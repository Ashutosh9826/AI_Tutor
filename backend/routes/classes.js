const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireTeacher } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

const parseArchivedFilter = (rawValue) => {
  const normalized = String(rawValue ?? 'false').toLowerCase();
  if (normalized === 'all') {
    return { includeAll: true, archivedOnly: false };
  }
  if (normalized === 'true') {
    return { includeAll: false, archivedOnly: true };
  }
  return { includeAll: false, archivedOnly: false };
};

const getTeacherOwnedClass = async (classId, teacherId) => {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!cls) {
    return { notFound: true, classRecord: null };
  }

  if (cls.teacher_id !== teacherId) {
    return { notFound: false, forbidden: true, classRecord: null };
  }

  return { notFound: false, forbidden: false, classRecord: cls };
};

// Get classes for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { includeAll, archivedOnly } = parseArchivedFilter(req.query.archived);

    if (role === 'TEACHER') {
      const where = { teacher_id: userId };
      if (!includeAll) {
        where.is_archived = archivedOnly;
      }

      const classes = await prisma.class.findMany({
        where,
        include: { _count: { select: { enrollments: true } } },
        orderBy: [{ name: 'asc' }],
      });
      return res.json(classes);
    }

    const where = {
      enrollments: {
        some: { user_id: userId },
      },
    };

    if (!includeAll) {
      where.is_archived = archivedOnly;
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        teacher: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    return res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get class details by id (for class stream + archived state)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });

    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (role === 'TEACHER') {
      if (cls.teacher_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.json(cls);
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        user_id: userId,
        class_id: id,
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(cls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class' });
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
        teacher_id: userId,
      },
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
      where: { class_code },
    });

    if (!targetClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (targetClass.is_archived) {
      return res.status(400).json({ error: 'Cannot join an archived class' });
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { user_id: userId, class_id: targetClass.id },
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this class' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        user_id: userId,
        class_id: targetClass.id,
      },
    });

    res.status(200).json({ message: 'Successfully joined class', class_id: targetClass.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join class' });
  }
});

// Archive class (Teacher only, owner only)
router.patch('/:id/archive', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const ownership = await getTeacherOwnedClass(id, userId);
    if (ownership.notFound) {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (ownership.forbidden) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        is_archived: true,
        archived_at: new Date(),
      },
      include: { _count: { select: { enrollments: true } } },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to archive class' });
  }
});

// Unarchive class (Teacher only, owner only)
router.patch('/:id/unarchive', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const ownership = await getTeacherOwnedClass(id, userId);
    if (ownership.notFound) {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (ownership.forbidden) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        is_archived: false,
        archived_at: null,
      },
      include: { _count: { select: { enrollments: true } } },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to unarchive class' });
  }
});

module.exports = router;
