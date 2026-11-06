#!/usr/bin/env node
/**
 * A1.3-0 (C1): a READ-ONLY report of raw-clip objects in S3 that may have
 * been left behind (for example by a take refused because its episode was
 * deleted while it uploaded, whose best-effort clean-up failed).
 *
 * It never deletes, moves or changes anything: it only lists S3 objects and
 * open multipart uploads, reads episode_raw_clips, and optionally reads log
 * files. Its S3 calls are ListObjectsV2 and ListMultipartUploads only.
 *
 * Each clip folder (episodes/<episode>/raw-clips/<clip>/) is classified:
 *   referenced              a raw clip row (removed rows included) has the
 *                           clip id or one of the keys;
 *   in_progress_or_recent   an object is newer than the grace window
 *                           (default 48 h, --grace-hours), or a multipart
 *                           upload is still open under the folder;
 *   refused_logged          a [raw-clip-orphan] log line names a key
 *                           (only when logs are given with --log);
 *   candidate_unreferenced  none of the above.
 *
 * A "candidate" is only that: no clip row references it, it is older than the
 * grace window and no upload is open. The grace window is a classification
 * rule, not proof that an upload was abandoned, and the absence of a row is
 * never enough on its own. The report never calls anything an orphan and
 * never deletes. A person decides, case by case.
 *
 * Usage (read-only; needs the bucket and a database URL in the environment):
 *   node scripts/maintenance/list-raw-clip-orphans.js [--grace-hours 48] [--log out.log ...] [--prefix episodes/]
 * The [raw-clip-orphan] log lines are best-effort: the API's pm2 logs have
 * no verified retention or rotation policy, so the report does not need them.
 */

const fs = require('fs');

const KEY_RE = /^episodes\/([^/]+)\/raw-clips\/([^/]+)\/(.+)$/;
const ORPHAN_MARK = '[raw-clip-orphan] ';
const DEFAULT_GRACE_HOURS = 48;
const CLASSES = ['referenced', 'in_progress_or_recent', 'refused_logged', 'candidate_unreferenced'];

/** Keys named by [raw-clip-orphan] lines in the given log text. */
function loggedKeysFrom(text) {
  const keys = new Set();
  for (const line of String(text || '').split('\n')) {
    const at = line.indexOf(ORPHAN_MARK);
    if (at < 0) continue;
    try {
      const entry = JSON.parse(line.slice(at + ORPHAN_MARK.length).trim());
      if (entry && typeof entry.key === 'string') keys.add(entry.key);
    } catch (err) {
      // A truncated or mangled line names no key: it is reported, not guessed.
      console.warn('[list-raw-clip-orphans] an unreadable [raw-clip-orphan] line was skipped:', err.message);
    }
  }
  return keys;
}

/**
 * The classification, a pure function. objects: [{ key, last_modified, size }];
 * uploads: [{ key, initiated }] (open multipart uploads); referencedIds and
 * referencedKeys: Sets from episode_raw_clips; loggedKeys: a Set or null.
 */
function classify({ objects, uploads = [], referencedIds, referencedKeys, loggedKeys = null, now = new Date(), graceHours = DEFAULT_GRACE_HOURS }) {
  const graceMs = graceHours * 3600 * 1000;
  const folders = new Map();
  for (const o of objects) {
    const m = KEY_RE.exec(o.key);
    if (!m) continue;
    const id = `${m[1]}/${m[2]}`;
    if (!folders.has(id)) folders.set(id, { episode_id: m[1], clip_id: m[2], keys: [] });
    folders.get(id).keys.push({ key: o.key, last_modified: o.last_modified ? new Date(o.last_modified).toISOString() : null, size: o.size ?? null });
  }
  const openUnder = (prefix) => uploads.filter((u) => String(u.key || '').startsWith(prefix));
  const out = [];
  for (const f of folders.values()) {
    const prefix = `episodes/${f.episode_id}/raw-clips/${f.clip_id}/`;
    let cls;
    let reason;
    if (referencedIds.has(f.clip_id) || f.keys.some((k) => referencedKeys.has(k.key))) {
      cls = 'referenced';
      reason = 'a raw clip row (live or removed) has this clip id or one of its keys';
    } else if (openUnder(prefix).length) {
      cls = 'in_progress_or_recent';
      reason = 'a multipart upload is still open under this folder';
    } else if (f.keys.some((k) => !k.last_modified || now.getTime() - new Date(k.last_modified).getTime() < graceMs)) {
      cls = 'in_progress_or_recent';
      reason = `an object is newer than the ${graceHours} h grace window (or has no date)`;
    } else if (loggedKeys && f.keys.some((k) => loggedKeys.has(k.key))) {
      cls = 'refused_logged';
      reason = 'a [raw-clip-orphan] log line names a key: a refused upload whose clean-up failed; still for a person to check';
    } else {
      cls = 'candidate_unreferenced';
      reason = `candidate only: no clip row references it, it is older than the ${graceHours} h grace window, and no upload is open${loggedKeys ? '; no log line names it' : '; no logs were given'}`;
    }
    out.push({ ...f, class: cls, reason });
  }
  out.sort((a, b) => CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class) || a.episode_id.localeCompare(b.episode_id) || a.clip_id.localeCompare(b.clip_id));
  return out;
}

/** Every object under the prefix (ListObjectsV2, paginated). Read-only. */
async function listObjects(s3, bucket, prefix, ListObjectsV2Command) {
  const objects = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents || []) objects.push({ key: o.Key, last_modified: o.LastModified || null, size: o.Size ?? null });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

/** Every open multipart upload under the prefix (ListMultipartUploads, paginated). Read-only. */
async function listUploads(s3, bucket, prefix, ListMultipartUploadsCommand) {
  const uploads = [];
  let keyMarker;
  let idMarker;
  do {
    const page = await s3.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix, KeyMarker: keyMarker, UploadIdMarker: idMarker }));
    for (const u of page.Uploads || []) uploads.push({ key: u.Key, initiated: u.Initiated || null });
    if (page.IsTruncated) { keyMarker = page.NextKeyMarker; idMarker = page.NextUploadIdMarker; } else { keyMarker = undefined; }
  } while (keyMarker);
  return uploads;
}

/** The clip ids and keys episode_raw_clips references (removed rows included), for the listed folders. Read-only. */
async function referencesFor(sequelize, objects) {
  const ids = new Set();
  const keys = new Set();
  const clipIds = [...new Set(objects.map((o) => KEY_RE.exec(o.key)?.[2]).filter(Boolean))];
  const allKeys = [...new Set(objects.map((o) => o.key))];
  for (let i = 0; i < Math.max(clipIds.length, allKeys.length); i += 500) {
    const idPage = clipIds.slice(i, i + 500);
    const keyPage = allKeys.slice(i, i + 500);
    const [rows] = await sequelize.query(
      `SELECT id::text AS id, s3_key_raw, thumbnail_key, s3_key_cutout FROM episode_raw_clips
        WHERE id::text IN (:ids) OR s3_key_raw IN (:keys) OR thumbnail_key IN (:keys) OR s3_key_cutout IN (:keys)`,
      { replacements: { ids: idPage.length ? idPage : [''], keys: keyPage.length ? keyPage : [''] } });
    for (const r of rows) {
      ids.add(String(r.id));
      for (const k of [r.s3_key_raw, r.thumbnail_key, r.s3_key_cutout]) if (k) keys.add(k);
    }
  }
  return { ids, keys };
}

/** The whole report. Lists and reads only; returns the JSON it prints. */
async function listRawClipOrphans({ s3, bucket, sequelize, prefix = 'episodes/', logTexts = null, graceHours = DEFAULT_GRACE_HOURS, now = new Date(), commands }) {
  const objects = (await listObjects(s3, bucket, prefix, commands.ListObjectsV2Command)).filter((o) => KEY_RE.test(o.key));
  const uploads = await listUploads(s3, bucket, prefix, commands.ListMultipartUploadsCommand);
  const refs = await referencesFor(sequelize, objects);
  const loggedKeys = logTexts ? logTexts.reduce((set, t) => { loggedKeysFrom(t).forEach((k) => set.add(k)); return set; }, new Set()) : null;
  const clips = classify({ objects, uploads, referencedIds: refs.ids, referencedKeys: refs.keys, loggedKeys, now, graceHours });
  const counts = Object.fromEntries(CLASSES.map((c) => [c, clips.filter((x) => x.class === c).length]));
  return {
    generated_at: now.toISOString(),
    read_only: true,
    bucket,
    prefix,
    grace_hours: graceHours,
    logs_supplied: Boolean(logTexts),
    note: 'Candidates are not proven orphans. Nothing was deleted. Log lines are best-effort (retention unverified).',
    counts,
    clips,
  };
}

function parseArgs(argv) {
  const args = { graceHours: DEFAULT_GRACE_HOURS, logs: [], prefix: 'episodes/' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--grace-hours') args.graceHours = Number(argv[++i]);
    else if (argv[i] === '--log') args.logs.push(argv[++i]);
    else if (argv[i] === '--prefix') args.prefix = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!Number.isFinite(args.graceHours) || args.graceHours < 0) throw new Error('--grace-hours: a number of hours, 0 or more');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { S3Client, ListObjectsV2Command, ListMultipartUploadsCommand } = require('@aws-sdk/client-s3');
  const { requireAssetBucket } = require('../../src/services/assetBucket');
  const { sequelize } = require('../../src/models');
  const bucket = requireAssetBucket();
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const logTexts = args.logs.length ? args.logs.map((p) => fs.readFileSync(p, 'utf8')) : null;
  try {
    const report = await listRawClipOrphans({ s3, bucket, sequelize, prefix: args.prefix, logTexts, graceHours: args.graceHours,
      commands: { ListObjectsV2Command, ListMultipartUploadsCommand } });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[list-raw-clip-orphans] failed:', err.message);
    process.exit(1);
  });
}

module.exports = { classify, loggedKeysFrom, listRawClipOrphans, parseArgs, CLASSES, DEFAULT_GRACE_HOURS };
