/**
 * WorldStudio.jsx  v4.0 — Refactored to match Prime Studios design system
 *
 * Changes from v3.1:
 *  - Header stripped: world picker + action buttons now live in a clean sub-bar
 *  - Stats bar redesigned to match Character Registry style
 *  - Sidebar search + filter pills match Character Registry patterns
 *  - Character cards redesigned: avatar initials, occupation subtitle, role badge
 *  - Detail pane tabs: Overview · Desire · Relationships · Depth · Demographics
 *  - Depth panel: reads de_* fields from character (populated via /character-depth)
 *  - Demographics panel: age, city, class, family, career
 *  - "Add Relationship" modal cleaned up
 *  - Preview modal grid: card-first layout matching Generate Ecosystem preview
 *  - Removed: duplicate registry tab (lives at /character-registry)
 *  - Added: breadcrumb, proper page header matching app frame
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
  { key: 'depth',         label: 'Depth' },
  { key: 'demographics',  label: 'Demographics' },
];

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
  const [pageTab, setPageTab] = useState('lalaverse');

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

  /* ── Locations / World State / Tensions ──────────────────────────── */
  const [locations,       setLocations]       = useState([]);
  const [locLoading,      setLocLoading]      = useState(false);
  const [locForm,         setLocForm]         = useState({ name: '', description: '', location_type: 'interior', narrative_role: '' });
  const [editLocId,       setEditLocId]       = useState(null);

  /* ── Toast ─────────────────────────────────────────────────────────── */
  const [toast, setToast] = useState(null);
  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── World Tab Loaders ─────────────────────────────────────────────── */
  const loadLocations = useCallback(async () => {
    setLocLoading(true);
    try { const r = await fetch(`${API}/world/locations`); const d = await r.json(); setLocations(d.locations || []); }
    catch (e) { console.error('loadLocations', e); }
    finally { setLocLoading(false); }
  }, []);


  const seedInfrastructure = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/locations/seed-infrastructure`, { method: 'POST' });
      const d = await r.json();
      flash(`Seeded ${d.created || 0} locations`);
      loadLocations();
    } catch (e) { flash('Seed failed', 'error'); }
  }, [flash, loadLocations]);

  const saveLocation = useCallback(async () => {
    const method = editLocId ? 'PUT' : 'POST';
    const url = editLocId ? `${API}/world/locations/${editLocId}` : `${API}/world/locations`;
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(locForm) });
      flash(editLocId ? 'Location updated' : 'Location created');
      setLocForm({ name: '', description: '', location_type: 'interior', narrative_role: '' });
      setEditLocId(null);
      loadLocations();
    } catch (e) { flash('Save failed', 'error'); }
  }, [editLocId, locForm, flash, loadLocations]);

  const deleteLocation = useCallback(async (id) => {
    try { await fetch(`${API}/world/locations/${id}`, { method: 'DELETE' }); flash('Location deleted'); loadLocations(); }
    catch (e) { flash('Delete failed', 'error'); }
  }, [flash, loadLocations]);


  const createStoryFromChar = useCallback(async (charId) => {
    try {
      const r = await fetch(`${API}/world/create-story-task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character_id: charId }) });
      const d = await r.json();
      if (d.task) navigate('/story-evaluation', { state: { task: d.task } });
      else flash('Could not generate task', 'error');
    } catch (e) { flash('Story task failed', 'error'); }
  }, [navigate, flash]);


  /* ── Loaders ───────────────────────────────────────────────────────── */
  const loadCharacters = useCallback(async (tag) => {
    try {
      // All Characters tab: fetch all worlds combined
      const effectiveTag = tag || worldTag;
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
    if (pageTab !== 'feed' && pageTab !== 'relationships') {
      loadCharacters(worldTag);
    }
    setSelectedChar(null); setCharDetail(null); setEditMode(false); setCurrentPage(1);
  }, [worldTag, pageTab]);

  useEffect(() => { setCurrentPage(1); }, [charSearch, charFilter]);
  useEffect(() => { if (selectedChar) loadCharDetail(selectedChar); }, [selectedChar]);

  /* ── Ecosystem generate / preview / confirm ────────────────────────── */
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
        body: JSON.stringify({ characters: selected, generation_notes: previewNotes, world_tag: worldTag }),
      });
      const d = await r.json();
      if (d.characters) {
        flash(`${d.count} characters committed`);
        setShowPreview(false);
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

          {/* Top-level tabs — matches Character Registry pattern */}
          <nav className="ws4-page-tabs">
            {[
              { key: 'lalaverse',      label: 'LalaVerse',      icon: '✦' },
              { key: 'before-lala',    label: 'Before Lala',    icon: '◈' },
              { key: 'all-characters', label: 'All Characters', icon: '🌍' },
              { key: 'relationships',  label: 'Relationships',  icon: '🔗' },
              { key: 'locations',      label: 'Locations',      icon: '🏛' },
              { key: 'feed',           label: 'The Feed',       icon: '📱' },
            ].map(t => (
              <button
                key={t.key}
                className={`ws4-page-tab ${pageTab === t.key ? 'ws4-page-tab-active' : ''}`}
                onClick={() => {
                  setPageTab(t.key);
                  if (t.key === 'lalaverse')      setWorldTag('lalaverse');
                  if (t.key === 'before-lala')    setWorldTag('book-1');
                  if (t.key === 'all-characters') setWorldTag('all');
                  if (t.key === 'locations')      loadLocations();
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

          {/* Action buttons — only on world tabs */}
          {(pageTab === 'lalaverse' || pageTab === 'before-lala' || pageTab === 'all-characters') && (
            <div className="ws4-header-actions">
              {draftCount > 0 && (
                <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={bulkActivate} disabled={bulkActivating}>
                  {bulkActivating ? '…' : `✓ Activate ${draftCount}`}
                </button>
              )}
              {(pageTab === 'lalaverse' || pageTab === 'before-lala') && (
                <button className="ws4-btn ws4-btn-primary" onClick={generatePreview} disabled={generating}>
                  {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FEED TAB ────────────────────────────────────────────────── */}
      {pageTab === 'feed' && (
        <div className="ws4-feed-tab">
          <SocialProfileGenerator embedded={true} />
        </div>
      )}

      {/* ── RELATIONSHIPS TAB ───────────────────────────────────────── */}
      {pageTab === 'relationships' && (
        <div className="ws4-feed-tab">
          <RelationshipEngine />
        </div>
      )}

      {/* ── LOCATIONS TAB ───────────────────────────────────────────── */}
      {pageTab === 'locations' && (
        <div className="ws4-feed-tab" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🏛 World Locations</h2>
            <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={seedInfrastructure}>🌆 Seed Infrastructure</button>
          </div>
          {/* Create/Edit form */}
          <div style={{ background: '#f8f7f4', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #e8e5de' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{editLocId ? '✎ Edit Location' : '+ New Location'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="ws4-input" placeholder="Name *" value={locForm.name} onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))} />
              <select className="ws4-select" value={locForm.location_type} onChange={e => setLocForm(p => ({ ...p, location_type: e.target.value }))}>
                <option value="interior">Interior</option><option value="exterior">Exterior</option>
                <option value="virtual">Virtual</option><option value="transitional">Transitional</option>
              </select>
              <input className="ws4-input" placeholder="Narrative Role" value={locForm.narrative_role} onChange={e => setLocForm(p => ({ ...p, narrative_role: e.target.value }))} />
              <textarea className="ws4-input" placeholder="Description" rows={2} value={locForm.description} onChange={e => setLocForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={saveLocation} disabled={!locForm.name}>{editLocId ? 'Update' : 'Create'}</button>
              {editLocId && <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" onClick={() => { setEditLocId(null); setLocForm({ name: '', description: '', location_type: 'interior', narrative_role: '' }); }}>Cancel</button>}
            </div>
          </div>
          {/* Location list */}
          {locLoading ? <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Loading…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {locations.map(loc => (
                <div key={loc.id} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e8e5de' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{loc.name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{loc.location_type}{loc.narrative_role ? ` · ${loc.narrative_role}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="ws4-btn ws4-btn-ghost ws4-btn-sm" style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={() => { setEditLocId(loc.id); setLocForm({ name: loc.name, description: loc.description || '', location_type: loc.location_type || 'interior', narrative_role: loc.narrative_role || '' }); }}>✎</button>
                      <button className="ws4-btn ws4-btn-danger ws4-btn-sm" style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={() => deleteLocation(loc.id)}>✕</button>
                    </div>
                  </div>
                  {loc.description && <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.4 }}>{loc.description}</div>}
                  {loc.sensory_details && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(loc.sensory_details).filter(([,v]) => v).map(([k,v]) => (
                        <span key={k} style={{ background: '#f0eee8', borderRadius: 4, padding: '1px 6px' }}>{k}: {v}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {locations.length === 0 && <div style={{ color: '#999', gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>No locations yet — seed infrastructure or create one above.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── WORLD / CHARACTER TABS ──────────────────────────────────── */}
      {pageTab !== 'feed' && pageTab !== 'relationships' && pageTab !== 'locations' && (
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
              <div className="ws4-empty-icon">{curWorld.icon}</div>
              <div className="ws4-empty-title">Start your {curWorld.label} Ecosystem</div>
              <div className="ws4-empty-body">
                Generate a full cast of world characters with <strong>{curWorld.protagonist}</strong> as protagonist.
                Preview them, select who stays, confirm to commit.
              </div>
              <button className="ws4-btn ws4-btn-primary ws4-btn-lg" onClick={generatePreview} disabled={generating}>
                {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
              </button>
            </div>
          )}

          {/* Dashboard overview (no selection) */}
          {characters.length > 0 && !charDetail && (
            <div className="ws4-dashboard">
              <div className="ws4-dashboard-heading">
                {curWorld.icon} {curWorld.label} — Ecosystem Overview
              </div>
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
                      {charDetail.status !== 'archived' && (
                        <button className="ws4-btn ws4-btn-ghost ws4-btn-sm ws4-btn-muted" onClick={() => archiveChar(charDetail.id)}>Archive</button>
                      )}
                      <button className="ws4-btn ws4-btn-danger ws4-btn-sm" onClick={() => deleteChar(charDetail.id)}>Delete</button>
                      <button className="ws4-btn ws4-btn-primary ws4-btn-sm" onClick={() => createStoryFromChar(charDetail.id)}>✦ Create Story</button>
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
                  ].map(f => (
                    <div key={f.key} className="ws4-edit-row">
                      <label className="ws4-edit-label">{f.label}</label>
                      {f.long
                        ? <textarea className="ws4-textarea" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        : <input className="ws4-input" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}

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
                <label className="ws4-form-label">Character (if in Create World)</label>
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
      ) /* end world/character tabs */}

      {/* Toast */}
      {toast && (
        <div className={`ws4-toast ${toast.type === 'error' ? 'ws4-toast-error' : 'ws4-toast-success'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}