/**
 * Visual Memory phase 3 (services/mediaVariations): what a variation asks
 * the image tool for, what it carries over from its original, and what it
 * tells Evoni to check before approving it.
 */
const v = require('../../../src/services/mediaVariations');

describe('mediaVariations', () => {
  test('a request needs a known change, something to change to, and known locks', () => {
    expect(v.normalizeRequest({ change: { kind: 'time', text: ' early  morning ' }, locks: ['face', 'face', 'location'] }))
      .toEqual({ kind: 'time', text: 'early morning', characterId: null, locks: ['face', 'location'] });
    expect(() => v.normalizeRequest({ change: { kind: 'paint', text: 'x' } })).toThrow(/must be one of/);
    expect(() => v.normalizeRequest({ change: { kind: 'object', text: '' } })).toThrow(/what it should become/);
    expect(() => v.normalizeRequest({ change: { kind: 'object', text: 'a tea cup' }, locks: ['mood'] })).toThrow(/Locks are/);
    expect(() => v.normalizeRequest({ change: { kind: 'add_character', text: '' } })).toThrow(/Choose who to add/);
  });

  test('an object cannot change while the props are locked', () => {
    expect(() => v.normalizeRequest({ change: { kind: 'object', text: 'a tea cup' }, locks: ['props'] })).toThrow(/props are locked/);
    expect(v.normalizeRequest({ change: { kind: 'object', text: 'a tea cup' }, locks: ['face', 'location'] }).locks).toEqual(['face', 'location']);
  });

  test('the prompt asks for one change and keeps every locked thing as it is', () => {
    const prompt = v.buildPrompt(
      { kind: 'object', text: 'a tea cup instead of the bread bowl', locks: ['face', 'wardrobe', 'location'] },
      { details: { objects: ['ceramic bowl', 'flour'] } },
    );
    expect(prompt).toContain('Edit this photograph');
    expect(prompt).toContain('Change the object: a tea cup instead of the bread bowl.');
    expect(prompt).toContain('the same face, skin, hair, body and identity');
    expect(prompt).toContain('Keep every outfit');
    expect(prompt).toContain('Keep the place exactly as it is');
    expect(prompt).not.toContain('Keep the key objects');
    expect(prompt).toContain('No text, no logos, no real brands.');
    const props = v.buildPrompt({ kind: 'time', text: 'dusk', locks: ['props'] }, { details: { objects: ['ceramic bowl'] } });
    expect(props).toContain('Keep the key objects exactly as they are: ceramic bowl.');
  });

  test('adding a character names them, points at their portraits and gives their approved look', () => {
    const prompt = v.buildPrompt(
      { kind: 'add_character', text: 'at the table', locks: ['face'] },
      { added: { name: 'Sable', look: '- hair: short silver locs', portraits: true } },
    );
    expect(prompt).toContain('Add Sable to the scene: at the table.');
    expect(prompt).toContain('reference portrait images that follow the first image');
    expect(prompt).toContain('short silver locs');
  });

  test('every variation waits for review, with what to check', () => {
    expect(v.reviewFor({ kind: 'add_character', locks: ['face'] }, { pictured: 1 }).reasons).toEqual([
      'A person was added: check they match their approved portraits.',
      'Faces were locked: check everyone already there still looks like themselves.',
    ]);
    expect(v.reviewFor({ kind: 'framing', locks: ['face', 'wardrobe'] }, { pictured: 1 }).reasons).toEqual(['The framing changed: check the outfit is still the approved one.']);
    expect(v.reviewFor({ kind: 'time', locks: ['face', 'wardrobe', 'location'] }, { pictured: 0 }).reasons)
      .toEqual(['The light changed: check the place still reads as their established location.']);
    expect(v.reviewFor({ kind: 'object', locks: [] }, { pictured: 2 }).reasons).toEqual([
      'Faces were not locked: check every person is still who they are.',
      'Wardrobe was not locked: check the outfits.',
    ]);
    expect(v.reviewFor({ kind: 'object', locks: ['face', 'wardrobe', 'location'] }, { pictured: 0 })).toEqual({
      locks: ['face', 'wardrobe', 'location'], needs_review: true, reasons: ['Check it matches the original everywhere except what was changed.'],
    });
  });

  test('it carries its original\'s tags but not the posts that use the original, and tags an added character', () => {
    const links = [
      { entity_type: 'character', entity_id: 'c-1', role: 'pictured' },
      { entity_type: 'scene_set', entity_id: 's-1', role: 'location' },
      { entity_type: 'post', entity_id: 'p-1', role: 'owner' },
    ];
    expect(v.tagsFor(links, null)).toEqual([
      { entity_type: 'character', entity_id: 'c-1', role: 'pictured' },
      { entity_type: 'scene_set', entity_id: 's-1', role: 'location' },
    ]);
    expect(v.tagsFor(links, { id: 'c-2' }).at(-1)).toEqual({ entity_type: 'character', entity_id: 'c-2', role: 'pictured' });
    expect(v.tagsFor(links, { id: 'c-1' })).toHaveLength(2);
  });

  test('its details are the original\'s with the change noted', () => {
    const parent = { objects: ['ceramic bowl'], time_of_day: 'noon', camera_angle: 'wide' };
    expect(v.detailsFor(parent, { kind: 'time', text: 'dusk' })).toMatchObject({ objects: ['ceramic bowl'], time_of_day: 'dusk', notes: 'Variation (time): dusk' });
    expect(v.detailsFor(parent, { kind: 'framing', text: 'close-up' }).camera_angle).toBe('close-up');
    expect(v.detailsFor({}, { kind: 'add_character', text: '' }, { name: 'Sable' }).notes).toBe('Variation: Sable added');
  });
});
