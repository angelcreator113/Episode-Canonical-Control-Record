/**
 * Line identity (architecture A1a; Evoni, 2026-10-26). The acceptance tests
 * of docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md R3.7,
 * numbered as there. Test 1 (parity with the frontend copy) is in
 * frontend/src/lib/lineKeys.test.js, which loads this module beside its own.
 */
const fs = require('fs');
const path = require('path');
const lk = require('../../../src/utils/lineKeys');
const { splitScriptBeats } = require('../../../src/utils/scriptBeatLocks');
const { headerNumber } = require('../../../src/utils/beatLabelNumber');
const F = require('../../fixtures/lineKeysScripts');
const EP1 = require('../../fixtures/myLittleListEpisode1');

const texts = (script) => lk.scriptLines(script).map((l) => l.text);
const keysOf = (stored) => stored.lines.map((e) => e.k);
const first = (script, seed = 1) => lk.reconcileLineKeys(null, script, { rand: F.seeded(seed) }).stored;
// The editor's hints for `next`: the key of the line each new line came from.
const hintsFrom = (stored, from) => from.map((p) => (p == null ? null : stored.lines[p].k));
const lines = (...rows) => rows.join('\n');

describe('A1a line identity', () => {
  test('2. beat headers are read as the Script tab and the beat locks read them', () => {
    for (const form of F.HEADER_FORMS) {
      const got = lk.scriptLines(form.script);
      expect(got.map((l) => l.b)).toEqual(form.beats);
      // Each line is in the beat scriptBeatLocks puts it in (the preamble is 0).
      const { beats } = splitScriptBeats(form.script);
      const beatOfText = new Map();
      for (const b of beats) for (const row of b.text.split('\n').slice(1)) if (row.trim()) beatOfText.set(row, b.number);
      for (const l of got) expect(l.b).toBe(beatOfText.has(l.text) ? beatOfText.get(l.text) : (beats.length ? 0 : null));
    }
    // A numbered header's beat is headerNumber's.
    expect(lk.scriptLines('## BEAT: 7 · Interruption Pulse 2\nLala: Again?')[0].b).toBe(headerNumber('7 · Interruption Pulse 2'));
    // Episode 1: every line in the beat its header names.
    expect([...new Set(lk.scriptLines(EP1.SCRIPT).map((l) => l.b))]).toEqual([1, 3, 4, 5, 6, 8, 11, 14]);
  });

  test('3. headers and blank lines have no entry; tags and hidden cues do', () => {
    expect(texts(F.TAGGED)).toEqual(F.TAGGED_LINES);
    expect(lk.scriptLines(F.TAGGED).every((l) => !/##\s*BEAT/i.test(l.text))).toBe(true);
    expect(lk.scriptLines('\n\n   \n## BEAT: 1 · Opening\n\n')).toEqual([]);
  });

  test('4. spacing, quote and dash variants keep the hash; a changed word changes it', () => {
    const hashes = new Set(F.SAME_LINE.map(lk.lineHash));
    expect(hashes.size).toBe(1);
    expect(lk.lineHash(F.OTHER_LINE)).not.toBe([...hashes][0]);
    expect(lk.lineHash('Lala: okay.')).not.toBe(lk.lineHash('Lala: Okay.'));
    expect(lk.lineHash('')).toMatch(/^[0-9a-f]{8}$/);
  });

  test('5. with hints, keys survive rewording, reordering, moves between beats, a split and a merge', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    // Reworded line 1, lines 3 and 4 swapped, line 0 moved to beat 5, line 5 split,
    // lines 6 and 7 merged into one.
    const next = lines(
      '## BEAT: 1 · Opening Ritual',
      'Prime: Morning, chat! Welcome back.',
      '## BEAT: 4 · Interruption Pulse 1',
      'Lala: Ooh, mail!',
      '[UI:NOTIFY Mail]',
      '## BEAT: 5 · Reveal',
      'Lala: Morning. Coffee first.',
      'Lala: Oh, a letter.',
      'Lala: From the studio!',
      '[UI:DISPLAY Invitation] They want me at the studio!',
    );
    const hints = [k[1], k[3], k[2], k[0], k[4], null, k[5]];
    const { stored, report } = lk.reconcileLineKeys(base, next, { hints, rand: F.seeded(9) });
    expect(keysOf(stored)).toEqual([k[1], k[3], k[2], k[0], k[4], report.minted[0].key, k[5]]);
    expect(report.edited.map((e) => e.key)).toEqual([k[1], k[4], k[5]]);
    expect(report.moved.map((e) => e.key)).toEqual([k[0]]);
    expect(report.minted).toHaveLength(1);
    expect(report.retired).toEqual([k[6]]);
    expect(stored.retired.map((e) => e.k)).toEqual([k[6]]);
    expect(lk.checkLineKeys(next, stored).status).toBe('ok');
  });

  test('6. unknown, retired and duplicated hints are refused and reported; those lines are matched instead', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    const afterDelete = lk.reconcileLineKeys(base, F.BASE.replace('Lala: Ooh, mail!\n', ''), { hints: hintsFrom(base, [0, 1, 2, 4, 5, 6]), rand: F.seeded(2) }).stored;
    expect(afterDelete.retired.map((e) => e.k)).toEqual([k[3]]);
    const next = lines(
      '## BEAT: 1 · Opening Ritual',
      'Lala: Morning. Coffee first.',
      'Prime: Good morning, everyone.',
      '## BEAT: 4 · Interruption Pulse 1',
      '[UI:NOTIFY Mail]',
      'Lala: Ooh, mail!',
    );
    const { stored, report } = lk.reconcileLineKeys(afterDelete, next, { hints: ['ln_aaaaaaaaaa', k[0], k[0], k[3]], rand: F.seeded(3) });
    expect(report.refusedHints).toEqual([
      { index: 0, key: 'ln_aaaaaaaaaa', reason: 'unknown' },
      { index: 2, key: k[0], reason: 'duplicate' },
      { index: 3, key: k[3], reason: 'retired' },
    ]);
    // The editor's valid hint is trusted: line 1 holds k[0]. Line 0's hint was
    // refused and nothing live matches it, so it gets a new key; line 2 matches
    // its own line; the retired k[3] is not given back to "Ooh, mail!" even with
    // the same words.
    expect(stored.lines[1].k).toBe(k[0]);
    expect(report.minted.map((e) => e.index)).toEqual([0, 3]);
    expect(stored.lines[2].k).toBe(k[2]);
    expect(stored.lines[3].k).not.toBe(k[3]);
    expect(keysOf(stored)).not.toContain(k[3]);
  });

  test('7. without hints: unchanged, edited in place, moved, removed and added lines', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    const next = lines(
      '## BEAT: 1 · Opening Ritual',
      'Lala: Morning. Coffee first, always.',
      'Prime: Good morning, everyone.',
      '## BEAT: 4 · Interruption Pulse 1',
      '[UI:NOTIFY Mail]',
      'Lala: Ooh, mail!',
      'Prime: What did you get?',
      '## BEAT: 5 · Reveal',
      'Lala: They want me at the studio!',
      '[UI:DISPLAY Invitation]',
    );
    const { stored, report } = lk.reconcileLineKeys(base, next, { prevText: F.BASE, rand: F.seeded(4) });
    // In beat 5 two lines swapped: the longest run keeps "They want me…" and the
    // invitation line is reported as moved.
    expect(report.kept).toEqual([{ index: 1, key: k[1] }, { index: 2, key: k[2] }, { index: 3, key: k[3] }, { index: 5, key: k[6] }]);
    expect(report.edited).toEqual([{ index: 0, key: k[0] }]);
    expect(report.moved).toEqual([{ index: 6, key: k[5] }]);
    expect(report.minted.map((e) => e.index)).toEqual([4]);
    expect(report.retired).toEqual([k[4]]);
    expect(keysOf(stored)[4]).toBe(report.minted[0].key);

    // Without the previous text, an edited line is not guessed: it gets a new key.
    const blind = lk.reconcileLineKeys(base, next, { rand: F.seeded(4) }).report;
    expect(blind.edited).toEqual([]);
    expect(blind.retired).toEqual([k[0], k[4]]);

    // Unrelated words in the same place are not an edit.
    const replaced = lk.reconcileLineKeys(base, F.BASE.replace('Prime: Good morning, everyone.', 'Nia: Did you see the runway news?'), { prevText: F.BASE, rand: F.seeded(5) }).report;
    expect(replaced.edited).toEqual([]);
    expect(replaced.retired).toEqual([k[1]]);
  });

  test('8. retired history only grows, through saves, an import and restores', () => {
    const v1 = first(F.BASE);
    const v2Text = F.BASE.replace('Prime: Good morning, everyone.\n', '');
    const importText = lines('## BEAT: 1 · Opening Ritual', 'Prime: An imported script.', 'Lala: Totally new.');
    const retiredKeys = (stored) => stored.retired.map((e) => e.k);
    const grewFrom = (before, after) => expect(retiredKeys(after)).toEqual(expect.arrayContaining(retiredKeys(before)));

    const v2 = lk.reconcileLineKeys(v1, v2Text, { prevText: F.BASE, rand: F.seeded(10) }).stored;
    grewFrom(v1, v2);
    expect(retiredKeys(v2)).toHaveLength(1);
    const imported = lk.reconcileLineKeys(v2, importText, { rand: F.seeded(11) }).stored;
    grewFrom(v2, imported);
    expect(retiredKeys(imported)).toHaveLength(1 + v2.lines.length);
    const restored = lk.restoreLineKeys(imported, v2, v2Text).stored;
    // Restoring v2 takes only v2's own keys off the list; the imported lines' keys join it.
    const reinstated = new Set(keysOf(v2));
    expect(retiredKeys(restored)).toEqual(expect.arrayContaining(retiredKeys(imported).filter((key) => !reinstated.has(key))));
    expect(retiredKeys(restored)).toEqual(expect.arrayContaining(keysOf(imported)));
    // A later save keeps all of it.
    const again = lk.reconcileLineKeys(restored, `${v2Text}\nLala: One more.`, { prevText: v2Text, rand: F.seeded(12) }).stored;
    grewFrom(restored, again);
  });

  test('9. a retired key is never given to other dialogue; minting avoids every key ever used', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    // Delete "Ooh, mail!", then type a different line in its place.
    const deleted = lk.reconcileLineKeys(base, F.BASE.replace('Lala: Ooh, mail!\n', ''), { prevText: F.BASE, rand: F.seeded(20) }).stored;
    const retyped = F.BASE.replace('Lala: Ooh, mail!', 'Lala: Wow, the post came early!');
    const after = lk.reconcileLineKeys(deleted, retyped, { prevText: F.BASE.replace('Lala: Ooh, mail!\n', ''), rand: F.seeded(21) }).stored;
    expect(keysOf(after)).not.toContain(k[3]);
    // A full import, then restoring a different version: k[3] stays retired.
    const imported = lk.reconcileLineKeys(after, lines('## BEAT: 4 · Interruption Pulse 1', 'Lala: Ooh, mail!'), { rand: F.seeded(22) }).stored;
    expect(keysOf(imported)).not.toContain(k[3]);
    const other = { text: F.BASE.replace('Lala: Ooh, mail!\n', ''), keys: deleted };
    const restored = lk.restoreLineKeys(imported, other.keys, other.text).stored;
    expect(keysOf(restored)).not.toContain(k[3]);
    expect(restored.retired.map((e) => e.k)).toContain(k[3]);
    // Minting never returns a key in use, even when the random source repeats one.
    const taken = new Set(['ln_aaaaaaaaaa']);
    const zeroThenOne = (() => { let n = 0; return () => (n++ < 10 ? 0 : 0.999); })();
    expect(lk.mintLineKey(zeroThenOne, taken)).toBe('ln_7777777777');
    expect(() => lk.mintLineKey(() => 0, taken)).toThrow('could not mint');
  });

  test('10. restoring a version brings back exactly its keys; keys retired since stay retired', () => {
    const v1 = first(F.BASE);
    const k = keysOf(v1);
    const edited = lk.reconcileLineKeys(v1, F.BASE.replace('Lala: Ooh, mail!', 'Prime: Something arrived.'), { prevText: F.BASE, rand: F.seeded(30) }).stored;
    const newLine = keysOf(edited).find((key) => !k.includes(key));
    const { stored, report } = lk.restoreLineKeys(edited, v1, F.BASE);
    expect(keysOf(stored)).toEqual(k);
    expect(stored.text_hash).toBe(lk.scriptTextHash(F.BASE));
    expect(report.reinstated).toEqual([k[3]]);
    expect(report.retired).toEqual([newLine]);
    expect(stored.retired.map((e) => e.k)).toEqual([newLine]);
    expect(lk.checkLineKeys(F.BASE, stored).status).toBe('ok');
    // A version whose keys don't describe its text is refused, not guessed.
    expect(() => lk.restoreLineKeys(edited, v1, `${F.BASE}\nLala: extra`)).toThrow('do not describe its text');
  });

  test('11. a beat a regeneration returns word for word keeps every key without hints', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    const regenerated = lines(
      '## BEAT: 1 · Opening Ritual',
      'Prime: A brand new opening.',
      '## BEAT: 4 · Interruption Pulse 1',
      '[UI:NOTIFY Mail]',
      'Lala: Ooh, mail!',
      '## BEAT: 5 · Reveal',
      'Lala: Completely rewritten reveal.',
    );
    const { stored } = lk.reconcileLineKeys(base, regenerated, { rand: F.seeded(40) });
    expect(keysOf(stored).slice(1, 3)).toEqual([k[2], k[3]]);
  });

  test('12. the integrity check reports, and never repairs', () => {
    const stored = first(F.BASE);
    const frozen = JSON.stringify(stored);
    expect(lk.checkLineKeys(F.BASE, stored)).toEqual({ status: 'ok' });
    expect(lk.checkLineKeys(F.BASE, null)).toEqual({ status: 'unkeyed' });
    expect(lk.checkLineKeys(F.BASE, {})).toEqual({ status: 'unkeyed' });
    expect(lk.checkLineKeys(`${F.BASE}\nLala: added elsewhere.`, stored)).toEqual({ status: 'mismatch', reason: 'text_hash' });
    expect(lk.checkLineKeys(F.BASE, { ...stored, v: 2 })).toEqual({ status: 'mismatch', reason: 'version' });
    expect(lk.checkLineKeys(F.BASE, { ...stored, lines: stored.lines.slice(1) }).status).toBe('mismatch');
    const badKey = { ...stored, lines: stored.lines.map((e, i) => (i === 2 ? { ...e, k: 'nope' } : e)) };
    expect(lk.checkLineKeys(F.BASE, badKey)).toEqual({ status: 'mismatch', reason: 'line', index: 2 });
    expect(JSON.stringify(stored)).toBe(frozen);
  });

  test('13. the same inputs and the same random source give byte-identical results', () => {
    const run = () => JSON.stringify(lk.reconcileLineKeys(first(EP1.SCRIPT, 7), `${EP1.SCRIPT}\nLala: One more line.`, { prevText: EP1.SCRIPT, rand: F.seeded(8) }));
    expect(run()).toBe(run());
    const a = first(EP1.SCRIPT, 7);
    expect(keysOf(a).every((key) => lk.KEY_RE.test(key))).toBe(true);
    expect(new Set(keysOf(a)).size).toBe(a.lines.length);
  });

  test('14. a stored line is found by its words after insertions above it; gone or ambiguous is null', () => {
    const base = first(F.BASE);
    const k = keysOf(base);
    const inserted = F.BASE.replace('## BEAT: 4 · Interruption Pulse 1\n', '## BEAT: 4 · Interruption Pulse 1\nPrime: Wait, listen.\nPrime: Something is coming.\n');
    const now = lk.reconcileLineKeys(base, inserted, { prevText: F.BASE, rand: F.seeded(50) }).stored;
    expect(lk.keyForStoredLine({ b: 4, line_text: 'Lala:  Ooh, mail! ' }, inserted, now)).toBe(k[3]);
    expect(lk.keyForStoredLine({ b: 4, line_text: 'Lala: Something else.' }, inserted, now)).toBeNull();
    const dup = first(F.DUPLICATES);
    expect(lk.keyForStoredLine({ line_text: 'Lala: Okay.' }, F.DUPLICATES, dup)).toBeNull();
    expect(lk.keyForStoredLine({ b: 3, line_text: 'Lala: Okay.' }, F.DUPLICATES, dup)).toBeNull();
    // Keys that don't describe the script give no answer.
    expect(lk.keyForStoredLine({ b: 4, line_text: 'Lala: Ooh, mail!' }, inserted, base)).toBeNull();
  });

  test('duplicated lines in a beat each keep their own key', () => {
    const base = first(F.DUPLICATES);
    const k = keysOf(base);
    expect(new Set(k).size).toBe(3);
    const { stored, report } = lk.reconcileLineKeys(base, F.DUPLICATES.replace('Lala: Okay.\nPrime', 'Prime'), { prevText: F.DUPLICATES, rand: F.seeded(60) });
    expect(keysOf(stored)).toEqual([k[1], k[2]]);
    expect(report.retired).toEqual([k[0]]);
  });

  test('15. nothing imports the line identity modules yet', () => {
    const root = path.resolve(__dirname, '../../..');
    const allowed = new Set([
      'src/utils/lineKeys.js',
      'frontend/src/lib/lineKeys.js',
      'frontend/src/lib/lineKeys.test.js',
    ]);
    const found = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (/\.(js|jsx|cjs|mjs|ts|tsx)$/.test(entry.name) && !allowed.has(rel)) {
          if (/(?:require\(|from\s+|import\()\s*['"][^'"]*\/lineKeys(?:\.js)?['"]/.test(fs.readFileSync(path.join(root, rel), 'utf8'))) found.push(rel);
        }
      }
    };
    walk('src');
    walk('frontend/src');
    expect(found).toEqual([]);
  });
});
