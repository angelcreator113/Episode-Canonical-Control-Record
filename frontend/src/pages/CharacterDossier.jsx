/**
 * CharacterDossier — 8-Section Canon Archive
 *
 * A protected canon archive. A fashion house portfolio.
 * A classified dossier. Clean. Intentional. Elevated.
 *
 * Props:
 *   character      — registry_characters record
 *   onSave(id, fields) — persist fields via PUT
 *   onStatusChange(id, status) — accept / decline / finalize
 *   onInterview(char)  — open voice interview modal
 *   onRefresh()        — reload registry data after save
 *
 * Location: frontend/src/pages/CharacterDossier.jsx
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import VoiceModeButton from '../components/VoiceModeButton';
import ConsciousnessLayer from '../components/ConsciousnessLayer';
import './CharacterDossier.css';

/* ─── Section definitions ── */
const SECTIONS = [
  { key: 'identity',    icon: '🔒', label: 'CORE IDENTITY',         number: '01' },
  { key: 'essence',     icon: '🪞', label: 'ESSENCE PROFILE',       number: '02' },
  { key: 'aesthetic',   icon: '🎭', label: 'AESTHETIC DNA',          number: '03' },
  { key: 'career',      icon: '💼', label: 'CAREER & STATUS',        number: '04' },
  { key: 'relationships', icon: '🔗', label: 'RELATIONSHIPS',       number: '05' },
  { key: 'story',       icon: '📚', label: 'STORY PRESENCE',         number: '06' },
  { key: 'voice',       icon: '🧠', label: 'VOICE & DIALOGUE',      number: '07' },
  { key: 'consciousness', icon: '◈', label: 'CONSCIOUSNESS',        number: '08' },
  { key: 'evolution',   icon: '💎', label: 'EVOLUTION TRACKING',     number: '09' },
  { key: 'living',      icon: '🏠', label: 'LIVING CONTEXT',          number: '10' },
  { key: 'deep',        icon: '🧬', label: 'DEEP PROFILE',             number: '11' },
];

/* ─── Role labels ── */
const ROLE_LABELS = {
  protagonist: 'Protagonist',
  pressure:    'Pressure',
  mirror:      'Mirror',
  support:     'Support',
  shadow:      'Shadow',
  special:     'Special',
};

const CANON_TIERS = ['Core Canon', 'Licensed', 'Minor'];
const GLAM_ENERGIES = ['Minimal', 'Maximal', 'Editorial'];
const STORY_STATUSES = ['Active', 'Evolving', 'Archived'];
const ARCHETYPES = [
  'Strategist', 'Dreamer', 'Performer', 'Guardian', 'Rebel',
  'Visionary', 'Healer', 'Trickster', 'Sage', 'Creator',
];

/* ─── Helper: get value from JSONB field safely ── */
const jGet = (obj, key) => (obj && typeof obj === 'object' ? obj[key] || '' : '');
const hasContent = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some(v => v && v !== '' && (!Array.isArray(v) || v.length > 0));
};

/* ================================================================== */
export default function CharacterDossier({ character, onSave, onStatusChange, onInterview, onRefresh }) {
  const c = character;
  const [collapsed, setCollapsed] = useState(new Set());
  const [editSection, setEditSection] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [writerInput, setWriterInput] = useState('');
  const [writerParsing, setWriterParsing] = useState(false);
  const [proposedAdditions, setProposedAdditions] = useState(null);
  const [expandedDims, setExpandedDims] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  /* anchor scroll */
  const sectionRefs = useRef({});
  const scrollTo = (key) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleCollapse = (key) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* ── start editing a section ── */
  const startEdit = (sectionKey) => {
    const initial = buildFormForSection(sectionKey, c);
    setForm(initial);
    setEditSection(sectionKey);
  };

  const cancelEdit = () => { setEditSection(null); setForm({}); };

  /* ── save section ── */
  const saveSection = useCallback(async () => {
    if (!editSection) return;
    setSaving(true);
    try {
      const payload = buildPayloadForSection(editSection, form);
      await onSave(c.id, payload);
      setEditSection(null);
      setForm({});
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Dossier save error:', err);
    } finally {
      setSaving(false);
    }
  }, [editSection, form, c?.id, onSave, onRefresh]);

  /* ── form helpers ── */
  const F = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  if (!c) return null;

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER                                             */
  /* ═══════════════════════════════════════════════════ */
  return (
    <div className="dossier">
      {/* ── HEADER BANNER ── */}
      <header className="dossier-header">
        <div className="dossier-header-icon">{c.icon || '◆'}</div>
        <div className="dossier-header-info">
          <div className="dossier-classification">CLASSIFIED · CHARACTER DOSSIER</div>
          <h1 className="dossier-name">{c.selected_name || c.display_name}</h1>
          {c.subtitle && <p className="dossier-subtitle">{c.subtitle}</p>}
          <div className="dossier-badges">
            <span className={`dossier-badge role-${c.role_type}`}>
              {c.role_label || ROLE_LABELS[c.role_type] || c.role_type}
            </span>
            {c.canon_tier && <span className="dossier-badge tier">{c.canon_tier}</span>}
            <span className={`dossier-badge status-${c.status}`}>{c.status}</span>
          </div>
        </div>
        <div className="dossier-header-actions">
          <button className="dossier-btn interview" onClick={() => onInterview?.(c)} title="Voice Interview">
            ✦ Interview
          </button>
        </div>
      </header>

      {/* ── SECTION NAV (quick jump) ── */}
      <nav className="dossier-nav">
        {SECTIONS.map(s => (
          <button key={s.key} className="dossier-nav-btn" onClick={() => scrollTo(s.key)}>
            <span className="dossier-nav-icon">{s.icon}</span>
            <span className="dossier-nav-num">{s.number}</span>
          </button>
        ))}
      </nav>

      {/* ── SECTIONS ── */}
      <div className="dossier-body">

        {/* ═══ SECTION 1: CORE IDENTITY ═══ */}
        <DossierSection
          def={SECTIONS[0]}
          ref={el => sectionRefs.current.identity = el}
          collapsed={collapsed.has('identity')}
          onToggle={() => toggleCollapse('identity')}
          editing={editSection === 'identity'}
          onEdit={() => startEdit('identity')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!c.display_name}
        >
          {editSection === 'identity' ? (
            <div className="dossier-fields">
              <DField label="Full Name" value={form.display_name} onChange={v => F('display_name', v)} />
              <DField label="Alias / Public Name" value={form.selected_name} onChange={v => F('selected_name', v)} />
              <DSelect label="Role" value={form.role_type} onChange={v => F('role_type', v)}
                options={[
                  { value: 'protagonist', label: 'Protagonist' },
                  { value: 'pressure',    label: 'Pressure / Antagonist' },
                  { value: 'mirror',      label: 'Mirror' },
                  { value: 'support',     label: 'Supporting' },
                  { value: 'shadow',      label: 'Shadow / Recurring' },
                  { value: 'special',     label: 'Special / Guest' },
                ]}
              />
              <DField label="Role Label (Custom)" value={form.role_label} onChange={v => F('role_label', v)} />
              <DSelect label="Canon Tier" value={form.canon_tier} onChange={v => F('canon_tier', v)}
                options={CANON_TIERS.map(t => ({ value: t, label: t }))}
                allowEmpty
              />
              <DField label="First Appearance" value={form.first_appearance} onChange={v => F('first_appearance', v)} placeholder="Book 1 · Episode 3" />
              <DField label="Era Introduced" value={form.era_introduced} onChange={v => F('era_introduced', v)} placeholder="Before Lala / Prime Era" />
              <DField label="Creator" value={form.creator} onChange={v => F('creator', v)} placeholder="Original creator" />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Full Name" value={c.display_name} />
              <DossierRow label="Alias" value={c.selected_name} />
              <DossierRow label="Role" value={c.role_label || ROLE_LABELS[c.role_type] || c.role_type} accent />
              <DossierRow label="Canon Tier" value={c.canon_tier} />
              <DossierRow label="First Appearance" value={c.first_appearance} />
              <DossierRow label="Era Introduced" value={c.era_introduced} />
              <DossierRow label="Creator" value={c.creator} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 2: ESSENCE PROFILE ═══ */}
        <DossierSection
          def={SECTIONS[1]}
          ref={el => sectionRefs.current.essence = el}
          collapsed={collapsed.has('essence')}
          onToggle={() => toggleCollapse('essence')}
          editing={editSection === 'essence'}
          onEdit={() => startEdit('essence')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!c.core_desire && !c.core_fear && !c.core_belief && !c.hidden_want && !c.personality}
        >
          {editSection === 'essence' ? (
            <div className="dossier-fields">
              <DArea label="Core Desire — What they want most" value={form.core_desire} onChange={v => F('core_desire', v)} rows={2} />
              <DArea label="Core Fear — What threatens them most" value={form.core_fear} onChange={v => F('core_fear', v)} rows={2} />
              <DArea label="Core Wound — Backstory scar" value={form.core_wound} onChange={v => F('core_wound', v)} rows={2} />
              <DArea label="Hidden Want — What they actually want but won't admit" value={form.hidden_want} onChange={v => F('hidden_want', v)} rows={2} />
              <DArea label="Mask — How they appear publicly" value={form.mask_persona} onChange={v => F('mask_persona', v)} rows={2} />
              <DArea label="Truth — Who they actually are" value={form.truth_persona} onChange={v => F('truth_persona', v)} rows={2} />
              <DSelect label="Character Archetype" value={form.character_archetype} onChange={v => F('character_archetype', v)}
                options={ARCHETYPES.map(a => ({ value: a, label: a }))} allowEmpty
              />
              <DArea label="Signature Trait — One unforgettable behavior" value={form.signature_trait} onChange={v => F('signature_trait', v)} rows={2} />
              <DField label="Emotional Baseline" value={form.emotional_baseline} onChange={v => F('emotional_baseline', v)} placeholder="Confident, guarded, restless…" />
              <div className="dossier-divider" />
              <DArea label="Core Belief (PNOS)" value={form.core_belief} onChange={v => F('core_belief', v)} rows={2} />
              <DField label="Pressure Type" value={form.pressure_type} onChange={v => F('pressure_type', v)} />
              <DField label="Personality Traits" value={form.personality} onChange={v => F('personality', v)} hint="Comma-separated" />
            </div>
          ) : (
            <div className="dossier-essence">
              {(c.core_desire || c.core_fear || c.core_wound || c.hidden_want) && (
                <div className="dossier-triad">
                  {c.core_desire  && <div className="dossier-triad-item desire"><span className="triad-label">DESIRE</span><p>{c.core_desire}</p></div>}
                  {c.core_fear    && <div className="dossier-triad-item fear"><span className="triad-label">FEAR</span><p>{c.core_fear}</p></div>}
                  {c.core_wound   && <div className="dossier-triad-item wound"><span className="triad-label">WOUND</span><p>{c.core_wound}</p></div>}
                  {c.hidden_want  && <div className="dossier-triad-item" style={{borderLeftColor: '#9b59b6'}}><span className="triad-label">HIDDEN WANT</span><p>{c.hidden_want}</p></div>}
                </div>
              )}
              {(c.mask_persona || c.truth_persona) && (
                <div className="dossier-duality">
                  {c.mask_persona  && <div className="dossier-duality-item mask"><span className="dual-label">MASK</span><p>{c.mask_persona}</p></div>}
                  {c.truth_persona && <div className="dossier-duality-item truth"><span className="dual-label">TRUTH</span><p>{c.truth_persona}</p></div>}
                </div>
              )}
              <div className="dossier-grid">
                <DossierRow label="Archetype" value={c.character_archetype} accent />
                <DossierRow label="Signature Trait" value={c.signature_trait} />
                <DossierRow label="Emotional Baseline" value={c.emotional_baseline} />
              </div>
              {(c.core_belief || c.pressure_type || c.personality) && (
                <>
                  <div className="dossier-divider" />
                  <div className="dossier-grid">
                    <DossierRow label="Core Belief" value={c.core_belief} />
                    <DossierRow label="Pressure Type" value={c.pressure_type} />
                  </div>
                  {c.personality && (
                    <div className="dossier-pills">
                      {c.personality.split(',').map((t, i) => <span key={i} className="dossier-pill">{t.trim()}</span>)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 3: AESTHETIC DNA ═══ */}
        <DossierSection
          def={SECTIONS[2]}
          ref={el => sectionRefs.current.aesthetic = el}
          collapsed={collapsed.has('aesthetic')}
          onToggle={() => toggleCollapse('aesthetic')}
          editing={editSection === 'aesthetic'}
          onEdit={() => startEdit('aesthetic')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.aesthetic_dna)}
        >
          {editSection === 'aesthetic' ? (
            <div className="dossier-fields">
              <DField label="Era Aesthetic" value={form.era_aesthetic} onChange={v => F('era_aesthetic', v)} placeholder="Soft Luxury, Bold Era, Prime Era" />
              <DArea label="Color Palette" value={form.color_palette} onChange={v => F('color_palette', v)} rows={2} placeholder="Warm ivory, muted gold, deep burgundy…" />
              <DArea label="Signature Silhouette" value={form.signature_silhouette} onChange={v => F('signature_silhouette', v)} rows={2} />
              <DArea label="Signature Accessories" value={form.signature_accessories} onChange={v => F('signature_accessories', v)} rows={2} />
              <DSelect label="Glam Energy" value={form.glam_energy} onChange={v => F('glam_energy', v)}
                options={GLAM_ENERGIES.map(g => ({ value: g, label: g }))} allowEmpty
              />
              <DArea label="Visual Evolution Notes" value={form.visual_evolution_notes} onChange={v => F('visual_evolution_notes', v)} rows={3} />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Era Aesthetic" value={jGet(c.aesthetic_dna, 'era_aesthetic')} accent />
              <DossierRow label="Color Palette" value={jGet(c.aesthetic_dna, 'color_palette')} />
              <DossierRow label="Signature Silhouette" value={jGet(c.aesthetic_dna, 'signature_silhouette')} />
              <DossierRow label="Signature Accessories" value={jGet(c.aesthetic_dna, 'signature_accessories')} />
              <DossierRow label="Glam Energy" value={jGet(c.aesthetic_dna, 'glam_energy')} accent />
              <DossierRow label="Visual Evolution" value={jGet(c.aesthetic_dna, 'visual_evolution_notes')} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 4: CAREER & STATUS ═══ */}
        <DossierSection
          def={SECTIONS[3]}
          ref={el => sectionRefs.current.career = el}
          collapsed={collapsed.has('career')}
          onToggle={() => toggleCollapse('career')}
          editing={editSection === 'career'}
          onEdit={() => startEdit('career')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.career_status)}
        >
          {editSection === 'career' ? (
            <div className="dossier-fields">
              <DField label="Profession" value={form.profession} onChange={v => F('profession', v)} />
              <DArea label="Career Goal" value={form.career_goal} onChange={v => F('career_goal', v)} rows={2} />
              <DField label="Reputation Level" value={form.reputation_level} onChange={v => F('reputation_level', v)} />
              <DArea label="Brand Relationships" value={form.brand_relationships} onChange={v => F('brand_relationships', v)} rows={2} />
              <DField label="Financial Status" value={form.financial_status} onChange={v => F('financial_status', v)} placeholder="Narrative context only" />
              <DField label="Public Recognition Level" value={form.public_recognition} onChange={v => F('public_recognition', v)} />
              <DArea label="Ongoing Arc" value={form.ongoing_arc} onChange={v => F('ongoing_arc', v)} rows={3} />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Profession" value={jGet(c.career_status, 'profession')} accent />
              <DossierRow label="Career Goal" value={jGet(c.career_status, 'career_goal')} />
              <DossierRow label="Reputation" value={jGet(c.career_status, 'reputation_level')} />
              <DossierRow label="Brands" value={jGet(c.career_status, 'brand_relationships')} />
              <DossierRow label="Financial Status" value={jGet(c.career_status, 'financial_status')} />
              <DossierRow label="Public Recognition" value={jGet(c.career_status, 'public_recognition')} />
              <DossierRow label="Ongoing Arc" value={jGet(c.career_status, 'ongoing_arc')} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 5: RELATIONSHIPS ═══ */}
        <DossierSection
          def={SECTIONS[4]}
          ref={el => sectionRefs.current.relationships = el}
          collapsed={collapsed.has('relationships')}
          onToggle={() => toggleCollapse('relationships')}
          editing={editSection === 'relationships'}
          onEdit={() => startEdit('relationships')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.relationships_map)}
        >
          {editSection === 'relationships' ? (
            <div className="dossier-fields">
              <DArea label="Allies" value={form.allies} onChange={v => F('allies', v)} rows={2} placeholder="Names or descriptions" />
              <DArea label="Rivals" value={form.rivals} onChange={v => F('rivals', v)} rows={2} />
              <DArea label="Mentors" value={form.mentors} onChange={v => F('mentors', v)} rows={2} />
              <DArea label="Love Interests" value={form.love_interests} onChange={v => F('love_interests', v)} rows={2} />
              <DArea label="Business Partners" value={form.business_partners} onChange={v => F('business_partners', v)} rows={2} />
              <DArea label="Dynamic Notes" value={form.dynamic_notes} onChange={v => F('dynamic_notes', v)} rows={3} placeholder="Tension? Supportive? Competitive?" />
            </div>
          ) : (
            <div className="dossier-grid rel-grid">
              <DossierRow label="Allies" value={jGet(c.relationships_map, 'allies')} icon="🤝" />
              <DossierRow label="Rivals" value={jGet(c.relationships_map, 'rivals')} icon="⚔️" />
              <DossierRow label="Mentors" value={jGet(c.relationships_map, 'mentors')} icon="🏛️" />
              <DossierRow label="Love Interests" value={jGet(c.relationships_map, 'love_interests')} icon="♡" />
              <DossierRow label="Business Partners" value={jGet(c.relationships_map, 'business_partners')} icon="💼" />
              <DossierRow label="Dynamic Notes" value={jGet(c.relationships_map, 'dynamic_notes')} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 6: STORY PRESENCE ═══ */}
        <DossierSection
          def={SECTIONS[5]}
          ref={el => sectionRefs.current.story = el}
          collapsed={collapsed.has('story')}
          onToggle={() => toggleCollapse('story')}
          editing={editSection === 'story'}
          onEdit={() => startEdit('story')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.story_presence)}
        >
          {editSection === 'story' ? (
            <div className="dossier-fields">
              <DArea label="Appears in — Books" value={form.appears_in_books} onChange={v => F('appears_in_books', v)} rows={2} />
              <DArea label="Appears in — Shows" value={form.appears_in_shows} onChange={v => F('appears_in_shows', v)} rows={2} />
              <DArea label="Appears in — Series" value={form.appears_in_series} onChange={v => F('appears_in_series', v)} rows={2} />
              <DSelect label="Current Status" value={form.current_story_status} onChange={v => F('current_story_status', v)}
                options={STORY_STATUSES.map(s => ({ value: s, label: s }))} allowEmpty
              />
              <DArea label="Unresolved Threads" value={form.unresolved_threads} onChange={v => F('unresolved_threads', v)} rows={3} />
              <DSelect label="Future Potential" value={form.future_potential} onChange={v => F('future_potential', v)}
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} allowEmpty
              />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Books" value={jGet(c.story_presence, 'appears_in_books')} />
              <DossierRow label="Shows" value={jGet(c.story_presence, 'appears_in_shows')} />
              <DossierRow label="Series" value={jGet(c.story_presence, 'appears_in_series')} />
              <DossierRow label="Current Status" value={jGet(c.story_presence, 'current_story_status')} accent />
              <DossierRow label="Unresolved Threads" value={jGet(c.story_presence, 'unresolved_threads')} />
              <DossierRow label="Future Potential" value={jGet(c.story_presence, 'future_potential')} accent />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 7: VOICE & DIALOGUE ═══ */}
        <DossierSection
          def={SECTIONS[6]}
          ref={el => sectionRefs.current.voice = el}
          collapsed={collapsed.has('voice')}
          onToggle={() => toggleCollapse('voice')}
          editing={editSection === 'voice'}
          onEdit={() => startEdit('voice')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.voice_signature)}
        >
          {editSection === 'voice' ? (
            <div className="dossier-fields">
              <DField label="Speech Pattern" value={form.speech_pattern} onChange={v => F('speech_pattern', v)} placeholder="Direct, playful, sarcastic, poetic" />
              <DField label="Vocabulary Tone" value={form.vocabulary_tone} onChange={v => F('vocabulary_tone', v)} placeholder="Luxury, street, soft, sharp" />
              <DArea label="Catchphrases" value={form.catchphrases} onChange={v => F('catchphrases', v)} rows={2} />
              <DArea label="Internal Monologue Style" value={form.internal_monologue_style} onChange={v => F('internal_monologue_style', v)} rows={3} />
              <DField label="Emotional Reactivity Level" value={form.emotional_reactivity} onChange={v => F('emotional_reactivity', v)} placeholder="Low / Moderate / High / Volatile" />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Speech Pattern" value={jGet(c.voice_signature, 'speech_pattern')} accent />
              <DossierRow label="Vocabulary Tone" value={jGet(c.voice_signature, 'vocabulary_tone')} />
              <DossierRow label="Catchphrases" value={jGet(c.voice_signature, 'catchphrases')} />
              <DossierRow label="Internal Monologue" value={jGet(c.voice_signature, 'internal_monologue_style')} />
              <DossierRow label="Emotional Reactivity" value={jGet(c.voice_signature, 'emotional_reactivity')} accent />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 8: CONSCIOUSNESS ═══ */}
        <DossierSection
          def={SECTIONS[7]}
          ref={el => sectionRefs.current.consciousness = el}
          collapsed={collapsed.has('consciousness')}
          onToggle={() => toggleCollapse('consciousness')}
          editing={false}
          onEdit={() => {}}
          onCancel={() => {}}
          onSave={() => {}}
          saving={false}
          isEmpty={false}
        >
          <ConsciousnessLayer
            character={c}
            psychology={{
              core_wound:     c.core_wound || c.belief_pressured,
              desire_line:    c.core_desire || c.emotional_function,
              fear_line:      c.core_fear || null,
              self_deception: null,
              at_their_best:  null,
              at_their_worst: null,
            }}
            dilemmas={null}
          />
        </DossierSection>

        {/* ═══ SECTION 9: EVOLUTION TRACKING ═══ */}
        <DossierSection
          def={SECTIONS[8]}
          ref={el => sectionRefs.current.evolution = el}
          collapsed={collapsed.has('evolution')}
          onToggle={() => toggleCollapse('evolution')}
          editing={editSection === 'evolution'}
          onEdit={() => startEdit('evolution')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.evolution_tracking)}
        >
          {editSection === 'evolution' ? (
            <div className="dossier-fields">
              <DArea label="Version History" value={form.version_history} onChange={v => F('version_history', v)} rows={3} placeholder="Key version changes over time" />
              <DArea label="Era Changes" value={form.era_changes} onChange={v => F('era_changes', v)} rows={2} />
              <DArea label="Personality Shifts" value={form.personality_shifts} onChange={v => F('personality_shifts', v)} rows={3} />
              <DArea label="Reputation Milestones" value={form.reputation_milestones} onChange={v => F('reputation_milestones', v)} rows={2} />
              <DArea label="Visual Transformations" value={form.visual_transformations} onChange={v => F('visual_transformations', v)} rows={3} />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Version History" value={jGet(c.evolution_tracking, 'version_history')} />
              <DossierRow label="Era Changes" value={jGet(c.evolution_tracking, 'era_changes')} />
              <DossierRow label="Personality Shifts" value={jGet(c.evolution_tracking, 'personality_shifts')} />
              <DossierRow label="Reputation Milestones" value={jGet(c.evolution_tracking, 'reputation_milestones')} />
              <DossierRow label="Visual Transforms" value={jGet(c.evolution_tracking, 'visual_transformations')} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 10: LIVING CONTEXT ═══ */}
        <DossierSection
          def={SECTIONS[9]}
          ref={el => sectionRefs.current.living = el}
          collapsed={collapsed.has('living')}
          onToggle={() => toggleCollapse('living')}
          editing={editSection === 'living'}
          onEdit={() => startEdit('living')}
          onCancel={cancelEdit}
          onSave={saveSection}
          saving={saving}
          isEmpty={!hasContent(c.living_context)}
        >
          {editSection === 'living' ? (
            <div className="dossier-fields">
              <DArea label="Active Pressures" value={form.active_pressures} onChange={v => F('active_pressures', v)} rows={3} placeholder="What is bearing down on this person right now? (financial, family, health, career, relationships)" />
              <DArea label="Support Network" value={form.support_network} onChange={v => F('support_network', v)} rows={3} placeholder="Who is in their corner? Who undermines them? Who do they refuse to call?" />
              <DArea label="Home Environment" value={form.home_environment} onChange={v => F('home_environment', v)} rows={3} placeholder="What does their daily physical reality look like? Who else is in that space?" />
              <DArea label="Relationship to Deadlines" value={form.relationship_to_deadlines} onChange={v => F('relationship_to_deadlines', v)} rows={2} placeholder="How do they behave under time pressure? Power through, freeze, cut scope, overcommunicate?" />
              <DArea label="Financial Reality" value={form.financial_reality} onChange={v => F('financial_reality', v)} rows={2} placeholder="Stable, stretched, or surviving? Does money anxiety factor into their decisions?" />
              <DArea label="Current Season of Life" value={form.current_season} onChange={v => F('current_season', v)} rows={2} placeholder="New mother, rebuilding after failure, first real success, caregiving, navigating a transition?" />
            </div>
          ) : (
            <div className="dossier-grid">
              <DossierRow label="Active Pressures" value={jGet(c.living_context, 'active_pressures')} />
              <DossierRow label="Support Network" value={jGet(c.living_context, 'support_network')} />
              <DossierRow label="Home Environment" value={jGet(c.living_context, 'home_environment')} />
              <DossierRow label="Relationship to Deadlines" value={jGet(c.living_context, 'relationship_to_deadlines')} />
              <DossierRow label="Financial Reality" value={jGet(c.living_context, 'financial_reality')} />
              <DossierRow label="Current Season" value={jGet(c.living_context, 'current_season')} />
            </div>
          )}
        </DossierSection>

        {/* ═══ SECTION 11: DEEP PROFILE ═══ */}
        <DossierSection
          def={SECTIONS[10]}
          ref={el => sectionRefs.current.deep = el}
          collapsed={collapsed.has('deep')}
          onToggle={() => toggleCollapse('deep')}
          editing={false}
          onEdit={() => {}}
          isEmpty={!hasContent(c.deep_profile)}
        >
          <DeepProfileViewer
            deepProfile={c.deep_profile || {}}
            expandedDims={expandedDims}
            onToggleDim={(dim) => setExpandedDims(prev => {
              const next = new Set(prev);
              next.has(dim) ? next.delete(dim) : next.add(dim);
              return next;
            })}
          />
          {/* Backfill button for characters with empty/sparse deep_profile */}
          {(() => {
            const dp = c.deep_profile || {};
            const filled = Object.keys(dp).filter(k => {
              const v = dp[k];
              return v && typeof v === 'object' && Object.values(v).some(fv => fv !== null && fv !== undefined && fv !== '');
            }).length;
            if (filled < 5) return (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#c9a84c', marginBottom: 8 }}>
                  {filled === 0 ? 'Deep profile is empty.' : `Only ${filled}/14 dimensions populated.`} Generate from existing character data?
                </div>
                <button
                  disabled={generating}
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const API = import.meta.env.VITE_API_URL || '/api/v1';
                      const resp = await fetch(`${API}/character-registry/characters/${c.id}/deep-profile/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      const data = await resp.json();
                      if (data.success && onRefresh) onRefresh();
                    } catch (err) {
                      console.error('Deep profile generation error:', err);
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  style={{
                    padding: '6px 16px', background: generating ? '#333' : '#c9a84c', color: '#000',
                    border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    opacity: generating ? 0.5 : 1,
                  }}
                >
                  {generating ? '🧬 Generating...' : '🧬 Generate Deep Profile from Dossier'}
                </button>
              </div>
            );
            return null;
          })()}
          {/* Writer Input */}
          <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Writer Input</div>
            <textarea
              value={writerInput}
              onChange={e => setWriterInput(e.target.value)}
              placeholder="Tell me about this character — anything. Their mother's kitchen, what they do when they can't sleep, the compliment they still think about. I'll file it into the right dimensions."
              style={{
                width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#ccc', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={async () => {
                  if (!writerInput.trim() || writerInput.trim().length < 10) return;
                  setWriterParsing(true);
                  setProposedAdditions(null);
                  try {
                    const API = import.meta.env.VITE_API_URL || '/api/v1';
                    const resp = await fetch(`${API}/character-registry/characters/${c.id}/deep-profile/writer-input`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: writerInput }),
                    });
                    const data = await resp.json();
                    if (data.proposed_additions) {
                      setProposedAdditions(data.proposed_additions);
                    }
                  } catch (err) {
                    console.error('Writer input parse error:', err);
                  } finally {
                    setWriterParsing(false);
                  }
                }}
                disabled={writerParsing || writerInput.trim().length < 10}
                style={{
                  padding: '6px 16px', background: writerParsing ? '#333' : '#c9a84c', color: '#000',
                  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: writerParsing ? 0.5 : 1,
                }}
              >
                {writerParsing ? 'Parsing...' : '✦ Parse into Profile'}
              </button>
            </div>
            {proposedAdditions && (
              <div style={{ marginTop: 12, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#c9a84c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Proposed Additions</div>
                {Object.entries(proposedAdditions).map(([dim, fields]) => (
                  <div key={dim} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#e8d5a0', fontWeight: 600, marginBottom: 4 }}>{dim.replace(/_/g, ' ')}</div>
                    {Object.entries(fields || {}).map(([field, val]) => val && (
                      <div key={field} style={{ fontSize: 12, color: '#aaa', marginLeft: 12, marginBottom: 2 }}>
                        <span style={{ color: '#888' }}>{field.replace(/_/g, ' ')}:</span> {val}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={async () => {
                      try {
                        const API = import.meta.env.VITE_API_URL || '/api/v1';
                        await fetch(`${API}/character-registry/characters/${c.id}/deep-profile/accept`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ additions: proposedAdditions }),
                        });
                        setProposedAdditions(null);
                        setWriterInput('');
                        if (onRefresh) onRefresh();
                      } catch (err) {
                        console.error('Accept error:', err);
                      }
                    }}
                    style={{ padding: '5px 14px', background: '#4a9', color: '#000', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✓ Accept All
                  </button>
                  <button
                    onClick={() => setProposedAdditions(null)}
                    style={{ padding: '5px 14px', background: '#444', color: '#aaa', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </DossierSection>
      </div>

      {/* ── STATUS ACTIONS (bottom bar) ── */}
      <footer className="dossier-footer">
        <div className="dossier-footer-status">
          <span className={`dossier-status-dot ${c.status}`} />
          <span className="dossier-status-label">{c.status?.toUpperCase()}</span>
        </div>
        <div className="dossier-footer-actions">
          <VoiceModeButton
            character={c}
            onProfileUpdate={() => onRefresh?.()}
          />
          {c.status !== 'finalized' && (
            <>
              {c.status !== 'accepted' && (
                <button className="dossier-btn accept" onClick={() => onStatusChange?.(c.id, 'accepted')}>✓ Accept</button>
              )}
              {c.status !== 'declined' && (
                <button className="dossier-btn decline" onClick={() => onStatusChange?.(c.id, 'declined')}>✗ Decline</button>
              )}
              {c.status === 'accepted' && (
                <button className="dossier-btn finalize" onClick={() => onStatusChange?.(c.id, 'finalized')}>◆ Finalize to Canon</button>
              )}
            </>
          )}
          {c.status === 'finalized' && (
            <>
              <span className="dossier-finalized-label">◆ CANON LOCKED</span>
              <button className="dossier-btn revert" onClick={() => onStatusChange?.(c.id, 'draft')}>↺ Revert to Draft</button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}


/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

/* ── Section wrapper ── */
const DossierSection = React.forwardRef(function DossierSection(
  { def, collapsed, onToggle, editing, onEdit, onCancel, onSave, saving, isEmpty, children },
  ref,
) {
  return (
    <section className={`dossier-section ${collapsed ? 'collapsed' : ''} ${editing ? 'editing' : ''}`} ref={ref}>
      <div className="dossier-section-header" onClick={onToggle}>
        <div className="dossier-section-left">
          <span className="dossier-section-num">{def.number}</span>
          <span className="dossier-section-icon">{def.icon}</span>
          <span className="dossier-section-label">{def.label}</span>
        </div>
        <div className="dossier-section-right">
          {isEmpty && !editing && <span className="dossier-empty-tag">EMPTY</span>}
          {!editing ? (
            <button className="dossier-edit-btn" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit section">✎</button>
          ) : (
            <div className="dossier-edit-actions" onClick={e => e.stopPropagation()}>
              <button className="dossier-btn cancel" onClick={onCancel}>Cancel</button>
              <button className="dossier-btn save" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : '✓ Save'}</button>
            </div>
          )}
          <span className="dossier-chevron">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>
      {!collapsed && <div className="dossier-section-body">{children}</div>}
    </section>
  );
});

/* ── Read-mode row ── */
function DossierRow({ label, value, accent, icon }) {
  if (!value) return null;
  return (
    <div className="dossier-row">
      <span className="dossier-row-label">{icon && <span className="dossier-row-icon">{icon}</span>}{label}</span>
      <span className={`dossier-row-value ${accent ? 'accent' : ''}`}>{value}</span>
    </div>
  );
}

/* ── Edit field ── */
function DField({ label, value, onChange, placeholder, hint }) {
  return (
    <div className="dossier-edit-field">
      <label className="dossier-edit-label">{label}</label>
      <input className="dossier-edit-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || label} />
      {hint && <span className="dossier-edit-hint">{hint}</span>}
    </div>
  );
}

function DArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="dossier-edit-field">
      <label className="dossier-edit-label">{label}</label>
      <textarea className="dossier-edit-input dossier-edit-textarea" value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder || label} />
    </div>
  );
}

function DSelect({ label, value, onChange, options, allowEmpty }) {
  return (
    <div className="dossier-edit-field">
      <label className="dossier-edit-label">{label}</label>
      <select className="dossier-edit-input dossier-edit-select" value={value || ''} onChange={e => onChange(e.target.value)}>
        {allowEmpty && <option value="">— Select —</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}


/* ================================================================== */
/*  Deep Profile Viewer                                                */
/* ================================================================== */

const DEEP_DIMS = [
  { key: 'life_stage',          icon: '⏳', label: 'Life Stage' },
  { key: 'the_body',            icon: '🫀', label: 'The Body' },
  { key: 'class_and_money',     icon: '💰', label: 'Class & Money' },
  { key: 'religion_and_meaning',icon: '✦',  label: 'Religion & Meaning' },
  { key: 'race_and_culture',    icon: '🌍', label: 'Race & Culture' },
  { key: 'sexuality_and_desire',icon: '🔥', label: 'Sexuality & Desire' },
  { key: 'family_architecture', icon: '🏠', label: 'Family Architecture' },
  { key: 'friendship_and_loyalty',icon: '🤝', label: 'Friendship & Loyalty' },
  { key: 'ambition_and_identity',icon: '⚡', label: 'Ambition & Identity' },
  { key: 'habits_and_rituals',  icon: '☕', label: 'Habits & Rituals' },
  { key: 'speech_and_silence',  icon: '💬', label: 'Speech & Silence' },
  { key: 'grief_and_loss',      icon: '🕯',  label: 'Grief & Loss' },
  { key: 'politics_and_justice',icon: '⚖',  label: 'Politics & Justice' },
  { key: 'the_unseen',          icon: '👁',  label: 'The Unseen' },
];

function DeepProfileViewer({ deepProfile, expandedDims, onToggleDim }) {
  const dp = deepProfile || {};
  const filledCount = DEEP_DIMS.filter(d => {
    const dim = dp[d.key];
    return dim && Object.values(dim).some(v => v);
  }).length;

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
        {filledCount}/{DEEP_DIMS.length} dimensions known
      </div>
      {DEEP_DIMS.map(dim => {
        const data = dp[dim.key] || {};
        const fields = Object.entries(data).filter(([, v]) => v);
        const isEmpty = fields.length === 0;
        const isOpen = expandedDims.has(dim.key);

        return (
          <div key={dim.key} style={{
            marginBottom: 4,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 4,
            background: isEmpty ? 'transparent' : 'rgba(255,255,255,0.02)',
          }}>
            <button
              onClick={() => onToggleDim(dim.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                color: isEmpty ? '#555' : '#ccc', fontSize: 13, textAlign: 'left',
              }}
            >
              <span>{dim.icon}</span>
              <span style={{ flex: 1, fontWeight: isEmpty ? 400 : 600 }}>{dim.label}</span>
              {isEmpty
                ? <span style={{ fontSize: 10, color: '#555', fontStyle: 'italic' }}>Not yet known</span>
                : <span style={{ fontSize: 10, color: '#c9a84c' }}>{fields.length} fields</span>
              }
              <span style={{ fontSize: 10, color: '#666' }}>{isOpen ? '▼' : '▶'}</span>
            </button>
            {isOpen && !isEmpty && (
              <div style={{ padding: '0 10px 10px 28px' }}>
                {fields.map(([field, val]) => (
                  <div key={field} style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#888' }}>{field.replace(/_/g, ' ')}: </span>
                    <span style={{ fontSize: 12, color: '#bbb' }}>{val}</span>
                  </div>
                ))}
              </div>
            )}
            {isOpen && isEmpty && (
              <div style={{ padding: '4px 10px 10px 28px', fontSize: 12, color: '#555', fontStyle: 'italic' }}>
                This dimension will be populated through generation, scene revelation, or writer input.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Form ↔ Data helpers                                                */
/* ================================================================== */

function buildFormForSection(sectionKey, c) {
  switch (sectionKey) {
    case 'identity':
      return {
        display_name:     c.display_name || '',
        selected_name:    c.selected_name || '',
        role_type:        c.role_type || 'special',
        role_label:       c.role_label || '',
        canon_tier:       c.canon_tier || '',
        first_appearance: c.first_appearance || '',
        era_introduced:   c.era_introduced || '',
        creator:          c.creator || '',
      };
    case 'essence':
      return {
        core_desire:        c.core_desire || '',
        core_fear:          c.core_fear || '',
        core_wound:         c.core_wound || '',
        hidden_want:        c.hidden_want || '',
        mask_persona:       c.mask_persona || '',
        truth_persona:      c.truth_persona || '',
        character_archetype:c.character_archetype || '',
        signature_trait:    c.signature_trait || '',
        emotional_baseline: c.emotional_baseline || '',
        core_belief:        c.core_belief || '',
        pressure_type:      c.pressure_type || '',
        personality:        c.personality || '',
      };
    case 'aesthetic':
      return {
        era_aesthetic:          jGet(c.aesthetic_dna, 'era_aesthetic'),
        color_palette:          jGet(c.aesthetic_dna, 'color_palette'),
        signature_silhouette:   jGet(c.aesthetic_dna, 'signature_silhouette'),
        signature_accessories:  jGet(c.aesthetic_dna, 'signature_accessories'),
        glam_energy:            jGet(c.aesthetic_dna, 'glam_energy'),
        visual_evolution_notes: jGet(c.aesthetic_dna, 'visual_evolution_notes'),
      };
    case 'career':
      return {
        profession:         jGet(c.career_status, 'profession'),
        career_goal:        jGet(c.career_status, 'career_goal'),
        reputation_level:   jGet(c.career_status, 'reputation_level'),
        brand_relationships:jGet(c.career_status, 'brand_relationships'),
        financial_status:   jGet(c.career_status, 'financial_status'),
        public_recognition: jGet(c.career_status, 'public_recognition'),
        ongoing_arc:        jGet(c.career_status, 'ongoing_arc'),
      };
    case 'relationships':
      return {
        allies:            jGet(c.relationships_map, 'allies'),
        rivals:            jGet(c.relationships_map, 'rivals'),
        mentors:           jGet(c.relationships_map, 'mentors'),
        love_interests:    jGet(c.relationships_map, 'love_interests'),
        business_partners: jGet(c.relationships_map, 'business_partners'),
        dynamic_notes:     jGet(c.relationships_map, 'dynamic_notes'),
      };
    case 'story':
      return {
        appears_in_books:    jGet(c.story_presence, 'appears_in_books'),
        appears_in_shows:    jGet(c.story_presence, 'appears_in_shows'),
        appears_in_series:   jGet(c.story_presence, 'appears_in_series'),
        current_story_status:jGet(c.story_presence, 'current_story_status'),
        unresolved_threads:  jGet(c.story_presence, 'unresolved_threads'),
        future_potential:    jGet(c.story_presence, 'future_potential'),
      };
    case 'voice':
      return {
        speech_pattern:          jGet(c.voice_signature, 'speech_pattern'),
        vocabulary_tone:         jGet(c.voice_signature, 'vocabulary_tone'),
        catchphrases:            jGet(c.voice_signature, 'catchphrases'),
        internal_monologue_style:jGet(c.voice_signature, 'internal_monologue_style'),
        emotional_reactivity:    jGet(c.voice_signature, 'emotional_reactivity'),
      };
    case 'evolution':
      return {
        version_history:        jGet(c.evolution_tracking, 'version_history'),
        era_changes:            jGet(c.evolution_tracking, 'era_changes'),
        personality_shifts:     jGet(c.evolution_tracking, 'personality_shifts'),
        reputation_milestones:  jGet(c.evolution_tracking, 'reputation_milestones'),
        visual_transformations: jGet(c.evolution_tracking, 'visual_transformations'),
      };
    case 'living':
      return {
        active_pressures:          jGet(c.living_context, 'active_pressures'),
        support_network:           jGet(c.living_context, 'support_network'),
        home_environment:          jGet(c.living_context, 'home_environment'),
        relationship_to_deadlines: jGet(c.living_context, 'relationship_to_deadlines'),
        financial_reality:         jGet(c.living_context, 'financial_reality'),
        current_season:            jGet(c.living_context, 'current_season'),
      };
    default:
      return {};
  }
}

function buildPayloadForSection(sectionKey, form) {
  switch (sectionKey) {
    case 'identity':
      return {
        display_name:     form.display_name,
        selected_name:    form.selected_name,
        role_type:        form.role_type,
        role_label:       form.role_label,
        canon_tier:       form.canon_tier,
        first_appearance: form.first_appearance,
        era_introduced:   form.era_introduced,
        creator:          form.creator,
      };
    case 'essence':
      return {
        core_desire:         form.core_desire,
        core_fear:           form.core_fear,
        core_wound:          form.core_wound,
        hidden_want:         form.hidden_want,
        mask_persona:        form.mask_persona,
        truth_persona:       form.truth_persona,
        character_archetype: form.character_archetype,
        signature_trait:     form.signature_trait,
        emotional_baseline:  form.emotional_baseline,
        core_belief:         form.core_belief,
        pressure_type:       form.pressure_type,
        personality:         form.personality,
      };
    case 'aesthetic':
      return {
        aesthetic_dna: {
          era_aesthetic:          form.era_aesthetic,
          color_palette:          form.color_palette,
          signature_silhouette:   form.signature_silhouette,
          signature_accessories:  form.signature_accessories,
          glam_energy:            form.glam_energy,
          visual_evolution_notes: form.visual_evolution_notes,
        },
      };
    case 'career':
      return {
        career_status: {
          profession:          form.profession,
          career_goal:         form.career_goal,
          reputation_level:    form.reputation_level,
          brand_relationships: form.brand_relationships,
          financial_status:    form.financial_status,
          public_recognition:  form.public_recognition,
          ongoing_arc:         form.ongoing_arc,
        },
      };
    case 'relationships':
      return {
        relationships_map: {
          allies:            form.allies,
          rivals:            form.rivals,
          mentors:           form.mentors,
          love_interests:    form.love_interests,
          business_partners: form.business_partners,
          dynamic_notes:     form.dynamic_notes,
        },
      };
    case 'story':
      return {
        story_presence: {
          appears_in_books:     form.appears_in_books,
          appears_in_shows:     form.appears_in_shows,
          appears_in_series:    form.appears_in_series,
          current_story_status: form.current_story_status,
          unresolved_threads:   form.unresolved_threads,
          future_potential:     form.future_potential,
        },
      };
    case 'voice':
      return {
        voice_signature: {
          speech_pattern:           form.speech_pattern,
          vocabulary_tone:          form.vocabulary_tone,
          catchphrases:             form.catchphrases,
          internal_monologue_style: form.internal_monologue_style,
          emotional_reactivity:     form.emotional_reactivity,
        },
      };
    case 'evolution':
      return {
        evolution_tracking: {
          version_history:        form.version_history,
          era_changes:            form.era_changes,
          personality_shifts:     form.personality_shifts,
          reputation_milestones:  form.reputation_milestones,
          visual_transformations: form.visual_transformations,
        },
      };
    case 'living':
      return {
        living_context: {
          active_pressures:          form.active_pressures,
          support_network:           form.support_network,
          home_environment:          form.home_environment,
          relationship_to_deadlines: form.relationship_to_deadlines,
          financial_reality:         form.financial_reality,
          current_season:            form.current_season,
        },
      };
    default:
      return form;
  }
}
