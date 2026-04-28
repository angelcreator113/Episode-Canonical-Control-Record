'use strict';

/**
 * Episode To-Do List Service
 *
 * Two responsibilities:
 *   1. generateTasks() — Claude reads event data, writes slot-specific tasks
 *   2. renderTodoAsset() — Canvas renders the task list as a PNG overlay
 *
 * Task structure:
 * {
 *   slot:        'shoes'           — wardrobe clothing_category
 *   label:       'Find your shoes' — short display label
 *   description: 'Cute and comfy for all that mingling'
 *   required:    true/false
 *   completed:   false             — updated by wardrobe gameplay
 *   order:       1-7               — display order
 * }
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createCanvas, registerFont } = require('canvas');
const _sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;

// Lazy Anthropic instantiation — avoids crash if API key missing at startup
function getAnthropic() {
  return new Anthropic();
}

// ─── SLOT DEFINITIONS (matches wardrobe clothing_category values) ─────────────

const SLOTS = [
  { slot: 'dress',       icon: '👗', label: 'Main Outfit',  required: true  },
  { slot: 'shoes',       icon: '👠', label: 'Shoes',        required: true  },
  { slot: 'accessories', icon: '👜', label: 'Accessories',  required: false },
  { slot: 'jewelry',     icon: '💍', label: 'Jewelry',      required: false },
  { slot: 'perfume',     icon: '🌸', label: 'Perfume',      required: false },
  { slot: 'top',         icon: '👚', label: 'Top',          required: false },
  { slot: 'bottom',      icon: '👖', label: 'Bottom',       required: false },
];

// ─── CLAUDE TASK GENERATOR ────────────────────────────────────────────────────

async function generateTasks(event) {
  const prestige = event.prestige || 5;
  const dressCode = event.dress_code || 'chic';
  const mood = event.mood || 'aspirational';
  const stakes = event.narrative_stakes ? event.narrative_stakes.slice(0, 200) : '';

  const prompt = `You are writing Lala's wardrobe shopping list — a dreamy, specific to-do list she makes while getting ready for an event.

This is NOT a boring checklist. Each item should have a cute, evocative name that captures the VIBE of what she's hunting for. Think of how a fashion-obsessed girl would describe what she wants to find:

EXAMPLES of the tone we want:
- Instead of "Find your dress" → "Find a showstopper that makes the room go quiet"
- Instead of "Find shoes" → "Find heels that say 'I belong at the front row'"
- Instead of "Find perfume" → "Find a floral scent that makes someone lean in close"
- Instead of "Find accessories" → "Find a clutch that holds secrets and lipstick"
- Instead of "Find jewelry" → "Find gold that catches the chandelier light"

EVENT:
Name: ${event.name}
Theme: ${event.theme || 'not set'}
Mood: ${mood}
Dress Code: ${dressCode}
Style Keywords: ${(event.dress_code_keywords || []).join(', ')}
Location: ${event.location_hint || 'exclusive venue'}
Prestige: ${prestige}/10
${stakes ? `Stakes: ${stakes}` : ''}

Write exactly 7 tasks — one for each wardrobe slot below.
The "label" must be a CUTE, VIVID, VIBE-BASED name (7-15 words max) — never generic.
The "description" is one whispered sentence about why this piece matters for tonight.
Mark required: true for dress and shoes. Everything else required: false.

Slots (in order):
1. dress — the main outfit (dress, or top + bottom combination)
2. shoes — footwear
3. accessories — bag, purse, clutch
4. jewelry — earrings, necklace, rings, bracelet
5. perfume — fragrance, scent
6. top — alternative to dress (top half only)
7. bottom — alternative to dress (skirt, pants, bottom half)

Respond ONLY with a JSON array. No preamble. No explanation.

[
  {
    "slot": "dress",
    "label": "Find a showstopper that makes the room go quiet",
    "description": "Tonight is ${prestige >= 8 ? 'the biggest stage yet' : prestige >= 5 ? 'about making an impression' : 'a chance to be seen'}",
    "required": true,
    "completed": false,
    "order": 1
  },
  ...7 total
]`;

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0]?.text || '[]';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    const tasks = JSON.parse(clean);
    return tasks.map((t, i) => ({
      slot:        t.slot        || SLOTS[i]?.slot || 'dress',
      label:       t.label       || SLOTS[i]?.label || 'Task',
      description: t.description || '',
      required:    t.required    ?? SLOTS[i]?.required ?? false,
      completed:   false,
      order:       i + 1,
    }));
  } catch {
    // Fallback — cute vibe-based defaults
    const VIBE_FALLBACKS = {
      dress:       { label: 'Find a look that says everything without a word',       desc: 'The outfit sets the tone for the whole night' },
      shoes:       { label: 'Find heels that make every step count',                 desc: 'Confidence starts from the ground up' },
      accessories: { label: 'Find a clutch that holds secrets and lipstick',          desc: 'The finishing touch that ties it together' },
      jewelry:     { label: 'Find something gold that catches the light',             desc: 'A little sparkle goes a long way' },
      perfume:     { label: 'Find a scent that makes someone lean in close',          desc: 'The invisible accessory they remember most' },
      top:         { label: 'Find a top that turns heads on its own',                 desc: 'Sometimes the top half does all the talking' },
      bottom:      { label: 'Find a bottom that moves like it was made for tonight',  desc: 'Pair it right and the outfit writes itself' },
    };
    return SLOTS.map((s, i) => ({
      slot:        s.slot,
      label:       VIBE_FALLBACKS[s.slot]?.label || `Find your ${s.label.toLowerCase()}`,
      description: VIBE_FALLBACKS[s.slot]?.desc || `Choose something perfect for ${event.name}`,
      required:    s.required,
      completed:   false,
      order:       i + 1,
    }));
  }
}

// ─── FONT SETUP ───────────────────────────────────────────────────────────────

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');
let fontsLoaded = false;

function loadFonts() {
  if (fontsLoaded) return;
  try {
    const reg = (file, family, weight, style) => {
      const p = path.join(FONT_DIR, file);
      if (fs.existsSync(p)) registerFont(p, { family, weight, style });
    };
    reg('CormorantGaramond-Bold.ttf',   'CormorantGaramond', 'bold',   'normal');
    reg('CormorantGaramond-Italic.ttf', 'CormorantGaramond', 'normal', 'italic');
    reg('LibreBaskerville-Regular.ttf', 'LibreBaskerville',  'normal', 'normal');
    reg('LibreBaskerville-Bold.ttf',    'LibreBaskerville',  'bold',   'normal');
    fontsLoaded = true;
  } catch { fontsLoaded = true; }
}

function wrapTextWithEllipsis(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['To Do'];

  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines - 1) break;
  }

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  const remaining = words.slice(consumedWords);
  const lastLineRaw = remaining.length ? remaining.join(' ') : current;

  let lastLine = lastLineRaw;
  if (lines.length >= maxLines) {
    lastLine = lines.pop() || lastLineRaw;
  }
  while (ctx.measureText(lastLine).width > maxWidth && lastLine.length > 1) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }

  const hasTrimmed = (consumedWords + remaining.length) < words.length || ctx.measureText(lastLineRaw).width > maxWidth;
  if (hasTrimmed && !lastLine.endsWith('...')) {
    while (ctx.measureText(`${lastLine}...`).width > maxWidth && lastLine.length > 1) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    lastLine = `${lastLine}...`;
  }

  lines.push(lastLine);
  return lines.slice(0, maxLines);
}

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

/**
 * Render a to-do list as a transparent PNG overlay for video compositing.
 *
 * @param {Array} tasks - Array of task objects
 * @param {object} event - The world event
 * @param {object} options - { width, listType: 'wardrobe' | 'career' }
 */
function renderTodoAsset(tasks, event, options = {}) {
  loadFonts();

  const listType = options.listType || 'wardrobe';
  const W = options.width || 520;
  const PADDING = 28;
  const HEADER_H = 118;
  const TASK_H = 64;
  const FOOTER_H = 40;
  const H = HEADER_H + (tasks.length * TASK_H) + FOOTER_H + (PADDING * 2);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Theme colors — career list gets a slightly different palette
  const theme = event.theme || '';
  let accentColor = listType === 'career' ? '#6366f1' : '#B8962E';
  let bgColor     = listType === 'career' ? 'rgba(238,242,255,0.97)' : 'rgba(250,247,240,0.97)';
  const checkColor  = '#1A7A40';

  if (listType === 'wardrobe') {
    if (theme.includes('avant-garde')) {
      accentColor = '#1A1A1A'; bgColor = 'rgba(245,245,245,0.97)';
    } else if (theme.includes('soft glam') || theme.includes('romantic')) {
      accentColor = '#C2185B'; bgColor = 'rgba(255,248,250,0.97)';
    } else if (theme.includes('minimal')) {
      accentColor = '#333'; bgColor = 'rgba(255,255,255,0.97)';
    }
  }

  // Card background with rounded corners
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

  // Header — different titles per list type
  let y = PADDING;

  const titleFontSize = Math.round(W * 0.044);
  const titleLineHeight = Math.round(titleFontSize * 1.15);
  const titleMaxWidth = W - (PADDING * 2);
  const rawTitle = event.name?.split(' — ')[0] || 'To Do';

  ctx.font = `bold ${titleFontSize}px CormorantGaramond, serif`;
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'center';
  const titleLines = wrapTextWithEllipsis(ctx, rawTitle, titleMaxWidth, 2);
  let titleY = y + 26;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, titleY);
    titleY += titleLineHeight;
  }

  ctx.font = `italic ${Math.round(W * 0.028)}px CormorantGaramond, serif`;
  ctx.fillStyle = accentColor;
  const subtitle = listType === 'career' ? 'Career Checklist' : 'Wardrobe Shopping List';
  ctx.fillText(subtitle, W / 2, titleY + 6);

  // Header divider
  y = HEADER_H;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(W - PADDING, y);
  ctx.strokeStyle = accentColor + '30';
  ctx.lineWidth = 1;
  ctx.stroke();
  y += 8;

  // Tasks
  for (const task of tasks) {
    const taskY = y;
    const checkSize = 18;
    const checkX = PADDING;
    const checkY = taskY + (TASK_H / 2) - (checkSize / 2);

    // Checkbox — plain rect
    ctx.beginPath();
    ctx.rect(checkX, checkY, checkSize, checkSize);
    ctx.strokeStyle = task.required ? accentColor : accentColor + '70';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (task.completed) {
      ctx.fillStyle = checkColor;
      ctx.fillRect(checkX, checkY, checkSize, checkSize);
      ctx.font = 'bold 13px LibreBaskerville, serif';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.fillText('✓', checkX + checkSize / 2, checkY + 13);
    }

    // Task label
    const labelX = checkX + checkSize + 12;
    const labelW = W - labelX - PADDING;

    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.round(W * 0.032)}px LibreBaskerville, serif`;
    ctx.fillStyle = task.completed ? '#AAA' : '#1A1A1A';
    ctx.fillText(task.label, labelX, taskY + 22);

    // Task description
    if (task.description) {
      ctx.font = `italic ${Math.round(W * 0.026)}px LibreBaskerville, serif`;
      ctx.fillStyle = task.completed ? '#CCC' : '#666';
      let desc = task.description;
      while (ctx.measureText(desc).width > labelW && desc.length > 20) {
        desc = desc.slice(0, -4) + '...';
      }
      ctx.fillText(desc, labelX, taskY + 42);
    }

    // Optional badge
    if (!task.required) {
      ctx.font = `${Math.round(W * 0.022)}px LibreBaskerville, serif`;
      ctx.fillStyle = accentColor + '80';
      ctx.textAlign = 'right';
      ctx.fillText('optional', W - PADDING, taskY + 22);
      ctx.textAlign = 'left';
    }

    // Row divider
    if (task.order < tasks.length) {
      ctx.beginPath();
      ctx.moveTo(PADDING + checkSize + 12, taskY + TASK_H);
      ctx.lineTo(W - PADDING, taskY + TASK_H);
      ctx.strokeStyle = '#EEE';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    y += TASK_H;
  }

  // Footer
  y += 12;
  ctx.font = `italic ${Math.round(W * 0.024)}px CormorantGaramond, serif`;
  ctx.fillStyle = accentColor + '80';
  ctx.textAlign = 'center';
  ctx.fillText('LalaVerse', W / 2, y + 16);

  return canvas.toBuffer('image/png');
}

// ─── S3 UPLOAD ────────────────────────────────────────────────────────────────

async function uploadTodoAsset(buffer, episodeId) {
  const s3Key = `todo-lists/${episodeId}/${uuidv4()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
}

// ─── MAIN SERVICE ─────────────────────────────────────────────────────────────

async function generateEpisodeTodoList(episodeId, showId, models) {
  const { sequelize } = models;

  // Load linked event (world_events has no deleted_at column)
  const [event] = await sequelize.query(
    `SELECT we.* FROM world_events we
     WHERE we.used_in_episode_id = :episodeId
     LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error('No event linked to this episode. Inject an event first.');

  console.log(`[TodoList] Generating for: ${event.name}`);

  const tasks = await generateTasks(event);
  console.log(`[TodoList] Generated ${tasks.length} tasks`);

  const buffer = renderTodoAsset(tasks, event);
  const assetUrl = await uploadTodoAsset(buffer, episodeId);
  console.log(`[TodoList] Asset stored: ${assetUrl.slice(-50)}`);

  // Create Asset record — wardrobe shopping list overlay
  const { Asset } = models;
  const asset = await Asset.create({
    id: uuidv4(),
    name: `${event.name} — Wardrobe List`,
    asset_type: 'TODO_LIST',
    asset_role: 'UI.OVERLAY.WARDROBE_LIST',
    asset_group: 'EPISODE',
    asset_scope: 'EPISODE',
    purpose: 'MAIN',
    category: 'overlay',
    entity_type: 'prop',
    s3_url_raw: assetUrl,
    s3_url_processed: assetUrl,
    episode_id: episodeId,
    show_id: showId,
    approval_status: 'approved',
    metadata: {
      source: 'todo-list-generator',
      list_type: 'wardrobe',
      event_id: event.id,
      event_name: event.name,
      task_count: tasks.length,
      required_count: tasks.filter(t => t.required).length,
      generated_at: new Date().toISOString(),
    },
  });

  // Upsert episode_todo_lists record — preserve social_tasks if already generated by episodeGeneratorService
  const existing = await sequelize.query(
    'SELECT id, social_tasks, financial_summary FROM episode_todo_lists WHERE episode_id = :episodeId LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  // If no social tasks exist yet, generate platform-aware ones
  let socialTasksJson = null;
  if (!existing.length || !existing[0].social_tasks) {
    try {
      const { buildSocialTasks } = require('./episodeGeneratorService');
      const eventType = event.event_type || 'invite';
      // Try to load host profile for platform-aware tasks
      let hostProfile = null;
      const automation = typeof event.canon_consequences === 'string'
        ? JSON.parse(event.canon_consequences)?.automation
        : event.canon_consequences?.automation;
      if (automation?.host_profile_id) {
        const [rows] = await sequelize.query(
          'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: automation.host_profile_id } }
        );
        hostProfile = rows?.[0] || null;
      }
      const socialTasks = buildSocialTasks(eventType, hostProfile);
      socialTasksJson = JSON.stringify(socialTasks);
    } catch { /* episodeGeneratorService not available — skip */ }
  }

  if (existing.length > 0) {
    const updateParts = [
      'tasks = :tasks', 'asset_id = :assetId', 'asset_url = :assetUrl',
      'event_id = :eventId', "status = 'generated'", 'updated_at = NOW()',
    ];
    const replacements = { tasks: JSON.stringify(tasks), assetId: asset.id, assetUrl, eventId: event.id, episodeId };
    if (socialTasksJson && !existing[0].social_tasks) {
      updateParts.push('social_tasks = :socialTasks');
      replacements.socialTasks = socialTasksJson;
    }
    await sequelize.query(
      `UPDATE episode_todo_lists SET ${updateParts.join(', ')} WHERE episode_id = :episodeId`,
      { replacements }
    );
  } else {
    await sequelize.query(
      `INSERT INTO episode_todo_lists
       (id, episode_id, show_id, event_id, tasks, social_tasks, asset_id, asset_url, status, generated_by, created_at, updated_at)
       VALUES (:id, :episodeId, :showId, :eventId, :tasks, :socialTasks, :assetId, :assetUrl, 'generated', 'ai', NOW(), NOW())`,
      {
        replacements: {
          id: uuidv4(),
          episodeId,
          showId: showId || null,
          eventId: event.id,
          tasks: JSON.stringify(tasks),
          socialTasks: socialTasksJson || '[]',
          assetId: asset.id,
          assetUrl,
        },
      }
    );
  }

  return { tasks, assetUrl, assetId: asset.id, eventName: event.name };
}

async function getTodoList(episodeId, models) {
  const { sequelize } = models;

  const [todoList] = await sequelize.query(
    'SELECT * FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!todoList) return null;

  // Check which slots are filled from episode wardrobe
  const wardrobeItems = await sequelize.query(
    `SELECT w.clothing_category
     FROM episode_wardrobe ew
     JOIN wardrobe w ON w.id = ew.wardrobe_id
     WHERE ew.episode_id = :episodeId`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  const filledSlots = new Set(wardrobeItems.map(w => w.clothing_category));

  // Map dress/top/bottom to body slot
  const bodyFilled = filledSlots.has('dress') || (filledSlots.has('top') && filledSlots.has('bottom'));
  if (bodyFilled) filledSlots.add('dress');

  const tasks = (typeof todoList.tasks === 'string'
    ? JSON.parse(todoList.tasks)
    : todoList.tasks
  ).map(t => ({
    ...t,
    completed: filledSlots.has(t.slot),
  }));

  return {
    ...todoList,
    tasks,
    completion: {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      required_total: tasks.filter(t => t.required).length,
      required_completed: tasks.filter(t => t.required && t.completed).length,
      all_required_done: tasks.filter(t => t.required).every(t => t.completed),
    },
  };
}

// ─── CAREER LIST GENERATOR ───────────────────────────────────────────────────

/**
 * Generate a career task list for an event — the tasks Lala must complete
 * during the event itself (deliverables, social posts, networking goals).
 *
 * This is To-Do List #2 (UI.OVERLAY.CAREER_LIST) — separate from the
 * wardrobe shopping list (UI.OVERLAY.WARDROBE_LIST).
 */
async function generateCareerTasks(event) {
  const prompt = `You are writing Lala's CAREER to-do list for an event in a luxury life simulator show.

This is NOT the wardrobe checklist — this is about what she needs to ACCOMPLISH during the event:
deliverables, content to create, people to network with, social media tasks, brand obligations.

EVENT:
Name: ${event.name}
Type: ${event.event_type || 'invite'}
Host: ${event.host || 'unknown'}
Brand: ${event.host_brand || 'none'}
Prestige: ${event.prestige || 5}/10
Dress Code: ${event.dress_code || 'chic'}
${event.narrative_stakes ? `Stakes: ${event.narrative_stakes.slice(0, 200)}` : ''}
${event.is_paid ? `Payment: ${event.payment_amount} coins` : 'Unpaid event'}

Write 4-6 career tasks. Each should feel specific to THIS event.
Mix of:
- Content creation (what to film, post, or capture)
- Networking (who to connect with, impressions to make)
- Brand deliverables (if brand_deal or paid event)
- Social media (what to post and when)
- Career positioning (what this event should do for her career)

Respond ONLY with a JSON array:
[
  {
    "slot": "content_main",
    "label": "Film a 30-second venue walkthrough for Stories",
    "description": "The algorithm rewards early-event content",
    "required": true,
    "completed": false,
    "order": 1
  }
]`;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0]?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    const tasks = JSON.parse(clean);
    return tasks.map((t, i) => ({
      slot:        t.slot        || `career_${i + 1}`,
      label:       t.label       || 'Career task',
      description: t.description || '',
      required:    t.required    ?? (i < 2),
      completed:   false,
      order:       i + 1,
    }));
  } catch {
    // Fallback career tasks
    return [
      { slot: 'content_main', label: 'Capture the moment everyone will talk about', description: 'The content that makes the event worth attending', required: true, completed: false, order: 1 },
      { slot: 'network', label: 'Make one connection that changes everything', description: 'The right conversation at the right time', required: true, completed: false, order: 2 },
      { slot: 'social_post', label: 'Post before the night ends', description: 'First to post sets the narrative', required: false, completed: false, order: 3 },
      { slot: 'brand_moment', label: 'Give the brand their money shot', description: 'They invited you for a reason — deliver it', required: false, completed: false, order: 4 },
    ];
  }
}

/**
 * Generate career list + render as overlay asset for video editing.
 */
async function generateCareerList(episodeId, showId, models) {
  const { sequelize } = models;

  const [event] = await sequelize.query(
    'SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error('No event linked to this episode.');

  console.log(`[CareerList] Generating for: ${event.name}`);

  const tasks = await generateCareerTasks(event);
  const buffer = renderTodoAsset(tasks, event, { listType: 'career' });
  const assetUrl = await uploadTodoAsset(buffer, episodeId);

  const { Asset } = models;
  const asset = await Asset.create({
    id: uuidv4(),
    name: `${event.name} — Career List`,
    asset_type: 'TODO_LIST',
    asset_role: 'UI.OVERLAY.CAREER_LIST',
    asset_group: 'EPISODE',
    asset_scope: 'EPISODE',
    purpose: 'MAIN',
    category: 'overlay',
    entity_type: 'prop',
    s3_url_raw: assetUrl,
    s3_url_processed: assetUrl,
    episode_id: episodeId,
    show_id: showId,
    approval_status: 'approved',
    metadata: {
      source: 'career-list-generator',
      list_type: 'career',
      event_id: event.id,
      event_name: event.name,
      task_count: tasks.length,
      generated_at: new Date().toISOString(),
    },
  });

  return { tasks, assetUrl, assetId: asset.id, eventName: event.name, listType: 'career' };
}

module.exports = {
  generateEpisodeTodoList,
  generateCareerList,
  getTodoList,
  generateTasks,
  generateCareerTasks,
  renderTodoAsset,
};
