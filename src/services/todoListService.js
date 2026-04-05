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
const sharp = require('sharp');
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
  const prompt = `You are writing a to-do list for Lala, a fashion character in a luxury life simulator show.

The to-do list appears on screen as a checklist overlay that Lala works through while getting ready for an event.
It must feel personal, specific to this event, and written in the show's warm voice — not generic.

EVENT:
Name: ${event.name}
Theme: ${event.theme || 'not set'}
Mood: ${event.mood || 'aspirational'}
Dress Code: ${event.dress_code || 'chic'}
Style Keywords: ${(event.dress_code_keywords || []).join(', ')}
Location: ${event.location_hint || 'exclusive venue'}
Prestige: ${event.prestige || 5}/10
Guest allowed: ${(event.browse_pool_size || 1) >= 2 ? 'Yes — plus one welcome' : 'No'}
${event.narrative_stakes ? `Stakes: ${event.narrative_stakes.slice(0, 200)}` : ''}

Write exactly 7 tasks — one for each wardrobe slot below.
Each task should feel like it was written specifically for THIS event, not a generic checklist.
The description should be 1 short sentence that references the event's vibe.
Mark required: true for dress and shoes. Everything else required: false.

Note: "dress" means either a dress OR a top+bottom combination.
If generating tasks for top and bottom, treat them as one combined styling task.

Slots (in order):
1. dress — the main outfit (dress, or top + bottom combination)
2. shoes — footwear
3. accessories — bag, purse, clutch
4. jewelry — earrings, necklace, rings
5. perfume — fragrance
6. top — alternative to dress (top half)
7. bottom — alternative to dress (bottom half)

Respond ONLY with a JSON array. No preamble. No explanation.

[
  {
    "slot": "dress",
    "label": "Choose your main outfit",
    "description": "One sentence specific to this event's vibe",
    "required": true,
    "completed": false,
    "order": 1
  },
  ...7 total
]`;

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
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
    // Fallback — generic tasks
    return SLOTS.map((s, i) => ({
      slot:        s.slot,
      label:       s.label,
      description: `Choose your ${s.label.toLowerCase()} for ${event.name}`,
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

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

function renderTodoAsset(tasks, event, options = {}) {
  loadFonts();

  const W = options.width || 520;
  const PADDING = 28;
  const HEADER_H = 90;
  const TASK_H = 64;
  const FOOTER_H = 40;
  const H = HEADER_H + (tasks.length * TASK_H) + FOOTER_H + (PADDING * 2);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Theme colors
  const theme = event.theme || '';
  let accentColor = '#B8962E';
  let bgColor     = 'rgba(250,247,240,0.97)';
  let checkColor  = '#1A7A40';

  if (theme.includes('avant-garde')) {
    accentColor = '#1A1A1A'; bgColor = 'rgba(245,245,245,0.97)';
  } else if (theme.includes('soft glam') || theme.includes('romantic')) {
    accentColor = '#C2185B'; bgColor = 'rgba(255,248,250,0.97)';
  } else if (theme.includes('minimal')) {
    accentColor = '#333'; bgColor = 'rgba(255,255,255,0.97)';
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

  // Header
  let y = PADDING;

  ctx.font = `bold ${Math.round(W * 0.044)}px CormorantGaramond, serif`;
  ctx.fillStyle = '#1A1A1A';
  ctx.textAlign = 'center';
  ctx.fillText(event.name?.split(' — ')[0] || 'To Do', W / 2, y + 32);

  ctx.font = `italic ${Math.round(W * 0.028)}px CormorantGaramond, serif`;
  ctx.fillStyle = accentColor;
  ctx.fillText('Getting Ready Checklist', W / 2, y + 56);

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

  // Create Asset record
  const { Asset } = models;
  const asset = await Asset.create({
    id: uuidv4(),
    name: `${event.name} — To-Do List`,
    asset_type: 'TODO_LIST',
    asset_role: 'UI.OVERLAY.TODO_LIST',
    asset_group: 'EPISODE',
    asset_scope: 'EPISODE',
    purpose: 'MAIN',
    category: 'overlay',
    entity_type: 'prop',
    s3_url_raw: assetUrl,
    s3_url_processed: assetUrl,
    processing_status: 'none',
    episode_id: episodeId,
    show_id: showId,
    approval_status: 'approved',
    metadata: {
      source: 'todo-list-generator',
      event_id: event.id,
      event_name: event.name,
      task_count: tasks.length,
      required_count: tasks.filter(t => t.required).length,
      generated_at: new Date().toISOString(),
    },
  });

  // Upsert episode_todo_lists record
  const existing = await sequelize.query(
    'SELECT id FROM episode_todo_lists WHERE episode_id = :episodeId LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (existing.length > 0) {
    await sequelize.query(
      `UPDATE episode_todo_lists
       SET tasks = :tasks, asset_id = :assetId, asset_url = :assetUrl,
           event_id = :eventId, status = 'generated', updated_at = NOW()
       WHERE episode_id = :episodeId`,
      {
        replacements: {
          tasks: JSON.stringify(tasks),
          assetId: asset.id,
          assetUrl,
          eventId: event.id,
          episodeId,
        },
      }
    );
  } else {
    await sequelize.query(
      `INSERT INTO episode_todo_lists
       (id, episode_id, show_id, event_id, tasks, asset_id, asset_url, status, generated_by, created_at, updated_at)
       VALUES (:id, :episodeId, :showId, :eventId, :tasks, :assetId, :assetUrl, 'generated', 'ai', NOW(), NOW())`,
      {
        replacements: {
          id: uuidv4(),
          episodeId,
          showId: showId || null,
          eventId: event.id,
          tasks: JSON.stringify(tasks),
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

module.exports = {
  generateEpisodeTodoList,
  getTodoList,
  generateTasks,
  renderTodoAsset,
};
