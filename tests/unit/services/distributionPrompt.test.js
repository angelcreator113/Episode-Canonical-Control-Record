/**
 * Distribution drafts platform copy from the viewer teaser (P12, Task
 * #2386); the synopsis (P13) and any evaluation are internal background it
 * must not reveal.
 */
const { buildDistributionPrompt, buildContextBlock } = require('../../../src/services/distributionService');

const baseCtx = (episode = {}) => ({
  episode: {
    title: 'The Maison Rue Night', episode_number: 4, categories: ['fashion'],
    description: 'Lala arrives late, the coat splits, she wins the room anyway.',
    ...episode,
  },
  show: { title: 'Styling Adventures with Lala' },
  event: { name: 'Maison Rue Launch', event_type: 'brand_deal', prestige: 7, host: 'Rue', venue_name: 'The Atelier' },
  evaluation: { tier_final: 'slay', score: 91, narrative_lines: { short: 'She owned it.' } },
  outfitPieces: [],
  socialTasks: [],
});

describe('buildDistributionPrompt', () => {
  test('with a teaser: drafts from it; synopsis and evaluation are internal, do-not-reveal', () => {
    const prompt = buildDistributionPrompt(baseCtx({ teaser: 'One invitation. One coat. One person who should not be there.' }), ['youtube', 'tiktok']);

    expect(prompt).toContain('VIEWER TEASER (the viewer-facing copy; draft every platform\'s copy from this): One invitation. One coat. One person who should not be there.');
    expect(prompt).toContain("SOURCE: Draft every platform's copy from the VIEWER TEASER above.");
    expect(prompt).toContain('INTERNAL BACKGROUND (production only, DO NOT REVEAL');
    expect(prompt).toContain('Synopsis (what happens): Lala arrives late');
    expect(prompt).toContain('NEVER REVEAL THE OUTCOME');
    expect(prompt).not.toContain('tier result');
    // The synopsis and evaluation sit only under the internal heading.
    const internalAt = prompt.indexOf('INTERNAL BACKGROUND');
    expect(prompt.indexOf('Synopsis (what happens)')).toBeGreaterThan(internalAt);
    expect(prompt.indexOf('Evaluation: SLAY')).toBeGreaterThan(internalAt);
    expect(prompt).not.toMatch(/^Synopsis: /m);
  });

  test('without a teaser: falls back to the episode data, says so, and still forbids revealing the outcome', () => {
    const prompt = buildDistributionPrompt(baseCtx({ teaser: '   ' }), ['instagram']);

    expect(prompt).toContain('VIEWER TEASER: none written for this episode yet.');
    expect(prompt).toContain('SOURCE: This episode has no viewer teaser yet, so draft from the episode data above.');
    expect(prompt).toContain('NEVER REVEAL THE OUTCOME');
    expect(prompt).toContain('Synopsis (what happens): Lala arrives late');
  });

  test('platform rules and show hashtags are still included', () => {
    const prompt = buildDistributionPrompt(baseCtx({ teaser: 'x' }), ['tiktok'], { tiktok: { default_hashtags: ['lalaverse'] } });
    expect(prompt).toContain('"tiktok": {');
    expect(prompt).toContain('Show-level hashtags (ALWAYS include): lalaverse');
  });
});

describe('buildContextBlock', () => {
  test('no synopsis and no evaluation: no internal section', () => {
    const block = buildContextBlock({ ...baseCtx({ description: null, teaser: 'x' }), evaluation: null });
    expect(block).not.toContain('INTERNAL BACKGROUND');
  });
});
