// Serverless contact-form endpoint (Vercel / Node runtime).
//
// Replaces contact.php for hosts that don't run PHP. The static form in
// /contact-us/ and /forms/ posts here via assets/js/form-handler.js.
//
// Email delivery is optional and gated on an env var so the endpoint works the
// moment it's deployed:
//   - Set RESEND_API_KEY (https://resend.com, free tier) and CONTACT_TO to
//     actually deliver mail.
//   - With neither set, submissions are validated and logged to the Vercel
//     function logs, and the visitor still gets a success response.

const CONTACT_TO   = process.env.CONTACT_TO   || 'order@printmediaonline.com';
const CONTACT_FROM = process.env.CONTACT_FROM || 'Print Media Online <onboarding@resend.dev>';

function readBody(req) {
  return new Promise((resolve) => {
    // Vercel usually parses the body already.
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

function collectFields(body) {
  // The Elementor markup names inputs form_fields[name], form_fields[email], …
  const f = {};
  for (const [k, v] of Object.entries(body || {})) {
    const m = /^form_fields\[(.+)\]$/.exec(k);
    if (m) f[m[1]] = typeof v === 'string' ? v.trim() : v;
  }
  if (body && typeof body.form_fields === 'object') {
    for (const [k, v] of Object.entries(body.form_fields)) {
      f[k] = typeof v === 'string' ? v.trim() : v;
    }
  }
  return f;
}

const LABELS = {
  name: 'Name', email: 'Email', field_6491f70: 'Service', message: 'Message',
};

async function sendViaResend(subject, text, replyTo) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no-provider' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: CONTACT_FROM, to: [CONTACT_TO], subject, text, reply_to: replyTo,
    }),
  });
  return { sent: res.ok, reason: res.ok ? 'ok' : `resend-${res.status}` };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, message: 'Method not allowed.' }));
  }

  const body = await readBody(req);
  const f = collectFields(body);

  const email = f.email || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.statusCode = 422;
    return res.end(JSON.stringify({ ok: false, message: 'Please enter a valid email address.' }));
  }
  if (!f.message && !f.name) {
    res.statusCode = 422;
    return res.end(JSON.stringify({ ok: false, message: 'Please add a message so we know what you need.' }));
  }
  // header-injection guard on single-line fields
  for (const [k, v] of Object.entries(f)) {
    if (k !== 'message' && typeof v === 'string' && /[\r\n]/.test(v)) {
      res.statusCode = 422;
      return res.end(JSON.stringify({ ok: false, message: 'Invalid input.' }));
    }
  }

  const lines = [];
  for (const [key, label] of Object.entries(LABELS)) {
    if (f[key]) lines.push(`${label}: ${f[key]}`);
  }
  lines.push('', '---', `Sent from the website contact form at ${new Date().toISOString()}`);
  const text = lines.join('\n');

  let delivery = { sent: false, reason: 'no-provider' };
  try {
    delivery = await sendViaResend('Website enquiry - Print Media Online', text, email);
  } catch (e) {
    delivery = { sent: false, reason: 'exception' };
  }

  // Always visible in Vercel function logs so nothing is silently lost even
  // before an email provider is configured.
  console.log('[contact] delivery=%s\n%s', delivery.reason, text);

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true,
    message: 'Thanks - your message has been sent. We will be in touch shortly.',
  }));
};
