/**
 * AI help in the Thumbnail Studio (Evoni, 2026-10-21): title ideas (one
 * Haiku call, refused past the daily AI budget) and a picture's background
 * removed (the poses' remove.bg step, within the image budget). Claude,
 * remove.bg and S3 are mocked.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const mockRemove = jest.fn();
const mockClean = jest.fn();
jest.mock('../../../src/services/episodePoseMedia', () => ({
  removeBackground: (...a) => mockRemove(...a),
  cleanEdges: (...a) => mockClean(...a),
}));

const mockGenerate = jest.fn();
jest.mock('../../../src/services/imageGenerationService', () => ({ generateImage: (...a) => mockGenerate(...a) }));
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({ get: (...a) => mockAxiosGet(...a) }));

const mockYt = {};
jest.mock('../../../src/services/youtubeThumbnailService', () => {
  class ThumbnailError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  return Object.assign(mockYt, { ThumbnailError });
});

const ai = require('../../../src/services/thumbnailAiService');

const SOURCES = {
  episode: { id: 'ep-1', title: 'Gala Night', episode_number: 4 },
  show: { id: 'show-1', name: 'Styling Adventures with Lala' },
  suggest: {
    edition: 'Gala Night',
    checklist: [{ text: 'Dress', checked: true }, { text: 'Heels', checked: true }],
    pieces: [{ url: 'https://b.s3.amazonaws.com/d.png', label: 'Red satin gown' }],
  },
};
const answer = (text) => ({ content: [{ type: 'text', text }] });

describe('thumbnailAiService', () => {
  const env = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockYt.sources = jest.fn().mockResolvedValue(SOURCES);
    mockYt.allowedImageUrl = (u) => /^https:\/\/b\.s3\.amazonaws\.com\//.test(u);
    mockYt.fetchImage = jest.fn().mockResolvedValue(Buffer.from('jpg'));
    mockYt.uploadPicture = jest.fn().mockResolvedValue({ url: 'https://b.s3.amazonaws.com/up/cut.png', label: 'Gown cut out' });
  });
  afterAll(() => { process.env.ANTHROPIC_API_KEY = env; });

  test('readIdeas: titles and hooks kept to size, repeats and empty ones dropped, at most five', () => {
    const text = `Here you go: ${JSON.stringify({ ideas: [
      { title: 'Red Gown, Real Budget', hook: 'WORTH IT?' },
      { title: 'red gown, real budget', hook: 'again' },
      { title: '', hook: 'nothing' },
      { title: 'x'.repeat(80), hook: 'y'.repeat(30) },
      { title: 'A', hook: '' }, { title: 'B' }, { title: 'C' }, { title: 'D' },
    ] })}`;
    const ideas = ai.readIdeas(text);
    expect(ideas).toHaveLength(5);
    expect(ideas[0]).toEqual({ title: 'Red Gown, Real Budget', hook: 'WORTH IT?' });
    expect(ideas[1].title).toHaveLength(ai.TITLE_MAX);
    expect(ideas[1].hook).toHaveLength(ai.HOOK_MAX);
    expect(ai.readIdeas('no json here')).toEqual([]);
    expect(ai.readIdeas('{"ideas": [ broken')).toEqual([]);
  });

  test('titleIdeas: one Haiku call written from the episode\'s own words', async () => {
    mockCreate.mockResolvedValue(answer('{"ideas":[{"title":"The $40 Gala Gown","hook":"$40 FIND"}]}'));
    expect(await ai.titleIdeas({}, 'ep-1')).toEqual([{ title: 'The $40 Gala Gown', hook: '$40 FIND' }]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [params] = mockCreate.mock.calls[0];
    expect(params.model).toBe('claude-haiku-4-5-20251001');
    const prompt = params.messages[0].content;
    for (const words of ['Styling Adventures with Lala', 'Episode 4: Gala Night', 'Checklist: Dress, Heels', 'Outfit pieces: Red satin gown']) {
      expect(prompt).toContain(words);
    }
  });

  test('titleIdeas: an answer without ideas is tried once more; two failures say so', async () => {
    mockCreate.mockResolvedValueOnce(answer('Sorry, no JSON')).mockResolvedValueOnce(answer('{"ideas":[{"title":"Gala Ready","hook":"NEW"}]}'));
    expect(await ai.titleIdeas({}, 'ep-1')).toEqual([{ title: 'Gala Ready', hook: 'NEW' }]);
    mockCreate.mockReset();
    mockCreate.mockRejectedValue(new Error('overloaded'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ai.titleIdeas({}, 'ep-1')).rejects.toMatchObject({ status: 502, message: expect.stringContaining('overloaded') });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('titleIdeas: past the daily AI budget it is a 429 with the reason, not tried again; without a key a 503', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    await expect(ai.titleIdeas({}, 'ep-1')).rejects.toMatchObject({ status: 429, message: expect.stringContaining('budget') });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    delete process.env.ANTHROPIC_API_KEY;
    await expect(ai.titleIdeas({}, 'ep-1')).rejects.toMatchObject({ status: 503 });
  });

  test('cutOut: the picture\'s background removed (any subject), its edges cleaned, kept as an upload', async () => {
    mockRemove.mockResolvedValue({ buffer: Buffer.from('cut'), provider: 'remove.bg' });
    mockClean.mockResolvedValue({ buffer: Buffer.from('clean'), width: 10, height: 10 });
    const out = await ai.cutOut('ep-1', 'https://b.s3.amazonaws.com/gown.jpg', 'Gown');
    expect(mockRemove).toHaveBeenCalledWith(Buffer.from('jpg'), { type: 'auto' });
    expect(mockClean).toHaveBeenCalledWith(Buffer.from('cut'));
    expect(mockYt.uploadPicture).toHaveBeenCalledWith('ep-1', Buffer.from('clean'), 'Gown cut out');
    expect(out).toEqual({ url: 'https://b.s3.amazonaws.com/up/cut.png', label: 'Gown cut out', provider: 'remove.bg' });
  });

  test('cutOut: not one of our pictures 400; past the image budget 429; not set up 503; a failure 502', async () => {
    await expect(ai.cutOut('ep-1', 'https://elsewhere.example/x.png')).rejects.toMatchObject({ status: 400 });
    // The image budget's refusal (imageCostService), the same code as the AI budget's.
    mockRemove.mockRejectedValueOnce(Object.assign(new Error('Daily image budget reached ($10.00)'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    await expect(ai.cutOut('ep-1', 'https://b.s3.amazonaws.com/a.jpg')).rejects.toMatchObject({ status: 429, message: expect.stringContaining('image budget') });
    mockRemove.mockRejectedValueOnce(new Error('Background removal is not set up on the server (REMOVEBG_API_KEY).'));
    await expect(ai.cutOut('ep-1', 'https://b.s3.amazonaws.com/a.jpg')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('REMOVEBG_API_KEY') });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRemove.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(ai.cutOut('ep-1', 'https://b.s3.amazonaws.com/a.jpg')).rejects.toMatchObject({ status: 502 });
    expect(mockYt.uploadPicture).not.toHaveBeenCalled();
  });

  // Evoni, 2026-10-22: a background made from the episode's theme.
  test('backgroundPrompt: the show, the episode\'s theme and her words; a place only, no people or words', () => {
    const p = ai.backgroundPrompt(SOURCES, '  a rooftop   at night ');
    expect(p).toContain('"Styling Adventures with Lala"');
    expect(p).toContain('The episode: Gala Night.'); // the edition and the title are the same: once
    expect(p).toContain('The setting: a rooftop at night.');
    expect(p).toMatch(/no people, no faces, no hands, no text/);
    expect(ai.backgroundPrompt(SOURCES)).not.toContain('The setting');
    expect(ai.backgroundPrompt(SOURCES, 'x'.repeat(500))).toContain(`${'x'.repeat(ai.BACKGROUND_WORDS_MAX)}.`);
  });

  test('aiBackground: made wide, fetched, kept as an upload named AI background', async () => {
    mockGenerate.mockResolvedValue({ url: 'https://fal.media/x.jpg', cost_estimate: 0.04, nsfw_flagged: false });
    mockAxiosGet.mockResolvedValue({ data: Buffer.from('jpg') });
    mockYt.uploadPicture.mockResolvedValue({ url: 'https://b.s3.amazonaws.com/up/bg.jpg', label: 'AI background' });
    const out = await ai.aiBackground({}, 'ep-1', 'a rooftop');
    expect(mockGenerate).toHaveBeenCalledWith(expect.stringContaining('The setting: a rooftop.'), { useCase: 'thumbnail', size: 'landscape' });
    expect(mockAxiosGet).toHaveBeenCalledWith('https://fal.media/x.jpg', expect.objectContaining({ responseType: 'arraybuffer' }));
    expect(mockYt.uploadPicture).toHaveBeenCalledWith('ep-1', Buffer.from('jpg'), 'AI background');
    expect(out).toEqual({ url: 'https://b.s3.amazonaws.com/up/bg.jpg', label: 'AI background', cost: 0.04 });
  });

  test('aiBackground: past the image budget 429; not set up 503; a blank one or a failed fetch 502; nothing kept', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerate.mockRejectedValueOnce(Object.assign(new Error('Daily image budget reached ($10.00)'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    await expect(ai.aiBackground({}, 'ep-1')).rejects.toMatchObject({ status: 429, message: expect.stringContaining('image budget') });
    mockGenerate.mockRejectedValueOnce(new Error('FAL_KEY not configured'));
    await expect(ai.aiBackground({}, 'ep-1')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('FAL_KEY') });
    mockGenerate.mockResolvedValueOnce({ url: 'https://fal.media/x.jpg', nsfw_flagged: true });
    await expect(ai.aiBackground({}, 'ep-1')).rejects.toMatchObject({ status: 502, message: expect.stringContaining('blank') });
    mockGenerate.mockResolvedValueOnce({ url: 'https://fal.media/x.jpg', nsfw_flagged: false });
    mockAxiosGet.mockRejectedValueOnce(new Error('timeout'));
    await expect(ai.aiBackground({}, 'ep-1')).rejects.toMatchObject({ status: 502, message: expect.stringContaining('could not be fetched') });
    mockGenerate.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(ai.aiBackground({}, 'ep-1')).rejects.toMatchObject({ status: 502 });
    expect(mockYt.uploadPicture).not.toHaveBeenCalled();
  });
});
