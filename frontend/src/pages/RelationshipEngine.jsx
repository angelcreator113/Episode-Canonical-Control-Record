/**
 * RelationshipEngine.jsx — the Relationships page: the cast, their
 * relationships and the seeds, in six tabs.
 * Prime Studios · LalaVerse
 * Palette: the house tokens (--lala-parchment, --lala-gold, --lala-ink; Lora
 * headings, DM Mono labels); rose, steel and orchid only carry meaning.
 */
import { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, GitBranch, Users, Share2, Sprout, List, Search } from 'lucide-react';
import apiClient from '../services/api';
import { findLala } from '../lib/theCast';
import './RelationshipEngine.css';

import {
  WebView, TreeView, FamilyView, CandidateView, ListView, ProfileView,
  Inspector, AddModal, GenModal, PulseStrip, pulseSeedsFor, pulseSeed, TypeTidyDialog, TypeTidyBanner,
  Btn, Spinner, useToast, useIsPhone,
  API, cname, initials, roleColor, roleLabel, sideName, typeLabel, humanize, isFamily,
} from '../components/RelationshipEngine';

/* ── API helpers ─────────────────────────────────────────────────────── */
// The page's people and pairs in one read (GET /relationships/cast): the
// cast across every registry holding them (registry characters a live
// LalaVerse feed profile names, and Lala; Evoni, 2026-10-16), their
// confirmed relationships and the seeds still pending. Every tab draws
// these same pairs.
export const fetchCast = () =>
  apiClient.get(`${API}/relationships/cast`);
// A seed's Confirm can carry the Inspector's edits (the seeds contract):
// they are applied, then it is confirmed, in one step.
export const confirmRelationship = (id, fields) => (fields
  ? apiClient.post(`${API}/relationships/confirm/${id}`, fields)
  : apiClient.post(`${API}/relationships/confirm/${id}`));
export const confirmAllSeeds = (ids) =>
  apiClient.post(`${API}/relationships/confirm-all`, { ids });
// "Keep as idea" ('kept') and its Bring back (null).
export const setSeedState = (id, state) =>
  apiClient.post(`${API}/relationships/${id}/seed-state`, { state });
// The server's methods (Task #3119): dismiss is a DELETE, both edits are PUTs.
// A reason rides in the DELETE's body; "too_soon" keeps the seed, under Later.
export const dismissRelationship = (id, reason) => (reason
  ? apiClient.delete(`${API}/relationships/dismiss/${id}`, { data: reason })
  : apiClient.delete(`${API}/relationships/dismiss/${id}`));
// Suggestions from elsewhere (a scene, the Pulse) put into Seeds.
export const addSeeds = (source, seeds) =>
  apiClient.post(`${API}/relationships/seeds`, { source, seeds });
// The one-time type tidy-up (Evoni, 2026-10-24): what needs a look, and the
// changes she accepted.
export const fetchTypeTidy = () =>
  apiClient.get(`${API}/relationships/type-tidy`);
export const saveTypeTidy = (changes) =>
  apiClient.post(`${API}/relationships/type-tidy`, { changes });
export const fetchPulseSuggestions = () =>
  apiClient.get(`${API}/feed-relationships/suggestions`);
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
// For a deep link to someone outside the cast: the relationship with its two
// people, or the person with their relationships.
export const fetchRelationship = (id) =>
  apiClient.get(`${API}/relationships/${id}`);
export const fetchPerson = (id) =>
  apiClient.get(`${API}/relationships/person/${id}`);

/** The server's reason for a failed call ({ error } or { message }), else the client's, else the fallback. */
export const errText = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

/** New seeds join the pending list (newest first), each once. */
export function mergeSeeds(current, fresh) {
  const ids = new Set((fresh || []).map(c => c.id));
  return [...(fresh || []), ...(current || []).filter(c => !ids.has(c.id))];
}

/**
 * A scene's suggestions (Story Evaluation's revelations: pairs of character
 * keys and what they share) as POST /seeds seeds; a key not in the cast is
 * counted, not sent. The type is a plain "friend" (one of the app's types):
 * the scene says they are linked, not how; Confirm is where Evoni names it.
 */
export function sceneSeeds(suggestions, chars, fromScene = 'Scene') {
  const byKey = new Map();
  for (const c of chars || []) {
    if (c?.character_key) byKey.set(String(c.character_key).toLowerCase(), c);
  }
  const find = k => {
    const w = String(k || '').trim().toLowerCase();
    return byKey.get(w) || (chars || []).find(c => cname(c).toLowerCase() === w) || null;
  };
  const seeds = [];
  let missing = 0;
  for (const sug of suggestions || []) {
    const a = find(sug?.pair?.[0]);
    const b = find(sug?.pair?.[1]);
    if (!a || !b || a.id === b.id) { missing += 1; continue; }
    const dims = (sug.sharedDimensions || []).map(d => String(d).replace(/_/g, ' '));
    const why = `In "${fromScene}" both changed in ${dims.join(', ') || 'the same scene'}.`;
    seeds.push({
      character_id_a: a.id, character_id_b: b.id, relationship_type: 'friend', is_romantic: false,
      situation: why, seed_why: why.slice(0, 140),
      seed_basis: { facts: [`Scene: ${fromScene}`, ...(sug.signal ? [`${sug.signal} signal`] : [])] },
    });
  }
  return { seeds, missing };
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
  seedMode: false,      // the Inspector shows a seed, to confirm with edits
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
    // Seeds merge into the list as it is now: one dismissed or confirmed
    // while a generator ran stays gone.
    case 'MERGE_SEEDS':  return { ...state, ...action.payload, cands: mergeSeeds(state.cands, action.fresh) };
    // People from a deep link outside the cast, and their relationships, join the page.
    case 'ADD_PEOPLE': {
      const known = new Set(state.chars.map(c => c.id));
      const relIds = new Set((action.rels || []).map(r => r.id));
      return {
        ...state, ...action.payload,
        chars: [...state.chars, ...(action.chars || []).filter(c => c && !known.has(c.id))],
        rels: [...(action.rels || []), ...state.rels.filter(r => !relIds.has(r.id))].sort(byNewest),
      };
    }
    case 'REMOVE_CAND':  return { ...state, cands: state.cands.filter(c => c.id !== action.id), busy: null };
    case 'REMOVE_CANDS': {
      const gone = new Set(action.ids);
      return { ...state, cands: state.cands.filter(c => !gone.has(c.id)), busy: null };
    }
    // Keep as idea, Later and Bring back change a seed's place, not the list.
    case 'UPDATE_CAND':  return { ...state, cands: state.cands.map(c => (c.id === action.id ? { ...c, ...action.fields } : c)), busy: null };
    // An undone dismiss: the seed back at the top, once.
    case 'ADD_CAND':     return { ...state, cands: [action.cand, ...state.cands.filter(c => c.id !== action.cand.id)] };
    case 'ADD_REL':      return { ...state, rels: [action.rel, ...state.rels.filter(r => r.id !== action.rel.id)].sort(byNewest), addOpen: false };
    case 'UPDATE_REL': {
      const updated = state.rels.map(r => r.id === action.id ? { ...r, ...action.fields } : r);
      return { ...state, rels: updated, selRel: state.selRel?.id === action.id ? { ...state.selRel, ...action.fields } : state.selRel };
    }
    case 'DELETE_REL':   return { ...state, rels: state.rels.filter(r => r.id !== action.id), selRel: null, panel: false, busy: null };
    // Switching tab closes the Inspector (it belonged to the last view).
    case 'TAB':          return { ...state, tab: action.tab, panel: false, selRel: null, seedMode: false };
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
  const [sceneBusy, setSceneBusy] = useState(false);
  // The Pulse's suggested pairs (read once, on the first visit to Seeds).
  const [pulsePairs, setPulsePairs] = useState(null);
  const [pulseBusy, setPulseBusy] = useState(null);
  // Types the app doesn't know: the items, the dialog, its last refusals.
  const [tidy, setTidy] = useState({ items: [], open: false, saving: false, refused: [] });
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
  // The link's tab and selection arrive with the cast, in one render: a
  // separate step after it showed the Overview first, for a moment.
  const searchRef = useRef(location.search);
  searchRef.current = location.search;
  // quiet: a refresh after a confirm, with no spinner in place of the view
  // (Confirm all's result stays on screen).
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) dispatch({ type: 'SET', payload: { loading: true, error: null } });
    try {
      const { data } = await fetchCast();
      const loaded = {
        chars:  data?.characters || [],
        rels:   data?.relationships || [],
        cands:  data?.candidates || [],
        lalaId: data?.lala_id || null,
      };
      dispatch({
        type: 'LOADED',
        payload: { ...loaded, ...(deepLinkState(searchRef.current, loaded) || {}) },
      });
    } catch (err) {
      console.error('[RelationshipEngine] load failed:', err);
      // A quiet refresh keeps the page as it is (the change itself was saved).
      if (quiet) return;
      // The server's reason when it gave one; otherwise a plain sentence (the
      // raw error, e.g. "Network Error", is in the console).
      dispatch({ type: 'ERROR', msg: err?.response?.data?.error || err?.response?.data?.message || "Could not load the people in Lala's world. Check your connection and try again." });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The tidy-up list: quiet, and nothing shows when it is empty or fails.
  const loadTidy = useCallback(async () => {
    try {
      const r = await fetchTypeTidy();
      const items = Array.isArray(r?.data?.items) ? r.data.items : [];
      setTidy(t => ({ ...t, items }));
      return items;
    } catch (err) {
      console.error('[RelationshipEngine] type tidy-up not loaded:', err?.response?.status || err?.message);
      return null;
    }
  }, []);
  useEffect(() => { loadTidy(); }, [loadTidy]);

  const saveTidy = async changes => {
    setTidy(t => ({ ...t, saving: true }));
    try {
      const r = await saveTypeTidy(changes);
      const updated = r.data?.updated || [];
      const refused = r.data?.refused || [];
      await loadTidy();
      load({ quiet: true });
      setTidy(t => ({ ...t, saving: false, refused, open: refused.length > 0 }));
      toast(`${updated.length} type${updated.length === 1 ? '' : 's'} tidied${refused.length ? `, ${refused.length} not` : ''}`, refused.length ? 'info' : 'success');
    } catch (err) {
      console.error('[RelationshipEngine] type tidy-up not saved:', err);
      setTidy(t => ({ ...t, saving: false }));
      toast(errText(err, 'The types could not be saved'), 'error');
    }
  };

  /* ── Deep links: ?char= selects a person, ?rel= opens a relationship ── */
  useEffect(() => {
    if (!s.loaded) return;
    const next = deepLinkState(location.search, { chars: s.chars, rels: s.rels });
    if (next) dispatch({ type: 'SET', payload: next });
    // The character page links to anyone; someone outside the cast is
    // fetched and added, so the link opens them instead of nothing.
    const q = new URLSearchParams(location.search || '');
    const relId = q.get('rel');
    const charId = q.get('char');
    if (relId && !s.rels.some(r => String(r.id) === relId)) {
      fetchRelationship(relId)
        .then(({ data }) => dispatch({ type: 'ADD_PEOPLE', chars: data?.characters, rels: [data.relationship], payload: { selRel: data.relationship, panel: true } }))
        .catch(err => {
          console.error('[RelationshipEngine] deep-linked relationship not loaded:', err);
          toast(err?.response?.status === 404 ? "That relationship was deleted or isn't confirmed" : errText(err, 'Could not open that relationship'), 'error');
        });
    } else if (charId && !s.chars.some(c => String(c.id) === charId)) {
      fetchPerson(charId)
        .then(({ data }) => dispatch({ type: 'ADD_PEOPLE', chars: data?.characters, rels: data?.relationships, payload: { selChar: data.character } }))
        .catch(err => {
          console.error('[RelationshipEngine] deep-linked person not loaded:', err);
          toast(err?.response?.status === 404 ? "That person was deleted or isn't a character" : errText(err, 'Could not open that person'), 'error');
        });
    }
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
      load({ quiet: true });
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Confirm failed'), 'error');
    }
  };

  // Confirm from the Inspector (seedMode): the edited fields, then confirmed.
  const confirmSeed = async (seed, fields) => {
    dispatch({ type: 'SET', payload: { busy: seed.id } });
    try {
      await confirmRelationship(seed.id, fields);
      dispatch({ type: 'REMOVE_CAND', id: seed.id });
      dispatch({ type: 'SET', payload: { panel: false, selRel: null, seedMode: false } });
      toast(`Confirmed ${sideName(seed, 'a', charById)} and ${sideName(seed, 'b', charById)}`, 'success');
      load({ quiet: true });
    } catch (err) {
      console.error('[RelationshipEngine] confirm with edits failed:', err);
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Confirm failed'), 'error');
    }
  };

  // Confirm all: each as it is; the refused stay pending, with the reason.
  const confirmAll = async ids => {
    dispatch({ type: 'SET', payload: { busy: 'all' } });
    try {
      const r = await confirmAllSeeds(ids);
      const confirmed = r.data?.confirmed || [];
      const refused = r.data?.refused || [];
      dispatch({ type: 'REMOVE_CANDS', ids: confirmed.map(c => c.id) });
      toast(`${confirmed.length} confirmed${refused.length ? `, ${refused.length} not` : ''}`, refused.length ? 'info' : 'success');
      if (confirmed.length) load({ quiet: true });
      return { confirmed, refused };
    } catch (err) {
      console.error('[RelationshipEngine] confirm all failed:', err);
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Confirm all failed'), 'error');
      return null;
    }
  };

  const keepIdea = async id => {
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      const r = await setSeedState(id, 'kept');
      dispatch({ type: 'UPDATE_CAND', id, fields: { ...(r.data?.relationship || {}), seed_state: 'kept' } });
      toast('Kept as an idea, under Kept ideas', 'success');
    } catch (err) {
      console.error('[RelationshipEngine] keep as idea failed:', err);
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Could not keep it'), 'error');
    }
  };

  // Bring back: a kept idea through seed-state, a "too soon" one through restore.
  const bringBack = async seed => {
    dispatch({ type: 'SET', payload: { busy: seed.id } });
    try {
      const r = seed.seed_state === 'later' ? await restoreRelationship(seed.id) : await setSeedState(seed.id, null);
      dispatch({ type: 'UPDATE_CAND', id: seed.id, fields: { ...(r.data?.relationship || {}), seed_state: null, dismiss_reason: null, dismiss_note: null } });
      toast('Back with the pending seeds', 'success');
    } catch (err) {
      console.error('[RelationshipEngine] bring back failed:', err);
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Could not bring it back'), 'error');
    }
  };

  // A seed's dismiss only marks it deleted (like Delete), so it can come back.
  const undoDismiss = async seed => {
    try {
      const r = await restoreRelationship(seed.id);
      dispatch({ type: 'ADD_CAND', cand: { ...seed, ...(r.data?.relationship || {}), seed_state: null, dismiss_reason: null, dismiss_note: null } });
      toast('Seed restored', 'success');
    } catch (err) {
      console.error('[RelationshipEngine] seed restore failed:', err);
      toast(err.message || 'Undo failed', 'error');
    }
  };

  // With a reason (the card's picker): "too soon" moves it to Later; any
  // other dismisses it, with Undo.
  const dismiss = async (id, reason = null, note = null) => {
    const seed = s.cands.find(c => c.id === id);
    dispatch({ type: 'SET', payload: { busy: id } });
    try {
      const r = await dismissRelationship(id, reason ? { reason, ...(note ? { note } : {}) } : null);
      if (r?.data?.later) {
        dispatch({ type: 'UPDATE_CAND', id, fields: { ...(r.data.relationship || {}), seed_state: 'later', dismiss_reason: 'too_soon', dismiss_note: note } });
        toast('Moved to Later, to bring back when the story is ready', 'success');
        return;
      }
      dispatch({ type: 'REMOVE_CAND', id });
      toast(seed ? `Dismissed ${sideName(seed, 'a', charById)} and ${sideName(seed, 'b', charById)}` : 'Seed dismissed', 'info',
        seed ? { label: 'Undo', run: () => undoDismiss(seed) } : null);
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Dismiss failed'), 'error');
    }
  };

  const undoDelete = async rel => {
    try {
      const r = await restoreRelationship(rel.id);
      dispatch({ type: 'ADD_REL', rel: r.data?.relationship || rel });
      toast('Relationship restored', 'success');
    } catch (err) {
      toast(errText(err, 'Undo failed'), 'error');
    }
  };

  // The Inspector asks first; the row is only marked deleted, so Undo works.
  const del = async rel => {
    dispatch({ type: 'SET', payload: { busy: rel.id } });
    try {
      const r = await deleteRelationship(rel.id);
      dispatch({ type: 'DELETE_REL', id: rel.id });
      // Their Pulse pair stays (the drift list offers to take it off).
      const kept = r?.data?.pulse_kept?.length ? ' Their Pulse pair stays: "Where relationships disagree" on the Pulse map can take it off.' : '';
      toast(`Deleted ${sideName(rel, 'a', charById)} and ${sideName(rel, 'b', charById)}.${kept}`, 'info', { label: 'Undo', run: () => undoDelete(rel) });
    } catch (err) {
      dispatch({ type: 'SET', payload: { busy: null } });
      toast(errText(err, 'Delete failed'), 'error');
    }
  };

  // body: the dialog's aim (GenModal generateBody: kind, count, focus, episode, twist).
  const generate = async body => {
    dispatch({ type: 'SET', payload: { genning: true } });
    try {
      const r = await generateRelationships(body);
      const d = r.data;
      const fresh = d.candidates || [];
      dispatch({ type: 'MERGE_SEEDS', fresh, payload: { genning: false, genOpen: false, tab: 'candidates', panel: false, selRel: null } });
      toast(fresh.length ? `${fresh.length} new seed${fresh.length === 1 ? '' : 's'} added` : 'No new seeds this time', 'success');
    } catch (err) {
      dispatch({ type: 'SET', payload: { genning: false } });
      toast(errText(err, 'Generation failed'), 'error');
    }
  };

  // The scene banner's "Add all to Seeds": its pairs stay, as seeds.
  const addSceneSeeds = async () => {
    const { seeds, missing } = sceneSeeds(autoSuggestions?.suggestions, s.chars, autoSuggestions?.fromScene);
    if (!seeds.length) { toast("None of these people are in the cast, so there is nothing to add", 'error'); return; }
    setSceneBusy(true);
    try {
      const r = await addSeeds('scene', seeds);
      const fresh = r.data?.candidates || [];
      const skipped = (r.data?.skipped || []).length;
      dispatch({ type: 'MERGE_SEEDS', fresh, payload: {} });
      setAutoSuggestions(null);
      const extra = [skipped && `${skipped} already there`, missing && `${missing} not in the cast`].filter(Boolean).join(', ');
      toast(`${fresh.length} added to Seeds${extra ? ` (${extra})` : ''}`, 'success',
        s.tab !== 'candidates' ? { label: 'Open Seeds', run: () => dispatch({ type: 'TAB', tab: 'candidates' }) } : null);
    } catch (err) {
      console.error('[RelationshipEngine] scene seeds not added:', err);
      toast(errText(err, 'Could not add them to Seeds'), 'error');
    } finally {
      setSceneBusy(false);
    }
  };

  // One Pulse pair into Seeds; it leaves the strip either way (added, or
  // the server already had the pair).
  const addPulse = async p => {
    setPulseBusy(p.key);
    try {
      const r = await addSeeds('pulse', [pulseSeed(p)]);
      const fresh = r.data?.candidates || [];
      dispatch({ type: 'MERGE_SEEDS', fresh, payload: {} });
      setPulsePairs(list => (list || []).filter(x => x.key !== p.key));
      toast(fresh.length ? 'Added to Seeds' : 'Already in Seeds or a relationship', fresh.length ? 'success' : 'info');
    } catch (err) {
      console.error('[RelationshipEngine] Pulse pair not added:', err);
      toast(errText(err, 'Could not add it to Seeds'), 'error');
    } finally {
      setPulseBusy(null);
    }
  };

  useEffect(() => {
    if (!s.loaded || s.tab !== 'candidates' || pulsePairs !== null) return;
    let gone = false;
    fetchPulseSuggestions()
      .then(r => { if (!gone) setPulsePairs(Array.isArray(r?.data?.pairs) ? r.data.pairs : []); })
      .catch(err => {
        // The strip is extra: without it the Seeds tab still works.
        console.error('[RelationshipEngine] Pulse suggestions not loaded:', err?.response?.status || err?.message);
        if (!gone) setPulsePairs([]);
      });
    return () => { gone = true; };
  }, [s.loaded, s.tab, pulsePairs]);

  const addRel = async f => {
    try {
      const r = await createRelationship(f);
      const d = r.data;
      dispatch({ type: 'ADD_REL', rel: d.relationship || d });
      // A family type is saved as a family tie (it is on the Family tab).
      toast(d.family ? 'Family tie added' : 'Relationship added', 'success',
        d.family ? { label: 'Open Family', run: () => dispatch({ type: 'TAB', tab: 'family' }) } : null);
    } catch (err) {
      toast(errText(err, 'Add failed'), 'error');
    }
  };

  // Family proposals arrive as seeds, to confirm on the Seeds tab.
  const genFamFn = async () => {
    dispatch({ type: 'SET', payload: { genFam: true } });
    try {
      const r = await generateFamilyRelationships({});
      const fresh = r.data?.family_bonds || [];
      dispatch({ type: 'MERGE_SEEDS', fresh, payload: { genFam: false } });
      toast(fresh.length ? `${fresh.length} family seed${fresh.length === 1 ? '' : 's'} to confirm` : 'No new family proposed', 'success',
        fresh.length ? { label: 'Open Seeds', run: () => dispatch({ type: 'TAB', tab: 'candidates' }) } : null);
    } catch (err) {
      dispatch({ type: 'SET', payload: { genFam: false } });
      toast(errText(err, 'Family generation failed'), 'error');
    }
  };

  const updateFamRole = async (id, fields) => {
    try {
      const r = await updateRelationshipFamilyRole(id, fields);
      dispatch({ type: 'UPDATE_REL', id, fields: r.data?.relationship || fields });
    } catch (err) {
      toast(errText(err, 'Update failed'), 'error');
    }
  };

  const updateRel = async (id, fields) => {
    try {
      const r = await updateRelationshipFields(id, fields);
      dispatch({ type: 'UPDATE_REL', id, fields: r.data?.relationship || fields });
      toast('Updated', 'success');
    } catch (err) {
      toast(errText(err, 'Update failed'), 'error');
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
      stats: { characters: s.chars.length, relationships: s.rels.length, pending_seeds: s.cands.filter(c => !c.seed_state).length },
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

  // Kept ideas and Later wait in folds; the count is the pending ones.
  const pendingCount = s.cands.filter(c => !c.seed_state).length;
  const pulseShown = useMemo(
    () => pulseSeedsFor(pulsePairs, s.chars, [...s.cands, ...s.rels]),
    [pulsePairs, s.chars, s.cands, s.rels],
  );

  const tabs = [
    { key: 'overview',   label: 'Overview',   Icon: House },
    { key: 'tree',       label: 'Tree',       Icon: GitBranch },
    { key: 'family',     label: 'Family',     Icon: Users },
    { key: 'web',        label: 'Web',        Icon: Share2 },
    { key: 'candidates', label: 'Seeds',      Icon: Sprout, badge: pendingCount || null },
    { key: 'list',       label: 'List',       Icon: List },
  ];
  const setTab = tab => dispatch({ type: 'TAB', tab });
  const openRel = r => dispatch({ type: 'SET', payload: { selRel: r, panel: true, seedMode: false } });
  const closeRel = useCallback(() => dispatch({ type: 'SET', payload: { panel: false, selRel: null, seedMode: false } }), []);
  // A seed's Confirm: the Inspector, open on its editor.
  const openSeed = seed => dispatch({ type: 'SET', payload: { selRel: seed, panel: true, seedMode: true } });
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

  // The Family tab's own rule and list (tokens' isFamily; spouses are romance).
  const familyCount = filtRels.filter(isFamily).length;
  // The counts live here, once (the Web's own bar already counts its graph).
  const subline =
    s.tab === 'candidates' ? `${pendingCount} pending` :
    s.tab === 'family'     ? `${familyCount} bond${familyCount === 1 ? '' : 's'}` :
    s.tab === 'web'        ? '' :
    `${filtChars.length} people · ${filtRels.length} relationships`;
  const failed = !!s.error && !s.loading;

  // The Inspector shows only with a relationship open: no empty placeholder
  // panel beside the views (2026-10-24 layout audit).
  const showPanel = s.panel && !!s.selRel;

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
            <option value="all">{s.loaded ? `All Types (${s.chars.length})` : 'All Types'}</option>
            {roleTypes.map(([k, n]) => (
              <option key={k} value={k}>{humanize(k)} ({n})</option>
            ))}
          </select>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      {/* A scene's suggestions (Story Evaluation): Add all puts them in Seeds, so they stay */}
      {autoSuggestions && (
        <section className="re-scene-banner" aria-label="Suggestions from a scene">
          <div className="re-scene-head">
            <div className="re-scene-title">
              ◈ Relationship Suggestions from &ldquo;{autoSuggestions.fromScene}&rdquo;
            </div>
            <div className="re-scene-tools">
              <Btn variant="primary" onClick={addSceneSeeds} disabled={sceneBusy}>
                {sceneBusy ? 'Adding…' : 'Add all to Seeds'}
              </Btn>
              <button type="button" className="re-close-btn" onClick={() => setAutoSuggestions(null)} aria-label="Close suggestions">×</button>
            </div>
          </div>
          <ul className="re-scene-list">
            {autoSuggestions.suggestions.map((sug, i) => (
              <li key={i} className={`re-scene-sug is-${sug.signal || 'weak'}`}>
                <div className="re-scene-pair">{sug.pair[0]} ↔ {sug.pair[1]}</div>
                <div className="re-scene-dims">
                  {(sug.sharedDimensions || []).map(d => d.replace(/_/g, ' ')).join(', ')}
                </div>
                <span className="re-scene-signal">{sug.signal} signal</span>
              </li>
            ))}
          </ul>
        </section>
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
          {s.tab !== 'web' && !failed && (
            <>
            <div className="re-sidebar-divider" />
            <div className="re-label re-sidebar-heading">People</div>
            {/* character list: a column on a desktop, a chip strip on a phone */}
            <div className="re-sidebar-chars" role="group" aria-label="People">
              {s.loading && !s.loaded && (
                <div className="re-sidebar-empty" role="status">Loading people…</div>
              )}
              {s.loaded && filtChars.length === 0 && (
                <div className="re-sidebar-empty">No one matches</div>
              )}
              {filtChars.map(c => {
                const rc = roleColor(c.role_type);
                const act = (s.tab === 'overview' ? profileChar?.id : s.selChar?.id) === c.id;
                const role = roleLabel(c, lala?.id);
                return (
                  <button key={c.id}
                    className={`cg-world-card ${act ? 'is-active' : ''}`}
                    onClick={() => pickChar(c)}
                    aria-pressed={act}
                    aria-label={`${cname(c)}, ${role === '—' ? 'unknown role' : role.toLowerCase()}`}>
                    <div className="re-char-avatar" style={{ borderColor: act ? rc : undefined, color: rc, background: act ? rc + '18' : undefined }}>
                      {initials(cname(c))}
                    </div>
                    <div className="re-char-info">
                      <div className="re-char-name">{cname(c)}</div>
                      <div className="re-char-role">{role}</div>
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
          {s.tab !== 'overview' && !failed && (
          <div className="re-sub-header">
            <div>
              <span className="re-sub-title">
                {{ tree: 'Tree', family: 'Family', web: 'Web', candidates: 'Seeds', list: 'List' }[s.tab]}
              </span>
              {subline && <span className="re-sub-stats">{subline}</span>}
            </div>
            <div className="re-sub-actions">
              {/* the commonest relationship types, as plain words (not filters) */}
              {s.tab !== 'candidates' && s.tab !== 'family' && Object.keys(relStats).length > 0 && (
                <p className="re-type-counts">
                  {Object.entries(relStats).slice(0, 5).map(([type, count]) => `${type} ${count}`).join(' · ')}
                </p>
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

          {!failed && s.loaded && (
            <TypeTidyBanner count={tidy.items.length} onReview={() => setTidy(t => ({ ...t, open: true, refused: [] }))} />
          )}

          {/* view */}
          <div className={`re-view ${failed ? 'is-error' : `${s.tab === 'overview' ? 'is-overview' : ''} is-${s.tab}`}`}>
            {failed                 ? (
                                      <div className="re-error-page" role="alert">
                                        <p className="re-error-msg">{s.error}</p>
                                        <Btn variant="primary" onClick={load}>Retry</Btn>
                                      </div>
                                    ) :
             s.loading              ? <Spinner /> :
             s.tab === 'web'        ? <WebView chars={filtChars} rels={filtRels} lalaId={lala?.id} selectedId={s.selChar?.id ?? null} navigate={navigate} onRelClick={openRel} /> :
             s.tab === 'overview'   ? <ProfileView char={profileChar} chars={s.chars} rels={s.rels} cands={s.cands}
                                        onSelectChar={c => dispatch({ type: 'SET', payload: { selChar: c, selRel: null, panel: false } })}
                                        onRelClick={openRel}
                                        onAdd={() => dispatch({ type: 'SET', payload: { addOpen: true } })}
                                        onGenerate={() => dispatch({ type: 'SET', payload: { genOpen: true } })}
                                        onExport={exportRelationships}
                                        onTab={setTab} /> :
             s.tab === 'tree'       ? <TreeView chars={filtChars} rels={filtRels} lalaId={lala?.id} selChar={s.selChar} onRelClick={openRel} onCharClick={c => dispatch({ type: 'SET', payload: { selChar: c } })} /> :
             s.tab === 'family'     ? <FamilyView chars={filtChars} rels={filtRels} charById={charById} genning={s.genFam} onGenerate={genFamFn} onUpdateRole={updateFamRole} onRelClick={openRel} /> :
             s.tab === 'candidates' ? (
                                      <CandidateView cands={s.cands} charById={charById} busy={!!s.busy}
                                        onConfirm={openSeed} onQuickConfirm={confirm} onKeep={keepIdea}
                                        onDismiss={dismiss} onBringBack={bringBack} onConfirmAll={confirmAll}>
                                        <PulseStrip pairs={pulseShown} busyKey={pulseBusy} onAdd={addPulse} />
                                      </CandidateView>
                                    ) :
                                      <ListView rels={filtRels} charById={charById} onSelect={openRel} />
            }
          </div>
        </main>

        {/* RIGHT INSPECTOR (a bottom sheet up to 900px: phones and tablets) */}
        {showPanel && isPhone && <div className="re-sheet-backdrop" onClick={closeRel} aria-hidden />}
        {showPanel && (
          <aside className={`re-inspector-panel ${isPhone ? 'is-sheet' : ''}`}>
            <Inspector rel={s.selRel} charById={charById} sheet={isPhone}
              seedMode={s.seedMode}
              onConfirm={fields => confirmSeed(s.selRel, fields)}
              confirmBusy={s.seedMode && s.busy === s.selRel.id}
              onClose={closeRel}
              onUpdate={u => updateRel(s.selRel.id, u)}
              onSaved={r => dispatch({ type: 'UPDATE_REL', id: r.id, fields: r })}
              onDelete={() => del(s.selRel)} />
          </aside>
        )}
      </div>

      {/* Modals */}
      {s.addOpen && <AddModal chars={s.chars} rels={s.rels} onAdd={addRel} onClose={() => dispatch({ type: 'SET', payload: { addOpen: false } })} />}
      {tidy.open && (
        <TypeTidyDialog items={tidy.items} refused={tidy.refused} saving={tidy.saving}
          onSave={saveTidy} onClose={() => setTidy(t => ({ ...t, open: false, refused: [] }))} />
      )}
      {s.genOpen && <GenModal chars={s.chars} genning={s.genning} onGenerate={generate} onClose={() => dispatch({ type: 'SET', payload: { genOpen: false } })} />}
    </div>
  );
}
