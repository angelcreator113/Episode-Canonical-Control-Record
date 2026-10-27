'use strict';

/**
 * The counts-only identity-plan log (A1c R1; spec §2.1, §4.2; condition 2):
 * one line of counts and ids, never text, dialogue, hashes, keys or names,
 * and a failure never throws into the write.
 */

const { logIdentityPlan, identityPlanLine, PREFIX } = require('../../../src/services/identityPlanLog');

const BEFORE = '## BEAT: 1 · Opening Ritual\nLala: "Velour Society is calling."\nPrime: "Answer it, bestie."\n';
const AFTER = '## BEAT: 1 · Opening Ritual\nLala: "Velour Society is calling."\nPrime: "Answer it now, bestie."\nLala: "Marcus? Is that you?"\n';

describe('identity-plan log', () => {
  test('logs one line of counts and ids only', () => {
    const lines = [];
    const out = logIdentityPlan({ episodeId: 'ep-1', writer: 'W1', source: 'save', state: 'unkeyed', prevText: BEFORE, nextText: AFTER }, (l) => lines.push(l));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith(`${PREFIX} {`)).toBe(true);
    const json = JSON.parse(lines[0].slice(PREFIX.length + 1));
    expect(json).toEqual(out);
    expect(Object.keys(json).sort()).toEqual(['episode', 'kept_exact', 'kept_group', 'lines_after', 'lines_before', 'moved', 'ms', 'new', 'removed', 'source', 'state', 'uncertain_group', 'uncertain_similar', 'v', 'writer'].sort());
    for (const [k, v] of Object.entries(json)) {
      if (!['episode', 'writer', 'source', 'state'].includes(k)) expect(typeof v).toBe('number');
    }
  });

  test('holds no text, dialogue, name, hash or key', () => {
    const lines = [];
    logIdentityPlan({ episodeId: 'ep-1', writer: 'W1', source: 'save', prevText: BEFORE, nextText: AFTER }, (l) => lines.push(l));
    const line = lines[0];
    for (const word of ['Velour', 'Marcus', 'bestie', 'Lala', 'Prime', 'Opening', 'BEAT', 'ln_', '"h"', 'hash']) {
      expect(line).not.toContain(word);
    }
    expect(line).not.toMatch(/[0-9a-f]{8,}/);
  });

  test('an unchanged script logs nothing', () => {
    const log = jest.fn();
    expect(logIdentityPlan({ episodeId: 'ep-1', writer: 'W1', prevText: BEFORE, nextText: BEFORE }, log)).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  test('a failure never throws, and its message holds no script', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const boom = () => { throw new Error(`could not plan "${BEFORE}"`); };
    expect(() => logIdentityPlan({ episodeId: 'ep-1', writer: 'W1', prevText: BEFORE, nextText: AFTER }, boom)).not.toThrow();
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).not.toContain('Velour');
    err.mockRestore();
  });

  test('identityPlanLine counts as planLineIdentity does', () => {
    const line = identityPlanLine({ episodeId: 7, writer: 'W3', source: 'generate', prevText: '', nextText: 'A.\nB.' });
    expect(line).toMatchObject({ episode: '7', writer: 'W3', source: 'generate', state: 'unkeyed', lines_before: 0, lines_after: 2, new: 2, removed: 0 });
  });
});
