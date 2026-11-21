// ============================================================================
// The follow profile's prompt and what they do for work (Career & World
// Alignment W1; Evoni, 2026-11-21). "Occupation" was their past career, or
// their description when they had none. It is now their decided occupation
// fact; the past career is given as what they did before. No database, no AI.
// ============================================================================

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));

const { buildFollowProfilePrompt } = require('../../../src/services/characterFollowService');

const base = {
  display_name: 'Maren', description: 'A quiet woman with a loud wardrobe.',
  career_history: 'Ten years as a paralegal before the shop.',
};
const occupationLine = (prompt) => prompt.split('\n').find((l) => l.startsWith('**Occupation:**'));

describe('the follow profile prompt', () => {
  it('Occupation is their decided occupation fact; the past career is said as past', () => {
    const prompt = buildFollowProfilePrompt({ ...base, canon_facts: { occupation: 'Vintage shop owner' } });
    expect(occupationLine(prompt)).toBe('**Occupation:** Vintage shop owner');
    expect(prompt).toContain('**Before (their past career, not what they do now):** Ten years as a paralegal before the shop.');
  });

  it('with no decided occupation it is unknown: never the past career or the description', () => {
    for (const canon of [undefined, null, {}, { occupation: '' }, { occupation: 'Vintage shop owner', undecided: ['occupation'] }]) {
      const prompt = buildFollowProfilePrompt({ ...base, canon_facts: canon });
      expect(occupationLine(prompt)).toBe('**Occupation:** unknown');
      expect(prompt).not.toContain('Vintage shop owner');
      expect(prompt).not.toContain('A quiet woman with a loud wardrobe.');
      expect(prompt).toContain('**Before (their past career, not what they do now):** Ten years as a paralegal before the shop.');
    }
  });

  it('with no past career there is no Before line', () => {
    const prompt = buildFollowProfilePrompt({ display_name: 'Maren', canon_facts: { occupation: 'Vintage shop owner' } });
    expect(prompt).not.toContain('**Before');
    expect(prompt).toContain('**Occupation:** Vintage shop owner\n\n**Core Desire:**');
  });
});
