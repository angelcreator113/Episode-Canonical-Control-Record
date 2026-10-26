/**
 * Line identity, the reading half (architecture A1a; Evoni, 2026-10-26).
 * Acceptance test 1 of docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md
 * R3.7: this copy and src/utils/lineKeys.js give the same lines, hashes and
 * integrity status on every fixture. The rest of the acceptance tests are in
 * tests/unit/utils/lineKeys.test.js.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { scriptLines, normaliseLine, lineHash, scriptTextHash, checkLineKeys, VERSION, KEY_RE } from './lineKeys';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/lineKeys.js');
const F = require('../../../tests/fixtures/lineKeysScripts.js');
const EP1 = require('../../../tests/fixtures/myLittleListEpisode1.js');

const SCRIPTS = [
  ['Episode 1', EP1.SCRIPT],
  ['tags and cues', F.TAGGED],
  ['duplicates', F.DUPLICATES],
  ['base', F.BASE],
  ...F.HEADER_FORMS.map((f) => [f.name, f.script]),
  ['empty', ''],
  ['blank lines only', '\n \n\t\n'],
];

describe('A1a: the frontend copy reads lines as the server does', () => {
  test('1. lines, normal forms and hashes are identical on every fixture', () => {
    for (const [, script] of SCRIPTS) {
      expect(scriptLines(script)).toEqual(server.scriptLines(script));
      expect(scriptTextHash(script)).toBe(server.scriptTextHash(script));
    }
    for (const line of [...F.SAME_LINE, F.OTHER_LINE, ...F.TAGGED_LINES, '', '😀 emoji and ünïcode']) {
      expect(normaliseLine(line)).toBe(server.normaliseLine(line));
      expect(lineHash(line)).toBe(server.lineHash(line));
    }
    expect(VERSION).toBe(server.VERSION);
    expect(String(KEY_RE)).toBe(String(server.KEY_RE));
  });

  test('1. the integrity check agrees on ok, unkeyed and every kind of mismatch', () => {
    const stored = server.reconcileLineKeys(null, EP1.SCRIPT, { rand: F.seeded(3) }).stored;
    const cases = [
      [EP1.SCRIPT, stored],
      [EP1.SCRIPT, null],
      [`${EP1.SCRIPT}\nLala: more`, stored],
      [EP1.SCRIPT, { ...stored, v: 2 }],
      [EP1.SCRIPT, { ...stored, lines: stored.lines.slice(2) }],
      [EP1.SCRIPT, { ...stored, lines: stored.lines.map((e, i) => (i === 4 ? { ...e, h: '00000000' } : e)) }],
    ];
    for (const [text, keys] of cases) expect(checkLineKeys(text, keys)).toEqual(server.checkLineKeys(text, keys));
    expect(checkLineKeys(EP1.SCRIPT, stored)).toEqual({ status: 'ok' });
  });

  test('the frontend copy never mints or reconciles', async () => {
    const mod = await import('./lineKeys');
    expect(Object.keys(mod).sort()).toEqual(['KEY_RE', 'VERSION', 'checkLineKeys', 'lineHash', 'normaliseLine', 'scriptLines', 'scriptTextHash']);
  });
});
