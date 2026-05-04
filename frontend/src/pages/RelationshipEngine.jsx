/**
 * RelationshipEngine.jsx
 * Prime Studios · LalaVerse
 * Editorial Fashion Intelligence — fully modernized
 * Palette: #d4789a rose · #7ab3d4 steel · #a889c8 orchid
 */
import { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/api';
import './RelationshipEngine.css';

import {
  WebView, TreeView, FamilyView, CandidateView, ListView,
  Inspector, AddModal, GenModal,
  Btn, LFBtn, Spinner, useToast,
  API, T, LAYER, TENSION, cname, clayer, initials, roleColor,
} from '../components/RelationshipEngine';

/* ── Track 3 module-scope helpers (Pattern D) ────────────────────────── */
export const fetchRelationshipTree = (regId) =>
  apiClient.get(`${API}/relationships/tree/${regId}`);
export const fetchPendingRelationships = () =>
  apiClient.get(`${API}/relationships/pending`);
export const fetchFamilyTree = (regId) =>
  apiClient.get(`${API}/relationships/family-tree/${regId}`);
export const confirmRelationship = (id) =>
  apiClient.post(`${API}/relationships/confirm/${id}`);
export const dismissRelationship = (id) =>
  apiClient.post(`${API}/relationships/dismiss/${id}`);
export const deleteRelationship = (id) =>
  apiClient.delete(`${API}/relationships/${id}`);
export const generateRelationships = (payload) =>
  apiClient.post(`${API}/relationships/generate`, payload);
export const createRelationship = (payload) =>
  apiClient.post(`${API}/relationships`, payload);
export const generateFamilyRelationships = (payload) =>
  apiClient.post(`${API}/relationships/generate-family`, payload);
export const updateRelationshipFamilyRole = (id, fields) =>
  apiClient.patch(`${API}/relationships/${id}/family`, fields);
export const updateRelationshipFields = (id, fields) =>
  apiClient.patch(`${API}/relationships/${id}`, fields);

/* ═══════════════════════════════════════════════════════════════════════
   State management (replaces 16 individual useState hooks)
   ═══════════════════════════════════════════════════════════════════════ */
const initial = {
  loading:  true,
  error:    null,       // global fetch error
  chars:    [],
  rels:     [],
  cands:    [],
  layers:   {},
  regs:     [],
  reg:      null,
  tab:      'tree',
  lf:       'all',
  selChar:  null,
  selRel:   null,
  panel:    false,
  addOpen:  false,
  genOpen:  false,
  genning:  false,
  genFam:   false,
  famData:  null,
  busy:     null,       // id of in-flight per-action operation
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':          return { ...state, ...action.payload };
    case 'TREE_LOADED':  return { ...state, ...action.payload, loading: false, error: null };
    case 'FAM_LOADED':   return { ...state, famData: action.payload, genFam: false };
    case 'REMOVE_CAND':  return { ...state, cands: state.cands.filter(c => c.id !== action.id), busy: null };
    case 'ADD_REL':      return { ...state, rels: [...state.rels, action.rel], addOpen: false };
    case 'UPDATE_REL': {
      const updated = state.rels.map(r => r.id === action.id ? { ...r, ...action.fields } : r);
      return { ...state, rels: updated, selRel: state.selRel?.id === action.id ? { ...state.selRel, ...action.fields } : state.selRel };
    }
    case 'DELETE_REL':   return { ...state, rels: state.rels.filter(r => r.id !== action.id), selRel: null, panel: false, busy: null };
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
  const { toasts, show: toast } = useToast();
  const [s, dispatch] = useReducer(reducer, initial);
  const [charSearch, setCharSearch] = useState('');
  const [autoSuggestions, setAutoSuggestions] = useState(null);

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

  /* ── Load registries ───────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/character-registry/registries`);
        const d = await r.json();
        const list = d.registries || d || [];
        if (list.length) dispatch({ type: 'SET', payload: { regs: list, reg: list[0] } });
      } catch { /* non-critical */ }
    })();
  }, []);

  /* ── Fetch tree when registry changes ─────────────────────────────── */
  const fetchTree = useCallback(async () => {
    if (!s.reg) return;
    dispatch({ type: 'SET', payload: { loading: true, error: null } });
    try {
      const [treeR, pendR] = await Promise.all([
        fetchRelationshipTree(s.reg.id),
        fetchPendingRelationships(),
      ]);
      const tree = treeR.data;
      const pend = pendR.data;
      dispatch({
        type: 'TREE_LOADED',
        payload: {
          chars:  tree.characters || [],
          rels:   tree.relationships || [],
          layers: tree.layers || {},
          cands:  pend.candidates || pend || [],
        },
      });
    } catch (err) {
      dispatch({ type: 'ERROR', msg: err.message || 'Failed to load relationships. Check your connection and try again.' });
    }
  }, [s.reg]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  /* ── Family tree ───────────────────────────────────────────────────── */
  const fetchFamily = useCallback(async () => {
    if (!s.reg) return;
    try {
      const r = await fetchFamilyTree(s.reg.id);
      dispatch({ type: 'FAM_LOADED', payload: r.data });
    } catch (err) {
      toast(err.message || 'Could not load family tree', 'error');
    }
  }, [s.reg, toast]);

  useEffect(() => { if (s.tab === 'family') fetchFamily(); }, [s.tab, fetchFamily]);

  /* ── Actions (with per-action loading) ─────────────────────────────── */
  const confirm = async id => {
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      await confirmRelationship(id);
      dispatch({ type: 'REMOVE_CAND', id });
      toast('Relationship confirmed', 'success');
      fetchTree();
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

  const del = async id => {
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      await deleteRelationship(id);
      dispatch({ type: 'DELETE_REL', id });
      toast('Deleted', 'info');
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(err.message || 'Delete failed', 'error');
    }
  };

  const generate = async focusId => {
    dispatch({ type: 'SET', payload: { genning: true } });
    try {
      const r = await generateRelationships({ registry_id: s.reg?.id, focus_character_id: focusId });
      const d = r.data;
      dispatch({ type: 'SET', payload: { cands: d.candidates || d || [], genning: false, genOpen: false, tab: 'candidates' } });
      toast('Seeds generated', 'success');
    } catch (err) {
      dispatch({ type: 'SET', payload: { genning: false } });
      toast(err.message || 'Generation failed', 'error');
    }
  };

  const addRel = async f => {
    try {
      const r = await createRelationship({ ...f, registry_id: s.reg?.id });
      const d = r.data;
      dispatch({ type: 'ADD_REL', rel: d.relationship || d });
      toast('Relationship added', 'success');
    } catch (err) {
      toast(err.message || 'Add failed', 'error');
    }
  };

  const genFamFn = async () => {
    dispatch({ type: 'SET', payload: { genFam: true } });
    try {
      await generateFamilyRelationships({ registry_id: s.reg?.id });
      fetchFamily();
      toast('Family tree generated', 'success');
    } catch (err) {
      dispatch({ type: 'SET', payload: { genFam: false } });
      toast(err.message || 'Family generation failed', 'error');
    }
  };

  const updateFamRole = async (id, fields) => {
    try {
      await updateRelationshipFamilyRole(id, fields);
      fetchFamily();
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  const updateRel = async (id, fields) => {
    try {
      await updateRelationshipFields(id, fields);
      dispatch({ type: 'UPDATE_REL', id, fields });
      toast('Updated', 'success');
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────── */
  const layerMap = useMemo(() => {
    const m = {};
    Object.entries(s.layers).forEach(([lk, cs]) => cs.forEach(c => { m[c.id] = lk; }));
    return m;
  }, [s.layers]);

  const filtChars = useMemo(() => {
    let list = s.lf === 'all' ? s.chars : s.chars.filter(c => clayer(c) === s.lf);
    if (charSearch.trim()) {
      const q = charSearch.toLowerCase();
      list = list.filter(c => cname(c).toLowerCase().includes(q) || (c.role_type || '').toLowerCase().includes(q));
    }
    return list;
  }, [s.chars, s.lf, charSearch]);
  const filtRels = useMemo(() => {
    if (s.lf === 'all') return s.rels;
    const ids = new Set(filtChars.map(c => c.id));
    return s.rels.filter(r => ids.has(r.character_id_a) || ids.has(r.character_id_b));
  }, [s.rels, s.lf, filtChars]);

  /* ── Export relationships as JSON ────────────────────────────────────── */
  const exportRelationships = useCallback(() => {
    const data = {
      registry: s.reg?.name || s.reg?.id || 'unknown',
      exported_at: new Date().toISOString(),
      characters: s.chars.map(c => ({ id: c.id, name: cname(c), role_type: c.role_type, layer: clayer(c) })),
      relationships: s.rels.map(r => ({ id: r.id, character_a: r.character_id_a, character_b: r.character_id_b, type: r.relationship_type, subtype: r.subtype, tension: r.tension_level, description: r.description })),
      stats: { characters: s.chars.length, relationships: s.rels.length, pending_seeds: s.cands.length },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relationships-${s.reg?.id?.slice(0, 8) || 'export'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Relationships exported', 'success');
  }, [s.chars, s.rels, s.cands, s.reg, toast]);

  /* ── Relationship type distribution ────────────────────────────────── */
  const relStats = useMemo(() => {
    const byType = {};
    s.rels.forEach(r => { byType[r.relationship_type || 'unknown'] = (byType[r.relationship_type || 'unknown'] || 0) + 1; });
    return byType;
  }, [s.rels]);

  const tabs = [
    { key: 'tree',       label: 'Tree',       icon: '◇' },
    { key: 'family',     label: 'Family',     icon: '⬡' },
    { key: 'web',        label: 'Web',        icon: '◎' },
    { key: 'candidates', label: 'Seeds',      icon: '◈', badge: s.cands.length || null },
    { key: 'list',       label: 'List',        icon: '≡' },
  ];

  const subline =
    s.tab === 'candidates' ? `${s.cands.length} pending` :
    s.tab === 'family'     ? `${s.famData?.family_bonds?.length || 0} bonds` :
    `${filtChars.length} characters · ${filtRels.length} relationships`;

  /* ── Error state (retry-able) ──────────────────────────────────────── */
  if (s.error && !s.loading) {
    return (
      <div className="re-shell" role="alert">
        <div className="re-error-page">
          <div className="re-error-icon">⚠</div>
          <div className="re-error-title">Something went wrong</div>
          <div className="re-error-msg">{s.error}</div>
          <Btn variant="primary" onClick={fetchTree}>Retry</Btn>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="re-shell">
      {/* toast tray */}
      <div className="re-toast-tray" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`cg-toast is-${t.type}`} role="status">{t.msg}</div>
        ))}
      </div>

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <header className="re-header" role="banner">
        <div className="re-header-left">
          <span className="re-wordmark">Relationship Engine</span>
          <span className="re-badge">v2</span>
        </div>

        {/* tab rail */}
        <nav className="re-tab-rail" role="tablist" aria-label="View tabs">
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={s.tab === t.key}
              className={`cg-tab-btn ${s.tab === t.key ? 'is-active' : ''}`}
              onClick={() => dispatch({ type: 'SET', payload: { tab: t.key } })}>
              <span>{t.icon}</span> {t.label}
              {t.badge && <span className="cg-tab-count">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="re-header-actions">
          <Btn variant="ghost" onClick={exportRelationships} title="Export relationships as JSON">↓ Export</Btn>
          <Btn variant="outline" onClick={() => dispatch({ type: 'SET', payload: { genOpen: true } })}>◈ Generate</Btn>
          <Btn variant="primary" onClick={() => dispatch({ type: 'SET', payload: { addOpen: true } })}>+ Add</Btn>
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
            <button onClick={() => setAutoSuggestions(null)}
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
        {s.tab !== 'web' && (
          <aside className="re-sidebar" role="navigation" aria-label="Characters">
            {/* search */}
            <div className="re-sidebar-section" style={{ padding: '0 12px 8px' }}>
              <input
                value={charSearch}
                onChange={e => setCharSearch(e.target.value)}
                placeholder="Search characters…"
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 12,
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  background: T.surface, color: T.text, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* layer filter */}
            <div className="re-sidebar-section">
              <div className="re-label">Layers</div>
              <LFBtn active={s.lf === 'all'} onClick={() => dispatch({ type: 'SET', payload: { lf: 'all' } })} count={s.chars.length}>
                All Characters
              </LFBtn>
              {Object.entries(LAYER).map(([k, v]) => (
                <LFBtn key={k} active={s.lf === k}
                  onClick={() => dispatch({ type: 'SET', payload: { lf: k } })}
                  count={(s.layers[k] || []).length} dot={v.color}>
                  {v.label}
                </LFBtn>
              ))}
            </div>
            <div className="re-sidebar-divider" />
            {/* character list */}
            <div className="re-sidebar-chars">
              {filtChars.length === 0 && (
                <div className="re-sidebar-empty">No characters in this layer</div>
              )}
              {filtChars.map(c => {
                const lk = layerMap[c.id];
                const lc = lk && LAYER[lk];
                const rc = roleColor(c.role_type);
                const act = s.selChar?.id === c.id;
                return (
                  <button key={c.id}
                    className={`cg-world-card ${act ? 'is-active' : ''}`}
                    onClick={() => {
                      dispatch({ type: 'SET', payload: { selChar: s.selChar?.id === c.id ? null : c, selRel: null, panel: false } });
                    }}
                    aria-pressed={act}
                    aria-label={`${cname(c)}, ${c.role_type || 'unknown role'}`}>
                    <div className="re-char-avatar" style={{ borderColor: act ? rc : undefined, color: rc, background: act ? rc + '18' : undefined }}>
                      {initials(cname(c))}
                    </div>
                    <div className="re-char-info">
                      <div className="re-char-name">{cname(c)}</div>
                      <div className="re-char-role">{c.role_type || '—'}</div>
                    </div>
                    {lc && <span className="re-char-layer-dot" style={{ background: lc.color }} />}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* CENTER CANVAS */}
        <main className="re-canvas" role="main">
          {/* sub-header */}
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
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginRight: 8 }}>
                  {Object.entries(relStats).slice(0, 5).map(([type, count]) => (
                    <span key={type} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      background: `${T.accent}15`, color: T.accent,
                      fontWeight: 600, whiteSpace: 'nowrap',
                    }}>{type} ({count})</span>
                  ))}
                </div>
              )}
              {s.tab === 'candidates' && s.cands.length > 0 && (
                <Btn variant="ghost" onClick={() => dispatch({ type: 'SET', payload: { genOpen: true } })}>◈ Regenerate</Btn>
              )}
              {s.tab === 'family' && (
                <Btn variant="ghost" onClick={genFamFn} disabled={s.genFam}>
                  {s.genFam ? 'Generating…' : '⬡ Auto-Generate Family'}
                </Btn>
              )}
            </div>
          </div>

          {/* view */}
          <div className="re-view">
            {s.tab === 'web'        ? <WebView navigate={navigate} /> :
             s.loading              ? <Spinner /> :
             s.tab === 'tree'       ? <TreeView chars={filtChars} rels={filtRels} layers={s.layers} lf={s.lf} selChar={s.selChar} onRelClick={r => dispatch({ type: 'SET', payload: { selRel: r, panel: true } })} onCharClick={c => dispatch({ type: 'SET', payload: { selChar: c } })} /> :
             s.tab === 'family'     ? <FamilyView data={s.famData} genning={s.genFam} onGenerate={genFamFn} onUpdateRole={updateFamRole} onRelClick={r => dispatch({ type: 'SET', payload: { selRel: r, panel: true } })} /> :
             s.tab === 'candidates' ? <CandidateView cands={s.cands} onConfirm={confirm} onDismiss={dismiss} busy={!!s.busy} /> :
                                      <ListView rels={filtRels} onSelect={r => dispatch({ type: 'SET', payload: { selRel: r, panel: true } })} />
            }
          </div>
        </main>

        {/* RIGHT INSPECTOR */}
        {s.tab !== 'web' && (
          <aside className="re-inspector-panel">
            {s.panel && s.selRel
              ? <Inspector rel={s.selRel}
                  onClose={() => dispatch({ type: 'SET', payload: { panel: false, selRel: null } })}
                  onUpdate={u => updateRel(s.selRel.id, u)}
                  onDelete={() => del(s.selRel.id)} />
              : (
                <div className="re-inspector-empty">
                  <div className="re-inspector-empty-icon">◈</div>
                  <div className="re-inspector-empty-title">Select a relationship</div>
                  <div className="re-inspector-empty-desc">
                    Click any edge in the tree or any row in the list to inspect it here
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
