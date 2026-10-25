/**
 * Event documents PR 3: Start Episode carries the event's approved shopping
 * list into the episode; a draft is never carried. (The career plan, whose
 * lines were carried too, was replaced by the offer letter on 2026-10-24.)
 */
const { approvedDocument, shoppingListTasks } = require('../../../src/services/eventDocumentsService');

const list = (status) => ({
  type: 'shopping_list', status, version: 3,
  items: [
    { slot: 'dress', label: 'The pink satin gown', description: 'Black tie', required: true },
    { slot: 'purse', label: 'A crystal clutch', description: '', required: false },
  ],
});
const event = (docs) => ({ canon_consequences: JSON.stringify({ documents: docs }) });

describe('approvedDocument', () => {
  test('an approved document is returned; a draft, an empty one or none is not', () => {
    expect(approvedDocument(event({ shopping_list: list('approved') }), 'shopping_list')).toMatchObject({ version: 3 });
    expect(approvedDocument(event({ shopping_list: list('draft') }), 'shopping_list')).toBeNull();
    expect(approvedDocument(event({ shopping_list: { ...list('approved'), items: [] } }), 'shopping_list')).toBeNull();
    expect(approvedDocument(event({}), 'offer_letter')).toBeNull();
    expect(approvedDocument({ canon_consequences: null }, 'offer_letter')).toBeNull();
  });

  test('an offer letter counts as approved by its words, not by lines', () => {
    const letter = { type: 'offer_letter', status: 'approved', version: 1, items: [], letter: { opening: 'We are pleased to offer you a partnership.' } };
    expect(approvedDocument(event({ offer_letter: letter }), 'offer_letter')).toMatchObject({ version: 1 });
    expect(approvedDocument(event({ offer_letter: { ...letter, letter: { opening: '', opportunity: '' } } }), 'offer_letter')).toBeNull();
    expect(approvedDocument(event({ offer_letter: { ...letter, status: 'draft' } }), 'offer_letter')).toBeNull();
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
