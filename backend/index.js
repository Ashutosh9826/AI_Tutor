const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const activeQuizSessions = {}; // { blockId: { startTime: timestamp, timeLimit: seconds } }
const prisma = new PrismaClient({ log: ['info', 'warn', 'error'] });
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.send('Academic Atelier Backend API is running!');
});

// Import routers
const authRoutes = require('./routes/auth');
const classesRoutes = require('./routes/classes');
const assignmentsRoutes = require('./routes/assignments');
const lessonsRoutes = require('./routes/lessons');
const chatRoutes = require('./routes/chat');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/lesson-chat', chatRoutes);

// Example route to get all classes
app.get('/classes', async (req, res) => {
  try {
    const classes = await prisma.class.findMany();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_lesson', async (lessonId) => {
    socket.join(lessonId);
    console.log(`User ${socket.id} joined lesson ${lessonId}`);
    socket.to(lessonId).emit('user_joined', { id: socket.id }); // Keep original user_joined emit

    // Send updated attendance
    const sockets = await io.in(lessonId).fetchSockets();
    io.to(lessonId).emit('attendance_updated', { count: sockets.length });
  });

  socket.on('send_message', (data) => {
    // data: { lessonId, message, user }
    io.to(data.lessonId).emit('receive_message', data);
  });

  // Quiz Synchronization
  socket.on('start_quiz', (data) => {
    // data: { lessonId, blockId, timeLimit: 30 }
    activeQuizSessions[data.blockId] = { startTime: Date.now(), timeLimit: data.timeLimit || 30 };
    io.to(data.lessonId).emit('quiz_started', data);
  });

  socket.on('stop_quiz', (data) => {
    delete activeQuizSessions[data.blockId];
    io.to(data.lessonId).emit('quiz_stopped', data);
  });

  socket.on('submit_answer', (data) => {
    // data: { lessonId, blockId, optionIndex, userId, userName, pointsEarned }
    const session = activeQuizSessions[data.blockId];
    let score = 0;
    
    if (data.pointsEarned !== undefined) {
      score = data.pointsEarned;
    } else if (session) {
      const timeElapsed = (Date.now() - session.startTime) / 1000;
      const timeLeft = Math.max(0, session.timeLimit - timeElapsed);
      // Base score 1000 if correct, plus speed bonus
      score = 1000 + Math.round(timeLeft * 50); 
    }

    io.to(data.lessonId).emit('answer_received', { ...data, score });
  });

  socket.on('chat_lock', (data) => {
    io.to(data.lessonId).emit('chat_locked', data);
  });

  socket.on('chat_unlock', (data) => {
    io.to(data.lessonId).emit('chat_unlocked', data);
  });

  // Session-wide controls for competition and podium display
  socket.on('start_final_quiz', (data) => {
    io.to(data.lessonId).emit('start_final_quiz', data);
  });

  socket.on('show_leaderboard', (data) => {
    io.to(data.lessonId).emit('show_leaderboard', data);
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(async (room) => {
      if (room !== socket.id) {
        const sockets = await io.in(room).fetchSockets();
        io.to(room).emit('attendance_updated', { count: Math.max(0, sockets.length - 1) });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
