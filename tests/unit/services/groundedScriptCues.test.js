// ============================================================================
// The script generator writes the cue lines the Script tab reads (Script tab
// audit, 2026-10-15): [UI:VERB Target] moments naming the show's own screens,
// icons and overlays, and a [WEAR: id] line for each piece of the locked
// look. Without them a generated script had no phone moments and every
// locked piece read as "never put on". No database, no network.
// ============================================================================

const { buildScriptPrompt } = require('../../../src/services/groundedScriptGeneratorService');

const inputs = (over = {}) => ({
  brief: null, scenePlan: [], franchiseLaws: [], eventData: null, wardrobeItems: [], lalaStats: null,
  outfitScore: null, seasonContext: null, onScreen: [], ...over,
});

describe('buildScriptPrompt: cue lines', () => {
  test('teaches the [UI:] grammar and never the action names in brackets', () => {
    const prompt = buildScriptPrompt(inputs());
    expect(prompt).toContain('[UI:OPEN <screen>] [UI:CLICK <icon>]');
    expect(prompt).toContain('[UI:NOTIFY <sender>: <words>]');
    expect(prompt).toContain('CLOSET_OPEN is [UI:OPEN Closet]');
    expect(prompt).not.toContain('═══ ON SCREEN ═══');
  });

  test("lists the show's screens, icons and overlays by name, sorted as the Script tab sorts them", () => {
    const prompt = buildScriptPrompt(inputs({ onScreen: [
      { name: 'Home', category: 'phone', is_home: true },
      { name: 'Closet', category: 'phone' },
      { name: 'Shoes', category: 'phone_icon' },
      { name: 'Mail', category: 'icon' },
      { name: 'Invite Letter', category: 'production' },
    ] }));
    expect(prompt).toContain('Screens: Home, Closet\n');
    expect(prompt).toContain('Icons: Shoes, Mail\n');
    expect(prompt).toContain('Overlays: Invite Letter\n');
  });

  test('gives each locked piece its [WEAR: id] line and asks for it in the transformation', () => {
    const prompt = buildScriptPrompt(inputs({ outfitScore: { count: 1, items: [
      { id: '3f2a9c1e-0000-4000-8000-000000000001', name: 'Gold slip dress', clothing_category: 'dress', tier: 'luxury' },
    ] } }));
    expect(prompt).toContain('- Gold slip dress (dress, luxury) [WEAR: 3f2a9c1e-0000-4000-8000-000000000001]');
    expect(prompt).toContain("write that piece's [WEAR: id] line exactly as shown above");
  });
});
