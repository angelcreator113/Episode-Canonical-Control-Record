/**
 * A1.3-0 (C1): scripts/maintenance/list-raw-clip-orphans.js is read-only and
 * evidence-based. On the test database, with a stub S3 that records every
 * call:
 *   - a folder a clip row references (a removed row too) is `referenced`;
 *   - a recent object with no row is `in_progress_or_recent`, never a candidate;
 *   - an old object under an open multipart upload is `in_progress_or_recent`;
 *   - an old object named by a [raw-clip-orphan] log line is `refused_logged`;
 *   - an old object with no row, no upload and no log line is only a
 *     `candidate_unreferenced`, and the report says "candidate";
 *   - its only S3 calls are ListObjectsV2 and ListMultipartUploads; nothing
 *     is deleted, and the source names no delete command.
 */
jest.unmock('uuid');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const models = require('../../src/models');
const report = require('../../scripts/maintenance/list-raw-clip-orphans');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

class ListObjectsV2Command { constructor(input) { this.input = input; this.name = 'ListObjectsV2'; } }
class ListMultipartUploadsCommand { constructor(input) { this.input = input; this.name = 'ListMultipartUploads'; } }

(shouldSkip ? describe.skip : describe)('the raw-clip orphan report (read-only)', () => {
  const show = uuid();
  const ep = uuid();
  const NOW = new Date('2026-11-06T12:00:00Z');
  const OLD = new Date('2026-11-01T12:00:00Z');
  const RECENT = new Date('2026-11-06T06:00:00Z');
  const ids = { referenced: uuid(), removed: uuid(), recent: uuid(), uploading: uuid(), logged: uuid(), candidate: uuid() };
  const key = (clip, file = 'original.mp4') => `episodes/${ep}/raw-clips/${clip}/${file}`;

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `orphan-report-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Report', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, thumbnail_key, created_at, updated_at)
               VALUES (:id, :ep, :show, 'lala', :k, :t, NOW(), NOW())`, { id: ids.referenced, ep, show, k: key(ids.referenced), t: key(ids.referenced, 'thumbnail.jpg') });
    // A removed row, with a different id, naming the folder's thumbnail key.
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, thumbnail_key, deleted_at, created_at, updated_at)
               VALUES (:id, :ep, :show, 'lala', :k, :t, NOW(), NOW(), NOW())`, { id: uuid(), ep, show, k: `elsewhere/${uuid()}`, t: key(ids.removed, 'thumbnail.jpg') });
  });
  afterAll(async () => {
    await run('DELETE FROM episode_raw_clips WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  function stubS3() {
    const calls = [];
    const objects = [
      { Key: key(ids.referenced), LastModified: OLD, Size: 10 },
      { Key: key(ids.referenced, 'thumbnail.jpg'), LastModified: OLD, Size: 1 },
      { Key: key(ids.removed), LastModified: OLD, Size: 10 },
      { Key: key(ids.removed, 'thumbnail.jpg'), LastModified: OLD, Size: 1 },
      { Key: key(ids.recent), LastModified: RECENT, Size: 10 },
      { Key: key(ids.uploading), LastModified: OLD, Size: 10 },
      { Key: key(ids.logged, 'thumbnail.jpg'), LastModified: OLD, Size: 1 },
      { Key: key(ids.candidate), LastModified: OLD, Size: 10 },
      { Key: `episodes/${ep}/other/file.txt`, LastModified: OLD, Size: 1 }, // not a raw clip
    ];
    return {
      calls,
      send: async (cmd) => {
        calls.push(cmd.name || cmd.constructor.name);
        if (cmd.name === 'ListObjectsV2') {
          // Two pages, to exercise the pagination.
          if (!cmd.input.ContinuationToken) return { Contents: objects.slice(0, 4), IsTruncated: true, NextContinuationToken: 'p2' };
          return { Contents: objects.slice(4), IsTruncated: false };
        }
        if (cmd.name === 'ListMultipartUploads') return { Uploads: [{ Key: key(ids.uploading), Initiated: OLD }], IsTruncated: false };
        throw new Error(`unexpected S3 call ${cmd.name}`);
      },
    };
  }

  test('each class, from evidence; only candidates are called candidates; nothing is deleted', async () => {
    const s3 = stubS3();
    const log = [
      'some other line',
      `[RawClips] upload complete refused (409): ...`,
      `2026-11-02T00:00:00Z [raw-clip-orphan] ${JSON.stringify({ episode_id: ep, clip_id: ids.logged, key: key(ids.logged, 'thumbnail.jpg'), reason: 'delete failed: SlowDown', at: '2026-11-02T00:00:00Z' })}`,
    ].join('\n');
    const out = await report.listRawClipOrphans({ s3, bucket: 'test-bucket', sequelize, logTexts: [log], now: NOW,
      commands: { ListObjectsV2Command, ListMultipartUploadsCommand } });
    const cls = Object.fromEntries(out.clips.map((c) => [c.clip_id, c.class]));
    expect(cls).toEqual({
      [ids.referenced]: 'referenced',
      [ids.removed]: 'referenced',
      [ids.recent]: 'in_progress_or_recent',
      [ids.uploading]: 'in_progress_or_recent',
      [ids.logged]: 'refused_logged',
      [ids.candidate]: 'candidate_unreferenced',
    });
    expect(out.counts).toEqual({ referenced: 2, in_progress_or_recent: 2, refused_logged: 1, candidate_unreferenced: 1 });
    const candidate = out.clips.find((c) => c.clip_id === ids.candidate);
    expect(candidate.reason).toMatch(/^candidate only/);
    expect(JSON.stringify(out)).not.toMatch(/"orphan"|is an orphan/i);
    expect(out).toMatchObject({ read_only: true, grace_hours: 48, logs_supplied: true });
    expect(new Set(s3.calls)).toEqual(new Set(['ListObjectsV2', 'ListMultipartUploads']));
  });

  test('without logs the logged folder is only a candidate; a wider grace window keeps it recent', async () => {
    const noLogs = await report.listRawClipOrphans({ s3: stubS3(), bucket: 'b', sequelize, now: NOW, commands: { ListObjectsV2Command, ListMultipartUploadsCommand } });
    expect(noLogs.clips.find((c) => c.clip_id === ids.logged).class).toBe('candidate_unreferenced');
    expect(noLogs.logs_supplied).toBe(false);
    const wide = await report.listRawClipOrphans({ s3: stubS3(), bucket: 'b', sequelize, now: NOW, graceHours: 24 * 30, commands: { ListObjectsV2Command, ListMultipartUploadsCommand } });
    expect(wide.counts.candidate_unreferenced).toBe(0);
  });

  test('the script names no delete, copy or write command', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../scripts/maintenance/list-raw-clip-orphans.js'), 'utf8');
    expect(src).not.toMatch(/Delete(Object|Objects)?Command|CopyObjectCommand|PutObjectCommand|AbortMultipartUploadCommand/);
    expect(src).not.toMatch(/\b(UPDATE|DELETE FROM|INSERT INTO|TRUNCATE)\b/);
  });

  test('argument parsing', () => {
    expect(report.parseArgs(['--grace-hours', '72', '--log', 'a.log', '--log', 'b.log'])).toEqual({ graceHours: 72, logs: ['a.log', 'b.log'], prefix: 'episodes/' });
    expect(() => report.parseArgs(['--delete'])).toThrow(/unknown argument/);
    expect(() => report.parseArgs(['--grace-hours', '-1'])).toThrow(/grace-hours/);
  });
});
