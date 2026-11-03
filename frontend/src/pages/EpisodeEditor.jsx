/**
 * EpisodeEditor: the episode's multitrack editor at /episodes/:episodeId/editor
 * (Timeline Editor redesign P1, 2026-11-02; Evoni's rulings D1 and D2). One
 * editor on the C1 episode edit: it reads only /api/v1/episodes/:id/edit and
 * the episode's own media, and in P1 it writes nothing. Its layout follows
 * the chosen reference (plan §3): top bar, media | preview | inspector,
 * the edit toolbar, then the 14-beat rail and the multitrack.
 *
 * P2 adds the working preview: playback on the edit's one clock, with the
 * scene, Prime's PIP, her commentary and the approved dialogue.
 *
 * P3 adds editing on the existing C1 routes: placing media from the media
 * panel, moving, trimming, splitting, deleting, copying and pasting, Prime's
 * place and size dragged in the preview, the inspector's stored values, the
 * beat card (Prime mode, length with a dry run, timing lock, hiding Prime),
 * undo and redo, and Save Draft (a named version). Every change is saved
 * when it is made, with the edit_revision the page read (useEditOps).
 *
 * Gate 2a (rulings D3, D4, D5) adds Lala's and guests' clips over the scene
 * (the Performer lane), captions, titles and lower thirds, opacity on every
 * placed picture, and each beat's visual mode with timed mode changes.
 *
 * What is not built yet is shown disabled with what unlocks it:
 * render and export (the render host, Gates 3–6), and the
 * phone, gameplay and overlay lanes (Gate 2b, their state model). The old
 * Timeline Editor was deleted (Evoni, 2026-11-03): /episodes/:id/timeline
 * lands here (App LegacyTimelineRedirect).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import {
  ArrowLeft, ChevronRight, Pencil, Save, MonitorPlay, Upload, MoreVertical,
  Undo2, Redo2, SquareSplitHorizontal, Scissors, Copy, ClipboardPaste, Trash2, ZoomIn, ZoomOut, Maximize2, Magnet, X,
} from 'lucide-react';
import { episodeEditApi, readFailure } from '../lib/episodeEditApi';
import {
  buildTimeline, beatReadiness, mediaIndex, editPoints,
} from '../lib/editorModel';
import { mixPlan } from '../lib/editTimeline';
import { framePlan, mixAt, snapToFrame } from '../lib/previewPlan';
import { TEXT_MS } from '../components/EpisodeEditor/AssetBrowser';
import * as ops from '../lib/editOps';
import useEditOps from '../components/EpisodeEditor/useEditOps';
import usePreviewPlayback from '../components/EpisodeEditor/usePreviewPlayback';
import AssetBrowser from '../components/EpisodeEditor/AssetBrowser';
import EditorPreview from '../components/EpisodeEditor/EditorPreview';
import EditorInspector from '../components/EpisodeEditor/EditorInspector';
import EditorTimeline, { LABEL_W } from '../components/EpisodeEditor/EditorTimeline';
import BeatRail from '../components/EpisodeEditor/BeatRail';
import useStoredSize, { readStored, writeStored } from '../components/EpisodeEditor/useStoredSize';
import './EpisodeEditor.css';

const FRAME_MS = 1000 / 30;
const MIN_PX_PER_MS = 0.004; // 4 px a second
const MAX_PX_PER_MS = 0.6; // 600 px a second
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * A read's state: { loading, data, error, reload }. reload() reads again and
 * keeps showing the last answer until the new one arrives; it rejects when
 * the read fails, so a caller can say so.
 */
function useRead(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const gen = useRef(0);
  useEffect(() => {
    const mine = ++gen.current;
    setState({ loading: true, data: null, error: null });
    fn().then(
      (data) => { if (gen.current === mine) setState({ loading: false, data, error: null }); },
      (err) => {
        console.error('[EpisodeEditor] read failed:', err?.message);
        if (gen.current === mine) setState({ loading: false, data: null, error: err });
      },
    );
  }, deps);
  const reload = useCallback(async () => {
    const mine = ++gen.current;
    const data = await fnRef.current();
    if (gen.current === mine) setState({ loading: false, data, error: null });
    return data;
  }, []);
  return { ...state, reload };
}

const messageOf = (err) => (err ? readFailure(err).message : null);

const PENDING = {
  render: 'Pending: the render host (Gates 3–6)',
};

function FullPage({ title, children, episodeId }) {
  return (
    <div className="tle tle-full" role="alert">
      <div className="tle-full-card">
        <h1>{title}</h1>
        {children}
        <p className="tle-full-links">
          {episodeId && <Link to={`/episodes/${episodeId}?tab=edit`}>← Back to the episode</Link>}
        </p>
      </div>
    </div>
  );
}

export default function EpisodeEditor() {
  const { episodeId } = useParams();
  const episode = useRead(() => episodeEditApi.episode(episodeId), [episodeId]);
  const edit = useRead(() => episodeEditApi.load(episodeId), [episodeId]);
  const findings = useRead(() => episodeEditApi.findings(episodeId), [episodeId]);
  const rawClips = useRead(() => episodeEditApi.rawClips(episodeId), [episodeId]);
  const sceneSets = useRead(() => episodeEditApi.sceneSets(episodeId), [episodeId]);
  const takes = useRead(() => episodeEditApi.takes(episodeId), [episodeId]);
  // Prepare From Existing Work, B1: the scene plan, beat by beat (reads only).
  const sources = useRead(() => episodeEditApi.sources(episodeId), [episodeId]);

  // Takes: Voice Studio's playable list, and (P4) the URL each take the edit names carries in GET /edit.
  const media = useMemo(() => {
    const listed = takes.data?.takes || [];
    const known = new Set(listed.map((t) => String(t.approval_id)));
    const fromEdit = Object.entries(edit.data?.edit?.voiceTakes || {})
      .filter(([id, k]) => !known.has(String(id)) && k.audio_url)
      .map(([id, k]) => ({ approval_id: id, audio_url: k.audio_url, beat_number: k.beat_number, line_index: k.line_index }));
    return mediaIndex({ rawClips: rawClips.data || [], sceneSets: sceneSets.data || [], takes: [...listed, ...fromEdit] });
  }, [rawClips.data, sceneSets.data, takes.data, edit.data]);
  const model = useMemo(() => (edit.data ? buildTimeline(edit.data.edit, media) : null), [edit.data, media]);
  // Which angles each beat already has on the edit (Existing work says "On the edit").
  const placedAngles = useMemo(() => {
    const out = new Map();
    for (const c of edit.data?.edit?.sceneClips || []) {
      if (c.source_kind !== 'angle_still' && c.source_kind !== 'angle_video') continue;
      if (!out.has(c.beat_number)) out.set(c.beat_number, new Set());
      out.get(c.beat_number).add(c.source_id);
    }
    return out;
  }, [edit.data]);
  const readiness = useMemo(() => (model && findings.data ? beatReadiness(model, findings.data.findings) : null), [model, findings.data]);

  const [playhead, setPlayhead] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [focusBeat, setFocusBeat] = useState(null);
  const [pxPerMs, setPxPerMs] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const viewKey = `tle-view-${episodeId}`;
  const [view, setView] = useState(() => readStored(viewKey, {}));
  const [railCollapsed, setRailCollapsed] = useState(() => Boolean(readStored('tle-rail-collapsed', false)));
  const [leftW, , dragLeft, resetLeft] = useStoredSize('tle-left-w', 400, { min: 280, max: 520 });
  const [rightW, , dragRight, resetRight] = useStoredSize('tle-right-w', 324, { min: 280, max: 420 });
  const [upper, setUpper, dragUpper, resetUpper] = useStoredSize('tle-upper-ratio', 0.52, { min: 0.25, max: 0.75 });
  const scrollRef = useRef(null);
  const bodyRef = useRef(null);
  const [draggingAsset, setDraggingAsset] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [liveLayout, setLiveLayout] = useState(null);
  const [beatPlan, setBeatPlan] = useState(null);
  const [versions, setVersions] = useState(null);

  // ── Saving changes (P3) ─────────────────────────────────────────────
  const editRef = useRef(null);
  editRef.current = edit.data;
  const reloadAll = useCallback(async () => {
    await edit.reload();
    findings.reload().catch((err) => console.error('[EpisodeEditor] findings reload failed:', err?.message));
  }, [edit.reload, findings.reload]);
  // Editing is an admin's (the server refuses anyone else's writes): others get the editor read
  // only, and useEditOps sends nothing for them, whatever starts the change (a key, a drop, a field).
  const { user } = useAuth();
  const admin = isAdmin(user);
  const editor = useEditOps({ episodeId, getRevision: () => editRef.current?.edit_revision, reload: reloadAll, canWrite: admin });
  const canEdit = Boolean(edit.data) && admin;
  const editable = canEdit && !editor.busy;

  const toggleView = useCallback((lane, key) => {
    setView((cur) => {
      const next = { ...cur, [lane]: { ...(cur[lane] || {}), [key]: !(cur[lane] || {})[key] } };
      writeStored(viewKey, next);
      return next;
    });
  }, [viewKey]);

  const fitTo = useCallback((ms) => {
    const width = (scrollRef.current?.clientWidth || 1000) - 40;
    setPxPerMs(ms > 0 ? clamp(width / ms, MIN_PX_PER_MS, MAX_PX_PER_MS) : 0.05);
  }, []);

  useEffect(() => { if (model && pxPerMs == null) fitTo(model.duration); }, [model, pxPerMs, fitTo]);

  const allBlocks = useMemo(() => (model ? Object.values(model.blocks).flat() : []), [model]);
  const selectedRaw = allBlocks.find((b) => b.id === selectedId) || null;
  const selected = selectedRaw ? { ...selectedRaw, locked: Boolean(view[selectedRaw.lane]?.locked) } : null;
  // The selection survives a reload by id; a block that is gone is no longer selected.
  useEffect(() => { if (selectedId && model && !allBlocks.some((b) => b.id === selectedId)) setSelectedId(null); }, [model, allBlocks, selectedId]);
  const beatAt = model ? (model.beats.find((b) => playhead >= b.start && playhead < b.end)
    || (playhead >= model.duration ? [...model.beats].reverse().find((b) => b.end > b.start) : null)) : null;
  const cardBeat = focusBeat != null ? model?.beats.find((b) => b.beat === focusBeat) : beatAt;
  const pipHiddenRule = cardBeat && edit.data
    ? [...(edit.data.edit.visibility || [])].reverse().find((r) => r.scope === 'beat' && r.beat_number === cardBeat.beat && r.visible === false) || null
    : null;
  const frame = useMemo(() => (edit.data ? framePlan(edit.data.edit, playhead, media) : null), [edit.data, playhead, media]);
  const hidden = { scene: view.scene?.hidden, prime: view.prime?.hidden, performer: view.performer?.hidden, captions: view.captions?.hidden };

  // The mix, once per edit; what each sound does at t, with the preview-only lane mutes.
  const mix = useMemo(() => (edit.data ? mixPlan(edit.data.edit) : null), [edit.data]);
  const mutedLanes = useMemo(() => Object.fromEntries(Object.entries(view).filter(([, v]) => v?.muted).map(([k]) => [k, true])), [view]);
  const soundsAt = useCallback((t) => (mix ? mixAt(mix, t, media, { mutedLanes }) : []), [mix, media, mutedLanes]);
  const [volume, setVolumeState] = useState(() => {
    const v = Number(readStored('tle-preview-volume', 0.8));
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0.8;
  });
  const [previewMuted, setPreviewMuted] = useState(false);
  const setVolume = (v) => { setVolumeState(v); writeStored('tle-preview-volume', v); };
  const [failedVideo, setFailedVideo] = useState({});
  const onVideoFailed = useCallback((src) => { if (src) setFailedVideo((cur) => ({ ...cur, [src]: true })); }, []);
  const player = usePreviewPlayback({
    duration: model?.duration || 0, playhead, setPlayhead, soundsAt, masterVolume: previewMuted ? 0 : volume,
  });
  const sounds = useMemo(() => soundsAt(playhead).map((s) => ({ ...s, failed: Boolean(player.failed[s.key]) })), [soundsAt, playhead, player.failed]);

  const seek = useCallback((t) => {
    const at = snapToFrame(clamp(Math.round(t), 0, model?.duration || 0));
    setPlayhead(at);
    player.restartAt(at);
  }, [model, player]);

  // While playing, the timeline keeps the playhead in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!player.playing || !el || !pxPerMs) return;
    const x = playhead * pxPerMs;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 40);
  }, [playhead, player.playing, pxPerMs]);
  const points = useMemo(() => (model ? editPoints(model) : [0]), [model]);
  const prevEdit = () => seek([...points].reverse().find((p) => p < playhead) ?? 0);
  const nextEdit = () => seek(points.find((p) => p > playhead) ?? (model?.duration || 0));

  // ── Editing actions (P3): each builds one command (lib/editOps) and runs it ──
  const laneLocked = (lane) => Boolean(view[lane]?.locked);
  const refuseLocked = (lane, what) => {
    if (!laneLocked(lane)) return false;
    editor.say({ kind: 'info', text: `${what}: the ${lane.replace('_', ' ')} lane is locked in this browser. Unlock it in its track header.` });
    return true;
  };
  const beatStart = (n) => model?.beats.find((b) => b.beat === n)?.start ?? 0;
  const segmentOf = (block) => (block.kind === 'commentary' ? allBlocks.find((b) => b.id === block.linked) || block : block);

  /** Where something new placed at t is anchored: to the beat it starts in, else to the start of the edit. */
  const anchorForNew = (t) => {
    const b = model.beats.find((x) => t >= x.start && t < x.end);
    return b ? { anchor_kind: 'beat_start', anchor_beat: b.beat, offset_ms: Math.round(t - b.start) } : { anchor_kind: 'edit_start', offset_ms: Math.round(t) };
  };
  const c1b = edit.data?.c1b !== false;
  const refuseNoC1b = (what) => {
    if (c1b) return false;
    editor.say({ kind: 'info', text: `${what} needs the C1b migration (Gate 2a), which has not run on this server. Nothing was changed.` });
    return true;
  };

  /** Places media from the media panel at edit time t (a drop, or the playhead). */
  const placeAsset = useCallback((asset, t, lane = null) => {
    if (!model || !edit.data) return;
    const at = snapToFrame(t);
    if (asset.kind === 'caption') {
      if (refuseNoC1b('A caption') || refuseLocked('captions', 'Add text')) return;
      const text = window.prompt(`${asset.label} text`, '');
      if (!text || !text.trim()) return;
      editor.run(ops.addItem({ kind: 'caption', ...anchorForNew(at), duration_ms: TEXT_MS, values: { text: text.trim().slice(0, 500), style_key: asset.style_key, layout: asset.layout } }, `Add ${asset.label.toLowerCase()}`));
      return;
    }
    if (asset.performer && (lane === 'performer' || lane == null)) {
      if (refuseNoC1b('Lala over the scene') || refuseLocked('performer', 'Place performer')) return;
      if (!(asset.duration_ms > 0)) {
        editor.say({ kind: 'error', text: `${asset.label} has no measured length yet, so it can't be placed over the scene. Nothing was changed.` });
        return;
      }
      editor.run(ops.addItem({ kind: 'performer_clip', ...anchorForNew(at),
        values: { raw_clip_id: asset.id, source_in_ms: 0, source_out_ms: asset.duration_ms, layout: { x: 0, y: 0, w: 1920, h: 1080 }, layer: 0 } }, `Place ${asset.label} over the scene`));
      return;
    }
    if (asset.kind === 'prime_clip') {
      if (refuseLocked('prime', 'Place Prime')) return;
      editor.run(ops.placeSegment({ raw_clip_id: asset.id, anchor_kind: 'edit_start', offset_ms: at }, `Place ${asset.label}`));
      return;
    }
    if (asset.kind === 'take') {
      if (refuseLocked('dialogue', 'Place dialogue')) return;
      const take = edit.data.edit.voiceTakes?.[asset.id];
      if (!take || !take.playable) {
        editor.say({ kind: 'error', text: `${asset.label}: this take is not the current approved one any more. Reload, or approve it again in Voice Studio.` });
        return;
      }
      const b = model.beats.find((x) => x.beat === take.beat_number);
      const offset = b && at >= b.start && at < b.end ? at - b.start : 0;
      editor.run(ops.placeDialogue({ approval_id: asset.id, association_id: take.association_id, anchor_kind: 'beat_start', anchor_beat: take.beat_number, offset_ms: offset }, `Place ${asset.label}`));
      return;
    }
    if (['angle_still', 'angle_video', 'scene_clip_source'].includes(asset.kind)) {
      if (refuseLocked('scene', 'Place scene')) return;
      // From Existing work an angle goes into the beat its plan names (asset.beat).
      const beat = asset.beat ?? focusBeat ?? ops.beatForDrop(model.beats, at, model.duration);
      const body = { beat_number: beat, source_kind: asset.source_kind, source_id: asset.id };
      if (asset.source_kind === 'angle_still') body.duration_ms = 5000;
      editor.run(ops.placeSceneClip(body, `Place ${asset.label} in beat ${beat}`));
      return;
    }
    editor.say({ kind: 'info', text: `${asset.label} can't be placed ${lane ? `on that lane` : 'here'}.` });
  }, [model, edit.data, editor, focusBeat, view]);

  /** A scene clip's place among its beat's clips, and where a drag to `start` would put it. */
  const sceneOrder = (block, start = block.start) => {
    const siblings = (model?.blocks.scene || []).filter((b) => b.beat === block.beat).sort((a, b) => a.start - b.start);
    const from = siblings.findIndex((b) => b.id === block.id);
    const mid = start + (block.end - block.start) / 2;
    const to = siblings.filter((b) => b.id !== block.id && (b.start + b.end) / 2 < mid).length;
    return { from, to, count: siblings.length };
  };

  const moveBlock = useCallback((block, newStart) => {
    const at = snapToFrame(Math.max(0, newStart));
    if (refuseLocked(block.lane, 'Move')) return;
    if (block.kind === 'segment') editor.run(ops.moveSegment(block.row, ops.anchorAt(block.row, at, model.beats)));
    else if (block.kind === 'dialogue') editor.run(ops.moveDialogue(block.row, ops.anchorAt(block.row, at, model.beats)));
    else if (block.kind === 'audio_item') editor.run(ops.updateAudioItem(block.row, ops.anchorAt(block.row, at, model.beats), 'Move sound'));
    else if (block.kind === 'performer_clip' || block.kind === 'caption') editor.run(ops.updateItem(block.row, ops.anchorAt(block.row, at, model.beats), block.kind === 'caption' ? 'Move caption' : 'Move performer clip'));
    else if (block.kind === 'scene_clip') {
      // Scene clips are laid end to end in their beat: a drag changes their order, never a time.
      const { from, to } = sceneOrder(block, newStart);
      if (to !== from) editor.run(ops.reorderSceneClip(block.row, to, from));
    }
  }, [editor, model, view]);

  const trimBlock = useCallback((block, edge, t) => {
    if (refuseLocked(block.lane, 'Trim')) return;
    const at = snapToFrame(t);
    const row = block.row;
    if (block.kind === 'segment') {
      if (edge === 'end') {
        const out = row.source_in_ms + Math.max(33, at - block.start);
        editor.run(ops.trimSegment(row, { source_out_ms: Math.round(out) }));
      } else {
        const inMs = Math.max(0, Math.min(row.source_out_ms - 33, row.source_in_ms + (at - block.start)));
        editor.run(ops.trimSegment(row, { source_in_ms: Math.round(inMs) }));
      }
    } else if (block.kind === 'scene_clip' && edge === 'end') {
      editor.run(ops.updateSceneClip(row, { duration_ms: Math.max(33, Math.round(at - block.start)) }, 'Change scene clip length'));
    } else if (block.kind === 'audio_item') {
      if (edge === 'end') {
        editor.run(ops.updateAudioItem(row, { source_out_ms: Math.round(row.source_in_ms + Math.max(33, at - block.start)) }, 'Trim sound'));
      } else {
        // Trimming the head keeps the rest where it plays: the start moves later by as much (as Prime's trims do).
        const delta = Math.max(-row.source_in_ms, Math.min(row.source_out_ms - row.source_in_ms - 33, Math.round(at - block.start)));
        editor.run(ops.updateAudioItem(row, { source_in_ms: row.source_in_ms + delta, ...ops.anchorAt(row, block.start + delta, model.beats) }, 'Trim sound'));
      }
    } else if (block.kind === 'performer_clip') {
      const v = row.values || {};
      if (edge === 'end') {
        editor.run(ops.updateItem(row, { values: { source_out_ms: Math.round(v.source_in_ms + Math.max(33, at - block.start)) } }, 'Trim performer clip'));
      } else {
        const delta = Math.max(-v.source_in_ms, Math.min(v.source_out_ms - v.source_in_ms - 33, Math.round(at - block.start)));
        editor.run(ops.updateItem(row, { values: { source_in_ms: v.source_in_ms + delta }, ...ops.anchorAt(row, block.start + delta, model.beats) }, 'Trim performer clip'));
      }
    } else if (block.kind === 'caption') {
      if (edge === 'end') {
        editor.run(ops.updateItem(row, { duration_ms: Math.max(33, Math.round(at - block.start)) }, 'Change caption length'));
      } else {
        // Its end stays where it is.
        const delta = Math.max(-block.start, Math.min(row.duration_ms - 33, Math.round(at - block.start)));
        editor.run(ops.updateItem(row, { duration_ms: row.duration_ms - delta, ...ops.anchorAt(row, block.start + delta, model.beats) }, 'Change caption length'));
      }
    }
  }, [editor, view, model]);

  const deleteBlock = useCallback((block) => {
    if (!block) return;
    const b = segmentOf(block);
    if (refuseLocked(b.lane, 'Delete')) return;
    if (b.kind === 'scene_clip') editor.run(ops.removeSceneClip(b.row));
    else if (b.kind === 'segment') editor.run(ops.removeSegment(b.row));
    else if (b.kind === 'dialogue') editor.run(ops.removeDialogue(b.row));
    else if (b.kind === 'audio_item') editor.run(ops.removeAudioItem(b.row));
    else if (b.kind === 'performer_clip' || b.kind === 'caption') editor.run(ops.removeItem(b.row));
  }, [editor, allBlocks, view]);

  const splitAtPlayhead = useCallback((block) => {
    const b = block && segmentOf(block);
    if (!b || !['segment', 'scene_clip'].includes(b.kind)) { editor.say({ kind: 'info', text: 'Split works on a Prime segment or a scene clip: select one and put the playhead inside it.' }); return; }
    if (refuseLocked(b.lane, 'Split')) return;
    if (!(playhead > b.start && playhead < b.end)) { editor.say({ kind: 'info', text: 'Put the playhead inside the clip to split it there.' }); return; }
    if (b.kind === 'segment') editor.run(ops.splitSegment(b.row, Math.round(b.row.source_in_ms + (playhead - b.start))));
    else editor.run(ops.splitSceneClip(b.row, Math.round(playhead - b.start)));
  }, [editor, playhead, allBlocks, view]);

  const copyBlock = useCallback((block, cut = false) => {
    const b = block && segmentOf(block);
    if (!b) return;
    if (b.kind === 'dialogue') { editor.say({ kind: 'info', text: 'A line is placed once: move it instead of copying it.' }); return; }
    setClipboard({ kind: b.kind, row: b.row, label: b.label, duration: b.end - b.start });
    if (cut) deleteBlock(b);
    else editor.say({ kind: 'ok', text: `Copied ${b.label}. Paste puts it at the playhead.` });
  }, [editor, deleteBlock, allBlocks]);

  const paste = useCallback(() => {
    if (!clipboard || !model) return;
    const at = snapToFrame(playhead);
    const { kind, row, label } = clipboard;
    if (kind === 'segment') {
      if (refuseLocked('prime', 'Paste')) return;
      // As it is stored (her commentary range, or none, her gain and mute), at the playhead.
      const body = { ...ops.segmentPlaceBody(row), anchor_kind: 'edit_start', offset_ms: at, layout: row.layout || null };
      delete body.anchor_beat;
      delete body.anchor_ref;
      editor.run(ops.placeSegment(body, `Paste ${label}`));
    } else if (kind === 'scene_clip') {
      if (refuseLocked('scene', 'Paste')) return;
      const beat = focusBeat ?? ops.beatForDrop(model.beats, at, model.duration);
      const body = { beat_number: beat, source_kind: row.source_kind, source_id: row.source_id, duration_ms: row.duration_ms };
      if (row.source_kind !== 'angle_still') Object.assign(body, { source_in_ms: row.source_in_ms, source_out_ms: row.source_out_ms });
      editor.run(ops.placeSceneClip(body, `Paste ${label} in beat ${beat}`));
    } else if (kind === 'audio_item') {
      const lane = row.track === 'sfx' ? 'sfx' : 'music';
      if (refuseLocked(lane, 'Paste')) return;
      const body = { track: row.track, asset_ref: row.asset_ref, slot: row.slot, source_in_ms: row.source_in_ms, source_out_ms: row.source_out_ms,
        anchor_kind: 'edit_start', offset_ms: at, gain_db: row.gain_db, fade_in_ms: row.fade_in_ms, fade_out_ms: row.fade_out_ms, duck_under_dialogue_db: row.duck_under_dialogue_db };
      editor.run(ops.addAudioItem(Object.fromEntries(Object.entries(body).filter(([, v]) => v != null)), `Paste ${label}`));
    } else if (kind === 'performer_clip' || kind === 'caption') {
      if (refuseLocked(kind === 'caption' ? 'captions' : 'performer', 'Paste')) return;
      const body = { kind, ...anchorForNew(at), values: row.values, ...(kind === 'caption' ? { duration_ms: row.duration_ms } : {}) };
      editor.run(ops.addItem(body, `Paste ${label}`));
    }
  }, [clipboard, model, playhead, editor, focusBeat, view]);

  const act = {
    move: (block, t) => moveBlock(block, t),
    updateScene: (block, changes) => { if (!refuseLocked('scene', 'Change')) editor.run(ops.updateSceneClip(block.row, changes, 'Change scene clip')); },
    reorderScene: (block, step) => {
      if (refuseLocked('scene', 'Move')) return;
      const { from, count } = sceneOrder(block);
      const to = from + step;
      if (to >= 0 && to < count) editor.run(ops.reorderSceneClip(block.row, to, from, step < 0 ? 'Move scene clip earlier' : 'Move scene clip later'));
    },
    audioItem: (block, changes) => { if (!refuseLocked(block.lane, 'Change')) editor.run(ops.updateAudioItem(block.row, changes)); },
    trimSegment: (block, range) => { if (!refuseLocked('prime', 'Trim')) editor.run(ops.trimSegment(segmentOf(block).row, range)); },
    segmentAudio: (block, changes) => { if (!refuseLocked('prime_vo', 'Change')) editor.run(ops.setSegmentAudio(segmentOf(block).row, changes)); },
    layout: (block, layout) => { if (!refuseLocked('prime', 'Move Prime')) editor.run(ops.setSegmentLayout(segmentOf(block).row, layout)); },
    item: (block, changes, label) => { if (!refuseLocked(block.lane, 'Change')) editor.run(ops.updateItem(block.row, changes, label)); },
    itemLayout: (block, layout) => {
      if (!refuseLocked(block.lane, 'Move')) editor.run(ops.updateItem(block.row, { values: { layout } }, block.kind === 'caption' ? 'Move caption' : 'Move performer clip'));
    },
    visualMode: (beat, mode) => { if (!refuseNoC1b('A visual mode')) editor.run(ops.setBeatVisualMode(beat.beat, mode, beat.visual_mode_set ?? null)); },
    addModeChange: (beat, mode) => {
      if (refuseNoC1b('A mode change')) return;
      const at = snapToFrame(playhead);
      if (!(at > beat.start && at < beat.end)) { editor.say({ kind: 'info', text: 'Put the playhead inside the beat to switch its mode there.' }); return; }
      editor.run(ops.addItem({ kind: 'visual_mode', anchor_kind: 'beat_start', anchor_beat: beat.beat, offset_ms: Math.round(at - beat.start), values: { mode } }, `Beat ${beat.beat}: ${mode} from the playhead`));
    },
    removeModeChange: (mark) => editor.run(ops.removeItem(mark.row, 'Remove mode change')),
    beatMode: (beat, mode) => editor.run(ops.setBeatMode(beat.beat, mode, beat.prime_mode)),
    hidePip: (beat) => editor.run(ops.setBeatPipVisible(beat.beat, false)),
    showPip: (beat, rule) => editor.run(ops.removeVisibility(rule)),
    planBeatLength: async (beat, msValue) => {
      try {
        const plan = await episodeEditApi.beatDurationPlan(episodeId, beat.beat, Math.round(msValue));
        setBeatPlan({ ...plan, requested_ms: Math.round(msValue) });
      } catch (err) {
        console.error('[EpisodeEditor] beat length dry run failed:', err?.message);
        editor.say({ kind: 'error', text: ops.writeFailure(err).message });
      }
    },
    applyBeatLength: async (beat, plan) => {
      if (String(plan.for_edit_revision) !== String(editRef.current?.edit_revision)) {
        setBeatPlan(null);
        editor.say({ kind: 'error', text: 'The edit changed after that preview, so nothing was applied. Preview the change again.' });
        return;
      }
      const stored = edit.data.edit.beatDurations?.[beat.beat] ?? null;
      const ok = await editor.run(ops.setBeatDuration(beat.beat, plan.requested_ms, stored));
      if (ok) setBeatPlan(null);
    },
    clearPlan: () => setBeatPlan(null),
    unlockBeat: (beat) => editor.run(ops.setBeatDuration(beat.beat, null, edit.data.edit.beatDurations?.[beat.beat] ?? null)),
    lockTiming: () => {
      if (window.confirm('Lock timing for all 14 beats? Each beat keeps the length it has now, so changing a clip later never moves anything after it. This is not undone with Undo.')) editor.run(ops.lockTiming());
    },
  };

  const saveDraft = async () => {
    const name = window.prompt('Name this draft', `Draft ${new Date().toLocaleString()}`);
    if (!name || !name.trim()) return;
    await editor.once('Save Draft', () => episodeEditApi.write(episodeId, { method: 'post', path: '/versions', body: { name: name.trim() } }, editRef.current?.edit_revision));
    setVersions(null);
  };
  const openVersions = async () => {
    try {
      setVersions(await episodeEditApi.versions(episodeId));
    } catch (err) {
      console.error('[EpisodeEditor] versions failed:', err?.message);
      editor.say({ kind: 'error', text: 'The saved drafts could not be listed.' });
    }
  };
  const restore = async (v) => {
    setMenuOpen(false);
    if (!window.confirm(`Restore “${v.name}”? The edit goes back to that draft as a new revision. Undo can't take a restore back, so save a draft first if you may want to return.`)) return;
    const ok = await editor.run(ops.restoreVersion(v));
    if (ok) editor.resetHistory();
  };

  const focus = (beat) => {
    if (focusBeat === beat) { setFocusBeat(null); return; }
    setFocusBeat(beat);
    setSelectedId(null);
    const b = model.beats.find((x) => x.beat === beat);
    if (!b) return;
    seek(b.start);
    if (b.end > b.start) {
      const width = (scrollRef.current?.clientWidth || 1000) - 40;
      const px = clamp(width / (b.end - b.start), MIN_PX_PER_MS, MAX_PX_PER_MS);
      setPxPerMs(px);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, b.start * px - 20); });
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) editor.redo(); else editor.undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); editor.redo(); return; }
      if (mod && (e.key === 'c' || e.key === 'C') && selected) { e.preventDefault(); copyBlock(selected); return; }
      if (mod && (e.key === 'x' || e.key === 'X') && selected) { e.preventDefault(); copyBlock(selected, true); return; }
      if (mod && (e.key === 'v' || e.key === 'V') && clipboard) { e.preventDefault(); paste(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteBlock(selected); return; }
      if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); player.toggle(); }
      else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); player.pause(); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); if (player.playing) player.faster(); else player.play(); }
      else if (e.key === 'j' || e.key === 'J') { e.preventDefault(); seek(playhead - 5000); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(playhead - (e.shiftKey ? 1000 : FRAME_MS)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(playhead + (e.shiftKey ? 1000 : FRAME_MS)); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if (e.key === 'End') { e.preventDefault(); seek(model?.duration || 0); }
      else if (e.key === 'Escape') { setSelectedId(null); setMenuOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playhead, seek, model, player, editor, selected, clipboard, copyBlock, paste, deleteBlock]);

  // ── Whole-page states ───────────────────────────────────────────────
  if (edit.loading) {
    return <div className="tle tle-full"><p className="tle-full-card" aria-busy="true">Opening the editor…</p></div>;
  }
  if (edit.error) {
    const why = readFailure(edit.error);
    if (why.kind === 'off') {
      return (
        <FullPage title="The episode edit is switched off" episodeId={episodeId}>
          <p>This editor works on the episode edit (C1), which is switched off on this server (<code>EPISODE_EDIT</code>). Nothing was changed.</p>
          <p>Turning it on is a server setting; nothing else is needed.</p>
        </FullPage>
      );
    }
    return <FullPage title={why.kind === 'not_found' ? 'Episode not found' : 'The editor could not be opened'} episodeId={episodeId}><p>{why.message}</p></FullPage>;
  }

  const ep = episode.data;
  const counts = findings.data?.counts;
  const px = pxPerMs || 0.05;
  const zoomSlider = Math.round(((Math.log(px) - Math.log(MIN_PX_PER_MS)) / (Math.log(MAX_PX_PER_MS) - Math.log(MIN_PX_PER_MS))) * 100);
  const setZoomFromSlider = (v) => setPxPerMs(Math.exp(Math.log(MIN_PX_PER_MS) + (v / 100) * (Math.log(MAX_PX_PER_MS) - Math.log(MIN_PX_PER_MS))));
  const height = bodyRef.current?.clientHeight || 800;

  return (
    <div className="tle" style={{ '--tle-left': `${leftW}px`, '--tle-right': `${rightW}px`, '--tle-upper': upper }}>
      <header className="tle-top">
        <nav className="tle-crumbs" aria-label="Breadcrumb">
          <Link to={`/episodes/${episodeId}?tab=edit`} className="tle-icon-btn" aria-label="Back to the episode" title="Back to the episode's Edit pill"><ArrowLeft size={18} /></Link>
          <Link to={ep?.show_id ? `/shows/${ep.show_id}` : '/shows'}>Episodes</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link to={`/episodes/${episodeId}`}>{ep?.episode_number ? `Episode ${ep.episode_number}` : 'Episode'}</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="tle-crumb-here" aria-current="page">Editor</span>
        </nav>
        <div className="tle-top-actions">
          <button type="button" className="tle-btn" onClick={saveDraft} disabled={!editable} title="Save the edit as a named draft you can restore"><Save size={16} aria-hidden="true" /> Save Draft</button>
          <button type="button" className="tle-btn" disabled aria-disabled="true" title={PENDING.render} aria-label={`Preview Render (${PENDING.render})`}><MonitorPlay size={16} aria-hidden="true" /> Preview Render</button>
          <button type="button" className="tle-btn tle-btn-primary" disabled aria-disabled="true" title={PENDING.render} aria-label={`Export Video (${PENDING.render})`}><Upload size={16} aria-hidden="true" /> Export Video</button>
          <div className="tle-menu-wrap">
            <button type="button" className="tle-btn tle-btn-square" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More" onClick={() => { setMenuOpen((o) => !o); setVersions(null); }}><MoreVertical size={16} /></button>
            {menuOpen && (
              <div className="tle-menu" role="menu">
                {versions == null
                  ? <button type="button" role="menuitem" onClick={openVersions}>Saved drafts…</button>
                  : (
                    <div className="tle-menu-versions" role="group" aria-label="Saved drafts">
                      {!versions.length && <p className="tle-muted">No saved drafts yet.</p>}
                      {versions.map((v) => (
                        <button key={v.id} type="button" role="menuitem" onClick={() => restore(v)} title={`Saved at revision ${v.edit_revision}`}>
                          Restore “{v.name}” <span className="tle-muted">{new Date(v.created_at).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                <button type="button" role="menuitem" onClick={() => { setUpper(0.62); setMenuOpen(false); }}>Layout: preview focus</button>
                <button type="button" role="menuitem" onClick={() => { setUpper(0.36); setMenuOpen(false); }}>Layout: timeline focus</button>
                <button type="button" role="menuitem" onClick={() => { resetLeft(); resetRight(); resetUpper(); setMenuOpen(false); }}>Reset layout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="tle-titlebar">
        <h1 className="tle-title">{ep?.episode_number ? `Episode ${ep.episode_number}: ` : ''}{ep?.title || (episode.loading ? '…' : 'Untitled episode')}</h1>
        <Link to={`/episodes/${episodeId}/edit`} className="tle-icon-btn" aria-label="Edit details" title="Edit details"><Pencil size={15} /></Link>
        <span className={`tle-pill${editor.busy ? ' is-busy' : ''}`} role="status" aria-live="polite">
          {editor.busy ? 'Saving…' : editor.lastSaved ? `Saved · ${editor.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Draft'}
        </span>
        <span className="tle-muted" title="Every change is saved when it is made">Edit revision {edit.data.edit_revision}</span>
        {counts && <span className={`tle-counts${counts.blocking ? ' is-blocked' : ''}`}>{counts.blocking} blocking · {counts.warning} {counts.warning === 1 ? 'warning' : 'warnings'}</span>}
        {findings.error && <span className="tle-counts is-blocked" role="status">Findings could not be loaded: {messageOf(findings.error)}</span>}
        {edit.data && !admin && (
          <span className="tle-notice is-info" role="status" data-testid="editor-read-only">Read only: editing needs an admin account.</span>
        )}
        {editor.notice && (
          <span className={`tle-notice is-${editor.notice.kind}`} role={editor.notice.kind === 'error' ? 'alert' : 'status'} data-testid="editor-notice">
            {editor.notice.text}
            {editor.notice.action && (
              <button type="button" className="tle-notice-action" onClick={editor.notice.action.run} data-testid="editor-notice-action">{editor.notice.action.label}</button>
            )}
            <button type="button" className="tle-icon-btn" onClick={editor.clearNotice} aria-label="Dismiss"><X size={13} /></button>
          </span>
        )}
      </div>

      <div className="tle-body" ref={bodyRef}>
        <div className="tle-upper">
          <AssetBrowser episodeId={episodeId} rawClips={{ ...rawClips, error: messageOf(rawClips.error) }} sceneSets={{ ...sceneSets, error: messageOf(sceneSets.error) }}
            takes={{ ...takes, error: messageOf(takes.error) }} sources={{ ...sources, error: messageOf(sources.error) }} placedAngles={placedAngles} focusBeat={focusBeat}
            editable={editable} onPlace={(asset) => placeAsset(asset, playhead)} onDragAsset={setDraggingAsset} />
          <div className="tle-split-v" role="separator" aria-orientation="vertical" aria-label="Resize the media panel" onPointerDown={(e) => dragLeft(e, { axis: 'x' })} onDoubleClick={resetLeft} />
          <EditorPreview frame={frame} duration={model.duration} selectedId={selectedId} onSelect={setSelectedId} onPrevEdit={prevEdit} onNextEdit={nextEdit} hidden={hidden}
            playing={player.playing} rate={player.rate} onToggle={player.toggle} volume={volume} onVolume={setVolume}
            muted={previewMuted} onMute={() => setPreviewMuted((m) => !m)} sounds={sounds} failedVideo={failedVideo} onVideoFailed={onVideoFailed}
            editable={editable} primeLocked={laneLocked('prime')} onLayoutDrag={setLiveLayout}
            locked={{ performer: laneLocked('performer'), captions: laneLocked('captions') }}
            onLayoutCommit={(id, layout) => {
              const b = allBlocks.find((x) => x.id === id);
              if (!b) return;
              // A drag moves and resizes; the stored opacity stays.
              const stored = b.kind === 'segment' ? b.row?.layout : b.row?.values?.layout;
              const next = stored?.opacity != null ? { ...layout, opacity: stored.opacity } : layout;
              if (b.kind === 'segment') act.layout(b, next); else act.itemLayout(b, next);
            }} />
          <div className="tle-split-v" role="separator" aria-orientation="vertical" aria-label="Resize the inspector" onPointerDown={(e) => dragRight(e, { axis: 'x', sign: -1 })} onDoubleClick={resetRight} />
          <EditorInspector block={selected} beat={cardBeat} readiness={readiness?.beats.find((r) => r.beat === cardBeat?.beat)}
            editable={canEdit} saving={editor.busy} act={act} liveLayout={liveLayout} beatPlan={beatPlan} pipHidden={pipHiddenRule}
            modeMarks={model.modeMarks} playhead={playhead} c1b={c1b} />
        </div>

        <div className="tle-split-h" role="separator" aria-orientation="horizontal" aria-label="Resize the preview and the timeline"
          onPointerDown={(e) => dragUpper(e, { axis: 'y', scale: 1 / height })} onDoubleClick={resetUpper} />

        <div className="tle-lower">
          <div className="tle-toolbar" role="toolbar" aria-label="Edit">
            <div className="tle-toolbar-group">
              <button type="button" className="tle-btn" onClick={editor.undo} disabled={!editable || !editor.canUndo} title={editor.undoLabel ? `${editor.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}><Undo2 size={16} aria-hidden="true" /> Undo</button>
              <button type="button" className="tle-btn" onClick={editor.redo} disabled={!editable || !editor.canRedo} title={editor.redoLabel ? `${editor.redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}><Redo2 size={16} aria-hidden="true" /> Redo</button>
              <span className="tle-toolbar-sep" aria-hidden="true" />
              <button type="button" className="tle-btn" onClick={() => splitAtPlayhead(selected)} disabled={!editable || !selected || !['segment', 'scene_clip'].includes(segmentOf(selected).kind)} title="Split the selected Prime segment or scene clip at the playhead"><SquareSplitHorizontal size={16} aria-hidden="true" /> Split</button>
              <button type="button" className="tle-btn" onClick={() => copyBlock(selected, true)} disabled={!editable || !selected || selected.kind === 'dialogue'} title="Cut (Ctrl+X)"><Scissors size={16} aria-hidden="true" /> Cut</button>
              <button type="button" className="tle-btn" onClick={() => copyBlock(selected)} disabled={!selected || selected.kind === 'dialogue'} title="Copy (Ctrl+C)"><Copy size={16} aria-hidden="true" /> Copy</button>
              <button type="button" className="tle-btn" onClick={paste} disabled={!editable || !clipboard} title={clipboard ? `Paste ${clipboard.label} at the playhead (Ctrl+V)` : 'Copy something first'}><ClipboardPaste size={16} aria-hidden="true" /> Paste</button>
              <button type="button" className="tle-btn" onClick={() => deleteBlock(selected)} disabled={!editable || !selected} title="Delete (Del)"><Trash2 size={16} aria-hidden="true" /> Delete</button>
              <span className="tle-toolbar-note">{editor.busy ? 'Saving…' : 'Every change is saved when it is made'}</span>
            </div>
            <div className="tle-toolbar-group">
              {focusBeat != null && (
                <button type="button" className="tle-btn" onClick={() => { setFocusBeat(null); fitTo(model.duration); }}><X size={14} aria-hidden="true" /> Leave beat {focusBeat}</button>
              )}
              <span className="tle-icon-btn is-off" title="Times snap to whole frames. Snapping to other clips' edges is not built yet." aria-hidden="true"><Magnet size={16} /></span>
              <button type="button" className="tle-icon-btn" onClick={() => setPxPerMs((p) => clamp((p || px) / 1.5, MIN_PX_PER_MS, MAX_PX_PER_MS))} aria-label="Zoom out"><ZoomOut size={17} /></button>
              <input type="range" className="tle-zoom" min="0" max="100" value={zoomSlider} onChange={(e) => setZoomFromSlider(Number(e.target.value))} aria-label="Timeline zoom" />
              <button type="button" className="tle-icon-btn" onClick={() => setPxPerMs((p) => clamp((p || px) * 1.5, MIN_PX_PER_MS, MAX_PX_PER_MS))} aria-label="Zoom in"><ZoomIn size={17} /></button>
              <button type="button" className="tle-btn" onClick={() => { setFocusBeat(null); fitTo(model.duration); }}><Maximize2 size={15} aria-hidden="true" /> Fit to Timeline</button>
            </div>
          </div>

          <BeatRail beats={model.beats} readiness={readiness} focusBeat={focusBeat} onFocus={focus} collapsed={railCollapsed}
            onToggle={() => setRailCollapsed((c) => { writeStored('tle-rail-collapsed', !c); return !c; })} />

          {model.duration === 0 && (
            <p className="tle-tl-empty" data-testid="timeline-empty">
              No beat has a length yet: the edit has no scene clips. Drag a scene or a clip from the media panel onto the Scene lane, or use its + to place it at the playhead.
            </p>
          )}
          <EditorTimeline model={model} pxPerMs={px} playhead={playhead} onSeek={seek} selectedId={selectedId} onSelect={setSelectedId}
            view={view} onToggleView={toggleView} scrollRef={scrollRef} labelWidth={LABEL_W}
            editable={editable} onMoveBlock={moveBlock} onTrimBlock={trimBlock} draggingAsset={draggingAsset}
            onDropAsset={(lane, asset, t) => { setDraggingAsset(null); if (asset) placeAsset(asset, t, lane); }} />
          <p className="tle-desktop-only">The multitrack timeline is desktop only. Review the beats above.</p>
        </div>
      </div>
    </div>
  );
}
