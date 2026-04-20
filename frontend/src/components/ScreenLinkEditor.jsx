/**
 * ScreenLinkEditor — Draw tap zones on a phone screen overlay, assign targets, upload icon images.
 *
 * The editor renders the screen image in a canvas that is a pixel-for-pixel replica
 * of the phone's screen area (same aspect ratio, same object-fit/position/scale via
 * getScreenImageStyle, same optional custom bezel). This guarantees that tap-zone
 * coordinates — stored as percentages — map to the exact visual location on the phone.
 *
 * Props:
 *   screen          — the full overlay object (url + image_fit metadata). Preferred over screenUrl.
 *   screenUrl       — fallback image URL if `screen` is not provided (legacy)
 *   links           — array of { id, x, y, w, h, target, label, icon_url }  (% based positions)
 *   screenTypes     — SCREEN_TYPES array for target picker dropdown
 *   globalFit       — device-level fit defaults (applied when screen has no override)
 *   customFrameUrl  — optional custom phone frame image URL (matches PhoneHub behavior)
 *   phoneSkin       — optional skin key for the built-in frame (passed through for visual parity)
 *   onSave(links)   — callback to persist updated links
 *   onUploadIcon(linkId, file) — callback to upload icon image for a zone
 *   readOnly        — if true, hide editing controls (used in preview mode)
 */
import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, Trash2, Upload, Link2, Save, X, Move, GripVertical, Pin, Eye, EyeOff, Ruler, Info, Check, Undo2, Redo2, Grid3x3, AlertTriangle, Loader, Sparkles, ChevronLeft } from 'lucide-react';
import { getIconUrls } from '../lib/overlayUtils';
import { getScreenImageStyle, PHONE_SKINS } from './PhoneHub';
import ZoneBadges from './phone-editor/ZoneBadges';
import ConditionRow from './phone-editor/ConditionRow';
import ActionRow from './phone-editor/ActionRow';
import AIProposalReview from './phone-editor/AIProposalReview';

const ZONE_COLORS = ['#d4789a', '#a889c8', '#c9a84c', '#6bba9a', '#7ab3d4', '#b89060', '#e06060', '#60b0e0'];

// getIconUrls moved to lib/overlayUtils — imported above.

// Grid defaults — 4 columns x 6 rows matches a typical phone home-screen app grid.
const GRID_COLS = 4;
const GRID_ROWS = 6;
const snap = (v, step) => Math.round(v / step) * step;
// When grid-snap is on, round to nearest grid cell edge.
const snapZone = (z, enabled) => {
  if (!enabled) return z;
  const colW = 100 / GRID_COLS;
  const rowH = 100 / GRID_ROWS;
  return {
    ...z,
    x: Math.max(0, Math.min(100, snap(z.x, colW))),
    y: Math.max(0, Math.min(100, snap(z.y, rowH))),
    w: Math.max(colW, snap(z.w, colW)),
    h: Math.max(rowH, snap(z.h, rowH)),
  };
};

const ScreenLinkEditor = forwardRef(function ScreenLinkEditor({
  screen,
  screenUrl,
  links = [],
  screenTypes = [],
  generatedScreenKeys,
  iconOverlays = [],
  globalFit,
  customFrameUrl,
  phoneSkin,
  onSave,
  onUploadIcon,
  onNavigate,
  navigationHistory = [],
  onBack,
  onRequestAiZones,  // (hint?: string) => Promise<{ proposal, context_summary }> — parent hits /ai/add-zones
  // Bulk-place support (Phase 3.3). allScreens = list of screens creators can copy
  // the current zone onto. onBulkPlace(zone, targetScreenIds) persists a copy of the
  // zone (icon, label, position) onto each target screen.
  allScreens = [],
  onBulkPlace,
  readOnly = false,
  compact = false,
}, ref) {
  // Resolve the image URL: prefer the full screen object, fall back to legacy screenUrl prop.
  const resolvedScreenUrl = screen?.url || screenUrl;
  // Build the exact same image style the phone uses, so the editor canvas is a visual twin.
  const imageStyle = screen
    ? getScreenImageStyle(screen, globalFit)
    : { width: '100%', height: '100%', objectFit: 'cover' };
  // Resolve the skin so the editor bezel matches the main phone's skin, not a generic dark rectangle.
  const currentSkin = (PHONE_SKINS && PHONE_SKINS.find(s => s.key === phoneSkin)) || (PHONE_SKINS && PHONE_SKINS[0]) || {
    body: '#1a1a2e', notch: '#333', btn: '#444', shadow: 'rgba(0,0,0,0.3)', accent: 'rgba(255,255,255,0.1)',
  };
  const [zones, setZones] = useState(links);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, origX, origY }
  // UX: toggle into a preview that hides editor chrome so you see exactly what the user sees.
  const [preview, setPreview] = useState(false);
  // UX: toggle dashed guides showing the notch / home-indicator areas to avoid during placement.
  // Also drives "show all zone outlines" when on — flip one switch to see everything for overview.
  const [showSafeArea, setShowSafeArea] = useState(false);
  // Hovering a zone row in the list lights up just that zone on the phone, so you can see
  // which card corresponds to which tap area without committing to a click-to-select.
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  // Bulk-place: zone id currently being "copied to other screens" (null = panel closed)
  // and the set of target screen ids selected via checkboxes.
  const [bulkPlacingZoneId, setBulkPlacingZoneId] = useState(null);
  const [bulkTargetIds, setBulkTargetIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // UX: toggle grid-snap — rounds zone positions/sizes to a 4x6 grid for clean home-screen layouts.
  const [gridSnap, setGridSnap] = useState(() => {
    try { return localStorage.getItem('screenLinkEditor.gridSnap') === '1'; } catch { return false; }
  });
  // Undo/redo stacks — snapshots of the zones array before each mutation.
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [undoTick, setUndoTick] = useState(0); // forces re-render so disabled-state updates
  // Migration notice state — dismissed per-screen and persisted in localStorage so it shows once.
  const MIGRATION_KEY = 'screenLinkEditor.migrationDismissed.v1';
  const [migrationDismissed, setMigrationDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MIGRATION_KEY) || '{}'); } catch { return {}; }
  });
  const containerRef = useRef(null);
  const iconInputRef = useRef(null);
  const uploadingLinkId = useRef(null);
  const [uploadingForZone, setUploadingForZone] = useState(null); // zone id currently uploading — drives the spinner
  // AI proposal — populated after a successful /ai/add-zones call; review modal opens when non-null.
  const [aiProposal, setAiProposal] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    // Retroactively inherit target from the icon library when a zone has an
    // icon_url but no target yet — covers zones created before the auto-fill
    // was wired up on icon selection. Non-destructive: never overwrites an
    // existing target, so per-zone overrides are preserved.
    const enriched = (links || []).map(z => {
      if (z.target) return z;
      const iconUrls = getIconUrls(z);
      if (!iconUrls.length) return z;
      const matchedIcon = iconOverlays.find(i => iconUrls.includes(i.url) && i.opens_screen);
      if (!matchedIcon) return z;
      return { ...z, target: matchedIcon.opens_screen };
    });
    setZones(enriched);
    // Any additions mean the on-disk zones differ from what we just rendered
    // — mark dirty so the Save button lights up and creators can commit the
    // inferred targets (or tweak them first).
    const wasEnriched = enriched.some((z, i) => z.target && !links[i]?.target);
    setIsDirty(wasEnriched);
    // Reset undo stacks when the screen changes (links prop identity changes per screen).
    undoStack.current = [];
    redoStack.current = [];
    setUndoTick(t => t + 1);
  }, [links, iconOverlays]);

  // Save a snapshot of current zones before mutating, clearing redo since the timeline branched.
  const pushUndo = useCallback(() => {
    undoStack.current.push(JSON.stringify(zones));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setUndoTick(t => t + 1);
  }, [zones]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(JSON.stringify(zones));
    const prev = JSON.parse(undoStack.current.pop());
    setZones(prev);
    setIsDirty(true);
    setUndoTick(t => t + 1);
  }, [zones]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(JSON.stringify(zones));
    const next = JSON.parse(redoStack.current.pop());
    setZones(next);
    setIsDirty(true);
    setUndoTick(t => t + 1);
  }, [zones]);

  // Expose save/isDirty/undo/redo to the parent so it can coordinate screen switches.
  useImperativeHandle(ref, () => ({
    save: () => { if (onSave) onSave(zones); setIsDirty(false); },
    isDirty: () => isDirty,
    undo,
    redo,
  }), [onSave, zones, isDirty, undo, redo]);

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo. Only active while editor is mounted.
  useEffect(() => {
    if (readOnly) return;
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      // Don't hijack undo inside inputs — users expect native text-undo there.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, readOnly]);

  // Editing is disabled when parent forced readOnly OR the user flipped into preview mode.
  const editingDisabled = readOnly || preview;
  // Key to persist migration-notice dismissal per screen.
  const screenKey = screen?.id || resolvedScreenUrl || 'unknown';
  const showMigrationNotice = !readOnly && links.length > 0 && !migrationDismissed[screenKey];
  const dismissMigration = () => {
    const next = { ...migrationDismissed, [screenKey]: true };
    setMigrationDismissed(next);
    try { localStorage.setItem(MIGRATION_KEY, JSON.stringify(next)); } catch {}
  };

  // Unified position getter — works for mouse, touch, and pointer events
  const getRelativePos = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Drawing new zones — works for mouse and touch via pointer capture
  const handlePointerDown = (e) => {
    if (editingDisabled || dragging) return;
    if (e.target.closest('[data-zone-id]')) return;
    e.preventDefault();
    // Capture pointer so we keep getting events even if finger moves fast
    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch {}
    }
    const pos = getRelativePos(e);
    setDrawing(true);
    setDrawStart(pos);
    setDrawCurrent(pos);
    setSelectedZone(null);
  };

  const handlePointerMove = (e) => {
    if (dragging) {
      e.preventDefault();
      const pos = getRelativePos(e);
      setZones(prev => prev.map(z => z.id === dragging.id ? {
        ...z,
        x: Math.max(0, Math.min(100 - z.w, dragging.origX + (pos.x - dragging.startX))),
        y: Math.max(0, Math.min(100 - z.h, dragging.origY + (pos.y - dragging.startY))),
      } : z));
      setIsDirty(true);
      return;
    }
    if (!drawing) return;
    e.preventDefault();
    setDrawCurrent(getRelativePos(e));
  };

  const handlePointerUp = (e) => {
    // Release pointer capture
    if (e?.target?.releasePointerCapture && e?.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    if (dragging) {
      // Snap the dragged zone to the grid on release.
      if (gridSnap) {
        setZones(prev => prev.map(z => z.id === dragging.id ? snapZone(z, true) : z));
      }
      setDragging(null);
      return;
    }
    if (!drawing || !drawStart || !drawCurrent) { setDrawing(false); return; }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size threshold — ignore tiny accidental clicks (5% min)
    if (w > 5 && h > 5) {
      pushUndo();
      const raw = {
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
        target: '',
        label: '',
        icon_url: null,
        icon_urls: [],
      };
      const newZone = snapZone(raw, gridSnap);
      setZones(prev => [...prev, newZone]);
      setSelectedZone(newZone.id);
      setIsDirty(true);
    }

    setDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handleZoneDragStart = (e, zone) => {
    e.stopPropagation();
    e.preventDefault();
    if (containerRef.current?.setPointerCapture) {
      try { containerRef.current.setPointerCapture(e.pointerId); } catch {}
    }
    pushUndo();
    const pos = getRelativePos(e);
    setDragging({ id: zone.id, startX: pos.x, startY: pos.y, origX: zone.x, origY: zone.y });
    setSelectedZone(zone.id);
  };

  const updateZone = (id, changes) => {
    pushUndo();
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...changes } : z));
    setIsDirty(true);
  };

  const removeZone = (id) => {
    pushUndo();
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedZone === id) setSelectedZone(null);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onSave) onSave(zones);
    setIsDirty(false);
  };

  const handleIconUpload = (linkId) => {
    uploadingLinkId.current = linkId;
    iconInputRef.current?.click();
  };

  const handleIconFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingLinkId.current) return;
    const linkId = uploadingLinkId.current;
    try {
      // Save any locally-drawn-but-unsaved zones first so the parent's upload handler
      // can find this zone in activeScreen.screen_links. Without this, newly-drawn
      // zones get silently wiped when the parent re-hydrates from the server.
      if (isDirty && onSave) {
        onSave(zones);
        setIsDirty(false);
      }
      setUploadingForZone(linkId);
      if (onUploadIcon) {
        await onUploadIcon(linkId, file);
      }
      // Auto-fill zone label from the filename if empty, matching the library-pick behavior.
      const current = zones.find(z => z.id === linkId);
      if (current && !current.label) {
        const cleanName = (file.name || '')
          .replace(/\.[^.]+$/, '')       // strip extension
          .replace(/[-_]+/g, ' ')         // dashes/underscores → spaces
          .replace(/\s*icon\s*$/i, '')    // strip trailing " icon"
          .trim();
        if (cleanName) updateZone(linkId, { label: cleanName });
      }
    } finally {
      setUploadingForZone(null);
      if (iconInputRef.current) iconInputRef.current.value = '';
      uploadingLinkId.current = null;
    }
  };

  // Add a default zone (alternative to drawing — better for mobile)
  const addDefaultZone = () => {
    const newZone = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: 25, y: 30, w: 20, h: 15,
      target: '', label: '', icon_url: null, icon_urls: [],
    };
    setZones(prev => [...prev, newZone]);
    setSelectedZone(newZone.id);
    setIsDirty(true);
  };

  const drawRect = drawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const sel = selectedZone ? zones.find(z => z.id === selectedZone) : null;

  // Deduplicate icon overlays by URL to avoid showing the same image multiple times
  const uniqueIcons = iconOverlays.filter((ico, idx, arr) => arr.findIndex(i => i.url === ico.url) === idx);

  // Fallback display name for a zone. Preference order:
  //   1. User-typed label
  //   2. Matching icon overlay's human name (strips trailing " Icon")
  //   3. Derived from the icon URL's filename (for inline-uploaded icons
  //      that aren't in the icon library)
  //   4. Target screen name
  //   5. Generic "Zone N" (1-indexed) — never show "Untitled"
  // Purely for display; the underlying zone.label stays empty until the user types one.
  const displayLabel = (zone, index = 0) => {
    if (zone.label) return zone.label;
    const firstIcon = getIconUrls(zone)[0];
    if (firstIcon) {
      const match = iconOverlays.find(i => i.url === firstIcon);
      if (match?.name) return match.name.replace(/\s*Icon$/i, '').trim();
      const fromFile = deriveLabelFromUrl(firstIcon);
      if (fromFile) return fromFile;
    }
    if (zone.target) return zone.target;
    return `Zone ${index + 1}`;
  };

  // Derive a human-readable label from an uploaded icon URL.
  // "https://.../icons/eye-closet-icon-1234567890.png" → "Eye Closet"
  // "calls-nobg.png" → "Calls" (technical suffix stripped)
  // Returns '' when nothing useful can be derived (all digits, empty, etc.).
  const deriveLabelFromUrl = (url) => {
    try {
      const pathname = typeof url === 'string' ? url.split('?')[0] : '';
      const file = pathname.split('/').pop() || '';
      const base = file.replace(/\.[^.]+$/, '');
      // Strip common trailing timestamps (10+ consecutive digits) and leading asset prefixes.
      const cleaned = base.replace(/[-_]?\d{10,}$/, '').replace(/^(icon[-_])/i, '');
      if (!cleaned || !/[a-z]/i.test(cleaned)) return '';
      // Technical suffixes creators add to distinguish asset variants —
      // strip them from the display label so "calls-nobg" reads as "Calls".
      const TECHNICAL_WORDS = new Set([
        'nobg', 'transparent', 'removed', 'removedbg', 'bg', 'alpha',
        'hd', 'sd', 'final', 'v1', 'v2', 'v3', 'new', 'old',
        'copy', 'draft', 'wip', 'png', 'jpg', 'jpeg',
      ]);
      const words = cleaned
        .split(/[-_.\s]+/)
        .filter(Boolean)
        .filter(w => !TECHNICAL_WORDS.has(w.toLowerCase()));
      if (!words.length) return '';
      return words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .replace(/\s*Icon$/i, '')
        .trim();
    } catch {
      return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar — grouped into view toggles / layout tools / history so intent is readable.
          Wrapped in a parchment pill with subtle gold border so it reads as one cohesive control bar. */}
      {!readOnly && (
        <div style={{
          display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
          padding: '4px', margin: '0 auto',
          background: '#FAF7F0',
          border: '1px solid rgba(184,150,46,0.2)',
          borderRadius: 10,
          width: 'fit-content', maxWidth: '100%',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          {/* Group 1 — view toggles */}
          <button
            type="button"
            onClick={() => {
              // Auto-save pending work before entering preview so navigation doesn't silently discard it.
              if (!preview && isDirty && onSave) { onSave(zones); setIsDirty(false); }
              setPreview(p => !p);
            }}
            title={preview ? 'Exit preview — back to editing' : 'Preview how this screen will look on the phone'}
            style={toolbarBtnStyle(preview)}
          >
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
            {preview ? 'Exit Preview' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => setShowSafeArea(s => !s)}
            title="Show all zone outlines + notch/home-indicator safe-area guides"
            style={toolbarBtnStyle(showSafeArea)}
          >
            <Ruler size={12} />
            {showSafeArea ? 'Hide All Zones' : 'Show All Zones'}
          </button>
          <div style={toolbarDividerStyle} />
          {/* Group 2 — layout */}
          <button
            type="button"
            onClick={() => {
              const next = !gridSnap;
              setGridSnap(next);
              try { localStorage.setItem('screenLinkEditor.gridSnap', next ? '1' : '0'); } catch {}
            }}
            title={`Grid snap (${GRID_COLS}x${GRID_ROWS}) — aligns zones to a clean phone-grid layout`}
            style={toolbarBtnStyle(gridSnap)}
          >
            <Grid3x3 size={12} />
            {gridSnap ? 'Snap On' : 'Snap Off'}
          </button>
          <div style={toolbarDividerStyle} />
          {/* Group 3 — history */}
          <button
            type="button"
            onClick={undo}
            disabled={!undoStack.current.length}
            title="Undo (Ctrl+Z)"
            style={{ ...toolbarBtnStyle(false), opacity: undoStack.current.length ? 1 : 0.4, cursor: undoStack.current.length ? 'pointer' : 'not-allowed' }}
          >
            <Undo2 size={12} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.current.length}
            title="Redo (Ctrl+Shift+Z)"
            style={{ ...toolbarBtnStyle(false), opacity: redoStack.current.length ? 1 : 0.4, cursor: redoStack.current.length ? 'pointer' : 'not-allowed' }}
          >
            <Redo2 size={12} />
          </button>
          {/* Group 4 — AI (show-aware add-zones). Only rendered when the parent wired the prop. */}
          {onRequestAiZones && (
            <>
              <div style={toolbarDividerStyle} />
              <button
                type="button"
                onClick={async () => {
                  if (aiBusy) return;
                  try {
                    setAiBusy(true);
                    const result = await onRequestAiZones();
                    if (result?.proposal) setAiProposal(result);
                  } catch (err) {
                    console.error('[ScreenLinkEditor] AI request failed:', err);
                  } finally {
                    setAiBusy(false);
                  }
                }}
                title="Let AI propose zones for this screen (review before apply)"
                style={{ ...toolbarBtnStyle(aiBusy), opacity: aiBusy ? 0.6 : 1, cursor: aiBusy ? 'wait' : 'pointer' }}
              >
                {aiBusy ? <Loader size={12} className="spin" /> : <Sparkles size={12} />}
                {aiBusy ? 'Thinking' : 'AI Zones'}
              </button>
            </>
          )}
        </div>
      )}

      {/* AI proposal review — opens modal when the AI call returns. Approve → merge + save;
          reject → discard. Validation already ran server-side so approve is just a merge. */}
      {aiProposal && (
        <AIProposalReview
          proposal={aiProposal.proposal}
          contextSummary={aiProposal.context_summary}
          busy={aiBusy}
          onReject={() => setAiProposal(null)}
          onApprove={() => {
            const newZones = aiProposal.proposal?.zones || [];
            if (newZones.length) {
              pushUndo();
              const merged = [...zones, ...newZones];
              setZones(merged);
              setIsDirty(true);
              // Persist immediately — AI work is safer on disk than in memory.
              if (onSave) onSave(merged);
              setIsDirty(false);
            }
            setAiProposal(null);
          }}
        />
      )}

      {/* Migration notice — one-time warning so users know to re-check pre-existing zones */}
      {showMigrationNotice && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: '#fdf8ee', border: '1px solid #e6d9b8',
          fontSize: 12, color: '#6b5a28', lineHeight: 1.5,
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: '#B8962E' }} />
          <div style={{ flex: 1 }}>
            The editor now matches the phone&rsquo;s exact dimensions. Existing zones may need to be repositioned — open each and drag into place, then Save Links.
          </div>
          <button
            type="button"
            onClick={dismissMigration}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8962E', padding: 2, flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main editor row — phone and zone list sit side-by-side on desktop
          (>=900px) and stack vertically on mobile. Phone stays fixed-width on
          the left so tap-zone drawing is always at a consistent size; the
          zone list flexes to fill the remaining width. */}
      <div className="sle-main-row">

      {/* Phone-frame wrapper — matches the selected phone skin exactly so the editor
          looks like the same device the user is editing for, not a generic stand-in.
          Zones live inside the inner screen-area div (which keeps the aspect ratio
          that matches PhoneHub). A soft fade keyed off screen.id makes screen switches
          feel polished instead of snapping. */}
      <div
        key={screen?.id || 'no-screen'}
        className="screen-link-editor-frame phone-hub-frame"
        style={{
          /* Bezel dimensions + shadows synced with PhoneHub's built-in frame so
             flipping between preview and edit mode doesn't feel like a different
             device. Any change here should also happen in PhoneHub.jsx. */
          width: '100%', maxWidth: 300, margin: '0 auto',
          padding: '16px 12px 20px',
          background: currentSkin.body,
          backgroundImage: typeof currentSkin.body === 'string' && currentSkin.body.startsWith('linear') ? currentSkin.body : undefined,
          borderRadius: 44,
          boxShadow: `0 8px 32px ${currentSkin.shadow}, inset 0 1px 0 ${currentSkin.accent}, 0 0 0 2px rgba(0,0,0,0.3)`,
          border: '2px solid rgba(0,0,0,0.5)',
          position: 'relative',
      }}>
        {/* Side buttons — match PhoneHub for visual parity */}
        <div style={{ position: 'absolute', left: -5, top: '18%', width: 4, height: 28, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', left: -5, top: '26%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', left: -5, top: '34%', width: 4, height: 44, background: currentSkin.btn, borderRadius: '3px 0 0 3px', border: '1px solid rgba(0,0,0,0.3)', borderRight: 'none' }} />
        <div style={{ position: 'absolute', right: -5, top: '24%', width: 4, height: 64, background: currentSkin.btn, borderRadius: '0 3px 3px 0', border: '1px solid rgba(0,0,0,0.3)', borderLeft: 'none' }} />
        {/* Screen with overlay zones — aspect ratio + image style MUST match PhoneHub
            exactly, or tap-zone percentages won't land at the same visual spot. */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!drawing && !dragging) return; /* captured pointers don't fire leave */ }}
        style={{
          /* Inner screen radius + border synced with PhoneHub's built-in frame. */
          position: 'relative',
          width: '100%',
          aspectRatio: '9/19.5',
          borderRadius: 24,
          touchAction: 'none',
          overflow: 'hidden',
          cursor: editingDisabled ? 'default' : 'crosshair',
          userSelect: 'none',
          border: '2.5px solid #111',
          background: '#000',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.4)',
        }}
      >
        {resolvedScreenUrl ? (
          <img src={resolvedScreenUrl} alt="Screen" style={{ ...imageStyle, pointerEvents: 'none' }} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#f5f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 11 }}>
            No screen image
          </div>
        )}

        {/* Existing zones — in preview mode, render without chrome so the surface
            looks exactly like the phone display. */}
        {zones.map((zone, i) => (
          <div
            key={zone.id}
            data-zone-id={zone.id}
            onPointerDown={(e) => !editingDisabled && handleZoneDragStart(e, zone)}
            onClick={(e) => {
              e.stopPropagation();
              if (preview) {
                // In preview, clicking a zone walks the actual navigation flow — catches broken targets fast.
                if (onNavigate && zone.target) onNavigate(zone.target);
              } else {
                setSelectedZone(zone.id);
              }
            }}
            style={(() => {
              // Clean default: zones are invisible unless the user is actively
              // engaging with them. This keeps the phone preview looking like a
              // phone instead of an editor. Outlines appear when:
              //   1. preview mode: never (preview = walk-as-user flow)
              //   2. Show Guides toggle is on (overview / debug)
              //   3. zone is selected
              //   4. zone is hovered from the list row
              const isSel = selectedZone === zone.id;
              const isHovered = hoveredZoneId === zone.id;
              const showOutline = !preview && (showSafeArea || isSel || isHovered);
              let border = 'none';
              let background = 'transparent';
              if (showOutline) {
                if (isSel) {
                  border = '2px solid #B8962E';
                  background = 'rgba(184,150,46,0.15)';
                } else if (isHovered) {
                  border = '2px solid rgba(184,150,46,0.7)';
                  background = 'rgba(184,150,46,0.06)';
                } else if (!zone.target) {
                  border = '2px dashed #dc2626';
                  background = 'rgba(255,255,255,0.06)';
                } else {
                  border = `2px solid ${ZONE_COLORS[i % ZONE_COLORS.length]}`;
                  background = 'rgba(255,255,255,0.06)';
                }
              }
              return {
                position: 'absolute',
                left: `${zone.x}%`, top: `${zone.y}%`,
                width: `${zone.w}%`, height: `${zone.h}%`,
                border,
                borderRadius: 6,
                background,
                cursor: editingDisabled ? (preview && zone.target ? 'pointer' : 'default') : 'move',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                transition: 'border-color 0.15s, background 0.15s',
              };
            })()}
          >
            {zone.icon_url ? (
              <img src={zone.icon_url} alt={zone.label || zone.target} style={{ width: '92%', height: '92%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
            ) : (
              !preview && (
                <span style={{ fontSize: 7, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', fontFamily: "'DM Mono', monospace", textAlign: 'center', padding: 2 }}>
                  {displayLabel(zone, i)}
                </span>
              )
            )}
          </div>
        ))}

        {/* Draw instruction overlay — shown when no zones exist and not drawing */}
        {!readOnly && zones.length === 0 && !drawing && screenUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)', pointerEvents: 'none',
          }}>
            <div style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
              textAlign: 'center', lineHeight: 1.4,
            }}>
              Draw a rectangle to<br />create a tap zone
            </div>
          </div>
        )}

        {/* Drawing preview */}
        {drawRect && drawRect.w > 1 && drawRect.h > 1 && (
          <div style={{
            position: 'absolute',
            left: `${drawRect.x}%`, top: `${drawRect.y}%`,
            width: `${drawRect.w}%`, height: `${drawRect.h}%`,
            border: '2px dashed #B8962E',
            borderRadius: 6,
            background: 'rgba(184,150,46,0.1)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Back button — appears in preview mode when the user has navigated to a target screen. */}
        {preview && navigationHistory.length > 0 && onBack && (
          <button onClick={(e) => { e.stopPropagation(); onBack(); }} style={{
            position: 'absolute', top: 38, left: 8, zIndex: 10,
            padding: '4px 10px', fontSize: 9, fontWeight: 700, border: 'none',
            borderRadius: 10, background: 'rgba(0,0,0,0.55)', color: '#fff',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
            fontFamily: "'DM Mono', monospace",
          }}>← Back</button>
        )}

        {/* Dynamic Island — matches PhoneHub exactly so it overlaps the same pixels
            on both surfaces. Drawn as an overlay inside the screen area. */}
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: '28%', height: 18, borderRadius: 9,
          background: '#000', zIndex: 6,
          border: '1.5px solid #333',
          pointerEvents: 'none',
        }} />

        {/* Home indicator bar — matches PhoneHub */}
        <div style={{
          position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
          width: '30%', height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.35)', zIndex: 6,
          pointerEvents: 'none',
        }} />

        {/* Safe-area guides — dashed regions users should avoid placing zones in */}
        {showSafeArea && !preview && (
          <>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '7%',
              border: '1px dashed rgba(220,180,60,0.9)',
              background: 'rgba(220,180,60,0.08)',
              pointerEvents: 'none', zIndex: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: 'rgba(220,180,60,1)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5,
            }}>notch area</div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '3.5%',
              border: '1px dashed rgba(220,180,60,0.9)',
              background: 'rgba(220,180,60,0.08)',
              pointerEvents: 'none', zIndex: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: 'rgba(220,180,60,1)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5,
            }}>home indicator</div>
          </>
        )}
      </div>
      </div>

      {/* Zone list + editor */}
      {!readOnly && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            {sel ? (
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', fontSize: 12, fontWeight: 700,
                  border: '1px solid var(--lala-parchment-3, #E8E0D0)',
                  borderRadius: 'var(--lala-radius, 8px)',
                  background: 'var(--lala-surface, #fff)',
                  color: 'var(--lala-ink, #2C2C2C)',
                  cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace", letterSpacing: 0.3,
                  minHeight: 32,
                }}
              >
                <ChevronLeft size={14} /> Back to zones
              </button>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
                TAP ZONES ({zones.length})
              </span>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Add button only in list view — adding a new zone from inside
                  the editor would be confusing. */}
              {!sel && (
                <button onClick={addDefaultZone} style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
                  borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#888',
                  display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
                }}>
                  <Plus size={12} /> Add
                </button>
              )}
              {isDirty && (
                <button onClick={handleSave} style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none',
                  borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, minHeight: 32,
                }}>
                  <Save size={12} /> Save
                </button>
              )}
            </div>
          </div>

          {zones.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '12px 0', lineHeight: 1.6 }}>
              Draw rectangles on the screen to create tap zones. Each zone links to another screen.
            </div>
          )}

          {/* Zone list — drill-in pattern: when a zone is selected, we hide all
              other zones so the panel reads as a dedicated editor for that one
              zone (matches the screens/icons detail flow). The "Back to zones"
              button up top brings the list back. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {zones.filter(z => !sel || z.id === sel.id).map((zone, _filteredIdx) => {
              // Keep the original color-swatch index so drill-in doesn't recolor
              // the zone to something different from how it looks in the list.
              const i = zones.findIndex(z => z.id === zone.id);
              return (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                onMouseEnter={() => setHoveredZoneId(zone.id)}
                onMouseLeave={() => setHoveredZoneId(null)}
                style={{
                  padding: '12px 14px',
                  background: selectedZone === zone.id ? '#fdf8ee' : '#fff',
                  border: `1px solid ${selectedZone === zone.id ? '#B8962E' : (hoveredZoneId === zone.id ? '#E8D9A8' : '#eee')}`,
                  borderRadius: 10,
                  fontSize: 13,
                  boxShadow: selectedZone === zone.id ? '0 2px 8px rgba(184,150,46,0.12)' : 'none',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: selectedZone === zone.id ? 10 : 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: ZONE_COLORS[i % ZONE_COLORS.length], flexShrink: 0 }} />
                  {zone.persistent && <Pin size={12} color="#B8962E" style={{ flexShrink: 0 }} />}
                  {getIconUrls(zone).slice(0, 3).map((url, idx) => (
                    <img key={idx} src={url} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain', marginLeft: idx > 0 ? -4 : 0, padding: 2, background: '#fafafa', border: '1px solid #f0ece4' }} />
                  ))}
                  {getIconUrls(zone).length > 3 && <span style={{ fontSize: 10, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>+{getIconUrls(zone).length - 3}</span>}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{
                      fontFamily: "'Lora', serif",
                      fontSize: 15, fontWeight: 600, lineHeight: 1.25,
                      color: '#2C2C2C',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{displayLabel(zone, i)}</span>
                    {/* Always-visible lock/unlock/action summary — one source of truth for the zone's behavior. */}
                    <ZoneBadges zone={zone} />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 6, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'color 0.15s, background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = 'transparent'; }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded editor for selected zone */}
                {selectedZone === zone.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid #f0ece4' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        value={zone.label || ''}
                        onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                        placeholder="Label (e.g. Messages)"
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 120 }}
                      />
                      <select
                        value={zone.target || ''}
                        onChange={(e) => {
                          const t = screenTypes.find(s => s.key === e.target.value);
                          updateZone(zone.id, { target: e.target.value, label: zone.label || t?.label || '' });
                        }}
                        style={{ padding: '8px 10px', border: '1px solid #e0d9ce', borderRadius: 6, fontSize: 13, minHeight: 36, minWidth: 120, flex: 1 }}
                      >
                        <option value="">— Target —</option>
                        {screenTypes.map(st => {
                          const hasImage = generatedScreenKeys?.has(st.key);
                          return (
                            <option key={st.key} value={st.key}>
                              {st.label}{hasImage ? ' \u2713' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {/* Position & Size — all slider-based for mobile friendliness */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                      {[
                        { label: 'X', key: 'x', max: () => 100 - zone.w },
                        { label: 'Y', key: 'y', max: () => 100 - zone.h },
                        { label: 'W', key: 'w', max: () => 100 - zone.x },
                        { label: 'H', key: 'h', max: () => 100 - zone.y },
                      ].map(s => (
                        <div key={s.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                            <span style={{ fontSize: 10, color: '#888', fontFamily: "'DM Mono', monospace" }}>{s.label}</span>
                            <span style={{ fontSize: 10, color: '#666', fontFamily: "'DM Mono', monospace" }}>{Math.round(zone[s.key])}%</span>
                          </div>
                          <input type="range" min={s.key === 'w' || s.key === 'h' ? 5 : 0} max={s.max()}
                            value={Math.round(zone[s.key])}
                            onChange={e => updateZone(zone.id, { [s.key]: parseInt(e.target.value) })}
                            style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: '#B8962E' }} />
                        </div>
                      ))}
                    </div>
                    {/* Conditions (when should this zone be visible/tappable?) and Actions
                        (what happens on tap, beyond navigate). Both are collapsible / additive.
                        Empty arrays behave as implicit defaults: always visible, navigate(target). */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '1px dashed #f0ece4', borderBottom: '1px dashed #f0ece4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                          VISIBLE WHEN {Array.isArray(zone.conditions) && zone.conditions.length > 0 ? `(${zone.conditions.length})` : '— always'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...(zone.conditions || []), { key: '', op: 'eq', value: true }];
                            updateZone(zone.id, { conditions: next });
                          }}
                          style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#666', fontFamily: "'DM Mono', monospace" }}
                        >+ condition</button>
                      </div>
                      {(zone.conditions || []).map((cond, ci) => (
                        <ConditionRow
                          key={ci}
                          condition={cond}
                          onChange={(nextCond) => {
                            const next = [...(zone.conditions || [])];
                            next[ci] = nextCond;
                            updateZone(zone.id, { conditions: next });
                          }}
                          onRemove={() => {
                            const next = (zone.conditions || []).filter((_, i) => i !== ci);
                            updateZone(zone.id, { conditions: next.length ? next : undefined });
                          }}
                        />
                      ))}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                          ON TAP {Array.isArray(zone.actions) && zone.actions.length > 0 ? `(${zone.actions.length})` : '— navigate only'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = [...(zone.actions || []), { type: 'set_state', key: '', value: true }];
                            updateZone(zone.id, { actions: next });
                          }}
                          style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#666', fontFamily: "'DM Mono', monospace" }}
                        >+ action</button>
                      </div>
                      {(zone.actions || []).map((act, ai) => (
                        <ActionRow
                          key={ai}
                          action={act}
                          screenOptions={screenTypes}
                          onChange={(nextAct) => {
                            const next = [...(zone.actions || [])];
                            next[ai] = nextAct;
                            updateZone(zone.id, { actions: next });
                          }}
                          onRemove={() => {
                            const next = (zone.actions || []).filter((_, i) => i !== ai);
                            updateZone(zone.id, { actions: next.length ? next : undefined });
                          }}
                        />
                      ))}
                    </div>
                    {/* Icons — selected row (if any) + always-visible picker with Upload as the first tile.
                        Clicking a library tile toggles it on/off. Clicking the Upload tile opens the
                        file picker; uploads auto-save any drawn zones first so local work isn't wiped. */}
                    <div>
                      {/* Header row — shows count + Clear All when any icons are attached */}
                      {getIconUrls(zone).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                            ICONS ({getIconUrls(zone).length})
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { icon_urls: [], icon_url: null }); }}
                            style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: '#dc2626', fontFamily: "'DM Mono', monospace" }}
                          >
                            Clear all
                          </button>
                        </div>
                      )}

                      {/* Selected icons row — small chips with remove button. Only shown when zone has icons. */}
                      {getIconUrls(zone).length > 0 && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                          {getIconUrls(zone).map((url, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img src={url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', padding: 3, background: '#fafafa', border: '1px solid #e0d9ce' }} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = getIconUrls(zone).filter(u => u !== url);
                                  updateZone(zone.id, { icon_urls: updated, icon_url: updated[0] || null });
                                }}
                                aria-label="Remove icon"
                                style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, background: '#dc2626', color: '#fff', border: '1.5px solid #fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Always-visible picker. First tile is Upload (creates new icon); rest are
                          library icons. Clicking a library icon toggles on/off; a gold check mark
                          indicates selection. */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                          {getIconUrls(zone).length === 0 ? 'ADD AN ICON' : 'ADD ANOTHER'}
                        </span>
                        {/* Diagnostic: surface the library count so "where are my icons?" is obvious.
                            If this says "3 in library" but you expected more, some icons are missing
                            a URL or category — go to the screen grid and check their status dots. */}
                        <span style={{ fontSize: 9, color: '#b0a890', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                          {uniqueIcons.length} in library
                        </span>
                      </div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                        gap: 6, padding: 2,
                      }}>
                        {/* Upload tile — always first so it's easy to find */}
                        <button
                          onClick={() => handleIconUpload(zone.id)}
                          disabled={uploadingForZone === zone.id}
                          title="Upload a custom icon"
                          style={{
                            position: 'relative',
                            width: '100%', aspectRatio: '1/1', borderRadius: 8,
                            border: '1px dashed #B8962E',
                            background: uploadingForZone === zone.id ? '#fdf8ee' : '#fafaf5',
                            cursor: uploadingForZone === zone.id ? 'wait' : 'pointer',
                            padding: 6,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                            color: '#B8962E',
                            transition: 'background 0.15s',
                          }}
                        >
                          {uploadingForZone === zone.id ? (
                            <Loader size={18} className="spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.3 }}>
                            {uploadingForZone === zone.id ? 'UPLOADING' : 'UPLOAD'}
                          </span>
                        </button>
                        {uniqueIcons.map(ico => {
                          const isSelected = getIconUrls(zone).includes(ico.url);
                          return (
                            <button
                              key={ico.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = getIconUrls(zone);
                                const updated = isSelected
                                  ? current.filter(u => u !== ico.url)
                                  : [...current, ico.url];
                                // Auto-fill label from icon name if zone has no label yet —
                                // saves a step and matches what the icon visually represents.
                                const cleanName = (ico.name || '').replace(/\s*Icon$/i, '').trim();
                                const labelUpdate = !zone.label && !isSelected && cleanName ? { label: cleanName } : {};
                                // Auto-fill target from the icon's `opens_screen` field so the
                                // "this icon opens X" info creators set at icon-creation time
                                // is inherited by any tap zone that uses the icon. Only applied
                                // when the zone doesn't already have a target (don't overwrite
                                // intentional per-zone targets) and only when this is the
                                // selection, not a deselection.
                                const targetUpdate = !zone.target && !isSelected && ico.opens_screen ? { target: ico.opens_screen } : {};
                                updateZone(zone.id, { icon_urls: updated, icon_url: updated[0] || null, ...labelUpdate, ...targetUpdate });
                              }}
                              title={ico.name}
                              style={{
                                position: 'relative',
                                width: '100%', aspectRatio: '1/1', borderRadius: 8,
                                border: isSelected ? '2px solid #B8962E' : '1px solid #e0d9ce',
                                background: isSelected ? '#fdf8ee' : '#fff',
                                cursor: 'pointer', padding: 6,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <img src={ico.url} alt={ico.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 3 }} draggable={false} />
                              {isSelected && (
                                <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, background: '#B8962E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Check size={10} color="#fff" strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {uniqueIcons.length === 0 && (
                        <div style={{ fontSize: 10, color: '#999', textAlign: 'center', padding: '8px 0', fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
                          No library icons yet — upload one or create via "+ New Icon" in the toolbar
                        </div>
                      )}
                    </div>
                    {/* Persistent toggle — pin icon to show on all screens */}
                    <button
                      onClick={(e) => { e.stopPropagation(); updateZone(zone.id, { persistent: !zone.persistent }); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        border: `1px solid ${zone.persistent ? '#B8962E' : '#e0d9ce'}`,
                        borderRadius: 6, cursor: 'pointer', minHeight: 36,
                        background: zone.persistent ? '#fdf8ee' : '#fff',
                        color: zone.persistent ? '#B8962E' : '#888',
                        width: '100%',
                      }}
                    >
                      <Pin size={12} /> {zone.persistent ? 'Pinned — shows on all screens' : 'Pin to all screens'}
                    </button>

                    {/* Bulk-place (Phase 3.3): copy this zone (icon + label +
                        position) onto other screens in one click. Different from
                        "Pin to all screens" — pinning ties every screen to the
                        same live position, bulk-place creates independent copies
                        you can reposition per screen later. */}
                    {onBulkPlace && allScreens.filter(s => s.id !== screen?.id).length > 0 && (
                      <div style={{
                        marginTop: 2,
                        padding: '10px 12px',
                        border: '1px solid #e0d9ce',
                        borderRadius: 8,
                        background: '#fff',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkPlacingZoneId(bulkPlacingZoneId === zone.id ? null : zone.id);
                            setBulkTargetIds(new Set());
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                            padding: 0, fontSize: 12, fontWeight: 600,
                            border: 'none', background: 'none',
                            color: '#2C2C2C', cursor: 'pointer',
                            fontFamily: "'DM Mono', monospace", letterSpacing: 0.3,
                          }}
                        >
                          <span>📋 Also place on other screens</span>
                          <span style={{ color: '#888', fontSize: 11 }}>
                            {bulkPlacingZoneId === zone.id ? 'Close' : 'Open'}
                          </span>
                        </button>

                        {bulkPlacingZoneId === zone.id && (
                          <>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                              gap: 4,
                            }}>
                              {allScreens.filter(s => s.id !== screen?.id).map(s => {
                                const checked = bulkTargetIds.has(s.id);
                                return (
                                  <label
                                    key={s.id}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      padding: '6px 8px',
                                      fontSize: 12,
                                      fontFamily: "'Lora', serif",
                                      color: '#2C2C2C',
                                      background: checked ? '#fdf8ee' : 'transparent',
                                      border: `1px solid ${checked ? '#B8962E' : 'transparent'}`,
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setBulkTargetIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                          return next;
                                        });
                                      }}
                                      style={{ margin: 0, accentColor: '#B8962E' }}
                                    />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {s.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => { setBulkPlacingZoneId(null); setBulkTargetIds(new Set()); }}
                                disabled={bulkBusy}
                                style={{
                                  padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                  border: '1px solid #e0d9ce', borderRadius: 6,
                                  background: '#fff', color: '#888',
                                  cursor: bulkBusy ? 'not-allowed' : 'pointer',
                                  fontFamily: "'DM Mono', monospace",
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!onBulkPlace || bulkTargetIds.size === 0) return;
                                  setBulkBusy(true);
                                  try {
                                    await onBulkPlace(zone, Array.from(bulkTargetIds));
                                    setBulkPlacingZoneId(null);
                                    setBulkTargetIds(new Set());
                                  } finally {
                                    setBulkBusy(false);
                                  }
                                }}
                                disabled={bulkBusy || bulkTargetIds.size === 0}
                                style={{
                                  padding: '6px 12px', fontSize: 11, fontWeight: 700,
                                  border: 'none', borderRadius: 6,
                                  background: (bulkBusy || bulkTargetIds.size === 0) ? '#eee' : '#B8962E',
                                  color: (bulkBusy || bulkTargetIds.size === 0) ? '#999' : '#fff',
                                  cursor: (bulkBusy || bulkTargetIds.size === 0) ? 'not-allowed' : 'pointer',
                                  fontFamily: "'DM Mono', monospace", letterSpacing: 0.3,
                                }}
                              >
                                {bulkBusy ? 'Placing...' : `Place on ${bulkTargetIds.size} screen${bulkTargetIds.size === 1 ? '' : 's'}`}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconFileChange} style={{ display: 'none' }} />
        </div>
      )}
      </div>{/* /.sle-main-row */}

      <style>{`
        /* Inline zone editor: side-by-side on desktop, stacked on mobile. */
        .sle-main-row {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .sle-main-row > .screen-link-editor-frame { flex-shrink: 0; }
        .sle-main-row > :last-child { flex: 1; min-width: 0; }
        @media (max-width: 900px) {
          .sle-main-row { flex-direction: column; align-items: stretch; }
          .sle-main-row > .screen-link-editor-frame { margin: 0 auto; }
        }
      `}</style>
    </div>
  );
});

export default ScreenLinkEditor;

// Shared style for the compact toolbar buttons above the canvas.
function toolbarBtnStyle(active) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', fontSize: 11, fontWeight: 600,
    border: `1px solid ${active ? '#B8962E' : 'transparent'}`,
    borderRadius: 6,
    background: active ? '#fdf8ee' : 'transparent',
    color: active ? '#B8962E' : '#666',
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 0.3,
    minHeight: 30,
  };
}

// Thin vertical divider that groups related toolbar buttons together.
const toolbarDividerStyle = {
  width: 1, height: 20,
  background: 'rgba(184,150,46,0.25)',
  margin: '0 2px',
};
