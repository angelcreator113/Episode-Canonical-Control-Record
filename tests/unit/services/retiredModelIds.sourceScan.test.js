// ============================================================================
// No call sends a retired model ID
// ============================================================================
// claude-sonnet-4-20250514 was retired: Anthropic answers 404 not_found_error
// (seen on the Depth Engine's Generate All, 2026-10-15), so every button
// still sending it failed. CLAUDE.md: primary claude-sonnet-4-6, Haiku 4.5
// for side calls. The pricing table (aiCostTracker) and the usage report's
// groups (aiUsageRoutes) keep old IDs on purpose, to price and group past
// usage; the AIUsageLog column comment only names an example.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const RETIRED = ['claude-sonnet-4-20250514', 'claude-sonnet-4-5-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
const ALLOWED = new Set([
  'src/services/aiCostTracker.js',
  'src/routes/aiUsageRoutes.js',
  'src/models/AIUsageLog.js',
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'migrations' || name === 'seeders') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|cjs|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

test('no source file sends a retired Claude model ID', () => {
  const offenders = [];
  for (const file of [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'frontend', 'src'))]) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const id of RETIRED) if (text.includes(id)) offenders.push(`${rel}: ${id}`);
  }
  expect(offenders).toEqual([]);
});
