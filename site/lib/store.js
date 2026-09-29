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

    // Per-client business data. Every row belongs to exactly one client and is
    // only ever returned to a session whose account carries that client.
    await pool().query(`
      CREATE TABLE IF NOT EXISTS portal_orders (
        id          TEXT PRIMARY KEY,
        client      TEXT NOT NULL,
        order_ref   TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity    TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        total       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool().query(`CREATE INDEX IF NOT EXISTS portal_orders_client_idx ON portal_orders (client);`);
    await pool().query(`
      CREATE TABLE IF NOT EXISTS portal_proofs (
        id          TEXT PRIMARY KEY,
        client      TEXT NOT NULL,
        title       TEXT NOT NULL,
        note        TEXT,
        tag         TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool().query(`CREATE INDEX IF NOT EXISTS portal_proofs_client_idx ON portal_proofs (client);`);
    // A client's decision on a proof: status becomes 'approved' or
    // 'changes_requested', with their feedback and when they decided.
    await pool().query(`ALTER TABLE portal_proofs ADD COLUMN IF NOT EXISTS feedback TEXT;`);
    await pool().query(`ALTER TABLE portal_proofs ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;`);

    await pool().query(`
      CREATE TABLE IF NOT EXISTS portal_files (
        id          TEXT PRIMARY KEY,
        client      TEXT NOT NULL,
        name        TEXT NOT NULL,
        kind        TEXT,
        size        TEXT,
        url         TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool().query(`CREATE INDEX IF NOT EXISTS portal_files_client_idx ON portal_files (client);`);
    await pool().query(`
      CREATE TABLE IF NOT EXISTS portal_invoices (
        id          TEXT PRIMARY KEY,
        client      TEXT NOT NULL,
        invoice_ref TEXT NOT NULL,
        order_ref   TEXT,
        amount      TEXT,
        status      TEXT NOT NULL DEFAULT 'unpaid',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool().query(`CREATE INDEX IF NOT EXISTS portal_invoices_client_idx ON portal_invoices (client);`);
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
  async listOrders(client) {
    await ensureSchema();
    if (!client) return [];
    const r = await pool().query('SELECT * FROM portal_orders WHERE client=$1 ORDER BY created_at DESC', [client]);
    return r.rows;
  },
  async listProofs(client) {
    await ensureSchema();
    if (!client) return [];
    const r = await pool().query('SELECT * FROM portal_proofs WHERE client=$1 ORDER BY created_at DESC', [client]);
    return r.rows;
  },
  async createOrder(o) {
    await ensureSchema();
    const r = await pool().query(
      `INSERT INTO portal_orders (id,client,order_ref,description,quantity,status,total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [o.id, o.client, o.order_ref, o.description, o.quantity || null, o.status || 'pending', o.total || null]
    );
    return r.rows[0];
  },
  async createProof(p) {
    await ensureSchema();
    const r = await pool().query(
      `INSERT INTO portal_proofs (id,client,title,note,tag,status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [p.id, p.client, p.title, p.note || null, p.tag || null, p.status || 'pending']
    );
    return r.rows[0];
  },
  async findOrder(orderRef, client) {
    await ensureSchema();
    if (!client) return null;
    const r = await pool().query(
      'SELECT * FROM portal_orders WHERE order_ref=$1 AND client=$2 LIMIT 1',
      [orderRef, client]
    );
    return r.rows[0] || null;
  },
  async listFiles(client) {
    await ensureSchema();
    if (!client) return [];
    const r = await pool().query('SELECT * FROM portal_files WHERE client=$1 ORDER BY created_at DESC', [client]);
    return r.rows;
  },
  async listInvoices(client) {
    await ensureSchema();
    if (!client) return [];
    const r = await pool().query('SELECT * FROM portal_invoices WHERE client=$1 ORDER BY created_at DESC', [client]);
    return r.rows;
  },
  async decideProof(id, client, status, feedback) {
    await ensureSchema();
    if (!id || !client) return null;
    // Only pending proofs of THIS client can be decided.
    const r = await pool().query(
      `UPDATE portal_proofs
          SET status=$3, feedback=$4, decided_at=now()
        WHERE id=$1 AND client=$2 AND status='pending'
        RETURNING *`,
      [id, client, status, feedback]
    );
    return r.rows[0] || null;
  },
};

/* ------------------------------ File (dev) ------------------------------- */

const fs = require('fs');
const path = require('path');
const os = require('os');
const FILE = path.join(os.tmpdir(), 'pmo-portal-users.json');

function readFile() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    db.users = db.users || [];
    db.orders = db.orders || [];
    db.proofs = db.proofs || [];
    db.files = db.files || [];
    db.invoices = db.invoices || [];
    return db;
  } catch (_) { return { users: [], orders: [], proofs: [], files: [], invoices: [] }; }
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
  async listOrders(client) {
    if (!client) return [];
    return readFile().orders.filter((o) => o.client === client);
  },
  async listProofs(client) {
    if (!client) return [];
    return readFile().proofs.filter((p) => p.client === client);
  },
  async createOrder(o) {
    const db = readFile(); db.orders.push(o); writeFile(db); return o;
  },
  async createProof(p) {
    const db = readFile(); db.proofs.push(p); writeFile(db); return p;
  },
  async findOrder(orderRef, client) {
    if (!client) return null;
    return readFile().orders.find((o) => o.order_ref === orderRef && o.client === client) || null;
  },
  async listFiles(client) {
    if (!client) return [];
    return readFile().files.filter((f) => f.client === client);
  },
  async listInvoices(client) {
    if (!client) return [];
    return readFile().invoices.filter((i) => i.client === client);
  },
  async decideProof(id, client, status, feedback) {
    const db = readFile();
    const p = db.proofs.find((x) => x.id === id && x.client === client && x.status === 'pending');
    if (!p) return null;
    p.status = status;
    p.feedback = feedback;
    p.decided_at = new Date().toISOString();
    writeFile(db);
    return p;
  },
};

/* -------------------------------- Export --------------------------------- */

const backend = PG_URL ? pg : file;

module.exports = {
  usingPostgres: !!PG_URL,
  newId: () => crypto.randomUUID(),
  ...backend,
};
