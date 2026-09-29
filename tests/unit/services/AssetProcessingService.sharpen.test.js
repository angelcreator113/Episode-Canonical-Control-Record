/**
 * smoothSkin's sharpen call shape (Task #2332, sharp 0.34 → 0.35).
 *
 * sharp 0.35 removed the numeric form sharpen(sigma): a number is no longer
 * read as sigma but silently falls back to the default mild sharpen. The
 * 0.34 call sharpen(0.5) meant sigma 0.5, so it is now written
 * sharpen({ sigma: 0.5 }), which means the same on both versions. This test
 * pins that shape; the real-sharp test beside it pins what it does.
 */
const mockSharpInstance = {
  modulate: jest.fn().mockReturnThis(),
  blur: jest.fn().mockReturnThis(),
  sharpen: jest.fn().mockReturnThis(),
  normalize: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('out')),
};
jest.mock('sharp', () => jest.fn(() => mockSharpInstance));
jest.mock('axios', () => ({ get: jest.fn().mockResolvedValue({ data: Buffer.from('in') }) }));
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({ putObject: jest.fn(() => ({ promise: () => Promise.resolve({}) })) })),
}));
jest.mock('../../../src/middleware/auditLog', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

const service = require('../../../src/services/AssetProcessingService');

describe('AssetProcessingService.smoothSkin sharpen shape', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sharpens with { sigma: 0.5 }, never the bare number', async () => {
    await service.smoothSkin('https://example.test/in.png');
    expect(mockSharpInstance.sharpen).toHaveBeenCalledTimes(1);
    expect(mockSharpInstance.sharpen).toHaveBeenCalledWith({ sigma: 0.5 });
  });

  it('autoEnhance keeps the no-argument default sharpen', async () => {
    await service.autoEnhance('https://example.test/in.png');
    expect(mockSharpInstance.sharpen).toHaveBeenCalledWith();
  });
});
