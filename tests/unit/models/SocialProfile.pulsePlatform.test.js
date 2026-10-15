/**
 * A LalaVerse feed profile's social is The Pulse (Evoni, 2026-10-15).
 *
 * The SocialProfile hooks put every LalaVerse profile on The Pulse on create
 * and on update, whatever platform the form, generator or import asked for;
 * an adult-content account (OnlyFans) becomes The PlayRoom, another hidden
 * account a private Pulse account. JustAWoman's
 * feed (feed_layer 'real_world') keeps its real apps.
 *
 * No database: the model is defined on an unconnected Sequelize instance
 * and its query interface's insert and update are stubbed to capture the
 * values each would write.
 */
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const appConfig = require(path.join('..', '..', '..', 'src', 'config', 'sequelize.js'));
const pulse = require(path.join('..', '..', '..', 'src', 'utils', 'pulsePlatform.js'));

function defineModel() {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', {
    logging: false,
    define: appConfig.test.define,
  });
  const SocialProfile = require(path.join('..', '..', '..', 'src', 'models', 'SocialProfile.js'))(sequelize, DataTypes);
  const captured = [];
  const qi = SocialProfile.queryInterface;
  qi.insert = jest.fn(async (instance, _table, values) => { captured.push({ op: 'insert', values }); return [instance, 1]; });
  qi.update = jest.fn(async (instance, _table, values) => { captured.push({ op: 'update', values }); return [instance, 1]; });
  return { SocialProfile, captured };
}

const VELVET = {
  handle: '@velvet', vibe_sentence: 'Haul queen.', platform: 'instagram',
  platform_presences: {
    instagram: { handle: '@velvet', persona: 'haul queen', is_primary: true },
    onlyfans: { handle: '@velvet_after', persona: 'the real money', visibility: 'discreet' },
  },
  front_platform: 'instagram', real_platform: 'onlyfans',
};

describe('SocialProfile on The Pulse', () => {
  test('a LalaVerse profile is created on The Pulse, its discreet OnlyFans on The PlayRoom', async () => {
    const { SocialProfile, captured } = defineModel();
    const p = await SocialProfile.create({ ...VELVET, feed_layer: 'lalaverse' });
    expect(p.platform).toBe('pulse');
    expect(p.front_platform).toBe('pulse');
    expect(p.real_platform).toBe('playroom');
    expect(p.platform_presences).toEqual({
      pulse: { handle: '@velvet', persona: 'haul queen', is_primary: true, visibility: 'public' },
      playroom: { handle: '@velvet_after', persona: 'the real money', visibility: 'discreet' },
    });
    const insert = captured.find((c) => c.op === 'insert');
    expect(insert.values).toMatchObject({ platform: 'pulse', front_platform: 'pulse', real_platform: 'playroom' });
  });

  test('a hidden account that is not adult content is a private Pulse account', async () => {
    const { SocialProfile } = defineModel();
    const p = await SocialProfile.create({
      handle: '@mira', vibe_sentence: 'x', feed_layer: 'lalaverse', platform: 'tiktok',
      platform_presences: { tiktok: { handle: '@mira' }, instagram: { handle: '@mira_cf', visibility: 'secret' } },
      front_platform: 'tiktok', real_platform: 'instagram',
    });
    expect(p.platform_presences).toEqual({
      pulse: { handle: '@mira', visibility: 'public', is_primary: true },
      pulse_private: { handle: '@mira_cf', visibility: 'private' },
    });
    expect(p.real_platform).toBe('pulse_private');
  });

  test('an openly adult creator (OnlyFans was their main app) is public on The PlayRoom', async () => {
    const { SocialProfile } = defineModel();
    const p = await SocialProfile.create({
      handle: '@after', vibe_sentence: 'x', feed_layer: 'lalaverse', platform: 'onlyfans',
      platform_presences: { onlyfans: { handle: '@after', is_primary: true } }, front_platform: 'onlyfans', real_platform: 'onlyfans',
    });
    expect(p.platform).toBe('pulse');
    expect(p.front_platform).toBe('playroom');
    expect(p.real_platform).toBe('playroom');
    expect(p.platform_presences).toEqual({
      pulse: { handle: '@after', visibility: 'public', is_primary: true },
      playroom: { handle: '@after', visibility: 'public' },
    });
  });

  test('a LalaVerse profile with no platform at all is created on The Pulse', async () => {
    const { SocialProfile } = defineModel();
    const p = await SocialProfile.create({ handle: '@new', vibe_sentence: 'x', feed_layer: 'lalaverse' });
    expect(p.platform).toBe('pulse');
    expect(p.platform_presences).toEqual({ pulse: { handle: '@new', visibility: 'public', is_primary: true } });
  });

  test('an update that sets a real app on a LalaVerse profile writes The Pulse', async () => {
    const { SocialProfile, captured } = defineModel();
    const p = SocialProfile.build({ id: 5, handle: '@a', vibe_sentence: 'x', feed_layer: 'lalaverse', platform: 'pulse', platform_presences: {} }, { isNewRecord: false });
    await p.update({ platform: 'tiktok' });
    expect(p.platform).toBe('pulse');
    const update = captured.find((c) => c.op === 'update');
    expect(update.values.platform).toBe('pulse');
  });

  test('a row loaded with only some attributes keeps the accounts it never read', async () => {
    const { SocialProfile, captured } = defineModel();
    const p = SocialProfile.build({ id: 6, feed_layer: 'lalaverse', status: 'generated' }, { isNewRecord: false, raw: true });
    await p.update({ status: 'finalized' });
    const update = captured.find((c) => c.op === 'update');
    expect(update.values).not.toHaveProperty('platform_presences');
    expect(update.values).not.toHaveProperty('front_platform');
  });

  test("JustAWoman's real-world feed keeps its real apps", async () => {
    const { SocialProfile } = defineModel();
    const p = await SocialProfile.create({ ...VELVET, feed_layer: 'real_world' });
    expect(p.platform).toBe('instagram');
    expect(p.real_platform).toBe('onlyfans');
    expect(Object.keys(p.platform_presences)).toEqual(['instagram', 'onlyfans']);
  });

  test('a profile already on The Pulse is left as it is', async () => {
    const { SocialProfile } = defineModel();
    const presences = { pulse: { handle: '@a', visibility: 'public', is_primary: true } };
    const p = await SocialProfile.create({ handle: '@a', vibe_sentence: 'x', feed_layer: 'lalaverse', platform: 'pulse', platform_presences: presences, front_platform: 'pulse' });
    expect(p.platform_presences).toEqual(presences);
    expect(p.front_platform).toBe('pulse');
  });
});

describe('pulsePlatform helpers', () => {
  test('platformLabel reads The Pulse, and real apps as themselves', () => {
    expect(pulse.platformLabel('pulse')).toBe('The Pulse');
    expect(pulse.platformLabel('lalaverse')).toBe('The Pulse');
    expect(pulse.platformLabel('pulse_private')).toBe('a private Pulse account');
    expect(pulse.platformLabel('playroom')).toBe('The PlayRoom');
    expect(pulse.platformLabel('instagram')).toBe('instagram');
    expect(pulse.platformLabel(null)).toBeNull();
  });

  test('an adult real-money app with no presence entry still gets a PlayRoom account', () => {
    const out = pulse.toPulsePresences({ platform: 'instagram', front_platform: 'instagram', real_platform: 'onlyfans', platform_presences: { instagram: { handle: '@a' } } });
    expect(out.real_platform).toBe('playroom');
    expect(out.platform_presences.playroom).toEqual({ visibility: 'discreet' });
    expect(out.platform_presences).not.toHaveProperty('pulse_private');
  });

  test('a profile already in LalaVerse shape is unchanged', () => {
    const shaped = { platform: 'pulse', front_platform: 'pulse', real_platform: 'playroom',
      platform_presences: { pulse: { handle: '@a' }, playroom: { handle: '@b', visibility: 'discreet' } } };
    expect(pulse.toPulsePresences(shaped)).toEqual({ platform_presences: shaped.platform_presences, front_platform: 'pulse', real_platform: 'playroom' });
  });

  test('same front and real platform: one public Pulse account, no private one', () => {
    const out = pulse.toPulsePresences({ platform: 'tiktok', front_platform: 'tiktok', real_platform: 'tiktok', platform_presences: { tiktok: { handle: '@t' }, youtube: { handle: '@t_long' } } });
    expect(out).toEqual({ platform_presences: { pulse: { handle: '@t', visibility: 'public', is_primary: true } }, front_platform: 'pulse', real_platform: 'pulse' });
  });

  test('the prompt rules are for the LalaVerse only', () => {
    expect(pulse.pulsePromptRules('lalaverse')).toMatch(/Never name them/);
    expect(pulse.pulsePromptRules('real_world')).toBe('');
  });

  test('the migration moves LalaVerse profiles only', () => {
    const fs = require('fs');
    const mig = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'migrations', '20261015120000-lalaverse-profiles-on-the-pulse.js'), 'utf8');
    expect(mig).toMatch(/feed_layer::text = 'lalaverse'/);
    expect(mig).toMatch(/const PLAYROOM = 'playroom'/);
  });
});
