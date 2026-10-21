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
import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Image as KImage, Transformer } from 'react-konva';
import {
  WIDTH, HEIGHT, LINE_HEIGHT, FONTS, fitText, measurer, fitPicture, boxFromNode, layerName, checklistRows, snapBox,
} from '../../lib/thumbnailLayers';
import { previewUrl, previewWidth } from '../../lib/picturePreview';

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
  const img = usePicture(l.src, l.w * scale);
  if (l.frame === 'polaroid') {
    const pad = Math.round(Math.min(l.w, l.h) * 0.05);
    const inner = { w: l.w - pad * 2, h: l.h - pad * 2 };
    const at = img ? fitPicture(img.width, img.height, { ...inner, fit: l.fit, center: true }) : null;
    return (
      <>
        <Rect width={l.w} height={l.h} fill="#FFFFFF" shadowColor="black" shadowBlur={18} shadowOffsetY={6} shadowOpacity={0.35} />
        {img && <KImage image={img} x={pad + at.x} y={pad + at.y} width={at.w} height={at.h} crop={at.crop || undefined} />}
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

function Words({ l }) {
  const text = l.upper ? String(l.text || '').toUpperCase() : String(l.text || '');
  const pad = l.bg ? Math.round(l.size * 0.25) : 0;
  const { size, lines } = fitText(text, { w: l.w - pad * 2, h: l.h - pad * 2, size: l.size }, measurer(l.font));
  const f = FONTS[l.font] || FONTS.serif;
  const lineH = size * LINE_HEIGHT;
  const top = l.h / 2 - (lines.length * lineH) / 2;
  return (
    <>
      <Rect width={l.w} height={l.h} fill={l.bg || 'rgba(0,0,0,0.001)'} />
      {lines.map((line, i) => (
        <Text key={i} text={line} x={pad} y={top + i * lineH} width={l.w - pad * 2} height={lineH} align={l.align} verticalAlign="middle"
          fontFamily={f.family} fontStyle={f.weight === 'bold' ? 'bold' : 'normal'} fontSize={size} fill={l.color}
          stroke={l.stroke || undefined} strokeWidth={l.stroke ? Math.max(2, Math.round(size / 7)) : 0} lineJoin="round" fillAfterStrokeEnabled />
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

const BODY = { image: Picture, text: Words, badge: Badge, checklist: Checklist };

export default function ThumbnailCanvas({ spec, selectedId, onSelect, onChange, fontsTick = 0 }) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [guides, setGuides] = useState([]);

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

  // The handles go round the picked layer.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const picked = (spec?.layers || []).find((l) => l.id === selectedId);
    const node = picked && !picked.locked ? stage.findOne(`#${CSS.escape(selectedId)}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, spec, width]);

  const scale = width / WIDTH;
  const layers = (spec?.layers || []).filter((l) => l.visible);
  const change = (l, node) => onChange(l.id, boxFromNode({
    x: node.x(), y: node.y(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation(),
  }, l));

  /** Snaps a dragged layer to the canvas and the other visible layers. */
  const snapDrag = (l, e) => {
    const node = e.target;
    if (e.evt?.altKey) { setGuides([]); return; }
    const others = layers.filter((o) => o.id !== l.id && o.kind !== 'shade' && o.role !== 'background');
    const s = snapBox({ cx: node.x(), cy: node.y(), w: l.w, h: l.h }, others);
    node.position({ x: s.cx, y: s.cy });
    setGuides(s.guides);
  };

  const onKeyDown = (e) => {
    const l = (spec?.layers || []).find((x) => x.id === selectedId);
    if (!l || l.kind === 'shade' || l.locked) return;
    const step = e.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(l.id, { x: l.x + move[0], y: l.y + move[1] });
  };

  const picked = (spec?.layers || []).find((x) => x.id === selectedId);
  return (
    <div ref={wrapRef} className="yts-canvas" tabIndex={0} onKeyDown={onKeyDown} data-testid="yts-canvas"
      aria-label={picked
        ? (picked.locked ? `Thumbnail editor. ${layerName(picked)} is picked and locked.` : `Thumbnail editor. ${layerName(picked)} is picked: drag to move, pull a corner to resize, use the top handle to turn; arrow keys nudge.`)
        : 'Thumbnail editor. Click a layer to move, resize or turn it.'}>
      <Stage ref={stageRef} width={width} height={Math.round((width * HEIGHT) / WIDTH)} scaleX={scale} scaleY={scale}
        onMouseDown={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
        onTouchStart={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}>
        <Layer key={fontsTick}>
          {layers.map((l) => {
            if (l.kind === 'shade') return <Shade key={l.id} l={l} />;
            const Body = BODY[l.kind];
            if (!Body) return null;
            return (
              <Group key={l.id} id={l.id} x={l.x + l.w / 2} y={l.y + l.h / 2} offsetX={l.w / 2} offsetY={l.h / 2}
                rotation={l.rotation} opacity={l.opacity} draggable={!l.locked}
                onMouseDown={() => onSelect(l.id)} onTap={() => onSelect(l.id)}
                onDragMove={(e) => snapDrag(l, e)}
                onDragEnd={(e) => { setGuides([]); change(l, e.target); }}
                onTransformEnd={(e) => { const node = e.target; change(l, node); node.scaleX(1); node.scaleY(1); }}>
                <Body l={l} scale={scale} />
              </Group>
            );
          })}
          {guides.map((g, i) => (
            <Line key={i} points={g.x !== undefined ? [g.x, 0, g.x, HEIGHT] : [0, g.y, WIDTH, g.y]}
              stroke="#E8C468" strokeWidth={2 / scale} dash={[8 / scale, 6 / scale]} listening={false} />
          ))}
          <Transformer ref={trRef} rotateEnabled keepRatio={false} rotationSnaps={[0, 90, 180, 270]} rotationSnapTolerance={4}
            borderStroke="#B8962E" anchorStroke="#B8962E" anchorFill="#FFFFFF" anchorSize={10}
            boundBoxFunc={(oldBox, box) => (Math.abs(box.width) < 12 || Math.abs(box.height) < 12 ? oldBox : box)} />
        </Layer>
      </Stage>
    </div>
  );
}
