/**
 * The "What changed" card (Evoni, 2026-10-23; services/episodeStoryRecord):
 * clean() keeps only the cast's people, real stages, the goals and the
 * open threads; the draft reads the whole script with the goals, the cast's
 * relationships and the open follow-ups; Save writes each kept item once
 * (a thread, a relationship and its event, a follow-up, a ticked goal),
 * skips a person not in the registry, and a second Save writes nothing.
 *
 * The SDK and the database are mocked; the database answers by SQL.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));
jest.mock('../../../src/services/storyGenerationService', () => ({ episodeCast: jest.fn() }));
jest.mock('../../../src/services/characterSecrets', () => ({ secretsFor: jest.fn(async () => new Map()) }));
jest.mock('../../../src/services/lalaFeedProfile', () => ({ lalaCharacter: jest.fn() }));
jest.mock('../../../src/services/storyThreadService', () => ({ createThread: jest.fn() }));

const { episodeCast } = require('../../../src/services/storyGenerationService');
const { secretsFor } = require('../../../src/services/characterSecrets');
const { lalaCharacter } = require('../../../src/services/lalaFeedProfile');
const { createThread } = require('../../../src/services/storyThreadService');
const { clean, draftPrompt, draftRecord, approveRecord, SCRIPT_LIMIT } = require('../../../src/services/episodeStoryRecord');

const EP = '11111111-1111-4111-8111-111111111111';
const SHOW = '22222222-2222-4222-8222-222222222222';
const LALA = '33333333-3333-4333-8333-333333333333';
const MARCUS = '44444444-4444-4444-8444-444444444444';
const THREAD = '55555555-5555-4555-8555-555555555555';
const SECRET = '66666666-6666-4666-8666-666666666666';

const CAST = [
  { id: LALA, name: 'Lala', profile_id: 1, linked: true, is_lala: true, secrets: [] },
  { id: MARCUS, name: 'Marcus Hale', profile_id: 7, linked: true, secrets: [{ id: SECRET, text: 'He sent the invitation', state: 'hidden', known_by: [] }] },
  { id: 'profile:9', name: 'Studio Bystable', profile_id: 9, linked: false, secrets: [] },
];
const THREADS = [{ id: THREAD, title: 'Who is Truthville?' }];
const GOALS = [{ slot: 'relationship_guest', label: 'Get to know Truthville', completed: false, beat: 11 }];

describe('clean()', () => {
  test('keeps the cast, real stages, beats 1-14, the goals and the open threads; every item gets keep', () => {
    const out = clean({
      relationships: [
        { a: LALA, b: MARCUS, type: 'Love Interest', is_romantic: true, stage_before: 'strangers', stage_after: 'Close Friends', evidence_beat: 11, tension_before: 2, tension_after: 11 },
        { a: MARCUS, b: LALA, type: 'again' },
        { a: LALA, b: LALA },
        { a: LALA, b: 'nobody' },
        { a: LALA, b: 'profile:9', stage_before: 'flirting', evidence_beat: 99 },
      ],
      follow_ups: [{ person: 'profile:9', text: 'Follow up about the collab', due_hint: 'next episode' }, { person: 'ghost', text: 'Call back', keep: false }, { text: ' ' }],
      goals: [{ slot: 'relationship_guest', covered: true, beat: '11' }, { slot: 'relationship_guest', covered: false }, { slot: 'made_up', covered: true }],
      threads: [
        { thread_id: THREAD, action: 'close', title: 'Who is Truthville?' },
        { thread_id: THREAD, action: 'new', title: 'Same one, called new' },
        { thread_id: 'made-up', action: 'close', title: 'Who sent the second invitation?' },
        { title: '' },
      ],
      secrets: [{ secret_id: SECRET, what: 'hinted', how: 'A glance', keep: false }, { secret_id: 'nope', what: 'revealed' }],
      twists: [{ title: 'Not yet' }],
    }, { cast: CAST, threads: THREADS, goals: GOALS });

    expect(out.relationships).toHaveLength(2);
    expect(out.relationships[0]).toMatchObject({
      a: LALA, b: MARCUS, a_name: 'Lala', b_name: 'Marcus Hale', type: 'love_interest', is_romantic: true,
      stage_before: 'strangers', stage_after: 'close_friends', evidence_beat: 11, tension_before: 2, tension_after: null, keep: true,
    });
    expect(out.relationships[1]).toMatchObject({ a: LALA, b: 'profile:9', stage_before: null, evidence_beat: null, is_romantic: false });
    expect(out.relationships.every((r) => typeof r.key === 'string' && r.key.length >= 6)).toBe(true);
    expect(out.follow_ups.map((f) => [f.person, f.name, f.text, f.keep])).toEqual([
      ['profile:9', 'Studio Bystable', 'Follow up about the collab', true],
      [null, '', 'Call back', false],
    ]);
    expect(out.goals).toEqual([expect.objectContaining({ slot: 'relationship_guest', label: 'Get to know Truthville', covered: true, beat: 11, keep: true })]);
    expect(out.threads.map((t) => [t.thread_id, t.action])).toEqual([[THREAD, 'close'], [THREAD, 'advance'], [null, 'new']]);
    expect(out.secrets).toEqual([{ secret_id: SECRET, character_id: MARCUS, text: 'He sent the invitation', what: 'hinted', how: 'A glance', keep: false }]);
    expect(out.twists).toEqual([]);
  });

  test('a key passed back is kept; a list that is not a list is refused', () => {
    const out = clean({ follow_ups: [{ key: 'keep-me-1', text: 'Hi' }] }, { cast: CAST, threads: [] });
    expect(out.follow_ups[0].key).toBe('keep-me-1');
    expect(() => clean({ relationships: 'nope' }, { cast: CAST, threads: [] })).toThrow('relationships is a list.');
  });
});

describe('draftPrompt()', () => {
  test('names the goals with their beats, the relationships, the open follow-ups and who is not linked', () => {
    const prompt = draftPrompt({
      episode: { episode_number: 1, title: 'Studio Night', script_content: 'x'.repeat(30000) + 'BEAT 14 ENDS HERE' },
      event: null, cast: CAST, threads: THREADS, goals: GOALS,
      relationships: [{ character_id_a: LALA, character_id_b: MARCUS, relationship_type: 'love_interest', is_romantic: true, stage: 'acquaintances' }],
      followUps: [{ text: 'Thank the host', due_hint: 'next episode', episode_number: 1 }],
    });
    expect(SCRIPT_LIMIT).toBeGreaterThanOrEqual(40000);
    expect(prompt).toContain('BEAT 14 ENDS HERE');
    expect(prompt).toContain('- [relationship_guest] Get to know Truthville (the script check finds it in beat 11)');
    expect(prompt).toContain(`- [${LALA}] Lala and [${MARCUS}] Marcus Hale: love_interest, romantic, stage acquaintances`);
    expect(prompt).toContain('- Thank the host (due: next episode) (from episode 1)');
    expect(prompt).toContain('[profile:9] Studio Bystable (not in the character registry yet)');
    expect(prompt).toContain(`[${LALA}] Lala (Lala herself)`);
    expect(prompt).toContain('strangers | acquaintances | friends | close_friends | lovers | partners | exes | enemies');
  });
});

// ── A database that answers by SQL ─────────────────────────────────────────

function fakeDb({ row: start }) {
  const state = {
    row: { id: 'rec-1', episode_id: EP, status: 'draft', what_happened: 'Lala met Truthville.', applied: {}, ...start },
    todo: { id: 'todo-1', social_tasks: [{ slot: 'relationship_guest', label: 'Get to know Truthville', task_source: 'goal', completed: false }] },
    rels: [], events: [], follows: [], threadUpdates: [], secretUpdates: [],
  };
  const query = jest.fn(async (sql, { replacements: r = {} } = {}) => {
    if (/FROM episodes WHERE id/.test(sql)) return [[{ id: EP, show_id: SHOW, episode_number: 1, title: 'Studio Night', script_content: '## BEAT: 11 · The Moment\nMARCUS HALE: Hi.', description: null }]];
    if (/FROM world_events/.test(sql)) return [[{ id: 'ev-1', name: 'Studio Night', canon_consequences: {} }]];
    if (/FROM episode_story_records/.test(sql)) return [[state.row]];
    if (/UPDATE episode_story_records/.test(sql)) {
      state.row = { ...state.row, status: 'approved', approved_by: r.by, ...(r.applied ? { applied: JSON.parse(r.applied) } : {}) };
      return [[]];
    }
    if (/UPDATE character_secrets/.test(sql)) { state.secretUpdates.push(r); return [[], { rowCount: 1 }]; }
    if (/FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND LOWER/.test(sql)) return [[]];
    if (/UPDATE show_story_threads/.test(sql)) { state.threadUpdates.push({ id: r.id, closed: /SET status = 'closed'/.test(sql) }); return [[]]; }
    if (/FROM show_story_threads/.test(sql)) return [THREADS];
    if (/SELECT id, situation FROM character_relationships/.test(sql)) return [[]];
    if (/INSERT INTO character_relationships/.test(sql)) { state.rels.push(r); return [[{ id: `rel-${state.rels.length}` }]]; }
    if (/FROM relationship_events/.test(sql)) return [[]];
    if (/INSERT INTO relationship_events/.test(sql)) { state.events.push({ ...r, metadata: JSON.parse(r.metadata) }); return [[{ id: `rev-${state.events.length}` }]]; }
    if (/SELECT id FROM show_follow_ups/.test(sql)) return [[]];
    if (/INSERT INTO show_follow_ups/.test(sql)) { state.follows.push(r); return [[{ id: `fu-${state.follows.length}` }]]; }
    if (/FROM show_follow_ups/.test(sql)) return [[]];
    if (/FROM episode_todo_lists/.test(sql)) return [[state.todo]];
    if (/UPDATE episode_todo_lists/.test(sql)) { state.todo = { ...state.todo, social_tasks: JSON.parse(r.tasks) }; return [[]]; }
    if (/FROM character_relationships/.test(sql)) return [[]];
    throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
  });
  return { state, sequelize: { query, transaction: async (fn) => fn({ id: 'tx' }) } };
}

const KEPT_ROW = {
  secrets: [{ secret_id: SECRET, character_id: MARCUS, text: 'He sent the invitation', what: 'hinted', how: 'A glance', keep: true }],
  threads: [
    { key: 'thread-new', thread_id: null, title: 'Who sent the second invitation?', note: 'A second envelope', action: 'new', keep: true },
    { key: 'thread-adv', thread_id: THREAD, title: 'Who is Truthville?', note: 'Real name Marcus Hale', action: 'advance', keep: true },
    { key: 'thread-off', thread_id: THREAD, title: 'Who is Truthville?', action: 'close', keep: false },
  ],
  relationships: [
    { key: 'rel-romance', a: LALA, b: MARCUS, type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'acquaintances', tension_before: 2, tension_after: 5, evidence_beat: 11, note: 'Flirting', keep: true },
    { key: 'rel-studio', a: LALA, b: 'profile:9', type: 'collaborator', is_romantic: false, stage_before: null, stage_after: 'acquaintances', evidence_beat: 9, note: '', keep: true },
  ],
  follow_ups: [
    { key: 'fu-studio', person: 'profile:9', name: 'Studio Bystable', text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', keep: true },
    { key: 'fu-dropped', person: null, name: '', text: 'Not this one', due_hint: '', keep: false },
  ],
  goals: [{ key: 'goal-1', slot: 'relationship_guest', label: 'Get to know Truthville', covered: true, beat: 11, keep: true }],
};

describe('approveRecord(): Save', () => {
  beforeEach(() => {
    episodeCast.mockResolvedValue([]);
    lalaCharacter.mockResolvedValue(null);
    secretsFor.mockResolvedValue(new Map());
    createThread.mockReset().mockResolvedValue({ id: 'thread-made' });
  });

  const withCast = () => {
    lalaCharacter.mockResolvedValue({ id: LALA, feed_profile_id: 1 });
    episodeCast.mockResolvedValue([
      { profile_id: 7, char_id: MARCUS, char_name: 'Marcus Hale', creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'truthville' },
      { profile_id: 9, char_id: null, display_name: 'Studio Bystable', handle: 'studiobystable' },
    ]);
  };

  test('writes each kept item: thread, relationship and event, follow-up, goal; skips the unlinked person', async () => {
    withCast();
    const { state, sequelize } = fakeDb({ row: KEPT_ROW });
    const out = await approveRecord(sequelize, EP, { by: 'evoni' });

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(createThread).toHaveBeenCalledWith(sequelize, SHOW,
      { title: 'Who sent the second invitation?', description: 'A second envelope', source: 'record', episode_id: EP }, { transaction: { id: 'tx' } });
    // Advanced, not closed: the close item was unticked.
    expect(state.threadUpdates).toEqual([{ id: THREAD, closed: false }]);
    expect(state.rels).toEqual([expect.objectContaining({ a: LALA, b: MARCUS, type: 'love_interest', romantic: true, lalaConnection: 'knows_lala', note: 'Flirting' })]);
    expect(state.events).toEqual([expect.objectContaining({
      id: 'rel-1', eventType: 'first_meeting', stage: 'acquaintances', tb: 2, ta: 5,
      metadata: { episode_id: EP, beat: 11, stage_before: 'strangers', source: 'record' },
    })]);
    expect(state.follows).toEqual([expect.objectContaining({ showId: SHOW, episodeId: EP, profileId: 9, characterId: null, text: 'Follow up with Studio Bystable about the collab', due: 'next episode', by: 'evoni' })]);
    expect(state.todo.social_tasks[0]).toMatchObject({ completed: true, completed_source: 'record', completed_beat: 11 });
    expect(state.secretUpdates).toHaveLength(1);
    expect(out.result.skipped).toEqual([{ kind: 'relationship', reason: 'not_linked', name: 'Studio Bystable', profile_id: 9 }]);
    expect(out.result.written.map((w) => w.text)).toEqual([
      'Hinted at: He sent the invitation',
      'New thread: Who sent the second invitation?',
      'Moved on: Who is Truthville? (Real name Marcus Hale)',
      'New relationship: Lala and Marcus Hale (love interest), strangers to acquaintances',
      'Follow-up: Follow up with Studio Bystable about the collab (next episode)',
      'Goal ticked: Get to know Truthville (beat 11)',
    ]);
    expect(state.row.applied).toMatchObject({
      threads: { 'thread-new': { thread_id: 'thread-made', action: 'new' }, 'thread-adv': { thread_id: THREAD, action: 'advance' } },
      relationships: { 'rel-romance': { relationship_id: 'rel-1', event_id: 'rev-1' } },
      follow_ups: { 'fu-studio': 'fu-1' }, goals: { relationship_guest: true }, secrets: { [SECRET]: 'hinted' },
    });
    expect(state.row.applied.relationships['rel-studio']).toBeUndefined();

    // The second Save: nothing new is written; the unlinked person is still reported.
    const again = await approveRecord(sequelize, EP, { by: 'evoni' });
    expect(again.result.written).toEqual([]);
    expect(again.result.skipped).toEqual([{ kind: 'relationship', reason: 'not_linked', name: 'Studio Bystable', profile_id: 9 }]);
    expect(createThread).toHaveBeenCalledTimes(1);
    expect(state.rels).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.follows).toHaveLength(1);
    expect(state.threadUpdates).toHaveLength(1);
    expect(state.secretUpdates).toHaveLength(1);
  });

  test('a close item that is kept closes the thread', async () => {
    withCast();
    const { state, sequelize } = fakeDb({ row: { threads: [{ key: 'thread-close', thread_id: THREAD, title: 'Who is Truthville?', action: 'close', keep: true }] } });
    const out = await approveRecord(sequelize, EP, { by: 'evoni' });
    expect(state.threadUpdates).toEqual([{ id: THREAD, closed: true }]);
    expect(out.result.written).toEqual([{ kind: 'thread', text: 'Closed: Who is Truthville?' }]);
  });

  test('without Lala in the registry, her relationship is skipped and says so', async () => {
    episodeCast.mockResolvedValue([{ profile_id: 7, char_id: MARCUS, char_name: 'Marcus Hale' }]);
    const { state, sequelize } = fakeDb({ row: { relationships: [{ key: 'rel-x1', a: 'lala', b: MARCUS, is_romantic: true, keep: true }] } });
    const out = await approveRecord(sequelize, EP, { by: 'evoni' });
    expect(state.rels).toEqual([]);
    expect(out.result.skipped).toEqual([{ kind: 'relationship', reason: 'not_linked', name: 'Lala', profile_id: null }]);
  });
});

describe('draftRecord()', () => {
  test('one call over the whole script, 4000 tokens; the reply is cleaned before it is saved', async () => {
    lalaCharacter.mockResolvedValue({ id: LALA, feed_profile_id: 1 });
    episodeCast.mockResolvedValue([{ profile_id: 7, char_id: MARCUS, char_name: 'Marcus Hale' }]);
    const { state, sequelize } = fakeDb({ row: {} });
    let saved = null;
    const base = sequelize.query;
    sequelize.query = jest.fn(async (sql, opts) => {
      if (/UPDATE episode_story_records SET status = :status/.test(sql)) { saved = opts.replacements; return [[]]; }
      return base(sql, opts);
    });
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify({
      what_happened: 'Lala met Truthville.',
      relationships: [{ a: LALA, b: MARCUS, is_romantic: true, stage_before: 'strangers', stage_after: 'acquaintances', evidence_beat: 11 }, { a: LALA, b: 'ghost' }],
      follow_ups: [{ person: MARCUS, text: 'Text him back', due_hint: 'next episode' }],
      goals: [{ slot: 'relationship_guest', covered: true, beat: 11 }],
      threads: [{ thread_id: null, action: 'new', title: 'Who sent the second invitation?' }],
    }) }] });
    await draftRecord(sequelize, EP);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.max_tokens).toBe(4000);
    expect(call.messages[0].content).toContain('LALA\'S RELATIONSHIP GOALS FOR THIS EPISODE:\n- [relationship_guest] Get to know Truthville');
    expect(JSON.parse(saved.relationships)).toHaveLength(1);
    expect(JSON.parse(saved.follow_ups)[0]).toMatchObject({ person: MARCUS, name: 'Marcus Hale', text: 'Text him back' });
    expect(JSON.parse(saved.goals)[0]).toMatchObject({ slot: 'relationship_guest', covered: true, beat: 11 });
    expect(JSON.parse(saved.twists)).toEqual([]);
    expect(state.row.id).toBe('rec-1');
  });
});
