/**
 * "Make one for me" on The Cast (services/castGenerate): proposal shaping
 * and the prompt, without the AI or the database.
 */
const cg = require('../../../src/services/castGenerate');

describe('castGenerate shaping', () => {
  const raw = {
    display_name: 'Sienna Vale', real_name: 'Sienna Okafor-Vale', role: 'shadow', role_label: 'rival stylist',
    summary: 'She dresses the women Lala wants to be.', city: 'Dazzle District', age: 29, gender: 'woman',
    pronouns: 'she/her', signature_trait: 'Never pays retail.', core_desire: 'To be the name.', core_fear: 'Being copied.',
    icon: '🦹', pulse: { handle: '@sienna vale!', bio: 'Styling the uninvited.', follower_count: 48000 },
  };

  it('keeps what a column takes: a DREAM city key, a known role, a clean handle', () => {
    const p = cg.shapeProposal(raw, 'lalaverse');
    expect(p).toMatchObject({
      display_name: 'Sienna Vale', selected_name: 'Sienna Okafor-Vale', role_type: 'shadow', current_city: 'dazzle_district',
      age: 29, world: 'lalaverse', pulse: { handle: 'sienna_vale', bio: 'Styling the uninvited.', follower_count: 48000 },
    });
  });

  it('falls back safely: an unknown role is pressure, an odd age is dropped, no name is no proposal', () => {
    const p = cg.shapeProposal({ ...raw, role: 'protagonist', age: 'old', city: 'Paris' }, 'lalaverse');
    expect(p.role_type).toBe('pressure');
    expect(p.age).toBeNull();
    expect(p.current_city).toBeNull();
    expect(cg.shapeProposal({ summary: 'nobody' }, 'lalaverse')).toBeNull();
  });

  it("a Before Lala registry's character lives outside the LalaVerse and gets no Pulse profile", () => {
    const p = cg.shapeProposal(raw, 'book-1');
    expect(p.current_city).toBe('outside_lalaverse');
    expect(p.pulse).toBeNull();
  });

  it('reads an array, a single object, or fenced JSON; an unreadable answer is none', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(cg.parseProposals(JSON.stringify([raw, { ...raw, display_name: 'Two' }]), 'lalaverse')).toHaveLength(2);
    expect(cg.parseProposals('```json\n' + JSON.stringify(raw) + '\n```', 'lalaverse')).toHaveLength(1);
    expect(cg.parseProposals('Sorry, no JSON today.', 'lalaverse')).toEqual([]);
  });

  it('the prompt carries the idea, the cast it must not repeat, The Pulse rules and the Bible', () => {
    const cast = { rows: [{ display_name: 'Maren', role_label: 'baker' }], roles: { support: 1 }, cities: { echo_park: 1 } };
    const prompt = cg.promptFor({ world: 'lalaverse', cast, idea: 'a rival stylist', count: 3, brain: 'SHOW BIBLE: rule one' });
    expect(prompt).toContain('a rival stylist');
    expect(prompt).toContain('Maren');
    expect(prompt).toContain('exactly 3');
    expect(prompt).toContain('SHOW BIBLE: rule one');
    expect(prompt).toContain('The Pulse');
    expect(prompt).toContain('Dr. Amara Sinclair');
    const noIdea = cg.promptFor({ world: 'lalaverse', cast, idea: '', count: 1, brain: null });
    expect(noIdea).toContain('fill a gap in the cast');
  });

  it('a registry reads as Before Lala by its book tag, else the LalaVerse', () => {
    expect(cg.worldOf({ book_tag: 'Book 1: Before Lala' })).toBe('book-1');
    expect(cg.worldOf({ book_tag: null })).toBe('lalaverse');
  });
});
