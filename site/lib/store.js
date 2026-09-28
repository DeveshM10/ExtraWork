// User persistence with two backends, chosen automatically:
//
//   * Postgres  — used when DATABASE_URL (or POSTGRES_URL) is set. This is the
//     production path. Works with Vercel Postgres, Neon, Supabase, or any
//     standard Postgres connection string.
//
//   * JSON file — fallback for local development (`vercel dev`), written to the
//     OS temp dir. This persists on your own machine so you can test the full
//     flow, but on Vercel's serverless instances /tmp is per-instance and
//     ephemeral — so DO NOT rely on it in production. Set DATABASE_URL there.
//
// Public API (all async): findByUsername, findByEmail, createUser, findById.

const crypto = require('crypto');

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

/* ------------------------------- Postgres -------------------------------- */

let _pool = null;
let _ready = null;

function pool() {
  if (_pool) return _pool;
  const { Pool } = require('pg'); // lazy — only needed when PG_URL is set
  _pool = new Pool({
    connectionString: PG_URL,
    ssl: PG_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 3,
  });
  return _pool;
}

async function ensureSchema() {
  if (_ready) return _ready;
  _ready = (async () => {
    await pool().query(`
      CREATE TABLE IF NOT EXISTS portal_users (
        id         TEXT PRIMARY KEY,
        username   TEXT UNIQUE NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        name       TEXT NOT NULL,
        company    TEXT,
        pass_hash  TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // client = which client's data this account may see ('tcs' | 'digitate' | null)
    // role   = 'client' (a normal client account) | 'admin'
    await pool().query(`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS client TEXT;`);
    await pool().query(`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client';`);
  })();
  return _ready;
}

const pg = {
  async findByUsername(username) {
    await ensureSchema();
    const r = await pool().query('SELECT * FROM portal_users WHERE lower(username)=lower($1) LIMIT 1', [username]);
    return r.rows[0] || null;
  },
  async findByEmail(email) {
    await ensureSchema();
    const r = await pool().query('SELECT * FROM portal_users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    return r.rows[0] || null;
  },
  async findById(id) {
    await ensureSchema();
    const r = await pool().query('SELECT * FROM portal_users WHERE id=$1 LIMIT 1', [id]);
    return r.rows[0] || null;
  },
  async createUser(u) {
    await ensureSchema();
    const r = await pool().query(
      `INSERT INTO portal_users (id, username, email, name, company, pass_hash, client, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [u.id, u.username, u.email, u.name, u.company || null, u.pass_hash, u.client || null, u.role || 'client']
    );
    return r.rows[0];
  },
};

/* ------------------------------ File (dev) ------------------------------- */

const fs = require('fs');
const path = require('path');
const os = require('os');
const FILE = path.join(os.tmpdir(), 'pmo-portal-users.json');

function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (_) { return { users: [] }; }
}
function writeFile(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

const file = {
  async findByUsername(username) {
    return readFile().users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  },
  async findByEmail(email) {
    return readFile().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  async findById(id) {
    return readFile().users.find((u) => u.id === id) || null;
  },
  async createUser(u) {
    const db = readFile();
    db.users.push(u);
    writeFile(db);
    return u;
  },
};

/* -------------------------------- Export --------------------------------- */

const backend = PG_URL ? pg : file;

module.exports = {
  usingPostgres: !!PG_URL,
  newId: () => crypto.randomUUID(),
  ...backend,
};
