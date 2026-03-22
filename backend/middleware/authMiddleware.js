const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
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
