/**
 * The event documents rework (2026-10-24):
 *   - a shopping list records the look it was drafted from (look_key), so
 *     "look changed" is the same on every device; Keep takes the new look;
 *   - Redraft within budget; amount checks on each version;
 *   - restore an earlier version; re-roll one line;
 *   - the offer letter (Evoni, 2026-10-24; it replaced the career plan):
 *     deal events only, a letter plus the deal's terms, "terms changed",
 *     edits of its words, and its overlay on beat 5, directly after the
 *     invitation, after approval.
 */
const mockLook = { current: null };
const mockOverlay = { current: null };
jest.mock('../../../src/services/eventDocumentOverlayService', () => ({
  shoppingListContext: jest.fn(async () => ({ look: mockLook.current, balance: 300 })),
  overlayState: jest.fn(() => 'current'),
  makeDocumentOverlay: jest.fn(async () => mockOverlay.current),
  shoppingLines: jest.fn(() => ({ lines: [], total: 0 })),
}));
// The deal's terms rows: one deliverable, and the host covering entry.
const mockTerms = { deliverables: [{ id: 'd-1', description: 'One reel in the coat', deliverable_type: 'reel', required: true, owed_to: 'brand', fee: 0 }], costs: [{ kind: 'entry', paid_by: 'host', amount: 0 }] };
jest.mock('../../../src/services/eventTermsService', () => ({ listEventDeliverables: jest.fn(async () => mockTerms.deliverables) }));
jest.mock('../../../src/services/eventCostsService', () => ({
  ...jest.requireActual('../../../src/services/eventCostsService'),
  listEventCosts: jest.fn(async () => mockTerms.costs),
}));
jest.mock('../../../src/services/offerLetterService', () => ({
  ...jest.requireActual('../../../src/services/offerLetterService'),
  writeOfferLetter: jest.fn(async () => ({
    letter: { greeting: 'Dear Lala,', opening: 'Following our invitation, Maison Rue is pleased to offer you a partnership.', opportunity: 'We would love you to front our launch.', next_steps: 'Reply to accept.', closing: 'Warm regards,', sender_name: 'Celeste Rue', sender_title: 'Founder, Maison Rue' },
    source: 'claude',
    checks: { amounts: { ok: true, invented: [] } },
  })),
}));
jest.mock('../../../src/services/episodeBeatPlacement', () => ({
  placeOverlayOnBeat: jest.fn(async () => ({ placement: null, anchor: null, beat: null })),
}));
jest.mock('../../../src/services/todoListService', () => ({
  generateTasks: jest.fn(),
  generateCareerTasks: jest.fn(),
  redraftDocumentLine: jest.fn(),
  listSlotOf: jest.requireActual('../../../src/services/todoListService').listSlotOf,
}));
jest.mock('../../../src/services/episodeEventsService', () => ({
  listEpisodeEvents: jest.fn(async () => ({ events: [{ id: 'ev-1' }] })),
}));

const todo = require('../../../src/services/todoListService');
const beats = require('../../../src/services/episodeBeatPlacement');
const svc = require('../../../src/services/eventDocumentsService');

const flat = (sql) => sql.replace(/\s+/g, ' ').trim();

/** An in-memory event, episode and todo row, answering the service's SQL. */
function fakeModels(event, { todoRow = null, wardrobe = [] } = {}) {
  const state = { row: JSON.parse(JSON.stringify(event)), todo: todoRow ? { ...todoRow } : null, writes: [] };
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (fn) => fn({ id: 'tx' })),
    query: jest.fn(async (sql, opts = {}) => {
      const q = flat(sql);
      const r = opts.replacements || {};
      if (/^SELECT \* FROM world_events WHERE id = :eventId AND show_id = :showId/.test(q)) {
        return [state.row.id === r.eventId && state.row.show_id === r.showId ? [JSON.parse(JSON.stringify(state.row))] : []];
      }
      if (/^SELECT \* FROM world_events WHERE id = :id/.test(q)) return [[JSON.parse(JSON.stringify(state.row))]];
      if (/FROM wardrobe/.test(q)) return wardrobe;
      if (/^SELECT id, show_id FROM episodes/.test(q)) return [[{ id: r.episodeId, show_id: 'show-1' }]];
      if (/^SELECT id, social_tasks, deleted_at FROM episode_todo_lists/.test(q)) return [state.todo ? [state.todo] : []];
      if (/^UPDATE episode_todo_lists SET social_tasks/.test(q)) {
        state.todo = { ...state.todo, social_tasks: JSON.parse(r.tasks) };
        state.writes.push('todo');
        return [[], 1];
      }
      if (/^INSERT INTO episode_todo_lists/.test(q)) {
        state.todo = { id: r.id, social_tasks: JSON.parse(r.tasks), deleted_at: null };
        state.writes.push('todo-insert');
        return [[], 1];
      }
      if (/^UPDATE world_events SET canon_consequences/.test(q)) {
        const cc = state.row.canon_consequences || {};
        state.row.canon_consequences = { ...cc, documents: { ...(cc.documents || {}), [r.type]: JSON.parse(r.doc) } };
        state.writes.push(r.type);
        return [[], 1];
      }
      return opts.type === 'SELECT' ? [] : [[], 0];
    }),
  };
  const CareerGoal = { findAll: jest.fn(async () => [{ id: 'g-1', title: 'Land a brand partnership', description: '', priority: 1 }]) };
  return { models: { sequelize, CareerGoal }, state };
}

const ids = { showId: 'show-1', eventId: 'ev-1' };
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', prestige: 3, canon_consequences: {} };
const LOOK = { state: 'event', total: 640, pieces: [{ id: 'p-heels', name: 'Gold heels', category: 'shoes', charge: { amount: 240 } }, { id: 'p-dress', name: 'Slip dress', category: 'dress', charge: { amount: 400 } }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockLook.current = null;
  mockOverlay.current = null;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  todo.generateTasks.mockResolvedValue([
    { slot: 'dress', label: 'Pick up the Slip dress', required: true, piece_id: 'p-dress' },
    { slot: 'shoes', label: 'Pick up the Gold heels', required: true, piece_id: 'p-heels' },
  ]);
  todo.generateCareerTasks.mockResolvedValue([
    { slot: 'a', label: 'Pitch the Sable team', task_source: 'goal', goal_id: 'g-1' },
    { slot: 'b', label: 'Snap the florals', task_source: 'optional' },
    { slot: 'c', label: 'Thank the host', task_source: 'goal' },
    { slot: 'd', label: 'Post a story', task_source: 'goal' },
  ]);
});
afterEach(() => jest.restoreAllMocks());

describe('the look the shopping list was drafted from', () => {
  test('a draft records the look; a changed look reads as changed; Keep takes the new look', async () => {
    mockLook.current = LOOK;
    const { models, state } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(doc.look_key).toBe('p-dress,p-heels');
    expect(doc.items[0].piece_id).toBe('p-dress');
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(false);

    mockLook.current = { ...LOOK, pieces: [LOOK.pieces[0]] };
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(true);

    const kept = await svc.keepListForLook(models, ids);
    expect(kept).toMatchObject({ version: 1, look_key: 'p-heels' });
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(false);
    expect(state.row.canon_consequences.documents.shopping_list.version).toBe(1);
  });

  test('Redraft within budget hands the writer her balance and the look\'s total', async () => {
    mockLook.current = LOOK;
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list', budget: true });
    expect(todo.generateTasks).toHaveBeenCalledWith(expect.any(Object), { look: LOOK, budget: { balance: 300, total: 640 } });
  });
});

describe('amount checks', () => {
  test('a shopping line naming a price no piece costs is flagged; an edit is checked too, never refused', async () => {
    mockLook.current = LOOK;
    todo.generateTasks.mockResolvedValueOnce([{ slot: 'shoes', label: 'Gold heels for 999 coins' }]);
    const { models } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(doc.checks.amounts).toEqual({ ok: false, invented: [999] });
    const edited = await svc.editDocument(models, { ...ids, type: 'shopping_list', items: [{ slot: 'shoes', label: 'Gold heels, 240 coins' }], note: '  wear them twice ' });
    expect(edited.checks.amounts.ok).toBe(true);
    expect(edited.note).toBe('wear them twice');
  });

  test('an offer letter naming an amount its terms do not state is flagged', () => {
    const terms = [{ key: 'fees', title: 'Compensation', lines: [{ label: 'Appearance fee', detail: '', amount: 500 }] }];
    expect(svc.documentChecks('offer_letter', [], { terms, letter: { opening: 'We offer 2,000 coins.' } }).amounts).toEqual({ ok: false, invented: [2000] });
    expect(svc.documentChecks('offer_letter', [], { terms, letter: { opening: 'A fee of 500 Prime Coins.' } }).amounts.ok).toBe(true);
  });
});

describe('restore and re-roll one line', () => {
  test('restore makes an earlier version current again, as a new draft version', async () => {
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    await svc.editDocument(models, { ...ids, type: 'shopping_list', items: [{ slot: 'shoes', label: 'Mine' }] });
    const back = await svc.restoreDocument(models, { ...ids, type: 'shopping_list', fromVersion: 1 });
    expect(back).toMatchObject({ version: 3, status: 'draft', source: 'restored', restored_from: 1 });
    expect(back.items.map((i) => i.label)).toEqual(['Pick up the Slip dress', 'Pick up the Gold heels']);
    expect(back.history.map((h) => h.version)).toEqual([2, 1]);
    await expect(svc.restoreDocument(models, { ...ids, type: 'shopping_list', fromVersion: 9 })).rejects.toMatchObject({ status: 404 });
  });

  test('a line re-roll changes that line only, as a new version', async () => {
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    todo.redraftDocumentLine.mockResolvedValueOnce({ label: 'Heels that outshine the chandelier', description: 'Gold' });
    const doc = await svc.redraftLine(models, { ...ids, type: 'shopping_list', index: 1 });
    expect(doc).toMatchObject({ version: 2, source: 'line_redraft' });
    expect(doc.items.map((i) => i.label)).toEqual(['Pick up the Slip dress', 'Heels that outshine the chandelier']);
    expect(doc.items[1].piece_id).toBe('p-heels');
  });

  test('only a shopping list re-words one line', async () => {
    const { models } = fakeModels(EVENT);
    await expect(svc.redraftLine(models, { ...ids, type: 'offer_letter', index: 0 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('the offer letter (Evoni, 2026-10-24)', () => {
  const DEAL = { ...EVENT, name: 'Maison Rue Launch', host_brand: 'Maison Rue', deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true };

  test('a deal event drafts a letter with the terms it was written with; the terms section comes live from the deal', async () => {
    const { models } = fakeModels(DEAL);
    const doc = await svc.draftDocument(models, { ...ids, type: 'offer_letter' });
    expect(doc).toMatchObject({ type: 'offer_letter', status: 'draft', version: 1, items: [], letter_source: 'claude' });
    expect(doc.letter.sender_title).toBe('Founder, Maison Rue');
    expect(typeof doc.terms_key).toBe('string');
    const got = await svc.getDocuments(models, ids);
    expect(got.offer_eligible).toBe(true);
    expect(got.offer_terms_changed).toBe(false);
    const titles = got.offer_terms.map((t) => t.title);
    expect(titles).toEqual(['Compensation', 'Deliverables', 'Covered']);
    expect(got.offer_terms[0].lines).toEqual([{ label: 'Appearance fee', detail: '', amount: 500 }]);
  });

  test('a deal changed after drafting reads "terms changed"', async () => {
    const { models, state } = fakeModels(DEAL);
    await svc.draftDocument(models, { ...ids, type: 'offer_letter' });
    state.row.appearance_fee = 750;
    expect((await svc.getDocuments(models, ids)).offer_terms_changed).toBe(true);
  });

  test('her own words are a new version, checked against the terms; an empty letter is refused', async () => {
    const { models } = fakeModels(DEAL);
    await svc.draftDocument(models, { ...ids, type: 'offer_letter' });
    const edited = await svc.editDocument(models, { ...ids, type: 'offer_letter', letter: { opening: 'We offer you 999 coins.', opportunity: 'Front the launch.' } });
    expect(edited).toMatchObject({ version: 2, source: 'edited', letter_source: 'edited' });
    expect(edited.checks.amounts).toEqual({ ok: false, invented: [999] });
    expect(edited.letter.greeting).toBe('');
    await expect(svc.editDocument(models, { ...ids, type: 'offer_letter', letter: { opening: ' ' } })).rejects.toMatchObject({ status: 400 });
    await expect(svc.editDocument(models, { ...ids, type: 'offer_letter', items: [] })).rejects.toMatchObject({ status: 400 });
    const back = await svc.restoreDocument(models, { ...ids, type: 'offer_letter', fromVersion: 1 });
    expect(back.letter.opening).toMatch(/pleased to offer/);
  });

  test('approving draws its overlay and, once the event has an episode, places it on beat 5, directly after the invitation', async () => {
    mockOverlay.current = { asset_id: 'ov-1', url: 'https://x/offer.png', version: 1, terms_key: 'k' };
    const { models } = fakeModels({ ...DEAL, used_in_episode_id: 'ep-1' });
    await svc.draftDocument(models, { ...ids, type: 'offer_letter' });
    const approved = await svc.approveDocument(models, { ...ids, type: 'offer_letter' });
    expect(approved.overlay.asset_id).toBe('ov-1');
    expect(beats.placeOverlayOnBeat).toHaveBeenCalledWith(models, expect.objectContaining({
      episodeId: 'ep-1', assetId: 'ov-1', label: 'Offer letter', canonicalBeat: expect.objectContaining({ number: 5 }), offsetSeconds: 5,
    }));
  });

  test('before Start Episode the approval places nothing', async () => {
    mockOverlay.current = { asset_id: 'ov-1', url: 'https://x/offer.png', version: 1 };
    const { models } = fakeModels(DEAL);
    await svc.draftDocument(models, { ...ids, type: 'offer_letter' });
    await svc.approveDocument(models, { ...ids, type: 'offer_letter' });
    expect(beats.placeOverlayOnBeat).not.toHaveBeenCalled();
  });
});

describe('closet suggestions', () => {
  test('her own pieces for lines the look does not fill with one of hers', async () => {
    mockLook.current = LOOK;
    const { models } = fakeModels(EVENT, { wardrobe: [
      { id: 'w1', name: 'Silver sandals', clothing_category: 'heels', thumbnail_url: 'https://x/w1.png' },
      { id: 'w2', name: 'Red gown', clothing_category: 'gown' },
      { id: 'p-heels', name: 'Gold heels', clothing_category: 'shoes' },
      { id: 'w3', name: 'Cap', clothing_category: 'zzz' },
    ] });
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    const { closet } = await svc.getDocuments(models, ids);
    expect(closet.shoes).toEqual([{ id: 'w1', name: 'Silver sandals', image_url: 'https://x/w1.png' }]);
    expect(closet.dress.map((p) => p.id)).toEqual(['w2']);
  });
});
