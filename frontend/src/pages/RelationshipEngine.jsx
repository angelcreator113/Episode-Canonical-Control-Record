/**
 * RelationshipEngine.jsx
 * Prime Studios · LalaVerse
 * Editorial Fashion Intelligence — fully modernized
 * Palette: #d4789a rose · #7ab3d4 steel · #a889c8 orchid
 */
import { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, GitBranch, Users, Share2, Sprout, List, Search } from 'lucide-react';
import apiClient from '../services/api';
import { findLala } from '../lib/theCast';
import './RelationshipEngine.css';

import {
  WebView, TreeView, FamilyView, CandidateView, ListView, ProfileView,
  Inspector, AddModal, GenModal,
  Btn, Spinner, useToast, useIsPhone,
  API, T, cname, initials, roleColor, sideName, typeLabel, humanize, isFamily,
} from '../components/RelationshipEngine';

/* ── API helpers ─────────────────────────────────────────────────────── */
// The page's people and pairs in one read (GET /relationships/cast): the
// cast across every registry holding them (registry characters a live
// LalaVerse feed profile names, and Lala; Evoni, 2026-10-16), their
// confirmed relationships and the seeds still pending. Every tab draws
// these same pairs.
export const fetchCast = () =>
  apiClient.get(`${API}/relationships/cast`);
export const confirmRelationship = (id) =>
  apiClient.post(`${API}/relationships/confirm/${id}`);
// The server's methods (Task #3119): dismiss is a DELETE, both edits are PUTs.
export const dismissRelationship = (id) =>
  apiClient.delete(`${API}/relationships/dismiss/${id}`);
// Delete marks the row deleted (its story so far stays); restore undoes it.
export const deleteRelationship = (id) =>
  apiClient.delete(`${API}/relationships/${id}`);
export const restoreRelationship = (id) =>
  apiClient.post(`${API}/relationships/${id}/restore`);
export const generateRelationships = (payload) =>
  apiClient.post(`${API}/relationships/generate`, payload);
export const createRelationship = (payload) =>
  apiClient.post(`${API}/relationships`, payload);
export const generateFamilyRelationships = (payload) =>
  apiClient.post(`${API}/relationships/generate-family`, payload);
export const updateRelationshipFamilyRole = (id, fields) =>
  apiClient.put(`${API}/relationships/${id}/family`, fields);
export const updateRelationshipFields = (id, fields) =>
  apiClient.put(`${API}/relationships/${id}`, fields);

/** New seeds join the pending list (newest first), each once. */
export function mergeSeeds(current, fresh) {
  const ids = new Set((fresh || []).map(c => c.id));
  return [...(fresh || []), ...(current || []).filter(c => !ids.has(c.id))];
}

/**
 * The deep link (?char=<registry character id> selects that person;
 * ?rel=<relationship id> opens that relationship's Inspector; ?tab= picks a
 * tab), as a state change, or null when it names nothing loaded.
 */
const TAB_KEYS = ['overview', 'tree', 'family', 'web', 'candidates', 'list'];
export function deepLinkState(search, { chars, rels }) {
  const q = new URLSearchParams(search || '');
  const out = {};
  const charId = q.get('char');
  const relId = q.get('rel');
  const tab = q.get('tab');
  if (charId) {
    const c = chars.find(x => String(x.id) === charId);
    if (c) out.selChar = c;
  }
  if (relId) {
    const r = rels.find(x => String(x.id) === relId);
    if (r) { out.selRel = r; out.panel = true; }
  }
  if (tab && TAB_KEYS.includes(tab)) out.tab = tab;
  return Object.keys(out).length ? out : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   State management
   ═══════════════════════════════════════════════════════════════════════ */
const initial = {
  loading:  true,
  loaded:   false,
  error:    null,       // global fetch error
  chars:    [],
  rels:     [],
  cands:    [],
  lalaId:   null,
  tab:      'overview',
  lf:       'all',
  selChar:  null,
  selRel:   null,
  panel:    false,
  addOpen:  false,
  genOpen:  false,
  genning:  false,
  genFam:   false,
  busy:     null,       // id of in-flight per-action operation
};

const byNewest = (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0);

function reducer(state, action) {
  switch (action.type) {
    case 'SET':          return { ...state, ...action.payload };
    case 'LOADED':       return { ...state, ...action.payload, loading: false, loaded: true, error: null };
    case 'REMOVE_CAND':  return { ...state, cands: state.cands.filter(c => c.id !== action.id), busy: null };
    case 'ADD_REL':      return { ...state, rels: [action.rel, ...state.rels.filter(r => r.id !== action.rel.id)].sort(byNewest), addOpen: false };
    case 'UPDATE_REL': {
      const updated = state.rels.map(r => r.id === action.id ? { ...r, ...action.fields } : r);
      return { ...state, rels: updated, selRel: state.selRel?.id === action.id ? { ...state.selRel, ...action.fields } : state.selRel };
    }
    case 'DELETE_REL':   return { ...state, rels: state.rels.filter(r => r.id !== action.id), selRel: null, panel: false, busy: null };
    // Switching tab closes the Inspector (it belonged to the last view).
    case 'TAB':          return { ...state, tab: action.tab, panel: false, selRel: null };
    case 'ERROR':        return { ...state, loading: false, error: action.msg };
    default:             return state;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════ */
export default function RelationshipEngine() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, show: toast, dismiss: dismissToast } = useToast();
  const [s, dispatch] = useReducer(reducer, initial);
  const [charSearch, setCharSearch] = useState('');
  const [autoSuggestions, setAutoSuggestions] = useState(null);
  const isPhone = useIsPhone();

  // ── Handle auto-suggestions from Story Evaluation Engine ─────────────
  useEffect(() => {
    const st = location.state;
    if (st?.autoSuggestions?.length) {
      setAutoSuggestions({ suggestions: st.autoSuggestions, fromScene: st.fromScene || 'Scene' });
      toast(`${st.autoSuggestions.length} relationship suggestions from "${st.fromScene || 'Scene'}"`, 'success');
      // Clear the state so refreshing doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, toast]);

  /* ── Load the cast, their relationships and seeds ─────────────────── */
  const load = useCallback(async () => {
    dispatch({ type: 'SET', payload: { loading: true, error: null } });
    try {
      const { data } = await fetchCast();
      dispatch({
        type: 'LOADED',
        payload: {
          chars:  data?.characters || [],
          rels:   data?.relationships || [],
          cands:  data?.candidates || [],
          lalaId: data?.lala_id || null,
        },
      });
    } catch (err) {
      console.error('[RelationshipEngine] load failed:', err);
      dispatch({ type: 'ERROR', msg: err.message || "Could not load the people in Lala's world. Check your connection and try again." });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Deep links: ?char= selects a person, ?rel= opens a relationship ── */
  useEffect(() => {
    if (!s.loaded) return;
    const next = deepLinkState(location.search, { chars: s.chars, rels: s.rels });
    if (next) dispatch({ type: 'SET', payload: next });
    // Only when the page loads or the link changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.loaded, location.search]);

  const charById = useMemo(() => Object.fromEntries(s.chars.map(c => [c.id, c])), [s.chars]);
  const lala = useMemo(() => s.chars.find(c => String(c.id) === String(s.lalaId)) || findLala(s.chars), [s.chars, s.lalaId]);

  /* ── Actions (with per-action loading) ─────────────────────────────── */
  const confirm = async id => {
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      await confirmRelationship(id);
      dispatch({ type: 'REMOVE_CAND', id });
      toast('Relationship confirmed', 'success');
      load();
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(err.message || 'Confirm failed', 'error');
    }
  };

  const dismiss = async id => {
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      await dismissRelationship(id);
      dispatch({ type: 'REMOVE_CAND', id });
      toast('Seed dismissed', 'info');
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(err.message || 'Dismiss failed', 'error');
    }
  };

  const undoDelete = async rel => {
    try {
      const r = await restoreRelationship(rel.id);
      dispatch({ type: 'ADD_REL', rel: r.data?.relationship || rel });
      toast('Relationship restored', 'success');
    } catch (err) {
      toast(err.message || 'Undo failed', 'error');
    }
  };

  // The Inspector asks first; the row is only marked deleted, so Undo works.
  const del = async rel => {
    dispatch({ type: 'SET', payload: { busy: rel.id } });
    try {
      await deleteRelationship(rel.id);
      dispatch({ type: 'DELETE_REL', id: rel.id });
      toast(`Deleted ${sideName(rel, 'a', charById)} and ${sideName(rel, 'b', charById)}`, 'info', { label: 'Undo', run: () => undoDelete(rel) });
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(err.message || 'Delete failed', 'error');
    }
  };

  const generate = async focusId => {
    dispatch({ type: 'SET', payload: { genning: true } });
    try {
      const r = await generateRelationships({ focus_character_id: focusId });
      const d = r.data;
      const fresh = d.candidates || [];
      dispatch({ type: 'SET', payload: { cands: mergeSeeds(s.cands, fresh), genning: false, genOpen: false, tab: 'candidates', panel: false, selRel: null } });
      toast(fresh.length ? `${fresh.length} new seed${fresh.length === 1 ? '' : 's'} added` : 'No new seeds this time', 'success');
    } catch (err) {
      dispatch({ type: 'SET', payload: { genning: false } });
      toast(err.message || 'Generation failed', 'error');
    }
  };

  const addRel = async f => {
    try {
      const r = await createRelationship(f);
      const d = r.data;
      dispatch({ type: 'ADD_REL', rel: d.relationship || d });
      toast('Relationship added', 'success');
    } catch (err) {
      toast(err.message || 'Add failed', 'error');
    }
  };

  // Family proposals arrive as seeds, to confirm on the Seeds tab.
  const genFamFn = async () => {
    dispatch({ type: 'SET', payload: { genFam: true } });
    try {
      const r = await generateFamilyRelationships({});
      const fresh = r.data?.family_bonds || [];
      dispatch({ type: 'SET', payload: { cands: mergeSeeds(s.cands, fresh), genFam: false } });
      toast(fresh.length ? `${fresh.length} family seed${fresh.length === 1 ? '' : 's'} to confirm` : 'No new family proposed', 'success',
        fresh.length ? { label: 'Open Seeds', run: () => dispatch({ type: 'TAB', tab: 'candidates' }) } : null);
    } catch (err) {
      dispatch({ type: 'SET', payload: { genFam: false } });
      toast(err.message || 'Family generation failed', 'error');
    }
  };

  const updateFamRole = async (id, fields) => {
    try {
      const r = await updateRelationshipFamilyRole(id, fields);
      dispatch({ type: 'UPDATE_REL', id, fields: r.data?.relationship || fields });
    } catch (err) {
      toast(err.response?.data?.error || err.message || 'Update failed', 'error');
    }
  };

  const updateRel = async (id, fields) => {
    try {
      const r = await updateRelationshipFields(id, fields);
      dispatch({ type: 'UPDATE_REL', id, fields: r.data?.relationship || fields });
      toast('Updated', 'success');
    } catch (err) {
      toast(err.response?.data?.error || err.message || 'Update failed', 'error');
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────── */
  const roleTypes = useMemo(() => {
    const n = {};
    s.chars.forEach(c => { if (c.role_type) n[c.role_type] = (n[c.role_type] || 0) + 1; });
    return Object.entries(n).sort();
  }, [s.chars]);

  const filtChars = useMemo(() => {
    // The type filter is the role type (every cast member is in Lala's world).
    let list = s.lf === 'all' ? s.chars : s.chars.filter(c => c.role_type === s.lf);
    if (charSearch.trim()) {
      const q = charSearch.toLowerCase();
      list = list.filter(c => cname(c).toLowerCase().includes(q) || (c.role_type || '').toLowerCase().includes(q));
    }
    return list;
  }, [s.chars, s.lf, charSearch]);
  const filtRels = useMemo(() => {
    if (s.lf === 'all' && !charSearch.trim()) return s.rels;
    const ids = new Set(filtChars.map(c => c.id));
    return s.rels.filter(r => ids.has(r.character_id_a) || ids.has(r.character_id_b));
  }, [s.rels, s.lf, charSearch, filtChars]);

  /* ── Export relationships as JSON ────────────────────────────────────── */
  const exportRelationships = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      characters: s.chars.map(c => ({ id: c.id, name: cname(c), role_type: c.role_type })),
      relationships: s.rels.map(r => ({
        id: r.id, character_a: r.character_id_a, character_a_name: sideName(r, 'a', charById),
        character_b: r.character_id_b, character_b_name: sideName(r, 'b', charById),
        type: r.relationship_type, romantic: !!r.is_romantic, family_role: r.family_role || null,
        tension_state: r.tension_state || null, stage: r.stage || null, status: r.status || null,
        situation: r.situation || null,
      })),
      stats: { characters: s.chars.length, relationships: s.rels.length, pending_seeds: s.cands.length },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relationships-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Relationships exported', 'success');
  }, [s.chars, s.rels, s.cands, charById, toast]);

  /* ── Relationship type distribution ────────────────────────────────── */
  const relStats = useMemo(() => {
    const byType = {};
    s.rels.forEach(r => { const k = typeLabel(r); byType[k] = (byType[k] || 0) + 1; });
    return byType;
  }, [s.rels]);

  const tabs = [
    { key: 'overview',   label: 'Overview',   Icon: House },
    { key: 'tree',       label: 'Tree',       Icon: GitBranch },
    { key: 'family',     label: 'Family',     Icon: Users },
    { key: 'web',        label: 'Web',        Icon: Share2 },
    { key: 'candidates', label: 'Seeds',      Icon: Sprout, badge: s.cands.length || null },
    { key: 'list',       label: 'List',       Icon: List },
  ];
  const setTab = tab => dispatch({ type: 'TAB', tab });
  const openRel = r => dispatch({ type: 'SET', payload: { selRel: r, panel: true } });
  const closeRel = useCallback(() => dispatch({ type: 'SET', payload: { panel: false, selRel: null } }), []);
  const pickChar = c => {
    const keep = s.tab === 'overview' || s.selChar?.id !== c.id;
    dispatch({ type: 'SET', payload: { selChar: keep ? c : null, selRel: null, panel: false } });
  };

  /* Overview profiles the selected character, else Lala, else the first protagonist */
  const profileChar = s.selChar
    || lala
    || s.chars.find(c => c.role_type === 'protagonist')
    || s.chars[0]
    || null;

  const familyCount = s.rels.filter(isFamily).length;
  const subline =
    s.tab === 'candidates' ? `${s.cands.length} pending` :
    s.tab === 'family'     ? `${familyCount} bond${familyCount === 1 ? '' : 's'}` :
    `${filtChars.length} people · ${filtRels.length} relationships`;

  /* ── Error state (retry-able) ──────────────────────────────────────── */
  if (s.error && !s.loading) {
    return (
      <div className="re-shell" role="alert">
        <div className="re-error-page">
          <div className="re-error-icon">⚠</div>
          <div className="re-error-title">Something went wrong</div>
          <div className="re-error-msg">{s.error}</div>
          <Btn variant="primary" onClick={load}>Retry</Btn>
        </div>
      </div>
    );
  }

  const showPanel = isPhone
    ? s.panel && !!s.selRel
    : (s.tab !== 'overview' && s.tab !== 'web') || s.panel;

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="re-shell">
      {/* toast tray */}
      <div className="re-toast-tray" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`cg-toast is-${t.type}`} role="status">
            {t.msg}
            {t.action && (
              <button type="button" className="re-toast-action"
                onClick={() => { dismissToast(t.id); t.action.run(); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <header className="re-header" role="banner">
        <div className="re-header-left">
          <span className="re-brand">LalaVerse</span>
          <div className="re-title-block">
            <h1 className="re-wordmark">Relationship Engine</h1>
            <div className="re-tagline">People · Connections · Stories · Consequences</div>
          </div>
        </div>

        <div className="re-header-tools">
          <label className="re-search">
            <Search size={18} aria-hidden />
            <input
              value={charSearch}
              onChange={e => setCharSearch(e.target.value)}
              placeholder="Search people…"
              aria-label="Search characters"
            />
          </label>
          <select className="re-layer-select" value={s.lf} aria-label="Filter by type"
            onChange={e => dispatch({ type: 'SET', payload: { lf: e.target.value } })}>
            <option value="all">All Types ({s.chars.length})</option>
            {roleTypes.map(([k, n]) => (
              <option key={k} value={k}>{humanize(k)} ({n})</option>
            ))}
          </select>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      {/* Auto-suggestion banner from Story Evaluation */}
      {autoSuggestions && (
        <div style={{
          padding: '12px 20px', background: `${T.orchid || '#a889c8'}10`,
          borderBottom: `1px solid ${T.orchid || '#a889c8'}30`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text || '#1a1a1a' }}>
              ◈ Relationship Suggestions from &ldquo;{autoSuggestions.fromScene}&rdquo;
            </div>
            <button onClick={() => setAutoSuggestions(null)} aria-label="Close suggestions"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: T.textDim || '#666' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {autoSuggestions.suggestions.map((sug, i) => (
              <div key={i} style={{
                padding: '8px 12px', borderRadius: 8,
                background: '#fff', border: `1px solid ${sug.signal === 'strong' ? '#6ec9a0' : sug.signal === 'moderate' ? '#c9a96e' : '#e0e0e0'}`,
                fontSize: 11,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {sug.pair[0]} ↔ {sug.pair[1]}
                </div>
                <div style={{ color: '#887766', fontSize: 10 }}>
                  {sug.sharedDimensions.map(d => d.replace(/_/g, ' ')).join(', ')}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: 4, fontSize: 9, padding: '1px 6px', borderRadius: 8,
                  background: sug.signal === 'strong' ? '#e8f5e9' : sug.signal === 'moderate' ? '#fff8e1' : '#f5f5f5',
                  color: sug.signal === 'strong' ? '#2a8a5e' : sug.signal === 'moderate' ? '#b8944e' : '#999',
                  fontWeight: 600,
                }}>{sug.signal} signal</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="re-body">
        {/* LEFT SIDEBAR */}
        <aside className="re-sidebar" aria-label="Views and characters">
          <nav className="re-nav" role="tablist" aria-label="View tabs">
            {tabs.map(t => (
              <button key={t.key} role="tab" aria-selected={s.tab === t.key}
                className={`re-nav-btn ${s.tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}>
                <t.Icon size={20} aria-hidden />
                <span className="re-nav-label">{t.label}</span>
                {t.badge && <span className="cg-tab-count">{t.badge}</span>}
              </button>
            ))}
          </nav>
          {s.tab !== 'web' && (
            <>
            <div className="re-sidebar-divider" />
            <div className="re-label re-sidebar-heading">People</div>
            {/* character list: a column on a desktop, a chip strip on a phone */}
            <div className="re-sidebar-chars" role="group" aria-label="People">
              {filtChars.length === 0 && (
                <div className="re-sidebar-empty">No one matches</div>
              )}
              {filtChars.map(c => {
                const rc = roleColor(c.role_type);
                const act = (s.tab === 'overview' ? profileChar?.id : s.selChar?.id) === c.id;
                const isLala = lala && c.id === lala.id;
                return (
                  <button key={c.id}
                    className={`cg-world-card ${act ? 'is-active' : ''}`}
                    onClick={() => pickChar(c)}
                    aria-pressed={act}
                    aria-label={`${cname(c)}, ${isLala ? 'protagonist' : (c.role_type || 'unknown role')}`}>
                    <div className="re-char-avatar" style={{ borderColor: act ? rc : undefined, color: rc, background: act ? rc + '18' : undefined }}>
                      {initials(cname(c))}
                    </div>
                    <div className="re-char-info">
                      <div className="re-char-name">{cname(c)}</div>
                      <div className="re-char-role">{isLala ? 'Protagonist' : (humanize(c.role_type) || '—')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            </>
          )}
        </aside>

        {/* CENTER CANVAS */}
        <main className="re-canvas" role="main">
          {/* sub-header */}
          {s.tab !== 'overview' && (
          <div className="re-sub-header">
            <div>
              <span className="re-sub-title">
                {{ tree: 'Tree', family: 'Family', web: 'Web', candidates: 'Seeds', list: 'List' }[s.tab]}
              </span>
              <span className="re-sub-stats">{subline}</span>
            </div>
            <div className="re-sub-actions">
              {/* relationship type pills */}
              {s.tab !== 'candidates' && Object.keys(relStats).length > 0 && (
                <div className="re-type-pills">
                  {Object.entries(relStats).slice(0, 5).map(([type, count]) => (
                    <span key={type} className="re-type-pill">{type} ({count})</span>
                  ))}
                </div>
              )}
              {s.tab === 'candidates' && s.cands.length > 0 && (
                <Btn variant="ghost" onClick={() => dispatch({ type: 'SET', payload: { genOpen: true } })}>◈ More seeds</Btn>
              )}
              {s.tab === 'family' && (
                <Btn variant="ghost" onClick={genFamFn} disabled={s.genFam}>
                  {s.genFam ? 'Generating…' : '⬡ Propose Family'}
                </Btn>
              )}
              <Btn variant="ghost" onClick={exportRelationships} title="Export relationships as JSON">↓ Export</Btn>
              <Btn variant="outline" onClick={() => dispatch({ type: 'SET', payload: { genOpen: true } })}>◈ Generate</Btn>
              <Btn variant="primary" onClick={() => dispatch({ type: 'SET', payload: { addOpen: true } })}>+ Add</Btn>
            </div>
          </div>
          )}

          {/* view */}
          <div className={`re-view ${s.tab === 'overview' ? 'is-overview' : ''} is-${s.tab}`}>
            {s.loading              ? <Spinner /> :
             s.tab === 'web'        ? <WebView chars={filtChars} rels={filtRels} lalaId={lala?.id} navigate={navigate} onRelClick={openRel} /> :
             s.tab === 'overview'   ? <ProfileView char={profileChar} chars={s.chars} rels={s.rels} cands={s.cands}
                                        onSelectChar={c => dispatch({ type: 'SET', payload: { selChar: c, selRel: null, panel: false } })}
                                        onRelClick={openRel}
                                        onAdd={() => dispatch({ type: 'SET', payload: { addOpen: true } })}
                                        onGenerate={() => dispatch({ type: 'SET', payload: { genOpen: true } })}
                                        onExport={exportRelationships}
                                        onTab={setTab} /> :
             s.tab === 'tree'       ? <TreeView chars={filtChars} rels={filtRels} lalaId={lala?.id} selChar={s.selChar} onRelClick={openRel} onCharClick={c => dispatch({ type: 'SET', payload: { selChar: c } })} /> :
             s.tab === 'family'     ? <FamilyView chars={filtChars} rels={filtRels} charById={charById} genning={s.genFam} onGenerate={genFamFn} onUpdateRole={updateFamRole} onRelClick={openRel} /> :
             s.tab === 'candidates' ? <CandidateView cands={s.cands} charById={charById} onConfirm={confirm} onDismiss={dismiss} busy={!!s.busy} /> :
                                      <ListView rels={filtRels} charById={charById} onSelect={openRel} />
            }
          </div>
        </main>

        {/* RIGHT INSPECTOR (a bottom sheet on a phone) */}
        {showPanel && isPhone && <div className="re-sheet-backdrop" onClick={closeRel} aria-hidden />}
        {showPanel && (
          <aside className={`re-inspector-panel ${isPhone ? 'is-sheet' : ''}`}>
            {s.panel && s.selRel
              ? <Inspector rel={s.selRel} charById={charById} sheet={isPhone}
                  onClose={closeRel}
                  onUpdate={u => updateRel(s.selRel.id, u)}
                  onDelete={() => del(s.selRel)} />
              : (
                <div className="re-inspector-empty">
                  <div className="re-inspector-empty-icon">◈</div>
                  <div className="re-inspector-empty-title">Select a relationship</div>
                  <div className="re-inspector-empty-desc">
                    Click any line in the tree or any row in the list to see their story so far here
                  </div>
                  {s.selChar && (
                    <div className="re-inspector-char-summary">
                      <div className="re-inspector-char-name">{cname(s.selChar)}</div>
                      <div className="re-inspector-char-count">
                        {filtRels.filter(r => r.character_id_a === s.selChar.id || r.character_id_b === s.selChar.id).length} connections
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          </aside>
        )}
      </div>

      {/* Modals */}
      {s.addOpen && <AddModal chars={s.chars} rels={s.rels} onAdd={addRel} onClose={() => dispatch({ type: 'SET', payload: { addOpen: false } })} />}
      {s.genOpen && <GenModal chars={s.chars} genning={s.genning} onGenerate={generate} onClose={() => dispatch({ type: 'SET', payload: { genOpen: false } })} />}
    </div>
  );
}
