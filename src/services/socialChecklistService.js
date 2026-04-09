'use strict';

/**
 * Social Checklist Service
 *
 * Renders social media tasks as a styled PNG checklist asset.
 * Similar to the invitation card and todo list generators.
 * Used as an on-screen visual during episodes.
 */

const { createCanvas, registerFont } = require('canvas');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;

// ─── FONT SETUP ─────────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');
let fontsLoaded = false;

function loadFonts() {
  if (fontsLoaded) return;
  try {
    const reg = (file, family, weight, style) => {
      const p = path.join(FONT_DIR, file);
      if (fs.existsSync(p)) registerFont(p, { family, weight, style });
    };
    reg('CormorantGaramond-Bold.ttf', 'CormorantGaramond', 'bold', 'normal');
    reg('CormorantGaramond-Italic.ttf', 'CormorantGaramond', 'normal', 'italic');
    reg('LibreBaskerville-Regular.ttf', 'LibreBaskerville', 'normal', 'normal');
    reg('LibreBaskerville-Bold.ttf', 'LibreBaskerville', 'bold', 'normal');
    fontsLoaded = true;
  } catch { fontsLoaded = true; }
}

// ─── TIMING PHASES ──────────────────────────────────────────────────────────

const TIMING_CONFIG = {
  before: { label: 'BEFORE THE EVENT', color: '#B8962E', icon: '◇' },
  during: { label: 'DURING THE EVENT', color: '#6366f1', icon: '◈' },
  after:  { label: 'AFTER THE EVENT', color: '#16a34a', icon: '◇' },
};

// ─── CANVAS RENDERER ────────────────────────────────────────────────────────

function renderSocialChecklist(tasks, event, options = {}) {
  loadFonts();

  const W = options.width || 520;
  const PADDING = 28;
  const HEADER_H = 100;
  const PHASE_HEADER_H = 32;
  const TASK_H = 48;
  const FOOTER_H = 44;

  // Group tasks by timing
  const groups = {};
  for (const t of tasks) {
    const timing = t.timing || 'during';
    if (!groups[timing]) groups[timing] = [];
    groups[timing].push(t);
  }
  const phases = ['before', 'during', 'after'].filter(p => groups[p]?.length > 0);

  // Calculate height
  const taskCount = tasks.length;
  const phaseCount = phases.length;
  const H = HEADER_H + (phaseCount * PHASE_HEADER_H) + (taskCount * TASK_H) + FOOTER_H + (PADDING * 2);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Theme colors ──
  const accentColor = '#B8962E';
  const bgColor = 'rgba(250,247,240,0.97)';

  // ── Card background with rounded corners ──
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Border
  ctx.strokeStyle = accentColor + '40';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Header ──
  let y = PADDING;

  // Event name
  ctx.font = `bold ${Math.round(W * 0.042)}px CormorantGaramond, serif`;
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'center';
  const eventName = (event.name || 'Event').length > 35
    ? (event.name || 'Event').slice(0, 32) + '...'
    : (event.name || 'Event');
  ctx.fillText(eventName, W / 2, y + 30);

  // Subtitle
  ctx.font = `italic ${Math.round(W * 0.026)}px CormorantGaramond, serif`;
  ctx.fillStyle = accentColor;
  ctx.fillText('Social Media Checklist', W / 2, y + 52);

  // Task count + required count
  const reqCount = tasks.filter(t => t.required).length;
  ctx.font = `${Math.round(W * 0.022)}px LibreBaskerville, serif`;
  ctx.fillStyle = '#666';
  ctx.fillText(`${tasks.length} tasks · ${reqCount} required`, W / 2, y + 72);

  // Header divider
  y = HEADER_H;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(W - PADDING, y);
  ctx.strokeStyle = accentColor + '30';
  ctx.lineWidth = 1;
  ctx.stroke();
  y += 8;

  // ── Phase groups ──
  for (const phase of phases) {
    const config = TIMING_CONFIG[phase];
    const phaseTasks = groups[phase];

    // Phase header
    ctx.font = `bold ${Math.round(W * 0.02)}px LibreBaskerville, serif`;
    ctx.fillStyle = config.color;
    ctx.textAlign = 'left';
    ctx.fillText(`${config.icon}  ${config.label}`, PADDING, y + 20);
    ctx.textAlign = 'right';
    ctx.font = `${Math.round(W * 0.018)}px LibreBaskerville, serif`;
    ctx.fillStyle = config.color + '80';
    ctx.fillText(`${phaseTasks.length} tasks`, W - PADDING, y + 20);
    y += PHASE_HEADER_H;

    // Tasks
    for (const task of phaseTasks) {
      const taskY = y;
      const checkSize = 16;
      const checkX = PADDING + 8;
      const checkY = taskY + (TASK_H / 2) - (checkSize / 2);

      // Checkbox
      ctx.beginPath();
      ctx.rect(checkX, checkY, checkSize, checkSize);
      ctx.strokeStyle = task.required ? config.color : config.color + '60';
      ctx.lineWidth = task.required ? 1.8 : 1.2;
      ctx.stroke();

      // Completed check
      if (task.completed) {
        ctx.fillStyle = config.color;
        ctx.fillRect(checkX, checkY, checkSize, checkSize);
        ctx.font = 'bold 11px LibreBaskerville, serif';
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.fillText('✓', checkX + checkSize / 2, checkY + 12);
      }

      // Task label
      const labelX = checkX + checkSize + 12;
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.round(W * 0.028)}px LibreBaskerville, serif`;
      ctx.fillStyle = task.completed ? '#AAA' : '#1A1A1A';
      ctx.fillText(task.label, labelX, taskY + 18);

      // Platform badge
      ctx.font = `${Math.round(W * 0.02)}px LibreBaskerville, serif`;
      ctx.fillStyle = task.completed ? '#CCC' : '#999';
      ctx.fillText(task.platform || '', labelX, taskY + 34);

      // Required badge
      if (task.required) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${Math.round(W * 0.018)}px LibreBaskerville, serif`;
        ctx.fillStyle = config.color;
        ctx.fillText('required', W - PADDING, taskY + 18);
        ctx.textAlign = 'left';
      }

      // Source badge (platform/niche bonus)
      if (task.source === 'platform') {
        ctx.textAlign = 'right';
        ctx.font = `${Math.round(W * 0.016)}px LibreBaskerville, serif`;
        ctx.fillStyle = '#6366f1';
        ctx.fillText('platform bonus', W - PADDING, taskY + 34);
        ctx.textAlign = 'left';
      } else if (task.source === 'category') {
        ctx.textAlign = 'right';
        ctx.font = `${Math.round(W * 0.016)}px LibreBaskerville, serif`;
        ctx.fillStyle = '#16a34a';
        ctx.fillText('niche bonus', W - PADDING, taskY + 34);
        ctx.textAlign = 'left';
      }

      // Row divider
      ctx.beginPath();
      ctx.moveTo(labelX, taskY + TASK_H - 1);
      ctx.lineTo(W - PADDING, taskY + TASK_H - 1);
      ctx.strokeStyle = '#EEE';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      y += TASK_H;
    }

    y += 4; // gap between phases
  }

  // ── Footer ──
  y += 8;
  ctx.font = `italic ${Math.round(W * 0.022)}px CormorantGaramond, serif`;
  ctx.fillStyle = accentColor + '80';
  ctx.textAlign = 'center';
  ctx.fillText('LalaVerse · Content Strategy', W / 2, y + 16);

  return canvas.toBuffer('image/png');
}

// ─── S3 UPLOAD ──────────────────────────────────────────────────────────────

async function uploadChecklist(buffer, eventId) {
  const s3Key = `social-checklists/${eventId}/${uuidv4()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
}

// ─── MAIN: GENERATE SOCIAL CHECKLIST ────────────────────────────────────────

async function generateSocialChecklist(event, models) {
  let tasks = event.canon_consequences?.automation?.social_tasks || [];
  if (!Array.isArray(tasks)) tasks = [];

  if (tasks.length === 0) {
    // Generate tasks on the fly
    const { buildSocialTasks } = require('./episodeGeneratorService');
    const eventType = event.event_type || 'invite';
    const auto = event.canon_consequences?.automation || {};
    let hostProfile = null;
    if (auto.host_profile_id) {
      try {
        const [rows] = await models.sequelize.query(
          'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: auto.host_profile_id } }
        );
        hostProfile = rows?.[0] || null;
      } catch { /* non-blocking */ }
    }
    tasks = buildSocialTasks(eventType, hostProfile);
  }

  const buffer = renderSocialChecklist(tasks, event);

  // Upload to S3 (optional — skip if no bucket configured)
  let assetUrl = null;
  try {
    if (S3_BUCKET) {
      assetUrl = await uploadChecklist(buffer, event.id);
    }
  } catch (uploadErr) {
    console.warn('[SocialChecklist] S3 upload failed (non-blocking):', uploadErr.message);
  }

  // Create Asset record (optional)
  const { Asset } = models;
  let asset = null;
  if (Asset && assetUrl) {
    try {
      asset = await Asset.create({
      id: uuidv4(),
      name: `${event.name} — Social Checklist`,
      asset_type: 'SOCIAL_CHECKLIST',
      asset_role: 'UI.OVERLAY.SOCIAL_CHECKLIST',
      asset_group: 'EVENT',
      asset_scope: 'EVENT',
      purpose: 'MAIN',
      category: 'overlay',
      entity_type: 'prop',
      s3_url_raw: assetUrl,
      s3_url_processed: assetUrl,
      // processing_status: 'none', — column may not exist
      show_id: event.show_id,
      approval_status: 'approved',
      metadata: {
        source: 'social-checklist-generator',
        event_id: event.id,
        event_name: event.name,
        task_count: tasks.length,
        required_count: tasks.filter(t => t.required).length,
        generated_at: new Date().toISOString(),
      },
    });
    } catch (assetErr) {
      console.warn('[SocialChecklist] Asset.create failed (non-blocking):', assetErr.message);
    }
  }

  // Store tasks + checklist URL back on the event automation data
  try {
    const auto = event.canon_consequences?.automation || {};
    auto.social_tasks = tasks;
    if (assetUrl) auto.social_checklist_url = assetUrl;
    if (asset?.id) auto.social_checklist_asset_id = asset.id;
    await models.sequelize.query(
      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
      { replacements: { cc: JSON.stringify({ ...event.canon_consequences, automation: auto }), id: event.id } }
    );
  } catch { /* non-blocking */ }

  return { tasks, assetUrl, assetId: asset?.id || null };
}

module.exports = {
  renderSocialChecklist,
  generateSocialChecklist,
  uploadChecklist,
};
