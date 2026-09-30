/**
 * Episode title approval + title card, pure parts (Task #2386, ruling P11).
 */
const {
  titleCardState, buildTitleCardPrompt, estimateTitleCard, TITLE_CARD_OPTIONS,
} = require('../../../src/services/episodeTitleCardService');
const { deriveEventVisualDirection } = require('../../../src/services/eventVisualDirection');
const { estimateGenerationCost } = require('../../../src/services/imageGenerationService');
const { buildBackgroundPrompt } = require('../../../src/services/invitationGeneratorService');

const APPROVED_AT = new Date('2026-09-30T12:00:00Z');

describe('titleCardState', () => {
  it('an unapproved title with no card offers nothing yet (approve first)', () => {
    const s = titleCardState({ title: 'Gala Night' });
    expect(s.approved).toBe(false);
    expect(s.card).toBeNull();
    expect(s.offer).toEqual({ offered: false });
  });

  it('an approved title with no card offers "design" with the estimate', () => {
    const s = titleCardState({ title: 'Gala Night', title_approved_at: APPROVED_AT, title_approved_value: 'Gala Night' });
    expect(s.approved).toBe(true);
    expect(s.offer).toMatchObject({ offered: true, kind: 'design', requires_approval: false });
    expect(s.offer.estimate).toEqual(estimateTitleCard());
  });

  it('an approval of a different title does not hold', () => {
    const s = titleCardState({ title: 'New Name', title_approved_at: APPROVED_AT, title_approved_value: 'Gala Night' });
    expect(s.approved).toBe(false);
    expect(s.approved_at).toBeNull();
    expect(s.approved_value).toBe('Gala Night');
  });

  it('a current card offers nothing and is not outdated', () => {
    const s = titleCardState(
      { title: 'Gala Night', title_approved_at: APPROVED_AT, title_approved_value: 'Gala Night', title_card_asset_id: 'a1', title_card_title: 'Gala Night' },
      { s3_url_processed: 'https://x/card.png' },
    );
    expect(s.card).toEqual({ asset_id: 'a1', designed_for: 'Gala Night', outdated: false, image_url: 'https://x/card.png' });
    expect(s.offer).toEqual({ offered: false });
  });

  it('changing the title marks the card outdated and offers a redesign that approves the new title', () => {
    const s = titleCardState({
      title: 'Gala Night II', title_approved_at: null, title_approved_value: 'Gala Night',
      title_card_asset_id: 'a1', title_card_title: 'Gala Night',
    });
    expect(s.card.outdated).toBe(true);
    expect(s.offer).toMatchObject({ offered: true, kind: 'redesign', requires_approval: true });
  });

  it('an outdated card whose new title is approved offers a plain redesign', () => {
    const s = titleCardState({
      title: 'Gala Night II', title_approved_at: APPROVED_AT, title_approved_value: 'Gala Night II',
      title_card_asset_id: 'a1', title_card_title: 'Gala Night',
    });
    expect(s.offer).toMatchObject({ offered: true, kind: 'redesign', requires_approval: false });
  });
});

describe('estimateTitleCard', () => {
  it('is priced from the exact options the card is generated with', () => {
    const e = estimateTitleCard();
    const direct = estimateGenerationCost(TITLE_CARD_OPTIONS);
    expect(e).toEqual({ usd: direct.usd, priced: direct.priced, unit: direct.unit, units: direct.units, model: direct.model });
    // landscape hd = fal-ai/flux-pro/v1.1 at 1024x576 → 1 megapixel at $0.04
    expect(e).toMatchObject({ usd: 0.04, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' });
  });
});

describe('buildTitleCardPrompt', () => {
  const event = {
    dress_code: 'black tie', mood: 'elegant', prestige: 9,
    color_palette: ['champagne', 'midnight blue'],
  };

  it('carries the show style first and the event visual direction the invitation uses', () => {
    const direction = deriveEventVisualDirection(event);
    const prompt = buildTitleCardPrompt({
      stylePrefix: 'SHOW STYLE: pastel watercolour. ', title: 'Gala "Night"', episodeNumber: 4, direction,
    });
    expect(prompt.startsWith('SHOW STYLE: pastel watercolour. ')).toBe(true);
    expect(prompt).toContain(`(${direction.theme} theme)`);
    expect(prompt).toContain(`Background: ${direction.background}.`);
    expect(prompt).toContain(`Border/Frame: ${direction.border}.`);
    expect(prompt).toContain('Color palette emphasis: champagne, midnight blue.');
    expect(prompt).toContain('Richness: Maximum luxury');
    expect(prompt).toContain('Center text reading "Gala \'Night\'"');
    expect(prompt).toContain('"Episode 4"');
    // The invitation background is built from the same direction.
    const invite = buildBackgroundPrompt(event);
    expect(invite).toContain(`Background: ${direction.background}`);
    expect(invite).toContain(`Border/Frame: ${direction.border}`);
    expect(invite).toContain('Color palette emphasis: champagne, midnight blue.');
  });

  it('with no source event keeps the house look', () => {
    const prompt = buildTitleCardPrompt({ stylePrefix: 'S. ', title: 'Solo', episodeNumber: null, direction: null });
    expect(prompt).toContain('Elegant dark background (#1A1A1A)');
    expect(prompt).not.toContain('Episode null');
    expect(prompt).not.toContain('Visual direction');
  });
});

describe('deriveEventVisualDirection', () => {
  it('uses the event theme preset, else the default', () => {
    expect(deriveEventVisualDirection({ theme: 'Soft Glam' }).theme).toBe('soft glam');
    const d = deriveEventVisualDirection({ theme: 'unknown thing', prestige: 3 });
    expect(d.theme).toBe('default');
    expect(d.richness).toMatch(/^Understated/);
    expect(d.palette).toEqual([]);
  });
});
