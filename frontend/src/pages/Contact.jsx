import { useState } from 'react';
import { sendEnquiry } from '../api.js';

const empty = { name: '', email: '', phone: '', message: '' };

export default function Contact() {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ state: 'idle', msg: '' });

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus({ state: 'sending', msg: '' });
    try {
      await sendEnquiry(form);
      setForm(empty);
      setStatus({ state: 'done', msg: 'Thanks! We will get back to you shortly.' });
    } catch (err) {
      setStatus({ state: 'error', msg: err.message });
    }
  }

  return (
    <section className="container section">
      <h1>Contact</h1>
      <form className="contact-form" onSubmit={submit}>
        <input name="name" placeholder="Name" value={form.name} onChange={update} required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={update} required />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={update} />
        <textarea name="message" placeholder="Message" rows="5" value={form.message} onChange={update} required />
        <button type="submit" disabled={status.state === 'sending'}>
          {status.state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        {status.msg && <p className={`form-status ${status.state}`}>{status.msg}</p>}
      </form>
    </section>
  );
}
