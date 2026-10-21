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
 * draft). A show has named templates (Evoni, 2026-10-21: Come Style Me,
 * Haul, GRWM…): use one, save this arrangement as a new one, rename one,
 * make one the default (where every episode starts), update or delete one.
 * The server draws the saved file from the same layers ("See it exactly").
 *
 * ?show= and ?episode= open it on an episode (Production's Thumbnail step);
 * ?template= starts that episode from one of the show's templates.
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
  Eye, EyeOff, ArrowUp, ArrowDown, Type, RotateCcw, ScanEye, X, Lock, LockOpen, Copy, Undo2, Redo2, Plus, Pencil, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Keyboard, RefreshCw, FlipHorizontal2, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
  youtubeThumbnailsApi, LAYOUTS, ACCENTS, TEXT_COLORS, readRecentColours, rememberColour, episodeWords, defaultPose, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import {
  FONTS, presetLayers, fillTemplate, applyStyle, setRoleContent, layerOf, updateLayer, moveLayer, removeLayer,
  addText, addPicture, layerName, loadThumbnailFonts, OUTLINE, BOX_COLOR, BOX_OPACITY, STICKER_EDGE, CARD_COLOR, duplicateLayer, WIDTH, HEIGHT,
  alignLayers, distributeLayers, measurer, youtubeWarnings, fileSize, YOUTUBE_SIZES, GLOW_COLOR, FADE_COLOR, EFFECT_SIZE,
} from '../lib/thumbnailLayers';
import ThumbnailCanvas from '../components/Thumbnails/ThumbnailCanvas';
import { usePreview } from '../lib/picturePreview';
import './YouTubeThumbnailStudio.css';

const DRAFT_DELAY_MS = 1200;
const ZOOM_MAX = 3;
// Changes this close together are one step to undo (typing a word, a slider).
const UNDO_GROUP_MS = 600;
const UNDO_STEPS = 50;

/** A folder's picture, from its small copy (the full one can be 4000px). */
function PreviewImg({ url, alt }) {
  const src = usePreview(url, 120);
  return src ? <img src={src} alt={alt} loading="lazy" /> : <span className="yts-img-wait" aria-hidden />;
}

function PickButton({ it, value, onPick }) {
  return (
    <button type="button" className={`yts-pick${value === it.url ? ' is-on' : ''}`} aria-pressed={value === it.url}
      onClick={() => onPick(it.url, it.label)} title={it.label}>
      <PreviewImg url={it.url} alt={it.label || ''} />
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
                <span className="yts-folder-art">{cover ? <PreviewImg url={cover} alt="" /> : <Folder size={20} aria-hidden />}</span>
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
/**
 * A picture's effects (Evoni, 2026-10-21): turn it left to right, lighter
 * or darker, more or less contrast; on a picture without a photo card, a
 * sticker edge round a cut-out and a drop shadow under it.
 */
function PictureEffects({ layer, onChange, colours = [], onRemember }) {
  const card = layer.frame === 'polaroid';
  const cardColour = layer.cardColor || CARD_COLOR;
  return (
    <div className="yts-text-tools" data-testid="yts-picture-effects">
      {card && (
        // A coloured card (Evoni, 2026-10-21: colour behind the wardrobe pieces, not only white).
        <fieldset className="yts-field">
          <legend className="yts-label">Card colour</legend>
          <div className="yts-swatches">
            {[CARD_COLOR, ...colours.filter((c) => c !== CARD_COLOR)].map((c) => (
              <button key={c} type="button" className={`yts-swatch${cardColour === c ? ' is-on' : ''}`} style={{ background: c }}
                aria-label={`Card ${c}`} aria-pressed={cardColour === c} onClick={() => onChange({ cardColor: c })} />
            ))}
            <label className="yts-swatch-any" title="Any colour">
              <Palette size={15} aria-hidden />
              <input type="color" className="yts-color" value={cardColour} aria-label="Any card colour"
                onChange={(e) => onChange({ cardColor: e.target.value.toUpperCase() })} onBlur={(e) => onRemember?.(e.target.value)} />
            </label>
          </div>
        </fieldset>
      )}
      <label className="yts-check">
        <input type="checkbox" checked={Boolean(layer.clearWhite)} aria-label="Clear the photo's white background"
          onChange={(e) => onChange({ clearWhite: e.target.checked })} />
        Clear the photo's white background{card ? ' (the card colour shows up to the piece)' : ''}
      </label>
      <div className="yts-row">
        <button type="button" className={`yts-btn${layer.flipX ? ' is-primary' : ''}`} aria-pressed={Boolean(layer.flipX)}
          onClick={() => onChange({ flipX: !layer.flipX })}><FlipHorizontal2 size={16} aria-hidden /> Flip</button>
      </div>
      <div className="yts-row">
        <label className="yts-field">
          <span className="yts-label">Brightness ({Math.round((layer.brightness || 0) * 100)})</span>
          <input type="range" min="-0.5" max="0.5" step="0.05" value={layer.brightness || 0} onChange={(e) => onChange({ brightness: Number(e.target.value) })} aria-label="Brightness" />
        </label>
        <label className="yts-field">
          <span className="yts-label">Contrast ({Math.round((layer.contrast || 0) * 100)})</span>
          <input type="range" min="-0.5" max="0.5" step="0.05" value={layer.contrast || 0} onChange={(e) => onChange({ contrast: Number(e.target.value) })} aria-label="Contrast" />
        </label>
      </div>
      {card ? (
        <p className="yts-note">A photo card has its own edge and shadow.</p>
      ) : (
        <>
          <label className="yts-check">
            <input type="checkbox" checked={Boolean(layer.outline)} aria-label="Sticker edge"
              onChange={(e) => onChange({ outline: e.target.checked ? STICKER_EDGE : null, outlineWidth: layer.outlineWidth || 12 })} />
            Sticker edge (best on a cut-out)
          </label>
          {layer.outline && (
            <div className="yts-row">
              <label className="yts-field is-small">
                <span className="yts-label">Edge colour</span>
                <input type="color" className="yts-color" value={layer.outline} onChange={(e) => onChange({ outline: e.target.value.toUpperCase() })} aria-label="Edge colour" />
              </label>
              <label className="yts-field">
                <span className="yts-label">Edge width ({layer.outlineWidth || 12})</span>
                <input type="range" min="2" max="40" step="1" value={layer.outlineWidth || 12} onChange={(e) => onChange({ outlineWidth: Number(e.target.value) })} aria-label="Edge width" />
              </label>
            </div>
          )}
          <label className="yts-check">
            <input type="checkbox" checked={Boolean(layer.shadow)} aria-label="Drop shadow" onChange={(e) => onChange({ shadow: e.target.checked })} />
            Drop shadow
          </label>
        </>
      )}
    </div>
  );
}

const ALIGNS = [['left', 'Left', AlignLeft], ['center', 'Centre', AlignCenter], ['right', 'Right', AlignRight]];

/**
 * Words' look (Evoni, 2026-10-21: text tools): left, centre or right; the
 * largest size (they are made smaller until they fit their box); the space
 * between letters; and a box behind them, its colour, how see-through and
 * how rounded.
 */
function TextTools({ layer, onChange }) {
  const align = layer.align || 'left';
  return (
    <div className="yts-text-tools" data-testid="yts-text-tools">
      <div className="yts-align" role="group" aria-label="Line up the words">
        {ALIGNS.map(([key, label, Icon]) => (
          <button key={key} type="button" className={`yts-icon-btn${align === key ? ' is-on' : ''}`} aria-pressed={align === key}
            aria-label={`Line up ${label.toLowerCase()}`} title={label} onClick={() => onChange({ align: key })}>
            <Icon size={15} aria-hidden />
          </button>
        ))}
      </div>
      <div className="yts-row">
        <label className="yts-field">
          <span className="yts-label">Largest size ({layer.size})</span>
          <input type="range" min="10" max="220" step="2" value={layer.size} onChange={(e) => onChange({ size: Number(e.target.value) })} aria-label="Largest size" />
        </label>
        <label className="yts-field">
          <span className="yts-label">Letter spacing ({layer.spacing || 0})</span>
          <input type="range" min="-2" max="20" step="1" value={layer.spacing || 0} onChange={(e) => onChange({ spacing: Number(e.target.value) })} aria-label="Letter spacing" />
        </label>
      </div>
      <label className="yts-check">
        <input type="checkbox" checked={Boolean(layer.bg)} aria-label="Box behind the words"
          onChange={(e) => onChange(e.target.checked ? { bg: BOX_COLOR, bgOpacity: BOX_OPACITY, bgRadius: 16 } : { bg: null })} />
        Box behind the words
      </label>
      {layer.bg && (
        <div className="yts-row">
          <label className="yts-field is-small">
            <span className="yts-label">Box colour</span>
            <input type="color" className="yts-color" value={layer.bg} onChange={(e) => onChange({ bg: e.target.value.toUpperCase() })} aria-label="Box colour" />
          </label>
          <label className="yts-field">
            <span className="yts-label">See-through ({Math.round((1 - (layer.bgOpacity ?? 1)) * 100)}%)</span>
            <input type="range" min="0" max="1" step="0.05" value={1 - (layer.bgOpacity ?? 1)} onChange={(e) => onChange({ bgOpacity: Math.round((1 - Number(e.target.value)) * 100) / 100 })} aria-label="Box see-through" />
          </label>
          <label className="yts-field">
            <span className="yts-label">Rounded ({layer.bgRadius || 0})</span>
            <input type="range" min="0" max="60" step="2" value={layer.bgRadius || 0} onChange={(e) => onChange({ bgRadius: Number(e.target.value) })} aria-label="Box rounded corners" />
          </label>
        </div>
      )}
      <TextEffects layer={layer} onChange={onChange} />
    </div>
  );
}

/** A shadow or a glow, a fade to a second colour, words on a curve (Evoni, 2026-10-21: text effects). */
function TextEffects({ layer, onChange }) {
  const effect = layer.effect || 'none';
  const curve = layer.curve || 0;
  return (
    <div className="yts-text-effects" data-testid="yts-text-effects">
      <div className="yts-row">
        <label className="yts-field">
          <span className="yts-label">Effect</span>
          <select className="yts-input" value={effect} aria-label="Words effect"
            onChange={(e) => onChange(e.target.value === 'glow'
              ? { effect: 'glow', effectColor: layer.effectColor || GLOW_COLOR, effectSize: layer.effectSize || EFFECT_SIZE }
              : { effect: e.target.value, effectSize: layer.effectSize || EFFECT_SIZE })}>
            <option value="none">None</option>
            <option value="shadow">Shadow</option>
            <option value="glow">Glow</option>
          </select>
        </label>
        {effect === 'glow' && (
          <label className="yts-field is-small">
            <span className="yts-label">Glow colour</span>
            <input type="color" className="yts-color" value={layer.effectColor || GLOW_COLOR} aria-label="Glow colour"
              onChange={(e) => onChange({ effectColor: e.target.value.toUpperCase() })} />
          </label>
        )}
        {effect !== 'none' && (
          <label className="yts-field">
            <span className="yts-label">{effect === 'glow' ? 'Glow' : 'Shadow'} size ({layer.effectSize || EFFECT_SIZE})</span>
            <input type="range" min="4" max="40" step="2" value={layer.effectSize || EFFECT_SIZE} aria-label="Effect size"
              onChange={(e) => onChange({ effectSize: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <div className="yts-row">
        <label className="yts-check">
          <input type="checkbox" checked={Boolean(layer.gradient)} aria-label="Fade to a second colour"
            onChange={(e) => onChange({ gradient: e.target.checked ? FADE_COLOR : null })} />
          Fade to a second colour
        </label>
        {layer.gradient && (
          <label className="yts-field is-small">
            <span className="yts-label">Fade to</span>
            <input type="color" className="yts-color" value={layer.gradient} aria-label="Fade to colour"
              onChange={(e) => onChange({ gradient: e.target.value.toUpperCase() })} />
          </label>
        )}
      </div>
      <div className="yts-row">
        <label className="yts-field">
          <span className="yts-label">Curve ({curve === 0 ? 'straight' : curve > 0 ? `arch up ${curve}°` : `bend down ${-curve}°`})</span>
          <input type="range" min="-180" max="180" step="5" value={curve} aria-label="Curve"
            onChange={(e) => onChange({ curve: Number(e.target.value) })} />
        </label>
        {curve !== 0 && (
          <button type="button" className="yts-btn" onClick={() => onChange({ curve: 0 })}>Straighten</button>
        )}
      </div>
      {curve !== 0 && <p className="yts-note">Curved words sit on one line.</p>}
    </div>
  );
}

function LayerSettings({ layer, onChange, colours, onRemember }) {
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
      {layer.kind === 'text' && <TextTools layer={layer} onChange={onChange} />}
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
      {layer.kind === 'image' && <PictureEffects layer={layer} onChange={onChange} colours={colours} onRemember={onRemember} />}
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
function LayersList({ spec, selectedId, pickedIds, onSelect, onChange, onDuplicate }) {
  const picked = new Set(pickedIds || (selectedId ? [selectedId] : []));
  const front = [...(spec?.layers || [])].reverse();
  return (
    <fieldset className="yts-field" data-testid="yts-layers">
      <legend className="yts-label">Layers</legend>
      <ul className="yts-layers">
        {front.map((l, i) => (
          <li key={l.id} className={`yts-layer${picked.has(l.id) ? ' is-on' : ''}${l.visible ? '' : ' is-hidden'}`}>
            <button type="button" className="yts-layer-name" aria-pressed={picked.has(l.id)}
              onClick={(e) => onSelect(l.kind === 'shade' ? null : l.id, { toggle: l.kind !== 'shade' && (e.shiftKey || e.ctrlKey || e.metaKey) })}>
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

const ALIGN_TOOLS = [
  ['left', 'Line up left edges', AlignStartVertical], ['center', 'Line up centres across', AlignCenterVertical], ['right', 'Line up right edges', AlignEndVertical],
  ['top', 'Line up tops', AlignStartHorizontal], ['middle', 'Line up middles', AlignCenterHorizontal], ['bottom', 'Line up bottoms', AlignEndHorizontal],
];

/**
 * Arranging the picked layers (Evoni, 2026-10-21): one lines up with the
 * canvas, several with each other; three or more spread evenly.
 */
function ArrangeBar({ count, onAlign, onSpread, onClear }) {
  if (!count) return null;
  return (
    <div className="yts-arrange" role="toolbar" aria-label="Arrange" data-testid="yts-arrange">
      <span className="yts-arrange-count">{count === 1 ? '1 picked: line up with the canvas' : `${count} picked`}</span>
      {ALIGN_TOOLS.map(([how, label, Icon]) => (
        <button key={how} type="button" className="yts-icon-btn" onClick={() => onAlign(how)} aria-label={label} title={label}>
          <Icon size={15} aria-hidden />
        </button>
      ))}
      <button type="button" className="yts-icon-btn" onClick={() => onSpread('x')} disabled={count < 3}
        aria-label="Spread evenly across" title="Spread evenly across (3 or more)"><AlignHorizontalDistributeCenter size={15} aria-hidden /></button>
      <button type="button" className="yts-icon-btn" onClick={() => onSpread('y')} disabled={count < 3}
        aria-label="Spread evenly down" title="Spread evenly down (3 or more)"><AlignVerticalDistributeCenter size={15} aria-hidden /></button>
      <button type="button" className="yts-icon-btn" onClick={onClear} aria-label="Pick nothing" title="Pick nothing (Esc)"><X size={15} aria-hidden /></button>
    </div>
  );
}

/**
 * The thumbnail where YouTube shows it (Evoni, 2026-10-21): in search, on
 * a phone and beside a video, with the timestamp over its corner; and what
 * would go wrong there (words too small, words under the timestamp).
 * Picking a warning picks its layer.
 */
function YouTubePreviews({ src, title, channel, warnings, onPick }) {
  if (!src) return null;
  return (
    <section className="yts-yt" aria-label="Where YouTube shows it" data-testid="yts-youtube">
      <p className="yts-label"><Youtube size={16} aria-hidden /> Where YouTube shows it</p>
      <div className="yts-yt-grid">
        {YOUTUBE_SIZES.map((size) => (
          <figure key={size.key} className={`yts-yt-card is-${size.key}`}>
            <div className="yts-yt-thumb" style={{ width: size.width }}>
              <img src={src} alt={`The thumbnail ${size.width} pixels wide`} />
              <span className="yts-yt-time" aria-hidden>12:34</span>
            </div>
            <figcaption>
              <strong>{title || 'Episode title'}</strong>
              <span>{channel}</span>
              <em>{size.label}</em>
            </figcaption>
          </figure>
        ))}
      </div>
      {warnings.length ? (
        <ul className="yts-yt-warn" data-testid="yts-yt-warnings">
          {warnings.map((w) => (
            <li key={`${w.id}-${w.kind}`}>
              <button type="button" className="yts-yt-warn-btn" onClick={() => onPick(w.id)}>{w.text}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="yts-note">Readable at every size, and clear of the timestamp.</p>
      )}
    </section>
  );
}

const SHORTCUTS = [
  ['Click', 'Pick a layer'],
  ['Shift-click or Ctrl-click', 'Pick more than one (or take one away)'],
  ['Drag across the canvas', 'Pick everything the box touches'],
  ['Arrow keys', 'Nudge the picked layers 1 point (with Shift, 10)'],
  ['Alt while dragging', 'Move freely, without snapping'],
  ['Delete or Backspace', 'Remove the picked layers (not locked ones)'],
  ['Esc', 'Pick nothing'],
  ['+ / - / 0', 'Zoom in, out, back to fit'],
  ['Ctrl+Z', 'Undo'],
  ['Ctrl+Shift+Z or Ctrl+Y', 'Redo'],
  ['Ctrl+D', 'Copy the picked layer'],
  ['?', 'Show or hide this list'],
];

function ShortcutsPanel({ onClose }) {
  return (
    <section className="yts-shortcuts" aria-label="Keyboard shortcuts" data-testid="yts-shortcuts">
      <div className="yts-templates-head">
        <p className="yts-label"><Keyboard size={16} aria-hidden /> Keyboard shortcuts</p>
        <button type="button" className="yts-icon-btn" onClick={onClose} aria-label="Close the shortcuts"><X size={15} aria-hidden /></button>
      </div>
      <dl className="yts-shortcut-list">
        {SHORTCUTS.map(([keys, what]) => (
          <React.Fragment key={keys}><dt>{keys}</dt><dd>{what}</dd></React.Fragment>
        ))}
      </dl>
      <p className="yts-note">On a Mac, Cmd works wherever Ctrl is named.</p>
    </section>
  );
}

/**
 * The show's named templates (Evoni, 2026-10-21): each with its picture;
 * Use starts this episode from it; save this arrangement as a new one;
 * rename (or double-click the name), make the default, update with this
 * arrangement, delete. Each handler resolves true when it worked.
 */
function TemplatesBar({ showName, templates, busy, onUse, onCreate, onRename, onDefault, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(null); // { name, makeDefault }
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [asking, setAsking] = useState(null); // { id, kind: 'update' | 'delete' }
  const create = async (e) => {
    e.preventDefault();
    if (await onCreate(adding.name, adding.makeDefault)) setAdding(null);
  };
  const rename = async (e, t) => {
    e.preventDefault();
    if (renaming.name.trim() === t.name || await onRename(t, renaming.name)) setRenaming(null);
  };
  const answer = async (t) => {
    const { kind } = asking;
    setAsking(null);
    await (kind === 'delete' ? onDelete(t) : onUpdate(t));
  };
  return (
    <section className="yts-templates" aria-label={`${showName} templates`} data-testid="yts-templates">
      <div className="yts-templates-head">
        <p className="yts-label"><LayoutTemplate size={16} aria-hidden /> {showName} templates</p>
        {!adding && (
          <button type="button" className="yts-btn" onClick={() => setAdding({ name: '', makeDefault: !templates.length })} disabled={busy} data-testid="yts-save-template">
            <Plus size={16} aria-hidden /> Save as a new template
          </button>
        )}
      </div>
      {adding && (
        <form className="yts-template-form" onSubmit={create} data-testid="yts-template-new">
          <input className="yts-input" value={adding.name} maxLength={80} autoFocus placeholder="Name, e.g. Come Style Me"
            aria-label="New template name" onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') setAdding(null); }} />
          <label className="yts-check">
            <input type="checkbox" checked={adding.makeDefault} onChange={(e) => setAdding({ ...adding, makeDefault: e.target.checked })} />
            Every episode starts from it
          </label>
          <button type="submit" className="yts-btn is-primary" disabled={busy || !adding.name.trim()}>Save template</button>
          <button type="button" className="yts-btn" onClick={() => setAdding(null)}>Cancel</button>
        </form>
      )}
      {templates.length ? (
        <ul className="yts-template-grid">
          {templates.map((t) => (
            <li key={t.id} className={`yts-template${t.isDefault ? ' is-default' : ''}`} data-testid={`yts-template-${t.id}`}>
              <button type="button" className="yts-template-pic" onClick={() => onUse(t)} disabled={busy || !t.spec} title={`Use ${t.name}`}>
                {t.previewUrl ? <PreviewImg url={t.previewUrl} alt="" /> : <LayoutTemplate size={28} aria-hidden />}
              </button>
              {renaming?.id === t.id ? (
                <form className="yts-template-form" onSubmit={(e) => rename(e, t)}>
                  <input className="yts-input" value={renaming.name} maxLength={80} autoFocus aria-label={`New name for ${t.name}`}
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} />
                  <button type="submit" className="yts-history-btn" disabled={busy || !renaming.name.trim()}>Save</button>
                  <button type="button" className="yts-history-btn" onClick={() => setRenaming(null)}>Cancel</button>
                </form>
              ) : (
                <p className="yts-template-name" onDoubleClick={() => setRenaming({ id: t.id, name: t.name })} title="Double-click to rename">
                  {t.isDefault && <Star size={13} aria-label="Default" />} {t.name}
                </p>
              )}
              {asking?.id === t.id ? (
                <div className="yts-history-row" role="group" aria-label="Confirm">
                  <span className="yts-template-ask">{asking.kind === 'delete' ? `Delete "${t.name}"?` : `Replace "${t.name}" with this arrangement?`}</span>
                  <button type="button" className="yts-history-btn" onClick={() => answer(t)}>Yes</button>
                  <button type="button" className="yts-history-btn" onClick={() => setAsking(null)}>No</button>
                </div>
              ) : (
                <div className="yts-history-row">
                  <button type="button" className="yts-history-btn" onClick={() => onUse(t)} disabled={busy || !t.spec}>Use</button>
                  <button type="button" className="yts-history-btn" onClick={() => setRenaming({ id: t.id, name: t.name })} disabled={busy}>
                    <Pencil size={13} aria-hidden /> Rename
                  </button>
                  {!t.isDefault && (
                    <button type="button" className="yts-history-btn" onClick={() => onDefault(t)} disabled={busy}>
                      <Star size={13} aria-hidden /> Make default
                    </button>
                  )}
                  <button type="button" className="yts-history-btn" onClick={() => setAsking({ id: t.id, kind: 'update' })} disabled={busy}>
                    Update with this
                  </button>
                  <button type="button" className="yts-history-btn is-danger" onClick={() => setAsking({ id: t.id, kind: 'delete' })} disabled={busy}
                    aria-label={`Delete ${t.name}`}><Trash2 size={13} aria-hidden /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="yts-note">No templates yet. Arrange this thumbnail, then save it as one: every episode of {showName} can start from it.</p>
      )}
    </section>
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
  // The picked layers (Evoni, 2026-10-21: arranging tools): the main one,
  // whose settings show, and any others picked with it.
  const [selectedId, setPrimary] = useState(null);
  const [extraIds, setExtraIds] = useState([]);
  const setSelectedId = useCallback((v) => { setPrimary(v); setExtraIds([]); }, []);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  const pickedIds = useMemo(() => (selectedId ? [selectedId, ...extraIds.filter((id) => id !== selectedId)] : []), [selectedId, extraIds]);
  const pickedRef = useRef([]);
  pickedRef.current = pickedIds;
  // A question asked on the page before something is replaced or deleted ({ text, yes }).
  const [asking, setAsking] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  // How far the canvas is zoomed in (Evoni, 2026-10-21): 100% fits the page.
  const [zoom, setZoom] = useState(1);
  const zoomBy = (d) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(1, Math.round((z + d) * 4) / 4)));
  // A small picture of the editor's thumbnail, for the YouTube previews.
  const [snapshot, setSnapshot] = useState(null);
  // The exact file "See it exactly" drew: { type: 'png' | 'jpeg', bytes }.
  const [exactFile, setExactFile] = useState(null);
  // Loading the episode, and what failed to load (with Retry).
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(null); // 'shows' | 'episodes' | 'episode'
  const [listsTick, setListsTick] = useState(0);
  const [episodeTick, setEpisodeTick] = useState(0);
  const retryLoad = () => (loadFailed === 'episode' ? setEpisodeTick((n) => n + 1) : setListsTick((n) => n + 1));
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
    youtubeThumbnailsApi.shows().then((list) => { setShows(list); setLoadFailed((f) => (f === 'shows' ? null : f)); }).catch((err) => {
      console.error('[YouTubeThumbnails] shows load failed:', err);
      setMessage({ type: 'error', text: 'Could not load the shows.' });
      setLoadFailed('shows');
    });
  }, [listsTick]);
  useEffect(() => {
    if (!showId) { setEpisodes([]); return; }
    youtubeThumbnailsApi.episodes(showId).then((list) => { setEpisodes(list); setLoadFailed((f) => (f === 'episodes' ? null : f)); }).catch((err) => {
      console.error('[YouTubeThumbnails] episodes load failed:', err);
      setLoadFailed('episodes');
      setMessage({ type: 'error', text: 'Could not load the episodes.' });
    });
  }, [showId, listsTick]);

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
    setLoading(true);
    youtubeThumbnailsApi.sources(episodeId).then((src) => {
      if (!live || !src) return;
      setLoading(false);
      setLoadFailed((f) => (f === 'episode' ? null : f));
      setSources(src);
      if (src.show?.id && src.show.id !== showId) setShowId(src.show.id);
      const lk = { layout: src.style?.layout || 'lala-left', accent: src.style?.accent, textColor: src.style?.textColor, dim: src.style?.dim };
      setLook(lk);
      edited.current = false;
      past.current = [];
      future.current = [];
      lastEditAt.current = 0;
      const asked = params.get('template');
      const chosen = asked ? (src.templates || []).find((t) => t.id === asked && t.spec) : null;
      if (chosen) {
        // Opened on one of the show's templates (the Templates page): the episode starts from it, and keeps it.
        edited.current = true;
        setSpecState(fillTemplate(chosen.spec, episodeContent(src)));
        setDraftNote(`Started from "${chosen.name}".`);
        setParams((p) => { const next = new URLSearchParams(p); next.delete('template'); return next; }, { replace: true });
      } else if (src.draft) {
        const { savedAt, ...draft } = src.draft;
        setSpecState(draft);
        setDraftNote(savedAt ? 'Your arrangement for this episode.' : null);
      } else {
        setSpecState(startingSpec(src, lk));
      }
    }).catch((err) => {
      console.error('[YouTubeThumbnails] sources load failed:', err);
      if (!live) return;
      setLoading(false);
      setLoadFailed('episode');
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not load the episode.' });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, episodeTick]);

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

  /** Picks a layer; with toggle, adds it to the picked ones or takes it away. */
  const select = useCallback((id, { toggle } = {}) => {
    if (!toggle || !id) { setSelectedId(id); return; }
    const now = pickedRef.current;
    if (now.includes(id)) {
      const rest = now.filter((x) => x !== id);
      setPrimary(rest[0] || null);
      setExtraIds(rest.slice(1));
    } else if (!now.length) {
      setSelectedId(id);
    } else {
      setExtraIds([...now.slice(1), id]);
    }
  }, [setSelectedId]);
  const selectMany = useCallback((ids) => { setPrimary(ids[0] || null); setExtraIds(ids.slice(1)); }, []);

  /** Several layers changed at once (moved together, lined up): one step to undo. */
  const editMany = useCallback((patches) => edit((s) => Object.entries(patches).reduce((acc, [id, patch]) => updateLayer(acc, id, patch), s)), [edit]);
  const align = (how) => edit((s) => alignLayers(s, pickedRef.current, how));
  const spread = (axis) => edit((s) => distributeLayers(s, pickedRef.current, axis));

  /** Removes the picked layers that are not locked. */
  const removePicked = useCallback(() => {
    const ids = pickedRef.current;
    const gone = (specRef.current?.layers || []).filter((l) => ids.includes(l.id) && !l.locked && l.kind !== 'shade').map((l) => l.id);
    if (!gone.length) return;
    edit((s) => gone.reduce((acc, id) => removeLayer(acc, id), s));
    const left = ids.filter((id) => !gone.includes(id));
    setPrimary(left[0] || null);
    setExtraIds(left.slice(1));
  }, [edit]);

  // Keys outside a field: Delete or Backspace removes the picked layers,
  // Esc picks nothing, ? shows the shortcuts. Ctrl/Cmd+Z undo,
  // Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+D copy the picked layer; not
  // while typing in a field (it has its own undo).
  useEffect(() => {
    const onKey = (e) => {
      if (!specRef.current) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey)) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && pickedRef.current.length) {
          e.preventDefault();
          removePicked();
        } else if (e.key === 'Escape') {
          setSelectedId(null);
          setShowKeys(false);
        } else if (e.key === '?') {
          setShowKeys((v) => !v);
        } else if (e.key === '+' || e.key === '=') {
          zoomBy(0.25);
        } else if (e.key === '-') {
          zoomBy(-0.25);
        } else if (e.key === '0') {
          setZoom(1);
        }
        return;
      }
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
  }, [undo, redo, duplicate, removePicked, setSelectedId]);

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

  // Colours picked with the free picker, newest first (this browser).
  const [recentColours, setRecentColours] = useState(readRecentColours);
  const remember = (c) => setRecentColours(rememberColour(c));

  const setColours = (patch) => {
    setLook((l) => ({ ...l, ...patch }));
    edit((s) => applyStyle(s, patch));
  };

  const ask = (text, yes) => setAsking({ text, yes });

  const pickLayout = (layout) => {
    if (edited.current) {
      ask('Start again from this layout? Moved, resized and turned layers go back to where the layout puts them.', () => applyLayout(layout));
      return;
    }
    applyLayout(layout);
  };

  const applyLayout = (layout) => {
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
    ask(`Start this episode again from ${sources.template ? "the show's default template" : "the show's layout"}? Undo goes back.`, () => {
      setSelectedId(null);
      edit(startingSpec(sources, look));
    });
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

  // The folders, Uploads first: this visit's, then the episode's earlier ones (kept on the server).
  const tree = useMemo(() => {
    const server = sources?.folders || [];
    const earlier = server.find((f) => f.key === 'uploads')?.items || [];
    const items = [...uploads, ...earlier.filter((e) => !uploads.some((u) => u.url === e.url))];
    return [...(items.length ? [{ key: 'uploads', label: 'Uploads', items }] : []), ...server.filter((f) => f.key !== 'uploads')];
  }, [uploads, sources]);

  // This arrangement on another episode, with its words and pictures (as the show's template would be).
  const [tryOn, setTryOn] = useState({ id: '', url: null, busy: false });
  useEffect(() => () => { if (tryOn.url) URL.revokeObjectURL(tryOn.url); }, [tryOn.url]);
  const tryOnEpisode = async (id) => {
    setTryOn((t) => ({ ...t, id, url: null }));
    if (!id) return;
    setTryOn({ id, url: null, busy: true });
    try {
      const other = await youtubeThumbnailsApi.sources(id);
      const blob = await youtubeThumbnailsApi.render(fillTemplate(specRef.current, episodeContent(other)));
      setTryOn({ id, url: URL.createObjectURL(blob), busy: false });
    } catch (err) {
      console.error('[YouTubeThumbnails] try on another episode failed:', err);
      setTryOn({ id, url: null, busy: false });
      setMessage({ type: 'error', text: err?.response?.data?.error || 'That episode could not be drawn with this arrangement.' });
    }
  };

  const pickShow = (id) => { setShowId(id); setEpisodeId(''); setParams(id ? { show: id } : {}); };
  // A template asked for in the address waits for the episode it is used on.
  const pickEpisode = (id) => {
    const template = params.get('template');
    setEpisodeId(id);
    setParams(id ? { show: showId, episode: id, ...(template ? { template } : {}) } : { show: showId, ...(template ? { template } : {}) });
  };

  const seeExactly = async () => {
    setRendering(true);
    try {
      const blob = await youtubeThumbnailsApi.render(spec);
      setExactFile({ type: /jpe?g/.test(blob.type || '') ? 'jpeg' : 'png', bytes: blob.size });
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
      setMessage({
        type: 'ok',
        text: out?.bytes
          ? `Saved as the episode's thumbnail (${out.type === 'jpeg' ? 'JPEG' : 'PNG'}, ${fileSize(out.bytes)}; YouTube allows 2 MB).`
          : "Saved as the episode's thumbnail.",
      });
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

  const removeSaved = (thumb) => ask('Delete this saved thumbnail? This cannot be undone.', () => deleteSaved(thumb));

  const deleteSaved = async (thumb) => {
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

  // The show's style (layout, colours, its own Lala), saved with a template.
  const saveShowStyle = async () => {
    // An episode's pose is that episode's look: the show keeps its own Lala.
    const lalaNow = roleSrc(spec, 'lala');
    const isPose = (sources?.poses?.lala || []).some((p) => p.url === lalaNow);
    const lalaUrl = isPose || !lalaNow ? (sources?.style?.lalaUrl || null) : lalaNow;
    await youtubeThumbnailsApi.saveStyle(sources.show.id, { layout: look.layout, accent: look.accent, textColor: look.textColor, dim: look.dim, lalaUrl });
  };

  const reloadTemplates = async () => {
    const templates = await youtubeThumbnailsApi.templates(sources.show.id);
    setSources((s) => ({ ...s, templates, template: templates.find((t) => t.isDefault)?.spec || null }));
  };

  /** One change to the show's templates: busy while it runs, the list again after, a message either way. */
  const templateChange = async (run, done, failed) => {
    if (!sources?.show?.id) return false;
    setBusy(true);
    try {
      await run();
      await reloadTemplates();
      setMessage({ type: 'ok', text: done });
      return true;
    } catch (err) {
      console.error('[YouTubeThumbnails] template change failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || failed });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createTemplate = (name, makeDefault) => templateChange(async () => {
    await saveShowStyle();
    await youtubeThumbnailsApi.createTemplate(sources.show.id, { name: name.trim(), spec, makeDefault });
  }, `Template "${name.trim()}" saved for ${sources?.show?.name}.${makeDefault ? ' Every episode starts from it.' : ''}`, 'The template could not be saved.');

  const renameTemplate = (t, name) => templateChange(
    () => youtubeThumbnailsApi.updateTemplate(sources.show.id, t.id, { name: name.trim() }),
    `Renamed to "${name.trim()}".`, 'The template could not be renamed.');

  const defaultTemplate = (t) => templateChange(
    () => youtubeThumbnailsApi.updateTemplate(sources.show.id, t.id, { isDefault: true }),
    `Every episode of ${sources?.show?.name} now starts from "${t.name}".`, 'Could not make that the default.');

  const updateTemplate = (t) => templateChange(async () => {
    await saveShowStyle();
    await youtubeThumbnailsApi.updateTemplate(sources.show.id, t.id, { spec });
  }, `"${t.name}" now has this arrangement.`, 'The template could not be updated.');

  const deleteTemplate = (t) => templateChange(
    () => youtubeThumbnailsApi.deleteTemplate(sources.show.id, t.id),
    `"${t.name}" is deleted.`, 'The template could not be deleted.');

  const useTemplate = (t) => {
    if (!t.spec || !sources) return;
    setSelectedId(null);
    edit(fillTemplate(t.spec, episodeContent(sources)));
    setMessage({ type: 'ok', text: `Started from "${t.name}". Undo goes back.` });
  };

  const fileName = useMemo(() => {
    const n = sources?.episode?.episode_number;
    return `${(sources?.show?.name || 'thumbnail').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${n ? `-ep${n}` : ''}.${exactFile?.type === 'jpeg' ? 'jpg' : 'png'}`;
  }, [sources, exactFile]);

  // What would go wrong where YouTube shows it (measured with the editor's fonts).
  const ytWarnings = useMemo(() => (spec ? youtubeWarnings(spec, measurer) : []), [spec, fontsTick]);

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

      {message && (
        <div className={`yts-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          {loadFailed && message.type === 'error' && (
            <button type="button" className="yts-btn" onClick={() => { setMessage(null); retryLoad(); }} data-testid="yts-retry">
              <RefreshCw size={15} aria-hidden /> Try again
            </button>
          )}
        </div>
      )}

      {asking && (
        <div className="yts-ask" role="group" aria-label="Confirm" data-testid="yts-ask">
          <p>{asking.text}</p>
          <button type="button" className="yts-btn is-primary" onClick={() => { const { yes } = asking; setAsking(null); yes(); }}>Yes</button>
          <button type="button" className="yts-btn" onClick={() => setAsking(null)}>No</button>
        </div>
      )}

      {!spec ? (
        loading ? (
          <div className="yts-empty" role="status" data-testid="yts-loading"><span className="yts-spinner" aria-hidden /><p>Loading the episode…</p></div>
        ) : (
          <div className="yts-empty"><LayoutTemplate size={36} aria-hidden /><p>Choose a show and an episode to make its thumbnail.</p></div>
        )
      ) : (
        <>
        <div className="yts-work">
          <section className="yts-stage" aria-label="Editor">
            <ThumbnailCanvas spec={spec} selectedId={selectedId} selectedIds={pickedIds} onSelect={select} onSelectMany={selectMany}
              fontsTick={fontsTick} onChange={(id, patch) => edit((s) => updateLayer(s, id, patch))} onChangeMany={editMany} onSnapshot={setSnapshot} zoom={zoom} />
            <div className="yts-zoom" role="group" aria-label="Zoom" data-testid="yts-zoom">
              <button type="button" className="yts-icon-btn" onClick={() => zoomBy(-0.25)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out (-)"><ZoomOut size={15} aria-hidden /></button>
              <span className="yts-zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button type="button" className="yts-icon-btn" onClick={() => zoomBy(0.25)} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in (+)"><ZoomIn size={15} aria-hidden /></button>
              {zoom > 1 && <button type="button" className="yts-history-btn" onClick={() => setZoom(1)}>Fit</button>}
            </div>
            <ArrangeBar count={pickedIds.length} onAlign={align} onSpread={spread} onClear={() => setSelectedId(null)} />
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
              <button type="button" className="yts-btn" onClick={undo} disabled={!past.current.length} data-testid="yts-undo" title="Undo (Ctrl+Z)">
                <Undo2 size={16} aria-hidden /> Undo
              </button>
              <button type="button" className="yts-btn" onClick={redo} disabled={!future.current.length} data-testid="yts-redo" title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={16} aria-hidden /> Redo
              </button>
              <button type="button" className="yts-btn" onClick={resetToTemplate} data-testid="yts-reset">
                <RotateCcw size={16} aria-hidden /> Start again
              </button>
              <button type="button" className="yts-btn" onClick={() => setShowKeys((v) => !v)} aria-expanded={showKeys} data-testid="yts-keys-btn" title="Keyboard shortcuts (?)">
                <Keyboard size={16} aria-hidden /> Shortcuts
              </button>
            </div>
            {showKeys && <ShortcutsPanel onClose={() => setShowKeys(false)} />}
            <YouTubePreviews src={snapshot} title={layerOf(spec, 'title')?.text || sources?.episode?.title} channel={sources?.show?.name}
              warnings={ytWarnings} onPick={(id) => setSelectedId(id)} />
            {exact && (
              <figure className="yts-exact" data-testid="yts-exact-figure">
                <img src={exact} alt="The thumbnail exactly as it will be saved" data-testid="yts-preview" />
                <figcaption>
                  Exactly as it will be saved{exactFile ? ` (${exactFile.type === 'jpeg' ? 'JPEG' : 'PNG'}, ${fileSize(exactFile.bytes)}` : ''}{exactFile?.type === 'jpeg' ? '; over 2 MB as a PNG, so saved as a JPEG for YouTube)' : exactFile ? '; YouTube allows 2 MB)' : ''}.
                  <a className="yts-btn" href={exact} download={fileName}><Download size={16} aria-hidden /> Download</a>
                  <button type="button" className="yts-icon-btn" onClick={() => setExact(null)} aria-label="Close the exact view"><X size={15} aria-hidden /></button>
                </figcaption>
              </figure>
            )}
            <div className="yts-try" data-testid="yts-try">
              <label className="yts-select">
                <span>Try it on another episode</span>
                <select value={tryOn.id} onChange={(e) => tryOnEpisode(e.target.value)} aria-label="Try it on another episode" disabled={tryOn.busy}>
                  <option value="">Choose an episode</option>
                  {episodes.filter((e) => e.id !== episodeId).map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `${e.episode_number}. ` : ''}{e.title || 'Untitled'}</option>)}
                </select>
              </label>
              {tryOn.busy && <span className="yts-note">Drawing…</span>}
            </div>
            {tryOn.url && (
              <figure className="yts-exact" data-testid="yts-try-figure">
                <img src={tryOn.url} alt="This arrangement on the other episode" />
                <figcaption>
                  This arrangement with that episode's words and pictures, as the show's template would give it.
                  <button type="button" className="yts-icon-btn" onClick={() => setTryOn({ id: '', url: null, busy: false })} aria-label="Close the other episode"><X size={15} aria-hidden /></button>
                </figcaption>
              </figure>
            )}
            {saved && (
              <p className="yts-saved"><Check size={16} aria-hidden /> Saved. <Link to={`/episodes/${episodeId}?tab=production`}>Back to Production</Link></p>
            )}
            <LayerSettings layer={picked} onChange={(patch) => edit((s) => updateLayer(s, picked.id, patch))}
              colours={[...ACCENTS, ...recentColours.filter((c) => !ACCENTS.includes(c))]} onRemember={remember} />
            <LayersList spec={spec} selectedId={selectedId} pickedIds={pickedIds} onSelect={select} onChange={edit} onDuplicate={duplicate} />
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
                {[...ACCENTS, ...recentColours.filter((c) => !ACCENTS.includes(c))].map((c) => (
                  <button key={c} type="button" className={`yts-swatch${shade?.accent === c ? ' is-on' : ''}`} style={{ background: c }}
                    aria-label={`Accent ${c}`} aria-pressed={shade?.accent === c} onClick={() => setColours({ accent: c })} />
                ))}
                <label className="yts-swatch-any" title="Any colour">
                  <Palette size={15} aria-hidden />
                  <input type="color" className="yts-color" value={shade?.accent || ACCENTS[0]} aria-label="Any accent colour"
                    onChange={(e) => setColours({ accent: e.target.value.toUpperCase() })} onBlur={(e) => remember(e.target.value)} />
                </label>
              </div>
            </fieldset>
            <div className="yts-row">
              <label className="yts-field">
                <span className="yts-label">Title colour</span>
                <span className="yts-title-colour">
                  <select className="yts-input" value={layerOf(spec, 'title')?.color || TEXT_COLORS[0].value} onChange={(e) => setColours({ textColor: e.target.value })} aria-label="Title colour">
                    {TEXT_COLORS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    {recentColours.filter((c) => !TEXT_COLORS.some((t) => t.value === c)).map((c) => <option key={c} value={c}>Recent {c}</option>)}
                    {(() => {
                      const now = layerOf(spec, 'title')?.color;
                      return now && !TEXT_COLORS.some((t) => t.value === now) && !recentColours.includes(now) ? <option value={now}>Your colour {now}</option> : null;
                    })()}
                  </select>
                  <input type="color" className="yts-color" value={layerOf(spec, 'title')?.color || TEXT_COLORS[0].value} aria-label="Any title colour"
                    onChange={(e) => setColours({ textColor: e.target.value.toUpperCase() })} onBlur={(e) => remember(e.target.value)} />
                </span>
              </label>
              <label className="yts-field">
                <span className="yts-label">Darken the background</span>
                <input type="range" min="0" max="0.8" step="0.05" value={shade?.dim ?? 0} onChange={(e) => setColours({ dim: Number(e.target.value) })} aria-label="Darken the background" disabled={!shade} />
              </label>
            </div>
          </section>
        </div>
        {sources?.show?.id && (
          <TemplatesBar showName={sources.show.name} templates={sources.templates || []} busy={busy}
            onUse={useTemplate} onCreate={createTemplate} onRename={renameTemplate} onDefault={defaultTemplate}
            onUpdate={updateTemplate} onDelete={deleteTemplate} />
        )}
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
