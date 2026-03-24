const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ override: true });
const { registerRealtimeHandlers } = require('./realtime/registerRealtimeHandlers');

const app = express();
const server = http.createServer(app);
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions = {
  origin: frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST']
};
const io = new Server(server, {
  cors: corsOptions
});
const prisma = new PrismaClient({ log: ['info', 'warn', 'error'] });
const PORT = process.env.PORT || 5000;

app.use(cors(corsOptions));
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

async function configureRedisAdapter() {
  if (!process.env.REDIS_URL) {
    return;
  }

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
}

async function startServer() {
  await configureRedisAdapter();
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
