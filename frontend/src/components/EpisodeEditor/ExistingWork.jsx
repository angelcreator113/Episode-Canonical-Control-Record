/**
 * The media panel's Existing work tab (Prepare From Existing Work, phase B1;
 * docs/reads/2026-11-03-editor-sources-and-prepare-from-existing-work.md).
 *
 * Beat by beat, what the episode already has before anything is placed:
 * - the scene plan's set and angle for the beat (GET /edit/sources), and,
 *   in plain words, why it can't be placed when it can't (the set isn't
 *   linked, the angle has no image, no set was chosen);
 * - the footage tied to the beat: its beat number, a whole-episode take's
 *   beat mark, and the producer's ★ for the beat;
 * - the approved Voice Studio takes of the beat's lines.
 * Clips with no beat at all are listed at the end, never hidden.
 *
 * Nothing is placed by this tab on its own. A ready item can be placed into
 * its own beat with its + (one change, undoable), exactly as from the other
 * tabs. Matching footage to a time in the beat is not guessed (phase C).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CirclePlus, Star, CheckCircle2, AlertTriangle, CircleSlash, AudioLines, Video, Image as ImageIcon } from 'lucide-react';
import { beatLabel, timecode } from '../../lib/editorModel';
import { assetOfClip } from './AssetBrowser';

const BEATS = Array.from({ length: 14 }, (_, i) => i + 1);
const PERFORMER = { lala: 'Lala', justawoman: 'Prime', guest: 'Guest' };

const STATUS_LOOK = {
  ready: { cls: 'is-ready', Icon: CheckCircle2, label: 'Ready' },
  not_linked: { cls: 'is-link', Icon: AlertTriangle, label: 'Set not linked' },
  missing: { cls: 'is-missing', Icon: AlertTriangle, label: 'Missing' },
  no_set: { cls: 'is-none', Icon: CircleSlash, label: 'No set chosen' },
  set_removed: { cls: 'is-missing', Icon: AlertTriangle, label: 'Set deleted' },
  set_picture: { cls: 'is-none', Icon: CircleSlash, label: "Set's picture" },
  unread: { cls: 'is-missing', Icon: AlertTriangle, label: 'Not read' },
};

/** A clip's beats: its beat range, and the beats a whole-episode take marks (t in seconds). */
export function clipBeats(c) {
  const out = new Map();
  const start = Number(c.beat_number);
  if (Number.isInteger(start) && start >= 1) {
    const end = Number(c.end_beat_number) || start;
    for (let b = start; b <= Math.min(14, end); b += 1) out.set(b, { how: 'beat' });
  }
  for (const m of Array.isArray(c.beat_marks) ? c.beat_marks : []) {
    const b = Number(m?.beat);
    if (Number.isInteger(b) && b >= 1 && b <= 14 && Number.isFinite(Number(m.t))) out.set(b, { how: 'mark', t: Number(m.t) });
  }
  return out;
}

function PlaceButton({ asset, editable, onPlace }) {
  if (!asset || !editable) return null;
  return (
    <button type="button" className="tle-tile-place" onClick={() => onPlace?.(asset)} aria-label={`Place ${asset.label}`} title={asset.beat ? `Place in beat ${asset.beat}` : 'Place at the playhead'}>
      <CirclePlus size={16} aria-hidden="true" />
    </button>
  );
}

function Row({ asset, editable, onPlace, onDragAsset, children, className = '' }) {
  const drag = asset && editable;
  return (
    <li className={`tle-work-row ${className}${drag ? ' is-placeable' : ''}`} draggable={drag || undefined}
      onDragStart={drag ? (e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', asset.label); onDragAsset?.(asset); } : undefined}
      onDragEnd={drag ? () => onDragAsset?.(null) : undefined}>
      <div className="tle-work-row-body">{children}</div>
      <PlaceButton asset={asset} editable={editable} onPlace={onPlace} />
    </li>
  );
}

function PlanItem({ item, placed, editable, onPlace, onDragAsset }) {
  const look = STATUS_LOOK[item.status] || STATUS_LOOK.missing;
  const name = `${item.scene_set?.name || 'No set'}${item.angle_label ? ` · ${item.angle_label}` : ''}`;
  const still = item.place?.still ? { kind: 'angle_still', id: item.angle.id, source_kind: 'angle_still', label: `${name} (still)`, beat: item.beat_number } : null;
  const video = item.place?.video ? { kind: 'angle_video', id: item.angle.id, source_kind: 'angle_video', label: `${name} (video)`, beat: item.beat_number } : null;
  const who = item.chosen_by_user || item.locked ? 'Chosen by you' : 'Suggested by the planner';
  return (
    <>
      <Row asset={still || video} editable={editable} onPlace={onPlace} onDragAsset={onDragAsset}>
        <span className="tle-work-thumb" aria-hidden="true">
          {item.angle?.still_image_url ? <img src={item.angle.still_image_url} alt="" loading="lazy" /> : <ImageIcon size={16} />}
        </span>
        <span className="tle-work-text">
          <span className="tle-work-name">{name}</span>
          <span className={`tle-work-status ${look.cls}`}><look.Icon size={12} aria-hidden="true" /> {look.label}</span>
          {placed && <span className="tle-work-status is-placed"><CheckCircle2 size={12} aria-hidden="true" /> On the edit</span>}
          <span className="tle-muted"> {who}{still && video ? ' · still (+); the video is below' : ''}</span>
          {item.status !== 'ready' && item.text && <span className="tle-work-why">{item.text}</span>}
        </span>
      </Row>
      {still && video && (
        <Row asset={video} editable={editable} onPlace={onPlace} onDragAsset={onDragAsset} className="is-sub">
          <span className="tle-work-thumb" aria-hidden="true"><Video size={16} /></span>
          <span className="tle-work-text"><span className="tle-work-name">{name}</span> <span className="tle-muted">angle video</span></span>
        </Row>
      )}
    </>
  );
}

function ClipItem({ clip, beat, how, editable, onPlace, onDragAsset }) {
  const asset = assetOfClip(clip);
  const label = clip.label || clip.original_filename || 'Untitled clip';
  const bits = [
    PERFORMER[clip.performer] || clip.performer,
    how?.how === 'mark' ? `marked at ${timecode(Math.round(how.t * 1000))} in the take` : null,
    clip.key_status === 'done' ? 'cutout ready' : clip.key_status === 'queued' || clip.key_status === 'processing' ? 'cutout in progress' : clip.key_status === 'failed' ? 'cutout failed' : null,
    Number(clip.duration_seconds) > 0 ? null : 'no measured length yet',
  ].filter(Boolean);
  const starred = clip.is_favorite && (beat == null || Number(clip.beat_number) === beat);
  return (
    <Row asset={asset} editable={editable} onPlace={onPlace} onDragAsset={onDragAsset}>
      <span className="tle-work-thumb" aria-hidden="true">{clip.thumbnail_url ? <img src={clip.thumbnail_url} alt="" loading="lazy" /> : <Video size={16} />}</span>
      <span className="tle-work-text">
        <span className="tle-work-name">{starred && <Star size={12} className="tle-star" aria-label="Your pick" />}<span>{label}</span></span>
        <span className="tle-muted"> {bits.join(' · ')}</span>
      </span>
    </Row>
  );
}

export default function ExistingWork({
  episodeId, sources, rawClips, takes, placedAngles, focusBeat, editable = false, onPlace, onDragAsset,
}) {
  const plan = sources.data?.plan || [];
  const clips = rawClips.data || [];
  const takeList = takes.data?.takes || [];
  const byBeat = useMemo(() => {
    const out = new Map(BEATS.map((b) => [b, { plan: [], clips: [], takes: [] }]));
    for (const p of plan) out.get(p.beat_number)?.plan.push(p);
    for (const c of clips) for (const [b, how] of clipBeats(c)) out.get(b)?.clips.push({ clip: c, how });
    for (const t of takeList) out.get(t.beat_number)?.takes.push(t);
    for (const v of out.values()) v.clips.sort((x, y) => Number(Boolean(y.clip.is_favorite)) - Number(Boolean(x.clip.is_favorite)));
    return out;
  }, [plan, clips, takeList]);
  const unassigned = clips.filter((c) => clipBeats(c).size === 0);
  const s = sources.data?.summary;
  const beats = focusBeat != null ? [focusBeat] : BEATS;
  const place = { editable, onPlace, onDragAsset };

  return (
    <div className="tle-work" data-testid="existing-work">
      <p className="tle-empty">What this episode already has, beat by beat. Nothing here is on the edit until you place it.</p>
      {sources.loading && <p className="tle-empty">Reading the scene plan…</p>}
      {sources.error && <p className="tle-empty tle-error" role="alert">The scene plan could not be read: {sources.error}</p>}
      {sources.data?.error && <p className="tle-empty tle-error" role="alert">{sources.data.error}</p>}
      {s && (
        <ul className="tle-work-summary" aria-label="Scene plan summary">
          <li>{s.beats_planned} of 14 beats planned</li>
          <li className="is-ready">{s.ready} ready</li>
          {s.not_linked > 0 && <li className="is-link">{s.not_linked} set{s.not_linked === 1 ? '' : 's'} not linked</li>}
          {s.missing + s.set_removed > 0 && <li className="is-missing">{s.missing + s.set_removed} missing</li>}
          <li>{clips.length} clip{clips.length === 1 ? '' : 's'}{unassigned.length ? ` (${unassigned.length} with no beat)` : ''}</li>
          <li>{takeList.length} approved take{takeList.length === 1 ? '' : 's'}</li>
        </ul>
      )}
      {sources.data && !plan.length && (
        <p className="tle-empty">No scene plan yet. Plan each beat's set and angle in the episode's <Link to={`/episodes/${episodeId}/plan`}>scene planner</Link>.</p>
      )}
      {beats.map((b) => {
        const v = byBeat.get(b) || { plan: [], clips: [], takes: [] };
        return (
          <section key={b} className="tle-work-beat" aria-label={`Beat ${b}: ${beatLabel(b)}`}>
            <h3 className="tle-set-name">Beat {b} · {beatLabel(b)}</h3>
            <ul className="tle-work-list">
              {v.plan.map((p) => <PlanItem key={p.id} item={p} placed={Boolean(p.angle && placedAngles?.get(b)?.has(p.angle.id))} {...place} />)}
              {sources.data && !v.plan.length && <li className="tle-work-row is-empty"><span className="tle-muted">No scene planned for this beat.</span></li>}
              {v.clips.map(({ clip, how }) => <ClipItem key={`${clip.id}-${b}`} clip={clip} beat={b} how={how} {...place} />)}
              {v.takes.map((t) => (
                <Row key={t.approval_id} asset={{ kind: 'take', id: t.approval_id, label: `Beat ${t.beat_number} · line ${t.line_index + 1}`, beat_number: t.beat_number, line_index: t.line_index }} {...place}>
                  <span className="tle-work-thumb" aria-hidden="true"><AudioLines size={16} /></span>
                  <span className="tle-work-text"><span className="tle-work-name">Line {t.line_index + 1}</span> <span className="tle-muted">approved take</span></span>
                </Row>
              ))}
            </ul>
          </section>
        );
      })}
      {unassigned.length > 0 && (
        <section className="tle-work-beat" aria-label="Clips not assigned to a beat">
          <h3 className="tle-set-name">Not assigned to a beat</h3>
          <p className="tle-empty">Give these a beat (or beat marks) in the episode's <Link to={`/episodes/${episodeId}?tab=files`}>Files</Link> tab, or place them by hand.</p>
          <ul className="tle-work-list">
            {unassigned.map((c) => <ClipItem key={c.id} clip={c} beat={null} how={null} {...place} />)}
          </ul>
        </section>
      )}
      {takes.data && !takes.data.available && <p className="tle-empty">Voice Studio is switched off here, so approved takes can't be shown.</p>}
    </div>
  );
}
