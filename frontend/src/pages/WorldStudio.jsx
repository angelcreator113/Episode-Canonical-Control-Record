/**
 * WorldStudio.jsx  v5.0 — Three-tab restructure
 *
 * Changes from v4.0:
 *  - Three top-level creation tabs: Characters · Feed · Relationships
 *  - World switcher (LalaVerse / Before Lala / All) moved inside Characters tab
 *  - Relationships tab embeds RelationshipEngine filtered to current world
 *  - Removed: Locations tab (moved to dedicated page)
 *  - Characters tab retains full existing functionality unchanged
 *  - Feed tab retains SocialProfileGenerator embed unchanged
 *
 * Styling: WorldStudio.css — light theme, pink/blue/lavender palette
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldStudio.css';

const API = '/api/v1';
const PAGE_SIZE = 20;

/* ── World options ──────────────────────────────────────────────────── */
const WORLD_OPTIONS = [
  { tag: 'lalaverse', label: 'LalaVerse',          icon: '✦', protagonist: 'Lala' },
  { tag: 'book-1',   label: 'Book 1 · Before Lala', icon: '◈', protagonist: 'JustAWoman' },
];

/* ── Character type labels ──────────────────────────────────────────── */
const TYPES = {
  love_interest:   'Love Interest',
  industry_peer:   'Industry Peer',
  mentor:          'Mentor',
  antagonist:      'Antagonist',
  rival:           'Rival',
  collaborator:    'Collaborator',
  one_night_stand: 'One Night Stand',
  recurring:       'Recurring',
  spouse:          'Spouse',
  partner:         'Partner',
  temptation:      'Temptation',
  ex:              'Ex',
  confidant:       'Confidant',
  friend:          'Friend',
  coworker:        'Coworker',
};

/* ── Detail tabs — grouped into sections ──────────────────────────────── */
const DETAIL_TAB_GROUPS = [
  { group: null, tabs: [
    { key: 'overview', label: 'Overview', icon: '◈' },
  ]},
  { group: 'Identity', tabs: [
    { key: 'essence',   label: 'Essence',   icon: '✦' },
    { key: 'aesthetic',  label: 'Aesthetic', icon: '◆' },
    { key: 'voice',      label: 'Voice',    icon: '¶' },
  ]},
  { group: 'Story', tabs: [
    { key: 'desire',        label: 'Desire',        icon: '♡' },
    { key: 'relationships', label: 'Relationships', icon: '⇄' },
    { key: 'scenes',        label: 'Scenes',        icon: '▶' },
  ]},
  { group: 'Data', tabs: [
    { key: 'depth',        label: 'Depth',        icon: '◉' },
    { key: 'demographics', label: 'Demographics', icon: '▤' },
    { key: 'evolution',    label: 'Evolution',    icon: '↗' },
  ]},
];
const DETAIL_TABS = DETAIL_TAB_GROUPS.flatMap(g => g.tabs);

/* ── Fidelity pattern labels ───────────────────────────────────────── */
const FIDELITY_LABELS = {
  faithful_tested: { label: 'Faithful (Tested)', color: '#4ade80' },
  faithful_untested: { label: 'Faithful (Untested)', color: '#86efac' },
  emotionally_unfaithful: { label: 'Emotionally Unfaithful', color: '#fbbf24' },
  physically_unfaithful: { label: 'Physically Unfaithful', color: '#f87171' },
  serial_cheater: { label: 'Serial Cheater', color: '#ef4444' },
  loyal_until_broken: { label: 'Loyal Until Broken', color: '#60a5fa' },
  would_never: { label: 'Would Never', color: '#34d399' },
  already_has: { label: 'Already Has', color: '#fb923c' },
};

/* ── Depth dimension config (must match backend DE_FIELDS / DIMENSION_FIELDS) ── */
const DEPTH_DIMS = [
  { key: 'joy',         label: 'The Experience of Joy',      fields: ['de_joy_trigger','de_joy_body_location','de_joy_origin','de_forbidden_joy','de_joy_threat_response','de_joy_current_access'], color: 'gold' },
  { key: 'body',        label: 'The Body',                   fields: ['de_body_relationship','de_body_currency','de_body_control','de_body_comfort','de_body_history'], color: 'pink' },
  { key: 'money',       label: 'Money as Behavior',          fields: ['de_money_behavior','de_money_origin_class','de_money_current_class','de_class_gap_direction','de_money_wound'], color: 'blue' },
  { key: 'time',        label: 'Time Orientation',           fields: ['de_time_orientation','de_time_wound'],                              color: 'lav' },
  { key: 'change',      label: 'Change Capacity',            fields: ['de_change_capacity','de_change_capacity_score','de_change_condition','de_change_witness','de_arc_function'], color: 'blue' },
  { key: 'luck',        label: 'Luck & Circumstance',        fields: ['de_world_belief','de_circumstance_advantages','de_circumstance_disadvantages','de_luck_interpretation','de_circumstance_wound'], color: 'gold' },
  { key: 'narrative',   label: 'Self vs Actual Narrative',   fields: ['de_self_narrative_origin','de_self_narrative_turning_point','de_self_narrative_villain','de_actual_narrative_gap','de_therapy_target'], color: 'pink', authorOnly: true },
  { key: 'blindspot',   label: 'Blind Spot',                 fields: ['de_blind_spot_category','de_blind_spot','de_blind_spot_evidence','de_blind_spot_crack_condition'], color: 'lav',  authorOnly: true },
  { key: 'cosmology',   label: 'Operative Cosmology',        fields: ['de_operative_cosmology','de_stated_religion','de_cosmology_conflict','de_meaning_making_style'], color: 'gold' },
  { key: 'foreclosed',  label: 'Foreclosed Possibility',     fields: ['de_foreclosed_possibilities','de_foreclosure_origins','de_foreclosure_visibility','de_crack_conditions'], color: 'pink', authorOnly: true },
];

/* ── Completeness tracking ─────────────────────────────────────────── */
const COMPLETENESS_SECTIONS = {
  core:      { label: 'Core',       fields: ['name','occupation','character_type','aesthetic','surface_want','real_want'] },
  essence:   { label: 'Essence',    fields: ['character_archetype','emotional_baseline','core_fear','at_their_best','at_their_worst'] },
  aesthetic: { label: 'Aesthetic',  fields: ['color_palette','glam_energy','signature_silhouette','signature_accessories'] },
  voice:     { label: 'Voice',      fields: ['speech_pattern','vocabulary_tone','catchphrases','internal_monologue_style'] },
  desire:    { label: 'Desire',     fields: ['attracted_to','how_they_love','desire_they_wont_admit','sexuality'] },
  social:    { label: 'Social',     fields: ['relationship_status','moral_code','fidelity_pattern','dynamic'] },
};

function getCompleteness(char) {
  if (!char) return { pct: 0, sections: {} };
  let filled = 0, total = 0;
  const sections = {};
  for (const [key, sec] of Object.entries(COMPLETENESS_SECTIONS)) {
    const secFilled = sec.fields.filter(f => char[f] && String(char[f]).trim()).length;
    sections[key] = { filled: secFilled, total: sec.fields.length, label: sec.label };
    filled += secFilled;
    total += sec.fields.length;
  }
  return { pct: total ? Math.round((filled / total) * 100) : 0, sections };
}

/* ── Small helpers ──────────────────────────────────────────────────── */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function AvatarCircle({ name, size = 'md' }) {
  const initials = getInitials(name);
  const colors = [
    ['#fce8f0','#d4789a'], ['#e8f0fc','#7ab3d4'], ['#f0e8fc','#a889c8'],
    ['#fce8e8','#c47a7a'], ['#e8fce8','#7ac47a'], ['#fdf5e8','#c4a07a'],
  ];
  const idx = (name || '').charCodeAt(0) % colors.length;
  const [bg, fg] = colors[idx];
  return (
    <div className={`ws4-avatar ws4-avatar-${size}`} style={{ background: bg, color: fg }}>
      {initials}
    </div>
  );
}

function Badge({ variant = 'default', children }) {
  return <span className={`ws4-badge ws4-badge-${variant}`}>{children}</span>;
}

function TypeBadge({ type }) {
  const label = TYPES[type] || type?.replace(/_/g, ' ') || '—';
  const typeClass = type?.replace(/_/g, '-') || 'default';
  return <span className={`ws4-badge ws4-badge-type ws4-badge-type-${typeClass}`}>{label}</span>;
}

function Stat({ value, label, color = '' }) {
  return (
    <div className="ws4-stat">
      <span className={`ws4-stat-value ${color}`}>{value}</span>
      <span className="ws4-stat-label">{label}</span>
    </div>
  );
}

function FieldCard({ label, value, dimmed = false }) {
  if (!value) return null;
  return (
    <div className={`ws4-field-card ${dimmed ? 'ws4-field-card-dim' : ''}`}>
      <div className="ws4-field-label">{label}</div>
      <div className="ws4-field-value">{value}</div>
    </div>
  );
}

function SectionLabel({ children, color = '' }) {
  return <div className={`ws4-section-label ${color}`}>{children}</div>;
}

function CompletenessBar({ pct, size = 'md' }) {
  const color = pct >= 80 ? 'var(--ws4-green)' : pct >= 50 ? 'var(--ws4-gold)' : 'var(--ws4-pink)';
  return (
    <div className={`ws4-completeness ws4-completeness-${size}`}>
      <div className="ws4-completeness-track">
        <div className="ws4-completeness-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ws4-completeness-label">{pct}%</span>
    </div>
  );
}

function CollapsibleSection({ title, color = '', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ws4-collapsible ${open ? 'ws4-collapsible-open' : ''}`}>
      <button className={`ws4-collapsible-header ${color}`} onClick={() => setOpen(o => !o)}>
        <span className="ws4-collapsible-title">{title}</span>
        <span className="ws4-collapsible-arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="ws4-collapsible-body">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEPTH PANEL
═══════════════════════════════════════════════════════════════════════ */
function DepthPanel({ registryCharId, onRefresh }) {
  const [depthData, setDepthData]   = useState({});
  const [generating, setGenerating] = useState(false);
  const [genDim, setGenDim]         = useState(null);
  const [preview, setPreview]       = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash]           = useState(null);
  const [loaded, setLoaded]         = useState(false);

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3000);
  };

  // Load saved depth data from registry_characters (reset all transient state on switch)
  useEffect(() => {
    if (!registryCharId) return;
    setLoaded(false);
    setPreview(null);
    setFlash(null);
    setGenerating(false);
    setGenDim(null);
    setConfirming(false);
    fetch(`${API}/character-depth/${registryCharId}`)
      .then(r => r.json())
      .then(d => { setDepthData(d.depth || {}); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [registryCharId]);

  if (!registryCharId) {
    return (
      <div className="ws4-depth-panel">
        <div className="ws4-depth-empty">This character has no registry entry. Activate the character first to enable depth generation.</div>
      </div>
    );
  }

  const generateAll = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/character-depth/${registryCharId}/generate`, { method: 'POST' });
      const d = await r.json();
      if (d.proposed) { setPreview(d.proposed); }
      else showFlash(d.error || 'Generation failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const generateDim = async (dim) => {
    setGenDim(dim);
    try {
      const r = await fetch(`${API}/character-depth/${registryCharId}/generate/${dim}`, { method: 'POST' });
      const d = await r.json();
      if (d.proposed) setPreview(prev => ({ ...prev, ...d.proposed }));
      else showFlash(d.error || 'Generation failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setGenDim(null); }
  };

  const confirmDepth = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const r = await fetch(`${API}/character-depth/${registryCharId}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposed: preview }),
      });
      const d = await r.json();
      if (d.success) {
        showFlash('Depth profile saved');
        setDepthData(d.depth || {});
        setPreview(null);
        onRefresh();
      } else showFlash(d.error || 'Confirm failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setConfirming(false); }
  };

  const source = preview || depthData;
  const hasAnyDepth = loaded && DEPTH_DIMS.some(d => d.fields.some(f => depthData?.[f]));

  return (
    <div className="ws4-depth-panel">
      {flash && (
        <div className={`ws4-inline-flash ws4-inline-flash-${flash.type}`}>{flash.msg}</div>
      )}

      <div className="ws4-depth-header">
        <div>
          <div className="ws4-depth-title">Psychological Depth</div>
          <div className="ws4-depth-sub">10 dimensions · {hasAnyDepth ? 'Partially filled' : 'Not yet generated'}</div>
        </div>
        <div className="ws4-depth-actions">
          {preview && (
            <button className="ws4-btn ws4-btn-gold ws4-btn-sm" onClick={confirmDepth} disabled={confirming}>
              {confirming ? 'Saving…' : '✓ Confirm All'}
            </button>
          )}
          <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={generateAll} disabled={generating}>
            {generating ? '⏳ Generating…' : '✦ Generate All'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="ws4-depth-preview-note">
          Preview generated — review below, then confirm to save.
        </div>
      )}

      {DEPTH_DIMS.map(dim => {
        const hasData = dim.fields.some(f => source?.[f]);
        return (
          <div key={dim.key} className={`ws4-depth-dim ws4-depth-dim-${dim.color} ${dim.authorOnly ? 'ws4-depth-dim-author' : ''}`}>
            <div className="ws4-depth-dim-header">
              <div className="ws4-depth-dim-title">
                {dim.label}
                {dim.authorOnly && <span className="ws4-author-badge">AUTHOR VIEW</span>}
              </div>
              <button
                className="ws4-btn ws4-btn-ghost ws4-btn-xs"
                onClick={() => generateDim(dim.key)}
                disabled={genDim === dim.key}
              >
                {genDim === dim.key ? '…' : '↻'}
              </button>
            </div>
            {hasData ? (
              <div className="ws4-depth-fields">
                {dim.fields.map(f => {
                  const val = source?.[f];
                  if (val === null || val === undefined) return null;
                  const label = f.replace(/^de_/, '').replace(/_/g, ' ');
                  const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
                  return (
                    <div key={f} className="ws4-depth-field">
                      <span className="ws4-depth-field-label">{label}</span>
                      <span className="ws4-depth-field-value">{display}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ws4-depth-empty">Not yet generated</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEMOGRAPHICS PANEL
═══════════════════════════════════════════════════════════════════════ */
function DemographicsPanel({ charDetail }) {
  if (!charDetail) return null;

  const c = charDetail;
  const cityLabels = {
    nova_prime: 'Nova Prime', velour_city: 'Velour City', the_drift: 'The Drift',
    solenne: 'Solenne', cascade_row: 'Cascade Row', outside_lalaverse: 'Outside LalaVerse',
  };
  const mobilityIcon = { ascending: '↑', descending: '↓', stable: '→', volatile: '⇅' };

  return (
    <div className="ws4-demo-panel">
      {/* Identity */}
      <SectionLabel color="pink">Identity</SectionLabel>
      <div className="ws4-demo-grid">
        {c.age && <FieldCard label="Age" value={String(c.age)} />}
        {c.cultural_background && <FieldCard label="Cultural Background" value={c.cultural_background} />}
        {c.nationality && <FieldCard label="Nationality" value={c.nationality} />}
        {c.first_language && <FieldCard label="First Language" value={c.first_language} />}
      </div>

      {/* Geography */}
      {(c.current_city || c.hometown) && (
        <>
          <SectionLabel color="blue">Geography</SectionLabel>
          <div className="ws4-demo-grid">
            {c.hometown && <FieldCard label="Hometown" value={c.hometown} />}
            {c.current_city && <FieldCard label="Current City" value={cityLabels[c.current_city] || c.current_city} />}
            {c.city_migration_history && <FieldCard label="Migration History" value={c.city_migration_history} />}
          </div>
        </>
      )}

      {/* Class */}
      {(c.class_origin || c.current_class) && (
        <>
          <SectionLabel color="lav">Class</SectionLabel>
          <div className="ws4-demo-grid">
            {c.class_origin && <FieldCard label="Class Origin" value={c.class_origin?.replace(/_/g, ' ')} />}
            {c.current_class && (
              <div className="ws4-field-card">
                <div className="ws4-field-label">Current Class</div>
                <div className="ws4-field-value">
                  {c.current_class?.replace(/_/g, ' ')}
                  {c.class_mobility_direction && (
                    <span className={`ws4-mobility ws4-mobility-${c.class_mobility_direction}`}>
                      {mobilityIcon[c.class_mobility_direction]} {c.class_mobility_direction}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Family */}
      {(c.family_structure || c.parents_status || c.relationship_status) && (
        <>
          <SectionLabel color="pink">Family</SectionLabel>
          <div className="ws4-demo-grid">
            {c.family_structure && <FieldCard label="Family Structure" value={c.family_structure?.replace(/_/g, ' ')} />}
            {c.sibling_position && <FieldCard label="Sibling Position" value={`${c.sibling_position?.replace(/_/g, ' ')}${c.sibling_count ? ` of ${c.sibling_count + 1}` : ''}`} />}
            {c.parents_status && <FieldCard label="Parents" value={c.parents_status} />}
            {c.relationship_status && <FieldCard label="Relationship Status" value={c.relationship_status} />}
            {c.has_children && <FieldCard label="Children" value={c.children_ages || 'Yes'} />}
          </div>
        </>
      )}

      {/* Career & Online */}
      {(c.career_history || c.years_posting || c.follower_tier) && (
        <>
          <SectionLabel color="blue">Career & Online Presence</SectionLabel>
          <div className="ws4-demo-grid">
            {c.education_experience && <FieldCard label="Education" value={c.education_experience} />}
            {c.career_history && <FieldCard label="Before This" value={c.career_history} />}
            {c.years_posting && <FieldCard label="Years Posting" value={String(c.years_posting)} />}
            {c.platform_primary && <FieldCard label="Primary Platform" value={c.platform_primary?.replace(/_/g, ' ')} />}
            {c.follower_tier && <FieldCard label="Follower Tier" value={c.follower_tier} />}
          </div>
        </>
      )}

      {/* Voice & Presence */}
      {(c.physical_presence || c.demographic_voice_signature) && (
        <>
          <SectionLabel color="lav">Presence & Voice</SectionLabel>
          {c.physical_presence && <FieldCard label="Physical Presence" value={c.physical_presence} />}
          {c.demographic_voice_signature && <FieldCard label="Voice Signature" value={c.demographic_voice_signature} />}
        </>
      )}

      {!c.age && !c.current_city && !c.class_origin && !c.family_structure && (
        <div className="ws4-demo-empty">
          Demographics not yet generated. Run generate-batch to populate all demographic fields automatically.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function WorldStudio() {
  const navigate = useNavigate();

  /* ── (page tabs removed — Scenes/Feed/Relationships are now separate pages) ──── */

  /* ── World ─────────────────────────────────────────────────────────── */
  const [worldTag, setWorldTag] = useState('lalaverse');
  const curWorld = WORLD_OPTIONS.find(w => w.tag === worldTag) || WORLD_OPTIONS[0];

  /* ── Characters ────────────────────────────────────────────────────── */
  const [characters,    setCharacters]    = useState([]);
  const [selectedChar,  setSelectedChar]  = useState(null);
  const [charDetail,    setCharDetail]    = useState(null);
  const [charFilter,    setCharFilter]    = useState('all');
  const [charSearch,    setCharSearch]    = useState('');
  const [detailTab,     setDetailTab]     = useState('overview');
  const [editMode,      setEditMode]      = useState(false);
  const [editForm,      setEditForm]      = useState({});
  const [saving,        setSaving]        = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [confirming,    setConfirming]    = useState(false);
  const [previewChars,  setPreviewChars]  = useState([]);
  const [previewSel,    setPreviewSel]    = useState(new Set());
  const [previewNotes,  setPreviewNotes]  = useState('');
  const [showPreview,   setShowPreview]   = useState(false);
  const [bulkActivating,setBulkActivating]= useState(false);
  const [currentPage,   setCurrentPage]  = useState(1);

  /* ── Relationship modal ────────────────────────────────────────────── */
  const [showAddRel, setShowAddRel] = useState(false);
  const [relForm,    setRelForm]    = useState({
    related_character_id: '', related_character_name: '',
    related_character_source: 'world_characters',
    relationship_type: 'friendship', family_role: '',
    history_summary: '', current_status: 'active',
    tension_state: 'Stable', romantic_eligible: false,
    knows_about_transfer: false, series_layer: worldTag,
    is_blood_relation: false, is_romantic: false,
    conflict_summary: '', knows_about_connection: false,
  });
  const [savingRel, setSavingRel] = useState(false);

  /* ── Per-character scenes (detail tab) ──────────────────────────────── */
  const [charScenes,     setCharScenes]     = useState([]);
  const [sceneGen,       setSceneGen]       = useState({ loading: false });
  const [activeScene,    setActiveScene]    = useState(null);

  /* ── Batches & Saved Previews ─────────────────────────────────────── */
  const [batches,        setBatches]        = useState([]);
  const [savedPreviews,  setSavedPreviews]  = useState([]);

  /* ── Compare ──────────────────────────────────────────────────────── */
  const [compareChar,    setCompareChar]    = useState(null);
  const [compareDetail,  setCompareDetail]  = useState(null);

  /* ── Deepen ───────────────────────────────────────────────────────── */
  const [deepening,      setDeepening]      = useState(false);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const [toast, setToast] = useState(null);
  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Loaders ───────────────────────────────────────────────────────── */
  const loadCharacters = useCallback(async (tag) => {
    try {
      const effectiveTag = tag !== undefined ? tag : worldTag;
      const url = effectiveTag === 'all'
        ? `${API}/world/characters`
        : `${API}/world/characters?world_tag=${encodeURIComponent(effectiveTag)}`;
      const r = await fetch(url);
      const d = await r.json();
      setCharacters(d.characters || []);
    } catch (e) { console.error(e); }
  }, [worldTag]);

  const loadCharDetail = useCallback(async (id) => {
    try {
      const r = await fetch(`${API}/world/characters/${id}`);
      const d = await r.json();
      setCharDetail(d.character || null);
      setEditMode(false);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadCharacters(worldTag);
    setSelectedChar(null); setCharDetail(null); setEditMode(false); setCurrentPage(1);
    setCompareChar(null); setActiveScene(null);
  }, [worldTag]);

  useEffect(() => { setCurrentPage(1); }, [charSearch, charFilter]);
  useEffect(() => { if (selectedChar) { loadCharDetail(selectedChar); setActiveScene(null); } }, [selectedChar]);

  /* ── Ecosystem generate / preview / confirm ────────────────────────── */
  const [previewId, setPreviewId] = useState(null);

  const generatePreview = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world_tag: worldTag }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) flash(d.error || `Generation failed (${r.status})`, 'error');
      else if (d.characters?.length) {
        setPreviewChars(d.characters);
        setPreviewNotes(d.generation_notes || '');
        setPreviewSel(new Set(d.characters.map((_, i) => i)));
        setPreviewId(d.preview_id || null);
        setShowPreview(true);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Ecosystem Generated', { body: `${d.characters.length} characters ready for review`, icon: '/favicon.ico' });
        }
      } else flash('Generation returned no characters', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const confirmPreview = async () => {
    const selected = previewChars.filter((_, i) => previewSel.has(i));
    if (!selected.length) { flash('Select at least one character', 'error'); return; }
    setConfirming(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: selected, generation_notes: previewNotes, world_tag: worldTag, preview_id: previewId }),
      });
      const d = await r.json();
      if (d.characters) {
        flash(`${d.count} characters committed · ${d.inter_relationships || 0} relationships seeded`);
        setShowPreview(false);
        setPreviewId(null);
        loadCharacters();
      } else flash(d.error || 'Confirm failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setConfirming(false); }
  };

  /* ── Character actions ─────────────────────────────────────────────── */
  const activateChar = async (id) => {
    try {
      const r = await fetch(`${API}/world/characters/${id}/activate`, { method: 'POST' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); flash(d.error || 'Activate failed', 'error'); return; }
      flash('Character activated');
      loadCharacters();
      if (selectedChar === id) loadCharDetail(id);
    } catch (e) { flash(e.message, 'error'); }
  };

  const archiveChar = async (id) => {
    try {
      const r = await fetch(`${API}/world/characters/${id}/archive`, { method: 'POST' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); flash(d.error || 'Archive failed', 'error'); return; }
      flash('Character archived');
      setSelectedChar(null); setCharDetail(null); loadCharacters();
    } catch (e) { flash(e.message, 'error'); }
  };

  const deleteChar = async (id) => {
    if (!window.confirm('Delete this character permanently?')) return;
    try {
      const r = await fetch(`${API}/world/characters/${id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); flash(d.error || 'Delete failed', 'error'); return; }
      flash('Character deleted');
      setSelectedChar(null); setCharDetail(null); loadCharacters();
    } catch (e) { flash(e.message, 'error'); }
  };

  const saveCharEdit = async () => {
    if (!selectedChar) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/world/characters/${selectedChar}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const d = await r.json();
      if (d.character) {
        flash('Saved'); setEditMode(false);
        loadCharDetail(selectedChar); loadCharacters();
      } else flash(d.error || 'Save failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const bulkActivate = async () => {
    const drafts = characters.filter(c => c.status === 'draft');
    if (!drafts.length) { flash('No drafts to activate', 'error'); return; }
    setBulkActivating(true);
    for (const c of drafts) {
      await fetch(`${API}/world/characters/${c.id}/activate`, { method: 'POST' }).catch(() => {});
    }
    flash(`${drafts.length} characters activated`);
    loadCharacters();
    if (selectedChar) loadCharDetail(selectedChar);
    setBulkActivating(false);
  };

  /* ── Relationship ──────────────────────────────────────────────────── */
  const addRelationship = async () => {
    if (!selectedChar) return;
    setSavingRel(true);
    try {
      const r = await fetch(`${API}/world/characters/${selectedChar}/relationships`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relForm),
      });
      const d = await r.json();
      if (d.graph) {
        flash('Relationship added');
        setShowAddRel(false);
        loadCharDetail(selectedChar);
      } else flash(d.error || 'Add failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSavingRel(false); }
  };

  const deleteRelationship = async (relId) => {
    try {
      const r = await fetch(`${API}/world/characters/${selectedChar}/relationships/${relId}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); flash(d.error || 'Delete failed', 'error'); return; }
      flash('Relationship removed');
      loadCharDetail(selectedChar);
    } catch (e) { flash(e.message, 'error'); }
  };

  /* ── Scene loaders & actions ──────────────────────────────────────── */
  const loadCharScenes = useCallback(async (charId) => {
    try {
      const r = await fetch(`${API}/world/scenes?character_id=${charId}`);
      const d = await r.json();
      setCharScenes(d.scenes || []);
    } catch { setCharScenes([]); }
  }, []);

  const generateScene = async (charAId) => {
    setSceneGen(p => ({ ...p, loading: true }));
    try {
      const r = await fetch(`${API}/world/scenes/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_a_id: charAId }),
      });
      const d = await r.json();
      if (d.scene) { setActiveScene(d.scene); flash('Scene generated'); loadCharScenes(charAId); }
      else flash(d.error || 'Scene generation failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSceneGen(p => ({ ...p, loading: false })); }
  };

  const approveScene = async (sceneId) => {
    try {
      const r = await fetch(`${API}/world/scenes/${sceneId}/approve`, { method: 'POST' });
      const d = await r.json();
      if (d.approved) {
        flash('Scene approved & written to StoryTeller');
        if (activeScene?.id === sceneId) setActiveScene({ ...activeScene, status: 'approved' });
        if (selectedChar) loadCharScenes(selectedChar);
      } else flash(d.error || 'Approve failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
  };

  const deleteScene = async (sceneId) => {
    if (!window.confirm('Delete this scene draft?')) return;
    await fetch(`${API}/world/scenes/${sceneId}`, { method: 'DELETE' });
    flash('Scene deleted'); setActiveScene(null);
    if (selectedChar) loadCharScenes(selectedChar);
  };

  // Load scenes when switching to scenes or evolution detail tab
  useEffect(() => {
    if ((detailTab === 'scenes' || detailTab === 'evolution') && selectedChar) loadCharScenes(selectedChar);
  }, [detailTab, selectedChar]);

  /* ── Batch & Saved Preview loaders ────────────────────────────────── */
  const loadBatches = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/batches`);
      const d = await r.json();
      setBatches(d.batches || []);
    } catch { setBatches([]); }
  }, []);

  const loadSavedPreviews = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/previews`);
      const d = await r.json();
      setSavedPreviews((d.previews || []).filter(p => p.status === 'pending'));
    } catch { setSavedPreviews([]); }
  }, []);

  const restorePreview = async (pid) => {
    try {
      const r = await fetch(`${API}/world/preview/${pid}`);
      const d = await r.json();
      if (d.characters?.length) {
        setPreviewChars(d.characters);
        setPreviewNotes(d.generation_notes || '');
        setPreviewSel(new Set(d.characters.map((_, i) => i)));
        setPreviewId(d.preview_id || pid);
        setShowPreview(true);
      } else flash('Preview is empty or expired', 'error');
    } catch { flash('Could not restore preview', 'error'); }
  };

  const discardPreview = async (pid) => {
    await fetch(`${API}/world/previews/${pid}`, { method: 'DELETE' });
    flash('Preview discarded');
    loadSavedPreviews();
  };

  useEffect(() => { if (!selectedChar) { loadBatches(); loadSavedPreviews(); } }, [selectedChar]);

  /* ── Compare loader ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!compareChar) { setCompareDetail(null); return; }
    fetch(`${API}/world/characters/${compareChar}`).then(r => r.json()).then(d => setCompareDetail(d.character || null)).catch(() => setCompareDetail(null));
  }, [compareChar]);

  /* ── AI Deepen ───────────────────────────────────────────────────── */
  const deepenCharacter = async (charId) => {
    setDeepening(true);
    try {
      const r = await fetch(`${API}/world/characters/${charId}/deepen`, { method: 'POST' });
      const d = await r.json();
      if (d.character) { flash('Character deepened with AI'); loadCharDetail(charId); }
      else flash(d.error || 'Deepening failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setDeepening(false); }
  };

  /* ── Export ──────────────────────────────────────────────────────── */
  const exportCharacter = (char) => {
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(char.name || 'character').replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCharacter = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const r = await fetch(`${API}/world/generate-ecosystem-confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: [data], world_tag: worldTag, generation_notes: `Imported from ${file.name}` }),
      });
      const d = await r.json();
      if (d.characters) { flash(`Imported ${data.name || 'character'}`); loadCharacters(); }
      else flash(d.error || 'Import failed', 'error');
    } catch (e) { flash('Invalid JSON file', 'error'); }
    e.target.value = '';
  };

  /* ── Ecosystem balance warnings ─────────────────────────────────── */
  const getEcosystemWarnings = () => {
    if (characters.length < 3) return [];
    const warnings = [];
    const types = characters.map(c => c.character_type);
    const sexualities = characters.map(c => (c.sexuality || '').toLowerCase()).filter(Boolean);
    const fidelities = characters.map(c => c.fidelity_pattern).filter(Boolean);
    if (!types.includes('antagonist') && !types.includes('rival')) warnings.push('No antagonist or rival — consider adding conflict');
    if (!types.includes('love_interest') && !types.includes('one_night_stand')) warnings.push('No love interest — romantic tension missing');
    if (!types.includes('mentor') && !types.includes('collaborator')) warnings.push('No mentor or collaborator — growth pathway missing');
    if (!['spouse','partner','temptation','ex'].some(t => types.includes(t))) warnings.push('No fidelity tension characters (spouse/partner/temptation/ex)');
    if (sexualities.length && sexualities.every(s => s === 'straight')) warnings.push('All characters are straight — consider diversity');
    if (characters.filter(c => c.intimate_eligible).length === 0) warnings.push('No intimate-eligible characters');
    if (fidelities.length && fidelities.every(f => f === 'faithful_untested')) warnings.push('No tested fidelity patterns — moral tension may be flat');
    return warnings;
  };

  /* ── Derived ───────────────────────────────────────────────────────── */
  const filtered = characters.filter(c => {
    if (charFilter !== 'all' && c.character_type !== charFilter) return false;
    if (charSearch) {
      const q = charSearch.toLowerCase();
      const fields = [c.name, c.occupation, c.character_archetype, c.aesthetic, c.glam_energy, c.fidelity_pattern?.replace(/_/g, ' ')];
      if (!fields.some(f => (f || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const uniqueTypes = [...new Set(characters.map(c => c.character_type).filter(Boolean))];
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const relGraph    = charDetail ? (() => {
    try {
      return typeof charDetail.relationship_graph === 'string'
        ? JSON.parse(charDetail.relationship_graph || '[]')
        : (charDetail.relationship_graph || []);
    } catch { return []; }
  })() : [];
  const draftCount  = characters.filter(c => c.status === 'draft').length;

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="ws4-page">

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="ws4-page-header">
        {/* Row 1: Title + World Switcher + Primary Action */}
        <div className="ws4-header-row">
          <div className="ws4-header-title-block">
            <h1 className="ws4-page-title">World Studio</h1>
          </div>

          <div className="ws4-world-switcher">
            {WORLD_OPTIONS.map(w => (
              <button
                key={w.tag}
                className={`ws4-world-btn ${worldTag === w.tag ? 'ws4-world-btn-active' : ''}`}
                onClick={() => { setWorldTag(w.tag); setSelectedChar(null); setCharDetail(null); setCharFilter('all'); }}
              >
                <span>{w.icon}</span> {w.label}
              </button>
            ))}
            <button
              className={`ws4-world-btn ${worldTag === 'all' ? 'ws4-world-btn-active' : ''}`}
              onClick={() => { setWorldTag('all'); setSelectedChar(null); setCharDetail(null); setCharFilter('all'); }}
            >
              <span>⊞</span> All
            </button>
          </div>

          <div className="ws4-header-actions">
            {worldTag !== 'all' && (
              <button className="ws4-btn ws4-btn-primary" onClick={generatePreview} disabled={generating}>
                {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Actions */}
        {(draftCount > 0 || (worldTag !== 'all' && characters.length > 0)) && (
          <div className="ws4-header-row-2">
            <div className="ws4-header-secondary">
              {draftCount > 0 && (
                <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={bulkActivate} disabled={bulkActivating}>
                  {bulkActivating ? '…' : `✓ Activate ${draftCount}`}
                </button>
              )}
              {worldTag !== 'all' && characters.length > 0 && (
                <button
                  className="ws4-btn ws4-btn-outline ws4-btn-sm"
                  title="Push all characters to the Character Registry so they stay in sync"
                  onClick={async () => {
                    try {
                      const resp = await fetch('/api/world/characters/bulk-re-sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ world_tag: worldTag }),
                      });
                      const data = await resp.json();
                      flash(`Synced ${data.synced}/${data.total} to registry`);
                    } catch (e) { flash(`Sync error: ${e.message}`); }
                  }}
                >
                  🔄 Sync to Registry
                </button>
              )}
              {worldTag !== 'all' && characters.length > 1 && (
                <button
                  className="ws4-btn ws4-btn-outline ws4-btn-sm"
                  title="Auto-generate relationship connections between characters in this world"
                  onClick={async () => {
                    try {
                      const resp = await fetch('/api/world/characters/seed-cross-batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ world_tag: worldTag }),
                      });
                      const data = await resp.json();
                      flash(`Created ${data.seeded} new relationships from ${data.total_candidates} candidates`);
                    } catch (e) { flash(`Seed error: ${e.message}`, 'error'); }
                  }}
                >
                  🔗 Auto-Link Characters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Characters content (Scenes/Feed/Relationships are now separate pages) ── */}
      <>

      {/* ── STATS BAR ───────────────────────────────────────────────── */}
      <div className="ws4-stats-bar">
        <Stat value={characters.length}                                      label="Characters" />
        <Stat value={characters.filter(c => c.status === 'active').length}   label="Active"     color="ws4-stat-green" />
        <Stat value={characters.filter(c => c.status === 'draft').length}    label="Draft"      color="ws4-stat-muted" />
        <div className="ws4-stats-divider" />
        <Stat value={characters.filter(c => c.intimate_eligible).length}     label="Intimate"   color="ws4-stat-rose" />
        <Stat value={characters.filter(c => c.is_alive === false).length}    label="† Deceased" color="ws4-stat-deceased" />
      </div>

      {/* ── BODY: sidebar + main ────────────────────────────────────── */}
      <div className="ws4-body">

        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="ws4-sidebar">
          <div className="ws4-sidebar-inner">
            <input
              className="ws4-search"
              placeholder="Search characters…"
              value={charSearch}
              onChange={e => setCharSearch(e.target.value)}
            />

            {/* Filter pills */}
            <div className="ws4-filter-pills">
              <button
                className={`ws4-pill ${charFilter === 'all' ? 'ws4-pill-active' : ''}`}
                onClick={() => setCharFilter('all')}
              >
                All <span className="ws4-pill-count">{characters.length}</span>
              </button>
              {uniqueTypes.map(t => {
                const count = characters.filter(c => c.character_type === t).length;
                return (
                  <button
                    key={t}
                    className={`ws4-pill ${charFilter === t ? 'ws4-pill-active' : ''}`}
                    onClick={() => setCharFilter(t)}
                  >
                    {TYPES[t] || t} <span className="ws4-pill-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Top Pagination */}
            {totalPages > 1 && (
              <div className="ws4-pagination">
                <button className="ws4-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                <span className="ws4-page-info">{currentPage} / {totalPages}</span>
                <button className="ws4-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
              </div>
            )}

            {/* Character list */}
            <div className="ws4-char-list">
              {filtered.length === 0 ? (
                <div className="ws4-sidebar-empty">
                  <div className="ws4-sidebar-empty-icon">✦</div>
                  <div>No characters yet</div>
                </div>
              ) : paged.map(c => {
                const comp = getCompleteness(c);
                const relCount = (() => {
                  try {
                    const g = typeof c.relationship_graph === 'string' ? JSON.parse(c.relationship_graph || '[]') : (c.relationship_graph || []);
                    return g.length;
                  } catch { return 0; }
                })();
                return (
                  <div
                    key={c.id}
                    className={`ws4-char-item ${selectedChar === c.id ? 'ws4-char-item-active' : ''} ${c.is_alive === false ? 'ws4-char-item-deceased' : ''}`}
                    onClick={() => { setSelectedChar(c.id); setDetailTab('overview'); }}
                  >
                    <AvatarCircle name={c.name} size="sm" />
                    <div className="ws4-char-item-info">
                      <div className="ws4-char-item-name">
                        {c.is_alive === false && <span className="ws4-dagger">†</span>}
                        {c.name}
                        {c.intimate_eligible && <span className="ws4-heart">♡</span>}
                      </div>
                      <div className="ws4-char-item-sub">{c.occupation || c.character_type?.replace(/_/g, ' ')}</div>
                      <div className="ws4-char-item-badges">
                        <TypeBadge type={c.character_type} />
                        <span className={`ws4-status-dot ws4-status-dot-${c.status}`} />
                        {relCount > 0 && <span className="ws4-char-item-rel-count">{relCount}</span>}
                      </div>
                      <CompletenessBar pct={comp.pct} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="ws4-pagination">
                <button className="ws4-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                <span className="ws4-page-info">{currentPage} / {totalPages}</span>
                <button className="ws4-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CANVAS ─────────────────────────────────────────── */}
        <main className="ws4-main">

          {/* Empty state */}
          {characters.length === 0 && (
            <div className="ws4-empty-state">
              <div className="ws4-empty-icon">{curWorld?.icon || '⊞'}</div>
              <div className="ws4-empty-title">
                {worldTag === 'all' ? 'No characters yet' : `Start your ${curWorld?.label} Ecosystem`}
              </div>
              <div className="ws4-empty-body">
                {worldTag === 'all'
                  ? 'Select LalaVerse or Before Lala to generate your first ecosystem.'
                  : `Generate a full cast of world characters with ${curWorld?.protagonist} as protagonist. Preview them, select who stays, confirm to commit.`
                }
              </div>
              {worldTag !== 'all' && (
                <button className="ws4-btn ws4-btn-primary ws4-btn-lg" onClick={generatePreview} disabled={generating}>
                  {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
                </button>
              )}
            </div>
          )}

          {/* Dashboard overview (no selection) */}
          {characters.length > 0 && !charDetail && (
            <div className="ws4-dashboard">
              <div className="ws4-dashboard-heading">
                {worldTag === 'all' ? '⊞ All Worlds' : `${curWorld?.icon} ${curWorld?.label}`} — Ecosystem Overview
              </div>

              {/* Ecosystem Health Summary */}
              {(() => {
                const avgComp = characters.length
                  ? Math.round(characters.reduce((s, c) => s + getCompleteness(c).pct, 0) / characters.length)
                  : 0;
                const needsWork = characters.filter(c => getCompleteness(c).pct < 50);
                const withRels = characters.filter(c => {
                  try {
                    const g = typeof c.relationship_graph === 'string' ? JSON.parse(c.relationship_graph || '[]') : (c.relationship_graph || []);
                    return g.length > 0;
                  } catch { return false; }
                });
                const intimate = characters.filter(c => c.intimate_eligible);
                // Section-level breakdown
                const sectionAvgs = {};
                for (const key of Object.keys(COMPLETENESS_SECTIONS)) {
                  const sums = characters.reduce((s, c) => {
                    const sec = getCompleteness(c).sections[key];
                    return s + (sec ? sec.filled / sec.total : 0);
                  }, 0);
                  sectionAvgs[key] = characters.length ? Math.round((sums / characters.length) * 100) : 0;
                }
                return (
                  <div className="ws4-health-grid">
                    <div className="ws4-health-card ws4-health-card-main">
                      <div className="ws4-health-stat">{avgComp}%</div>
                      <div className="ws4-health-label">Avg Completeness</div>
                      <CompletenessBar pct={avgComp} />
                    </div>
                    <div className="ws4-health-card">
                      <div className="ws4-health-stat">{withRels.length}/{characters.length}</div>
                      <div className="ws4-health-label">Have Relationships</div>
                    </div>
                    <div className="ws4-health-card">
                      <div className="ws4-health-stat">{intimate.length}</div>
                      <div className="ws4-health-label">Intimate Eligible</div>
                    </div>
                    <div className="ws4-health-card">
                      <div className="ws4-health-stat ws4-health-warn">{needsWork.length}</div>
                      <div className="ws4-health-label">Need Work (&lt;50%)</div>
                    </div>
                    <div className="ws4-health-sections">
                      {Object.entries(sectionAvgs).map(([key, avg]) => (
                        <div key={key} className="ws4-health-section-row">
                          <span className="ws4-health-section-name">{COMPLETENESS_SECTIONS[key].label}</span>
                          <CompletenessBar pct={avg} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Characters needing attention */}
              {(() => {
                const lowChars = characters
                  .map(c => ({ ...c, _comp: getCompleteness(c) }))
                  .filter(c => c._comp.pct < 60)
                  .sort((a, b) => a._comp.pct - b._comp.pct)
                  .slice(0, 5);
                return lowChars.length > 0 ? (
                  <div className="ws4-attention-list">
                    <div className="ws4-dash-label">Needs Attention</div>
                    {lowChars.map(c => (
                      <div key={c.id} className="ws4-attention-item" onClick={() => { setSelectedChar(c.id); setDetailTab('overview'); }}>
                        <AvatarCircle name={c.name} size="sm" />
                        <div className="ws4-attention-info">
                          <span className="ws4-attention-name">{c.name}</span>
                          <span className="ws4-attention-missing">
                            {Object.entries(c._comp.sections)
                              .filter(([, s]) => s.filled < s.total)
                              .map(([, s]) => s.label)
                              .join(', ')}
                          </span>
                        </div>
                        <CompletenessBar pct={c._comp.pct} size="sm" />
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Saved Previews — resume generation you left */}
              {savedPreviews.length > 0 && (
                <div className="ws4-saved-previews">
                  <div className="ws4-saved-previews-title">Saved Ecosystems</div>
                  <div className="ws4-saved-previews-desc">You generated these but haven't confirmed them yet. Resume or discard.</div>
                  {savedPreviews.map(p => (
                    <div key={p.preview_id} className="ws4-saved-preview-card">
                      <div className="ws4-saved-preview-meta">
                        <Badge variant="default">{p.character_count} characters</Badge>
                        <Badge variant="draft">{p.world_tag}</Badge>
                        <span className="ws4-saved-preview-date">{new Date(p.created_at).toLocaleString()}</span>
                      </div>
                      {p.generation_notes && <div className="ws4-saved-preview-notes">{p.generation_notes.substring(0, 160)}</div>}
                      <div className="ws4-saved-preview-actions">
                        <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => restorePreview(p.preview_id)}>Resume</button>
                        <button className="ws4-btn ws4-btn-ghost ws4-btn-sm ws4-btn-muted" onClick={() => discardPreview(p.preview_id)}>Discard</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ecosystem Balance Warnings */}
              {(() => {
                const warnings = getEcosystemWarnings();
                return warnings.length > 0 ? (
                  <div className="ws4-warnings">
                    <div className="ws4-warnings-title">⚠ Ecosystem Balance</div>
                    {warnings.map((w, i) => <div key={i} className="ws4-warning-item">{w}</div>)}
                  </div>
                ) : null;
              })()}

              <div className="ws4-dash-label">Character Types</div>
              <div className="ws4-type-grid">
                {uniqueTypes.map(t => {
                  const count = characters.filter(c => c.character_type === t).length;
                  const pct   = Math.round((count / characters.length) * 100);
                  return (
                    <div key={t} className="ws4-type-card" onClick={() => setCharFilter(t)}>
                      <TypeBadge type={t} />
                      <div className="ws4-type-count">{count}</div>
                      <div className="ws4-type-label">characters</div>
                      <div className="ws4-type-bar">
                        <div className="ws4-type-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Relationship Web (text-based visualizer) */}
              {characters.length >= 2 && (
                <>
                  <div className="ws4-dash-label">Relationship Web</div>
                  <div className="ws4-rel-web">
                    {characters.map(c => {
                      let rels;
                      try { rels = typeof c.relationship_graph === 'string' ? JSON.parse(c.relationship_graph || '[]') : (c.relationship_graph || []); }
                      catch { rels = []; }
                      return { ...c, _rels: rels };
                    }).filter(c => c._rels.length > 0).slice(0, 12).map(c => {
                      const rels = c._rels;
                      return (
                        <div key={c.id} className="ws4-rel-web-node" onClick={() => { setSelectedChar(c.id); }}>
                          <div className="ws4-rel-web-name">{c.name}</div>
                          <div className="ws4-rel-web-links">
                            {rels.slice(0, 3).map((r, i) => (
                              <span key={i} className="ws4-rel-web-link">→ {r.character_name || '?'} <em>({r.relationship_type})</em></span>
                            ))}
                            {rels.length > 3 && <span className="ws4-rel-web-more">+{rels.length - 3} more</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Batch History */}
              {batches.length > 0 && (
                <>
                  <div className="ws4-dash-label">Generation History</div>
                  <div className="ws4-batch-list">
                    {batches.slice(0, 5).map(b => (
                      <div key={b.id} className="ws4-batch-card">
                        <div className="ws4-batch-meta">
                          <span className="ws4-batch-date">{new Date(b.created_at).toLocaleDateString()}</span>
                          <Badge variant="default">{b.character_count} characters</Badge>
                          <Badge variant="draft">{b.series_label}</Badge>
                        </div>
                        {b.generation_notes && <div className="ws4-batch-notes">{b.generation_notes.substring(0, 200)}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Import button */}
              <div className="ws4-dash-actions">
                <label className="ws4-btn ws4-btn-outline ws4-btn-sm">
                  ↙ Import Character JSON
                  <input type="file" accept=".json" onChange={importCharacter} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          )}

          {/* Character detail */}
          {charDetail && (
            <div className="ws4-detail">

              {/* Detail header */}
              <div className="ws4-detail-header">
                <div className="ws4-detail-hero">
                  <AvatarCircle name={charDetail.name} size="lg" />
                  <div className="ws4-detail-hero-info">
                    <h2 className={`ws4-detail-name ${charDetail.is_alive === false ? 'ws4-deceased-name' : ''}`}>
                      {charDetail.is_alive === false && <span className="ws4-dagger-lg">†</span>}
                      {charDetail.name}
                    </h2>
                    <div className="ws4-detail-meta">
                      {[charDetail.age_range, charDetail.occupation, charDetail.world_location].filter(Boolean).join(' · ')}
                    </div>
                    <div className="ws4-detail-badges">
                      <TypeBadge type={charDetail.character_type} />
                      {charDetail.intimate_eligible && <Badge variant="intimate">♡ Intimate</Badge>}
                      <Badge variant={charDetail.status}>{charDetail.status}</Badge>
                      {charDetail.gender && <Badge variant="identity">{charDetail.gender}</Badge>}
                      {charDetail.species && charDetail.species !== 'human' && (
                        <Badge variant="species">{charDetail.species}</Badge>
                      )}
                    </div>
                    <CompletenessBar pct={getCompleteness(charDetail).pct} />
                  </div>
                </div>

                <div className="ws4-detail-toolbar">
                  {!editMode ? (
                    <>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => { setEditForm({ ...charDetail }); setEditMode(true); }}>✎ Edit</button>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => deepenCharacter(charDetail.id)} disabled={deepening}>
                        {deepening ? '⏳' : '🧠'} Deepen
                      </button>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => exportCharacter(charDetail)}>↗ Export</button>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => {
                        if (compareChar) { setCompareChar(null); }
                        else {
                          const other = characters.find(c => c.id !== charDetail.id);
                          if (other) setCompareChar(other.id);
                          else flash('Need at least two characters to compare', 'error');
                        }
                      }}>
                        {compareChar ? '✕ Close Compare' : '⇄ Compare'}
                      </button>
                      {charDetail.status !== 'archived' && (
                        <button className="ws4-btn ws4-btn-ghost ws4-btn-sm ws4-btn-muted" onClick={() => archiveChar(charDetail.id)}>Archive</button>
                      )}
                      <button className="ws4-btn ws4-btn-danger ws4-btn-sm" onClick={() => deleteChar(charDetail.id)}>Delete</button>
                    </>
                  ) : (
                    <>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => setEditMode(false)}>✕ Cancel</button>
                      <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={saveCharEdit} disabled={saving}>{saving ? 'Saving…' : '✓ Save'}</button>
                    </>
                  )}
                  {charDetail.status === 'draft' && !editMode && (
                    <button className="ws4-btn ws4-btn-green ws4-btn-sm" onClick={() => activateChar(charDetail.id)}>Activate</button>
                  )}
                </div>
              </div>

              {/* Death notice */}
              {charDetail.is_alive === false && (
                <div className="ws4-death-notice">
                  <span className="ws4-death-label">† Deceased</span>
                  {charDetail.death_cause && <span>{charDetail.death_cause}</span>}
                  {charDetail.death_impact && <div className="ws4-death-impact">Impact: {charDetail.death_impact}</div>}
                </div>
              )}

              {/* Tabs */}
              {!editMode && (
                <>
                  <div className="ws4-tabs ws4-tabs-grouped">
                    {DETAIL_TAB_GROUPS.map((g, gi) => (
                      <React.Fragment key={gi}>
                        {g.group && <span className="ws4-tab-group-label">{g.group}</span>}
                        {g.tabs.map(t => (
                          <button
                            key={t.key}
                            className={`ws4-tab ${detailTab === t.key ? 'ws4-tab-active' : ''}`}
                            onClick={() => setDetailTab(t.key)}
                          >
                            <span className="ws4-tab-icon">{t.icon}</span>
                            {t.label}
                          </button>
                        ))}
                        {gi < DETAIL_TAB_GROUPS.length - 1 && <span className="ws4-tab-divider" />}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="ws4-tab-content">

                    {/* ── OVERVIEW ─────────────────────────────────── */}
                    {detailTab === 'overview' && (
                      <div className="ws4-overview">
                        {charDetail.signature && (
                          <blockquote className="ws4-blockquote">"{charDetail.signature}"</blockquote>
                        )}

                        {charDetail.aesthetic && (
                          <FieldCard label="Aesthetic" value={charDetail.aesthetic} />
                        )}

                        <div className="ws4-want-grid">
                          {charDetail.surface_want && (
                            <div className="ws4-want-card ws4-want-card-gold">
                              <div className="ws4-want-label">Surface Want</div>
                              <div className="ws4-want-value">{charDetail.surface_want}</div>
                            </div>
                          )}
                          {charDetail.real_want && (
                            <div className="ws4-want-card ws4-want-card-rose">
                              <div className="ws4-want-label">Real Want</div>
                              <div className="ws4-want-value">{charDetail.real_want}</div>
                            </div>
                          )}
                        </div>

                        {charDetail.what_they_want_from_lala && (
                          <FieldCard label={`What They Want From ${curWorld.protagonist}`} value={charDetail.what_they_want_from_lala} />
                        )}
                        {charDetail.how_they_meet && (
                          <FieldCard label="How They Meet" value={charDetail.how_they_meet} />
                        )}
                        {charDetail.dynamic && (
                          <FieldCard label="Dynamic" value={charDetail.dynamic} />
                        )}

                        {/* Fidelity & Moral Profile */}
                        {(charDetail.fidelity_pattern || charDetail.moral_code || charDetail.relationship_status) && (
                          <>
                            <SectionLabel color="lav">Moral Profile</SectionLabel>
                            <div className="ws4-moral-grid">
                              {charDetail.relationship_status && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Status</div>
                                  <div className="ws4-moral-value">
                                    {charDetail.relationship_status.replace(/_/g, ' ')}
                                    {charDetail.committed_to && <span className="ws4-moral-committed"> → {charDetail.committed_to}</span>}
                                  </div>
                                </div>
                              )}
                              {charDetail.fidelity_pattern && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Fidelity</div>
                                  <div className="ws4-moral-value">
                                    <span className="ws4-fidelity-badge" style={{ borderColor: FIDELITY_LABELS[charDetail.fidelity_pattern]?.color || '#999' }}>
                                      {FIDELITY_LABELS[charDetail.fidelity_pattern]?.label || charDetail.fidelity_pattern.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {charDetail.moral_code && (
                                <div className="ws4-moral-card ws4-moral-card-wide">
                                  <div className="ws4-moral-label">Moral Code</div>
                                  <div className="ws4-moral-value">{charDetail.moral_code}</div>
                                </div>
                              )}
                              {charDetail.sexuality && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Sexuality</div>
                                  <div className="ws4-moral-value">{charDetail.sexuality}</div>
                                </div>
                              )}
                              {charDetail.gender && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Gender</div>
                                  <div className="ws4-moral-value">{charDetail.gender}</div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {(charDetail.origin_story || charDetail.public_persona || charDetail.private_reality) && (
                          <>
                            <SectionLabel>Deeper Profile</SectionLabel>
                            <FieldCard label="Origin Story" value={charDetail.origin_story} />
                            <FieldCard label="Public Persona" value={charDetail.public_persona} />
                            <FieldCard label="Private Reality" value={charDetail.private_reality} dimmed />
                          </>
                        )}

                        {charDetail.arc_role && <FieldCard label="Arc Role" value={charDetail.arc_role} />}
                        {charDetail.career_goal && <FieldCard label="Career Goal" value={charDetail.career_goal} />}

                        <div className="ws4-overview-links">
                          <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={() => navigate('/relationships')}>
                            🔗 Relationship Map
                          </button>
                          {charDetail.registry_character_id && (
                            <button className="ws4-btn ws4-btn-outline ws4-btn-sm"
                              onClick={() => navigate(`/character-registry?highlight=${charDetail.registry_character_id}`)}>
                              📋 Registry Entry
                            </button>
                          )}
                          <button className="ws4-btn ws4-btn-outline ws4-btn-sm"
                            onClick={async () => {
                              try {
                                const resp = await fetch(`/api/world/characters/${charDetail.id}/re-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                                const data = await resp.json();
                                if (data.synced) { flash('Registry synced'); } else { flash(`Sync failed: ${data.error}`); }
                              } catch (e) { flash(`Sync error: ${e.message}`); }
                            }}>
                            🔄 Sync to Registry
                          </button>
                          <button className="ws4-btn ws4-btn-outline ws4-btn-sm"
                            onClick={() => window.open(`/api/world/characters/${charDetail.id}/export`, '_blank')}>
                            📥 Export Dossier
                          </button>
                          <button className="ws4-btn ws4-btn-outline ws4-btn-sm"
                            onClick={() => navigate(`/universe?highlight_character=${charDetail.name}`)}>
                            ◈ View in Universe
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── ESSENCE ──────────────────────────────────── */}
                    {detailTab === 'essence' && (
                      <div className="ws4-overview">
                        {(charDetail.character_archetype || charDetail.emotional_baseline || charDetail.core_fear) ? (
                          <>
                            <div className="ws4-moral-grid">
                              {charDetail.character_archetype && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Archetype</div>
                                  <div className="ws4-moral-value">{charDetail.character_archetype}</div>
                                </div>
                              )}
                              {charDetail.emotional_baseline && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Emotional Baseline</div>
                                  <div className="ws4-moral-value">{charDetail.emotional_baseline}</div>
                                </div>
                              )}
                              {charDetail.core_fear && (
                                <div className="ws4-moral-card ws4-moral-card-wide">
                                  <div className="ws4-moral-label">Core Fear</div>
                                  <div className="ws4-moral-value">{charDetail.core_fear}</div>
                                </div>
                              )}
                            </div>
                            {charDetail.at_their_best && <FieldCard label="At Their Best" value={charDetail.at_their_best} />}
                            {charDetail.at_their_worst && <FieldCard label="At Their Worst" value={charDetail.at_their_worst} dimmed />}
                            {charDetail.signature && <FieldCard label="Signature Trait" value={charDetail.signature} />}
                          </>
                        ) : (
                          <div className="ws4-tab-empty">No essence data yet. Use 🧠 Deepen to generate.</div>
                        )}
                      </div>
                    )}

                    {/* ── AESTHETIC ────────────────────────────────── */}
                    {detailTab === 'aesthetic' && (
                      <div className="ws4-overview">
                        {(charDetail.aesthetic || charDetail.color_palette || charDetail.glam_energy) ? (
                          <>
                            {charDetail.aesthetic && <FieldCard label="Aesthetic" value={charDetail.aesthetic} />}
                            <div className="ws4-moral-grid">
                              {charDetail.glam_energy && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Glam Energy</div>
                                  <div className="ws4-moral-value">{charDetail.glam_energy}</div>
                                </div>
                              )}
                              {charDetail.color_palette && (
                                <div className="ws4-moral-card">
                                  <div className="ws4-moral-label">Color Palette</div>
                                  <div className="ws4-moral-value">{charDetail.color_palette}</div>
                                </div>
                              )}
                            </div>
                            {charDetail.signature_silhouette && <FieldCard label="Signature Silhouette" value={charDetail.signature_silhouette} />}
                            {charDetail.signature_accessories && <FieldCard label="Signature Accessories" value={charDetail.signature_accessories} />}
                          </>
                        ) : (
                          <div className="ws4-tab-empty">No aesthetic data yet. Use 🧠 Deepen to generate.</div>
                        )}
                      </div>
                    )}

                    {/* ── VOICE ────────────────────────────────────── */}
                    {detailTab === 'voice' && (
                      <div className="ws4-overview">
                        {(charDetail.speech_pattern || charDetail.vocabulary_tone || charDetail.catchphrases) ? (
                          <>
                            {charDetail.speech_pattern && <FieldCard label="Speech Pattern" value={charDetail.speech_pattern} />}
                            {charDetail.vocabulary_tone && <FieldCard label="Vocabulary Tone" value={charDetail.vocabulary_tone} />}
                            {charDetail.catchphrases && <FieldCard label="Catchphrases" value={charDetail.catchphrases} />}
                            {charDetail.internal_monologue_style && <FieldCard label="Internal Monologue" value={charDetail.internal_monologue_style} dimmed />}
                          </>
                        ) : (
                          <div className="ws4-tab-empty">No voice data yet. Use 🧠 Deepen to generate.</div>
                        )}
                      </div>
                    )}

                    {/* ── DESIRE ───────────────────────────────────── */}
                    {detailTab === 'desire' && (
                      <div className="ws4-desire">
                        {(charDetail.attracted_to || charDetail.how_they_love || charDetail.desire_they_wont_admit) ? (
                          <>
                            <FieldCard label="Attracted To" value={charDetail.attracted_to} />
                            <FieldCard label="How They Love" value={charDetail.how_they_love} />
                            <FieldCard label="What They Won't Admit" value={charDetail.desire_they_wont_admit} dimmed />
                            {charDetail.intimate_eligible && (
                              <>
                                <SectionLabel color="pink">Intimate Profile</SectionLabel>
                                <FieldCard label="Intimate Style" value={charDetail.intimate_style} />
                                <FieldCard label="Intimate Dynamic" value={charDetail.intimate_dynamic} />
                                <FieldCard label={`What ${curWorld.protagonist} Feels`} value={charDetail.what_lala_feels} />
                                <p className="ws4-intimate-note">
                                  Scene generation triggers inside Narrative Intelligence when tension reaches threshold.
                                </p>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="ws4-tab-empty">No desire profile data yet. Edit the character to add it.</div>
                        )}
                      </div>
                    )}

                    {/* ── RELATIONSHIPS ─────────────────────────────── */}
                    {detailTab === 'relationships' && (
                      <div className="ws4-relationships">
                        <div className="ws4-rel-header">
                          <span className="ws4-rel-count">{relGraph.length} relationship{relGraph.length !== 1 ? 's' : ''}</span>
                          <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => {
                            setRelForm(p => ({ ...p, series_layer: worldTag, related_character_id: '', related_character_name: '', history_summary: '', conflict_summary: '', family_role: '' }));
                            setShowAddRel(true);
                          }}>+ Add</button>
                        </div>

                        {relGraph.length === 0 ? (
                          <div className="ws4-tab-empty">No relationships logged yet.</div>
                        ) : relGraph.map((rel, i) => (
                          <div key={rel.rel_id || i} className="ws4-rel-card">
                            <div className="ws4-rel-card-top">
                              <AvatarCircle name={rel.character_name || '?'} size="sm" />
                              <div className="ws4-rel-card-info">
                                <div className="ws4-rel-card-name">{rel.character_name || '—'}</div>
                                <div className="ws4-rel-card-badges">
                                  <Badge variant="default">{rel.relationship_type?.replace(/_/g, ' ')}</Badge>
                                  {rel.current_status && <Badge variant="draft">{rel.current_status}</Badge>}
                                  {rel.is_romantic && <Badge variant="intimate">♡</Badge>}
                                  {rel.is_blood_relation && <Badge variant="primary">Blood</Badge>}
                                </div>
                              </div>
                              {rel.rel_id && (
                                <button className="ws4-rel-remove" onClick={() => deleteRelationship(rel.rel_id)}>✕</button>
                              )}
                            </div>
                            {rel.family_role && <div className="ws4-rel-family">Family role: {rel.family_role}</div>}
                            {rel.conflict_summary && <div className="ws4-rel-conflict">⚡ {rel.conflict_summary}</div>}
                            {rel.knows_about_connection && <div className="ws4-rel-awareness">👁 Knows about the connection</div>}
                            {rel.history_summary && <div className="ws4-rel-history">{rel.history_summary}</div>}
                          </div>
                        ))}

                        {charDetail.family_layer && (
                          <div className="ws4-family-layer">
                            <SectionLabel>Family in Franchise</SectionLabel>
                            <div className="ws4-family-layer-badge">
                              <Badge variant="primary">{charDetail.family_layer.replace(/_/g, ' ')}</Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── DEPTH ────────────────────────────────────── */}
                    {detailTab === 'depth' && (
                      <DepthPanel
                        registryCharId={charDetail?.registry_character_id}
                        onRefresh={() => loadCharDetail(selectedChar)}
                      />
                    )}

                    {/* ── DEMOGRAPHICS ─────────────────────────────── */}
                    {detailTab === 'demographics' && (
                      <DemographicsPanel charDetail={charDetail} />
                    )}

                    {/* ── SCENES (per-character) ─────────────────── */}
                    {detailTab === 'scenes' && (
                      <div className="ws4-char-scenes">
                        {charScenes.length === 0 ? (
                          <div className="ws4-tab-empty">
                            No scenes yet.
                            {charDetail.intimate_eligible && (
                              <button className="ws4-btn ws4-btn-primary ws4-btn-sm" style={{ marginTop: 12 }} onClick={() => generateScene(charDetail.id)}>
                                🔥 Generate First Scene
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {charScenes.map(s => (
                              <div key={s.id} className={`ws4-scene-card ${activeScene?.id === s.id ? 'ws4-scene-card-active' : ''}`} onClick={() => setActiveScene(s)}>
                                <div className="ws4-scene-card-top">
                                  <Badge variant="default">{s.scene_type?.replace(/_/g, ' ')}</Badge>
                                  <Badge variant="intimate">{s.intensity}</Badge>
                                  <Badge variant={s.status === 'approved' ? 'primary' : 'draft'}>{s.status}</Badge>
                                </div>
                                <div className="ws4-scene-card-preview">{(s.approach_text || s.scene_text || '').substring(0, 120)}…</div>
                                <div className="ws4-scene-card-date">{new Date(s.created_at).toLocaleDateString()}</div>
                              </div>
                            ))}
                            {charDetail.intimate_eligible && (
                              <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={() => generateScene(charDetail.id)} disabled={sceneGen.loading}>
                                + Generate Another Scene
                              </button>
                            )}
                          </>
                        )}

                        {/* Inline scene reader */}
                        {activeScene && (
                          <div className="ws4-scene-inline-reader">
                            <div className="ws4-scene-beat-label">The Approach</div>
                            <div className="ws4-scene-beat-text">{activeScene.approach_text}</div>
                            <div className="ws4-scene-beat-label">The Scene</div>
                            <div className="ws4-scene-beat-text">{activeScene.scene_text}</div>
                            <div className="ws4-scene-beat-label">The Aftermath</div>
                            <div className="ws4-scene-beat-text">{activeScene.aftermath_text}</div>
                            {activeScene.relationship_shift && <div className="ws4-scene-shift"><strong>Shift:</strong> {activeScene.relationship_shift}</div>}
                            <div className="ws4-scene-actions">
                              {activeScene.status === 'draft' && (
                                <>
                                  <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => approveScene(activeScene.id)}>Approve</button>
                                  <button className="ws4-btn ws4-btn-danger ws4-btn-sm" onClick={() => deleteScene(activeScene.id)}>Delete</button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── EVOLUTION TIMELINE ──────────────────────── */}
                    {detailTab === 'evolution' && (
                      <div className="ws4-evolution">
                        {charDetail.registry_character_id ? (
                          <>
                            <SectionLabel>Character Evolution</SectionLabel>
                            <div className="ws4-evolution-timeline">
                              <div className="ws4-evo-entry">
                                <div className="ws4-evo-dot" />
                                <div className="ws4-evo-content">
                                  <div className="ws4-evo-date">Created {new Date(charDetail.created_at).toLocaleDateString()}</div>
                                  <div className="ws4-evo-label">Generated as {charDetail.character_type?.replace(/_/g, ' ')}</div>
                                  <div className="ws4-evo-detail">Status: {charDetail.status} · World: {charDetail.world_tag}</div>
                                </div>
                              </div>
                              {charDetail.status === 'active' && (
                                <div className="ws4-evo-entry">
                                  <div className="ws4-evo-dot ws4-evo-dot-active" />
                                  <div className="ws4-evo-content">
                                    <div className="ws4-evo-label">Activated — now part of the living world</div>
                                  </div>
                                </div>
                              )}
                              {charDetail.is_alive === false && (
                                <div className="ws4-evo-entry">
                                  <div className="ws4-evo-dot ws4-evo-dot-dead" />
                                  <div className="ws4-evo-content">
                                    <div className="ws4-evo-label">† Deceased</div>
                                    {charDetail.death_cause && <div className="ws4-evo-detail">{charDetail.death_cause}</div>}
                                  </div>
                                </div>
                              )}
                              {charScenes.length > 0 && charScenes.map(s => (
                                <div key={s.id} className="ws4-evo-entry">
                                  <div className="ws4-evo-dot ws4-evo-dot-scene" />
                                  <div className="ws4-evo-content">
                                    <div className="ws4-evo-date">{new Date(s.created_at).toLocaleDateString()}</div>
                                    <div className="ws4-evo-label">Scene: {s.scene_type?.replace(/_/g, ' ')} ({s.intensity})</div>
                                    {s.relationship_shift && <div className="ws4-evo-detail">{s.relationship_shift}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="ws4-tab-empty">Activate this character to begin tracking evolution.</div>
                        )}
                      </div>
                    )}

                  </div>
                </>
              )}

              {/* Edit Form */}
              {editMode && (
                <div className="ws4-edit-form">
                  <CollapsibleSection title="Core Info" color="pink" defaultOpen={true}>
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'age_range', label: 'Age Range' },
                      { key: 'occupation', label: 'Occupation' },
                      { key: 'world_location', label: 'Location' },
                      { key: 'aesthetic', label: 'Aesthetic', long: true },
                      { key: 'surface_want', label: 'Surface Want', long: true },
                      { key: 'real_want', label: 'Real Want', long: true },
                      { key: 'what_they_want_from_lala', label: `Want From ${curWorld.protagonist}`, long: true },
                      { key: 'how_they_meet', label: 'How They Meet', long: true },
                      { key: 'dynamic', label: 'Dynamic', long: true },
                    ].map(f => (
                      <div key={f.key} className="ws4-edit-row">
                        <label className="ws4-edit-label">{f.label}</label>
                        {f.long
                          ? <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                          : <input className="ws4-input" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        }
                      </div>
                    ))}
                  </CollapsibleSection>

                  <CollapsibleSection title="Essence" color="lav" defaultOpen={false}>
                    {[
                      { key: 'character_archetype', label: 'Archetype' },
                      { key: 'emotional_baseline', label: 'Emotional Baseline' },
                      { key: 'core_fear', label: 'Core Fear', long: true },
                      { key: 'at_their_best', label: 'At Their Best', long: true },
                      { key: 'at_their_worst', label: 'At Their Worst', long: true },
                      { key: 'origin_story', label: 'Origin Story', long: true },
                      { key: 'public_persona', label: 'Public Persona', long: true },
                      { key: 'private_reality', label: 'Private Reality', long: true },
                      { key: 'arc_role', label: 'Arc Role', long: true },
                      { key: 'career_goal', label: 'Career Goal', long: true },
                    ].map(f => (
                      <div key={f.key} className="ws4-edit-row">
                        <label className="ws4-edit-label">{f.label}</label>
                        {f.long
                          ? <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                          : <input className="ws4-input" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        }
                      </div>
                    ))}
                  </CollapsibleSection>

                  <CollapsibleSection title="Aesthetic DNA" color="blue" defaultOpen={false}>
                    {[
                      { key: 'color_palette', label: 'Color Palette' },
                      { key: 'glam_energy', label: 'Glam Energy' },
                      { key: 'signature_silhouette', label: 'Signature Silhouette', long: true },
                      { key: 'signature_accessories', label: 'Signature Accessories', long: true },
                    ].map(f => (
                      <div key={f.key} className="ws4-edit-row">
                        <label className="ws4-edit-label">{f.label}</label>
                        {f.long
                          ? <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                          : <input className="ws4-input" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        }
                      </div>
                    ))}
                  </CollapsibleSection>

                  <CollapsibleSection title="Voice" color="lav" defaultOpen={false}>
                    {[
                      { key: 'speech_pattern', label: 'Speech Pattern', long: true },
                      { key: 'vocabulary_tone', label: 'Vocabulary Tone', long: true },
                      { key: 'catchphrases', label: 'Catchphrases', long: true },
                      { key: 'internal_monologue_style', label: 'Internal Monologue Style', long: true },
                    ].map(f => (
                      <div key={f.key} className="ws4-edit-row">
                        <label className="ws4-edit-label">{f.label}</label>
                        <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </CollapsibleSection>

                  <CollapsibleSection title="Desire & Intimacy" color="pink" defaultOpen={false}>
                    {[
                      { key: 'attracted_to', label: 'Attracted To', long: true },
                      { key: 'how_they_love', label: 'How They Love', long: true },
                      { key: 'desire_they_wont_admit', label: "What They Won't Admit", long: true },
                      { key: 'intimate_style', label: 'Intimate Style', long: true },
                      { key: 'intimate_dynamic', label: 'Intimate Dynamic', long: true },
                      { key: 'what_lala_feels', label: `What ${curWorld.protagonist} Feels`, long: true },
                    ].map(f => (
                      <div key={f.key} className="ws4-edit-row">
                        <label className="ws4-edit-label">{f.label}</label>
                        <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                    <div className="ws4-edit-row">
                      <label className="ws4-checkbox-label">
                        <input type="checkbox" checked={editForm.intimate_eligible || false} onChange={e => setEditForm(p => ({ ...p, intimate_eligible: e.target.checked }))} />
                        Intimate Eligible
                      </label>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Moral & Relationship" color="gold" defaultOpen={false}>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Sexuality</label>
                      <select className="ws4-select" value={editForm.sexuality || ''} onChange={e => setEditForm(p => ({ ...p, sexuality: e.target.value }))}>
                        <option value="">—</option>
                        {['straight','gay','lesbian','bisexual','pansexual','queer','fluid'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Relationship Status</label>
                      <select className="ws4-select" value={editForm.relationship_status || ''} onChange={e => setEditForm(p => ({ ...p, relationship_status: e.target.value }))}>
                        <option value="">—</option>
                        {['single','dating','engaged','married','divorced','separated','its_complicated'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Committed To</label>
                      <input className="ws4-input" value={editForm.committed_to || ''} onChange={e => setEditForm(p => ({ ...p, committed_to: e.target.value }))} placeholder="Name of person they're committed to" />
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Fidelity Pattern</label>
                      <select className="ws4-select" value={editForm.fidelity_pattern || ''} onChange={e => setEditForm(p => ({ ...p, fidelity_pattern: e.target.value }))}>
                        <option value="">—</option>
                        {Object.entries(FIDELITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Tension Type</label>
                      <select className="ws4-select" value={editForm.tension_type || ''} onChange={e => setEditForm(p => ({ ...p, tension_type: e.target.value }))}>
                        <option value="">—</option>
                        {['romantic','professional','creative','power','unspoken','moral','fidelity','temptation','betrayal','guilt'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Moral Code</label>
                      <textarea className="ws4-textarea" value={editForm.moral_code || ''} onChange={e => setEditForm(p => ({ ...p, moral_code: e.target.value }))} />
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Exit Reason</label>
                      <textarea className="ws4-textarea" value={editForm.exit_reason || ''} onChange={e => setEditForm(p => ({ ...p, exit_reason: e.target.value }))} />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Identity & Life" color="blue" defaultOpen={false}>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Gender</label>
                      <input className="ws4-input" list="gender-opts" value={editForm.gender || ''} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} />
                      <datalist id="gender-opts">{['Male','Female','Non-binary','Trans man','Trans woman','Genderfluid','Agender'].map(g => <option key={g} value={g} />)}</datalist>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Ethnicity</label>
                      <input className="ws4-input" value={editForm.ethnicity || ''} onChange={e => setEditForm(p => ({ ...p, ethnicity: e.target.value }))} placeholder="e.g. Black, Korean, Mixed-race..." />
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Species</label>
                      <input className="ws4-input" list="species-opts" value={editForm.species || 'human'} onChange={e => setEditForm(p => ({ ...p, species: e.target.value }))} />
                      <datalist id="species-opts">{['human','vampire','werewolf','fae','demon','angel','hybrid','shifter','witch','god'].map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-edit-label">Family Layer</label>
                      <select className="ws4-select" value={editForm.family_layer || worldTag} onChange={e => setEditForm(p => ({ ...p, family_layer: e.target.value }))}>
                        <option value="real_world">Real World</option>
                        <option value="lalaverse">LalaVerse</option>
                        <option value="book-1">Book 1 · Before Lala</option>
                        <option value="series_2">Series 2</option>
                      </select>
                    </div>
                    <div className="ws4-edit-row">
                      <label className="ws4-checkbox-label">
                        <input type="checkbox" checked={editForm.is_alive !== false} onChange={e => setEditForm(p => ({ ...p, is_alive: e.target.checked }))} />
                        Character is alive
                      </label>
                    </div>
                    {editForm.is_alive === false && (
                      <>
                        <div className="ws4-edit-row">
                          <label className="ws4-edit-label">Cause of Death</label>
                          <textarea className="ws4-textarea" value={editForm.death_cause || ''} onChange={e => setEditForm(p => ({ ...p, death_cause: e.target.value }))} placeholder="How did they die?" />
                        </div>
                        <div className="ws4-edit-row">
                          <label className="ws4-edit-label">Narrative Impact</label>
                          <textarea className="ws4-textarea" value={editForm.death_impact || ''} onChange={e => setEditForm(p => ({ ...p, death_impact: e.target.value }))} placeholder="What does their death mean for the story?" />
                        </div>
                      </>
                    )}
                  </CollapsibleSection>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ═══ COMPARE PANEL ═══════════════════════════════════════════ */}
      {compareChar && charDetail && compareDetail && compareDetail.id !== charDetail.id && (
        <div className="ws4-compare-panel">
          <div className="ws4-compare-header">
            <span>⇄ Comparing</span>
            <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => setCompareChar(null)}>✕ Close</button>
          </div>
          <div className="ws4-compare-grid">
            {[charDetail, compareDetail].map(c => (
              <div key={c.id} className="ws4-compare-col">
                <div className="ws4-compare-name">{c.name}</div>
                <div className="ws4-compare-sub">{c.character_type?.replace(/_/g, ' ')} · {c.occupation}</div>
                {[
                  ['Aesthetic', c.aesthetic],
                  ['Surface Want', c.surface_want],
                  ['Real Want', c.real_want],
                  ['Dynamic', c.dynamic],
                  ['Sexuality', c.sexuality],
                  ['Fidelity', FIDELITY_LABELS[c.fidelity_pattern]?.label || c.fidelity_pattern],
                  ['Moral Code', c.moral_code],
                  ['How They Love', c.how_they_love],
                  ['Tension', c.tension_type],
                  ['Arc Role', c.arc_role],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="ws4-compare-field">
                    <div className="ws4-compare-field-label">{label}</div>
                    <div className="ws4-compare-field-value">{val}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="ws4-compare-pick">
            <span>Compare with:</span>
            <select className="ws4-select" value={compareChar} onChange={e => setCompareChar(e.target.value)}>
              {characters.filter(c => c.id !== charDetail.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ═══ PREVIEW MODAL ════════════════════════════════════════════ */}
      {showPreview && (
        <div className="ws4-overlay" onClick={() => !confirming && setShowPreview(false)}>
          <div className="ws4-modal ws4-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="ws4-modal-header">
              <div className="ws4-modal-title">{curWorld.icon} Preview — {curWorld.label}</div>
              <div className="ws4-modal-sub">
                {previewChars.length} characters generated · {previewSel.size} selected · Deselect any you don't want, then confirm.
              </div>
            </div>
            {previewNotes && <div className="ws4-modal-notes">{previewNotes}</div>}
            <div className="ws4-preview-grid">
              {previewChars.map((c, i) => (
                <div
                  key={i}
                  className={`ws4-preview-card ${previewSel.has(i) ? 'ws4-preview-card-selected' : ''}`}
                  onClick={() => setPreviewSel(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                >
                  <div className="ws4-preview-card-top">
                    <AvatarCircle name={c.name} />
                    <div className={`ws4-preview-check ${previewSel.has(i) ? 'ws4-preview-check-on' : ''}`}>
                      {previewSel.has(i) && '✓'}
                    </div>
                  </div>
                  <div className="ws4-preview-name">{c.name}</div>
                  <div className="ws4-preview-meta">{c.age_range} · {c.occupation}</div>
                  <div className="ws4-preview-badges">
                    <TypeBadge type={c.character_type} />
                    {c.intimate_eligible && <Badge variant="intimate">♡</Badge>}
                    {c.sexuality && <Badge variant="identity">{c.sexuality}</Badge>}
                  </div>
                  {c.signature && <div className="ws4-preview-sig">"{c.signature}"</div>}
                  {c.dynamic && <div className="ws4-preview-dynamic">{c.dynamic}</div>}
                  <div className="ws4-preview-wants">
                    {c.surface_want && <div className="ws4-preview-want"><span className="ws4-preview-want-label">Wants:</span> {c.surface_want}</div>}
                    {c.real_want && <div className="ws4-preview-want ws4-preview-want-real"><span className="ws4-preview-want-label">Really:</span> {c.real_want}</div>}
                  </div>
                  {c.aesthetic && <div className="ws4-preview-aesthetic">{c.aesthetic}</div>}
                </div>
              ))}
            </div>
            <div className="ws4-modal-footer">
              <span className="ws4-modal-count">{previewSel.size} of {previewChars.length} selected</span>
              <div className="ws4-modal-actions">
                <button className="ws4-btn ws4-btn-ghost" onClick={() => setShowPreview(false)}>Cancel</button>
                <button className="ws4-btn ws4-btn-primary" disabled={confirming || !previewSel.size} onClick={confirmPreview}>
                  {confirming ? 'Committing…' : `Confirm ${previewSel.size} Characters`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD RELATIONSHIP MODAL ═══════════════════════════════════ */}
      {showAddRel && (
        <div className="ws4-overlay" onClick={() => setShowAddRel(false)}>
          <div className="ws4-modal" onClick={e => e.stopPropagation()}>
            <div className="ws4-modal-header">
              <div className="ws4-modal-title">Add Relationship</div>
            </div>

            <div className="ws4-form">
              <div className="ws4-form-row">
                <label className="ws4-form-label">Character Name</label>
                <input className="ws4-input" placeholder="Name or describe…" value={relForm.related_character_name} onChange={e => setRelForm(p => ({ ...p, related_character_name: e.target.value }))} />
              </div>
              <div className="ws4-form-row">
                <label className="ws4-form-label">Character (if in World Studio)</label>
                <select className="ws4-select" value={relForm.related_character_id}
                  onChange={e => {
                    const char = characters.find(c => c.id === e.target.value);
                    setRelForm(p => ({ ...p, related_character_id: e.target.value, related_character_name: char ? char.name : p.related_character_name }));
                  }}>
                  <option value="">— Select existing —</option>
                  {characters.filter(c => c.id !== selectedChar).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="ws4-form-row">
                <label className="ws4-form-label">Relationship Type</label>
                <div className="ws4-filter-pills ws4-filter-pills-sm">
                  {['family','romantic_history','friendship','rivalry','professional','estranged'].map(t => (
                    <button key={t} className={`ws4-pill ${relForm.relationship_type === t ? 'ws4-pill-active' : ''}`} onClick={() => setRelForm(p => ({ ...p, relationship_type: t }))}>
                      {t.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              {relForm.relationship_type === 'family' && (
                <div className="ws4-form-row">
                  <label className="ws4-form-label">Family Role</label>
                  <input className="ws4-input" placeholder="mother, sister, cousin, aunt…" value={relForm.family_role} onChange={e => setRelForm(p => ({ ...p, family_role: e.target.value }))} />
                </div>
              )}
              <div className="ws4-form-row">
                <label className="ws4-form-label">History Summary</label>
                <textarea className="ws4-textarea" placeholder="What happened between them…" value={relForm.history_summary} onChange={e => setRelForm(p => ({ ...p, history_summary: e.target.value }))} />
              </div>
              <div className="ws4-form-two-col">
                <div className="ws4-form-row">
                  <label className="ws4-form-label">Current Status</label>
                  <select className="ws4-select" value={relForm.current_status} onChange={e => setRelForm(p => ({ ...p, current_status: e.target.value }))}>
                    {['active','close','complicated','estranged','ended','unknown'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="ws4-form-row">
                  <label className="ws4-form-label">Franchise Layer</label>
                  <select className="ws4-select" value={relForm.series_layer} onChange={e => setRelForm(p => ({ ...p, series_layer: e.target.value }))}>
                    <option value="lalaverse">LalaVerse</option>
                    <option value="book-1">Book 1 · Before Lala</option>
                    <option value="real_world">Real World</option>
                    <option value="series_2">Series 2</option>
                  </select>
                </div>
              </div>
              <div className="ws4-checkboxes">
                {[
                  ['romantic_eligible','Romantic eligible'],
                  ['knows_about_transfer','Knows about transfer'],
                  ['is_blood_relation','Blood relation'],
                  ['is_romantic','Romantic'],
                  ['knows_about_connection','Knows about connection'],
                ].map(([key, label]) => (
                  <label key={key} className="ws4-checkbox-label">
                    <input type="checkbox" checked={!!relForm[key]} onChange={e => setRelForm(p => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="ws4-form-row">
                <label className="ws4-form-label">Conflict Summary</label>
                <textarea className="ws4-textarea" placeholder="The conflict between them…" value={relForm.conflict_summary} onChange={e => setRelForm(p => ({ ...p, conflict_summary: e.target.value }))} />
              </div>
            </div>

            <div className="ws4-modal-footer">
              <div />
              <div className="ws4-modal-actions">
                <button className="ws4-btn ws4-btn-ghost" onClick={() => setShowAddRel(false)}>Cancel</button>
                <button className="ws4-btn ws4-btn-primary" disabled={savingRel || !relForm.relationship_type} onClick={addRelationship}>
                  {savingRel ? 'Saving…' : 'Add Relationship'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </>

      {/* Toast */}
      {toast && (
        <div className={`ws4-toast ${toast.type === 'error' ? 'ws4-toast-error' : 'ws4-toast-success'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}