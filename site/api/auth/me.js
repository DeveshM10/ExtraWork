const store = require('../../lib/store');
const { sessionFromRequest } = require('../../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const session = sessionFromRequest(req);
  if (!session) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, authenticated: false }));
  }
  try {
    const user = await store.findById(session.sub);
    if (!user) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, authenticated: false }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      authenticated: true,
      user: { username: user.username, name: user.name, email: user.email, company: user.company },
    }));
  } catch (err) {
    console.error('[me]', err.message);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, authenticated: false }));
  }
};
