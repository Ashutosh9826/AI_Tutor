const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// Send message to AI Tutor
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { lessonId, messages } = req.body;
    
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key is missing' });
    }

    // Fetch lesson context
    let lessonContext = '';
    if (lessonId && lessonId !== 'demo-lesson') {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { blocks: { orderBy: { order_index: 'asc' } } }
      });
      
      if (lesson) {
        lessonContext = `You are a University-level Teaching Assistant for a lesson titled "${lesson.title}".\n`;
        lessonContext += `Here is the lesson content for context:\n`;
        lesson.blocks.forEach((block, i) => {
          lessonContext += `[Block ${i + 1} - ${block.type}]: ${block.content}\n`;
        });
      }
    } else {
        lessonContext = `You are a University-level Teaching Assistant. Provide academically rigorous guidance, use precise terminology, and guide students through reasoning rather than handing out direct answers.`;
    }

    // Format messages for OpenRouter
    const openRouterMessages = [
      {
        role: "system",
        content: `${lessonContext}\n\nYou must respond like a college professor: rigorous, concise, and conceptually precise. Use higher-education vocabulary, ask probing questions when useful, and avoid giving direct assignment answers when guided reasoning is possible.`
      }
    ];

    // Map incoming history
    // Expect incoming messages to look like: [{ sender: '', role: 'USER', text: '' }, ...]
    (messages || []).forEach(m => {
      openRouterMessages.push({
        role: m.role === 'ASSISTANT' || m.role === 'SYSTEM' ? 'assistant' : 'user',
        content: m.text
      });
    });

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
        messages: openRouterMessages,
        max_tokens: 500 // Increased tokens for better reasoning
      })
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await openRouterRes.json();
    const replyText = data.choices[0].message.content.trim();

    res.json({ text: replyText });
  } catch (err) {
    console.error('Chat AI Error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Evaluate student written answer
router.post('/evaluate-answer', authenticateToken, async (req, res) => {
  try {
    const { question, idealAnswer, studentAnswer } = req.body;
    
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key is missing' });
    }

    const systemPrompt = `You are a strict but fair university professor evaluating a student's answer.
Question: "${question}"
Ideal Answer: "${idealAnswer}"
Student Answer: "${studentAnswer}"

Provide a score out of 10 based on conceptual accuracy, depth of reasoning, and alignment with the ideal answer. First, provide concise but academically rigorous feedback. Then, on a new line at the very end, write strictly "SCORE: X/10" where X is the score (decimals allowed, e.g. 8.5).`;

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: systemPrompt }],
        max_tokens: 300
      })
    });

    if (!openRouterRes.ok) throw new Error('API Error');
    const data = await openRouterRes.json();
    const replyText = data.choices[0].message.content.trim();
    
    const scoreMatch = replyText.match(/SCORE:\s*([\d.]+)\/10/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
    
    res.json({ feedback: replyText, score });
  } catch (err) {
    console.error('Evaluate AI Error:', err);
    res.status(500).json({ error: 'Failed to evaluate answer' });
  }
});

module.exports = router;
