import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROLE_COLORS, ROLE_ICONS, MOMENTUM_COLORS, WORLD_LABELS } from '../constants/characterConstants';
import useRegistries from '../hooks/useRegistries';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import './CharacterGenerator.css';

// ─── LocalStorage persistence helpers ─────────────────────────────────────────
const STORAGE_KEY = 'cg-session';
const HISTORY_KEY = 'cg-history';
function saveSession(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}
function loadSession() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
function saveToHistory(entry) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry); // newest first
    // Keep last 50 generations to avoid quota issues
    if (list.length > 50) list.length = 50;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch { /* quota */ }
}
function loadHistory() {
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Utility functions ────────────────────────────────────────────────────────────────
function computeCompleteness(profile) {
  if (!profile) return 0;
  const fields = [
    profile.identity?.name, profile.identity?.age, profile.identity?.gender,
    profile.living_state?.knows, profile.living_state?.wants, profile.living_state?.unresolved,
    profile.living_state?.current_location, profile.living_state?.momentum,
    profile.psychology?.core_wound, profile.psychology?.desire_line, profile.psychology?.fear_line,
    profile.psychology?.coping_mechanism, profile.psychology?.self_deception,
    profile.aesthetic_dna?.visual_signature, profile.aesthetic_dna?.style, profile.aesthetic_dna?.signature_object,
    profile.career?.job_title, profile.career?.industry, profile.career?.career_wound,
    profile.relationships?.romantic_status, profile.relationships?.romantic_detail,
    profile.voice?.how_they_speak, profile.voice?.signature_sentence_structure,
    profile.dilemma?.active, profile.dilemma?.latent_1,
    ...(profile.plot_threads || []).map(t => t.thread),
  ];
  const filled = fields.filter(v => v && String(v).trim()).length;
  return Math.round((filled / fields.length) * 100);
}

function exportBatchAsJSON(batch) {
  const data = batch
    .filter(r => r.status === 'generated' && r.profile)
    .map(r => ({ seed: r.seed, profile: r.profile }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `character-profiles-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CompletionRing ─────────────────────────────────────────────────────────────────
function CompletionRing({ percent, size = 32 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent >= 90 ? 'var(--cg-green)' : percent >= 60 ? 'var(--cg-gold)' : 'var(--cg-red)';
  return (
    <svg width={size} height={size} className="cg-completion-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--cg-border)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size < 36 ? '8px' : '10px', fill: 'var(--cg-muted)', fontWeight: 700 }}>
        {percent}%
      </text>
    </svg>
  );
}

// ─── SkeletonCard (loading placeholder) ───────────────────────────────────────────
function SkeletonCard({ index }) {
  return (
    <div className="cg-staging-card cg-skeleton-card" style={{ animationDelay: `${index * 0.15}s` }}>
      <div className="cg-staging-bar cg-skeleton-bar" />
      <div style={{ padding: '18px 22px' }}>
        <div className="cg-skeleton-line cg-skeleton-name" />
        <div className="cg-skeleton-line cg-skeleton-meta-line" />
        <div className="cg-skeleton-line cg-skeleton-tension-line" />
      </div>
    </div>
  );
}

// ─── RelationshipWebPreview ─────────────────────────────────────────────────────────
function RelationshipWebPreview({ batch }) {
  const generated = batch.filter(r => r.status === 'generated' && r.profile);
  if (generated.length < 2) return null;
  const svgSize = 300;
  const cx = svgSize / 2, cy = svgSize / 2, radius = 110;
  const nodes = generated.map((r, i) => {
    const angle = (2 * Math.PI * i) / generated.length - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      name: r.seed?.name || r.profile?.identity?.name || '?',
      role: r.seed?.role_type || r.profile?.identity?.role_type,
      connections: r.profile?.relationships?.proposed_connections || [],
    };
  });
  const edges = [];
  nodes.forEach((node, i) => {
    (node.connections || []).forEach(conn => {
      const target = (conn.to_character || '').toLowerCase();
      const targetIdx = nodes.findIndex((n, j) => j !== i && (
        n.name.toLowerCase().includes(target) || target.includes(n.name.toLowerCase())
      ));
      if (targetIdx >= 0) {
        const exists = edges.some(e => (e.from === i && e.to === targetIdx) || (e.from === targetIdx && e.to === i));
        if (!exists) edges.push({ from: i, to: targetIdx, type: conn.relationship_type });
      }
    });
  });
  const typeColor = { pressure: 'var(--cg-red)', romantic: '#e07070', shadow: '#9b4dca', support: 'var(--cg-green)', mirror: '#7b8de0' };
  return (
    <div className="cg-rel-web">
      <div className="cg-rel-web-title">Relationship Web</div>
      <svg width={svgSize} height={svgSize} className="cg-rel-web-svg">
        {edges.map((e, i) => (
          <line key={i}
            x1={nodes[e.from].x} y1={nodes[e.from].y}
            x2={nodes[e.to].x} y2={nodes[e.to].y}
            stroke={typeColor[e.type] || 'var(--cg-border2)'} strokeWidth="1.5" opacity="0.6"
            strokeDasharray={e.type === 'pressure' ? '4,3' : 'none'} />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="20" fill={ROLE_COLORS[n.role] || '#94a3b8'} opacity="0.12"
              stroke={ROLE_COLORS[n.role] || '#94a3b8'} strokeWidth="2" />
            <text x={n.x} y={n.y + 4} textAnchor="middle" dominantBaseline="central"
              fontSize="13" fill={ROLE_COLORS[n.role] || '#94a3b8'} fontWeight="700">
              {ROLE_ICONS[n.role] || '◆'}
            </text>
            <text x={n.x} y={n.y + 32} textAnchor="middle"
              fontSize="10" fill="var(--cg-muted)" fontWeight="600">
              {n.name.length > 10 ? n.name.slice(0, 9) + '…' : n.name}
            </text>
          </g>
        ))}
      </svg>
      {edges.length > 0 && (
        <div className="cg-rel-web-legend">
          {edges.map((e, i) => (
            <span key={i} className="cg-rel-web-edge-label">
              <span style={{ color: typeColor[e.type] || 'var(--cg-muted)' }}>●</span>
              {' '}{nodes[e.from].name.split(' ')[0]} → {nodes[e.to].name.split(' ')[0]}
              <span className="cg-rel-web-type">{e.type}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ComparisonModal ───────────────────────────────────────────────────────────────
function ComparisonModal({ batch, onClose }) {
  const generated = batch.filter(r => r.status === 'generated' && r.profile);
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(Math.min(1, generated.length - 1));
  if (generated.length < 2) return null;
  const a = generated[idxA], b = generated[idxB];
  const fields = [
    { label: 'Role', get: r => `${ROLE_ICONS[r.seed?.role_type] || ''} ${r.seed?.role_type || '—'}` },
    { label: 'Age / Gender', get: r => `${r.profile?.identity?.age || r.seed?.age || '—'}, ${r.profile?.identity?.gender || r.seed?.gender || '—'}` },
    { label: 'Career', get: r => r.profile?.career?.job_title || r.seed?.career || '—' },
    { label: 'Tension', get: r => r.seed?.tension || '—' },
    { label: 'Core Wound', get: r => r.profile?.psychology?.core_wound || '—' },
    { label: 'Desire Line', get: r => r.profile?.psychology?.desire_line || '—' },
    { label: 'Fear Line', get: r => r.profile?.psychology?.fear_line || '—' },
    { label: 'Active Dilemma', get: r => r.profile?.dilemma?.active || '—' },
    { label: 'Momentum', get: r => r.profile?.living_state?.momentum || '—' },
    { label: 'Voice', get: r => r.profile?.voice?.how_they_speak || '—' },
    { label: 'Romantic Status', get: r => r.profile?.relationships?.romantic_status || '—' },
    { label: 'Visual Sig.', get: r => r.profile?.aesthetic_dna?.visual_signature || '—' },
  ];
  return (
    <div className="cg-compare-overlay" onClick={onClose}>
      <div className="cg-compare-modal" onClick={e => e.stopPropagation()}>
        <div className="cg-compare-header">
          <span className="cg-compare-title">Compare Characters</span>
          <button className="cg-btn cg-btn-cancel" onClick={onClose}>✕</button>
        </div>
        <div className="cg-compare-selectors">
          <select className="cg-world-select" value={idxA} onChange={e => setIdxA(+e.target.value)}>
            {generated.map((r, i) => <option key={i} value={i}>{r.seed?.name}</option>)}
          </select>
          <span className="cg-compare-vs">vs</span>
          <select className="cg-world-select" value={idxB} onChange={e => setIdxB(+e.target.value)}>
            {generated.map((r, i) => <option key={i} value={i}>{r.seed?.name}</option>)}
          </select>
        </div>
        <div className="cg-compare-table">
          <div className="cg-compare-row cg-compare-row-header">
            <div className="cg-compare-label">Field</div>
            <div className="cg-compare-val">{a?.seed?.name}</div>
            <div className="cg-compare-val">{b?.seed?.name}</div>
          </div>
          {fields.map((f, i) => (
            <div key={i} className="cg-compare-row">
              <div className="cg-compare-label">{f.label}</div>
              <div className="cg-compare-val">{f.get(a)}</div>
              <div className="cg-compare-val">{f.get(b)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── World Builder mini-panel (ecosystem generation for empty worlds) ────────
function WorldBuilderPanel({ worldTarget, ecosystem, onEcosystemGenerated }) {
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    city: '', industry: '', career_stage: 'early_career', character_count: 8,
  });

  const worldStats = ecosystem?.[worldTarget]?.stats;
  const isEmpty = !worldStats || worldStats.total === 0;

  if (!isEmpty) return null;

  return (
    <div className="cg-world-builder">
      <div className="cg-world-builder-header">
        <div className="cg-world-builder-icon">✦</div>
        <div className="cg-world-builder-text">
          <div className="cg-world-builder-title">
            {worldTarget === 'lalaverse' ? 'LalaVerse' : 'Book 1'} is empty
          </div>
          <div className="cg-world-builder-sub">
            Generate a character ecosystem first, or propose seeds directly
          </div>
        </div>
      </div>

      {!showForm ? (
        <button
          className="cg-btn cg-btn-world-build"
          onClick={() => setShowForm(true)}
        >
          ✨ Build World Ecosystem
        </button>
      ) : (
        <div className="cg-world-builder-form">
          <div className="cg-wb-row">
            <label>City / Setting</label>
            <input
              placeholder={worldTarget === 'lalaverse' ? 'Fashion capital, digital world…' : 'Suburban America, a major city…'}
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="cg-wb-row">
            <label>Industry / Focus</label>
            <input
              placeholder={worldTarget === 'lalaverse' ? 'Content creation and fashion' : 'Professional careers, family life'}
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
            />
          </div>
          <div className="cg-wb-row-inline">
            <div className="cg-wb-row">
              <label>Career Stage</label>
              <select value={form.career_stage} onChange={e => setForm(f => ({ ...f, career_stage: e.target.value }))}>
                <option value="early_career">Early Career</option>
                <option value="mid_career">Mid Career</option>
                <option value="established">Established</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div className="cg-wb-row">
              <label>Characters</label>
              <input
                type="number" min={4} max={20}
                value={form.character_count}
                onChange={e => setForm(f => ({ ...f, character_count: parseInt(e.target.value) || 8 }))}
              />
            </div>
          </div>
          <div className="cg-wb-actions">
            <button className="cg-btn cg-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            <button
              className="cg-btn cg-btn-generate"
              disabled={generating}
              onClick={async () => {
                setGenerating(true);
                try {
                  const res = await fetch(`${API_BASE}/world/generate-ecosystem`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      world_context: {
                        city: form.city || (worldTarget === 'lalaverse' ? 'a fashion capital' : 'a major city'),
                        industry: form.industry || (worldTarget === 'lalaverse' ? 'content creation and fashion' : 'professional careers'),
                        career_stage: form.career_stage,
                      },
                      character_count: form.character_count,
                    }),
                  });
                  const data = await res.json();
                  if (data.characters || data.count) {
                    setShowForm(false);
                    if (onEcosystemGenerated) onEcosystemGenerated();
                  }
                } catch (e) {
                  console.error('Ecosystem generation failed:', e);
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {generating ? 'Generating…' : `Generate ${form.character_count} Characters`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ecosystem panel ──────────────────────────────────────────────────────────
function EcosystemPanel({ ecosystem, loading, worldTarget }) {
  if (loading) return (
    <div className="cg-ecosystem-loading">
      <div className="cg-spinner" />
      <span>Reading the world…</span>
    </div>
  );

  if (!ecosystem) return null;

  // Show relevant worlds based on target
  const worlds = worldTarget === 'both' ? ['book1', 'lalaverse']
    : worldTarget === 'lalaverse' ? ['lalaverse']
    : ['book1'];

  return (
    <div className="cg-ecosystem">
      {worlds.map((worldId) => {
        const world = ecosystem[worldId];
        if (!world) return null;
        const stats = world.stats || {};
        const roleCount = stats.roleCount || {};

        return (
          <div key={worldId} className={`cg-world-card cg-health-${stats.health || 'unknown'}`}>
            <div className="cg-world-header">
              <span className="cg-world-label">{WORLD_LABELS[worldId]}</span>
              <span className={`cg-world-health cg-health-badge-${stats.health}`}>
                {stats.health || '—'}
              </span>
            </div>
            <div className="cg-world-total">{stats.total || 0} characters</div>

            {/* Role distribution */}
            <div className="cg-role-bars">
              {Object.entries(roleCount).map(([role, count]) => (
                <div key={role} className="cg-role-bar-row">
                  <span
                    className="cg-role-bar-label"
                    style={{ color: ROLE_COLORS[role] }}
                  >
                    {ROLE_ICONS[role]} {role}
                  </span>
                  <div className="cg-role-bar-track">
                    <div
                      className="cg-role-bar-fill"
                      style={{
                        width: `${Math.min(count / 6, 1) * 100}%`,
                        background: ROLE_COLORS[role],
                      }}
                    />
                  </div>
                  <span className="cg-role-bar-count">{count}</span>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {stats.saturated?.length > 0 && (
              <div className="cg-ecosystem-warning">
                ⚠ Saturated: {stats.saturated.join(', ')}
              </div>
            )}
            {stats.empty?.length > 0 && (
              <div className="cg-ecosystem-empty">
                ○ Empty: {stats.empty.join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Seed card ────────────────────────────────────────────────────────────────
function SeedCard({ seed, index, onApprove, onReject, onEdit, dragListeners }) {
  const [editing, setEditing]   = useState(false);
  const [editSeed, setEditSeed] = useState(seed);
  const color = ROLE_COLORS[seed.role_type] || '#94a3b8';

  function handleSave() {
    onEdit(index, editSeed);
    setEditing(false);
  }

  return (
    <div
      className={`cg-seed-card cg-seed-${seed._status || 'pending'}`}
      style={{ '--role-color': color }}
    >
      {/* Status indicator */}
      <div className="cg-seed-status-bar" style={{ background: color }} />

      <div className="cg-seed-body">
        {editing ? (
          <div className="cg-seed-edit-form">
            <div className="cg-seed-edit-row">
              <label>Name</label>
              <input
                value={editSeed.name}
                onChange={(e) => setEditSeed((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Age</label>
              <input
                type="number"
                value={editSeed.age}
                onChange={(e) => setEditSeed((p) => ({ ...p, age: parseInt(e.target.value) }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Gender</label>
              <select
                value={editSeed.gender}
                onChange={(e) => setEditSeed((p) => ({ ...p, gender: e.target.value }))}
              >
                <option value="woman">Woman</option>
                <option value="man">Man</option>
                <option value="nonbinary">Nonbinary</option>
              </select>
            </div>
            <div className="cg-seed-edit-row">
              <label>Role</label>
              <select
                value={editSeed.role_type}
                onChange={(e) => setEditSeed((p) => ({ ...p, role_type: e.target.value }))}
              >
                {['pressure', 'mirror', 'support', 'shadow', 'special'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="cg-seed-edit-row">
              <label>Career</label>
              <input
                value={editSeed.career}
                onChange={(e) => setEditSeed((p) => ({ ...p, career: e.target.value }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Tension</label>
              <textarea
                value={editSeed.tension}
                onChange={(e) => setEditSeed((p) => ({ ...p, tension: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="cg-seed-edit-actions">
              <button className="cg-btn cg-btn-cancel" onClick={() => { setEditing(false); setEditSeed(seed); }}>
                Cancel
              </button>
              <button className="cg-btn cg-btn-save" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cg-seed-top">
              <div className="cg-seed-name-row">
                {dragListeners && (
                  <span className="cg-drag-handle" {...dragListeners} title="Drag to reorder">≡</span>
                )}
                <div className="cg-seed-name">{seed.name}</div>
              </div>
              <div className="cg-seed-meta">
                <span className="cg-seed-age">{seed.age}</span>
                <span className="cg-seed-gender">{seed.gender}</span>
                <span className="cg-seed-world">{WORLD_LABELS[seed.world]}</span>
              </div>
            </div>
            <div className="cg-seed-role" style={{ color }}>
              {ROLE_ICONS[seed.role_type]} {seed.role_type}
            </div>
            <div className="cg-seed-career">{seed.career}</div>
            <div className="cg-seed-tension">"{seed.tension}"</div>
            <div className="cg-seed-why">{seed.why_this_world}</div>
          </>
        )}
      </div>

      {!editing && seed._status === 'pending' && (
        <div className="cg-seed-actions">
          <button className="cg-btn cg-btn-edit" onClick={() => setEditing(true)}>Edit</button>
          <button className="cg-btn cg-btn-reject" onClick={() => onReject(index)}>Skip</button>
          <button className="cg-btn cg-btn-approve" style={{ background: color }} onClick={() => onApprove(index)}>
            Approve
          </button>
        </div>
      )}

      {!editing && seed._status === 'approved' && (
        <div className="cg-seed-approved-badge">✓ Approved</div>
      )}
      {!editing && seed._status === 'rejected' && (
        <div className="cg-seed-rejected-badge">Skipped</div>
      )}
    </div>
  );
}

// ─── Sortable seed card wrapper ──────────────────────────────────────────────
function SortableSeedCard({ id, seed, index, onApprove, onReject, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SeedCard seed={seed} index={index} onApprove={onApprove} onReject={onReject}
        onEdit={onEdit} dragListeners={listeners} />
    </div>
  );
}

// ─── Staging card (full profile review) ──────────────────────────────────────
function StagingCard({ result, checks, onCommit, onDiscard, onDelete, onRegenerate, onUpdateProfile, onRewriteField, registries }) {
  const [expanded, setExpanded]       = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [rewritingField, setRewritingField] = useState(null);

  const { seed, profile, status, error } = result;
  const color = ROLE_COLORS[seed?.role_type] || '#94a3b8';
  const identity = profile?.identity || {};
  const living   = profile?.living_state || {};
  const psych    = profile?.psychology || {};
  const aesthetic = profile?.aesthetic_dna || {};
  const career   = profile?.career || {};
  const rels     = profile?.relationships || {};
  const voice    = profile?.voice || {};
  const dilemma  = profile?.dilemma || {};
  const threads  = profile?.plot_threads || [];
  const demo     = profile?.demographics || {};

  if (status === 'failed') return (
    <div className="cg-staging-card cg-staging-failed">
      <div className="cg-staging-name" style={{ padding: '18px 22px 0' }}>{seed?.name}</div>
      <div className="cg-staging-error">Generation failed: {error}</div>
      <div className="cg-staging-commit">
        <button className="cg-btn cg-btn-discard" onClick={() => onDiscard(result)}>Remove</button>
        <button className="cg-btn cg-btn-generate" onClick={() => onRegenerate(result)}>↻ Retry</button>
      </div>
    </div>
  );

  return (
    <div className="cg-staging-card" style={{ '--role-color': color }}>
      <div className="cg-staging-bar" style={{ background: color }} />

      {/* Header */}
      <div className="cg-staging-header" onClick={() => setExpanded((p) => !p)}>
        <div className="cg-staging-header-left">
          <div className="cg-staging-name-row">
            <div className="cg-staging-name">{seed?.name}</div>
            {profile && <CompletionRing percent={computeCompleteness(profile)} />}
          </div>
          <div className="cg-staging-meta">
            <span>{identity.age || seed?.age}</span>
            <span>{identity.gender || seed?.gender}</span>
            <span style={{ color }}>{ROLE_ICONS[seed?.role_type]} {seed?.role_type}</span>
            <span>{WORLD_LABELS[seed?.world]}</span>
            <span className={`cg-momentum cg-momentum-${living.momentum}`}>
              {living.momentum}
            </span>
          </div>
          <div className="cg-staging-tension">"{seed?.tension}"</div>
        </div>
        <div className="cg-staging-header-right">
          {expanded && !result._committed && (
            <button className="cg-btn cg-btn-edit" onClick={(e) => { e.stopPropagation(); setEditMode(m => !m); }}>
              {editMode ? '✓ Done' : '✎ Edit'}
            </button>
          )}
          <div className="cg-staging-expand">{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Checks */}
      {checks && (
        <div className="cg-staging-checks">
          {checks.errors?.map((e, i) => (
            <div key={i} className="cg-check cg-check-error">✗ {e.message}</div>
          ))}
          {checks.warnings?.map((w, i) => (
            <div key={i} className="cg-check cg-check-warning" title={w.note || ''}>
              ⚠ {w.message}
              {w.note && <span className="cg-dim" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{w.note}</span>}
            </div>
          ))}
          {checks.collision_character && (
            <div className="cg-check cg-check-collision">
              ⊕ Dilemma collides with {checks.collision_character.name} — high story potential
            </div>
          )}
          {!checks.errors?.length && !checks.warnings?.length && (
            <div className="cg-check cg-check-ok">✓ No conflicts detected</div>
          )}
        </div>
      )}

      {/* Edit panel (inline profile editing + AI rewrite) */}
      {expanded && editMode && profile && !result._committed && (
        <div className="cg-edit-panel">
          <div className="cg-edit-panel-title">
            Edit Key Fields <span className="cg-dim">Click ↻ AI to regenerate any field</span>
          </div>
          {[
            { label: 'Core Wound', key: 'psychology.core_wound', val: psych.core_wound },
            { label: 'Desire Line', key: 'psychology.desire_line', val: psych.desire_line },
            { label: 'Fear Line', key: 'psychology.fear_line', val: psych.fear_line },
            { label: 'Active Dilemma', key: 'dilemma.active', val: dilemma.active },
            { label: 'How They Speak', key: 'voice.how_they_speak', val: voice.how_they_speak },
            { label: 'Visual Signature', key: 'aesthetic_dna.visual_signature', val: aesthetic.visual_signature },
            { label: 'Career', key: 'career.job_title', val: career.job_title },
            { label: 'Signature Sentence', key: 'voice.signature_sentence_structure', val: voice.signature_sentence_structure },
          ].map(f => (
            <div key={f.key} className="cg-edit-field">
              <div className="cg-edit-field-header">
                <label>{f.label}</label>
                <button className="cg-btn-field-rewrite"
                  disabled={rewritingField === f.key}
                  onClick={async () => {
                    setRewritingField(f.key);
                    const newVal = await onRewriteField(result, f.key, editedProfile[f.key] ?? f.val);
                    if (newVal) setEditedProfile(p => ({ ...p, [f.key]: newVal }));
                    setRewritingField(null);
                  }}>
                  {rewritingField === f.key ? '…' : '↻ AI'}
                </button>
              </div>
              <textarea className="cg-edit-textarea"
                value={editedProfile[f.key] ?? f.val ?? ''}
                onChange={e => setEditedProfile(p => ({ ...p, [f.key]: e.target.value }))}
                rows={2} />
            </div>
          ))}
          <div className="cg-edit-panel-actions">
            <button className="cg-btn cg-btn-cancel" onClick={() => { setEditMode(false); setEditedProfile({}); }}>Cancel</button>
            <button className="cg-btn cg-btn-save" onClick={() => {
              onUpdateProfile(result, editedProfile);
              setEditMode(false);
              setEditedProfile({});
            }}>Save Changes</button>
          </div>
        </div>
      )}

      {/* Expanded profile */}
      {expanded && profile && (
        <div className="cg-staging-profile">

          {/* Living state */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Living State</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Knows</div>
                <div className="cg-profile-value">{living.knows}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Wants</div>
                <div className="cg-profile-value">{living.wants}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Unresolved</div>
                <div className="cg-profile-value">{living.unresolved}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Location</div>
                <div className="cg-profile-value">{living.current_location}</div>
              </div>
            </div>
          </div>

          {/* Demographics */}
          {Object.keys(demo).length > 0 && (
          <div className="cg-profile-section" style={{ borderLeft: '3px solid #7ab3d4' }}>
            <div className="cg-profile-section-title">Demographics</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Age</div>
                <div className="cg-profile-value">{demo.age || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">City</div>
                <div className="cg-profile-value cg-enum-badge">{(demo.current_city || '—').replace(/_/g, ' ')}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Class Origin</div>
                <div className="cg-profile-value cg-enum-badge">{(demo.class_origin || '—').replace(/_/g, ' ')}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Current Class</div>
                <div className="cg-profile-value">
                  {(demo.current_class || '—').replace(/_/g, ' ')}
                  {demo.class_mobility_direction && demo.class_mobility_direction !== 'stable' && (
                    <span style={{ marginLeft: 6, color: demo.class_mobility_direction === 'ascending' ? '#4caf50' : demo.class_mobility_direction === 'descending' ? '#f44336' : '#ff9800' }}>
                      {demo.class_mobility_direction === 'ascending' ? '↑' : demo.class_mobility_direction === 'descending' ? '↓' : '~'}
                      {' '}{demo.class_mobility_direction}
                    </span>
                  )}
                </div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Family</div>
                <div className="cg-profile-value cg-enum-badge">{(demo.family_structure || '—').replace(/_/g, ' ')}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Siblings</div>
                <div className="cg-profile-value">{demo.sibling_position ? `${demo.sibling_position.replace(/_/g, ' ')}${demo.sibling_count ? ` of ${demo.sibling_count}` : ''}` : '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Cultural Background</div>
                <div className="cg-profile-value">{demo.cultural_background || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Physical Presence</div>
                <div className="cg-profile-value">{demo.physical_presence || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Voice Signature</div>
                <div className="cg-profile-value">{demo.voice_signature_text || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Career History</div>
                <div className="cg-profile-value">{demo.career_history || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Years Posting</div>
                <div className="cg-profile-value">{demo.years_posting ?? '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Follower Tier</div>
                <div className="cg-profile-value cg-enum-badge">{demo.follower_tier || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Relationship</div>
                <div className="cg-profile-value">{(demo.relationship_status || '—').replace(/_/g, ' ')}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Children</div>
                <div className="cg-profile-value">{demo.has_children ? `Yes${demo.children_ages ? ` (${demo.children_ages})` : ''}` : demo.has_children === false ? 'No' : '—'}</div>
              </div>
            </div>
          </div>
          )}

          {/* Psychology */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Psychology</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Core Wound</div>
                <div className="cg-profile-value">{psych.core_wound}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Desire Line</div>
                <div className="cg-profile-value">{psych.desire_line}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Fear Line</div>
                <div className="cg-profile-value">{psych.fear_line}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Coping Mechanism</div>
                <div className="cg-profile-value">{psych.coping_mechanism}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Self-Deception</div>
                <div className="cg-profile-value">{psych.self_deception}</div>
              </div>
            </div>
          </div>

          {/* Dilemmas */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Dilemmas</div>
            <div className="cg-dilemma-active">
              <div className="cg-profile-label">Active</div>
              <div className="cg-dilemma-text" style={{ color }}>{dilemma.active}</div>
            </div>
            <div className="cg-dilemma-latent">
              <div className="cg-profile-label">Latent</div>
              <div className="cg-dilemma-text cg-dim">{dilemma.latent_1}</div>
              <div className="cg-dilemma-text cg-dim">{dilemma.latent_2}</div>
            </div>
          </div>

          {/* Aesthetic DNA */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Aesthetic DNA</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Visual Signature</div>
                <div className="cg-profile-value">{aesthetic.visual_signature}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Style</div>
                <div className="cg-profile-value">{aesthetic.style}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Signature Object</div>
                <div className="cg-profile-value">{aesthetic.signature_object}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Room Presence</div>
                <div className="cg-profile-value">{aesthetic.room_presence}</div>
              </div>
            </div>
          </div>

          {/* Career */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Career</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Job</div>
                <div className="cg-profile-value">{career.job_title} · {career.industry}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Career Wound</div>
                <div className="cg-profile-value">{career.career_wound}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Job Antagonist</div>
                <div className="cg-profile-value">{career.job_antagonist}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Success To Them</div>
                <div className="cg-profile-value">{career.success_to_them}</div>
              </div>
            </div>
          </div>

          {/* Relationships */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Relationships</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Status</div>
                <div className="cg-profile-value">{rels.romantic_status} — {rels.romantic_detail}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Wants From Love</div>
                <div className="cg-profile-value">{rels.what_they_want_from_love}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">How They Fight</div>
                <div className="cg-profile-value">{rels.how_they_fight}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Last Ending Taught</div>
                <div className="cg-profile-value">{rels.last_ending_taught_them}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Calls At 2am</div>
                <div className="cg-profile-value">{rels.who_they_call_at_2am}</div>
              </div>
            </div>
            {/* Proposed connections */}
            {rels.proposed_connections?.length > 0 && (
              <div className="cg-proposed-connections">
                <div className="cg-profile-label">Proposed Connections</div>
                {rels.proposed_connections.map((conn, i) => (
                  <div key={i} className="cg-connection">
                    <span className="cg-connection-target">{conn.to_character}</span>
                    <span className="cg-connection-dir">{conn.direction === 'two_way' ? '↔' : '→'}</span>
                    <span className="cg-connection-type">{conn.relationship_type}</span>
                    <span className="cg-connection-note">{conn.from_knows}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Voice</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">How They Speak</div>
                <div className="cg-profile-value">{voice.how_they_speak}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Never Says Directly</div>
                <div className="cg-profile-value">{voice.what_they_never_say_directly}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Their Tell</div>
                <div className="cg-profile-value">{voice.their_tell}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Signature Sentence</div>
                <div className="cg-profile-value cg-italic">"{voice.signature_sentence_structure}"</div>
              </div>
            </div>
          </div>

          {/* Plot threads */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Plot Threads</div>
            {threads.map((thread, i) => (
              <div key={i} className="cg-thread">
                <div className="cg-thread-text">{thread.thread}</div>
                <div className="cg-thread-trigger">{thread.activation_condition}</div>
              </div>
            ))}
          </div>

          {/* ── Section 9: Physical Self & Money ── */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Physical Self & Money</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Body Relationship</div>
                <div className="cg-profile-value">{profile?.depth?.body_relationship || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Body History</div>
                <div className="cg-profile-value">{profile?.depth?.body_history || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Body as Currency</div>
                <div className="cg-profile-value">{profile?.depth?.body_currency || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Control Pattern</div>
                <div className="cg-profile-value">{profile?.depth?.body_control_pattern || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Money Pattern</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.money_behavior_pattern || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Money Note</div>
                <div className="cg-profile-value">{profile?.depth?.money_behavior_note || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── Section 10: Time, Change & Capacity ── */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Time, Change & Capacity</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Time Orientation</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.time_orientation || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Time Note</div>
                <div className="cg-profile-value">{profile?.depth?.time_orientation_note || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Change Capacity</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.change_capacity || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Change Conditions</div>
                <div className="cg-profile-value">{profile?.depth?.change_conditions || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Change Blocker</div>
                <div className="cg-profile-value">{profile?.depth?.change_blocker || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── Section 11: Meaning, Cosmology & Circumstance ── */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Meaning, Cosmology & Circumstance</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Unchosen Advantages</div>
                <div className="cg-profile-value">{profile?.depth?.circumstance_advantages || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Unchosen Obstacles</div>
                <div className="cg-profile-value">{profile?.depth?.circumstance_disadvantages || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Luck Belief</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.luck_belief || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Luck Belief vs Stated</div>
                <div className="cg-profile-value">{profile?.depth?.luck_belief_vs_stated || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Operative Cosmology</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.operative_cosmology || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Cosmology vs Stated Religion</div>
                <div className="cg-profile-value">{profile?.depth?.cosmology_vs_stated_religion || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Self-Narrative</div>
                <div className="cg-profile-value">{profile?.depth?.self_narrative || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Actual Narrative</div>
                <div className="cg-profile-value cg-author-knowledge">{profile?.depth?.actual_narrative || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Narrative Gap Type</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.narrative_gap_type || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── Section 12: Author Knowledge — Blind Spot & Foreclosure ── */}
          <div className="cg-profile-section cg-section-author-knowledge">
            <div className="cg-profile-section-title">
              Author Knowledge — Never Shown to Character
            </div>
            <div className="cg-author-knowledge-banner">
              These fields are visible to the author and the evaluation engine only. They are never injected into character voice generation.
            </div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Blind Spot</div>
                <div className="cg-profile-value cg-author-knowledge">{profile?.depth?.blind_spot || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Blind Spot Category</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.blind_spot_category || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Visible To</div>
                <div className="cg-profile-value">{(profile?.depth?.blind_spot_visible_to || []).join(', ') || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Foreclosed Category</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.foreclosed_category || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Foreclosure Origin</div>
                <div className="cg-profile-value cg-author-knowledge">{profile?.depth?.foreclosure_origin || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Foreclosure vs Stated Want</div>
                <div className="cg-profile-value cg-author-knowledge">{profile?.depth?.foreclosure_vs_stated_want || '—'}</div>
              </div>
            </div>
          </div>

          {/* ── Section 13: Aliveness — Experience of Joy ── */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Aliveness — The Experience of Joy</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Joy Source</div>
                <div className="cg-profile-value">{profile?.depth?.joy_source || '—'}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Joy Accessibility</div>
                <div className="cg-profile-value cg-enum-badge">{profile?.depth?.joy_accessibility || '—'}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Joy vs Ambition</div>
                <div className="cg-profile-value">{profile?.depth?.joy_vs_ambition || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commit actions */}
      {!result._committed && (
        <div className="cg-staging-commit">
          <button className="cg-btn cg-btn-discard" onClick={() => onDiscard(result)}>Discard</button>
          {onRegenerate && (
            <button className="cg-btn cg-btn-edit" onClick={() => onRegenerate(result)}>↻ Regenerate</button>
          )}
        </div>
      )}

      {result._committed && (
        <div className="cg-staging-committed">
          <span>✓ Added to Registry</span>
          <button
            className="cg-btn cg-btn-delete-committed"
            disabled={deleting}
            onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm(`Delete ${seed?.name} from registry? This cannot be undone.`)) return;
              setDeleting(true);
              await onDelete(result);
              setDeleting(false);
            }}
          >
            {deleting ? '…' : '✕ Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main CharacterGenerator ──────────────────────────────────────────────────
export default function CharacterGenerator() {
  const navigate = useNavigate();
  const location = useLocation();

  // Ecosystem
  const [ecosystem, setEcosystem]         = useState(null);
  const [ecoLoading, setEcoLoading]       = useState(true);

  // Restore saved session (if any)
  const saved = useRef(loadSession());

  // Seed proposal
  const [worldTarget, setWorldTarget]     = useState(
    saved.current?.worldTarget || 'book1'
  );
  const [seeds, setSeeds]                 = useState(saved.current?.seeds || []);
  const [seedsLoading, setSeedsLoading]   = useState(false);

  // Batch generation
  const [batch, setBatch]                 = useState(saved.current?.batch || []);
  const [batchLoading, setBatchLoading]   = useState(false);

  // Staging
  const [stagingChecks, setStagingChecks] = useState(saved.current?.stagingChecks || {});

  // Registries — shared hook
  const { registries } = useRegistries();

  // Phase: 'seeds' | 'staging' | 'history'
  const [phase, setPhase]                 = useState(saved.current?.phase || 'seeds');
  const [approvalFlash, setApprovalFlash] = useState(false);

  // Seed history
  const [history, setHistory]             = useState([]);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);

  // ── New feature state ───────────────────────────────────────────────────────
  const [seedCount, setSeedCount]         = useState(10);
  const [stagingFilter, setStagingFilter] = useState({ text: '', role: '', status: '' });
  const [trash, setTrash]                 = useState([]);
  const [showTrash, setShowTrash]         = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Auto-save to localStorage on meaningful state changes ───────────────────
  useEffect(() => {
    // Only save when there's actual work to preserve
    if (seeds.length > 0 || batch.length > 0) {
      saveSession({ worldTarget, seeds, batch, stagingChecks, phase });
    }
  }, [worldTarget, seeds, batch, stagingChecks, phase]);

  // ── Warn before leaving with unsaved work ───────────────────────────────────
  const hasUnsavedWork = batch.some((r) => r.status === 'generated' && !r._committed);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  // Guard back-button navigation (works with BrowserRouter)
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onPop = () => {
      if (!window.confirm('You have uncommitted characters. Your work is auto-saved — leave anyway?')) {
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hasUnsavedWork]);

  // Clear saved session when everything is committed
  useEffect(() => {
    if (batch.length > 0 && batch.every((r) => r._committed)) {
      clearSession();
    }
  }, [batch]);

  // Load ecosystem and history on mount (registries loaded by useRegistries hook)
  useEffect(() => {
    loadEcosystem();
    setHistory(loadHistory());
  }, []);

  // ── Spark on-ramp: auto-generate from CharacterCreationDrawer seed ────────
  const sparkHandled = useRef(false);
  useEffect(() => {
    if (ecoLoading || sparkHandled.current) return;
    const sparkSeed = location.state?.sparkSeed;
    if (!sparkSeed) return;
    sparkHandled.current = true;

    // Clear route state so a refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    // Pre-approve the seed and fire generate-batch immediately
    const approved = { ...sparkSeed, _status: 'approved' };
    setSeeds([approved]);
    handleGenerateBatch([approved]);
  }, [ecoLoading]);

  async function loadEcosystem() {
    setEcoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/character-generator/ecosystem`);
      if (res.ok) setEcosystem(await res.json());
    } catch { /* silent */ }
    finally { setEcoLoading(false); }
  }

  // ── Propose seeds ─────────────────────────────────────────────────────────
  async function handleProposeSeeds() {
    setSeedsLoading(true);
    setSeeds([]);
    setBatch([]);
    setPhase('seeds');
    clearSession();
    try {
      const existingNames = [
        ...(ecosystem?.book1?.characters || []),
        ...(ecosystem?.lalaverse?.characters || []),
      ].map((c) => c.name);

      // "both" mode: fetch seeds for each world in parallel, merge
      const worldsToFetch = worldTarget === 'both' ? ['book1', 'lalaverse'] : [worldTarget];

      const allSeeds = [];
      await Promise.all(worldsToFetch.map(async (w) => {
        const res = await fetch(`${API_BASE}/character-generator/propose-seeds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            world: w,
            count: worldTarget === 'both' ? Math.ceil(seedCount / 2) : seedCount,
            existing_names: existingNames,
            ecosystem_stats: ecosystem?.[w]?.stats || ecosystem,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          allSeeds.push(...(data.seeds || []));
        }
      }));

      setSeeds(allSeeds.map((s) => ({ ...s, _status: 'pending' })));
    } catch (e) {
      console.error('propose seeds error:', e);
    } finally {
      setSeedsLoading(false);
    }
  }

  // ── Seed actions ──────────────────────────────────────────────────────────
  function handleApproveSeed(index) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...s, _status: 'approved' } : s));
  }
  function handleRejectSeed(index) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...s, _status: 'rejected' } : s));
  }
  function handleEditSeed(index, updated) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...updated, _status: 'approved' } : s));
  }
  function handleApproveAll() {
    setSeeds((prev) => prev.map((s) => ({ ...s, _status: 'approved' })));
    // Flash animation on seed cards
    setApprovalFlash(true);
    setTimeout(() => setApprovalFlash(false), 800);
    // Auto-scroll to the generate banner
    setTimeout(() => {
      document.querySelector('.cg-approval-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  // One-click: Approve All → immediately Generate
  function handleApproveAllAndGenerate() {
    const allApproved = seeds.map((s) => ({ ...s, _status: 'approved' }));
    setSeeds(allApproved);
    // Pass approved seeds directly — don’t wait for React state
    handleGenerateBatch(allApproved.filter((s) => s._status === 'approved'));
  }

  // ── Generate batch ──────────────────────────────────────────────────────────────────
  async function handleGenerateBatch(overrideSeeds) {
    const approvedSeeds = overrideSeeds || seeds.filter((s) => s._status === 'approved');
    if (!approvedSeeds.length) return alert('Approve at least one seed first.');

    setBatchLoading(true);
    setBatch([]);
    setPhase('staging');

    try {
      const existingCharacters = [
        ...(ecosystem?.book1?.characters || []),
        ...(ecosystem?.lalaverse?.characters || []),
      ];

      const res = await fetch(`${API_BASE}/character-generator/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: approvedSeeds, existingCharacters }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatch(data.batch || []);

        // Run staging checks for all generated characters
        const checks = {};
        await Promise.all((data.batch || []).map(async (result, i) => {
          if (result.status !== 'generated') return;
          try {
            const checkRes = await fetch(`${API_BASE}/character-generator/check-staging`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                character: { ...result.profile, seed: result.seed },
                existingCharacters,
                ecosystemStats: ecosystem,
              }),
            });
            if (checkRes.ok) checks[i] = await checkRes.json();
          } catch { /* silent */ }
        }));

        setStagingChecks(checks);
      }
    } catch (e) {
      console.error('generate batch error:', e);
    } finally {
      setBatchLoading(false);
    }
  }

  // ── Commit to registry ────────────────────────────────────────────────────
  async function handleCommit(result, registryId) {
    try {
      const res = await fetch(`${API_BASE}/character-generator/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: result.profile,
          seed: result.seed,
          registryId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatch((prev) =>
          prev.map((r) => r === result ? { ...r, _committed: true, _charId: data.character_id } : r)
        );
        loadEcosystem(); // Refresh ecosystem after commit
      } else {
        const err = await res.json();
        alert('Commit failed: ' + err.error);
      }
    } catch (e) {
      alert('Commit failed: ' + e.message);
    }
  }

  function handleDiscard(result) {
    setBatch((prev) => prev.filter((r) => r !== result));
    setTrash(prev => [...prev, result]);
  }

  function handleRestoreFromTrash(result) {
    setTrash(prev => prev.filter(r => r !== result));
    setBatch(prev => [...prev, result]);
  }

  // ── Regenerate a single character (retry failed or re-run generated) ────────
  async function handleRegenerate(result) {
    const seed = result.seed;
    if (!seed) return;
    setBatch(prev => prev.map(r => r === result ? { ...r, status: 'regenerating', error: null } : r));
    try {
      const existingCharacters = [
        ...(ecosystem?.book1?.characters || []),
        ...(ecosystem?.lalaverse?.characters || []),
      ];
      const res = await fetch(`${API_BASE}/character-generator/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: [seed], existingCharacters }),
      });
      if (res.ok) {
        const data = await res.json();
        const newResult = data.batch?.[0];
        if (newResult) {
          setBatch(prev => prev.map(r =>
            r.seed?.name === seed.name && (r.status === 'regenerating' || r === result)
              ? newResult : r
          ));
        }
      }
    } catch (e) {
      console.error('Regenerate failed:', e);
      setBatch(prev => prev.map(r =>
        r.seed?.name === seed.name && r.status === 'regenerating'
          ? { ...r, status: 'failed', error: e.message } : r
      ));
    }
  }

  // ── Update profile fields from inline editing ──────────────────────────────
  function handleUpdateProfile(result, editedFields) {
    setBatch(prev => prev.map(r => {
      if (r !== result) return r;
      const updated = { ...r, profile: JSON.parse(JSON.stringify(r.profile)) };
      Object.entries(editedFields).forEach(([path, value]) => {
        const parts = path.split('.');
        let obj = updated.profile;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      });
      return updated;
    }));
  }

  // ── AI rewrite a single profile field ──────────────────────────────────────
  async function handleRewriteField(result, fieldPath, currentValue) {
    try {
      const res = await fetch(`${API_BASE}/character-generator/rewrite-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldPath,
          currentValue,
          characterContext: {
            name: result.seed?.name,
            role: result.seed?.role_type,
            tension: result.seed?.tension,
            world: result.seed?.world,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.newValue;
      }
    } catch (e) {
      console.error('Rewrite failed:', e);
    }
    return null;
  }

  // ── Drag-and-drop reorder seeds ────────────────────────────────────────────
  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSeeds(prev => {
        const oldIndex = prev.findIndex((_, i) => `seed-${i}` === active.id);
        const newIndex = prev.findIndex((_, i) => `seed-${i}` === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  // ── Delete committed character from registry ──────────────────────────────
  async function handleDeleteCommitted(result) {
    const charId = result._charId;
    if (!charId) {
      // No ID tracked — just remove from staging
      setBatch((prev) => prev.filter((r) => r !== result));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/character-registry/characters/${charId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBatch((prev) => prev.filter((r) => r !== result));
        loadEcosystem();
      } else {
        const err = await res.json();
        alert('Delete failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  // ── Commit ALL staged characters to a registry at once ──────────────────────
  const [commitAllLoading, setCommitAllLoading] = useState(false);
  const commitLockRef = useRef(false); // Prevent double-click race condition

  // Auto-match registry to the world the user already selected
  // Normalize: strip hyphens/spaces for fuzzy match (book1 ↔ book-1, lalaverse ↔ lala-verse)
  const norm = (s) => (s || '').toLowerCase().replace(/[-_\s]/g, '');
  const matchedRegistry = registries.find((r) => norm(r.book_tag) === norm(worldTarget))
    || registries.find((r) => norm(r.title).includes(norm(worldTarget)))
    || registries[0];

  async function handleCommitAll() {
    // Guard against double-click (React setState is async, so use a ref)
    if (commitLockRef.current) return;
    commitLockRef.current = true;

    const regId = matchedRegistry?.id;
    if (!regId) { commitLockRef.current = false; return alert('No registry found for this world.'); }

    const pending = batch.filter((r) => r.status === 'generated' && !r._committed);
    if (!pending.length) { commitLockRef.current = false; return; }

    setCommitAllLoading(true);
    let ok = 0;
    for (const result of pending) {
      try {
        const res = await fetch(`${API_BASE}/character-generator/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: result.profile,
            seed: result.seed,
            registryId: regId,
          }),
        });
        if (res.ok) {
          setBatch((prev) =>
            prev.map((r) => r === result ? { ...r, _committed: true } : r)
          );
          ok++;
        }
      } catch { /* continue */ }
    }
    loadEcosystem();
    setCommitAllLoading(false);
    commitLockRef.current = false; // Release lock

    // Save committed batch to history
    if (ok > 0) {
      const histEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        world: worldTarget,
        registry: matchedRegistry?.title || matchedRegistry?.name || worldTarget,
        committedCount: ok,
        totalCount: pending.length,
        characters: pending.filter((_, i) => i < ok).map(r => ({
          name: r.profile?.identity?.display_name || r.seed?.name || 'Unknown',
          role: r.profile?.identity?.role_type || r.seed?.role || '—',
          career: r.profile?.career?.title || r.seed?.career || '—',
          age: r.profile?.identity?.age || r.seed?.age || '—',
          gender: r.profile?.identity?.gender || r.seed?.gender || '—',
          tension: r.seed?.tension || '—',
          psychology: r.profile?.psychology?.core_desire || '—',
          seed: r.seed,
        })),
      };
      saveToHistory(histEntry);
      setHistory(loadHistory());
    }

    if (ok === pending.length) {
      const goTo = window.confirm(`✓ All ${ok} characters added to registry!\n\nOpen registry to view them?`);
      if (goTo) navigate(`/character-registry`);
    } else {
      alert(`${ok}/${pending.length} characters committed. Some failed.`);
    }
  }

  const approvedCount = seeds.filter((s) => s._status === 'approved').length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="cg-page">

      {/* Navigation guard handled via popstate + beforeunload; data auto-saved to localStorage */}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cg-header">
        <button className="cg-btn-back" onClick={() => navigate('/character-registry')}>
          ← Registry
        </button>
        <div className="cg-header-title">Character Generator</div>
        <div className="cg-step-indicator">
          <span className={`cg-step${phase === 'seeds' && seeds.length === 0 ? ' cg-step-active' : (seeds.length > 0 || phase === 'staging') ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">1</span> Propose
          </span>
          <span className="cg-step-arrow">→</span>
          <span className={`cg-step${phase === 'seeds' && seeds.length > 0 ? ' cg-step-active' : phase === 'staging' ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">2</span> Approve & Generate
          </span>
          <span className="cg-step-arrow">→</span>
          <span className={`cg-step${phase === 'staging' && batch.some(r => !r._committed) ? ' cg-step-active' : batch.every(r => r._committed) && batch.length > 0 ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">3</span> Commit to Registry
          </span>
        </div>

        <div className="cg-header-controls">
          <button
            className={`cg-btn cg-btn-history${phase === 'history' ? ' cg-btn-history-active' : ''}`}
            onClick={() => {
              if (phase === 'history') {
                setPhase('seeds');
              } else {
                setHistory(loadHistory());
                setPhase('history');
              }
            }}
            title="View previous generations"
          >
            ☰ History {history.length > 0 && <span className="cg-history-badge">{history.length}</span>}
          </button>
          <select
            className="cg-world-select"
            value={worldTarget}
            onChange={(e) => setWorldTarget(e.target.value)}
          >
            <option value="book1">Book 1 World</option>
            <option value="lalaverse">LalaVerse</option>
            <option value="both">Both Worlds</option>
          </select>
          <select
            className="cg-seed-count-select"
            value={seedCount}
            onChange={(e) => setSeedCount(+e.target.value)}
          >
            <option value={5}>5 seeds</option>
            <option value={10}>10 seeds</option>
            <option value={15}>15 seeds</option>
            <option value={20}>20 seeds</option>
          </select>
          <button
            className="cg-btn cg-btn-propose"
            onClick={handleProposeSeeds}
            disabled={seedsLoading}
          >
            {seedsLoading ? '…' : `Propose ${seedCount} Seeds`}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="cg-body">

        {/* Left: ecosystem */}
        <div className="cg-left">
          <div className="cg-panel-title">World Ecosystem</div>
          <WorldBuilderPanel
            worldTarget={worldTarget === 'both' ? 'lalaverse' : worldTarget}
            ecosystem={ecosystem}
            onEcosystemGenerated={loadEcosystem}
          />
          <EcosystemPanel ecosystem={ecosystem} loading={ecoLoading} worldTarget={worldTarget} />
        </div>

        {/* Right: seeds or staging */}
        <div className="cg-right">

          {/* Seeds phase */}
          {phase === 'seeds' && (
            <>
              <div className="cg-phase-header">
                <div className="cg-panel-title">
                  Proposed Seeds
                  {seeds.length > 0 && (
                    <span className="cg-seed-count">
                      {approvedCount} of {seeds.length} approved
                    </span>
                  )}
                </div>
                {seeds.length > 0 && (
                  <div className="cg-phase-actions">
                    <button className="cg-btn cg-btn-approve-all" onClick={handleApproveAllAndGenerate}
                      disabled={batchLoading}
                    >
                      {batchLoading ? 'Generating…' : 'Approve All & Generate'}
                    </button>
                    {approvedCount > 0 && approvedCount < seeds.length && (
                      <button
                        className="cg-btn cg-btn-generate"
                        onClick={handleGenerateBatch}
                        disabled={approvedCount === 0 || batchLoading}
                      >
                        {batchLoading ? 'Generating…' : `Generate ${approvedCount}`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {seedsLoading && (
                <div className="cg-loading-state">
                  <div className="cg-spinner-large" />
                  <div>Proposing seeds for {WORLD_LABELS[worldTarget] || worldTarget}…</div>
                </div>
              )}

              {!seedsLoading && seeds.length === 0 && (
                <div className="cg-empty-state">
                  <div className="cg-empty-icon">◎</div>
                  <div>Select a world and click "Propose Seeds" to begin.</div>
                </div>
              )}

              {/* Next-step banner when seeds approved but not yet generated */}
              {approvedCount > 0 && !batchLoading && (
                <div className="cg-approval-banner">
                  <span>✓ {approvedCount} seed{approvedCount > 1 ? 's' : ''} approved — ready to generate full profiles</span>
                  <button
                    className="cg-btn cg-btn-generate"
                    onClick={handleGenerateBatch}
                  >
                    Generate {approvedCount} Character{approvedCount > 1 ? 's' : ''}
                  </button>
                </div>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={seeds.map((_, i) => `seed-${i}`)} strategy={rectSortingStrategy}>
                  <div className={`cg-seeds-grid${approvalFlash ? ' cg-flash' : ''}`}>
                    {seeds.map((seed, i) => (
                      <SortableSeedCard
                        key={`seed-${i}`}
                        id={`seed-${i}`}
                        seed={seed}
                        index={i}
                        onApprove={handleApproveSeed}
                        onReject={handleRejectSeed}
                        onEdit={handleEditSeed}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}

          {/* Staging phase */}
          {phase === 'staging' && (
            <>
              <div className="cg-phase-header">
                <div className="cg-panel-title">
                  {seeds.some(s => s._from_spark) ? 'Spark → Staging' : 'Staging Area'}
                  <span className="cg-seed-count">
                    {batch.filter((r) => r._committed).length} committed · {batch.filter((r) => !r._committed).length} pending
                  </span>
                </div>
                <button
                  className="cg-btn cg-btn-propose"
                  onClick={() => setPhase('seeds')}
                >
                  ← Back to Seeds
                </button>
              </div>

              {batchLoading && (
                <>
                  <div className="cg-loading-state">
                    <div className="cg-spinner-large" />
                    <div>Building {approvedCount} characters one by one…</div>
                    <div className="cg-loading-sub">Each character takes ~30 seconds. Please wait.</div>
                  </div>
                  <div className="cg-staging-list">
                    {Array.from({ length: approvedCount }, (_, i) => (
                      <SkeletonCard key={i} index={i} />
                    ))}
                  </div>
                </>
              )}

              {/* Guidance + Batch commit banner */}
              {!batchLoading && batch.filter((r) => r.status === 'generated' && !r._committed).length > 0 && (
                <div className="cg-staging-guidance">
                  <div className="cg-guidance-steps">
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">▼</span>
                      <span>Click any character to <strong>expand their full profile</strong> — psychology, voice, dilemmas, relationships</span>
                    </div>
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">✗</span>
                      <span>Click <strong>Discard</strong> to remove characters you don't want</span>
                    </div>
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">↓</span>
                      <span>When ready, click the button below to <strong>add them all at once</strong></span>
                    </div>
                  </div>

                  <div className="cg-commit-all-banner">
                    <div className="cg-commit-all-ready">
                      <strong>{batch.filter((r) => r.status === 'generated' && !r._committed).length}</strong> characters ready
                      {matchedRegistry && <span className="cg-commit-target"> → {matchedRegistry.title || matchedRegistry.name}</span>}
                    </div>
                    <button
                      className="cg-btn cg-btn-commit-all"
                      onClick={handleCommitAll}
                      disabled={commitAllLoading}
                    >
                      {commitAllLoading ? 'Committing…' : `Add All to Registry`}
                    </button>
                  </div>
                </div>
              )}

              {/* All committed */}
              {!batchLoading && batch.length > 0 && batch.every((r) => r._committed) && (
                <div className="cg-all-committed-banner">
                  <div className="cg-all-committed-icon">✓</div>
                  <div className="cg-all-committed-text">All characters added to registry!</div>
                  <div className="cg-all-committed-actions">
                    <button className="cg-btn cg-btn-propose" onClick={() => { setPhase('seeds'); setSeeds([]); setBatch([]); }}>
                      Generate More
                    </button>
                    <button className="cg-btn cg-btn-generate" onClick={() => navigate('/character-registry')}>
                      View Registry →
                    </button>
                  </div>
                </div>
              )}

              <div className="cg-staging-list">
                {(() => {
                  const filteredBatch = batch.filter(r => {
                    if (stagingFilter.text && !r.seed?.name?.toLowerCase().includes(stagingFilter.text.toLowerCase())) return false;
                    if (stagingFilter.role && r.seed?.role_type !== stagingFilter.role) return false;
                    if (stagingFilter.status === 'pending' && (r._committed || r.status === 'failed')) return false;
                    if (stagingFilter.status === 'committed' && !r._committed) return false;
                    if (stagingFilter.status === 'failed' && r.status !== 'failed') return false;
                    return true;
                  });

                  return (
                    <>
                      {/* Filter bar */}
                      {batch.length > 2 && (
                        <div className="cg-staging-filter-bar">
                          <input
                            className="cg-staging-search"
                            placeholder="Search by name…"
                            value={stagingFilter.text}
                            onChange={e => setStagingFilter(f => ({ ...f, text: e.target.value }))}
                          />
                          <select
                            className="cg-staging-filter-select"
                            value={stagingFilter.role}
                            onChange={e => setStagingFilter(f => ({ ...f, role: e.target.value }))}
                          >
                            <option value="">All Roles</option>
                            {['pressure', 'mirror', 'support', 'shadow', 'special'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <select
                            className="cg-staging-filter-select"
                            value={stagingFilter.status}
                            onChange={e => setStagingFilter(f => ({ ...f, status: e.target.value }))}
                          >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="committed">Committed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </div>
                      )}

                      {/* Staging tools bar */}
                      {batch.filter(r => r.status === 'generated').length > 0 && (
                        <div className="cg-staging-tools-bar">
                          <button className="cg-btn cg-btn-tool" onClick={() => exportBatchAsJSON(batch)}>
                            ↓ Export JSON
                          </button>
                          {batch.filter(r => r.status === 'generated' && r.profile).length >= 2 && (
                            <button className="cg-btn cg-btn-tool" onClick={() => setShowComparison(true)}>
                              ⇆ Compare
                            </button>
                          )}
                          {trash.length > 0 && (
                            <button
                              className={`cg-btn cg-btn-tool cg-btn-trash${showTrash ? ' cg-btn-trash-active' : ''}`}
                              onClick={() => setShowTrash(t => !t)}
                            >
                              🗑 Trash ({trash.length})
                            </button>
                          )}
                        </div>
                      )}

                      {/* Trash panel */}
                      {showTrash && trash.length > 0 && (
                        <div className="cg-trash-panel">
                          <div className="cg-trash-header">Discarded Characters</div>
                          {trash.map((r, i) => (
                            <div key={i} className="cg-trash-item">
                              <span className="cg-trash-name">{r.seed?.name || 'Unknown'}</span>
                              <span className="cg-trash-role" style={{ color: ROLE_COLORS[r.seed?.role_type] }}>
                                {ROLE_ICONS[r.seed?.role_type]} {r.seed?.role_type}
                              </span>
                              <button className="cg-btn cg-btn-restore" onClick={() => handleRestoreFromTrash(r)}>
                                ↩ Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Character cards */}
                      {filteredBatch.map((result, i) => (
                        <StagingCard
                          key={i}
                          result={result}
                          checks={stagingChecks[batch.indexOf(result)]}
                          onCommit={handleCommit}
                          onDiscard={handleDiscard}
                          onDelete={handleDeleteCommitted}
                          onRegenerate={handleRegenerate}
                          onUpdateProfile={handleUpdateProfile}
                          onRewriteField={handleRewriteField}
                          registries={registries}
                        />
                      ))}

                      {/* Relationship Web */}
                      <RelationshipWebPreview batch={batch} />
                    </>
                  );
                })()}
              </div>

              {/* Comparison modal */}
              {showComparison && (
                <ComparisonModal batch={batch} onClose={() => setShowComparison(false)} />
              )}
            </>
          )}

          {/* History phase */}
          {phase === 'history' && (
            <>
              <div className="cg-phase-header">
                <div className="cg-panel-title">
                  Generation History
                  <span className="cg-seed-count">{history.length} past generation{history.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  className="cg-btn cg-btn-propose"
                  onClick={() => setPhase('seeds')}
                >
                  ← Back to Generator
                </button>
              </div>

              {history.length === 0 && (
                <div className="cg-empty-state">
                  <div className="cg-empty-icon">☰</div>
                  <div>No previous generations yet. Commit characters to start building history.</div>
                </div>
              )}

              <div className="cg-history-list">
                {history.map((entry, idx) => {
                  const isExpanded = expandedHistoryIdx === idx;
                  const dt = new Date(entry.timestamp);
                  const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={entry.id || idx} className={`cg-history-card${isExpanded ? ' cg-history-card-expanded' : ''}`}>
                      <div className="cg-history-card-header" onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}>
                        <div className="cg-history-card-left">
                          <span className="cg-history-icon">{isExpanded ? '▼' : '▶'}</span>
                          <div className="cg-history-meta">
                            <span className="cg-history-date">{dateStr} · {timeStr}</span>
                            <span className="cg-history-world">{WORLD_LABELS[entry.world] || entry.world}</span>
                          </div>
                        </div>
                        <div className="cg-history-card-right">
                          <span className="cg-history-count">{entry.committedCount} character{entry.committedCount !== 1 ? 's' : ''}</span>
                          <span className="cg-history-registry">→ {entry.registry}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="cg-history-card-body">
                          <div className="cg-history-chars">
                            {(entry.characters || []).map((ch, ci) => (
                              <div key={ci} className="cg-history-char">
                                <div className="cg-history-char-header">
                                  <span className="cg-history-char-role" style={{ color: ROLE_COLORS[ch.role] || '#546678' }}>
                                    {ROLE_ICONS[ch.role] || '◆'}{' '}
                                  </span>
                                  <span className="cg-history-char-name">{ch.name}</span>
                                  <span className="cg-history-char-age">{ch.age}{ch.gender ? `, ${ch.gender}` : ''}</span>
                                </div>
                                <div className="cg-history-char-details">
                                  <span className="cg-history-char-career">{ch.career}</span>
                                  {ch.tension && ch.tension !== '—' && (
                                    <span className="cg-history-char-tension">⊗ {ch.tension}</span>
                                  )}
                                  {ch.psychology && ch.psychology !== '—' && (
                                    <span className="cg-history-char-psych">Core desire: {ch.psychology}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {history.length > 0 && (
                <div className="cg-history-footer">
                  <button
                    className="cg-btn cg-btn-discard"
                    onClick={() => {
                      if (window.confirm('Clear all generation history? This cannot be undone.')) {
                        localStorage.removeItem(HISTORY_KEY);
                        setHistory([]);
                      }
                    }}
                  >
                    Clear History
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
