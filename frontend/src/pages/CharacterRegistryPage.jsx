/**
 * Character Registry — Archival Design
 *
 * Serious. Literary. Elevated.
 *
 * Three views:
 *   1. Browse (Editorial Grid / Archive List)
 *   2. Full-Page Dossier (Left portrait + Right tabbed sections)
 *
 * "When someone opens the Character Registry, they should feel:
 *  This is serious."
 *
 * Location: frontend/src/pages/CharacterRegistryPage.jsx
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import SocialProfileGenerator from './SocialProfileGenerator';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './CharacterRegistryPage.css';
import CharacterDilemmaEngine from '../components/CharacterDilemmaEngine';
import {
  ROLE_COLORS, ROLE_LABELS, ROLE_OPTIONS, ROLE_ICONS,
  MOMENTUM, CANON_TIERS, DOSSIER_TABS,
  ARCHETYPES, GLAM_ENERGIES, STORY_STATUSES,
} from '../constants/characterConstants';
import useRegistries from '../hooks/useRegistries';
import CharacterCreationDrawer from '../components/CharacterCreationDrawer';

/* ── Auto-scroll active tab into view on mobile ── */
function useTabAutoScroll(tabRef, activeTab) {
  useEffect(() => {
    if (!tabRef.current) return;
    const active = tabRef.current.querySelector('.cr-dossier-tab.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);
}

/* ── Constants imported from constants/characterConstants.js ── */

const API = '/api/v1/character-registry';
const AI_API = '/api/v1/character-ai';

/* ── JSONB Helpers ──────────────────────────────────────────────── */

const jGet = (obj, key) => (obj && typeof obj === 'object' ? obj[key] || '' : '');

/* Check if a JSON object has any non-empty value */
const hasJsonData = (obj) => obj && typeof obj === 'object' && Object.values(obj).some(v => v && String(v).trim());

/* Normalize relationships_map: array format → flat format for dossier display */
const normalizeRelMap = (rm) => {
  if (!rm || typeof rm !== 'object') return null;
  // Already flat format
  if (!Array.isArray(rm)) return rm;
  // Convert array [{type, target, feels, note}] → {allies, rivals, mentors, love_interests, business_partners, dynamic_notes}
  const flat = { allies: '', rivals: '', mentors: '', love_interests: '', business_partners: '', dynamic_notes: '' };
  const typeMap = { support: 'allies', familial: 'allies', pressure: 'rivals', shadow: 'rivals', mirror: 'mentors', romantic: 'love_interests', transactional: 'business_partners', creation: 'allies' };
  const notes = [];
  rm.forEach(r => {
    const cat = typeMap[r.type] || 'allies';
    const label = r.target || 'Unknown';
    const detail = r.feels ? `${label} (${r.feels})` : label;
    flat[cat] = flat[cat] ? `${flat[cat]}, ${detail}` : detail;
    if (r.note) notes.push(`${label}: ${r.note}`);
  });
  if (notes.length) flat.dynamic_notes = notes.join('. ');
  return flat;
};

/* ── Writer Notes smart renderer ── */
function WriterNotesDisplay({ notes }) {
  if (!notes) return null;

  // Try to parse as JSON
  let parsed = null;
  try {
    const trimmed = notes.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      parsed = JSON.parse(trimmed);
    }
  } catch (_) { /* not JSON, that's fine */ }

  // Plain text — render directly
  if (!parsed || typeof parsed !== 'object') {
    return <p className="cr-dossier-writer-notes-text" style={{ whiteSpace: 'pre-line' }}>{notes}</p>;
  }

  // Helper: render a value (string, array, object) as readable text
  const renderValue = (val) => {
    if (val == null || val === '') return null;
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      return (
        <ul className="wn-list">
          {val.map((item, i) => (
            <li key={i} className="wn-list-item">
              {typeof item === 'object' ? renderObject(item) : String(item)}
            </li>
          ))}
        </ul>
      );
    }
    if (typeof val === 'object') return renderObject(val);
    return <span>{String(val)}</span>;
  };

  const renderObject = (obj) => (
    <div className="wn-sub-block">
      {Object.entries(obj).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
        <div key={k} className="wn-row">
          <span className="wn-key">{k.replace(/_/g, ' ')}</span>
          <span className="wn-val">{typeof v === 'object' ? renderValue(v) : String(v)}</span>
        </div>
      ))}
    </div>
  );

  // Known top-level section labels
  const sectionLabels = {
    seed: '🌱 Seed',
    living_state: '💭 Living State',
    arc_timeline: '📐 Arc Timeline',
    aesthetic_dna: '🎨 Aesthetic DNA',
    career: '💼 Career',
    relationships: '❤️ Relationships',
    voice: '🗣️ Voice',
    dilemma: '⚖️ Dilemma',
    story_presence: '📖 Story Presence',
    plot_threads: '🧵 Plot Threads',
    psychology: '🧠 Psychology',
    identity: '🪪 Identity',
    visual: '👁️ Visual',
  };

  const entries = Object.entries(parsed).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0));

  if (entries.length === 0) {
    return <p className="cr-dossier-writer-notes-text" style={{ color: '#999' }}>Empty notes.</p>;
  }

  return (
    <div className="wn-formatted">
      {entries.map(([key, value]) => (
        <details key={key} className="wn-section" open>
          <summary className="wn-section-title">{sectionLabels[key] || key.replace(/_/g, ' ')}</summary>
          <div className="wn-section-body">{renderValue(value)}</div>
        </details>
      ))}
    </div>
  );
}

/* Empty state shown when a tab has no data */
function EmptyState({ label, onEdit }) {
  return (
    <div className="cr-dossier-empty">
      <div className="cr-dossier-empty-icon">📝</div>
      <p className="cr-dossier-empty-text">No {label} data yet.</p>
      <button className="cr-dossier-empty-btn" onClick={onEdit}>
        ✎ Add {label}
      </button>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CharacterRegistryPage() {

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Mobile Detection ── */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* ── State ── */
  const [view, setView]             = useState('browse');      // 'browse' | 'dossier'
  const [viewMode, setViewMode]     = useState(() => window.innerWidth < 768 ? 'grid' : 'grid'); // always grid default
  const [registries, setRegistries] = useState([]);
  const [activeRegistry, setActiveRegistry] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);

  // Browse state
  const [search, setSearch]       = useState('');
  const [filters, setFilters]     = useState({ canon: null, role: null, era: null, status: null });
  const [showFilters, setShowFilters] = useState(false);

  // Dossier state
  const [activeChar, setActiveChar]       = useState(null);
  const [dossierTab, setDossierTab]       = useState('overview');
  const [editSection, setEditSection]     = useState(null);
  const [form, setForm]                   = useState({});
  const [saving, setSaving]               = useState(false);

  // New character modal (legacy)
  const [showNewChar, setShowNewChar]     = useState(false);
  const [newCharForm, setNewCharForm]     = useState({ display_name: '', role_type: 'support', icon: '' });

  // Character creation drawer
  const [showCreationDrawer, setShowCreationDrawer] = useState(false);

  // Registry management
  const [showNewRegistry, setShowNewRegistry]     = useState(false);
  const [editingRegistry, setEditingRegistry]     = useState(null);   // null or registry object
  const [registryForm, setRegistryForm]           = useState({ title: '', book_tag: '', description: '', core_rule: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId]       = useState(null);

  // Dossier mobile: collapse left panel
  const [dossierPanelOpen, setDossierPanelOpen] = useState(false);
  const tabsRef = useRef(null);
  useTabAutoScroll(tabsRef, dossierTab);

  // Living State / Arc / Threads (merged from CharacterHome)
  const [livingStates, setLivingStates]   = useState({});     // { charId: stateObj }
  const [charArc, setCharArc]             = useState(null);
  const [plotThreads, setPlotThreads]     = useState([]);
  const [generatingArc, setGeneratingArc] = useState(false);
  const [generatingId, setGeneratingId]   = useState(null);   // single char generation

  // Plot thread CRUD state
  const [showNewThread, setShowNewThread] = useState(false);
  const [threadForm, setThreadForm]       = useState({ title: '', description: '', status: 'open', source: '' });
  const [editingThreadId, setEditingThreadId] = useState(null);

  // Feed mode — The Feed (parasocial creator profiles)
  const [feedMode, setFeedMode]             = useState(false);

  // World mode — flat view of ALL characters across registries
  const [worldMode, setWorldMode]           = useState(false);
  const [allCharacters, setAllCharacters]   = useState([]);
  const [worldType, setWorldType]           = useState('all');  // role type filter

  // AI Writer state
  const [aiMode, setAiMode]             = useState('scene');    // scene | monologue | profile | gaps | next
  const [aiPrompt, setAiPrompt]         = useState('');
  const [aiMood, setAiMood]             = useState('');
  const [aiOtherChars, setAiOtherChars] = useState('');
  const [aiLength, setAiLength]         = useState('medium');   // short | medium | long
  const [aiDirection, setAiDirection]    = useState('');
  const [aiResult, setAiResult]         = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState(null);
  const [aiContextUsed, setAiContextUsed] = useState(null);

  // Comparison view state
  const [compareMode, setCompareMode]   = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);  // array of char ids (max 2)
  const [showCompare, setShowCompare]   = useState(false);

  // Bulk selection / delete state
  const [selectMode, setSelectMode]               = useState(false);
  const [selectedIds, setSelectedIds]             = useState(new Set());
  const [bulkDeleting, setBulkDeleting]           = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Bulk status / move modals
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget]       = useState('accepted');
  const [showBulkMoveModal, setShowBulkMoveModal]     = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget]           = useState('');

  // Card size: 'compact' | 'normal' | 'large'
  const [cardSize, setCardSize]   = useState('normal');

  // Sort option: 'default' | 'name' | 'role' | 'status' | 'recent'
  const [sortBy, setSortBy]       = useState('default');

  // Quick-edit inline
  const [quickEditId, setQuickEditId]       = useState(null);
  const [quickEditForm, setQuickEditForm]   = useState({});

  // Portrait gallery view (extends viewMode)
  // viewMode can now be 'grid' | 'list' | 'gallery'

  // Export state
  const [exporting, setExporting] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  /* ── Data Fetching ── */

  const fetchRegistries = useCallback(async () => {
    try {
      const res = await fetch(`${API}/registries`);
      const data = await res.json();
      if (data.success) {
        setRegistries(data.registries || []);
        // Auto-select first registry
        if (data.registries?.length && !activeRegistry) {
          const first = data.registries[0];
          fetchRegistry(first.id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch registries', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRegistry = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/registries/${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveRegistry(data.registry);
        setRegistries(prev => prev.map(r => r.id === id ? data.registry : r));
      }
    } catch (e) {
      console.error('Failed to fetch registry', e);
    }
  }, []);

  useEffect(() => { fetchRegistries(); }, [fetchRegistries]);

  // Load living states from localStorage on mount, then try DB
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wv_living_states') || '{}');
    setLivingStates(saved);
  }, []);

  // Hydrate living states from DB (evolution_tracking.living_state) when registry loads
  useEffect(() => {
    if (!activeRegistry?.characters) return;
    const dbStates = {};
    for (const ch of activeRegistry.characters) {
      const ls = ch.evolution_tracking?.living_state;
      if (ls?.isGenerated) dbStates[ch.id] = ls;
    }
    if (Object.keys(dbStates).length > 0) {
      setLivingStates(prev => {
        const merged = { ...prev };
        for (const [id, state] of Object.entries(dbStates)) {
          if (!merged[id]?.isGenerated) merged[id] = state;
        }
        localStorage.setItem('wv_living_states', JSON.stringify(merged));
        return merged;
      });
    }
  }, [activeRegistry?.id]);

  // Names to exclude from All Characters world view (none currently)
  const WORLD_EXCLUDE = [];

  // Load ALL characters across ALL registries + Press (for World mode)
  const loadAllCharacters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/registries`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const regs = data.registries || data || [];
      const all = [];
      for (const reg of regs) {
        const r = await fetch(`${API}/registries/${reg.id}`, { credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          const chars = d.registry?.characters || d.characters || [];
          // Tag each character with its registry name for display in All Characters view
          for (const ch of chars) {
            ch._registryTitle = reg.title || 'Unknown';
            ch._registryTag = reg.book_tag || '';
          }
          all.push(...chars);
        }
      }
      setAllCharacters(all);
    } catch { /* silent */ }
  }, []);

  // ── Generate living state via Claude ─────────────────────────────────
  function generateFallbackState(character) {
    const name = character?.selected_name || character?.display_name || 'Character';
    const typeDefaults = {
      protagonist: { currentKnows: `${name} understands more than she lets on.`, currentWants: `To become what she was always becoming.`, unresolved: `The gap between who she is and who she's building.`, momentum: 'rising' },
      special:     { currentKnows: `${name} understands more than she lets on.`, currentWants: `To become what she was always becoming.`, unresolved: `The gap between who she is and who she's building.`, momentum: 'rising' },
      pressure:    { currentKnows: `${name} sees the risk before the possibility.`, currentWants: `To protect what's already been built.`, unresolved: `Whether his caution is wisdom or fear.`, momentum: 'steady' },
      mirror:      { currentKnows: `${name} has done what others are trying to do.`, currentWants: `Nothing — she's already there.`, unresolved: `Whether she'd have gotten there differently.`, momentum: 'steady' },
      support:     { currentKnows: `${name} holds the thread of consistency.`, currentWants: `To see the pattern resolved.`, unresolved: `Whether she's been seen for her steadiness.`, momentum: 'steady' },
      shadow:      { currentKnows: `${name} appeared at exactly the right moment.`, currentWants: `To be the answer someone needed.`, unresolved: `Whether the rescue was real.`, momentum: 'falling' },
    };
    const defaults = typeDefaults[character?.role_type] || typeDefaults.support;
    return { ...defaults, relationships: [], isGenerated: true };
  }

  const generateState = useCallback(async (charId) => {
    // Find in allCharacters or activeRegistry
    const character = allCharacters.find(c => c.id === charId) ||
                      (activeRegistry?.characters || []).find(c => c.id === charId);
    if (!character) return;
    setGeneratingId(charId);
    try {
      const charName = character.selected_name || character.display_name || 'Character';
      const res = await fetch('/api/v1/memories/generate-living-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          character_id: charId,
          character_name: charName,
          character_type: character.role_type,
          character_role: character.role_label,
          belief_pressured: character.belief_pressured,
        }),
      });
      let newState;
      if (res.ok) {
        const data = await res.json();
        newState = {
          currentKnows:  data.knows  || `${charName} knows the world she's been given.`,
          currentWants:  data.wants  || `${charName} wants something she can't name yet.`,
          unresolved:    data.unresolved || "Something between her and what she's after.",
          lastChapter:   data.lastChapter || null,
          momentum:      data.momentum || 'steady',
          relationships: data.relationships || [],
          isGenerated:   true,
        };
      } else {
        newState = generateFallbackState(character);
      }
      setLivingStates(prev => {
        const updated = { ...prev, [charId]: newState };
        localStorage.setItem('wv_living_states', JSON.stringify(updated));
        return updated;
      });
      // Persist to DB via evolution_tracking
      try {
        await fetch(`${API}/characters/${charId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evolution_tracking: { ...character.evolution_tracking, living_state: newState } }),
        });
      } catch { /* non-critical */ }
    } catch {
      const newState = generateFallbackState(character);
      setLivingStates(prev => {
        const updated = { ...prev, [charId]: newState };
        localStorage.setItem('wv_living_states', JSON.stringify(updated));
        return updated;
      });
      // Persist fallback to DB too
      try {
        await fetch(`${API}/characters/${charId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evolution_tracking: { ...character.evolution_tracking, living_state: newState } }),
        });
      } catch { /* non-critical */ }
    } finally {
      setGeneratingId(null);
    }
  }, [allCharacters, activeRegistry]);


  // Fetch book ID for interview context
  useEffect(() => {
    if (!activeRegistry?.book_tag) return;
    (async () => {
      try {
        const res = await fetch('/api/v1/storyteller/books');
        const data = await res.json();
        const books = data.books || data || [];
        const match = books.find(b =>
          b.title?.toLowerCase().includes('book 1') ||
          b.title?.toLowerCase().includes('before lala')
        );
        if (match) setBookId(match.id);
      } catch (e) { /* no book context */ }
    })();
  }, [activeRegistry?.book_tag]);

  // Deep-link: ?charId=xxx opens that character's dossier, ?view=world opens world mode
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'world') {
      setWorldMode(true);
      loadAllCharacters();
      setSearchParams({}, { replace: true });
      return;
    }
    const linkId = searchParams.get('charId');
    if (!linkId) return;
    // Try to find in active registry first, then load all
    const chars = activeRegistry?.characters || [];
    const found = chars.find(c => c.id === linkId);
    if (found) {
      setActiveChar(found);
      setView('dossier');
      setDossierTab(searchParams.get('tab') || 'living');
      setEditSection(null);
      setSearchParams({}, { replace: true });
    } else if (allCharacters.length > 0) {
      const fromAll = allCharacters.find(c => c.id === linkId);
      if (fromAll) {
        setActiveChar(fromAll);
        setView('dossier');
        setDossierTab(searchParams.get('tab') || 'living');
        setEditSection(null);
        setSearchParams({}, { replace: true });
      }
    }
  }, [activeRegistry, searchParams, allCharacters]);

  // Load plot threads & arc when dossier opens for a character
  useEffect(() => {
    if (view !== 'dossier' || !activeChar) {
      setCharArc(null);
      setPlotThreads([]);
      return;
    }
    // Plot threads from API
    (async () => {
      try {
        const res = await fetch(`${API}/characters/${activeChar.id}/plot-threads`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPlotThreads(data.threads || []);
        }
      } catch { /* phase 2 */ }
    })();
  }, [view, activeChar?.id]);

  // Generate arc from manuscript
  const generateArc = useCallback(async () => {
    if (!activeChar) return;
    setGeneratingArc(true);
    try {
      const res = await fetch('/api/v1/memories/generate-character-arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          character_id: activeChar.id,
          character_name: activeChar.selected_name || activeChar.display_name,
          character_type: activeChar.role_type,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCharArc(data.arc || data);
      } else {
        setCharArc({
          chapters: [
            { chapter: 'Ch 1', event: 'Introduction', shift: 'Belief intact' },
            { chapter: 'Ch 5', event: 'First pressure', shift: 'Cracks forming' },
          ],
          summary: `${activeChar.selected_name || activeChar.display_name}'s arc is still being written.`,
        });
      }
    } catch {
      setCharArc({ chapters: [], summary: 'Unable to generate arc. Connect to a manuscript first.' });
    } finally {
      setGeneratingArc(false);
    }
  }, [activeChar]);

  /* ── Plot Thread CRUD ── */
  const addPlotThread = async () => {
    if (!activeChar || !threadForm.title.trim()) return;
    try {
      const res = await fetch(`${API}/characters/${activeChar.id}/plot-threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threadForm),
      });
      const data = await res.json();
      if (data.success) {
        setPlotThreads(data.threads);
        setShowNewThread(false);
        setThreadForm({ title: '', description: '', status: 'open', source: '' });
        showToast('Plot thread added');
      }
    } catch (e) { showToast('Failed to add thread', 'error'); }
  };

  const updatePlotThread = async (threadId) => {
    if (!activeChar) return;
    try {
      const res = await fetch(`${API}/characters/${activeChar.id}/plot-threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threadForm),
      });
      const data = await res.json();
      if (data.success) {
        setPlotThreads(data.threads);
        setEditingThreadId(null);
        setThreadForm({ title: '', description: '', status: 'open', source: '' });
        showToast('Plot thread updated');
      }
    } catch (e) { showToast('Failed to update thread', 'error'); }
  };

  const deletePlotThread = async (threadId) => {
    if (!activeChar) return;
    try {
      const res = await fetch(`${API}/characters/${activeChar.id}/plot-threads/${threadId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setPlotThreads(data.threads);
        showToast('Thread removed');
      }
    } catch (e) { showToast('Failed to delete thread', 'error'); }
  };

  const toggleThreadStatus = async (thread) => {
    const nextStatus = thread.status === 'open' ? 'active' : thread.status === 'active' ? 'resolved' : 'open';
    try {
      const res = await fetch(`${API}/characters/${activeChar.id}/plot-threads/${thread.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) setPlotThreads(data.threads);
    } catch { /* silent */ }
  };

  /* ── Characters + Filtering ── */

  const characters = worldMode ? allCharacters : (activeRegistry?.characters || []);

  const sorted = useMemo(() => {
    let arr = [...characters];
    switch (sortBy) {
      case 'name':    arr.sort((a, b) => (a.selected_name || a.display_name || '').localeCompare(b.selected_name || b.display_name || '')); break;
      case 'role':    arr.sort((a, b) => (a.role_type || '').localeCompare(b.role_type || '')); break;
      case 'status':  arr.sort((a, b) => (a.status || '').localeCompare(b.status || '')); break;
      case 'recent':  arr.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)); break;
      default:        arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return arr;
  }, [characters, sortBy]);

  const eras = [...new Set(sorted.map(c => c.era_introduced).filter(Boolean))];

  // World mode uses simpler type filter + search; browse mode uses full filter set
  const filtered = worldMode
    ? sorted.filter(c => {
      if (worldType !== 'all' && c.role_type !== worldType) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [c.display_name, c.selected_name, c.role_type, c.subtitle, c.description]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    : sorted.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        c.display_name, c.subtitle, c.description, c.selected_name,
        c.character_archetype, c.core_desire, c.core_fear, c.core_wound,
        c.personality, c.writer_notes, c.role_label, c.belief_pressured,
        c.core_belief, c.pressure_type, c.role_type,
        ROLE_LABELS[c.role_type],
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.canon === 'Core Canon' && c.canon_tier !== 'Core Canon') return false;
    if (filters.canon === 'Licensed' && c.canon_tier !== 'Licensed') return false;
    if (filters.role && c.role_type !== filters.role) return false;
    if (filters.era && c.era_introduced !== filters.era) return false;
    if (filters.status === 'archived' && c.status !== 'declined') return false;
    if (filters.status === 'active' && (c.status === 'declined')) return false;
    return true;
  });

  /* ── Pagination ── */
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters/search change
  useEffect(() => { setCurrentPage(1); }, [search, filters, worldType, activeRegistry?.id]);

  const hasActiveFilters = filters.canon || filters.role || filters.era || filters.status;

  const clearFilters = () => setFilters({ canon: null, role: null, era: null, status: null });

  const toggleFilter = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));
  };

  /* ── Bulk Selection helpers ── */
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`${API}/characters/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${data.deleted} character(s) deleted`);
        exitSelectMode();
        await fetchRegistries();
      } else {
        showToast(data.error || 'Bulk delete failed', 'error');
      }
    } catch (e) {
      showToast('Bulk delete failed: ' + e.message, 'error');
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  /* ── Bulk Status Update ── */
  const bulkUpdateStatus = async (overrideStatus) => {
    const targetStatus = overrideStatus || bulkStatusTarget;
    if (selectedIds.size === 0 || !targetStatus) return;
    try {
      const res = await fetch(`${API}/characters/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], status: targetStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${data.updated} character(s) → ${targetStatus}`);
        exitSelectMode();
        setShowBulkStatusModal(false);
        await fetchRegistries();
        if (worldMode) await loadAllCharacters();
      } else {
        showToast(data.error || 'Status update failed', 'error');
      }
    } catch (e) {
      showToast('Status update failed: ' + e.message, 'error');
    }
  };

  /* ── Bulk Move to Registry ── */
  const bulkMoveToRegistry = async () => {
    if (selectedIds.size === 0 || !bulkMoveTarget) return;
    try {
      const res = await fetch(`${API}/characters/bulk-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], registryId: bulkMoveTarget }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        exitSelectMode();
        setShowBulkMoveModal(false);
        await fetchRegistries();
        if (activeRegistry?.id) await fetchRegistry(activeRegistry.id);
        if (worldMode) await loadAllCharacters();
      } else {
        showToast(data.error || 'Move failed', 'error');
      }
    } catch (e) {
      showToast('Move failed: ' + e.message, 'error');
    }
  };

  /* ── Bulk Deep Profile Generation ── */
  const [bulkDeepProfileRunning, setBulkDeepProfileRunning] = useState(false);
  const bulkGenerateDeepProfiles = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Generate deep profiles for ${selectedIds.size} character(s)? This uses AI and may take a while.`)) return;
    setBulkDeepProfileRunning(true);
    try {
      const res = await fetch(`${API}/characters/bulk-deep-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Deep profiles: ${data.succeeded} generated, ${data.skipped} skipped, ${data.failed} failed`);
        exitSelectMode();
        if (activeRegistry?.id) await fetchRegistry(activeRegistry.id);
        if (worldMode) await loadAllCharacters();
      } else {
        showToast(data.error || 'Bulk deep profile failed', 'error');
      }
    } catch (e) {
      showToast('Bulk deep profile failed: ' + e.message, 'error');
    } finally { setBulkDeepProfileRunning(false); }
  };

  /* ── Bulk Writer Paragraph Generation ── */
  const [bulkWriterParagraphRunning, setBulkWriterParagraphRunning] = useState(false);
  const [bulkWriterParagraphs, setBulkWriterParagraphs] = useState(null);
  const bulkGenerateWriterParagraphs = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Generate writer paragraphs for ${selectedIds.size} character(s)? This uses AI and may take a while.`)) return;
    setBulkWriterParagraphRunning(true);
    try {
      const res = await fetch(`${API}/characters/bulk-writer-paragraph`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Writer paragraphs: ${data.succeeded} generated, ${data.failed} failed`);
        if (data.paragraphs && data.paragraphs.length > 0) {
          setBulkWriterParagraphs(data.paragraphs);
        }
        exitSelectMode();
      } else {
        showToast(data.error || 'Bulk writer paragraph failed', 'error');
      }
    } catch (e) {
      showToast('Bulk writer paragraph failed: ' + e.message, 'error');
    } finally { setBulkWriterParagraphRunning(false); }
  };

  /* ── Clone Character ── */
  const cloneCharacter = async (charId) => {
    try {
      const res = await fetch(`${API}/characters/${charId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Character cloned');
        if (activeRegistry?.id) await fetchRegistry(activeRegistry.id);
        if (worldMode) await loadAllCharacters();
      } else {
        showToast(data.error || 'Clone failed', 'error');
      }
    } catch (e) {
      showToast('Clone failed: ' + e.message, 'error');
    }
  };

  /* ── Export Registry as JSON ── */
  const exportRegistryJSON = useCallback(() => {
    const data = worldMode ? allCharacters : (activeRegistry?.characters || []);
    if (data.length === 0) return showToast('Nothing to export', 'error');
    setExporting(true);
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        registry: worldMode ? 'All Characters' : activeRegistry?.title,
        character_count: data.length,
        characters: data.map(c => ({
          id: c.id,
          display_name: c.display_name,
          selected_name: c.selected_name,
          role_type: c.role_type,
          role_label: c.role_label,
          status: c.status,
          canon_tier: c.canon_tier,
          character_archetype: c.character_archetype,
          description: c.description,
          core_desire: c.core_desire,
          core_fear: c.core_fear,
          core_wound: c.core_wound,
          mask_persona: c.mask_persona,
          truth_persona: c.truth_persona,
          belief_pressured: c.belief_pressured,
          core_belief: c.core_belief,
          personality: c.personality,
          signature_trait: c.signature_trait,
          emotional_baseline: c.emotional_baseline,
          voice_signature: c.voice_signature,
          aesthetic_dna: c.aesthetic_dna,
          career_status: c.career_status,
          relationships_map: c.relationships_map,
          story_presence: c.story_presence,
          evolution_tracking: c.evolution_tracking,
          writer_notes: c.writer_notes,
          portrait_url: c.portrait_url,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(worldMode ? 'all-characters' : activeRegistry?.title || 'registry').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export downloaded');
    } catch (e) {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }, [worldMode, allCharacters, activeRegistry, showToast]);

  /* ── Quick-Edit Inline ── */
  const startQuickEdit = (char) => {
    setQuickEditId(char.id);
    setQuickEditForm({
      display_name: char.display_name || '',
      role_type: char.role_type || 'support',
      status: char.status || 'draft',
    });
  };

  const saveQuickEdit = async () => {
    if (!quickEditId) return;
    try {
      const res = await fetch(`${API}/characters/${quickEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickEditForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Updated');
        setQuickEditId(null);
        setQuickEditForm({});
        if (activeRegistry?.id) await fetchRegistry(activeRegistry.id);
        if (worldMode) await loadAllCharacters();
      } else {
        showToast(data.error || 'Update failed', 'error');
      }
    } catch (e) {
      showToast('Update failed', 'error');
    }
  };

  /* ── Keyboard Navigation ── */
  useEffect(() => {
    const handler = (e) => {
      // Only active in browse view
      if (view !== 'browse') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Escape') {
        if (selectMode) { exitSelectMode(); e.preventDefault(); }
        else if (compareMode) { setCompareMode(false); setCompareSelection([]); e.preventDefault(); }
        else if (showFilters) { setShowFilters(false); e.preventDefault(); }
      }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.querySelector('.cr-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, selectMode, compareMode, showFilters]);

  /* ── Relationship count helper ── */
  const getRelCount = useCallback((char) => {
    const rm = normalizeRelMap(char.relationships_map);
    if (!rm || typeof rm !== 'object') return 0;
    let count = 0;
    ['allies', 'rivals', 'mentors', 'love_interests', 'business_partners'].forEach(key => {
      const val = rm[key];
      if (val && typeof val === 'string') count += val.split(',').filter(s => s.trim()).length;
    });
    return count;
  }, []);

  /* ── Character Actions ── */

  const openDossier = (char) => {
    if (selectMode) {
      toggleSelectId(char.id);
      return;
    }
    if (compareMode) {
      setCompareSelection(prev => {
        if (prev.includes(char.id)) return prev.filter(id => id !== char.id);
        if (prev.length >= 2) return [prev[1], char.id];
        return [...prev, char.id];
      });
      return;
    }
    setActiveChar(char);
    setView('dossier');
    setDossierTab('overview');
    setEditSection(null);
  };

  const closeDossier = () => {
    setView('browse');
    setActiveChar(null);
    setEditSection(null);
  };

  const createCharacter = async () => {
    if (!activeRegistry || !newCharForm.display_name.trim()) return;
    try {
      const res = await fetch(`${API}/registries/${activeRegistry.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newCharForm.display_name.trim(),
          role_type: newCharForm.role_type,
          icon: newCharForm.icon || '◆',
          character_key: newCharForm.display_name.trim().toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Character created');
        setShowNewChar(false);
        setNewCharForm({ display_name: '', role_type: 'support', icon: '' });
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Failed to create character', 'error');
      }
    } catch (e) {
      showToast('Failed to create character', 'error');
    }
  };

  const seedBook1 = async () => {
    if (!activeRegistry) return;
    try {
      const res = await fetch(`${API}/registries/${activeRegistry.id}/seed-book1`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Seeded ${data.seeded} characters`);
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Seed failed', 'error');
      }
    } catch (e) {
      showToast('Failed to seed characters', 'error');
    }
  };

  const createRegistry = () => {
    setRegistryForm({ title: '', book_tag: '', description: '', core_rule: '' });
    setShowNewRegistry(true);
  };

  const submitNewRegistry = async () => {
    if (!registryForm.title.trim()) return;
    try {
      const res = await fetch(`${API}/registries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: registryForm.title.trim(),
          book_tag: registryForm.book_tag.trim() || null,
          description: registryForm.description.trim() || null,
          core_rule: registryForm.core_rule.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Registry created');
        setShowNewRegistry(false);
        setActiveRegistry(data.registry);
        await fetchRegistries();
      } else {
        showToast(data.error || 'Failed to create registry', 'error');
      }
    } catch (e) {
      showToast('Failed to create registry', 'error');
    }
  };

  const openEditRegistry = (reg) => {
    setRegistryForm({
      title: reg.title || '',
      book_tag: reg.book_tag || '',
      description: reg.description || '',
      core_rule: reg.core_rule || '',
    });
    setEditingRegistry(reg);
  };

  const updateRegistry = async () => {
    if (!editingRegistry || !registryForm.title.trim()) return;
    try {
      const res = await fetch(`${API}/registries/${editingRegistry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: registryForm.title.trim(),
          book_tag: registryForm.book_tag.trim() || null,
          description: registryForm.description.trim() || null,
          core_rule: registryForm.core_rule.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Registry updated');
        setEditingRegistry(null);
        if (activeRegistry?.id === editingRegistry.id) {
          await fetchRegistry(editingRegistry.id);
        }
        await fetchRegistries();
      } else {
        showToast(data.error || 'Failed to update registry', 'error');
      }
    } catch (e) {
      showToast('Failed to update registry', 'error');
    }
  };

  const confirmDeleteRegistry = (id) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const deleteRegistry = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API}/registries/${deleteTargetId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Registry deleted');
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
        if (activeRegistry?.id === deleteTargetId) {
          setActiveRegistry(null);
        }
        await fetchRegistries();
      } else {
        showToast(data.error || 'Failed to delete registry', 'error');
      }
    } catch (e) {
      showToast('Failed to delete registry', 'error');
    }
  };

  /* ── Dossier Section Save ── */

  const setCharStatus = async (charId, status) => {
    try {
      const res = await fetch(`${API}/characters/${charId}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Character ${status}`);
        await fetchRegistry(activeRegistry.id);
        // Update active char
        const refreshed = await fetch(`${API}/registries/${activeRegistry.id}`);
        const rData = await refreshed.json();
        if (rData.success) {
          const updated = (rData.registry?.characters || []).find(c => c.id === charId);
          if (updated) setActiveChar(updated);
        }
      }
    } catch (e) {
      showToast('Failed to update status', 'error');
    }
  };

  const startEdit = (tabKey) => {
    console.log('[EDIT] startEdit called with tabKey:', tabKey, 'activeChar:', activeChar?.display_name);
    const initial = buildFormForTab(tabKey, activeChar);
    setForm(initial);
    setEditSection(tabKey);
  };

  const cancelEdit = () => { setEditSection(null); setForm({}); };

  const F = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const saveSection = async () => {
    if (!editSection || !activeChar) return;
    setSaving(true);
    try {
      const payload = buildPayloadForTab(editSection, form);
      const res = await fetch(`${API}/characters/${activeChar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Saved');
        setEditSection(null);
        setForm({});
        // Refresh
        const refreshed = await fetch(`${API}/registries/${activeRegistry.id}`);
        const rData = await refreshed.json();
        if (rData.success) {
          setActiveRegistry(rData.registry);
          const updated = (rData.registry?.characters || []).find(c => c.id === activeChar.id);
          if (updated) setActiveChar(updated);
        }
      } else {
        showToast(data.error || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── AI Writer Actions ── */
  const aiGenerate = async () => {
    if (!activeChar) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setAiContextUsed(null);

    const endpoints = {
      scene:     'write-scene',
      monologue: 'character-monologue',
      profile:   'build-profile',
      gaps:      'suggest-gaps',
      next:      'what-happens-next',
    };

    const body = { character_id: activeChar.id };

    if (aiMode === 'scene') {
      body.situation = aiPrompt;
      body.mood = aiMood;
      body.other_characters = aiOtherChars;
      body.length = aiLength;
    } else if (aiMode === 'monologue') {
      body.moment = aiPrompt;
      body.prompt = aiMood; // reuse mood field as additional context
    } else if (aiMode === 'next') {
      body.direction = aiDirection || aiPrompt;
    }

    try {
      const res = await fetch(`${AI_API}/${endpoints[aiMode]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data);
        setAiContextUsed(data.context_used || data.data_sources || null);
      } else {
        setAiError(data.error || 'Generation failed');
      }
    } catch (e) {
      setAiError('Failed to connect to AI service');
    } finally {
      setAiLoading(false);
    }
  };

  const aiClear = () => {
    setAiResult(null);
    setAiError(null);
    setAiPrompt('');
    setAiMood('');
    setAiOtherChars('');
    setAiDirection('');
  };

  /* ── Save AI Writer Result to Character Profile ── */
  const saveAiToProfile = useCallback(async (fields) => {
    if (!activeChar || !fields || Object.keys(fields).length === 0) return;
    try {
      const res = await fetch(`${API}/characters/${activeChar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success) {
        showToast('AI result saved to profile');
        // Refresh character data
        if (activeRegistry?.id) {
          const refreshed = await fetch(`${API}/registries/${activeRegistry.id}`);
          const rData = await refreshed.json();
          if (rData.success) {
            setActiveRegistry(rData.registry);
            const updated = (rData.registry?.characters || []).find(c => c.id === activeChar.id);
            if (updated) setActiveChar(updated);
          }
        }
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (e) {
      showToast('Failed to save AI result', 'error');
    }
  }, [activeChar, activeRegistry, showToast]);

  /* ── Stats ── */
  const statusCounts = {
    total: sorted.length,
    draft: sorted.filter(c => c.status === 'draft').length,
    accepted: sorted.filter(c => c.status === 'accepted').length,
    alive: sorted.filter(c => c.depth_level === 'alive').length,
  };

  // World mode stats
  const worldTypeCounts = characters.reduce((acc, c) => {
    acc[c.role_type] = (acc[c.role_type] || 0) + 1;
    return acc;
  }, {});
  const generatedCount = characters.filter(c => livingStates[c.id]?.isGenerated).length;

  // Enter world mode
  const enterWorldMode = useCallback(() => {
    setFeedMode(false);
    setWorldMode(true);
    loadAllCharacters();
  }, [loadAllCharacters]);

  // Exit world mode
  const exitWorldMode = useCallback(() => {
    setWorldMode(false);
    setWorldType('all');
  }, []);

  // Enter/exit feed mode
  const enterFeedMode = useCallback(() => {
    setWorldMode(false);
    setFeedMode(true);
  }, []);
  const exitFeedMode = useCallback(() => {
    setFeedMode(false);
  }, []);


  /* ================================================================
     RENDER: LOADING
     ================================================================ */
  if (loading) {
    return (
      <div className="cr-page">
        <div className="cr-loading">Loading registry…</div>
      </div>
    );
  }


  /* ================================================================
     RENDER: NO REGISTRY
     ================================================================ */
  if (!activeRegistry) {
    return (
      <div className="cr-page">
        <HeaderBar
          search={search} onSearch={setSearch}
          viewMode={viewMode} onViewMode={setViewMode}
          showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
          onNewChar={() => {}}
          isMobile={isMobile}
        />
        <div className="cr-content">
          <div className="cr-empty-state">
            <div className="cr-empty-icon">◈</div>
            <h2 className="cr-empty-title">No Registries</h2>
            <p className="cr-empty-desc">Create a character registry to begin defining your cast.</p>
            <button className="cr-empty-btn" onClick={createRegistry}>
              Create Registry
            </button>
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }


  /* ================================================================
     RENDER: DOSSIER VIEW
     ================================================================ */
  if (view === 'dossier' && activeChar) {
    const c = activeChar;
    const isCore = c.canon_tier === 'Core Canon';

    return (
      <div className="cr-page">
        {/* Header (simplified for dossier) */}
        <div className="cr-header cr-header-dossier">
          <div className="cr-header-left">
            {isMobile ? (
              <button className="cr-dossier-back-btn-inline" onClick={closeDossier}>←</button>
            ) : (
              <>
                <div className="cr-header-brand">LaLaPlace</div>
                <div className="cr-header-breadcrumb">Universe → Registry → Dossier</div>
              </>
            )}
          </div>
          <div className="cr-header-center">
            <h1 className="cr-header-title">{isMobile ? 'Characters' : (c.selected_name || c.display_name)}</h1>
          </div>
          <div className="cr-header-right">
            {!isMobile && (
              <button className="cr-header-btn" onClick={() => navigate(`/therapy/${activeRegistry?.id || 'default'}`)}>
                ◈ Therapy
              </button>
            )}
          </div>
        </div>

        <div className="cr-dossier">
          {/* Back bar — desktop only, mobile uses header back button */}
          {!isMobile && (
            <div className="cr-dossier-back">
              <button className="cr-dossier-back-btn" onClick={closeDossier}>
                ← Back to Registry
              </button>
              <button className="cr-export-btn" onClick={() => window.print()} title="Print / Export PDF">
                🖨 Export
              </button>
            </div>
          )}

          <div className="cr-dossier-layout">

            {/* ── LEFT PANEL (30%) — collapsible on mobile ── */}
            <div className={`cr-dossier-left ${isMobile && !dossierPanelOpen ? 'collapsed' : ''}`}>
              {/* Mobile: compact summary strip (always visible) */}
              {isMobile && (
                <div className="cr-dossier-mobile-summary" onClick={() => setDossierPanelOpen(p => !p)}>
                  <div className={`cr-dossier-portrait-mini ${isCore ? 'canon-core' : ''}`}>
                    {c.icon ? (
                      <span className="portrait-icon-mini">{c.icon}</span>
                    ) : (
                      <span className="portrait-initial-mini">{(c.display_name || '?')[0]}</span>
                    )}
                  </div>
                  <div className="cr-dossier-mobile-identity">
                    <h2 className="cr-dossier-name-mobile">{c.selected_name || c.display_name}</h2>
                    <div className="cr-dossier-mobile-meta-line">
                      <span className={`cr-card-role ${c.role_type}`}>{c.role_label || ROLE_LABELS[c.role_type] || c.role_type}</span>
                      {c.character_archetype && <span className="cr-dossier-mobile-archetype">{c.character_archetype}</span>}
                      <span className={`cr-dossier-status-mini ${c.status}`}>
                        <span className="cr-dossier-status-dot" />
                        {c.status}
                      </span>
                    </div>
                  </div>
                  <span className={`cr-dossier-expand-arrow ${dossierPanelOpen ? 'open' : ''}`}>&#9662;</span>
                </div>
              )}

              {/* Full panel content — always on desktop, toggled on mobile */}
              <div className={`cr-dossier-left-inner ${isMobile && !dossierPanelOpen ? 'hidden' : ''}`}>
                {/* Portrait with upload support */}
                <div className={`cr-dossier-portrait ${isCore ? 'canon-core' : ''} ${c.portrait_url ? 'has-image' : ''}`}>
                  {c.portrait_url ? (
                    <img src={c.portrait_url} alt={c.display_name} className="portrait-image" />
                  ) : c.icon ? (
                    <span className="portrait-icon">{c.icon}</span>
                  ) : (
                    <span className="portrait-initial">{(c.display_name || '?')[0]}</span>
                  )}
                  <label className="portrait-upload-overlay" title="Upload portrait">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="portrait-file-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('portrait', file);
                        try {
                          const resp = await fetch(`${API}/characters/${c.id}/portrait`, {
                            method: 'POST',
                            body: fd,
                          });
                          const data = await resp.json();
                          if (data.success && data.portrait_url) {
                            setActiveChar(prev => ({ ...prev, portrait_url: data.portrait_url }));
                            if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
                            showToast('Portrait uploaded');
                          } else {
                            showToast(data.error || 'Upload failed', 'error');
                          }
                        } catch (err) {
                          console.error('Portrait upload failed:', err);
                          showToast('Portrait upload failed', 'error');
                        }
                        e.target.value = '';
                      }}
                    />
                    <span className="portrait-upload-icon">{'📷'}</span>
                  </label>
                  {c.portrait_url && (
                    <button
                      className="portrait-remove-btn"
                      title="Remove portrait"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const resp = await fetch(`${API}/characters/${c.id}/portrait`, { method: 'DELETE' });
                          const data = await resp.json();
                          if (data.success) {
                            setActiveChar(prev => ({ ...prev, portrait_url: null }));
                            if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
                            showToast('Portrait removed');
                          }
                        } catch (err) {
                          console.error('Portrait remove failed:', err);
                          showToast('Portrait remove failed', 'error');
                        }
                      }}
                    >
                      {'✕'}
                    </button>
                  )}
                </div>

                {/* Identity — hidden on mobile (already in summary strip) */}
                {!isMobile && (
                  <div>
                    <h2 className="cr-dossier-name">{c.selected_name || c.display_name}</h2>
                    {c.selected_name && c.display_name !== c.selected_name && (
                      <div className="cr-dossier-alias">née {c.display_name}</div>
                    )}
                  </div>
                )}

                {/* Meta fields — on mobile, skip Role & Archetype (already in strip) */}
                <div className="cr-dossier-meta">
                  {!isMobile && (
                    <div className="cr-dossier-meta-row">
                      <span className="cr-dossier-meta-label">Role</span>
                      <span className="cr-dossier-meta-value">{c.role_label || ROLE_LABELS[c.role_type] || c.role_type}</span>
                    </div>
                  )}
                  <div className="cr-dossier-meta-row">
                    <span className="cr-dossier-meta-label">Canon Tier</span>
                    <span className={`cr-dossier-meta-value ${isCore ? 'gold' : ''}`}>
                      {c.canon_tier || '—'}
                    </span>
                  </div>
                  {!isMobile && c.character_archetype && (
                    <div className="cr-dossier-meta-row">
                      <span className="cr-dossier-meta-label">Archetype</span>
                      <span className="cr-dossier-meta-value">{c.character_archetype}</span>
                    </div>
                  )}
                  {c.first_appearance && (
                    <div className="cr-dossier-meta-row">
                      <span className="cr-dossier-meta-label">First Appeared</span>
                      <span className="cr-dossier-meta-value">{c.first_appearance}</span>
                    </div>
                  )}
                  {c.era_introduced && (
                    <div className="cr-dossier-meta-row">
                      <span className="cr-dossier-meta-label">Era</span>
                      <span className="cr-dossier-meta-value">{c.era_introduced}</span>
                    </div>
                  )}
                </div>

                {/* Status — hidden on mobile (already in strip) */}
                {!isMobile && (
                  <div className={`cr-dossier-status ${c.status}`}>
                    <span className="cr-dossier-status-dot" />
                    {c.status?.toUpperCase()}
                  </div>
                )}
                {(() => {
                  const dp = c.deep_profile || {};
                  const filled = Object.keys(dp).filter(k => {
                    const d = dp[k];
                    return d && typeof d === 'object' && Object.values(d).some(v => v !== null && v !== undefined && v !== '');
                  }).length;
                  if (filled === 0) return null;
                  return (
                    <div className={`cr-dossier-profile-badge ${filled >= 14 ? 'complete' : ''}`}>
                      <span className="cr-dossier-profile-badge-icon">🧬</span>
                      {filled >= 14 ? 'Profile Complete' : `${filled}/14`}
                    </div>
                  );
                })()}

                {/* Relationship Quick View */}
                {c.relationships_map && (() => {
                  const nrm = normalizeRelMap(c.relationships_map) || {};
                  const hasRels = Object.values(nrm).some(v => v && String(v).trim());
                  if (!hasRels) return null;
                  return (
                    <div>
                      <span className="cr-dossier-meta-label" style={{ marginBottom: 8, display: 'block' }}>Relationships</span>
                      <div className="cr-dossier-rel-quick">
                        {jGet(nrm, 'allies') && (
                          <span className="cr-dossier-rel-chip">
                            <span className="cr-dossier-rel-chip-icon">🤝</span>
                            {jGet(nrm, 'allies').split(',')[0]?.trim()}
                          </span>
                        )}
                        {jGet(nrm, 'rivals') && (
                          <span className="cr-dossier-rel-chip">
                            <span className="cr-dossier-rel-chip-icon">⚔</span>
                            {jGet(nrm, 'rivals').split(',')[0]?.trim()}
                          </span>
                        )}
                        {jGet(nrm, 'mentors') && (
                          <span className="cr-dossier-rel-chip">
                            <span className="cr-dossier-rel-chip-icon">🏛</span>
                            {jGet(nrm, 'mentors').split(',')[0]?.trim()}
                          </span>
                        )}
                        {jGet(nrm, 'love_interests') && (
                          <span className="cr-dossier-rel-chip">
                            <span className="cr-dossier-rel-chip-icon">♡</span>
                            {jGet(nrm, 'love_interests').split(',')[0]?.trim()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="cr-dossier-actions">
                  {c.status !== 'accepted' && (
                    <button className="cr-dossier-action-btn accept" onClick={() => setCharStatus(c.id, 'accepted')}>
                      Accept
                    </button>
                  )}
                  <button className="cr-dossier-action-btn clone" onClick={() => cloneCharacter(c.id)} title="Duplicate this character">
                    ⧉ Clone
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL (70%) ── */}
            <div className="cr-dossier-right">
              {/* Tabs + Edit toggle */}
              <div className="cr-dossier-tabs-row">
                <button className="cr-tabs-scroll-btn left" onClick={() => { if (tabsRef.current) tabsRef.current.scrollBy({ left: -200, behavior: 'smooth' }); }} aria-label="Scroll tabs left">‹</button>
                <div className="cr-dossier-tabs" ref={tabsRef}>
                  {DOSSIER_TABS.map(t => (
                    <button
                      key={t.key}
                      className={`cr-dossier-tab ${dossierTab === t.key ? 'active' : ''}`}
                      onClick={() => { setDossierTab(t.key); setEditSection(null); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button className="cr-tabs-scroll-btn right" onClick={() => { if (tabsRef.current) tabsRef.current.scrollBy({ left: 200, behavior: 'smooth' }); }} aria-label="Scroll tabs right">›</button>
              </div>

              {/* Tab Content */}
              <div className="cr-dossier-tab-content">
                {/* ── Living State Tab ── */}
                {dossierTab === 'living' ? (() => {
                  const ls = livingStates[c.id] || null;
                  const mom = MOMENTUM[ls?.momentum || 'dormant'];
                  const meta = { color: ROLE_COLORS[c.role_type] || '#9a8c9e' };
                  const isGen = generatingId === c.id;
                  return (
                    <div className="cr-living-tab">
                      {ls?.isGenerated ? (
                        <>
                          <div className="cr-living-header">
                            <h4>Living State</h4>
                            <div className="cr-living-momentum" style={{ background: mom.color }}>
                              {mom.symbol} {mom.label}
                            </div>
                          </div>
                          <div className="cr-living-grid">
                            <div className="cr-living-slot">
                              <div className="cr-living-slot-label">Knows</div>
                              <div className="cr-living-slot-text">{ls.currentKnows}</div>
                            </div>
                            <div className="cr-living-slot">
                              <div className="cr-living-slot-label">Wants</div>
                              <div className="cr-living-slot-text">{ls.currentWants}</div>
                            </div>
                            <div className="cr-living-slot cr-living-slot-full">
                              <div className="cr-living-slot-label cr-living-slot-danger">Unresolved</div>
                              <div className="cr-living-slot-text">{ls.unresolved}</div>
                            </div>
                          </div>
                          {ls.lastChapter && (
                            <div className="cr-living-footer">Last seen: {ls.lastChapter}</div>
                          )}
                          <div className="cr-living-actions">
                              <button
                                className="cr-btn-outline"
                                onClick={() => generateState(c.id)}
                                disabled={isGen}
                              >
                                {isGen ? '✦ Regenerating…' : '↺ Regenerate'}
                              </button>
                            </div>
                        </>
                      ) : (
                        <div className="cr-dossier-empty">
                          <div className="cr-dossier-empty-icon">✦</div>
                          <p className="cr-dossier-empty-text">No living state generated yet.</p>
                          <button
                            className="cr-dossier-empty-btn"
                            onClick={() => generateState(c.id)}
                            disabled={isGen}
                          >
                            {isGen ? '✦ Generating…' : `✦ Generate ${c.selected_name || c.display_name}'s State`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()

                /* ── Arc Timeline Tab ── */
                : dossierTab === 'arc' ? (() => {
                  const ls = livingStates[c.id] || null;
                  const mom = MOMENTUM[ls?.momentum || 'dormant'];
                  const roleColor = ROLE_COLORS[c.role_type] || '#9a8c9e';
                  return (
                    <div className="cr-arc-tab">
                      {charArc?.summary && <p className="cr-arc-summary">{charArc.summary}</p>}
                      {charArc && (charArc.chapters || []).length > 0 ? (
                        <div className="cr-arc-strip">
                          {(charArc.chapters || []).map((ch, i) => (
                            <React.Fragment key={i}>
                              <div className="cr-arc-beat">
                                <div className="cr-arc-beat-header">
                                  <span className="cr-arc-chapter-label">{ch.chapter}</span>
                                  {ch.title && <span className="cr-arc-chapter-title">{ch.title}</span>}
                                  <span className="cr-arc-momentum" style={{ color: mom.color }}>{mom.symbol}</span>
                                </div>
                                <div className="cr-arc-event">{ch.event}</div>
                                {ch.shift && (
                                  <div className="cr-arc-shift">
                                    <span className="cr-arc-shift-label">Belief shift</span>
                                    {ch.shift}
                                  </div>
                                )}
                              </div>
                              {i < (charArc.chapters || []).length - 1 && (
                                <div className="cr-arc-connector" style={{ background: roleColor }} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      ) : !charArc ? (
                        <div className="cr-dossier-empty">
                          <div className="cr-dossier-empty-icon">📈</div>
                          <p className="cr-dossier-empty-text">No arc data yet.</p>
                          <button className="cr-dossier-empty-btn" onClick={generateArc} disabled={generatingArc}>
                            {generatingArc ? '✦ Generating…' : '✦ Generate Arc from Manuscript'}
                          </button>
                        </div>
                      ) : (
                        <div className="cr-dossier-empty">
                          <p className="cr-dossier-empty-text">Arc generated but no chapter beats found yet.</p>
                        </div>
                      )}
                    </div>
                  );
                })()

                /* ── Plot Threads Tab ── */
                : dossierTab === 'threads' ? (
                  <div className="cr-threads-tab">
                    <div className="cr-threads-header">
                      <h4>Plot Threads</h4>
                      <button className="cr-btn-outline" onClick={() => { setShowNewThread(true); setEditingThreadId(null); setThreadForm({ title: '', description: '', status: 'open', source: '' }); }}>
                        + New Thread
                      </button>
                    </div>

                    {/* New / Edit Thread Form */}
                    {(showNewThread || editingThreadId) && (
                      <div className="cr-thread-form">
                        <div className="cr-edit-field">
                          <label className="cr-edit-label">Thread Title *</label>
                          <input className="cr-edit-input" value={threadForm.title}
                            onChange={e => setThreadForm(p => ({ ...p, title: e.target.value }))}
                            placeholder="e.g. David's resistance to Lala" autoFocus />
                        </div>
                        <div className="cr-edit-field">
                          <label className="cr-edit-label">Description</label>
                          <textarea className="cr-edit-input cr-edit-textarea" value={threadForm.description}
                            onChange={e => setThreadForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="What this thread is about…" rows={2} />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div className="cr-edit-field" style={{ flex: 1 }}>
                            <label className="cr-edit-label">Status</label>
                            <select className="cr-edit-input cr-edit-select" value={threadForm.status}
                              onChange={e => setThreadForm(p => ({ ...p, status: e.target.value }))}>
                              <option value="open">Open</option>
                              <option value="active">Active</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                          <div className="cr-edit-field" style={{ flex: 1 }}>
                            <label className="cr-edit-label">Source</label>
                            <input className="cr-edit-input" value={threadForm.source}
                              onChange={e => setThreadForm(p => ({ ...p, source: e.target.value }))}
                              placeholder="Ch. 3, Ep. 5…" />
                          </div>
                        </div>
                        <div className="cr-modal-actions">
                          <button className="cr-edit-cancel-btn" onClick={() => { setShowNewThread(false); setEditingThreadId(null); }}>Cancel</button>
                          <button className="cr-edit-save-btn"
                            disabled={!threadForm.title.trim()}
                            onClick={() => editingThreadId ? updatePlotThread(editingThreadId) : addPlotThread()}>
                            {editingThreadId ? 'Update Thread' : 'Add Thread'}
                          </button>
                        </div>
                      </div>
                    )}

                    {plotThreads.length > 0 ? (
                      <div className="cr-threads-list">
                        {plotThreads.map((thread, i) => {
                          const dotColor = thread.status === 'active' ? '#3d8e42'
                            : thread.status === 'resolved' ? '#9a8c9e' : '#c9a84c';
                          return (
                            <div key={thread.id || i} className="cr-thread-entry">
                              <div className="cr-thread-dot" style={{ background: dotColor }}
                                onClick={() => toggleThreadStatus(thread)}
                                title="Click to cycle status" />
                              <div className="cr-thread-body">
                                <div className="cr-thread-title">{thread.title || thread.description}</div>
                                {thread.description && thread.title && (
                                  <div className="cr-thread-desc">{thread.description}</div>
                                )}
                                <div className="cr-thread-meta">
                                  <span style={{ color: dotColor }}>{thread.status || 'open'}</span>
                                  {thread.source && <span className="cr-thread-source">· {thread.source}</span>}
                                </div>
                              </div>
                              <div className="cr-thread-actions">
                                <button className="cr-thread-edit-btn" onClick={() => {
                                  setEditingThreadId(thread.id);
                                  setShowNewThread(false);
                                  setThreadForm({ title: thread.title || '', description: thread.description || '', status: thread.status || 'open', source: thread.source || '' });
                                }}>✎</button>
                                <button className="cr-thread-delete-btn" onClick={() => deletePlotThread(thread.id)}>✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !showNewThread ? (
                      <div className="cr-dossier-empty">
                        <div className="cr-dossier-empty-icon">🧵</div>
                        <p className="cr-dossier-empty-text">No plot threads tracked yet.</p>
                        <button className="cr-dossier-empty-btn" onClick={() => setShowNewThread(true)}>
                          + Add First Thread
                        </button>
                      </div>
                    ) : null}
                  </div>
                )

                /* ── Dilemma Tab ── */
                : dossierTab === 'dilemma' ? (
                  <CharacterDilemmaEngine
                    character={{
                      id: c.id,
                      name: c.display_name || c.name,
                      character_type: c.character_type || 'pressure',
                      role: c.role || c.subtitle || '',
                      story_context: c.story_presence?.current_story_status || '',
                    }}
                    onProfileBuilt={() => {
                      if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
                    }}
                  />
                ) : (
                  renderDossierTab(c, dossierTab, editSection, form, saving, startEdit, cancelEdit, saveSection, F, { aiMode, setAiMode, aiPrompt, setAiPrompt, aiMood, setAiMood, aiOtherChars, setAiOtherChars, aiLength, setAiLength, aiDirection, setAiDirection, aiResult, aiLoading, aiError, aiContextUsed, aiGenerate, aiClear, onSaveToProfile: saveAiToProfile })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom action bar */}
        {isMobile && (
          <div className="cr-mobile-bottom-bar">
            <button className="cr-mobile-bottom-btn" onClick={() => navigate(`/write?character=${c.id}`)}>
              <span className="cr-mobile-bottom-icon">✦</span>
              <span>Write</span>
            </button>
            <button className="cr-mobile-bottom-btn" onClick={() => setInterviewTarget(c)}>
              <span className="cr-mobile-bottom-icon">🎙</span>
              <span>Interview</span>
            </button>
            <button className="cr-mobile-bottom-btn" onClick={() => navigate(`/therapy/${activeRegistry?.id || 'default'}`)}>
              <span className="cr-mobile-bottom-icon">◈</span>
              <span>Therapy</span>
            </button>
            <button className="cr-mobile-bottom-btn" onClick={() => { setDossierTab('ai'); }}>
              <span className="cr-mobile-bottom-icon">⟐</span>
              <span>AI</span>
            </button>
          </div>
        )}

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }


  /* ================================================================
     RENDER: BROWSE VIEW (Grid / List)
     ================================================================ */
  return (
    <div className="cr-page">

      {/* Header */}
      <HeaderBar
        viewMode={viewMode}
        onViewMode={setViewMode}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        onNewChar={() => activeRegistry ? setShowCreationDrawer(true) : null}
        isMobile={isMobile}
      >
        {/* Registry tabs inside header */}
        {registries.length > 0 && (
          <div className="cr-registry-tabs">
            {registries.map(r => (
              <button
                key={r.id}
                className={`cr-registry-pill${!worldMode && !feedMode && activeRegistry?.id === r.id ? ' active' : ''}`}
                onClick={() => { exitWorldMode(); exitFeedMode(); fetchRegistry(r.id); }}
              >
                <span className="cr-pill-title">{r.title || 'Untitled'}</span>
                {r.book_tag && <span className="cr-pill-tag">{r.book_tag}</span>}
                {!worldMode && !feedMode && activeRegistry?.id === r.id && <span className="cr-pill-edit-icon">✎</span>}
              </button>
            ))}
            <button
              className={`cr-registry-pill${worldMode ? ' active world' : ''}`}
              onClick={enterWorldMode}
              title="View all characters across all registries"
            >
              <span className="cr-pill-title">🌍 All Characters</span>
            </button>
            <button
              className={`cr-registry-pill${feedMode ? ' active' : ''}`}
              onClick={enterFeedMode}
              title="The Feed — parasocial creator profiles"
            >
              <span className="cr-pill-title">📱 The Feed</span>
            </button>
          </div>
        )}
      </HeaderBar>

      {/* Filters */}
      {showFilters && !feedMode && (
        <div className="cr-filters">
          <span className="cr-filter-label">Filter</span>

          {/* Canon */}
          <button className={`cr-filter-pill ${filters.canon === 'Core Canon' ? 'active' : ''}`}
            onClick={() => toggleFilter('canon', 'Core Canon')}>Core Canon</button>
          <button className={`cr-filter-pill ${filters.canon === 'Licensed' ? 'active' : ''}`}
            onClick={() => toggleFilter('canon', 'Licensed')}>Licensed</button>

          <span className="cr-filter-sep" />

          {/* Status */}
          <button className={`cr-filter-pill ${filters.status === 'archived' ? 'active' : ''}`}
            onClick={() => toggleFilter('status', 'archived')}>Archived</button>

          <span className="cr-filter-sep" />

          {/* Era */}
          {eras.map(era => (
            <button key={era} className={`cr-filter-pill ${filters.era === era ? 'active' : ''}`}
              onClick={() => toggleFilter('era', era)}>{era}</button>
          ))}

          {eras.length > 0 && <span className="cr-filter-sep" />}

          {/* Role */}
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <button key={key} className={`cr-filter-pill ${filters.role === key ? 'active' : ''}`}
              onClick={() => toggleFilter('role', key)}>{label}</button>
          ))}

          {hasActiveFilters && (
            <button className="cr-filter-clear" onClick={clearFilters}>Clear all</button>
          )}
        </div>
      )}

      {/* Search — hidden in Feed mode (Feed has its own search) */}
      {!feedMode && (
      <div className="cr-search-standalone">
        <div className="cr-search-wrap">
          <span className="cr-search-icon">⌕</span>
          <input
            className="cr-search-input"
            type="text"
            placeholder={isMobile ? 'Search…' : 'Search characters…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      )}

      {/* Content */}
      <div className="cr-content">

        {/* ── FEED MODE ── */}
        {feedMode ? (
          <SocialProfileGenerator embedded />
        ) : worldMode ? (
          <>
            {/* World header */}
            <div className="cr-world-header">
              <div className="cr-world-header-left">
                <h2 className="cr-world-title">All Characters</h2>
                <p className="cr-world-subtitle">
                  {characters.length} character{characters.length !== 1 ? 's' : ''} · {generatedCount} alive
                </p>
              </div>
              <div className="cr-world-header-actions">
                <button className="cr-btn-outline" onClick={exportRegistryJSON} disabled={exporting}>
                  📥 Export JSON
                </button>
              </div>
            </div>


            {/* Type filter bar */}
            <div className="cr-world-filters">
              {['all', 'protagonist', 'special', 'pressure', 'mirror', 'support', 'shadow'].map(t => {
                const typeColor = ROLE_COLORS[t];
                const count = t === 'all'
                  ? Object.values(worldTypeCounts).reduce((a, b) => a + b, 0)
                  : (worldTypeCounts[t] || 0);
                if (t !== 'all' && count === 0) return null;
                return (
                  <button
                    key={t}
                    className={`cr-world-filter-btn ${worldType === t ? 'active' : ''}`}
                    style={worldType === t && typeColor ? { background: `${typeColor}18`, color: typeColor, borderColor: `${typeColor}55` } : {}}
                    onClick={() => setWorldType(t)}
                  >
                    {t === 'all' ? 'All' : ROLE_LABELS[t] || t}
                    <span className="cr-world-filter-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* World grid */}
            {filtered.length === 0 ? (
              <div className="cr-empty-state">
                <div className="cr-empty-icon">🌍</div>
                <h2 className="cr-empty-title">No Characters</h2>
                <p className="cr-empty-desc">No {worldType === 'all' ? '' : worldType + ' '}characters found.</p>
              </div>
            ) : (
              <div className="cr-world-grid">
                {paged.map((char, i) => {
                  const ls = livingStates[char.id] || null;
                  const meta = { color: ROLE_COLORS[char.role_type] || '#9a8c9e' };
                  const statusM = { draft: '#9a8c9e', accepted: '#3d8e42', declined: '#c43a2a', alive: '#c9a84c', sparked: '#aaa', breathing: '#7ab3d4', active: '#a889c8' };
                  const mom = MOMENTUM[ls?.momentum || 'dormant'];
                  const charName = char.selected_name || char.display_name || '?';
                  const initials = charName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={char.id}
                      className={`cr-world-card ${ls?.isGenerated ? 'cr-world-unconfirmed' : 'cr-world-nostate'}`}
                      style={{ '--wc-accent': meta.color, animationDelay: `${i * 60}ms`, cursor: 'pointer' }}
                      onClick={() => openDossier(char)}
                    >
                      {/* Card header — click opens dossier */}
                      <div className="cr-world-card-header">
                        <div className="cr-world-avatar" style={{ background: `${meta.color}18`, borderColor: `${meta.color}55`, color: meta.color }}>
                          {initials}
                        </div>
                        <div className="cr-world-card-title">
                          <div className="cr-world-card-name">{charName}</div>
                          <div className="cr-world-card-role">{char.role_label || char.belief_pressured || '—'}</div>
                          <div className="cr-world-card-badges">
                            <span className="cr-world-type-badge" style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}55` }}>
                              {ROLE_LABELS[char.role_type] || char.role_type}
                            </span>
                            <span className="cr-world-status-badge">
                              <span style={{ background: statusM[char.status] || '#9a8c9e' }} className="cr-world-status-dot" />
                              {char.status}
                            </span>
                          </div>
                        </div>
                        {ls?.isGenerated && (
                          <div className="cr-world-card-preview">
                            <span style={{ color: mom.color }}>{mom.symbol}</span>
                          </div>
                        )}
                        <span className="cr-world-expand-btn">→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="cr-pagination">
                <button className="cr-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>← Prev</button>
                <span className="cr-page-info">Page {currentPage} of {totalPages} · {filtered.length} characters</span>
                <button className="cr-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        ) : (
        <>

        {/* Registry context bar */}
        {activeRegistry && (
          <div className="cr-registry-context">
            <div className="cr-registry-context-info">
              <h3 className="cr-registry-context-title">{activeRegistry.title}</h3>
              {activeRegistry.description && (
                <p className="cr-registry-context-desc">{activeRegistry.description}</p>
              )}
              {activeRegistry.core_rule && (
                <p className="cr-registry-context-rule">"{activeRegistry.core_rule}"</p>
              )}
            </div>
            <div className="cr-registry-context-actions">
              <BulkBackfillButton
                registryId={activeRegistry.id}
                characterCount={(activeRegistry.characters || []).length}
                onDone={() => fetchRegistry(activeRegistry.id)}
              />
              <button className="cr-ctx-btn" onClick={() => openEditRegistry(activeRegistry)}>
                ✎ Edit
              </button>
              <button className="cr-ctx-btn danger" onClick={() => confirmDeleteRegistry(activeRegistry.id)}>
                ✕ Delete
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="cr-stats-strip">
          <div className="cr-stat-counts">
            <span className="cr-stat-chip">{statusCounts.total} total</span>
            <span className="cr-stat-chip">{statusCounts.alive} alive</span>
            <span className="cr-stat-chip">{statusCounts.accepted} accepted</span>
            <span className="cr-stat-chip">{statusCounts.draft} draft</span>
          </div>

          <div className="cr-toolbar-right">
            <select className="cr-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="default">Default</option>
              <option value="name">Name</option>
              <option value="role">Role</option>
              <option value="status">Status</option>
              <option value="recent">Recent</option>
            </select>

            <div className="cr-card-size-toggle">
              <button className={`cr-size-btn ${cardSize === 'compact' ? 'active' : ''}`} onClick={() => setCardSize('compact')} title="Small cards">S</button>
              <button className={`cr-size-btn ${cardSize === 'normal' ? 'active' : ''}`} onClick={() => setCardSize('normal')} title="Medium cards">M</button>
              <button className={`cr-size-btn ${cardSize === 'large' ? 'active' : ''}`} onClick={() => setCardSize('large')} title="Large cards">L</button>
            </div>

            <div className="cr-stat-actions">
              <button className="cr-btn-outline cr-export-toggle" onClick={exportRegistryJSON} disabled={exporting} title="Export registry as JSON">
                Export
              </button>
              <button className={`cr-btn-outline cr-compare-toggle ${compareMode ? 'active' : ''}`}
                onClick={() => { setCompareMode(m => !m); setCompareSelection([]); if (selectMode) exitSelectMode(); }}>
                {compareMode ? '✕ Cancel' : 'Compare'}
              </button>
              <button className={`cr-btn-outline cr-select-toggle ${selectMode ? 'active' : ''}`}
                onClick={() => { if (selectMode) { exitSelectMode(); } else { setSelectMode(true); if (compareMode) { setCompareMode(false); setCompareSelection([]); } } }}>
                {selectMode ? '✕ Cancel' : 'Select'}
              </button>
            </div>
          </div>
        </div>

        {/* Compare bar */}
        {compareMode && (
          <div className="cr-compare-bar">
            <span className="cr-compare-bar-text">
              Select 2 characters to compare ({compareSelection.length}/2)
            </span>
            {compareSelection.length === 2 && (
              <button className="cr-edit-save-btn" onClick={() => setShowCompare(true)}>
                Compare Now →
              </button>
            )}
          </div>
        )}

        {/* Bulk select bar */}
        {selectMode && (
          <div className="cr-bulk-bar">
            <div className="cr-bulk-bar-left">
              <span className="cr-bulk-bar-count">{selectedIds.size} selected</span>
              <button className="cr-bulk-bar-btn" onClick={selectAllFiltered}>
                Select All ({filtered.length})
              </button>
              {selectedIds.size > 0 && (
                <button className="cr-bulk-bar-btn" onClick={deselectAll}>Deselect All</button>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="cr-bulk-bar-right">
                <button className="cr-bulk-bar-btn cr-bulk-bar-accept" onClick={() => bulkUpdateStatus('accepted')}>
                  ✓ Accept {selectedIds.size}
                </button>
                <button className="cr-bulk-bar-btn" style={{ background: 'rgba(201,168,76,0.15)', color: '#8a7230' }}
                  onClick={bulkGenerateDeepProfiles} disabled={bulkDeepProfileRunning}>
                  {bulkDeepProfileRunning ? '🧬 Running…' : `🧬 Deep Profile ${selectedIds.size}`}
                </button>
                <button className="cr-bulk-bar-btn" style={{ background: 'rgba(106,76,147,0.15)', color: '#6a4c93' }}
                  onClick={bulkGenerateWriterParagraphs} disabled={bulkWriterParagraphRunning}>
                  {bulkWriterParagraphRunning ? '📝 Running…' : `📝 Writer Para ${selectedIds.size}`}
                </button>
                <button className="cr-bulk-bar-btn cr-bulk-bar-status" onClick={() => setShowBulkStatusModal(true)}>
                  ✎ Status
                </button>
                <button className="cr-bulk-bar-btn cr-bulk-bar-move" onClick={() => setShowBulkMoveModal(true)}>
                  ↗ Move
                </button>
                <button
                  className="cr-bulk-bar-delete"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={bulkDeleting}
                >
                  🗑 Delete {selectedIds.size}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bulk Writer Paragraphs Results */}
        {bulkWriterParagraphs && bulkWriterParagraphs.length > 0 && (
          <div style={{ background: 'rgba(106,76,147,0.06)', border: '1px solid rgba(106,76,147,0.25)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6a4c93' }}>📝 Writer Paragraphs ({bulkWriterParagraphs.length})</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(bulkWriterParagraphs.map(p => `## ${p.name}\n\n${p.paragraph}`).join('\n\n---\n\n')); showToast('All paragraphs copied!'); }}
                  style={{ padding: '5px 12px', background: '#6a4c93', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  📋 Copy All
                </button>
                <button
                  onClick={() => setBulkWriterParagraphs(null)}
                  style={{ padding: '5px 12px', background: '#ddd', color: '#666', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
            {bulkWriterParagraphs.map((p, i) => (
              <div key={p.id} style={{ marginBottom: i < bulkWriterParagraphs.length - 1 ? 16 : 0, paddingBottom: i < bulkWriterParagraphs.length - 1 ? 16 : 0, borderBottom: i < bulkWriterParagraphs.length - 1 ? '1px solid rgba(106,76,147,0.15)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6a4c93', marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.paragraph}</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {sorted.length === 0 ? (
          <div className="cr-empty-state">
            <div className="cr-empty-icon">◈</div>
            <h2 className="cr-empty-title">No Characters</h2>
            <p className="cr-empty-desc">
              {activeRegistry?.book_tag === 'book-1'
                ? 'Seed the Book 1 cast or create characters manually.'
                : 'Use the Character Generator or create characters manually.'}
            </p>
            {activeRegistry?.book_tag === 'book-1' ? (
              <button className="cr-empty-btn" onClick={seedBook1}>Seed Book 1 Cast</button>
            ) : (
              <button className="cr-empty-btn" onClick={() => navigate('/character-generator')}>
                Open Character Generator
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="cr-empty-state">
            <div className="cr-empty-icon">∅</div>
            <h2 className="cr-empty-title">No Matches</h2>
            <p className="cr-empty-desc">No characters match the current filters.</p>
            <button className="cr-empty-btn" onClick={() => { clearFilters(); setSearch(''); }}>
              Clear Filters
            </button>
          </div>
        ) : (viewMode === 'grid' || isMobile) ? (
          /* ── GRID VIEW ── */
          <div className={`cr-grid ${cardSize !== 'normal' ? `cr-grid-${cardSize}` : ''}`}>
            {paged.map(c => (
              <CharacterCard key={c.id} c={c} onClick={() => openDossier(c)}
                isCompareSelected={compareMode && compareSelection.includes(c.id)}
                selectMode={selectMode} isSelected={selectedIds.has(c.id)}
                cardSize={cardSize} relCount={getRelCount(c)}
                quickEditId={quickEditId} quickEditForm={quickEditForm}
                onQuickEdit={() => startQuickEdit(c)}
                onQuickEditChange={(field, val) => setQuickEditForm(p => ({ ...p, [field]: val }))}
                onQuickEditSave={saveQuickEdit}
                onQuickEditCancel={() => setQuickEditId(null)}
                onAccept={(id) => setCharStatus(id, 'accepted')} />
            ))}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="cr-list">
            <div className="cr-list-header">
              <span></span>
              <span>Name</span>
              <span>Role · Archetype</span>
              <span>First Appeared</span>
              <span>Era</span>
              <span>Status</span>
              <span></span>
            </div>
            {paged.map(c => (
              <CharacterRow key={c.id} c={c} onClick={() => openDossier(c)}
                selectMode={selectMode} isSelected={selectedIds.has(c.id)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="cr-pagination">
            <button className="cr-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>← Prev</button>
            <span className="cr-page-info">Page {currentPage} of {totalPages} · {filtered.length} characters</span>
            <button className="cr-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </>
      )}
      </div>

      {/* New Character Modal */}
      {showNewChar && (
        <div className="cr-modal-overlay" onClick={() => setShowNewChar(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <h2 className="cr-modal-title">New Character</h2>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Name</label>
                <input className="cr-edit-input" value={newCharForm.display_name}
                  onChange={e => setNewCharForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder="Character name" autoFocus />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Role</label>
                <select className="cr-edit-input cr-edit-select" value={newCharForm.role_type}
                  onChange={e => setNewCharForm(p => ({ ...p, role_type: e.target.value }))}>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Icon (emoji)</label>
                <input className="cr-edit-input" value={newCharForm.icon}
                  onChange={e => setNewCharForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="◆" style={{ maxWidth: 80 }} />
              </div>
              <div className="cr-modal-actions">
                <button className="cr-edit-cancel-btn" onClick={() => setShowNewChar(false)}>Cancel</button>
                <button className="cr-edit-save-btn" onClick={createCharacter}
                  disabled={!newCharForm.display_name.trim()}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Registry Modal */}
      {showNewRegistry && (
        <div className="cr-modal-overlay" onClick={() => setShowNewRegistry(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <h2 className="cr-modal-title">New Registry</h2>
              <p className="cr-modal-subtitle">Create a character registry for a book or arc.</p>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Title *</label>
                <input className="cr-edit-input" value={registryForm.title}
                  onChange={e => setRegistryForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Book 1 · Before Lala" autoFocus />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Book Tag</label>
                <input className="cr-edit-input" value={registryForm.book_tag}
                  onChange={e => setRegistryForm(p => ({ ...p, book_tag: e.target.value }))}
                  placeholder="e.g. book-1" />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Description</label>
                <textarea className="cr-edit-input" value={registryForm.description}
                  onChange={e => setRegistryForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What this registry is about…" rows={3} />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Core Rule</label>
                <textarea className="cr-edit-input" value={registryForm.core_rule}
                  onChange={e => setRegistryForm(p => ({ ...p, core_rule: e.target.value }))}
                  placeholder="The narrative rule governing every character…" rows={2} />
              </div>
              <div className="cr-modal-actions">
                <button className="cr-edit-cancel-btn" onClick={() => setShowNewRegistry(false)}>Cancel</button>
                <button className="cr-edit-save-btn" onClick={submitNewRegistry}
                  disabled={!registryForm.title.trim()}>Create Registry</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Registry Modal */}
      {editingRegistry && (
        <div className="cr-modal-overlay" onClick={() => setEditingRegistry(null)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <h2 className="cr-modal-title">Edit Registry</h2>
              <p className="cr-modal-subtitle">Update the registry's details.</p>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Title *</label>
                <input className="cr-edit-input" value={registryForm.title}
                  onChange={e => setRegistryForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Registry title" autoFocus />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Book Tag</label>
                <input className="cr-edit-input" value={registryForm.book_tag}
                  onChange={e => setRegistryForm(p => ({ ...p, book_tag: e.target.value }))}
                  placeholder="e.g. book-1" />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Description</label>
                <textarea className="cr-edit-input" value={registryForm.description}
                  onChange={e => setRegistryForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What this registry is about…" rows={3} />
              </div>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Core Rule</label>
                <textarea className="cr-edit-input" value={registryForm.core_rule}
                  onChange={e => setRegistryForm(p => ({ ...p, core_rule: e.target.value }))}
                  placeholder="The narrative rule governing every character…" rows={2} />
              </div>
              <div className="cr-modal-actions">
                <button className="cr-edit-cancel-btn" onClick={() => setEditingRegistry(null)}>Cancel</button>
                <button className="cr-edit-save-btn" onClick={updateRegistry}
                  disabled={!registryForm.title.trim()}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Registry Confirmation */}
      {showDeleteConfirm && (
        <div className="cr-modal-overlay" onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <div className="cr-delete-confirm">
                <div className="cr-delete-icon">🗑</div>
                <h2 className="cr-delete-title">Delete Registry?</h2>
                <p className="cr-delete-desc">
                  This will remove the registry and all its characters. This action cannot be undone.
                </p>
                <div className="cr-delete-name">
                  {registries.find(r => r.id === deleteTargetId)?.title || 'Unknown'}
                </div>
                <div className="cr-delete-actions">
                  <button className="cr-delete-cancel" onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}>
                    Cancel
                  </button>
                  <button className="cr-delete-btn" onClick={deleteRegistry}>
                    Delete Registry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="cr-modal-overlay" onClick={() => setShowBulkDeleteConfirm(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <div className="cr-delete-confirm">
                <div className="cr-delete-icon">🗑</div>
                <h2 className="cr-delete-title">Delete {selectedIds.size} Character{selectedIds.size > 1 ? 's' : ''}?</h2>
                <p className="cr-delete-desc">
                  This will permanently remove the selected characters. This action cannot be undone.
                </p>
                <div className="cr-delete-actions">
                  <button className="cr-delete-cancel" onClick={() => setShowBulkDeleteConfirm(false)}>
                    Cancel
                  </button>
                  <button className="cr-delete-btn" onClick={bulkDelete} disabled={bulkDeleting}>
                    {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} Character${selectedIds.size > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {showBulkStatusModal && (
        <div className="cr-modal-overlay" onClick={() => setShowBulkStatusModal(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <h2 className="cr-modal-title">Update Status — {selectedIds.size} Character{selectedIds.size > 1 ? 's' : ''}</h2>
              <p className="cr-modal-subtitle">Set the status for all selected characters.</p>
              <div className="cr-edit-field">
                <label className="cr-edit-label">New Status</label>
                <select className="cr-edit-input cr-edit-select" value={bulkStatusTarget}
                  onChange={e => setBulkStatusTarget(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>
              <div className="cr-modal-actions">
                <button className="cr-edit-cancel-btn" onClick={() => setShowBulkStatusModal(false)}>Cancel</button>
                <button className="cr-edit-save-btn" onClick={() => bulkUpdateStatus(bulkStatusTarget)}>Apply to {selectedIds.size}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <div className="cr-modal-overlay" onClick={() => setShowBulkMoveModal(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-body">
              <h2 className="cr-modal-title">Move {selectedIds.size} Character{selectedIds.size > 1 ? 's' : ''}</h2>
              <p className="cr-modal-subtitle">Choose a destination registry.</p>
              <div className="cr-edit-field">
                <label className="cr-edit-label">Destination Registry</label>
                <select className="cr-edit-input cr-edit-select" value={bulkMoveTarget}
                  onChange={e => setBulkMoveTarget(e.target.value)}>
                  <option value="">— Select —</option>
                  {registries.filter(r => r.id !== activeRegistryId).map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>
              <div className="cr-modal-actions">
                <button className="cr-edit-cancel-btn" onClick={() => setShowBulkMoveModal(false)}>Cancel</button>
                <button className="cr-edit-save-btn" onClick={() => bulkMoveToRegistry(bulkMoveTarget)}
                  disabled={!bulkMoveTarget}>Move to Registry</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Character Comparison Modal */}
      {showCompare && compareSelection.length === 2 && (() => {
        const chars = sorted;
        const a = chars.find(ch => ch.id === compareSelection[0]);
        const b = chars.find(ch => ch.id === compareSelection[1]);
        if (!a || !b) return null;
        const fields = [
          { label: 'Role', key: 'role_type', fmt: v => ROLE_LABELS[v] || v },
          { label: 'Archetype', key: 'character_archetype' },
          { label: 'Canon Tier', key: 'canon_tier' },
          { label: 'Era', key: 'era_introduced' },
          { label: 'Status', key: 'status' },
          { label: 'Core Desire', key: 'core_desire' },
          { label: 'Core Fear', key: 'core_fear' },
          { label: 'Core Wound', key: 'core_wound' },
          { label: 'Mask', key: 'mask_persona' },
          { label: 'Truth', key: 'truth_persona' },
          { label: 'Signature Trait', key: 'signature_trait' },
          { label: 'Emotional Baseline', key: 'emotional_baseline' },
          { label: 'Core Belief', key: 'core_belief' },
          { label: 'Pressure Type', key: 'pressure_type' },
          { label: 'Belief Pressured', key: 'belief_pressured' },
          { label: 'Personality', key: 'personality' },
          { label: 'Appearance Mode', key: 'appearance_mode', fmt: v => v?.replace('_', ' ') || '—' },
          { label: 'First Appearance', key: 'first_appearance' },
          { label: 'Relationships', key: 'relationships_map', fmt: v => {
            if (!v) return '—';
            try { const obj = typeof v === 'string' ? JSON.parse(v) : v; return Object.keys(obj).filter(k => obj[k]).length + ' connections'; } catch { return '—'; }
          }},
        ];
        return (
          <div className="cr-modal-overlay" onClick={() => { setShowCompare(false); setCompareMode(false); setCompareSelection([]); }}>
            <div className="cr-modal cr-compare-modal" onClick={e => e.stopPropagation()}>
              <div className="cr-modal-body">
                <h2 className="cr-modal-title">Character Comparison</h2>
                <div className="cr-compare-grid">
                  <div className="cr-compare-header-row">
                    <div className="cr-compare-label-col"></div>
                    <div className="cr-compare-char-col">
                      <span className="cr-compare-char-icon">{a.icon || '◆'}</span>
                      <span className="cr-compare-char-name">{a.selected_name || a.display_name}</span>
                    </div>
                    <div className="cr-compare-char-col">
                      <span className="cr-compare-char-icon">{b.icon || '◆'}</span>
                      <span className="cr-compare-char-name">{b.selected_name || b.display_name}</span>
                    </div>
                  </div>
                  {fields.map(f => {
                    const va = f.fmt ? f.fmt(a[f.key]) : (a[f.key] || '—');
                    const vb = f.fmt ? f.fmt(b[f.key]) : (b[f.key] || '—');
                    const diff = va !== vb;
                    return (
                      <div key={f.key} className={`cr-compare-row ${diff ? 'cr-compare-diff' : ''}`}>
                        <div className="cr-compare-label-col">{f.label}</div>
                        <div className="cr-compare-val-col">{va}</div>
                        <div className="cr-compare-val-col">{vb}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="cr-modal-actions">
                  <button className="cr-edit-cancel-btn" onClick={() => { setShowCompare(false); setCompareMode(false); setCompareSelection([]); }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Character Creation Drawer */}
      <CharacterCreationDrawer
        open={showCreationDrawer}
        onClose={() => setShowCreationDrawer(false)}
        worldId={null}
        onCreated={(newChar) => {
          showToast('Character created');
          setShowCreationDrawer(false);
          if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
        }}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}


/* ================================================================
   HEADER BAR
   ================================================================ */
function HeaderBar({ viewMode, onViewMode, showFilters, onToggleFilters, onNewChar, isMobile, children }) {
  return (
    <div className="cr-header">
      <div className="cr-header-left">
        <div className="cr-header-brand">LaLaPlace</div>
        {!isMobile && <div className="cr-header-breadcrumb">World → Characters</div>}
      </div>

      <div className="cr-header-center">
        <h1 className="cr-header-title">Characters</h1>
      </div>

      <div className="cr-header-right">
        <button className="cr-header-btn primary" onClick={onNewChar}>
          {isMobile ? '+' : '+ New Character'}
        </button>

        <button className={`cr-header-btn ${showFilters ? 'active' : ''}`} onClick={onToggleFilters}>
          {isMobile ? '⚙' : 'Filter'}
        </button>

        {!isMobile && (
          <div className="cr-view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewMode('grid')}
              title="Grid view">▦</button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewMode('list')}
              title="List view">☰</button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}


/* ================================================================
   CHARACTER CARD (Grid)
   ================================================================ */
function CharacterCard({ c, onClick, isCompareSelected, isSelected, selectMode, cardSize = 'normal', relCount = 0,
  quickEditId, quickEditForm, onQuickEdit, onQuickEditChange, onQuickEditSave, onQuickEditCancel, onAccept }) {
  const isCore = c.canon_tier === 'Core Canon';
  const roleColor = `var(--role-${c.role_type || 'special'})`;
  const isQuickEditing = quickEditId === c.id;
  const canAccept = c.status === 'draft' || c.status === 'declined';

  return (
    <div className={`cr-card cr-card-${cardSize} ${isCore ? 'canon-core' : ''} ${isCompareSelected ? 'compare-selected' : ''} ${isSelected ? 'bulk-selected' : ''}`} onClick={onClick}>
      {/* Selection checkbox */}
      {selectMode && (
        <div className={`cr-card-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={e => { e.stopPropagation(); onClick(); }}>
          {isSelected ? '✓' : ''}
        </div>
      )}

      {/* Quick-edit menu */}
      {!selectMode && !isQuickEditing && (
        <button className="cr-card-quick-edit-btn" onClick={e => { e.stopPropagation(); onQuickEdit(); }} title="Quick Edit">⋮</button>
      )}

      {/* Quick-edit overlay */}
      {isQuickEditing && (
        <div className="cr-card-quick-overlay" onClick={e => e.stopPropagation()}>
          <input className="cr-quick-input" value={quickEditForm.display_name || ''}
            onChange={e => onQuickEditChange('display_name', e.target.value)} placeholder="Name" autoFocus />
          <select className="cr-quick-select" value={quickEditForm.role_type || ''}
            onChange={e => onQuickEditChange('role_type', e.target.value)}>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="cr-quick-select" value={quickEditForm.status || ''}
            onChange={e => onQuickEditChange('status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="accepted">Accepted</option>
          </select>
          <div className="cr-quick-btns">
            <button className="cr-quick-save" onClick={onQuickEditSave}>Save</button>
            <button className="cr-quick-cancel" onClick={onQuickEditCancel}>✕</button>
          </div>
        </div>
      )}

      {/* Portrait */}
      <div className="cr-card-portrait" style={{ background: `linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)` }}>
        <div className="cr-card-portrait-bg" style={{ background: roleColor }} />
        {c.icon ? (
          <span className="cr-card-icon">{c.icon}</span>
        ) : (
          <span className="cr-card-initial">{(c.display_name || '?')[0]}</span>
        )}

        {/* Registry tag (shown in All Characters view) */}
        {c._registryTitle && (
          <span className="cr-card-registry-tag">{c._registryTitle}</span>
        )}

        {/* Relationship count badge */}
        {relCount > 0 && (
          <span className="cr-card-rel-badge" title={`${relCount} relationship${relCount > 1 ? 's' : ''}`}>
            🔗 {relCount}
          </span>
        )}

        {/* Hover overlay */}
        <div className="cr-card-hover">
          {c.core_desire && (
            <div className="cr-card-hover-desire">"{c.core_desire}"</div>
          )}
          {c.subtitle && (
            <div className="cr-card-hover-essence">{c.subtitle}</div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="cr-card-body">
        <h3 className="cr-card-name">{c.selected_name || c.display_name}</h3>
        <span className={`cr-card-role ${c.role_type}`}>
          {c.role_label || ROLE_LABELS[c.role_type] || c.role_type}
        </span>
        {c.character_archetype && cardSize !== 'compact' && (
          <div className="cr-card-archetype">{c.character_archetype}</div>
        )}
        <div className="cr-card-bottom">
          {c.era_introduced ? (
            <span className="cr-card-era">{c.era_introduced}</span>
          ) : <span />}
          <span className={`cr-card-status-badge ${c.status}`}>{c.status}</span>
        </div>
        {/* Status action strip */}
        {!selectMode && !isQuickEditing && canAccept && onAccept && (
          <button
            className="cr-card-status-strip"
            onClick={e => { e.stopPropagation(); onAccept(c.id); }}
            title="Accept this character"
          >
            Accept ✓
          </button>
        )}
        {cardSize === 'large' && c.updated_at && (
          <div className="cr-card-timeline">
            <span className="cr-card-timeline-label">Updated</span>
            <span className="cr-card-timeline-date">{new Date(c.updated_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}


/* ================================================================
   CHARACTER ROW (List)
   ================================================================ */
function CharacterRow({ c, onClick, isSelected, selectMode }) {
  const isCore = c.canon_tier === 'Core Canon';

  return (
    <div className={`cr-list-row ${isCore ? 'canon-core' : ''} ${isSelected ? 'bulk-selected' : ''}`} onClick={onClick}>
      {selectMode ? (
        <span className={`cr-row-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={e => { e.stopPropagation(); onClick(); }}>
          {isSelected ? '✓' : ''}
        </span>
      ) : (
        <span className="cr-list-icon">{c.icon || '◆'}</span>
      )}
      <div className="cr-list-name-cell">
        <span className="cr-list-name">{c.selected_name || c.display_name}</span>
        {c.subtitle && <span className="cr-list-subtitle">{c.subtitle}</span>}
      </div>
      <div>
        <span className={`cr-list-role`} style={{ color: `var(--role-${c.role_type || 'special'})` }}>
          {c.role_label || ROLE_LABELS[c.role_type] || c.role_type}
        </span>
        {c.character_archetype && (
          <div className="cr-list-archetype">{c.character_archetype}</div>
        )}
      </div>
      <span className="cr-list-era">{c.first_appearance || '—'}</span>
      <span className="cr-list-era">{c.era_introduced || '—'}</span>
      <span className={`cr-list-status ${c.status}`}>{c.status}</span>
      <button className="cr-list-open-btn" onClick={e => { e.stopPropagation(); onClick(); }}>
        Open Dossier
      </button>
    </div>
  );
}


/* ================================================================
   TOAST
   ================================================================ */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`cr-toast ${type}`}>{msg}</div>;
}


/* ================================================================
   DOSSIER TAB CONTENT
   ================================================================ */
function renderDossierTab(c, tab, editSection, form, saving, startEdit, cancelEdit, saveSection, F, ai) {
  const editing = editSection === tab;

  const editControls = editing ? (
    <div className="cr-edit-controls">
      <button className="cr-edit-cancel-btn" onClick={cancelEdit}>Cancel</button>
      <button className="cr-edit-save-btn" onClick={saveSection} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  ) : null;

  const sectionHeader = (title) => (
    <div className="cr-dossier-section-header">
      <span className="cr-dossier-section-title">{title}</span>
      {!editing && (
        <button className="cr-dossier-edit-btn" onClick={() => startEdit(tab)} title="Edit this section">✎</button>
      )}
    </div>
  );

  switch (tab) {

    /* ── OVERVIEW ── */
    case 'overview':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Overview')}
          {editControls}
          {editing ? (
            <>
              <EField label="Display Name" value={form.display_name} onChange={v => F('display_name', v)} />
              <EField label="Alias / Selected Name" value={form.selected_name} onChange={v => F('selected_name', v)} />
              <EArea label="Description" value={form.description} onChange={v => F('description', v)} rows={4} />
              <EArea label="Core Belief" value={form.core_belief} onChange={v => F('core_belief', v)} rows={2} placeholder="The central question this character carries" />
              <EField label="First Appearance" value={form.first_appearance} onChange={v => F('first_appearance', v)} placeholder="Book 1 · Episode 3" />
              <EField label="Era Introduced" value={form.era_introduced} onChange={v => F('era_introduced', v)} />
              <ESelect label="Canon Tier" value={form.canon_tier} onChange={v => F('canon_tier', v)}
                options={CANON_TIERS.map(t => ({ value: t, label: t }))} allowEmpty />
              <ESelect label="Appearance Mode" value={form.appearance_mode} onChange={v => F('appearance_mode', v)}
                options={[{value:'on_page',label:'On Page'},{value:'composite',label:'Composite'},{value:'observed',label:'Observed'},{value:'invisible',label:'Invisible'},{value:'brief',label:'Brief'}]} allowEmpty />
              <EField label="Pressure Type" value={form.pressure_type} onChange={v => F('pressure_type', v)} placeholder="How this character applies pressure" />
              <EArea label="Pressure Quote" value={form.pressure_quote} onChange={v => F('pressure_quote', v)} rows={2} placeholder="A line that captures their pressure" />
              <EField label="Job Options" value={form.job_options} onChange={v => F('job_options', v)} placeholder="Considered professions" />
              <EField label="Creator" value={form.creator} onChange={v => F('creator', v)} />
              <EArea label="Writer Notes" value={form.writer_notes} onChange={v => F('writer_notes', v)} rows={3} placeholder="Private notes for the writer…" />
            </>
          ) : (
            <>
              {(c.description || c.subtitle) && (
                <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 20, fontStyle: 'italic', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {c.description || c.subtitle}
                </p>
              )}
              {c.core_belief && (
                <div className="cr-dossier-belief-banner">
                  <span className="cr-dossier-belief-icon">◈</span>
                  <span className="cr-dossier-belief-text">"{c.core_belief}"</span>
                </div>
              )}
              <DRow label="Appearance Mode" value={c.appearance_mode?.replace('_', ' ')} />
              <DRow label="Pressure Type" value={c.pressure_type} />
              {c.pressure_quote && (
                <DRow label="Pressure Quote" value={`"${c.pressure_quote}"`} accent />
              )}
              <DRow label="Job Options" value={c.job_options} />
              <DRow label="Creator" value={c.creator} />
              {c.writer_notes && (
                <div className="cr-dossier-writer-notes">
                  <span className="cr-dossier-writer-notes-label">✎ Writer Notes</span>
                  <WriterNotesDisplay notes={c.writer_notes} />
                </div>
              )}
              {jGet(c.story_presence, 'current_story_status') && (
                <DRow label="Current Arc" value={jGet(c.story_presence, 'current_story_status')} accent />
              )}
              {jGet(c.story_presence, 'unresolved_threads') && (
                <DRow label="Unresolved Threads" value={jGet(c.story_presence, 'unresolved_threads')} />
              )}
              <BackfillBanner character={c} />
            </>
          )}
        </div>
      );

    /* ── PSYCHOLOGY ── */
    case 'psychology':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Psychology')}
          {editControls}
          {editing ? (
            <>
              <EArea label="Core Desire" value={form.core_desire} onChange={v => F('core_desire', v)} rows={2} />
              <EArea label="Core Fear" value={form.core_fear} onChange={v => F('core_fear', v)} rows={2} />
              <EArea label="Core Wound" value={form.core_wound} onChange={v => F('core_wound', v)} rows={2} />
              <EArea label="Mask — Public Persona" value={form.mask_persona} onChange={v => F('mask_persona', v)} rows={2} />
              <EArea label="Truth — Private Self" value={form.truth_persona} onChange={v => F('truth_persona', v)} rows={2} />
              <ESelect label="Archetype" value={form.character_archetype} onChange={v => F('character_archetype', v)}
                options={ARCHETYPES.map(a => ({ value: a, label: a }))} allowEmpty />
              <EArea label="Signature Trait" value={form.signature_trait} onChange={v => F('signature_trait', v)} rows={2} />
              <EField label="Emotional Baseline" value={form.emotional_baseline} onChange={v => F('emotional_baseline', v)} />
              <EArea label="Belief Under Pressure" value={form.belief_pressured} onChange={v => F('belief_pressured', v)} rows={2} placeholder="What they believe when the mask cracks" />
              <EArea label="Emotional Function" value={form.emotional_function} onChange={v => F('emotional_function', v)} rows={2} placeholder="The role they serve emotionally in the story" />
              <EField label="Wound Depth" value={form.wound_depth} onChange={v => F('wound_depth', v)} placeholder="0–10 scale" />
            </>
          ) : (
            <>
              {/* Triad */}
              {(c.core_desire || c.core_fear || c.core_wound) && (
                <div className="cr-dossier-triad">
                  {c.core_desire && (
                    <div className="cr-dossier-triad-item desire">
                      <span className="cr-dossier-triad-label">Desire</span>
                      <p className="cr-dossier-triad-text">{c.core_desire}</p>
                    </div>
                  )}
                  {c.core_fear && (
                    <div className="cr-dossier-triad-item fear">
                      <span className="cr-dossier-triad-label">Fear</span>
                      <p className="cr-dossier-triad-text">{c.core_fear}</p>
                    </div>
                  )}
                  {c.core_wound && (
                    <div className="cr-dossier-triad-item wound">
                      <span className="cr-dossier-triad-label">Wound</span>
                      <p className="cr-dossier-triad-text">{c.core_wound}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Duality: Mask vs Truth */}
              {(c.mask_persona || c.truth_persona) && (
                <div className="cr-dossier-duality">
                  {c.mask_persona && (
                    <div className="cr-dossier-duality-item">
                      <span className="cr-dossier-duality-label">Mask</span>
                      <p className="cr-dossier-duality-text">{c.mask_persona}</p>
                    </div>
                  )}
                  {c.truth_persona && (
                    <div className="cr-dossier-duality-item">
                      <span className="cr-dossier-duality-label">Truth</span>
                      <p className="cr-dossier-duality-text">{c.truth_persona}</p>
                    </div>
                  )}
                </div>
              )}

              <DRow label="Archetype" value={c.character_archetype} accent />
              <DRow label="Signature Trait" value={c.signature_trait} />
              <DRow label="Emotional Baseline" value={c.emotional_baseline} />
              <DRow label="Belief Under Pressure" value={c.belief_pressured} />
              <DRow label="Emotional Function" value={c.emotional_function} />
              {c.wound_depth > 0 && (
                <div className="cr-dossier-row">
                  <span className="cr-dossier-row-label">Wound Depth</span>
                  <span className="cr-dossier-row-value">
                    <span className="cr-wound-meter">
                      <span className="cr-wound-fill" style={{ width: `${(c.wound_depth || 0) * 10}%` }} />
                    </span>
                    {c.wound_depth}/10
                  </span>
                </div>
              )}

              {c.personality && (
                <div className="cr-dossier-pills">
                  {c.personality.split(',').map((t, i) => (
                    <span key={i} className="cr-dossier-pill">{t.trim()}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );

    /* ── AESTHETIC DNA ── */
    case 'aesthetic':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Aesthetic DNA')}
          {editControls}
          {editing ? (
            <>
              <EField label="Era Aesthetic" value={form.era_aesthetic} onChange={v => F('era_aesthetic', v)} />
              <EArea label="Color Palette" value={form.color_palette} onChange={v => F('color_palette', v)} rows={2}
                placeholder="Warm ivory, muted gold, deep burgundy…" />
              <EArea label="Signature Silhouette" value={form.signature_silhouette} onChange={v => F('signature_silhouette', v)} rows={2} />
              <EArea label="Signature Accessories" value={form.signature_accessories} onChange={v => F('signature_accessories', v)} rows={2} />
              <ESelect label="Glam Energy" value={form.glam_energy} onChange={v => F('glam_energy', v)}
                options={GLAM_ENERGIES.map(g => ({ value: g, label: g }))} allowEmpty />
              <EArea label="Visual Evolution Notes" value={form.visual_evolution_notes} onChange={v => F('visual_evolution_notes', v)} rows={3} />
            </>
          ) : hasJsonData(c.aesthetic_dna) ? (
            <>
              <DRow label="Era Aesthetic" value={jGet(c.aesthetic_dna, 'era_aesthetic')} accent />
              <DRow label="Color Palette" value={jGet(c.aesthetic_dna, 'color_palette')} />
              <DRow label="Signature Silhouette" value={jGet(c.aesthetic_dna, 'signature_silhouette')} />
              <DRow label="Signature Accessories" value={jGet(c.aesthetic_dna, 'signature_accessories')} />
              <DRow label="Glam Energy" value={jGet(c.aesthetic_dna, 'glam_energy')} accent />
              <DRow label="Visual Evolution" value={jGet(c.aesthetic_dna, 'visual_evolution_notes')} />
            </>
          ) : (
            <EmptyState label="Aesthetic DNA" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── CAREER ── */
    case 'career':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Career & Status')}
          {editControls}
          {editing ? (
            <>
              <EField label="Profession" value={form.profession} onChange={v => F('profession', v)} />
              <EArea label="Career Goal / Ambition" value={form.career_goal} onChange={v => F('career_goal', v)} rows={2} />
              <EField label="Reputation Level" value={form.reputation_level} onChange={v => F('reputation_level', v)} />
              <EArea label="Brand Affiliations" value={form.brand_relationships} onChange={v => F('brand_relationships', v)} rows={2} />
              <EField label="Financial Status" value={form.financial_status} onChange={v => F('financial_status', v)} />
              <EField label="Public Recognition" value={form.public_recognition} onChange={v => F('public_recognition', v)} />
              <EArea label="Ongoing Arc" value={form.ongoing_arc} onChange={v => F('ongoing_arc', v)} rows={3} />
            </>
          ) : hasJsonData(c.career_status) ? (
            <>
              <DRow label="Profession" value={jGet(c.career_status, 'profession')} accent />
              <DRow label="Ambition" value={jGet(c.career_status, 'career_goal')} />
              <DRow label="Reputation" value={jGet(c.career_status, 'reputation_level')} />
              <DRow label="Brand Affiliations" value={jGet(c.career_status, 'brand_relationships')} />
              <DRow label="Public Perception" value={jGet(c.career_status, 'public_recognition')} />
              <DRow label="Financial Status" value={jGet(c.career_status, 'financial_status')} />
              <DRow label="Ongoing Arc" value={jGet(c.career_status, 'ongoing_arc')} />
            </>
          ) : (
            <EmptyState label="Career" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── RELATIONSHIPS ── */
    case 'relationships':
      return (
        <div className="cr-dossier-section">
          <div className="cr-dossier-section-header">
            <span className="cr-dossier-section-title">Relationships</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/relationships" className="cr-btn-outline" style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }}>
                🕸 View Web
              </a>
              {!editing && (
                <button className="cr-dossier-edit-btn" onClick={() => startEdit(tab)}>✎ Edit</button>
              )}
            </div>
          </div>
          {editControls}
          {editing ? (
            <>
              <EArea label="Allies" value={form.allies} onChange={v => F('allies', v)} rows={2} />
              <EArea label="Rivals" value={form.rivals} onChange={v => F('rivals', v)} rows={2} />
              <EArea label="Mentors" value={form.mentors} onChange={v => F('mentors', v)} rows={2} />
              <EArea label="Love Interests" value={form.love_interests} onChange={v => F('love_interests', v)} rows={2} />
              <EArea label="Business Partners" value={form.business_partners} onChange={v => F('business_partners', v)} rows={2} />
              <EArea label="Dynamic Notes" value={form.dynamic_notes} onChange={v => F('dynamic_notes', v)} rows={3}
                placeholder="Tension? Loyal? Competitive?" />
            </>
          ) : (() => {
            const nrm = normalizeRelMap(c.relationships_map);
            return hasJsonData(nrm) ? (
              <div className="cr-dossier-rel-grid">
                <RelCard type="Allies" icon="🤝" value={jGet(nrm, 'allies')} />
                <RelCard type="Rivals" icon="⚔" value={jGet(nrm, 'rivals')} />
                <RelCard type="Mentors" icon="🏛" value={jGet(nrm, 'mentors')} />
                <RelCard type="Love Interests" icon="♡" value={jGet(nrm, 'love_interests')} />
                <RelCard type="Business" icon="💼" value={jGet(nrm, 'business_partners')} />
                {jGet(nrm, 'dynamic_notes') && (
                  <div className="cr-dossier-rel-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="cr-dossier-rel-type">Dynamic Notes</div>
                    <div className="cr-dossier-rel-names">{jGet(nrm, 'dynamic_notes')}</div>
                  </div>
                )}
              </div>
            ) : null;
          })() || (
            <EmptyState label="Relationships" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── STORY PRESENCE ── */
    case 'story':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Story Presence')}
          {editControls}
          {editing ? (
            <>
              <EArea label="Appears in — Books" value={form.appears_in_books} onChange={v => F('appears_in_books', v)} rows={2} />
              <EArea label="Appears in — Shows" value={form.appears_in_shows} onChange={v => F('appears_in_shows', v)} rows={2} />
              <EArea label="Appears in — Series" value={form.appears_in_series} onChange={v => F('appears_in_series', v)} rows={2} />
              <ESelect label="Current Status" value={form.current_story_status} onChange={v => F('current_story_status', v)}
                options={STORY_STATUSES.map(s => ({ value: s, label: s }))} allowEmpty />
              <EArea label="Unresolved Threads" value={form.unresolved_threads} onChange={v => F('unresolved_threads', v)} rows={3} />
              <ESelect label="Future Potential" value={form.future_potential} onChange={v => F('future_potential', v)}
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} allowEmpty />
            </>
          ) : hasJsonData(c.story_presence) ? (
            <>
              <DRow label="Books" value={jGet(c.story_presence, 'appears_in_books')} />
              <DRow label="Shows" value={jGet(c.story_presence, 'appears_in_shows')} />
              <DRow label="Series" value={jGet(c.story_presence, 'appears_in_series')} />
              <DRow label="Current Status" value={jGet(c.story_presence, 'current_story_status')} accent />
              <DRow label="Unresolved Threads" value={jGet(c.story_presence, 'unresolved_threads')} />
              <DRow label="Future Potential" value={jGet(c.story_presence, 'future_potential')} accent />

              {/* Evolution tracking preview */}
              {(jGet(c.evolution_tracking, 'version_history') || jGet(c.evolution_tracking, 'era_changes')) && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 16px', paddingTop: 16 }}>
                    <span className="cr-dossier-section-title">Evolution</span>
                  </div>
                  <DRow label="Version History" value={jGet(c.evolution_tracking, 'version_history')} />
                  <DRow label="Era Changes" value={jGet(c.evolution_tracking, 'era_changes')} />
                  <DRow label="Personality Shifts" value={jGet(c.evolution_tracking, 'personality_shifts')} />
                </>
              )}
            </>
          ) : (
            <EmptyState label="Story Presence" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── VOICE ── */
    case 'voice':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Voice Profile')}
          {editControls}
          {editing ? (
            <>
              <EField label="Speech Pattern" value={form.speech_pattern} onChange={v => F('speech_pattern', v)}
                placeholder="Direct, playful, sarcastic, poetic" />
              <EField label="Vocabulary Tone" value={form.vocabulary_tone} onChange={v => F('vocabulary_tone', v)}
                placeholder="Luxury, street, soft, sharp" />
              <EArea label="Catchphrases" value={form.catchphrases} onChange={v => F('catchphrases', v)} rows={2} />
              <EArea label="Internal Monologue Style" value={form.internal_monologue_style} onChange={v => F('internal_monologue_style', v)} rows={3} />
              <EField label="Emotional Reactivity" value={form.emotional_reactivity} onChange={v => F('emotional_reactivity', v)}
                placeholder="Low / Moderate / High / Volatile" />
            </>
          ) : hasJsonData(c.voice_signature) ? (
            <>
              <DRow label="Speech Pattern" value={jGet(c.voice_signature, 'speech_pattern')} accent />
              <DRow label="Vocabulary Tone" value={jGet(c.voice_signature, 'vocabulary_tone')} />
              <DRow label="Catchphrases" value={jGet(c.voice_signature, 'catchphrases')} />
              <DRow label="Internal Monologue" value={jGet(c.voice_signature, 'internal_monologue_style')} />
              <DRow label="Dialogue Rhythm" value={jGet(c.voice_signature, 'emotional_reactivity')} accent />
            </>
          ) : (
            <EmptyState label="Voice Profile" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── DEEP PROFILE ── */
    case 'deep':
      return <DeepProfileTab character={c} />;

    /* ── AI WRITER ── */
    case 'ai':
      return <AIWriterTab character={c} ai={ai} onSaveToProfile={ai.onSaveToProfile} />;

    default:
      return null;
  }
}


/* ================================================================
   BACKFILL BANNER — fills empty JSONB sections from existing data
   ================================================================ */
function BackfillBanner({ character }) {
  const [filling, setFilling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const hasData = (val) => val && typeof val === 'object' && Object.values(val).some(v => v && v !== '');
  const emptySections = [];
  if (!hasData(character.career_status))     emptySections.push('Career');
  if (!hasData(character.aesthetic_dna))      emptySections.push('Aesthetic DNA');
  if (!hasData(character.voice_signature))    emptySections.push('Voice');
  if (!hasData(character.story_presence))     emptySections.push('Story Presence');
  if (!hasData(character.evolution_tracking)) emptySections.push('Evolution');
  if (!hasData(character.living_context))     emptySections.push('Living Context');

  if (emptySections.length === 0) return null;

  return (
    <div style={{ marginTop: 20, padding: 14, background: 'rgba(100,80,200,0.04)', border: '1px dashed rgba(100,80,200,0.25)', borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: '#6850c8', marginBottom: 6, fontWeight: 600 }}>
        {emptySections.length} empty section{emptySections.length > 1 ? 's' : ''} detected
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        {emptySections.join(' · ')}
      </div>
      {result ? (
        <div style={{ fontSize: 12, color: '#4a9a6a', fontWeight: 600 }}>
          ✓ Filled {result.filled.length} section{result.filled.length !== 1 ? 's' : ''} — refresh to see updates
        </div>
      ) : (
        <>
          <button
            disabled={filling}
            onClick={async () => {
              setFilling(true);
              setError(null);
              try {
                const resp = await fetch(`/api/v1/character-registry/characters/${character.id}/backfill-sections`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                });
                const data = await resp.json();
                if (data.success) {
                  setResult(data);
                } else {
                  setError(data.error || 'Backfill failed');
                }
              } catch (err) {
                console.error('Backfill error:', err);
                setError(err.message || 'Network error');
              } finally {
                setFilling(false);
              }
            }}
            style={{
              padding: '8px 20px', background: filling ? '#ddd' : '#6850c8', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: filling ? 0.6 : 1,
            }}
          >
            {filling ? '⟳ Filling sections…' : '✦ Auto-fill Empty Sections from Dossier'}
          </button>
          {error && (
            <div style={{ fontSize: 12, color: '#c43a2a', marginTop: 8 }}>
              Error: {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* ================================================================
   BULK BACKFILL BUTTON
   ================================================================ */
function BulkBackfillButton({ registryId, characterCount, onDone }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  if (!registryId) return null;

  return (
    <>
      {progress ? (
        <div style={{ padding: '10px 14px', background: 'rgba(100,80,200,0.04)', border: '1px solid rgba(100,80,200,0.15)', borderRadius: 8, marginTop: 10 }}>
          <div style={{ fontSize: 13, color: '#4a9a6a', fontWeight: 600, marginBottom: 4 }}>
            ✓ Bulk backfill complete
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {progress.total_sections_filled} sections filled across {progress.total_characters} characters
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            {progress.results.map(r => (
              <div key={r.id} style={{ marginBottom: 2 }}>
                {r.name}: {r.skipped ? 'already complete' : r.error ? `error — ${r.error}` : `${r.filled.length} sections filled`}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          className="cr-ctx-btn"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            setError(null);
            try {
              const resp = await fetch(`/api/v1/character-registry/registries/${registryId}/backfill-all`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
              });
              const data = await resp.json();
              if (data.success) {
                setProgress(data);
                if (onDone) onDone();
              } else {
                setError(data.error || 'Bulk backfill failed');
              }
            } catch (err) {
              console.error('Bulk backfill error:', err);
              setError(err.message || 'Network error');
            } finally {
              setRunning(false);
            }
          }}
          style={{ borderColor: '#6850c8', color: running ? '#999' : '#6850c8' }}
        >
          {running ? `⟳ Filling ${characterCount} characters…` : `✦ Bulk Backfill All (${characterCount})`}
        </button>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#c43a2a', marginTop: 4 }}>
          {error}
        </div>
      )}
    </>
  );
}


/* ================================================================
   DEEP PROFILE TAB
   ================================================================ */
const DEEP_DIMS = [
  { key: 'life_stage',            icon: '⏳', label: 'Life Stage' },
  { key: 'the_body',              icon: '🦴', label: 'The Body' },
  { key: 'class_and_money',       icon: '💰', label: 'Class & Money' },
  { key: 'religion_and_meaning',  icon: '🕯', label: 'Religion & Meaning' },
  { key: 'race_and_culture',      icon: '🌍', label: 'Race & Culture' },
  { key: 'sexuality_and_desire',  icon: '🔥', label: 'Sexuality & Desire' },
  { key: 'family_architecture',   icon: '🏠', label: 'Family Architecture' },
  { key: 'friendship_and_loyalty',icon: '🤝', label: 'Friendship & Loyalty' },
  { key: 'ambition_and_identity', icon: '🎯', label: 'Ambition & Identity' },
  { key: 'habits_and_rituals',    icon: '☕', label: 'Habits & Rituals' },
  { key: 'speech_and_silence',    icon: '💬', label: 'Speech & Silence' },
  { key: 'grief_and_loss',        icon: '🖤', label: 'Grief & Loss' },
  { key: 'politics_and_justice',  icon: '⚖', label: 'Politics & Justice' },
  { key: 'the_unseen',            icon: '👁', label: 'The Unseen' },
];

function DeepProfileTab({ character }) {
  const [generating, setGenerating] = useState(false);
  const [expandedDims, setExpandedDims] = useState(new Set());
  const [writerInput, setWriterInput] = useState('');
  const [writerParsing, setWriterParsing] = useState(false);
  const [proposedAdditions, setProposedAdditions] = useState(null);
  const [localProfile, setLocalProfile] = useState(null);
  const [writerParagraph, setWriterParagraph] = useState(null);
  const [paragraphGenerating, setParagraphGenerating] = useState(false);

  const dp = localProfile || character.deep_profile || {};
  const API = import.meta.env.VITE_API_URL || '/api/v1';

  const filledCount = DEEP_DIMS.filter(d => {
    const dim = dp[d.key];
    return dim && typeof dim === 'object' && Object.values(dim).some(v => v !== null && v !== undefined && v !== '');
  }).length;

  const toggleDim = (key) => setExpandedDims(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const resp = await fetch(`${API}/character-registry/characters/${character.id}/deep-profile/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (data.success) setLocalProfile(data.deep_profile);
    } catch (err) { console.error('Deep profile generation error:', err); }
    finally { setGenerating(false); }
  };

  const handleParse = async () => {
    if (!writerInput.trim() || writerInput.trim().length < 10) return;
    setWriterParsing(true);
    setProposedAdditions(null);
    try {
      const resp = await fetch(`${API}/character-registry/characters/${character.id}/deep-profile/writer-input`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: writerInput }),
      });
      const data = await resp.json();
      if (data.proposed_additions) setProposedAdditions(data.proposed_additions);
    } catch (err) { console.error('Writer input parse error:', err); }
    finally { setWriterParsing(false); }
  };

  const handleAccept = async () => {
    try {
      const resp = await fetch(`${API}/character-registry/characters/${character.id}/deep-profile/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additions: proposedAdditions }),
      });
      const data = await resp.json();
      if (data.deep_profile) setLocalProfile(data.deep_profile);
      setProposedAdditions(null);
      setWriterInput('');
    } catch (err) { console.error('Accept error:', err); }
  };

  const handleGenerateParagraph = async () => {
    setParagraphGenerating(true);
    try {
      const resp = await fetch(`${API}/character-registry/characters/${character.id}/writer-paragraph/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (data.paragraph) setWriterParagraph(data.paragraph);
    } catch (err) { console.error('Writer paragraph generation error:', err); }
    finally { setParagraphGenerating(false); }
  };

  return (
    <div className="cr-dossier-section">
      <div className="cr-dossier-section-header">
        <span className="cr-dossier-section-title">🧬 Deep Profile</span>
        <span className={`cr-deep-profile-progress ${filledCount >= DEEP_DIMS.length ? 'complete' : filledCount > 0 ? 'partial' : ''}`}>
          {filledCount >= DEEP_DIMS.length ? '✓ Complete' : `${filledCount}/${DEEP_DIMS.length} dimensions`}
        </span>
      </div>

      {/* Dimension accordion */}
      {DEEP_DIMS.map(dim => {
        const data = dp[dim.key];
        const hasDimData = data && typeof data === 'object' && Object.values(data).some(v => v !== null && v !== undefined && v !== '');
        const isOpen = expandedDims.has(dim.key);
        return (
          <div key={dim.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 2 }}>
            <div
              onClick={() => toggleDim(dim.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 4px', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 14 }}>
                <span style={{ marginRight: 8 }}>{dim.icon}</span>
                <span style={{ fontWeight: 600, color: hasDimData ? 'var(--ink)' : '#aaa' }}>{dim.label}</span>
              </span>
              <span style={{ fontSize: 11, color: '#999' }}>{isOpen ? '▾' : '▸'}</span>
            </div>
            {isOpen && (
              <div style={{ padding: '4px 12px 12px 32px' }}>
                {hasDimData ? Object.entries(data).map(([field, val]) => {
                  if (val === null || val === undefined || val === '') return null;
                  return (
                    <div key={field} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                        {field.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{val}</div>
                    </div>
                  );
                }) : (
                  <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>Not yet known</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Generate deep profile */}
      <div style={{ marginTop: 16, padding: 14, background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: 8 }}>
        <div style={{ fontSize: 13, color: '#b8942f', marginBottom: 10 }}>
          {filledCount === 0
            ? 'Deep profile is empty — generate from existing character data?'
            : filledCount < 14
              ? `${filledCount}/14 dimensions populated. Generate the rest?`
              : 'All 14 dimensions populated. Regenerate empty fields?'}
        </div>
        <button
          disabled={generating}
          onClick={handleGenerate}
          style={{
            padding: '8px 20px', background: generating ? '#ddd' : '#c9a84c', color: generating ? '#888' : '#000',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {generating ? '🧬 Generating…' : '🧬 Generate Deep Profile from Dossier'}
        </button>
      </div>

      {/* Writer input */}
      <div style={{ marginTop: 20, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Writer Input</div>
        <textarea
          value={writerInput}
          onChange={e => setWriterInput(e.target.value)}
          placeholder="Tell me about this character — anything. Their mother's kitchen, what they do when they can't sleep, the compliment they still think about. I'll file it into the right dimensions."
          style={{
            width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6, color: 'var(--ink)', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleParse}
            disabled={writerParsing || writerInput.trim().length < 10}
            style={{
              padding: '6px 16px', background: writerParsing ? '#ddd' : '#c9a84c', color: '#000',
              border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: (writerParsing || writerInput.trim().length < 10) ? 0.5 : 1,
            }}
          >
            {writerParsing ? 'Parsing…' : '✦ Parse into Profile'}
          </button>
        </div>
      </div>

      {/* Proposed additions */}
      {proposedAdditions && (
        <div style={{ marginTop: 12, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#b8942f', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Proposed Additions</div>
          {Object.entries(proposedAdditions).map(([dim, fields]) => (
            <div key={dim} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#8a7230', fontWeight: 600, marginBottom: 4 }}>{dim.replace(/_/g, ' ')}</div>
              {Object.entries(fields || {}).map(([field, val]) => {
                if (!val) return null;
                return (
                  <div key={field} style={{ fontSize: 12, color: '#555', marginLeft: 12, marginBottom: 2 }}>
                    <span style={{ color: '#888' }}>{field.replace(/_/g, ' ')}:</span> {val}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleAccept}
              style={{ padding: '6px 14px', background: '#4a9a6a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              ✓ Accept All
            </button>
            <button
              onClick={() => setProposedAdditions(null)}
              style={{ padding: '6px 14px', background: '#ddd', color: '#666', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Writer Paragraph Generator */}
      <div style={{ marginTop: 20, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Writer Paragraph</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
          Generate a rich, literary paragraph from this character's registry data and deep profile — a novelist's reference portrait.
        </div>
        <button
          disabled={paragraphGenerating}
          onClick={handleGenerateParagraph}
          style={{
            padding: '8px 20px', background: paragraphGenerating ? '#ddd' : '#6a4c93', color: paragraphGenerating ? '#888' : '#fff',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {paragraphGenerating ? '📝 Generating…' : '📝 Generate Writer Paragraph'}
        </button>
        {writerParagraph && (
          <div style={{ marginTop: 12, background: 'rgba(106,76,147,0.06)', border: '1px solid rgba(106,76,147,0.25)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{writerParagraph}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(writerParagraph); }}
                style={{ padding: '6px 14px', background: '#6a4c93', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                📋 Copy
              </button>
              <button
                onClick={() => setWriterParagraph(null)}
                style={{ padding: '6px 14px', background: '#ddd', color: '#666', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ================================================================
   AI WRITER TAB
   ================================================================ */
function AIWriterTab({ character, ai, onSaveToProfile }) {
  const {
    aiMode, setAiMode, aiPrompt, setAiPrompt, aiMood, setAiMood,
    aiOtherChars, setAiOtherChars, aiLength, setAiLength,
    aiDirection, setAiDirection, aiResult, aiLoading, aiError,
    aiContextUsed, aiGenerate, aiClear,
  } = ai;

  const charName = character.selected_name || character.display_name;

  const AI_MODES = [
    { key: 'scene',     label: 'Write a Scene',       icon: '✦', desc: 'Claude writes a scene featuring this character using everything it knows' },
    { key: 'monologue', label: 'Inner Monologue',      icon: '◈', desc: 'Hear what this character is really thinking — behind the mask' },
    { key: 'next',      label: 'What Happens Next',    icon: '→', desc: 'Claude predicts the next story beat based on psychology & plot' },
    { key: 'gaps',      label: 'Suggest Missing',      icon: '◇', desc: 'Find underdeveloped areas in this character\'s profile' },
    { key: 'profile',   label: 'Generate from Story',  icon: '⟐', desc: 'Build a profile by reading all memories, lines & relationships' },
  ];

  const renderInputs = () => {
    switch (aiMode) {
      case 'scene':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>What\'s happening?</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. ${charName} walks into a meeting she wasn't invited to...`}
                rows={3}
              />
            </div>
            <div className="ai-writer-field-row">
              <div className="ai-writer-field half">
                <label>Mood / Feeling</label>
                <input value={aiMood} onChange={e => setAiMood(e.target.value)}
                  placeholder="Tense, electric, quiet" />
              </div>
              <div className="ai-writer-field half">
                <label>Other Characters</label>
                <input value={aiOtherChars} onChange={e => setAiOtherChars(e.target.value)}
                  placeholder="Names of others present" />
              </div>
            </div>
            <div className="ai-writer-length-row">
              <span className="ai-writer-length-label">Length:</span>
              {['short', 'medium', 'long'].map(l => (
                <button key={l} className={`ai-writer-length-btn ${aiLength === l ? 'active' : ''}`}
                  onClick={() => setAiLength(l)}>{l}</button>
              ))}
            </div>
          </div>
        );

      case 'monologue':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>The moment (optional)</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. Right after she finds out the truth about Dillon...`}
                rows={3}
              />
            </div>
            <div className="ai-writer-field">
              <label>Additional context (optional)</label>
              <input value={aiMood} onChange={e => setAiMood(e.target.value)}
                placeholder="What else should Claude know?" />
            </div>
          </div>
        );

      case 'next':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>Direction (optional — leave blank for Claude to decide)</label>
              <textarea
                value={aiDirection}
                onChange={e => setAiDirection(e.target.value)}
                placeholder="e.g. I want the story to move toward confrontation... or leave blank and let Claude read the momentum"
                rows={3}
              />
            </div>
          </div>
        );

      case 'gaps':
      case 'profile':
        return (
          <div className="ai-writer-inputs">
            <p className="ai-writer-auto-note">
              Claude will analyze all available data — memories, approved lines, relationships, 
              therapy sessions — to {aiMode === 'gaps' ? 'find what\'s underdeveloped' : 'build a comprehensive profile'}.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderResult = () => {
    if (aiLoading) {
      return (
        <div className="ai-writer-loading">
          <div className="ai-writer-loading-icon">✦</div>
          <div className="ai-writer-loading-text">
            Claude is reading everything about {charName}...
          </div>
          <div className="ai-writer-loading-sub">
            Psychology · Relationships · Memories · Story Lines · Universe
          </div>
        </div>
      );
    }

    if (aiError) {
      return (
        <div className="ai-writer-error">
          <span>⚠ {aiError}</span>
          <button onClick={aiClear} className="ai-writer-retry-btn">Try Again</button>
        </div>
      );
    }

    if (!aiResult) return null;

    // Prose result (scene / monologue)
    if (aiResult.prose) {
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Generated for {aiResult.character_name}</span>
            <div className="ai-writer-result-actions">
              <button onClick={() => navigator.clipboard?.writeText(aiResult.prose)} className="ai-writer-copy-btn">Copy</button>
              <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
            </div>
          </div>
          <div className="ai-writer-prose">{aiResult.prose}</div>
          {onSaveToProfile && (
            <button
              className="ai-writer-save-btn"
              onClick={() => onSaveToProfile({
                writer_notes: `[AI ${aiMode}] ${aiResult.prose?.slice(0, 500)}${aiResult.prose?.length > 500 ? '…' : ''}`,
              })}
            >
              Save to Writer Notes
            </button>
          )}
          {aiContextUsed && (
            <div className="ai-writer-context-badge">
              Context: {aiContextUsed.memories || 0} memories · {aiContextUsed.relationships || 0} relationships · {aiContextUsed.recent_lines || 0} lines
              {aiContextUsed.has_universe && ' · Universe'}
              {aiContextUsed.has_therapy && ' · Therapy'}
            </div>
          )}
        </div>
      );
    }

    // Beats result (what happens next)
    if (aiResult.beats) {
      const beats = aiResult.beats;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Story Beats for {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          {beats.story_tension && (
            <div className="ai-writer-tension">
              <strong>Core Tension:</strong> {beats.story_tension}
            </div>
          )}
          <div className="ai-writer-beats">
            {(beats.beats || []).map((beat, i) => (
              <div key={i} className="ai-writer-beat">
                <div className="ai-writer-beat-num">{i + 1}</div>
                <div className="ai-writer-beat-body">
                  <div className="ai-writer-beat-title">{beat.title}</div>
                  <div className="ai-writer-beat-desc">{beat.description}</div>
                  <div className="ai-writer-beat-why"><em>Why:</em> {beat.why}</div>
                  {beat.prose_preview && (
                    <div className="ai-writer-beat-preview">"{beat.prose_preview}"</div>
                  )}
                  <div className="ai-writer-beat-meta">
                    {beat.tone && <span className="ai-writer-beat-tone">{beat.tone}</span>}
                    {beat.characters_involved?.length > 0 && (
                      <span className="ai-writer-beat-chars">with {beat.characters_involved.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Analysis result (gaps)
    if (aiResult.analysis) {
      const a = aiResult.analysis;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Gap Analysis — {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          <div className="ai-writer-score-row">
            <div className="ai-writer-score">
              <div className="ai-writer-score-num">{a.overall_depth_score || '?'}</div>
              <div className="ai-writer-score-label">Depth Score</div>
            </div>
            <div className="ai-writer-score-details">
              {a.strongest_aspect && <div><strong>Strongest:</strong> {a.strongest_aspect}</div>}
              {a.weakest_aspect && <div><strong>Weakest:</strong> {a.weakest_aspect}</div>}
            </div>
          </div>
          {(a.gaps || []).map((gap, i) => (
            <div key={i} className={`ai-writer-gap ${gap.severity}`}>
              <div className="ai-writer-gap-header">
                <span className="ai-writer-gap-area">{gap.area}</span>
                <span className={`ai-writer-gap-severity ${gap.severity}`}>{gap.severity?.replace('_', ' ')}</span>
              </div>
              <div className="ai-writer-gap-title">{gap.title}</div>
              <div className="ai-writer-gap-detail">{gap.detail}</div>
              {gap.suggestion && <div className="ai-writer-gap-suggestion">💡 {gap.suggestion}</div>}
            </div>
          ))}
          {a.scene_prompts?.length > 0 && (
            <div className="ai-writer-scene-prompts">
              <div className="ai-writer-scene-prompts-title">Scene Ideas to Explore</div>
              {a.scene_prompts.map((p, i) => (
                <div key={i} className="ai-writer-scene-prompt"
                  onClick={() => { setAiMode('scene'); setAiPrompt(p); }}
                  title="Click to use as scene prompt"
                >✦ {p}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Profile result
    if (aiResult.profile) {
      const p = aiResult.profile;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Generated Profile — {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          {p.ai_summary && (
            <div className="ai-writer-profile-summary">{p.ai_summary}</div>
          )}
          <div className="ai-writer-profile-grid">
            {p.core_desire && <div className="ai-writer-profile-item"><strong>Core Desire</strong><span>{p.core_desire}</span></div>}
            {p.core_fear && <div className="ai-writer-profile-item"><strong>Core Fear</strong><span>{p.core_fear}</span></div>}
            {p.core_wound && <div className="ai-writer-profile-item"><strong>Core Wound</strong><span>{p.core_wound}</span></div>}
            {p.mask_persona && <div className="ai-writer-profile-item"><strong>Public Mask</strong><span>{p.mask_persona}</span></div>}
            {p.truth_persona && <div className="ai-writer-profile-item"><strong>Private Truth</strong><span>{p.truth_persona}</span></div>}
            {p.signature_trait && <div className="ai-writer-profile-item"><strong>Signature Trait</strong><span>{p.signature_trait}</span></div>}
            {p.emotional_baseline && <div className="ai-writer-profile-item"><strong>Emotional Baseline</strong><span>{p.emotional_baseline}</span></div>}
          </div>
          {p.description && (
            <div className="ai-writer-profile-desc">
              <strong>Bio:</strong> {p.description}
            </div>
          )}
          {onSaveToProfile && (
            <button
              className="ai-writer-save-btn"
              onClick={() => {
                const fields = {};
                if (p.core_desire) fields.core_desire = p.core_desire;
                if (p.core_fear) fields.core_fear = p.core_fear;
                if (p.core_wound) fields.core_wound = p.core_wound;
                if (p.mask_persona) fields.mask_persona = p.mask_persona;
                if (p.truth_persona) fields.truth_persona = p.truth_persona;
                if (p.signature_trait) fields.signature_trait = p.signature_trait;
                if (p.emotional_baseline) fields.emotional_baseline = p.emotional_baseline;
                if (p.description) fields.description = p.description;
                onSaveToProfile(fields);
              }}
            >
              Save Profile to Character Record
            </button>
          )}
          {p.evidence?.length > 0 && (
            <div className="ai-writer-evidence">
              <div className="ai-writer-evidence-title">Evidence from Story</div>
              {p.evidence.map((e, i) => <div key={i} className="ai-writer-evidence-item">• {e}</div>)}
            </div>
          )}
          {aiResult.data_sources && (
            <div className="ai-writer-context-badge">
              Analyzed: {aiResult.data_sources.memories || 0} memories · {aiResult.data_sources.relationships || 0} relationships · {aiResult.data_sources.lines_mentioning || 0} character lines · {aiResult.data_sources.recent_lines || 0} story lines
            </div>
          )}
        </div>
      );
    }

    // Fallback: show raw
    if (aiResult.raw) {
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Result</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          <div className="ai-writer-prose">{aiResult.raw}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="ai-writer-tab">
      {/* Header */}
      <div className="ai-writer-header">
        <div className="ai-writer-header-title">✦ AI Writer</div>
        <div className="ai-writer-header-sub">
          Claude knows everything about {charName} — psychology, wounds, relationships, 
          memories, voice, and every approved line of story.
        </div>
      </div>

      {/* Mode selector */}
      <div className="ai-writer-modes">
        {AI_MODES.map(m => (
          <button
            key={m.key}
            className={`ai-writer-mode ${aiMode === m.key ? 'active' : ''}`}
            onClick={() => { setAiMode(m.key); if (aiResult) aiClear(); }}
          >
            <span className="ai-writer-mode-icon">{m.icon}</span>
            <span className="ai-writer-mode-label">{m.label}</span>
            <span className="ai-writer-mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Inputs */}
      {renderInputs()}

      {/* Generate button */}
      {!aiResult && !aiLoading && (
        <button className="ai-writer-generate-btn" onClick={aiGenerate} disabled={aiLoading}>
          ✦ Generate with Claude
        </button>
      )}

      {/* Result */}
      {renderResult()}
    </div>
  );
}


/* ================================================================
   DOSSIER SUB-COMPONENTS
   ================================================================ */

/* Read-mode row */
function DRow({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className="cr-dossier-row">
      <span className="cr-dossier-row-label">{label}</span>
      <span className={`cr-dossier-row-value ${accent ? 'accent' : ''}`}>{value}</span>
    </div>
  );
}

/* Relationship card */
function RelCard({ type, icon, value }) {
  if (!value) return null;
  return (
    <div className="cr-dossier-rel-card">
      <div className="cr-dossier-rel-type">{icon} {type}</div>
      <div className="cr-dossier-rel-names">{value}</div>
    </div>
  );
}

/* Edit field */
function EField({ label, value, onChange, placeholder }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <input className="cr-edit-input" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label} />
    </div>
  );
}

/* Edit textarea */
function EArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <textarea className="cr-edit-input cr-edit-textarea" value={value || ''}
        onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder || label} />
    </div>
  );
}

/* Edit select */
function ESelect({ label, value, onChange, options, allowEmpty }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <select className="cr-edit-input cr-edit-select" value={value || ''} onChange={e => onChange(e.target.value)}>
        {allowEmpty && <option value="">— Select —</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}


/* ================================================================
   FORM ↔ DATA HELPERS
   ================================================================ */

function buildFormForTab(tabKey, c) {
  if (!c) return {};
  switch (tabKey) {
    case 'overview':
      return {
        display_name:     c.display_name || '',
        selected_name:    c.selected_name || '',
        description:      c.description || '',
        core_belief:      c.core_belief || '',
        first_appearance: c.first_appearance || '',
        era_introduced:   c.era_introduced || '',
        canon_tier:       c.canon_tier || '',
        appearance_mode:  c.appearance_mode || '',
        pressure_type:    c.pressure_type || '',
        pressure_quote:   c.pressure_quote || '',
        job_options:      c.job_options || '',
        creator:          c.creator || '',
        writer_notes:     c.writer_notes || '',
      };
    case 'psychology':
      return {
        core_desire:         c.core_desire || '',
        core_fear:           c.core_fear || '',
        core_wound:          c.core_wound || '',
        mask_persona:        c.mask_persona || '',
        truth_persona:       c.truth_persona || '',
        character_archetype: c.character_archetype || '',
        signature_trait:     c.signature_trait || '',
        emotional_baseline:  c.emotional_baseline || '',
        belief_pressured:    c.belief_pressured || '',
        emotional_function:  c.emotional_function || '',
        wound_depth:         c.wound_depth || '',
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
        profession:          jGet(c.career_status, 'profession'),
        career_goal:         jGet(c.career_status, 'career_goal'),
        reputation_level:    jGet(c.career_status, 'reputation_level'),
        brand_relationships: jGet(c.career_status, 'brand_relationships'),
        financial_status:    jGet(c.career_status, 'financial_status'),
        public_recognition:  jGet(c.career_status, 'public_recognition'),
        ongoing_arc:         jGet(c.career_status, 'ongoing_arc'),
      };
    case 'relationships': {
      const nrm = normalizeRelMap(c.relationships_map) || {};
      return {
        allies:            jGet(nrm, 'allies'),
        rivals:            jGet(nrm, 'rivals'),
        mentors:           jGet(nrm, 'mentors'),
        love_interests:    jGet(nrm, 'love_interests'),
        business_partners: jGet(nrm, 'business_partners'),
        dynamic_notes:     jGet(nrm, 'dynamic_notes'),
      };
    }
    case 'story':
      return {
        appears_in_books:     jGet(c.story_presence, 'appears_in_books'),
        appears_in_shows:     jGet(c.story_presence, 'appears_in_shows'),
        appears_in_series:    jGet(c.story_presence, 'appears_in_series'),
        current_story_status: jGet(c.story_presence, 'current_story_status'),
        unresolved_threads:   jGet(c.story_presence, 'unresolved_threads'),
        future_potential:     jGet(c.story_presence, 'future_potential'),
      };
    case 'voice':
      return {
        speech_pattern:           jGet(c.voice_signature, 'speech_pattern'),
        vocabulary_tone:          jGet(c.voice_signature, 'vocabulary_tone'),
        catchphrases:             jGet(c.voice_signature, 'catchphrases'),
        internal_monologue_style: jGet(c.voice_signature, 'internal_monologue_style'),
        emotional_reactivity:     jGet(c.voice_signature, 'emotional_reactivity'),
      };
    default:
      return {};
  }
}

function buildPayloadForTab(tabKey, form) {
  switch (tabKey) {
    case 'overview':
      return {
        display_name:     form.display_name,
        selected_name:    form.selected_name,
        description:      form.description,
        core_belief:      form.core_belief,
        first_appearance: form.first_appearance,
        era_introduced:   form.era_introduced,
        canon_tier:       form.canon_tier,
        appearance_mode:  form.appearance_mode,
        pressure_type:    form.pressure_type,
        pressure_quote:   form.pressure_quote,
        job_options:      form.job_options,
        creator:          form.creator,
        writer_notes:     form.writer_notes,
      };
    case 'psychology':
      return {
        core_desire:         form.core_desire,
        core_fear:           form.core_fear,
        core_wound:          form.core_wound,
        mask_persona:        form.mask_persona,
        truth_persona:       form.truth_persona,
        character_archetype: form.character_archetype,
        signature_trait:     form.signature_trait,
        emotional_baseline:  form.emotional_baseline,
        belief_pressured:    form.belief_pressured,
        emotional_function:  form.emotional_function,
        wound_depth:         form.wound_depth ? parseFloat(form.wound_depth) : null,
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
    default:
      return form;
  }
}
