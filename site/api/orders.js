// GET /api/orders — the signed-in account's dashboard data.
//
// This is the session-driven, server-enforced source of truth for the
// dashboard. It reads the session cookie, resolves the account (and its client)
// from the database — never trusting anything the browser sends — and returns
// only that client's orders and proofs. A TCS session can never receive
// Digitate rows, and vice versa.

const store = require('../lib/store');
const { sessionFromRequest } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  if (!session) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, authenticated: false }));
  }

  try {
    // Re-read the account from the DB so scope reflects current state, not a
    // stale token. The client is taken from the stored account, not the request.
    const user = await store.findById(session.sub);
    if (!user) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ ok: false, authenticated: false }));
    }

    const client = user.client || null;
    const [orders, proofs] = await Promise.all([
      store.listOrders(client),
      store.listProofs(client),
    ]);

    const filesOnRecord = orders.length + proofs.length;
    const stats = {
      active: orders.filter((o) => o.status === 'printing').length,
      review: proofs.length,
      completed: orders.filter((o) => o.status === 'done' || o.status === 'shipped').length,
      files: filesOnRecord,
    };

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, client, stats, orders, proofs }));
  } catch (err) {
    console.error('[orders]', err.message);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, message: 'Could not load your dashboard.' }));
  }
};
