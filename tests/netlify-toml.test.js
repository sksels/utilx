const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression test for a real deploy-breaking bug: `command` was nested under
// [build.environment] instead of [build] in netlify.toml. TOML treats those as two
// distinct tables -- [build.environment] is reserved for environment variables, so a
// `command` key placed there is read by Netlify as an env var literally named "command",
// not as the actual build command. Netlify still picked up `publish = "dist"` correctly
// (a real [build] key), ran no build command at all, and every deploy failed at the
// publish step with "Deploy directory 'dist' does not exist" -- while `npm run build`
// (what our own build/test steps run) never touches netlify.toml at all, so nothing
// local could ever have caught this. This test parses netlify.toml's top-level table
// structure (no full TOML parser needed -- just enough to catch keys landing under the
// wrong section) and asserts `command`/`publish` are direct children of [build].
function parseTopLevelTables(source) {
  const tables = {};
  let current = null;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/) || line.match(/^\[\[([^\]]+)\]\]$/);
    if (sectionMatch) {
      current = sectionMatch[1];
      if (!tables[current]) tables[current] = {};
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z_][\w.-]*)\s*=/);
    if (kvMatch && current) {
      tables[current][kvMatch[1]] = true;
    }
  }
  return tables;
}

test('netlify.toml: [build] directly defines both command and publish', () => {
  const source = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  const tables = parseTopLevelTables(source);
  assert.ok(tables.build, '[build] table not found in netlify.toml');
  assert.ok(tables.build.command, '[build] is missing a `command` key -- without it, Netlify never runs the build and deploy fails with "Deploy directory \'dist\' does not exist"');
  assert.ok(tables.build.publish, '[build] is missing a `publish` key');
});

test('netlify.toml: [build.environment] does not accidentally redefine command/publish', () => {
  const source = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  const tables = parseTopLevelTables(source);
  if (tables['build.environment']) {
    assert.ok(!tables['build.environment'].command, '`command` is nested under [build.environment] instead of [build] -- Netlify reads it as an env var named "command", not the build command');
    assert.ok(!tables['build.environment'].publish, '`publish` is nested under [build.environment] instead of [build]');
  }
});

test('netlify.toml: build command actually invokes the Astro build', () => {
  const source = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  const match = source.match(/command\s*=\s*"([^"]*)"/);
  assert.ok(match, 'could not find a quoted `command` value in netlify.toml');
  assert.match(match[1], /npm run build/, 'build command does not run `npm run build`');
});
