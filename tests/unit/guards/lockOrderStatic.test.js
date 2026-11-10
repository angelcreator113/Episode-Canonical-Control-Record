/**
 * A1.3-0 (C6), secondary: a coarse textual ratchet over where src/ takes
 * explicit row locks (FOR UPDATE / FOR SHARE) on the tables of the episode
 * lock order (episodes, world_events, season_slots, season_specials,
 * show_arcs). It is NOT the proof of the order: the runtime trace
 * (tests/integration/lockOrderTrace.integration.test.js) and the gated races
 * (lockOrderMatrix) are. It only makes a new lock statement on these tables
 * visible: a new file, or more statements in a file, fails here until the
 * path is added to the trace (traced: true) or recorded as outside it.
 *
 * How it reads a statement: a line with FOR UPDATE / FOR SHARE, and the last
 * "FROM <table>" within the 6 lines up to it. Locks built from a template
 * (lockEpisodes' mode, lockSpecial's table constant) are not seen by text;
 * the trace sees them at run time.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const TABLES = ['episodes', 'world_events', 'season_slots', 'season_specials', 'show_arcs'];

// traced: the path runs in lockOrderTrace / lockOrderMatrix. The others lock
// one class only, or lie outside the Start and season paths (the A1.1 note
// lists their order); a change there still has to be looked at.
const PINNED = {
  'src/routes/episodeSpending.js': { traced: false, locks: { episodes: 1 } },
  'src/routes/worldEvents/inject.js': { traced: true, locks: { world_events: 1 } },
  'src/services/arcProgressionService.js': { traced: false, locks: { show_arcs: 1 } },
  'src/services/beat14Opportunity.js': { traced: false, locks: { episodes: 2 } },
  'src/services/dealTermsDraftService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/dealTypeDraftService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/episodeCompletionService.js': { traced: false, locks: { episodes: 1 } },
  'src/services/episodeEstimateBackfill.js': { traced: false, locks: { episodes: 1 } },
  'src/services/episodeGeneratorService.js': { traced: true, locks: { world_events: 1 } },
  'src/services/eventCostsService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/eventDocumentsService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/financialTransactionService.js': { traced: false, locks: { episodes: 1 } },
  'src/services/sceneSetVersionService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/seasonFullSpecials.js': { traced: true, locks: { world_events: 1 } },
  'src/services/seasonGoalCoverage.js': { traced: false, locks: { world_events: 1 } },
  'src/services/seasonIntentionService.js': { traced: true, locks: { season_slots: 1 } },
  'src/services/seasonLoader.js': { traced: true, locks: { show_arcs: 1, season_slots: 1 } },
  'src/services/seasonSetupService.js': { traced: true, locks: { world_events: 1, season_slots: 1 } }, // C4c events, C4d target and holder slots, id order
  'src/services/seasonSlotService.js': { traced: true, locks: { season_slots: 5, world_events: 1 } }, // C4c: pencilEventIn's event first. 5th season_slots lock (2026-11-10): placeEpisodeIn's "WHERE id IN (:ids) ... ORDER BY id FOR UPDATE" on the target and the slots holding the episode's event; traced by lockOrderTrace "placeEpisode with the episode's event pencilled in another slot"
  'src/services/seasonSpecials.js': { traced: true, locks: { world_events: 2, season_slots: 1 } },
  'src/services/startOfferDecision.js': { traced: true, locks: { world_events: 1 } },
  'src/services/termsReopenService.js': { traced: false, locks: { episodes: 1, world_events: 1 } },
  'src/services/venueLookService.js': { traced: false, locks: { world_events: 1 } },
  'src/services/voiceStudioService.js': { traced: false, locks: { episodes: 1 } },
  'src/services/youtubeThumbnailService.js': { traced: false, locks: { episodes: 1 } },
  'src/utils/eventScope.js': { traced: true, locks: { world_events: 1 } },
  'src/utils/frozenEpisode.js': { traced: true, locks: { world_events: 1 } },
  'src/utils/worldEventSafeDelete.js': { traced: false, locks: { world_events: 1 } },
};

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

function inventory() {
  const out = {};
  for (const abs of walk(path.join(ROOT, 'src'))) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/FOR (NO KEY )?(UPDATE|SHARE)\b/.test(line)) return;
      const window = lines.slice(Math.max(0, i - 6), i + 1).join(' ');
      const tables = (window.match(/FROM\s+(\w+)/g) || []).map((x) => x.split(/\s+/)[1]).filter((t) => TABLES.includes(t));
      if (!tables.length) return;
      const t = tables[tables.length - 1];
      out[rel] = out[rel] || {};
      out[rel][t] = (out[rel][t] || 0) + 1;
    });
  }
  return out;
}

describe('A1.3-0: lock statements on the episode lock-order tables (coarse ratchet; the trace is the proof)', () => {
  const found = inventory();

  test('no new file takes such a lock without being pinned here (and traced, or recorded as outside the trace)', () => {
    const extra = Object.keys(found).filter((f) => !PINNED[f]);
    expect(extra).toEqual([]);
  });

  test('no pinned file takes more such locks than pinned', () => {
    const over = [];
    for (const [f, tables] of Object.entries(found)) {
      for (const [t, n] of Object.entries(tables)) {
        const pinned = PINNED[f]?.locks?.[t] || 0;
        if (n > pinned) over.push(`${f}: ${t} ${n} > ${pinned}`);
      }
    }
    expect(over).toEqual([]);
  });

  test('the traced season paths use Sequelize only (no raw pg client the trace could not see)', () => {
    const traced = Object.entries(PINNED).filter(([, v]) => v.traced).map(([f]) => f)
      .concat(['src/services/rawClipsService.js', 'src/utils/episodeLocks.js', 'src/routes/rawClipRoutes.js']);
    const raw = traced.filter((f) => /require\(['"]pg['"]\)|new Pool\(|new Client\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(raw).toEqual([]);
  });
});
