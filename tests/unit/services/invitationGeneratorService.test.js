/**
 * invitationGeneratorService unit tests
 *
 * Regression coverage for Task #1425: generateInvitation() referenced an
 * undefined `compositeInvitation` (dropped from the destructured import of
 * ./invitationCompositingService). Every call threw a ReferenceError before
 * reaching S3 upload or asset creation.
 */
jest.mock('axios');

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn((args) => args),
  DeleteObjectCommand: jest.fn((args) => args),
}));

jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid') }));

// generateInvitation's local callDallE3() helper (line 139) wraps
// generateImageUrl() from this module — not axios.post — so mocking it here
// is what lets execution reach the compositeInvitation call at line 378.
jest.mock('../../../src/services/imageGenerationService', () => ({
  generateImageUrl: jest.fn().mockResolvedValue('https://example.com/background.png'),
}));

const mockCompositeInvitation = jest.fn().mockResolvedValue(Buffer.from('final-png'));

jest.mock('../../../src/services/invitationCompositingService', () => ({
  detectTheme: jest.fn(() => 'honey luxe'),
  buildInvitationContent: jest.fn().mockResolvedValue(null),
  compositeInvitation: (...args) => mockCompositeInvitation(...args),
  compositeInvitationPDF: jest.fn(),
}));

const axios = require('axios');
const { generateInvitation } = require('../../../src/services/invitationGeneratorService');

describe('invitationGeneratorService.generateInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: Buffer.from('background-bytes') });
  });

  it('calls compositeInvitation instead of throwing a ReferenceError', async () => {
    const event = {
      id: 'evt-1',
      name: 'Golden Hour Gala',
      canon_consequences: {},
      prestige: 5,
    };

    const sequelize = {
      query: jest.fn()
        .mockResolvedValueOnce([event]) // load event
        .mockResolvedValueOnce([{ count: '0' }]) // getNextVersion
        .mockResolvedValueOnce([]), // invitation_text update
      QueryTypes: { SELECT: 'SELECT' },
    };

    const models = {
      sequelize,
      Asset: { create: jest.fn().mockResolvedValue({ id: 'asset-1' }) },
    };

    const result = await generateInvitation('evt-1', models, 'show-1');

    expect(mockCompositeInvitation).toHaveBeenCalledTimes(1);
    expect(mockCompositeInvitation).toHaveBeenCalledWith(
      expect.any(Buffer),
      event,
      expect.objectContaining({ eventName: 'Golden Hour Gala' })
    );
    expect(result.success).toBe(true);
  });
});
