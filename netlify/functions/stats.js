// Returns aggregated analytics. Protected by a password check against the
// STATS_PASSWORD environment variable — never exposed publicly or indexed.
const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

exports.handler = async (event) => {
  const password = event.queryStringParameters && event.queryStringParameters.password;
  if (!process.env.STATS_PASSWORD || password !== process.env.STATS_PASSWORD) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  try {
    const totalRes = await db.execute(
      "SELECT COUNT(*) as total, COUNT(DISTINCT visitor_hash) as unique_visitors FROM pageviews"
    );
    const byPageRes = await db.execute(
      "SELECT path, COUNT(*) as views FROM pageviews GROUP BY path ORDER BY views DESC LIMIT 20"
    );
    const byDayRes = await db.execute(
      "SELECT substr(created_at,1,10) as day, COUNT(*) as views, COUNT(DISTINCT visitor_hash) as unique_visitors FROM pageviews GROUP BY day ORDER BY day DESC LIMIT 30"
    );
    const byReferrerRes = await db.execute(
      "SELECT CASE WHEN referrer = '' OR referrer IS NULL THEN '(direct)' ELSE referrer END as referrer, COUNT(*) as views FROM pageviews GROUP BY referrer ORDER BY views DESC LIMIT 20"
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: totalRes.rows[0] || { total: 0, unique_visitors: 0 },
        byPage: byPageRes.rows,
        byDay: byDayRes.rows,
        byReferrer: byReferrerRes.rows,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to load stats" }),
    };
  }
};
