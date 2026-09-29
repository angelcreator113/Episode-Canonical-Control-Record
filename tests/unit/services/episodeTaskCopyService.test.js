/**
 * T5 (§8(bb); Task #2304): an edit saved to the episode's copy keeps the
 * completion of every task it still carries.
 */
const { keepCompletion } = require('../../../src/services/episodeTaskCopyService');

describe('keepCompletion', () => {
  const previous = [
    { slot: 'grwm', label: 'GRWM', completed: true },
    { slot: 'arrival', label: 'Arrival', completed: false },
    { slot: 'gone', label: 'Removed', completed: true },
  ];

  test('a carried slot keeps its flag; a new slot keeps its own; a removed slot is gone', () => {
    const next = [
      { slot: 'grwm', label: 'GRWM, edited', completed: false },
      { slot: 'arrival', label: 'Arrival, edited', completed: true },
      { slot: 'new', label: 'New' },
    ];
    expect(keepCompletion(previous, next).map((t) => [t.slot, t.label, t.completed])).toEqual([
      ['grwm', 'GRWM, edited', true],
      ['arrival', 'Arrival, edited', false],
      ['new', 'New', false],
    ]);
  });

  test('reads stored JSON strings and tolerates junk', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(keepCompletion(JSON.stringify(previous), [{ slot: 'grwm' }])[0].completed).toBe(true);
    expect(keepCompletion('not json', [{ slot: 'grwm', completed: true }])[0].completed).toBe(true);
    expect(keepCompletion(null, null)).toEqual([]);
    console.error.mockRestore();
  });
});
