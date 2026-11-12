/**
 * One way to delete an event, and one lock every event writer shares
 * (Evoni, 2026-11-12; Phase 1, Production Data Safety, PR 1).
 *
 * Static: reads the source, runs nothing.
 *   - world_events.deleted_at is written only by utils/worldEventSafeDelete;
 *   - the helper locks the events in one statement and reads what uses them
 *     in the next (a combined statement misses work that committed while it
 *     waited for the lock);
 *   - Start Episode and inject lock the event with lockLiveEvent, which
 *     refuses a deleted event;
 *   - the single delete and bulk delete are ADMIN only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'migrations') out.push(...sourceFiles(rel)); } else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

describe('deleting an event: one way, one lock', () => {
  test('only the helper writes world_events.deleted_at', () => {
    const writers = sourceFiles('src').filter((rel) => {
      const text = code(read(rel));
      return /UPDATE\s+world_events\s+SET\s+[^;`'"]*\bdeleted_at\s*=/i.test(text) || /DELETE\s+FROM\s+world_events\b/i.test(text)
        || /WorldEvent\.destroy\(/.test(text);
    });
    expect(writers).toEqual(['src/utils/worldEventSafeDelete.js']);
  });

  test('the helper locks first and looks second, as two statements', () => {
    const text = code(read('src/utils/worldEventSafeDelete.js'));
    const body = text.slice(text.indexOf('async function softDeleteUnusedUnlinkedEvents'));
    const lock = body.indexOf('ORDER BY we.id FOR UPDATE OF we');
    const look = body.indexOf('AS linked_by');
    expect(lock).toBeGreaterThan(-1);
    expect(look).toBeGreaterThan(lock);
    // The statement that reads the links takes no lock, and the one that locks reads no links.
    const lookStatement = body.slice(body.lastIndexOf('sequelize.query(', look), body.indexOf(');', look));
    expect(lookStatement).not.toMatch(/FOR UPDATE/);
    const lockStatement = body.slice(body.lastIndexOf('sequelize.query(', lock), lock);
    expect(lockStatement).not.toMatch(/linked_by|linkedBy/);
  });

  test('the owned-preparation rule is opt-in, and only the single delete asks for it', () => {
    expect(code(read('src/utils/worldEventSafeDelete.js'))).toContain('allowOwnedPreparation = false');
    const callers = sourceFiles('src').filter((rel) => /allowOwnedPreparation:\s*true/.test(code(read(rel))));
    expect(callers).toEqual(['src/routes/worldEvents/update.js']);
  });

  test('Start Episode and inject lock the event with lockLiveEvent', () => {
    const link = code(read('src/utils/eventEpisodeLink.js'));
    const fn = link.slice(link.indexOf('async function lockLiveEvent'), link.indexOf('module.exports'));
    expect(fn).toMatch(/FROM world_events WHERE id = :eventId FOR UPDATE/);
    expect(fn).toMatch(/!row \|\| row\.deleted_at/);
    expect(code(read('src/services/episodeGeneratorService.js'))).toMatch(/await lockLiveEvent\(models\.sequelize, eventId, \{ transaction \}\)/);
    expect(code(read('src/routes/worldEvents/inject.js'))).toMatch(/await lockLiveEvent\(models\.sequelize, eventId, \{ transaction: t \}\)/);
    // No writer that links an event to an episode locks it another way.
    for (const rel of ['src/services/episodeGeneratorService.js', 'src/routes/worldEvents/inject.js']) {
      expect(code(read(rel))).not.toMatch(/FROM world_events WHERE id = :eventId FOR UPDATE/);
    }
  });

  test('both delete routes are ADMIN only', () => {
    expect(code(read('src/routes/worldEvents/update.js'))).toMatch(/router\.delete\('\/world\/:showId\/events\/:eventId', requireAuth, authorize\(\['ADMIN'\]\)/);
    expect(code(read('src/routes/worldEvents/episodeBatch.js'))).toMatch(/router\.post\('\/world\/:showId\/events\/bulk-delete', requireAuth, authorize\(\['ADMIN'\]\)/);
  });
});
