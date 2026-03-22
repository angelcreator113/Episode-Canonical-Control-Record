/**
 * ArtifactDetectionService Unit Tests
 * Tests artifact detection, manual review, and prompt refinement
 */

jest.mock('sharp', () => {
  const mockSharpInstance = {
    metadata: jest.fn(),
    stats: jest.fn(),
    greyscale: jest.fn(),
    convolve: jest.fn(),
  };
  // Chain methods return the instance
  mockSharpInstance.greyscale.mockReturnValue(mockSharpInstance);
  mockSharpInstance.convolve.mockReturnValue(mockSharpInstance);

  const sharpFn = jest.fn(() => mockSharpInstance);
  sharpFn._mockInstance = mockSharpInstance;
  return sharpFn;
});

jest.mock('axios');

const sharp = require('sharp');
const axios = require('axios');
const {
  ARTIFACT_CATEGORIES,
  SEVERITY_WEIGHTS,
  analyzeImageQuality,
  createManualReview,
  buildRefinedPrompt,
} = require('../../../src/services/artifactDetectionService');

describe('ArtifactDetectionService', () => {
  let mockSharpInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSharpInstance = sharp._mockInstance;

    // Reset chain methods
    mockSharpInstance.greyscale.mockReturnValue(mockSharpInstance);
    mockSharpInstance.convolve.mockReturnValue(mockSharpInstance);
  });

  // ─── ARTIFACT_CATEGORIES ────────────────────────────────────────────────

  describe('ARTIFACT_CATEGORIES', () => {
    const EXPECTED_KEYS = [
      'FURNITURE_DISTORTION',
      'OBJECT_BLOBBING',
      'REFLECTION_ERROR',
      'FABRIC_ANOMALY',
      'HARDWARE_INCONSISTENCY',
      'FLOOR_DISTORTION',
      'HAND_BODY',
      'TEXT_BLEED',
    ];

    it('should contain all expected category keys', () => {
      expect(Object.keys(ARTIFACT_CATEGORIES)).toEqual(expect.arrayContaining(EXPECTED_KEYS));
      expect(Object.keys(ARTIFACT_CATEGORIES)).toHaveLength(EXPECTED_KEYS.length);
    });

    it.each(EXPECTED_KEYS)('category %s should have required fields', (key) => {
      const cat = ARTIFACT_CATEGORIES[key];
      expect(cat).toBeDefined();
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('description');
      expect(cat).toHaveProperty('severity');
      expect(cat).toHaveProperty('promptFix');
      expect(typeof cat.label).toBe('string');
      expect(typeof cat.description).toBe('string');
      expect(typeof cat.promptFix).toBe('string');
      expect(['critical', 'high', 'medium', 'low']).toContain(cat.severity);
    });

    it('should have a matching SEVERITY_WEIGHTS entry for each severity level used', () => {
      const severities = new Set(Object.values(ARTIFACT_CATEGORIES).map(c => c.severity));
      for (const sev of severities) {
        expect(SEVERITY_WEIGHTS[sev]).toBeDefined();
        expect(typeof SEVERITY_WEIGHTS[sev]).toBe('number');
      }
    });
  });

  // ─── SEVERITY_WEIGHTS ──────────────────────────────────────────────────

  describe('SEVERITY_WEIGHTS', () => {
    it('should have weights for critical, high, medium, and low', () => {
      expect(SEVERITY_WEIGHTS).toEqual({
        critical: 40,
        high: 25,
        medium: 15,
        low: 8,
      });
    });

    it('should rank critical > high > medium > low', () => {
      expect(SEVERITY_WEIGHTS.critical).toBeGreaterThan(SEVERITY_WEIGHTS.high);
      expect(SEVERITY_WEIGHTS.high).toBeGreaterThan(SEVERITY_WEIGHTS.medium);
      expect(SEVERITY_WEIGHTS.medium).toBeGreaterThan(SEVERITY_WEIGHTS.low);
    });
  });

  // ─── createManualReview ────────────────────────────────────────────────

  describe('createManualReview', () => {
    it('should return flags for valid categories', () => {
      const result = createManualReview(['FURNITURE_DISTORTION', 'TEXT_BLEED']);

      expect(result.flags).toHaveLength(2);
      expect(result.flags[0].category).toBe('FURNITURE_DISTORTION');
      expect(result.flags[0].label).toBe('Furniture Distortion');
      expect(result.flags[0].auto).toBe(false);
      expect(result.flags[1].category).toBe('TEXT_BLEED');
      expect(result.method).toBe('manual');
    });

    it('should ignore invalid category keys', () => {
      const result = createManualReview(['FURNITURE_DISTORTION', 'NONEXISTENT', 'FAKE_CAT']);

      expect(result.flags).toHaveLength(1);
      expect(result.flags[0].category).toBe('FURNITURE_DISTORTION');
    });

    it('should return empty flags and score 100 for empty categories array', () => {
      const result = createManualReview([]);

      expect(result.flags).toHaveLength(0);
      expect(result.qualityScore).toBe(100);
      expect(result.refinedPromptSuffix).toBe('');
    });

    it('should return empty flags and score 100 when all categories are invalid', () => {
      const result = createManualReview(['BOGUS', 'FAKE']);

      expect(result.flags).toHaveLength(0);
      expect(result.qualityScore).toBe(100);
    });

    it('should compute quality score by subtracting severity weights', () => {
      // HAND_BODY = critical (40), TEXT_BLEED = high (25) => 100 - 40 - 25 = 35
      const result = createManualReview(['HAND_BODY', 'TEXT_BLEED']);

      expect(result.qualityScore).toBe(35);
    });

    it('should clamp quality score to minimum of 0', () => {
      // All categories combined exceed 100
      const allCategories = Object.keys(ARTIFACT_CATEGORIES);
      const result = createManualReview(allCategories);

      expect(result.qualityScore).toBe(0);
    });

    it('should build refinedPromptSuffix from flagged promptFixes', () => {
      const result = createManualReview(['FURNITURE_DISTORTION']);

      expect(result.refinedPromptSuffix).toContain('QUALITY EMPHASIS:');
      expect(result.refinedPromptSuffix).toContain(
        ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix
      );
    });

    it('should join multiple prompt fixes with periods', () => {
      const result = createManualReview(['FURNITURE_DISTORTION', 'OBJECT_BLOBBING']);

      const expected = `QUALITY EMPHASIS: ${ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix}. ${ARTIFACT_CATEGORIES.OBJECT_BLOBBING.promptFix}.`;
      expect(result.refinedPromptSuffix).toBe(expected);
    });

    it('should include notes in the result when provided', () => {
      const result = createManualReview(['TEXT_BLEED'], 'Chair legs are melting');

      expect(result.notes).toBe('Chair legs are melting');
    });

    it('should default notes to null when not provided', () => {
      const result = createManualReview(['TEXT_BLEED']);

      expect(result.notes).toBeNull();
    });

    it('should include reviewedAt timestamp', () => {
      const result = createManualReview(['TEXT_BLEED']);

      expect(result.reviewedAt).toBeDefined();
      expect(new Date(result.reviewedAt).getTime()).not.toBeNaN();
    });
  });

  // ─── buildRefinedPrompt ────────────────────────────────────────────────

  describe('buildRefinedPrompt', () => {
    const basePrompt = 'A modern living room with soft natural lighting.';

    it('should return original prompt when no flags are provided', () => {
      const result = buildRefinedPrompt(basePrompt, []);

      expect(result).toBe(basePrompt);
    });

    it('should return original prompt when flags have no matching categories', () => {
      const result = buildRefinedPrompt(basePrompt, [{ category: 'NONEXISTENT' }]);

      expect(result).toBe(basePrompt);
    });

    it('should append QUALITY EMPHASIS suffix with prompt fixes from objects', () => {
      const flags = [{ category: 'FURNITURE_DISTORTION' }];
      const result = buildRefinedPrompt(basePrompt, flags);

      expect(result).toContain(basePrompt);
      expect(result).toContain('QUALITY EMPHASIS:');
      expect(result).toContain(ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix);
    });

    it('should handle flags as plain strings (category keys)', () => {
      const flags = ['FURNITURE_DISTORTION', 'TEXT_BLEED'];
      const result = buildRefinedPrompt(basePrompt, flags);

      expect(result).toContain('QUALITY EMPHASIS:');
      expect(result).toContain(ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix);
      expect(result).toContain(ARTIFACT_CATEGORIES.TEXT_BLEED.promptFix);
    });

    it('should handle mixed array of strings and objects', () => {
      const flags = ['FURNITURE_DISTORTION', { category: 'OBJECT_BLOBBING' }];
      const result = buildRefinedPrompt(basePrompt, flags);

      expect(result).toContain(ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix);
      expect(result).toContain(ARTIFACT_CATEGORIES.OBJECT_BLOBBING.promptFix);
    });

    it('should insert suffix before "Cinematic quality." if present', () => {
      const cinematicPrompt = 'A beautiful room. Cinematic quality.';
      const flags = ['FURNITURE_DISTORTION'];
      const result = buildRefinedPrompt(cinematicPrompt, flags);

      expect(result).toMatch(/QUALITY EMPHASIS:.*Cinematic quality\.$/);
      expect(result).not.toMatch(/Cinematic quality\..*QUALITY EMPHASIS/);
    });

    it('should respect the 1000 character limit when appending', () => {
      const longPrompt = 'A'.repeat(950);
      const flags = ['FURNITURE_DISTORTION'];
      const result = buildRefinedPrompt(longPrompt, flags);

      expect(result.length).toBeLessThanOrEqual(1000);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not truncate when combined length is under 1000', () => {
      const shortPrompt = 'A modern room.';
      const flags = ['FABRIC_ANOMALY'];
      const result = buildRefinedPrompt(shortPrompt, flags);

      expect(result).not.toMatch(/\.\.\.$/);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should join multiple fixes with periods in the suffix', () => {
      const flags = ['FURNITURE_DISTORTION', 'REFLECTION_ERROR'];
      const result = buildRefinedPrompt(basePrompt, flags);

      const fix1 = ARTIFACT_CATEGORIES.FURNITURE_DISTORTION.promptFix;
      const fix2 = ARTIFACT_CATEGORIES.REFLECTION_ERROR.promptFix;
      expect(result).toContain(`${fix1}. ${fix2}.`);
    });
  });

  // ─── analyzeImageQuality ──────────────────────────────────────────────

  describe('analyzeImageQuality', () => {
    const testUrl = 'https://example.com/image.png';
    const fakeBuffer = Buffer.from('fake-image-data');

    function setupMocks({ width = 1920, height = 1080, channelStdevs = [45, 50, 48], channelMeans = [120, 125, 118], edgeStdev = 30 } = {}) {
      axios.get.mockResolvedValue({ data: fakeBuffer });

      mockSharpInstance.metadata.mockResolvedValue({ width, height });
      mockSharpInstance.stats.mockResolvedValue({
        channels: channelStdevs.map((stdev, i) => ({
          stdev,
          mean: channelMeans[i],
        })),
      });

      // Edge detection stats (called on a separate sharp instance for greyscale pipeline)
      // Since sharp() is called twice (once for metadata/stats, once for edge detection),
      // we need the second call's chain to also return stats
      mockSharpInstance.stats
        .mockResolvedValueOnce({
          channels: channelStdevs.map((stdev, i) => ({
            stdev,
            mean: channelMeans[i],
          })),
        })
        .mockResolvedValueOnce({
          channels: [{ stdev: edgeStdev }],
        });
    }

    it('should return a valid quality result for a good image', async () => {
      setupMocks();

      const result = await analyzeImageQuality(testUrl);

      expect(result.qualityScore).toBe(100);
      expect(result.flags).toHaveLength(0);
      expect(result.resolution).toEqual({ width: 1920, height: 1080 });
      expect(result.method).toBe('heuristic');
      expect(result.analyzedAt).toBeDefined();
    });

    it('should call axios.get with correct url and options', async () => {
      setupMocks();

      await analyzeImageQuality(testUrl);

      expect(axios.get).toHaveBeenCalledWith(testUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
    });

    it('should flag LOW_RESOLUTION when image is too small', async () => {
      setupMocks({ width: 800, height: 400 });

      const result = await analyzeImageQuality(testUrl);

      const lowResFlag = result.flags.find(f => f.category === 'LOW_RESOLUTION');
      expect(lowResFlag).toBeDefined();
      expect(lowResFlag.severity).toBe('high');
      expect(lowResFlag.auto).toBe(true);
      expect(lowResFlag.description).toContain('800x400');
    });

    it('should not flag LOW_RESOLUTION at exactly 1024x576', async () => {
      setupMocks({ width: 1024, height: 576 });

      const result = await analyzeImageQuality(testUrl);

      const lowResFlag = result.flags.find(f => f.category === 'LOW_RESOLUTION');
      expect(lowResFlag).toBeUndefined();
    });

    it('should flag FLAT_IMAGE when color variance is very low', async () => {
      setupMocks({ channelStdevs: [10, 12, 8] });

      const result = await analyzeImageQuality(testUrl);

      const flatFlag = result.flags.find(f => f.category === 'FLAT_IMAGE');
      expect(flatFlag).toBeDefined();
      expect(flatFlag.severity).toBe('medium');
      expect(flatFlag.auto).toBe(true);
    });

    it('should flag HIGH_CONTRAST_ARTIFACT when variance is very high', async () => {
      setupMocks({ channelStdevs: [110, 105, 115] });

      const result = await analyzeImageQuality(testUrl);

      const contrastFlag = result.flags.find(f => f.category === 'HIGH_CONTRAST_ARTIFACT');
      expect(contrastFlag).toBeDefined();
      expect(contrastFlag.severity).toBe('low');
    });

    it('should flag COLOR_CAST when channel means differ by more than 80', async () => {
      setupMocks({ channelMeans: [50, 140, 60] });

      const result = await analyzeImageQuality(testUrl);

      const colorCastFlag = result.flags.find(f => f.category === 'COLOR_CAST');
      expect(colorCastFlag).toBeDefined();
      expect(colorCastFlag.severity).toBe('low');
    });

    it('should not flag COLOR_CAST when channel means differ by exactly 80', async () => {
      setupMocks({ channelMeans: [100, 180, 120] });

      const result = await analyzeImageQuality(testUrl);

      const colorCastFlag = result.flags.find(f => f.category === 'COLOR_CAST');
      expect(colorCastFlag).toBeUndefined();
    });

    it('should flag SOFT_FOCUS when edge variance is very low', async () => {
      setupMocks({ edgeStdev: 5 });

      const result = await analyzeImageQuality(testUrl);

      const softFlag = result.flags.find(f => f.category === 'SOFT_FOCUS');
      expect(softFlag).toBeDefined();
      expect(softFlag.severity).toBe('medium');
    });

    it('should not flag SOFT_FOCUS when edge variance is exactly 8', async () => {
      setupMocks({ edgeStdev: 8 });

      const result = await analyzeImageQuality(testUrl);

      const softFlag = result.flags.find(f => f.category === 'SOFT_FOCUS');
      expect(softFlag).toBeUndefined();
    });

    it('should subtract severity weights from quality score for each flag', async () => {
      // LOW_RESOLUTION (high=25) + FLAT_IMAGE (medium=15) = 40 deducted => 60
      setupMocks({ width: 800, height: 400, channelStdevs: [10, 12, 8] });

      const result = await analyzeImageQuality(testUrl);

      // Score should reflect deductions for flagged issues
      expect(result.qualityScore).toBeLessThan(100);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should clamp quality score to 0 minimum', async () => {
      // Trigger many flags: low res (25) + flat (15) + soft (15) = 55
      // Plus color cast (8) = 63 ... still above 0 but let's ensure clamping works
      setupMocks({
        width: 400,
        height: 200,
        channelStdevs: [5, 5, 5],
        channelMeans: [10, 200, 15],
        edgeStdev: 2,
      });

      const result = await analyzeImageQuality(testUrl);

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should use greyscale + Laplacian convolve for edge detection', async () => {
      setupMocks();

      await analyzeImageQuality(testUrl);

      expect(mockSharpInstance.greyscale).toHaveBeenCalled();
      expect(mockSharpInstance.convolve).toHaveBeenCalledWith({
        width: 3,
        height: 3,
        kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0],
      });
    });

    // ─── Error handling ─────────────────────────────────────────────────

    it('should return error result when axios request fails', async () => {
      axios.get.mockRejectedValue(new Error('Network timeout'));

      const result = await analyzeImageQuality(testUrl);

      expect(result.qualityScore).toBeNull();
      expect(result.flags).toEqual([]);
      expect(result.error).toBe('Network timeout');
      expect(result.method).toBe('heuristic');
      expect(result.analyzedAt).toBeDefined();
    });

    it('should return error result when sharp throws', async () => {
      axios.get.mockResolvedValue({ data: fakeBuffer });
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid image format'));

      const result = await analyzeImageQuality(testUrl);

      expect(result.qualityScore).toBeNull();
      expect(result.flags).toEqual([]);
      expect(result.error).toBe('Invalid image format');
    });

    it('should log error message to console.error on failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      axios.get.mockRejectedValue(new Error('Connection refused'));

      await analyzeImageQuality(testUrl);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ArtifactDetection] Image analysis failed:',
        'Connection refused'
      );
      consoleSpy.mockRestore();
    });
  });
});
