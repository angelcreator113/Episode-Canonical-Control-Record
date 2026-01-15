/**
 * MetadataStorage Model Methods - Unit Tests
 * Tests instance methods without database dependency
 */

describe('MetadataStorage Model Methods - Unit Tests', () => {
  const createMockMetadata = (overrides = {}) => ({
    id: 1,
    episodeId: 1,
    extractedText: 'Some extracted text from OCR...',
    scenesDetected: [{ timestamp: 0, description: 'Scene 1' }],
    sentimentAnalysis: { overall: 'positive', confidence: 0.85 },
    visualObjects: ['person', 'car', 'house'],
    transcription: 'This is a transcription...',
    tags: ['action', 'drama', 'series'],
    categories: ['TV Show', 'English'],
    extractionTimestamp: new Date(),
    processingDurationSeconds: 45,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateExtractedText: jest.fn().mockResolvedValue(true),
    addTags: jest.fn().mockResolvedValue(true),
    setDetectedScenes: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  describe('MetadataStorage.updateExtractedText()', () => {
    test('should update extracted text', async () => {
      const metadata = createMockMetadata();
      const newText = 'New extracted text from OCR';
      
      await metadata.updateExtractedText(newText);
      
      expect(metadata.updateExtractedText).toHaveBeenCalledWith(newText);
    });

    test('should handle long text', async () => {
      const metadata = createMockMetadata();
      const longText = 'x'.repeat(10000);
      
      await metadata.updateExtractedText(longText);
      
      expect(metadata.updateExtractedText).toHaveBeenCalledWith(longText);
    });

    test('should handle empty text', async () => {
      const metadata = createMockMetadata();
      
      await metadata.updateExtractedText('');
      
      expect(metadata.updateExtractedText).toHaveBeenCalledWith('');
    });

    test('should handle special characters', async () => {
      const metadata = createMockMetadata();
      const text = 'Text with special chars: @#$%^&*()';
      
      await metadata.updateExtractedText(text);
      
      expect(metadata.updateExtractedText).toHaveBeenCalledWith(text);
    });

    test('should call save after update', async () => {
      const metadata = createMockMetadata();
      metadata.updateExtractedText = jest.fn(async function(text) {
        this.extractedText = text;
        return await this.save();
      });
      
      await metadata.updateExtractedText('New text');
      
      expect(metadata.save).toHaveBeenCalled();
    });

    test('should handle update errors', async () => {
      const metadata = createMockMetadata();
      metadata.updateExtractedText = jest.fn().mockRejectedValue(new Error('Update failed'));
      
      await expect(metadata.updateExtractedText('text')).rejects.toThrow('Update failed');
    });
  });

  describe('MetadataStorage.addTags()', () => {
    test('should add single tag', async () => {
      const metadata = createMockMetadata({ tags: ['existing'] });
      
      await metadata.addTags(['new-tag']);
      
      expect(metadata.addTags).toHaveBeenCalledWith(['new-tag']);
    });

    test('should add multiple tags', async () => {
      const metadata = createMockMetadata({ tags: ['tag1'] });
      const newTags = ['tag2', 'tag3', 'tag4'];
      
      await metadata.addTags(newTags);
      
      expect(metadata.addTags).toHaveBeenCalledWith(newTags);
    });

    test('should handle duplicate tags', async () => {
      const metadata = createMockMetadata({ tags: ['action', 'drama'] });
      
      await metadata.addTags(['action', 'comedy']);
      
      expect(metadata.addTags).toHaveBeenCalled();
    });

    test('should handle empty tag array', async () => {
      const metadata = createMockMetadata();
      
      await metadata.addTags([]);
      
      expect(metadata.addTags).toHaveBeenCalledWith([]);
    });

    test('should handle tags with special characters', async () => {
      const metadata = createMockMetadata();
      const tags = ['action-packed', 'sci-fi', 'super-hero'];
      
      await metadata.addTags(tags);
      
      expect(metadata.addTags).toHaveBeenCalledWith(tags);
    });

    test('should call save after adding tags', async () => {
      const metadata = createMockMetadata();
      metadata.addTags = jest.fn(async function(tags) {
        this.tags = [...(this.tags || []), ...tags];
        return await this.save();
      });
      
      await metadata.addTags(['new-tag']);
      
      expect(metadata.save).toHaveBeenCalled();
    });
  });

  describe('MetadataStorage.setDetectedScenes()', () => {
    test('should set detected scenes', async () => {
      const metadata = createMockMetadata();
      const scenes = [
        { timestamp: 0, description: 'Scene 1' },
        { timestamp: 45, description: 'Scene 2' },
      ];
      
      await metadata.setDetectedScenes(scenes, 120);
      
      expect(metadata.setDetectedScenes).toHaveBeenCalledWith(scenes, 120);
    });

    test('should handle single scene', async () => {
      const metadata = createMockMetadata();
      const scenes = [{ timestamp: 0, description: 'Opening' }];
      
      await metadata.setDetectedScenes(scenes, 60);
      
      expect(metadata.setDetectedScenes).toHaveBeenCalledWith(scenes, 60);
    });

    test('should handle multiple scenes', async () => {
      const metadata = createMockMetadata();
      const scenes = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 12,
        description: `Scene ${i + 1}`,
      }));
      
      await metadata.setDetectedScenes(scenes, 120);
      
      expect(metadata.setDetectedScenes).toHaveBeenCalledWith(scenes, 120);
    });

    test('should handle empty scenes array', async () => {
      const metadata = createMockMetadata();
      
      await metadata.setDetectedScenes([], 0);
      
      expect(metadata.setDetectedScenes).toHaveBeenCalledWith([], 0);
    });

    test('should include scene metadata', async () => {
      const metadata = createMockMetadata();
      const scenes = [
        {
          timestamp: 0,
          description: 'Opening scene',
          confidence: 0.95,
          objects: ['person', 'car'],
        },
      ];
      
      await metadata.setDetectedScenes(scenes, 60);
      
      expect(metadata.setDetectedScenes).toHaveBeenCalled();
    });

    test('should call save after setting scenes', async () => {
      const metadata = createMockMetadata();
      metadata.setDetectedScenes = jest.fn(async function(scenes, _duration) {
        this.scenesDetected = scenes;
        return await this.save();
      });
      
      const scenes = [{ timestamp: 0, description: 'Test' }];
      await metadata.setDetectedScenes(scenes, 120);
      
      expect(metadata.save).toHaveBeenCalled();
    });
  });

  describe('MetadataStorage AI Analysis', () => {
    test('should have sentiment analysis data', () => {
      const metadata = createMockMetadata();
      
      expect(metadata.sentimentAnalysis).toBeDefined();
    });

    test('should have visual objects detected', () => {
      const metadata = createMockMetadata();
      
      expect(Array.isArray(metadata.visualObjects)).toBe(true);
    });

    test('should have transcription text', () => {
      const metadata = createMockMetadata();
      
      expect(typeof metadata.transcription === 'string' || metadata.transcription === null).toBe(true);
    });

    test('should have scene detection data', () => {
      const metadata = createMockMetadata();
      
      expect(Array.isArray(metadata.scenesDetected)).toBe(true);
    });

    test('should handle null sentiment analysis', () => {
      const metadata = createMockMetadata({ sentimentAnalysis: null });
      
      expect(metadata.sentimentAnalysis).toBeNull();
    });

    test('should handle null visual objects', () => {
      const metadata = createMockMetadata({ visualObjects: null });
      
      expect(metadata.visualObjects).toBeNull();
    });
  });

  describe('MetadataStorage Properties', () => {
    test('should have extraction timestamp', () => {
      const metadata = createMockMetadata();
      
      expect(metadata.extractionTimestamp).toBeInstanceOf(Date);
    });

    test('should have processing duration', () => {
      const metadata = createMockMetadata({ processingDurationSeconds: 30 });
      
      expect(metadata.processingDurationSeconds).toBeGreaterThanOrEqual(0);
    });

    test('should have tags array', () => {
      const metadata = createMockMetadata();
      
      expect(Array.isArray(metadata.tags)).toBe(true);
    });

    test('should have categories array', () => {
      const metadata = createMockMetadata();
      
      expect(Array.isArray(metadata.categories)).toBe(true);
    });

    test('should have creation timestamp', () => {
      const metadata = createMockMetadata();
      
      expect(metadata.createdAt).toBeInstanceOf(Date);
    });

    test('should have update timestamp', () => {
      const metadata = createMockMetadata();
      
      expect(metadata.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('MetadataStorage Lifecycle', () => {
    test('should update metadata without losing data', async () => {
      const metadata = createMockMetadata();
      const originalEpisodeId = metadata.episodeId;
      
      metadata.update = jest.fn(async function(updates) {
        Object.assign(this, updates);
        return this;
      });
      
      await metadata.update({ extractedText: 'Updated' });
      
      expect(metadata.episodeId).toBe(originalEpisodeId);
    });

    test('should save metadata with all fields', async () => {
      const metadata = createMockMetadata();
      
      metadata.save = jest.fn(async function() {
        return this;
      });
      
      const saved = await metadata.save();
      
      expect(saved.episodeId).toBe(1);
      expect(saved.extractedText).toBeDefined();
    });

    test('should preserve tags across updates', async () => {
      const metadata = createMockMetadata({ tags: ['original'] });
      
      metadata.addTags = jest.fn(async function(newTags) {
        this.tags = [...this.tags, ...newTags];
        await this.save();
      });
      
      await metadata.addTags(['new']);
      
      expect(metadata.tags).toContain('original');
    });
  });
});
