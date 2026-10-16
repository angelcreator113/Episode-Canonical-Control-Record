import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutGrid, CheckCircle2, PenLine, Archive, Lock, Search, Plus, Copy, Send,
  Trash2, ImageIcon, Layers, Maximize2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import apiClient from '../services/api';
import './TemplateStudio.css';

// ─── Track 6 CP10 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites on /template-studio/*. publishTemplateApi
// duplicated locally per v2.12 §9.11 (CP6 TemplateDesigner has it).
export const listTemplatesApi = (params) =>
  apiClient.get(params ? `/api/v1/template-studio?${params}` : '/api/v1/template-studio');
export const cloneTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/clone`);
export const publishTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/publish`);
export const lockTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/lock`);
export const archiveTemplateApi = (id) =>
  apiClient.post(`/api/v1/template-studio/${id}/archive`);
export const deleteTemplateApi = (id) =>
  apiClient.delete(`/api/v1/template-studio/${id}`);

/**
 * TemplateStudio - Template Management Dashboard
 * List, filter, preview and manage thumbnail templates
 */

const STATUSES = {
  ALL:       { label: 'All Templates', icon: LayoutGrid },
  PUBLISHED: { label: 'Published',     icon: CheckCircle2 },
  DRAFT:     { label: 'Drafts',        icon: PenLine },
  ARCHIVED:  { label: 'Archived',      icon: Archive },
};

// The formats TemplateDesigner offers (THUMBNAIL_FORMATS), plus Twitter, which it saves.
export const FORMAT_LABELS = {
  YOUTUBE: 'YouTube',
  INSTAGRAM_FEED: 'Instagram Feed',
  INSTAGRAM_STORY: 'Instagram Story',
  FACEBOOK: 'Facebook',
  TWITTER: 'Twitter / X',
};
export const formatLabel = (f) =>
  FORMAT_LABELS[String(f).toUpperCase()] || String(f).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const SORTS = {
  recently_used: { label: 'Recently Used', fn: (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at) },
  alphabetical:  { label: 'Alphabetical',  fn: (a, b) => a.name.localeCompare(b.name) },
  most_used:     { label: 'Most Used',     fn: (a, b) => (b.usage_count || 0) - (a.usage_count || 0) },
  newest:        { label: 'Newest First',  fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
};

/** "CHAR.HOST.PRIMARY" → "Host Primary"; "TEXT.TITLE" → "Title". */
export const roleLabel = (role) => {
  const parts = String(role || '').split('.').filter(Boolean);
  const words = (parts.length > 1 ? parts.slice(1) : parts).join(' ').replace(/_/g, ' ').toLowerCase();
  return words.replace(/\b\w/g, c => c.toUpperCase()) || 'Slot';
};

/** A slot's box, from the flat (x, y…) or nested (position.x…) shape TemplateDesigner reads. */
export const slotBox = (slot) => ({
  x: Number(slot.x ?? slot.position?.x) || 0,
  y: Number(slot.y ?? slot.position?.y) || 0,
  width: Number(slot.width ?? slot.position?.width) || 0,
  height: Number(slot.height ?? slot.position?.height) || 0,
  layer: Number(slot.layer ?? slot.z_index) || 0,
});

const statusWord = (st) => { const w = String(st || '').toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); };

export function orientationOf(t) {
  const w = Number(t.canvas_config?.width), h = Number(t.canvas_config?.height);
  if (!w || !h) return null;
  if (Math.abs(w - h) / Math.max(w, h) < 0.05) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

const ROLE_TINTS = ['#e98bb5', '#c9a84c', '#a46ee0', '#4f8cc9', '#2bb5ad', '#e9a81c'];
const roleTint = (role) => {
  const parts = String(role || '').split('.');
  const top = parts.slice(0, 2).join('.');
  let h = 0;
  for (const ch of top) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROLE_TINTS[h % ROLE_TINTS.length];
};

/* A wireframe of the template: its canvas and role slots, to scale. */
function TemplatePreview({ template, labels = false, safeZones = false, fit = 4 / 3 }) {
  const w = Number(template.canvas_config?.width) || 1920;
  const h = Number(template.canvas_config?.height) || 1080;
  const bg = template.canvas_config?.background || '#fff6fa';
  const required = new Set(template.required_roles || []);
  const slots = (template.role_slots || []).map(s => ({ ...slotBox(s), role: s.role }))
    .filter(s => s.width > 0 && s.height > 0)
    .sort((a, b) => a.layer - b.layer);
  const zones = safeZones && Array.isArray(template.safe_zones) ? template.safe_zones : [];
  const fs = Math.max(w, h) / 32;
  return (
    <svg className="ts-preview" viewBox={`0 0 ${w} ${h}`} role="img"
      // Fill the box's width or its height, whichever the canvas meets first.
      style={w / h > fit ? { width: '100%', aspectRatio: `${w} / ${h}` } : { height: '100%', aspectRatio: `${w} / ${h}` }}
      aria-label={`${template.name} layout, ${w}×${h}, ${slots.length} slots`}>
      <defs>
        <linearGradient id={`ts-bg-${template.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg} />
          <stop offset="1" stopColor="#f6d3e3" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#ts-bg-${template.id})`} />
      {zones.map((z, i) => {
        const b = slotBox(z);
        return b.width > 0 && (
          <rect key={`z${i}`} x={b.x} y={b.y} width={b.width} height={b.height}
            fill="none" stroke="#b8962e" strokeWidth={fs / 8} strokeDasharray={`${fs / 2} ${fs / 3}`} />
        );
      })}
      {slots.map((s, i) => {
        // A background slot is the backdrop, not a box: a soft wash, no label.
        if (String(s.role).toUpperCase().startsWith('BACKGROUND')) {
          return (
            <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height}
              fill="#e98bb5" fillOpacity={0.12} stroke="none" />
          );
        }
        const tint = roleTint(s.role);
        return (
          <g key={i}>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={Math.min(s.width, s.height) * 0.06}
              fill={tint} fillOpacity={required.has(s.role) ? 0.45 : 0.22}
              stroke={tint} strokeWidth={fs / 6} strokeDasharray={required.has(s.role) ? undefined : `${fs / 2} ${fs / 3}`} />
            {labels && (
              <text x={s.x + s.width / 2} y={s.y + s.height / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(fs, s.width / 6)} fontFamily="DM Sans, sans-serif" fontWeight="700" fill="#6e1d4f">
                {roleLabel(s.role)}
              </text>
            )}
          </g>
        );
      })}
      {slots.length === 0 && (
        <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs}
          fontFamily="DM Sans, sans-serif" fill="#9b6a86">No slots yet</text>
      )}
    </svg>
  );
}

function TemplateStudio() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [orientation, setOrientation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recently_used');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Every status at once, so the rail's counts are true whichever is in view.
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listTemplatesApi('limit=500');
      setTemplates(response.data?.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/template-studio/designer');
  };

  const handleEdit = (template) => {
    if (template.status !== 'DRAFT') {
      alert('Only DRAFT templates can be edited. Clone this template to create a new version.');
      return;
    }
    navigate(`/template-studio/designer/${template.id}`);
  };

  const handleClone = async (template) => {
    if (!confirm(`Clone "${template.name}" to create version ${template.version + 1}?`)) {
      return;
    }

    try {
      const response = await cloneTemplateApi(template.id);
      alert(`✅ Template cloned successfully! New version: ${response.data?.data?.version}`);
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to clone template'}`);
    }
  };

  const handlePublish = async (template) => {
    if (!confirm(`Publish "${template.name}"? This will make it available for use.`)) {
      return;
    }

    try {
      await publishTemplateApi(template.id);
      alert('✅ Template published successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to publish template'}`);
    }
  };

  const handleLock = async (template) => {
    if (!confirm(`Lock "${template.name}"? This will prevent any future edits.`)) {
      return;
    }

    try {
      await lockTemplateApi(template.id);
      alert('✅ Template locked successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to lock template'}`);
    }
  };

  const handleArchive = async (template) => {
    if (!confirm(`Archive "${template.name}"? It will no longer be available for new compositions.`)) {
      return;
    }

    try {
      await archiveTemplateApi(template.id);
      alert('✅ Template archived successfully!');
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to archive template'}`);
    }
  };

  const handleDelete = async (template) => {
    if (template.status !== 'DRAFT') {
      alert('Only DRAFT templates can be deleted. Use Archive instead.');
      return;
    }

    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteTemplateApi(template.id);
      alert('✅ Template deleted successfully!');
      if (selectedId === template.id) setSelectedId(null);
      loadTemplates();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message || 'Failed to delete template'}`);
    }
  };

  const statusCounts = useMemo(() => templates.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {}), [templates]);

  const formats = useMemo(() => {
    const n = {};
    templates.forEach(t => (t.formats_supported || []).forEach(f => {
      const k = String(f).toUpperCase();
      n[k] = (n[k] || 0) + 1;
    }));
    return Object.keys(n).sort((a, b) => n[b] - n[a]);
  }, [templates]);

  const sortedTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (formatFilter !== 'ALL' && !(t.formats_supported || []).some(f => String(f).toUpperCase() === formatFilter)) return false;
      if (orientation !== 'all' && orientationOf(t) !== orientation) return false;
      if (q && !(t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))) return false;
      return true;
    }).sort(SORTS[sortBy].fn);
  }, [templates, statusFilter, formatFilter, orientation, searchQuery, sortBy]);

  const selected = sortedTemplates.find(t => t.id === selectedId) || sortedTemplates[0] || null;

  // The selected template's versions: every template sharing its name, oldest first.
  const versions = useMemo(() => (selected
    ? templates.filter(t => t.name === selected.name).sort((a, b) => (a.version || 0) - (b.version || 0))
    : []), [templates, selected]);

  const selIndex = selected ? sortedTemplates.indexOf(selected) : -1;
  const step = (d) => {
    const next = sortedTemplates[selIndex + d];
    if (next) setSelectedId(next.id);
  };

  const filtersActive = statusFilter !== 'ALL' || formatFilter !== 'ALL' || orientation !== 'all' || searchQuery.trim() !== '';
  const clearFilters = () => {
    setStatusFilter('ALL');
    setFormatFilter('ALL');
    setOrientation('all');
    setSearchQuery('');
  };

  return (
    <div className="template-studio">
      {/* ── Banner ─────────────────────────────────────────────── */}
      <header className="ts-banner">
        <div className="ts-banner-left">
          <span className="ts-brand">LalaVerse</span>
          <div>
            <h1 className="ts-title">Template Studio</h1>
            <div className="ts-tagline">Create · Customize · Publish · Reuse</div>
          </div>
        </div>
        <button type="button" onClick={handleCreateNew} className="ts-new">
          <Plus size={20} aria-hidden /> New Template
        </button>
      </header>

      <div className="ts-body">
        {/* ── Rail ───────────────────────────────────────────────── */}
        <aside className="ts-rail" aria-label="Template folders">
          <nav className="ts-rail-nav">
            {Object.entries(STATUSES).map(([key, s]) => {
              const Icon = s.icon;
              const n = key === 'ALL' ? templates.length : (statusCounts[key] || 0);
              return (
                <button key={key} type="button" aria-pressed={statusFilter === key}
                  className={`ts-rail-btn ${statusFilter === key ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(key)}>
                  <Icon size={20} aria-hidden />
                  <span className="ts-rail-label">{s.label}</span>
                  <span className="ts-rail-count">{n}</span>
                </button>
              );
            })}
          </nav>
          <div className="ts-rail-divider" />
          <div className="ts-rail-heading">Elsewhere in the studio</div>
          <nav className="ts-rail-nav">
            <Link className="ts-rail-btn" to="/assets"><ImageIcon size={20} aria-hidden /><span className="ts-rail-label">Asset Library</span></Link>
          </nav>
        </aside>

        {/* ── Main ───────────────────────────────────────────────── */}
        <div className="ts-main">
          {/* format tabs */}
          <div className="ts-tabs" role="tablist" aria-label="Formats">
            <button type="button" role="tab" aria-selected={formatFilter === 'ALL'}
              className={`ts-tab ${formatFilter === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setFormatFilter('ALL')}>All Formats</button>
            {formats.map(f => (
              <button key={f} type="button" role="tab" aria-selected={formatFilter === f}
                className={`ts-tab ${formatFilter === f ? 'is-active' : ''}`}
                onClick={() => setFormatFilter(f)}>{formatLabel(f)}</button>
            ))}
          </div>

          {/* filter row */}
          <div className="ts-filters">
            <select className="ts-filter" value={orientation} onChange={(e) => setOrientation(e.target.value)} aria-label="Orientation">
              <option value="all">Orientation: All</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="square">Square</option>
            </select>
            <label className="ts-search">
              <Search size={18} aria-hidden />
              <input type="text" placeholder="Search templates…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search templates" />
            </label>
            <select className="ts-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>Sort: {s.label}</option>)}
            </select>
            {filtersActive && <button type="button" className="ts-clear" onClick={clearFilters}>Clear</button>}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="ts-state">
              <div className="ts-spinner"></div>
              <p>Loading templates...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="ts-state" role="alert">
              <p>{error}</p>
              <button onClick={loadTemplates} className="ts-clear">Retry</button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && sortedTemplates.length === 0 && (
            <div className="ts-state">
              <Layers size={40} aria-hidden className="ts-state-icon" />
              <h3>No Templates Found</h3>
              <p>
                {filtersActive
                  ? 'Try adjusting your search or filters'
                  : 'Create your first template to get started'
                }
              </p>
              {filtersActive
                ? <button onClick={clearFilters} className="ts-clear">Clear filters</button>
                : <button onClick={handleCreateNew} className="ts-new">Create First Template</button>}
            </div>
          )}

          {!loading && !error && selected && (
            <div className="ts-workspace">
              {/* card grid */}
              <div className="ts-grid">
                {sortedTemplates.map(t => (
                  <button key={t.id} type="button"
                    className={`ts-card ${selected.id === t.id ? 'is-selected' : ''}`}
                    aria-pressed={selected.id === t.id}
                    onClick={() => setSelectedId(t.id)}
                    onDoubleClick={() => t.status === 'DRAFT' && !t.locked && handleEdit(t)}>
                    <div className="ts-card-media"><TemplatePreview template={t} fit={1.2} /></div>
                    <div className="ts-card-foot">
                      <span className="ts-card-name">{t.name}</span>
                      <span className={`ts-status is-${String(t.status).toLowerCase()}`}>
                        {t.locked && <Lock size={11} aria-hidden />} v{t.version} · {statusWord(t.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* preview panel */}
              <section className="ts-panel" aria-label={`Preview: ${selected.name}`}>
                <div className="ts-panel-bar">
                  <button type="button" className="ts-icon-btn" onClick={() => step(-1)} disabled={selIndex <= 0} aria-label="Previous template">
                    <ChevronLeft size={18} aria-hidden />
                  </button>
                  <span className="ts-panel-pos">{selIndex + 1} of {sortedTemplates.length}</span>
                  <button type="button" className="ts-icon-btn" onClick={() => step(1)} disabled={selIndex >= sortedTemplates.length - 1} aria-label="Next template">
                    <ChevronRight size={18} aria-hidden />
                  </button>
                  <span className="ts-panel-size">
                    <Maximize2 size={14} aria-hidden /> {selected.canvas_config?.width}×{selected.canvas_config?.height}
                  </span>
                </div>

                <div className="ts-panel-stage">
                  <TemplatePreview template={selected} labels safeZones fit={1.15} />
                </div>

                <div className="ts-panel-info">
                  <h2 className="ts-panel-name">{selected.name}</h2>
                  {selected.description && <p className="ts-panel-desc">{selected.description}</p>}
                  <div className="ts-chips">
                    <span className={`ts-status is-${String(selected.status).toLowerCase()}`}>v{selected.version} · {statusWord(selected.status)}</span>
                    {selected.locked && <span className="ts-chip"><Lock size={12} aria-hidden /> Locked</span>}
                    {(selected.formats_supported || []).map(f => <span key={f} className="ts-chip">{formatLabel(f)}</span>)}
                  </div>
                  <div className="ts-roles">
                    <div><strong>{(selected.required_roles || []).length}</strong> required</div>
                    <div><strong>{(selected.optional_roles || []).length}</strong> optional</div>
                    <div><strong>{(selected.role_slots || []).length}</strong> slots</div>
                  </div>
                  {(selected.required_roles || []).length > 0 && (
                    <div className="ts-role-list">
                      {selected.required_roles.map(r => <span key={r} className="ts-role is-required">{roleLabel(r)}</span>)}
                      {(selected.optional_roles || []).map(r => <span key={r} className="ts-role">{roleLabel(r)}</span>)}
                    </div>
                  )}
                </div>

                <div className="ts-actions">
                  {selected.status === 'DRAFT' && !selected.locked && (
                    <>
                      <button type="button" className="ts-action is-primary" onClick={() => handleEdit(selected)}><PenLine size={18} aria-hidden /> Edit</button>
                      <button type="button" className="ts-action" onClick={() => handlePublish(selected)}><Send size={18} aria-hidden /> Publish</button>
                      <button type="button" className="ts-action is-danger" onClick={() => handleDelete(selected)}><Trash2 size={18} aria-hidden /> Delete</button>
                    </>
                  )}
                  {selected.status === 'PUBLISHED' && (
                    <>
                      {/* Removed: "Use Template" button — opened a composer with this template; no composer route takes a template without an episode. */}
                      <button type="button" className="ts-action is-primary" onClick={() => handleClone(selected)}><Copy size={18} aria-hidden /> Clone</button>
                      <button type="button" className="ts-action" onClick={() => handleArchive(selected)}><Archive size={18} aria-hidden /> Archive</button>
                    </>
                  )}
                  {selected.status === 'ARCHIVED' && (
                    <button type="button" className="ts-action is-primary" onClick={() => handleClone(selected)}><Copy size={18} aria-hidden /> Clone</button>
                  )}
                </div>
              </section>

              {/* versions strip */}
              <section className="ts-versions" aria-label={`${selected.name} versions`}>
                <header className="ts-versions-head">
                  <Layers size={18} aria-hidden />
                  <h2>{selected.name} — {versions.length} version{versions.length !== 1 ? 's' : ''}</h2>
                </header>
                <div className="ts-versions-strip">
                  {versions.map(v => (
                    <button key={v.id} type="button"
                      className={`ts-version ${v.id === selected.id ? 'is-selected' : ''}`}
                      onClick={() => { clearFilters(); setSelectedId(v.id); }}>
                      <div className="ts-version-media"><TemplatePreview template={v} fit={1.4} /></div>
                      <span>v{v.version} · {statusWord(v.status)}</span>
                    </button>
                  ))}
                  {selected.status !== 'DRAFT' && (
                    <button type="button" className="ts-version ts-version-add" onClick={() => handleClone(selected)}
                      aria-label={`Clone ${selected.name} as a new version`}>
                      <div className="ts-version-media"><Plus size={28} aria-hidden /></div>
                      <span>New version</span>
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateStudio;
