const jwt = require('jsonwebtoken');
const db  = require('../../database/db');

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set (min 16 chars) in production');
    }
    return 'laundry-dev-secret-change-me';
  }
  return s;
}

function signUserToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      role_id: user.role_id || null,
      full_name: user.full_name,
      session_id: sessionId || null,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.laundry_auth;
  if (!token) {
    return res.status(401).json({ success: false, message: 'غير مصرح' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    try {
      const expired = jwt.decode(token);
      if (expired && expired.session_id) {
        db.closeUserSession(expired.session_id, 'jwt_expired').catch(() => {});
      }
    } catch (_) {}
    return res.status(401).json({ success: false, message: 'انتهت الجلسة' });
  }
  req.user = payload;
  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies && req.cookies.laundry_auth;
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

module.exports = {
  getJwtSecret,
  signUserToken,
  verifyToken,
  authMiddleware,
  optionalAuth
};
