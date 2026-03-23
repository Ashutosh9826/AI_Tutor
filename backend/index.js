const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const { registerRealtimeHandlers } = require('./realtime/registerRealtimeHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
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
const attendanceRoutes = require('./routes/attendance');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/lesson-chat', chatRoutes);
app.use('/api/attendance', attendanceRoutes);

// Example route to get all classes
app.get('/classes', async (req, res) => {
  try {
    const classes = await prisma.class.findMany();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

registerRealtimeHandlers(io);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
