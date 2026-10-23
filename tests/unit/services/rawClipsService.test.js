/**
 * Raw clips (episode_raw_clips; Evoni, 2026-10-17): validation, the SQL the
 * service sends, and the pure green-removal pieces (key colour, ffmpeg
 * arguments, ffprobe reading). No database: sequelize.query is mocked.
 */

const clips = require('../../../src/services/rawClipsService');

const seq = (...results) => {
  const query = jest.fn();
  results.forEach((r) => query.mockResolvedValueOnce(r));
  return { query };
};

describe('readFields', () => {
  test('accepts the three performers and drops guest_name for non-guests', () => {
    expect(clips.readFields({ performer: 'guest', guest_name: '  Sage  ' }, { requirePerformer: true }))
      .toEqual({ performer: 'guest', guest_name: 'Sage' });
    expect(clips.readFields({ performer: 'lala', guest_name: 'Sage' }, { requirePerformer: true }))
      .toEqual({ performer: 'lala', guest_name: null });
    expect(clips.readFields({ performer: 'justawoman' }, { requirePerformer: true })).toEqual({ performer: 'justawoman', guest_name: null });
  });

  test('rejects an unknown or missing performer with a 400', () => {
    expect(() => clips.readFields({ performer: 'host' })).toThrow(clips.RawClipError);
    expect(() => clips.readFields({}, { requirePerformer: true })).toThrow(/performer must be one of lala, justawoman, guest/);
  });

  test('beat_number links a scene 1-14; null or empty unlinks; anything else is a 400', () => {
    expect(clips.readFields({ beat_number: '7' })).toEqual({ beat_number: 7 });
    expect(clips.readFields({ beat_number: null })).toEqual({ beat_number: null });
    expect(clips.readFields({ beat_number: '' })).toEqual({ beat_number: null });
    expect(() => clips.readFields({ beat_number: 15 })).toThrow(/beat_number must be a whole number from 1 to 14/);
    expect(() => clips.readFields({ beat_number: 2.5 })).toThrow(clips.RawClipError);
  });

  test('label is trimmed and capped at 200', () => {
    expect(clips.readFields({ label: ` ${'x'.repeat(250)} ` }).label).toHaveLength(200);
    expect(clips.readFields({ label: '   ' }).label).toBeNull();
  });
});

describe('take fields: is_favorite and start_line (Teleprompter batch 2)', () => {
  test('readFields: is_favorite is a boolean; start_line a whole number from 0, or null', () => {
    expect(clips.readFields({ is_favorite: true })).toEqual({ is_favorite: true });
    expect(clips.readFields({ is_favorite: 'false' })).toEqual({ is_favorite: false });
    expect(() => clips.readFields({ is_favorite: 'yes' })).toThrow(/is_favorite must be true or false/);
    expect(clips.readFields({ start_line: 0 })).toEqual({ start_line: 0 });
    expect(clips.readFields({ start_line: '4' })).toEqual({ start_line: 4 });
    expect(clips.readFields({ start_line: null })).toEqual({ start_line: null });
    expect(() => clips.readFields({ start_line: -1 })).toThrow(/start_line must be a whole number from 0/);
    expect(() => clips.readFields({ start_line: 1.5 })).toThrow(clips.RawClipError);
  });

  test('shapeRow sends the fields only when the columns exist, never has_take_fields', () => {
    expect(clips.shapeRow({ id: 'c1', is_favorite: null, start_line: null, has_take_fields: false })).toEqual({ id: 'c1' });
    expect(clips.shapeRow({ id: 'c1', is_favorite: true, start_line: '3', has_take_fields: true })).toEqual({ id: 'c1', is_favorite: true, start_line: 3 });
    expect(clips.shapeRow({ id: 'c1', is_favorite: false, start_line: null, has_take_fields: true })).toEqual({ id: 'c1', is_favorite: false, start_line: null });
    expect(clips.shapeRow(undefined)).toBeUndefined();
  });

  test('listing reads the fields through to_jsonb, so it works before the migration', async () => {
    const s = seq([[]], [[{ id: 'c1', has_take_fields: false, is_favorite: null, start_line: null }, { id: 'c2', has_take_fields: true, is_favorite: true, start_line: 2 }]]);
    await expect(clips.listClips(s, 'ep')).resolves.toEqual([{ id: 'c1' }, { id: 'c2', is_favorite: true, start_line: 2 }]);
    expect(s.query.mock.calls[1][0]).toMatch(/to_jsonb\(episode_raw_clips\) -> 'is_favorite' AS is_favorite/);
  });

  test('starring a take un-stars the other takes of its beat, in one transaction', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([[{ id: 'c2', beat_number: 8, is_favorite: true, start_line: null, has_take_fields: true }]])
      .mockResolvedValueOnce([[], 1]);
    const transaction = jest.fn(async (fn) => fn('tx'));
    const row = await clips.updateClip({ query, transaction }, 'ep', 'c2', { is_favorite: true });
    expect(row).toEqual({ id: 'c2', beat_number: 8, is_favorite: true, start_line: null });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/SET is_favorite = :is_favorite, updated_at = NOW\(\)/);
    expect(query.mock.calls[0][1].transaction).toBe('tx');
    const [unstar, opts] = query.mock.calls[1];
    expect(unstar).toMatch(/SET is_favorite = false/);
    expect(unstar).toMatch(/beat_number = :beat AND id <> :clipId/);
    expect(opts).toMatchObject({ replacements: { episodeId: 'ep', clipId: 'c2', beat: 8 }, transaction: 'tx' });
  });

  test('un-starring, or starring a take with no beat, touches only that take', async () => {
    const query = jest.fn().mockResolvedValue([[{ id: 'c2', beat_number: null, has_take_fields: true, is_favorite: true, start_line: null }]]);
    const transaction = jest.fn(async (fn) => fn('tx'));
    await clips.updateClip({ query, transaction }, 'ep', 'c2', { is_favorite: true });
    expect(query).toHaveBeenCalledTimes(1);
    await clips.updateClip({ query, transaction }, 'ep', 'c2', { is_favorite: false, start_line: 3 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[1][0]).toMatch(/SET is_favorite = :is_favorite, start_line = :start_line/);
  });

  test('before the migration, a PATCH of the fields is a 409 with a plain message (and is logged)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const pgErr = Object.assign(new Error('column "start_line" of relation "episode_raw_clips" does not exist'), { original: { code: '42703', message: 'column "start_line" of relation "episode_raw_clips" does not exist' } });
    const query = jest.fn().mockRejectedValue(pgErr);
    await expect(clips.updateClip({ query, transaction: async (fn) => fn('tx') }, 'ep', 'c1', { start_line: 2 }))
      .rejects.toMatchObject({ status: 409, message: clips.TAKE_FIELDS_MISSING });
    await expect(clips.updateClip({ query, transaction: async (fn) => fn('tx') }, 'ep', 'c1', { is_favorite: true }))
      .rejects.toBeInstanceOf(clips.RawClipError);
    const other = new Error('connection reset');
    await expect(clips.updateClip({ query: jest.fn().mockRejectedValue(other) }, 'ep', 'c1', { label: 'x' })).rejects.toBe(other);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('beat_marks: a full-episode take\'s beat markers (Record whole episode, 2026-10-23)', () => {
  test('readFields: a list of { beat 1-14, t 0-36000 }, sorted by time, t to one decimal; null clears', () => {
    expect(clips.readFields({ beat_marks: [{ beat: 3, t: 90.04 }, { beat: 1, t: 0 }, { beat: 2, t: 41.26 }] }))
      .toEqual({ beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 41.3 }, { beat: 3, t: 90 }] });
    expect(clips.readFields({ beat_marks: [] })).toEqual({ beat_marks: [] });
    expect(clips.readFields({ beat_marks: null })).toEqual({ beat_marks: null });
    // As a multipart form sends it: JSON text, numbers as strings.
    expect(clips.readFields({ beat_marks: '[{"beat":"14","t":"36000"}]' })).toEqual({ beat_marks: [{ beat: 14, t: 36000 }] });
  });

  test('readFields: anything else is a 400', () => {
    const bad = [
      'not json', 5, { beat: 1, t: 0 }, [null], [[1, 0]], [{ beat: 0, t: 1 }], [{ beat: 15, t: 1 }], [{ beat: 2.5, t: 1 }],
      [{ beat: 1 }], [{ beat: 1, t: -0.1 }], [{ beat: 1, t: 36000.1 }], [{ beat: 1, t: 'soon' }], [{ beat: 1, t: Infinity }],
      [{ beat: 1, t: 0 }, { beat: 1, t: 5 }],
      Array.from({ length: 31 }, (_, i) => ({ beat: (i % 14) + 1, t: i })),
    ];
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    bad.forEach((v) => {
      expect(() => clips.readFields({ beat_marks: v })).toThrow(clips.RawClipError);
      try { clips.readFields({ beat_marks: v }); } catch (err) { expect(err.status).toBe(400); }
    });
    spy.mockRestore();
    expect(clips.MAX_BEAT_MARKS).toBe(30);
  });

  test('shapeRow sends beat_marks only when its column exists, never has_beat_marks', () => {
    expect(clips.shapeRow({ id: 'c1', beat_marks: null, has_beat_marks: false })).toEqual({ id: 'c1' });
    expect(clips.shapeRow({ id: 'c1', beat_marks: null, has_beat_marks: true })).toEqual({ id: 'c1', beat_marks: null });
    expect(clips.shapeRow({ id: 'c1', beat_marks: [{ beat: 1, t: 0 }], has_beat_marks: true })).toEqual({ id: 'c1', beat_marks: [{ beat: 1, t: 0 }] });
    // Both migrations' fields, each on its own.
    expect(clips.shapeRow({ id: 'c1', is_favorite: false, start_line: null, has_take_fields: true, beat_marks: null, has_beat_marks: false }))
      .toEqual({ id: 'c1', is_favorite: false, start_line: null });
    expect(clips.shapeRow({ id: 'c1', is_favorite: null, start_line: null, has_take_fields: false, beat_marks: [], has_beat_marks: true }))
      .toEqual({ id: 'c1', beat_marks: [] });
  });

  test('listing reads beat_marks through to_jsonb (key present = column exists)', async () => {
    const s = seq([[]], [[{ id: 'c1', has_take_fields: false, has_beat_marks: false, beat_marks: null }, { id: 'c2', has_take_fields: false, has_beat_marks: true, beat_marks: [{ beat: 1, t: 0 }] }]]);
    await expect(clips.listClips(s, 'ep')).resolves.toEqual([{ id: 'c1' }, { id: 'c2', beat_marks: [{ beat: 1, t: 0 }] }]);
    const sql = s.query.mock.calls[1][0];
    expect(sql).toMatch(/to_jsonb\(episode_raw_clips\) -> 'beat_marks' AS beat_marks/);
    expect(sql).toMatch(/\(to_jsonb\(episode_raw_clips\) -> 'beat_marks'\) IS NOT NULL AS has_beat_marks/);
  });

  test('updateClip casts beat_marks to jsonb from its JSON text; null stays null', async () => {
    const s = seq([[{ id: 'c1', has_beat_marks: true, beat_marks: [{ beat: 1, t: 0 }] }]], [[{ id: 'c1', has_beat_marks: true, beat_marks: null }]]);
    await expect(clips.updateClip(s, 'ep', 'c1', { beat_marks: [{ beat: 1, t: 0 }] })).resolves.toEqual({ id: 'c1', beat_marks: [{ beat: 1, t: 0 }] });
    expect(s.query.mock.calls[0][0]).toMatch(/SET beat_marks = CAST\(:beat_marks AS jsonb\), updated_at = NOW\(\)/);
    expect(s.query.mock.calls[0][1].replacements.beat_marks).toBe('[{"beat":1,"t":0}]');
    await clips.updateClip(s, 'ep', 'c1', { beat_marks: null });
    expect(s.query.mock.calls[1][1].replacements.beat_marks).toBeNull();
  });

  test('before the migration, a PATCH of beat_marks is a logged 409 that says the update has not run', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const pgErr = Object.assign(new Error('column "beat_marks" of relation "episode_raw_clips" does not exist'), { original: { code: '42703', message: 'column "beat_marks" of relation "episode_raw_clips" does not exist' } });
    await expect(clips.updateClip({ query: jest.fn().mockRejectedValue(pgErr) }, 'ep', 'c1', { beat_marks: [{ beat: 1, t: 0 }] }))
      .rejects.toMatchObject({ status: 409, message: clips.BEAT_MARKS_MISSING });
    expect(clips.BEAT_MARKS_MISSING).toMatch(/database update .* hasn't run yet/);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/migration 20261023220000 not run/), expect.any(String));
    spy.mockRestore();
  });
});

describe('readStrength and truthy', () => {
  test('strength defaults to medium and must be low, medium or high', () => {
    expect(clips.readStrength(undefined)).toBe('medium');
    expect(clips.readStrength('high')).toBe('high');
    expect(() => clips.readStrength('max')).toThrow(/strength must be one of low, medium, high/);
  });

  test('multipart truthy values', () => {
    ['true', '1', 'on', true, 1].forEach((v) => expect(clips.truthy(v)).toBe(true));
    ['false', '0', '', undefined, null].forEach((v) => expect(clips.truthy(v)).toBe(false));
  });
});

describe('database calls', () => {
  test('findEpisode returns the episode or throws 404', async () => {
    await expect(clips.findEpisode(seq([[{ id: 'ep', show_id: 'sh' }]]), 'ep')).resolves.toEqual({ id: 'ep', show_id: 'sh' });
    await expect(clips.findEpisode(seq([[]]), 'ep')).rejects.toMatchObject({ status: 404 });
  });

  test('listClips marks stale jobs failed (sparing running ones), then lists oldest first', async () => {
    const s = seq([[]], [[{ id: 'c1' }]]);
    await expect(clips.listClips(s, 'ep', { activeIds: ['c9'] })).resolves.toEqual([{ id: 'c1' }]);
    const [staleSql, staleOpts] = s.query.mock.calls[0];
    expect(staleSql).toMatch(/key_status IN \('queued', 'processing'\)/);
    expect(staleSql).toMatch(/id NOT IN \(:activeIds\)/);
    expect(staleOpts.replacements).toMatchObject({ episodeId: 'ep', activeIds: ['c9'], message: clips.STALE_MESSAGE });
    expect(s.query.mock.calls[1][0]).toMatch(/ORDER BY created_at ASC/);
  });

  test('listClips leaves out the NOT IN clause when nothing is running', async () => {
    const s = seq([[]], [[]]);
    await clips.listClips(s, 'ep');
    expect(s.query.mock.calls[0][0]).not.toMatch(/NOT IN/);
  });

  test('updateClip sets only the fields sent; nothing to change is a 400', async () => {
    const s = seq([[{ id: 'c1', performer: 'guest' }]]);
    await clips.updateClip(s, 'ep', 'c1', { performer: 'guest', guest_name: 'Sage' });
    expect(s.query.mock.calls[0][0]).toMatch(/SET performer = :performer, guest_name = :guest_name, updated_at = NOW\(\)/);
    await expect(clips.updateClip(seq(), 'ep', 'c1', {})).rejects.toMatchObject({ status: 400 });
  });

  test('setKeyState: done stores the cut-out; failed stores the reason; queued clears the last error', async () => {
    const s = seq([[{ id: 'c1' }]], [[{ id: 'c1' }]], [[{ id: 'c1' }]]);
    await clips.setKeyState(s, 'c1', 'done', { cutoutKey: 'k', cutoutUrl: 'u' });
    expect(s.query.mock.calls[0][0]).toMatch(/s3_key_cutout = :cutoutKey, url_cutout = :cutoutUrl/);
    await clips.setKeyState(s, 'c1', 'failed', { error: 'ffmpeg is not installed on the server' });
    expect(s.query.mock.calls[1][1].replacements.error).toBe('ffmpeg is not installed on the server');
    await clips.setKeyState(s, 'c1', 'queued', { strength: 'high' });
    expect(s.query.mock.calls[2][0]).toMatch(/key_strength = :strength.*key_error = NULL/s);
    await expect(clips.setKeyState(s, 'c1', 'nope')).rejects.toBeInstanceOf(clips.RawClipError);
  });

  test('removeClip is a soft delete', async () => {
    const s = seq([[{ id: 'c1' }]], [[]]);
    await expect(clips.removeClip(s, 'ep', 'c1')).resolves.toBe(true);
    expect(s.query.mock.calls[0][0]).toMatch(/SET deleted_at = NOW\(\)/);
    await expect(clips.removeClip(s, 'ep', 'gone')).resolves.toBe(false);
  });
});

describe('green removal pieces', () => {
  const frame = (edge, center = [224, 104, 159], size = 16) => {
    const buf = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const onEdge = y === 0 || y === size - 1 || x === 0 || x === size - 1;
        buf.set(onEdge ? edge : center, (y * size + x) * 3);
      }
    }
    return buf;
  };

  test('pickKeyColor averages the green edge of the frame', () => {
    expect(clips.pickKeyColor(frame([59, 177, 67]))).toBe('0x3BB143');
  });

  test('pickKeyColor falls back to chroma-key green when the edge is not green, or the frame is short', () => {
    expect(clips.pickKeyColor(frame([240, 240, 240]))).toBe(clips.DEFAULT_KEY_COLOR);
    expect(clips.pickKeyColor(Buffer.alloc(10))).toBe(clips.DEFAULT_KEY_COLOR);
  });

  test('chromakeyArgs keys the colour at the strength, despills, and writes VP9 with alpha and Opus audio', () => {
    const args = clips.chromakeyArgs('in.mp4', 'out.webm', { color: '0x3BB143', strength: 'high' });
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain(`chromakey=color=0x3BB143:similarity=${clips.STRENGTH_SIMILARITY.high}:blend=0.08`);
    expect(vf).toContain('despill=type=green');
    expect(vf).toContain('min(1920,iw)');
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-c:a', 'libopus']));
    expect(args[args.indexOf('-i') + 1]).toBe('in.mp4');
    expect(args[args.length - 1]).toBe('out.webm');
  });

  test('readProbe reads length and size, and says when there is no video', () => {
    const json = JSON.stringify({ format: { duration: '12.3456' }, streams: [{ codec_type: 'audio' }, { codec_type: 'video', width: 1920, height: 1080 }] });
    expect(clips.readProbe(json)).toEqual({ duration_seconds: 12.35, width: 1920, height: 1080, hasVideo: true });
    expect(clips.readProbe({ format: {}, streams: [{ codec_type: 'audio' }] }).hasVideo).toBe(false);
    expect(clips.readProbe('not json').hasVideo).toBe(false);
  });
});
