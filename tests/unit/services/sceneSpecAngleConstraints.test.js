/**
 * The spec lines an angle's prompt carries (audit of the Scene Sets page,
 * 2026-10-15): the angle's own contract, matched exactly before by
 * containment; no demanded text (the brief forbids text in the image) and no
 * "Do NOT include" list (the image model reads it as a mention and adds it).
 */
const { buildAngleConstraints } = require('../../../src/services/sceneSpecService');

const spec = {
  objects: [
    { id: 'rail', label: 'Clothes rail', description: 'brass rail', continuity: { locked_color: 'brass' } },
    { id: 'sign', label: 'Neon sign', description: 'pink neon script', continuity: { locked_text: 'Lala' } },
    { id: 'bed', label: 'Bed', description: 'velvet bed' },
    { id: 'lamp', label: 'Lamp', description: 'glass lamp' },
  ],
  camera_contracts: [
    { angle: 'CLOSE', required: ['lamp'] },
    { angle: 'CLOSET', required: ['rail', 'sign'], expected: ['lamp'], out_of_frame: ['bed'] },
  ],
};

describe('buildAngleConstraints', () => {
  test('CLOSET takes its own contract, not CLOSE listed first', () => {
    const text = buildAngleConstraints(spec, 'CLOSET');
    expect(text).toContain('Clothes rail: brass rail Color: brass.');
    expect(text).not.toContain('Lamp: glass lamp');
    expect(text).toContain('Should also show: Lamp.');
  });

  test('a label containing a contract\'s name still finds it', () => {
    expect(buildAngleConstraints(spec, 'CLOSE_UP')).toContain('Lamp: glass lamp');
  });

  test('no demanded text and no "Do NOT include" list', () => {
    const text = buildAngleConstraints(spec, 'CLOSET');
    expect(text).toContain('Neon sign: pink neon script');
    expect(text).not.toMatch(/Text reads exactly|Lala/);
    expect(text).not.toMatch(/Do NOT include|Bed/);
  });
});
