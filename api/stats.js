// GET /api/stats?days=30 : aggregated numbers for /admin. Needs "Authorization: Bearer <ADMIN_KEY>".
const crypto = require('crypto');
const { pool } = require('./_db');

function authorised(req) {
  const key = process.env.ADMIN_KEY || '';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (key.length < 16 || !got) return false;
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!authorised(req)) { await new Promise(r => setTimeout(r, 400)); return res.status(401).json({ error: 'Wrong admin key' }); }

  const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
  const since = 'ts >= UTC_TIMESTAMP() - INTERVAL ? DAY';
  const db = pool();
  const q = async sql => (await db.query(sql, [days]))[0];

  try {
    const [totals] = await q(`SELECT COUNT(*) AS views, COUNT(DISTINCT sid) AS visitors FROM events WHERE type='view' AND ${since}`);
    const [time] = await q(`SELECT COALESCE(SUM(value),0) AS secs, COUNT(DISTINCT sid) AS n FROM events WHERE type='section' AND ${since}`);
    const [depth] = await q(`SELECT COALESCE(AVG(d),0) AS avg FROM (SELECT sid, MAX(value) AS d FROM events WHERE type='depth' AND ${since} GROUP BY sid) x`);
    const daily = await q(`SELECT DATE_FORMAT(ts + INTERVAL 8 HOUR, '%Y-%m-%d') AS day, COUNT(DISTINCT sid) AS visitors FROM events WHERE type='view' AND ${since} GROUP BY 1 ORDER BY 1`);
    const sections = await q(`SELECT name, COUNT(DISTINCT sid) AS visitors, SUM(value) AS secs FROM events WHERE type='section' AND ${since} GROUP BY name`);
    const clicks = await q(`SELECT name, type, COUNT(*) AS n, COUNT(DISTINCT sid) AS visitors FROM events WHERE type IN ('click','expand') AND ${since} GROUP BY name, type ORDER BY n DESC LIMIT 30`);
    const refs = await q(`SELECT COALESCE(ref,'(direct or hidden)') AS name, COUNT(DISTINCT sid) AS n FROM events WHERE type='view' AND ${since} GROUP BY 1 ORDER BY n DESC LIMIT 10`);
    const countries = await q(`SELECT COALESCE(country,'??') AS name, COUNT(DISTINCT sid) AS n FROM events WHERE type='view' AND ${since} GROUP BY 1 ORDER BY n DESC LIMIT 10`);
    const devices = await q(`SELECT COALESCE(device,'?') AS name, COUNT(DISTINCT sid) AS n FROM events WHERE type='view' AND ${since} GROUP BY 1 ORDER BY n DESC`);
    const recent = await q(`
      SELECT DATE_FORMAT(v.ts + INTERVAL 8 HOUR, '%Y-%m-%d %H:%i') AS at, v.country, v.device, v.ref,
        (SELECT COALESCE(SUM(s.value),0) FROM events s WHERE s.sid=v.sid AND s.type='section') AS secs,
        (SELECT COALESCE(MAX(d.value),0) FROM events d WHERE d.sid=v.sid AND d.type='depth') AS depth,
        (SELECT GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') FROM events c WHERE c.sid=v.sid AND c.type IN ('click','expand')) AS clicks
      FROM events v WHERE v.type='view' AND v.${since} ORDER BY v.ts DESC LIMIT 25`);

    res.status(200).json({
      days,
      totals: {
        visitors: Number(totals.visitors), views: Number(totals.views),
        avgSecs: Number(time.n) ? Math.round(Number(time.secs) / Number(time.n)) : 0,
        avgDepth: Math.round(Number(depth.avg)),
      },
      daily, sections, clicks, refs, countries, devices, recent,
    });
  } catch (err) {
    console.error('stats failed:', err.code || err.message);
    res.status(500).json({ error: 'Database error' });
  }
};
