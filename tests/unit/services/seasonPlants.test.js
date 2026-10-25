/**
 * Plant tracker's pure parts (services/seasonTwists, 2026-10-25): where the
 * season is, the two new warnings, the AI drafts cleaned, and the open
 * plants block. No database, no AI.
 */
const {
  checkTwists, currentEpisode, cleanPlantDrafts, renderOpenPlants, plantPrompt, OPEN_TOO_LONG,
} = require('../../../src/services/seasonTwists');

const slot = (n, extra = {}) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, ...extra });
const plant = (over = {}) => ({
  id: 'p1', title: 'Declan Ferris is @thriftveil', status: 'planted', planted_episode_id: 'e1',
  plant: slot(1), payoff: null, payoff_slot_id: null, ...over,
});

describe('currentEpisode', () => {
  it('is the latest slot done or with a script, or null', () => {
    expect(currentEpisode([])).toBeNull();
    expect(currentEpisode([slot(1), slot(2)])).toBeNull();
    expect(currentEpisode([slot(1, { done: true }), slot(3, { scripted: true }), slot(9)])).toBe(3);
  });
});

describe('checkTwists, plant warnings', () => {
  it('warns when a plant with no payoff is open more than ~3 episodes', () => {
    expect(OPEN_TOO_LONG).toBe(3);
    expect(checkTwists([plant()], { current: 4 })).toEqual([]);
    expect(checkTwists([plant()], { current: 5 })).toEqual([
      { twist_id: 'p1', type: 'open_long', text: expect.stringContaining('still open 4 episodes later') },
    ]);
  });

  it('warns once a plant is past its planned payoff episode', () => {
    const t = plant({ payoff: slot(4), payoff_slot_id: 's4' });
    expect(checkTwists([t], { current: 4 })).toEqual([]);
    expect(checkTwists([t], { current: 6 })).toEqual([
      { twist_id: 'p1', type: 'past_payoff', text: expect.stringContaining('meant to pay off in Episode 4, and the season is at Episode 6') },
    ]);
    // A written payoff episode already has its own warning; this one does not repeat it.
    expect(checkTwists([{ ...t, payoff: slot(4, { written: true }) }], { current: 6 }).map((w) => w.type)).toEqual([undefined]);
  });

  it('says nothing new for a plant paid off or dropped, or with no current episode', () => {
    expect(checkTwists([plant({ status: 'paid_off' })], { current: 10 })).toEqual([]);
    expect(checkTwists([plant({ status: 'dropped' })], { current: 10 })).toEqual([]);
    expect(checkTwists([plant()])).toEqual([]);
  });
});

describe('cleanPlantDrafts', () => {
  const opts = { plantSlotId: 's2', plantNumber: 2, laterSlots: [slot(3), slot(5)], beatCount: 14, taken: ['Already here'] };

  it('keeps what fits: kind, beat in the script, a later payoff, no repeats', () => {
    const drafts = cleanPlantDrafts({ plants: [
      { text: 'Studio by Sable wants her to model', kind: 'opportunity', beat: 14, payoff_episode: 5, why: 'Model vs design', quote: 'MODEL' },
      { text: 'already here', kind: 'twist' },
      { text: 'Bad bits', kind: 'gossip', beat: 15, payoff_episode: 2 },
      { title: 'Uses title too', kind: 'callback', beat: '3' },
      { text: '   ' },
    ] }, opts);
    expect(drafts).toEqual([
      { title: 'Studio by Sable wants her to model', kind: 'opportunity', description: 'Model vs design', quote: 'MODEL', plant_beat: 14, plant_slot_id: 's2', payoff_slot_id: 's5' },
      { title: 'Bad bits', kind: 'twist', description: null, quote: null, plant_beat: null, plant_slot_id: 's2', payoff_slot_id: null },
      { title: 'Uses title too', kind: 'callback', description: null, quote: null, plant_beat: 3, plant_slot_id: 's2', payoff_slot_id: null },
    ]);
  });

  it('reads a bare list and caps at eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ text: `Plant ${i}` }));
    expect(cleanPlantDrafts(many, opts)).toHaveLength(8);
    expect(cleanPlantDrafts(null, opts)).toEqual([]);
  });
});

describe('renderOpenPlants', () => {
  it('is null with none, and lists each with where it was planted', () => {
    expect(renderOpenPlants([])).toBeNull();
    const text = renderOpenPlants([
      { title: 'Declan is @thriftveil', kind: 'twist', plant_number: 1, plant_beat: 3, payoff_number: 4 },
      { title: 'A ring', description: 'Not hers', kind: 'mystery', plant_number: 2, plant_beat: null, payoff_number: null },
    ]);
    expect(text).toContain('- [twist] Declan is @thriftveil (planted in episode 1, beat 3; it was meant to pay off in episode 4)');
    expect(text).toContain('- [mystery] A ring — Not hers (planted in episode 2)');
    expect(text).toContain('never force one in');
  });
});

describe('plantPrompt', () => {
  it('carries the forward hook, the later episodes and what is already recorded', () => {
    const prompt = plantPrompt({
      episode: { title: 'The Archive', script_content: '## BEAT: 1\nLALA: Hi.' }, slot: { slot_number: 1 }, seasonNumber: 1,
      hook: 'Who is @thriftveil?', laterSlots: [slot(2), slot(3)], taken: ['The ring'],
    });
    expect(prompt).toContain("THE BRIEF'S FORWARD HOOK: Who is @thriftveil?");
    expect(prompt).toContain('LATER EPISODES IN THE SEASON: E2, E3');
    expect(prompt).toContain('- The ring');
    expect(prompt).toContain('LALA: Hi.');
  });
});
