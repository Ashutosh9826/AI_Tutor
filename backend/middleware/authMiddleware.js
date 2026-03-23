const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });

    // Backward-compatible payload support:
    // older tokens may carry "id" instead of "userId".
    const normalizedUserId = payload?.userId || payload?.id || null;
    const normalizedRole = payload?.role || null;

    if (!normalizedUserId || !normalizedRole) {
      return res.status(401).json({ error: 'Invalid token payload. Please sign in again.' });
    }

    req.user = {
      ...payload,
      userId: normalizedUserId,
      role: normalizedRole,
    };
    next();
  });
}

function requireTeacher(req, res, next) {
  console.log('requireTeacher check:', req.user);
  if (req.user && req.user.role === 'TEACHER') {
    next();
  } else {
    res.status(403).json({ error: 'Teacher access required' });
  }
}

module.exports = { authenticateToken, requireTeacher };
