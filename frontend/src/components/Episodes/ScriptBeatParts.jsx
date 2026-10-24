// frontend/src/components/Episodes/ScriptBeatParts.jsx
// The Script tab's studio pieces (Evoni's mockup, 2026-10-19): the Episode
// Beats list, a beat's status badge, and the three cards under a beat
// (Scene Context, Assets & Links, Beat Checklist). Layout only: each shows
// what the tab already has (lib/scriptBeatView), and acts only through the
// tab's own handlers.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Smartphone, EllipsisVertical, ListOrdered, Clapperboard, Link2, ListChecks, Check, MapPin, Image as ImageIcon, Shirt, Bell, MessageCircle, Send, Layers, CircleHelp, LogIn, Hand, Mail, Sparkles, Target, AlarmClock, Plane, Trophy, Palette, ChartColumn, Flame, FileText } from 'lucide-react';
import { STATUS_LABELS } from '../../lib/scriptBeatView';
import { dropIndex } from '../../lib/scriptBeatOrder';
import { SHOT_LABELS, fmtType } from '../BeatPlan/BeatPlanParts';

export function BeatStatusBadge({ status = 'draft', testId = undefined }) {
  return <span className={`esp-status is-${status}`} data-testid={testId}>{STATUS_LABELS[status] || STATUS_LABELS.draft}</span>;
}

// A beat with no scene picture shows its kind as a lucide icon, not the
// beat's emoji (Script page audit 4, 2026-10-19), by its canonical number.
const BEAT_ICONS = { 1: Clapperboard, 2: LogIn, 3: Hand, 4: Mail, 5: Sparkles, 6: Target, 7: MessageCircle, 8: Shirt, 9: AlarmClock, 10: Plane, 11: Trophy, 12: Palette, 13: ChartColumn, 14: Flame };
function BeatIcon({ number }) {
  const Icon = BEAT_ICONS[number] || FileText;
  return <Icon size={22} aria-hidden="true" />;
}

// Beats 1–14 can be approved (the server's lock takes no other number).
export const canApprove = (beat) => Number.isInteger(beat?.number) && beat.number >= 1 && beat.number <= 14;

// A beat row's ⋮: the beat's own actions (move, approve), as the open
// beat's buttons do them. Escape or a click elsewhere closes it.
function BeatRowMenu({ beat, index, count, onMoveBeat, onApprove, locking, saving = false }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const close = () => { if (ref.current) ref.current.open = false; };
  // Focus goes back to the ⋮ once an item acts, and again after a move has
  // put the row in its new place (Script page audit 4, 2026-10-19: it fell
  // to the page with the item that was pressed).
  const back = () => {
    const summary = ref.current?.querySelector('summary');
    summary?.focus();
    setTimeout(() => { if (summary?.isConnected && document.activeElement !== summary) summary.focus(); }, 0);
  };
  const act = (fn) => () => { close(); fn(); back(); };
  return (
    <details ref={ref} className="esp-rowmenu" onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); close(); ref.current?.querySelector('summary')?.focus(); } }}>
      <summary className="esp-rowmenu-btn" aria-label={`More for beat ${beat.number}`} title="Beat actions"><EllipsisVertical size={16} aria-hidden="true" /></summary>
      {/* Drawn only while open, so its buttons are not on the page twice. */}
      {open && <div className="esp-rowmenu-list" role="group" aria-label={`Beat ${beat.number}`}>
        {!beat.approved && <button type="button" className="esp-rowmenu-item" disabled={index === 0 || locking} onClick={act(() => onMoveBeat(index, index - 1))}>Move up</button>}
        {!beat.approved && <button type="button" className="esp-rowmenu-item" disabled={index >= count - 1 || locking} onClick={act(() => onMoveBeat(index, index + 1))}>Move down</button>}
        {/* aria-disabled while a lock or a Save is on its way, as the beat's
            own button (Script page audit 3, 2026-10-19; audit 6, 2026-10-24). */}
        {(beat.approved || canApprove(beat)) && (
          <button type="button" className="esp-rowmenu-item" aria-disabled={locking || saving || undefined} title={saving ? 'Wait for the save to finish' : undefined} onClick={() => { if (locking || saving) return; close(); onApprove(beat.id); back(); }}>
            {beat.approved ? 'Unlock' : 'Approve & lock'}
          </button>
        )}
        {/* A beat past 14 can't be approved: the server takes beats 1–14 (Script tab audit 6, 2026-10-24). */}
        {!beat.approved && !canApprove(beat) && <p className="esp-rowmenu-note" data-testid={`script-row-canon-note-${beat.number}`}>Only beats 1–14 can be approved.</p>}
      </div>}
    </details>
  );
}

// The Episode Beats card (the mockup's left column): one row per beat, its
// scene picture, status, name, location and length. Choosing a row opens the
// beat in the centre. A beat is dragged by its handle onto another row.
export function ScriptBeatList({ beats, openId, onChoose, statuses = {}, scenePlan = [], phoneBeats = new Set(), runtimes = {}, totalRuntime = '', drag, onMoveBeat, onApprove, locking = false, saving = false }) {
  const [dropAt, setDropAt] = useState(null);
  const rowRefs = useRef({});
  return (
    <nav className="esp-beatlist" aria-label="Beats" data-testid="script-beatlist">
      <div className="esp-beatlist-head">
        <h3 className="esp-beatlist-title"><ListOrdered size={18} aria-hidden="true" /> Episode Beats</h3>
        <p className="esp-beatlist-sum" data-testid="script-beatlist-sum">{beats.length} beat{beats.length === 1 ? '' : 's'} · {totalRuntime}</p>
      </div>
      <ol className="esp-beatlist-items">
        {beats.map((b, i) => {
          const scene = scenePlan.find((p) => p.beat_number === b.number) || null;
          const status = statuses[b.id] || 'draft';
          const open = b.id === openId;
          const phone = phoneBeats.has(b.id);
          return (
            <li key={b.id} ref={(el) => { rowRefs.current[b.id] = el; }}
              className={`esp-beatrow${open ? ' is-open' : ''}${b.approved ? ' is-locked' : ''}${dropAt?.id === b.id ? ` esp-drop-${dropAt.half}` : ''}`}
              data-testid={`script-row-${b.number}`} data-status={status}
              onDragOver={(e) => { if (drag.current()?.kind !== 'beat') return; e.preventDefault(); setDropAt({ id: b.id, half: drag.half(e) }); }}
              onDragLeave={() => setDropAt(null)}
              onDrop={(e) => { const d = drag.current(); setDropAt(null); if (d?.kind !== 'beat') return; e.preventDefault(); onMoveBeat(d.from, dropIndex(d.from, i, drag.half(e) === 'after')); drag.end(); }}>
              {b.approved
                ? <span className="esp-grip is-locked" aria-hidden="true" />
                : (
                  <span className="esp-grip" data-testid={`script-drag-${b.number}`} draggable
                    title="Drag to move this beat. It keeps its number and name."
                    onDragStart={(e) => { const row = rowRefs.current[b.id]; if (row) e.dataTransfer?.setDragImage?.(row, 24, 24); drag.start(e, { kind: 'beat', from: i }); }}
                    onDragEnd={() => drag.end()}><GripVertical size={16} aria-hidden="true" /></span>
                )}
              <button type="button" className="esp-beatlist-btn" aria-current={open ? 'true' : undefined} data-testid={`script-nav-${b.number}`}
                aria-label={`Beat ${b.number}: ${b.name}, ${STATUS_LABELS[status].toLowerCase()}${phone ? ', has a phone moment' : ''}`}
                onClick={() => onChoose(b.id)}>
                <span className="esp-beatlist-num" aria-hidden="true">{b.number}</span>
                <span className="esp-beatlist-thumb" aria-hidden="true">
                  {scene?.image ? <img src={scene.image} alt="" loading="lazy" /> : <span className="esp-beatlist-icon"><BeatIcon number={b.number} /></span>}
                </span>
                <span className="esp-beatlist-text">
                  <span className="esp-beatlist-badges">
                    <BeatStatusBadge status={status} testId={`script-nav-status-${b.number}`} />
                    {phone && <Smartphone size={14} className="esp-beatlist-phone" aria-label="Has a phone moment" data-testid={`script-nav-phone-${b.number}`} />}
                  </span>
                  <span className="esp-beatlist-name">{b.name}</span>
                  <span className="esp-beatlist-meta">
                    <span className="esp-beatlist-where">{scene?.scene_set_name || 'No scene set'}</span>
                    <span className="esp-beatlist-time">{runtimes[b.id]}</span>
                  </span>
                </span>
              </button>
              <BeatRowMenu beat={b} index={i} count={beats.length} onMoveBeat={onMoveBeat} onApprove={onApprove} locking={locking} saving={saving} />
            </li>
          );
        })}
      </ol>
      <p className="esp-beatlist-legend"><Smartphone size={12} aria-hidden="true" /> = has a phone moment</p>
    </nav>
  );
}

/** The Scene Context card's rows, from the scene plan and the story time: only those it has. */
export function sceneContextFields(scene, { storyTime = null } = {}) {
  const rows = [];
  if (scene?.scene_set_name) rows.push({ key: 'location', label: 'Location', value: `${scene.scene_set_name}${scene.angle_label ? ` · ${scene.angle_label}` : ''}` });
  const setting = fmtType(scene?.sceneSet?.scene_type);
  if (setting) rows.push({ key: 'setting', label: 'Setting', value: setting });
  if (storyTime) rows.push({ key: 'time', label: 'Time', value: storyTime });
  if (scene?.emotional_intent) rows.push({ key: 'mood', label: 'Mood', value: scene.emotional_intent });
  const shot = scene?.shot_type ? (SHOT_LABELS[scene.shot_type] || fmtType(scene.shot_type)) : '';
  if (shot) rows.push({ key: 'shot', label: 'Shot', value: shot });
  if (scene?.scene_context) rows.push({ key: 'context', label: 'Context', value: scene.scene_context });
  if (scene?.director_note) rows.push({ key: 'notes', label: 'Notes', value: scene.director_note });
  return rows;
}

export function SceneContextCard({ beatNumber, rows }) {
  return (
    <section className="esp-card esp-context" data-testid={`script-context-${beatNumber}`} aria-label="Scene context">
      <h4 className="esp-card-title"><Clapperboard size={16} aria-hidden="true" /> Scene Context</h4>
      {rows.length ? (
        <dl className="esp-context-list">
          {rows.map((r) => <div key={r.key} data-testid={`script-context-${r.key}`}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
        </dl>
      ) : (
        <p className="esp-card-empty">No scene planned for this beat yet · <Link className="esp-link" to="?tab=beatplan">Open the Scenes plan</Link></p>
      )}
    </section>
  );
}

const ASSET_ICONS = { location: MapPin, device: Smartphone, phone: Smartphone, icon: Smartphone, overlay: Layers, notify: Bell, dm: MessageCircle, post: Send, wardrobe: Shirt, unknown: CircleHelp };

// The first few assets, then all on "Show all n", so a beat with twenty
// pieces doesn't stretch the cards beside it (Script page audit 4, 2026-10-19).
const ASSETS_SHOWN = 8;

export function AssetsCard({ beatNumber, assets }) {
  const [all, setAll] = useState(false);
  const shown = all ? assets : assets.slice(0, ASSETS_SHOWN);
  return (
    <section className="esp-card esp-assets" data-testid={`script-assets-${beatNumber}`} aria-label="Assets and links">
      <h4 className="esp-card-title"><Link2 size={16} aria-hidden="true" /> Assets &amp; Links</h4>
      {assets.length ? (
        <ul className="esp-assets-list">
          {shown.map((a) => {
            const Icon = ASSET_ICONS[a.kind] || ImageIcon;
            return (
              <li key={a.key} data-testid="script-asset" data-kind={a.kind}>
                <Icon size={15} aria-hidden="true" />
                <span><span className="esp-assets-name">{a.name}</span> <span className="esp-assets-kind">({a.label})</span></span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="esp-card-empty">Nothing on screen or worn in this beat yet.</p>
      )}
      {assets.length > ASSETS_SHOWN && (
        <button type="button" className="esp-link esp-assets-more" aria-expanded={all} data-testid={`script-assets-more-${beatNumber}`} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${assets.length}`}
        </button>
      )}
    </section>
  );
}

export function BeatChecklistCard({ beatNumber, checklist }) {
  const { items, done, total } = checklist;
  return (
    <section className="esp-card esp-checklist" data-testid={`script-checklist-${beatNumber}`} aria-label="Beat checklist">
      <h4 className="esp-card-title"><ListChecks size={16} aria-hidden="true" /> Beat Checklist
        <span className="esp-checklist-count" data-testid={`script-checklist-count-${beatNumber}`}>{done} / {total}</span>
      </h4>
      <progress className="esp-progress" max={total || 1} value={done} aria-label={`${done} of ${total} done`} />
      <ul className="esp-checklist-list">
        {items.map((i) => (
          <li key={i.key} className={i.ok ? 'is-ok' : 'is-todo'} data-testid="script-checklist-item" data-ok={i.ok ? 'true' : 'false'}>
            <span className="esp-checkbox" aria-hidden="true">{i.ok && <Check size={12} />}</span>
            <span>{i.label}</span>
            <span className="esp-sr">{i.ok ? ' (done)' : ' (to do)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
