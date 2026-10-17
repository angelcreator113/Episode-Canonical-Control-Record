'use strict';

/**
 * LalaVerse social is The Pulse (Evoni, 2026-10-17: "seems the generator
 * still uses other social medias but lalaverse social media is The Pulse"),
 * the AI mocked:
 * - a new character is on The Pulse unless their world is JustAWoman's
 *   (Before Lala, Book 1, real world), even when the world's name does not
 *   say "Lala"; their social-presence and feed-profile prompts then offer
 *   only The Pulse;
 * - a synced profile's leverage line names The Pulse's accounts.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const { onPulseFor, generateFullCharacter } = require('../../../src/services/characterGenerationService');
const { generateSocialLeverage } = require('../../../src/services/registrySyncService');

const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const prompts = () => mockCreate.mock.calls.map((c) => c[0].messages[0].content);

describe('onPulseFor', () => {
  test.each([
    [null, null, true],
    [{ name: 'Dazzle District' }, null, true],
    [{ name: 'The LalaVerse' }, null, true],
    [{ name: 'Before Lala' }, null, false],
    [{ name: 'Book 1: the real one' }, null, false],
    [{ name: 'Atlanta', description: 'JustAWoman\'s real world' }, null, false],
    [{ name: 'Before Lala' }, 'lalaverse', true],
    [{ name: 'Dazzle District' }, 'real_world', false],
  ])('%j, layer %s → %s', (world, layer, expected) => {
    expect(onPulseFor(world, layer)).toBe(expected);
  });
});

describe('a new character\'s social', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply({ social_presence: true, inferred_platform: 'pulse', handle: 'nia', platform: 'pulse', members: [], family: [] }));
  });

  test('a LalaVerse world not named "Lala" asks about The Pulse only', async () => {
    await generateFullCharacter({ spark: { name: 'Nia', vibe: 'painter', role: 'friend' }, worldContext: { name: 'Dazzle District', description: 'a city' } });
    const presence = prompts().find((p) => p.includes('inferred_platform'));
    expect(presence).toContain('"pulse OR none"');
    expect(presence).not.toMatch(/instagram OR|tiktok OR/i);
    expect(presence).toContain('do not exist here');
    const feed = prompts().find((p) => p.includes('Generate their social media profile'));
    expect(feed).toContain('"platform": "pulse"');
    expect(feed).toContain('THE PULSE (LalaVerse rule)');
  });

  test('JustAWoman\'s world keeps real apps', async () => {
    await generateFullCharacter({ spark: { name: 'Dee', vibe: 'mom', role: 'friend' }, worldContext: { name: 'Before Lala' } });
    expect(prompts().find((p) => p.includes('inferred_platform'))).toContain('instagram OR tiktok');
  });
});

describe('generateSocialLeverage', () => {
  test('names The Pulse\'s accounts, never a real app', () => {
    const line = generateSocialLeverage({ follower_tier: 'micro', platform_presences: { pulse: {}, pulse_private: {} } });
    expect(line).toContain('dual presence on The Pulse and a private Pulse account');
  });
});
