/**
 * services/societyArchetypes — the Society tab's fifteen archetypes in the
 * Feed (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list
 * item 26; Evoni's ruling, 2026-10-08: "Feed also uses your 15"). The list
 * is the one the page shows, Evoni's saved edits or the defaults; a new
 * LalaVerse profile gets the AI's pick from it or the least used.
 */
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_ARCHETYPES, normalizeArchetypes, loadSocietyArchetypes, societyArchetypeCounts,
  pickSocietyArchetypes, matchSocietyArchetype, assignSocietyArchetype,
  societyArchetypeLine, societyArchetypeMenu, societySparkBlock,
} = require('../../../src/services/societyArchetypes');

const frontend = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'data', 'influencerData.js'), 'utf8');
const list = (...names) => names.map((name) => ({ name, content: `${name} posts`, audience: '', narrative: '' }));
const pageContent = (impl) => ({ findOne: jest.fn(impl) });

describe('the defaults', () => {
  test('are the Society page\'s own fifteen, as frontend/src/data/influencerData.js has them', () => {
    const m = /export const ARCHETYPES = (\[[\s\S]*?\n\]);/.exec(frontend);
    expect(m).toBeTruthy();
    const T = new Proxy({}, { get: (_, k) => String(k) });
    const page = Function('T', `return ${m[1]}`)(T);
    expect(DEFAULT_ARCHETYPES).toEqual(page.map(({ name, content, audience, narrative }) => ({ name, content, audience, narrative })));
    expect(DEFAULT_ARCHETYPES).toHaveLength(15);
    expect(Object.isFrozen(DEFAULT_ARCHETYPES) && Object.isFrozen(DEFAULT_ARCHETYPES[0])).toBe(true);
  });
});

describe('the list', () => {
  test('named items only, trimmed, the first of a name kept', () => {
    expect(normalizeArchetypes([
      { name: ' The Rebel ', content: ' Anti-trend ', icon: '⚡' },
      { name: '' }, null, { content: 'no name' },
      { name: 'the rebel', content: 'a second Rebel' },
      { name: 'The Archivist' },
    ])).toEqual([
      { name: 'The Rebel', content: 'Anti-trend', audience: '', narrative: '' },
      { name: 'The Archivist', content: '', audience: '', narrative: '' },
    ]);
    expect(normalizeArchetypes('not a list')).toEqual([]);
  });

  test('Evoni\'s saved list wins, an empty one too, as the page shows it', async () => {
    const PageContent = pageContent(async () => ({ data: [{ name: 'The Night Owl', content: 'Posts at 3am' }] }));
    expect(await loadSocietyArchetypes({ PageContent })).toEqual([{ name: 'The Night Owl', content: 'Posts at 3am', audience: '', narrative: '' }]);
    expect(PageContent.findOne).toHaveBeenCalledWith({ where: { page_name: 'influencer_systems', constant_key: 'ARCHETYPES' }, attributes: ['data'] });
    expect(await loadSocietyArchetypes({ PageContent: pageContent(async () => ({ data: [] })) })).toEqual([]);
  });

  test('no saved list, a saved value that is not a list, a failed read or no models: the defaults', async () => {
    const defaults = normalizeArchetypes(DEFAULT_ARCHETYPES);
    expect(await loadSocietyArchetypes({ PageContent: pageContent(async () => null) })).toEqual(defaults);
    expect(await loadSocietyArchetypes({ PageContent: pageContent(async () => ({ data: { not: 'a list' } })) })).toEqual(defaults);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadSocietyArchetypes({ PageContent: pageContent(async () => { throw new Error('down'); }) })).toEqual(defaults);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[societyArchetypes]'), 'down');
    spy.mockRestore();
    expect(await loadSocietyArchetypes(null)).toEqual(defaults);
  });
});

describe('picking', () => {
  test('the least used first, then the next least used, the picks counting as they go', () => {
    const arch = list('The A', 'The B', 'The C');
    const first = () => 0;
    expect(pickSocietyArchetypes(arch, { 'The A': 2, 'The B': 0, 'The C': 1 }, 1, first).map((a) => a.name)).toEqual(['The B']);
    expect(pickSocietyArchetypes(arch, { 'The A': 2, 'The B': 0, 'The C': 1 }, 4, first).map((a) => a.name)).toEqual(['The B', 'The B', 'The C', 'The A']);
    expect(pickSocietyArchetypes(arch, {}, 3, first).map((a) => a.name)).toEqual(['The A', 'The B', 'The C']);
  });

  test('a tie is broken at random; stored names count whatever their spelling; a name off the list counts for nothing', () => {
    const arch = list('The A', 'The B', 'The C');
    expect(pickSocietyArchetypes(arch, {}, 1, () => 0.99)[0].name).toBe('The C');
    expect(pickSocietyArchetypes(arch, { 'the a': 1, B: 1, 'Gone Now': 9 }, 1, () => 0)[0].name).toBe('The C');
    expect(pickSocietyArchetypes([], { 'The A': 1 }, 2)).toEqual([]);
  });

  test('a name the AI gives matches the list\'s whatever its case, "The" or punctuation; else null', () => {
    const arch = normalizeArchetypes(DEFAULT_ARCHETYPES);
    expect(matchSocietyArchetype(arch, 'the trendsetter').name).toBe('The Trendsetter');
    expect(matchSocietyArchetype(arch, 'Beauty Oracle').name).toBe('The Beauty Oracle');
    expect(matchSocietyArchetype(arch, '  THE VIRAL-WILDCARD ').name).toBe('The Viral Wildcard');
    expect(matchSocietyArchetype(arch, 'polished_curator')).toBeNull();
    expect(matchSocietyArchetype(arch, undefined)).toBeNull();
    expect(matchSocietyArchetype(arch, 7)).toBeNull();
  });
});

describe('the counts and one pick', () => {
  const sequelize = { fn: (...a) => ['fn', ...a], col: (c) => ['col', c] };

  test('LalaVerse profiles per name, those with none left out', async () => {
    const SocialProfile = { findAll: jest.fn(async () => [
      { society_archetype: 'The A', count: '3' }, { society_archetype: null, count: '40' }, { society_archetype: 'The B', count: 1 },
    ]) };
    expect(await societyArchetypeCounts({ SocialProfile, sequelize })).toEqual({ 'The A': 3, 'The B': 1 });
    const q = SocialProfile.findAll.mock.calls[0][0];
    expect(q.where).toEqual({ feed_layer: 'lalaverse' });
    expect(q.group).toEqual(['society_archetype']);
  });

  test('no database, or a failed read: no counts, and the failure is logged', async () => {
    expect(await societyArchetypeCounts({})).toEqual({});
    expect(await societyArchetypeCounts({ SocialProfile: { findAll: jest.fn() } })).toEqual({});
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const SocialProfile = { findAll: jest.fn(async () => { throw new Error('no column'); }) };
    expect(await societyArchetypeCounts({ SocialProfile, sequelize })).toEqual({});
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[societyArchetypes]'), 'no column');
    spy.mockRestore();
  });

  test('one pick: the least used of the list given, or of the saved list; none from an empty list', async () => {
    const SocialProfile = { findAll: jest.fn(async () => [{ society_archetype: 'The A', count: '2' }]) };
    expect((await assignSocietyArchetype({ SocialProfile, sequelize }, list('The A', 'The B'))).name).toBe('The B');
    const PageContent = pageContent(async () => ({ data: list('The A') }));
    expect((await assignSocietyArchetype({ SocialProfile, sequelize, PageContent })).name).toBe('The A');
    expect(await assignSocietyArchetype({ SocialProfile, sequelize }, [])).toBeNull();
  });
});

describe('the prompts', () => {
  const [mainCharacter] = normalizeArchetypes(DEFAULT_ARCHETYPES);

  test('a profile\'s own archetype, apart from the Feed\'s ten, with what it posts, does and means', () => {
    const line = societyArchetypeLine(mainCharacter);
    expect(line).toContain('SOCIETY ARCHETYPE: The Main Character');
    expect(line).toContain('not the "archetype" field');
    expect(line).toContain('What they post: Relationship stories, glow-ups, emotional monologues, life updates as episodes.');
    expect(line).toContain('What they do in the story: The character the audience is emotionally invested in. Their choices matter.');
    expect(line).not.toContain('..');
    expect(societyArchetypeLine({ name: 'The Old Name' })).toBe('\n\nSOCIETY ARCHETYPE: The Old Name, what the LalaVerse knows this creator for (not the "archetype" field, which is how they behave online). Write the creator as this archetype.');
    expect(societyArchetypeLine(null)).toBe('');
  });

  test('the list to choose from names every archetype and the JSON field', () => {
    const menu = societyArchetypeMenu(list('The A', 'The B'));
    expect(menu).toContain('"society_archetype"');
    expect(menu).toContain('- The A: The A posts\n- The B: The B posts');
    expect(societyArchetypeMenu([])).toBe('');
  });

  test('the scheduler\'s sparks, one archetype each, in order', () => {
    const block = societySparkBlock(list('The B', 'The A'));
    expect(block).toContain('Build spark 1 around the first');
    expect(block).toContain('1. The B: The B posts\n2. The A: The A posts');
    expect(societySparkBlock([])).toBe('');
  });
});
