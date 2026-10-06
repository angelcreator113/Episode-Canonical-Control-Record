/**
 * Event documents PR 3: Start Episode carries the event's approved shopping
 * list and career plan into the episode; a draft is never carried.
 */
const { approvedDocument, shoppingListTasks, careerPlanGoals } = require('../../../src/services/eventDocumentsService');

const list = (status) => ({
  type: 'shopping_list', status, version: 3,
  items: [
    { slot: 'dress', label: 'The pink satin gown', description: 'Black tie', required: true },
    { slot: 'purse', label: 'A crystal clutch', description: '', required: false },
  ],
});
const plan = {
  type: 'career_plan', status: 'approved', version: 2,
  items: [
    { slot: 'net_1', label: 'Meet the Maison Rue buyer', description: '', section: 'this_event' },
    { slot: 'goal_1', label: 'Land a brand partnership', description: '', section: 'bigger_goals', goal_id: 'g-1' },
    { slot: 'item_3', label: 'Post the look before midnight', description: '' },
  ],
};
const event = (docs) => ({ canon_consequences: JSON.stringify({ documents: docs }) });

describe('approvedDocument', () => {
  test('an approved document is returned; a draft, an empty one or none is not', () => {
    expect(approvedDocument(event({ shopping_list: list('approved') }), 'shopping_list')).toMatchObject({ version: 3 });
    expect(approvedDocument(event({ shopping_list: list('draft') }), 'shopping_list')).toBeNull();
    expect(approvedDocument(event({ shopping_list: { ...list('approved'), items: [] } }), 'shopping_list')).toBeNull();
    expect(approvedDocument(event({}), 'career_plan')).toBeNull();
    expect(approvedDocument({ canon_consequences: null }, 'career_plan')).toBeNull();
  });
});

describe('shoppingListTasks', () => {
  test('each line is a wardrobe task in order, unfilled, tagged with its document', () => {
    expect(shoppingListTasks(list('approved'))).toEqual([
      { slot: 'dress', label: 'The pink satin gown', description: 'Black tie', required: true, completed: false, order: 1, from_event_document: { type: 'shopping_list', version: 3 } },
      { slot: 'purse', label: 'A crystal clutch', description: '', required: false, completed: false, order: 2, from_event_document: { type: 'shopping_list', version: 3 } },
    ]);
  });
});

describe('careerPlanGoals', () => {
  test('only the "This event" lines become goals, never required; bigger goals stay on the event', () => {
    const goals = careerPlanGoals(plan);
    expect(goals.map((g) => g.label)).toEqual(['Meet the Maison Rue buyer', 'Post the look before midnight']);
    expect(goals[0]).toEqual({
      slot: 'plan_net_1', label: 'Meet the Maison Rue buyer', description: '', timing: 'during', platform: null,
      task_source: 'goal', required: false, completed: false, from_event_document: { type: 'career_plan', version: 2 },
    });
  });
});
