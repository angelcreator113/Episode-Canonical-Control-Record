/**
 * rawClipMedia.inspect (Teleprompter audit 9, 2026-10-24): when ffprobe
 * can't read an upload, the reason is logged before the 400, so a take the
 * server refused can be explained later. ffprobe is a stand-in (/bin/false
 * fails with exit 1); no S3 is touched.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

describe('inspect', () => {
  const saved = process.env.FFPROBE_PATH;
  afterEach(() => {
    if (saved === undefined) delete process.env.FFPROBE_PATH; else process.env.FFPROBE_PATH = saved;
    jest.resetModules();
  });

  test('an ffprobe failure is console.error-ed, then a 400', async () => {
    process.env.FFPROBE_PATH = '/bin/false';
    const media = require('../../../src/services/rawClipMedia');
    const file = path.join(os.tmpdir(), `inspect-${Date.now()}.webm`);
    fs.writeFileSync(file, 'not a video');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(media.inspect(file)).rejects.toMatchObject({ status: 400, message: 'That file is not a video we can read' });
      expect(spy).toHaveBeenCalledWith('[rawClips] ffprobe could not read the upload:', expect.stringMatching(/false failed/));
    } finally {
      spy.mockRestore();
      fs.unlinkSync(file);
    }
  });
});
