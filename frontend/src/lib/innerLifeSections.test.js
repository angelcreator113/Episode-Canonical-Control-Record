/**
 * The Inner life workspace's sections (step 2): each subject reads its
 * fields from their one home, and saves only what changed, merged onto
 * what is stored.
 */
import { describe, test, expect } from 'vitest';
import {
  SECTIONS, getAt, draftOf, saveOf, filledCount, sectionProgress, summaryOf, applySuggestion,
  reviewRows, proposalLines, DIMENSION_KEYS, dimensionLabel, dimensionOf, dimensionText, searchDimensions, dimensionDraft, deepProfileWith,
} from './innerLifeSections';

const subject = (key) => SECTIONS.flatMap((s) => s.subjects).find((s) => s.key === key);

describe('the sections', () => {
  test('four sections of subjects, every form key unique', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Core psychology', 'Emotional architecture', 'Personal history', 'Beliefs & behaviours']);
    const keys = SECTIONS.flatMap((s) => s.subjects.flatMap((sub) => sub.fields.map((fd) => fd.key)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('the blind spot and the narrative gap are for the author only', () => {
    expect(subject('blindspot').authorOnly).toBe(true);
    expect(subject('narrative').fields.find((fd) => fd.key === 'de_actual_narrative_gap').authorOnly).toBe(true);
  });
});

describe('reading', () => {
  test('nested paths, JSON text and the older dilemma', () => {
    expect(getAt({ wound: { description: 'x' } }, ['wound', 'description'])).toBe('x');
    expect(getAt({ change_capacity: '{"mobility":"highly_fluid"}' }, ['change_capacity', 'mobility'])).toBe('highly_fluid');
    expect(getAt({ change_capacity: 'Slowly.' }, ['change_capacity', 'description'])).toBe('Slowly.');
    expect(getAt({ extra_fields: { dilemma: { option_a: 'Stay' } } }, ['dilemma', 'option_a'])).toBe('Stay');
    expect(getAt(null, ['wound'])).toBeNull();
  });

  test('a form: lists as lines, sliders as numbers, the rest as text', () => {
    const c = { triggers: ['Being ignored', { label: 'Silence' }], de_joy_current_access: '40', experience_of_joy: null };
    expect(draftOf(c, subject('triggers'))).toEqual({ triggers: 'Being ignored\nSilence' });
    const joy = draftOf(c, subject('joy'));
    expect(joy.de_joy_current_access).toBe(40);
    expect(joy.experience_of_joy).toBe('');
  });

  test('author-only fields are left out for everyone else', () => {
    const form = draftOf({ self_narrative: 'Me' }, subject('narrative'), false);
    expect(form).not.toHaveProperty('de_actual_narrative_gap');
    expect(filledCount({ self_narrative: 'Me' }, subject('narrative'), false)).toEqual({ filled: 1, total: 5 });
  });

  test('progress counts started subjects; a non-author does not count the blind spot', () => {
    const emotional = SECTIONS.find((s) => s.key === 'emotional');
    const c = { blind_spot: 'They cannot see it', time_orientation: 'cyclical' };
    expect(sectionProgress(c, emotional)).toEqual({ started: 2, total: 4 });
    expect(sectionProgress(c, emotional, false)).toEqual({ started: 1, total: 3 });
  });

  test('a summary: the summary fields, choices in words, lists joined', () => {
    expect(summaryOf({ change_capacity: { mobility: 'conditionally_open', armor_type: 'Wit' } }, subject('change')))
      .toEqual([{ label: 'How far they can change', text: 'conditionally open' }]);
    expect(summaryOf({ triggers: ['A', 'B'] }, subject('triggers'))).toEqual([{ label: 'Triggers', text: 'A · B' }]);
    expect(summaryOf({}, subject('wants'))).toEqual([]);
  });
});

describe('saving', () => {
  test('an untouched form saves nothing', () => {
    const c = {
      want_architecture: { surface_want: 'Fame', real_want: 'Love' }, triggers: ['A', 'B'], de_joy_current_access: 40,
      change_capacity: { mobility: 'highly_fluid', score: 70 },
    };
    for (const key of ['wants', 'triggers', 'joy', 'change']) {
      expect(saveOf(c, subject(key), draftOf(c, subject(key)))).toEqual({});
    }
  });

  test('a nested field is merged onto what is stored', () => {
    const c = { wound: { description: 'Old', deep_profile_dimensions_affected: ['the_body'] } };
    const form = { ...draftOf(c, subject('wound')), wound_origin: ' Age nine ' };
    expect(saveOf(c, subject('wound'), form)).toEqual({ wound: { description: 'Old', deep_profile_dimensions_affected: ['the_body'], origin_period: 'Age nine' } });
  });

  test('change capacity keeps the keys it does not edit, and a plain string becomes its description', () => {
    const c = { change_capacity: 'Slowly, if at all.' };
    const form = { ...draftOf(c, subject('change')), cc_mobility: 'highly_rigid' };
    expect(saveOf(c, subject('change'), form)).toEqual({ change_capacity: { description: 'Slowly, if at all.', mobility: 'highly_rigid' } });
  });

  test('clearing the last key of a record clears the column', () => {
    const c = { the_mask: { description: 'Calm' } };
    const form = { ...draftOf(c, subject('mask')), mask_description: '  ' };
    expect(saveOf(c, subject('mask'), form)).toEqual({ the_mask: null });
  });

  test('lists save as trimmed lines; sliders are kept in 0 to 100', () => {
    const c = {};
    expect(saveOf(c, subject('triggers'), { triggers: ' A \n\nB ' })).toEqual({ triggers: ['A', 'B'] });
    const joy = { ...draftOf(c, subject('joy')), de_joy_current_access: 140 };
    expect(saveOf(c, subject('joy'), joy)).toEqual({ de_joy_current_access: 100 });
  });

  test('the older dilemma is saved into the column, keeping its parts', () => {
    const c = { extra_fields: { dilemma: { central_tension: 'Stay or go', option_a: 'Stay' } } };
    const form = { ...draftOf(c, subject('dilemma')), dilemma_b: 'Go' };
    expect(saveOf(c, subject('dilemma'), form)).toEqual({ dilemma: { central_tension: 'Stay or go', option_a: 'Stay', option_b: 'Go' } });
  });

  test('foreclosed doors: notes for unselected doors are dropped', () => {
    const c = { de_foreclosed_possibilities: ['love'], de_foreclosure_origins: { love: 'Her mother' } };
    const form = draftOf(c, subject('foreclosed'));
    form.de_foreclosed_possibilities = { ...form.de_foreclosed_possibilities, selected: ['safety'], origins: { love: 'Her mother', safety: 'The fire' } };
    expect(saveOf(c, subject('foreclosed'), form)).toEqual({
      de_foreclosed_possibilities: ['safety'], de_foreclosure_origins: { safety: 'The fire' },
    });
    // Untouched, nothing is saved, even with no notes stored.
    const none = { de_foreclosed_possibilities: ['love'], de_crack_conditions: {} };
    expect(saveOf(none, subject('foreclosed'), draftOf(none, subject('foreclosed')))).toEqual({});
  });

  test('a non-author never saves an author-only field', () => {
    const c = { self_narrative: 'Me', de_actual_narrative_gap: 'The truth' };
    const form = { ...draftOf(c, subject('narrative'), false), de_actual_narrative_gap: '' };
    expect(saveOf(c, subject('narrative'), form, false)).toEqual({});
  });
});

describe('a Depth Engine suggestion', () => {
  test('fills only empty fields, maps twins to their homes, and skips values a list does not take', () => {
    const change = subject('change');
    const form = { ...draftOf({}, change), cc_conditions: 'Mine' };
    const { form: next, filled } = applySuggestion(change, form, {
      de_change_capacity: 'Highly Rigid', de_change_capacity_score: '33.6', de_change_condition: 'Theirs', de_arc_function: 'sideways', de_unknown: 'x',
    });
    expect(next.cc_mobility).toBe('highly_rigid');
    expect(next.cc_score).toBe(34);
    expect(next.cc_conditions).toBe('Mine');
    expect(next.cc_arc).toBe('');
    expect(filled).toEqual(['How far they can change', 'Change score (0 rigid, 100 fluid)']);
  });

  test('foreclosed doors only when none are chosen, notes only where none are written', () => {
    const fc = subject('foreclosed');
    const form = draftOf({}, fc);
    const { form: next } = applySuggestion(fc, form, {
      de_foreclosed_possibilities: ['love', 'nonsense'], de_foreclosure_origins: { love: 'Her mother' }, de_foreclosure_visibility: { love: 20 },
    });
    expect(next.de_foreclosed_possibilities.selected).toEqual(['love']);
    expect(next.de_foreclosed_possibilities.origins).toEqual({ love: 'Her mother' });
    const again = applySuggestion(fc, next, { de_foreclosed_possibilities: ['safety'], de_foreclosure_origins: { love: 'Other' } });
    expect(again.form.de_foreclosed_possibilities.selected).toEqual(['love']);
    expect(again.form.de_foreclosed_possibilities.origins.love).toBe('Her mother');
  });

  test('a non-author is never handed an author-only field', () => {
    const narrative = subject('narrative');
    const { form } = applySuggestion(narrative, draftOf({}, narrative, false), { de_actual_narrative_gap: 'Secret' }, false);
    expect(form).not.toHaveProperty('de_actual_narrative_gap');
  });
});

describe('the deep profile', () => {
  test('fourteen dimensions, read under either name', () => {
    expect(DIMENSION_KEYS).toHaveLength(14);
    expect(DIMENSION_KEYS.map(dimensionLabel).slice(0, 3)).toEqual(['Life Stage', 'The Body', 'Class & Money']);
    expect(dimensionOf({ class_and_money: 'Old money' }, 'class_money')).toBe('Old money');
    expect(dimensionOf('{"the_body":"Tall"}', 'the_body')).toBe('Tall');
    expect(dimensionText({ posture: 'Upright', stress_location: '' })).toBe('posture: Upright');
  });

  test('search matches the name or the words', () => {
    const dp = { grief_loss: 'Her father, in winter' };
    expect(searchDimensions(dp, 'grief')).toEqual(['grief_loss']);
    expect(searchDimensions(dp, 'father winter')).toEqual(['grief_loss']);
    expect(searchDimensions(dp, '')).toHaveLength(14);
  });

  test('saving one dimension keeps the others and moves an older name to the current one', () => {
    const dp = { class_and_money: 'Old', the_body: 'Tall' };
    expect(deepProfileWith(dp, 'class_money', { text: ' New ' })).toEqual({ the_body: 'Tall', class_money: 'New' });
    expect(deepProfileWith({ the_body: 'Tall' }, 'the_body', { text: '' })).toBeNull();
  });

  test('an object of notes is edited note by note', () => {
    const dp = { the_body: { posture: 'Upright', stress_location: 'Jaw' } };
    const draft = dimensionDraft(dp, 'the_body');
    expect(draft).toEqual({ parts: [['posture', 'Upright'], ['stress_location', 'Jaw']] });
    expect(deepProfileWith(dp, 'the_body', { parts: [['posture', 'Slouched'], ['stress_location', '']] })).toEqual({ the_body: { posture: 'Slouched' } });
  });
});

describe('Generate All\u2019s review', () => {
  test('each proposed field, what it would write, and whether to keep it', () => {
    const character = { wound: { description: 'Kept' }, extra_fields: { dilemma: { option_a: 'Stay' } } };
    const rows = reviewRows(character, {
      wound: { description: 'Drafted' }, experience_of_joy: 'Fittings', dilemma: { option_a: 'Go' }, the_mask: { description: 'Calm' },
    }, ['the_mask']);
    expect(rows.map((r) => [r.field, r.label, r.written, r.unsaved, r.keep])).toEqual([
      ['wound', 'Wound', true, false, false],
      ['experience_of_joy', 'Joy', false, false, true],
      ['dilemma', 'Central dilemma', true, false, false],
      ['the_mask', 'The mask', false, true, false],
    ]);
  });

  test('records read part by part, lists item by item, times in words', () => {
    expect(proposalLines('want_architecture', { real_want: 'Love', forbidden_want: '' })).toEqual([['real want', 'Love']]);
    expect(proposalLines('deep_profile', { class_money: 'Old' })).toEqual([['Class & Money', 'Old']]);
    expect(proposalLines('triggers', ['A', 'B'])).toEqual([['', 'A'], ['', 'B']]);
    expect(proposalLines('time_orientation', 'future_oriented')).toEqual([['', 'future oriented']]);
  });
});
