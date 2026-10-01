/**
 * Ruling S4 (Evoni, 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "Remove the
 * injected generic instructions ("feminine aesthetic", "soft natural
 * lighting"); lighting comes from the brief." No scene-image source sends
 * a house style or a fixed lighting: the brief (place, event, shot,
 * environment) is the whole prompt.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// The scene image paths: the brief, scene-set and venue generation, and the
// description writer whose text becomes the place's description.
const SOURCES = [
  'src/services/sceneBriefService.js',
  'src/services/sceneGenerationService.js',
  'src/services/venueGenerationService.js',
  'src/routes/sceneSetRoutes.js',
];

// The generic text the review found, and its kin.
const GENERIC = [
  /feminine/i,
  /pinterest/i,
  /soft natural light/i,
  /warm soft natural/i,
  /natural hero lighting/i,
  /soft warm glow/i,
  /soft glamour lighting/i,
  /natural golden light/i,
  /aspirational/i,
  /magical realism/i,
  /final fantasy softness/i,
];

describe('S4: no generic style or lighting in scene image prompts', () => {
  test.each(SOURCES)('%s sends none', (rel) => {
    const src = read(rel);
    const found = GENERIC.filter((re) => re.test(src)).map(String);
    expect(found).toEqual([]);
  });

  test('the style anchor, angle modifiers and venue look-up are gone', () => {
    const gen = require('../../../src/services/sceneGenerationService');
    expect(gen.LALAVERSE_VISUAL_ANCHOR).toBeUndefined();
    expect(gen.ANGLE_MODIFIERS).toBeUndefined();
    expect(require('../../../src/services/venueGenerationService').buildVenueIdentity).toBeUndefined();
  });
});
