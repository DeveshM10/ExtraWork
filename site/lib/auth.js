// Auth primitives shared by the /api/auth functions: password hashing,
// session tokens (signed JWT in an httpOnly cookie), and cookie helpers.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'pmo_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// SESSION_SECRET must be set in production. Locally we fall back to a fixed dev
// secret so the app runs out of the box, but warn loudly and never in prod.
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set. Refusing to sign sessions in production.');
  }
  if (!secret._warned) {
    console.warn('[auth] SESSION_SECRET not set — using an insecure dev secret. Set SESSION_SECRET before deploying.');
    secret._warned = true;
  }
  return 'dev-only-insecure-secret-change-me';
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function verifyPassword(plain, hash) {
  try { return await bcrypt.compare(plain, hash); }
  catch (_) { return false; }
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name },
    secret(),
    { expiresIn: MAX_AGE }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, secret()); }
  catch (_) { return null; }
}

function sessionCookie(token) {
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.VERCEL_ENV ? true : false,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

function clearCookie() {
  return cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.VERCEL_ENV ? true : false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

// Read the current session from a request, or null.
function sessionFromRequest(req) {
  const header = req.headers.cookie || '';
  const jar = cookie.parse(header || '');
  const token = jar[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

// Parse a JSON or form-encoded request body into an object.
function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { return resolve(JSON.parse(raw)); }
      catch (_) {
        const out = {};
        new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
        resolve(out);
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  sessionCookie,
  clearCookie,
  sessionFromRequest,
  readBody,
};
