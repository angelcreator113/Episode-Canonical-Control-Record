/**
 * A character knows the events they host or attend, and what each is for
 * (Evoni, 2026-10-15: "shouldn't character profiles know about the events
 * characters are hosting, purpose, etc"). services/characterEvents is the
 * one reader; the character page, Pulse drafting, the Depth Engine and the
 * interior generator use it.
 */
const fs = require('fs');
const path = require('path');

jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: jest.fn() } }; });

const { eventsForProfile, eventsPromptLines } = require('../../../src/services/characterEvents');
const { buildPostBatchPrompt, hostingLine } = require('../../../src/services/pulseDrafter');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', ...p), 'utf8');

const GALA = {
  id: 'ev1', name: 'Velvet Hour', role: 'host', episode_number: 3,
  description: 'Her first launch party, to prove the line is real.', narrative_stakes: 'If the room stays empty, the brand is over.',
  theme: 'Velvet', dress_code: 'Black tie', host_brand: 'Maison Belle',
};
const BRUNCH = { id: 'ev2', name: 'Sunday Brunch', role: 'guest', episode_number: 1, description: null };

describe('eventsForProfile', () => {
  test('reads the host by the organizer field, else the automation copy, and guests from guest_profiles', async () => {
    const query = jest.fn(async () => [[GALA]]);
    const rows = await eventsForProfile({ query }, 7);
    expect(rows).toEqual([GALA]);
    const [sql, { replacements }] = query.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(we\.source_profile_id,/);
    expect(sql).toMatch(/'host_profile_id'/);
    expect(sql).toMatch(/guest_profiles/);
    expect(sql).toMatch(/m\.description, m\.theme, m\.dress_code, m\.narrative_stakes, m\.host_brand/);
    expect(replacements).toEqual({ pid: 7, pidText: '7' });
  });

  test('no Feed profile: no query, no events', async () => {
    const query = jest.fn();
    expect(await eventsForProfile({ query }, null)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('eventsPromptLines', () => {
  test('hosted first, each with what it is for', () => {
    const lines = eventsPromptLines([BRUNCH, GALA]).split('\n');
    expect(lines[0]).toBe('- Hosts "Velvet Hour" (Episode 3); what it is: Her first launch party, to prove the line is real.; stakes: If the room stays empty, the brand is over.; theme: Velvet; dress code: Black tie; with Maison Belle');
    expect(lines[1]).toBe('- Guest at "Sunday Brunch" (Episode 1)');
  });

  test('none: empty; long text is cut', () => {
    expect(eventsPromptLines([])).toBe('');
    expect(eventsPromptLines(null)).toBe('');
    const line = eventsPromptLines([{ ...GALA, description: 'x'.repeat(500) }]);
    expect(line).toMatch(/what it is: x{219}…/);
  });
});

describe('Pulse drafting knows the events a character hosts', () => {
  test('a host may build up to their event, never tell what happens at it', () => {
    expect(hostingLine('')).toBe('');
    expect(hostingLine('- Hosts "Velvet Hour"')).toMatch(/^Events they host:\n- Hosts "Velvet Hour"\nThey may build up to an event they host .* Never say what happens at it before it happens\./);
  });

  test('the batch prompt carries each poster\'s hosted events', () => {
    const voice = { habits_json: {}, examples_json: [] };
    const prompt = buildPostBatchPrompt([
      { character: { display_name: 'Sable' }, profile: { handle: 'sable' }, voice, known: null, hosting: eventsPromptLines([GALA]) },
      { character: { display_name: 'Nia' }, profile: { handle: 'nia' }, voice, known: null },
    ], { label: 'now' });
    expect(prompt).toContain('Events they host:\n- Hosts "Velvet Hour" (Episode 3)');
    expect(prompt.split('Events they host:').length).toBe(2);
  });
});

describe('the other readers', () => {
  test('the Depth Engine adds their events to the dossier', () => {
    const src = read('routes', 'characterDepthRoutes.js');
    expect(src.match(/buildCharacterContext\(character\) \+ await eventsSection\(character\)/g)).toHaveLength(2);
  });

  test('the interior generator is given their events', () => {
    expect(read('routes', 'characterRegistry.js')).toMatch(/generateMissingInterior\(\{ character: plain, feedProfile, events, fields: toAsk(, factsBlock)? \}\)/);
    expect(read('services', 'characterGenerationService.js')).toMatch(/known: withEvents\(characterContext\(character, feedProfile\), events\)/);
  });

  test('the character page reads its events from the same service', () => {
    expect(read('routes', 'castRoutes.js')).toMatch(/require\('\.\.\/services\/characterEvents'\)\.eventsForProfile\(sequelize, profileId\)/);
  });
});
