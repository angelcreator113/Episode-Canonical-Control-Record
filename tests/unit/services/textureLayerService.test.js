/**
 * Unit tests for textureLayerService helper functions
 */

const {
  detectPhone,
  isConflictEligible,
  isPrivateMomentPosition,
  isPostPosition,
} = require('../../../src/services/textureLayerService');

describe('textureLayerService', () => {
  describe('detectPhone', () => {
    it('detects "her phone" in story text', () => {
      const result = detectPhone('She glanced at her phone and sighed.');
      expect(result.appeared).toBe(true);
      expect(result.context).toBeTruthy();
    });

    it('detects "her screen" in story text', () => {
      const result = detectPhone('The glow of her screen lit the dark room.');
      expect(result.appeared).toBe(true);
    });

    it('detects "she scrolled" in story text', () => {
      const result = detectPhone('She scrolled past the comment without stopping.');
      expect(result.appeared).toBe(true);
    });

    it('returns false when no phone references', () => {
      const result = detectPhone('She walked to the kitchen and poured coffee.');
      expect(result.appeared).toBe(false);
      expect(result.context).toBeNull();
    });

    it('handles empty string', () => {
      const result = detectPhone('');
      expect(result.appeared).toBe(false);
      expect(result.context).toBeNull();
    });
  });

  describe('isConflictEligible', () => {
    it('returns true for collision with eligible role', () => {
      const chars = [{ role_type: 'love_interest' }];
      expect(isConflictEligible('collision', chars)).toBe(true);
    });

    it('returns true for wrong_win with rival', () => {
      const chars = [{ role_type: 'rival' }];
      expect(isConflictEligible('wrong_win', chars)).toBe(true);
    });

    it('returns false for non-eligible story type', () => {
      const chars = [{ role_type: 'love_interest' }];
      expect(isConflictEligible('quiet_moment', chars)).toBe(false);
    });

    it('returns false when no characters have eligible roles', () => {
      const chars = [{ role_type: 'friend' }, { role_type: 'stranger' }];
      expect(isConflictEligible('collision', chars)).toBe(false);
    });

    it('returns false with empty characters array', () => {
      expect(isConflictEligible('collision', [])).toBe(false);
    });

    it('returns false with default empty characters', () => {
      expect(isConflictEligible('collision')).toBe(false);
    });
  });

  describe('isPrivateMomentPosition', () => {
    it('returns true for position 5', () => {
      expect(isPrivateMomentPosition(5)).toBe(true);
    });

    it('returns true for position 50', () => {
      expect(isPrivateMomentPosition(50)).toBe(true);
    });

    it('returns true for all valid positions', () => {
      [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(pos => {
        expect(isPrivateMomentPosition(pos)).toBe(true);
      });
    });

    it('returns false for non-private-moment positions', () => {
      [1, 2, 3, 4, 6, 11, 49].forEach(pos => {
        expect(isPrivateMomentPosition(pos)).toBe(false);
      });
    });
  });

  describe('isPostPosition', () => {
    it('returns true for story 1', () => {
      expect(isPostPosition(1)).toBe(true);
    });

    it('returns true for every 5th story', () => {
      [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(pos => {
        expect(isPostPosition(pos)).toBe(true);
      });
    });

    it('returns false for non-post positions', () => {
      [2, 3, 4, 6, 7, 8, 9, 11].forEach(pos => {
        expect(isPostPosition(pos)).toBe(false);
      });
    });
  });
});
