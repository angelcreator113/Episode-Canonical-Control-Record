/**
 * SceneGenerationService Unit Tests
 * Tests pure functions and exported constants (no external API calls)
 */

// Mock dependencies that are loaded at module level
jest.mock('sharp', () => jest.fn());
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));
jest.mock('../../../src/services/artifactDetectionService', () => ({
  analyzeImageQuality: jest.fn(),
  buildRefinedPrompt: jest.fn(),
}));

const {
  buildPrompt,
  buildVideoPrompt,
  LALAVERSE_VISUAL_ANCHOR,
  NEGATIVE_PROMPT,
  ANGLE_MODIFIERS,
  CAMERA_MOTION_MAP,
  VIDEO_DURATION_MAP,
  VIDEO_MOVEMENT_MODIFIERS,
} = require('../../../src/services/sceneGenerationService');

// ─── Test fixtures ──────────────────────────────────────────────────────────

const makeSceneSet = (overrides = {}) => ({
  id: 'set-001',
  name: 'Lala Bedroom',
  canonical_description: 'A cozy cream-toned bedroom with linen drapes, gold hardware, and soft natural light.',
  ...overrides,
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe('SceneGenerationService', () => {
  describe('LALAVERSE_VISUAL_ANCHOR', () => {
    it('should be a non-empty string', () => {
      expect(typeof LALAVERSE_VISUAL_ANCHOR).toBe('string');
      expect(LALAVERSE_VISUAL_ANCHOR.length).toBeGreaterThan(0);
    });

    it('should be under 700 chars (condensed budget)', () => {
      expect(LALAVERSE_VISUAL_ANCHOR.length).toBeLessThanOrEqual(700);
    });
  });

  describe('NEGATIVE_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof NEGATIVE_PROMPT).toBe('string');
      expect(NEGATIVE_PROMPT.length).toBeGreaterThan(0);
    });

    it('should include common artifact suppressions', () => {
      expect(NEGATIVE_PROMPT).toMatch(/watermarks/i);
      expect(NEGATIVE_PROMPT).toMatch(/blurry/i);
      expect(NEGATIVE_PROMPT).toMatch(/distorted/i);
    });
  });

  describe('ANGLE_MODIFIERS', () => {
    const expectedLabels = [
      'WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY',
      'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER',
    ];

    it('should have entries for all expected angle labels', () => {
      expectedLabels.forEach((label) => {
        expect(ANGLE_MODIFIERS).toHaveProperty(label);
      });
    });

    it('should have non-empty string values for every label', () => {
      Object.entries(ANGLE_MODIFIERS).forEach(([key, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('CAMERA_MOTION_MAP', () => {
    it('should cover the same labels as ANGLE_MODIFIERS', () => {
      const angleKeys = Object.keys(ANGLE_MODIFIERS);
      angleKeys.forEach((key) => {
        expect(CAMERA_MOTION_MAP).toHaveProperty(key);
      });
    });

    it('should have non-empty string values', () => {
      Object.values(CAMERA_MOTION_MAP).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('VIDEO_DURATION_MAP', () => {
    it('should cover the same labels as ANGLE_MODIFIERS', () => {
      const angleKeys = Object.keys(ANGLE_MODIFIERS);
      angleKeys.forEach((key) => {
        expect(VIDEO_DURATION_MAP).toHaveProperty(key);
      });
    });

    it('should have numeric durations of 5 or 10', () => {
      Object.values(VIDEO_DURATION_MAP).forEach((value) => {
        expect(typeof value).toBe('number');
        expect([5, 10]).toContain(value);
      });
    });
  });

  describe('VIDEO_MOVEMENT_MODIFIERS', () => {
    it('should cover the same labels as ANGLE_MODIFIERS', () => {
      const angleKeys = Object.keys(ANGLE_MODIFIERS);
      angleKeys.forEach((key) => {
        expect(VIDEO_MOVEMENT_MODIFIERS).toHaveProperty(key);
      });
    });

    it('should have non-empty string values describing movement', () => {
      Object.values(VIDEO_MOVEMENT_MODIFIERS).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── buildPrompt ────────────────────────────────────────────────────────

  describe('buildPrompt', () => {
    it('should include the LALAVERSE visual anchor', () => {
      const result = buildPrompt(makeSceneSet());
      expect(result).toContain('Final Fantasy softness');
    });

    it('should include the scene set name as LOCATION', () => {
      const result = buildPrompt(makeSceneSet({ name: 'Grand Foyer' }));
      expect(result).toContain('LOCATION: Grand Foyer.');
    });

    it('should include the canonical description', () => {
      const result = buildPrompt(makeSceneSet());
      expect(result).toContain('cream-toned bedroom');
    });

    it('should include the camera direction for the angle label', () => {
      const result = buildPrompt(makeSceneSet(), 'VANITY');
      expect(result).toContain(ANGLE_MODIFIERS.VANITY);
    });

    it('should default to WIDE when no angle label provided', () => {
      const result = buildPrompt(makeSceneSet({ canonical_description: '' }));
      expect(result).toContain('CAMERA:');
      expect(result).toContain('Wide establishing shot');
    });

    it('should default to WIDE for unknown angle labels', () => {
      const result = buildPrompt(makeSceneSet({ canonical_description: '' }), 'NONEXISTENT');
      expect(result).toContain('CAMERA:');
      expect(result).toContain('Wide establishing shot');
    });

    it('should use customCameraDirection when provided', () => {
      const custom = 'Low angle looking up at chandelier, dramatic perspective.';
      const result = buildPrompt(makeSceneSet(), 'WIDE', custom);
      expect(result).toContain(`CAMERA: ${custom}`);
      expect(result).not.toContain(ANGLE_MODIFIERS.WIDE);
    });

    it('should include the quality suffix', () => {
      // Use short description to avoid 1000 char truncation cutting off the suffix
      const result = buildPrompt(makeSceneSet({ canonical_description: '' }));
      expect(result).toContain('Photorealistic cinematic quality');
      expect(result).toContain('No text');
    });

    it('should collapse whitespace and newlines', () => {
      const sceneSet = makeSceneSet({
        canonical_description: 'Line one.\n\nLine two.\n   Extra spaces.',
      });
      const result = buildPrompt(sceneSet);
      expect(result).not.toMatch(/\n/);
      expect(result).not.toMatch(/\s{2,}/);
    });

    it('should enforce 1000 character limit', () => {
      const sceneSet = makeSceneSet({
        canonical_description: 'A'.repeat(500),
      });
      const result = buildPrompt(sceneSet);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should append ellipsis when truncated', () => {
      const sceneSet = makeSceneSet({
        canonical_description: 'A'.repeat(500),
      });
      const result = buildPrompt(sceneSet);
      if (result.length === 1000) {
        expect(result).toMatch(/\.\.\.$/);
      }
    });

    it('should truncate canonical_description to 350 chars', () => {
      const longDesc = 'B'.repeat(600);
      const sceneSet = makeSceneSet({ canonical_description: longDesc });
      const result = buildPrompt(sceneSet);
      // The full 600-char description should not appear
      expect(result).not.toContain(longDesc);
      // But the first 350 chars should be present (before overall 1000 char truncation)
      expect(result).toContain('B'.repeat(200));
    });

    it('should handle missing canonical_description gracefully', () => {
      const sceneSet = makeSceneSet({ canonical_description: undefined });
      const result = buildPrompt(sceneSet);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty canonical_description', () => {
      const sceneSet = makeSceneSet({ canonical_description: '' });
      const result = buildPrompt(sceneSet);
      expect(typeof result).toBe('string');
      expect(result).toContain('LOCATION:');
    });

    it('should produce valid prompts for every angle label', () => {
      const labels = Object.keys(ANGLE_MODIFIERS);
      labels.forEach((label) => {
        const result = buildPrompt(makeSceneSet(), label);
        expect(result.length).toBeLessThanOrEqual(1000);
        expect(result.length).toBeGreaterThan(0);
        // CAMERA section should start (may be truncated at 1000 char limit for long angle descriptions)
        expect(result).toContain('CAMERA:');
      });
    });
  });

  // ─── buildVideoPrompt ───────────────────────────────────────────────────

  describe('buildVideoPrompt', () => {
    it('should include the movement modifier for the angle label', () => {
      const result = buildVideoPrompt(makeSceneSet(), 'WIDE');
      expect(result).toContain(VIDEO_MOVEMENT_MODIFIERS.WIDE);
    });

    it('should include the scene name', () => {
      const result = buildVideoPrompt(makeSceneSet({ name: 'Penthouse' }), 'WIDE');
      expect(result).toContain('Scene: Penthouse.');
    });

    it('should include quality instructions', () => {
      const result = buildVideoPrompt(makeSceneSet(), 'WIDE');
      expect(result).toContain('Photorealistic quality');
      expect(result).toContain('No morphing');
      expect(result).toContain('No text overlays');
    });

    it('should default to WIDE movement for unknown angle labels', () => {
      const result = buildVideoPrompt(makeSceneSet(), 'NONEXISTENT');
      expect(result).toContain(VIDEO_MOVEMENT_MODIFIERS.WIDE);
    });

    it('should use customCameraDirection when provided', () => {
      const custom = 'Slow orbit around the subject';
      const result = buildVideoPrompt(makeSceneSet(), 'CLOSE', custom);
      expect(result).toContain(`Camera movement: ${custom}`);
      expect(result).not.toContain(VIDEO_MOVEMENT_MODIFIERS.CLOSE);
    });

    it('should NOT contain the full LALAVERSE anchor (video prompts are short)', () => {
      const result = buildVideoPrompt(makeSceneSet(), 'WIDE');
      expect(result).not.toContain(LALAVERSE_VISUAL_ANCHOR);
    });

    it('should NOT include the canonical_description (scene already in base image)', () => {
      const result = buildVideoPrompt(makeSceneSet(), 'WIDE');
      expect(result).not.toContain('cream-toned bedroom');
    });

    it('should produce valid prompts for every angle label', () => {
      const labels = Object.keys(VIDEO_MOVEMENT_MODIFIERS);
      labels.forEach((label) => {
        const result = buildVideoPrompt(makeSceneSet(), label);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain(VIDEO_MOVEMENT_MODIFIERS[label]);
      });
    });

    it('should be shorter than buildPrompt output', () => {
      const sceneSet = makeSceneSet();
      const imagePrompt = buildPrompt(sceneSet, 'WIDE');
      const videoPrompt = buildVideoPrompt(sceneSet, 'WIDE');
      expect(videoPrompt.length).toBeLessThan(imagePrompt.length);
    });
  });
});
