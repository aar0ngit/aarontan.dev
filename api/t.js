// POST /api/t: receives a batch of page events from /t.js and stores them.
const { pool } = require('./_db');

const TYPES = new Set(['view', 'section', 'click', 'expand', 'depth']);
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embed|python|curl|wget/i;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua)) return res.status(204).end();

  let b = req.body;
  try {
    if (Buffer.isBuffer(b)) b = b.toString('utf8');
    if (typeof b === 'string') { if (b.length > 8000) return res.status(413).end(); b = JSON.parse(b); }
  } catch (e) { return res.status(400).end(); }
  if (!b || typeof b !== 'object' || !Array.isArray(b.ev)) return res.status(400).end();

  const sid = String(b.sid || '').replace(/[^\w-]/g, '').slice(0, 36);
  if (!sid) return res.status(400).end();
  const w = Number(b.w) || 0;
  const device = w && w < 600 ? 'phone' : w && w < 1024 ? 'tablet' : 'desktop';
  const country = String(req.headers['x-vercel-ip-country'] || '').replace(/[^A-Z]/g, '').slice(0, 2) || null;
  const ref = String(b.ref || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 100) || null;

  const rows = [];
  for (const e of b.ev.slice(0, 80)) {
    if (!Array.isArray(e) || !TYPES.has(e[0])) continue;
    const name = String(e[1] || '').replace(/[^\w ()./-]/g, '').slice(0, 80);
    const value = Math.max(0, Math.min(1800, Number(e[2]) | 0));
    const isView = e[0] === 'view';
    rows.push([sid, e[0], name, value, isView ? country : null, isView ? device : null, isView ? ref : null]);
  }
  if (!rows.length) return res.status(204).end();

  try {
    await pool().query('INSERT INTO events (sid, type, name, value, country, device, ref) VALUES ?', [rows]);
    res.status(204).end();
  } catch (err) {
    console.error('track insert failed:', err.code || err.message);
    res.status(500).end();
  }
};
