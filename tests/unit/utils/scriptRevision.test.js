'use strict';

/**
 * The script revision token (A1c R1; docs/reads/2026-10-27-a1c-r1-spec.md
 * §4.2): stable, sensitive to the text and the identity record, blind to
 * everything else, and never carrying a line key.
 */

const { scriptRevision, isRevision } = require('../../../src/utils/scriptRevision');

describe('scriptRevision', () => {
  const TEXT = '## BEAT: 1 · Opening Ritual\nLala: "Hi besties."\n';

  test('is stable, and has the token form', () => {
    expect(scriptRevision(TEXT)).toBe(scriptRevision(TEXT));
    expect(isRevision(scriptRevision(TEXT))).toBe(true);
    expect(scriptRevision(TEXT)).toMatch(/^sr1-[0-9a-f]{40}$/);
  });

  test('changes with any change to the text, a space included', () => {
    expect(scriptRevision(`${TEXT} `)).not.toBe(scriptRevision(TEXT));
    expect(scriptRevision(TEXT.replace('Hi', 'Hey'))).not.toBe(scriptRevision(TEXT));
  });

  test('null and an empty script are the same empty script, with a revision of their own', () => {
    expect(scriptRevision(null)).toBe(scriptRevision(''));
    expect(scriptRevision(undefined)).toBe(scriptRevision(''));
    expect(isRevision(scriptRevision(''))).toBe(true);
    expect(scriptRevision('')).not.toBe(scriptRevision(' '));
  });

  test('reads only the text and the identity record: an episode\'s title is not in it', () => {
    // The function takes nothing else; two episodes with one script share a revision.
    expect(scriptRevision.length).toBeLessThanOrEqual(2);
    expect(scriptRevision(TEXT, null)).toBe(scriptRevision(TEXT));
  });

  test('changes with the identity record, and not with the order its fields were written in', () => {
    const keys = { v: 1, text_hash: 'abc', lines: [{ k: 'ln_aaaaaaaaaa', h: 'x' }], retired: [] };
    const reordered = { retired: [], lines: [{ h: 'x', k: 'ln_aaaaaaaaaa' }], text_hash: 'abc', v: 1 };
    expect(scriptRevision(TEXT, keys)).not.toBe(scriptRevision(TEXT, null));
    expect(scriptRevision(TEXT, keys)).toBe(scriptRevision(TEXT, reordered));
    expect(scriptRevision(TEXT, { ...keys, lines: [{ k: 'ln_bbbbbbbbbb', h: 'x' }] })).not.toBe(scriptRevision(TEXT, keys));
  });

  test('never contains a line key', () => {
    const keys = { v: 1, lines: [{ k: 'ln_aaaaaaaaaa', h: 'x' }] };
    expect(scriptRevision(TEXT, keys)).not.toContain('ln_');
  });

  test('isRevision refuses anything else', () => {
    for (const v of [null, undefined, '', 'sr1-', 'sr1-xyz', `sr2-${'a'.repeat(40)}`, `sr1-${'A'.repeat(40)}`, 42, {}]) {
      expect(isRevision(v)).toBe(false);
    }
  });
});
