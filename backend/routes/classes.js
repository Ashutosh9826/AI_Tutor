const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireTeacher } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// Get classes for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    
    if (role === 'TEACHER') {
      const classes = await prisma.class.findMany({
        where: { teacher_id: userId },
        include: { _count: { select: { enrollments: true } } }
      });
      return res.json(classes);
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { user_id: userId },
        include: {
          class: {
            include: { teacher: { select: { name: true } } }
          }
        }
      });
      return res.json(enrollments.map(e => e.class));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Create class (Teacher only)
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { name, section } = req.body;
    const { userId } = req.user;

    // Generate random 6-char code
    const class_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newClass = await prisma.class.create({
      data: {
        name,
        section,
        class_code,
        teacher_id: userId
      }
    });

    res.status(201).json(newClass);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Join class by code (Student)
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { class_code } = req.body;
    const { userId, role } = req.user;

    if (role === 'TEACHER') {
      return res.status(403).json({ error: 'Teachers cannot join classes as students' });
    }

    const targetClass = await prisma.class.findUnique({
      where: { class_code }
    });

    if (!targetClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { user_id: userId, class_id: targetClass.id }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this class' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        user_id: userId,
        class_id: targetClass.id
      }
    });

    res.status(200).json({ message: 'Successfully joined class', class_id: targetClass.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join class' });
  }
});

module.exports = router;
