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

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_PLACEHOLDER_VALUES = new Set([
  '',
  'replace_me',
  'your_openrouter_api_key',
  'your_openrouter_key',
  'changeme',
]);

const getOpenRouterApiKey = () => String(process.env.OPENROUTER_API_KEY || '').trim();
const hasUsableOpenRouterApiKey = () =>
  !OPENROUTER_PLACEHOLDER_VALUES.has(getOpenRouterApiKey().toLowerCase());

const getDefaultQuizContent = () => ({
  question: 'What is the most important idea from this lesson section?',
  options: [
    { text: 'Main concept and how to apply it', isCorrect: true, feedback: 'Correct. Focus on understanding and application.' },
    { text: 'Memorizing random details only', isCorrect: false, feedback: 'Not quite. Conceptual understanding matters more.' },
  ],
  timeLimit: 30,
});

const getDefaultExerciseContent = () => ({
  question: 'Choose the best explanation based on the lesson.',
  options: [
    { text: 'A concept-based explanation', isCorrect: true, feedback: 'Nice work. This aligns with the concept.' },
    { text: 'An unrelated explanation', isCorrect: false, feedback: 'Try again by focusing on the lesson idea.' },
  ],
});

const getDefaultWrittenQuizContent = () => ({
  question: 'Explain the core idea in your own words.',
  idealAnswer: 'A clear explanation of the central concept and one practical example.',
});

const getDefaultSimulationContent = () => ({
  title: 'Interactive Simulation',
  description: 'Explore the concept with a simple interactive model.',
  hint: 'Change the control values and observe how the state changes.',
  solutionText: 'The simulation state should update consistently with user input.',
  html: '<div id="app"></div>',
  css: '',
  js: `const { app, input, helpers } = context;
helpers.setState({ value: input.value ?? 50 }, "initial");

const wrapper = helpers.el("div");
const valueLabel = helpers.el("p", { class: "sim-subtitle" }, "");
const slider = helpers.el("input", {
  type: "range",
  min: "0",
  max: "100",
  value: String(input.value ?? 50),
  style: { width: "100%" },
});

const render = (value) => {
  valueLabel.textContent = "Current value: " + value;
  app.style.background = "linear-gradient(90deg, #dbeafe " + value + "%, #eff6ff " + value + "%)";
  app.style.padding = "16px";
  app.style.borderRadius = "10px";
  helpers.setState({ value }, "slider changed");
};

slider.addEventListener("input", (e) => render(Number(e.target.value)));
wrapper.append(valueLabel, slider);
app.innerHTML = "";
app.appendChild(wrapper);
render(Number(slider.value));`,
  libs: [],
  height: 420,
  inputJson: '{"value":50}',
});

const toObjectOrNull = (value) => {
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

const normalizeType = (type) => {
  const t = String(type || '').trim().toUpperCase();
  return ALLOWED_BLOCK_TYPES.has(t) ? t : 'TEXT';
};

const normalizeQuizLikeContent = (rawContent, blockType) => {
  const fallback = blockType === 'QUIZ' ? getDefaultQuizContent() : getDefaultExerciseContent();
  const content = toObjectOrNull(rawContent) || fallback;
  const optionsSource = Array.isArray(content.options) ? content.options : fallback.options;

  const options = optionsSource
    .map((option, index) => ({
      text: typeof option?.text === 'string' && option.text.trim() ? option.text.trim() : `Option ${index + 1}`,
      isCorrect: Boolean(option?.isCorrect),
      feedback:
        typeof option?.feedback === 'string' && option.feedback.trim()
          ? option.feedback.trim()
          : option?.isCorrect
          ? 'Correct.'
          : 'Try again.',
    }))
    .slice(0, 6);

  if (options.length < 2) {
    options.push(...fallback.options.slice(options.length));
  }

  if (!options.some((option) => option.isCorrect)) {
    options[0].isCorrect = true;
  }

  const normalized = {
    question:
      typeof content.question === 'string' && content.question.trim()
        ? content.question.trim()
        : fallback.question,
    options,
  };

  if (blockType === 'QUIZ') {
    normalized.timeLimit = Math.max(10, Number(content.timeLimit) || 30);
  }

  return normalized;
};

const normalizeSimulationContent = (rawContent) => {
  const fallback = getDefaultSimulationContent();
  const content = toObjectOrNull(rawContent) || fallback;
  const libsSource = Array.isArray(content.libs) ? content.libs : fallback.libs;

  return {
    title: typeof content.title === 'string' && content.title.trim() ? content.title.trim() : fallback.title,
    description:
      typeof content.description === 'string' && content.description.trim()
        ? content.description.trim()
        : fallback.description,
    hint: typeof content.hint === 'string' ? content.hint : fallback.hint,
    solutionText: typeof content.solutionText === 'string' ? content.solutionText : fallback.solutionText,
    html: typeof content.html === 'string' && content.html.trim() ? content.html : fallback.html,
    css: typeof content.css === 'string' ? content.css : fallback.css,
    js: typeof content.js === 'string' && content.js.trim() ? content.js : fallback.js,
    libs: libsSource.filter((lib) => typeof lib === 'string' && /^https?:\/\/\S+$/i.test(lib)),
    height: Math.max(280, Number(content.height) || fallback.height),
    inputJson:
      typeof content.inputJson === 'string'
        ? content.inputJson
        : JSON.stringify(content.inputJson ?? { value: 50 }),
  };
};

const normalizeGeneratedBlock = (rawBlock) => {
  const type = normalizeType(rawBlock?.type);
  const rawContent = rawBlock?.content;

  if (type === 'TEXT') {
    return {
      type,
      content: typeof rawContent === 'string' ? rawContent : String(rawContent ?? ''),
    };
  }

  if (type === 'DISCUSSION') {
    return {
      type,
      content:
        typeof rawContent === 'string' && rawContent.trim()
          ? rawContent.trim()
          : 'Discuss how this concept applies in a real-world scenario.',
    };
  }

  if (type === 'CODE') {
    if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
      const notebook = normalizeCodeNotebook(rawContent);
      if (notebook) {
        return { type, content: notebook };
      }
    }
    return {
      type,
      content:
        typeof rawContent === 'string' && rawContent.trim()
          ? rawContent
          : `// %%\nconsole.log("Example output for this lesson topic");`,
    };
  }

  if (type === 'EXERCISE' || type === 'QUIZ') {
    return {
      type,
      content: normalizeQuizLikeContent(rawContent, type),
    };
  }

  if (type === 'WRITTEN_QUIZ') {
    const fallback = getDefaultWrittenQuizContent();
    const content = toObjectOrNull(rawContent) || fallback;
    return {
      type,
      content: {
        question:
          typeof content.question === 'string' && content.question.trim()
            ? content.question.trim()
            : fallback.question,
        idealAnswer:
          typeof content.idealAnswer === 'string' && content.idealAnswer.trim()
            ? content.idealAnswer.trim()
            : fallback.idealAnswer,
      },
    };
  }

  if (type === 'INTERACTIVE_SIMULATION') {
    return {
      type,
      content: normalizeSimulationContent(rawContent),
    };
  }

  return { type: 'TEXT', content: '' };
};

const buildFallbackBlock = (type, topic, purpose) => {
  const safeTopic = String(topic || 'this topic');
  const safePurpose = String(purpose || '').trim();
  const suffix = safePurpose ? ` (${safePurpose})` : '';

  if (type === 'TEXT') {
    return {
      type,
      content: `This section explains ${safeTopic}${suffix}. Focus on the core ideas and one practical example.`,
    };
  }

  if (type === 'CODE') {
    return {
      type,
      content: `// %%\nconst topic = "${safeTopic.replace(/"/g, '\\"')}";\nconsole.log("Exploring:", topic);\n\n// %%\nconsole.table([{ concept: topic, takeaway: "Apply the idea to a simple scenario." }]);`,
    };
  }

  if (type === 'EXERCISE') {
    return { type, content: getDefaultExerciseContent() };
  }

  if (type === 'QUIZ') {
    return { type, content: getDefaultQuizContent() };
  }

  if (type === 'DISCUSSION') {
    return {
      type,
      content: `How would you explain ${safeTopic} to a classmate using your own example?`,
    };
  }

  if (type === 'WRITTEN_QUIZ') {
    return { type, content: getDefaultWrittenQuizContent() };
  }

  if (type === 'INTERACTIVE_SIMULATION') {
    return { type, content: getDefaultSimulationContent() };
  }

  return { type: 'TEXT', content: `Let's explore ${safeTopic}.` };
};

const enforceRequiredBlockCoverage = (blocks, topic) => {
  const nextBlocks = [...blocks];
  const hasType = (type) => nextBlocks.some((block) => block.type === type);

  if (!hasType('CODE')) {
    nextBlocks.push(buildFallbackBlock('CODE', topic, 'auto-added coverage'));
  }
  if (!hasType('EXERCISE')) {
    nextBlocks.push(buildFallbackBlock('EXERCISE', topic, 'auto-added coverage'));
  }
  if (!hasType('INTERACTIVE_SIMULATION')) {
    nextBlocks.push(buildFallbackBlock('INTERACTIVE_SIMULATION', topic, 'auto-added coverage'));
  }
  if (!hasType('QUIZ')) {
    nextBlocks.push(buildFallbackBlock('QUIZ', topic, 'final check'));
  }

  const firstQuizIndex = nextBlocks.findIndex((block) => block.type === 'QUIZ');
  if (firstQuizIndex !== -1 && firstQuizIndex < nextBlocks.length - 2) {
    const [quizBlock] = nextBlocks.splice(firstQuizIndex, 1);
    nextBlocks.push(quizBlock);
  }

  return nextBlocks;
};

const normalizeStructurePlan = (raw, topic, targetDuration) => {
  const fallbackSections = [
    { id: 'section-1', title: 'Introduction', goal: `Introduce ${topic}`, keyPoints: [`What is ${topic}?`] },
    { id: 'section-2', title: 'Core Concepts', goal: `Explain core ideas in ${topic}`, keyPoints: ['Core principle 1', 'Core principle 2'] },
    { id: 'section-3', title: 'Guided Practice', goal: `Practice ${topic}`, keyPoints: ['Worked example', 'Common mistakes'] },
    { id: 'section-4', title: 'Assessment & Wrap-Up', goal: `Check understanding of ${topic}`, keyPoints: ['Quick recap', 'Exit check'] },
  ];

  const sourceSections = Array.isArray(raw?.sections) && raw.sections.length > 0 ? raw.sections : fallbackSections;
  const safeDuration = Math.max(10, Number(targetDuration) || 30);
  const perSection = Math.max(5, Math.round(safeDuration / sourceSections.length));

  return {
    lessonTitle:
      typeof raw?.lessonTitle === 'string' && raw.lessonTitle.trim()
        ? raw.lessonTitle.trim()
        : `Lesson on ${topic}`,
    objectives: Array.isArray(raw?.objectives)
      ? raw.objectives.map((objective) => String(objective)).filter(Boolean).slice(0, 6)
      : [`Understand the key idea behind ${topic}`, `Apply ${topic} in one practical situation`],
    sections: sourceSections.map((section, index) => ({
      id:
        typeof section?.id === 'string' && section.id.trim()
          ? section.id.trim()
          : `section-${index + 1}`,
      title:
        typeof section?.title === 'string' && section.title.trim()
          ? section.title.trim()
          : `Section ${index + 1}`,
      goal:
        typeof section?.goal === 'string' && section.goal.trim()
          ? section.goal.trim()
          : `Teach section ${index + 1} of ${topic}`,
      durationMinutes: Math.max(3, Number(section?.durationMinutes) || perSection),
      keyPoints: Array.isArray(section?.keyPoints)
        ? section.keyPoints.map((point) => String(point)).filter(Boolean).slice(0, 6)
        : [],
    })),
  };
};

const normalizeBlockStrategyPlan = (raw, structurePlan) => {
  const indexById = new Map(structurePlan.sections.map((section, index) => [section.id, index]));
  const sections = structurePlan.sections.map((section, index) => {
    const rawSection = Array.isArray(raw?.sections)
      ? raw.sections.find((candidate) => candidate && candidate.id === section.id)
      : null;

    const fallbackTypes =
      index === 0
        ? ['TEXT']
        : index === structurePlan.sections.length - 1
        ? ['EXERCISE', 'QUIZ']
        : ['TEXT'];

    const rawBlocks = Array.isArray(rawSection?.blocks) ? rawSection.blocks : fallbackTypes.map((type) => ({ type }));
    const blocks = rawBlocks
      .map((block) => ({
        type: normalizeType(block?.type),
        purpose: typeof block?.purpose === 'string' ? block.purpose : '',
      }))
      .filter((block) => ALLOWED_BLOCK_TYPES.has(block.type));

    return {
      id: section.id,
      title: section.title,
      blocks: blocks.length > 0 ? blocks : fallbackTypes.map((type) => ({ type, purpose: '' })),
    };
  });

  const ensureInSection = (sectionIndex, blockType, purpose) => {
    if (sections.some((section) => section.blocks.some((block) => block.type === blockType))) {
      return;
    }
    const targetIndex = Math.max(0, Math.min(sectionIndex, sections.length - 1));
    sections[targetIndex].blocks.push({ type: blockType, purpose: purpose || '' });
  };

  ensureInSection(1, 'CODE', 'Demonstrate concept through runnable example');
  ensureInSection(Math.max(1, sections.length - 2), 'EXERCISE', 'Check understanding before the end');
  ensureInSection(Math.max(1, sections.length - 2), 'INTERACTIVE_SIMULATION', 'Interactive visualization of state changes');
  ensureInSection(sections.length - 1, 'QUIZ', 'End-of-lesson assessment');

  // Keep QUIZ near the end.
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex < sections.length - 1) {
      section.blocks = section.blocks.filter((block) => block.type !== 'QUIZ');
    }
  });
  ensureInSection(sections.length - 1, 'QUIZ', 'End-of-lesson assessment');

  return {
    lessonTitle:
      typeof raw?.lessonTitle === 'string' && raw.lessonTitle.trim()
        ? raw.lessonTitle.trim()
        : structurePlan.lessonTitle,
    sections,
    sectionOrder: structurePlan.sections.map((section) => section.id),
    indexById,
  };
};

const normalizeFinalLessonData = (raw, structurePlan, strategyPlan, topic) => {
  const title =
    typeof raw?.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : structurePlan.lessonTitle || `Lesson on ${topic}`;

  let blocks = [];

  if (Array.isArray(raw?.blocks) && raw.blocks.length > 0) {
    blocks = raw.blocks.map(normalizeGeneratedBlock);
  } else {
    const fallbackBlocks = [];
    strategyPlan.sections.forEach((section) => {
      section.blocks.forEach((block) => {
        fallbackBlocks.push(buildFallbackBlock(block.type, topic, block.purpose || section.title));
      });
    });
    blocks = fallbackBlocks.map(normalizeGeneratedBlock);
  }

  if (blocks.length === 0) {
    blocks = [
      normalizeGeneratedBlock(buildFallbackBlock('TEXT', topic, 'introduction')),
      normalizeGeneratedBlock(buildFallbackBlock('CODE', topic, 'example')),
      normalizeGeneratedBlock(buildFallbackBlock('EXERCISE', topic, 'practice')),
      normalizeGeneratedBlock(buildFallbackBlock('INTERACTIVE_SIMULATION', topic, 'simulation')),
      normalizeGeneratedBlock(buildFallbackBlock('QUIZ', topic, 'assessment')),
    ];
  }

  blocks = enforceRequiredBlockCoverage(blocks, topic);

  return { title, blocks };
};

const callOpenRouterForJson = async ({ systemPrompt, userPrompt }) => {
  const apiKey = getOpenRouterApiKey();
  const openRouterRes = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Academic Atelier',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!openRouterRes.ok) {
    let providerErrorText = await openRouterRes.text();
    try {
      const parsedError = JSON.parse(providerErrorText);
      providerErrorText =
        parsedError?.error?.message ||
        parsedError?.message ||
        providerErrorText;
    } catch {
      // Keep raw text if provider response is not JSON.
    }

    const error = new Error(
      `OpenRouter API Error (${openRouterRes.status}): ${providerErrorText}`,
    );
    error.status = openRouterRes.status;
    throw error;
  }

  const data = await openRouterRes.json();
  const messageContent = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonPayload(messageContent);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenRouter returned invalid JSON payload');
  }
  return parsed;
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

    if (!hasUsableOpenRouterApiKey()) {
      return res.status(500).json({
        error:
          'AI service is not configured. Set a valid OPENROUTER_API_KEY in backend/.env and restart the backend.',
      });
    }

    const safeTopic = String(topic || '').trim() || 'Untitled Topic';
    const audience = String(gradeLevel || 'High School / College').trim();
    const durationMinutes = Math.max(10, Number(targetDuration) || 30);
    const reference = String(referenceContent || '').trim();

    // Step 1 — Structure: lesson outline and section flow.
    const structureSystemPrompt = `You are a curriculum architect.
Create only the high-level lesson structure.

Return ONLY valid JSON with this shape:
{
  "lessonTitle": "string",
  "objectives": ["string"],
  "sections": [
    {
      "id": "section-1",
      "title": "string",
      "goal": "string",
      "durationMinutes": 8,
      "keyPoints": ["string"]
    }
  ]
}

Rules:
- 3 to 6 sections.
- Keep section flow logical from introduction to assessment.
- Do not generate detailed block content in this step.
- Do not include markdown or commentary.`;

    const structureUserPrompt = `Topic: ${safeTopic}
Target audience: ${audience}
Target duration (minutes): ${durationMinutes}
${reference ? `Reference content:\n${reference}` : 'Reference content: none'}`;

    const rawStructurePlan = await callOpenRouterForJson({
      systemPrompt: structureSystemPrompt,
      userPrompt: structureUserPrompt,
    });
    const structurePlan = normalizeStructurePlan(rawStructurePlan, safeTopic, durationMinutes);

    // Step 2 — Block Strategy: decide where each block type goes.
    const blockStrategySystemPrompt = `You are a lesson planner.
You will receive a lesson structure and must assign block types to each section.

Allowed block types only:
TEXT, CODE, EXERCISE, QUIZ, DISCUSSION, WRITTEN_QUIZ, INTERACTIVE_SIMULATION

Return ONLY valid JSON with this shape:
{
  "lessonTitle": "string",
  "sections": [
    {
      "id": "section-1",
      "title": "string",
      "blocks": [
        { "type": "TEXT", "purpose": "string" }
      ]
    }
  ]
}

Rules:
- Keep QUIZ near the end.
- Include at least one CODE, one EXERCISE, and one INTERACTIVE_SIMULATION across the lesson.
- Keep each section focused; usually 1-3 blocks per section.
- Do not include detailed block content in this step.
- Do not include markdown or commentary.`;

    const blockStrategyUserPrompt = `Topic: ${safeTopic}
Target audience: ${audience}
Target duration (minutes): ${durationMinutes}
Lesson structure JSON:
${JSON.stringify(structurePlan, null, 2)}
${reference ? `Reference content:\n${reference}` : 'Reference content: none'}`;

    const rawBlockStrategy = await callOpenRouterForJson({
      systemPrompt: blockStrategySystemPrompt,
      userPrompt: blockStrategyUserPrompt,
    });
    const strategyPlan = normalizeBlockStrategyPlan(rawBlockStrategy, structurePlan);

    // Step 3 — Full Lesson: generate detailed content based on structure + block strategy.
    const fullLessonSystemPrompt = `You are a curriculum content generator.
Generate the full lesson content based on the provided structure and block strategy.

Return ONLY valid JSON with this exact top-level shape:
{
  "title": "string",
  "blocks": [
    { "type": "TEXT", "content": "..." }
  ]
}

Use only these block types:
1. TEXT
2. CODE
3. EXERCISE
4. QUIZ
5. DISCUSSION
6. WRITTEN_QUIZ
7. INTERACTIVE_SIMULATION

Block content requirements:
- TEXT: clear, concise explanation text.
- CODE: notebook-ready JavaScript as plain string. For multiple runnable sections, separate with lines that start with "// %%".
- EXERCISE: object with "question" and "options"; each option includes "text", "isCorrect", and "feedback".
- QUIZ: object with "question", "options", and "timeLimit".
- DISCUSSION: thought-provoking prompt string.
- WRITTEN_QUIZ: object with "question" and "idealAnswer".
- INTERACTIVE_SIMULATION: object with:
  "title","description","hint","solutionText","html","css","js","libs","height","inputJson"
  Use context.app, context.input, context.helpers in js.

Quality requirements:
- Keep content classroom-safe and deterministic.
- Match the given section order and block placement.
- Do not include markdown fences or commentary.`;

    const fullLessonUserPrompt = `Topic: ${safeTopic}
Target audience: ${audience}
Target duration (minutes): ${durationMinutes}
Lesson structure JSON:
${JSON.stringify(structurePlan, null, 2)}

Block strategy JSON:
${JSON.stringify(
  {
    lessonTitle: strategyPlan.lessonTitle,
    sections: strategyPlan.sections,
  },
  null,
  2
)}
${reference ? `\nReference content:\n${reference}` : ''}`;

    const rawFullLesson = await callOpenRouterForJson({
      systemPrompt: fullLessonSystemPrompt,
      userPrompt: fullLessonUserPrompt,
    });
    const lessonData = normalizeFinalLessonData(rawFullLesson, structurePlan, strategyPlan, safeTopic);

    res.json(lessonData);
  } catch (err) {
    console.error('AI Generation Error:', err);

    if (err?.status === 401 || err?.status === 403) {
      return res.status(502).json({
        error:
          'AI provider rejected credentials. Update OPENROUTER_API_KEY in backend/.env and restart the backend.',
      });
    }

    if (String(err?.message || '').includes('invalid JSON payload')) {
      return res.status(502).json({
        error:
          'AI provider returned malformed JSON. Please try generating again.',
      });
    }

    return res.status(500).json({
      error:
        'Failed to generate lesson with AI. Check backend logs for details.',
    });
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

    if (!hasUsableOpenRouterApiKey()) {
      return res.status(500).json({
        error:
          'AI service is not configured. Set a valid OPENROUTER_API_KEY in backend/.env and restart the backend.',
      });
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
        Authorization: `Bearer ${getOpenRouterApiKey()}`,
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
      let providerErrorText = await openRouterRes.text();
      try {
        const parsedError = JSON.parse(providerErrorText);
        providerErrorText =
          parsedError?.error?.message ||
          parsedError?.message ||
          providerErrorText;
      } catch {
        // Keep raw text if provider response is not JSON.
      }

      const error = new Error(
        `OpenRouter API Error (${openRouterRes.status}): ${providerErrorText}`,
      );
      error.status = openRouterRes.status;
      throw error;
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

    if (err?.status === 401 || err?.status === 403) {
      return res.status(502).json({
        error:
          'AI provider rejected credentials. Update OPENROUTER_API_KEY in backend/.env and restart the backend.',
      });
    }

    return res.status(500).json({
      error:
        'Failed to refine block with AI. Check backend logs for details.',
    });
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
