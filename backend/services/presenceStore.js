const classPresenceMap = new Map();
const socketIndex = new Map();

const normalizeRole = (role) => String(role || '').toUpperCase();

const addClassPresence = ({ classId, userId, role, socketId }) => {
  const safeClassId = String(classId || '').trim();
  const safeUserId = String(userId || '').trim();
  const safeSocketId = String(socketId || '').trim();
  const safeRole = normalizeRole(role);

  if (!safeClassId || !safeUserId || !safeSocketId || !safeRole) {
    return;
  }

  if (!classPresenceMap.has(safeClassId)) {
    classPresenceMap.set(safeClassId, new Map());
  }

  const classUsers = classPresenceMap.get(safeClassId);
  if (!classUsers.has(safeUserId)) {
    classUsers.set(safeUserId, { role: safeRole, sockets: new Set() });
  }

  const entry = classUsers.get(safeUserId);
  entry.role = safeRole;
  entry.sockets.add(safeSocketId);

  if (!socketIndex.has(safeSocketId)) {
    socketIndex.set(safeSocketId, []);
  }
  const indexed = socketIndex.get(safeSocketId);
  const exists = indexed.some((item) => item.classId === safeClassId && item.userId === safeUserId);
  if (!exists) {
    indexed.push({ classId: safeClassId, userId: safeUserId });
  }
};

const removeSocketPresence = (socketId) => {
  const safeSocketId = String(socketId || '').trim();
  if (!safeSocketId) return [];

  const indexed = socketIndex.get(safeSocketId) || [];
  const affectedClassIds = new Set();
  indexed.forEach(({ classId, userId }) => {
    affectedClassIds.add(classId);
    const classUsers = classPresenceMap.get(classId);
    if (!classUsers) return;

    const entry = classUsers.get(userId);
    if (!entry) return;

    entry.sockets.delete(safeSocketId);
    if (entry.sockets.size === 0) {
      classUsers.delete(userId);
    }

    if (classUsers.size === 0) {
      classPresenceMap.delete(classId);
    }
  });

  socketIndex.delete(safeSocketId);
  return [...affectedClassIds];
};

const removeClassPresence = ({ classId, userId, socketId }) => {
  const safeClassId = String(classId || '').trim();
  const safeUserId = String(userId || '').trim();
  const safeSocketId = String(socketId || '').trim();

  if (!safeClassId || !safeUserId || !safeSocketId) {
    return;
  }

  const classUsers = classPresenceMap.get(safeClassId);
  if (!classUsers) return;

  const entry = classUsers.get(safeUserId);
  if (!entry) return;

  entry.sockets.delete(safeSocketId);
  if (entry.sockets.size === 0) {
    classUsers.delete(safeUserId);
  }
  if (classUsers.size === 0) {
    classPresenceMap.delete(safeClassId);
  }

  const indexed = socketIndex.get(safeSocketId);
  if (indexed) {
    socketIndex.set(
      safeSocketId,
      indexed.filter((item) => !(item.classId === safeClassId && item.userId === safeUserId))
    );
    if (socketIndex.get(safeSocketId).length === 0) {
      socketIndex.delete(safeSocketId);
    }
  }
};

const getOnlineStudentIdsForClass = (classId) => {
  const safeClassId = String(classId || '').trim();
  if (!safeClassId) return [];

  const classUsers = classPresenceMap.get(safeClassId);
  if (!classUsers) return [];

  const studentIds = [];
  classUsers.forEach((entry, userId) => {
    if (entry.role === 'STUDENT' && entry.sockets.size > 0) {
      studentIds.push(userId);
    }
  });

  return studentIds;
};

module.exports = {
  addClassPresence,
  removeClassPresence,
  removeSocketPresence,
  getOnlineStudentIdsForClass,
};
