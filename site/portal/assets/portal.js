// Client helpers for the portal pages. Talks to /api/auth/*.
(function (w) {
  'use strict';

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  }

  async function me() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const d = await res.json();
      return d.authenticated ? d.user : null;
    } catch (_) { return null; }
  }

  function showMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'msg show ' + (kind || 'err');
  }
  function hideMsg(el) { if (el) el.className = 'msg'; }

  function busy(btn, on, labelWhenBusy) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = labelWhenBusy || 'Please wait…';
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  w.Portal = { post, me, showMsg, hideMsg, busy };
})(window);
