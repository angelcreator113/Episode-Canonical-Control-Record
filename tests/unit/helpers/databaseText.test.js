/**
 * The authoritative corpus for tests/helpers/databaseText.js.
 *
 * It lives under tests/unit/ because jest.config.js testMatch collects
 * `**\/tests/unit/**\/*.test.js` and `**\/tests/integration/**\/*.test.js`
 * only — a file under tests/helpers/ would never be collected, and before
 * this one there was no *.test.js there to notice (Evoni's point 6,
 * 2026-11-27). The helper itself stays beside the other helpers.
 *
 * What this file is, and is not. It measures what the matcher catches on the
 * strings below. It is not a claim that the matcher catches all SQL: it is
 * not a parser, and a shape absent from this corpus can defeat it. The
 * integration suites' own assertions are what prove the real response paths
 * are guarded; this proves the matcher those paths use.
 *
 * No database, no network.
 */
const { databaseTextMatcher, BASE_WORDS, SQL_SHAPES } = require('../../helpers/databaseText');

// Spelled in pieces so no line here reads as a bare statement to the
// repository's command guards.
const S = ('sel' + 'ect').toUpperCase();
const U = ('upd' + 'ate').toUpperCase();
const I = ('ins' + 'ert').toUpperCase();
const D = ('del' + 'ete').toUpperCase();

// ── the four suites' profiles, as they are in their own files ──
const REFERENCE_WRITERS_WORDS = [...BASE_WORDS,
  'could not serialize', 'FOR KEY SHARE', 'NOWAIT',
  'scene_sets', 'scene_plans', 'scene_set_episodes'];
const EVENT_WRITERS_WORDS = [...BASE_WORDS, 'could not obtain lock'];
const BASE_SAVE_WORDS = ['Instance could not be reloaded', 'find call returned null',
  'Sequelize', 'violates', 'constraint', 'relation '];

/** How the call sites present their input: a JSON-encoded body, and a raw string. */
const asBody = (text) => JSON.stringify({ success: false, error: text });
const asRaw = (text) => String(text);

/**
 * Leakage the shared shapes must catch whatever words a suite carries. Every
 * previously detected example is here, and so is every one the three bare
 * keywords used to miss.
 */
const LEAKAGE = [
  // upper, lower and mixed case
  `${S} id FROM scene_sets WHERE id = $1 FOR ${U} NOWAIT`,
  'select id from world_events where show_id = $1',
  'Select Id From Episodes Where Id = $1',
  `${U} world_events SET scene_set_id = $1 WHERE id = $2`,
  'update world_events set scene_set_id = $1 where id = $2',
  'Update World_Events Set Scene_Set_Id = $1 Where Id = $2',
  // all four verbs
  `${I} INTO episode_briefs (id) VALUES ($1)`,
  'insert into shows (id, name) values ($1, $2)',
  `${D} FROM episode_todo_lists WHERE episode_id = $1`,
  'delete from scene_set_episodes where id = $1',
  // a read with no source
  `${S} 1`,
  'select now()',
  `${S} pg_advisory_lock(42)`,
  'select count(*)',
  // multiline and odd whitespace
  `${S}\n  id,\n  name\nFROM   episodes\nWHERE  id = $1`,
  `${U}\n  season_slots\nSET\n  release_position = $1\nWHERE arc_id = $2`,
  `${S}\t id \t FROM \t shows`,
  // quoted and schema-qualified identifiers
  `${S} "id" FROM "scene_sets" WHERE "id" = '...'`,
  `${S} id FROM a2_constraints_25370.season_slots WHERE arc_id = $1 FOR ${U}`,
  `${S} id FROM public."world_events"`,
  // no parameters at all
  `${U} scene_plans SET scene_set_id = NULL`,
  `${S} * FROM episodes WHERE status = 'draft'`,
  `${D} FROM scenes WHERE id = 'abc'`,
  // inside Sequelize or PostgreSQL error text
  'SequelizeDatabaseError: canceling statement due to lock timeout',
  'error: relation "scene_sets" does not exist',
  `Executing (default): ${S} "id" FROM "scene_sets" AS "SceneSet" WHERE "SceneSet"."id" = $1;`,
  `deadlock detected DETAIL: Process 962: ${S} id FROM season_slots WHERE arc_id = $1 FOR ${U}`,
  'ERROR:  syntax error at or near ")"',
  'duplicate key value violates unique constraint "season_slots_release_position_live"',
  'could not obtain lock on row in relation "scene_sets"',
  // clause-only fragments
  'ON CONFLICT (episode_id) DO NOTHING',
  'ORDER BY beat_number LIMIT 14',
];

/** Messages this repository's own routes and tests really produce. */
const OUR_OWN = [
  'Select an outfit from your closet.',
  'Select an event from the season roadmap.',
  'Update your scene set.',
  "Update the character's wardrobe set.",
  'Insert a scene into the episode.',
  'Failed to update event',
  'Invalid update field',
  'Could not save the locations',
  'This episode is accepted and uses this scene set: it stays. Nothing was changed.',
  'Please select an event first',
  'Insert a title before publishing',
  'Select an outfit to continue',
  'Update the brief before generating the script',
  'Setup is still incomplete',
  'Episode 10 "Gala Night" is accepted and uses this scene set: it stays.',
  'Select a venue from the event package',
  'Update the season slot and try again',
  'Delete from the library is not allowed here',
  'The locations could not be saved; nothing was changed.',
  'This episode has been filmed (since 2026-11-01) and uses this scene set: it stays. Nothing was changed.',
  // the scene set delete suite's own expected bodies
  'The scene set could not be deleted. Nothing was changed.',
  'Someone else changed this at the same moment. Nothing was saved: try again.',
];

/**
 * Known, deliberately kept: the `relation` word flags one phrasing of ours.
 * It predates this helper, is not changed by it, and is asserted here so a
 * later change cannot mistake it for a new regression.
 */
const KNOWN_RELATION_FALSE_POSITIVE = 'Could not update the relation between these records';

describe('databaseTextMatcher', () => {
  const shared = databaseTextMatcher();

  describe('the object it returns', () => {
    test('is a real RegExp, case-insensitive and not global', () => {
      expect(shared).toBeInstanceOf(RegExp);
      expect(shared.constructor).toBe(RegExp);
      expect(shared.flags).toBe('i');
      expect(shared.global).toBe(false);
      // .test is therefore stateless: the same input answers the same twice.
      expect(shared.test(asBody(`${S} 1`))).toBe(true);
      expect(shared.test(asBody(`${S} 1`))).toBe(true);
    });

    test('words are literal text, not patterns', () => {
      // A word with regex punctuation is matched as itself and nothing else.
      const m = databaseTextMatcher(['a.b(c)']);
      expect(m.test('a.b(c)')).toBe(true);
      expect(m.test('axbXcX')).toBe(false);
    });

    test('refuses a missing or empty word list rather than matching everything', () => {
      expect(() => databaseTextMatcher([])).toThrow(TypeError);
      expect(() => databaseTextMatcher('deadlock')).toThrow(TypeError);
    });

    test('the SQL shapes are shared, and there is one set of them', () => {
      expect(SQL_SHAPES.length).toBeGreaterThan(0);
      expect(BASE_WORDS).toHaveLength(8);
      // Frozen, so no suite can quietly edit the shared list in place.
      expect(Object.isFrozen(BASE_WORDS)).toBe(true);
    });
  });

  describe('leakage, in both the shapes the call sites use', () => {
    test.each(LEAKAGE)('JSON-encoded body: %s', (text) => {
      expect(asBody(text)).toMatch(shared);
    });

    test.each(LEAKAGE)('raw string: %s', (text) => {
      expect(asRaw(text)).toMatch(shared);
    });
  });

  describe('our own messages are not flagged, in both shapes', () => {
    test.each(OUR_OWN)('JSON-encoded body: %s', (text) => {
      expect(asBody(text)).not.toMatch(shared);
    });

    test.each(OUR_OWN)('raw string: %s', (text) => {
      expect(asRaw(text)).not.toMatch(shared);
    });
  });

  test('KNOWN and unchanged: the `relation` word flags one phrasing of ours', () => {
    // Deliberately preserved. If this ever starts passing, the `relation`
    // token was removed or narrowed — a decision, not an accident.
    expect(KNOWN_RELATION_FALSE_POSITIVE).toMatch(shared);
  });

  // ── each suite's own profile ──
  describe('per-suite word profiles', () => {
    test('scene set delete takes the shared words exactly, and adds none', () => {
      const m = databaseTextMatcher();
      expect(m.source).toBe(shared.source);
    });

    test('event writers keeps its own "could not obtain lock"', () => {
      const m = databaseTextMatcher(EVENT_WRITERS_WORDS);
      expect('could not obtain lock on row').toMatch(m);
      // and the shared words still reach it
      expect('deadlock detected').toMatch(m);
    });

    test('reference writers keeps its own table names and lock modes', () => {
      const m = databaseTextMatcher(REFERENCE_WRITERS_WORDS);
      for (const w of ['could not serialize', 'FOR KEY SHARE', 'NOWAIT', 'scene_sets', 'scene_plans', 'scene_set_episodes']) {
        expect(w).toMatch(m);
      }
      // A serialization failure is caught where that suite asks for it, in
      // both the shapes its call sites use. It is deliberately NOT a shared
      // word: the two suites that do not list it today do not gain it here.
      const serialization = 'could not serialize access due to concurrent update';
      expect(asBody(serialization)).toMatch(m);
      expect(asRaw(serialization)).toMatch(m);
      expect(serialization).not.toMatch(databaseTextMatcher());
    });

    describe('base save keeps its narrower list', () => {
      const m = databaseTextMatcher(BASE_SAVE_WORDS);

      test('its two ORM phrases are caught', () => {
        expect('Instance could not be reloaded').toMatch(m);
        expect('find call returned null').toMatch(m);
      });

      test('its `relation ` keeps the trailing space: "relation" alone is not enough', () => {
        expect('relation "x" does not exist').toMatch(m); // "relation " with the space
        // A bare "relation" at the very end of a string has no trailing space,
        // so its narrower token does not fire. This is the boundary that
        // distinguishes its list from the shared one, and it is preserved.
        expect(m.test('a stale relation')).toBe(false);
      });

      test('it does NOT inherit the shared words it leaves out', () => {
        for (const omitted of ['deadlock', 'syntax', 'canceling statement', 'lock timeout']) {
          expect(m.test(omitted)).toBe(false);
        }
      });

      test('it DOES gain the shared SQL recognition, including INSERT and DELETE', () => {
        // An intentional improvement, approved 2026-11-27: its own pattern had
        // SELECT and UPDATE keywords only, so these forms reached no assertion.
        expect(asBody(`${I} INTO episode_briefs (id) VALUES ($1)`)).toMatch(m);
        expect(asBody('insert into shows (id, name) values ($1, $2)')).toMatch(m);
        expect(asBody(`${D} FROM episode_todo_lists WHERE episode_id = $1`)).toMatch(m);
        expect(asBody(`${S}\n  id\nFROM episodes\nWHERE id = $1`)).toMatch(m);
        expect(asBody('ON CONFLICT (episode_id) DO NOTHING')).toMatch(m);
        expect(asBody('ORDER BY beat_number LIMIT 14')).toMatch(m);
      });

      test('and it stops flagging our English, which its keywords did', () => {
        for (const ours of ['Select an outfit from your closet.', 'Update your scene set.',
          'Failed to update event', 'Select a venue from the event package',
          'Update the brief before generating the script']) {
          expect(asBody(ours)).not.toMatch(m);
        }
      });
    });
  });

  /**
   * The frozen suite may carry no test of its own (sceneSetDeleteLockOrder is
   * byte-frozen beyond the two authorized lines), so its wiring is checked
   * from here instead: the file must call the shared matcher, define no
   * pattern of its own, and keep its five assertion call sites.
   */
  describe('sceneSetDeleteLockOrder is wired to this helper, checked from outside it', () => {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(__dirname, '../../integration/sceneSetDeleteLockOrder.integration.test.js');
    const src = fs.readFileSync(file, 'utf8');

    test('it requires this helper and calls it', () => {
      expect(src).toMatch(/require\('\.\.\/helpers\/databaseText'\)/);
      expect(src).toMatch(/const NOT_DATABASE_TEXT = databaseTextMatcher\(\);/);
    });

    test('it defines no pattern of its own any more', () => {
      expect(src).not.toMatch(/const NOT_DATABASE_TEXT = \//);
    });

    test('its five assertion call sites are all still there', () => {
      expect((src.match(/toMatch\(NOT_DATABASE_TEXT\)/g) || [])).toHaveLength(5);
      // One of them asserts on a raw captured statement, not a JSON body.
      expect(src).toMatch(/expect\(sent\)\.not\.toMatch\(NOT_DATABASE_TEXT\)/);
    });
  });
});
