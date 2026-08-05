// Records one pageview. No cookies, no raw IP storage — the visitor's IP + user-agent
// + today's date are hashed together into a one-way identifier used only to distinguish
// a "unique visitor" from a page refresh. The raw IP itself is never written to the database.
let createClient;
try {
  ({ createClient } = require("@libsql/client"));
} catch (e) {
  createClient = null;
}
const crypto = require("crypto");

let db = null;
let tableReady = false;

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
  if (tableReady) return;
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      visitor_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  tableReady = true;
}

function hashVisitor(ip, ua, dateStr) {
  const salt = process.env.HASH_SALT || "utilx-analytics-salt";
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${dateStr}|${salt}`)
    .digest("hex");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const client = getDb();
    const body = JSON.parse(event.body || "{}");
    const path = String(body.path || "/").slice(0, 500);
    const referrer = String(body.referrer || "").slice(0, 500);

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "unknown";
    const ua = event.headers["user-agent"] || "unknown";
    const today = new Date().toISOString().slice(0, 10);
    const visitorHash = hashVisitor(ip, ua, today);

    await ensureTable(client);
    await client.execute({
      sql: "INSERT INTO pageviews (path, referrer, visitor_hash) VALUES (?, ?, ?)",
      args: [path, referrer, visitorHash],
    });

    return { statusCode: 204, body: "" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Error recording pageview: " + err.message };
  }
};
