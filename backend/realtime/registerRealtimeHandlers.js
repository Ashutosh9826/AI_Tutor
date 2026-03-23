const {
  addClassPresence: addClassPresenceDefault,
  removeClassPresence: removeClassPresenceDefault,
  removeSocketPresence: removeSocketPresenceDefault,
  getOnlineStudentIdsForClass: getOnlineStudentIdsForClassDefault,
} = require('../services/presenceStore');

function normalizeId(value) {
  return String(value || '').trim();
}

function registerRealtimeHandlers(io, deps = {}) {
  const now = typeof deps.now === 'function' ? deps.now : Date.now;
  const addClassPresence = deps.addClassPresence || addClassPresenceDefault;
  const removeClassPresence = deps.removeClassPresence || removeClassPresenceDefault;
  const removeSocketPresence = deps.removeSocketPresence || removeSocketPresenceDefault;
  const getOnlineStudentIdsForClass =
    deps.getOnlineStudentIdsForClass || getOnlineStudentIdsForClassDefault;
  const activeQuizSessions = deps.activeQuizSessions || {};

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_lesson', async (lessonId) => {
      const lessonRoom = normalizeId(lessonId);
      if (!lessonRoom) {
        return;
      }

      socket.join(lessonRoom);
      console.log(`User ${socket.id} joined lesson ${lessonRoom}`);
      socket.to(lessonRoom).emit('user_joined', { id: socket.id });

      const sockets = await io.in(lessonRoom).fetchSockets();
      io.to(lessonRoom).emit('attendance_updated', { count: sockets.length });
    });

    socket.on('send_message', (data) => {
      io.to(data.lessonId).emit('receive_message', data);
    });

    socket.on('start_quiz', (data) => {
      activeQuizSessions[data.blockId] = {
        startTime: now(),
        timeLimit: data.timeLimit || 30,
      };
      io.to(data.lessonId).emit('quiz_started', data);
    });

    socket.on('stop_quiz', (data) => {
      delete activeQuizSessions[data.blockId];
      io.to(data.lessonId).emit('quiz_stopped', data);
    });

    socket.on('submit_answer', (data) => {
      const session = activeQuizSessions[data.blockId];
      let score = 0;

      if (data.pointsEarned !== undefined) {
        score = data.pointsEarned;
      } else if (session) {
        const timeElapsed = (now() - session.startTime) / 1000;
        const timeLeft = Math.max(0, session.timeLimit - timeElapsed);
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

    socket.on('start_final_quiz', (data) => {
      io.to(data.lessonId).emit('start_final_quiz', data);
    });

    socket.on('show_leaderboard', (data) => {
      io.to(data.lessonId).emit('show_leaderboard', data);
    });

    socket.on('join_class_presence', (data) => {
      const classId = normalizeId(data?.classId);
      const userId = normalizeId(data?.userId);
      const role = normalizeId(data?.role).toUpperCase();

      if (!classId || !userId || !role) {
        return;
      }

      addClassPresence({
        classId,
        userId,
        role,
        socketId: socket.id,
      });

      socket.join(`class_presence:${classId}`);
      io.to(`class_presence:${classId}`).emit('class_presence_updated', {
        classId,
        onlineStudentIds: getOnlineStudentIdsForClass(classId),
      });
    });

    socket.on('leave_class_presence', (data) => {
      const classId = normalizeId(data?.classId);
      const userId = normalizeId(data?.userId);
      if (!classId || !userId) {
        return;
      }

      removeClassPresence({
        classId,
        userId,
        socketId: socket.id,
      });

      socket.leave(`class_presence:${classId}`);
      io.to(`class_presence:${classId}`).emit('class_presence_updated', {
        classId,
        onlineStudentIds: getOnlineStudentIdsForClass(classId),
      });
    });

    socket.on('disconnecting', async () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          const sockets = await io.in(room).fetchSockets();
          io.to(room).emit('attendance_updated', { count: Math.max(0, sockets.length - 1) });
        }
      }
    });

    socket.on('disconnect', () => {
      const affectedClassIds = removeSocketPresence(socket.id);
      affectedClassIds.forEach((classId) => {
        io.to(`class_presence:${classId}`).emit('class_presence_updated', {
          classId,
          onlineStudentIds: getOnlineStudentIdsForClass(classId),
        });
      });
      console.log('User disconnected:', socket.id);
    });
  });

  return {
    activeQuizSessions,
  };
}

module.exports = {
  registerRealtimeHandlers,
};
