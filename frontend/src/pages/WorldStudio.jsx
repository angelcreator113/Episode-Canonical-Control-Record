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
import SocialProfileGenerator from './SocialProfileGenerator';
import RelationshipEngine from './RelationshipEngine';
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

/* ── Detail tabs ─────────────────────────────────────────────────────── */
const DETAIL_TABS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'desire',        label: 'Desire' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'scenes',        label: 'Scenes' },
  { key: 'depth',         label: 'Depth' },
  { key: 'demographics',  label: 'Demographics' },
  { key: 'evolution',     label: 'Evolution' },
];

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

/* ── Depth dimension config ──────────────────────────────────────────── */
const DEPTH_DIMS = [
  { key: 'joy',         label: 'The Experience of Joy',      fields: ['de_joy_source','de_joy_accessibility','de_joy_vs_ambition'],      color: 'gold' },
  { key: 'body',        label: 'The Body',                   fields: ['de_body_relationship','de_body_history','de_body_currency','de_body_control_pattern'], color: 'pink' },
  { key: 'money',       label: 'Money as Behavior',          fields: ['de_money_behavior_pattern','de_money_behavior_note'],              color: 'blue' },
  { key: 'time',        label: 'Time Orientation',           fields: ['de_time_orientation_v2','de_time_orientation_note'],               color: 'lav' },
  { key: 'change',      label: 'Change Capacity',            fields: ['de_change_capacity_v2','de_change_conditions','de_change_blocker'], color: 'blue' },
  { key: 'luck',        label: 'Luck & Circumstance',        fields: ['de_circumstance_advantages','de_circumstance_disadvantages','de_luck_belief','de_luck_belief_vs_stated'], color: 'gold' },
  { key: 'narrative',   label: 'Self vs Actual Narrative',   fields: ['de_self_narrative','de_actual_narrative','de_narrative_gap_type'],  color: 'pink', authorOnly: true },
  { key: 'blind_spot',  label: 'Blind Spot',                 fields: ['de_blind_spot','de_blind_spot_category'],                         color: 'lav',  authorOnly: true },
  { key: 'cosmology',   label: 'Operative Cosmology',        fields: ['de_operative_cosmology_v2','de_cosmology_vs_stated_religion'],      color: 'gold' },
  { key: 'foreclosed',  label: 'Foreclosed Possibility',     fields: ['de_foreclosed_category','de_foreclosure_origin','de_foreclosure_vs_stated_want'], color: 'pink', authorOnly: true },
];

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

/* ═══════════════════════════════════════════════════════════════════════
   DEPTH PANEL
═══════════════════════════════════════════════════════════════════════ */
function DepthPanel({ charDetail, charId, onRefresh }) {
  const [generating, setGenerating] = useState(false);
  const [genDim, setGenDim]         = useState(null);
  const [preview, setPreview]       = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash]           = useState(null);

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3000);
  };

  const generateAll = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/character-depth/${charId}/generate`, { method: 'POST' });
      const d = await r.json();
      if (d.depth) { setPreview(d.depth); }
      else showFlash(d.error || 'Generation failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const generateDim = async (dim) => {
    setGenDim(dim);
    try {
      const r = await fetch(`${API}/character-depth/${charId}/generate/${dim}`, { method: 'POST' });
      const d = await r.json();
      if (d.depth) setPreview(d.depth);
      else showFlash(d.error || 'Generation failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setGenDim(null); }
  };

  const confirmDepth = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const r = await fetch(`${API}/character-depth/${charId}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depth: preview }),
      });
      const d = await r.json();
      if (d.success) {
        showFlash('Depth profile saved');
        setPreview(null);
        onRefresh();
      } else showFlash(d.error || 'Confirm failed', 'error');
    } catch (e) { showFlash(e.message, 'error'); }
    finally { setConfirming(false); }
  };

  const source = preview || charDetail;
  const hasAnyDepth = DEPTH_DIMS.some(d => d.fields.some(f => charDetail?.[f]));

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
                  if (!val) return null;
                  const label = f.replace(/^de_/, '').replace(/_v2$/, '').replace(/_/g, ' ');
                  return (
                    <div key={f} className="ws4-depth-field">
                      <span className="ws4-depth-field-label">{label}</span>
                      <span className="ws4-depth-field-value">{val}</span>
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

  /* ── Top-level page tab ─────────────────────────────────────────────── */
  const [pageTab, setPageTab] = useState('characters');

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

  /* ── Scenes ────────────────────────────────────────────────────────── */
  const [charScenes,     setCharScenes]     = useState([]);
  const [tensionPairs,   setTensionPairs]   = useState([]);
  const [sceneGen,       setSceneGen]       = useState({ loading: false, charB: '', sceneType: 'hook_up', location: '' });
  const [activeScene,    setActiveScene]    = useState(null);

  /* ── Batches ──────────────────────────────────────────────────────── */
  const [batches,        setBatches]        = useState([]);

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
  }, [worldTag]);

  useEffect(() => { setCurrentPage(1); }, [charSearch, charFilter]);
  useEffect(() => { if (selectedChar) loadCharDetail(selectedChar); }, [selectedChar]);

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
    await fetch(`${API}/world/characters/${id}/activate`, { method: 'POST' });
    flash('Character activated');
    loadCharacters();
    if (selectedChar === id) loadCharDetail(id);
  };

  const archiveChar = async (id) => {
    await fetch(`${API}/world/characters/${id}/archive`, { method: 'POST' });
    flash('Character archived');
    setSelectedChar(null); setCharDetail(null); loadCharacters();
  };

  const deleteChar = async (id) => {
    if (!window.confirm('Delete this character permanently?')) return;
    await fetch(`${API}/world/characters/${id}`, { method: 'DELETE' });
    flash('Character deleted');
    setSelectedChar(null); setCharDetail(null); loadCharacters();
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
    await fetch(`${API}/world/characters/${selectedChar}/relationships/${relId}`, { method: 'DELETE' });
    flash('Relationship removed');
    loadCharDetail(selectedChar);
  };

  /* ── Scene loaders & actions ──────────────────────────────────────── */
  const loadCharScenes = useCallback(async (charId) => {
    try {
      const r = await fetch(`${API}/world/scenes?character_id=${charId}`);
      const d = await r.json();
      setCharScenes(d.scenes || []);
    } catch { setCharScenes([]); }
  }, []);

  const loadTensionPairs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/tension-check`);
      const d = await r.json();
      setTensionPairs(d.pairs || []);
    } catch { setTensionPairs([]); }
  }, []);

  const generateScene = async (charAId) => {
    setSceneGen(p => ({ ...p, loading: true }));
    try {
      const r = await fetch(`${API}/world/scenes/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_a_id: charAId,
          character_b_id: sceneGen.charB || undefined,
          scene_type: sceneGen.sceneType,
          location: sceneGen.location || undefined,
        }),
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
      if (d.scene) { flash('Scene approved & written to StoryTeller'); setActiveScene(d.scene); if (selectedChar) loadCharScenes(selectedChar); }
      else flash(d.error || 'Approve failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
  };

  const deleteScene = async (sceneId) => {
    if (!window.confirm('Delete this scene draft?')) return;
    await fetch(`${API}/world/scenes/${sceneId}`, { method: 'DELETE' });
    flash('Scene deleted'); setActiveScene(null);
    if (selectedChar) loadCharScenes(selectedChar);
  };

  // Load scenes when switching to scenes detail tab
  useEffect(() => {
    if (detailTab === 'scenes' && selectedChar) loadCharScenes(selectedChar);
  }, [detailTab, selectedChar]);

  /* ── Batch loader ────────────────────────────────────────────────── */
  const loadBatches = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/batches`);
      const d = await r.json();
      setBatches(d.batches || []);
    } catch { setBatches([]); }
  }, []);

  useEffect(() => { if (pageTab === 'characters' && !selectedChar) loadBatches(); }, [pageTab, selectedChar]);

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
    if (charSearch && !(c.name || '').toLowerCase().includes(charSearch.toLowerCase())) return false;
    return true;
  });
  const uniqueTypes = [...new Set(characters.map(c => c.character_type).filter(Boolean))];
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const relGraph    = charDetail ? (
    typeof charDetail.relationship_graph === 'string'
      ? JSON.parse(charDetail.relationship_graph || '[]')
      : (charDetail.relationship_graph || [])
  ) : [];
  const draftCount  = characters.filter(c => c.status === 'draft').length;

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="ws4-page">

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="ws4-page-header">
        <div className="ws4-header-row">
          <div className="ws4-header-title-block">
            <div className="ws4-breadcrumb">
              <span className="ws4-breadcrumb-link" onClick={() => navigate('/')}>Home</span>
              <span className="ws4-breadcrumb-sep">/</span>
              <span className="ws4-breadcrumb-current">World Studio</span>
            </div>
            <h1 className="ws4-page-title">World Studio</h1>
          </div>

          {/* Top-level tabs — three creation flows */}
          <nav className="ws4-page-tabs">
            {[
              { key: 'characters',    label: 'Characters',    icon: '◈' },
              { key: 'scenes',        label: 'Scenes',        icon: '🔥' },
              { key: 'feed',          label: 'The Feed',      icon: '📱' },
              { key: 'relationships', label: 'Relationships', icon: '🔗' },
            ].map(t => (
              <button
                key={t.key}
                className={`ws4-page-tab ${pageTab === t.key ? 'ws4-page-tab-active' : ''}`}
                onClick={() => {
                  setPageTab(t.key);
                  setSelectedChar(null);
                  setCharDetail(null);
                  setCharFilter('all');
                }}
              >
                <span className="ws4-page-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Action buttons — Characters tab only */}
          {pageTab === 'characters' && (
            <div className="ws4-header-actions">
              {/* World switcher — now lives here, inside Characters tab */}
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
              {draftCount > 0 && (
                <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={bulkActivate} disabled={bulkActivating}>
                  {bulkActivating ? '…' : `✓ Activate ${draftCount}`}
                </button>
              )}
              {worldTag !== 'all' && (
                <button className="ws4-btn ws4-btn-primary" onClick={generatePreview} disabled={generating}>
                  {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SCENES TAB (Intimate Scene Studio) ─────────────────────── */}
      {pageTab === 'scenes' && (
        <div className="ws4-scenes-tab">
          <div className="ws4-scenes-header">
            <h2 className="ws4-section-title">Intimate Scene Studio</h2>
            <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={loadTensionPairs}>Scan Tension</button>
          </div>

          {/* Tension pairs */}
          {tensionPairs.length > 0 && (
            <div className="ws4-tension-grid">
              <SectionLabel color="pink">Tension Triggers</SectionLabel>
              {tensionPairs.map((p, i) => (
                <div key={i} className="ws4-tension-card">
                  <div className="ws4-tension-names">{p.character_a_name} ↔ {p.character_b_name}</div>
                  <div className="ws4-tension-badges">
                    <Badge variant="intimate">{p.tension_state}</Badge>
                    <Badge variant="default">{p.relationship_type}</Badge>
                  </div>
                  {p.situation && <div className="ws4-tension-situation">{p.situation}</div>}
                  <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => {
                    setSceneGen(g => ({ ...g, charB: p.character_b_id }));
                    generateScene(p.character_a_id);
                  }}>Generate Scene</button>
                </div>
              ))}
            </div>
          )}

          {/* Scene reader */}
          {activeScene && (
            <div className="ws4-scene-reader">
              <div className="ws4-scene-reader-header">
                <h3>{activeScene.character_a_name} {activeScene.character_b_name ? `& ${activeScene.character_b_name}` : ''}</h3>
                <div className="ws4-scene-meta">
                  <Badge variant="default">{activeScene.scene_type?.replace(/_/g, ' ')}</Badge>
                  <Badge variant="intimate">{activeScene.intensity}</Badge>
                  <Badge variant={activeScene.status === 'approved' ? 'primary' : 'draft'}>{activeScene.status}</Badge>
                </div>
              </div>

              {activeScene.approach_text && (
                <div className="ws4-scene-beat">
                  <div className="ws4-scene-beat-label">The Approach</div>
                  <div className="ws4-scene-beat-text">{activeScene.approach_text}</div>
                </div>
              )}
              {activeScene.scene_text && (
                <div className="ws4-scene-beat ws4-scene-beat-main">
                  <div className="ws4-scene-beat-label">The Scene</div>
                  <div className="ws4-scene-beat-text">{activeScene.scene_text}</div>
                </div>
              )}
              {activeScene.aftermath_text && (
                <div className="ws4-scene-beat">
                  <div className="ws4-scene-beat-label">The Aftermath</div>
                  <div className="ws4-scene-beat-text">{activeScene.aftermath_text}</div>
                </div>
              )}

              {activeScene.relationship_shift && (
                <div className="ws4-scene-shift">
                  <strong>What shifted:</strong> {activeScene.relationship_shift}
                </div>
              )}

              <div className="ws4-scene-actions">
                {activeScene.status === 'draft' && (
                  <>
                    <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => approveScene(activeScene.id)}>
                      Approve & Write to StoryTeller
                    </button>
                    <button className="ws4-btn ws4-btn-danger ws4-btn-sm" onClick={() => deleteScene(activeScene.id)}>Delete</button>
                  </>
                )}
                {activeScene.status === 'approved' && (
                  <span className="ws4-scene-approved-note">Written to StoryTeller</span>
                )}
              </div>
            </div>
          )}

          {/* Quick generate */}
          <div className="ws4-scene-generate-box">
            <SectionLabel>Generate New Scene</SectionLabel>
            <div className="ws4-scene-gen-form">
              <select className="ws4-select" value={sceneGen.charB} onChange={e => setSceneGen(p => ({ ...p, charB: e.target.value }))}>
                <option value="">Select Character B…</option>
                {characters.filter(c => c.status === 'active' && c.intimate_eligible).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="ws4-select" value={sceneGen.sceneType} onChange={e => setSceneGen(p => ({ ...p, sceneType: e.target.value }))}>
                {['hook_up','first_encounter','charged_moment','recurring','one_night_stand'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <input className="ws4-input" placeholder="Location (optional)" value={sceneGen.location} onChange={e => setSceneGen(p => ({ ...p, location: e.target.value }))} />
              <button className="ws4-btn ws4-btn-primary" onClick={() => {
                const charA = characters.find(c => c.status === 'active' && c.intimate_eligible && c.id !== sceneGen.charB);
                if (charA) generateScene(charA.id);
                else flash('No eligible character A found', 'error');
              }} disabled={sceneGen.loading}>
                {sceneGen.loading ? '⏳ Generating…' : '🔥 Generate Scene'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FEED TAB ────────────────────────────────────────────────── */}
      {pageTab === 'feed' && (
        <div className="ws4-feed-tab">
          <SocialProfileGenerator embedded={true} />
        </div>
      )}

      {/* ── RELATIONSHIPS TAB ───────────────────────────────────────── */}
      {pageTab === 'relationships' && (
        <div className="ws4-relationships-tab">
          <RelationshipEngine embedded={true} defaultWorldTag={worldTag} />
        </div>
      )}

      {/* ── CHARACTERS TAB ──────────────────────────────────────────── */}
      {pageTab === 'characters' && (
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
              ) : paged.map(c => (
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
                    </div>
                  </div>
                </div>
              ))}
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
                    {characters.filter(c => c.relationship_graph && (
                      typeof c.relationship_graph === 'string' ? JSON.parse(c.relationship_graph || '[]') : c.relationship_graph
                    ).length > 0).slice(0, 12).map(c => {
                      const rels = typeof c.relationship_graph === 'string' ? JSON.parse(c.relationship_graph || '[]') : (c.relationship_graph || []);
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
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => setCompareChar(compareChar ? null : charDetail.id)}>
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
                  <div className="ws4-tabs">
                    {DETAIL_TABS.map(t => (
                      <button
                        key={t.key}
                        className={`ws4-tab ${detailTab === t.key ? 'ws4-tab-active' : ''}`}
                        onClick={() => setDetailTab(t.key)}
                      >
                        {t.label}
                      </button>
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
                        </div>
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
                          <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => setShowAddRel(true)}>+ Add</button>
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
                        charDetail={charDetail}
                        charId={selectedChar}
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
                  {[
                    { key: 'name',                     label: 'Name' },
                    { key: 'age_range',                label: 'Age Range' },
                    { key: 'occupation',               label: 'Occupation' },
                    { key: 'world_location',           label: 'Location' },
                    { key: 'aesthetic',                label: 'Aesthetic',                          long: true },
                    { key: 'surface_want',             label: 'Surface Want',                       long: true },
                    { key: 'real_want',                label: 'Real Want',                          long: true },
                    { key: 'what_they_want_from_lala', label: `Want From ${curWorld.protagonist}`,  long: true },
                    { key: 'how_they_meet',            label: 'How They Meet',                      long: true },
                    { key: 'dynamic',                  label: 'Dynamic',                            long: true },
                    { key: 'intimate_style',           label: 'Intimate Style',                     long: true },
                    { key: 'attracted_to',             label: 'Attracted To',                       long: true },
                    { key: 'how_they_love',            label: 'How They Love',                      long: true },
                    { key: 'desire_they_wont_admit',   label: "What They Won't Admit",               long: true },
                    { key: 'origin_story',             label: 'Origin Story',                       long: true },
                    { key: 'public_persona',           label: 'Public Persona',                     long: true },
                    { key: 'private_reality',          label: 'Private Reality',                    long: true },
                    { key: 'arc_role',                 label: 'Arc Role',                           long: true },
                    { key: 'intimate_dynamic',         label: 'Intimate Dynamic',                   long: true },
                    { key: 'what_lala_feels',          label: `What ${curWorld.protagonist} Feels`,  long: true },
                    { key: 'moral_code',               label: 'Moral Code',                         long: true },
                    { key: 'exit_reason',              label: 'Exit Reason',                        long: true },
                  ].map(f => (
                    <div key={f.key} className="ws4-edit-row">
                      <label className="ws4-edit-label">{f.label}</label>
                      {f.long
                        ? <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        : <input className="ws4-input" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}

                  <div className="ws4-edit-section">Moral & Relationship</div>
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
                    <label className="ws4-checkbox-label">
                      <input type="checkbox" checked={editForm.intimate_eligible || false} onChange={e => setEditForm(p => ({ ...p, intimate_eligible: e.target.checked }))} />
                      Intimate Eligible
                    </label>
                  </div>

                  <div className="ws4-edit-section">Identity</div>
                  <div className="ws4-edit-row">
                    <label className="ws4-edit-label">Gender</label>
                    <input className="ws4-input" list="gender-opts" value={editForm.gender || ''} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} />
                    <datalist id="gender-opts">{['Male','Female','Non-binary','Trans man','Trans woman','Genderfluid','Agender'].map(g => <option key={g} value={g} />)}</datalist>
                  </div>
                  <div className="ws4-edit-row">
                    <label className="ws4-edit-label">Ethnicity</label>
                    <input className="ws4-input" value={editForm.ethnicity || ''} onChange={e => setEditForm(p => ({ ...p, ethnicity: e.target.value }))} placeholder="e.g. Black, Korean, Mixed-race…" />
                  </div>
                  <div className="ws4-edit-row">
                    <label className="ws4-edit-label">Species</label>
                    <input className="ws4-input" list="species-opts" value={editForm.species || 'human'} onChange={e => setEditForm(p => ({ ...p, species: e.target.value }))} />
                    <datalist id="species-opts">{['human','vampire','werewolf','fae','demon','angel','hybrid','shifter','witch','god'].map(s => <option key={s} value={s} />)}</datalist>
                  </div>

                  <div className="ws4-edit-section">Life Status</div>
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

                  <div className="ws4-edit-row">
                    <label className="ws4-edit-label">Family Layer</label>
                    <select className="ws4-select" value={editForm.family_layer || worldTag} onChange={e => setEditForm(p => ({ ...p, family_layer: e.target.value }))}>
                      <option value="real_world">Real World</option>
                      <option value="lalaverse">LalaVerse</option>
                      <option value="book-1">Book 1 · Before Lala</option>
                      <option value="series_2">Series 2</option>
                    </select>
                  </div>
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
                  </div>
                  {c.signature && <div className="ws4-preview-sig">"{c.signature}"</div>}
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
      ) /* end characters tab */}

      {/* Toast */}
      {toast && (
        <div className={`ws4-toast ${toast.type === 'error' ? 'ws4-toast-error' : 'ws4-toast-success'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}