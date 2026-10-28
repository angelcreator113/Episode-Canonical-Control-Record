/**
 * The Script tab's studio layout (Evoni's mockup, 2026-10-19): what each
 * beat's row, header and three cards show, read only from what the tab
 * already holds (the script's beats, the scene plan, "Ready to film?" rows,
 * the locked look). Nothing here reads or writes the server, and nothing is
 * shown that the app does not have: no runtime target, no story goal.
 */
import { speakerLine } from './scriptSpeaker';
import { lineSeconds } from './scriptRuntime';
import { wearCues } from './scriptMoments';

export const STATUS_LABELS = { approved: 'APPROVED', revision: 'NEEDS REVISION', draft: 'DRAFT' };

/**
 * A beat's status: approved (locked), needs revision (a "Ready to film?"
 * row of this beat is not OK), else draft.
 */
export function beatStatus(beat, healthRows = []) {
  if (!beat) return 'draft';
  if (beat.approved) return 'approved';
  // A tip (`advice`, lib/scriptPacing) is no revision.
  const gaps = (healthRows || []).some((r) => r && !r.ok && !r.advice && r.beatId && r.beatId === beat.id);
  return gaps ? 'revision' : 'draft';
}

/**
 * The beat's pictures, each once, the scene's own picture first: then the
 * location's picture, its angle's still, the event look and the set's base
 * still, where the plan has them. [{ url, label }].
 */
export function beatPictures(scene) {
  if (!scene) return [];
  const seen = new Set();
  const out = [];
  const add = (url, label) => {
    if (typeof url !== 'string' || !url.trim() || seen.has(url)) return;
    seen.add(url);
    out.push({ url, label: label || null });
  };
  add(scene.image, scene.image_label || scene.scene_set_name);
  add(scene.location?.image?.url, scene.location?.image?.label);
  add(scene.location?.angle?.still_image_url, scene.location?.angle?.label || 'Angle');
  add(scene.location?.look?.image_url, 'Event look');
  add(scene.sceneSet?.base_still_url, scene.sceneSet?.name ? `${scene.sceneSet.name} · base` : 'Base still');
  return out;
}

/** "2.4s", "12s", or null for a line that takes no screen time. `pace`: lib/scriptRuntime lineWpm. */
export function lineDuration(line, pace = null) {
  const s = lineSeconds(line, pace);
  if (!(s > 0)) return null;
  return s < 10 ? `${Math.round(s * 10) / 10}s` : `${Math.round(s)}s`;
}

const BEAT_HEADER = /^\s*##\s*BEAT:/i;

/**
 * The beat's checklist: what can be told honestly from the tab's data,
 * then this beat's "Ready to film?" rows, then whether it is approved.
 * { items: [{ key, label, ok }], done, total }.
 * `healthRows`: the script's rows (only this beat's are taken);
 * `pictures`: beatPictures of its scene; `shown`: (line) => the text a row
 * shows, so the checklist reads as the panel does.
 */
export function beatChecklist(beat, { healthRows = [], scene = null, pictures = [], shown = (t) => t } = {}) {
  if (!beat) return { items: [], done: 0, total: 0 };
  const lines = (beat.lines || []).filter((l) => typeof l === 'string' && l.trim());
  const items = [
    { key: 'header', label: 'Has its own beat header', ok: BEAT_HEADER.test(String(beat.raw || '')) },
    { key: 'lines', label: 'Has script lines', ok: lines.some((l) => !/^\[(STAT|MAIL):/i.test(l.trim())) },
    { key: 'dialogue', label: 'Has dialogue or voiceover', ok: lines.some((l) => !!speakerLine(l)?.words) },
    { key: 'visual', label: 'Has a scene picture', ok: pictures.length > 0 },
    { key: 'location', label: 'Has a location', ok: !!scene?.scene_set_name },
  ];
  for (const r of healthRows || []) {
    if (r && !r.advice && r.beatId && r.beatId === beat.id) items.push({ key: `health-${r.key}`, label: shown(r.text), ok: !!r.ok });
  }
  items.push({ key: 'approved', label: 'Approved and locked', ok: !!beat.approved });
  return { items, done: items.filter((i) => i.ok).length, total: items.length };
}

/** The look's pieces a beat puts on (its [WEAR] cues that name one piece), each once. */
export function piecesWornIn(beats = [], beatIndex = -1, look = []) {
  if (!Array.isArray(look) || !look.length || beatIndex < 0) return [];
  const seen = new Map();
  for (const c of wearCues(beats, look)) {
    if (c.beatIndex === beatIndex && c.piece && !seen.has(String(c.piece.id))) seen.set(String(c.piece.id), c.piece);
  }
  return [...seen.values()];
}

const ASSET_KINDS = {
  device: 'Phone', phone: 'Phone screen', icon: 'Phone icon', overlay: 'Overlay',
  notify: 'Notification', dm: 'DM', post: 'Post', unknown: 'Not made yet',
};

/**
 * What a beat already uses: its location, what it puts on screen (beatOnScreen's
 * `used`) and the pieces of the look it puts on. [{ key, name, kind, label }].
 */
export function beatAssets({ scene = null, used = [], worn = [] } = {}) {
  const out = [];
  if (scene?.scene_set_name) out.push({ key: 'location', name: scene.scene_set_name, kind: 'location', label: 'Location' });
  for (const u of used || []) {
    if (!u?.name) continue;
    out.push({ key: `used-${u.kind}-${u.name}`, name: u.name, kind: u.kind || 'unknown', label: ASSET_KINDS[u.kind] || 'On screen' });
  }
  for (const p of worn || []) {
    if (!p?.name) continue;
    out.push({ key: `worn-${p.id}`, name: p.name, kind: 'wardrobe', label: 'Wardrobe' });
  }
  return out;
}
