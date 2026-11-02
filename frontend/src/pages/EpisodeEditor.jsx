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
 * What is not built yet is shown disabled with what unlocks it: editing (P3),
 * render and export (the render host, Gates 3–6), and the
 * performer, phone, gameplay, overlay and caption lanes (Gate 2). The legacy
 * Timeline Editor (/episodes/:id/timeline) stays until this one passes
 * testing (ruling 14).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

/** A read's state: { loading, data, error }. */
function useRead(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: null });
    fn().then(
      (data) => { if (live) setState({ loading: false, data, error: null }); },
      (err) => {
        console.error('[EpisodeEditor] read failed:', err?.message);
        if (live) setState({ loading: false, data: null, error: err });
      },
    );
    return () => { live = false; };
  }, deps);
  return state;
}

const messageOf = (err) => (err ? readFailure(err).message : null);

const PENDING = {
  edit: 'Editing arrives in P3',
  render: 'Pending: the render host (Gates 3–6)',
  draft: 'Save Draft (a named checkpoint) arrives with editing in P3',
};

function FullPage({ title, children, episodeId }) {
  return (
    <div className="tle tle-full" role="alert">
      <div className="tle-full-card">
        <h1>{title}</h1>
        {children}
        <p className="tle-full-links">
          {episodeId && <Link to={`/episodes/${episodeId}`}>← Back to the episode</Link>}
          {episodeId && <Link to={`/episodes/${episodeId}/timeline`}>Open the legacy Timeline Editor</Link>}
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

  const media = useMemo(() => mediaIndex({ rawClips: rawClips.data || [], sceneSets: sceneSets.data || [], takes: takes.data?.takes || [] }),
    [rawClips.data, sceneSets.data, takes.data]);
  const model = useMemo(() => (edit.data ? buildTimeline(edit.data.edit, media) : null), [edit.data, media]);
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
  const selected = allBlocks.find((b) => b.id === selectedId) || null;
  const beatAt = model ? (model.beats.find((b) => playhead >= b.start && playhead < b.end)
    || (playhead >= model.duration ? [...model.beats].reverse().find((b) => b.end > b.start) : null)) : null;
  const cardBeat = focusBeat != null ? model?.beats.find((b) => b.beat === focusBeat) : beatAt;
  const frame = useMemo(() => (edit.data ? framePlan(edit.data.edit, playhead, media) : null), [edit.data, playhead, media]);
  const hidden = { scene: view.scene?.hidden, prime: view.prime?.hidden };

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
  }, [playhead, seek, model, player]);

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
          <p>The legacy Timeline Editor is still available.</p>
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
          <Link to={`/episodes/${episodeId}`} className="tle-icon-btn" aria-label="Back to the episode"><ArrowLeft size={18} /></Link>
          <Link to={ep?.show_id ? `/shows/${ep.show_id}` : '/shows'}>Episodes</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link to={`/episodes/${episodeId}`}>{ep?.episode_number ? `Episode ${ep.episode_number}` : 'Episode'}</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="tle-crumb-here" aria-current="page">Editor</span>
        </nav>
        <div className="tle-top-actions">
          <button type="button" className="tle-btn" disabled aria-disabled="true" title={PENDING.draft} aria-label={`Save Draft (${PENDING.draft})`}><Save size={16} aria-hidden="true" /> Save Draft</button>
          <button type="button" className="tle-btn" disabled aria-disabled="true" title={PENDING.render} aria-label={`Preview Render (${PENDING.render})`}><MonitorPlay size={16} aria-hidden="true" /> Preview Render</button>
          <button type="button" className="tle-btn tle-btn-primary" disabled aria-disabled="true" title={PENDING.render} aria-label={`Export Video (${PENDING.render})`}><Upload size={16} aria-hidden="true" /> Export Video</button>
          <div className="tle-menu-wrap">
            <button type="button" className="tle-btn tle-btn-square" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More" onClick={() => setMenuOpen((o) => !o)}><MoreVertical size={16} /></button>
            {menuOpen && (
              <div className="tle-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setUpper(0.62); setMenuOpen(false); }}>Layout: preview focus</button>
                <button type="button" role="menuitem" onClick={() => { setUpper(0.36); setMenuOpen(false); }}>Layout: timeline focus</button>
                <button type="button" role="menuitem" onClick={() => { resetLeft(); resetRight(); resetUpper(); setMenuOpen(false); }}>Reset layout</button>
                <Link role="menuitem" to={`/episodes/${episodeId}/timeline`}>Open the legacy Timeline Editor</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="tle-titlebar">
        <h1 className="tle-title">{ep?.episode_number ? `Episode ${ep.episode_number}: ` : ''}{ep?.title || (episode.loading ? '…' : 'Untitled episode')}</h1>
        <Link to={`/episodes/${episodeId}/edit`} className="tle-icon-btn" aria-label="Edit details" title="Edit details"><Pencil size={15} /></Link>
        <span className="tle-pill" title="P1 reads the edit; editing arrives in P3">Read only</span>
        <span className="tle-muted">Edit revision {edit.data.edit_revision}</span>
        {counts && <span className={`tle-counts${counts.blocking ? ' is-blocked' : ''}`}>{counts.blocking} blocking · {counts.warning} {counts.warning === 1 ? 'warning' : 'warnings'}</span>}
        {findings.error && <span className="tle-counts is-blocked" role="status">Findings could not be loaded: {messageOf(findings.error)}</span>}
      </div>

      <div className="tle-body" ref={bodyRef}>
        <div className="tle-upper">
          <AssetBrowser episodeId={episodeId} rawClips={{ ...rawClips, error: messageOf(rawClips.error) }} sceneSets={{ ...sceneSets, error: messageOf(sceneSets.error) }}
            takes={{ ...takes, error: messageOf(takes.error) }} focusBeat={focusBeat} />
          <div className="tle-split-v" role="separator" aria-orientation="vertical" aria-label="Resize the media panel" onPointerDown={(e) => dragLeft(e, { axis: 'x' })} onDoubleClick={resetLeft} />
          <EditorPreview frame={frame} duration={model.duration} selectedId={selectedId} onSelect={setSelectedId} onPrevEdit={prevEdit} onNextEdit={nextEdit} hidden={hidden}
            playing={player.playing} rate={player.rate} onToggle={player.toggle} volume={volume} onVolume={setVolume}
            muted={previewMuted} onMute={() => setPreviewMuted((m) => !m)} sounds={sounds} failedVideo={failedVideo} onVideoFailed={onVideoFailed} />
          <div className="tle-split-v" role="separator" aria-orientation="vertical" aria-label="Resize the inspector" onPointerDown={(e) => dragRight(e, { axis: 'x', sign: -1 })} onDoubleClick={resetRight} />
          <EditorInspector block={selected} beat={cardBeat} readiness={readiness?.beats.find((r) => r.beat === cardBeat?.beat)} />
        </div>

        <div className="tle-split-h" role="separator" aria-orientation="horizontal" aria-label="Resize the preview and the timeline"
          onPointerDown={(e) => dragUpper(e, { axis: 'y', scale: 1 / height })} onDoubleClick={resetUpper} />

        <div className="tle-lower">
          <div className="tle-toolbar" role="toolbar" aria-label="Edit">
            <div className="tle-toolbar-group">
              {[[Undo2, 'Undo'], [Redo2, 'Redo']].map(([Icon, label]) => (
                <button key={label} type="button" className="tle-btn" disabled aria-disabled="true" title={PENDING.edit} aria-label={`${label} (${PENDING.edit})`}><Icon size={16} aria-hidden="true" /> {label}</button>
              ))}
              <span className="tle-toolbar-sep" aria-hidden="true" />
              {[[SquareSplitHorizontal, 'Split'], [Scissors, 'Cut'], [Copy, 'Copy'], [ClipboardPaste, 'Paste'], [Trash2, 'Delete']].map(([Icon, label]) => (
                <button key={label} type="button" className="tle-btn" disabled aria-disabled="true" title={PENDING.edit} aria-label={`${label} (${PENDING.edit})`}><Icon size={16} aria-hidden="true" /> {label}</button>
              ))}
              <span className="tle-toolbar-note">Read only · {PENDING.edit}</span>
            </div>
            <div className="tle-toolbar-group">
              {focusBeat != null && (
                <button type="button" className="tle-btn" onClick={() => { setFocusBeat(null); fitTo(model.duration); }}><X size={14} aria-hidden="true" /> Leave beat {focusBeat}</button>
              )}
              <span className="tle-icon-btn is-off" title={`Snap: ${PENDING.edit}`} aria-hidden="true"><Magnet size={16} /></span>
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
              No beat has a length yet: the edit has no scene clips. Placing clips arrives with editing (P3); nothing is invented in their place.
            </p>
          )}
          <EditorTimeline model={model} pxPerMs={px} playhead={playhead} onSeek={seek} selectedId={selectedId} onSelect={setSelectedId}
            view={view} onToggleView={toggleView} scrollRef={scrollRef} labelWidth={LABEL_W} />
          <p className="tle-desktop-only">The multitrack timeline is desktop only. Review the beats above.</p>
        </div>
      </div>
    </div>
  );
}
