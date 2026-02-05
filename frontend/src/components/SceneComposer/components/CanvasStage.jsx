import React, { useEffect, useMemo, useState } from "react";

const SNAP_THRESHOLD = 5;
const GRID_SIZE = 20;

export default function CanvasStage({
  format,
  zoom,
  showGrid,
  showRulers,
  snapEnabled,
  selectedScenes,
  selectedAssets,
  selectedWardrobes,
  elementTransforms,
  setElementTransforms,
  selectedElementId,
  setSelectedElementId,
  SCENE_ROLES,
  ASSET_ROLES,
  WARDROBE_ROLES,
  DEFAULT_TRANSFORM,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState({ x: 0, y: 0, width: 200, height: 150 });
  const [snapGuides, setSnapGuides] = useState({ vertical: [], horizontal: [] });
  const [dragInfo, setDragInfo] = useState(null);

  const canvasWidth = useMemo(() => {
    // Fixed base canvas dimensions based on format
    // Templates are at full resolution, but we display them scaled down for editing
    const w = format?.width || 1920;
    // Scale down for comfortable editing view (not dependent on screen size)
    return w > 1920 ? Math.round(w / 2) : (w <= 1280 ? Math.round(w * 0.8) : Math.round(w * 0.7));
  }, [format]);

  const canvasHeight = useMemo(() => {
    const h = format?.height || 1080;
    // Scale down for comfortable editing view
    return h > 1080 ? Math.round(h / 2) : (h <= 720 ? Math.round(h * 0.8) : Math.round(h * 0.7));
  }, [format]);

  const elements = useMemo(() => {
    const out = [];

    const orderWeight = {
      background: 0,
      primary: 1,
      "b-roll": 2,
      costume: 2,
      transition: 3,
      overlay: 4,
      effect: 5,
    };

    selectedScenes.forEach((item) => {
      out.push({
        id: `scene-${item.scene.id}`,
        type: "scene",
        role: item.role,
        data: item.scene,
        zIndex: orderWeight[item.role] ?? 1,
        thumbnail: item.scene.libraryScene?.thumbnail_url || item.scene.thumbnail_url || item.scene.image_url,
      });
    });

    selectedAssets.forEach((item) => {
      out.push({
        id: `asset-${item.asset.id}`,
        type: "asset",
        role: item.role,
        data: item.asset,
        zIndex: orderWeight[item.role] ?? 1,
        thumbnail: item.asset.s3_url_processed || item.asset.s3_url_raw || item.asset.thumbnail_url || item.asset.url,
      });
    });

    selectedWardrobes.forEach((item) => {
      out.push({
        id: `wardrobe-${item.wardrobe.id}`,
        type: "wardrobe",
        role: item.role,
        data: item.wardrobe,
        zIndex: orderWeight[item.role] ?? 2,
        thumbnail: item.wardrobe.image_url || item.wardrobe.thumbnail_url,
      });
    });

    return out.sort((a, b) => a.zIndex - b.zIndex);
  }, [selectedScenes, selectedAssets, selectedWardrobes]);

  function getRoleInfo(el) {
    if (el.type === "scene") return SCENE_ROLES.find((r) => r.id === el.role);
    if (el.type === "asset") return ASSET_ROLES.find((r) => r.id === el.role);
    return WARDROBE_ROLES.find((r) => r.id === el.role);
  }

  function getRect(el, index) {
    const t = elementTransforms[el.id];
    if (!t) {
      // default stagger
      return {
        ...DEFAULT_TRANSFORM,
        x: 50 + index * 20,
        y: 50 + index * 20,
      };
    }
    return { ...DEFAULT_TRANSFORM, ...t };
  }

  function clampToCanvas(x, y, w, h) {
    return {
      x: Math.max(0, Math.min(x, canvasWidth - w)),
      y: Math.max(0, Math.min(y, canvasHeight - h)),
    };
  }

  function calculateSnap(x, y, w, h) {
    if (!snapEnabled) return { x, y, guides: { vertical: [], horizontal: [] } };

    const clamped = clampToCanvas(x, y, w, h);
    let snappedX = clamped.x;
    let snappedY = clamped.y;

    const guides = { vertical: [], horizontal: [] };

    const cx = snappedX + w / 2;
    const cy = snappedY + h / 2;
    const right = snappedX + w;
    const bottom = snappedY + h;

    // canvas center
    const canvasCX = canvasWidth / 2;
    const canvasCY = canvasHeight / 2;

    if (Math.abs(cx - canvasCX) < SNAP_THRESHOLD) {
      snappedX = canvasCX - w / 2;
      guides.vertical.push(canvasCX);
    }
    if (Math.abs(cy - canvasCY) < SNAP_THRESHOLD) {
      snappedY = canvasCY - h / 2;
      guides.horizontal.push(canvasCY);
    }

    // edges
    if (Math.abs(snappedX - 0) < SNAP_THRESHOLD) {
      snappedX = 0;
      guides.vertical.push(0);
    }
    if (Math.abs(snappedY - 0) < SNAP_THRESHOLD) {
      snappedY = 0;
      guides.horizontal.push(0);
    }
    if (Math.abs(right - canvasWidth) < SNAP_THRESHOLD) {
      snappedX = canvasWidth - w;
      guides.vertical.push(canvasWidth);
    }
    if (Math.abs(bottom - canvasHeight) < SNAP_THRESHOLD) {
      snappedY = canvasHeight - h;
      guides.horizontal.push(canvasHeight);
    }

    // grid
    const gx = Math.round(snappedX / GRID_SIZE) * GRID_SIZE;
    const gy = Math.round(snappedY / GRID_SIZE) * GRID_SIZE;
    if (Math.abs(snappedX - gx) < SNAP_THRESHOLD) snappedX = gx;
    if (Math.abs(snappedY - gy) < SNAP_THRESHOLD) snappedY = gy;

    // other elements alignment
    const others = elements
      .filter((e) => e.id !== selectedElementId)
      .map((e, idx) => {
        const r = getRect(e, idx);
        return {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          cx: r.x + r.width / 2,
          cy: r.y + r.height / 2,
          right: r.x + r.width,
          bottom: r.y + r.height,
          visible: r.visible !== false,
        };
      })
      .filter((o) => o.visible);

    others.forEach((o) => {
      // vertical align
      if (Math.abs(snappedX - o.x) < SNAP_THRESHOLD) {
        snappedX = o.x;
        guides.vertical.push(o.x);
      }
      if (Math.abs(cx - o.cx) < SNAP_THRESHOLD) {
        snappedX = o.cx - w / 2;
        guides.vertical.push(o.cx);
      }
      if (Math.abs(right - o.right) < SNAP_THRESHOLD) {
        snappedX = o.right - w;
        guides.vertical.push(o.right);
      }

      // horizontal align
      if (Math.abs(snappedY - o.y) < SNAP_THRESHOLD) {
        snappedY = o.y;
        guides.horizontal.push(o.y);
      }
      if (Math.abs(cy - o.cy) < SNAP_THRESHOLD) {
        snappedY = o.cy - h / 2;
        guides.horizontal.push(o.cy);
      }
      if (Math.abs(bottom - o.bottom) < SNAP_THRESHOLD) {
        snappedY = o.bottom - h;
        guides.horizontal.push(o.bottom);
      }
    });

    // final clamp after snap
    const again = clampToCanvas(snappedX, snappedY, w, h);
    return { x: again.x, y: again.y, guides };
  }

  function onElementMouseDown(e, el, index) {
    const rect = getRect(el, index);
    const isBackground = el.role === "background";
    const isPrimary = el.role === "primary";
    const locked = rect.locked === true;

    if (isBackground || isPrimary || locked) return;

    e.stopPropagation();
    setSelectedElementId(el.id);

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  function onResizeStart(e, el, index, handle) {
    const rect = getRect(el, index);
    const isBackground = el.role === "background";
    const isPrimary = el.role === "primary";
    const locked = rect.locked === true;

    if (isBackground || isPrimary || locked) return;

    e.stopPropagation();
    setSelectedElementId(el.id);

    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  function onMouseMove(e) {
    if (!selectedElementId) return;

    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;

      let newX = initialRect.x + dx;
      let newY = initialRect.y + dy;

      const snapped = calculateSnap(newX, newY, initialRect.width, initialRect.height);
      newX = snapped.x;
      newY = snapped.y;

      setSnapGuides(snapped.guides);
      setDragInfo({ x: Math.round(newX), y: Math.round(newY), width: Math.round(initialRect.width), height: Math.round(initialRect.height) });

      setElementTransforms((prev) => ({
        ...prev,
        [selectedElementId]: {
          ...DEFAULT_TRANSFORM,
          ...(prev[selectedElementId] || {}),
          x: newX,
          y: newY,
        },
      }));
    }

    if (isResizing && resizeHandle) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;

      let { x, y, width, height } = initialRect;

      if (resizeHandle.includes("e")) width = Math.max(50, initialRect.width + dx);
      if (resizeHandle.includes("s")) height = Math.max(50, initialRect.height + dy);

      if (resizeHandle.includes("w")) {
        width = Math.max(50, initialRect.width - dx);
        x = initialRect.x + dx;
        if (width === 50) x = initialRect.x + initialRect.width - 50;
      }

      if (resizeHandle.includes("n")) {
        height = Math.max(50, initialRect.height - dy);
        y = initialRect.y + dy;
        if (height === 50) y = initialRect.y + initialRect.height - 50;
      }

      const clamped = clampToCanvas(x, y, width, height);

      setDragInfo({ x: Math.round(clamped.x), y: Math.round(clamped.y), width: Math.round(width), height: Math.round(height) });

      setElementTransforms((prev) => ({
        ...prev,
        [selectedElementId]: {
          ...DEFAULT_TRANSFORM,
          ...(prev[selectedElementId] || {}),
          x: clamped.x,
          y: clamped.y,
          width,
          height,
        },
      }));
    }
  }

  function onMouseUp() {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragInfo(null);
    setSnapGuides({ vertical: [], horizontal: [] });
  }

  // Shift disables snap (like your legacy)
  useEffect(() => {
    function down(e) {
      if (e.key === "Shift") {
        // snapEnabled is controlled in parent — we don't mutate it here
      }
    }
    function up(e) {
      if (e.key === "Shift") {
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div className="vw-canvas">
      <div className="vw-canvas-format-badge">
        <span>{format?.icon}</span>
        <span>{format?.name}</span>
        <span>({format?.ratio})</span>
      </div>

      {(elements.length === 0) ? (
        <div className="vw-canvas-placeholder">
          <div className="vw-canvas-icon">🎥</div>
          <div className="vw-canvas-title">Scene Template Canvas</div>
          <div className="vw-canvas-subtitle">Add scenes, assets, or wardrobe to start composing</div>
        </div>
      ) : (
        <div className="vw-canvas-container">
          {showRulers && (
            <>
              <div className="vw-ruler vw-ruler-horizontal">
                {[...Array(Math.ceil(canvasWidth / 20))].map((_, i) => (
                  <div key={i} className="vw-ruler-mark" style={{ left: `${i * 20}px` }}>
                    {i % 5 === 0 && <span className="vw-ruler-label">{i * 20}</span>}
                  </div>
                ))}
              </div>
              <div className="vw-ruler vw-ruler-vertical">
                {[...Array(Math.ceil(canvasHeight / 20))].map((_, i) => (
                  <div key={i} className="vw-ruler-mark" style={{ top: `${i * 20}px` }}>
                    {i % 5 === 0 && <span className="vw-ruler-label">{i * 20}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          <div
            className="vw-canvas-active"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onMouseDown={() => setSelectedElementId(null)}
          >
            <div
              className="vw-canvas-viewport"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                backgroundImage: showGrid
                  ? `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`
                  : "none",
                backgroundSize: showGrid ? `${GRID_SIZE}px ${GRID_SIZE}px` : "auto",
                backgroundPosition: showGrid ? "-1px -1px" : "0 0",
              }}
            >
              {elements.map((el, idx) => {
                const roleInfo = getRoleInfo(el);
                const rect = getRect(el, idx);
                const isVisible = rect.visible !== false;
                const isLocked = rect.locked === true;
                const isSelected = selectedElementId === el.id;

                if (!isVisible) return null;

                const isBackground = el.role === "background";
                const isPrimary = el.role === "primary";
                const opacity = (rect.opacity ?? 100) / 100;
                const rotation = rect.rotation ?? 0;

                // Background/primary fills entire stage
                const style = (isBackground || isPrimary)
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: canvasWidth,
                      height: canvasHeight,
                      opacity,
                      overflow: "hidden",
                      zIndex: el.zIndex,
                    }
                  : {
                      position: "absolute",
                      left: rect.x,
                      top: rect.y,
                      width: rect.width,
                      height: rect.height,
                      transform: `scale(${rect.scale || 1}) rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                      cursor: isLocked ? "not-allowed" : (isDragging ? "grabbing" : "grab"),
                      zIndex: rect.zIndex ?? el.zIndex,
                      opacity,
                    };

                return (
                  <div
                    key={el.id}
                    className={[
                      "vw-canvas-layer",
                      isSelected && !(isBackground || isPrimary) ? "vw-layer-selected" : "",
                      isBackground ? "vw-layer-background" : "",
                      isPrimary ? "vw-layer-primary" : "",
                      isLocked ? "vw-layer-locked" : "",
                    ].join(" ")}
                    style={style}
                    onMouseDown={(e) => onElementMouseDown(e, el, idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLocked) setSelectedElementId(el.id);
                    }}
                  >
                    <div className="vw-layer-content" style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                      {el.thumbnail ? (
                        <img
                          src={el.thumbnail}
                          alt={el.data?.title || el.data?.name || "layer"}
                          style={(isBackground || isPrimary) 
                            ? { width: "100%", height: "100%", objectFit: "cover", display: "block" } 
                            : { width: "100%", height: "100%", objectFit: "contain", display: "block" }
                          }
                        />
                      ) : (
                        <div style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "3rem",
                          opacity: 0.6,
                        }}>
                          {roleInfo?.icon || "📷"}
                        </div>
                      )}
                    </div>

                    {isSelected && !(isBackground || isPrimary) && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            border: "3px solid #3b82f6",
                            borderRadius: "8px",
                            pointerEvents: "none",
                          }}
                        />

                        {/* resize handles (FIXED: uses el.id correctly) */}
                        {["nw","n","ne","e","se","s","sw","w"].map((h) => (
                          <div
                            key={h}
                            className={`vw-resize-handle vw-resize-${h}`}
                            onMouseDown={(e) => onResizeStart(e, el, idx, h)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}

              {/* snap guides */}
              {snapGuides.vertical.map((x, i) => (
                <div key={`v-${i}`} className="vw-snap-guide vw-snap-guide-vertical" style={{ left: `${x}px` }} />
              ))}
              {snapGuides.horizontal.map((y, i) => (
                <div key={`h-${i}`} className="vw-snap-guide vw-snap-guide-horizontal" style={{ top: `${y}px` }} />
              ))}

              {/* drag info */}
              {dragInfo && (isDragging || isResizing) && (
                <div className="vw-drag-feedback">
                  <div className="vw-drag-info">
                    <div className="vw-drag-label">Position</div>
                    <div className="vw-drag-value">X: {dragInfo.x}px, Y: {dragInfo.y}px</div>
                  </div>
                  <div className="vw-drag-info">
                    <div className="vw-drag-label">Size</div>
                    <div className="vw-drag-value">{dragInfo.width} × {dragInfo.height}px</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
