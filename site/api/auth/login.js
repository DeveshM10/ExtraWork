const store = require('../../lib/store');
const { verifyPassword, issueToken, sessionCookie, readBody } = require('../../lib/auth');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });

  const b = await readBody(req);
  const identifier = (b.username || b.email || '').trim();
  const password = String(b.password || '');

  if (!identifier || !password) {
    return json(res, 422, { ok: false, message: 'Please enter your username and password.' });
  }

  try {
    // Allow signing in with either username or email.
    let user = await store.findByUsername(identifier);
    if (!user && identifier.includes('@')) user = await store.findByEmail(identifier);

    // Constant-ish response: same message whether the user or the password is
    // wrong, so we don't reveal which usernames exist.
    const ok = user && (await verifyPassword(password, user.pass_hash));
    if (!ok) return json(res, 401, { ok: false, message: 'Incorrect username or password.' });

    const token = issueToken(user);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return json(res, 200, {
      ok: true,
      user: { username: user.username, name: user.name, email: user.email, company: user.company },
    });
  } catch (err) {
    console.error('[login]', err.message);
    return json(res, 500, { ok: false, message: 'Sign-in failed. Please try again.' });
  }
};
