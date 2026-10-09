/**
 * eventDocumentsService — the Event Package's shopping list and career plan
 * beside the invitation (Evoni, 2026-10-06): Draft, Edit, Redraft, Approve,
 * stored in the event's canon_consequences.documents.
 */
jest.mock('../../../src/services/todoListService', () => ({
  generateTasks: jest.fn(),
  generateCareerTasks: jest.fn(),
}));

const todo = require('../../../src/services/todoListService');
const svc = require('../../../src/services/eventDocumentsService');
const { withoutServerOwnedKeys } = require('../../../src/utils/eventTermsLock');

// An in-memory world_events row: SELECT returns it, the UPDATE merges the
// document into its canon_consequences the way the SQL does.
function fakeModels(event) {
  const row = { ...event };
  const sequelize = {
    query: jest.fn(async (sql, { replacements }) => {
      if (/^SELECT/.test(sql.trim())) {
        return [row.id === replacements.eventId && row.show_id === replacements.showId ? [JSON.parse(JSON.stringify(row))] : []];
      }
      const cc = row.canon_consequences || {};
      row.canon_consequences = { ...cc, documents: { ...(cc.documents || {}), [replacements.type]: JSON.parse(replacements.doc) } };
      return [[], 1];
    }),
  };
  const CareerGoal = { findAll: jest.fn(async () => [{ id: 'g-1', title: 'Land a brand partnership', description: '', priority: 1 }]) };
  return { models: { sequelize, CareerGoal }, row };
}

const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', canon_consequences: { invitation_text: 'Dearest Lala', terms_history: [] } };
const ids = { showId: 'show-1', eventId: 'ev-1' };

beforeEach(() => {
  jest.clearAllMocks();
  todo.generateTasks.mockResolvedValue([
    { slot: 'dress', label: 'Find a showstopper', description: 'Tonight matters', required: true },
    { slot: 'purse', label: 'Find a clutch', description: '', required: false },
    { slot: 'empty', label: '   ' },
  ]);
  todo.generateCareerTasks.mockResolvedValue([
    { slot: 'net_1', label: 'Follow up with STUDIO BY SABLE', description: 'A warm intro', required: false },
  ]);
});

describe('eventDocumentsService', () => {
  test('nothing is drafted yet: both documents are null', async () => {
    const { models } = fakeModels(EVENT);
    const docs = await svc.getDocuments(models, ids);
    expect(docs).toMatchObject({ shopping_list: null, career_plan: null, deliverables: [] });
    // The look the shopping list adds up comes with the documents (Task #2787).
    expect(docs).toHaveProperty('look');
    expect(docs).toHaveProperty('balance');
  });

  test('a shopping list drafts from the episode list writer, as a draft, version 1', async () => {
    const { models, row } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(todo.generateTasks).toHaveBeenCalledWith(expect.objectContaining({ id: 'ev-1' }));
    expect(doc).toMatchObject({ type: 'shopping_list', status: 'draft', version: 1, source: 'draft', history: [] });
    expect(doc.items.map((i) => i.label)).toEqual(['Find a showstopper', 'Find a clutch']); // the blank label is dropped
    expect(doc.items[0]).toEqual({ slot: 'dress', label: 'Find a showstopper', description: 'Tonight matters', required: true });
    // The rest of canon_consequences is left as it was.
    expect(row.canon_consequences.invitation_text).toBe('Dearest Lala');
    expect(row.canon_consequences.documents.shopping_list.version).toBe(1);
  });

  test('a career plan holds this event\'s goals and her active career goals', async () => {
    const { models } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    expect(doc.items).toEqual([
      { slot: 'net_1', label: 'Follow up with STUDIO BY SABLE', description: 'A warm intro', required: false, section: 'this_event' },
      { slot: 'goal_1', label: 'Land a brand partnership', description: '', required: false, section: 'bigger_goals', goal_id: 'g-1' },
    ]);
    expect(models.CareerGoal.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { show_id: 'show-1', status: 'active' } }));
  });

  test('edit, approve, redraft: each a version, the replaced one kept in history', async () => {
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    const edited = await svc.editDocument(models, { ...ids, type: 'shopping_list', items: [{ label: 'Gold heels', slot: 'shoes' }] });
    expect(edited).toMatchObject({ status: 'draft', version: 2, source: 'edited' });
    expect(edited.items).toEqual([{ slot: 'shoes', label: 'Gold heels', description: '', required: false }]);
    expect(edited.history.map((h) => h.version)).toEqual([1]);
    expect(edited.history[0].history).toBeUndefined();

    const approved = await svc.approveDocument(models, { ...ids, type: 'shopping_list' });
    expect(approved).toMatchObject({ status: 'approved', version: 2 });
    expect(approved.approved_at).toEqual(expect.any(String));

    const redrafted = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(redrafted).toMatchObject({ status: 'draft', version: 3, source: 'draft', approved_at: null });
    expect(redrafted.history.map((h) => [h.version, h.status])).toEqual([[2, 'approved'], [1, 'draft']]);
  });

  test('history keeps the last ten versions', () => {
    let doc = null;
    for (let i = 0; i < 14; i += 1) doc = svc.nextVersion(doc, 'shopping_list', { items: [] });
    expect(doc.version).toBe(14);
    expect(doc.history).toHaveLength(svc.HISTORY_MAX);
    expect(doc.history[0].version).toBe(13);
  });

  test('refusals: an unknown document, editing or approving before a draft, an empty edit, a missing event', async () => {
    const { models } = fakeModels(EVENT);
    await expect(svc.draftDocument(models, { ...ids, type: 'invoice' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.editDocument(models, { ...ids, type: 'career_plan', items: [{ label: 'x' }] })).rejects.toMatchObject({ status: 404 });
    await expect(svc.approveDocument(models, { ...ids, type: 'career_plan' })).rejects.toMatchObject({ status: 404 });
    await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    await expect(svc.editDocument(models, { ...ids, type: 'career_plan', items: [{ label: ' ' }] })).rejects.toMatchObject({ status: 400 });
    await expect(svc.editDocument(models, { ...ids, type: 'career_plan', items: 'nope' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.getDocuments(models, { showId: 'show-1', eventId: 'other' })).rejects.toMatchObject({ status: 404 });
  });

  test('normalizeItems trims, caps at 20 and keeps a career item\'s section', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ label: `Item ${i}`, section: i === 0 ? 'bigger_goals' : 'other' }));
    const out = svc.normalizeItems('career_plan', many);
    expect(out).toHaveLength(20);
    expect(out[0].section).toBe('bigger_goals');
    expect(out[1].section).toBe('this_event');
    expect(svc.normalizeItems('shopping_list', [{ label: 'x'.repeat(300) }])[0].label).toHaveLength(200);
  });

  test('an Event Package save cannot overwrite the documents: the key is server-owned', () => {
    const saved = withoutServerOwnedKeys({ invitation_text: 'Hi', documents: { shopping_list: { version: 1 } } });
    expect(saved).toEqual({ invitation_text: 'Hi' });
  });
});
