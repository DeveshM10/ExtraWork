const store = require('../../lib/store');
const { hashPassword, issueToken, sessionCookie, readBody } = require('../../lib/auth');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });

  const b = await readBody(req);
  const name = (b.name || '').trim();
  const username = (b.username || '').trim();
  const email = (b.email || '').trim();
  const company = (b.company || '').trim();
  const password = String(b.password || '');

  if (!name) return json(res, 422, { ok: false, message: 'Please enter your name.' });
  if (!USERNAME_RE.test(username)) {
    return json(res, 422, { ok: false, message: 'Username must be 3–32 characters: letters, numbers, . _ - only.' });
  }
  if (!EMAIL_RE.test(email)) return json(res, 422, { ok: false, message: 'Please enter a valid email address.' });
  if (password.length < 8) return json(res, 422, { ok: false, message: 'Password must be at least 8 characters.' });

  try {
    if (await store.findByUsername(username)) {
      return json(res, 409, { ok: false, message: 'That username is already taken.' });
    }
    if (await store.findByEmail(email)) {
      return json(res, 409, { ok: false, message: 'An account with that email already exists.' });
    }

    const user = await store.createUser({
      id: store.newId(),
      username,
      email,
      name,
      company,
      pass_hash: await hashPassword(password),
    });

    const token = issueToken(user);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return json(res, 201, {
      ok: true,
      message: 'Account created.',
      user: { username: user.username, name: user.name, email: user.email, company: user.company },
    });
  } catch (err) {
    console.error('[register]', err.message);
    return json(res, 500, { ok: false, message: 'Could not create the account. Please try again.' });
  }
};
