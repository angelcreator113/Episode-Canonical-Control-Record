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

// The scene image paths: the brief, scene-set and venue generation, the
// description writer whose text becomes the place's description, and Scene
// Studio's objects and backgrounds (S4 extended, Evoni 2026-10-01).
const SOURCES = [
  'src/services/sceneBriefService.js',
  'src/services/sceneGenerationService.js',
  'src/services/venueGenerationService.js',
  'src/routes/sceneSetRoutes.js',
  'src/services/objectGenerationService.js',
  'src/controllers/sceneStudioController.js',
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
  /warm neutrals|pastel glow|warm tones/i,
  /studio lighting/i,
];

describe('S4: no generic style or lighting in scene image prompts', () => {
  test.each(SOURCES)('%s sends none', (rel) => {
    const src = read(rel);
    const found = GENERIC.filter((re) => re.test(src)).map(String);
    expect(found).toEqual([]);
  });

  test('Scene Studio: an object is what was asked for, with neutral light; a background has no house style', () => {
    const { buildObjectPrompt, buildScenePrompt } = require('../../../src/services/objectGenerationService');
    const obj = buildObjectPrompt('a brass floor lamp', 'art deco');
    expect(obj).toContain('Object: a brass floor lamp.');
    expect(obj).toContain('Additional style: art deco.');
    expect(obj).toContain('Even, neutral lighting with no colour cast.');
    expect(obj).not.toMatch(/feminine|pinterest|blush|pastel|magical/i);
    const bg = buildScenePrompt('a rooftop terrace at night');
    expect(bg).toBe('Scene: a rooftop terrace at night. Wide establishing shot, cinematic composition, no people, no text, no UI elements. Photographic quality, 16:9 aspect ratio, high resolution.');
  });

  test('the style anchor, angle modifiers and venue look-up are gone', () => {
    const gen = require('../../../src/services/sceneGenerationService');
    expect(gen.LALAVERSE_VISUAL_ANCHOR).toBeUndefined();
    expect(gen.ANGLE_MODIFIERS).toBeUndefined();
    expect(require('../../../src/services/venueGenerationService').buildVenueIdentity).toBeUndefined();
  });
});
