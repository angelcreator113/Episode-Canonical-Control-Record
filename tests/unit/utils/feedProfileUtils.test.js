/**
 * feedProfileUtils Unit Tests
 * Tests handle generation and role inference mapping functions
 */

const {
  generateHandleFromCharacter,
  inferArchetypeFromRole,
  inferLalaRelationship,
  inferCareerPressure,
  inferFollowerTier,
} = require('../../../src/utils/feedProfileUtils');

describe('feedProfileUtils', () => {
  describe('generateHandleFromCharacter', () => {
    it('should generate a handle from selected_name', () => {
      const character = { selected_name: 'Lala Voss' };
      const handle = generateHandleFromCharacter(character);
      expect(handle).toMatch(/^lala_voss_\d{3}$/);
    });

    it('should fall back to display_name when selected_name is absent', () => {
      const character = { display_name: 'Amber Rose' };
      const handle = generateHandleFromCharacter(character);
      expect(handle).toMatch(/^amber_rose_\d{3}$/);
    });

    it('should fall back to creator when both names are absent', () => {
      const handle = generateHandleFromCharacter({});
      expect(handle).toMatch(/^creator_\d{3}$/);
    });

    it('should lowercase the name', () => {
      const character = { selected_name: 'UPPERCASE' };
      const handle = generateHandleFromCharacter(character);
      expect(handle).toMatch(/^uppercase_\d{3}$/);
    });

    it('should replace spaces with underscores', () => {
      const character = { selected_name: 'John  Doe' };
      const handle = generateHandleFromCharacter(character);
      expect(handle).toMatch(/^john_doe_\d{3}$/);
    });

    it('should remove non-alphanumeric characters and collapse underscores', () => {
      // 'Lala@! Voss' → lowercase → 'lala@! voss' → replace non-alphanum with '_' → 'lala__ voss'
      // → spaces become '_' → 'lala___voss' → collapse to 'lala_voss'
      const character = { selected_name: 'Lala@! Voss' };
      const handle = generateHandleFromCharacter(character);
      expect(handle).toMatch(/^lala_voss_\d{3}$/);
    });

    it('should append a 3-digit numeric suffix (100-999)', () => {
      const character = { selected_name: 'Test' };
      const handle = generateHandleFromCharacter(character);
      const suffix = parseInt(handle.split('_').pop(), 10);
      expect(suffix).toBeGreaterThanOrEqual(100);
      expect(suffix).toBeLessThanOrEqual(999);
    });

    it('should produce different handles on repeated calls (random suffix)', () => {
      const character = { selected_name: 'Lala' };
      const handles = new Set(Array.from({ length: 20 }, () => generateHandleFromCharacter(character)));
      // With 900 possible suffixes, 20 calls should produce at least 2 unique values
      expect(handles.size).toBeGreaterThan(1);
    });
  });

  describe('inferArchetypeFromRole', () => {
    const mappings = [
      ['love_interest', 'polished_curator'],
      ['one_night_stand', 'messy_transparent'],
      ['industry_peer', 'the_peer'],
      ['mentor', 'polished_curator'],
      ['antagonist', 'chaos_creator'],
      ['rival', 'the_peer'],
      ['collaborator', 'community_builder'],
      ['spouse', 'soft_life'],
      ['partner', 'soft_life'],
      ['temptation', 'overnight_rise'],
      ['ex', 'messy_transparent'],
      ['confidant', 'the_watcher'],
      ['friend', 'community_builder'],
      ['coworker', 'cautionary'],
    ];

    test.each(mappings)('should map %s to %s', (role, archetype) => {
      expect(inferArchetypeFromRole(role)).toBe(archetype);
    });

    it('should return the_watcher for unknown roles', () => {
      expect(inferArchetypeFromRole('unknown_role')).toBe('the_watcher');
      expect(inferArchetypeFromRole('')).toBe('the_watcher');
      expect(inferArchetypeFromRole(undefined)).toBe('the_watcher');
    });
  });

  describe('inferLalaRelationship', () => {
    const mappings = [
      ['love_interest', 'direct'],
      ['one_night_stand', 'direct'],
      ['industry_peer', 'competitive'],
      ['mentor', 'aware'],
      ['antagonist', 'aware'],
      ['rival', 'competitive'],
      ['collaborator', 'direct'],
      ['spouse', 'direct'],
      ['partner', 'direct'],
      ['temptation', 'aware'],
      ['ex', 'direct'],
      ['confidant', 'aware'],
      ['friend', 'aware'],
      ['coworker', 'aware'],
    ];

    test.each(mappings)('should map %s to %s', (role, relationship) => {
      expect(inferLalaRelationship(role)).toBe(relationship);
    });

    it('should return mutual_unaware for unknown roles', () => {
      expect(inferLalaRelationship('unknown_role')).toBe('mutual_unaware');
      expect(inferLalaRelationship('')).toBe('mutual_unaware');
    });
  });

  describe('inferCareerPressure', () => {
    const mappings = [
      ['mentor', 'ahead'],
      ['antagonist', 'ahead'],
      ['rival', 'level'],
      ['industry_peer', 'level'],
      ['collaborator', 'level'],
      ['love_interest', 'level'],
      ['temptation', 'level'],
      ['one_night_stand', 'level'],
      ['ex', 'level'],
      ['confidant', 'behind'],
      ['friend', 'behind'],
      ['coworker', 'behind'],
      ['spouse', 'different_lane'],
      ['partner', 'different_lane'],
    ];

    test.each(mappings)('should map %s to %s', (role, pressure) => {
      expect(inferCareerPressure(role)).toBe(pressure);
    });

    it('should return different_lane for unknown roles', () => {
      expect(inferCareerPressure('undefined_role')).toBe('different_lane');
      expect(inferCareerPressure(null)).toBe('different_lane');
    });
  });

  describe('inferFollowerTier', () => {
    const mappings = [
      ['mentor', 'macro'],
      ['antagonist', 'macro'],
      ['rival', 'mid'],
      ['industry_peer', 'mid'],
      ['collaborator', 'mid'],
      ['love_interest', 'micro'],
      ['temptation', 'micro'],
      ['one_night_stand', 'micro'],
      ['ex', 'micro'],
      ['confidant', 'micro'],
      ['friend', 'micro'],
      ['coworker', 'micro'],
      ['spouse', 'micro'],
      ['partner', 'micro'],
    ];

    test.each(mappings)('should map %s to %s', (role, tier) => {
      expect(inferFollowerTier(role)).toBe(tier);
    });

    it('should return micro for unknown roles', () => {
      expect(inferFollowerTier('mystery_role')).toBe('micro');
      expect(inferFollowerTier(undefined)).toBe('micro');
    });
  });
});
