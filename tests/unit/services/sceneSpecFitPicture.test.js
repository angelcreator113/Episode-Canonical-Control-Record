/**
 * Evoni, 2026-10-07: "still trying to do 8 of the wrong angle". The spec
 * prompt told every Home Base set to plan 4-8 angles of "the room", so the
 * outside of Lala's house got bedroom angles, and generateAngle cropped a
 * fixed bedroom box (VANITY = the right side) out of any set's picture.
 * Now the spec says whether the picture is an interior or an exterior, plans
 * only angles the picture holds, and gives each shot's frame in THIS picture;
 * an angle is cropped only by that frame.
 */
const { buildSpecPrompt, contractFrame } = require('../../../src/services/sceneSpecService');

describe('the spec prompt plans angles that fit the picture', () => {
  test('a home base: as many angles as the picture supports, exterior angles for an exterior', () => {
    const p = buildSpecPrompt({ name: "Lala's home", scene_type: 'HOME_BASE' });
    expect(p).not.toContain('Create 4-8 camera angles covering different parts of the room.');
    expect(p).toContain('only as many as this picture supports');
    expect(p).toMatch(/For an EXTERIOR[^.]*every angle must be of the outside/);
    expect(p).toContain('never plan a bed, vanity, closet or other interior angle the picture does not show');
  });

  test('every spec says what the picture shows, and each shot its frame in it', () => {
    const p = buildSpecPrompt({ name: 'Gala hall', scene_type: 'EVENT_LOCATION' });
    expect(p).toContain('"view": "interior | exterior | mixed"');
    expect(p).toContain('"frame": { "left": 0.0, "top": 0.0, "width": 1.0, "height": 1.0 }');
    expect(p).toMatch(/set "frame": null when the shot looks somewhere the picture does not show/);
  });
});

describe('contractFrame: the part of the set\'s picture a shot covers', () => {
  const spec = {
    camera_contracts: [
      { angle: 'VANITY', frame: { left: 0.6, top: 0.1, width: 0.4, height: 0.8 } },
      { angle: 'Front door', frame: { left: '0.2', top: '0.3', width: '0.5', height: '0.6' } },
      { angle: 'BEHIND', frame: null },
      { angle: 'TINY', frame: { left: 0.5, top: 0.5, width: 0.05, height: 0.5 } },
      { angle: 'OUTSIDE', frame: { left: 0.8, top: 0, width: 0.5, height: 1 } },
    ],
  };

  test('the matching contract\'s frame, numbers read from strings too', () => {
    expect(contractFrame(spec, 'VANITY')).toEqual({ left: 0.6, top: 0.1, width: 0.4, height: 0.8 });
    expect(contractFrame(spec, 'FRONT_DOOR')).toEqual({ left: 0.2, top: 0.3, width: 0.5, height: 0.6 });
  });

  test('no frame, a box too small or outside the picture, no contract, no spec: null', () => {
    expect(contractFrame(spec, 'BEHIND')).toBeNull();
    expect(contractFrame(spec, 'TINY')).toBeNull();
    expect(contractFrame(spec, 'OUTSIDE')).toBeNull();
    expect(contractFrame(spec, 'WINDOW')).toBeNull();
    expect(contractFrame(null, 'VANITY')).toBeNull();
    expect(contractFrame({ camera_contracts: { WIDE: {} } }, 'WIDE')).toBeNull();
  });
});
