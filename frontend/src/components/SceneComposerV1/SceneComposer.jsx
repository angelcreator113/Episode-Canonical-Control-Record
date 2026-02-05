import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CanvasStage from "../SceneComposer/components/CanvasStage";
import "../SceneComposer/SceneComposer.css";

/**
 * Scene Composer v1 (Standalone)
 *
 * Single source of truth: /video-compositions
 * Composition type: "scene_template" (aka "Scene Composer templates")
 *
 * Routes (recommended):
 * - /episodes/:episodeId/scene-templates/new
 * - /episodes/:episodeId/scene-templates/:templateId/edit
 *
 * NOTE: This component is EDITOR-FIRST (no legacy tab gallery).
 * If you want a gallery, it should be a separate screen (later).
 */

const VIDEO_FORMATS = [
  { id: "youtube", name: "YouTube", ratio: "16:9", width: 1920, height: 1080, icon: "📺" },
  { id: "instagram", name: "Instagram", ratio: "1:1", width: 1080, height: 1080, icon: "📷" },
  { id: "instagram-story", name: "IG Story", ratio: "9:16", width: 1080, height: 1920, icon: "📱" },
  { id: "tiktok", name: "TikTok", ratio: "9:16", width: 1080, height: 1920, icon: "🎵" },
  { id: "twitter", name: "Twitter", ratio: "16:9", width: 1280, height: 720, icon: "🐦" },
  { id: "linkedin", name: "LinkedIn", ratio: "16:9", width: 1920, height: 1080, icon: "💼" },
  { id: "facebook", name: "Facebook", ratio: "16:9", width: 1280, height: 720, icon: "👥" },
];

const SCENE_ROLES = [
  { id: "primary", label: "Primary Content", icon: "🎬", color: "#3b82f6" },
  { id: "b-roll", label: "B-Roll", icon: "📹", color: "#8b5cf6" },
  { id: "transition", label: "Transition", icon: "➡️", color: "#f59e0b" },
  { id: "overlay", label: "Video Overlay", icon: "🎞️", color: "#10b981" },
];

const ASSET_ROLES = [
  { id: "primary", label: "Primary Visual", icon: "🖼️", color: "#3b82f6" },
  { id: "background", label: "Background", icon: "🌄", color: "#6b7280" },
  { id: "overlay", label: "Overlay", icon: "✨", color: "#10b981" },
  { id: "effect", label: "Effect/Filter", icon: "🎨", color: "#8b5cf6" },
];

const WARDROBE_ROLES = [
  { id: "costume", label: "Costume Reference", icon: "👗", color: "#ec4899" },
  { id: "overlay", label: "Wardrobe Overlay", icon: "✨", color: "#10b981" },
  { id: "background", label: "Background Item", icon: "🎨", color: "#6b7280" },
];

const DEFAULT_TRANSFORM = { x: 50, y: 50, width: 200, height: 150, scale: 1, opacity: 100, rotation: 0, visible: true, locked: false };

function safeJsonParse(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : (value ?? fallback);
  } catch {
    return fallback;
  }
}

export default function SceneComposerV1() {
  const navigate = useNavigate();
  const { episodeId, templateId } = useParams();

  // Source material
  const [episode, setEpisode] = useState(null);
  const [episodeScenes, setEpisodeScenes] = useState([]);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [episodeWardrobes, setEpisodeWardrobes] = useState([]);

  // Composition (truth: /video-compositions)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [composition, setComposition] = useState(null);

  // Editor selections
  const [sourceTab, setSourceTab] = useState("scenes");
  const [selectedScenes, setSelectedScenes] = useState([]);       // [{ scene, role }]
  const [selectedAssets, setSelectedAssets] = useState([]);       // [{ asset, role }]
  const [selectedWardrobes, setSelectedWardrobes] = useState([]); // [{ wardrobe, role }]

  // Canvas
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [elementTransforms, setElementTransforms] = useState({});
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Format
  const [selectedFormat, setSelectedFormat] = useState("youtube");

  const format = useMemo(
    () => VIDEO_FORMATS.find((f) => f.id === selectedFormat) || VIDEO_FORMATS[0],
    [selectedFormat]
  );

  /**
   * API helpers
   */
  const api = useMemo(() => {
    const base = `/api/v1/episodes/${episodeId}`;
    return {
      getEpisode: () => fetch(`${base}`).then((r) => r.json()),
      getScenes: () => fetch(`${base}/scenes`).then((r) => r.json()),
      getAssets: () => fetch(`${base}/assets`).then((r) => r.json()),
      getWardrobes: () => fetch(`${base}/wardrobes`).then((r) => r.json()),

      createComposition: (payload) =>
        fetch(`${base}/video-compositions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json()),

      getComposition: (id) =>
        fetch(`${base}/video-compositions/${id}`).then((r) => r.json()),

      updateComposition: (id, payload) =>
        fetch(`${base}/video-compositions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json()),
    };
  }, [episodeId]);

  // Load source + composition
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setLoading(true);

        const [epRes, scRes, asRes, waRes] = await Promise.all([
          api.getEpisode().catch(() => null),
          api.getScenes().catch(() => null),
          api.getAssets().catch(() => null),
          api.getWardrobes().catch(() => null),
        ]);

        if (!mounted) return;
        if (epRes?.success) setEpisode(epRes.data);
        if (scRes?.success) setEpisodeScenes(scRes.data || []);
        if (asRes?.success) setEpisodeAssets(asRes.data || []);
        if (waRes?.success) setEpisodeWardrobes(waRes.data || []);

        if (templateId && templateId !== 'new') {
          const compRes = await api.getComposition(templateId);
          if (!mounted) return;

          if (!compRes?.success) throw new Error(compRes?.error || "Failed to load composition");
          hydrateFromComposition(compRes.data);
        } else {
          const compRes = await api.createComposition({
            name: "New Scene Template",
            type: "scene_template",
            status: "draft",
            scenes: [],
            assets: [],
            wardrobes: [],
            layer_transforms: {},
            settings: { format: "youtube" },
          });

          if (!mounted) return;
          if (!compRes?.success) throw new Error(compRes?.error || "Failed to create composition");
          hydrateFromComposition(compRes.data);

          navigate(`/episodes/${episodeId}/scene-templates/${compRes.data.id}/edit`, { replace: true });
        }
      } catch (err) {
        console.error(err);
        alert(err.message || "Failed to load Scene Composer v1");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [api, episodeId, templateId, navigate]);

  function hydrateFromComposition(comp) {
    setComposition(comp);

    const settings = safeJsonParse(comp.settings, {});
    if (settings?.format) setSelectedFormat(settings.format);

    const transforms = safeJsonParse(comp.layer_transforms, {});
    setElementTransforms(transforms || {});

    const scenes = (comp.scenes || []).map((s) => {
      const scene = episodeScenes.find((x) => String(x.id) === String(s.scene_id));
      return scene ? { scene, role: s.role || "primary" } : null;
    }).filter(Boolean);

    const assets = (comp.assets || []).map((a) => {
      const asset = episodeAssets.find((x) => String(x.id) === String(a.asset_id));
      return asset ? { asset, role: a.role || "primary" } : null;
    }).filter(Boolean);

    const wardrobes = (comp.wardrobes || []).map((w) => {
      const wardrobe = episodeWardrobes.find((x) => String(x.id) === String(w.wardrobe_id));
      return wardrobe ? { wardrobe, role: w.role || "costume" } : null;
    }).filter(Boolean);

    setSelectedScenes(scenes);
    setSelectedAssets(assets);
    setSelectedWardrobes(wardrobes);
  }

  async function saveComposition(partial = {}) {
    if (!composition?.id) return;

    const payload = {
      name: partial.name ?? composition.name,
      type: "scene_template",
      scenes: selectedScenes.map((s, i) => ({ scene_id: s.scene.id, role: s.role, order: i })),
      assets: selectedAssets.map((a, i) => ({ asset_id: a.asset.id, role: a.role, order: i })),
      wardrobes: selectedWardrobes.map((w, i) => ({ wardrobe_id: w.wardrobe.id, role: w.role, order: i })),
      layer_transforms: elementTransforms,
      settings: {
        ...(safeJsonParse(composition.settings, {}) || {}),
        format: selectedFormat,
        platform: VIDEO_FORMATS.find((f) => f.id === selectedFormat)?.name,
      },
      ...partial,
    };

    try {
      setSaving(true);
      const res = await api.updateComposition(composition.id, payload);
      if (!res?.success) throw new Error(res?.error || "Save failed");
      setComposition(res.data);
    } catch (err) {
      console.error(err);
      alert(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Autosave (debounced)
  useEffect(() => {
    if (!composition?.id) return;
    const t = setTimeout(() => saveComposition(), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenes, selectedAssets, selectedWardrobes, elementTransforms, selectedFormat]);

  function toggleScene(scene) {
    const exists = selectedScenes.some((s) => String(s.scene.id) === String(scene.id));
    if (exists) setSelectedScenes((p) => p.filter((s) => String(s.scene.id) !== String(scene.id)));
    else setSelectedScenes((p) => [...p, { scene, role: "primary" }]);
  }

  function toggleAsset(asset) {
    const exists = selectedAssets.some((a) => String(a.asset.id) === String(asset.id));
    if (exists) setSelectedAssets((p) => p.filter((a) => String(a.asset.id) !== String(asset.id)));
    else setSelectedAssets((p) => [...p, { asset, role: "primary" }]);
  }

  function toggleWardrobe(wardrobe) {
    const exists = selectedWardrobes.some((w) => String(w.wardrobe.id) === String(wardrobe.id));
    if (exists) setSelectedWardrobes((p) => p.filter((w) => String(w.wardrobe.id) !== String(wardrobe.id)));
    else setSelectedWardrobes((p) => [...p, { wardrobe, role: "costume" }]);
  }

  function changeRole(type, id, role) {
    if (type === "scene") setSelectedScenes((p) => p.map((x) => (String(x.scene.id) === String(id) ? { ...x, role } : x)));
    if (type === "asset") setSelectedAssets((p) => p.map((x) => (String(x.asset.id) === String(id) ? { ...x, role } : x)));
    if (type === "wardrobe") setSelectedWardrobes((p) => p.map((x) => (String(x.wardrobe.id) === String(id) ? { ...x, role } : x)));
  }

  if (loading) {
    return (
      <div className="vw-loading">
        <div className="vw-spinner" />
        <p>Loading Scene Composer v1...</p>
      </div>
    );
  }

  return (
    <div className="video-workspace">
      {/* Header */}
      <div className="vw-header">
        <div className="vw-header-left">
          <button className="vw-back-btn" onClick={() => navigate(-1)} title="Back">
            ←
          </button>
          <div>
            <h2 className="vw-title">🎬 {composition?.name || "Scene Template"}</h2>
            <p className="vw-subtitle">{episode?.episodeTitle || episode?.title || `Episode ${episodeId}`}</p>
          </div>
        </div>

        <div className="vw-header-right">
          <div className="vw-toolbar">
            <div className="vw-toolbar-group">
              <label className="vw-toolbar-label">Zoom:</label>
              {[0.25, 0.5, 1, 2].map((z) => (
                <button key={z} className={`sc-toolbar-btn ${canvasZoom === z ? "active" : ""}`} onClick={() => setCanvasZoom(z)}>
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>

            <div className="vw-toolbar-divider" />

            <div className="vw-toolbar-group">
              <button className={`sc-toolbar-btn ${showGrid ? "active" : ""}`} onClick={() => setShowGrid((v) => !v)}>
                Grid
              </button>
              <button className={`sc-toolbar-btn ${showRulers ? "active" : ""}`} onClick={() => setShowRulers((v) => !v)}>
                Rulers
              </button>
              <button className={`sc-toolbar-btn ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((v) => !v)}>
                Snap
              </button>
            </div>
          </div>

          <div className="vw-format-selector">
            <label className="vw-format-label">Platform:</label>
            <select className="vw-format-select" value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
              {VIDEO_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name} ({f.ratio})
                </option>
              ))}
            </select>
          </div>

          <button className="vw-btn" onClick={() => saveComposition()} disabled={saving} title="Save">
            <span>{saving ? "⏳" : "💾"}</span>
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>

          <button
            className="vw-btn vw-btn-primary"
            onClick={() => navigate(`/episodes/${episodeId}/timeline?composition=${composition?.id}`)}
            title="Open in timeline"
          >
            <span>🎞️</span>
            <span>Open in Timeline</span>
          </button>
        </div>
      </div>

      {/* Main editor layout */}
      <div className="vw-editor">
        {/* Left: Sources */}
        <div className="vw-source-panel">
          <div className="vw-panel-header">
            <div className="vw-panel-tabs">
              <button className={`vw-tab ${sourceTab === "scenes" ? "vw-tab-active" : ""}`} onClick={() => setSourceTab("scenes")}>
                <span>🎬</span>
                <span>Scenes</span>
                <span className="vw-badge">{episodeScenes.length}</span>
              </button>
              <button className={`vw-tab ${sourceTab === "assets" ? "vw-tab-active" : ""}`} onClick={() => setSourceTab("assets")}>
                <span>🎨</span>
                <span>Assets</span>
                <span className="vw-badge">{episodeAssets.length}</span>
              </button>
              <button className={`vw-tab ${sourceTab === "wardrobe" ? "vw-tab-active" : ""}`} onClick={() => setSourceTab("wardrobe")}>
                <span>👗</span>
                <span>Wardrobe</span>
                <span className="vw-badge">{episodeWardrobes.length}</span>
              </button>
            </div>
          </div>

          <div className="vw-panel-content">
            {sourceTab === "scenes" && (
              <div className="vw-source-list">
                {episodeScenes.map((scene) => {
                  const selected = selectedScenes.find((s) => String(s.scene.id) === String(scene.id));
                  return (
                    <div
                      key={scene.id}
                      className={`sc-source-item ${selected ? "sc-source-item-selected" : ""}`}
                      onClick={() => toggleScene(scene)}
                    >
                      <div className="vw-source-thumb">
                        {scene.libraryScene?.thumbnail_url || scene.thumbnail_url ? (
                          <img src={scene.libraryScene?.thumbnail_url || scene.thumbnail_url} alt={scene.title || "Scene"} />
                        ) : (
                          <div className="vw-source-thumb-fallback">🎬</div>
                        )}
                      </div>

                      <div className="vw-source-info">
                        <div className="vw-source-title">{scene.title || `Scene ${scene.scene_number}`}</div>
                        <div className="vw-source-meta">{scene.duration_seconds ? `${scene.duration_seconds}s · ` : ""}{scene.scene_type || ""}</div>
                      </div>

                      <div className="vw-source-check">{selected ? "✓" : ""}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {sourceTab === "assets" && (
              <div className="vw-source-list">
                {episodeAssets.map((asset) => {
                  const selected = selectedAssets.find((a) => String(a.asset.id) === String(asset.id));
                  return (
                    <div
                      key={asset.id}
                      className={`sc-source-item ${selected ? "sc-source-item-selected" : ""}`}
                      onClick={() => toggleAsset(asset)}
                    >
                      <div className="vw-source-thumb">
                        {asset.s3_url_processed || asset.s3_url_raw ? (
                          <img src={asset.s3_url_processed || asset.s3_url_raw} alt={asset.name} />
                        ) : (
                          <div className="vw-source-thumb-fallback">🎨</div>
                        )}
                      </div>

                      <div className="vw-source-info">
                        <div className="vw-source-title">{asset.name}</div>
                        <div className="vw-source-meta">{asset.asset_type ? `${asset.asset_type} · ` : ""}{asset.media_type || ""}</div>
                      </div>

                      <div className="vw-source-check">{selected ? "✓" : ""}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {sourceTab === "wardrobe" && (
              <div className="vw-source-list">
                {episodeWardrobes.map((w) => {
                  const selected = selectedWardrobes.find((x) => String(x.wardrobe.id) === String(w.id));
                  return (
                    <div
                      key={w.id}
                      className={`sc-source-item ${selected ? "sc-source-item-selected" : ""}`}
                      onClick={() => toggleWardrobe(w)}
                    >
                      <div className="vw-source-thumb">
                        {w.image_url || w.thumbnail_url ? (
                          <img src={w.image_url || w.thumbnail_url} alt={w.name} />
                        ) : (
                          <div className="vw-source-thumb-fallback">👗</div>
                        )}
                      </div>

                      <div className="vw-source-info">
                        <div className="vw-source-title">{w.name}</div>
                        <div className="vw-source-meta">{w.type ? `${w.type} · ` : ""}{w.character || "Character"}</div>
                      </div>

                      <div className="vw-source-check">{selected ? "✓" : ""}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="vw-main">
          <div className="vw-canvas">
            <CanvasStage
              selectedFormat={selectedFormat}
              formats={VIDEO_FORMATS}
              canvasZoom={canvasZoom}
              showGrid={showGrid}
              showRulers={showRulers}
              snapEnabled={snapEnabled}
              selectedElementId={selectedElementId}
              setSelectedElementId={setSelectedElementId}
              elementTransforms={elementTransforms}
              setElementTransforms={setElementTransforms}
              selectedScenes={selectedScenes}
              selectedAssets={selectedAssets}
              selectedWardrobes={selectedWardrobes}
              roles={{ SCENE_ROLES, ASSET_ROLES, WARDROBE_ROLES }}
              onHistoryCommit={() => {}}
            />
          </div>
        </div>

        {/* Right: Inspector */}
        <div className="vw-inspector-panel">
          <div className="vw-panel-header">
            <h3 className="vw-panel-title">Properties</h3>
          </div>

          <div className="vw-panel-content">
            <Inspector
              selectedElementId={selectedElementId}
              elementTransforms={elementTransforms}
              setElementTransforms={setElementTransforms}
              selectedScenes={selectedScenes}
              selectedAssets={selectedAssets}
              selectedWardrobes={selectedWardrobes}
              SCENE_ROLES={SCENE_ROLES}
              ASSET_ROLES={ASSET_ROLES}
              WARDROBE_ROLES={WARDROBE_ROLES}
              changeRole={changeRole}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildElements({ selectedScenes, selectedAssets, selectedWardrobes }) {
  const elements = [];

  selectedScenes.forEach((item) => {
    elements.push({
      id: `scene-${item.scene.id}`,
      type: "scene",
      role: item.role,
      data: item.scene,
      thumbnail: item.scene.libraryScene?.thumbnail_url || item.scene.thumbnail_url || item.scene.image_url,
    });
  });

  selectedAssets.forEach((item) => {
    elements.push({
      id: `asset-${item.asset.id}`,
      type: "asset",
      role: item.role,
      data: item.asset,
      thumbnail: item.asset.s3_url_processed || item.asset.s3_url_raw || item.asset.thumbnail_url || item.asset.url,
    });
  });

  selectedWardrobes.forEach((item) => {
    elements.push({
      id: `wardrobe-${item.wardrobe.id}`,
      type: "wardrobe",
      role: item.role,
      data: item.wardrobe,
      thumbnail: item.wardrobe.image_url || item.wardrobe.thumbnail_url,
    });
  });

  return elements;
}

function Inspector({
  selectedElementId,
  elementTransforms,
  setElementTransforms,
  selectedScenes,
  selectedAssets,
  selectedWardrobes,
  SCENE_ROLES,
  ASSET_ROLES,
  WARDROBE_ROLES,
  changeRole,
}) {
  const elements = useMemo(() => buildElements({ selectedScenes, selectedAssets, selectedWardrobes }), [selectedScenes, selectedAssets, selectedWardrobes]);
  const el = elements.find((x) => x.id === selectedElementId);
  const t = elementTransforms[selectedElementId] || DEFAULT_TRANSFORM;

  return (
    <>
      {selectedElementId && el && (
        <div className="vw-inspector-section sc-layer-properties">
          <h4 className="vw-inspector-heading">🎨 Element Properties</h4>

          <div className="vw-property-group">
            <div className="vw-property-label">Layer</div>
            <div className="vw-property-value" style={{ fontWeight: 600 }}>{el.data?.title || el.data?.name || el.id}</div>
          </div>

          <div className="vw-property-group">
            <div className="vw-property-label">Position</div>
            <div className="vw-property-inputs">
              <div className="vw-input-group">
                <label>X</label>
                <input
                  type="number"
                  value={Math.round(t.x || 0)}
                  onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], x: Number(e.target.value) } }))}
                  className="vw-number-input"
                />
              </div>
              <div className="vw-input-group">
                <label>Y</label>
                <input
                  type="number"
                  value={Math.round(t.y || 0)}
                  onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], y: Number(e.target.value) } }))}
                  className="vw-number-input"
                />
              </div>
            </div>
          </div>

          <div className="vw-property-group">
            <div className="vw-property-label">Size</div>
            <div className="vw-property-inputs">
              <div className="vw-input-group">
                <label>W</label>
                <input
                  type="number"
                  min={50}
                  value={Math.round(t.width || 200)}
                  onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], width: Math.max(50, Number(e.target.value)) } }))}
                  className="vw-number-input"
                />
              </div>
              <div className="vw-input-group">
                <label>H</label>
                <input
                  type="number"
                  min={50}
                  value={Math.round(t.height || 150)}
                  onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], height: Math.max(50, Number(e.target.value)) } }))}
                  className="vw-number-input"
                />
              </div>
            </div>
          </div>

          <div className="vw-property-group">
            <div className="vw-property-label">
              Opacity <span className="vw-property-value-badge">{Math.round(t.opacity ?? 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={t.opacity ?? 100}
              onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], opacity: Number(e.target.value) } }))}
              className="vw-slider"
            />
          </div>

          <div className="vw-property-group">
            <div className="vw-property-label">
              Rotation <span className="vw-property-value-badge">{Math.round(t.rotation ?? 0)}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              value={t.rotation ?? 0}
              onChange={(e) => setElementTransforms((p) => ({ ...p, [selectedElementId]: { ...p[selectedElementId], rotation: Number(e.target.value) } }))}
              className="vw-slider"
            />
          </div>

          {/* Role selector */}
          <div className="vw-property-group">
            <div className="vw-property-label">Role</div>
            <select
              className="vw-role-select"
              value={el.role}
              onChange={(e) => {
                const role = e.target.value;
                if (el.type === "scene") changeRole("scene", el.data.id, role);
                if (el.type === "asset") changeRole("asset", el.data.id, role);
                if (el.type === "wardrobe") changeRole("wardrobe", el.data.id, role);
              }}
            >
              {(el.type === "scene" ? SCENE_ROLES : el.type === "asset" ? ASSET_ROLES : WARDROBE_ROLES).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="vw-layer-actions">
            <button
              className="vw-btn-reset"
              onClick={() => setElementTransforms((p) => {
                const copy = { ...p };
                delete copy[selectedElementId];
                return copy;
              })}
            >
              🔄 Reset Transform
            </button>
          </div>
        </div>
      )}

      <div className="vw-inspector-section">
        <h4 className="vw-inspector-heading">Selected Items</h4>
        <div className="vw-inspector-stats">
          <div className="vw-stat"><span className="vw-stat-label">Scenes:</span><span className="vw-stat-value">{selectedScenes.length}</span></div>
          <div className="vw-stat"><span className="vw-stat-label">Assets:</span><span className="vw-stat-value">{selectedAssets.length}</span></div>
          <div className="vw-stat"><span className="vw-stat-label">Wardrobe:</span><span className="vw-stat-value">{selectedWardrobes.length}</span></div>
        </div>
      </div>
    </>
  );
}


