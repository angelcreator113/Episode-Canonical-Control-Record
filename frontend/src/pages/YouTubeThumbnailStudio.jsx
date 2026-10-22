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
  Youtube, Upload, Download, ChevronLeft, Save, Palette, ImageOff, Check, LayoutTemplate, Sparkles, Star, Trash2, History, Folder, ChevronRight,
  Eye, EyeOff, ArrowUp, ArrowDown, Type, RotateCcw, ScanEye, X, Lock, LockOpen, Copy, Undo2, Redo2, Plus, Pencil, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Keyboard, RefreshCw, FlipHorizontal2, ZoomIn, ZoomOut, ClipboardCopy, ClipboardPaste, Columns2, CopyPlus, ArrowRight, Circle, Tag, LayoutGrid, EllipsisVertical, Grid3x3, SquareDashed, GripVertical, ListChecks, Shapes, Bandage, StickyNote, Eclipse, Wand2,
} from 'lucide-react';
import {
  youtubeThumbnailsApi, LAYOUTS, ACCENTS, TEXT_COLORS, readRecentColours, rememberColour, episodeContent, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import {
  FONTS, presetLayers, fillTemplate, applyStyle, setRoleContent, layerOf, updateLayer, moveLayer, placeLayer, removeLayer,
  addText, addPicture, addPieceCard, layerName, loadThumbnailFonts, OUTLINE, BOX_COLOR, BOX_OPACITY, STICKER_EDGE, duplicateLayer, WIDTH, HEIGHT, CARD_COLOR,
  alignLayers, distributeLayers, copyLayers, pasteLayers, CLIPBOARD_KEY, figureLayers, toggleFigure, clearFigure, measurer, youtubeWarnings, fixWarning, fixAllWarnings, fileSize, YOUTUBE_SIZES, GLOW_COLOR, FADE_COLOR, EFFECT_SIZE, SHAPES, WORDS_SHAPES, addShape,
} from '../lib/thumbnailLayers';
import ThumbnailCanvas from '../components/Thumbnails/ThumbnailCanvas';
import ThumbnailSeason from '../components/Thumbnails/ThumbnailSeason';
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

function PickButton({ it, on, onPick }) {
  return (
    <button type="button" className={`yts-pick${on ? ' is-on' : ''}`} aria-pressed={on}
      onClick={() => onPick(it.url, it.label)} title={it.label}>
      <PreviewImg url={it.url} alt={it.label || ''} />
    </button>
  );
}

// The tabs over the episode's pictures (Evoni, 2026-10-21 redesign), in the
// order she reaches for them; only the folders this episode has.
const ASSET_TABS = [
  ['outfit', 'Outfit'], ['library', 'Library'], ['scene-sets', 'Scene sets'], ['poses', 'Poses'], ['documents', 'Documents'], ['uploads', 'Uploads'],
];

/** Assets for this episode: a tab per picture folder; picking one adds it as a layer. */
function AssetTabs({ tree, onPick, onUpload, uploading }) {
  const tabs = ASSET_TABS.filter(([key]) => (tree || []).some((f) => f.key === key && folderCount(f) > 0));
  const [tab, setTab] = useState(null);
  const on = tabs.some(([key]) => key === tab) ? tab : (tabs.find(([key]) => key === 'outfit') || tabs.find(([key]) => key === 'documents') || tabs[0] || [null])[0];
  return (
    <>
      {tabs.length > 1 && (
        <div className="yts-tabs" role="tablist" aria-label="Pictures">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={on === key} className={`yts-tab${on === key ? ' is-on' : ''}`}
              onClick={() => setTab(key)} data-testid={`yts-asset-tab-${key}`}>{label}</button>
          ))}
        </div>
      )}
      <FolderPicker key={on || 'all'} title="Add a picture" testid="yts-add-picture" whole tree={tree} start={on ? [on] : []}
        onPick={onPick} uploading={uploading} onUpload={(f) => { setTab('uploads'); onUpload(f); }} />
    </>
  );
}

/**
 * A picture picker in folders (Evoni, 2026-10-21): None and Upload, where
 * it is ("All folders › Character poses › Lala"), the folders here, and the
 * pictures here. It opens in the first of `start` that has pictures (the
 * background in Scene sets, Lala in her poses); any folder is a click away.
 * Without onNone there is no None button (adding a picture).
 */
function FolderPicker({ title, tree, start, value, values = null, onPick, onUpload, uploading = false, onNone, noneLabel, testid, whole = false, hint = null }) {
  const inputRef = useRef(null);
  const startKey = firstFolder(tree, start);
  const [at, setAt] = useState(startKey);
  useEffect(() => { setAt(startKey); }, [startKey]);
  const path = folderPath(tree, at);
  const here = path.at(-1) || null;
  const folders = here ? (here.folders || []) : (tree || []);
  const items = here?.items || [];
  const grid = `yts-grid${whole ? ' is-whole' : ''}`;
  // Several at once (values) or one (value).
  const isOn = (url) => (values ? values.includes(url) : value === url);
  const none = values ? !values.length : !value;
  return (
    <fieldset className="yts-field" data-testid={testid}>
      <legend className="yts-label">{title}</legend>
      {hint && <p className="yts-note">{hint}</p>}
      <div className={grid}>
        {onNone && (
          <button type="button" className={`yts-pick is-none${none ? ' is-on' : ''}`} aria-pressed={none} onClick={onNone}>
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
          {items.map((it) => <PickButton key={it.url} it={it} on={isOn(it.url)} onPick={onPick} />)}
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
function PictureEffects({ layer, onChange, colours = [], onRemember, onCutOut, cutting = false }) {
  const card = layer.frame === 'polaroid';
  const cardColour = layer.cardColor || CARD_COLOR;
  return (
    <div className="yts-text-tools" data-testid="yts-picture-effects">
      {onCutOut && layer.src && (
        // AI help (Evoni, 2026-10-21): the background off a picture, e.g. one uploaded straight here; within the image budget.
        <div className="yts-actions">
          <button type="button" className="yts-btn" onClick={() => onCutOut(layer)} disabled={cutting} data-testid="yts-cut-out"
            title="Removes the background with AI (counts toward the daily image budget); the cut-out is kept in Uploads">
            <Wand2 size={16} aria-hidden /> {cutting ? 'Removing the background…' : 'Remove the background (AI)'}
          </button>
        </div>
      )}
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
      <label className="yts-field">
        <span className="yts-label">Blur ({layer.blur || 0})</span>
        <input type="range" min="0" max="40" step="1" value={layer.blur || 0} onChange={(e) => onChange({ blur: Number(e.target.value) })} aria-label="Blur" />
      </label>
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

const SHAPE_ICONS = { arrow: ArrowRight, ring: Circle, burst: Star, sparkle: Sparkles, tag: Tag, tape: Bandage, paper: StickyNote, shadow: Eclipse };

/** Add a sticker (Evoni, 2026-10-21: stickers and shapes): an arrow, a circle, a burst, sparkles, a price tag; tape, paper, a shadow (redesign). */
function StickerRow({ onAdd }) {
  return (
    <div className="yts-stickers" role="group" aria-label="Add a sticker" data-testid="yts-stickers">
      <span className="yts-label">Stickers &amp; elements</span>
      <div className="yts-actions">
        {SHAPES.map((sh) => {
          const Icon = SHAPE_ICONS[sh.key];
          return (
            <button key={sh.key} type="button" className="yts-btn" onClick={() => onAdd(sh.key)} aria-label={`Add ${sh.label.toLowerCase()}`}>
              <Icon size={16} aria-hidden /> {sh.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A sticker's colours, outline, and a burst's, a tag's or a paper note's words. */
function ShapeSettings({ layer, onChange }) {
  const worded = WORDS_SHAPES.includes(layer.shape);
  const width = layer.strokeWidth ?? 6;
  return (
    <div className="yts-text-tools" data-testid="yts-shape-settings">
      {worded && (
        <input className="yts-input" value={layer.text || ''} maxLength={layer.shape === 'paper' ? 60 : 16} aria-label="Sticker words"
          onChange={(e) => onChange({ text: e.target.value })} />
      )}
      <div className="yts-row">
        <label className="yts-field is-small">
          <span className="yts-label">{layer.shape === 'ring' ? 'Colour' : 'Fill'}</span>
          <input type="color" className="yts-color" value={layer.fill} aria-label="Sticker colour"
            onChange={(e) => onChange({ fill: e.target.value.toUpperCase() })} />
        </label>
        {layer.shape === 'ring' && (
          <label className="yts-field">
            <span className="yts-label">Thickness ({layer.thickness || 16})</span>
            <input type="range" min="4" max="60" step="2" value={layer.thickness || 16} aria-label="Circle thickness"
              onChange={(e) => onChange({ thickness: Number(e.target.value) })} />
          </label>
        )}
        {worded && (
          <>
            <label className="yts-field">
              <span className="yts-label">Font</span>
              <select className="yts-input" value={layer.font || 'sans'} onChange={(e) => onChange({ font: e.target.value })} aria-label="Sticker font">
                {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </select>
            </label>
            <label className="yts-field is-small">
              <span className="yts-label">Words colour</span>
              <input type="color" className="yts-color" value={layer.color || OUTLINE} aria-label="Sticker words colour"
                onChange={(e) => onChange({ color: e.target.value.toUpperCase() })} />
            </label>
          </>
        )}
      </div>
      <label className="yts-check">
        <input type="checkbox" checked={Boolean(layer.stroke)} aria-label="Sticker outline"
          onChange={(e) => onChange({ stroke: e.target.checked ? OUTLINE : null, strokeWidth: width || 6 })} />
        Outline
      </label>
      {layer.stroke && (
        <div className="yts-row">
          <label className="yts-field is-small">
            <span className="yts-label">Outline colour</span>
            <input type="color" className="yts-color" value={layer.stroke} aria-label="Sticker outline colour"
              onChange={(e) => onChange({ stroke: e.target.value.toUpperCase() })} />
          </label>
          <label className="yts-field">
            <span className="yts-label">Outline width ({width})</span>
            <input type="range" min="1" max="24" step="1" value={width} aria-label="Sticker outline width"
              onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} />
          </label>
        </div>
      )}
      {layer.shape === 'arrow' && <p className="yts-note">Turn the arrow with the handle above it to aim it.</p>}
    </div>
  );
}

function LayerSettings({ layer, onChange, colours, onRemember, onCutOut, cutting }) {
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
      {layer.kind === 'shape' && <ShapeSettings layer={layer} onChange={onChange} />}
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
      {layer.kind === 'image' && <PictureEffects layer={layer} onChange={onChange} colours={colours} onRemember={onRemember} onCutOut={onCutOut} cutting={cutting} />}
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

/** A title idea's hook as a burst sticker with those words (AI help). */
const addHook = (spec, hook) => {
  const next = addShape(spec, 'burst');
  return updateLayer(next, next.layers.at(-1).id, { text: hook });
};

/** A small picture of a layer for its row in Layers (Evoni, 2026-10-21 redesign). */
function LayerThumb({ l }) {
  let inner;
  if (l.kind === 'image') inner = l.src ? <PreviewImg url={l.src} alt="" /> : <ImageOff size={14} aria-hidden />;
  else if (l.kind === 'badge') inner = <span className="yts-layer-thumb-words">{String(l.text || '').slice(0, 5)}</span>;
  else if (l.kind === 'checklist') inner = <ListChecks size={15} aria-hidden />;
  else if (l.kind === 'shape') { const Icon = SHAPE_ICONS[l.shape] || Shapes; inner = <Icon size={15} aria-hidden />; }
  else if (l.kind === 'shade') inner = <span className="yts-layer-thumb-shade" style={{ background: l.accent }} />;
  else inner = <Type size={15} aria-hidden />;
  return <span className={`yts-layer-thumb is-${l.kind}`} aria-hidden>{inner}</span>;
}

/** The layers, front first: pick, hide or show, lock, copy, move forward or back, remove. */
const LAYERS_SHORT = 6;
const TOAST_MS = 5000;

function LayersList({ spec, selectedId, pickedIds, onSelect, onChange, onDuplicate }) {
  const picked = new Set(pickedIds || (selectedId ? [selectedId] : []));
  const front = [...(spec?.layers || [])].reverse();
  // Dragged by its row (Evoni, 2026-10-21 redesign); the arrows still move one step.
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const done = () => { setDrag(null); setOver(null); };
  // A long list (Evoni, 2026-10-22 layout list): the top six, and any picked
  // one further down, until "Show all".
  const [all, setAll] = useState(false);
  const long = front.length > LAYERS_SHORT + 2;
  const rows = long && !all ? front.filter((l, i) => i < LAYERS_SHORT || picked.has(l.id)) : front;
  return (
    <fieldset className="yts-field" data-testid="yts-layers">
      <legend className="yts-label">Layers</legend>
      <ul className="yts-layers">
        {rows.map((l) => { const i = front.indexOf(l); return (
          <li key={l.id} className={`yts-layer${picked.has(l.id) ? ' is-on' : ''}${l.visible ? '' : ' is-hidden'}${over === l.id ? ' is-over' : ''}${drag === l.id ? ' is-dragged' : ''}`}
            draggable data-testid={`yts-layer-${l.id}`}
            onDragStart={(e) => { setDrag(l.id); e.dataTransfer?.setData?.('text/plain', l.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (drag && drag !== l.id) { e.preventDefault(); setOver(l.id); } }}
            onDragLeave={() => setOver((o) => (o === l.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (drag && drag !== l.id) onChange(placeLayer(spec, drag, l.id)); done(); }}
            onDragEnd={done}>
            <GripVertical size={14} className="yts-layer-grip" aria-hidden />
            <LayerThumb l={l} />
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
        ); })}
      </ul>
      {long && (
        <button type="button" className="yts-more-layers" onClick={() => setAll((v) => !v)} aria-expanded={all} data-testid="yts-layers-all">
          {all ? 'Show fewer' : `Show all ${front.length} layers`}
        </button>
      )}
    </fieldset>
  );
}

/** What a role shows now (for the controls). */
const roleText = (spec, role) => layerOf(spec, role)?.text || '';
const roleSrc = (spec, role) => layerOf(spec, role)?.src || null;

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
function ArrangeBar({ count, removable = 0, onAlign, onSpread, onClear, onCopy, onRemove }) {
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
      {/* Copy to paste on another episode (Evoni, 2026-10-21). */}
      <button type="button" className="yts-btn" onClick={onCopy} title="Copy, to paste on this or another episode (Ctrl+C)">
        <ClipboardCopy size={15} aria-hidden /> Copy
      </button>
      {/* Remove what is picked, right where it is picked (Evoni, 2026-10-21: "no way of deleting anything"). */}
      <button type="button" className="yts-btn yts-remove-btn" onClick={onRemove} disabled={!removable}
        title={removable ? 'Remove (Delete key); Undo brings it back' : 'Locked: unlock it to remove it'}>
        <Trash2 size={15} aria-hidden /> {removable > 1 ? `Remove ${removable}` : 'Remove'}
      </button>
    </div>
  );
}

/** The canvas's ⋮ menu: what is used now and then (the whole season, start again, the shortcuts). */
// A phone (Evoni, 2026-10-22 layout list): the width the app's other pages
// call a phone (EpisodeScriptTab). No matchMedia (tests): not a phone.
const PHONE = '(max-width: 760px)';
const phoneQuery = () => {
  try { return window.matchMedia?.(PHONE) || null; } catch (err) { console.error('[YouTubeThumbnail] width check failed:', err); return null; }
};
function useIsPhone() {
  const [phone, setPhone] = useState(() => Boolean(phoneQuery()?.matches));
  useEffect(() => {
    const mq = phoneQuery();
    if (!mq?.addEventListener) return undefined;
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/** True once the element has scrolled up out of view (not when it is below). */
function useScrolledAway(ref, on = true) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver === 'undefined') { setAway(false); return undefined; }
    const io = new IntersectionObserver(([e]) => setAway(e.intersectionRatio < 0.25 && e.boundingClientRect.top < 0), { threshold: [0, 0.25, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, on]);
  return away;
}

// On a phone the settings show one section at a time (Evoni, 2026-10-22
// layout list), in tabs under the canvas.
const PHONE_TABS = [
  ['layers', 'Layers'], ['layout', 'Layout'], ['text', 'Text'], ['assets', 'Assets'],
  ['characters', 'Characters'], ['background', 'Background'], ['colours', 'Colours'], ['saved', 'Saved'],
];

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="yts-menu" ref={box}>
      <button type="button" className="yts-icon-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        aria-label="More" title="More" data-testid="yts-more-btn"><EllipsisVertical size={15} aria-hidden /></button>
      {open && (
        <ul className="yts-menu-list" role="menu" aria-label="More">
          {items.map(({ key, testid, icon: Icon, label, onChoose, on, disabled }) => (
            <li key={key} role="none">
              <button type="button" role={on === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={on === undefined ? undefined : on}
                className={`yts-menu-item${on ? ' is-on' : ''}`} data-testid={testid} disabled={disabled} onClick={() => { setOpen(false); onChoose(); }}>
                <Icon size={15} aria-hidden /> {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The thumbnail where YouTube shows it (Evoni, 2026-10-21): in search, on
 * a phone and beside a video, with the timestamp over its corner; and what
 * would go wrong there (words too small, words under the timestamp).
 * Picking a warning picks its layer.
 */
function YouTubePreviews({ src, title, channel, warnings, onPick, onFix, onFixAll, onSmallOk }) {
  // What a fix could not do, said under the warnings (Evoni, 2026-10-21: fix them from here).
  const [cant, setCant] = useState(null);
  if (!src) return null;
  const nameOf = (w) => w.text.split(' is about ')[0].split(' sits under ')[0];
  const fix = (w) => {
    setCant(onFix(w) ? null : w.kind === 'small'
      ? `${nameOf(w)} cannot be made readable beside a video without outgrowing the thumbnail. Use fewer words, or keep it small on purpose.`
      : `${nameOf(w)} is too big to move clear of the timestamp. Make it smaller first.`);
  };
  const fixAll = () => {
    const left = onFixAll();
    setCant(left.length ? `Fixed what could be. Still to do: ${left.map(nameOf).join(', ')}.` : null);
  };
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
        <>
          <ul className="yts-yt-warn" data-testid="yts-yt-warnings">
            {warnings.map((w) => (
              <li key={`${w.id}-${w.kind}`} className="yts-yt-warn-row">
                <button type="button" className="yts-yt-warn-btn" onClick={() => onPick(w.id)}>{w.text}</button>
                <div className="yts-actions">
                  <button type="button" className="yts-btn" onClick={() => fix(w)}>
                    {w.kind === 'small' ? 'Make it readable' : 'Move it'}
                  </button>
                  {w.kind === 'small' && (
                    <button type="button" className="yts-btn" onClick={() => { setCant(null); onSmallOk(w.id); }}
                      title="Stop warning about this one: it is small on purpose">Small on purpose</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {warnings.length > 1 && (
            <div className="yts-actions">
              <button type="button" className="yts-btn is-primary" onClick={fixAll}>Fix all</button>
            </div>
          )}
        </>
      ) : (
        <p className="yts-note">Readable at every size, and clear of the timestamp.</p>
      )}
      {cant && <p className="yts-note" role="status">{cant}</p>}
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
  ['Ctrl+C / Ctrl+V', 'Copy the picked layers; paste them here or on another episode'],
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

/** How a version reads where YouTube shows it: "Reads at every size" or how many warnings. */
const warningsLine = (n) => (n ? `${n} warning${n === 1 ? '' : 's'}` : 'Reads at every size');

/**
 * Compare (Evoni, 2026-10-21: versions to compare): the thumbnail as it is
 * now and each kept version side by side, at YouTube's search size and
 * beside a video, with the timestamp, and how each reads there.
 */
function CompareVersions({ now, nowWarnings, versions, warningsOf, busy, onUse }) {
  const columns = [
    ...(now ? [{ id: 'now', name: 'Now', src: now, warnings: nowWarnings, now: true }] : []),
    ...versions.map((v) => ({ id: v.id, name: v.name, url: v.previewUrl, warnings: warningsOf(v), version: v })),
  ];
  return (
    <ul className="yts-compare" data-testid="yts-compare">
      {columns.map((c) => (
        <li key={c.id} className={`yts-compare-col${c.now ? ' is-now' : ''}`} data-testid={`yts-compare-${c.id}`}>
          <p className="yts-template-name">{c.name}</p>
          {[360, 168].map((width) => (
            <div key={width} className="yts-yt-thumb" style={{ width }}>
              {c.src ? <img src={c.src} alt={`${c.name}, ${width} pixels wide`} /> : c.url ? <PreviewImg url={c.url} alt={`${c.name}, ${width} pixels wide`} /> : null}
              <span className="yts-yt-time" aria-hidden>12:34</span>
            </div>
          ))}
          <p className={`yts-note${c.warnings ? ' is-warn' : ''}`}>{warningsLine(c.warnings)}</p>
          {c.version && (
            <button type="button" className="yts-history-btn" onClick={() => onUse(c.version)} disabled={busy || !c.version.spec}>Use this one</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The episode's versions (Evoni, 2026-10-21: "versions to compare"): keep
 * the arrangement as Version A, B, ...; each with its picture; use one,
 * rename it, update it with the arrangement, delete it; compare them all.
 */
function VersionsBar({ versions, busy, now, nowWarnings, warningsOf, onKeep, onUse, onRename, onUpdate, onDelete }) {
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [asking, setAsking] = useState(null); // { id, kind: 'update' | 'delete' }
  const [comparing, setComparing] = useState(false);
  const rename = async (e, v) => {
    e.preventDefault();
    if (renaming.name.trim() === v.name || await onRename(v, renaming.name)) setRenaming(null);
  };
  const answer = async (v) => {
    const { kind } = asking;
    setAsking(null);
    await (kind === 'delete' ? onDelete(v) : onUpdate(v));
  };
  return (
    <section className="yts-templates" aria-label="Versions to compare" data-testid="yts-versions">
      <div className="yts-templates-head">
        <p className="yts-label"><Columns2 size={16} aria-hidden /> Versions to compare</p>
        <div className="yts-actions">
          {versions.length > 0 && (
            <button type="button" className={`yts-btn${comparing ? ' is-primary' : ''}`} aria-pressed={comparing} onClick={() => setComparing((c) => !c)}>
              <Columns2 size={16} aria-hidden /> {comparing ? 'Close compare' : 'Compare'}
            </button>
          )}
          <button type="button" className="yts-btn" onClick={onKeep} disabled={busy} data-testid="yts-keep-version">
            <CopyPlus size={16} aria-hidden /> Keep as a version
          </button>
        </div>
      </div>
      {comparing && versions.length > 0 && (
        <CompareVersions now={now} nowWarnings={nowWarnings} versions={versions} warningsOf={warningsOf} busy={busy}
          onUse={(v) => { setComparing(false); onUse(v); }} />
      )}
      {versions.length ? (
        <ul className="yts-template-grid">
          {versions.map((v) => (
            <li key={v.id} className="yts-template" data-testid={`yts-version-${v.id}`}>
              <button type="button" className="yts-template-pic" onClick={() => onUse(v)} disabled={busy || !v.spec} title={`Use ${v.name}`}>
                {v.previewUrl ? <PreviewImg url={v.previewUrl} alt="" /> : <Columns2 size={28} aria-hidden />}
              </button>
              {renaming?.id === v.id ? (
                <form className="yts-template-form" onSubmit={(e) => rename(e, v)}>
                  <input className="yts-input" value={renaming.name} maxLength={80} autoFocus aria-label={`New name for ${v.name}`}
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} />
                  <button type="submit" className="yts-history-btn" disabled={busy || !renaming.name.trim()}>Save</button>
                  <button type="button" className="yts-history-btn" onClick={() => setRenaming(null)}>Cancel</button>
                </form>
              ) : (
                <p className="yts-template-name" onDoubleClick={() => setRenaming({ id: v.id, name: v.name })} title="Double-click to rename">
                  {v.name} <span className="yts-version-reads">· {warningsLine(warningsOf(v))}</span>
                </p>
              )}
              {asking?.id === v.id ? (
                <div className="yts-history-row" role="group" aria-label="Confirm">
                  <span className="yts-template-ask">{asking.kind === 'delete' ? `Delete "${v.name}"?` : `Replace "${v.name}" with this arrangement?`}</span>
                  <button type="button" className="yts-history-btn" onClick={() => answer(v)}>Yes</button>
                  <button type="button" className="yts-history-btn" onClick={() => setAsking(null)}>No</button>
                </div>
              ) : (
                <div className="yts-history-row">
                  <button type="button" className="yts-history-btn" onClick={() => onUse(v)} disabled={busy || !v.spec}>Use</button>
                  <button type="button" className="yts-history-btn" onClick={() => setRenaming({ id: v.id, name: v.name })} disabled={busy}>
                    <Pencil size={13} aria-hidden /> Rename
                  </button>
                  <button type="button" className="yts-history-btn" onClick={() => setAsking({ id: v.id, kind: 'update' })} disabled={busy}>
                    Update with this
                  </button>
                  <button type="button" className="yts-history-btn is-danger" onClick={() => setAsking({ id: v.id, kind: 'delete' })} disabled={busy}
                    aria-label={`Delete ${v.name}`}><Trash2 size={13} aria-hidden /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="yts-note">Try a few looks: keep this arrangement as a version, change it, keep another, then compare them side by side at YouTube's sizes.</p>
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
  // A success fades by itself (Evoni, 2026-10-22 layout list); an error stays until closed.
  useEffect(() => {
    if (message?.type !== 'ok') return undefined;
    const t = setTimeout(() => setMessage((m) => (m === message ? null : m)), TOAST_MS);
    return () => clearTimeout(t);
  }, [message]);
  const [draftNote, setDraftNote] = useState(null);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const [fontsTick, setFontsTick] = useState(0);
  // A whole season at once (Evoni, 2026-10-21): the grid in place of the editor.
  const [season, setSeason] = useState(false);
  // The grid and safe zones over the canvas (Evoni, 2026-10-21 redesign); never saved.
  const [marks, setMarks] = useState({ grid: false, safe: false });
  // On a phone (Evoni, 2026-10-22): the toolbar on one row, the picked layer's
  // settings in a sheet from the bottom, and a small picture of the thumbnail
  // pinned at the top once the canvas has scrolled away.
  const phone = useIsPhone();
  const stageRef = useRef(null);
  const [phoneTab, setPhoneTab] = useState('layers');
  // A section shows when its tab is open on a phone; always on a wider screen.
  const shown = (tab) => !phone || phoneTab === tab;
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


  /** Where an episode starts: the show's template, else the show's layout. */
  const startingSpec = useCallback((src, lk) => (src.template
    ? fillTemplate(src.template, episodeContent(src))
    : presetLayers(lk.layout, episodeContent(src), lk)), []);

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
      // The server's reason, so a failure can be told apart (Evoni, 2026-10-21).
      const why = err?.response?.data?.error || err?.response?.data?.message;
      const status = err?.response?.status;
      setMessage({ type: 'error', text: `Could not load the saved thumbnails${status ? ` (${status}${why ? `: ${why}` : ''})` : ''}.` });
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

  // What was copied, kept on this browser so it can be pasted on another episode (Evoni, 2026-10-21).
  const readClip = () => {
    try {
      const raw = window.localStorage.getItem(CLIPBOARD_KEY);
      const c = raw ? JSON.parse(raw) : null;
      return Array.isArray(c?.layers) && c.layers.length ? c : null;
    } catch (err) {
      console.error('[YouTubeThumbnails] the copied layers could not be read:', err);
      return null;
    }
  };
  const [clip, setClip] = useState(readClip);
  useEffect(() => {
    // Copied in another tab: the Paste button follows.
    const onStorage = (e) => { if (e.key === CLIPBOARD_KEY) setClip(readClip()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const clipRef = useRef(null);
  clipRef.current = clip;
  const sourcesRef = useRef(null);
  sourcesRef.current = sources;

  const copyPicked = useCallback(() => {
    const ep = sourcesRef.current?.episode;
    const c = copyLayers(specRef.current, pickedRef.current, ep ? { episodeId: ep.id, title: ep.title || null } : null);
    if (!c) return;
    try {
      window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(c));
    } catch (err) {
      // Kept for this page only; another tab or a reload will not have it.
      console.error('[YouTubeThumbnails] the copied layers could not be kept on this browser:', err);
    }
    setClip(c);
    const n = c.layers.length;
    setMessage({ type: 'ok', text: `Copied ${n === 1 ? '1 layer' : `${n} layers`}. Open any episode and press Paste (Ctrl+V).` });
  }, []);

  const pasteClip = useCallback(() => {
    const c = clipRef.current;
    if (!c || !specRef.current) return;
    const here = sourcesRef.current?.episode?.id;
    const { spec: next, ids } = pasteLayers(specRef.current, c, { nudge: Boolean(here) && c.from?.episodeId === here });
    if (!ids.length) return;
    edit(next);
    setPrimary(ids[0]);
    setExtraIds(ids.slice(1));
    const from = c.from?.title && c.from.episodeId !== here ? ` from "${c.from.title}"` : '';
    setMessage({ type: 'ok', text: `Pasted ${ids.length === 1 ? '1 layer' : `${ids.length} layers`}${from}. Undo takes them away.` });
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
  // Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+D copy the picked layer,
  // Ctrl/Cmd+C and V copy and paste (another episode too); not
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
      } else if (key === 'c' && pickedRef.current.length) {
        e.preventDefault();
        copyPicked();
      } else if (key === 'v' && clipRef.current) {
        e.preventDefault();
        pasteClip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, duplicate, removePicked, setSelectedId, copyPicked, pasteClip]);

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

  // AI help (Evoni, 2026-10-21), within the daily budgets: title ideas; a picture's background removed.
  const [ideas, setIdeas] = useState({ busy: false, list: [] });
  useEffect(() => { setIdeas({ busy: false, list: [] }); }, [episodeId]);
  const askIdeas = async () => {
    setIdeas((x) => ({ ...x, busy: true }));
    try {
      const list = await youtubeThumbnailsApi.titleIdeas(episodeId);
      setIdeas({ busy: false, list });
    } catch (err) {
      console.error('[YouTubeThumbnails] title ideas failed:', err);
      setIdeas((x) => ({ ...x, busy: false }));
      setMessage({ type: 'error', text: err?.response?.data?.error || 'No title ideas this time. Try again.' });
    }
  };
  const [cutting, setCutting] = useState(false);
  const cutOut = async (layer) => {
    setCutting(true);
    try {
      const pic = await youtubeThumbnailsApi.cutOut(episodeId, layer.src, layerName(layer));
      setUploads((u) => [pic, ...u.filter((x) => x.url !== pic.url)]);
      edit((s) => updateLayer(s, layer.id, { src: pic.url, clearWhite: false }));
      setMessage({ type: 'ok', text: 'Background removed. The cut-out is kept in Uploads; Undo puts the photo back.' });
    } catch (err) {
      console.error('[YouTubeThumbnails] cut out failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The background could not be removed. Try again.' });
    } finally {
      setCutting(false);
    }
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

  // The episode's outfit pieces: picked from "Add a picture", they come in on a photo card like the others.
  const outfitUrls = useMemo(() => {
    const urls = new Set();
    const walk = (f) => { (f.items || []).forEach((it) => urls.add(it.url)); (f.folders || []).forEach(walk); };
    tree.filter((f) => f.key === 'outfit').forEach(walk);
    return urls;
  }, [tree]);
  const addChosenPicture = (url, label) => addAndPick((s) => (outfitUrls.has(url) ? addPieceCard(s, url, label) : addPicture(s, url, label)));

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

  // The episode's versions to compare (Evoni, 2026-10-21).
  const versionChange = async (run, done, failed) => {
    if (!episodeId) return false;
    setBusy(true);
    try {
      const text = await run();
      const versions = await youtubeThumbnailsApi.versions(episodeId);
      setSources((s) => ({ ...s, versions }));
      // run may say what happened (keeping a version names it); else the usual words.
      setMessage({ type: 'ok', text: typeof text === 'string' ? text : done });
      return true;
    } catch (err) {
      console.error('[YouTubeThumbnails] version change failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || failed });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const keepVersion = () => versionChange(async () => {
    const v = await youtubeThumbnailsApi.createVersion(episodeId, { spec });
    return `Kept as "${v?.name || 'a version'}". Change the thumbnail and keep another to compare.`;
  }, null, 'The version could not be kept.');
  const renameVersion = (v, name) => versionChange(
    () => youtubeThumbnailsApi.updateVersion(episodeId, v.id, { name: name.trim() }), `Renamed to "${name.trim()}".`, 'The version could not be renamed.');
  const updateVersion = (v) => versionChange(
    () => youtubeThumbnailsApi.updateVersion(episodeId, v.id, { spec }), `"${v.name}" now has this arrangement.`, 'The version could not be updated.');
  const deleteVersion = (v) => versionChange(
    () => youtubeThumbnailsApi.deleteVersion(episodeId, v.id), `"${v.name}" is deleted.`, 'The version could not be deleted.');
  const useVersion = (v) => {
    if (!v.spec) return;
    setSelectedId(null);
    edit(v.spec);
    setMessage({ type: 'ok', text: `Now editing "${v.name}". Undo goes back.` });
  };
  const versionWarnings = useCallback((v) => (v.spec ? youtubeWarnings(v.spec, measurer).length : 0), [fontsTick]);

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
  const stageAway = useScrolledAway(stageRef, phone && Boolean(spec));
  const sheet = phone && picked && picked.kind !== 'shade';
  // The header shrinks to one line once an episode is open, with the one before and after it.
  const compact = Boolean(episodeId);
  const at = episodes.findIndex((e) => e.id === episodeId);
  const prevEpisode = at > 0 ? episodes[at - 1] : null;
  const nextEpisode = at >= 0 && at < episodes.length - 1 ? episodes[at + 1] : null;
  const pickedSettings = picked && picked.kind !== 'shade' && (
    <LayerSettings layer={picked} onChange={(patch) => edit((s) => updateLayer(s, picked.id, patch))} onCutOut={cutOut} cutting={cutting}
      colours={[...ACCENTS, ...recentColours.filter((c) => !ACCENTS.includes(c))]} onRemember={remember} />
  );
  const marksItems = [
    { key: 'exact', testid: 'yts-menu-exact', icon: ScanEye, label: rendering ? 'Drawing…' : 'See it exactly', onChoose: seeExactly, disabled: rendering },
    { key: 'grid', testid: 'yts-menu-grid', icon: Grid3x3, label: 'Show grid', on: marks.grid, onChoose: () => setMarks((m) => ({ ...m, grid: !m.grid })) },
    { key: 'safe', testid: 'yts-menu-safe', icon: SquareDashed, label: 'Safe zones', on: marks.safe, onChoose: () => setMarks((m) => ({ ...m, safe: !m.safe })) },
  ];

  const versionsBar = episodeId && sources && (
    <VersionsBar versions={sources.versions || []} busy={busy} now={snapshot} nowWarnings={ytWarnings.length} warningsOf={versionWarnings}
      onKeep={keepVersion} onUse={useVersion} onRename={renameVersion} onUpdate={updateVersion} onDelete={deleteVersion} />
  );
  const savedList = history.length > 0 && (
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
  );

  return (
    <div className={`yts${sheet ? ' has-sheet' : ''}`}>
      <header className={`yts-banner${compact ? ' is-compact' : ''}`}>
        {compact ? (
          <p className="yts-kicker"><Link to="/template-studio">Templates</Link> · <Youtube size={14} aria-hidden /> YouTube</p>
        ) : (
          <div>
            <p className="yts-kicker"><Link to="/template-studio">Templates</Link> · YouTube</p>
            <h1 className="yts-title"><Youtube size={30} aria-hidden /> YouTube thumbnails</h1>
            <p className="yts-sub">Each episode's thumbnail, from its show's template. Drag, resize and turn anything. 1280 × 720.</p>
          </div>
        )}
        <div className="yts-choose">
          <label className="yts-select">
            <span>Show</span>
            <select value={showId} onChange={(e) => pickShow(e.target.value)} aria-label="Show">
              <option value="">Choose a show</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="yts-episode-nav">
            {compact && (
              <button type="button" className="yts-icon-btn" onClick={() => pickEpisode(prevEpisode.id)} disabled={!prevEpisode}
                aria-label="Previous episode" title={prevEpisode ? `Previous: ${prevEpisode.title || 'Untitled'}` : 'Previous episode'} data-testid="yts-prev-episode">
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
            <label className="yts-select">
              <span>Episode</span>
              <select value={episodeId} onChange={(e) => pickEpisode(e.target.value)} aria-label="Episode" disabled={!showId}>
                <option value="">Choose an episode</option>
                {episodes.map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `${e.episode_number}. ` : ''}{e.title || 'Untitled'}</option>)}
              </select>
            </label>
            {compact && (
              <button type="button" className="yts-icon-btn" onClick={() => pickEpisode(nextEpisode.id)} disabled={!nextEpisode}
                aria-label="Next episode" title={nextEpisode ? `Next: ${nextEpisode.title || 'Untitled'}` : 'Next episode'} data-testid="yts-next-episode">
                <ChevronRight size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>

      {message && (
        <div className={`yts-message yts-toast is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} data-testid="yts-toast">
          <span>{message.text}</span>
          {loadFailed && message.type === 'error' && (
            <button type="button" className="yts-btn" onClick={() => { setMessage(null); retryLoad(); }} data-testid="yts-retry">
              <RefreshCw size={15} aria-hidden /> Try again
            </button>
          )}
          <button type="button" className="yts-icon-btn" onClick={() => setMessage(null)} aria-label="Close the message" data-testid="yts-toast-close">
            <X size={15} aria-hidden />
          </button>
        </div>
      )}

      {asking && (
        <div className="yts-ask" role="group" aria-label="Confirm" data-testid="yts-ask">
          <p>{asking.text}</p>
          <button type="button" className="yts-btn is-primary" onClick={() => { const { yes } = asking; setAsking(null); yes(); }}>Yes</button>
          <button type="button" className="yts-btn" onClick={() => setAsking(null)}>No</button>
        </div>
      )}

      {season && showId ? (
        <ThumbnailSeason showId={showId} onClose={() => setSeason(false)}
          onOpenEpisode={(id) => { setSeason(false); pickEpisode(id); }} />
      ) : !spec ? (
        loading ? (
          <div className="yts-empty" role="status" data-testid="yts-loading"><span className="yts-spinner" aria-hidden /><p>Loading the episode…</p></div>
        ) : (
          <div className="yts-empty">
            <LayoutTemplate size={36} aria-hidden /><p>Choose a show and an episode to make its thumbnail.</p>
            {showId && (
              <button type="button" className="yts-btn" onClick={() => setSeason(true)} data-testid="yts-season-start">
                <LayoutGrid size={15} aria-hidden /> Or the whole season at once
              </button>
            )}
          </div>
        )
      ) : (
        <>
        <div className="yts-studio">
          <div className="yts-main">
            <section className="yts-card yts-stage" aria-label="Editor" ref={stageRef}>
              <div className="yts-toolbar" role="toolbar" aria-label="Canvas">
                <div className="yts-zoom" role="group" aria-label="Zoom" data-testid="yts-zoom">
                  <button type="button" className="yts-icon-btn" onClick={() => zoomBy(-0.25)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out (-)"><ZoomOut size={15} aria-hidden /></button>
                  {!phone && <span className="yts-zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</span>}
                  <button type="button" className="yts-icon-btn" onClick={() => zoomBy(0.25)} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in (+)"><ZoomIn size={15} aria-hidden /></button>
                  {zoom > 1 && <button type="button" className="yts-tool-btn" onClick={() => setZoom(1)}>Fit</button>}
                </div>
                <div className="yts-toolbar-group" role="group" aria-label="History">
                  <button type="button" className="yts-icon-btn" onClick={undo} disabled={!past.current.length} data-testid="yts-undo" aria-label="Undo" title="Undo (Ctrl+Z)">
                    <Undo2 size={15} aria-hidden />
                  </button>
                  <button type="button" className="yts-icon-btn" onClick={redo} disabled={!future.current.length} data-testid="yts-redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                    <Redo2 size={15} aria-hidden />
                  </button>
                </div>
                {!phone && (
                <div className="yts-toolbar-group" role="group" aria-label="Marks">
                  <button type="button" className={`yts-tool-btn${marks.grid ? ' is-on' : ''}`} aria-pressed={marks.grid} data-testid="yts-grid-btn"
                    onClick={() => setMarks((m) => ({ ...m, grid: !m.grid }))} title="Squares and thirds over the canvas (not saved)">
                    <Grid3x3 size={15} aria-hidden /> Show grid
                  </button>
                  <button type="button" className={`yts-tool-btn${marks.safe ? ' is-on' : ''}`} aria-pressed={marks.safe} data-testid="yts-safe-btn"
                    onClick={() => setMarks((m) => ({ ...m, safe: !m.safe }))} title="Where YouTube's timestamp sits, and a margin round the edge (not saved)">
                    <SquareDashed size={15} aria-hidden /> Safe zones
                  </button>
                </div>
                )}
                <div className="yts-toolbar-end">
                  {!phone && (
                    <button type="button" className="yts-tool-btn" onClick={seeExactly} disabled={rendering} data-testid="yts-exact">
                      <ScanEye size={15} aria-hidden /> {rendering ? 'Drawing…' : 'See it exactly'}
                    </button>
                  )}
                  <button type="button" className="yts-tool-btn is-primary" onClick={save} disabled={busy} data-testid="yts-save" aria-label="Save as thumbnail">
                    <Save size={15} aria-hidden /> {phone ? 'Save' : 'Save as thumbnail'}
                  </button>
                  <MoreMenu items={[
                    ...(phone ? marksItems : []),
                    { key: 'season', testid: 'yts-season-open', icon: LayoutGrid, label: 'Whole season', onChoose: () => setSeason(true) },
                    { key: 'reset', testid: 'yts-reset', icon: RotateCcw, label: 'Start again', onChoose: resetToTemplate },
                    ...(phone ? [] : [{ key: 'keys', testid: 'yts-keys-btn', icon: Keyboard, label: 'Keyboard shortcuts', onChoose: () => setShowKeys((v) => !v) }]),
                  ]} />
                </div>
              </div>
              <ArrangeBar count={pickedIds.length} onAlign={align} onSpread={spread} onClear={() => setSelectedId(null)}
                removable={(spec?.layers || []).filter((l) => pickedIds.includes(l.id) && !l.locked && l.kind !== 'shade').length} onRemove={removePicked}
                onCopy={copyPicked} />
              <ThumbnailCanvas spec={spec} selectedId={selectedId} selectedIds={pickedIds} onSelect={select} onSelectMany={selectMany}
                fontsTick={fontsTick} onChange={(id, patch) => edit((s) => updateLayer(s, id, patch))} onChangeMany={editMany} onSnapshot={setSnapshot} zoom={zoom}
                grid={marks.grid} safeZones={marks.safe} />
              <p className="yts-note" data-testid="yts-draft-note">
                {draftNote || 'Click a layer to move it, pull a corner to resize, use the top handle to turn it.'}
              </p>
              {saved && (
                <p className="yts-saved"><Check size={16} aria-hidden /> Saved. <Link to={`/episodes/${episodeId}?tab=production`}>Back to Production</Link></p>
              )}
            </section>

            {(showKeys || exact) && (
            <section className="yts-card" aria-label="See it exactly">
              {showKeys && <ShortcutsPanel onClose={() => setShowKeys(false)} />}
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
            </section>
            )}


            {phone && (
              <div className="yts-phone-tabs" role="tablist" aria-label="Settings" data-testid="yts-phone-tabs">
                {PHONE_TABS.map(([key, label]) => (
                  <button key={key} type="button" role="tab" className={`yts-tab${phoneTab === key ? ' is-on' : ''}`} aria-selected={phoneTab === key}
                    onClick={() => setPhoneTab(key)} data-testid={`yts-phone-tab-${key}`}>{label}</button>
                ))}
              </div>
            )}

            {/* Versions and saved thumbnails under the canvas, as strips (Evoni, 2026-10-22 layout list); a tab of their own on a phone. */}
            {shown('saved') && (
              <div className="yts-strip" data-testid="yts-strip">
                {versionsBar}
                {savedList}
              </div>
            )}

            <div className="yts-bottom">
              {shown('layers') && (
              <section className="yts-card" aria-label="Layers">
                <LayersList spec={spec} selectedId={selectedId} pickedIds={pickedIds} onSelect={select} onChange={edit} onDuplicate={duplicate} />
                <div className="yts-actions">
                  <button type="button" className="yts-btn" onClick={() => addAndPick((s) => addText(s))} data-testid="yts-add-text">
                    <Type size={16} aria-hidden /> Add words
                  </button>
                  {clip?.layers?.length > 0 && (
                    <button type="button" className="yts-btn" onClick={pasteClip} data-testid="yts-paste"
                      title={clip.from?.title ? `Copied from ${clip.from.title} (Ctrl+V)` : 'Ctrl+V'}>
                      <ClipboardPaste size={16} aria-hidden /> Paste {clip.layers.length === 1 ? '1 layer' : `${clip.layers.length} layers`}
                    </button>
                  )}
                </div>
              </section>
              )}
              {shown('assets') && (
              <section className="yts-card" aria-label="Assets for this episode">
                <h2 className="yts-label">Assets for this episode</h2>
                <AssetTabs tree={tree} onPick={addChosenPicture} uploading={Boolean(uploading)}
                  onUpload={(f) => upload(f, (url, label) => addAndPick((s) => addPicture(s, url, label)))} />
              </section>
              )}
            </div>
          </div>

          <aside className="yts-side" aria-label="Thumbnail settings">
            {pickedSettings && !phone && <section className="yts-card">{pickedSettings}</section>}

            {shown('layout') && (
            <section className="yts-card" aria-label="Template layout">
              <h2 className="yts-label">Template layout</h2>
              <div className="yts-layouts">
                {LAYOUTS.map((l) => (
                  <button key={l.key} type="button" className={`yts-layout is-${l.key}${look?.layout === l.key ? ' is-on' : ''}`} aria-pressed={look?.layout === l.key} onClick={() => pickLayout(l.key)}>
                    <span className="yts-layout-art" aria-hidden><i /><b /></span>{l.label}
                  </button>
                ))}
              </div>
            </section>
            )}

            {shown('text') && (
            <section className="yts-card yts-text-content" aria-label="Text content">
              <h2 className="yts-label">Text content</h2>
              {layerOf(spec, 'headline') && (
                <label className="yts-text-row">
                  <span className="yts-text-row-label">Headline</span>
                  <input className="yts-input" value={roleText(spec, 'headline')} maxLength={160} onChange={(e) => edit((s) => updateLayer(s, 'headline', { text: e.target.value }))} aria-label="Headline" />
                </label>
              )}
              {layerOf(spec, 'title') && (
                <label className="yts-text-row">
                  <span className="yts-text-row-label">Title</span>
                  <input className="yts-input" value={roleText(spec, 'title')} maxLength={160} onChange={(e) => setRole('title', e.target.value)} aria-label="Title" />
                </label>
              )}
              <label className="yts-text-row">
                <span className="yts-text-row-label">Show name line</span>
                <input className="yts-input" value={roleText(spec, 'kicker')} maxLength={160} onChange={(e) => setRole('kicker', e.target.value)} aria-label="Show name line" />
              </label>
              <label className="yts-text-row">
                <span className="yts-text-row-label">Episode badge</span>
                <input className="yts-input" value={roleText(spec, 'badge')} maxLength={16} onChange={(e) => setRole('badge', e.target.value)} aria-label="Badge" />
              </label>
              {layerOf(spec, 'edition') && (
                <div className="yts-text-row">
                  <label className="yts-text-row">
                    <span className="yts-text-row-label">Edition label</span>
                    <input className="yts-input" value={roleText(spec, 'edition')} maxLength={160} onChange={(e) => edit((s) => updateLayer(s, 'edition', { text: e.target.value }))} aria-label="Edition label" />
                  </label>
                  {/* The edition label is the episode's title (Evoni, 2026-10-21); an arrangement kept from before has the old words. */}
                  {sources?.episode?.title && roleText(spec, 'edition') !== sources.episode.title && (
                    <button type="button" className="yts-btn" onClick={() => edit((s) => updateLayer(s, 'edition', { text: sources.episode.title }))}>
                      Use the episode title
                    </button>
                  )}
                </div>
              )}
            </section>
            )}

            {shown('text') && (
            <section className="yts-card" aria-label="AI help" data-testid="yts-ai">
              <h2 className="yts-label"><Sparkles size={14} aria-hidden /> AI help</h2>
              <div className="yts-actions">
                <button type="button" className="yts-btn" onClick={askIdeas} disabled={ideas.busy} data-testid="yts-ideas-btn">
                  <Sparkles size={16} aria-hidden /> {ideas.busy ? 'Thinking…' : ideas.list.length ? 'More title ideas' : 'Title ideas'}
                </button>
              </div>
              <p className="yts-note">From this episode's title, checklist and outfit; counts toward the daily AI budget.</p>
              {ideas.list.length > 0 && (
                <ul className="yts-ideas" data-testid="yts-ideas">
                  {ideas.list.map((idea, i) => (
                    <li key={`${i}-${idea.title}`} className="yts-idea">
                      <span className="yts-idea-title">{idea.title}</span>
                      {idea.hook && <span className="yts-idea-hook">{idea.hook}</span>}
                      <span className="yts-idea-actions">
                        <button type="button" className="yts-history-btn" onClick={() => setRole('title', idea.title)} aria-label={`Use "${idea.title}" as the title`}>Use title</button>
                        {idea.hook && (
                          <button type="button" className="yts-history-btn" onClick={() => addAndPick((s) => addHook(s, idea.hook))} aria-label={`Add "${idea.hook}" as a burst`}>Add the hook</button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            )}

            {shown('assets') && (
            <section className="yts-card yts-pair" aria-label="Checklist and stickers">
              {layerOf(spec, 'checklist') && (
                <ChecklistEditor layer={layerOf(spec, 'checklist')} onChange={(patch) => edit((s) => updateLayer(s, layerOf(s, 'checklist').id, patch))} />
              )}
              <StickerRow onAdd={(key) => addAndPick((s) => addShape(s, key))} />
            </section>
            )}

            {shown('characters') && (
            <section className="yts-card" aria-label="Characters">
              <h2 className="yts-label">Characters</h2>
              {/* More than one Lala (Evoni, 2026-10-22): each picture clicked is added beside her; clicked again, taken off. */}
              <FolderPicker title="Lala" testid="yts-lala" whole values={figureLayers(spec, 'lala').map((l) => l.src)} tree={tree} start={['poses/lala', 'library/lala']}
                hint="Click as many as you like; click one again to take it off."
                noneLabel="No Lala" onPick={(url) => edit((s) => toggleFigure(s, 'lala', url, look?.layout))} uploading={Boolean(uploading)}
                onUpload={(f) => upload(f, (url) => edit((s) => toggleFigure(s, 'lala', url, look?.layout)))}
                onNone={() => edit((s) => clearFigure(s, 'lala'))} />
              <FolderPicker title="JustAWoman" testid="yts-jaw" whole value={roleSrc(spec, 'jaw')} tree={tree} start={['poses/justawoman']}
                noneLabel="No JustAWoman" onPick={(url) => setRole('jaw', url)} uploading={Boolean(uploading)}
                onUpload={(f) => upload(f, (url) => setRole('jaw', url))}
                onNone={() => setRole('jaw', null)} />
              {!(sources?.poses?.lala || []).length && !(sources?.poses?.justawoman || []).length && (
                <p className="yts-note is-block" data-testid="yts-poses-note"><Sparkles size={14} aria-hidden /> Add Lala and JustAWoman photos on the episode's <Link to={`/episodes/${episodeId}?tab=files`}>Files tab</Link>, labelled by pose; they show here once they are ready. Or upload one.</p>
              )}
            </section>
            )}

            {shown('background') && (
            <section className="yts-card" aria-label="Background">
              <FolderPicker title="Background" testid="yts-backgrounds" tree={tree} start={['scene-sets']} value={roleSrc(spec, 'background')}
                noneLabel="Plain" onPick={(url) => setRole('background', url)} uploading={Boolean(uploading)}
                onUpload={(f) => upload(f, (url) => setRole('background', url))}
                onNone={() => setRole('background', null)} />
              <label className="yts-field">
                <span className="yts-label">Darken the background</span>
                <input type="range" min="0" max="0.8" step="0.05" value={shade?.dim ?? 0} onChange={(e) => setColours({ dim: Number(e.target.value) })} aria-label="Darken the background" disabled={!shade} />
              </label>
              <label className="yts-field">
                <span className="yts-label">Blur the background ({layerOf(spec, 'background')?.blur || 0})</span>
                <input type="range" min="0" max="40" step="1" value={layerOf(spec, 'background')?.blur || 0} aria-label="Blur the background"
                  disabled={!layerOf(spec, 'background')?.src} onChange={(e) => edit((s) => updateLayer(s, layerOf(s, 'background').id, { blur: Number(e.target.value) }))} />
              </label>
            </section>
            )}

            {shown('colours') && (
            <section className="yts-card" aria-label="Colour palette">
              <fieldset className="yts-field">
                <legend className="yts-label">Colour palette</legend>
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
            </section>
            )}
          </aside>
        </div>

        <div className="yts-more">
          <YouTubePreviews src={snapshot} title={layerOf(spec, 'title')?.text || sources?.episode?.title} channel={sources?.show?.name}
            warnings={ytWarnings} onPick={(id) => setSelectedId(id)}
            onFix={(w) => {
              const next = fixWarning(specRef.current, w, measurer);
              if (next) edit(next);
              return Boolean(next);
            }}
            onFixAll={() => {
              const { spec: next, left } = fixAllWarnings(specRef.current, measurer);
              if (next !== specRef.current) edit(next);
              return left;
            }}
            onSmallOk={(id) => edit((s) => updateLayer(s, id, { smallOk: true }))} />
          <section className="yts-card yts-try" data-testid="yts-try">
            <label className="yts-select">
              <span>Try it on another episode</span>
              <select value={tryOn.id} onChange={(e) => tryOnEpisode(e.target.value)} aria-label="Try it on another episode" disabled={tryOn.busy}>
                <option value="">Choose an episode</option>
                {episodes.filter((e) => e.id !== episodeId).map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `${e.episode_number}. ` : ''}{e.title || 'Untitled'}</option>)}
              </select>
            </label>
            {tryOn.busy && <span className="yts-note">Drawing…</span>}
            {tryOn.url && (
              <figure className="yts-exact" data-testid="yts-try-figure">
                <img src={tryOn.url} alt="This arrangement on the other episode" />
                <figcaption>
                  This arrangement with that episode's words and pictures, as the show's template would give it.
                  <button type="button" className="yts-icon-btn" onClick={() => setTryOn({ id: '', url: null, busy: false })} aria-label="Close the other episode"><X size={15} aria-hidden /></button>
                </figcaption>
              </figure>
            )}
          </section>
        </div>
        {sources?.show?.id && (
          <TemplatesBar showName={sources.show.name} templates={sources.templates || []} busy={busy}
            onUse={useTemplate} onCreate={createTemplate} onRename={renameTemplate} onDefault={defaultTemplate}
            onUpdate={updateTemplate} onDelete={deleteTemplate} />
        )}
        {sheet && (
          <section className="yts-sheet" aria-label="The picked layer" data-testid="yts-sheet">
            <div className="yts-sheet-head">
              <span className="yts-sheet-grip" aria-hidden />
              <button type="button" className="yts-tool-btn is-primary" onClick={() => setSelectedId(null)} data-testid="yts-sheet-done">
                <Check size={15} aria-hidden /> Done
              </button>
            </div>
            {pickedSettings}
          </section>
        )}
        {phone && stageAway && snapshot && !season && (
          <button type="button" className="yts-mini" data-testid="yts-mini" aria-label="Back to the canvas"
            onClick={() => stageRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>
            <img src={snapshot} alt="" />
          </button>
        )}
        </>
      )}
    </div>
  );
}
