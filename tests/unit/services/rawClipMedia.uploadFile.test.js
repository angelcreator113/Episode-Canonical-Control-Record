/**
 * rawClipMedia.uploadFile (found while testing Voice Studio B1, 2026-10-27):
 * the file it streams to S3 is closed whatever S3 does. A send that failed
 * before reading the body used to leave the read stream open (the file
 * descriptor held until the process ended), and an unread stream whose file
 * was then removed emitted an error nothing listened for. The S3 call is a
 * stand-in (S3Client.prototype.send); nothing leaves the machine.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

describe('uploadFile', () => {
  const saved = process.env.AWS_S3_BUCKET;
  let file;
  let streams;
  let createSpy;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET = 'upload-test-bucket';
    jest.resetModules();
    file = path.join(os.tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
    fs.writeFileSync(file, Buffer.alloc(4096, 7));
    streams = [];
    const real = fs.createReadStream;
    createSpy = jest.spyOn(fs, 'createReadStream').mockImplementation((...args) => { const s = real(...args); streams.push(s); return s; });
  });

  afterEach(() => {
    createSpy.mockRestore();
    jest.restoreAllMocks();
    if (saved === undefined) delete process.env.AWS_S3_BUCKET; else process.env.AWS_S3_BUCKET = saved;
    try { fs.unlinkSync(file); } catch (err) { if (err.code !== 'ENOENT') console.error('cleanup', err.message); }
  });

  const closed = (s) => new Promise((resolve) => { if (s.closed) resolve(true); else s.once('close', () => resolve(true)); setTimeout(() => resolve(s.closed), 500); });

  test('a send that fails before reading the file: the error comes back and the file is closed', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('credentials could not be loaded (test)'));
    const media = require('../../../src/services/rawClipMedia');
    await expect(media.uploadFile(file, 'k/one.bin', 'application/octet-stream')).rejects.toThrow('credentials could not be loaded');
    expect(streams).toHaveLength(1);
    expect(await closed(streams[0])).toBe(true);
  });

  test('a send that fails before reading, and the file removed straight after: nothing is left to throw', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('network down (test)'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const uncaught = [];
    const onUncaught = (err) => uncaught.push(err);
    process.on('uncaughtException', onUncaught);
    try {
      const media = require('../../../src/services/rawClipMedia');
      await expect(media.uploadFile(file, 'k/two.bin', 'application/octet-stream')).rejects.toThrow('network down');
      fs.unlinkSync(file);
      await new Promise((r) => setTimeout(r, 100));
      expect(uncaught).toEqual([]);
      expect(await closed(streams[0])).toBe(true);
    } finally {
      process.off('uncaughtException', onUncaught);
      errors.mockRestore();
    }
  });

  // Linux: how many of the process's open descriptors point at this file, as the kernel lists them.
  const openOn = (target) => fs.readdirSync('/proc/self/fd').filter((n) => {
    try { return fs.readlinkSync(`/proc/self/fd/${n}`) === target; } catch (err) { return err.code !== 'ENOENT' && err.code !== 'EBADF' && Boolean(console.error('fd', n, err.message)); }
  }).length;
  (fs.existsSync('/proc/self/fd') ? test : test.skip)('twenty failed sends leave no file open (the descriptors, counted by the kernel)', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('S3 unavailable (test)'));
    const media = require('../../../src/services/rawClipMedia');
    const target = fs.realpathSync(file);
    expect(openOn(target)).toBe(0);
    for (let i = 0; i < 20; i += 1) {
      await expect(media.uploadFile(file, `k/${i}.bin`, 'application/octet-stream')).rejects.toThrow('S3 unavailable');
    }
    await Promise.all(streams.map(closed));
    expect(streams).toHaveLength(20);
    expect(openOn(target)).toBe(0);
  });

  test('a send that succeeds: the whole file was read, the stream is closed, the public URL comes back', async () => {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    let read = 0;
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({ Bucket: 'upload-test-bucket', Key: 'k/three.bin', ContentLength: 4096, ContentType: 'audio/wav' });
      for await (const chunk of command.input.Body) read += chunk.length;
      return {};
    });
    const media = require('../../../src/services/rawClipMedia');
    await expect(media.uploadFile(file, 'k/three.bin', 'audio/wav')).resolves.toMatch(/upload-test-bucket\.s3\..*\/k\/three\.bin$/);
    expect(read).toBe(4096);
    expect(await closed(streams[0])).toBe(true);
  });
});
