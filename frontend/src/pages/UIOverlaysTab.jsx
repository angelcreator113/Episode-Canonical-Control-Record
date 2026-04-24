/**
 * UIOverlaysTab — Phone Hub Design
 *
 * The phone is the show's interface. All overlays are phone screens.
 * Left: phone device preview showing active screen
 * Right: screen type grid + actions
 * Bottom: detail panel for selected screen (generate, upload, edit, delete)
 */
import { useState, useEffect, useCallback, useRef, useMemo, Component } from 'react';
import { Sparkles, Loader, Upload, Trash2, Download, RefreshCw, X, Eraser, Maximize, Layers, Play, Copy, Info, Monitor, Undo2, ChevronDown, ChevronRight, ChevronLeft, GitBranch, Check, Target } from 'lucide-react';
import api from '../services/api';
import PhoneHub from '../components/PhoneHub';
import PhoneHubSectionTabs from '../components/PhoneHubSectionTabs';
import ScreenLinkEditor from '../components/ScreenLinkEditor';
import IconPlacementMode from '../components/IconPlacementMode';
import { isIcon, isScreen, isGeneratedScreen, deriveTypeKey, getScreenLinks } from '../lib/overlayUtils';
import AIAssistantPanel from '../components/phone-editor/AIAssistantPanel';
import AIProposalReview from '../components/phone-editor/AIProposalReview';
import MissionEditor from '../components/phone-editor/MissionEditor';
// PhoneHubSteps removed — see below where the 4-step guide was deleted.
import ContentZoneEditor from '../components/ContentZoneEditor';
import PhonePreviewMode, { ScreenFlowMap } from '../components/PhonePreviewMode';
import ScreenThumbnailStrip from '../components/phone/ScreenThumbnailStrip';
import ToolbarMenu from '../components/phone/ToolbarMenu';
import '../components/phone/ZonesTab.css';
import './UIOverlaysTab.css';

class OverlayErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[PhoneHub] Component error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>Something went wrong in this section.</p>
          <p style={{ fontSize: 12 }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{
            marginTop: 12, padding: '8px 16px', border: '1px solid #e8e0d0', borderRadius: 8,
            background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function zonesOverlap(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return right > left && bottom > top;
}

function countZoneOverlaps(zones = []) {
  let count = 0;
  for (let i = 0; i < zones.length; i += 1) {
    for (let j = i + 1; j < zones.length; j += 1) {
      if (zonesOverlap(zones[i], zones[j])) count += 1;
    }
  }
  return count;
}

function findZoneOverlapPairs(zones = []) {
  const pairs = [];
  for (let i = 0; i < zones.length; i += 1) {
    for (let j = i + 1; j < zones.length; j += 1) {
      if (zonesOverlap(zones[i], zones[j])) {
        pairs.push([zones[i]?.id, zones[j]?.id]);
      }
    }
  }
  return pairs;
}

export default function UIOverlaysTab({ showId: propShowId }) {
  const [showId, setShowId] = useState(propShowId || null);
  const [shows, setShows] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editorTab, setEditorTab] = useState('actions');
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState('phone'); // 'phone' or 'phone_icon'
  const [phoneSkin, setPhoneSkin] = useState('rosegold');
  const [customFrameUrl, setCustomFrameUrl] = useState(null);
  // Top-level tab bar state — replaces the old `editingLinks` boolean and
  // PhoneHub's internal `gridSection`. Values: 'screens' | 'icons' |
  // 'placements' | 'zones' | 'missions'. Centralizing this here means the
  // tab bar can host all five sections and the phone stays in one place.
  const [activeTab, setActiveTab] = useState('screens');
  const editingLinks = activeTab === 'zones';  // kept as an alias so legacy
                                                // references below keep working
                                                // until 3c refactors them out.
  const editingContent = activeTab === 'content';  // new Content top-level tab,
                                                   // promoted out of the old
                                                   // Zones mode toggle.
  // 'zones' — draw-rectangle ScreenLinkEditor (the precise/advanced mode with conditions, variants, AI).
  // 'icons' — IconPlacementMode (tap the phone, pick an icon from the picker — simpler for placing
  // app-icon-style tap zones on a home screen). Both persist to the same screen_links array.
  // Content zones are a different feature (content_zones table) and now live on
  // their own top-level tab instead of inside this toggle.
  const [zoneEditorMode, setZoneEditorMode] = useState('zones');
  const [tapZonesDraft, setTapZonesDraft] = useState([]);
  const [tapZonesDirty, setTapZonesDirty] = useState(false);
  const [tapSelectedZoneId, setTapSelectedZoneId] = useState(null);
  const [pendingIssueFocus, setPendingIssueFocus] = useState(null);
  const [flowAudit, setFlowAudit] = useState(null);
  const [navHistory, setNavHistory] = useState([]);  // stack of screen keys for back navigation
  const [globalFit, setGlobalFit] = useState({});    // device-level fit applied to all screens
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [addingVariant, setAddingVariant] = useState(false);
  const [newVariantLabel, setNewVariantLabel] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showFlowMap, setShowFlowMap] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ actions: true, fit: false, links: false, content: false, variants: true });
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const undoStackRef = useRef([]);  // undo history for activeScreen changes
  const frameRemovedRef = useRef(false);  // tracks if user explicitly removed the custom frame
  const activeScreenRef = useRef(null);  // ref mirror of activeScreen for stable closures
  const [batchUploading, setBatchUploading] = useState(false);
  const [hiddenScreens, setHiddenScreens] = useState(() => {
    // Guard against malformed storage (non-array JSON) — earlier bugs wrote
    // strings or objects; if `.includes()` is called on a non-array it throws
    // and breaks the whole grid render. Fail closed (empty list) so creators
    // just see everything instead of a blank screen.
    try {
      const raw = JSON.parse(localStorage.getItem('phone_hub_hidden') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  });
  const [showHidden, setShowHidden] = useState(false);
  const fileInputRef = useRef(null);
  const variantInputRef = useRef(null);
  const frameInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const pollRef = useRef(null);
  const genTimeoutRef = useRef(null);  // tracks the 5-min generation timeout
  const linkEditorRef = useRef(null);  // exposes save()/isDirty()/undo()/redo() from the inline zone editor
  const [removingBg, setRemovingBg] = useState(false);  // loading state for Remove BG

  // Keep activeScreenRef in sync with activeScreen state
  useEffect(() => { activeScreenRef.current = activeScreen; }, [activeScreen]);

  useEffect(() => {
    if (!pendingIssueFocus || !activeScreen) return;
    const sameScreen = activeScreen.id === pendingIssueFocus.screenId;
    const sameMode = zoneEditorMode === pendingIssueFocus.mode;
    if (!sameScreen || !sameMode) return;
    if (pendingIssueFocus.mode === 'zones' && pendingIssueFocus.zoneId) {
      linkEditorRef.current?.setSelectedZone?.(pendingIssueFocus.zoneId);
    }
    setPendingIssueFocus(null);
  }, [pendingIssueFocus, activeScreen, zoneEditorMode]);

  // Load phone skin preference
  useEffect(() => {
    const saved = localStorage.getItem('phone_hub_skin');
    if (saved) setPhoneSkin(saved);
  }, []);

  const handleHideScreen = (key) => {
    setHiddenScreens(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem('phone_hub_hidden', JSON.stringify(next));
      return next;
    });
  };

  const handleChangeSkin = (skin) => {
    setPhoneSkin(skin);
    localStorage.setItem('phone_hub_skin', skin);
  };

  const flash = useCallback((msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); }, []);

  // ── Undo system ──
  // Read from activeScreenRef (kept in sync below) rather than closing over
  // the `activeScreen` state so rapid sequences (switch screen → pushUndo →
  // switch back → pushUndo) capture the latest value without waiting for the
  // callback to be re-created on the next render.
  const pushUndo = useCallback(() => {
    const current = activeScreenRef.current;
    if (current) {
      undoStackRef.current.push(JSON.parse(JSON.stringify(current)));
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop();
    setActiveScreen(prev);
    setOverlays(ov => ov.map(o => o.id === prev.id ? { ...o, ...prev } : o));
    flash('Undone');
  }, [flash]);

  // Close detail panel — revert phone display to home screen
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setActiveTab('screens');
    undoStackRef.current = [];
    const home = overlays.find(o => o.is_home && o.generated && o.url)
      || overlays.find(o => o.generated && o.url && isScreen(o));
    if (home) setActiveScreen(home);
  }, [overlays]);

  // Ctrl+Z and Escape listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 'Escape' && panelOpen) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        closePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, panelOpen, closePanel]);

  // Lock body scroll when editor modal is open
  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [panelOpen]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Load saved phone frame + global fit settings
  useEffect(() => {
    if (!showId) return;
    frameRemovedRef.current = false;  // reset on show change
    api.get(`/api/v1/ui-overlays/${showId}/frame`).then(r => {
      if (!frameRemovedRef.current && r.data?.frame_url) setCustomFrameUrl(r.data.frame_url);
      if (r.data?.global_fit) setGlobalFit(r.data.global_fit);
    }).catch(err => {
      console.warn('[PhoneHub] Failed to load frame/fit settings:', err.message);
    });
  }, [showId]);

  // Upload custom phone frame (persists to S3)
  const handleFrameUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !showId) return;
    frameRemovedRef.current = false;
    const prevUrl = customFrameUrl;
    const previewUrl = URL.createObjectURL(file);
    // Revoke old blob URL to prevent memory leak
    if (prevUrl && prevUrl.startsWith('blob:')) URL.revokeObjectURL(prevUrl);
    setCustomFrameUrl(previewUrl);
    flash('Uploading frame...');
    try {
      const fd = new FormData();
      fd.append('frame', file);
      const res = await api.post(`/api/v1/ui-overlays/${showId}/frame`, fd, { timeout: 30000 });
      if (res.data?.frame_url) {
        setCustomFrameUrl(res.data.frame_url);
        flash('Frame uploaded!');
      } else {
        flash('Frame preview set (upload may still be processing)');
      }
    } catch (err) {
      // Keep the preview URL so the user can still see the frame locally
      console.error('[PhoneHub] Frame upload failed:', err.message);
      flash(err.response?.data?.error || 'Frame upload failed — preview only', 'error');
    }
    if (frameInputRef.current) frameInputRef.current.value = '';
  };

  // Batch upload — match files to existing screen types by filename
  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !showId) return;
    // Match against the show's DB-defined screen keys
    const screenKeys = overlays.map(o => o.id);
    const matchCount = files.filter(f => {
      const name = f.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_');
      return screenKeys.find(k => name.includes(k) || name.includes(k.replace(/_/g, '')));
    }).length;
    if (matchCount > 0 && overlays.some(o => o.generated)) {
      if (!confirm(`Upload ${files.length} files? This may overwrite ${matchCount} existing screens.`)) {
        if (batchInputRef.current) batchInputRef.current.value = '';
        return;
      }
    }
    setBatchUploading(true);
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      const name = file.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_');
      // Try to match filename to an existing screen key
      const match = screenKeys.find(k => name.includes(k) || name.includes(k.replace(/_/g, '')));
      if (!match) {
        // No existing type matches — create a new type from the filename.
        // If that 409s (a type with the same slug already exists but our local
        // screenKeys list was stale, or the slug matches an icon vs a screen),
        // fall through to the upload step instead of marking the file failed.
        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        const typeKey = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
        try {
          try {
            await api.post(`/api/v1/ui-overlays/${showId}/types`, {
              name: cleanName, beat: 'Various', description: `Uploaded from ${file.name}`,
              prompt: `Phone screen for ${cleanName}`, category: 'phone',
            });
          } catch (createErr) {
            // 409 = type already exists under this slug; upload to it anyway.
            // Anything else is a real create failure — surface as file failure.
            if (createErr?.response?.status !== 409) throw createErr;
          }
          const fd = new FormData();
          fd.append('image', file);
          await api.post(`/api/v1/ui-overlays/${showId}/upload/${typeKey}`, fd);
          uploaded++;
        } catch { failed++; }
        continue;
      }
      // Upload to existing type
      try {
        const fd = new FormData();
        fd.append('image', file);
        await api.post(`/api/v1/ui-overlays/${showId}/upload/${match}`, fd);
        uploaded++;
      } catch { failed++; }
    }

    loadOverlays(false);
    setBatchUploading(false);
    flash(`Batch upload: ${uploaded} uploaded${failed ? `, ${failed} failed/unmatched` : ''}`, failed && !uploaded ? 'error' : 'success');
    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  // Load shows
  useEffect(() => {
    if (propShowId) { setShowId(propShowId); return; }
    api.get('/api/v1/shows').then(r => {
      const s = r.data?.data || [];
      setShows(s);
      if (s.length > 0 && !showId) setShowId(s[0].id);
    }).catch(() => {});
  }, [propShowId]);

  // Load overlays — auto-select home screen as default
  const loadOverlays = useCallback((showLoader) => {
    if (!showId) return;
    if (showLoader) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then(r => {
        const data = r.data?.data || [];
        setOverlays(data);
        // Auto-select home screen (or first screen) on initial load if nothing is selected
        if (!activeScreenRef.current) {
          const home = data.find(o => o.is_home && o.generated && o.url)
            || data.find(o => o.generated && o.url && isScreen(o));
          if (home) setActiveScreen(home);
        }
      })
      .catch(() => setOverlays([]))
      .finally(() => setLoading(false));
  }, [showId]);

  const screenDiagnostics = useMemo(() => {
    const screens = overlays.filter(o => o.generated && o.url && isScreen(o));
    const generatedKeys = new Set(screens.map(s => s.id));
    const diagnostics = new Map();

    screens.forEach((screen) => {
      const links = getScreenLinks(screen);
      const contentZones = screen.content_zones || screen.metadata?.content_zones || [];
      const iconCount = links.filter(link => (
        !!link?.icon_overlay_id
        || !!link?.icon_url
        || (Array.isArray(link?.icon_urls) && link.icon_urls.length > 0)
      )).length;
      const tapCount = Math.max(0, links.length - iconCount);

      const invalidBoundsZones = links.filter(link => {
        if (typeof link?.x !== 'number' || typeof link?.y !== 'number' || typeof link?.w !== 'number' || typeof link?.h !== 'number') return true;
        if (link.w <= 0 || link.h <= 0) return true;
        if (link.x < 0 || link.y < 0) return true;
        if ((link.x + link.w) > 100 || (link.y + link.h) > 100) return true;
        return false;
      });

      const missingTargetZones = links.filter(link => !link?.target);
      const brokenTargetZones = links.filter(link => link?.target && !generatedKeys.has(link.target));
      const untypedContentZones = contentZones.filter(zone => !zone?.content_type);
      const overlapPairs = findZoneOverlapPairs(links);

      const invalidBounds = invalidBoundsZones.length;
      const missingTarget = missingTargetZones.length;
      const brokenTarget = brokenTargetZones.length;
      const untypedContent = untypedContentZones.length;
      const overlapCount = overlapPairs.length;

      const issues = [];
      const issueItems = [];
      if (brokenTarget > 0) issues.push(`${brokenTarget} zone${brokenTarget > 1 ? 's have' : ' has'} a missing destination screen`);
      if (brokenTarget > 0) {
        issueItems.push({
          id: `${screen.id}-broken-target`,
          text: `${brokenTarget} broken target${brokenTarget > 1 ? 's' : ''}`,
          mode: 'zones',
          screenId: screen.id,
          zoneId: brokenTargetZones[0]?.id,
        });
      }
      if (invalidBounds > 0) issues.push(`${invalidBounds} zone${invalidBounds > 1 ? 's are' : ' is'} outside valid bounds`);
      if (invalidBounds > 0) {
        issueItems.push({
          id: `${screen.id}-invalid-bounds`,
          text: `${invalidBounds} zone${invalidBounds > 1 ? 's' : ''} out of bounds`,
          mode: 'zones',
          screenId: screen.id,
          zoneId: invalidBoundsZones[0]?.id,
        });
      }
      if (missingTarget > 0) issues.push(`${missingTarget} zone${missingTarget > 1 ? 's are' : ' is'} missing a target`);
      if (missingTarget > 0) {
        issueItems.push({
          id: `${screen.id}-missing-target`,
          text: `${missingTarget} zone${missingTarget > 1 ? 's' : ''} missing target`,
          mode: 'zones',
          screenId: screen.id,
          zoneId: missingTargetZones[0]?.id,
        });
      }
      if (untypedContent > 0) issues.push(`${untypedContent} content zone${untypedContent > 1 ? 's are' : ' is'} unassigned`);
      if (untypedContent > 0) {
        issueItems.push({
          id: `${screen.id}-content-untyped`,
          text: `${untypedContent} content zone${untypedContent > 1 ? 's' : ''} unassigned`,
          mode: 'content',
          screenId: screen.id,
          zoneId: untypedContentZones[0]?.id,
        });
      }
      if (overlapCount > 0) issues.push(`${overlapCount} zone overlap${overlapCount > 1 ? 's need' : ' needs'} review`);
      if (overlapCount > 0) {
        issueItems.push({
          id: `${screen.id}-overlap`,
          text: `${overlapCount} overlap${overlapCount > 1 ? 's' : ''} found`,
          mode: 'zones',
          screenId: screen.id,
          zoneId: overlapPairs[0]?.[0],
        });
      }

      let severity = 'ok';
      if (brokenTarget > 0 || invalidBounds > 0) severity = 'error';
      else if (issues.length > 0) severity = 'warn';

      diagnostics.set(screen.id, {
        counts: {
          tap: tapCount,
          icon: iconCount,
          content: contentZones.length,
        },
        issues,
        issueItems,
        issueCount: issues.length,
        severity,
      });
    });

    return diagnostics;
  }, [overlays]);

  useEffect(() => { loadOverlays(true); }, [loadOverlays]);
  useEffect(() => { return () => { if (pollRef.current) clearTimeout(pollRef.current); if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current); }; }, []);

  // Generate all
  const handleGenerateAll = async () => {
    if (!showId) return;
    setGenerating(true);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate-all`);
      let pollErrors = 0;
      const poll = () => {
        api.get(`/api/v1/ui-overlays/${showId}`).then(r => {
          pollErrors = 0;
          const data = r.data?.data || [];
          setOverlays(data);
          if (data.filter(o => o.generated).length >= data.length) {
            clearTimeout(pollRef.current); pollRef.current = null; setGenerating(false);
            return;
          }
          pollRef.current = setTimeout(poll, 5000);
        }).catch(() => {
          pollErrors++;
          if (pollErrors >= 5) { pollRef.current = null; setGenerating(false); flash('Generation polling failed — refresh to check status', 'error'); return; }
          pollRef.current = setTimeout(poll, 5000 * Math.pow(2, pollErrors));
        });
      };
      pollRef.current = setTimeout(poll, 3000);
      genTimeoutRef.current = setTimeout(() => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; } setGenerating(false); }, 300000);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); setGenerating(false); }
  };

  // Shared: auto-run background removal on freshly-uploaded icon assets.
  // Icons are almost always meant to be transparent PNGs sitting on top of a
  // phone screen — leaving the original background in makes them look like
  // clunky rectangles. Screens skip this (full-bleed images keep their
  // backgrounds). Non-blocking: if bg removal fails, the upload still stands
  // and creators can retry via the Remove BG button on the detail card.
  const autoRemoveBgIfIcon = async (freshOverlays, typeKey) => {
    if (!showId || !typeKey) return false;
    const item = freshOverlays.find(o => o.id === typeKey);
    if (!item) return false;
    const isIcon = item.category === 'phone_icon' || item.category === 'icon';
    if (!isIcon || !item.asset_id || item.bg_removed) return false;
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/remove-bg/${item.asset_id}`);
      return true;
    } catch (err) {
      console.warn('[autoRemoveBgIfIcon] failed', err);
      return false;
    }
  };

  // Shared: auto-place an icon on the home screen when it has both a linked
  // navigation target (opens_screen) and an image (url). Idempotent — skips
  // if a zone on the home screen already references this icon's URL. Returns
  // true when a new zone was placed, false otherwise. Callers refresh state
  // themselves; this only performs the PUT.
  const autoPlaceIconOnHome = async (freshOverlays, iconTypeKey) => {
    if (!showId || !iconTypeKey) return false;
    const icon = freshOverlays.find(o => o.id === iconTypeKey);
    if (!icon) return false;
    const isIcon = icon.category === 'phone_icon' || icon.category === 'icon';
    if (!isIcon || !icon.url || !icon.opens_screen) return false;
    const home = freshOverlays.find(o => o.is_home && o.generated && o.url && o.category === 'phone')
      || freshOverlays.find(o => o.generated && o.url && o.category === 'phone');
    if (!home?.asset_id) return false;
    const existingLinks = getScreenLinks(home);
    if (existingLinks.some(l => l.icon_url === icon.url)) return false;
    const iconLinks = existingLinks.filter(l => l.icon_url);
    const col = iconLinks.length % 4;
    const row = Math.floor(iconLinks.length / 4);
    const newZone = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: 8 + col * 22,
      y: Math.max(8, 75 - row * 14),
      w: 18, h: 10,
      target: icon.opens_screen,
      label: icon.name,
      icon_url: icon.url,
      icon_urls: [icon.url],
    };
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${home.asset_id}`, {
        screen_links: [...existingLinks, newZone],
      });
      return true;
    } catch (err) {
      console.warn('[autoPlaceIconOnHome] failed', err);
      return false;
    }
  };

  // Generate one
  const handleGenerateOne = async (overlayId, prompt) => {
    if (!showId) return;
    setGeneratingId(overlayId);
    try {
      const body = prompt ? { prompt } : {};
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlayId}`, body);
      flash('Generated!');
      // Refresh this screen
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === overlayId);
      if (updated) setActiveScreen(updated);
      // Newly-generated icons with an opens_screen target haven't been placed
      // yet; auto-place them on home so creators don't have to remember a
      // second step after generation.
      if (await autoPlaceIconOnHome(all, overlayId)) {
        loadOverlays(false);
        flash('Generated + placed on home screen');
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    setGeneratingId(null);
  };

  // Upload image for a screen
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeScreen?.id) return;
    // Confirm overwrite if screen already has an image
    if (activeScreen.url && activeScreen.generated) {
      if (!confirm(`"${activeScreen.name}" already has an image. Replace it?`)) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${activeScreen.id}`, fd);
      flash('Uploaded!');
      let all = (await api.get(`/api/v1/ui-overlays/${showId}`)).data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) setActiveScreen(updated);
      // Auto-bg-removal disabled — user reported it was replacing their
      // uploaded icon with a bg-stripped version, which read as "a new
      // image got auto-generated." The Remove BG button on the detail
      // card is still available for the cases where they DO want it.
      // Freshly-uploaded icon with a pre-set opens_screen? Place it on home.
      if (await autoPlaceIconOnHome(all, activeScreen.id)) {
        loadOverlays(false);
        flash('Uploaded + placed on home screen');
      } else if ((updated?.category === 'phone_icon' || updated?.category === 'icon')) {
        flash('Uploaded + bg removed');
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload variant
  const handleVariantUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeScreen?.id || !newVariantLabel.trim() || !showId) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('variant_label', newVariantLabel.trim());
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${activeScreen.id}`, fd);
      flash(`Variant "${newVariantLabel.trim()}" uploaded!`);
      setNewVariantLabel('');
      setAddingVariant(false);
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) {
        setActiveScreen(updated);
        // Switch to the new variant
        if (updated.variants) setActiveVariantIdx(updated.variants.length - 1);
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    if (variantInputRef.current) variantInputRef.current.value = '';
  };

  // Remove background
  const handleRemoveBg = async () => {
    if (!activeScreen?.asset_id || removingBg) return;
    setRemovingBg(true);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/remove-bg/${activeScreen.asset_id}`);
      flash('Background removed!');
      const res = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = res.data?.data || [];
      setOverlays(all);
      const updated = all.find(o => o.id === activeScreen.id);
      if (updated) setActiveScreen(updated);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    setRemovingBg(false);
  };

  // Delete screen + clean up any links pointing to it from other screens
  const handleDeleteScreen = async (screen) => {
    if (!screen) return;
    if (!confirm(`Delete "${screen.name}"? Any links pointing to this screen will be removed.`)) return;
    try {
      const deletedKey = screen.id;
      if (screen.custom && screen.custom_id) {
        // Custom screen: delete the type definition (removes it from the list entirely)
        await api.delete(`/api/v1/ui-overlays/${showId}/types/${screen.custom_id}`);
      }
      if (screen.asset_id) {
        // Delete the asset (image)
        await api.delete(`/api/v1/ui-overlays/${showId}/asset/${screen.asset_id}`);
      }
      // For built-in screen types, hide them so they don't reappear as placeholders
      if (!screen.custom) {
        handleHideScreen(deletedKey);
      }
      // Clean orphaned links: remove any screen_links targeting the deleted screen
      for (const overlay of overlays) {
        const links = getScreenLinks(overlay);
        const orphans = links.filter(l => l.target === deletedKey);
        if (orphans.length > 0 && overlay.asset_id) {
          const cleaned = links.filter(l => l.target !== deletedKey);
          api.put(`/api/v1/ui-overlays/${showId}/screen-links/${overlay.asset_id}`, { screen_links: cleaned })
            .catch(err => console.warn(`[handleDeleteScreen] orphan cleanup failed on ${overlay.name}`, err));
        }
      }
      // Optimistic removal from local state
      setOverlays(prev => prev.filter(o => o.id !== deletedKey));
      if (activeScreen?.id === deletedKey) { closePanel(); }
      flash('Deleted');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };
  const handleDelete = () => handleDeleteScreen(activeScreen);

  // Download — fetch as blob for cross-origin S3 URLs
  const handleDownload = async () => {
    if (!activeScreen?.url) return;
    const filename = `${activeScreen.id || 'screen'}.png`;
    try {
      const resp = await fetch(activeScreen.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab if fetch fails (e.g., CORS)
      window.open(activeScreen.url, '_blank');
    }
  };

  // Create custom screen or icon
  // The Create modal is strictly for *new* entries. If the slug collides with
  // an existing type (409), bail with a clear error and point the creator at
  // the right remedy (rename, pick from grid, or use the Type toggle). The
  // previous "silently upload to the existing entry" recovery was confusing
  // because the modal's button says "Create" — replacing an existing screen
  // is supposed to happen from that screen's detail panel, not this modal.
  const handleCreateScreen = async (form, file) => {
    // If the user attaches a file while creating, we still want the image to land
    // on the matching type even when the create POST returns 409 (name already
    // exists). Resolve the target type_key from either the create response or
    // the existing list, then upload — but only if the existing type's category
    // matches what the creator just asked for, otherwise we'd silently upload
    // a new Icon's image to an existing Screen (or vice versa).
    const deriveTypeKey = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const categoryMatches = (existing, target) => {
      const existingIsIcon = existing?.category === 'phone_icon' || existing?.category === 'icon';
      const targetIsIcon = target === 'phone_icon' || target === 'icon';
      return existingIsIcon === targetIsIcon;
    };
    try {
      let newType = null;
      try {
        const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, { ...form, category: createMode });
        newType = res.data?.data;
      } catch (err) {
        if (err.response?.status === 409) {
          // Find the colliding overlay locally to give the creator a precise
          // description of what to do. Fall back to a generic message if we
          // can't locate it (stale local state).
          const targetKey = deriveTypeKey(form.name);
          const existing = overlays.find(o => o.id === targetKey || deriveTypeKey(o.name) === targetKey);
          const existingKind = existing
            ? (existing.category === 'phone_icon' || existing.category === 'icon' ? 'icon' : 'screen')
            : 'item';
          flash(`Name "${form.name}" is already in use by an existing ${existingKind}. Pick a different name, or edit that ${existingKind} from the grid if you meant to replace its image.`, 'error');
          return;
        }
        throw err;
      }
      if (!newType) {
        flash('Create returned no data — reload and try again', 'error');
        return;
      }
      // Optimistic add so the card appears immediately; loadOverlays below
      // reconciles with server truth.
      setOverlays(prev => [...prev, {
        id: newType.type_key, name: newType.name, category: newType.category,
        beat: newType.beat, description: newType.description, prompt: newType.prompt,
        opens_screen: newType.opens_screen, is_home: !!newType.is_home,
        custom: true, custom_id: newType.id, generated: false, url: null,
      }]);
      let autoPlaced = false;
      if (file && newType.type_key) {
        try {
          const fd = new FormData();
          fd.append('image', file);
          // Use newType.type_key — the earlier `targetKey` was scoped inside
          // the 409-conflict branch above and is undefined here on the happy
          // path. Caused "ReferenceError: targetKey is not defined" on every
          // screen/icon create with an attached image.
          await api.post(`/api/v1/ui-overlays/${showId}/upload/${newType.type_key}`, fd);
        } catch (upErr) {
          console.warn('[createScreen] image upload failed', upErr);
          flash('Created, but the image upload failed — upload from the card', 'error');
        }
        // Refetch to surface the newly-uploaded asset URL on the icon, then
        // auto-bg-remove + auto-place if this is a linked icon.
        let fresh = await api.get(`/api/v1/ui-overlays/${showId}`).then(r => r.data?.data || []).catch(() => []);
        setOverlays(fresh);
        if (createMode === 'phone_icon') {
          // Auto-bg-removal disabled here too — mirror of the change in
          // handleUpload. Creators can hit Remove BG from the card when
          // they want it; we don't modify their uploaded image silently.
          autoPlaced = await autoPlaceIconOnHome(fresh, newType.type_key);
          if (autoPlaced) loadOverlays(false);
        }
      }
      setShowCreateModal(false);
      if (autoPlaced) {
        flash(createMode === 'phone_icon'
          ? `${newType.name} created and placed on the home screen — drag to reposition`
          : `${newType.name} created and placed on the home screen — drag to reposition`);
      } else {
        flash(createMode === 'phone_icon'
          ? (file ? 'Icon created + image uploaded' : 'Icon type created')
          : (file ? 'Screen created + image uploaded' : 'Screen type created'));
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Auto-create a screen type from a placeholder, then run an action (upload or generate)
  const handleAutoCreateAndAction = async (action) => {
    if (!activeScreen?.placeholder || !showId) return;
    const findScreen = (all, res) => all.find(o => o.name === activeScreen.name || o.id === (res?.data?.data?.type_key))
      || all.find(o => (o.name || '').toLowerCase() === activeScreen.name.toLowerCase());
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
        name: activeScreen.name,
        beat: activeScreen.beat || activeScreen.key || '',
        description: activeScreen.description || activeScreen.desc || '',
        prompt: `A luxury phone screen overlay for "${activeScreen.name}". Dreamy glassmorphism aesthetic with soft pink and lavender gradients. Frosted glass UI elements with sparkle particle effects. Rose gold accents. Elegant typography. Premium mobile UI design. Isolated on plain background.`,
        category: 'phone',
      });
      const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
      const all = listRes.data?.data || [];
      setOverlays(all);
      const created = findScreen(all, res);
      if (created) setActiveScreen(created);
      action(created);
    } catch (err) {
      if (err.response?.status === 409) {
        const listRes = await api.get(`/api/v1/ui-overlays/${showId}`);
        const all = listRes.data?.data || [];
        setOverlays(all);
        const existing = findScreen(all, null);
        if (existing) setActiveScreen(existing);
        action(existing);
      } else {
        flash(err.response?.data?.error || err.message, 'error');
      }
    }
  };

  const handleAutoCreateAndUpload = () => handleAutoCreateAndAction((screen) => {
    setTimeout(() => fileInputRef.current?.click(), 100);
  });

  const handleAutoCreateAndGenerate = () => handleAutoCreateAndAction((screen) => {
    if (screen) handleGenerateOne(screen.id);
  });

  // ── Screen link navigation ──

  const handleNavigate = (targetKey) => {
    // Find the overlay matching the target screen key
    const target = overlays.find(o => {
      const id = (o.id || '').toLowerCase();
      const name = (o.name || '').toLowerCase();
      const key = targetKey.toLowerCase();
      return id === key || name.includes(key) || (o.overlay_type || '').toLowerCase() === key;
    });
    if (target) {
      // Push current screen to history for back navigation
      if (activeScreen) {
        setNavHistory(prev => [...prev, activeScreen.id || activeScreen.key]);
      }
      setActiveScreen(target);
    }
  };

  const handleBack = () => {
    if (navHistory.length === 0) return;
    const prevKey = navHistory[navHistory.length - 1];
    setNavHistory(prev => prev.slice(0, -1));
    const prevScreen = overlays.find(o => o.id === prevKey);
    if (prevScreen) setActiveScreen(prevScreen);
  };

  // ── Screen link editing ──

  const handleSaveLinks = async (links) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${activeScreen.asset_id}`, { screen_links: links });
      // Update local state
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, screen_links: links, metadata: { ...(o.metadata || {}), screen_links: links } } : o));
      setActiveScreen(prev => prev ? { ...prev, screen_links: links, metadata: { ...(prev.metadata || {}), screen_links: links } } : prev);
      flash('Links saved!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Bulk-place (Phase 3.3) — copies the given zone (icon, label, position) onto
  // each target screen as an independent new zone. Each copy gets a fresh id so
  // they can be repositioned / edited per screen without affecting the original.
  const handleBulkPlaceZone = async (sourceZone, targetScreenIds) => {
    if (!showId || !sourceZone || !Array.isArray(targetScreenIds) || targetScreenIds.length === 0) return;
    let ok = 0, failed = 0;
    // Update local state incrementally so each target flips immediately; each
    // screen's zones get persisted via the same endpoint handleSaveLinks uses.
    for (const targetId of targetScreenIds) {
      const target = overlays.find(o => o.id === targetId);
      if (!target?.asset_id) { failed++; continue; }
      const existing = target.screen_links || target.metadata?.screen_links || [];
      const copy = {
        ...sourceZone,
        id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      };
      const nextLinks = [...existing, copy];
      try {
        await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${target.asset_id}`, { screen_links: nextLinks });
        setOverlays(prev => prev.map(o => o.id === targetId ? { ...o, screen_links: nextLinks, metadata: { ...(o.metadata || {}), screen_links: nextLinks } } : o));
        ok++;
      } catch (err) {
        console.error('[bulk-place] failed for screen', targetId, err);
        failed++;
      }
    }
    if (ok && !failed) flash(`Placed on ${ok} screen${ok === 1 ? '' : 's'}`);
    else if (ok && failed) flash(`Placed on ${ok}, ${failed} failed`, 'error');
    else flash('Bulk place failed', 'error');
  };

  // Request AI-proposed zones for the current screen. Returns the proposal so
  // ScreenLinkEditor can open its review modal; we deliberately do NOT write here.
  const handleRequestAiZones = async (hint) => {
    if (!activeScreen?.asset_id || !showId) return null;
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/ai/add-zones`, {
        asset_id: activeScreen.asset_id,
        prompt_hint: hint || undefined,
      });
      return res.data;
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
      throw err;
    }
  };

  // ── AI panel state — the panel lives outside ScreenLinkEditor so it needs its
  //    own proposal holder + review modal. Separate from ScreenLinkEditor's
  //    toolbar AI flow so both entry points can coexist without fighting. ──
  const [panelProposal, setPanelProposal] = useState(null);
  const [panelAiBusy, setPanelAiBusy] = useState(false);
  // Missions modal (PR4). No per-episode context here — missions are show-scoped,
  // optionally per-episode, and that's picked inside the editor form.
  // Opened when activeTab === 'missions'; closing reverts to the Screens tab.
  const missionsOpen = activeTab === 'missions';

  const handlePanelAddZones = async (hint) => {
    if (!activeScreen?.asset_id || !showId || panelAiBusy) return;
    setPanelAiBusy(true);
    try {
      const data = await handleRequestAiZones(hint);
      if (data?.proposal) setPanelProposal(data);
    } finally {
      setPanelAiBusy(false);
    }
  };

  // When the user approves a panel-generated proposal, merge the new zones with
  // whatever the screen already has and save through the existing PUT.
  const handleApprovePanelProposal = async () => {
    if (!panelProposal?.proposal?.zones?.length || !activeScreen) return;
    const existing = getScreenLinks(activeScreen);
    const merged = [...existing, ...panelProposal.proposal.zones];
    await handleSaveLinks(merged);
    setPanelProposal(null);
  };

  // Zone-level AI — called from ContentZoneEditor via prop. Returns the proposal;
  // the editor renders an inline Apply/Discard surface and applies on approve.
  const handleFillContentZone = async (zoneId, hint) => {
    if (!activeScreen?.asset_id || !showId) return null;
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/ai/fill-content-zone`, {
        asset_id: activeScreen.asset_id,
        zone_id: zoneId,
        prompt_hint: hint || undefined,
      });
      return res.data;
    } catch (err) {
      flash(err.response?.data?.error || err.message, 'error');
      return null;
    }
  };

  const handleUploadIcon = async (linkId, file) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      const fd = new FormData();
      fd.append('icon', file);
      fd.append('link_id', linkId);
      const res = await api.post(`/api/v1/ui-overlays/${showId}/screen-links/${activeScreen.asset_id}/icon`, fd);
      const iconUrl = res.data?.icon_url;
      if (iconUrl) {
        // Append uploaded icon to the link's icon_urls array
        const currentLinks = getScreenLinks(activeScreen);
        const updated = currentLinks.map(l => {
          if (l.id !== linkId) return l;
          const existing = l.icon_urls?.length ? l.icon_urls : (l.icon_url ? [l.icon_url] : []);
          const icon_urls = [...existing, iconUrl];
          return { ...l, icon_urls, icon_url: icon_urls[0] };
        });
        setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, screen_links: updated, metadata: { ...(o.metadata || {}), screen_links: updated } } : o));
        setActiveScreen(prev => prev ? { ...prev, screen_links: updated, metadata: { ...(prev.metadata || {}), screen_links: updated } } : prev);
        flash('Icon uploaded!');
      }
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // ── Content zones (live data rendering on templates) ──

  const handleSaveContentZones = async (zones) => {
    if (!activeScreen?.asset_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/content-zones/${activeScreen.asset_id}`, { content_zones: zones });
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, content_zones: zones, metadata: { ...(o.metadata || {}), content_zones: zones } } : o));
      setActiveScreen(prev => prev ? { ...prev, content_zones: zones, metadata: { ...(prev.metadata || {}), content_zones: zones } } : prev);
      flash('Content zones saved!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // ── Image fit controls ──

  // Per-screen fit
  const handleUpdateFit = (fitChanges) => {
    if (!activeScreen) return;
    pushUndo();
    const currentFit = activeScreen.image_fit || activeScreen.metadata?.image_fit || {};
    const newFit = { ...currentFit, ...fitChanges };
    setActiveScreen(prev => prev ? { ...prev, image_fit: newFit, metadata: { ...(prev.metadata || {}), image_fit: newFit } } : prev);
    setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, image_fit: newFit, metadata: { ...(o.metadata || {}), image_fit: newFit } } : o));
  };

  const handleSaveFit = async () => {
    if (!activeScreen?.asset_id || !showId) return;
    const fit = activeScreen.image_fit || activeScreen.metadata?.image_fit || {};
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${activeScreen.asset_id}`, { image_fit: fit });
      flash('Fit saved for this screen!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  const handleClearScreenFit = async () => {
    if (!activeScreen?.asset_id || !showId) return;
    setActiveScreen(prev => prev ? { ...prev, image_fit: null, metadata: { ...(prev.metadata || {}), image_fit: null } } : prev);
    setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, image_fit: null, metadata: { ...(o.metadata || {}), image_fit: null } } : o));
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${activeScreen.asset_id}`, { image_fit: null });
      flash('Using global fit');
    } catch (err) {
      console.warn('[clearScreenFit] failed to persist null fit — optimistic state kept', err);
      flash('Fit cleared locally but save failed — refresh to verify', 'error');
    }
  };

  // Global fit (applies to all screens that don't have a per-screen override)
  const handleUpdateGlobalFit = (fitChanges) => {
    setGlobalFit(prev => ({ ...prev, ...fitChanges }));
  };

  const handleSaveGlobalFit = async () => {
    if (!showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/global-fit`, { global_fit: globalFit });
      flash('Global fit saved for all screens!');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Rename screen
  const handleRename = async (newName) => {
    if (!newName?.trim() || !activeScreen || !showId) return;
    const trimmed = newName.trim();
    pushUndo();
    try {
      if (activeScreen.custom && activeScreen.custom_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { name: trimmed });
      }
      if (activeScreen.asset_id) {
        // Update asset name and preserve category
        await api.put(`/api/v1/ui-overlays/${showId}/category/${activeScreen.asset_id}`, { name: `UI Overlay: ${trimmed}`, category: activeScreen.category || 'phone' });
      }
      setActiveScreen(prev => prev ? { ...prev, name: trimmed } : prev);
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, name: trimmed } : o));
      flash(`Renamed to "${trimmed}"`);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
    setEditingName(false);
  };

  // Change screen's type (screen vs icon)
  const handleChangeScreenType = async (category) => {
    if (!activeScreen || !showId) return;
    pushUndo();
    try {
      if (activeScreen.custom && activeScreen.custom_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { category });
      }
      if (activeScreen.asset_id) {
        await api.put(`/api/v1/ui-overlays/${showId}/category/${activeScreen.asset_id}`, { category });
      }
      const typeField = category === 'phone_icon' ? 'icon'
        : category === 'production' ? 'overlay'
        : 'screen';
      // Flipping to 'production' moves the item out of the Phone Hub entirely
      // (it'll show up in the UI Overlays / ProductionOverlaysTab instead), so
      // close the detail panel and drop it from local state rather than leaving
      // a dangling selection.
      if (category === 'production') {
        setOverlays(prev => prev.filter(o => o.id !== activeScreen.id));
        closePanel();
        flash('Moved to UI Overlays tab');
        return;
      }
      setActiveScreen(prev => prev ? { ...prev, category, type: typeField } : prev);
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, category, type: typeField } : o));
      flash(category === 'phone_icon' ? 'Set as Icon' : 'Set as Screen');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Toggle home screen
  const handleSetHome = async () => {
    if (!activeScreen?.custom_id || !showId) return;
    const newValue = !activeScreen.is_home;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { is_home: newValue });
      // Optimistic: unset all others, set this one
      setOverlays(prev => prev.map(o => ({ ...o, is_home: o.id === activeScreen.id ? newValue : false })));
      setActiveScreen(prev => prev ? { ...prev, is_home: newValue } : prev);
      flash(newValue ? `"${activeScreen.name}" set as Home Screen` : 'Home screen unset');
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Update the icon's navigation target (opens_screen). Empty string clears.
  // The backend validates the key exists; a flash surfaces the server-side
  // 400 if the picked target is no longer valid.
  const handleChangeOpensScreen = async (targetKey) => {
    if (!activeScreen?.custom_id || !showId) return;
    try {
      await api.put(`/api/v1/ui-overlays/${showId}/types/${activeScreen.custom_id}`, { opens_screen: targetKey || null });
      setOverlays(prev => prev.map(o => o.id === activeScreen.id ? { ...o, opens_screen: targetKey || null } : o));
      setActiveScreen(prev => prev ? { ...prev, opens_screen: targetKey || null } : prev);
      // Auto-place if this is an icon that just got a target — mirrors the
      // behaviour of the Create modal so setting the link post-hoc still
      // produces a tap zone on the home screen.
      let autoPlaced = false;
      if (targetKey && isIcon(activeScreen) && activeScreen.url) {
        const fresh = await api.get(`/api/v1/ui-overlays/${showId}`).then(r => r.data?.data || []).catch(() => []);
        if (fresh.length) setOverlays(fresh);
        autoPlaced = await autoPlaceIconOnHome(fresh.length ? fresh : overlays, activeScreen.id);
        if (autoPlaced) loadOverlays(false);
      }
      flash(
        autoPlaced ? `Opens screen updated + placed on home screen`
        : targetKey ? 'Opens screen updated'
        : 'Opens screen cleared'
      );
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Duplicate screen settings to another screen
  const handleDuplicateSettings = async (targetScreenId) => {
    if (!activeScreen || !showId) return;
    const target = overlays.find(o => o.id === targetScreenId);
    if (!target?.asset_id) { flash('Target screen has no asset', 'error'); return; }
    const fit = activeScreen.image_fit || activeScreen.metadata?.image_fit;
    const links = activeScreen.screen_links || activeScreen.metadata?.screen_links;
    try {
      if (fit) await api.put(`/api/v1/ui-overlays/${showId}/image-fit/${target.asset_id}`, { image_fit: fit });
      if (links?.length) await api.put(`/api/v1/ui-overlays/${showId}/screen-links/${target.asset_id}`, { screen_links: links });
      // Optimistic update
      setOverlays(prev => prev.map(o => o.id === targetScreenId ? {
        ...o,
        ...(fit ? { image_fit: fit, metadata: { ...(o.metadata || {}), image_fit: fit } } : {}),
        ...(links?.length ? { screen_links: links, metadata: { ...(o.metadata || {}), screen_links: links } } : {}),
      } : o));
      flash(`Settings copied to ${target.name}!`);
    } catch (err) { flash(err.response?.data?.error || err.message, 'error'); }
  };

  // Export contact sheet — download all screen thumbnails
  const handleExportContactSheet = async () => {
    const generated = overlays.filter(o => o.generated && o.url);
    if (!generated.length) { flash('No screens to export', 'error'); return; }
    // Create a simple HTML table of images and download as page
    const html = `<!DOCTYPE html><html><head><title>Phone Screens - Contact Sheet</title>
<style>body{background:#1a1a2e;margin:40px;font-family:'DM Mono',monospace;color:#fff}
h1{color:#B8962E;font-size:20px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{background:#2a2a4a;border-radius:12px;overflow:hidden;text-align:center}
.card img{width:100%;aspect-ratio:9/16;object-fit:cover}
.card p{padding:8px;font-size:11px;color:#aaa;margin:0}</style></head>
<body><h1>Phone Screens Contact Sheet</h1><div class="grid">
${generated.map(s => { const esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); return `<div class="card"><img src="${esc(s.url)}"/><p>${esc(s.name)}</p></div>`; }).join('')}
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'phone-screens-contact-sheet.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    flash('Contact sheet downloaded!');
  };

  const generatedCount = overlays.filter(o => o.generated).length;

  // Step-header derived counts. "Screens" excludes phone icons — icons are
  // app tiles that live on a screen, not standalone workspaces.
  const screenOverlays = overlays.filter(o => isScreen(o));
  const screensGenerated = screenOverlays.filter(o => o.generated && o.url).length;
  const screensTotal = screenOverlays.length;
  const screensWithZones = screenOverlays.filter(o => {
    const links = o.screen_links || o.metadata?.screen_links || [];
    return Array.isArray(links) && links.length > 0;
  }).length;

  // Counts for the section tab bar. We render the tab bar here (above the
  // phone-hub-layout) so it stays visible across tab switches — including
  // when PhoneHub unmounts for the Zones workspace. These mirror the
  // derivations PhoneHub does internally.
  const iconOverlays = overlays.filter(isIcon);
  // Stable reference for consumers that do effect-dep comparison on this
  // array (ScreenLinkEditor re-enriches zones whenever iconOverlays changes
  // reference, which clobbers in-flight dropdown edits if we pass a fresh
  // array every render).
  const iconOverlaysForEditor = useMemo(
    () => overlays.filter(o => (isIcon(o) || o.type === 'icon') && o.url),
    [overlays]
  );
  const placementsCount = useMemo(() => {
    const iconUrls = new Set(iconOverlays.map(i => i.url).filter(Boolean));
    const seen = new Set(iconUrls);  // library icons always count
    screenOverlays.forEach(screen => {
      const links = getScreenLinks(screen);
      links.forEach(link => {
        if (link.icon_url) seen.add(link.icon_url);
      });
    });
    return seen.size;
  }, [iconOverlays, screenOverlays]);

  // Lightweight mission count fetch — refreshes on mount + whenever the
  // missions modal closes (after a save/delete). Keeps the step header in
  // sync without prop-drilling the modal's internal list.
  const [missionCount, setMissionCount] = useState(0);
  useEffect(() => {
    if (!showId || missionsOpen) return;
    let cancelled = false;
    api.get(`/api/v1/ui-overlays/${showId}/missions`)
      .then(r => { if (!cancelled) setMissionCount((r.data?.missions || []).length); })
      .catch(() => { /* table may not exist yet; leave count at 0 */ });
    return () => { cancelled = true; };
  }, [showId, missionsOpen]);


  return (
    <div style={{ padding: '20px 0' }}>
      {/* Toast */}
      {toast && (
        <div className={`overlays-toast overlays-toast--${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="overlays-header">
        <div className="overlays-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C', fontFamily: "'Lora', serif" }}>Phone Hub</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
                {generatedCount}/{overlays.length} screens ready
              </p>
            </div>
            {/* Show selector — visible when no propShowId so user can switch shows */}
            {!propShowId && shows.length > 0 && (
              <select
                value={showId || ''}
                onChange={(e) => setShowId(e.target.value)}
                className="overlays-show-select"
              >
                <option value="" disabled>Select show...</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="overlays-header-actions">
            {/* Size-guide toggle stays as a small icon button (frequent quick-check). */}
            <button onClick={() => setShowSizeGuide(!showSizeGuide)} title="Upload size guide" aria-label="Toggle upload size guide" className="overlays-header-btn" style={{ color: '#aaa', border: '1px solid #eee' }}>
              <Info size={13} />
            </button>
            {/* Preview stays visible — it's the most common view action. */}
            <button onClick={() => setPreviewMode(true)} disabled={!generatedCount} title="Preview mode" className="overlays-header-btn" style={{ color: '#B8962E', border: '1px solid #B8962E30' }}>
              <Play size={13} /> <span className="btn-label">Preview</span>
            </button>
            {/* Flow Map + Export move into a "More" menu — used less often. */}
            <ToolbarMenu label="More" disabled={!generatedCount}>
              <button onClick={() => setShowFlowMap(true)} disabled={!generatedCount}>
                <GitBranch size={13} /> Flow Map
              </button>
              <button onClick={handleExportContactSheet} disabled={!generatedCount}>
                <Download size={13} /> Export contact sheet
              </button>
            </ToolbarMenu>
          </div>
        </div>

        {/* Size guide */}
        {showSizeGuide && (
          <div className="overlays-size-guide">
            <div className="overlays-size-guide__title">Recommended Upload Sizes</div>
            <div className="overlays-size-guide__grid">
              <span style={{ color: '#999' }}>Screens (HD):</span><span><strong>1080 x 1920</strong> px (9:16)</span>
              <span style={{ color: '#999' }}>Screens (Retina):</span><span><strong>1170 x 2532</strong> px (iPhone 15 Pro)</span>
              <span style={{ color: '#999' }}>App Icons:</span><span><strong>512 x 512</strong> px (square)</span>
              <span style={{ color: '#999' }}>Phone Frame:</span><span><strong>1170 x 2532</strong> px (match screen)</span>
            </div>
            <div style={{ marginTop: 6, color: '#aaa', fontSize: 9 }}>PNG with transparency recommended for icons. JPG/PNG for screens.</div>
          </div>
        )}

        {/* Action buttons row — creation actions collapse into a "+ Add"
            dropdown; Generate All stays as the primary CTA at full size. */}
        <div className="overlays-toolbar">
          <ToolbarMenu label="Add" icon={<span style={{ fontWeight: 700, marginRight: 2 }}>+</span>} disabled={!showId && batchUploading}>
            <button onClick={() => { setCreateMode('phone'); setShowCreateModal(true); }} disabled={!showId}>
              + New Screen
            </button>
            <button onClick={() => { setCreateMode('phone_icon'); setShowCreateModal(true); }} disabled={!showId}>
              + New Icon
            </button>
            <button onClick={() => batchInputRef.current?.click()} disabled={batchUploading || !showId}>
              <Upload size={13} /> {batchUploading ? 'Uploading...' : 'Batch Upload'}
            </button>
            <button onClick={() => frameInputRef.current?.click()}>
              <Monitor size={13} /> {customFrameUrl ? 'Change Frame' : 'Upload Frame'}
            </button>
            {customFrameUrl && (
              <button
                onClick={async () => {
                  if (!confirm('Remove custom phone frame?')) return;
                  frameRemovedRef.current = true;
                  setCustomFrameUrl(null);
                  flash('Using built-in frame');
                  if (showId) {
                    try { await api.delete(`/api/v1/ui-overlays/${showId}/frame`); } catch (err) {
                      console.warn('[PhoneHub] Failed to delete frame:', err.message);
                    }
                  }
                }}
                style={{ color: '#dc2626' }}
              >
                <X size={13} /> Remove Frame
              </button>
            )}
          </ToolbarMenu>
          <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={handleBatchUpload} style={{ display: 'none' }} />
          <input ref={frameInputRef} type="file" accept="image/*" onChange={handleFrameUpload} style={{ display: 'none' }} />
          {/* Missions moved to the tab bar (see PhoneHub). Toolbar button removed. */}
          <button onClick={handleGenerateAll} disabled={generating || !showId} className="overlays-header-btn" style={{
            background: generating ? 'var(--lala-parchment-2)' : 'var(--lala-gold)',
            color: generating ? 'var(--lala-ink-faint)' : '#fff',
            border: 'none',
          }}>
            {generating ? <><Loader size={13} className="spin" /> Generating...</> : <><Sparkles size={13} /> Generate All</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="overlays-loading">
          <Loader size={24} className="spin" />
          <p>Loading phone screens...</p>
        </div>
      ) : (
        <>
        {/* 4-step guide removed — creators don't need the hand-holding every
            visit, and it was eating prime real estate above the phone. The
            same state (screens generated, missions, preview) is still
            reachable via the header buttons + grid tabs. */}

        <div className="phone-hub-layout">
          {/* Section tabs rendered outside PhoneHub so they stay visible
              even when PhoneHub unmounts for the Zones workspace. */}
          <PhoneHubSectionTabs
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            screenCount={screenOverlays.length}
            iconCount={iconOverlays.length}
            placementCount={placementsCount}
            hiddenCount={hiddenScreens.length}
            showHidden={showHidden}
            onToggleShowHidden={() => setShowHidden(h => !h)}
          />
          {!((editingLinks || editingContent) && activeScreen?.url) && <div className="phone-hub-main">
            <OverlayErrorBoundary>
              <PhoneHub
                screens={overlays}
                activeScreen={activeScreen}
                onSelectScreen={(s) => { setActiveScreen(s); setPanelOpen(true); setNavHistory([]); setActiveTab('screens'); setActiveVariantIdx(0); setAddingVariant(false); setEditingName(false); setEditorTab('actions'); }}
                onDelete={handleDeleteScreen}
                onHideScreen={handleHideScreen}
                hiddenScreens={hiddenScreens}
                showHidden={showHidden}
                onToggleShowHidden={() => setShowHidden(h => !h)}
                onNavigate={handleNavigate}
                navigationHistory={navHistory}
                onBack={handleBack}
                skin={phoneSkin}
                onChangeSkin={handleChangeSkin}
                customFrameUrl={customFrameUrl}
                globalFit={globalFit}
                onEditZones={() => setActiveTab('zones')}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                suppressSectionTabs
              />
            </OverlayErrorBoundary>

            {/* AI Assistant moved into the inline zone editor — it only
                appears when you're actively editing zones since that's
                what it acts on. */}
          </div>}

          {editingLinks && activeScreen?.url && (
            /* ── Unified Zones Tab — rendered as tab content inside the same
                 Phone Hub shell so section tabs remain visible.
                 ── */
            (() => {
              const editableScreens = overlays.filter(o => o.generated && o.url && isScreen(o));
              const switchToScreen = (target) => {
                if (!target || target.id === activeScreen.id) return;
                if (linkEditorRef.current?.isDirty?.()) linkEditorRef.current.save();
                setActiveScreen(target);
                setNavHistory([]);
                setFlowAudit(null);
              };
              // Aggregate zone counts per screen so the thumbnail strip can show a badge.
              const zoneCounts = new Map();
              const screenHealth = new Map();
              editableScreens.forEach(s => {
                const diag = screenDiagnostics.get(s.id);
                if (diag?.counts) {
                  zoneCounts.set(s.id, diag.counts);
                  screenHealth.set(s.id, {
                    severity: diag.severity,
                    issueCount: diag.issueCount,
                  });
                  return;
                }
                const tap = (s.screen_links || s.metadata?.screen_links || []).length;
                const content = (s.content_zones || s.metadata?.content_zones || []).length;
                zoneCounts.set(s.id, { tap, icon: 0, content });
                screenHealth.set(s.id, { severity: 'ok', issueCount: 0 });
              });
              const activeHealth = screenDiagnostics.get(activeScreen.id) || {
                issues: [],
                issueItems: [],
                issueCount: 0,
                severity: 'ok',
              };
              const switchMode = (next) => {
                if (zoneEditorMode === next) return;
                if (linkEditorRef.current?.isDirty?.()) linkEditorRef.current.save();
                setZoneEditorMode(next);
              };
              const focusIssue = (issue) => {
                if (!issue) return;
                const targetScreen = editableScreens.find(s => s.id === issue.screenId);
                if (targetScreen && targetScreen.id !== activeScreen.id) switchToScreen(targetScreen);
                // Content issues live on their own top-level tab now.
                if (issue.mode === 'content') {
                  if (linkEditorRef.current?.isDirty?.()) linkEditorRef.current.save();
                  setActiveTab('content');
                  setPendingIssueFocus({
                    screenId: issue.screenId || activeScreen.id,
                    mode: 'content',
                    zoneId: issue.zoneId || null,
                  });
                  return;
                }
                if (issue.mode && zoneEditorMode !== issue.mode) switchMode(issue.mode);
                setPendingIssueFocus({
                  screenId: issue.screenId || activeScreen.id,
                  mode: issue.mode || 'zones',
                  zoneId: issue.zoneId || null,
                });
              };
              const runFlowAudit = () => {
                const byId = new Map(editableScreens.map(screen => [screen.id, screen]));
                const linksByScreen = new Map(editableScreens.map(screen => [screen.id, getScreenLinks(screen)]));
                const deadLinks = [];
                const graph = new Map();

                editableScreens.forEach((screen) => {
                  const links = linksByScreen.get(screen.id) || [];
                  const targets = [];
                  links.forEach((zone) => {
                    if (!zone?.target) return;
                    if (!byId.has(zone.target)) {
                      deadLinks.push({
                        sourceScreenId: screen.id,
                        sourceScreenName: screen.name,
                        zoneId: zone.id,
                        zoneLabel: zone.label || zone.target || 'Unnamed zone',
                        target: zone.target,
                      });
                      return;
                    }
                    targets.push(zone.target);
                  });
                  graph.set(screen.id, targets);
                });

                const visited = new Set();
                const stack = [activeScreen.id];
                while (stack.length) {
                  const current = stack.pop();
                  if (!current || visited.has(current)) continue;
                  visited.add(current);
                  (graph.get(current) || []).forEach(next => {
                    if (!visited.has(next)) stack.push(next);
                  });
                }

                const unreachable = editableScreens
                  .filter(screen => !visited.has(screen.id))
                  .map(screen => ({ id: screen.id, name: screen.name }));

                const cycles = [];
                const cycleKeys = new Set();
                const state = new Map();
                const path = [];
                const dfs = (node) => {
                  state.set(node, 1);
                  path.push(node);
                  (graph.get(node) || []).forEach((next) => {
                    if (state.get(next) === 0 || !state.has(next)) {
                      dfs(next);
                      return;
                    }
                    if (state.get(next) === 1) {
                      const idx = path.indexOf(next);
                      const loop = [...path.slice(idx), next];
                      const key = loop.join('>');
                      if (!cycleKeys.has(key)) {
                        cycleKeys.add(key);
                        cycles.push(loop);
                      }
                    }
                  });
                  path.pop();
                  state.set(node, 2);
                };
                editableScreens.forEach((screen) => {
                  if (!state.has(screen.id)) dfs(screen.id);
                });

                setFlowAudit({
                  deadLinks,
                  unreachable,
                  cycles,
                  scanned: editableScreens.length,
                  reached: visited.size,
                  ranAt: new Date().toLocaleTimeString(),
                });
              };
              return (
                <div className="phone-hub-zones-panel">
                  {/* Sub-tabs — Tap and Icon are two views of the same data
                      (screen_links). Placed at the top of the Zones surface so
                      they feel like a second tier under the main tab bar,
                      instead of a sidebar pill group. */}
                  <div className="zones-subtabs" role="tablist" aria-label="Zone edit mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={zoneEditorMode === 'zones'}
                      className={`zones-subtab ${zoneEditorMode === 'zones' ? 'active' : ''}`}
                      onClick={() => switchMode('zones')}
                    >
                      Tap
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={zoneEditorMode === 'icons'}
                      className={`zones-subtab ${zoneEditorMode === 'icons' ? 'active' : ''}`}
                      onClick={() => switchMode('icons')}
                    >
                      Icon
                    </button>
                  </div>
                <div className="zones-tab">
                    <div className="zones-tab__canvas">
                    {zoneEditorMode === 'zones' ? (
                      <ScreenLinkEditor
                        ref={linkEditorRef}
                        screen={activeScreen}
                        screenUrl={activeScreen.url}
                        links={getScreenLinks(activeScreen)}
                        screenTypes={overlays.filter(o => isScreen(o)).map(o => ({ key: o.id, label: o.name, desc: o.description || '' }))}
                        generatedScreenKeys={new Set(overlays.filter(o => o.generated && o.url).map(o => o.id))}
                        iconOverlays={iconOverlaysForEditor}
                        globalFit={globalFit}
                        customFrameUrl={customFrameUrl}
                        phoneSkin={phoneSkin}
                        onSave={handleSaveLinks}
                        onUploadIcon={handleUploadIcon}
                        onNavigate={handleNavigate}
                        navigationHistory={navHistory}
                        onBack={handleBack}
                        onRequestAiZones={handleRequestAiZones}
                        allScreens={overlays.filter(o => isScreen(o) && o.url).map(o => ({ id: o.id, name: o.name }))}
                        onBulkPlace={handleBulkPlaceZone}
                        embedded
                        onZonesChange={(zones, dirty, selectedId) => {
                          setTapZonesDraft(zones || []);
                          setTapZonesDirty(!!dirty);
                          setTapSelectedZoneId(selectedId || null);
                        }}
                      />
                    ) : (
                      <IconPlacementMode
                        links={getScreenLinks(activeScreen)}
                        iconOverlays={iconOverlaysForEditor}
                        screenTypes={overlays.filter(o => isScreen(o)).map(o => ({ key: o.id, label: o.name, icon: '📱', desc: o.description || '' }))}
                        generatedScreenKeys={new Set(overlays.filter(o => o.generated && o.url).map(o => o.id))}
                        onSave={handleSaveLinks}
                        screenUrl={activeScreen.url}
                        phoneSkin={phoneSkin}
                        customFrameUrl={customFrameUrl}
                      />
                    )}
                  </div>

                    <div className="zones-tab__controls">
                      <div className="zones-tab__sidebar-card zones-tab__sidebar-card--primary">
                      <div className="zone-editor-header">
                        <div className="zones-tab__sidebar-meta">
                          <div className="zones-tab__sidebar-label">Zones Workspace</div>
                          <div className="zones-tab__sidebar-screen">{activeScreen?.name}</div>
                        </div>
                        <button onClick={() => {
                          if (linkEditorRef.current?.isDirty?.()) linkEditorRef.current.save();
                          setActiveTab('screens');
                          setNavHistory([]);
                        }} className="zone-editor-done-btn">
                          <Check size={14} /> Done
                        </button>
                      </div>

                      <ScreenThumbnailStrip
                        screens={editableScreens}
                        activeId={activeScreen.id}
                        onSelect={switchToScreen}
                        globalFit={globalFit}
                        zoneCounts={zoneCounts}
                        healthByScreen={screenHealth}
                      />

                      <div className={`zones-health zones-health--${activeHealth.severity}`}>
                        <div className="zones-health__header">
                          <span className="zones-health__label">Screen Health</span>
                          <span className={`zones-health__badge zones-health__badge--${activeHealth.severity}`}>
                            {activeHealth.issueCount > 0 ? `${activeHealth.issueCount} issue${activeHealth.issueCount > 1 ? 's' : ''}` : 'Ready'}
                          </span>
                        </div>
                        {activeHealth.issueCount > 0 ? (
                          <ul className="zones-health__list">
                            {(activeHealth.issueItems || []).slice(0, 3).map((issue) => (
                              <li key={issue.id}>
                                <button
                                  type="button"
                                  className="zones-health__jump"
                                  onClick={() => focusIssue(issue)}
                                >
                                  {issue.text}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="zones-health__ok">No blockers found for this screen.</div>
                        )}
                      </div>

                      {zoneEditorMode === 'zones' && (
                        <div className="zones-tab__sidebar-card">
                          <div className="zones-tap-panel__header">
                            <span className="zones-tap-panel__title">Tap Zones ({tapZonesDraft.length})</span>
                            <div className="zones-tap-panel__actions">
                              <button
                                type="button"
                                className="zones-tap-panel__btn"
                                onClick={() => linkEditorRef.current?.addDefaultZone?.()}
                              >
                                Add
                              </button>
                              {tapZonesDirty && (
                                <button
                                  type="button"
                                  className="zones-tap-panel__btn zones-tap-panel__btn--save"
                                  onClick={() => linkEditorRef.current?.save?.()}
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          </div>

                          {tapZonesDraft.length > 1 && (
                            <div className="zones-tap-tools">
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('align_left')}>Align L</button>
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('align_center')}>Align C</button>
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('align_right')}>Align R</button>
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('distribute_horizontal')}>Dist H</button>
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('distribute_vertical')}>Dist V</button>
                              <button type="button" onClick={() => linkEditorRef.current?.transformZones?.('equal_size')}>Equal Size</button>
                            </div>
                          )}

                          {tapZonesDraft.length === 0 ? (
                            <div className="zones-tap-panel__empty">Draw on the phone to create your first tap zone.</div>
                          ) : (
                            <div className="zones-tap-panel__list">
                              {tapZonesDraft.map((zone, index) => {
                                const isSelected = tapSelectedZoneId === zone.id;
                                const hasTarget = !!zone.target;
                                return (
                                  <div key={zone.id} className={`zones-tap-row zones-tap-row--inline ${isSelected ? 'active' : ''}`}>
                                    <input
                                      className="zones-tap-row__label-input"
                                      value={zone.label || ''}
                                      onChange={(e) => linkEditorRef.current?.updateZone?.(zone.id, { label: e.target.value })}
                                      onFocus={() => linkEditorRef.current?.setSelectedZone?.(zone.id)}
                                      placeholder={`Zone ${index + 1}`}
                                    />
                                    <select
                                      className={`zones-tap-row__target-select ${hasTarget ? '' : 'zones-tap-row__target-select--warn'}`}
                                      value={zone.target || ''}
                                      onChange={(e) => {
                                        const target = e.target.value;
                                        linkEditorRef.current?.updateZone?.(zone.id, { target, label: zone.label || target || '' });
                                      }}
                                    >
                                      <option value="">— Opens: nothing —</option>
                                      {overlays.filter(o => isScreen(o)).map(screen => (
                                        <option key={screen.id} value={screen.id}>Opens: {screen.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="zones-tap-row__delete-btn"
                                      onClick={() => linkEditorRef.current?.removeZone?.(zone.id)}
                                      aria-label={`Delete ${zone.label || `zone ${index + 1}`}`}
                                      title="Delete"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {zoneEditorMode === 'zones' && (
                        <div className="zones-tab__sidebar-card">
                          <div className="zones-flow__header">
                            <span className="zones-flow__title">Flow Test</span>
                            <button type="button" className="zones-tap-panel__btn" onClick={runFlowAudit}>Run</button>
                          </div>
                          {flowAudit ? (
                            <div className="zones-flow__results">
                              <div className="zones-flow__meta">Checked {flowAudit.scanned} screens, reached {flowAudit.reached}. Last run {flowAudit.ranAt}.</div>
                              <div className="zones-flow__stat">Dead links: <strong>{flowAudit.deadLinks.length}</strong></div>
                              <div className="zones-flow__stat">Unreachable screens: <strong>{flowAudit.unreachable.length}</strong></div>
                              <div className="zones-flow__stat">Cycles: <strong>{flowAudit.cycles.length}</strong></div>

                              {flowAudit.deadLinks.slice(0, 3).map((item) => (
                                <button
                                  key={`${item.sourceScreenId}-${item.zoneId}`}
                                  type="button"
                                  className="zones-flow__jump"
                                  onClick={() => focusIssue({
                                    screenId: item.sourceScreenId,
                                    mode: 'zones',
                                    zoneId: item.zoneId,
                                  })}
                                >
                                  {item.sourceScreenName}: {item.zoneLabel} → {item.target}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="zones-flow__empty">Run a flow test to find dead links, loops, and unreachable screens.</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* AI Assistant — screen-scoped, proposes tap zones for the
                        active screen. */}
                      {activeScreen?.url && !activeScreen.placeholder && (
                        <div className="zones-tab__sidebar-card">
                        <AIAssistantPanel
                          scope="screen"
                          scopeLabel={`Screen: ${activeScreen.name}`}
                          activeScreen={activeScreen}
                          onRunAddZones={handlePanelAddZones}
                          busy={panelAiBusy}
                        />
                        </div>
                      )}
                    </div>
                </div>
                </div>
              );
            })()
          )}

          {/* ── Content Workspace — top-level tab. Mirrors the Zones workspace
               layout (sticky phone on the left, controls on the right) so the
               phone sits in the exact same visual slot as Screens/Icons/Zones. */}
          {editingContent && activeScreen?.url && (() => {
            const editableScreens = overlays.filter(o => o.generated && o.url && isScreen(o));
            const switchToScreen = (target) => {
              if (!target || target.id === activeScreen.id) return;
              setActiveScreen(target);
              setNavHistory([]);
            };
            const contentZoneCounts = new Map();
            editableScreens.forEach(s => {
              const content = (s.content_zones || s.metadata?.content_zones || []).length;
              contentZoneCounts.set(s.id, { tap: 0, icon: 0, content });
            });
            return (
              <div className="phone-hub-zones-panel">
                <div className="zones-tab">
                  <div className="zones-tab__canvas">
                    <ContentZoneEditor
                      screenUrl={activeScreen.url}
                      zones={activeScreen.content_zones || activeScreen.metadata?.content_zones || []}
                      screenLinks={getScreenLinks(activeScreen)}
                      showId={showId}
                      onSave={handleSaveContentZones}
                      onAiFillZone={handleFillContentZone}
                      phoneSkin={phoneSkin}
                      customFrameUrl={customFrameUrl}
                      compact
                    />
                  </div>
                  <div className="zones-tab__controls">
                    <div className="zones-tab__sidebar-card zones-tab__sidebar-card--primary">
                      <div className="zone-editor-header">
                        <div className="zones-tab__sidebar-meta">
                          <div className="zones-tab__sidebar-label">Content</div>
                          <div className="zones-tab__sidebar-screen">{activeScreen?.name}</div>
                        </div>
                        <button
                          onClick={() => { setActiveTab('screens'); setNavHistory([]); }}
                          className="zone-editor-done-btn"
                        >
                          <Check size={14} /> Done
                        </button>
                      </div>
                      <ScreenThumbnailStrip
                        screens={editableScreens}
                        activeId={activeScreen.id}
                        onSelect={switchToScreen}
                        globalFit={globalFit}
                        zoneCounts={contentZoneCounts}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

      {/* ── Floating Editor Modal ── */}
      {activeScreen && panelOpen && (
        <>
          <div className="editor-modal-scrim" onClick={closePanel} />
          <div className="editor-modal">
            {/* ── Header ── */}
            <div className="editor-modal-header">
              <div className="editor-modal-header-left">
                {(() => {
                  const displayUrl = activeScreen.variants?.[activeVariantIdx]?.url || activeScreen.url;
                  const iconThumb = isIcon(activeScreen) || activeScreen.type === 'icon';
                  return displayUrl ? (
                    <div className={`editor-modal-thumb ${iconThumb ? 'icon' : 'screen'}`}>
                      <img src={displayUrl} alt="" />
                    </div>
                  ) : (
                    <div className="editor-modal-thumb screen placeholder-thumb">📱</div>
                  );
                })()}
                <div className="editor-modal-title">
                  <div className="editor-modal-name-row">
                    {editingName ? (
                      <input
                        autoFocus
                        className="editor-modal-name-input"
                        value={editNameValue}
                        onChange={e => setEditNameValue(e.target.value)}
                        onBlur={() => { if (editNameValue.trim()) handleRename(editNameValue); else setEditingName(false); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { if (editNameValue.trim()) handleRename(editNameValue); else setEditingName(false); }
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                      />
                    ) : (
                      <div
                        className="editor-modal-name"
                        onClick={() => { setEditNameValue(activeScreen.name || ''); setEditingName(true); }}
                        title="Click to rename"
                      >{activeScreen.name}</div>
                    )}
                    <span className={`editor-modal-badge ${(activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? 'badge-icon' : 'badge-screen'}`}>
                      {(activeScreen.category === 'phone_icon' || activeScreen.type === 'icon') ? 'ICON' : 'SCREEN'}
                    </span>
                  </div>
                  <div className="editor-modal-meta">
                    {activeScreen.beat && <span>{activeScreen.beat}</span>}
                    {activeScreen.beat && activeScreen.description && <span className="meta-dot" />}
                    {activeScreen.description && <span>{activeScreen.description.slice(0, 80)}</span>}
                  </div>
                </div>
              </div>
              <div className="editor-modal-header-actions">
                <button onClick={handleUndo} disabled={undoStackRef.current.length === 0} title={undoStackRef.current.length > 0 ? `Undo (${undoStackRef.current.length})` : 'Nothing to undo'} className="editor-modal-icon-btn">
                  <Undo2 size={16} />
                </button>
                <button onClick={closePanel} className="editor-modal-icon-btn close" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="editor-modal-tabs">
              {[
                { key: 'actions', label: 'Actions' },
                ...(activeScreen?.url && !activeScreen.placeholder ? [
                  { key: 'fit', label: 'Image Fit' },
                  // Tap Links and Content sub-tabs removed — zone editing (tap,
                  // icon, content) lives on the top-level Zones tab now. The
                  // "Edit zones →" button below deep-links into it.
                ] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`editor-tab ${editorTab === tab.key ? 'active' : ''}`}
                  onClick={() => setEditorTab(tab.key)}
                >
                  {tab.label}
                  {tab.badge > 0 && <span className="editor-tab-badge">{tab.badge}</span>}
                </button>
              ))}
              {/* Deep-link into the top-level Zones tab, preselecting the
                  right mode. Replaces the old Links / Content sub-tabs. */}
              {activeScreen?.url && !activeScreen.placeholder && (
                <button
                  type="button"
                  className="editor-tab editor-tab--link"
                  onClick={() => {
                    const hasContent = (activeScreen.content_zones || activeScreen.metadata?.content_zones || []).length > 0;
                    setZoneEditorMode(hasContent ? 'content' : 'zones');
                    setActiveTab('zones');
                    setPanelOpen(false);
                  }}
                  title="Open the Zones tab for this screen"
                  style={{ marginLeft: 'auto', color: 'var(--lala-gold)' }}
                >
                  Edit zones →
                </button>
              )}
            </div>

            {/* ── Tab Content ── */}
            <div className="editor-modal-body">

              {/* ── Actions Tab ── */}
              {editorTab === 'actions' && (
                <div className="editor-tab-content">
                  {/* Placeholder indicator */}
                  {activeScreen.placeholder && (
                    <div className="editor-placeholder-notice">
                      New screen — upload an image or generate one to get started
                    </div>
                  )}

                  {/* Type toggle — Screen ↔ Icon ↔ UI Overlay. Only meaningful once
                      an asset exists (placeholder cards don't have a type to change
                      yet). Flipping to "UI Overlay" re-tags the item as
                      category='production' so it moves out of the Phone Hub and
                      into the UI Overlays (ProductionOverlaysTab) view. */}
                  {activeScreen.asset_id && (
                    <div className="editor-section">
                      <div className="editor-section-label">Type</div>
                      <div className="editor-type-toggle">
                        <button
                          onClick={() => handleChangeScreenType('phone')}
                          className={`editor-type-btn ${activeScreen.category === 'phone' ? 'active-screen' : ''}`}
                        >
                          Screen
                        </button>
                        <button
                          onClick={() => handleChangeScreenType('phone_icon')}
                          className={`editor-type-btn ${activeScreen.category === 'phone_icon' || activeScreen.category === 'icon' ? 'active-icon' : ''}`}
                        >
                          Icon
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Move this item to the UI Overlays tab? It will disappear from the Phone Hub.')) {
                              handleChangeScreenType('production');
                            }
                          }}
                          className={`editor-type-btn ${activeScreen.category === 'production' ? 'active-overlay' : ''}`}
                          title="Move to UI Overlays tab"
                        >
                          UI Overlay
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Opens Screen — icons only. Edit the icon's default navigation
                      target after creation. The Create modal surfaces this too, but
                      creators often realise they need to change it (or didn't pick
                      one at all) once the icon is placed. */}
                  {activeScreen.custom_id && isIcon(activeScreen) && (
                    <div className="editor-section">
                      <div className="editor-section-label">Opens Screen</div>
                      <select
                        value={activeScreen.opens_screen || ''}
                        onChange={e => handleChangeOpensScreen(e.target.value)}
                        className="overlays-modal__field"
                        style={{ cursor: 'pointer', width: '100%' }}
                      >
                        <option value="">None (no navigation)</option>
                        {overlays
                          .filter(o => isScreen(o))
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                      {!activeScreen.opens_screen && (
                        <div style={{ fontSize: 10, color: '#A09889', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                          Pick a target so tap zones placing this icon inherit it.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary Actions — Generate is gold (primary); Upload is ink-muted
                      so the two read as equal-weight options without competing for
                      the eye. Previously Upload was sky-blue which fought the gold palette. */}
                  <div className="editor-primary-actions">
                    {!activeScreen.placeholder ? (
                      <>
                        <ActionBtn icon={Sparkles} label={generatingId === activeScreen.id ? '...' : 'Generate'} onClick={() => handleGenerateOne(activeScreen.id)} disabled={generatingId === activeScreen.id} color="#B8962E" primary />
                        <ActionBtn icon={Upload} label="Upload" onClick={() => fileInputRef.current?.click()} color="#6B6557" primary />
                      </>
                    ) : (
                      <>
                        <ActionBtn icon={Upload} label="Upload" onClick={() => handleAutoCreateAndUpload()} color="#6B6557" primary />
                        <ActionBtn icon={Sparkles} label="Generate" onClick={() => handleAutoCreateAndGenerate()} disabled={generatingId === activeScreen.id} color="#B8962E" primary />
                      </>
                    )}
                  </div>

                  {/* Home Screen Toggle */}
                  {activeScreen.custom_id && activeScreen.category !== 'phone_icon' && activeScreen.category !== 'icon' && (
                    <div className="editor-section">
                      <button onClick={handleSetHome} className={`editor-home-btn ${activeScreen.is_home ? 'is-home' : ''}`}>
                        {activeScreen.is_home ? '★ Home Screen' : 'Set as Home Screen'}
                      </button>
                    </div>
                  )}

                  {/* Variants */}
                  {(activeScreen.variants?.length > 1 || activeScreen.url) && (
                    <div className="editor-section">
                      <div className="editor-section-label">Variants</div>
                      {activeScreen.variants?.length > 1 && (
                        <div className="editor-variant-pills">
                          {activeScreen.variants.map((v, i) => (
                            <button key={v.asset_id} onClick={() => setActiveVariantIdx(i)} className={`editor-variant-pill ${activeVariantIdx === i ? 'active' : ''}`}>
                              {v.variant_label}
                            </button>
                          ))}
                          <button onClick={() => setAddingVariant(!addingVariant)} className="editor-variant-pill add">+</button>
                        </div>
                      )}
                      {addingVariant && (
                        <div className="editor-variant-add">
                          <input value={newVariantLabel} onChange={e => setNewVariantLabel(e.target.value)} placeholder="e.g. Locked, Dark Mode" className="editor-variant-input" />
                          <button onClick={() => newVariantLabel.trim() && variantInputRef.current?.click()} disabled={!newVariantLabel.trim()} className="editor-variant-upload-btn">Upload</button>
                          <button onClick={() => { setAddingVariant(false); setNewVariantLabel(''); }} className="editor-modal-icon-btn"><X size={14} /></button>
                        </div>
                      )}
                      {!activeScreen.variants && activeScreen.url && !addingVariant && (
                        <button onClick={() => setAddingVariant(true)} className="editor-add-variant-btn"><Layers size={14} /> Add Variant</button>
                      )}
                      <input ref={variantInputRef} type="file" accept="image/*" onChange={handleVariantUpload} style={{ display: 'none' }} />
                    </div>
                  )}

                  {/* Secondary Actions — non-destructive only (Download, Remove BG, Copy To).
                      Delete moved to its own "Danger Zone" section below so it doesn't
                      sit next to benign buttons and get hit by accident. */}
                  {!activeScreen.placeholder && (activeScreen.url || activeScreen.asset_id) && (
                    <div className="editor-secondary-actions">
                      {activeScreen.url && <ActionBtn icon={Download} label="Download" onClick={handleDownload} color="#6bba9a" />}
                      {activeScreen.asset_id && <ActionBtn icon={removingBg ? Loader : Eraser} label={removingBg ? 'Removing...' : 'Remove BG'} onClick={handleRemoveBg} disabled={removingBg} color="#6B6557" />}
                      {activeScreen.url && overlays.filter(o => o.id !== activeScreen.id && o.generated).length > 0 && (
                        <DuplicateSettingsBtn
                          screens={overlays.filter(o => o.id !== activeScreen.id && o.generated)}
                          onDuplicate={handleDuplicateSettings}
                        />
                      )}
                    </div>
                  )}

                  {/* Danger Zone — destructive actions isolated at the bottom with a
                      visible boundary so Delete isn't a one-tap mistake next to Download. */}
                  {!activeScreen.placeholder && (activeScreen.url || activeScreen.asset_id) && (
                    <div className="editor-danger-zone">
                      <div className="editor-section-label editor-danger-zone-label">Danger Zone</div>
                      <ActionBtn icon={Trash2} label="Delete" onClick={handleDelete} color="#B84D2E" />
                    </div>
                  )}
                </div>
              )}

              {/* ── Image Fit Tab ── */}
              {editorTab === 'fit' && activeScreen?.url && !activeScreen.placeholder && (
                <div className="editor-tab-content">
                  <ImageFitControls
                    fit={activeScreen.image_fit || activeScreen.metadata?.image_fit || globalFit || {}}
                    hasScreenOverride={!!(activeScreen.image_fit || activeScreen.metadata?.image_fit)}
                    onChange={handleUpdateFit}
                    onSave={handleSaveFit}
                    onClearOverride={handleClearScreenFit}
                    globalFit={globalFit}
                    onChangeGlobal={handleUpdateGlobalFit}
                    onSaveGlobal={handleSaveGlobalFit}
                  />
                </div>
              )}

              {/* Tap Links render block removed — the tab itself is gone (see tab definitions
                  above). Tap-zone editing lives on the main phone display via the
                  "Edit Tap Zones" button below the phone. */}

              {/* Content Zones sub-tab removed — edit content zones on the
                  top-level Zones tab (Content mode). The detail panel is
                  for per-screen metadata now. */}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          </div>
        </>
      )}
      </>
      )}

      {/* Missions editor — show-scoped CRUD modal */}
      <MissionEditor
        open={missionsOpen}
        showId={showId}
        onClose={() => setActiveTab('screens')}
      />

      {/* AI proposal from the Assistant panel — separate modal from the one
          ScreenLinkEditor's toolbar button uses so both entry points work. */}
      {panelProposal && (
        <AIProposalReview
          proposal={panelProposal.proposal}
          contextSummary={panelProposal.context_summary}
          busy={panelAiBusy}
          onReject={() => setPanelProposal(null)}
          onApprove={handleApprovePanelProposal}
        />
      )}

      {/* Preview Mode */}
      {previewMode && (
        <PhonePreviewMode
          screens={overlays}
          initialScreen={overlays.find(o => o.is_home && o.generated) || overlays.find(o => o.generated && isScreen(o)) || overlays.find(o => o.generated)}
          onClose={() => setPreviewMode(false)}
          globalFit={globalFit}
          phoneSkin={phoneSkin}
        />
      )}

      {/* Flow Map — visual graph of screen-to-screen links */}
      {showFlowMap && (
        <ScreenFlowMap
          screens={overlays}
          onClose={() => setShowFlowMap(false)}
          onSelectScreen={(s) => { setActiveScreen(s); setShowFlowMap(false); }}
        />
      )}

      {/* Create Screen Modal */}
      {showCreateModal && (
        <CreateScreenModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateScreen}
          isIcon={createMode === 'phone_icon'}
          showId={showId}
          existingScreens={overlays.filter(o => isScreen(o))}
        />
      )}

    </div>
  );
}

const FIT_MODES = [
  { key: 'cover', label: 'Fill & Crop' },
  { key: 'contain', label: 'Fit Inside' },
  { key: 'fill', label: 'Stretch' },
];

function ImageFitControls({ fit, hasScreenOverride, onChange, onSave, onClearOverride, globalFit, onChangeGlobal, onSaveGlobal }) {
  // Default to 'screen' (per-screen override) so accidental edits don't propagate
  // to every screen via the global defaults. Users who explicitly want to change
  // the global defaults have to click "All Screens" first.
  const [editMode, setEditMode] = useState('screen');
  const activeFit = editMode === 'global' ? (globalFit || {}) : fit;
  const activeChange = editMode === 'global' ? onChangeGlobal : onChange;
  const activeSave = editMode === 'global' ? onSaveGlobal : onSave;

  const mode = activeFit.mode || 'cover';
  const scale = activeFit.scale || 100;
  const offsetX = activeFit.offsetX || 0;
  const offsetY = activeFit.offsetY || 0;

  return (
    <div style={{ padding: '4px 0' }}>
      <div className="editor-tab-hint">
        Adjust how the image fits within the phone screen. Use "All Screens" for global defaults or "This Screen" to override.
      </div>
      {/* Mode toggle: global vs per-screen */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditMode('global')} style={{
            padding: '6px 10px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 6, cursor: 'pointer', minHeight: 32,
            background: editMode === 'global' ? '#B8962E' : '#fff',
            color: editMode === 'global' ? '#fff' : '#888',
          }}>All Screens</button>
          <button onClick={() => setEditMode('screen')} style={{
            padding: '6px 10px', fontSize: 10, fontWeight: 600, border: '1px solid #e0d9ce',
            borderRadius: 6, cursor: 'pointer', minHeight: 32,
            background: editMode === 'screen' ? '#B8962E' : '#fff',
            color: editMode === 'screen' ? '#fff' : '#888',
          }}>This Screen</button>
        </div>
        <button onClick={activeSave} style={{
          padding: '6px 12px', fontSize: 10, fontWeight: 600, border: 'none',
          borderRadius: 6, background: '#B8962E', color: '#fff', cursor: 'pointer', minHeight: 32,
        }}>Save</button>
      </div>

      <div style={{ fontSize: 9, color: '#999', marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>
        {editMode === 'global'
          ? 'These settings apply to all screens by default.'
          : hasScreenOverride
            ? 'This screen has a custom fit override.'
            : 'No override \u2014 using global fit. Change here to override.'}
      </div>

      {/* Fit mode */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {FIT_MODES.map(m => (
          <button
            key={m.key}
            onClick={() => activeChange({ mode: m.key })}
            style={{
              flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, border: '1px solid #e0d9ce',
              borderRadius: 6, cursor: 'pointer', minHeight: 34,
              background: mode === m.key ? '#2C2C2C' : '#fff',
              color: mode === m.key ? '#fff' : '#888',
            }}
          >{m.label}</button>
        ))}
      </div>

      {/* Scale slider */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>Scale</span>
          <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{scale}%</span>
        </div>
        <input type="range" min={50} max={200} value={scale} onChange={e => activeChange({ scale: parseInt(e.target.value) })}
          style={{ width: '100%', height: 4, cursor: 'pointer' }} />
      </div>

      {/* Position offsets */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>X Offset</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{offsetX}%</span>
          </div>
          <input type="range" min={-50} max={50} value={offsetX} onChange={e => activeChange({ offsetX: parseInt(e.target.value) })}
            style={{ width: '100%', height: 4, cursor: 'pointer' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#999', fontFamily: "'DM Mono', monospace" }}>Y Offset</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: "'DM Mono', monospace" }}>{offsetY}%</span>
          </div>
          <input type="range" min={-50} max={50} value={offsetY} onChange={e => activeChange({ offsetY: parseInt(e.target.value) })}
            style={{ width: '100%', height: 4, cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => activeChange({ mode: 'cover', scale: 100, offsetX: 0, offsetY: 0 })} style={{
          padding: '6px 10px', fontSize: 10, color: '#999', background: 'none',
          border: '1px solid #eee', borderRadius: 6, cursor: 'pointer', minHeight: 32,
        }}>Reset</button>
        {editMode === 'screen' && hasScreenOverride && (
          <button onClick={onClearOverride} style={{
            padding: '6px 10px', fontSize: 10, color: '#B8962E', background: 'none',
            border: '1px solid #B8962E30', borderRadius: 6, cursor: 'pointer', minHeight: 32,
          }}>Use Global Fit</button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, expanded, onToggle, badge }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 6, width: '100%',
      padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
      borderTop: '1px solid #f0ece4', marginTop: 4, minHeight: 36,
    }}>
      {expanded ? <ChevronDown size={12} color="#aaa" /> : <ChevronRight size={12} color="#aaa" />}
      <span style={{ fontSize: 10, fontWeight: 700, color: '#888', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      {badge && <span style={{ fontSize: 9, background: '#B8962E20', color: '#B8962E', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{badge}</span>}
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, color, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: primary ? 'center' : 'flex-start', gap: 6,
      padding: primary ? '10px 16px' : '8px 14px',
      border: primary ? 'none' : `1px solid ${color}20`, borderRadius: 8,
      background: primary ? color : `${color}08`,
      color: primary ? '#fff' : color,
      fontSize: primary ? 13 : 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      minHeight: primary ? 42 : 36, whiteSpace: 'nowrap',
      flex: primary ? 1 : undefined,
    }}>
      <Icon size={primary ? 16 : 14} /> {label}
    </button>
  );
}

function DuplicateSettingsBtn({ screens, onDuplicate }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <ActionBtn icon={Copy} label="Copy To" onClick={() => setOpen(!open)} color="#7ab3d4" />
      {open && (
        <div className="overlays-dup-dropdown">
          <div className="overlays-dup-dropdown__header">
            Copy fit & links to:
          </div>
          {screens.map(s => (
            <button key={s.id} onClick={() => { onDuplicate(s.id); setOpen(false); }} className="overlays-dup-dropdown__item">
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateScreenModal({ onClose, onCreate, isIcon = false, showId, existingScreens = [] }) {
  const [form, setForm] = useState({ name: '', beat: '', description: '', prompt: '', opens_screen: '' });
  // Optional details (beat / description / generation prompt) collapsed by
  // default — most creators just want to name the thing and pick what it opens.
  // The Generation Prompt is only needed if you plan to AI-generate the image;
  // uploading one later works fine without it.
  const [showOptional, setShowOptional] = useState(false);
  // Direct-upload support: attach an image while creating so the asset is
  // immediately populated. Preview shown inline before Create is clicked.
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Auto-suggest linked screen when creating an icon
  useEffect(() => {
    if (!isIcon || !form.name.trim() || !showId) { setSuggestions([]); return; }
    const timer = setTimeout(() => {
      api.get(`/api/v1/ui-overlays/${showId}/types/suggest-links/${encodeURIComponent(form.name.trim())}`)
        .then(r => {
          const data = r.data?.data || [];
          setSuggestions(data);
          // Auto-select first suggestion if user hasn't picked one
          if (data.length > 0 && !form.opens_screen) {
            setForm(f => ({ ...f, opens_screen: data[0].id }));
          }
        })
        .catch(() => setSuggestions([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [isIcon, form.name, showId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onCreate(form, uploadFile);
    setSaving(false);
  };

  // File picker: store the File for submit-time upload AND generate a local
  // object URL for an inline preview so creators can confirm before hitting Create.
  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadPreview((prev) => {
      if (prev) { try { URL.revokeObjectURL(prev); } catch {} }
      return URL.createObjectURL(file);
    });
  };
  const clearFile = () => {
    setUploadFile(null);
    setUploadPreview((prev) => {
      if (prev) { try { URL.revokeObjectURL(prev); } catch {} }
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  useEffect(() => () => {
    // Revoke the preview URL on unmount to avoid leaks.
    if (uploadPreview) { try { URL.revokeObjectURL(uploadPreview); } catch {} }
  }, [uploadPreview]);

  return (
    <div className="overlays-modal-backdrop" onClick={onClose}>
      <div className="overlays-modal" onClick={e => e.stopPropagation()}>
        <div className="overlays-modal__header">
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isIcon ? 'New App Icon' : 'New Phone Screen'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overlays-modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>{isIcon ? 'Icon Name' : 'Screen Name'}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isIcon ? 'e.g., Social Feed Icon, Camera Icon' : 'e.g., Feed View, DM Conversation'} className="overlays-modal__field" />
            </div>

            {/* Inline image upload — lets creators attach their own image right
                here instead of creating a placeholder first then uploading on
                the card. Optional; skipping keeps today's "generate or upload
                later" flow intact. */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
                {isIcon ? 'Icon Image' : 'Screen Image'} <span style={{ color: '#A09889', fontWeight: 500 }}>— optional, upload your own</span>
              </label>
              {uploadPreview ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 10,
                  border: '1px solid #E8E0D0',
                  borderRadius: 8,
                  background: '#FAF7F0',
                }}>
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    style={{
                      width: isIcon ? 48 : 42,
                      height: isIcon ? 48 : 72,
                      objectFit: isIcon ? 'contain' : 'cover',
                      borderRadius: 6,
                      background: '#fff',
                      border: '1px solid #E8E0D0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {uploadFile?.name || 'Selected image'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B6557', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                      Will upload when you click Create
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600,
                      border: '1px solid #E8E0D0', borderRadius: 6,
                      background: '#fff', color: '#6B6557',
                      cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #E8E0D0',
                    borderRadius: 8,
                    background: '#FAF7F0',
                    color: '#6B6557',
                    cursor: 'pointer',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#B8962E'; e.currentTarget.style.color = '#B8962E'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E8E0D0'; e.currentTarget.style.color = '#6B6557'; }}
                >
                  <Upload size={14} /> Upload image (PNG or JPG)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFilePick}
                style={{ display: 'none' }}
              />
            </div>
            {isIcon && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>Opens Screen</label>
                <select
                  value={form.opens_screen}
                  onChange={e => setForm(f => ({ ...f, opens_screen: e.target.value }))}
                  className="overlays-modal__field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">None (no navigation)</option>
                  {/* Show suggestions first, highlighted */}
                  {suggestions.length > 0 && <optgroup label="Suggested">
                    {suggestions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>}
                  {/* All screens */}
                  <optgroup label="All Screens">
                    {existingScreens.filter(s => !suggestions.find(sg => sg.id === s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                </select>
                {suggestions.length > 0 && (
                  <div style={{ fontSize: 10, color: '#B8962E', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                    Auto-suggested based on icon name
                  </div>
                )}
              </div>
            )}
            {/* Optional details — collapsed by default since most creators
                just want a name + what-it-opens. Beat/Description are
                nice-to-have; Generation Prompt is only needed if you plan
                to AI-generate the image (you can upload one later instead). */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptional(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: '#6B6557', fontFamily: "'DM Mono', monospace",
                  letterSpacing: 0.3,
                }}
              >
                <ChevronRight
                  size={14}
                  style={{
                    transform: showOptional ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
                Optional details
                <span style={{ color: '#A09889', fontWeight: 500 }}>
                  · beat, description, AI prompt
                </span>
              </button>
            </div>
            {showOptional && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
                    Beat / Trigger <span style={{ color: '#A09889', fontWeight: 500 }}>— optional</span>
                  </label>
                  <input value={form.beat} onChange={e => setForm(f => ({ ...f, beat: e.target.value }))} placeholder="e.g., Beat 2, Login" className="overlays-modal__field" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
                    Description <span style={{ color: '#A09889', fontWeight: 500 }}>— optional</span>
                  </label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What the screen shows" className="overlays-modal__field" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>
                    Generation Prompt <span style={{ color: '#A09889', fontWeight: 500 }}>— only if you plan to AI-generate</span>
                  </label>
                  <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={3} placeholder="Describe the screen for AI generation..." className="overlays-modal__field" style={{ resize: 'vertical' }} />
                </div>
              </>
            )}
            <button type="submit" disabled={saving || !form.name.trim()} className="overlays-modal__submit">
              {saving ? 'Creating...' : isIcon ? 'Create Icon' : 'Create Screen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
