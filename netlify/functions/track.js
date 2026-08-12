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
      source TEXT,
      visitor_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migration for databases created before the "source" column existed.
  // Fails harmlessly if the column is already there.
  try {
    await client.execute(`ALTER TABLE pageviews ADD COLUMN source TEXT`);
  } catch (e) {
    /* column already exists */
  }
  tableReady = true;
}

let warnedAboutDefaultSalt = false;

function hashVisitor(ip, ua, dateStr) {
  const salt = process.env.HASH_SALT;
  if (!salt && !warnedAboutDefaultSalt) {
    // Security note (security release): HASH_SALT isn't just an internal detail -- it's
    // published in this file's source (this repo is not currently public, but "not public
    // yet" isn't the same guarantee as "secret"). Falling back to a hardcoded, guessable
    // salt makes the visitor hash crackable (an attacker who can also see/guess IP+UA+date
    // could brute-force it), which defeats the point of hashing it in the first place. This
    // doesn't block tracking -- a pageview counter isn't worth breaking over -- but it logs
    // loudly, once per cold start, so a missing HASH_SALT doesn't go unnoticed silently.
    // Action needed: set HASH_SALT to a long random value in Netlify env vars for all three
    // environments (production, staging, development).
    console.warn(
      "SECURITY: HASH_SALT is not set -- falling back to a hardcoded default salt. " +
      "Set HASH_SALT in Netlify environment variables (production, staging, and development) " +
      "to a long random value so visitor hashes can't be brute-forced."
    );
    warnedAboutDefaultSalt = true;
  }
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${dateStr}|${salt || "utilx-analytics-salt"}`)
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
    const source = String(body.source || "").slice(0, 100);

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "unknown";
    const ua = event.headers["user-agent"] || "unknown";
    const today = new Date().toISOString().slice(0, 10);
    const visitorHash = hashVisitor(ip, ua, today);

    await ensureTable(client);
    await client.execute({
      sql: "INSERT INTO pageviews (path, referrer, source, visitor_hash) VALUES (?, ?, ?, ?)",
      args: [path, referrer, source, visitorHash],
    });

    return { statusCode: 204, body: "" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Error recording pageview: " + err.message };
  }
};
