/**
 * The spec check of a generated angle (validateAngleAgainstSpec). Before
 * (audit, 2026-10-15) a check that could not run (no key, no contract, an
 * error, an unreadable answer) returned a passing 100, shown on the angle
 * as proof it matched; and the contract was found by substring, so a
 * WIDE_WINDOW angle could be checked against whichever of WIDE or WINDOW
 * came first.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const { validateAngleAgainstSpec, findContract } = require('../../../src/services/sceneSpecService');

const spec = {
  objects: [{ id: 'bed', label: 'Bed', description: 'canopy' }, { id: 'lamp', label: 'Lamp', description: 'brass' }],
  camera_contracts: [
    { angle: 'CLOSE', required: ['lamp'] },
    { angle: 'WIDE', required: ['bed'] },
    { angle: 'WIDE_WINDOW', required: ['lamp'], expected: ['bed'] },
  ],
};
const answer = (json) => ({ content: [{ text: JSON.stringify(json) }] });

describe('validateAngleAgainstSpec', () => {
  const key = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => { if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key; });

  test('a check that cannot run is not checked, never a passing 100', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE')).toMatchObject({ checked: false, score: null, pass: null });
    process.env.ANTHROPIC_API_KEY = 'test-key';
    expect(await validateAngleAgainstSpec('u', spec, 'OVERHEAD')).toMatchObject({ checked: false, score: null, pass: null });

    mockCreate.mockRejectedValueOnce(new Error('overloaded'));
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE')).toMatchObject({ checked: false, score: null, reason: expect.stringMatching(/overloaded/) });
    mockCreate.mockResolvedValueOnce({ content: [{ text: 'no json here' }] });
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE')).toMatchObject({ checked: false, score: null });
    mockCreate.mockResolvedValueOnce(answer({ present: ['bed'] }));
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE')).toMatchObject({ checked: false, score: null });
  });

  test('a check that ran: its score, and a missing required object fails it', async () => {
    mockCreate.mockResolvedValueOnce(answer({ score: 92, present: ['bed'], missing: [], issues: [] }));
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE')).toMatchObject({ checked: true, score: 92, pass: true, missing_required: [] });

    mockCreate.mockResolvedValueOnce(answer({ score: 85, missing: ['lamp'] }));
    expect(await validateAngleAgainstSpec('u', spec, 'WIDE_WINDOW')).toMatchObject({ checked: true, score: 85, pass: false, missing_required: ['lamp'] });
  });

  test('the shot\'s own contract: named exactly, else the longest name the label holds', () => {
    expect(findContract(spec, 'WIDE_WINDOW').angle).toBe('WIDE_WINDOW');
    expect(findContract(spec, 'wide window').angle).toBe('WIDE_WINDOW');
    expect(findContract(spec, 'WIDE').angle).toBe('WIDE');
    expect(findContract(spec, 'WIDE_WINDOW_LEFT').angle).toBe('WIDE_WINDOW');
    expect(findContract(spec, 'CLOSET')).toBeNull();
    expect(findContract(spec, '')).toBeNull();
    expect(findContract(null, 'WIDE')).toBeNull();
  });
});
