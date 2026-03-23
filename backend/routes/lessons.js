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
    
    The lesson should have a mix of the following block types:
    1. 'TEXT': Thorough explanations with clear headings.
    2. 'CODE': Working code examples (mostly JavaScript/Python style for this demo).
    3. 'EXERCISE': Individual 'Check for Understanding' MCQ questions. These should be placed mid-content. EACH option must include a 'feedback' string explaining why it is correct or incorrect.
    4. 'QUIZ': A set of 3-5 challenging questions for the END of the lesson (this will be the live competitive part).
    5. 'DISCUSSION': Thought-provoking prompts.
    6. 'INTERACTIVE_SIMULATION': A general programmable simulation sandbox block where JavaScript code returns interactive states/steps, visuals, and explanations.
       - Use this for algorithms, flowcharts, graphs, trees, state machines, timelines, DP tables, recursion trees, architecture diagrams, and any process animation.
       - Content schema for this block should be a JSON object with:
         {
           "title": "Simulation title",
           "diagramType": "GRAPH | FLOWCHART | TREE | STATE_MACHINE | STEP_PROCESS | ALGORITHM | TIMELINE | DECISION_DIAGRAM | DP_TABLE | RECURSION_TREE | SYSTEM_ARCHITECTURE",
           "description": "What this simulation teaches",
           "hint": "Guidance for students",
           "solutionText": "Expected insight or final result",
           "sandbox": {
             "enabled": true,
	             "inputJson": "{\"key\":\"value\"}",
             "code": "JavaScript function body that uses context.input/context.helpers and RETURNS a simulation object."
           }
         }
       - The returned simulation object from sandbox code can include:
         nodes, edges, steps, table, timeline, description, hint, solutionText, title, diagramType.
       - Keep code safe, deterministic, and classroom-appropriate.

    Target Audience: ${gradeLevel || 'High School / College'}
    Estimated Time: ${targetDuration || '30'} minutes.
    ${referenceContent ? `Reference Content to use: ${referenceContent}` : ''}

    JSON Structure Example:
    {
      "title": "A catchy, educational title",
      "blocks": [
        { "type": "TEXT", "content": "Markdown text..." },
        { "type": "EXERCISE", "content": { "question": "...", "options": [{ "text": "...", "isCorrect": true, "feedback": "..." }] } },
        { "type": "CODE", "content": "..." },
	        { "type": "INTERACTIVE_SIMULATION", "content": { "title": "...", "diagramType": "GRAPH", "sandbox": { "enabled": true, "inputJson": "{\"start\":\"A\"}", "code": "const { input, helpers } = context; return { nodes: [], edges: [], steps: [] };" } } },
        { "type": "QUIZ", "content": { "question": "...", "options": [...] } }
      ]
    }
    
    Ensure the content is premium, detailed, and pedagogically sound. Return ONLY valid JSON.
    DO NOT wrap in markdown backticks.`;

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
