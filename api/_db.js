// Shared MySQL (TiDB Cloud) pool, reused across warm serverless invocations.
const mysql = require('mysql2/promise');

function pool() {
  if (!global.__sitePool) {
    global.__sitePool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 4000),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'site_analytics',
      ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionLimit: 2,
      timezone: 'Z',
    });
  }
  return global.__sitePool;
}

module.exports = { pool };
