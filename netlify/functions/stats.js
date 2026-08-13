// Returns aggregated analytics.
//
// Security note (fixed in the security release): this endpoint previously had NO auth at
// all -- it relied solely on robots.txt/noindex keeping the dashboard URL out of search
// engines, which is not real access control (the URL can still leak via browser history
// sync, referrer headers, a misdirected link, etc.). It now requires a shared-secret token,
// checked with a constant-time comparison to avoid leaking the correct value via response
// timing. Fails CLOSED: if STATS_ACCESS_TOKEN isn't configured in the environment, every
// request is rejected rather than silently falling back to "open to everyone" -- an admin
// misconfiguration should never mean "public by default."
const crypto = require("crypto");

let createClient;
try {
  ({ createClient } = require("@libsql/client"));
} catch (e) {
  createClient = null;
}

let db = null;

function isAuthorized(event) {
  const expected = process.env.STATS_ACCESS_TOKEN;
  if (!expected) return false;
  const provided =
    event.headers["x-stats-token"] || event.headers["X-Stats-Token"] || "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function getDb() {
  if (!createClient) {
    throw new Error("@libsql/client module failed to load — check build dependencies");
  }
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variable");
  }
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

async function ensureTable(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      source TEXT,
      visitor_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    await client.execute(`ALTER TABLE pageviews ADD COLUMN source TEXT`);
  } catch (e) {
    /* column already exists */
  }
}

// Exported for unit testing (see tests/stats-auth.test.js). Netlify only ever calls
// exports.handler; this extra export is inert in production.
exports.isAuthorized = isAuthorized;

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: process.env.STATS_ACCESS_TOKEN
          ? "Unauthorized -- missing or incorrect X-Stats-Token header."
          : "STATS_ACCESS_TOKEN is not configured in the environment -- this endpoint is locked until it is set.",
      }),
    };
  }

  try {
    const client = getDb();
    await ensureTable(client);

    const totalRes = await client.execute(
      "SELECT COUNT(*) as total, COUNT(DISTINCT visitor_hash) as unique_visitors FROM pageviews"
    );
    const byPageRes = await client.execute(
      "SELECT path, COUNT(*) as views FROM pageviews GROUP BY path ORDER BY views DESC LIMIT 20"
    );
    const byDayRes = await client.execute(
      "SELECT substr(created_at,1,10) as day, COUNT(*) as views, COUNT(DISTINCT visitor_hash) as unique_visitors FROM pageviews GROUP BY day ORDER BY day DESC LIMIT 30"
    );
    const byReferrerRes = await client.execute(
      "SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN '(direct)' ELSE referrer END as referrer, COUNT(*) as views FROM pageviews GROUP BY referrer ORDER BY views DESC LIMIT 20"
    );
    const bySourceRes = await client.execute(
      "SELECT source, COUNT(*) as views FROM pageviews WHERE source IS NOT NULL AND source != '' GROUP BY source ORDER BY views DESC LIMIT 20"
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: totalRes.rows[0] || { total: 0, unique_visitors: 0 },
        byPage: byPageRes.rows,
        byDay: byDayRes.rows,
        byReferrer: byReferrerRes.rows,
        bySource: bySourceRes.rows,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to load stats: " + err.message }),
    };
  }
};
