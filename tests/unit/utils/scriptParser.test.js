/**
 * scriptParser Unit Tests
 * Tests scene parsing, duration estimation, and content extraction
 */

const {
  parseScriptScenes,
  estimateSceneDuration,
  extractSceneContent,
} = require('../../../src/utils/scriptParser');

describe('scriptParser', () => {
  describe('parseScriptScenes', () => {
    it('should return empty array for null/undefined input', () => {
      expect(parseScriptScenes(null)).toEqual([]);
      expect(parseScriptScenes(undefined)).toEqual([]);
      expect(parseScriptScenes('')).toEqual([]);
    });

    it('should parse "SCENE N: Title" format', () => {
      const script = 'SCENE 1: The Opening\nSome scene content here.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].scene_number).toBe(1);
      expect(scenes[0].name).toBe('The Opening');
      expect(scenes[0].line_number).toBe(1);
      expect(scenes[0].raw_line).toBe('SCENE 1: The Opening');
    });

    it('should parse "INT. LOCATION - TIME" format', () => {
      const script = 'INT. FASHION STUDIO - DAY\nLala walks in.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe('DAY');
      expect(scenes[0].raw_line).toBe('INT. FASHION STUDIO - DAY');
    });

    it('should parse "EXT. LOCATION - TIME" format', () => {
      const script = 'EXT. ROOFTOP GARDEN - NIGHT\nThey meet on the roof.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe('NIGHT');
    });

    it('should parse "SCENE N - Title" format', () => {
      const script = 'SCENE 2 - The Reveal\nDrama unfolds.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe('The Reveal');
    });

    it('should parse "[SCENE N] Title" format', () => {
      const script = '[SCENE 3] Fashion Crisis\nLala panics.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe('Fashion Crisis');
    });

    it('should parse multiple scenes', () => {
      const script = [
        'SCENE 1: Opening',
        'Some content.',
        '',
        'SCENE 2: Middle',
        'More content.',
        '',
        'SCENE 3: Closing',
        'Final words.',
      ].join('\n');

      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(3);
      expect(scenes[0].scene_number).toBe(1);
      expect(scenes[1].scene_number).toBe(2);
      expect(scenes[2].scene_number).toBe(3);
    });

    it('should increment scene_number sequentially regardless of declared number', () => {
      const script = 'SCENE 5: Act Five\nContent.\nSCENE 10: Act Ten\nMore content.';
      const scenes = parseScriptScenes(script);
      expect(scenes[0].scene_number).toBe(1);
      expect(scenes[1].scene_number).toBe(2);
    });

    it('should set description to empty string', () => {
      const script = 'SCENE 1: Test Scene\nContent.';
      const scenes = parseScriptScenes(script);
      expect(scenes[0].description).toBe('');
    });

    it('should include correct line_number (1-indexed)', () => {
      const script = '\nSCENE 1: Second Line Scene\nContent.';
      const scenes = parseScriptScenes(script);
      expect(scenes[0].line_number).toBe(2);
    });

    it('should handle script with no scenes', () => {
      const script = 'This is a script with no scene headers.\nJust regular text.\nNo patterns here.';
      const scenes = parseScriptScenes(script);
      expect(scenes).toEqual([]);
    });

    it('should ignore blank lines', () => {
      const script = '\n\nSCENE 1: Title\n\n\nSCENE 2: Second\n\n';
      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(2);
    });

    it('should include raw_line in each scene', () => {
      const script = 'SCENE 1: Raw Test Scene';
      const scenes = parseScriptScenes(script);
      expect(scenes[0].raw_line).toBe('SCENE 1: Raw Test Scene');
    });
  });

  describe('estimateSceneDuration', () => {
    it('should return 60 for null/undefined input', () => {
      expect(estimateSceneDuration(null)).toBe(60);
      expect(estimateSceneDuration(undefined)).toBe(60);
      expect(estimateSceneDuration('')).toBe(60);
    });

    it('should return minimum 30 seconds for very short scenes', () => {
      const sceneText = 'One line.';
      expect(estimateSceneDuration(sceneText)).toBe(30);
    });

    it('should estimate 1 second per line', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
      expect(estimateSceneDuration(lines)).toBe(50);
    });

    it('should ignore blank lines in count', () => {
      const textWith50NonBlank = Array.from({ length: 50 }, (_, i) => `Line ${i}`).join('\n\n');
      const duration = estimateSceneDuration(textWith50NonBlank);
      expect(duration).toBe(50);
    });

    it('should return a rounded integer', () => {
      const result = estimateSceneDuration('Line 1\nLine 2\nLine 3');
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('extractSceneContent', () => {
    it('should extract content between two scene headers', () => {
      const script = [
        'SCENE 1: Opening',
        'First scene content.',
        'More first scene.',
        'SCENE 2: Middle',
        'Second scene content.',
      ].join('\n');

      const content = extractSceneContent(script, 1);
      expect(content).toContain('First scene content.');
      expect(content).toContain('More first scene.');
      expect(content).not.toContain('Second scene content.');
    });

    it('should extract content for the last scene to end of script', () => {
      const script = [
        'SCENE 1: Opening',
        'First scene.',
        'SCENE 2: Closing',
        'Last scene content.',
        'Ending line.',
      ].join('\n');

      const content = extractSceneContent(script, 2);
      expect(content).toContain('Last scene content.');
      expect(content).toContain('Ending line.');
    });

    it('should return empty string for scene number beyond total scenes', () => {
      const script = 'SCENE 1: Only Scene\nContent.';
      const content = extractSceneContent(script, 5);
      expect(content).toBe('');
    });

    it('should not include the scene header line itself in content', () => {
      const script = [
        'SCENE 1: My Scene',
        'Body content.',
        'SCENE 2: Next',
      ].join('\n');

      const content = extractSceneContent(script, 1);
      expect(content).not.toContain('SCENE 1: My Scene');
    });
  });
});
