const { clearCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', clearCookie());
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true }));
};
