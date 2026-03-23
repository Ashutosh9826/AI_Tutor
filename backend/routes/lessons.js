const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireTeacher } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const JSON_CONTENT_BLOCK_TYPES = new Set([
  'QUIZ',
  'EXERCISE',
  'WRITTEN_QUIZ',
  'INTERACTIVE_SIMULATION',
]);

const ALLOWED_BLOCK_TYPES = new Set([
  'TEXT',
  'CODE',
  'EXERCISE',
  'QUIZ',
  'DISCUSSION',
  'WRITTEN_QUIZ',
  'INTERACTIVE_SIMULATION',
]);

const extractJsonPayload = (rawText) => {
  let cleaned = String(rawText || '').trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```$/, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const parsePossiblyJson = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeCodeNotebook = (candidate) => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  if (!Array.isArray(candidate.cells)) {
    return null;
  }

  const normalizedCells = candidate.cells.map((cell, index) => ({
    id:
      typeof cell?.id === 'string' && cell.id.trim()
        ? cell.id.trim()
        : `cell-${index + 1}`,
    title:
      typeof cell?.title === 'string' && cell.title.trim()
        ? cell.title.trim()
        : `Cell ${index + 1}`,
    code: typeof cell?.code === 'string' ? cell.code : '',
  }));

  return {
    version: Number(candidate.version) || 1,
    language: typeof candidate.language === 'string' ? candidate.language : 'javascript',
    runtime: typeof candidate.runtime === 'string' ? candidate.runtime : 'browser-js',
    cells: normalizedCells.length > 0 ? normalizedCells : [{ id: 'cell-1', title: 'Cell 1', code: '' }],
  };
};

const normalizeRefinedContent = (blockType, originalContent, candidate) => {
  if (blockType === 'CODE') {
    const originalAsNotebook = parsePossiblyJson(originalContent);
    const originalWasNotebook = Boolean(originalAsNotebook && Array.isArray(originalAsNotebook.cells));

    if (originalWasNotebook) {
      const normalized = normalizeCodeNotebook(candidate);
      if (normalized) return normalized;

      if (typeof candidate === 'string') {
        return {
          version: 1,
          language: 'javascript',
          runtime: 'browser-js',
          cells: [{ id: 'cell-1', title: 'Cell 1', code: candidate }],
        };
      }

      return originalAsNotebook;
    }

    if (typeof candidate === 'string') {
      return candidate;
    }

    const normalized = normalizeCodeNotebook(candidate);
    if (normalized) return normalized;

    return typeof originalContent === 'string' ? originalContent : '';
  }

  if (JSON_CONTENT_BLOCK_TYPES.has(blockType)) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate;
    }
    const fallback = parsePossiblyJson(originalContent);
    return fallback || {};
  }

  if (typeof candidate === 'string') {
    return candidate;
  }
  return typeof originalContent === 'string' ? originalContent : '';
};

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
    2. "CODE": Notebook-ready JavaScript. Use plain text code (no markdown fences). For multiple runnable sections, separate cells with lines that start with "// %%".
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
    - Use built-in helpers for clear state visualization:
      - context.helpers.setState({ ... }, "label")
      - context.helpers.replaceState({ ... }, "label")
      - context.helpers.emitStep("label", { ... })
      - context.helpers.log("message")
    - Include obvious controls in the simulation UI (buttons/sliders/inputs) and visually reflect changing state.
    - Keep simulation configuration minimal and easy to read.
    - Do NOT use deprecated fields: canvasSandbox, sandbox, diagramType, nodes, edges, or steps.

    CODE block constraints:
    - Must run directly in a browser JavaScript runtime.
    - May use direct ESM imports from URLs or package names (for example: import * as d3 from "d3";).
    - Keep setup minimal so students can run and modify instantly.

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

// Refine one lesson block with AI (Teacher only, affects only provided block content)
router.post('/:id/refine-block', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { blockType, blockContent, instructions } = req.body;

    if (!ALLOWED_BLOCK_TYPES.has(blockType)) {
      return res.status(400).json({ error: 'Unsupported block type for AI refinement' });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key is missing from environment variables' });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (lesson.class.teacher_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (lesson.class.is_archived) {
      return res.status(400).json({ error: 'Cannot edit lessons in an archived class' });
    }

    const currentContent =
      typeof blockContent === 'object' ? JSON.stringify(blockContent, null, 2) : String(blockContent || '');

    const systemPrompt = `You are an expert curriculum editor helping a teacher improve exactly one lesson block.

Hard requirements:
1. Edit ONLY the provided block content.
2. Never reference other lesson blocks.
3. Keep the same blockType.
4. Keep output concise, classroom-ready, and aligned to teacher instructions.
5. Return ONLY valid JSON with this shape: {"content": ...}

Block type schema rules:
- TEXT: content must be a string.
- DISCUSSION: content must be a short discussion prompt string.
- CODE: content can be either:
  a) string JavaScript code, or
  b) notebook object: {"version":1,"language":"javascript","runtime":"browser-js","cells":[{"id":"...","title":"...","code":"..."}]}
- EXERCISE or QUIZ: content object with "question", "options" (array), and optional "timeLimit". Each option should keep "text", "isCorrect", and "feedback" when relevant.
- WRITTEN_QUIZ: content object with "question" and "idealAnswer".
- INTERACTIVE_SIMULATION: content object with:
  "title","description","hint","solutionText","html","css","js","libs","height","inputJson".
  Use context.app, context.input, context.helpers in js.

Output must be JSON only, without markdown fences or commentary.`;

    const userPrompt = `Lesson title: ${lesson.title}
Block type: ${blockType}
Teacher instructions: ${String(instructions || '').trim() || 'Improve clarity and quality while preserving intent.'}

Current block content:
${currentContent}`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Academic Atelier',
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await openRouterRes.json();
    const messageContent = data?.choices?.[0]?.message?.content || '';
    const parsedPayload = extractJsonPayload(messageContent);

    if (!parsedPayload || typeof parsedPayload !== 'object') {
      return res.status(502).json({ error: 'AI returned invalid block format' });
    }

    const candidate = Object.prototype.hasOwnProperty.call(parsedPayload, 'content')
      ? parsedPayload.content
      : parsedPayload;

    const refinedContent = normalizeRefinedContent(blockType, blockContent, candidate);

    return res.json({ content: refinedContent });
  } catch (err) {
    console.error('AI Refine Block Error:', err);
    return res.status(500).json({ error: 'Failed to refine block with AI' });
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

// Delete lesson (Teacher only, owner only)
router.delete('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (lesson.class.teacher_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      const sessions = await tx.quizSession.findMany({
        where: { lesson_id: id },
        select: { id: true },
      });
      const sessionIds = sessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        await tx.quizResponse.deleteMany({
          where: {
            session_id: {
              in: sessionIds,
            },
          },
        });
      }

      await tx.quizSession.deleteMany({
        where: { lesson_id: id },
      });

      await tx.chatMessage.deleteMany({
        where: { lesson_id: id },
      });

      await tx.lessonBlock.deleteMany({
        where: { lesson_id: id },
      });

      await tx.lesson.delete({
        where: { id },
      });
    });

    return res.json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete lesson' });
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
