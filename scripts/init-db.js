// One-off: create the analytics database and table. Run from the repo root: node scripts/init-db.js
// Reads DB_* values from .env.local (never committed).
const fs = require('fs'), path = require('path'), mysql = require('mysql2/promise');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
  await c.query('CREATE DATABASE IF NOT EXISTS site_analytics');
  await c.query(`CREATE TABLE IF NOT EXISTS site_analytics.events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sid VARCHAR(36) NOT NULL,
    type VARCHAR(10) NOT NULL,
    name VARCHAR(80) NOT NULL,
    value INT NOT NULL DEFAULT 0,
    country CHAR(2) NULL,
    device VARCHAR(8) NULL,
    ref VARCHAR(100) NULL,
    KEY ix_type_ts (type, ts),
    KEY ix_sid (sid)
  )`);
  console.log('site_analytics.events ready');
  await c.end();
})().catch(e => { console.error('init failed:', e.code || e.message); process.exit(1); });
