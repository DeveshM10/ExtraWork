// POST /api/proofs — a client approves a proof or requests changes.
//
// Body: { id, action: 'approve' | 'changes', feedback? }
//
// Authorization is enforced here, on the server: the proof is only updated if
// it belongs to the signed-in account's client AND is still pending. A TCS
// session cannot act on a Digitate proof even if it knows the proof's id.

const store = require('../lib/store');
const { sessionFromRequest, readBody } = require('../lib/auth');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { ok: false, message: 'Please sign in again.' });

  try {
    const user = await store.findById(session.sub);
    if (!user) return json(res, 401, { ok: false, message: 'Please sign in again.' });
    if (!user.client) return json(res, 403, { ok: false, message: 'Your account has no client assigned.' });

    const b = await readBody(req);
    const id = String(b.id || '').trim();
    const action = String(b.action || '').trim();
    const feedback = String(b.feedback || '').trim().slice(0, 1000);

    if (!id) return json(res, 422, { ok: false, message: 'Missing proof id.' });
    if (action !== 'approve' && action !== 'changes') {
      return json(res, 422, { ok: false, message: 'Unknown action.' });
    }
    if (action === 'changes' && !feedback) {
      return json(res, 422, { ok: false, message: 'Please describe the changes you need.' });
    }

    const status = action === 'approve' ? 'approved' : 'changes_requested';
    const proof = await store.decideProof(id, user.client, status, action === 'changes' ? feedback : null);
    if (!proof) {
      // Not this client's proof, unknown id, or already decided — same answer
      // either way, so ids from other clients can't be probed.
      return json(res, 404, { ok: false, message: 'This proof was not found or has already been reviewed.' });
    }

    // Visible in the deployment logs so the team sees every decision until
    // staff notifications / the admin panel are in place.
    console.log('[proofs] client=%s user=%s proof=%s status=%s feedback=%j',
      user.client, user.username, proof.id, proof.status, proof.feedback || '');

    return json(res, 200, { ok: true, proof });
  } catch (err) {
    console.error('[proofs]', err.message);
    return json(res, 500, { ok: false, message: 'Could not save your decision. Please try again.' });
  }
};
