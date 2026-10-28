/**
 * Where a clip starts and ends (Evoni, 2026-10-28): end_beat_number on
 * episode_raw_clips (migration 20261028120000), read and written the way
 * start_line and beat_marks are, so nothing breaks before the database
 * update runs; and the browser's own measure of an upload (width, height)
 * and ffprobe never leaving a length of 0:00. No database: query is mocked.
 */
const clips = require('../../../src/services/rawClipsService');

const missing = (col) => Object.assign(new Error(`column "${col}" of relation "episode_raw_clips" does not exist`), { original: { code: '42703', message: `column "${col}" of relation "episode_raw_clips" does not exist` } });

describe('end_beat_number: readFields', () => {
  test('a whole number 1-14, null or empty clears; not before beat_number when both are sent', () => {
    expect(clips.readFields({ end_beat_number: 11 })).toEqual({ end_beat_number: 11 });
    expect(clips.readFields({ end_beat_number: '14' })).toEqual({ end_beat_number: 14 });
    expect(clips.readFields({ end_beat_number: null })).toEqual({ end_beat_number: null });
    expect(clips.readFields({ end_beat_number: '' })).toEqual({ end_beat_number: null });
    expect(clips.readFields({ beat_number: 1, end_beat_number: 11 })).toEqual({ beat_number: 1, end_beat_number: 11 });
    expect(clips.readFields({ beat_number: 4, end_beat_number: 4 })).toEqual({ beat_number: 4, end_beat_number: 4 });
    [0, 15, 2.5, 'eleven', true].forEach((v) => expect(() => clips.readFields({ end_beat_number: v })).toThrow(/end_beat_number must be/));
    expect(() => clips.readFields({ beat_number: 5, end_beat_number: 3 })).toThrow(/no earlier than the beat the clip starts on/);
    expect(() => clips.readFields({ beat_number: null, end_beat_number: 3 })).toThrow(/Pick the beat the clip starts on/);
  });
});

describe('end_beat_number: reading', () => {
  test('shapeRow sends end_beat_number only when its column exists, never has_end_beat', () => {
    expect(clips.shapeRow({ id: 'c1', end_beat_number: null, has_end_beat: false })).toEqual({ id: 'c1' });
    expect(clips.shapeRow({ id: 'c1', end_beat_number: null, has_end_beat: true })).toEqual({ id: 'c1', end_beat_number: null });
    expect(clips.shapeRow({ id: 'c1', end_beat_number: 11, has_end_beat: true })).toEqual({ id: 'c1', end_beat_number: 11 });
    expect(clips.shapeRow({ id: 'c1', end_beat_number: '11', has_end_beat: true })).toEqual({ id: 'c1', end_beat_number: 11 });
  });

  test('listing reads it through to_jsonb, so the same SELECT works before the migration', async () => {
    const query = jest.fn().mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ id: 'c1', has_end_beat: false, end_beat_number: null }]]);
    expect(await clips.listClips({ query }, 'ep')).toEqual([{ id: 'c1' }]);
    const sql = query.mock.calls[1][0];
    expect(sql).toMatch(/to_jsonb\(episode_raw_clips\) -> 'end_beat_number' AS end_beat_number/);
    expect(sql).toMatch(/\(to_jsonb\(episode_raw_clips\) -> 'end_beat_number'\) IS NOT NULL AS has_end_beat/);
    expect(sql.split('to_jsonb')[0]).not.toMatch(/end_beat_number/);
  });
});

describe('end_beat_number: updateClip', () => {
  test('with the start beat: one UPDATE that sets both', async () => {
    const query = jest.fn(async () => [[{ id: 'c1', beat_number: 1, end_beat_number: 11, has_end_beat: true }]]);
    await expect(clips.updateClip({ query }, 'ep', 'c1', { beat_number: 1, end_beat_number: 11 })).resolves.toEqual({ id: 'c1', beat_number: 1, end_beat_number: 11 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/SET beat_number = :beat_number, end_beat_number = :end_beat_number, updated_at = NOW\(\)/);
  });

  test('alone: the start beat is read first and the end checked against it', async () => {
    const query = jest.fn(async (sql) => (/^\s*SELECT beat_number/.test(sql)
      ? [[{ beat_number: 3, has_end_beat: true }]]
      : [[{ id: 'c1', beat_number: 3, end_beat_number: 9, has_end_beat: true }]]));
    await expect(clips.updateClip({ query }, 'ep', 'c1', { end_beat_number: 9 })).resolves.toMatchObject({ end_beat_number: 9 });
    await expect(clips.updateClip({ query }, 'ep', 'c1', { end_beat_number: 2 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/no earlier than the beat/) });
    await expect(clips.updateClip({ query }, 'ep', 'c1', { end_beat_number: null })).resolves.toMatchObject({ id: 'c1' });
    const noStart = jest.fn(async () => [[{ beat_number: null, has_end_beat: true }]]);
    await expect(clips.updateClip({ query: noStart }, 'ep', 'c1', { end_beat_number: 4 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Pick the beat the clip starts on/) });
    const gone = jest.fn(async () => [[]]);
    await expect(clips.updateClip({ query: gone }, 'ep', 'c1', { end_beat_number: 4 })).resolves.toBeNull();
  });

  test('before the migration: a PATCH of it is a logged 409 that says plainly the update has not run', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const before = jest.fn(async () => [[{ beat_number: 1, has_end_beat: false }]]);
    await expect(clips.updateClip({ query: before }, 'ep', 'c1', { end_beat_number: 11 })).rejects.toMatchObject({ status: 409, message: clips.END_BEAT_MISSING });
    expect(before).toHaveBeenCalledTimes(1); // no UPDATE tried
    expect(clips.END_BEAT_MISSING).toMatch(/hasn't run yet/);
    // With the start beat (no read first): the database's own "no such column" is the same 409.
    const pg = jest.fn().mockRejectedValue(missing('end_beat_number'));
    await expect(clips.updateClip({ query: pg }, 'ep', 'c1', { beat_number: 1, end_beat_number: 11 })).rejects.toMatchObject({ status: 409, message: clips.END_BEAT_MISSING });
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/migration 20261028120000 not run/), expect.any(String));
    spy.mockRestore();
  });

  test('a start beat moved past the end beat clears the end beat; before the migration a scene link is one UPDATE as always', async () => {
    const query = jest.fn(async (sql) => (/SET end_beat_number = NULL/.test(sql)
      ? [[{ id: 'c1', beat_number: 12, end_beat_number: null, has_end_beat: true }]]
      : [[{ id: 'c1', beat_number: 12, end_beat_number: 11, has_end_beat: true }]]));
    await expect(clips.updateClip({ query }, 'ep', 'c1', { beat_number: 12 })).resolves.toEqual({ id: 'c1', beat_number: 12, end_beat_number: null });
    expect(query).toHaveBeenCalledTimes(2);
    const old = jest.fn(async () => [[{ id: 'c1', beat_number: 4, has_end_beat: false, end_beat_number: null }]]);
    await expect(clips.updateClip({ query: old }, 'ep', 'c1', { beat_number: 4 })).resolves.toEqual({ id: 'c1', beat_number: 4 });
    expect(old).toHaveBeenCalledTimes(1);
    const fine = jest.fn(async () => [[{ id: 'c1', beat_number: 2, end_beat_number: 11, has_end_beat: true }]]);
    await clips.updateClip({ query: fine }, 'ep', 'c1', { beat_number: 2 });
    expect(fine).toHaveBeenCalledTimes(1);
  });

  test('with an upload: kept by storeTakeExtras after the row exists, or reported not kept', async () => {
    const query = jest.fn(async (sql) => {
      if (/^\s*SELECT beat_number/.test(sql)) return [[{ beat_number: 1, has_end_beat: false }]];
      return [[{ id: 'c1' }]];
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const out = await clips.storeTakeExtras({ query }, 'ep', 'c1', { end_beat_number: 11 });
    expect(out).toEqual({ row: null, stored: [], notStored: ['end_beat_number'] });
    expect(clips.UPLOAD_EXTRAS).toContain('end_beat_number');
    console.error.mockRestore();
  });
});

describe('the browser\'s measure, and ffprobe never saying 0:00', () => {
  test('readVideoSize: whole pixels 1-16384; anything else is left out (logged)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(clips.readVideoSize('1080')).toBe(1080);
    expect(clips.readVideoSize(1920)).toBe(1920);
    [undefined, null, ''].forEach((v) => expect(clips.readVideoSize(v)).toBeNull());
    expect(warn).not.toHaveBeenCalled();
    ['0', '-1', '1.5', 'wide', '20000'].forEach((v) => expect(clips.readVideoSize(v)).toBeNull());
    expect(warn).toHaveBeenCalledTimes(5);
    warn.mockRestore();
  });

  test('readProbe: "N/A" or 0 is no length (null), not 0:00; a stream with no size is null', () => {
    expect(clips.readProbe({ format: { duration: 'N/A' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] }))
      .toEqual({ duration_seconds: null, width: 1080, height: 1920, hasVideo: true });
    expect(clips.readProbe({ format: { duration: '0.000000' }, streams: [{ codec_type: 'video', width: 0, height: 0 }] }))
      .toEqual({ duration_seconds: null, width: null, height: null, hasVideo: true });
  });

  test('probeArgs: a link gets a read timeout; a file on disk does not', () => {
    expect(clips.probeArgs('https://bucket/x.mp4?X-Amz-Signature=1')).toEqual(['-v', 'error', '-rw_timeout', '15000000', '-print_format', 'json', '-show_format', '-show_streams', 'https://bucket/x.mp4?X-Amz-Signature=1']);
    expect(clips.probeArgs('/tmp/x.mp4')).toEqual(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '/tmp/x.mp4']);
  });
});
