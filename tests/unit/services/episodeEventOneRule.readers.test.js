/**
 * Every service reads the episode's event through one rule (Task #1917;
 * §8(w) P2: the brief's event is canonical). The rule lives in
 * utils/episodeEventSql (the services) and services/episodeEventsService
 * listEpisodeEvents (the episode's tabs). A read keyed on the stamp alone
 * (world_events.used_in_episode_id = the episode) can name another event
 * after a reassign, so this scans src/ for one and fails unless the place
 * is listed below with the reason it is not "the episode's event".
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DIRS = ['src/services', 'src/routes', 'src/utils'];

// A read of the stamp by episode: SQL `used_in_episode_id = :episodeId`
// (or a join on an episodes alias), or the model's
// `where: { used_in_episode_id: <episode> }`.
const STAMP_READ = [
  /used_in_episode_id\s*=\s*:(episodeId|episode_id|epId|id)\b/,
  /\.used_in_episode_id\s*=\s*(e|ep|eps|episodes)\.id\b/,
  /where:\s*\{\s*used_in_episode_id:\s*[A-Za-z_]/,
];

// file -> why its stamp reads are not the episode's event.
const ALLOWED = {
  'src/services/episodeEventsService.js': 'listEpisodeEvents itself: the rule for the tabs, lists every stamped event',
  'src/services/episodeGeneratorService.js': 'the Start Episode write of the stamp',
  'src/routes/worldEvents.js': 'the inject and generate-from-many writes, and the stale-link cleanup of a deleted episode',
  'src/services/sceneSetUsesService.js': 'scene-set uses: every linked event\'s scene set, not the episode\'s one event',
  'src/utils/eventTermsLock.js': 'the reopen guard: any stamped or brief event of the episode with reopened terms',
  'src/utils/episodeEventSql.js': 'the rule itself, and its doc comment',
};

function jsFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return jsFiles(rel);
    return d.name.endsWith('.js') ? [rel] : [];
  });
}

const hits = DIRS.flatMap(jsFiles).flatMap((file) => {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  return lines
    .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
    .filter(({ text }) => STAMP_READ.some((re) => re.test(text)));
});

describe('the episode\'s event, one rule for every service (Task #1917)', () => {
  test('no service, route or util reads the episode\'s event from the stamp alone', () => {
    const unlisted = hits.filter((h) => !ALLOWED[h.file]).map((h) => `${h.file}:${h.line}  ${h.text}`);
    expect(unlisted).toEqual([]);
  });

  test('every allowed file still has such a line (the list does not go stale)', () => {
    const files = new Set(hits.map((h) => h.file));
    expect(Object.keys(ALLOWED).filter((f) => !files.has(f))).toEqual([]);
  });

  test.each([
    // The services named in #1913's report, plus the readers found since.
    'src/routes/episodes.js', 'src/routes/evaluation.js', 'src/routes/wardrobe.js', 'src/routes/worldEvents.js',
    'src/services/episodeScriptWriterService.js', 'src/services/groundedScriptGeneratorService.js',
    'src/services/financialTransactionService.js', 'src/services/scenePlannerService.js',
    'src/services/distributionService.js', 'src/services/todoListService.js',
    'src/services/storyGenerationService.js', 'src/services/careerPipelineService.js',
    'src/services/wardrobeIntelligenceService.js', 'src/services/episodeMoneyService.js',
    'src/services/outfitScoreContext.js', 'src/services/seasonIntentionService.js',
    'src/services/episodeOverlaysService.js', 'src/services/dressedAngleService.js',
    'src/services/seasonSlotService.js', 'src/services/seasonSuggestionService.js',
    'src/services/episodeInvitationOverlayService.js',
  ])('%s reads through utils/episodeEventSql', (file) => {
    expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toMatch(/episodeEventSql/);
  });

  test('completion and the styling score read through outfitScoreContext\'s one-event SQL', () => {
    const completion = fs.readFileSync(path.join(ROOT, 'src/services/episodeCompletionService.js'), 'utf8');
    const score = fs.readFileSync(path.join(ROOT, 'src/services/outfitScoreContext.js'), 'utf8');
    expect(completion).toMatch(/EPISODE_EVENT_SQL/);
    expect(score).toMatch(/EPISODE_EVENT_SQL = `SELECT \* FROM world_events WHERE id = \$\{EPISODE_EVENT_ID_SQL\}`/);
  });
});
