/**
 * services/registryWriteGuard.planRegistryWrite: which registry values a
 * World Studio edit may write (Evoni, 2026-11-04: the Character Registry
 * owns a character's identity).
 */
const { planRegistryWrite } = require('../../../src/services/registryWriteGuard');

const J = { jsonColumns: ['aesthetic_dna'] };

describe('planRegistryWrite', () => {
  test('a changed field the registry still holds as World Studio gave it is written', () => {
    const plan = planRegistryWrite({ core_fear: 'a' }, { core_fear: 'b' }, { core_fear: 'a' });
    expect(plan).toEqual({ set: { core_fear: 'b' }, written: ['core_fear'], conflicts: [] });
  });

  test('a changed field edited in the registry is kept and reported', () => {
    const plan = planRegistryWrite({ core_fear: 'a' }, { core_fear: 'b' }, { core_fear: 'registry' });
    expect(plan.set).toEqual({});
    expect(plan.conflicts).toEqual([{ field: 'core_fear', registry_value: 'registry', world_value: 'b' }]);
  });

  test('a field the edit did not change is never written, whatever the registry holds', () => {
    const plan = planRegistryWrite({ core_fear: 'a', age: 28 }, { core_fear: 'a', age: 28 }, { core_fear: 'registry', age: 40 });
    expect(plan).toEqual({ set: {}, written: [], conflicts: [] });
  });

  test('blank values compare equal, numbers compare to their text', () => {
    expect(planRegistryWrite({ x: null }, { x: 'v' }, { x: '' }).written).toEqual(['x']);
    expect(planRegistryWrite({ age: '28' }, { age: 35 }, { age: 28 }).set).toEqual({ age: 35 });
  });

  test('a cleared registry value is a Registry edit, not a blank to fill', () => {
    const plan = planRegistryWrite({ x: 'old' }, { x: 'new' }, { x: null });
    expect(plan.set).toEqual({});
    expect(plan.conflicts).toEqual([{ field: 'x', registry_value: null, world_value: 'new' }]);
  });

  test('JSON columns are decided key by key, and keys World Studio does not own are kept', () => {
    const prev = { aesthetic_dna: { era_aesthetic: 'a', color_palette: 'black' } };
    const next = { aesthetic_dna: { era_aesthetic: 'b', color_palette: 'red' } };
    const current = { aesthetic_dna: { era_aesthetic: 'a', color_palette: 'gold', registry_note: 'kept' } };
    const plan = planRegistryWrite(prev, next, current, J);
    expect(plan.set).toEqual({ aesthetic_dna: { era_aesthetic: 'b', color_palette: 'gold', registry_note: 'kept' } });
    expect(plan.written).toEqual(['aesthetic_dna.era_aesthetic']);
    expect(plan.conflicts).toEqual([{ field: 'aesthetic_dna.color_palette', registry_value: 'gold', world_value: 'red' }]);
  });

  test('a registry JSON column stored as text is read', () => {
    const plan = planRegistryWrite({ aesthetic_dna: { k: 'a' } }, { aesthetic_dna: { k: 'b' } }, { aesthetic_dna: '{"k":"a"}' }, J);
    expect(plan.set).toEqual({ aesthetic_dna: { k: 'b' } });
  });
});
