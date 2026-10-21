/**
 * Templates › YouTube thumbnails (Evoni, 2026-10-17): make an episode's
 * 1280x720 YouTube thumbnail. Pick the show and the episode; the title, the
 * show's name and "EP n" fill in.
 *
 * The thumbnail is layers (2026-10-21: "make my images bigger or smaller
 * and move things so I can have them at different angles"): drag any of
 * them, pull a corner to resize, turn it with the handle above it. The
 * layout buttons are starting arrangements; the layers list hides, orders
 * and removes; words and pictures can be added. The pictures are in
 * folders: Scene sets, Character poses (Lala, JustAWoman › Front, Back,
 * Side, Glamour; Lala's starred pose picked first), This episode's outfit,
 * Asset library, Documents, and this session's Uploads.
 *
 * What is arranged on an episode stays with it (kept as it changes, a
 * draft); Save as show template makes it where every episode starts.
 * The server draws the saved file from the same layers ("See it exactly").
 *
 * ?show= and ?episode= open it on an episode (Production's Thumbnail step).
 *
 * The one place an episode's thumbnail is edited (Evoni, 2026-10-20): the
 * episode's saved thumbnails are listed under the editor, its current one
 * first; any of them can be made the episode's thumbnail again, and one
 * that is not current can be deleted. Every other page links here
 * (thumbnailStudioHref); /thumbnails/:episodeId redirects here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Youtube, Upload, Download, Save, Palette, ImageOff, Check, LayoutTemplate, Sparkles, Star, Trash2, History, Folder, ChevronRight,
  Eye, EyeOff, ArrowUp, ArrowDown, Type, RotateCcw, ScanEye, X, Lock, LockOpen, Copy, Undo2, Redo2,
} from 'lucide-react';
import {
  youtubeThumbnailsApi, LAYOUTS, ACCENTS, TEXT_COLORS, episodeWords, defaultPose, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import {
  FONTS, presetLayers, fillTemplate, applyStyle, setRoleContent, layerOf, updateLayer, moveLayer, removeLayer,
  addText, addPicture, layerName, loadThumbnailFonts, OUTLINE, duplicateLayer, WIDTH, HEIGHT,
} from '../lib/thumbnailLayers';
import ThumbnailCanvas from '../components/Thumbnails/ThumbnailCanvas';
import './YouTubeThumbnailStudio.css';

const DRAFT_DELAY_MS = 1200;
// Changes this close together are one step to undo (typing a word, a slider).
const UNDO_GROUP_MS = 600;
const UNDO_STEPS = 50;

function PickButton({ it, value, onPick }) {
  return (
    <button type="button" className={`yts-pick${value === it.url ? ' is-on' : ''}`} aria-pressed={value === it.url}
      onClick={() => onPick(it.url, it.label)} title={it.label}>
      <img src={it.url} alt={it.label || ''} loading="lazy" />
    </button>
  );
}

/**
 * A picture picker in folders (Evoni, 2026-10-21): None and Upload, where
 * it is ("All folders › Character poses › Lala"), the folders here, and the
 * pictures here. It opens in the first of `start` that has pictures (the
 * background in Scene sets, Lala in her poses); any folder is a click away.
 * Without onNone there is no None button (adding a picture).
 */
function FolderPicker({ title, tree, start, value, onPick, onUpload, uploading = false, onNone, noneLabel, testid, whole = false }) {
  const inputRef = useRef(null);
  const startKey = firstFolder(tree, start);
  const [at, setAt] = useState(startKey);
  useEffect(() => { setAt(startKey); }, [startKey]);
  const path = folderPath(tree, at);
  const here = path.at(-1) || null;
  const folders = here ? (here.folders || []) : (tree || []);
  const items = here?.items || [];
  const grid = `yts-grid${whole ? ' is-whole' : ''}`;
  return (
    <fieldset className="yts-field" data-testid={testid}>
      <legend className="yts-label">{title}</legend>
      <div className={grid}>
        {onNone && (
          <button type="button" className={`yts-pick is-none${!value ? ' is-on' : ''}`} aria-pressed={!value} onClick={onNone}>
            <ImageOff size={18} aria-hidden /><span>{noneLabel}</span>
          </button>
        )}
        <button type="button" className="yts-pick is-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload size={18} aria-hidden /><span>{uploading ? 'Uploading…' : 'Upload'}</span>
        </button>
      </div>
      <nav className="yts-crumbs" aria-label={`${title}: where you are`} data-testid={`${testid}-crumbs`}>
        <button type="button" onClick={() => setAt(null)} aria-current={here ? undefined : 'location'}>All folders</button>
        {path.map((f) => (
          <React.Fragment key={f.key}>
            <ChevronRight size={12} aria-hidden />
            <button type="button" onClick={() => setAt(f.key)} aria-current={f === here ? 'location' : undefined}>{f.label}</button>
          </React.Fragment>
        ))}
      </nav>
      {folders.length > 0 && (
        <div className="yts-folders">
          {folders.map((f) => {
            const cover = folderCover(f);
            const n = folderCount(f);
            return (
              <button key={f.key} type="button" className="yts-folder" onClick={() => setAt(f.key)} data-testid={`${testid}-folder-${f.key}`}
                aria-label={`${f.label}, ${n} ${n === 1 ? 'picture' : 'pictures'}`}>
                <span className="yts-folder-art">{cover ? <img src={cover} alt="" loading="lazy" /> : <Folder size={20} aria-hidden />}</span>
                <span className="yts-folder-name"><Folder size={12} aria-hidden /> {f.label}</span>
                <span className="yts-folder-count" aria-hidden>{n} {n === 1 ? 'picture' : 'pictures'}</span>
              </button>
            );
          })}
        </div>
      )}
      {items.length > 0 && (
        <div className={grid} data-testid={`${testid}-pictures`}>
          {items.map((it) => <PickButton key={it.url} it={it} value={value} onPick={onPick} />)}
        </div>
      )}
      {!folders.length && !items.length && <p className="yts-note">No pictures yet. Upload one.</p>}
      <input ref={inputRef} type="file" accept="image/*" hidden data-testid={`${testid}-input`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </fieldset>
  );
}

/** The picked layer's own settings: words, font and colour; or a picture's fit and frame; and its turn. */
function LayerSettings({ layer, onChange }) {
  if (!layer || layer.kind === 'shade') return null;
  return (
    <fieldset className="yts-field yts-layer-settings" data-testid="yts-layer-settings">
      <legend className="yts-label">{layerName(layer)}</legend>
      {(layer.kind === 'text' || layer.kind === 'badge') && (
        <input className="yts-input" value={layer.text} maxLength={layer.kind === 'badge' ? 16 : 160}
          onChange={(e) => onChange({ text: e.target.value })} aria-label={`${layerName(layer)} words`} />
      )}
      {layer.kind === 'text' && (
        <div className="yts-row">
          <label className="yts-field">
            <span className="yts-label">Font</span>
            <select className="yts-input" value={layer.font} onChange={(e) => onChange({ font: e.target.value })} aria-label="Font">
              {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </select>
          </label>
          <label className="yts-field is-small">
            <span className="yts-label">Colour</span>
            <input type="color" className="yts-color" value={layer.color} onChange={(e) => onChange({ color: e.target.value.toUpperCase() })} aria-label="Words colour" />
          </label>
          <label className="yts-field is-small">
            <span className="yts-label">Outline</span>
            <input type="checkbox" checked={Boolean(layer.stroke)} onChange={(e) => onChange({ stroke: e.target.checked ? OUTLINE : null })} aria-label="Outline the words" />
          </label>
        </div>
      )}
      {layer.kind === 'image' && layer.role !== 'background' && (
        <div className="yts-row">
          <label className="yts-field">
            <span className="yts-label">Frame</span>
            <select className="yts-input" value={layer.frame} onChange={(e) => onChange({ frame: e.target.value })} aria-label="Frame">
              <option value="none">None</option>
              <option value="polaroid">Photo card</option>
            </select>
          </label>
          <label className="yts-field">
            <span className="yts-label">Fit</span>
            <select className="yts-input" value={layer.fit} onChange={(e) => onChange({ fit: e.target.value })} aria-label="Fit">
              <option value="contain">Whole picture</option>
              <option value="cover">Fill the box</option>
            </select>
          </label>
        </div>
      )}
      <div className="yts-row yts-box-fields">
        {[['x', 'Left', -WIDTH, WIDTH * 2], ['y', 'Top', -HEIGHT, HEIGHT * 2], ['w', 'Width', 10, WIDTH * 3], ['h', 'Height', 10, HEIGHT * 3]].map(([key, label, min, max]) => (
          <label key={key} className="yts-field is-small">
            <span className="yts-label">{label}</span>
            <input type="number" className="yts-input" value={Math.round(layer[key])} min={min} max={max} disabled={layer.locked}
              onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange({ [key]: Math.min(max, Math.max(min, Math.round(n))) }); }}
              aria-label={`${label} (points)`} />
          </label>
        ))}
      </div>
      <label className="yts-field">
        <span className="yts-label">Turn ({Math.round(layer.rotation)}°)</span>
        <input type="range" min="-180" max="180" step="1" value={layer.rotation} onChange={(e) => onChange({ rotation: Number(e.target.value) })} aria-label="Turn" disabled={layer.locked} />
      </label>
    </fieldset>
  );
}

/** The layers, front first: pick, hide or show, lock, copy, move forward or back, remove. */
function LayersList({ spec, selectedId, onSelect, onChange, onDuplicate }) {
  const front = [...(spec?.layers || [])].reverse();
  return (
    <fieldset className="yts-field" data-testid="yts-layers">
      <legend className="yts-label">Layers</legend>
      <ul className="yts-layers">
        {front.map((l, i) => (
          <li key={l.id} className={`yts-layer${l.id === selectedId ? ' is-on' : ''}${l.visible ? '' : ' is-hidden'}`}>
            <button type="button" className="yts-layer-name" onClick={() => onSelect(l.kind === 'shade' ? null : l.id)} aria-pressed={l.id === selectedId}>
              {layerName(l)}
            </button>
            <button type="button" className="yts-icon-btn" onClick={() => onChange(updateLayer(spec, l.id, { visible: !l.visible }))}
              aria-label={`${l.visible ? 'Hide' : 'Show'} ${layerName(l)}`} title={l.visible ? 'Hide' : 'Show'}>
              {l.visible ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
            </button>
            {l.kind !== 'shade' && (
              <button type="button" className={`yts-icon-btn${l.locked ? ' is-on' : ''}`} onClick={() => onChange(updateLayer(spec, l.id, { locked: !l.locked }))}
                aria-pressed={Boolean(l.locked)} aria-label={`${l.locked ? 'Unlock' : 'Lock'} ${layerName(l)}`} title={l.locked ? 'Unlock' : 'Lock'}>
                {l.locked ? <Lock size={15} aria-hidden /> : <LockOpen size={15} aria-hidden />}
              </button>
            )}
            {l.kind !== 'shade' && (
              <button type="button" className="yts-icon-btn" onClick={() => onDuplicate(l.id)}
                aria-label={`Copy ${layerName(l)}`} title="Copy"><Copy size={15} aria-hidden /></button>
            )}
            <button type="button" className="yts-icon-btn" onClick={() => onChange(moveLayer(spec, l.id, 'up'))} disabled={i === 0}
              aria-label={`Bring ${layerName(l)} forward`} title="Forward"><ArrowUp size={15} aria-hidden /></button>
            <button type="button" className="yts-icon-btn" onClick={() => onChange(moveLayer(spec, l.id, 'down'))} disabled={i === front.length - 1}
              aria-label={`Send ${layerName(l)} back`} title="Back"><ArrowDown size={15} aria-hidden /></button>
            <button type="button" className="yts-icon-btn is-danger" onClick={() => { if (l.id === selectedId) onSelect(null); onChange(removeLayer(spec, l.id)); }}
              aria-label={`Remove ${layerName(l)}`} title="Remove"><Trash2 size={15} aria-hidden /></button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** What a role shows now (for the controls). */
const roleText = (spec, role) => layerOf(spec, role)?.text || '';
const roleSrc = (spec, role) => layerOf(spec, role)?.src || null;

/** A head-to-toe pose for Come Style Me's full outfit: her back pose, else her front; not the main one. */
function outfitPose(poses, mainUrl) {
  for (const pose of ['back', 'front', 'side']) {
    const list = (poses || []).filter((p) => p.pose === pose && p.url !== mainUrl);
    const pick = list.find((p) => p.isDefault) || list[0];
    if (pick) return pick.url;
  }
  return null;
}

/** The checklist's rows: a tick and a few words each; add one (six at most), remove one. */
function ChecklistEditor({ layer, onChange }) {
  const items = layer.items || [];
  const set = (i, patch) => onChange({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <fieldset className="yts-field" data-testid="yts-checklist">
      <legend className="yts-label">Checklist</legend>
      <ul className="yts-checklist">
        {items.map((it, i) => (
          <li key={i}>
            <input type="checkbox" checked={it.checked} onChange={(e) => set(i, { checked: e.target.checked })} aria-label={`Tick ${it.text || `row ${i + 1}`}`} />
            <input className="yts-input" value={it.text} maxLength={40} onChange={(e) => set(i, { text: e.target.value })} aria-label={`Checklist row ${i + 1}`} />
            <button type="button" className="yts-icon-btn is-danger" onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}
              aria-label={`Remove checklist row ${i + 1}`} title="Remove"><Trash2 size={15} aria-hidden /></button>
          </li>
        ))}
      </ul>
      {items.length < 6 && (
        <button type="button" className="yts-btn" onClick={() => onChange({ items: [...items, { text: 'New', checked: true }] })}>Add a row</button>
      )}
    </fieldset>
  );
}

export default function YouTubeThumbnailStudio() {
  const [params, setParams] = useSearchParams();
  const [shows, setShows] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [showId, setShowId] = useState(params.get('show') || '');
  const [episodeId, setEpisodeId] = useState(params.get('episode') || '');
  const [sources, setSources] = useState(null);
  const [spec, setSpecState] = useState(null);
  const [look, setLook] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(null);
  const [exact, setExact] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [draftNote, setDraftNote] = useState(null);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const [fontsTick, setFontsTick] = useState(0);
  const edited = useRef(false);
  // The layers as they are now (an upload adds to them after its await).
  const specRef = useRef(null);
  specRef.current = spec;
  // Undo and redo (Evoni, 2026-10-21): the arrangements before and after
  // this one; changes close together are one step.
  const past = useRef([]);
  const future = useRef([]);
  const lastEditAt = useRef(0);
  const [, setHistoryTick] = useState(0);

  useEffect(() => { loadThumbnailFonts().then(() => setFontsTick((n) => n + 1)); }, []);

  // Shows, then the chosen show's episodes.
  useEffect(() => {
    youtubeThumbnailsApi.shows().then(setShows).catch((err) => {
      console.error('[YouTubeThumbnails] shows load failed:', err);
      setMessage({ type: 'error', text: 'Could not load the shows.' });
    });
  }, []);
  useEffect(() => {
    if (!showId) { setEpisodes([]); return; }
    youtubeThumbnailsApi.episodes(showId).then(setEpisodes).catch((err) => {
      console.error('[YouTubeThumbnails] episodes load failed:', err);
      setMessage({ type: 'error', text: 'Could not load the episodes.' });
    });
  }, [showId]);

  /** This episode's words and pictures, as a template or a layout fills them. */
  const episodeContent = useCallback((src) => {
    // This episode's starred Lala pose first (her look changes each
    // episode), then the show's saved Lala, then the Asset Library's.
    const lalaUrl = defaultPose(src.poses?.lala)?.url || src.style?.lalaUrl || src.cutouts?.[0]?.url || null;
    return {
      ...episodeWords(src.episode, src.show),
      backgroundUrl: src.backgrounds?.[0]?.url || null,
      lalaUrl,
      // JustAWoman joins only when picked.
      jawUrl: null,
      // Come Style Me: the full outfit is another of Lala's poses (her back
      // or front), the checklist, edition and pieces come from the episode.
      outfitUrl: outfitPose(src.poses?.lala, lalaUrl),
      checklist: src.suggest?.checklist || [],
      edition: src.suggest?.edition || null,
      pieces: src.suggest?.pieces || [],
      logoUrl: src.suggest?.logoUrl || null,
    };
  }, []);

  /** Where an episode starts: the show's template, else the show's layout. */
  const startingSpec = useCallback((src, lk) => (src.template
    ? fillTemplate(src.template, episodeContent(src))
    : presetLayers(lk.layout, episodeContent(src), lk)), [episodeContent]);

  // The episode's pictures, its show's style and template, and its own arrangement.
  useEffect(() => {
    if (!episodeId) { setSources(null); setSpecState(null); return; }
    let live = true;
    setSaved(null);
    setExact(null);
    setSelectedId(null);
    setDraftNote(null);
    youtubeThumbnailsApi.sources(episodeId).then((src) => {
      if (!live || !src) return;
      setSources(src);
      if (src.show?.id && src.show.id !== showId) setShowId(src.show.id);
      const lk = { layout: src.style?.layout || 'lala-left', accent: src.style?.accent, textColor: src.style?.textColor, dim: src.style?.dim };
      setLook(lk);
      edited.current = false;
      past.current = [];
      future.current = [];
      lastEditAt.current = 0;
      if (src.draft) {
        const { savedAt, ...draft } = src.draft;
        setSpecState(draft);
        setDraftNote(savedAt ? 'Your arrangement for this episode.' : null);
      } else {
        setSpecState(startingSpec(src, lk));
      }
    }).catch((err) => {
      console.error('[YouTubeThumbnails] sources load failed:', err);
      if (live) setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not load the episode.' });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  // Every change is kept for this episode, a moment after the last one.
  useEffect(() => {
    if (!spec || !episodeId || !edited.current) return undefined;
    const t = setTimeout(async () => {
      try {
        await youtubeThumbnailsApi.saveDraft(episodeId, spec);
        setDraftNote('Arrangement kept for this episode.');
      } catch (err) {
        console.error('[YouTubeThumbnails] arrangement not kept:', err);
        setDraftNote(err?.response?.status === 503
          ? 'Arrangements are kept once the server has its latest update.'
          : 'This arrangement could not be kept. Save the thumbnail to keep it.');
      }
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(t);
  }, [spec, episodeId]);

  // The episode's saved thumbnails, its current one first.
  const loadHistory = useCallback(async (id) => {
    if (!id) { setHistory([]); return; }
    try {
      setHistory(await youtubeThumbnailsApi.saved(id));
    } catch (err) {
      console.error('[YouTubeThumbnails] saved thumbnails load failed:', err);
      setHistory([]);
      setMessage({ type: 'error', text: 'Could not load the saved thumbnails.' });
    }
  }, []);
  useEffect(() => { loadHistory(episodeId); }, [episodeId, loadHistory]);

  useEffect(() => () => { if (exact) URL.revokeObjectURL(exact); }, [exact]);

  /** A change made here: kept as this episode's arrangement. */
  const edit = useCallback((next) => {
    const now = Date.now();
    if (specRef.current && now - lastEditAt.current > UNDO_GROUP_MS) {
      past.current = [...past.current, specRef.current].slice(-UNDO_STEPS);
    }
    future.current = [];
    lastEditAt.current = now;
    edited.current = true;
    setSaved(null);
    setExact(null);
    setHistoryTick((n) => n + 1);
    setSpecState((s) => (typeof next === 'function' ? next(s) : next));
  }, []);

  /** Back one step (undo) or forward one (redo); kept as the episode's arrangement like any change. */
  const step = useCallback((from, to) => {
    if (!from.current.length || !specRef.current) return;
    to.current = [...to.current, specRef.current];
    const prev = from.current[from.current.length - 1];
    from.current = from.current.slice(0, -1);
    lastEditAt.current = 0;
    edited.current = true;
    setSaved(null);
    setExact(null);
    setHistoryTick((n) => n + 1);
    setSpecState(prev);
    setSelectedId((id) => (prev.layers.some((l) => l.id === id) ? id : null));
  }, []);
  const undo = useCallback(() => step(past, future), [step]);
  const redo = useCallback(() => step(future, past), [step]);

  const duplicate = useCallback((id) => {
    const next = duplicateLayer(specRef.current, id);
    const i = next.layers.findIndex((l) => l.id === id);
    edit(next);
    if (next.layers[i + 1]) setSelectedId(next.layers[i + 1].id);
  }, [edit]);

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+D copy the
  // picked layer; not while typing in a field (it has its own undo).
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !specRef.current) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      } else if (key === 'd' && selectedIdRef.current) {
        e.preventDefault();
        duplicate(selectedIdRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, duplicate]);

  const setRole = (role, value) => edit((s) => {
    if (!value && (role === 'lala' || role === 'jaw')) {
      const l = layerOf(s, role);
      return l ? removeLayer(s, l.id) : s;
    }
    return setRoleContent(s, role, value, look?.layout);
  });

  /** Adds a layer (addText, addPicture) and picks it, so its settings show. */
  const addAndPick = (make) => {
    const next = make(specRef.current);
    edit(next);
    setSelectedId(next.layers.at(-1).id);
  };

  const setColours = (patch) => {
    setLook((l) => ({ ...l, ...patch }));
    edit((s) => applyStyle(s, patch));
  };

  const pickLayout = (layout) => {
    if (edited.current && !window.confirm('Start again from this layout? Moved, resized and turned layers go back to where the layout puts them.')) return;
    // What is on the thumbnail now, and the episode's own for what is not.
    const own = sources ? episodeContent(sources) : {};
    const pieces = ['piece-1', 'piece-2', 'piece-3', 'piece-4'].map((r) => layerOf(spec, r)).filter(Boolean).map((l) => ({ url: l.src, label: l.name }));
    const content = {
      ...own,
      title: roleText(spec, 'title') || own.title, kicker: roleText(spec, 'kicker') || own.kicker,
      badge: roleText(spec, 'badge').replace(/^EPISODE\b/i, 'EP') || own.badge,
      backgroundUrl: roleSrc(spec, 'background'), lalaUrl: roleSrc(spec, 'lala'), jawUrl: roleSrc(spec, 'jaw'),
      outfitUrl: roleSrc(spec, 'outfit') || own.outfitUrl,
      checklist: layerOf(spec, 'checklist')?.items || own.checklist,
      edition: roleText(spec, 'edition') || own.edition,
      pieces: pieces.length ? pieces : own.pieces,
      headline: roleText(spec, 'headline') || undefined,
    };
    const lk = { ...look, layout };
    setLook(lk);
    setSelectedId(null);
    edit(presetLayers(layout, content, lk));
  };

  const resetToTemplate = () => {
    if (!sources) return;
    if (!window.confirm(`Start this episode again from ${sources.template ? "the show's template" : "the show's layout"}?`)) return;
    setSelectedId(null);
    edit(startingSpec(sources, look));
  };

  const upload = async (file, then) => {
    setUploading(file.name);
    try {
      const pic = await youtubeThumbnailsApi.uploadPicture(episodeId, file);
      setUploads((u) => [pic, ...u.filter((x) => x.url !== pic.url)]);
      then(pic.url, pic.label);
    } catch (err) {
      console.error('[YouTubeThumbnails] upload failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The picture could not be uploaded.' });
    } finally {
      setUploading(null);
    }
  };

  // The folders, with this session's uploads first.
  const tree = useMemo(() => [
    ...(uploads.length ? [{ key: 'uploads', label: 'Uploads', items: uploads }] : []),
    ...(sources?.folders || []),
  ], [uploads, sources]);

  const pickShow = (id) => { setShowId(id); setEpisodeId(''); setParams(id ? { show: id } : {}); };
  const pickEpisode = (id) => { setEpisodeId(id); setParams(id ? { show: showId, episode: id } : { show: showId }); };

  const seeExactly = async () => {
    setRendering(true);
    try {
      const blob = await youtubeThumbnailsApi.render(spec);
      setExact((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch (err) {
      console.error('[YouTubeThumbnails] render failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The thumbnail could not be drawn. Check the pictures.' });
    } finally {
      setRendering(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const out = await youtubeThumbnailsApi.save(episodeId, spec);
      setSaved(out);
      setMessage({ type: 'ok', text: "Saved as the episode's thumbnail." });
      loadHistory(episodeId);
    } catch (err) {
      console.error('[YouTubeThumbnails] save failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The thumbnail could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const makeCurrent = async (thumb) => {
    setBusy(true);
    try {
      await youtubeThumbnailsApi.makePrimary(episodeId, thumb.id);
      setMessage({ type: 'ok', text: "That one is the episode's thumbnail again." });
      await loadHistory(episodeId);
    } catch (err) {
      console.error('[YouTubeThumbnails] make current failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not change the thumbnail.' });
    } finally {
      setBusy(false);
    }
  };

  const removeSaved = async (thumb) => {
    if (!window.confirm('Delete this saved thumbnail? This cannot be undone.')) return;
    setBusy(true);
    try {
      await youtubeThumbnailsApi.removeSaved(episodeId, thumb.id);
      setHistory((h) => h.filter((t) => t.id !== thumb.id));
    } catch (err) {
      console.error('[YouTubeThumbnails] delete failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not delete the thumbnail.' });
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!sources?.show?.id) return;
    setBusy(true);
    try {
      // An episode's pose is that episode's look: the show keeps its own Lala.
      const lalaNow = roleSrc(spec, 'lala');
      const isPose = (sources?.poses?.lala || []).some((p) => p.url === lalaNow);
      const lalaUrl = isPose || !lalaNow ? (sources?.style?.lalaUrl || null) : lalaNow;
      const style = { layout: look.layout, accent: look.accent, textColor: look.textColor, dim: look.dim, lalaUrl, template: spec };
      await youtubeThumbnailsApi.saveStyle(sources.show.id, style);
      setSources((s) => ({ ...s, template: spec }));
      setMessage({ type: 'ok', text: `Template saved for ${sources.show.name}: every episode starts from this arrangement, with its own words and pictures.` });
    } catch (err) {
      console.error('[YouTubeThumbnails] template save failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The template could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const fileName = useMemo(() => {
    const n = sources?.episode?.episode_number;
    return `${(sources?.show?.name || 'thumbnail').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${n ? `-ep${n}` : ''}.png`;
  }, [sources]);

  const picked = spec?.layers.find((l) => l.id === selectedId) || null;
  const shade = layerOf(spec, 'shade');

  return (
    <div className="yts">
      <header className="yts-banner">
        <div>
          <p className="yts-kicker"><Link to="/template-studio">Templates</Link> · YouTube</p>
          <h1 className="yts-title"><Youtube size={30} aria-hidden /> YouTube thumbnails</h1>
          <p className="yts-sub">Each episode's thumbnail, from its show's template. Drag, resize and turn anything. 1280 × 720.</p>
        </div>
        <div className="yts-choose">
          <label className="yts-select">
            <span>Show</span>
            <select value={showId} onChange={(e) => pickShow(e.target.value)} aria-label="Show">
              <option value="">Choose a show</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="yts-select">
            <span>Episode</span>
            <select value={episodeId} onChange={(e) => pickEpisode(e.target.value)} aria-label="Episode" disabled={!showId}>
              <option value="">Choose an episode</option>
              {episodes.map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `${e.episode_number}. ` : ''}{e.title || 'Untitled'}</option>)}
            </select>
          </label>
        </div>
      </header>

      {message && <p className={`yts-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {!spec ? (
        <div className="yts-empty"><LayoutTemplate size={36} aria-hidden /><p>Choose a show and an episode to make its thumbnail.</p></div>
      ) : (
        <>
        <div className="yts-work">
          <section className="yts-stage" aria-label="Editor">
            <ThumbnailCanvas spec={spec} selectedId={selectedId} onSelect={setSelectedId} fontsTick={fontsTick}
              onChange={(id, patch) => edit((s) => updateLayer(s, id, patch))} />
            <p className="yts-note" data-testid="yts-draft-note">
              {draftNote || 'Click a layer to move it, pull a corner to resize, use the top handle to turn it.'}
            </p>
            <div className="yts-actions">
              <button type="button" className="yts-btn is-primary" onClick={save} disabled={busy} data-testid="yts-save">
                <Save size={16} aria-hidden /> Save as episode thumbnail
              </button>
              <button type="button" className="yts-btn" onClick={seeExactly} disabled={rendering} data-testid="yts-exact">
                <ScanEye size={16} aria-hidden /> {rendering ? 'Drawing…' : 'See it exactly'}
              </button>
              <button type="button" className="yts-btn" onClick={saveTemplate} disabled={busy || !sources?.show?.id} data-testid="yts-save-template">
                <Palette size={16} aria-hidden /> Save as {sources?.show?.name || 'show'} template
              </button>
              <button type="button" className="yts-btn" onClick={undo} disabled={!past.current.length} data-testid="yts-undo" title="Undo (Ctrl+Z)">
                <Undo2 size={16} aria-hidden /> Undo
              </button>
              <button type="button" className="yts-btn" onClick={redo} disabled={!future.current.length} data-testid="yts-redo" title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={16} aria-hidden /> Redo
              </button>
              <button type="button" className="yts-btn" onClick={resetToTemplate} data-testid="yts-reset">
                <RotateCcw size={16} aria-hidden /> Start again
              </button>
            </div>
            {exact && (
              <figure className="yts-exact" data-testid="yts-exact-figure">
                <img src={exact} alt="The thumbnail exactly as it will be saved" data-testid="yts-preview" />
                <figcaption>
                  Exactly as it will be saved.
                  <a className="yts-btn" href={exact} download={fileName}><Download size={16} aria-hidden /> Download</a>
                  <button type="button" className="yts-icon-btn" onClick={() => setExact(null)} aria-label="Close the exact view"><X size={15} aria-hidden /></button>
                </figcaption>
              </figure>
            )}
            {saved && (
              <p className="yts-saved"><Check size={16} aria-hidden /> Saved. <Link to={`/episodes/${episodeId}?tab=production`}>Back to Production</Link></p>
            )}
            <LayerSettings layer={picked} onChange={(patch) => edit((s) => updateLayer(s, picked.id, patch))} />
            <LayersList spec={spec} selectedId={selectedId} onSelect={setSelectedId} onChange={edit} onDuplicate={duplicate} />
          </section>

          <section className="yts-panel" aria-label="Thumbnail settings">
            <fieldset className="yts-field">
              <legend className="yts-label">Layout</legend>
              <div className="yts-layouts">
                {LAYOUTS.map((l) => (
                  <button key={l.key} type="button" className={`yts-layout is-${l.key}${look?.layout === l.key ? ' is-on' : ''}`} aria-pressed={look?.layout === l.key} onClick={() => pickLayout(l.key)}>
                    <span className="yts-layout-art" aria-hidden><i /><b /></span>{l.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {layerOf(spec, 'headline') && (
              <label className="yts-field">
                <span className="yts-label">Headline</span>
                <input className="yts-input" value={roleText(spec, 'headline')} maxLength={160} onChange={(e) => edit((s) => updateLayer(s, 'headline', { text: e.target.value }))} aria-label="Headline" />
              </label>
            )}
            {layerOf(spec, 'title') && (
              <label className="yts-field">
                <span className="yts-label">Title</span>
                <input className="yts-input" value={roleText(spec, 'title')} maxLength={160} onChange={(e) => setRole('title', e.target.value)} aria-label="Title" />
              </label>
            )}
            <div className="yts-row">
              <label className="yts-field">
                <span className="yts-label">Show name line</span>
                <input className="yts-input" value={roleText(spec, 'kicker')} maxLength={160} onChange={(e) => setRole('kicker', e.target.value)} aria-label="Show name line" />
              </label>
              <label className="yts-field is-small">
                <span className="yts-label">Badge</span>
                <input className="yts-input" value={roleText(spec, 'badge')} maxLength={16} onChange={(e) => setRole('badge', e.target.value)} aria-label="Badge" />
              </label>
            </div>

            {layerOf(spec, 'edition') && (
              <label className="yts-field">
                <span className="yts-label">Edition label</span>
                <input className="yts-input" value={roleText(spec, 'edition')} maxLength={160} onChange={(e) => edit((s) => updateLayer(s, 'edition', { text: e.target.value }))} aria-label="Edition label" />
              </label>
            )}
            {layerOf(spec, 'checklist') && (
              <ChecklistEditor layer={layerOf(spec, 'checklist')} onChange={(patch) => edit((s) => updateLayer(s, layerOf(s, 'checklist').id, patch))} />
            )}

            <div className="yts-actions">
              <button type="button" className="yts-btn" onClick={() => addAndPick((s) => addText(s))} data-testid="yts-add-text">
                <Type size={16} aria-hidden /> Add words
              </button>
            </div>

            <FolderPicker title="Background" testid="yts-backgrounds" tree={tree} start={['scene-sets']} value={roleSrc(spec, 'background')}
              noneLabel="Plain" onPick={(url) => setRole('background', url)} uploading={Boolean(uploading)}
              onUpload={(f) => upload(f, (url) => setRole('background', url))}
              onNone={() => setRole('background', null)} />

            <FolderPicker title="Lala" testid="yts-lala" whole value={roleSrc(spec, 'lala')} tree={tree} start={['poses/lala', 'library/lala']}
              noneLabel="No Lala" onPick={(url) => setRole('lala', url)} uploading={Boolean(uploading)}
              onUpload={(f) => upload(f, (url) => setRole('lala', url))}
              onNone={() => setRole('lala', null)} />
            <FolderPicker title="JustAWoman" testid="yts-jaw" whole value={roleSrc(spec, 'jaw')} tree={tree} start={['poses/justawoman']}
              noneLabel="No JustAWoman" onPick={(url) => setRole('jaw', url)} uploading={Boolean(uploading)}
              onUpload={(f) => upload(f, (url) => setRole('jaw', url))}
              onNone={() => setRole('jaw', null)} />
            {!(sources?.poses?.lala || []).length && !(sources?.poses?.justawoman || []).length && (
              <p className="yts-note" data-testid="yts-poses-note"><Sparkles size={14} aria-hidden /> Add Lala and JustAWoman photos on the episode's <Link to={`/episodes/${episodeId}?tab=files`}>Files tab</Link>, labelled by pose; they show here once they are ready. Or upload one.</p>
            )}

            <FolderPicker title="Add a picture" testid="yts-add-picture" whole tree={tree} start={['outfit', 'documents']}
              onPick={(url, label) => addAndPick((s) => addPicture(s, url, label))} uploading={Boolean(uploading)}
              onUpload={(f) => upload(f, (url, label) => addAndPick((s) => addPicture(s, url, label)))} />

            <fieldset className="yts-field">
              <legend className="yts-label">Accent</legend>
              <div className="yts-swatches">
                {ACCENTS.map((c) => (
                  <button key={c} type="button" className={`yts-swatch${shade?.accent === c ? ' is-on' : ''}`} style={{ background: c }}
                    aria-label={`Accent ${c}`} aria-pressed={shade?.accent === c} onClick={() => setColours({ accent: c })} />
                ))}
              </div>
            </fieldset>
            <div className="yts-row">
              <label className="yts-field">
                <span className="yts-label">Title colour</span>
                <select className="yts-input" value={layerOf(spec, 'title')?.color || TEXT_COLORS[0].value} onChange={(e) => setColours({ textColor: e.target.value })} aria-label="Title colour">
                  {TEXT_COLORS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="yts-field">
                <span className="yts-label">Darken the background</span>
                <input type="range" min="0" max="0.8" step="0.05" value={shade?.dim ?? 0} onChange={(e) => setColours({ dim: Number(e.target.value) })} aria-label="Darken the background" disabled={!shade} />
              </label>
            </div>
          </section>
        </div>
        {history.length > 0 && (
          <section className="yts-history" aria-label="Saved thumbnails" data-testid="yts-history">
            <h2 className="yts-label"><History size={14} aria-hidden /> Saved thumbnails</h2>
            <ul className="yts-history-grid">
              {history.map((t) => (
                <li key={t.id} className={`yts-history-item${t.isPrimary ? ' is-current' : ''}`} data-testid={`yts-saved-${t.id}`}>
                  <img src={t.url} alt={t.isPrimary ? "The episode's thumbnail" : 'An earlier thumbnail'} loading="lazy" />
                  <div className="yts-history-row">
                    {t.isPrimary ? (
                      <span className="yts-history-badge"><Star size={13} aria-hidden /> Episode thumbnail</span>
                    ) : (
                      <>
                        <button type="button" className="yts-history-btn" onClick={() => makeCurrent(t)} disabled={busy}>
                          <Star size={13} aria-hidden /> Use this one
                        </button>
                        <button type="button" className="yts-history-btn is-danger" onClick={() => removeSaved(t)} disabled={busy} aria-label="Delete this saved thumbnail">
                          <Trash2 size={13} aria-hidden />
                        </button>
                      </>
                    )}
                    {t.savedAt && <span className="yts-history-date">{new Date(t.savedAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
      )}
    </div>
  );
}
