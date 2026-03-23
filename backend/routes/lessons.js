const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireTeacher } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// Get lessons for a class
router.get('/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const lessons = await prisma.lesson.findMany({
      where: { class_id: classId },
      orderBy: { created_at: 'desc' }
    });
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Get single lesson details with blocks
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        blocks: {
          orderBy: { order_index: 'asc' }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// Generate lesson with AI (Teacher only)
router.post('/generate', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { topic, gradeLevel, targetDuration, referenceContent } = req.body;
    
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key is missing from environment variables' });
    }

    const systemPrompt = `You are a curriculum designer. Generate a highly interactive lesson in JSON format for the topic: "${topic}".

    Return exactly one JSON object with this top-level shape:
    {
      "title": "string",
      "blocks": [ ... ]
    }

    Use only these block types:
    1. "TEXT": Thorough explanations with clear headings.
    2. "CODE": Working JavaScript examples as a plain string (no markdown fences).
    3. "EXERCISE": Mid-lesson MCQ checks. Each option must include "feedback".
    4. "QUIZ": End-of-lesson competitive MCQ questions.
    5. "DISCUSSION": Thought-provoking prompts.
    6. "INTERACTIVE_SIMULATION": Flat HTML/CSS/JS simulation payload for a sandboxed iframe.

    INTERACTIVE_SIMULATION content MUST be a flat object with this schema:
    {
      "title": "Simulation title",
      "description": "What this simulation teaches",
      "hint": "Guidance for students",
      "solutionText": "Expected insight or final result",
      "html": "<div id=\\"app\\"></div>",
      "css": "/* custom CSS */",
      "js": "const { app, input, helpers } = context;\\n// Render into app",
      "libs": ["https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"],
      "height": 420,
      "inputJson": "{\\"key\\":\\"value\\"}"
    }

    Simulation constraints:
    - Keep code deterministic, safe, and classroom appropriate.
    - Use browser JavaScript only.
    - The runtime provides context.app, context.input, and context.helpers.
    - Do NOT use deprecated fields: canvasSandbox, sandbox, diagramType, nodes, edges, or steps.

    Content quality constraints:
    - Include a balanced sequence of explanation, practice, and assessment.
    - Include at least one EXERCISE, one CODE block, and one INTERACTIVE_SIMULATION block.
    - Put QUIZ blocks near the end of the lesson.

    Target Audience: ${gradeLevel || 'High School / College'}
    Estimated Time: ${targetDuration || '30'} minutes.
    ${referenceContent ? 'Reference Content to use: ' + referenceContent : ''}

    Return ONLY valid JSON.
    Do NOT include markdown, code fences, or commentary.`;

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Academic Atelier"
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "system", content: systemPrompt }]
      })
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await openRouterRes.json();
    let messageContent = data.choices[0].message.content.trim();
    
    // Attempt to extract JSON if the model ignored instructions and wrapped in markdown
    if (messageContent.startsWith('```')) {
      messageContent = messageContent.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    const lessonData = JSON.parse(messageContent);
    res.json(lessonData);
  } catch (err) {
    console.error('AI Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate lesson with AI' });
  }
});

// Create basic empty lesson (Teacher only)
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { class_id, title } = req.body;
    const { userId } = req.user;

    const targetClass = await prisma.class.findUnique({
      where: { id: class_id },
    });

    if (!targetClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (targetClass.teacher_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (targetClass.is_archived) {
      return res.status(400).json({ error: 'Cannot create lessons in an archived class' });
    }

    const newLesson = await prisma.lesson.create({
      data: {
        class_id,
        title,
        created_by: userId,
        status: 'DRAFT'
      }
    });

    res.status(201).json(newLesson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// Update lesson (Teacher only)
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, blocks } = req.body;
    const { userId } = req.user;

    // Verify ownership or access
    const existingLesson = await prisma.lesson.findUnique({
      where: { id },
      include: { class: true }
    });

    if (!existingLesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (existingLesson.class.teacher_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existingLesson.class.is_archived) {
      return res.status(400).json({ error: 'Cannot edit lessons in an archived class' });
    }

    // Use a transaction to update the lesson and replace its blocks
    const updatedLesson = await prisma.$transaction(async (tx) => {
      // 1. Update lesson details
      const lesson = await tx.lesson.update({
        where: { id },
        data: {
          title: title !== undefined ? title : existingLesson.title,
          status: status || existingLesson.status
        }
      });

      // 2. Delete all existing blocks for this lesson
      if (blocks !== undefined) {
        await tx.lessonBlock.deleteMany({
          where: { lesson_id: id }
        });

        // 3. Create new blocks with proper ordering
        if (blocks.length > 0) {
          const blocksData = blocks.map((block, index) => ({
            lesson_id: id,
            type: block.type,
            content: typeof block.content === 'object' ? JSON.stringify(block.content) : block.content,
            order_index: index
          }));

          await tx.lessonBlock.createMany({
            data: blocksData
          });
        }
      }

      // Return the complete updated lesson
      return await tx.lesson.findUnique({
        where: { id },
        include: {
          blocks: {
            orderBy: { order_index: 'asc' }
          }
        }
      });
    });

    res.json(updatedLesson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

module.exports = router;
