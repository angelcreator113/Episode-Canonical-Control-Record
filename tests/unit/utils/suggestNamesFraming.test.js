// Task #2120 — the suggest-names framing sentence (§8(u) R9): the organizer's
// niche and the event's format and description, each omitted
// cleanly when missing; never the "content-creator show" framing.
const { buildSuggestNamesFraming, descriptionLead, DESCRIPTION_MAX } = require('../../../src/utils/suggestNamesFraming');

describe('buildSuggestNamesFraming', () => {
  test('full input: niche, format and the description\'s first sentence; category is not in the sentence', () => {
    const event = {
      format: 'workout_class',
      category: 'fitness',
      description: 'A sunset sculpt session on the rooftop, then a recovery social. Guests bring their own mats.',
    };
    expect(buildSuggestNamesFraming(event, { content_category: 'fitness' })).toBe(
      'Name this fictional workout class, hosted by a fitness creator. '
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

  const CONCEPT = 'A sunset sculpt workout that ends in a recovery social.';
  const withConcept = (extra, concept = CONCEPT) => ({ ...extra, canon_consequences: { automation: { concept } } });

  test('Task #2135: concept only: the concept is the About line', () => {
    expect(buildSuggestNamesFraming(withConcept({ format: 'workout_class' }), { content_category: 'fitness' })).toBe(
      'Name this fictional workout class, hosted by a fitness creator. '
      + `About it: ${CONCEPT}`
    );
  });

  test('Task #2135: concept plus description: the concept replaces the description', () => {
    const event = withConcept({ description: 'A golden-hour session on the rooftop. Bring a mat.' });
    const sentence = buildSuggestNamesFraming(event, null);
    expect(sentence).toBe(`Name this fictional event. About it: ${CONCEPT}`);
    expect(sentence).not.toMatch(/golden-hour/);
  });

  test('Task #2135: no concept (missing, blank, or unreadable): the description, as before', () => {
    const description = 'A golden-hour session on the rooftop. Bring a mat.';
    const expected = 'Name this fictional event. About it: A golden-hour session on the rooftop.';
    expect(buildSuggestNamesFraming({ description }, null)).toBe(expected);
    expect(buildSuggestNamesFraming(withConcept({ description }, '   '), null)).toBe(expected);
    expect(buildSuggestNamesFraming({ description, canon_consequences: { automation: {} } }, null)).toBe(expected);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildSuggestNamesFraming({ description, canon_consequences: '{not json' }, null)).toBe(expected);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('Task #2135: the concept is capped like the description; a JSON-string column is read too', () => {
    const long = `${'word '.repeat(60).trim()}.`;
    expect(buildSuggestNamesFraming(withConcept({}, long), null))
      .toBe(`Name this fictional event. About it: ${descriptionLead(long)}.`);
    const asString = { canon_consequences: JSON.stringify({ automation: { concept: CONCEPT } }) };
    expect(buildSuggestNamesFraming(asString, null)).toBe(`Name this fictional event. About it: ${CONCEPT}`);
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
