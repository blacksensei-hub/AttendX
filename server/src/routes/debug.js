// server/src/routes/debug.js
//
// ⚠️ TEMPORARY DIAGNOSTIC ROUTE — DELETE THIS FILE once the Render→Neon
// connection issue is resolved. It exists only to run network checks
// from inside Render's actual runtime, since the free plan has no Shell
// access. Do not leave this mounted in a real deployment: it exposes
// internal network behaviour and (if extended) could leak connection
// details to anyone who finds the URL.

const router = require('express').Router();
const dns    = require('dns');
const net    = require('net');

const NEON_HOST = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).hostname
  : null;

router.get('/debug-db', async (req, res) => {
  const result = {
    neonHostFromEnv: NEON_HOST,
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
    dns: null,
    tcp: null,
  };

  if (!NEON_HOST) {
    return res.json({ ...result, error: 'DATABASE_URL is not set in this environment' });
  }

  // ── DNS resolution ──────────────────────────────────────────
  await new Promise((resolve) => {
    dns.lookup(NEON_HOST, { all: true }, (err, addresses) => {
      result.dns = err
        ? { error: err.message, code: err.code }
        : { addresses };
      resolve();
    });
  });

  // ── Raw TCP connect to port 5432 ────────────────────────────
  await new Promise((resolve) => {
    const socket = net.createConnection(5432, NEON_HOST);
    const timer = setTimeout(() => {
      socket.destroy();
      result.tcp = { error: 'Connection attempt timed out after 5s' };
      resolve();
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timer);
      result.tcp = { status: 'CONNECTED' };
      socket.end();
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      result.tcp = { error: err.message, code: err.code };
      resolve();
    });
  });

  return res.json(result);
});

module.exports = router;