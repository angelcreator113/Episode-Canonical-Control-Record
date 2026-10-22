/**
 * The thumbnail editor's canvas (Templates › YouTube thumbnails; Evoni,
 * 2026-10-21): the layers drawn at the page's width, 16:9. Click a layer to
 * pick it; drag it to move it; pull a corner to make it bigger or smaller;
 * turn it with the handle above it. Arrow keys nudge the picked layer (with
 * Shift, ten at a time). A drag snaps to the canvas's edges and centre and
 * to the other layers (gold guide lines; hold Alt not to snap). A locked
 * layer can be picked but not moved, resized or turned. Drawn as the server draws the saved file
 * (lib/thumbnailLayers: the same fonts, fitting and picture fit).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Image as KImage, Transformer } from 'react-konva';
import Konva from 'konva';
import {
  WIDTH, HEIGHT, LINE_HEIGHT, FONTS, fitText, measurer, spaced, fitPicture, boxFromNode, layerName, checklistRows, snapBox, layersInBox, adjustedPicture, stickerCanvas, stickerMargin, drawFitted, CARD_COLOR,
  fancyWords, wordsCanvas, wordsMargin, finerCanvas, drawRes, shapeCanvas, shapeMargin,
  TIMESTAMP_ZONE, pinchGesture, pinchDelta,
} from '../../lib/thumbnailLayers';
import { previewUrl, previewWidth } from '../../lib/picturePreview';

// A second finger while the first drags a layer (Evoni, 2026-10-22: pinch to
// resize and turn): Konva hides touch moves during a drag unless asked.
Konva.hitOnDragEnabled = true;

/** A picture for a box `points` wide on screen: its smaller copy (picturePreview), loaded. */
function usePicture(src, points) {
  const [img, setImg] = useState(null);
  const pixels = previewWidth(points);
  useEffect(() => {
    if (!src) { setImg(null); return undefined; }
    let live = true;
    previewUrl(src, pixels).then((address) => {
      if (!live) return;
      const el = new window.Image();
      el.onload = () => { if (live) setImg(el); };
      el.onerror = () => { console.error('[ThumbnailCanvas] picture did not load:', src); if (live) setImg(null); };
      el.src = address;
    });
    return () => { live = false; };
  }, [src, pixels]);
  return img;
}

function Shade({ l }) {
  const side = l.side === 'left' || l.side === 'right';
  return (
    <Group listening={false} opacity={l.opacity}>
      <Rect width={WIDTH} height={HEIGHT} fill={`rgba(0,0,0,${l.dim})`} />
      {side && (
        <Rect width={WIDTH} height={HEIGHT}
          fillLinearGradientStartPoint={{ x: l.side === 'left' ? WIDTH : 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: l.side === 'left' ? 0 : WIDTH, y: 0 }}
          fillLinearGradientColorStops={[0, 'rgba(42,10,34,0.85)', 0.55, 'rgba(42,10,34,0.35)', 1, 'rgba(42,10,34,0)']} />
      )}
      {l.side === 'center' && (
        <Rect width={WIDTH} height={HEIGHT}
          fillRadialGradientStartPoint={{ x: WIDTH / 2, y: HEIGHT / 2 }} fillRadialGradientStartRadius={0}
          fillRadialGradientEndPoint={{ x: WIDTH / 2, y: HEIGHT / 2 }} fillRadialGradientEndRadius={WIDTH * 0.7}
          fillRadialGradientColorStops={[0, 'rgba(42,10,34,0.65)', 1, 'rgba(42,10,34,0.2)']} />
      )}
      <Rect y={HEIGHT - 14} width={WIDTH} height={14} fill={l.accent} />
    </Group>
  );
}

function Picture({ l, scale }) {
  const loaded = usePicture(l.src, l.w * scale);
  // Flipped and toned as the server does it (Evoni, 2026-10-21: picture effects).
  const img = useMemo(() => (loaded ? adjustedPicture(loaded, l) : null), [loaded, l.flipX, l.brightness, l.contrast, l.clearWhite]);
  // Drawn as fine as the screen shows it, so the edge and shadow stay sharp (Evoni, 2026-10-21).
  const res = drawRes(scale);
  const sticker = useMemo(() => (img && l.frame !== 'polaroid' && (l.outline || l.shadow)
    ? stickerCanvas(l, (bx) => drawFitted(bx, img, { x: 0, y: 0, w: l.w, h: l.h, fit: l.fit }), finerCanvas(res))
    : null), [img, res, l.w, l.h, l.fit, l.frame, l.outline, l.outlineWidth, l.shadow]);
  if (l.frame === 'polaroid') {
    const pad = Math.round(Math.min(l.w, l.h) * 0.05);
    const inner = { w: l.w - pad * 2, h: l.h - pad * 2 };
    const at = img ? fitPicture(img.width, img.height, { ...inner, fit: l.fit, center: true }) : null;
    return (
      <>
        <Rect width={l.w} height={l.h} fill={l.cardColor || CARD_COLOR} shadowColor="black" shadowBlur={18} shadowOffsetY={6} shadowOpacity={0.35} />
        {img && <KImage image={img} x={pad + at.x} y={pad + at.y} width={at.w} height={at.h} crop={at.crop || undefined} />}
      </>
    );
  }
  if (sticker) {
    const m = stickerMargin(l);
    return (
      <>
        <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
        <KImage image={sticker} x={-m} y={-m} width={l.w + m * 2} height={l.h + m * 2} />
      </>
    );
  }
  const at = img ? fitPicture(img.width, img.height, { w: l.w, h: l.h, fit: l.fit }) : null;
  return (
    <>
      {/* The whole box can be picked, not only the figure. */}
      <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
      {img && <KImage image={img} x={at.x} y={at.y} width={at.w} height={at.h} crop={at.crop || undefined} />}
    </>
  );
}

function Words({ l, scale = 1 }) {
  // A shadow or glow, a fade or a curve (Evoni, 2026-10-21: text effects):
  // drawn on a canvas as the server draws them, one shadow under it all.
  const fancy = fancyWords(l);
  const res = drawRes(scale);
  const drawn = useMemo(() => {
    if (!fancy) return null;
    try {
      return wordsCanvas(l, finerCanvas(res));
    } catch (err) {
      // No 2D canvas here: the plain words stand in; the saved file still has the effect.
      console.error('[ThumbnailCanvas] could not draw the words\' effect:', err?.message || err);
      return null;
    }
  }, [fancy, res, l.text, l.upper, l.font, l.size, l.w, l.h, l.bg, l.align,
    l.spacing, l.color, l.stroke, l.effect, l.effectColor, l.effectSize, l.gradient, l.curve]);
  if (drawn) {
    const m = wordsMargin(l);
    return (
      <>
        <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
        {l.bg && <Rect width={l.w} height={l.h} fill={l.bg} opacity={l.bgOpacity ?? 1} cornerRadius={Math.min(l.bgRadius || 0, l.w / 2, l.h / 2)} />}
        <KImage image={drawn} x={-m} y={-m} width={l.w + m * 2} height={l.h + m * 2} listening={false} />
      </>
    );
  }
  const text = l.upper ? String(l.text || '').toUpperCase() : String(l.text || '');
  const pad = l.bg ? Math.round(l.size * 0.25) : 0;
  const spacing = l.spacing || 0;
  const measure = spaced(measurer(l.font), spacing);
  const { size, lines } = fitText(text, { w: l.w - pad * 2, h: l.h - pad * 2, size: l.size }, measure);
  const f = FONTS[l.font] || FONTS.serif;
  const lineH = size * LINE_HEIGHT;
  const top = l.h / 2 - (lines.length * lineH) / 2;
  const look = {
    fontFamily: f.family, fontStyle: f.weight === 'bold' ? 'bold' : 'normal', fontSize: size, fill: l.color,
    stroke: l.stroke || undefined, strokeWidth: l.stroke ? Math.max(2, Math.round(size / 7)) : 0, lineJoin: 'round', fillAfterStrokeEnabled: true,
  };
  // Spaced words are placed line by line here, as the server places them
  // (the space after the last letter is not part of where the line stands).
  const startOf = (line) => {
    const lineW = measure(line, size) - spacing;
    return l.align === 'center' ? (l.w - lineW) / 2 : l.align === 'right' ? l.w - pad - lineW : pad;
  };
  return (
    <>
      <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
      {l.bg && <Rect width={l.w} height={l.h} fill={l.bg} opacity={l.bgOpacity ?? 1} cornerRadius={Math.min(l.bgRadius || 0, l.w / 2, l.h / 2)} />}
      {lines.map((line, i) => (spacing
        ? <Text key={i} text={line} x={startOf(line)} y={top + i * lineH} height={lineH} verticalAlign="middle" letterSpacing={spacing} {...look} />
        : <Text key={i} text={line} x={pad} y={top + i * lineH} width={l.w - pad * 2} height={lineH} align={l.align} verticalAlign="middle" {...look} />
      ))}
    </>
  );
}

function Badge({ l }) {
  const f = FONTS[l.font] || FONTS.sans;
  const { size } = fitText(String(l.text || '').toUpperCase(), { w: l.w * 0.8, h: l.h * 0.7, size: Math.round(l.h * 0.55) }, measurer(l.font));
  return (
    <>
      <Rect width={l.w} height={l.h} cornerRadius={Math.min(l.h / 2, l.w / 2)} fill={l.fill} stroke="#FFFFFF" strokeWidth={4} />
      <Text text={String(l.text || '').toUpperCase()} width={l.w} height={l.h} align="center" verticalAlign="middle"
        fontFamily={f.family} fontStyle={f.weight === 'bold' ? 'bold' : 'normal'} fontSize={size} fill={l.color} />
    </>
  );
}

/** Rows of a tick box and words (the server's drawChecklist). */
function Checklist({ l }) {
  const items = l.items || [];
  const { rowH, box, textX, size } = checklistRows(l, measurer(l.font));
  const f = FONTS[l.font] || FONTS.hand;
  return (
    <>
      <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
      {items.map((it, i) => {
        const cy = rowH * (i + 0.5);
        return (
          <React.Fragment key={i}>
            <Rect x={0} y={cy - box / 2} width={box} height={box} stroke={l.color} strokeWidth={Math.max(2, Math.round(box * 0.09))} lineJoin="round" />
            {it.checked && (
              <Line points={[box * 0.18, cy, box * 0.42, cy + box * 0.28, box * 0.95, cy - box * 0.45]} stroke={l.color}
                strokeWidth={Math.max(3, Math.round(box * 0.14))} lineCap="round" lineJoin="round" />
            )}
            <Text text={it.text} x={textX} y={cy - rowH / 2} width={l.w - textX} height={rowH} verticalAlign="middle"
              fontFamily={f.family} fontStyle={f.weight === 'bold' ? 'bold' : 'normal'} fontSize={size} fill={l.color} />
          </React.Fragment>
        );
      })}
    </>
  );
}

/** A sticker (Evoni, 2026-10-21: stickers and shapes), drawn on a canvas as the server draws it. */
function Shape({ l, scale = 1 }) {
  // As fine as the screen shows it, so the sticker stays sharp (Evoni, 2026-10-21).
  const res = drawRes(scale);
  const drawn = useMemo(() => {
    try {
      return shapeCanvas(l, finerCanvas(res));
    } catch (err) {
      // No 2D canvas here: the box stays pickable; the saved file still has the sticker.
      console.error('[ThumbnailCanvas] could not draw the sticker:', err?.message || err);
      return null;
    }
  }, [res, l.shape, l.w, l.h, l.fill, l.stroke, l.strokeWidth, l.thickness, l.text, l.font, l.color]);
  const m = shapeMargin(l);
  return (
    <>
      <Rect width={l.w} height={l.h} fill="rgba(0,0,0,0.001)" />
      {drawn && <KImage image={drawn} x={-m} y={-m} width={l.w + m * 2} height={l.h + m * 2} listening={false} />}
    </>
  );
}

const BODY = { image: Picture, text: Words, badge: Badge, checklist: Checklist, shape: Shape };

// Bigger handles where fingers do the dragging (Evoni, 2026-10-21: phone width).
const coarsePointer = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches;

/**
 * The editor. selectedIds are the picked layers, the first the main one
 * (its settings show). Click picks one; Shift or Ctrl/Cmd-click adds or
 * takes away; a drag on an empty part of the canvas picks what the box
 * touches (onSelectMany). Picked layers move together: one change for all
 * (onChangeMany: { [id]: patch }).
 */
// The editor's own marks (Evoni, 2026-10-21 redesign), never in the saved file:
// a grid of 80-point squares with the thirds stronger, and the safe zones
// (YouTube's timestamp over the bottom right; a 5% margin round the edge).
const GRID_STEP = 80;
const SAFE_MARGIN = { x: WIDTH * 0.05, y: HEIGHT * 0.05 };

function Overlays({ grid, safeZones, scale }) {
  const thin = 1 / scale;
  const lines = [];
  if (grid) {
    for (let x = GRID_STEP; x < WIDTH; x += GRID_STEP) lines.push({ key: `x${x}`, points: [x, 0, x, HEIGHT], third: false });
    for (let y = GRID_STEP; y < HEIGHT; y += GRID_STEP) lines.push({ key: `y${y}`, points: [0, y, WIDTH, y], third: false });
    [1, 2].forEach((k) => {
      lines.push({ key: `tx${k}`, points: [(WIDTH * k) / 3, 0, (WIDTH * k) / 3, HEIGHT], third: true });
      lines.push({ key: `ty${k}`, points: [0, (HEIGHT * k) / 3, WIDTH, (HEIGHT * k) / 3], third: true });
    });
  }
  return (
    <>
      {lines.map((g) => (
        <Line key={g.key} name={g.third ? 'grid-third' : 'grid-line'} points={g.points} listening={false}
          stroke={g.third ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)'} strokeWidth={(g.third ? 1.5 : 1) * thin} />
      ))}
      {safeZones && (
        <>
          <Rect name="safe-margin" x={SAFE_MARGIN.x} y={SAFE_MARGIN.y} width={WIDTH - SAFE_MARGIN.x * 2} height={HEIGHT - SAFE_MARGIN.y * 2}
            stroke="rgba(255,255,255,0.85)" strokeWidth={1.5 * thin} dash={[10 * thin, 6 * thin]} listening={false} />
          <Rect name="safe-timestamp" x={TIMESTAMP_ZONE.x} y={TIMESTAMP_ZONE.y} width={TIMESTAMP_ZONE.w} height={TIMESTAMP_ZONE.h}
            fill="rgba(224,104,159,0.35)" stroke="#E0689F" strokeWidth={2 * thin} listening={false} />
          <Text text="Timestamp" x={TIMESTAMP_ZONE.x} y={TIMESTAMP_ZONE.y + TIMESTAMP_ZONE.h / 2 - 12} width={TIMESTAMP_ZONE.w}
            align="center" fontSize={22} fontStyle="bold" fill="#FFFFFF" listening={false} />
        </>
      )}
    </>
  );
}

export default function ThumbnailCanvas({
  spec, selectedId, selectedIds, onSelect, onSelectMany, onChange, onChangeMany, onSnapshot, fontsTick = 0, zoom = 1,
  grid = false, safeZones = false, onZoom = null,
}) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const marksRef = useRef(null); // the grid and safe zones, hidden while the snapshot is taken
  const dragFrom = useRef(null); // { id, x, y, others: { [id]: { x, y } } } while picked layers move together
  const pinch = useRef(null); // { d, a, id, rotation, zoom } while two fingers are down
  const [fitWidth, setWidth] = useState(640);
  // Zoomed in (Evoni, 2026-10-21), the canvas is drawn bigger and scrolls inside its frame.
  const width = Math.round(fitWidth * zoom);
  const [guides, setGuides] = useState([]);
  const [marquee, setMarquee] = useState(null); // { x0, y0, x1, y1 } in canvas points
  const picks = selectedIds || (selectedId ? [selectedId] : []);
  const pickSet = new Set(picks);
  const many = (patches) => (onChangeMany ? onChangeMany(patches) : Object.entries(patches).forEach(([id, p]) => onChange(id, p)));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.max(200, Math.round(el.clientWidth || 640)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The handles go round the picked layers (not locked ones).
  const picksKey = picks.join('|');
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = (spec?.layers || []).filter((l) => pickSet.has(l.id) && !l.locked && l.visible)
      .map((l) => stage.findOne(`#${CSS.escape(l.id)}`)).filter(Boolean);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksKey, spec, width]);

  // A small picture of the thumbnail for the YouTube previews (Evoni,
  // 2026-10-21), without the handles: a moment after each change, and once
  // more a little later, when pictures that were loading have drawn.
  useEffect(() => {
    if (!onSnapshot) return undefined;
    const shoot = () => {
      const stage = stageRef.current;
      const tr = trRef.current;
      if (!stage) return;
      const marks = marksRef.current;
      const shown = tr?.visible();
      tr?.visible(false);
      marks?.visible(false);
      try {
        onSnapshot(stage.toDataURL({ pixelRatio: 720 / width, mimeType: 'image/jpeg', quality: 0.85 }));
      } catch (err) {
        console.error('[ThumbnailCanvas] snapshot failed:', err?.message || err);
      } finally {
        tr?.visible(shown !== false);
        marks?.visible(true);
      }
    };
    const soon = setTimeout(shoot, 500);
    const later = setTimeout(shoot, 1800);
    return () => { clearTimeout(soon); clearTimeout(later); };
  }, [spec, width, fontsTick, onSnapshot]);

  const scale = width / WIDTH;
  const layers = (spec?.layers || []).filter((l) => l.visible);
  const change = (l, node) => onChange(l.id, boxFromNode({
    x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation(),
  }, l));
  const together = (l) => pickSet.has(l.id) && picks.length > 1;

  /** Snaps a dragged layer to the canvas and the other visible layers; picked ones move with it. */
  // The layers that follow a led drag get Konva's drag events too: they
  // neither snap nor report on their own; the led layer reports for all.
  const following = (l) => Boolean(dragFrom.current && dragFrom.current.others[l.id]);

  const onDragMove = (l, e) => {
    const node = e.target;
    const from = dragFrom.current;
    if (following(l)) return;
    if (from && from.id === l.id) {
      const dx = node.x() - from.x;
      const dy = node.y() - from.y;
      const stage = stageRef.current;
      Object.entries(from.others).forEach(([id, p]) => stage?.findOne(`#${CSS.escape(id)}`)?.position({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    if (e.evt?.altKey) { setGuides([]); return; }
    const others = layers.filter((o) => o.id !== l.id && o.kind !== 'shade' && o.role !== 'background');
    const s = snapBox({ cx: node.x(), cy: node.y(), w: l.w, h: l.h }, others);
    node.position({ x: s.cx, y: s.cy });
    setGuides(s.guides);
  };

  const onDragStart = (l, e) => {
    if (following(l)) return;
    if (!together(l)) { dragFrom.current = null; return; }
    const stage = stageRef.current;
    const others = {};
    for (const o of layers) {
      if (o.id === l.id || !pickSet.has(o.id) || o.locked) continue;
      const n = stage?.findOne(`#${CSS.escape(o.id)}`);
      if (n) others[o.id] = { x: n.x(), y: n.y() };
    }
    dragFrom.current = { id: l.id, x: e.target.x(), y: e.target.y(), others };
  };

  const onDragEnd = (l, e) => {
    setGuides([]);
    const from = dragFrom.current;
    if (following(l)) return;
    if (!from || from.id !== l.id) { dragFrom.current = null; change(l, e.target); return; }
    // Kept a moment, so the followers' own drag ends (which may come after) are ignored too.
    setTimeout(() => { if (dragFrom.current === from) dragFrom.current = null; }, 0);
    const dx = Math.round(e.target.x() - from.x);
    const dy = Math.round(e.target.y() - from.y);
    const patches = { [l.id]: { x: l.x + dx, y: l.y + dy } };
    for (const id of Object.keys(from.others)) {
      const o = layers.find((x) => x.id === id);
      if (o) patches[id] = { x: o.x + dx, y: o.y + dy };
    }
    many(patches);
  };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!move) return;
    const moving = (spec?.layers || []).filter((x) => pickSet.has(x.id) && x.kind !== 'shade' && !x.locked);
    if (!moving.length) return;
    e.preventDefault();
    if (moving.length === 1) onChange(moving[0].id, { x: moving[0].x + move[0], y: moving[0].y + move[1] });
    else many(Object.fromEntries(moving.map((x) => [x.id, { x: x.x + move[0], y: x.y + move[1] }])));
  };

  // The drag box, in canvas points.
  const pointer = () => {
    const p = stageRef.current?.getPointerPosition();
    return p ? { x: p.x / scale, y: p.y / scale } : null;
  };
  // A drag box starts on an empty part of the canvas, or on the background
  // picture while it is not picked (a click there still picks it).
  const boxStart = (e, onLayer = null) => {
    if (!onLayer && e.target !== e.target.getStage()) return;
    const p = pointer();
    if (p) setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, click: onLayer });
  };
  const boxMove = () => {
    if (!marquee) return;
    const p = pointer();
    if (p) setMarquee((m) => (m ? { ...m, x1: p.x, y1: p.y } : m));
  };
  const boxEnd = () => {
    if (!marquee) return;
    const m = marquee;
    setMarquee(null);
    if (Math.abs(m.x1 - m.x0) < 6 && Math.abs(m.y1 - m.y0) < 6) { onSelect(m.click || null); return; }
    const ids = layersInBox(spec, m);
    if (onSelectMany) onSelectMany(ids);
    else onSelect(ids[0] || null);
  };

  const pick = (l, e) => {
    const evt = e?.evt || {};
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey) { onSelect(l.id, { toggle: true }); return; }
    // A picked layer among several stays with them, so they can be dragged together.
    if (!together(l)) onSelect(l.id);
  };

  // Two fingers (Evoni, 2026-10-22): on the one picked layer, pinch to resize
  // it and twist to turn it (drawn as they move, kept when they lift); with
  // nothing picked, pinch zooms the canvas.
  const twoFingers = (evt) => {
    const t = evt?.touches;
    return t && t.length >= 2 ? [{ x: t[0].clientX, y: t[0].clientY }, { x: t[1].clientX, y: t[1].clientY }] : null;
  };
  const pinchMove = (e) => {
    const pts = twoFingers(e.evt);
    if (!pts) return false;
    e.evt.preventDefault?.();
    const stage = stageRef.current;
    stage?.find('Group').forEach((n) => { if (n.isDragging?.()) n.stopDrag(); });
    setMarquee(null);
    const g = pinchGesture(pts);
    if (!pinch.current) {
      const one = picks.length === 1 ? layers.find((x) => x.id === picks[0]) : null;
      const target = one && !one.locked && one.kind !== 'shade' ? one : null;
      pinch.current = { ...g, id: target?.id || null, rotation: target?.rotation || 0, zoom };
      return true;
    }
    const { k, turn } = pinchDelta(pinch.current, g);
    if (pinch.current.id) {
      const node = stage?.findOne(`#${CSS.escape(pinch.current.id)}`);
      if (node) { node.scaleX(k); node.scaleY(k); node.rotation(pinch.current.rotation + turn); node.getLayer()?.batchDraw(); }
    } else if (onZoom) {
      onZoom(pinch.current.zoom * k);
    }
    return true;
  };
  const pinchEnd = () => {
    const p = pinch.current;
    if (!p) return false;
    pinch.current = null;
    if (p.id) {
      const node = stageRef.current?.findOne(`#${CSS.escape(p.id)}`);
      const l = layers.find((x) => x.id === p.id);
      if (node && l) { change(l, node); node.scaleX(1); node.scaleY(1); }
    }
    return true;
  };

  const main = (spec?.layers || []).find((x) => x.id === picks[0]);
  const anchorSize = coarsePointer() ? 18 : 10;
  return (
    <div ref={wrapRef} className={`yts-canvas${zoom > 1 ? ' is-zoomed' : ''}`} tabIndex={0} onKeyDown={onKeyDown} data-testid="yts-canvas"
      aria-label={picks.length > 1
        ? `Thumbnail editor. ${picks.length} layers are picked: drag one to move them together; arrow keys nudge them.`
        : main
          ? (main.locked ? `Thumbnail editor. ${layerName(main)} is picked and locked.` : `Thumbnail editor. ${layerName(main)} is picked: drag to move, pull a corner to resize, use the top handle to turn; arrow keys nudge.`)
          : 'Thumbnail editor. Click a layer to move, resize or turn it; drag across the canvas to pick several.'}>
      <Stage ref={stageRef} width={width} height={Math.round((width * HEIGHT) / WIDTH)} scaleX={scale} scaleY={scale}
        onMouseDown={boxStart} onTouchStart={(e) => { if (!twoFingers(e.evt)) boxStart(e); }} onMouseMove={boxMove}
        onTouchMove={(e) => { if (!pinchMove(e)) boxMove(e); }}
        onMouseUp={boxEnd} onTouchEnd={(e) => { if (!pinchEnd()) boxEnd(e); }} onMouseLeave={boxEnd}>
        <Layer key={fontsTick}>
          {layers.map((l) => {
            if (l.kind === 'shade') return <Shade key={l.id} l={l} />;
            const Body = BODY[l.kind];
            if (!Body) return null;
            const boxFromHere = l.role === 'background' && !pickSet.has(l.id);
            return (
              <Group key={l.id} id={l.id} x={l.x + l.w / 2} y={l.y + l.h / 2} offsetX={l.w / 2} offsetY={l.h / 2}
                rotation={l.rotation} opacity={l.opacity} draggable={!l.locked && !boxFromHere}
                onMouseDown={(e) => (boxFromHere ? boxStart(e, l.id) : pick(l, e))}
                onTouchStart={(e) => { if (boxFromHere) boxStart(e, l.id); }}
                onTap={(e) => { if (!boxFromHere) pick(l, e); }}
                onDragStart={(e) => onDragStart(l, e)}
                onDragMove={(e) => onDragMove(l, e)}
                onDragEnd={(e) => onDragEnd(l, e)}
                onTransformEnd={(e) => { const node = e.target; change(l, node); node.scaleX(1); node.scaleY(1); }}>
                <Body l={l} scale={scale} />
              </Group>
            );
          })}
          {guides.map((g, i) => (
            <Line key={i} points={g.x !== undefined ? [g.x, 0, g.x, HEIGHT] : [0, g.y, WIDTH, g.y]}
              stroke="#E8C468" strokeWidth={2 / scale} dash={[8 / scale, 6 / scale]} listening={false} />
          ))}
          {marquee && (
            <Rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(184,150,46,0.12)" stroke="#B8962E" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
          )}
          <Transformer ref={trRef} rotateEnabled keepRatio={false} rotationSnaps={[0, 90, 180, 270]} rotationSnapTolerance={4}
            borderStroke="#B8962E" anchorStroke="#B8962E" anchorFill="#FFFFFF" anchorSize={anchorSize}
            boundBoxFunc={(oldBox, box) => (Math.abs(box.width) < 12 || Math.abs(box.height) < 12 ? oldBox : box)} />
        </Layer>
        {(grid || safeZones) && (
          <Layer ref={marksRef} listening={false}>
            <Overlays grid={grid} safeZones={safeZones} scale={scale} />
          </Layer>
        )}
      </Stage>
    </div>
  );
}
