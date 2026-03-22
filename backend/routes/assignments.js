const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireTeacher } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

// Get assignments for a class
router.get('/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { userId, role } = req.user;
    const assignments = await prisma.assignment.findMany({
      where: { class_id: classId },
      orderBy: { due_date: 'asc' },
      ...(role === 'STUDENT'
        ? {
            include: {
              submissions: {
                where: { student_id: userId },
                select: { id: true }
              }
            }
          }
        : {})
    });

    if (role === 'STUDENT') {
      const studentAssignments = assignments.map((assignment) => {
        const { submissions, ...rest } = assignment;
        return {
          ...rest,
          completed: submissions.length > 0
        };
      });
      return res.json(studentAssignments);
    }

    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get single assignment details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        class: { select: { name: true } },
        submissions: {
          where: { student_id: req.user.userId }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Create assignment (Teacher only)
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { class_id, title, description, due_date, attachment_url } = req.body;
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
      return res.status(400).json({ error: 'Cannot create assignments in an archived class' });
    }

    const newAssignment = await prisma.assignment.create({
      data: {
        class_id,
        title,
        description,
        due_date: due_date ? new Date(due_date) : null,
        attachment_url
      }
    });

    res.status(201).json(newAssignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Student Submit Assignment
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { file_url } = req.body;
    const { userId, role } = req.user;

    if (role === 'TEACHER') {
      return res.status(403).json({ error: 'Teachers cannot submit assignments' });
    }

    const submission = await prisma.submission.create({
      data: {
        assignment_id: id,
        student_id: userId,
        file_url
      }
    });

    res.status(201).json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit assignment' });
  }
});

// Teacher Get All Submissions for Assignment
router.get('/:id/submissions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if teacher owns the class
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { class: true }
    });

    if (!assignment || assignment.class.teacher_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const submissions = await prisma.submission.findMany({
      where: { assignment_id: id },
      include: {
        student: { select: { id: true, name: true, email: true } }
      },
      orderBy: { submitted_at: 'desc' }
    });

    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Teacher Grade Submission
router.put('/submissions/:submissionId/grade', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        grade: parseFloat(grade),
        feedback
      }
    });

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to grade submission' });
  }
});

module.exports = router;
