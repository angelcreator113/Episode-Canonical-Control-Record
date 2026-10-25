/**
 * The worldEvents router's source, for tests that read it as text.
 *
 * The router was one file (src/routes/worldEvents.js) until Task #54 split it
 * into src/routes/worldEvents/: index.js mounts the parts in their original
 * order and helpers.js holds what more than one part uses. worldEventsSource()
 * joins helpers.js and the parts in mount order, so a regex or a
 * between(start, end) slice reads the code in the same order as before.
 */

const fs = require('fs');
const path = require('path');

const WORLD_EVENTS_DIR = path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldEvents');

/** helpers.js, then each part in the order index.js mounts it. */
function worldEventsFiles() {
  const index = fs.readFileSync(path.join(WORLD_EVENTS_DIR, 'index.js'), 'utf8');
  const parts = [...index.matchAll(/router\.use\(require\('\.\/([A-Za-z]+)'\)\)/g)].map((m) => `${m[1]}.js`);
  return ['helpers.js', ...parts];
}

function worldEventsSource() {
  return worldEventsFiles().map((f) => fs.readFileSync(path.join(WORLD_EVENTS_DIR, f), 'utf8')).join('\n');
}

module.exports = { WORLD_EVENTS_DIR, worldEventsFiles, worldEventsSource };
