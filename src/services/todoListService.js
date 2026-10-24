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
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { listEventDeliverables } = require('./eventTermsService');
const { withDeliverableTasks, withCareerTasks } = require('../utils/socialTaskSource');
const {
  goalTaskScale, goalFields, composeGoalTasks, enforceGoalTaskBounds, remainingGoalRoom, capCombinedGoals,
} = require('../utils/goalTasks');
const { v4: uuidv4 } = require('uuid');
const { CATEGORY_ALIASES } = require('../utils/wardrobeSlots');
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
  { slot: 'purse',       icon: '👛', label: 'Purse',        required: false },
  { slot: 'accessories', icon: '👜', label: 'Accessories',  required: false },
  { slot: 'jewelry',     icon: '💍', label: 'Jewelry',      required: false },
  { slot: 'perfume',     icon: '🌸', label: 'Perfume',      required: false },
  { slot: 'top',         icon: '👚', label: 'Top',          required: false },
  { slot: 'bottom',      icon: '👖', label: 'Bottom',       required: false },
  // The hairstyle or wig (Evoni, 2026-10-14, Task #3167); last, so the
  // lines before it keep their places.
  { slot: 'hair',        icon: '💇', label: 'Hair',         required: false },
];

// ─── WHICH LIST LINES THE OUTFIT FILLS ─────────────────────────────────────────

// A wardrobe clothing_category as the shopping list's line (Evoni,
// 2026-10-06: a bag belongs on the list as a Purse, apart from the other
// accessories). Categories resolve through the wardrobe's own names and
// aliases (utils/wardrobeSlots: handbag, clutch, tote → bag; scarf, belt →
// accessory; fragrance → perfume), so a piece ticks its line whatever it was
// called. Before, a line ticked only on an exact match, and the wardrobe
// never saves a bag as 'accessories', so the bag line never ticked.
const CATEGORY_TO_LIST_SLOT = {
  dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes',
  bag: 'purse', accessory: 'accessories', jewelry: 'jewelry', perfume: 'perfume',
  hair: 'hair',
  // A jacket over the outfit has a line of its own when the list names one
  // (Task #3205); before, it filled nothing.
  outerwear: 'outerwear',
};

function listSlotOf(clothingCategory) {
  if (!clothingCategory || typeof clothingCategory !== 'string') return null;
  const raw = clothingCategory.toLowerCase().trim();
  if (CATEGORY_TO_LIST_SLOT[raw]) return CATEGORY_TO_LIST_SLOT[raw];
  const aliased = CATEGORY_ALIASES[raw];
  if (aliased && CATEGORY_TO_LIST_SLOT[aliased]) return CATEGORY_TO_LIST_SLOT[aliased];
  // Free text ("evening clutch", "silk scarf"): the first name it contains.
  for (const [name, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (raw.includes(name) && CATEGORY_TO_LIST_SLOT[canonical]) return CATEGORY_TO_LIST_SLOT[canonical];
  }
  for (const name of Object.keys(CATEGORY_TO_LIST_SLOT)) {
    if (raw.includes(name)) return CATEGORY_TO_LIST_SLOT[name];
  }
  return null;
}

/** The list lines an outfit's clothing_categories fill. */
function listSlotsFilled(categories = []) {
  const filled = new Set(categories.map(listSlotOf).filter(Boolean));
  // The main outfit is a dress, or a top and a bottom.
  if (filled.has('dress') || (filled.has('top') && filled.has('bottom'))) filled.add('dress');
  return filled;
}

/**
 * Whether a list line is ticked. A list saved before the Purse line has one
 * 'accessories' line for bags and the rest (its prompt said "bag, purse,
 * clutch"), so there either a purse or an accessory ticks it.
 */
function taskFilled(slot, filled, { legacyAccessories = false } = {}) {
  if (slot === 'accessories' && legacyAccessories) return filled.has('accessories') || filled.has('purse');
  return filled.has(slot);
}

// ─── CLAUDE TASK GENERATOR ────────────────────────────────────────────────────
//
// The shopping list (2026-10-24 rework). The lines are decided here, not by
// the model: from the look when there is one (a line per piece, the main
// outfit as a dress or a top and a bottom, outerwear when the look has it),
// else the standard lines (the main-outfit line means a dress, or a top and
// a bottom — listSlotsFilled — so there are no separate Top and Bottom
// lines). The model only words them, as a forced tool call; two attempts;
// a budget refusal is thrown; otherwise the fallback words each line from
// the piece and the event, never one generic list.

const SHOPPING_MODELS = ['claude-haiku-4-5-20251001'];
const SHOPPING_ATTEMPTS = 2;

// The standard lines, in order, when there is no look.
const DEFAULT_SHOPPING_SLOTS = ['dress', 'shoes', 'purse', 'accessories', 'jewelry', 'perfume', 'hair'];
// The order lines take on the list.
const SLOT_ORDER = ['dress', 'top', 'bottom', 'outerwear', 'shoes', 'purse', 'accessories', 'jewelry', 'perfume', 'hair'];
const REQUIRED_SLOTS = new Set(['dress', 'shoes']);
// Lines kept even when the look has no piece for them: the essentials, and
// the two that are rarely a wardrobe piece.
const ALWAYS_SLOTS = ['shoes', 'perfume', 'hair'];

const slotLabel = (slot) => SLOTS.find((s) => s.slot === slot)?.label || (slot === 'outerwear' ? 'Outerwear' : slot);

/** Whether a look piece is one Lala already has (owned, bought, gifted, borrowed). */
function pieceIsHers(p) {
  if (p && 'charge' in p) return !p.charge;
  return p?.is_owned === true;
}

function pieceCharge(p) {
  if (p && 'charge' in p) return p.charge ? Number(p.charge.amount) || 0 : 0;
  return p?.is_owned === true ? 0 : Number(p?.coin_cost) || 0;
}

/**
 * The list's lines: [{ slot, piece|null, pieces? }]. With a look, each
 * piece's line (a second piece on the same line gets a line of its own),
 * the main outfit as a dress or a top and a bottom, then the essentials it
 * lacks; without one, DEFAULT_SHOPPING_SLOTS.
 */
function shoppingPlan(look) {
  const pieces = Array.isArray(look?.pieces) ? look.pieces.filter(Boolean) : [];
  if (pieces.length === 0) return DEFAULT_SHOPPING_SLOTS.map((slot) => ({ slot, piece: null }));
  const lines = [];
  for (const p of pieces) {
    // A piece of no known line is left to the list's own "another piece"
    // line (shoppingLines), so it is neither lost nor counted twice.
    const slot = listSlotOf(p.category || p.clothing_category);
    if (slot) lines.push({ slot, piece: p });
  }
  const has = (slot) => lines.some((l) => l.slot === slot);
  // The main outfit: a dress, or a top and a bottom; with neither, a line to find one.
  if (!has('dress') && !(has('top') && has('bottom'))) lines.push({ slot: 'dress', piece: null });
  for (const slot of ALWAYS_SLOTS) if (!has(slot)) lines.push({ slot, piece: null });
  const rank = (slot) => { const i = SLOT_ORDER.indexOf(slot); return i === -1 ? SLOT_ORDER.length : i; };
  return lines.map((l, i) => ({ ...l, i })).sort((a, b) => rank(a.slot) - rank(b.slot) || a.i - b.i).map(({ i, ...l }) => l); // eslint-disable-line no-unused-vars
}

/** One line's facts for the prompt. */
function planLineFacts(line, n) {
  const p = line.piece;
  if (!p) return `${n + 1}. ${line.slot} — nothing chosen yet: she still has to find one`;
  const hers = pieceIsHers(p);
  const why = p.free_because && p.free_because !== 'free' ? ` (${p.free_because})` : '';
  return `${n + 1}. ${line.slot} — "${p.name || slotLabel(line.slot)}": ${hers ? `already hers${why}, she pulls it from her closet` : `to buy, ${pieceCharge(p)} coins`}`;
}

/** The words for a line when the model gives none: from its piece and the event. */
function fallbackLine(line, event) {
  const p = line.piece;
  const dress = event?.dress_code ? ` for ${event.dress_code}` : '';
  if (p?.name) {
    return pieceIsHers(p)
      ? { label: `Pull my ${p.name} from the closet`, description: `Already mine, and right${dress || ` for ${event?.name || 'tonight'}`}.` }
      : { label: `Pick up the ${p.name}`, description: `The piece that finishes the look${dress}.` };
  }
  const VIBE = {
    dress: ['Find a look that says everything without a word', 'The outfit sets the tone for the whole night'],
    shoes: ['Find heels that make every step count', 'Confidence starts from the ground up'],
    purse: ['Find a clutch that holds secrets and lipstick', 'The finishing touch that ties it together'],
    accessories: ['Find a silk scarf that finishes the story', 'The little extra that makes it hers'],
    jewelry: ['Find something gold that catches the light', 'A little sparkle goes a long way'],
    perfume: ['Find a scent that makes someone lean in close', 'The invisible accessory they remember most'],
    top: ['Find a top that turns heads on its own', 'Sometimes the top half does all the talking'],
    bottom: ['Find a bottom that moves like it was made for tonight', 'Pair it right and the outfit writes itself'],
    hair: ['Find a hairstyle that frames the whole look', 'The crown of the outfit, and the first thing they see'],
    outerwear: ['Find a jacket worth arriving in', 'The first thing they see at the door'],
  };
  const [label, description] = VIBE[line.slot] || [`Find the ${slotLabel(line.slot).toLowerCase()}`, `Something right for ${event?.name || 'tonight'}`];
  return { label, description: event?.dress_code && line.slot === 'dress' ? `Dress code: ${event.dress_code}. ${description}` : description };
}

function shoppingTask(line, words, i) {
  return {
    slot: line.slot,
    label: words.label,
    description: words.description || '',
    required: REQUIRED_SLOTS.has(line.slot),
    completed: false,
    order: i + 1,
    ...(line.piece?.id != null ? { piece_id: String(line.piece.id) } : {}),
  };
}

/**
 * The list with no AI call: every line worded from its piece and the event.
 * Start Episode uses it when the event has no approved list, so an episode
 * gets the same lines a draft would have.
 */
function defaultShoppingTasks(event, look = null) {
  return shoppingPlan(look).map((line, i) => shoppingTask(line, fallbackLine(line, event), i));
}

const SHOPPING_TOOL = Object.freeze({
  name: 'write_shopping_list',
  description: 'Return the wording for each line of the shopping list, in order.',
  input_schema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slot: { type: 'string' },
            label: { type: 'string', description: 'The line, 7-15 words, vivid and specific.' },
            description: { type: 'string', description: 'One whispered sentence about why it matters tonight.' },
          },
          required: ['slot', 'label'],
        },
      },
    },
    required: ['lines'],
  },
});

/**
 * A model reply's JSON: the named tool call's input, else JSON written as
 * text (an older reply shape: a bare array or object, fenced or not).
 * Throws when there is neither.
 */
function readJsonReply(response, toolName) {
  const call = (response?.content || []).find((b) => b?.type === 'tool_use' && b.name === toolName);
  if (call?.input) return call.input;
  const text = (response?.content || []).filter((b) => typeof b?.text === 'string').map((b) => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.search(/[[{]/);
  if (start === -1) throw new Error('reply holds no JSON');
  return JSON.parse(clean.slice(start));
}

const isBudgetRefusal = (err) => err?.code === 'AI_BUDGET_EXCEEDED';

/**
 * Lala's shopping list for an event.
 *
 * @param {object} event
 * @param {object} [opts]
 * @param {object|null} [opts.look]   episodeLook's { pieces, total }: the lines come from it
 * @param {{ balance: number, total: number }|null} [opts.budget]
 *        when set and the look costs more than she has, the lines for
 *        pieces to buy suggest renting, borrowing or a cheaper swap
 */
async function generateTasks(event, { look = null, budget = null } = {}) {
  const plan = shoppingPlan(look);
  const prestige = event.prestige || 5;
  const stakes = event.narrative_stakes ? event.narrative_stakes.slice(0, 200) : '';
  const short = budget && Number.isFinite(Number(budget.balance)) && Number(budget.total) > Number(budget.balance)
    ? Number(budget.total) - Number(budget.balance) : 0;

  const prompt = `You are writing Lala's wardrobe shopping list — a dreamy, specific to-do list she makes while getting ready for an event.

This is NOT a boring checklist. Each line has a cute, evocative name that captures the VIBE of what she's hunting for, the way a fashion-obsessed girl would write it:
- Instead of "Find your dress" → "Find a showstopper that makes the room go quiet"
- Instead of "Find shoes" → "Find heels that say 'I belong at the front row'"
- Instead of "Wear my black dress" → "Pull the black slip dress that never misses"

EVENT:
Name: ${event.name}
Theme: ${event.theme || 'not set'}
Mood: ${event.mood || 'aspirational'}
Dress Code: ${event.dress_code || 'chic'}
Style Keywords: ${(event.dress_code_keywords || []).join(', ')}
Location: ${event.venue_name || event.location_hint || 'exclusive venue'}
Prestige: ${prestige}/10
${stakes ? `Stakes: ${stakes}` : ''}

THE LINES (word exactly these, in this order, one each — do not add, drop or merge any):
${plan.map(planLineFacts).join('\n')}

Rules:
- A piece that is already hers is a "pull it from my closet" line, never "find" or "buy".
- A piece to buy names the piece (its name, or what it is) so the line reads as that piece.
- A line with nothing chosen is something she still has to find.
- Never write a price or a coin amount: the list shows each price itself.
${short > 0 ? `- She is ${short} coins short of what this look costs. For each piece to buy, the description suggests renting, borrowing, or a cheaper swap, in her voice.\n` : ''}- "label": 7-15 words, vivid and specific. "description": one whispered sentence about why it matters tonight.

Return the lines with the write_shopping_list tool, each with its slot.`;

  let lastErr = null;
  for (let attempt = 0; attempt < SHOPPING_ATTEMPTS; attempt += 1) {
    try {
      const response = await getAnthropic().messages.create({
        model: SHOPPING_MODELS[0],
        max_tokens: 1000,
        tools: [SHOPPING_TOOL],
        tool_choice: { type: 'tool', name: SHOPPING_TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      });
      const reply = readJsonReply(response, SHOPPING_TOOL.name);
      const written = Array.isArray(reply) ? reply : reply?.lines;
      if (!Array.isArray(written) || written.length === 0) throw new Error('reply has no lines');
      // Matched by position, then by slot; a line it left out keeps its fallback words.
      return plan.map((line, i) => {
        const byPos = written[i] && String(written[i].slot || line.slot).toLowerCase() === line.slot ? written[i] : null;
        const w = byPos || written.find((x) => String(x?.slot || '').toLowerCase() === line.slot) || null;
        const label = typeof w?.label === 'string' ? w.label.trim().slice(0, 200) : '';
        return shoppingTask(line, label ? { label, description: String(w.description || '').trim().slice(0, 300) } : fallbackLine(line, event), i);
      });
    } catch (err) {
      if (isBudgetRefusal(err)) throw err;
      lastErr = err;
      console.error(`[TodoList] Shopping list attempt ${attempt + 1} of ${SHOPPING_ATTEMPTS} failed:`, err.message);
    }
  }
  console.error(`[TodoList] Shopping list written from the look and the event without AI: ${lastErr?.message}`);
  return defaultShoppingTasks(event, look);
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
      // The fonts are committed (src/assets/fonts/invitation); a missing one is a deploy fault.
      else console.error(`[TodoList] FONT FILE MISSING: ${p}; a fallback font is used. Redeploy src/assets/fonts/invitation.`);
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

function fitTextToWidth(ctx, text, maxWidth) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (ctx.measureText(raw).width <= maxWidth) return raw;

  let fitted = raw;
  while (ctx.measureText(`${fitted}...`).width > maxWidth && fitted.length > 1) {
    fitted = fitted.slice(0, -1).trimEnd();
  }
  return `${fitted}...`;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────

/**
 * Render a to-do list as a transparent PNG overlay for video compositing.
 *
 * @param {Array} tasks - Array of task objects
 * @param {object} event - The world event
 * @param {object} options - { width, listType: 'wardrobe' | 'career' }
 */
const CAREER_LIST_ROLE = 'UI.OVERLAY.CAREER_LIST';

// T2 (§8(bb); Task #2294): the source label on a rendered one-list item.
// 'deliverable' is a T1-era deliverable task stamped before owed_to existed.
const SOURCE_BADGE = {
  host_requirement: 'host requirement',
  brand_deliverable: 'brand deliverable',
  deliverable: 'host requirement',
  goal: 'goal',
  optional: 'optional idea',
};

function renderTodoAsset(tasks, event, options = {}) {
  loadFonts();

  const listType = options.listType || 'wardrobe';
  const W = options.width || 520;
  const PADDING = 28;
  const HEADER_H = 118;
  const TASK_H = 68;
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
    const rowHeight = TASK_H - 6;
    const rowY = taskY + 2;
    const rowX = PADDING - 6;
    const rowW = W - (PADDING * 2) + 12;
    const checkX = PADDING;
    const checkY = taskY + (TASK_H / 2) - (checkSize / 2);
    // T2: a one-list item (it has a task_source) always shows its source; a
    // wardrobe slot shows "optional" when it is not required.
    const badgeText = task.task_source ? (SOURCE_BADGE[task.task_source] || 'optional idea')
      : task.required ? null : 'optional';
    const badgeReservedWidth = badgeText ? Math.round(W * 0.2) : 0;

    // Refined row surface to match invitation/social quality
    drawRoundedRect(ctx, rowX, rowY, rowW, rowHeight, 10);
    ctx.fillStyle = task.completed ? 'rgba(232,245,233,0.55)' : 'rgba(255,255,255,0.72)';
    ctx.fill();
    ctx.strokeStyle = task.completed ? 'rgba(26,122,64,0.20)' : 'rgba(184,150,46,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Checkbox — plain rect
    drawRoundedRect(ctx, checkX, checkY, checkSize, checkSize, 3);
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
    const labelW = W - labelX - PADDING - badgeReservedWidth;
    const labelFontSize = Math.round(W * 0.029);
    const descriptionFontSize = Math.round(W * 0.022);

    ctx.textAlign = 'left';
    ctx.font = `bold ${labelFontSize}px LibreBaskerville, serif`;
    ctx.fillStyle = task.completed ? '#AAA' : '#1A1A1A';
    ctx.fillText(fitTextToWidth(ctx, task.label, labelW), labelX, taskY + 24);

    // Task description
    if (task.description) {
      ctx.font = `italic ${descriptionFontSize}px LibreBaskerville, serif`;
      ctx.fillStyle = task.completed ? '#CCC' : '#666';
      ctx.fillText(fitTextToWidth(ctx, task.description, labelW), labelX, taskY + 45);
    }

    // Source badge (T1/T2): where a one-list item comes from; "optional" on
    // an unrequired wardrobe slot
    if (badgeText) {
      const badgeFont = `${Math.round(W * 0.020)}px LibreBaskerville, serif`;
      ctx.font = badgeFont;
      const badgeW = Math.ceil(ctx.measureText(badgeText).width) + 10;
      const badgeH = 12;
      const badgeX = W - PADDING - badgeW;
      const badgeY = taskY + 16;
      drawRoundedRect(ctx, badgeX, badgeY - 9, badgeW, badgeH, 6);
      ctx.fillStyle = accentColor + '1F';
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = accentColor + 'A0';
      ctx.fillText(badgeText, W - PADDING - 4, taskY + 25);
      ctx.textAlign = 'left';
    }

    // Row divider
    if (task.order < tasks.length) {
      ctx.beginPath();
      ctx.moveTo(PADDING + checkSize + 12, taskY + TASK_H);
      ctx.lineTo(W - PADDING, taskY + TASK_H);
      ctx.strokeStyle = 'rgba(184,150,46,0.12)';
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

  // Load the episode's event: its brief's, else the first stamped
  // (utils/episodeEventSql; Task #1917)
  const [event] = await sequelize.query(
    `SELECT we.* FROM world_events we WHERE we.id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error('No event linked to this episode. Inject an event first.');

  console.log(`[TodoList] Generating for: ${event.name}`);

  // Event documents PR 3: the event's approved shopping list is the list;
  // only an event without one gets a written list.
  const { approvedDocument, shoppingListTasks } = require('./eventDocumentsService');
  const approvedList = approvedDocument(event, 'shopping_list');
  const tasks = approvedList ? shoppingListTasks(approvedList) : await generateTasks(event);
  console.log(`[TodoList] ${approvedList ? `Approved shopping list (version ${approvedList.version})` : 'Generated'}: ${tasks.length} tasks`);

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
      const creator = eventCreatorOrganizer(event);
      if (creator) {
        const [rows] = await sequelize.query(
          'SELECT platform, content_category, archetype FROM social_profiles WHERE id = :id LIMIT 1',
          { replacements: { id: creator.profileId } }
        );
        hostProfile = rows?.[0] || null;
      }
      // T1 (§8(bb); Task #2292): required only from the event's deliverables.
      let deliverables = [];
      try {
        deliverables = await listEventDeliverables(sequelize, event.id);
      } catch (delivErr) {
        console.error('[TodoList] Deliverables read failed (no social task is required):', delivErr.message);
      }
      // T9 (§8(cc); Task #2395): the event row sets the goal count and text.
      const socialTasks = buildSocialTasks(eventType, hostProfile, [], { event, deliverables });
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

/**
 * As of a beat (Task #3188; Evoni, 2026-10-14, phone phase 3 rulings 1 and
 * 2): the locked look's pieces Lala has put on by that beat and line of the
 * script (utils/scriptWear.wornByBeat: [WEAR] cues, legacy selects by
 * name, an uncued piece from the last getting-ready beat), and the uncued
 * pieces to flag.
 */
async function wornAsOf(sequelize, episodeId, { beat, line }) {
  const [episode] = await sequelize.query(
    'SELECT script_content, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  const look = await sequelize.query(
    `SELECT w.id, w.name, w.clothing_category
     FROM episode_wardrobe ew
     JOIN wardrobe w ON w.id = ew.wardrobe_id
     WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL AND ew.approval_status = 'approved'
       AND w.deleted_at IS NULL AND w.parent_item_id IS NULL
     ORDER BY ew.created_at ASC`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  const { wornByBeat } = require('../utils/scriptWear');
  return {
    ...wornByBeat(episode?.script_content || '', look, beat, Number.isInteger(line) ? line : Infinity),
    showId: episode?.show_id || null,
  };
}

/**
 * Spent so far (Task #3189; Lala's Phone spec §5): what the pieces worn by
 * the beat cost, each by the charge Finalize books for it (episodeLook, the
 * one charge rule: owned, already bought, gifted or borrowed pieces cost
 * nothing; a rental its fee; any other its price). The look's total stays
 * the Money page's; this is the running part up to the beat.
 */
async function spentSoFar(sequelize, episodeId, showId, worn) {
  if (!worn.length) return 0;
  const { episodeLook, chargeMap } = require('./episodeLookCharges');
  const charges = chargeMap(await episodeLook(sequelize, { episodeId, event: null, showId }));
  return worn.reduce((sum, p) => sum + (charges.get(String(p.id)) || 0), 0);
}

async function getTodoList(episodeId, models, { beat = null, line = null } = {}) {
  const { sequelize } = models;

  const [todoList] = await sequelize.query(
    'SELECT * FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!todoList) return null;

  // Which slots Lala's outfit fills (T7, §8(bb); Task #2307): a wardrobe
  // task's completion comes only from here, never from a manual toggle. A
  // piece counts when it is linked to the episode and not rejected. As of a
  // beat, only the pieces she has put on by then count (Task #3188).
  let categories;
  let asOf = null;
  let spent = null;
  if (Number.isInteger(beat)) {
    const { worn, uncued, beatFound, showId } = await wornAsOf(sequelize, episodeId, { beat, line });
    categories = worn.map(p => p.clothing_category);
    asOf = {
      beat,
      line: Number.isInteger(line) ? line : null,
      beat_found: beatFound,
      worn: worn.map(p => ({ id: p.id, name: p.name })),
      // Flagged "in the look, never equipped on screen" (ruling 2).
      uncued: uncued.map(p => ({ id: p.id, name: p.name })),
    };
    spent = await spentSoFar(sequelize, episodeId, showId, worn);
  } else {
    const wardrobeItems = await sequelize.query(
      `SELECT w.clothing_category
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id
       WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL
         AND COALESCE(ew.approval_status, 'pending') <> 'rejected'`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    categories = wardrobeItems.map(w => w.clothing_category);
  }

  const filledSlots = listSlotsFilled(categories);

  const saved = typeof todoList.tasks === 'string' ? JSON.parse(todoList.tasks) : todoList.tasks;
  // A list with no Purse line predates it; its Accessories line held bags.
  const legacyAccessories = !(saved || []).some(t => t?.slot === 'purse');
  const tasks = (saved || []).map(t => ({
    ...t,
    completed: taskFilled(t.slot, filledSlots, { legacyAccessories }),
  }));

  return {
    ...todoList,
    tasks,
    ...(asOf ? { as_of: asOf, spent_so_far: spent } : {}),
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

// T9 (docs/EVENT_EPISODE_FLOW.md §8(cc); Task #2395): "Lala's goal tasks
// scale with the event: 2–3 for small or low-key events, 4–6 for major ones;
// no fixed template lists." The count comes from goalTaskScale (prestige);
// the prompt asks for it and enforceGoalTaskBounds holds it server-side.
// Haiku 4.5, the side-call model this generator already used; two attempts
// (an API error or an unreadable reply); every call is logged and budget-
// gated by the aiCostTracker patch on the SDK.
const CAREER_MODELS = ['claude-haiku-4-5-20251001'];
const CAREER_ATTEMPTS = 2;

const CAREER_TOOL = Object.freeze({
  name: 'write_career_tasks',
  description: 'Return Lala\'s career tasks for this event.',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slot: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            goal: { type: 'boolean', description: 'true for what she means to do, false for an optional idea' },
            goal_id: { type: 'string', description: 'the id of the career goal it serves, if any' },
          },
          required: ['slot', 'label'],
        },
      },
    },
    required: ['tasks'],
  },
});

/**
 * Generate a career task list for an event — the tasks Lala must complete
 * during the event itself (deliverables, social posts, networking goals).
 *
 * This is To-Do List #2 (UI.OVERLAY.CAREER_LIST) — separate from the
 * wardrobe shopping list (UI.OVERLAY.WARDROBE_LIST).
 *
 * 2026-10-24: the money line is the deal's own statement
 * (describeInvitationMoney, the invitation's; `money` when the caller loaded
 * the terms rows), not the legacy is_paid/payment_amount pair that read
 * "Unpaid event" for every deal; the host is read as the invitation reads
 * it; `goals` (her active CareerGoal rows, { id, title }) let each task name
 * the career goal it serves (goal_id, kept only when it is one of them);
 * the reply is a forced tool call; a budget refusal is thrown.
 */
async function generateCareerTasks(event, { room = null, need = null, excludeSlots = [], money = null, goals = [] } = {}) {
  const scale = goalTaskScale(event);
  const { invitationFacts, describeInvitationMoney } = require('./invitationCompositingService');
  const facts = invitationFacts(event);
  const moneyText = money || describeInvitationMoney(event).text;
  const goalList = (Array.isArray(goals) ? goals : []).filter((g) => g && g.id && g.title).slice(0, 8);
  const goalIds = new Set(goalList.map((g) => String(g.id)));
  // T9 follow-up (Evoni, 2026-09-30): the limit is for Lala's combined goal
  // list, so the Career Checklist writes only the room the Start Episode
  // goals leave (room) and at least what the minimum still needs (need).
  const max = room == null ? scale.max : Math.min(scale.max, room);
  const min = need == null ? scale.min : Math.min(max, need);
  const bounds = { ...scale, min, max };
  if (max <= 0) return [];
  const low = Math.max(1, min);
  const count = low >= max ? `${max}` : `${low} to ${max}`;
  const sizeLine = bounds.scale === 'major'
    ? 'a major event'
    : bounds.scale === 'small' ? 'a small or low-key event' : 'a mid-sized event';

  const prompt = `You are writing Lala's CAREER to-do list for an event in a luxury life simulator show.

This is NOT the wardrobe checklist — this is about what she needs to ACCOMPLISH during the event:
content to create, people to network with, social media moments, career positioning.

EVENT:
Name: ${event.name}
Type: ${event.event_type || 'invite'}
${event.format ? `Format: ${String(event.format).replace(/_/g, ' ')}\n` : ''}Host: ${facts.hostName}
Brand: ${event.host_brand || 'none'}
${event.venue_name ? `Venue: ${event.venue_name}\n` : ''}Prestige: ${bounds.prestige}/10 (${sizeLine})
Dress Code: ${event.dress_code || 'chic'}
${event.description ? `Description: ${String(event.description).slice(0, 300)}\n` : ''}${event.narrative_stakes ? `Stakes: ${event.narrative_stakes.slice(0, 200)}` : ''}
Money (the deal, in the host's words): ${moneyText}
${goalList.length ? `
HER CAREER GOALS (link a task to the one it moves forward, by id; leave goal_id empty when none fits):
${goalList.map((g) => `- ${g.id}: ${g.title}`).join('\n')}
` : ''}

Write ${count} career tasks — no more, no fewer. This is ${sizeLine}, so the list is that size.
Each must be specific to THIS event: name its host, brand, venue, format or
dress code where it can. No generic items that would fit any event.
Mix of:
- Content creation (what to film, post, or capture)
- Networking (who to connect with, impressions to make)
- Social media (what to post and when)
- Career positioning (what this event should do for her career)

These are Lala's own goals and ideas. Do not invent brand or host obligations:
the event's accepted deliverables are added to the list separately. Mark
"goal": true for what she means to do, false for an optional idea.

Never write a coin amount the money line above does not hold.

Return the tasks with the write_career_tasks tool: each with a short
snake_case slot (e.g. "content_main"), a label (e.g. "Film a 30-second venue
walkthrough for Stories"), a one-sentence description, goal true or false${goalList.length ? ', and goal_id when it serves one of her career goals' : ''}.`;

  let lastErr = null;
  for (let attempt = 0; attempt < CAREER_ATTEMPTS; attempt += 1) {
    try {
      const response = await getAnthropic().messages.create({
        model: CAREER_MODELS[0],
        max_tokens: 900,
        tools: [CAREER_TOOL],
        tool_choice: { type: 'tool', name: CAREER_TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      });

      const reply = readJsonReply(response, CAREER_TOOL.name);
      const parsed = Array.isArray(reply) ? reply : reply?.tasks;
      if (!Array.isArray(parsed)) throw new Error('reply is not a list of tasks');
      const tasks = parsed.map((t, i) => ({
        slot:        t?.slot        || `career_${i + 1}`,
        label:       t?.label       || '',
        description: t?.description || '',
        // T1 (§8(bb); Task #2292): a generated career task is never required.
        required:    false,
        task_source: (t?.goal ?? t?.required ?? (i < 2)) ? 'goal' : 'optional',
        completed:   false,
        order:       i + 1,
        ...(t?.goal_id && goalIds.has(String(t.goal_id)) ? { goal_id: String(t.goal_id) } : {}),
      })).filter((t) => String(t.label).trim());
      // T9: trimmed to the event's maximum; a short reply is kept, not padded.
      return enforceGoalTaskBounds(tasks, bounds, 'CareerList')
        .map((t, i) => ({ ...t, order: i + 1 }));
    } catch (err) {
      if (isBudgetRefusal(err)) throw err;
      lastErr = err;
      console.error(`[CareerList] Generation attempt ${attempt + 1} of ${CAREER_ATTEMPTS} failed:`, err.message);
    }
  }

  // T9: no fixed fallback list. The minimum for the event's scale is written
  // from its own fields (dress code, venue, host, brand, guests, format,
  // description, stakes, name); see src/utils/goalTasks.js.
  console.error('[CareerList] Generation failed; writing the event\'s minimum goals from its fields:', lastErr?.message);
  return composeGoalTasks(goalFields(event), bounds, { upTo: bounds.min, where: 'CareerList', excludeSlots })
    .map((t, i) => ({ ...t, order: i + 1 }));
}

const LINE_TOOL = Object.freeze({
  name: 'write_line',
  description: 'Return one new line for the list.',
  input_schema: {
    type: 'object',
    properties: {
      label: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['label'],
  },
});

/**
 * One new wording for one shopping-list line (2026-10-24: re-roll one line
 * instead of the whole list): the same slot and piece; the rest of the list
 * is shown so the new line repeats none of it. Two attempts; a budget
 * refusal is thrown; with no answer it throws, and the list is left as it is.
 *
 * @returns {{ label, description }}
 */
async function redraftDocumentLine(event, { items, index, look = null }) {
  const line = items[index];
  if (!line) throw Object.assign(new Error('No such line'), { status: 404 });
  const others = items.filter((_, i) => i !== index).map((i) => `- ${i.label}`).join('\n') || '- (none)';
  const plan = shoppingPlan(look);
  const planned = plan.find((l) => line.piece_id && String(l.piece?.id) === String(line.piece_id)) || plan.find((l) => l.slot === listSlotOf(line.slot)) || { slot: line.slot, piece: null };
  const prompt = `EVENT: ${event.name} · ${event.dress_code || 'chic'} · prestige ${event.prestige || 5}/10${event.host_brand ? ` · ${event.host_brand}` : ''}

Rewrite ONE line of Lala's wardrobe shopping list, the "${line.slot}" line.
It is: ${planLineFacts(planned, 0).replace(/^1\. /, '')}.
Now it reads: "${line.label}". Write a different, vivid, specific line (7-15 words) and one whispered sentence about why it matters tonight.
A piece already hers is a "pull it from my closet" line. Never write a price.

The rest of the list (repeat none of it):
${others}

Return it with the write_line tool.`;

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await getAnthropic().messages.create({
        model: SHOPPING_MODELS[0],
        max_tokens: 300,
        tools: [LINE_TOOL],
        tool_choice: { type: 'tool', name: LINE_TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      });
      const r = readJsonReply(response, LINE_TOOL.name);
      const label = typeof r?.label === 'string' ? r.label.trim().slice(0, 200) : '';
      if (!label) throw new Error('reply has no label');
      return { label, description: String(r.description || '').trim().slice(0, 300) };
    } catch (err) {
      if (isBudgetRefusal(err)) throw err;
      lastErr = err;
      console.error(`[TodoList] Line redraft attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw Object.assign(new Error(`No new line this time (${lastErr?.message || 'no answer'}). Try again.`), { status: 502 });
}

/**
 * Generate career list + render as overlay asset for video editing.
 */
async function generateCareerList(episodeId, showId, models) {
  const { sequelize } = models;

  const [event] = await sequelize.query(
    // The episode's event (utils/episodeEventSql; Task #1917)
    `SELECT * FROM world_events WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );

  if (!event) throw new Error('No event linked to this episode.');

  console.log(`[CareerList] Generating for: ${event.name}`);

  // T2 (§8(bb); Task #2294): one task list. The Career Checklist is a view
  // of the episode's list (episode_todo_lists.social_tasks): its generated
  // goals and ideas are saved into that list, replacing the previous
  // career items, and the rendered checklist shows the whole list. T1: a
  // generated item is never required; only a deliverable is.
  const [todoRow] = await sequelize.query(
    'SELECT id, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  let stored = todoRow?.social_tasks;
  if (typeof stored === 'string') stored = JSON.parse(stored || '[]');
  if (!Array.isArray(stored)) stored = [];

  // A list saved before T1 may lack the event's deliverables; each row not
  // yet on the list is added. Stored items are otherwise left as they are.
  let deliverables = [];
  try {
    deliverables = await listEventDeliverables(sequelize, event.id);
  } catch (delivErr) {
    console.error('[CareerList] Deliverables read failed (none added to the list):', delivErr.message);
  }
  const onList = new Set(stored.map((t) => t?.deliverable_id).filter(Boolean));
  const missing = withDeliverableTasks([], deliverables).filter((t) => !onList.has(t.deliverable_id));

  // T9 follow-up: Lala's combined goal list (the Start Episode goals kept on
  // the list plus the career items) stays within the event's limit;
  // deliverables don't count. The previous career items are being replaced,
  // so only the rest of the list uses up room.
  const bounds = goalTaskScale(event);
  const baseList = [...stored, ...missing].filter((t) => t?.generated_by !== 'career');
  const { room, need } = remainingGoalRoom(baseList, bounds);
  // A career item that repeats a goal already on the list (the fallback
  // writes from the same event fields as Start Episode) is dropped.
  const onListLabels = new Set(baseList.map((t) => String(t?.label || '').trim().toLowerCase()));
  const careerTasks = (room > 0 ? await generateCareerTasks(event, { room, need, excludeSlots: baseList.map((t) => t?.slot).filter(Boolean), money: require('./invitationCompositingService').describeInvitationMoney(event, { deliverables }).text }) : [])
    .filter((t) => !onListLabels.has(String(t.label || '').trim().toLowerCase()));
  if (room === 0) console.log(`[CareerList] ${event.name}: the list already holds ${bounds.max} of Lala's goals; no career items added (T9)`);
  const tasks = capCombinedGoals(withCareerTasks([...stored, ...missing], careerTasks), bounds, 'CareerList');
  if (todoRow) {
    await sequelize.query(
      'UPDATE episode_todo_lists SET social_tasks = :tasks, updated_at = NOW() WHERE id = :id',
      { replacements: { tasks: JSON.stringify(tasks), id: todoRow.id } }
    );
  } else {
    await sequelize.query(
      `INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
       VALUES (:id, :episodeId, :showId, :eventId, '[]', :tasks, 'generated', NOW(), NOW())
       ON CONFLICT (episode_id) DO UPDATE SET social_tasks = EXCLUDED.social_tasks, updated_at = NOW()`,
      { replacements: { id: uuidv4(), episodeId, showId: showId || null, eventId: event.id, tasks: JSON.stringify(tasks) } }
    );
  }

  const buffer = renderTodoAsset(tasks.map((t, i) => ({ ...t, order: i + 1 })), event, { listType: 'career' });
  const assetUrl = await uploadTodoAsset(buffer, episodeId);

  // T4 (§8(bb); Task #2300): Regenerate replaces the episode's Career List
  // image instead of adding another asset row. The newest live row is
  // updated in place; one is created only when the episode has none. Rows
  // left by earlier regenerates are not touched.
  const { Asset } = models;
  const metadata = {
    source: 'career-list-generator',
    list_type: 'career',
    event_id: event.id,
    event_name: event.name,
    task_count: tasks.length,
    generated_at: new Date().toISOString(),
  };
  // Raw SQL, named columns only: the Asset model declares s3_key_processed,
  // which no migration adds to assets, so a model read can fail on it.
  const [existing] = await sequelize.query(
    `SELECT id, metadata FROM assets
     WHERE episode_id = :episodeId AND asset_role = :role AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    { replacements: { episodeId, role: CAREER_LIST_ROLE }, type: sequelize.QueryTypes.SELECT }
  );
  let asset;
  if (existing) {
    const prior = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata || '{}') : (existing.metadata || {});
    await sequelize.query(
      `UPDATE assets SET name = :name, s3_url_raw = :url, s3_url_processed = :url,
              metadata = CAST(:metadata AS jsonb), updated_at = NOW()
       WHERE id = :id`,
      { replacements: { id: existing.id, name: `${event.name} — Career List`, url: assetUrl, metadata: JSON.stringify({ ...prior, ...metadata }) } }
    );
    asset = { id: existing.id };
  } else {
    asset = await Asset.create({
      id: uuidv4(),
      name: `${event.name} — Career List`,
      asset_type: 'TODO_LIST',
      asset_role: CAREER_LIST_ROLE,
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
      metadata,
    });
  }

  return { tasks, assetUrl, assetId: asset.id, eventName: event.name, listType: 'career' };
}

module.exports = {
  generateEpisodeTodoList,
  generateCareerList,
  getTodoList,
  generateTasks,
  generateCareerTasks,
  redraftDocumentLine,
  defaultShoppingTasks,
  shoppingPlan,
  readJsonReply,
  renderTodoAsset,
  listSlotOf,
  listSlotsFilled,
  taskFilled,
};
