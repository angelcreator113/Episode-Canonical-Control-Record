/**
 * One truth for relationships (services/relationshipTruth): what a story
 * pair is, its kind on The Pulse, Lala's tie from it, and relationships_map
 * from the story pairs.
 */
const truth = require('../../../src/services/relationshipTruth');

describe('relationshipTruth: reading a story pair', () => {
  test.each([
    [{ relationship_type: 'sister' }, 'family'],
    [{ relationship_type: 'Best Friend' }, 'friend'],
    [{ relationship_type: 'rival' }, 'rival'],
    [{ relationship_type: 'love interest' }, 'romance'],
    [{ relationship_type: 'girlfriend' }, 'romance'],
    [{ relationship_type: 'business partner' }, 'collab'],
    [{ relationship_type: 'Manager' }, 'manager'],
    [{ relationship_type: 'former friends' }, 'enemy'],
    [{ relationship_type: 'ex-husband' }, 'ex'],
    [{ relationship_type: 'husband', status: 'Past' }, 'ex'],
    [{ relationship_type: 'anything', is_romantic: true }, 'romance'],
    [{ relationship_type: 'anything', family_role: 'aunt' }, 'family'],
    [{ relationship_type: 'friend', stage: 'lovers' }, 'romance'],
    [{ relationship_type: 'friend', stage: 'enemies' }, 'enemy'],
    [{ relationship_type: 'constant presence' }, null],
    [{ relationship_type: 'mystery', role_tag: 'detractor' }, 'rival'],
  ])('%j is %s', (row, category) => {
    expect(truth.storyCategory(row)).toBe(category);
  });

  test('its Pulse kind, and the kinds that agree with it: a story rival is never a Pulse bestie', () => {
    expect(truth.pulseKindFor({ relationship_type: 'rival' })).toMatchObject({ kind: 'rival' });
    expect(truth.pulseKindFor({ relationship_type: 'rival' }).fits).not.toContain('bestie');
    expect(truth.pulseKindFor({ relationship_type: 'love interest' }).fits).toEqual(expect.arrayContaining(['couple', 'secret_link']));
    expect(truth.pulseKindFor({ relationship_type: 'mystery' })).toBeNull();
  });

  test("Lala's tie for the script: a romance or family is said in words, not as a LALA_TIES key", () => {
    expect(truth.lalaTieFields({ lala_relationship: 'competitive' }, null)).toEqual({ lala_relationship: 'competitive', lala_story_tie: null });
    expect(truth.lalaTieFields({ lala_relationship: 'competitive' }, { scriptTie: null, words: 'sister', note: null }))
      .toEqual({ lala_relationship: null, lala_story_tie: 'sister' });
    expect(truth.lalaTieFields({ lala_relationship: 'aware' }, { scriptTie: 'competitive', words: 'rival', note: 'the gala' }))
      .toEqual({ lala_relationship: 'competitive', lala_story_tie: 'rival (the gala)' });
  });

  test('relationships_map from the story: story people where the story puts them, unknown names and prose kept', () => {
    const story = { lists: { allies: [], rivals: ['Marcus'], mentors: [], love_interests: ['Jo'], business_partners: [], family: [] }, people: ['marcus', 'jo'] };
    expect(truth.withStoryMap({ allies: ['Marcus', 'Someone'], dynamic_notes: 'x' }, story))
      .toEqual({ allies: ['Someone'], rivals: ['Marcus'], love_interests: ['Jo'], dynamic_notes: 'x' });
    // A generator's prose stays beside the story's names.
    expect(truth.withStoryMap({ rivals: 'Marcus, since the tour' }, story))
      .toEqual({ rivals: ['Marcus'], rivals_notes: 'Marcus, since the tour', love_interests: ['Jo'] });
    expect(truth.withStoryMap([{ target: 'x' }], story)).toEqual([{ target: 'x' }]);
  });
});
