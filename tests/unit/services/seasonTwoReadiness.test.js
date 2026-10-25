// ============================================================================
// Season 2 readiness (season-AI audit, 2026-10-25), without a database:
// each part's moods are editable (emotional arc, feed tone), checked, and
// default only when empty; the story record's draft prompt names the slot
// the episode filled.
// ============================================================================

const {
  normaliseSetup, buildPhases, partMoods, PART_DEFAULTS, MOOD_MAX, SeasonSetupError,
} = require('../../../src/services/seasonSetupService');
const { draftPrompt } = require('../../../src/services/episodeStoryRecord');

const FORM = (phases) => ({
  title: 'Velvet Ladder',
  phases: phases || [{ title: 'Arrival' }, { title: 'The Climb' }, { title: 'Crown' }],
  split: [6, 10, 8],
});

describe('part moods', () => {
  test("a part's emotional arc and feed tone are its own when the form gives them", () => {
    const setup = normaliseSetup(FORM([
      { title: 'Arrival', emotional_arc: '  wonder →   doubt ', feed_tone: 'The city is loud and new.' },
      { title: 'The Climb' },
      { title: 'Crown', emotional_arc: '', feed_tone: '' },
    ]));
    const phases = buildPhases(setup);
    expect(phases[0].emotional_arc).toBe('wonder → doubt');
    expect(phases[0].feed_behavior.feed_tone).toBe('The city is loud and new.');
    // The rest of the feed behaviour still follows the position.
    expect(phases[0].feed_behavior.event_prestige_max).toBe(PART_DEFAULTS[0].feed_behavior.event_prestige_max);
    // Left out or empty: the position's default.
    expect(phases[1].emotional_arc).toBe(PART_DEFAULTS[1].emotional_arc);
    expect(phases[2].emotional_arc).toBe(PART_DEFAULTS[2].emotional_arc);
    expect(phases[2].feed_behavior.feed_tone).toBe(PART_DEFAULTS[2].feed_behavior.feed_tone);
  });

  test('a mood that is too long, or not text, is refused with what is wrong', () => {
    const long = 'x'.repeat(MOOD_MAX.emotional_arc + 1);
    expect(() => normaliseSetup(FORM([{ title: 'A', emotional_arc: long }, { title: 'B' }, { title: 'C' }])))
      .toThrow(new SeasonSetupError(`Part 1's emotional arc is ${MOOD_MAX.emotional_arc + 1} characters; keep it to ${MOOD_MAX.emotional_arc}.`));
    expect(() => normaliseSetup(FORM([{ title: 'A' }, { title: 'B', feed_tone: 'y'.repeat(MOOD_MAX.feed_tone + 1) }, { title: 'C' }])))
      .toThrow(/Part 2's feed tone is \d+ characters; keep it to 500\./);
    expect(() => normaliseSetup(FORM([{ title: 'A' }, { title: 'B' }, { title: 'C', emotional_arc: 7 }])))
      .toThrow("Part 3's emotional arc must be text.");
    expect(() => normaliseSetup(FORM([{ title: 'A', emotional_arc: 'x'.repeat(MOOD_MAX.emotional_arc) }, { title: 'B' }, { title: 'C' }]))).not.toThrow();
  });

  test("Edit season: a mood the form leaves out keeps the saved one; empty takes the default", () => {
    const saved = { emotional_arc: 'her own arc', feed_behavior: { follow_bias: 'study', feed_tone: 'her own tone', event_prestige_max: 9 } };
    expect(partMoods({ title: 'A' }, 0, saved)).toEqual({ emotional_arc: 'her own arc', feed_behavior: saved.feed_behavior });
    expect(partMoods({ title: 'A', emotional_arc: null, feed_tone: null }, 0, saved)).toEqual({
      emotional_arc: PART_DEFAULTS[0].emotional_arc,
      feed_behavior: { ...saved.feed_behavior, feed_tone: PART_DEFAULTS[0].feed_behavior.feed_tone },
    });
    expect(partMoods({ title: 'A', emotional_arc: 'new', feed_tone: 'new tone' }, 2, saved)).toEqual({
      emotional_arc: 'new', feed_behavior: { ...saved.feed_behavior, feed_tone: 'new tone' },
    });
  });
});

describe("the story record's draft prompt names the slot", () => {
  const base = { event: null, cast: [], threads: [] };
  const SC = {
    label: 'S2 · E1', slot_number: 1, phase: { number: 1, title: 'Arrival' },
    story_purposes: [{ text: 'Lala arrives and is not invited', primary: true }, { text: 'Plant the rival', primary: false }],
    desired_pressure: 'Medium', outcome_range: { min: 'safe', max: 'pass' }, career_focus: 'reputation',
  };

  test("the slot's purposes, pressure and hoped-for outcome, and the ask to say how it met them", () => {
    const prompt = draftPrompt({ ...base, episode: { episode_number: 25, title: 'Arrival', script_content: 'x', season_context: SC } });
    expect(prompt).toContain('THE SEASON SLOT THIS EPISODE FILLS (S2 · E1, Part 1: Arrival):');
    expect(prompt).toContain('1. [Primary] Lala arrives and is not invited');
    expect(prompt).toContain('2. Plant the rival');
    expect(prompt).toContain('Desired pressure: Medium');
    expect(prompt).toContain('Hoped-for outcome: safe to pass');
    expect(prompt).toContain('end with a sentence on how the episode met its slot');
  });

  test('read from JSON text too; capped; nothing for an episode in no slot', () => {
    const long = { ...SC, story_purposes: [{ text: 'p'.repeat(1000), primary: true }] };
    const prompt = draftPrompt({ ...base, episode: { title: 'A', script_content: 'x', season_context: JSON.stringify(long) } });
    expect(prompt).toContain('THE SEASON SLOT THIS EPISODE FILLS');
    expect(prompt).not.toContain('p'.repeat(201));
    const none = draftPrompt({ ...base, episode: { title: 'A', script_content: 'x', season_context: null } });
    expect(none).not.toContain('SEASON SLOT');
    expect(draftPrompt({ ...base, episode: { title: 'A', script_content: 'x' } })).toBe(none);
  });
});
