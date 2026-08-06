// Returns aggregated analytics. No password gate — kept out of search engines
// via robots.txt and a noindex meta tag on the dashboard page instead.
let createClient;
try {
  ({ createClient } = require("@libsql/client"));
} catch (e) {
  createClient = null;
}

let db = null;

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

exports.handler = async (event) => {
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
