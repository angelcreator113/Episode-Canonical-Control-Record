'use strict';

/**
 * The task-list overlay's text layer (Task #2395, ruling P14).
 *
 * Image models set text poorly, so — as the invitation does
 * (invitationCompositingService: a text-free generated background, the
 * words drawn with Canvas and composited with Sharp) — the task-list
 * overlay is a generated background in the event's visual direction with
 * the tasks' own text drawn on it. The fonts are the invitation's
 * (checkFonts / fontFamilies), and the accent colour follows the event's
 * visual direction theme.
 *
 * canvas and sharp are optional native dependencies; without them
 * compositingAvailable() is false and the service refuses before spending
 * on an image.
 */

let createCanvas;
let sharp;
try {
  ({ createCanvas } = require('canvas'));
  sharp = require('sharp');
} catch (err) {
  console.warn('[TaskListOverlay] canvas/sharp not available — compositing disabled:', err.message);
}
const invitationCompositing = require('./invitationCompositingService');

const INK = '#2C1810';
const INK_SOFT = '#4A3728';

// Accent per visual-direction theme (eventVisualDirection.THEME_PRESETS):
// the colour of the header rule, the checkboxes and the source tags, picked
// to sit with that theme's border and florals. 'default' is the house gold.
const THEME_ACCENTS = Object.freeze({
  'honey luxe': '#A8741A',
  'avant-garde': '#1A1A1A',
  'soft glam': '#B76E79',
  'romantic garden': '#5E7352',
  'luxury intimate': '#8B6914',
  'formal glamour': '#B8962E',
  'chic minimal': '#1A1A1A',
  'power fashion': '#1A1A1A',
  default: '#B8962E',
});

const MAX_LABEL_CHARS = 140;

function compositingAvailable() {
  return Boolean(createCanvas && sharp);
}

function accentFor(direction) {
  return THEME_ACCENTS[direction?.theme] || THEME_ACCENTS.default;
}

/** One line of source text under a task, or null (pure). */
function sourceNote(task) {
  if (task.source === 'host_requirement') return task.required ? 'Required · for the host' : 'For the host';
  if (task.source === 'brand_deliverable') return task.required ? 'Required · for the brand' : 'For the brand';
  if (task.source === 'optional') return 'Optional';
  return null;
}

/**
 * What the layer shows (pure): the header, the deadline line and each task's
 * label and source note, in list order.
 * @param {object[]} items — taskListContent() output ({ label, description, source, required })
 * @param {object} ctx — { eventName, eventDate, direction }
 */
function buildTaskListLayerContent(items, { eventName = null, eventDate = null, direction = null } = {}) {
  const tasks = (Array.isArray(items) ? items : [])
    .filter((t) => t && String(t.label || '').trim())
    .map((t) => {
      const label = String(t.label).trim();
      return {
        label: label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label,
        note: sourceNote(t),
        required: Boolean(t.required),
      };
    });
  return {
    heading: "Lala's To-Do",
    subheading: eventName ? String(eventName) : null,
    deadline: eventDate ? `Before ${formatDate(eventDate)}` : null,
    tasks,
    theme: direction?.theme || 'default',
    accent: accentFor(direction),
  };
}

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Lay the list out at a base size. With draw false it only measures.
 * Returns the height used and how many tasks were drawn.
 */
function layout(ctx, content, box, base, fonts, { draw, maxTasks }) {
  const { wrapText } = invitationCompositing;
  const cx = box.x + box.w / 2;
  const left = box.x + box.w * 0.08;
  const textW = box.w * 0.84;
  let y = box.y + base * 2.4;

  const line = (text, font, color, lh, align = 'center', x = cx) => {
    ctx.font = font;
    const lines = wrapText(ctx, text, align === 'center' ? textW : textW - base * 1.6);
    for (const l of lines) {
      if (draw) {
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.fillText(l, x, y);
      }
      y += lh;
    }
    return lines.length;
  };

  line(content.heading.toUpperCase(), `bold ${Math.round(base * 1.5)}px ${fonts.header}`, INK, base * 1.7);
  if (content.subheading) line(content.subheading, `italic ${Math.round(base * 1.05)}px ${fonts.header}`, INK_SOFT, base * 1.35);
  if (content.deadline) line(content.deadline, `${Math.round(base * 0.85)}px ${fonts.body}`, content.accent, base * 1.3);

  // Rule
  y += base * 0.2;
  if (draw) {
    ctx.strokeStyle = content.accent;
    ctx.lineWidth = Math.max(1, base * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - box.w * 0.2, y);
    ctx.lineTo(cx + box.w * 0.2, y);
    ctx.stroke();
  }
  y += base * 1.4;

  const shown = content.tasks.slice(0, maxTasks);
  const boxSize = base * 0.8;
  for (const task of shown) {
    const top = y;
    if (draw) {
      ctx.strokeStyle = content.accent;
      ctx.lineWidth = Math.max(1, base * 0.08);
      ctx.strokeRect(left, top - boxSize * 0.85, boxSize, boxSize);
    }
    const x = left + base * 1.6;
    line(task.label, `${task.required ? 'bold ' : ''}${Math.round(base)}px ${fonts.body}`, INK, base * 1.35, 'left', x);
    if (task.note) line(task.note, `italic ${Math.round(base * 0.75)}px ${fonts.body}`, content.accent, base * 1.05, 'left', x);
    y += base * 0.55;
  }
  const hidden = content.tasks.length - shown.length;
  if (hidden > 0) line(`+ ${hidden} more`, `italic ${Math.round(base * 0.85)}px ${fonts.body}`, INK_SOFT, base * 1.2);
  return { height: y - box.y, drawn: shown.length };
}

/** The text layer as a transparent PNG the size of the background. */
function renderTaskListLayer(content, width, height, fonts) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const box = { x: width * 0.08, y: height * 0.08, w: width * 0.84, h: height * 0.84 };
  roundedRect(ctx, box.x, box.y, box.w, box.h, Math.round(width * 0.03));
  ctx.fillStyle = 'rgba(255,253,245,0.92)';
  ctx.fill();
  ctx.strokeStyle = content.accent;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, box.x + 10, box.y + 10, box.w - 20, box.h - 20, Math.round(width * 0.025));
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Largest size (down to a legible floor) at which the list fits; past the
  // floor, tasks are dropped from the end with a "+ N more" line.
  const maxBase = width * 0.042;
  const minBase = width * 0.026;
  let base = maxBase;
  let maxTasks = content.tasks.length;
  const fits = () => layout(ctx, content, box, base, fonts, { draw: false, maxTasks }).height <= box.h - base;
  while (!fits() && base > minBase) base = Math.max(minBase, base * 0.92);
  while (!fits() && maxTasks > 1) maxTasks -= 1;
  layout(ctx, content, box, base, fonts, { draw: true, maxTasks });

  return { buffer: canvas.toBuffer('image/png'), base, drawn: Math.min(maxTasks, content.tasks.length) };
}

/**
 * Composite the task list onto the generated background.
 * @returns {Promise<{ buffer: Buffer, width, height, drawn }>}
 */
async function compositeTaskList(backgroundBuffer, content) {
  if (!compositingAvailable()) throw new Error('canvas/sharp are not installed; the task list cannot be composited');
  await invitationCompositing.checkFonts();
  const fonts = invitationCompositing.fontFamilies();
  const meta = await sharp(backgroundBuffer).metadata();
  const width = meta.width || 576;
  const height = meta.height || 1024;
  const layer = renderTaskListLayer(content, width, height, fonts);
  const buffer = await sharp(backgroundBuffer)
    .composite([{ input: layer.buffer, top: 0, left: 0, blend: 'over' }])
    .png()
    .toBuffer();
  return { buffer, width, height, drawn: layer.drawn };
}

module.exports = {
  THEME_ACCENTS,
  compositingAvailable,
  accentFor,
  sourceNote,
  buildTaskListLayerContent,
  renderTaskListLayer,
  compositeTaskList,
};
