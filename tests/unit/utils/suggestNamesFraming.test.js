// Task #2120 — the suggest-names framing sentence (§8(u) R9): the organizer's
// niche and the event's format, category and description, each omitted
// cleanly when missing; never the "content-creator show" framing.
const { buildSuggestNamesFraming, descriptionLead, DESCRIPTION_MAX } = require('../../../src/utils/suggestNamesFraming');

describe('buildSuggestNamesFraming', () => {
  test('full input: niche, format, category and the description\'s first sentence', () => {
    const event = {
      format: 'workout_class',
      category: 'fitness',
      description: 'A sunset sculpt session on the rooftop, then a recovery social. Guests bring their own mats.',
    };
    expect(buildSuggestNamesFraming(event, { content_category: 'fitness' })).toBe(
      'Name this fictional workout class in the fitness world, hosted by a fitness creator. '
      + 'About it: A sunset sculpt session on the rooftop, then a recovery social.'
    );
  });

  test('niche only', () => {
    expect(buildSuggestNamesFraming({}, { content_category: 'luxury' }))
      .toBe('Name this fictional event, hosted by a luxury creator.');
  });

  test('format only', () => {
    expect(buildSuggestNamesFraming({ format: 'run_club' }, null))
      .toBe('Name this fictional run club.');
  });

  test('empty input', () => {
    expect(buildSuggestNamesFraming({}, null)).toBe('Name this fictional event.');
    expect(buildSuggestNamesFraming(null, undefined)).toBe('Name this fictional event.');
    expect(buildSuggestNamesFraming({ format: '  ', category: '', description: '   ' }, { content_category: ' ' }))
      .toBe('Name this fictional event.');
  });

  test('never uses the content-creator-show framing, whatever the input', () => {
    const inputs = [
      [{}, null],
      [{ format: 'gala' }, null],
      [{}, { content_category: 'fashion' }],
      [{ format: 'brunch', category: 'brunch_dining', description: 'Pancakes.' }, { content_category: 'lifestyle' }],
    ];
    for (const [event, organizer] of inputs) {
      expect(buildSuggestNamesFraming(event, organizer)).not.toMatch(/content-creator show/);
    }
  });
});

describe('descriptionLead', () => {
  test('first sentence only; a description with no end punctuation is used whole', () => {
    expect(descriptionLead('One. Two.')).toBe('One.');
    expect(descriptionLead('No full stop here')).toBe('No full stop here');
  });

  test(`caps at ${DESCRIPTION_MAX} characters, cut at a word boundary`, () => {
    const long = `${'word '.repeat(60).trim()}.`;
    const lead = descriptionLead(long);
    expect(lead.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(lead.endsWith('word')).toBe(true);
    expect(buildSuggestNamesFraming({ description: long }, null)).toBe(`Name this fictional event. About it: ${lead}.`);
  });

  test('empty or non-string gives nothing', () => {
    expect(descriptionLead('')).toBe('');
    expect(descriptionLead(null)).toBe('');
    expect(descriptionLead(42)).toBe('');
  });
});
