/**
 * My Little List ♡, Phase 1 (Evoni, 2026-10-26). Episode 1
 * (tests/fixtures/myLittleListEpisode1): what Lala sees before the
 * invitation, after discovering and accepting the deal, and after her
 * outfit and Reel; one deal item that changes, never two; nothing private
 * leaves the server, said or paraphrased; ticks only where the game allows;
 * her reminders never touch social_tasks.
 */
jest.mock('../../../src/services/storyCarryForward', () => ({ settleFollowUps: jest.fn(async () => {}) }));

const list = require('../../../src/services/myLittleListService');
const ep1 = require('../../fixtures/myLittleListEpisode1');

const at = (beat, line = 0) => ({ beat, line });
const seen = (input, pos) => list.publicList(list.buildList(input, pos));
const titles = (input, pos) => seen(input, pos).items.map((i) => i.title);
const itemOf = (input, pos, title) => seen(input, pos).items.find((i) => i.title === title);

describe('Episode 1: A, B, C', () => {
  test('A — before the invitation (beat 3): her own reminder only; no event, brand, deal or runway', () => {
    const out = seen(ep1.input(), at(3));
    expect(out).toEqual({
      app: 'My Little List ♡',
      items: [{ key: expect.stringMatching(/^mll_[0-9a-f]{24}$/), title: 'Check my coins', note: null, done: false, can_check: true, can_edit: true, can_remove: true }],
      progress: { done: 0, total: 1 },
    });
  });

  test('B1 — after the invitation and the offer (beat 5, the offer letter line): preparation, and the offer to think over', () => {
    expect(titles(ep1.input(), at(5, 3))).toEqual([
      'Check my coins', 'Find something to wear', 'Meet some interesting people', 'Get some good footage', 'Get to the studio', 'Look into that video offer',
    ]);
    expect(itemOf(ep1.input(), at(5, 3), 'Find something to wear')).toMatchObject({ note: '0 of 3 pieces sorted', done: false, can_check: false });
    expect(itemOf(ep1.input(), at(5, 3), 'Look into that video offer')).toMatchObject({ done: false, can_check: false, can_remove: false });
  });

  test('within beat 5: the invitation line shows the preparation, the offer waits for its own line', () => {
    expect(titles(ep1.input(), at(5, 0))).toEqual(['Check my coins']);
    expect(titles(ep1.input(), at(5, 1))).not.toContain('Look into that video offer');
    expect(titles(ep1.input(), at(5, 1))).toContain('Find something to wear');
  });

  test('B2 — after she says yes (beat 6, the [LEARNS: deal_accepted] line): the same item, now committed', () => {
    const before = itemOf(ep1.input(), at(6, 0), 'Look into that video offer');
    const after = itemOf(ep1.input(), at(6, 1), 'Film my video');
    expect(before).toBeTruthy();
    expect(after).toMatchObject({ key: before.key, done: false });
    expect(titles(ep1.input(), at(6, 1))).not.toContain('Look into that video offer');
    expect(seen(ep1.input(), at(6, 1)).items.filter((i) => i.key === before.key)).toHaveLength(1);
  });

  test('C — after the outfit (beat 8) and the Reel (beat 11 [DELIVER]): both ticked, the rest as they were', () => {
    const out = seen(ep1.input(), at(12));
    expect(out.items.map((i) => [i.title, i.done])).toEqual([
      ['Check my coins', false], ['Find something to wear', true], ['Meet some interesting people', false],
      ['Get some good footage', false], ['Get to the studio', false], ['Film my video', true],
    ]);
    expect(itemOf(ep1.input(), at(12), 'Find something to wear').note).toBe('2 of 3 pieces sorted');
    expect(out.progress).toEqual({ done: 2, total: 6 });
  });

  test('the outfit ticks on its [WEAR] line and the video on its [DELIVER] line, within the beat', () => {
    expect(itemOf(ep1.input(), at(8, 0), 'Find something to wear').done).toBe(false);
    expect(itemOf(ep1.input(), at(8, 1), 'Find something to wear').done).toBe(true);
    expect(itemOf(ep1.input(), at(11, 0), 'Film my video').done).toBe(false);
    expect(itemOf(ep1.input(), at(11, 1), 'Film my video').done).toBe(true);
  });

  test('the runway: hidden until she hears of it (beat 14), and her runway reminder until she says yes', () => {
    expect(titles(ep1.input(), at(14, 0))).not.toContain('Practice my catwalk');
    expect(titles(ep1.input(), at(14, 1))).toContain('Practice my catwalk');
    expect(titles(ep1.input(), at(14, 2))).not.toContain('Don\'t embarrass myself on this runway');
    const yes = ep1.input({ script: `${ep1.SCRIPT}\n[LEARNS: opportunity_accepted opp-runway]` });
    expect(titles(yes, at(14, 4))).toContain('Don\'t embarrass myself on this runway');
  });
});

describe('nothing private leaves the server', () => {
  const POSITIONS = [at(1), at(3), at(5, 1), at(5, 3), at(6, 1), at(8, 2), at(11, 2), at(12), at(14, 0)];

  test('exactly the public fields; the key is the opaque one', () => {
    for (const pos of POSITIONS) {
      const out = seen(ep1.input(), pos);
      expect(Object.keys(out).sort()).toEqual(['app', 'items', 'progress']);
      expect(Object.keys(out.progress).sort()).toEqual(['done', 'total']);
      for (const item of out.items) {
        expect(Object.keys(item).sort()).toEqual([...list.PUBLIC_FIELDS].sort());
        expect(item.key).toMatch(/^mll_[0-9a-f]{24}$/);
      }
    }
  });

  test('no label, description, slot, source, id or brand, at any point', () => {
    for (const pos of POSITIONS) {
      const json = JSON.stringify(seen(ep1.input(), pos)).toLowerCase();
      for (const secret of ep1.PRIVATE_STRINGS) expect(json).not.toContain(String(secret).toLowerCase());
    }
  });

  test('the key says nothing: not the slot, the episode or the item ref', () => {
    const { key } = itemOf(ep1.input(), at(12), 'Meet some interesting people');
    expect(key).not.toMatch(/network|task|11111111/);
    expect(list.itemKey(ep1.EPISODE_ID, 'task:network')).toBe(key);
    expect(list.itemKey('22222222-2222-4222-8222-222222222222', 'task:network')).not.toBe(key);
  });

  test('progress counts only what she sees: a hidden goal is not a hidden "1 more"', () => {
    const out = seen(ep1.input(), at(12));
    expect(out.progress.total).toBe(out.items.length);
    expect(ep1.SOCIAL_TASKS.filter((t) => !t.deliverable_id)).toHaveLength(3);
    expect(out.items.filter((i) => /people|footage/.test(i.title))).toHaveLength(2);
  });

  test('a goal no wording fits is hidden and flagged for the producer, with its label there only', () => {
    const built = list.buildList(ep1.input(), at(12));
    expect(list.reviewList(built)).toEqual([
      // Her early catwalk reminder names the runway she hasn't heard of yet.
      expect.objectContaining({ reason: 'spoiler', kind: 'reminder', label: 'Practice my catwalk', leaked: ['runway'] }),
      expect.objectContaining({ reason: 'needs_wording', kind: 'task', label: 'Win over the creative director before the reveal' }),
    ]);
  });
});

describe('semantic spoilers: said or paraphrased', () => {
  const withWords = (words) => ep1.input({ personal: { ...ep1.PERSONAL, words } });

  test.each([
    ['the runway, said', 'Walk the runway for Maison Rue'],
    ['the runway, paraphrased', 'Practice for the catwalk'],
    ['the runway, as modelling', 'Nail the modelling gig'],
    ['the company, possessive', "Ask about Maison Rue's samples"],
    ['the venue', 'Scope out the Glasshouse'],
  ])('%s: approved wording is hidden and flagged', (_, words) => {
    const input = withWords({ 'task:network': { title: words } });
    expect(titles(input, at(12))).not.toContain(words);
    const flagged = list.reviewList(list.buildList(input, at(12))).find((r) => r.label === 'Network with strategic event contacts');
    expect(flagged).toMatchObject({ reason: 'spoiler', leaked: expect.any(Array) });
  });

  test('a note can leak too: the whole item is hidden', () => {
    const input = withWords({ 'task:bts': { title: 'Get some good footage', note: 'Save some for the catwalk' } });
    expect(titles(input, at(12))).not.toContain('Get some good footage');
  });

  test('before the invitation, the event\'s own names are private: a start reminder naming Sable is hidden', () => {
    const input = ep1.input({ personal: { reminders: [{ id: 'r1', title: 'Text Sable back', reveal: { when: 'start' } }], words: {} } });
    expect(titles(input, at(3))).toEqual([]);
    expect(titles(input, at(5, 1))).toContain('Text Sable back');
  });

  test('once she knows of the runway, the same words show', () => {
    const input = withWords({ 'task:network': { title: 'Practice for the catwalk' } });
    expect(titles(input, at(14, 1))).toContain('Practice for the catwalk');
  });

  test('two items with the same wording: the second is hidden and flagged, not doubled', () => {
    const input = withWords({ 'task:bts': { title: 'Meet some interesting people' } });
    expect(titles(input, at(12)).filter((t) => t === 'Meet some interesting people')).toHaveLength(1);
    expect(list.reviewList(list.buildList(input, at(12))).map((r) => r.reason)).toContain('duplicate_wording');
  });
});

describe('hidden unless a rule shows it', () => {
  test('a reminder with no valid reveal stays hidden and is flagged', () => {
    const input = ep1.input({ personal: { reminders: [{ id: 'r1', title: 'Mystery', reveal: { when: 'someday' } }], words: {} } });
    expect(titles(input, at(14, 9))).not.toContain('Mystery');
    expect(list.reviewList(list.buildList(input, at(14, 9))).find((r) => r.label === 'Mystery')).toMatchObject({ reason: 'no_reveal_rule' });
  });

  test('no event: only start reminders and follow-ups', () => {
    const input = ep1.input({ event: null, deliverables: [], socialTasks: [...ep1.SOCIAL_TASKS, { slot: 'follow_up_f1', label: 'Catch up with Nia', task_source: 'goal', follow_up_id: 'f1' }] });
    expect(titles(input, at(5, 3))).toEqual(['Follow up from last time', 'Check my coins']);
  });

  test('a goal ticked in a later beat from the Script tab reads not done before that beat', () => {
    const input = ep1.input({ socialTasks: ep1.SOCIAL_TASKS.map((t) => (t.slot === 'network' ? { ...t, completed: true, completed_beat: 10 } : t)) });
    expect(itemOf(input, at(9), 'Meet some interesting people').done).toBe(false);
    expect(itemOf(input, at(10), 'Meet some interesting people').done).toBe(true);
  });

  test('a deal with no deliverables: one item, done once she says yes', () => {
    const input = ep1.input({ deliverables: [], socialTasks: ep1.SOCIAL_TASKS.filter((t) => !t.deliverable_id) });
    expect(itemOf(input, at(6, 0), 'Think over that offer').done).toBe(false);
    expect(itemOf(input, at(6, 1), 'Think over that offer').done).toBe(true);
  });

  test('several deliverables: one item, counted', () => {
    const input = ep1.input({ deliverables: [...ep1.DELIVERABLES, { id: 'd-st', deliverable_type: 'pulse_stories', required: true }] });
    expect(itemOf(input, at(5, 3), 'Look into that offer')).toBeTruthy();
    expect(itemOf(input, at(12), 'Get my content for the deal done')).toMatchObject({ note: '1 of 2 done', done: false });
  });
});

describe('positions', () => {
  test('the start of the episode by default; 400 on a bad beat or line', () => {
    expect(list.positionOf({})).toEqual({ beat: 1, line: 0 });
    expect(list.positionOf({ beat: '6', line: '2' })).toEqual({ beat: 6, line: 2 });
    for (const bad of [{ beat: 0 }, { beat: 15 }, { beat: 'x' }, { beat: 2.5 }, { line: -1 }, { line: 'a' }]) {
      expect(() => list.positionOf(bad)).toThrow(expect.objectContaining({ status: 400, code: 'LIST_ITEM_INVALID' }));
    }
  });
});

// ─── Writes, with a fake database ───────────────────────────────────────────

function fakeModels({ columnReady = true, todo = true } = {}) {
  const store = {
    social: JSON.parse(JSON.stringify(ep1.SOCIAL_TASKS)),
    personal: JSON.parse(JSON.stringify(ep1.PERSONAL)),
  };
  const calls = [];
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (fn) => fn({ id: 'txn' })),
    query: jest.fn(async (sql, opts = {}) => {
      calls.push({ sql, opts });
      if (/information_schema\.columns/.test(sql)) return columnReady ? [{ '?column?': 1 }] : [];
      if (/FROM episodes WHERE id = :episodeId/.test(sql)) return [{ id: ep1.EPISODE_ID, show_id: 'show-1', episode_number: 1, script_content: ep1.SCRIPT }];
      if (/FROM episode_todo_lists/.test(sql)) {
        if (!todo) return [];
        return [{ id: 'todo-1', tasks: JSON.stringify(ep1.WARDROBE_TASKS), social_tasks: JSON.stringify(store.social), ...(columnReady ? { personal_list: JSON.stringify(store.personal) } : {}) }];
      }
      if (/FROM episode_wardrobe ew/.test(sql)) return ep1.LOOK;
      if (/FROM world_events WHERE id =/.test(sql)) return [{ ...ep1.EVENT, deal_type: 'brand_partnership', deal_components: ['paid_for_content'] }];
      if (/FROM episode_briefs b/.test(sql)) return [];
      if (/SELECT used_in_episode_id FROM world_events/.test(sql)) return [[{ used_in_episode_id: ep1.EPISODE_ID }]];
      if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) return [[{ id: ep1.EPISODE_ID }]];
      if (/FROM event_deliverables/.test(sql)) return ep1.DELIVERABLES;
      if (/FROM opportunities o/.test(sql)) return [{ id: 'opp-runway', name: ep1.OPPORTUNITIES[0].name, brand_or_company: 'Maison Rue', venue_name: 'The Glasshouse', status: 'offered', offered_episode_number: null }];
      if (/^UPDATE episode_todo_lists SET personal_list/.test(sql)) {
        store.personal = JSON.parse(opts.replacements.personal);
        if (/social_tasks = CAST/.test(sql)) store.social = JSON.parse(opts.replacements.social);
        return [[], 1];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
  return { models: { sequelize }, store, calls };
}

describe('writes', () => {
  beforeEach(() => list.resetColumnCache());
  const keyOf = async (models, pos, title) => (await list.getMyLittleList(models, ep1.EPISODE_ID, pos)).items.find((i) => i.title === title)?.key;

  test('her reminder: added, ticked, edited, removed, all with the row locked; social_tasks untouched', async () => {
    const { models, store, calls } = fakeModels();
    const socialBefore = JSON.stringify(store.social);
    const { key } = await list.addReminder(models, ep1.EPISODE_ID, { title: 'Charge my phone', note: 'Before the car comes' });
    expect(key).toMatch(/^mll_/);
    expect(calls.some((c) => /FOR UPDATE$/.test(c.sql) && c.opts.transaction)).toBe(true);
    await list.updateItem(models, ep1.EPISODE_ID, key, { done: true }, at(3));
    await list.updateItem(models, ep1.EPISODE_ID, key, { title: 'Charge my phone and the ring light' }, at(3));
    const item = (await list.getMyLittleList(models, ep1.EPISODE_ID, at(3))).items.find((i) => i.key === key);
    expect(item).toMatchObject({ title: 'Charge my phone and the ring light', note: 'Before the car comes', done: true });
    await list.removeItem(models, ep1.EPISODE_ID, key, at(3));
    expect((await list.getMyLittleList(models, ep1.EPISODE_ID, at(3))).items.some((i) => i.key === key)).toBe(false);
    expect(JSON.stringify(store.social)).toBe(socialBefore);
  });

  test('ticking her reminder changes no score: computeSocialTaskBonuses reads the same list', async () => {
    const { computeSocialTaskBonuses } = jest.requireActual('../../../src/services/episodeCompletionService');
    const { models, store } = fakeModels();
    const before = computeSocialTaskBonuses(store.social);
    const key = await keyOf(models, at(3), 'Check my coins');
    await list.updateItem(models, ep1.EPISODE_ID, key, { done: true }, at(3));
    expect(computeSocialTaskBonuses(store.social)).toEqual(before);
  });

  test('the wardrobe and the deal tick only from gameplay: 403, nothing written', async () => {
    const { models, calls } = fakeModels();
    for (const title of ['Find something to wear', 'Film my video']) {
      const key = await keyOf(models, at(12), title);
      await expect(list.updateItem(models, ep1.EPISODE_ID, key, { done: true }, at(12))).rejects.toMatchObject({ status: 403, code: 'COMPLETION_FROM_GAMEPLAY' });
    }
    expect(calls.some((c) => /^UPDATE/.test(c.sql))).toBe(false);
  });

  test('a goal ticks through social_tasks, as the Run Sheet does', async () => {
    const { models, store } = fakeModels();
    const key = await keyOf(models, at(12), 'Meet some interesting people');
    await list.updateItem(models, ep1.EPISODE_ID, key, { done: true }, at(12));
    expect(store.social.find((t) => t.slot === 'network')).toMatchObject({ completed: true });
    expect(store.social.find((t) => t.deliverable_id).completed).toBe(false);
  });

  test('a task\'s words are saved as its wording, never over its label', async () => {
    const { models, store } = fakeModels();
    const key = await keyOf(models, at(12), 'Meet some interesting people');
    await list.updateItem(models, ep1.EPISODE_ID, key, { title: 'Say hi to the stylists' }, at(12));
    expect(store.personal.words['task:network']).toEqual({ title: 'Say hi to the stylists' });
    expect(store.social.find((t) => t.slot === 'network').label).toBe('Network with strategic event contacts');
  });

  test('the deal\'s words go to its stage', async () => {
    const { models, store } = fakeModels();
    const key = await keyOf(models, at(5, 3), 'Look into that video offer');
    await list.updateItem(models, ep1.EPISODE_ID, key, { title: 'Think about Sable\'s offer' }, at(5, 3));
    await list.updateItem(models, ep1.EPISODE_ID, key, { title: 'Film the studio video' }, at(12));
    expect(store.personal.words[`deal:${ep1.EVENT.id}`]).toEqual({ title_considering: 'Think about Sable\'s offer', title: 'Film the studio video' });
  });

  test('a key she cannot see at that point is a 404, exactly as one that does not exist', async () => {
    const { models } = fakeModels();
    const dealKey = list.itemKey(ep1.EPISODE_ID, `deal:${ep1.EVENT.id}`);
    const a = list.updateItem(models, ep1.EPISODE_ID, dealKey, { done: true }, at(3));
    const b = list.updateItem(models, ep1.EPISODE_ID, 'mll_000000000000000000000000', { done: true }, at(3));
    await expect(a).rejects.toMatchObject({ status: 404, code: 'LIST_ITEM_NOT_FOUND', message: 'No such item on her list.' });
    await expect(b).rejects.toMatchObject({ status: 404, code: 'LIST_ITEM_NOT_FOUND', message: 'No such item on her list.' });
    const runwayReminder = list.itemKey(ep1.EPISODE_ID, 'reminder:r-runway');
    await expect(list.removeItem(models, ep1.EPISODE_ID, runwayReminder, at(12))).rejects.toMatchObject({ status: 404 });
  });

  test('a task is never removed here: 403', async () => {
    const { models } = fakeModels();
    const key = await keyOf(models, at(12), 'Meet some interesting people');
    await expect(list.removeItem(models, ep1.EPISODE_ID, key, at(12))).rejects.toMatchObject({ status: 403, code: 'LIST_ITEM_NOT_REMOVABLE' });
  });

  test.each([
    [{}, /title is required/],
    [{ title: 'x'.repeat(81) }, /at most 80/],
    [{ title: 'ok', note: 'n'.repeat(201) }, /at most 200/],
    [{ title: 'ok', reveal: { when: 'someday' } }, /reveal.when/],
    [{ title: 'ok', reveal: { when: 'opportunity_accepted' } }, /reveal.ref/],
    [{ title: 'ok', reveal: { when: 'opportunity_accepted', ref: 'opp-nope' } }, /reveal.ref/],
    [{ title: 'ok', reveal: { when: 'deal_accepted', ref: 'opp-runway' } }, /only for/],
  ])('adding %j is a 400', async (body, message) => {
    const { models } = fakeModels();
    await expect(list.addReminder(models, ep1.EPISODE_ID, body)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(message) });
  });

  test('a reminder tied to an opportunity is accepted with the show\'s opportunity id', async () => {
    const { models, store } = fakeModels();
    await list.addReminder(models, ep1.EPISODE_ID, { title: 'Book a walking coach', reveal: { when: 'opportunity_accepted', ref: 'opp-runway' } });
    expect(store.personal.reminders.at(-1).reveal).toEqual({ when: 'opportunity_accepted', ref: 'opp-runway' });
  });

  test('done must be a boolean; an empty change is a 400', async () => {
    const { models } = fakeModels();
    const key = await keyOf(models, at(3), 'Check my coins');
    await expect(list.updateItem(models, ep1.EPISODE_ID, key, { done: 'yes' }, at(3))).rejects.toMatchObject({ status: 400 });
    await expect(list.updateItem(models, ep1.EPISODE_ID, key, {}, at(3))).rejects.toMatchObject({ status: 400 });
  });

  test('no list row yet: writes are a 404', async () => {
    const { models } = fakeModels({ todo: false });
    await expect(list.addReminder(models, ep1.EPISODE_ID, { title: 'x' })).rejects.toMatchObject({ status: 404, code: 'NO_EPISODE_LIST' });
  });
});

describe('before the migration has run', () => {
  beforeEach(() => list.resetColumnCache());

  test('the list reads, without the column in the query, and shows no reminders or wording', async () => {
    const { models, calls } = fakeModels({ columnReady: false });
    const out = await list.getMyLittleList(models, ep1.EPISODE_ID, at(12));
    const todoQuery = calls.find((c) => /FROM episode_todo_lists/.test(c.sql)).sql;
    expect(todoQuery).not.toMatch(/personal_list/);
    expect(out.items.map((i) => i.title)).toEqual([
      'Find something to wear', 'Meet some interesting people', 'Get some good footage', 'Film my video',
    ]);
  });

  test('every write is a 503 PERSONAL_LIST_MIGRATION_PENDING and nothing is written', async () => {
    const { models, calls } = fakeModels({ columnReady: false });
    await expect(list.addReminder(models, ep1.EPISODE_ID, { title: 'x' })).rejects.toMatchObject({ status: 503, code: 'PERSONAL_LIST_MIGRATION_PENDING' });
    const key = list.itemKey(ep1.EPISODE_ID, 'task:network');
    await expect(list.updateItem(models, ep1.EPISODE_ID, key, { done: true }, at(12))).rejects.toMatchObject({ status: 503 });
    expect(calls.some((c) => /^UPDATE/.test(c.sql))).toBe(false);
  });

  test('once the column is there, the check is not repeated', async () => {
    const { models, calls } = fakeModels();
    await list.getMyLittleList(models, ep1.EPISODE_ID, at(3));
    await list.getMyLittleList(models, ep1.EPISODE_ID, at(3));
    expect(calls.filter((c) => /information_schema/.test(c.sql))).toHaveLength(1);
  });
});
