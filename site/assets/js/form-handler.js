/*
 * Static replacement for the Elementor Pro form handler.
 *
 * The original site posted this form to WordPress (wp-admin/admin-ajax.php).
 * That endpoint does not exist in a static build, so this script takes over
 * submission while leaving the form's markup and styling untouched.
 *
 * ---------------------------------------------------------------------------
 * CONFIGURE ME: set ENDPOINT to whichever you are using.
 *
 *   'contact.php'  - the bundled PHP script (works on any normal PHP host,
 *                    which is what this site was previously running on).
 *   a full URL     - e.g. a Formspree / Web3Forms / Netlify Forms endpoint
 *                    if you host somewhere without PHP.
 *   ''  (empty)    - fall back to opening the visitor's mail client.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var ENDPOINT   = '/api/contact';
  var MAIL_TO    = 'order@printmediaonline.com';
  var SUCCESS_MSG = 'Thanks — your message has been sent. We will be in touch shortly.';
  var ERROR_MSG   = 'Sorry, the message could not be sent. Please email ' + MAIL_TO + ' directly.';

  // Resolve ENDPOINT so it works from any page depth.
  function endpointUrl() {
    if (!ENDPOINT) return '';
    // Absolute URL or root-relative path ("/api/contact") -> use as-is.
    if (/^https?:\/\//i.test(ENDPOINT) || ENDPOINT.charAt(0) === '/') return ENDPOINT;
    // Bare relative path (e.g. "contact.php") -> climb back to the site root.
    var depth = window.location.pathname.replace(/\/[^\/]*$/, '/');
    var up = (depth.match(/[^\/]+\//g) || []).length ? '../' : '';
    return up + ENDPOINT;
  }

  function fieldLabel(name) {
    var m = name.match(/form_fields\[(.+)\]/);
    var key = m ? m[1] : name;
    if (key === 'field_6491f70') return 'Service';
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function showMessage(form, text, ok) {
    var box = form.querySelector('.pmo-form-message');
    if (!box) {
      box = document.createElement('div');
      box.className = 'pmo-form-message';
      box.setAttribute('role', 'status');
      box.style.cssText = 'margin-top:14px;padding:11px 15px;border-radius:4px;font-size:15px;line-height:1.5;';
      form.appendChild(box);
    }
    box.style.background = ok ? '#e6f6ea' : '#fdeaea';
    box.style.color      = ok ? '#1b5e2a' : '#8a1f1f';
    box.style.border     = '1px solid ' + (ok ? '#b6e0c1' : '#f0bcbc');
    box.textContent = text;
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"], .elementor-button[type="submit"]');
    if (!btn) return;
    if (busy) {
      btn.dataset.pmoLabel = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '0.65';
      var txt = btn.querySelector('.elementor-button-text');
      if (txt) txt.textContent = 'Sending…';
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      if (btn.dataset.pmoLabel) btn.innerHTML = btn.dataset.pmoLabel;
    }
  }

  function mailtoFallback(form) {
    var data = new FormData(form);
    var lines = [];
    data.forEach(function (v, k) {
      if (k.indexOf('form_fields[') !== 0 || !String(v).trim()) return;
      lines.push(fieldLabel(k) + ': ' + v);
    });
    var subject = 'Website enquiry — Print Media Online';
    window.location.href = 'mailto:' + MAIL_TO +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function handle(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honour the browser's own required-field validation first.
      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var url = endpointUrl();
      if (!url) { mailtoFallback(form); return; }

      setBusy(form, true);

      fetch(url, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then(function (r) {
          return r.json().catch(function () { return { ok: r.ok }; });
        })
        .then(function (res) {
          setBusy(form, false);
          if (res && res.ok) {
            form.reset();
            showMessage(form, (res.message || SUCCESS_MSG), true);
          } else {
            showMessage(form, (res && res.message) || ERROR_MSG, false);
          }
        })
        .catch(function () {
          setBusy(form, false);
          showMessage(form, ERROR_MSG, false);
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form.elementor-form');
    for (var i = 0; i < forms.length; i++) handle(forms[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
