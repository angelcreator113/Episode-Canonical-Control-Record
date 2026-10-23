/**
 * Episode 1 feeds Episode 2 (Evoni, 2026-10-23; services/storyCarryForward):
 * the last approved record and the open follow-ups as the writers read
 * them, the follow-ups as Start Episode's carried goal tasks, and a ticked
 * carried task settling its follow-up.
 *
 * The database is mocked; it answers by SQL.
 */
const {
  carryBlock, carryForEpisode, carriedGoalTasks, settleFollowUps, MAX_CARRIED,
} = require('../../../src/services/storyCarryForward');
const { isLalaGoal, capCombinedGoals } = require('../../../src/utils/goalTasks');

const SHOW = '22222222-2222-4222-8222-222222222222';
const EP2 = '11111111-1111-4111-8111-111111111112';
const FU = (n) => `33333333-3333-4333-8333-33333333333${n}`;

const RECORD = {
  episode_number: 1, title: 'Studio Night', what_happened: 'Lala met Truthville at Studio Bystable\'s launch.',
  relationships: [
    { a_name: 'Lala', b_name: 'Marcus Hale', is_romantic: true, type: 'love_interest', stage_before: 'acquaintances', stage_after: 'flirting', note: 'He asks to see her again' },
  ],
  threads: [
    { title: 'Who sent the second invitation?', note: 'No name on it', action: 'new' },
    { title: 'Who is Truthville?', action: 'close' },
  ],
};
const FOLLOW = [{ id: FU(1), text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', episode_number: 1, profile_id: 9 }];

function fakeDb({ record = null, follows = [] } = {}) {
  const calls = [];
  const query = jest.fn(async (sql, { replacements: r = {} } = {}) => {
    calls.push({ sql, r });
    if (/FROM episodes WHERE id/.test(sql)) return [[{ show_id: SHOW, episode_number: 2 }]];
    if (/FROM episode_story_records/.test(sql)) {
      return [[record ? { ...record, relationships: JSON.stringify(record.relationships), threads: record.threads } : undefined].filter(Boolean)];
    }
    if (/FROM show_follow_ups/.test(sql)) return [follows];
    if (/UPDATE show_follow_ups SET status = 'done'/.test(sql)) return [r.ids.map((id) => ({ id }))];
    if (/UPDATE show_follow_ups SET status = 'open'/.test(sql)) return [r.ids.map((id) => ({ id }))];
    throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
  });
  return { calls, sequelize: { query } };
}

describe('carryBlock()', () => {
  test('what happened, where the relationships stand, what is left open, and what Lala owes', () => {
    const text = carryBlock({ record: { ...RECORD, relationships: RECORD.relationships, threads: RECORD.threads }, followUps: FOLLOW });
    expect(text).toContain('═══ LAST EPISODE\'S STORY (Episode 1, "Studio Night"; approved) ═══');
    expect(text).toContain('What happened: Lala met Truthville at Studio Bystable\'s launch.');
    expect(text).toContain('- Lala and Marcus Hale: love interest, now flirting (was acquaintances). He asks to see her again');
    expect(text).toContain('Left open:\n- Who sent the second invitation?: No name on it');
    // A closed thread is not left open.
    expect(text).not.toContain('Who is Truthville?');
    expect(text).toContain('What Lala still owes people:\n- Follow up with Studio Bystable about the collab (due: next episode) (from episode 1)');
    expect(text).toContain('CONTINUITY DIRECTIVE');
  });

  test('follow-ups alone have their own heading; nothing at all is empty', () => {
    expect(carryBlock({ followUps: FOLLOW })).toMatch(/^═══ WHAT LALA STILL OWES PEOPLE ═══\n- Follow up/);
    expect(carryBlock({})).toBe('');
  });
});

describe('carryForEpisode()', () => {
  test('reads the record and follow-ups before the episode\'s number', async () => {
    const { calls, sequelize } = fakeDb({ record: RECORD, follows: FOLLOW });
    const text = await carryForEpisode(sequelize, EP2);
    expect(text).toContain('Episode 1, "Studio Night"');
    const recordCall = calls.find((c) => /FROM episode_story_records/.test(c.sql));
    expect(recordCall.sql).toContain("r.status = 'approved'");
    expect(recordCall.r).toEqual({ showId: SHOW, before: 2 });
    expect(calls.find((c) => /FROM show_follow_ups/.test(c.sql)).r).toEqual({ showId: SHOW, before: 2 });
  });

  test('a bad id or a failed read is empty, never a throw', async () => {
    expect(await carryForEpisode({ query: jest.fn() }, 'nope')).toBe('');
    const broken = { query: jest.fn(async () => { throw new Error('relation "show_follow_ups" does not exist'); }) };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await carryForEpisode(broken, EP2)).toBe('');
    console.error.mockRestore();
  });
});

describe('carriedGoalTasks()', () => {
  test('open follow-ups become goal tasks with their follow-up and person, at most three', async () => {
    const follows = [1, 2, 3, 4].map((n) => ({ id: FU(n), text: `Owed ${n}`, due_hint: n === 1 ? 'next episode' : null, episode_number: 1, profile_id: n === 1 ? 9 : null }));
    const { sequelize } = fakeDb({ follows });
    const tasks = await carriedGoalTasks(sequelize, SHOW, { before: 2 });
    expect(MAX_CARRIED).toBe(3);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({
      slot: `follow_up_${FU(1)}`, label: 'Owed 1', description: 'Carried from episode 1 · due: next episode',
      platform: 'story', timing: 'during', required: false, completed: false, task_source: 'goal', follow_up_id: FU(1), profile_id: 9,
    });
    expect(tasks[1]).not.toHaveProperty('profile_id');
  });

  test('a carried task is owed already: it neither counts toward nor is dropped by the goal limit', () => {
    expect(isLalaGoal({ slot: 'x', task_source: 'goal', follow_up_id: FU(1) })).toBe(false);
    const list = [{ slot: 'a' }, { slot: 'b' }, { slot: 'c', follow_up_id: FU(1) }];
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(capCombinedGoals(list, { min: 1, max: 1 }).map((t) => t.slot)).toEqual(['a', 'c']);
    console.warn.mockRestore();
  });
});

describe('settleFollowUps()', () => {
  test('a completed carried task marks its follow-up done here; an unticked one opens again', async () => {
    const { calls, sequelize } = fakeDb();
    const out = await settleFollowUps(sequelize, [
      { slot: 's1', completed: true, follow_up_id: FU(1) },
      { slot: 's2', completed: false, follow_up_id: FU(2) },
      { slot: 'plain', completed: true },
    ], { episodeId: EP2 });
    expect(out).toEqual({ done: [FU(1)], reopened: [FU(2)] });
    const done = calls.find((c) => /status = 'done'/.test(c.sql));
    expect(done.r).toEqual({ ids: [FU(1)], episodeId: EP2 });
    expect(done.sql).toContain("status = 'open'");
    const reopen = calls.find((c) => /SET status = 'open'/.test(c.sql));
    // Only one this episode had done.
    expect(reopen.sql).toContain('done_episode_id = :episodeId');
  });

  test('no carried task, no query', async () => {
    const { calls, sequelize } = fakeDb();
    expect(await settleFollowUps(sequelize, [{ slot: 'a', completed: true }], { episodeId: EP2 })).toEqual({ done: [], reopened: [] });
    expect(calls).toHaveLength(0);
  });
});
