// ============================================================================
// The camera roll's plan and what they do for work (Career & World Alignment
// W1; Evoni, 2026-11-21). The plan's "Work" line is their decided occupation
// fact (services/characterFacts), exactly. Before, it was built from the
// career section, an object, and read "Work: [object Object]"; its fallbacks
// were a story role and an old list of job options, neither a job. A job not
// decided yet is not named or invented, and facts that could not be read are
// told apart from that. A saved place of work, or an event, stays a setting
// either way. No database, no AI.
// ============================================================================

const { promptFor, workFor } = require('../../../src/services/cameraRoll');

const character = {
  display_name: 'Sable', age: 31, description: 'Runs a studio in Echo Park.',
  // What used to be read as the job: none of it is one.
  career_status: { profession: 'runway model', career_goal: 'to own a fashion house' },
  role_label: 'rival stylist',
  job_options: 'florist, barista',
  appearance: {},
};
const ctx = (facts) => ({
  look: '', profile: { city: 'echo_park' }, facts,
  places: [{ role: 'work', scene_set_name: "STUDIO BY SABLE's Studio" }, { role: 'home', scene_set_name: "Sable's Loft" }],
  events: [{ role: 'host', name: 'Wearable Experiments', event_date: '2026-11-12' }],
});
const plan = (facts) => promptFor(character, ctx(facts), { count: 3, idea: '', existing: [] });
const facts = (over = {}) => ({ occupation: null, undecided: [], ...over });

describe('the Work line of a camera-roll plan', () => {
  it('is their decided occupation, exactly', () => {
    const prompt = plan(facts({ occupation: 'Fashion designer and studio owner' }));
    expect(prompt).toContain('\nWork: Fashion designer and studio owner\n');
    expect(prompt).not.toMatch(/Their job (is not decided|could not be read)/);
  });

  it('never prints the career section, its goal, the story role or a job option', () => {
    for (const f of [facts({ occupation: 'Fashion designer' }), facts(), facts({ occupation: 'Fashion designer', undecided: ['occupation'] }), null, undefined]) {
      const prompt = plan(f);
      expect(prompt).not.toContain('[object Object]');
      expect(prompt).not.toContain('runway model');
      expect(prompt).not.toContain('to own a fashion house');
      expect(prompt).not.toContain('rival stylist');
      expect(prompt).not.toContain('florist');
    }
  });

  it('a job not decided yet, or simply not set, is not named or invented', () => {
    for (const f of [facts({ occupation: 'Fashion designer', undecided: ['occupation'] }), facts()]) {
      const prompt = plan(f);
      expect(prompt).not.toMatch(/^Work:/m);
      expect(prompt).not.toContain('Fashion designer');
      expect(prompt).toContain('- Their job is not decided: do not name or invent a job title, employer or work activity.');
      expect(prompt).not.toContain('could not be read');
    }
  });

  it('facts that could not be read are said as that, not as a job not decided', () => {
    for (const f of [null, undefined]) {
      const prompt = plan(f);
      expect(prompt).not.toMatch(/^Work:/m);
      expect(prompt).toContain('- Their job could not be read just now: name no job title, employer or work activity.');
      expect(prompt).not.toContain('is not decided');
    }
  });

  it('their saved place of work and their events stay settings in every case', () => {
    for (const f of [facts({ occupation: 'Fashion designer' }), facts(), null]) {
      const prompt = plan(f);
      expect(prompt).toContain("1. STUDIO BY SABLE's Studio (work)");
      expect(prompt).toContain('Hosts "Wearable Experiments"');
      expect(prompt).toContain('place: one of their saved places by name when it fits');
    }
    expect(plan(facts())).toContain('A saved place above, their place of work included, or an event above can still be where a photo is taken.');
    expect(plan(null)).toContain('A saved place above, their place of work included, or an event above can still be where a photo is taken.');
  });

  it('workFor: a long occupation is kept to 120 characters; a decided one carries no rule', () => {
    const long = workFor(facts({ occupation: 'x'.repeat(300) }));
    expect(long.line).toBe(`Work: ${'x'.repeat(120)}`);
    expect(long.rule).toBeNull();
    expect(workFor(facts()).line).toBeNull();
    expect(workFor(null).line).toBeNull();
  });
});
