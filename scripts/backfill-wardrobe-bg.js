#!/usr/bin/env node
'use strict';

/**
 * Backfill wardrobe.s3_url_processed via remove.bg (with Runway ML fallback).
 *
 * Mirrors the logic of src/controllers/wardrobeController.js processBackgroundRemoval
 * so every existing item ends up with the same kind of background-removed PNG that
 * newly-uploaded items get automatically.
 *
 * Usage:
 *   node scripts/backfill-wardrobe-bg.js --dry-run
 *   node scripts/backfill-wardrobe-bg.js --limit 10
 *   node scripts/backfill-wardrobe-bg.js --limit 100 --concurrency 3 --yes
 *
 * Flags:
 *   --dry-run          List what would be processed; no API calls, no writes
 *   --limit N          Process at most N items this run (default: 25)
 *   --concurrency N    Run N in parallel (default: 2)
 *   --yes              Skip the confirmation prompt
 *
 * Idempotent: only touches rows where s3_url_processed IS NULL.
 * Resumable: every attempt (success/failure) is appended to
 *   scripts/state/wardrobe-bg-backfill.log (JSONL).
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuid } = require('uuid');
const { Op } = require('sequelize');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const { models, sequelize } = require('../src/models');
const { Wardrobe } = models;
const { applyRemoveBgParams } = require('../src/services/removeBgParams');

// ── Config ─────────────────────────────────────────────────────────────────
const REMOVEBG_KEY =
  process.env.REMOVEBG_API_KEY || process.env.REMOVE_BG_API_KEY;
const RUNWAY_KEY = process.env.RUNWAY_ML_API_KEY;
const BUCKET_NAME =
  process.env.S3_PRIMARY_BUCKET ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET_NAME ||
  'episode-metadata-storage-dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Approximate cost per image on remove.bg pay-as-you-go (used for the confirm prompt only)
const EST_COST_PER_IMAGE_USD = 0.2;

// ── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const argValue = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const DRY_RUN = hasFlag('--dry-run');
const LIMIT = parseInt(argValue('--limit', '25'), 10);
const CONCURRENCY = Math.max(1, parseInt(argValue('--concurrency', '2'), 10));
const SKIP_CONFIRM = hasFlag('--yes');

// ── Log ────────────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, 'state');
const LOG_FILE = path.join(LOG_DIR, 'wardrobe-bg-backfill.log');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const log = (obj) =>
  fs.appendFileSync(
    LOG_FILE,
    JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'
  );

// ── S3 ─────────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

async function downloadFromS3(key) {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Background removal (remove.bg → Runway ML fallback) ────────────────────
async function removeBackground(item) {
  if (!item.s3_key) {
    throw new Error('item has no s3_key; cannot download source');
  }
  const imageBuffer = await downloadFromS3(item.s3_key);

  const buildForm = () => {
    const fd = new FormData();
    fd.append('image_file', imageBuffer, {
      filename: `${item.id}.jpg`,
      contentType: 'image/jpeg',
    });
    applyRemoveBgParams(fd, item.clothing_category);
    return fd;
  };

  if (REMOVEBG_KEY) {
    try {
      const fd = buildForm();
      const r = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        fd,
        {
          headers: { ...fd.getHeaders(), 'X-Api-Key': REMOVEBG_KEY },
          responseType: 'arraybuffer',
          timeout: 60000,
        }
      );
      return { data: r.data, provider: 'remove.bg' };
    } catch (err) {
      if (!RUNWAY_KEY) throw err;
      console.warn(
        `    remove.bg failed (${err.message}); falling back to Runway`
      );
    }
  }

  if (RUNWAY_KEY) {
    const fd = buildForm();
    const r = await axios.post(
      'https://api.runwayml.com/v1/remove-background',
      fd,
      {
        headers: {
          ...fd.getHeaders(),
          Authorization: `Bearer ${RUNWAY_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 60000,
      }
    );
    return { data: r.data, provider: 'runway' };
  }

  throw new Error('No background-removal API key configured');
}

async function processItem(item) {
  const label = `${item.id.slice(0, 8)} · ${item.character || 'uncategorized'} · ${(item.name || '').slice(0, 50)}`;
  console.log(`  → ${label}`);

  if (DRY_RUN) {
    log({ event: 'dry_run', id: item.id });
    return { ok: true, dry: true };
  }

  const { data, provider } = await removeBackground(item);

  const character = item.character || 'uncategorized';
  const safeCharacter = character.replace(/[^\w-]/g, '_');
  const processedKey = `wardrobe/${safeCharacter}/${uuid()}-nobg.png`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: processedKey,
      Body: Buffer.from(data),
      ContentType: 'image/png',
      CacheControl: 'max-age=31536000',
    })
  );

  const processedUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${processedKey}`;
  await item.update({
    s3_key_processed: processedKey,
    s3_url_processed: processedUrl,
  });

  log({ event: 'success', id: item.id, provider, key: processedKey });
  return { ok: true, provider };
}

// ── Prompt ─────────────────────────────────────────────────────────────────
function confirm(question) {
  if (SKIP_CONFIRM) return Promise.resolve(true);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no) `, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Wardrobe Background-Removal Backfill');
  console.log('─────────────────────────────────────────');
  console.log(`  mode:         ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  limit:        ${LIMIT}`);
  console.log(`  concurrency:  ${CONCURRENCY}`);
  console.log(`  remove.bg:    ${REMOVEBG_KEY ? 'configured' : 'missing'}`);
  console.log(`  runway:       ${RUNWAY_KEY ? 'configured' : 'missing'}`);
  console.log(`  bucket:       ${BUCKET_NAME}`);
  console.log(`  log file:     ${LOG_FILE}`);
  console.log('');

  if (!DRY_RUN && !REMOVEBG_KEY && !RUNWAY_KEY) {
    console.error(
      'ERROR: No background-removal API key set. Add REMOVEBG_API_KEY or RUNWAY_ML_API_KEY to .env.'
    );
    process.exit(1);
  }

  const baseWhere = {
    s3_url_processed: null,
    s3_url: { [Op.ne]: null },
    s3_key: { [Op.ne]: null },
    deleted_at: null,
  };

  const total = await Wardrobe.count({ where: baseWhere, paranoid: false });
  console.log(`${total} items in DB missing s3_url_processed`);

  const items = await Wardrobe.findAll({
    where: baseWhere,
    limit: LIMIT,
    order: [['created_at', 'DESC']],
    paranoid: false,
  });
  console.log(`${items.length} queued this run (limit ${LIMIT})\n`);

  if (items.length === 0) {
    console.log('Nothing to do.');
    await sequelize.close();
    process.exit(0);
  }

  if (!DRY_RUN) {
    const est = (items.length * EST_COST_PER_IMAGE_USD).toFixed(2);
    const ok = await confirm(
      `About to call remove.bg for ${items.length} images (est. ~$${est} at pay-as-you-go pricing). Continue?`
    );
    if (!ok) {
      console.log('Aborted.');
      await sequelize.close();
      process.exit(0);
    }
  }

  const stats = { success: 0, failed: 0 };
  const queue = [...items];
  const runWorker = async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        await processItem(item);
        stats.success++;
      } catch (err) {
        stats.failed++;
        const msg =
          err.response && err.response.status
            ? `${err.response.status} ${err.message}`
            : err.message;
        console.error(`    x ${item.id}: ${msg}`);
        log({ event: 'failed', id: item.id, error: msg });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => runWorker())
  );

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log(`Success: ${stats.success}`);
  console.log(`Failed:  ${stats.failed}`);
  const remaining = total - stats.success;
  if (remaining > 0) {
    console.log(
      `Still remaining: ${remaining}. Re-run to continue (script is idempotent).`
    );
  } else if (!DRY_RUN) {
    console.log('All items processed.');
  }

  await sequelize.close();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  try {
    await sequelize.close();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
