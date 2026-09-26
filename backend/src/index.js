import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { supabase } from './supabase.js';

const app = express();
const PORT = process.env.PORT || 4000;
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, db: Boolean(supabase) });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/enquiries', async (req, res) => {
  const { name, email, phone = '', message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!supabase) {
    return res.status(503).json({ error: 'Database is not configured.' });
  }

  const { error } = await supabase.from('enquiries').insert({
    name: name.trim().slice(0, 200),
    email: email.trim().slice(0, 200),
    phone: String(phone).trim().slice(0, 50),
    message: message.trim().slice(0, 5000),
  });
  if (error) {
    console.error('Failed to save enquiry:', error.message);
    return res.status(500).json({ error: 'Could not save your enquiry. Please try again.' });
  }
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
