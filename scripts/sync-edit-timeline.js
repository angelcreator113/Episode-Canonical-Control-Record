#!/usr/bin/env node
/**
 * Writes the editor's copy of the episode edit's clock:
 * frontend/src/lib/editTimeline.js from src/utils/editTimeline.js, changing
 * only the two module lines (design R8.11.1; Timeline Editor redesign P1,
 * 2026-11-02). frontend/src/lib/editTimeline.test.js fails when the two
 * differ. Run after any change to the server module:
 *
 *   node scripts/sync-edit-timeline.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const from = path.join(ROOT, 'src/utils/editTimeline.js');
const to = path.join(ROOT, 'frontend/src/lib/editTimeline.js');
const head = "'use strict';\n\n";

const text = fs.readFileSync(from, 'utf8');
if (!text.startsWith(head)) {
  console.error("src/utils/editTimeline.js must start with 'use strict' and a blank line");
  process.exit(1);
}
if ((text.match(/^module\.exports = \{/gm) || []).length !== 1) {
  console.error('src/utils/editTimeline.js must have exactly one `module.exports = {`');
  process.exit(1);
}
fs.writeFileSync(to, text.slice(head.length).replace(/^module\.exports = \{/m, 'export {'));
console.log(`Wrote ${path.relative(ROOT, to)}`);
