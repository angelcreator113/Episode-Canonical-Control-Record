/**
 * CharacterProfilePage.jsx — the character page
 *
 * Route: /character/:id
 * Evoni's STUDIO BY SABLE mock (2026-10-08): a header with the character's
 * feed handle, chips and how alive they are, then five tabs. Overview is
 * "Who they are" (editable; Rewrite drafts it from the profile), "Where
 * they show up" (lib/characterPage, from GET /api/v1/cast/characters/:id/
 * appearances), their voice and what is between them and Lala. Inner life
 * is a workspace of five sections (components/InnerLife); Voice & feed the feed
 * profile; Connections and In the world as before.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, ArrowRight, LayoutDashboard, Heart, Mic, Users, Globe2, ImagePlus, Trash2,
  BarChart3, CalendarDays, Download, Link2, MapPin, Palette, Crown, Instagram,
  Quote, Star, TrendingUp, Briefcase, IdCard, Activity, FileText, CirclePlay, Flame,
  Copy, BadgeCheck, Lock, Eye, Smartphone, Plus, ExternalLink, Share2, Search,
  Building2, BookOpen, Radio, Settings as SettingsIcon, AlertTriangle, Archive, RotateCcw, Link as LinkIcon, MessageCircle, UserRound,
} from 'lucide-react';
import Pager, { usePaged } from '../components/Pager/Pager';
import CharacterPlacesTab from '../components/CharacterPlaces/CharacterPlacesTab';
import KnownFor from '../components/Cast/KnownFor';
import CharacterAppearanceTab from '../components/CharacterAppearance/CharacterAppearanceTab';
import PostingSchedule from '../components/PostingSchedule/PostingSchedule';
import PulseTrust from '../components/PulseTrust/PulseTrust';
import CharacterTalkTab from '../components/CharacterTalk/CharacterTalkTab';
import CharacterGalleryTab from '../components/CharacterGallery/CharacterGalleryTab';
import FamilySection from '../components/CharacterFamily/FamilySection';
import PersonPage from '../components/PersonPage/PersonPage';
import { API_URL } from '../config/api';
import InnerLifeWorkspace from '../components/InnerLife/InnerLifeWorkspace';
import { dimensionOf as dimension, dimensionText } from '../lib/innerLifeSections';
import { platformLabel, atHandle, followersOf } from './feed/feedConstants';
import apiClient from '../services/api';
import { ROLE_LABELS } from '../constants/characterConstants';
import { findLala } from '../lib/theCast';
import { setPageTitle, clearPageTitle } from '../lib/pageTitle';
import { DEPTH_STEPS, depthOf, depthStageOf, cityOf, archetypeOf, showUpRows, withLala, voiceOf, DREAM_CITIES, dreamCityOf, eventPurpose } from '../lib/characterPage';
import {
  GROUPS, TENSION, groupOf, closenessOf, nameOf, typeLabel, noteOf, connectionStats, SORTS,
  filterConnections, keyRelationships, connectionHistory, mapPoints,
} from '../lib/characterConnections';
import './CharacterProfilePage.css';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 5 helpers covering 5 fetch sites across /character-registry, /entanglements,
// and /social-profiles. File-local per Track 6 convention.
export const updateCharacterApi = (id, payload) =>
  apiClient.put(`${API_URL}/character-registry/characters/${id}`, payload);
export const getCharacterApi = (id) =>
  apiClient.get(`${API_URL}/character-registry/characters/${id}`);
// The character's confirmed relationships, each naming the other character (Task #3119).
export const getCharacterRelationshipsApi = (id) =>
  apiClient.get(`${API_URL}/relationships/character/${id}`, { params: { confirmed: true } });
export const getCharacterEntanglementsApi = (id) =>
  apiClient.get(`${API_URL}/entanglements/characters/${id}/entanglements`);
// Their places (home, closet, other; #3228) with pictures, and sharing one
// on The Pulse as a draft (castRoutes, services/characterPlaceShare).
// Their Pulse posts, and the short stories and chapters they are in (routes/castRoutes.js).
/**
 * One follower count on the page (the profile audit, 2026-10-19): their
 * facts' count (the follower ledger, as Quick facts shows it), else the
 * profile's stored label.
 */
export const followerLabelOf = (facts, feedProfile) =>
  facts?.followers?.label || (feedProfile ? followersOf(feedProfile) : '') || '';

export const getFactsApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/facts`);
export const putFactsApi = (id, body) =>
  apiClient.put(`${API_URL}/cast/characters/${id}/facts`, body);
export const suggestFactsApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/facts/suggest`);
export const factHistoryApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/facts/history`);
export const pressureTestApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/pressure-test`);
export const getCheckApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/check`);
export const markIntentionalApi = (id, flagId, note) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/intentional`, { flag_id: flagId, note });
export const fixFlagApi = (id, flagId, text) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/fix`, text === undefined ? { flag_id: flagId } : { flag_id: flagId, text });
export const suggestFixesApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/suggest`);
export const rewriteFlagApi = (id, flagId, before, after) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/fix`, { flag_id: flagId, before, after });
export const fixCharacterApi = (id) =>
  apiClient.post(`${API_URL}/cast/consistency/fix-character/${id}`);
export const undoFixApi = (change) =>
  apiClient.post(`${API_URL}/cast/consistency/undo`, { change });
export const unmarkIntentionalApi = (id, flagId) =>
  apiClient.delete(`${API_URL}/cast/characters/${id}/check/intentional/${flagId}`);
export const postIdeasApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/posts/ideas`);
// Settings (step 8): status, keep in the cast, archive, bring back, delete for good.
export const setStatusApi = (id, status) =>
  apiClient.post(`${API_URL}/character-registry/characters/${id}/set-status`, { status });
export const keepApi = (id, kept) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/keep`, { kept });
export const archiveApi = (id) =>
  apiClient.delete(`${API_URL}/character-registry/characters/${id}`);
export const restoreApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/restore`);
export const deleteForGoodApi = (id) =>
  apiClient.delete(`${API_URL}/cast/characters/${id}/permanent`);
export const makeActiveApi = (id) =>
  apiClient.put(`${API_URL}/character-registry/characters/${id}`, { depth_level: 'active' });
export const setRegistryShowApi = (registryId, showId) =>
  apiClient.put(`${API_URL}/character-registry/registries/${registryId}`, { show_id: showId });
export const buildVoiceApi = (id) =>
  apiClient.post(`${API_URL}/pulse-voices/${id}/build`);
// Why their posts are or aren't on The Pulse (Evoni, 2026-10-18).
export const pulseVisibilityApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/pulse-visibility`);
export const generatePostsApi = (id, body) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/posts/generate`, body);
export const getTypologyApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/typology`);
export const putTypologyApi = (id, body) =>
  apiClient.put(`${API_URL}/cast/characters/${id}/typology`, body);
export const suggestTypologyApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/typology/suggest`);
export const getStoryTrailApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/story-trail`);
export const getPlacesApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/places`);
export const sharePlaceApi = (id, sceneSetId) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/places/share`, { scene_set_id: sceneSetId });
export const showSceneSetsApi = (showId) =>
  apiClient.get(`${API_URL}/scene-sets`, { params: { show_id: showId } });
export const linkPlaceApi = (showId, payload) =>
  apiClient.post(`${API_URL}/shows/${showId}/character-places`, payload);
export const updateSocialProfileApi = (profileId, payload) =>
  apiClient.put(`${API_URL}/social-profiles/${profileId}`, payload);
export const getSocialProfileApi = (profileId) =>
  apiClient.get(`${API_URL}/social-profiles/${profileId}`);
// Their profile and cover photos (routes/characterRegistry.js POST/DELETE photo?kind=).
export const uploadPhotoApi = (id, kind, file) => {
  const form = new FormData();
  form.append('image', file);
  return apiClient.post(`${API_URL}/character-registry/characters/${id}/photo?kind=${kind}`, form);
};
export const removePhotoApi = (id, kind) =>
  apiClient.delete(`${API_URL}/character-registry/characters/${id}/photo?kind=${kind}`);
export const getAppearancesApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/appearances`);
// Promote a ghost (a name in their family tree) to a sparked character.
export const promoteGhostApi = (id, ghostName, registryId) =>
  apiClient.post(`${API_URL}/character-generation/promote-ghost/${id}`, { ghost_name: ghostName, registry_id: registryId });
export const draftProseApi = (id) =>
  apiClient.post(`${API_URL}/character-registry/characters/${id}/writer-paragraph/generate`);
// Fills in the missing inner life (want, wound, mask, dilemma, deep profile …);
// no fields means everything missing. Never overwrites what is there.
export const generateInteriorApi = (id, fields) =>
  apiClient.post(`${API_URL}/character-registry/characters/${id}/interior/generate`, fields ? { fields } : {});
// Generate All as a preview (nothing written), then the values kept (step 3).
export const previewInteriorApi = (id) =>
  apiClient.post(`${API_URL}/character-registry/characters/${id}/interior/generate`, { preview: true });
export const applyInteriorApi = (id, values) =>
  apiClient.post(`${API_URL}/character-registry/characters/${id}/interior/apply`, { values });

/* ── Config ──────────────────────────────────────────────────────────────────── */

// Each tab has its own link (?tab=voice), so a tab can be shared or reopened
// (the redesign, Evoni's mocks, 2026-10-18); Overview is the page with no tab.
export const TABS = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  // Evoni, 2026-10-23: "one person page": who they are, their Pulse account,
  // relationships, family and episodes in one place (components/PersonPage).
  { id: 'person',      label: 'Person',       icon: UserRound },
  { id: 'inner',       label: 'Inner Life',   icon: Heart },
  // Evoni, 2026-10-17: how they look, a generator for it, and portraits.
  { id: 'appearance',  label: 'Appearance',   icon: Palette },
  { id: 'voice',       label: 'Voice & Pulse', icon: Mic },
  { id: 'connections', label: 'Connections',  icon: Users },
  { id: 'world',       label: 'In the World', icon: Globe2 },
  // Evoni, 2026-10-17: their home, closet and place of work, and the events they host.
  // Evoni, 2026-10-18: "maybe the gallery and places tab should be one": every
  // picture already linked to them sits under their places.
  { id: 'places',      label: 'Places & Gallery', icon: MapPin },
  // Evoni, 2026-10-18: their episodes, events, posts, stories and chapters in one place.
  { id: 'story',       label: 'Story & Events', icon: CalendarDays },
  // Evoni, 2026-10-18: a confidential session with them, as Dr. Amara Sinclair.
  { id: 'talk',        label: 'Talk',         icon: MessageCircle },
  // Evoni, 2026-10-18: what already works: status, keep, feed profile, export, archive and delete.
  { id: 'settings',    label: 'Settings',     icon: SettingsIcon },
];
const tabOf = (value) => (TABS.some((t) => t.id === value) ? value : 'overview');

// Something is there: non-empty text, a list with items, or an object with a filled value.
function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(hasValue);
  return !!v;
}

// The role as The cast says it: Lala is the Protagonist whatever her stored
// role (Task #3199, lib/theCast), the rest by ROLE_LABELS.
function roleOf(character) {
  if (character.role_label) return character.role_label;
  if (findLala([character])) return ROLE_LABELS.protagonist;
  return ROLE_LABELS[character.role_type] || (character.role_type
    ? character.role_type.charAt(0).toUpperCase() + character.role_type.slice(1) : null);
}

/* ── Empty State ─────────────────────────────────────────────────────────────── */

// `gen` (from useInteriorGenerate) and `fields` make Generate a real button;
// without them the state is only a label (the old Generate was text that did
// nothing). `children` replaces the button, e.g. a link to where it is made.
function EmptyState({ label, gen, fields, children }) {
  const key = fields?.join(',');
  // Only a state with fields has a run of its own: without them the key is
  // undefined, and undefined === undefined would read another run's note.
  const busy = !!(gen && key && gen.busy === key);
  const note = gen && key && gen.note?.key === key ? gen.note : null;
  return (
    <div className="cp-empty-state">
      <p className="cp-empty-label">{label}</p>
      {gen && fields && !gen.locked && (
        <button type="button" className="ch-btn-chip cp-empty-generate" disabled={!!gen.busy} onClick={() => gen.run(fields)}>
          <Sparkles size={14} aria-hidden="true" /> {busy ? 'Generating…' : 'Generate'}
        </button>
      )}
      {children}
      {note && <p className={`ch-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}
    </div>
  );
}

const FIELD_LABELS = {
  want_architecture: 'want', wound: 'wound', the_mask: 'mask', living_state: 'living state',
  triggers: 'triggers', blind_spot: 'blind spot', change_capacity: 'change capacity',
  self_narrative: 'self-narrative', operative_cosmology: 'cosmology', foreclosed_possibility: 'foreclosed possibility',
  experience_of_joy: 'joy', time_orientation: 'time orientation', dilemma: 'dilemma', deep_profile: 'deep profile',
  selected_name: 'real name',
};

/**
 * Generating the inner life. One at a time: `busy` is the key of the run
 * (its fields joined, 'all' or 'apply'); `note` says what came of the last
 * one. run(fields) fills one empty part and saves it. Everything at once
 * (Evoni, 2026-10-17, step 3) is a preview first: preview() puts what it
 * would fill in `review`, nothing saved; apply(values) saves the values
 * kept, into fields still empty; discard() drops it.
 */
function useInteriorGenerate(character, onSaved) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [review, setReview] = useState(null);
  const id = character?.id;
  const failed = (key, err, what) => {
    console.error(`[CharacterProfilePage] ${what} failed:`, err);
    setNote({ key, error: true, text: err.response?.data?.error || err.message || 'Could not generate it.' });
  };
  const run = useCallback(async (fields = null) => {
    const key = fields ? fields.join(',') : 'all';
    setBusy(key); setNote(null);
    try {
      const res = await generateInteriorApi(id, fields);
      const { filled = [], character: updated, message } = res.data || {};
      if (updated) onSaved(updated);
      setNote({ key, text: filled.length
        ? `Filled in: ${filled.map((f) => FIELD_LABELS[f] || f).join(', ')}.`
        : (message || 'Nothing new came back.') });
    } catch (err) {
      failed(key, err, 'generate inner life');
    } finally { setBusy(null); }
  }, [id, onSaved]);
  const preview = useCallback(async () => {
    setBusy('all'); setNote(null); setReview(null);
    try {
      const res = await previewInteriorApi(id);
      const proposed = res.data?.proposed || {};
      if (Object.keys(proposed).length) setReview({ proposed });
      else setNote({ key: 'all', text: res.data?.message || 'Nothing is missing.' });
    } catch (err) {
      failed('all', err, 'preview inner life');
    } finally { setBusy(null); }
  }, [id]);
  const apply = useCallback(async (values) => {
    setBusy('apply'); setNote(null);
    try {
      const res = await applyInteriorApi(id, values);
      const { filled = [], skipped = [], character: updated } = res.data || {};
      if (updated) onSaved(updated);
      setReview(null);
      const name = (f) => FIELD_LABELS[f] || f;
      setNote({ key: 'all', text: [
        filled.length ? `Filled in: ${filled.map(name).join(', ')}.` : 'Nothing was saved.',
        skipped.length ? `Not saved, already written or not usable: ${skipped.map(name).join(', ')}.` : '',
      ].filter(Boolean).join(' ') });
    } catch (err) {
      failed('all', err, 'save generated inner life');
    } finally { setBusy(null); }
  }, [id, onSaved]);
  const discard = useCallback(() => setReview(null), []);
  return { busy, note, run, preview, apply, discard, review, locked: character?.status === 'finalized' };
}

/* ── Overview ────────────────────────────────────────────────────────────────── */

function WhoTheyAre({ character, onSaved, openTab }) {
  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const prose = character.prose_overview || character.description || '';
  const locked = character.status === 'finalized';

  const edit = (text) => { setDraft(text); setEditing(true); };
  const save = async () => {
    setBusy(true); setNote(null);
    try {
      await updateCharacterApi(character.id, { prose_overview: draft.trim() || null });
      onSaved({ prose_overview: draft.trim() || null });
      setEditing(false);
    } catch (err) {
      console.error('[CharacterProfilePage] save prose failed:', err);
      setNote(err.response?.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  };
  const rewrite = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await draftProseApi(character.id);
      const text = res.data?.paragraph;
      if (!text) throw new Error('No draft came back.');
      edit(text);
      setNote('A draft from the profile. Save to keep it.');
    } catch (err) {
      console.error('[CharacterProfilePage] rewrite from profile failed:', err);
      setNote(err.response?.data?.error || err.message || 'Could not draft it.');
    } finally { setBusy(false); }
  };

  return (
    <section className="ch-card" aria-labelledby="ch-who">
      <div className="ch-card-head">
        <h2 id="ch-who" className="ch-h2">Who they are</h2>
        {!editing && !locked && <button type="button" className="ch-pill-btn" onClick={() => edit(prose)}>Edit</button>}
      </div>
      {editing ? (
        <>
          <textarea className="ch-textarea" aria-label="Edit who they are" value={draft} rows={6} onChange={(e) => setDraft(e.target.value)} />
          <div className="ch-row">
            <button type="button" className="ch-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => { setEditing(false); setNote(null); }}>Cancel</button>
          </div>
        </>
      ) : prose
        ? (
          <>
            <p className={`ch-prose${full ? '' : ' is-clamped'}`} data-testid="ch-prose">{prose}</p>
            {prose.length > PROSE_CLAMP && (
              <button type="button" className="ch-pill-btn" aria-expanded={full} onClick={() => setFull((f) => !f)}>
                {full ? 'Show less' : 'Read full narrative'} <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </>
        )
        : <p className="ch-note">Nothing written yet.</p>}
      {note && <p className="ch-note" role="status">{note}</p>}
      {!editing && !locked && (
        <button type="button" className="ch-btn-chip" disabled={busy} onClick={rewrite}>
          <Sparkles size={14} aria-hidden="true" /> {busy ? 'Drafting…' : 'Rewrite from profile'}
        </button>
      )}
      {!editing && <WantsAndFears character={character} openTab={openTab} />}
    </section>
  );
}

// Longer than this, "Who they are" shows its first lines and Read full narrative.
const PROSE_CLAMP = 420;

// A JSON column may come back as text.
const objOf = (v) => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch (err) {
    console.error('[CharacterProfilePage] not JSON:', err);
    return {};
  }
};
const textOf = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Wants and fears (Evoni's mock, 2026-10-18), from their inner life: what
 * they say they want, what they actually need, what they will not admit,
 * their desire; their fear and their wound. Nothing written, nothing shown
 * but the way to Inner Life.
 */
export function wantsAndFears(character) {
  const want = objOf(character?.want_architecture);
  const wound = objOf(character?.wound);
  const wants = [
    ['Says they want', want.surface_want], ['Actually needs', want.real_want],
    ['Will not admit wanting', want.forbidden_want || character?.hidden_want], ['Desire', character?.core_desire],
  ].map(([kind, v]) => ({ kind, text: textOf(v) })).filter((x) => x.text);
  const fears = [['Fear', character?.core_fear], ['The wound', wound.description || character?.core_wound]]
    .map(([kind, v]) => ({ kind, text: textOf(v) })).filter((x) => x.text);
  return { wants, fears };
}

function WantsAndFears({ character, openTab }) {
  const { wants, fears } = wantsAndFears(character);
  if (!wants.length && !fears.length) {
    return (
      <p className="ch-note">
        No wants or fears written yet.{' '}
        {openTab && <button type="button" className="ch-link" onClick={() => openTab('inner')}>Open Inner Life</button>}
      </p>
    );
  }
  const list = (items, tone, Icon, title) => (
    <div className={`ch-wf is-${tone}`} data-testid={`ch-${tone === 'want' ? 'wants' : 'fears'}`}>
      <h3 className="ch-wf-h"><Icon size={16} aria-hidden="true" /> {title}</h3>
      {items.length ? (
        <ul className="ch-wf-list">
          {items.map((x) => <li key={x.kind}><span className="ch-wf-kind">{x.kind}</span> {x.text}</li>)}
        </ul>
      ) : <p className="ch-note">Not written yet.</p>}
    </div>
  );
  return (
    <div className="ch-wfs">
      {list(wants, 'want', Heart, 'Wants')}
      {list(fears, 'fear', Flame, 'Fears')}
    </div>
  );
}

function WhereTheyShowUp({ appearances, feedProfile }) {
  const rows = showUpRows(appearances, feedProfile);
  const { pageItems, pager } = usePaged(rows);
  return (
    <section className="ch-card" aria-labelledby="ch-where">
      <div className="ch-card-head">
        <h2 id="ch-where" className="ch-h2">Where they show up</h2>
        <span className="ch-note">Everything in the show that points at them</span>
      </div>
      {!appearances ? <p className="ch-note">Loading…</p>
        : !appearances.linked ? <p className="ch-note">No Pulse profile yet, so nothing in the show points at them. Match them to a Pulse person on <Link to="/character-registry">The cast</Link>.</p>
        : rows.length === 0 ? <p className="ch-note">Not in the show yet: no event, home or posts.</p>
        : (
          <ul className="ch-shows" data-testid="ch-shows">
            {pageItems.map((r, i) => {
              const inner = (<>
                <span className="ch-show-kind">{r.label}</span>
                <span className="ch-show-text"><strong>{r.title}</strong>{r.sub && <span>{r.sub}</span>}{r.detail && <span className="ch-show-detail">{r.detail}</span>}</span>
                {r.to && <ArrowRight size={16} aria-hidden="true" className="ch-show-go" />}
              </>);
              return (
                <li key={`${r.kind}-${i}`}>
                  {r.to ? <Link className={`ch-show is-${r.kind}`} to={r.to}>{inner}</Link> : <div className={`ch-show is-${r.kind}`}>{inner}</div>}
                </li>
              );
            })}
          </ul>
        )}
      <Pager {...pager} label="Where they show up" />
    </section>
  );
}

function TheirVoice({ character, feedProfile, openTab }) {
  const voice = voiceOf(character, feedProfile);
  const name = character.display_name || character.selected_name;
  return (
    <section className="ch-card" aria-labelledby="ch-voice" data-testid="ch-voice">
      <div className="ch-card-head">
        <h2 id="ch-voice" className="ch-h2"><Quote size={20} aria-hidden="true" className="ch-h2-icon" /> Their voice</h2>
        {openTab && <button type="button" className="ch-pill-btn" onClick={() => openTab('voice')}>View all</button>}
      </div>
      {!voice ? <p className="ch-note">No voice yet. It comes from their Pulse profile and voice signature.</p> : (<>
        {voice.sample && (
          <p className="ch-sample">
            <span className="ch-sample-mark" aria-hidden="true"><Quote size={16} /></span>
            <span><strong>{name}</strong> {voice.sample}</span>
          </p>
        )}
        {/* The habit is a paragraph of direction, too long for a pill. */}
        {voice.habit && <p className="ch-voice-habit">{voice.habit}</p>}
        <div className="ch-chips">
          {voice.phrase && <span className="ch-chip">{voice.phrase}</span>}
          {voice.innerVoice && <span className="ch-chip">inner voice: {voice.innerVoice}</span>}
          {voice.neverSays && <span className="ch-chip">never says outright: {voice.neverSays}</span>}
        </div>
        <p className="ch-note">How they sound on The Pulse and in their head.</p>
      </>)}
      {openTab && voice && (
        <button type="button" className="ch-link ch-more" onClick={() => openTab('voice')}>More examples <ArrowRight size={14} aria-hidden="true" /></button>
      )}
    </section>
  );
}

function WithLala({ appearances }) {
  const line = withLala(appearances);
  return (
    <section className="ch-card" aria-labelledby="ch-lala" data-testid="ch-lala">
      <h2 id="ch-lala" className="ch-h2"><Crown size={20} aria-hidden className="ch-h2-icon" /> With Lala</h2>
      <p className="ch-text">{line || 'Nothing between them and Lala yet.'}</p>
      <Link className="ch-link" to="/feed-relationships">Open Relationship Map</Link>
    </section>
  );
}

/** Their real name (selected_name, else the feed profile's creator_name). */
export const realNameOf = (character, feedProfile) => character?.selected_name || feedProfile?.creator_name || null;

/** One editable name: shows the value or "Not set", saves through `save`. */
function NameRow({ label, value, placeholder, locked, save, children }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const submit = async () => {
    setBusy(true); setNote(null);
    try {
      await save(draft.trim() || null);
      setEditing(false);
    } catch (err) {
      console.error(`[CharacterProfilePage] save ${label} failed:`, err);
      setNote(err.response?.data?.message || err.response?.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  };
  return (
    <div className="ch-name-row">
      <span className="ch-name-label">{label}</span>
      {editing ? (
        <div className="ch-row">
          <input className="ch-input" aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" className="ch-btn" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => { setEditing(false); setNote(null); }}>Cancel</button>
        </div>
      ) : (
        <div className="ch-row">
          <span className={value ? 'ch-name-value' : 'ch-note'}>{value || 'Not set'}</span>
          {!locked && <button type="button" className="ch-link" onClick={() => { setDraft(value || ''); setEditing(true); }}>{value ? 'Edit' : 'Write it'}</button>}
          {children}
        </div>
      )}
      {note && <p className="ch-note is-error" role="status">{note}</p>}
    </div>
  );
}

/**
 * Their names: the real one (the name on their ID) and the one they go by
 * on social media (their feed profile's name and @handle). Evoni,
 * 2026-10-15: "a character should have a social media name and a real name".
 */
function TheirNames({ character, feedProfile, onSaved, onFeedSaved, gen }) {
  const real = realNameOf(character, feedProfile);
  const locked = character.status === 'finalized';
  const handle = feedProfile?.handle ? `@${feedProfile.handle.replace(/^@/, '')}` : null;
  const genNote = gen.note?.key === 'selected_name' ? gen.note : null;
  return (
    <section className="ch-card" aria-labelledby="ch-names" data-testid="ch-names">
      <h2 id="ch-names" className="ch-h2">Their names</h2>
      <NameRow label="Real name" value={real} placeholder="First and last name" locked={locked}
        save={async (v) => { await updateCharacterApi(character.id, { selected_name: v }); onSaved({ selected_name: v }); }}>
        {!real && !locked && (
          <button type="button" className="ch-btn-chip" disabled={!!gen.busy} onClick={() => gen.run(['selected_name'])}>
            <Sparkles size={14} aria-hidden="true" /> {gen.busy === 'selected_name' ? 'Suggesting…' : 'Suggest one'}
          </button>
        )}
      </NameRow>
      {genNote && <p className={`ch-note${genNote.error ? ' is-error' : ''}`} role="status">{genNote.text}</p>}
      {feedProfile ? (
        <NameRow label="Social media name" value={feedProfile.display_name || null} placeholder="The name on their profile" locked={locked}
          save={async (v) => { await updateSocialProfileApi(feedProfile.id, { display_name: v }); onFeedSaved({ display_name: v }); }}>
          {handle && <span className="ch-note">{handle}</span>}
        </NameRow>
      ) : (
        <div className="ch-name-row">
          <span className="ch-name-label">Social media name</span>
          <p className="ch-note">No Pulse profile yet. Match them to a Pulse person on <Link to="/character-registry">The cast</Link>.</p>
        </div>
      )}
    </section>
  );
}

const PLACE_LABEL = { home: 'Home', closet: 'Closet', work: 'Place of work' };
const PULSE_REVIEW = '/admin?tab=pulse&sub=review';

/**
 * Their facts (Character Consistency Engine step 2; services/characterFacts):
 * the hard values every profile section must agree with. Followers come from
 * the follower ledger; changing them writes a ledger row with a reason. A
 * fact marked "Not decided yet" is left for Evoni: generators must not
 * invent it.
 */
const FACT_LABELS = {
  handle: 'Handle', followers: 'Followers', account_status: 'Account status',
  income: 'Income', occupation: 'Occupation', major_possessions: 'Major possessions',
  home_price_range: 'Home price range',
};
// services/characterFacts HOME_PRICE_RANGES: what their home costs, read when
// their home is described from their profile (2026-10-17).
const HOME_PRICE_RANGE_OPTIONS = [
  ['budget', 'Budget (under $1,500 a month)'], ['modest', 'Modest ($1,500 to $3,000 a month)'],
  ['comfortable', 'Comfortable ($3,000 to $6,000 a month)'], ['upscale', 'Upscale ($6,000 to $15,000 a month)'],
  ['luxury', 'Luxury ($15,000 to $50,000 a month)'], ['ultra', 'Ultra-luxury (over $50,000 a month)'],
];
const ACCOUNT_STATUS_OPTIONS = ['rising', 'peaking', 'plateauing', 'controversial', 'cancelled', 'reinventing', 'gone_dark', 'posthumous'];
const words = (s) => (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');
const money = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? `$${Number(n).toLocaleString('en-US')}` : null);

function factText(facts, key) {
  if (facts.undecided.includes(key)) return 'Not decided yet';
  switch (key) {
    case 'handle': return facts.handle;
    case 'followers': return facts.followers ? `${facts.followers.label}${facts.followers.source === 'estimate' ? ' (estimate, not in the follower ledger yet)' : ''}` : null;
    case 'account_status': return facts.account_status ? words(facts.account_status) : null;
    case 'income': {
      const i = facts.income;
      if (!i || (i.amount == null && !i.source)) return null;
      return [money(i.amount) && `${money(i.amount)}${i.cadence ? ` ${i.cadence.replace('_', ' ')}` : ''}`, i.source].filter(Boolean).join(' · ');
    }
    case 'occupation': return facts.occupation;
    case 'major_possessions': return facts.major_possessions.length ? facts.major_possessions.join(', ') : null;
    case 'home_price_range': return facts.home_price_range?.label || null;
    default: return null;
  }
}

/** Whether any of occupation, income and possessions is missing (and not marked not decided). */
export const needsFacts = (facts) => {
  const undecided = new Set(facts?.undecided || []);
  return (!undecided.has('occupation') && !facts?.occupation)
    || (!undecided.has('income') && facts?.income?.amount == null)
    || (!undecided.has('major_possessions') && !(facts?.major_possessions || []).length);
};

export function TheirFacts({ character, onFeedSaved }) {
  const [facts, setFacts] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const id = character.id;

  useEffect(() => {
    let live = true;
    getFactsApi(id)
      .then((res) => { if (live) setFacts(res.data?.facts || null); })
      .catch((err) => {
        console.error('[CharacterProfilePage] facts load failed:', err);
        if (live) setFacts({ error: err.response?.data?.error || 'Could not load their facts.' });
      });
    return () => { live = false; };
  }, [id]);

  const startEdit = (proposal = null, why = null) => {
    setNote(why ? { kind: 'ok', text: `Suggested from their profile: ${why} Save to keep it, or change it first.` } : null);
    const p = proposal || {};
    setForm({
      handle: facts.handle || '',
      followers: facts.followers?.count ?? '',
      followers_reason: '',
      account_status: facts.account_status || '',
      income_amount: p.income?.amount ?? facts.income?.amount ?? '',
      income_cadence: p.income?.cadence || facts.income?.cadence || 'per_year',
      income_source: p.income?.source || facts.income?.source || '',
      occupation: p.occupation || facts.occupation || '',
      major_possessions: (p.major_possessions || facts.major_possessions).join(', '),
      home_price_range: facts.home_price_range?.key || '',
      undecided: [...facts.undecided],
      reason: '',
    });
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Suggest facts from their profile (Evoni, 2026-10-17): the missing ones,
  // read from what is written about them; the form opens with them.
  const suggest = async () => {
    setSuggesting(true);
    setNote(null);
    try {
      const res = await suggestFactsApi(id);
      startEdit(res.data?.proposal || {}, res.data?.why || '');
    } catch (err) {
      console.error('[CharacterProfilePage] suggesting facts failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not suggest their facts.' });
    } finally {
      setSuggesting(false);
    }
  };
  const toggleUndecided = (k) => setForm((f) => ({
    ...f, undecided: f.undecided.includes(k) ? f.undecided.filter((x) => x !== k) : [...f.undecided, k],
  }));

  const save = async () => {
    const body = {
      income: { amount: form.income_amount === '' ? null : Number(form.income_amount), cadence: form.income_cadence, source: form.income_source },
      occupation: form.occupation,
      major_possessions: form.major_possessions.split(',').map((x) => x.trim()).filter(Boolean),
      home_price_range: form.home_price_range || null,
      undecided: form.undecided,
      ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
    };
    if (facts.feed_linked) {
      if (form.handle !== (facts.handle || '')) body.handle = form.handle;
      if ((form.account_status || null) !== (facts.account_status || null)) body.account_status = form.account_status || null;
      if (form.followers !== '' && Number(form.followers) !== facts.followers?.count) {
        body.followers = { count: Number(form.followers), reason: form.followers_reason };
      }
    }
    setBusy(true);
    try {
      const res = await putFactsApi(id, body);
      const next = res.data?.facts;
      setFacts(next);
      setForm(null);
      setNote({ kind: 'ok', text: 'Saved.' });
      if (onFeedSaved && next) {
        onFeedSaved({ handle: next.handle, current_state: next.account_status, ...(next.followers ? { follower_count_approx: next.followers.label } : {}) });
      }
    } catch (err) {
      console.error('[CharacterProfilePage] facts save failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not save their facts.' });
    } finally {
      setBusy(false);
    }
  };

  const feedKeys = ['handle', 'followers', 'account_status'];
  return (
    <section className="ch-card" aria-labelledby="ch-facts" data-testid="ch-facts">
      <div className="ch-card-head">
        <h2 id="ch-facts" className="ch-h2">Their facts</h2>
        <span className="ch-note">The values every part of their profile must agree with</span>
      </div>
      {!facts ? <p className="ch-note">Loading…</p>
        : facts.error ? <p className="ch-note" role="alert">{facts.error}</p>
        : !form ? (
          <>
            <dl className="ch-facts">
              {Object.keys(FACT_LABELS).map((key) => (
                <div key={key} className="ch-fact">
                  <dt>{FACT_LABELS[key]}</dt>
                  <dd className={facts.undecided.includes(key) ? 'is-undecided' : ''}>{factText(facts, key) || <span className="ch-note">Not set</span>}</dd>
                </div>
              ))}
              <div className="ch-fact">
                <dt>Can afford</dt>
                <dd>{facts.affordability ? `${facts.affordability.label} (${money(facts.affordability.yearly)} a year)` : <span className="ch-note">Set their income</span>}</dd>
              </div>
            </dl>
            {facts.feed_linked && <KnownFor characterId={id} />}
            <span className="ch-facts-row">
              <button type="button" className="ch-btn-soft" onClick={() => startEdit()}>Edit facts</button>
              {needsFacts(facts) && (
                <button type="button" className="ch-btn-soft" disabled={suggesting} onClick={suggest}>
                  {suggesting ? 'Reading their profile…' : 'Suggest facts from their profile'}
                </button>
              )}
            </span>
          </>
        ) : (
          <form className="ch-facts-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            {facts.feed_linked ? (
              <>
                <label>Handle<input value={form.handle} onChange={set('handle')} placeholder="@handle" /></label>
                <label>Followers<input type="number" min="0" step="1" value={form.followers} onChange={set('followers')} /></label>
                {form.followers !== '' && Number(form.followers) !== facts.followers?.count && (
                  <label>Why the followers changed<input value={form.followers_reason} onChange={set('followers_reason')} placeholder="One line, for the follower ledger" /></label>
                )}
                <label>Account status
                  <select value={form.account_status} onChange={set('account_status')}>
                    <option value="">Not set</option>
                    {ACCOUNT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{words(s)}</option>)}
                  </select>
                </label>
              </>
            ) : <p className="ch-note">No Pulse profile yet, so no handle, followers or account status.</p>}
            <label>Income
              <span className="ch-facts-row">
                <input type="number" min="0" value={form.income_amount} onChange={set('income_amount')} placeholder="Amount" />
                <select value={form.income_cadence} onChange={set('income_cadence')}>
                  <option value="per_year">a year</option>
                  <option value="per_month">a month</option>
                </select>
              </span>
            </label>
            <label>Where the money comes from<input value={form.income_source} onChange={set('income_source')} placeholder="Brand deals, PlayRoom, a salary…" /></label>
            <label>Occupation<input value={form.occupation} onChange={set('occupation')} /></label>
            <label>Major possessions<input value={form.major_possessions} onChange={set('major_possessions')} placeholder="Separate with commas" /></label>
            <label>Home price range
              <select value={form.home_price_range} onChange={set('home_price_range')} data-testid="ch-facts-home-price">
                <option value="">Not set</option>
                {HOME_PRICE_RANGE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <fieldset className="ch-facts-undecided">
              <legend>Not decided yet</legend>
              {Object.keys(FACT_LABELS).filter((k) => facts.feed_linked || !feedKeys.includes(k)).map((k) => (
                <label key={k}><input type="checkbox" aria-label={`${FACT_LABELS[k]}: not decided yet`} checked={form.undecided.includes(k)} onChange={() => toggleUndecided(k)} /> {FACT_LABELS[k]}</label>
              ))}
            </fieldset>
            <label>Why these facts changed<input value={form.reason} onChange={set('reason')} placeholder="Optional, one line, kept in their fact history" maxLength={500} /></label>
            <span className="ch-facts-row">
              <button type="submit" className="ch-btn" disabled={busy}>{busy ? 'Saving…' : 'Save facts'}</button>
              <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
            </span>
          </form>
        )}
      {note && <p className={note.kind === 'error' ? 'ch-note is-error' : 'ch-note'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
      {facts && !facts.error && !form && <FactHistory characterId={id} refreshKey={facts} />}
      {facts && !facts.error && !form && <ProfileCheck characterId={id} />}
      {facts && !facts.error && !form && <PressureTest characterId={id} />}
    </section>
  );
}

/**
 * Fact history (the spec's #1; Evoni, 2026-10-17; services/factHistory):
 * when and why each fact changed, newest first, with the follower ledger
 * (an episode's result, a post, an event, a change here). Loads when opened.
 */
const historyWhen = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function FactHistory({ characterId, refreshKey }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    factHistoryApi(characterId)
      .then((res) => { if (live) { setHistory(res.data?.history || []); setError(null); } })
      .catch((err) => {
        console.error('[CharacterProfilePage] fact history failed:', err);
        if (live) setError(err.response?.data?.error || 'Could not load their fact history.');
      });
    return () => { live = false; };
  }, [open, characterId, refreshKey]);
  return (
    <details className="ch-history" data-testid="ch-history" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Fact history</summary>
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
      {open && !history && !error && <p className="ch-note">Loading…</p>}
      {history && history.length === 0 && <p className="ch-note">No changes yet. Each save on this sheet, and each follower change, is kept here.</p>}
      {history && history.length > 0 && (
        <ol className="ch-history-list">
          {history.map((h, i) => (
            <li key={`${h.at}-${h.fact}-${i}`} data-testid="ch-history-item">
              <span className="ch-history-what">
                <b>{h.label}</b>{' '}
                {h.from ? <>{h.from} → {h.to || 'not set'}</> : <>set to {h.to || 'not set'}</>}
              </span>
              <span className="ch-history-when">
                {historyWhen(h.at)}{h.story_label ? ` · ${h.story_label}` : ''}{h.by ? ` · ${h.by}` : ''}
              </span>
              {h.reason && <span className="ch-history-why">{h.reason}</span>}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

/**
 * Pressure test (the spec's #6; Evoni, 2026-10-17: "yes start the pressure
 * test"; services/characterPressure): the hard questions a fact-checker
 * would ask, each answered from their own character file. A question the
 * file answers holds; a gap is something nothing decides yet; a
 * contradiction is two parts that disagree (the mask lying is never one).
 * It reads; it never changes anything.
 */
const PRESSURE_VERDICTS = {
  answers: { label: 'Holds', className: 'is-holds' },
  gap: { label: 'Gap', className: 'is-gap' },
  contradiction: { label: 'Contradiction', className: 'is-contradiction' },
};
const PRESSURE_SUMMARY = {
  holds: 'They hold up: the file answers every question.',
  gaps: 'No contradictions, but some questions have nothing written to answer them.',
  fails: 'They don’t hold up yet: parts of their file disagree.',
};

export function PressureTest({ characterId }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await pressureTestApi(characterId);
      setResult(res.data);
    } catch (err) {
      console.error('[CharacterProfilePage] pressure test failed:', err);
      setError(err.response?.data?.error || 'Could not run the pressure test.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ch-pressure" data-testid="ch-pressure">
      <button type="button" className="ch-btn-soft" disabled={busy} onClick={run}>
        {busy ? 'Asking the hard questions…' : result ? 'Test again' : 'Pressure test: ask them the hard questions'}
      </button>
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
      {result && (
        <>
          <p className="ch-note" data-testid="ch-pressure-summary">
            {PRESSURE_SUMMARY[result.verdict] || ''}
            {' '}{result.summary.answers} hold, {result.summary.gaps} gap{result.summary.gaps === 1 ? '' : 's'}, {result.summary.contradictions} contradiction{result.summary.contradictions === 1 ? '' : 's'}.
          </p>
          <ul className="ch-pressure-list">
            {result.questions.map((q) => (
              <li key={q.question} className={`ch-pressure-item ${PRESSURE_VERDICTS[q.verdict]?.className || ''}`} data-testid="ch-pressure-item">
                <span className="ch-facts-row">
                  <span className={`ch-chip ch-pressure-verdict ${PRESSURE_VERDICTS[q.verdict]?.className || ''}`}>{PRESSURE_VERDICTS[q.verdict]?.label || q.verdict}</span>
                  <b className="ch-pressure-q">{q.question}</b>
                </span>
                {q.answer && <span className="ch-pressure-answer">{q.answer}</span>}
                {q.cites?.length > 0 && <span className="ch-pressure-cites">From: {q.cites.join(' · ')}</span>}
                {q.fix && <span className="ch-pressure-fix">To fix: {q.fix}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * The consistency check (Character Consistency Engine step 3): every place
 * the narrator's text disagrees with their facts. The check never edits;
 * each finding can be fixed (the suggested wording, or Evoni's own), or
 * marked intentional and listed as such. What they post and author-only
 * notes are not checked (a gap there is the mask).
 * Suggest fixes (Evoni, 2026-10-17: "i want to be able to auto fix the
 * text issues"): one AI call proposes, for each finding with no single
 * right wording, a rewrite of its sentence or that it is fine as it is.
 * Fix all applies every one-click fix and every suggestion; a "fine" one is
 * marked intentional with the reason.
 * Check and fix (Evoni, 2026-10-19: "i want it to automatically fix it for
 * me inside character profiles"): one click checks and fixes everything it
 * can (POST /cast/consistency/fix-character/:id, services/castFixAll), then
 * lists each change with Undo and what is left to do by hand. "Only check"
 * still checks without changing anything.
 */
const CHECK_LABELS = {
  followers: 'Followers', account_status: 'Account status', handle: 'Handle',
  social_name: 'Social media name', affordability: 'Can afford',
};

export function ProfileCheck({ characterId }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // { id, text }
  const [saving, setSaving] = useState(null);
  const [suggestions, setSuggestions] = useState({}); // flag id → { verdict, before, after, why }
  const [auto, setAuto] = useState(null); // 'suggest' | 'all'
  const [autoNote, setAutoNote] = useState(null);
  const [fixed, setFixed] = useState(null); // { changes, left } from Check and fix
  const [undone, setUndone] = useState({}); // change id → 'undone' | error text

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await getCheckApi(characterId);
      setResult(res.data);
    } catch (err) {
      console.error('[CharacterProfilePage] profile check failed:', err);
      setError(err.response?.data?.error || 'Could not check their profile.');
    } finally {
      setBusy(false);
    }
  };
  const mark = async (flag, on) => {
    try {
      if (on) await markIntentionalApi(characterId, flag.id, null);
      else await unmarkIntentionalApi(characterId, flag.id);
      await run();
    } catch (err) {
      console.error('[CharacterProfilePage] marking a flag failed:', err);
      setError(err.response?.data?.error || 'Could not save that.');
    }
  };
  const fix = async (flag, text) => {
    setSaving(flag.id);
    setError(null);
    try {
      const res = await fixFlagApi(characterId, flag.id, text);
      setResult(res.data);
      setEditing(null);
    } catch (err) {
      console.error('[CharacterProfilePage] fixing a flag failed:', err);
      setError(err.response?.data?.error || 'Could not fix that.');
    } finally {
      setSaving(null);
    }
  };

  const suggest = async () => {
    setAuto('suggest');
    setError(null);
    setAutoNote(null);
    try {
      const res = await suggestFixesApi(characterId);
      const list = res.data?.suggestions || [];
      setSuggestions(Object.fromEntries(list.map((x) => [x.flag_id, x])));
      setAutoNote(list.length ? null : 'No suggestions: edit these by hand.');
    } catch (err) {
      console.error('[CharacterProfilePage] suggesting fixes failed:', err);
      setError(err.response?.data?.error || 'Could not suggest fixes.');
    } finally {
      setAuto(null);
    }
  };
  const forget = (flagId) => setSuggestions((all) => { const next = { ...all }; delete next[flagId]; return next; });
  /** Applies one suggestion; returns the check after a rewrite, or null after a mark. */
  const applySuggestion = async (flag, sug) => {
    if (sug.verdict === 'fine') {
      await markIntentionalApi(characterId, flag.id, sug.why || null);
      return null;
    }
    const res = await rewriteFlagApi(characterId, flag.id, sug.before, sug.after);
    return res.data;
  };
  const takeSuggestion = async (flag, sug) => {
    setSaving(flag.id);
    setError(null);
    try {
      const after = await applySuggestion(flag, sug);
      forget(flag.id);
      if (after) setResult(after); else await run();
    } catch (err) {
      console.error('[CharacterProfilePage] applying a suggestion failed:', err);
      setError(err.response?.data?.error || 'Could not apply that.');
    } finally {
      setSaving(null);
    }
  };
  const fixAll = async () => {
    setAuto('all');
    setError(null);
    setAutoNote(null);
    let done = 0;
    const failed = [];
    for (const f of result.flags) {
      const sug = suggestions[f.id];
      if (f.fix == null && !sug) continue;
      try {
        if (f.fix != null) await fixFlagApi(characterId, f.id);
        else await applySuggestion(f, sug);
        done += 1;
      } catch (err) {
        console.error('[CharacterProfilePage] fix all: one fix failed:', err);
        failed.push(f.field_label);
      }
    }
    setSuggestions({});
    await run();
    setAutoNote(`Fixed ${done}.${failed.length ? ` Could not fix: ${failed.join(', ')}. Check again and edit those by hand.` : ''}`);
    setAuto(null);
  };
  const checkAndFix = async () => {
    setBusy(true);
    setError(null);
    setAutoNote(null);
    setSuggestions({});
    setUndone({});
    try {
      const res = await fixCharacterApi(characterId);
      setFixed({ changes: res.data.changes || [], left: res.data.left || [] });
      setResult(res.data.check);
    } catch (err) {
      console.error('[CharacterProfilePage] check and fix failed:', err);
      setError(err.response?.data?.error || 'Could not fix their profile.');
    } finally {
      setBusy(false);
    }
  };
  const undo = async (change) => {
    try {
      await undoFixApi(change);
      setUndone((u) => ({ ...u, [change.id]: 'undone' }));
      await run();
    } catch (err) {
      console.error('[CharacterProfilePage] undoing a fix failed:', err);
      setUndone((u) => ({ ...u, [change.id]: err.response?.data?.error || 'Could not undo that.' }));
    }
  };
  const flags = result?.flags || [];
  const canSuggest = flags.some((f) => f.fix == null && f.editable);
  const fixable = flags.filter((f) => f.fix != null || suggestions[f.id]).length;

  return (
    <div className="ch-check" data-testid="ch-check">
      <span className="ch-facts-row">
        <button type="button" className="ch-btn-chip is-primary" disabled={busy || !!auto} onClick={checkAndFix} data-testid="ch-check-and-fix">
          {busy ? 'Checking and fixing…' : 'Check and fix'}
        </button>
        <button type="button" className="ch-btn-chip" disabled={busy || !!auto} onClick={run}>
          {result ? 'Check again' : 'Only check'}
        </button>
      </span>
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
      {fixed && (
        <div className="ch-check-fixed" data-testid="ch-check-fixed" role="status">
          <p className="ch-note">
            {fixed.changes.length ? `Fixed ${fixed.changes.length}.` : 'Nothing needed fixing automatically.'}
          </p>
          {fixed.changes.length > 0 && (
            <ul className="ch-check-list">
              {fixed.changes.map((c) => (
                <li key={c.id}>
                  <span className="ch-check-what">{c.label}</span>
                  <span className="ch-facts-row">
                    {undone[c.id] === 'undone'
                      ? <span className="ch-note">Undone</span>
                      : <button type="button" className="ch-btn-chip" onClick={() => undo(c)}>Undo</button>}
                    {undone[c.id] && undone[c.id] !== 'undone' && <span className="ch-note is-error">{undone[c.id]}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {fixed.left.length > 0 && (
            <ul className="ch-check-left">{fixed.left.map((l) => <li key={l} className="ch-note">{l}</li>)}</ul>
          )}
        </div>
      )}
      {result && (
        <>
          <p className="ch-note">
            {result.flags.length === 0 ? 'Everything agrees with their facts.' : `${result.flags.length} place${result.flags.length === 1 ? '' : 's'} disagree${result.flags.length === 1 ? 's' : ''} with their facts.`}
            {' '}Checked {result.checked} text field{result.checked === 1 ? '' : 's'}; what they post ({result.skipped.mask}) and author-only notes ({result.skipped.author}) are not checked.
          </p>
          {flags.length > 0 && (
            <span className="ch-facts-row">
              {canSuggest && (
                <button type="button" className="ch-btn-chip" disabled={!!auto} onClick={suggest}>
                  {auto === 'suggest' ? 'Suggesting…' : 'Suggest fixes'}
                </button>
              )}
              {fixable > 0 && (
                <button type="button" className="ch-btn-chip is-primary" disabled={!!auto} onClick={fixAll}>
                  {auto === 'all' ? 'Fixing…' : `Fix all ${fixable}`}
                </button>
              )}
            </span>
          )}
          {autoNote && <p className="ch-note" role="status">{autoNote}</p>}
          {result.flags.length > 0 && (
            <ul className="ch-check-list">
              {result.flags.map((f) => (
                <li key={f.id}>
                  <span className="ch-check-what"><b>{f.field_label}</b> says &ldquo;{f.found}&rdquo;; the facts say {f.expected}.</span>
                  <span className="ch-check-excerpt">{f.excerpt}</span>
                  {suggestions[f.id] && (
                    <span className="ch-check-suggestion" data-testid="ch-check-suggestion">
                      {suggestions[f.id].verdict === 'fix'
                        ? <>Suggested: &ldquo;{suggestions[f.id].after}&rdquo;</>
                        : <>Looks fine as it is.</>}
                      {suggestions[f.id].why && <span className="ch-check-why"> {suggestions[f.id].why}</span>}
                      <button type="button" className="ch-btn-chip is-primary" disabled={saving === f.id || !!auto} onClick={() => takeSuggestion(f, suggestions[f.id])}>
                        {saving === f.id ? 'Saving…' : suggestions[f.id].verdict === 'fix' ? 'Use this' : 'Keep it as it is'}
                      </button>
                    </span>
                  )}
                  <span className="ch-facts-row">
                    <span className="ch-chip is-plain">{CHECK_LABELS[f.check] || f.check}</span>
                    {f.fix != null && (
                      <button type="button" className="ch-btn-chip is-primary" disabled={saving === f.id} onClick={() => fix(f)}>
                        {saving === f.id ? 'Fixing…' : `Fix: “${f.fix}”`}
                      </button>
                    )}
                    {f.editable && editing?.id !== f.id && (
                      <button type="button" className="ch-btn-chip" onClick={() => setEditing({ id: f.id, text: f.text })}>Edit the text</button>
                    )}
                    <button type="button" className="ch-btn-chip" onClick={() => mark(f, true)}>It&rsquo;s intentional</button>
                  </span>
                  {editing?.id === f.id && (
                    <span className="ch-check-edit">
                      <label className="ch-check-edit-label" htmlFor={`ch-check-edit-${f.id}`}>{f.field_label}</label>
                      <textarea className="ch-textarea" id={`ch-check-edit-${f.id}`} rows={5} value={editing.text}
                        onChange={(e) => setEditing({ id: f.id, text: e.target.value })} />
                      <span className="ch-facts-row">
                        <button type="button" className="ch-btn-chip is-primary" disabled={saving === f.id || !editing.text.trim()} onClick={() => fix(f, editing.text)}>
                          {saving === f.id ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="ch-btn-chip" onClick={() => setEditing(null)}>Cancel</button>
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {result.intentional.length > 0 && (
            <details className="ch-check-intentional">
              <summary>{result.intentional.length} marked intentional</summary>
              <ul className="ch-check-list">
                {result.intentional.map((f) => (
                  <li key={f.id}>
                    <span className="ch-check-what"><b>{f.field_label}</b>: &ldquo;{f.found}&rdquo;</span>
                    <button type="button" className="ch-btn-chip" onClick={() => mark(f, false)}>Not intentional</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Their type (Character Consistency Engine step 6a; services/characterTypology):
 * the Enneagram type their inner life grows from, an optional MBTI dial for
 * how they phrase things, and why. "Suggest a type" reads their writing and
 * proposes one; nothing is saved until you choose it.
 */
const ENNEAGRAM_NAMES = {
  1: 'The Reformer', 2: 'The Helper', 3: 'The Achiever', 4: 'The Individualist', 5: 'The Investigator',
  6: 'The Loyalist', 7: 'The Enthusiast', 8: 'The Challenger', 9: 'The Peacemaker',
};
const MBTI_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const wingsOf = (type) => [type === 1 ? 9 : type - 1, type === 9 ? 1 : type + 1];
const formOf = (t) => ({
  type: t?.enneagram?.type ? String(t.enneagram.type) : '', wing: t?.enneagram?.wing ? String(t.enneagram.wing) : '',
  mbti: t?.mbti || '', why: t?.why || '',
});

export function TheirType({ character }) {
  const id = character.id;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    getTypologyApi(id)
      .then((res) => { if (live) setData(res.data); })
      .catch((err) => {
        console.error('[CharacterProfilePage] typology load failed:', err);
        if (live) setData({ error: err.response?.data?.error || 'Could not load their type.' });
      });
    return () => { live = false; };
  }, [id]);

  const act = async (label, fn) => {
    setBusy(label);
    setError(null);
    try { await fn(); } catch (err) {
      console.error(`[CharacterProfilePage] typology ${label} failed:`, err);
      setError(err.response?.data?.error || `Could not ${label}.`);
    } finally { setBusy(null); }
  };
  const save = (e) => {
    e.preventDefault();
    return act('save', async () => {
      const res = await putTypologyApi(id, {
        enneagram: { type: Number(form.type), wing: form.wing ? Number(form.wing) : null },
        mbti: form.mbti || null, why: form.why.trim() || null,
      });
      setData(res.data);
      setForm(null);
      setSuggestion(null);
    });
  };
  const clear = () => act('clear', async () => {
    const res = await putTypologyApi(id, { clear: true });
    setData(res.data);
    setForm(null);
  });
  const suggest = () => act('suggest a type', async () => {
    const res = await suggestTypologyApi(id);
    setSuggestion(res.data);
  });

  const typology = data?.typology;
  const type = Number(form?.type) || null;
  return (
    <section className="ch-card" aria-labelledby="ch-type" data-testid="ch-type">
      <div className="ch-card-head">
        <h2 id="ch-type" className="ch-h2">Their type</h2>
        <span className="ch-note">The root their inner life grows from</span>
      </div>
      {!data ? <p className="ch-note">Loading…</p>
        : data.error ? <p className="ch-note is-error" role="alert">{data.error}</p>
        : !form && (
          <>
            {typology ? (
              <div className="ch-type-now">
                <p className="ch-type-label"><b>Enneagram {data.label}</b>{typology.mbti && <> · MBTI {typology.mbti}</>}</p>
                {typology.why && <p className="ch-note">{typology.why}</p>}
              </div>
            ) : <p className="ch-note">No type set yet. Generated inner life is built without one.</p>}
            <span className="ch-facts-row">
              <button type="button" className="ch-btn-soft" onClick={() => setForm(formOf(typology))}>{typology ? 'Change' : 'Set their type'}</button>
              <button type="button" className="ch-btn-soft" disabled={Boolean(busy)} onClick={suggest}>{busy === 'suggest a type' ? 'Reading…' : 'Suggest a type from their writing'}</button>
              {typology && <button type="button" className="ch-btn-chip" disabled={Boolean(busy)} onClick={clear}>Clear</button>}
            </span>
          </>
        )}
      {suggestion && !form && (
        <div className="ch-type-suggest" data-testid="ch-type-suggest">
          <p><b>Suggested: Enneagram {suggestion.label}</b>{suggestion.suggestion?.mbti && <> · MBTI {suggestion.suggestion.mbti}</>}</p>
          {suggestion.suggestion?.why && <p className="ch-note">{suggestion.suggestion.why}</p>}
          <span className="ch-facts-row">
            <button type="button" className="ch-btn" onClick={() => { setForm(formOf(suggestion.suggestion)); }}>Use this</button>
            <button type="button" className="ch-btn-soft" onClick={() => setSuggestion(null)}>Dismiss</button>
          </span>
        </div>
      )}
      {form && (
        <form className="ch-type-form" onSubmit={save}>
          <label className="ch-gen-field">
            <span>Enneagram type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, wing: '' })} required>
              <option value="">Choose…</option>
              {Object.entries(ENNEAGRAM_NAMES).map(([n, name]) => <option key={n} value={n}>{n} · {name}</option>)}
            </select>
          </label>
          <label className="ch-gen-field">
            <span>Wing</span>
            <select value={form.wing} onChange={(e) => setForm({ ...form, wing: e.target.value })} disabled={!type}>
              <option value="">None</option>
              {type && wingsOf(type).map((w) => <option key={w} value={w}>{type}w{w} · {ENNEAGRAM_NAMES[w]}</option>)}
            </select>
          </label>
          <label className="ch-gen-field">
            <span>MBTI (how they phrase things only)</span>
            <select value={form.mbti} onChange={(e) => setForm({ ...form, mbti: e.target.value })}>
              <option value="">None</option>
              {MBTI_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="ch-gen-field">
            <span>Why this type</span>
            <textarea rows={2} maxLength={1000} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
          </label>
          <span className="ch-facts-row">
            <button type="submit" className="ch-btn" disabled={Boolean(busy) || !form.type}>{busy === 'save' ? 'Saving…' : 'Save type'}</button>
            <button type="button" className="ch-btn-soft" onClick={() => setForm(null)}>Cancel</button>
          </span>
        </form>
      )}
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
    </section>
  );
}

const STORY_FORMATS = { short_story: 'Short story', social_fiction: 'Social fiction', snippet: 'Snippet', recap: 'Recap' };
const shortText = (t, n = 160) => (t && t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t || '');

/**
 * Their story (Evoni, 2026-10-16): what they posted on The Pulse, and the
 * short stories and book chapters they are in (services/characterStoryTrail).
 */
// Their posts, stories and chapters; `skip` when the trail is already loaded.
function useStoryTrail(id, skip = false) {
  const [trail, setTrail] = useState(null);
  useEffect(() => {
    if (skip) return undefined;
    let live = true;
    getStoryTrailApi(id)
      .then((res) => { if (live) setTrail(res.data || {}); })
      .catch((err) => {
        console.error('[CharacterProfilePage] story trail load failed:', err);
        if (live) setTrail({ error: err.response?.data?.error || 'Could not load their story.' });
      });
    return () => { live = false; };
  }, [id, skip]);
  return trail;
}

export function TheirStory({ character, trail: given }) {
  const own = useStoryTrail(character.id, given !== undefined);
  const trail = given !== undefined ? given : own;

  const posts = trail?.posts || [];
  const stories = trail?.stories || [];
  const chapters = trail?.chapters || [];
  const counts = trail?.post_counts || { live: 0, draft: 0 };
  const empty = trail && !trail.error && posts.length === 0 && stories.length === 0 && chapters.length === 0;
  const postPages = usePaged(posts);
  const storyPages = usePaged(stories);
  const chapterPages = usePaged(chapters);

  return (
    <section className="ch-card" aria-labelledby="ch-story" data-testid="ch-story">
      <div className="ch-card-head">
        <h2 id="ch-story" className="ch-h2">Their story</h2>
        <span className="ch-note">What they posted, and the stories and chapters they are in</span>
      </div>
      {!trail ? <p className="ch-note">Loading…</p>
        : trail.error ? <p className="ch-note" role="alert">{trail.error}</p>
        : empty ? <p className="ch-note">Nothing yet: no Pulse posts, stories or chapters.</p>
        : (
          <>
            {posts.length > 0 && (
              <div className="ch-trail">
                <h3 className="ch-trail-h">On The Pulse <span>{counts.live} posted{counts.draft ? `, ${counts.draft} draft${counts.draft === 1 ? '' : 's'}` : ''}</span></h3>
                <ul className="ch-trail-list">
                  {postPages.pageItems.map((p) => (
                    <li key={p.id}>
                      <span className="ch-trail-text">{shortText(p.text)}</span>
                      <span className="ch-trail-meta">{[p.status === 'draft' ? 'Draft' : null, p.episode_number != null ? `Episode ${p.episode_number}` : null].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
                <Pager {...postPages.pager} label="Posts" />
              </div>
            )}
            {stories.length > 0 && (
              <div className="ch-trail">
                <h3 className="ch-trail-h">Stories</h3>
                <ul className="ch-trail-list">
                  {storyPages.pageItems.map((st) => (
                    <li key={st.id}>
                      <Link to={st.show_id ? `/stories?show=${st.show_id}` : '/stories'} className="ch-trail-text">{st.title || 'Untitled'}</Link>
                      <span className="ch-trail-meta">{[STORY_FORMATS[st.format] || st.format, st.episode_number != null ? `Episode ${st.episode_number}` : null, st.status].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
                <Pager {...storyPages.pager} label="Stories" />
              </div>
            )}
            {chapters.length > 0 && (
              <div className="ch-trail">
                <h3 className="ch-trail-h">Chapters</h3>
                <ul className="ch-trail-list">
                  {chapterPages.pageItems.map((c) => (
                    <li key={c.id}>
                      <Link to={`/chapter/${c.book_id}/${c.id}`} className="ch-trail-text">{c.title || `Chapter ${c.chapter_number ?? ''}`.trim()}</Link>
                      <span className="ch-trail-meta">{[c.book_title, c.written ? null : 'not written yet'].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
                <Pager {...chapterPages.pager} label="Chapters" />
              </div>
            )}
          </>
        )}
    </section>
  );
}

/**
 * Generate Posts (Character Consistency Engine step 4): drafts their Pulse
 * posts from their voice, mask, facts and events (services/characterPosts).
 * Every draft waits in Review; nothing posts from here. Each is load-bearing
 * (the story reacts to it) or ambient (flavor, any beat). Ideas from their
 * own story fill "What is happening" with one tap (Evoni, 2026-10-17: "now
 * im just sitting here wondering what to say").
 */
const WEIGHT_LABELS = { load_bearing: 'Load-bearing', ambient: 'Ambient' };

export function GeneratePosts({ characterId, onDrafted }) {
  const [count, setCount] = useState(3);
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ideas, setIdeas] = useState(null); // { ready, blocker, next, ideas }
  const [picked, setPicked] = useState(null);
  const [stepping, setStepping] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [showChoice, setShowChoice] = useState('');

  const loadIdeas = useCallback(async () => {
    try {
      const res = await postIdeasApi(characterId);
      setIdeas(res.data);
      setShowChoice((prev) => prev || res.data?.shows?.[0]?.id || '');
    } catch (err) {
      console.error('[CharacterProfilePage] post ideas failed:', err);
      setIdeas({ ready: true, blocker: null, next: null, ideas: [] });
    }
  }, [characterId]);
  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  // The step that unblocks drafting, taken here (Evoni, 2026-10-17): choose
  // the registry's show, Make Active, then Build their voice (one manual
  // Pulse request). Its error shows by its button.
  const step = async () => {
    setStepping(true);
    setStepError(null);
    try {
      if (ideas?.next === 'choose_show') await setRegistryShowApi(ideas.registry.id, showChoice);
      else if (ideas?.next === 'make_active') await makeActiveApi(characterId);
      else await buildVoiceApi(characterId);
      await loadIdeas();
    } catch (err) {
      console.error('[CharacterProfilePage] unblocking their posts failed:', err);
      setStepError(err.response?.data?.error || 'Could not do that.');
    } finally {
      setStepping(false);
    }
  };

  const pick = (idea) => {
    setPicked(idea.key);
    setAbout(idea.about);
  };

  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await generatePostsApi(characterId, { count: Number(count), about: about.trim() || null });
      setResult(res.data);
      if (onDrafted) onDrafted();
    } catch (err) {
      console.error('[CharacterProfilePage] generate posts failed:', err);
      setError(err.response?.data?.error || 'Could not draft their posts.');
    } finally {
      setBusy(false);
    }
  };

  const drafted = result?.drafted || [];
  const failed = result?.failed || [];
  return (
    <form className="ch-gen" onSubmit={run} data-testid="ch-gen">
      <h3 className="ch-trail-h">Draft posts</h3>
      <p className="ch-note">Drafts in their voice, from their facts and the events they know about. They wait in Review; nothing posts until you approve it.</p>
      {ideas?.blocker && <p className="ch-note is-error" role="alert">{ideas.blocker}</p>}
      {ideas?.next === 'choose_show' && ideas.registry && (
        <label className="ch-gen-field">
          <span>Their registry&rsquo;s show</span>
          <select value={showChoice} onChange={(e) => setShowChoice(e.target.value)} disabled={stepping}>
            {(ideas.shows || []).map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
          </select>
          {ideas.registry.characters > 1 && (
            <span className="ch-note">This puts all {ideas.registry.characters} characters in {ideas.registry.title ? `“${ideas.registry.title}”` : 'their registry'} in that show.</span>
          )}
        </label>
      )}
      {ideas?.next && (
        <button type="button" className="ch-btn-soft" disabled={stepping || (ideas.next === 'choose_show' && !showChoice)} onClick={step}>
          {ideas.next === 'choose_show'
            ? (stepping ? 'Saving…' : 'Put their registry in this show')
            : ideas.next === 'make_active'
              ? (stepping ? 'Moving…' : 'Make Active')
              : (stepping ? 'Building their voice…' : 'Build their voice')}
        </button>
      )}
      {stepError && <p className="ch-note is-error" role="alert">{stepError}</p>}
      {ideas?.ideas?.length > 0 && (
        <div className="ch-gen-ideas">
          <span className="ch-gen-ideas-h">Not sure what to say? Pick one:</span>
          <span className="ch-facts-row">
            {ideas.ideas.map((idea) => (
              <button key={idea.key} type="button" className={picked === idea.key ? 'ch-btn-chip is-picked' : 'ch-btn-chip'}
                aria-pressed={picked === idea.key} onClick={() => pick(idea)} disabled={busy}>
                {idea.label}
              </button>
            ))}
          </span>
        </div>
      )}
      <label className="ch-gen-field">
        <span>How many</span>
        <select value={count} onChange={(e) => setCount(e.target.value)} disabled={busy}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="ch-gen-field">
        <span>What is happening (optional)</span>
        <textarea rows={3} maxLength={500} value={about} onChange={(e) => { setAbout(e.target.value); setPicked(null); }} disabled={busy}
          placeholder="Pick an idea above, or write one line, like “the week before the linen swap”. Leave it empty for everyday posts." />
      </label>
      <button type="submit" className="ch-btn" disabled={busy || ideas?.ready === false}>{busy ? 'Drafting…' : 'Draft posts for Review'}</button>
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
      {result && (
        <div role="status">
          <p className="ch-note">
            {drafted.length} draft{drafted.length === 1 ? '' : 's'} waiting in Review{failed.length ? `; ${failed.length} could not be read` : ''}. <Link to={PULSE_REVIEW}>Open Review</Link>
          </p>
          {drafted.length > 0 && (
            <ul className="ch-trail-list">
              {drafted.map((d) => (
                <li key={d.post.id}>
                  <span className="ch-trail-text">{d.post.content_text}</span>
                  <span className="ch-facts-row">
                    <span className={d.weight === 'load_bearing' ? 'ch-chip' : 'ch-chip is-plain'}>{WEIGHT_LABELS[d.weight] || d.weight}</span>
                    {d.why && <span className="ch-trail-meta">{d.why}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

/**
 * Their places: home, closet and others (the character homes of #3228),
 * each with its everyday picture, and "Share to The Pulse", which makes a
 * draft post from their feed profile with the picture and the venue
 * (Evoni, 2026-10-15: "their everyday scene sets which can be shared on the
 * pulse"). With no home yet, one of the show's scene sets can be chosen.
 */
function TheirPlaces({ character }) {
  const [data, setData] = useState(null);
  const [sets, setSets] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const id = character.id;

  const load = useCallback(async () => {
    try {
      const res = await getPlacesApi(id);
      setData(res.data || { places: [] });
    } catch (err) {
      console.error('[CharacterProfilePage] places load failed:', err);
      setData({ places: [], error: err.response?.data?.error || 'Could not load their places.' });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const places = data?.places || [];
  const hasHome = places.some((p) => p.role === 'home');
  const locked = character.status === 'finalized';

  const openPicker = async () => {
    setNote(null);
    try {
      const res = await showSceneSetsApi(data.show_id);
      const list = res.data?.data || res.data?.sceneSets || res.data?.scene_sets || [];
      setSets(list.filter((s) => s && s.id));
    } catch (err) {
      console.error('[CharacterProfilePage] scene sets load failed:', err);
      setNote({ error: true, text: 'Could not load the scene sets.' });
    }
  };
  const linkHome = async () => {
    if (!choice) return;
    setBusy('link'); setNote(null);
    try {
      await linkPlaceApi(data.show_id, { character_id: id, scene_set_id: choice, role: 'home' });
      setSets(null); setChoice('');
      await load();
    } catch (err) {
      console.error('[CharacterProfilePage] link home failed:', err);
      setNote({ error: true, text: err.response?.data?.error || 'Could not set their home.' });
    } finally { setBusy(null); }
  };
  const share = async (place) => {
    setBusy(place.scene_set_id); setNote(null);
    try {
      await sharePlaceApi(id, place.scene_set_id);
      setNote({ shared: true, text: `A draft of their ${PLACE_LABEL[place.role]?.toLowerCase() || place.label || 'place'} is waiting in The Pulse's Review.` });
    } catch (err) {
      console.error('[CharacterProfilePage] share place failed:', err);
      setNote({ error: true, text: err.response?.data?.error || 'Could not share it.' });
    } finally { setBusy(null); }
  };

  return (
    <section className="ch-card" aria-labelledby="ch-places" data-testid="ch-places">
      <h2 id="ch-places" className="ch-h2"><MapPin size={20} aria-hidden className="ch-h2-icon" /> Their places</h2>
      {!data ? <p className="ch-note">Loading…</p>
        : data.error ? <p className="ch-note is-error">{data.error}</p>
        : !data.show_id ? <p className="ch-note">Not in a show&rsquo;s cast yet, so no home to set.</p>
        : (<>
          {places.length === 0 && <p className="ch-note">No home yet.</p>}
          <ul className="ch-places">
            {places.map((p) => (
              <li key={`${p.role}-${p.scene_set_id}`} className="ch-place">
                {p.image_url
                  ? <img className="ch-place-img" src={p.image_url} alt={`${PLACE_LABEL[p.role] || p.label || 'Place'}: ${p.scene_set_name}`} />
                  : <div className="ch-place-img is-empty" aria-hidden="true" />}
                <div className="ch-place-text">
                  <span className="ch-show-kind">{PLACE_LABEL[p.role] || p.label || 'Place'}{p.everyday ? ' · everyday look' : ''}</span>
                  <strong>{p.scene_set_name}</strong>
                  {character.feed_profile_id && p.image_url && (
                    <button type="button" className="ch-btn-chip" disabled={!!busy} onClick={() => share(p)}>
                      {busy === p.scene_set_id ? 'Sharing…' : 'Share to The Pulse'}
                    </button>
                  )}
                  {!p.image_url && <span className="ch-note">No picture yet</span>}
                </div>
              </li>
            ))}
          </ul>
          {!hasHome && !locked && (sets ? (
            <div className="ch-row">
              <select className="ch-input" aria-label="Their home set" value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Choose a scene set…</option>
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" className="ch-btn" disabled={!choice || busy === 'link'} onClick={linkHome}>{busy === 'link' ? 'Saving…' : 'Make it home'}</button>
            </div>
          ) : (
            <button type="button" className="ch-link" onClick={openPicker}>Choose their home</button>
          ))}
          {places.length > 0 && !character.feed_profile_id && <p className="ch-note">Sharing on The Pulse needs a Pulse profile.</p>}
        </>)}
      {note && (
        <p className={`ch-note${note.error ? ' is-error' : ''}`} role="status">
          {note.text}{note.shared && <> <Link to={PULSE_REVIEW}>Open Review</Link></>}
        </p>
      )}
    </section>
  );
}

/**
 * The Overview to Evoni's mock (2026-10-18): Quick facts, Who they are with
 * their wants and fears, Key stats, Their voice, Profile images, Where they
 * show up and Recent activity first; the rest of what the page already
 * showed below them. Quick facts' Edit opens their names and facts.
 */
function TabOverview({ character, appearances, feedProfile, relationships, entanglements, onSaved, onFeedSaved, gen, openTab }) {
  const [editingFacts, setEditingFacts] = useState(false);
  // Quick facts' facts, so Key stats shows the same follower count (the profile audit, 2026-10-19).
  const [facts, setFacts] = useState(null);
  const trail = useStoryTrail(character.id);
  return (
    <div className="ch-overview">
      <div className="ch-col">
        <QuickFacts character={character} feedProfile={feedProfile} appearances={appearances} editing={editingFacts} onEdit={setEditingFacts} onFacts={setFacts} />
        {editingFacts && (
          <>
            <TheirNames character={character} feedProfile={feedProfile} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} />
            <TheirFacts character={character} onFeedSaved={onFeedSaved} />
          </>
        )}
        <ProfileImages character={character} onSaved={onSaved} />
        <ConnectionsCard relationships={relationships} entanglements={entanglements} openTab={openTab} />
      </div>
      <div className="ch-col">
        <WhoTheyAre character={character} onSaved={onSaved} openTab={openTab} />
        <WhereTheyShowUp appearances={appearances} feedProfile={feedProfile} />
        <TheirStory character={character} trail={trail} />
      </div>
      <div className="ch-col">
        <TheirStats feedProfile={feedProfile} facts={facts} appearances={appearances} relationships={relationships} entanglements={entanglements} />
        <TheirVoice character={character} feedProfile={feedProfile} openTab={openTab} />
        <RecentActivity appearances={appearances} trail={trail} />
        <WithLala appearances={appearances} />
        <TheirEvents appearances={appearances} />
        <TheirPlaces character={character} />
      </div>
    </div>
  );
}

/** Their saved stage, and "ready to be …" when their fields already reach further (lib/characterPage depthStageOf). */
export function aliveLine(character) {
  const { level, ready } = depthStageOf(character);
  return `${depthOf(level).step.label}${ready ? ` · ready to be ${depthOf(ready).step.label}` : ''}`;
}

/* ── Quick facts: who they are at a glance; Edit opens their names and facts ── */
export function QuickFacts({ character, feedProfile, appearances, editing, onEdit, onFacts }) {
  const [facts, setFacts] = useState(null);
  const [type, setType] = useState(null);
  const id = character.id;
  // Read again when the editors close, so a saved fact shows here.
  useEffect(() => {
    if (editing) return undefined;
    let live = true;
    getFactsApi(id)
      .then((res) => {
        if (!live) return;
        setFacts(res.data?.facts || {});
        onFacts?.(res.data?.facts || {});
      })
      .catch((err) => {
        console.error('[CharacterProfilePage] quick facts load failed:', err);
        if (live) setFacts({});
      });
    getTypologyApi(id)
      .then((res) => { if (live) setType(res.data?.typology && res.data.label ? String(res.data.label).replace(/^Type /, '') : ''); })
      .catch((err) => {
        console.error('[CharacterProfilePage] quick facts type load failed:', err);
        if (live) setType('');
      });
    return () => { live = false; };
  }, [id, editing]);

  const episodes = (appearances?.episodes || []).map((e) => e.episode_number).filter((n) => n != null);
  const firstEp = episodes.length ? Math.min(...episodes) : null;
  const loading = (v) => (v === null ? '…' : v);
  const rows = [
    { key: 'real', label: 'Real name', icon: IdCard, value: realNameOf(character, feedProfile) },
    { key: 'type', label: 'Type', icon: Crown, value: loading(type) },
    // "How alive", not "Status": Settings' Status is draft / accepted / finalized (the profile audit, 2026-10-19).
    { key: 'status', label: 'How alive', icon: Heart, value: aliveLine(character) },
    { key: 'first', label: 'First appearance', icon: CalendarDays, value: !appearances ? '…' : firstEp != null ? `Episode ${firstEp}` : null },
    { key: 'known', label: 'Known as', icon: Star, value: archetypeOf(feedProfile) },
    { key: 'role', label: 'Role', icon: Users, value: roleOf(character) },
    { key: 'work', label: 'Occupation', icon: Briefcase, value: facts ? facts.occupation : '…' },
    { key: 'followers', label: 'Followers', icon: BarChart3, value: facts ? (facts.followers ? `${facts.followers.label}${facts.followers.source === 'estimate' ? ' (estimate)' : ''}` : null) : '…' },
    { key: 'account', label: 'Account status', icon: TrendingUp, value: facts ? (facts.account_status ? words(facts.account_status) : null) : '…' },
  ];
  return (
    <section className="ch-card" aria-labelledby="ch-quick" data-testid="ch-quick">
      <div className="ch-card-head">
        <h2 id="ch-quick" className="ch-h2">Quick facts</h2>
        <button type="button" className="ch-pill-btn" aria-expanded={editing} onClick={() => onEdit(!editing)}>{editing ? 'Done' : 'Edit'}</button>
      </div>
      <dl className="ch-qf">
        {rows.map(({ key, label, icon: Icon, value }) => (
          <div key={key} className="ch-qf-row">
            <dt><span className="ch-qf-icon" aria-hidden="true"><Icon size={14} /></span>{label}</dt>
            <dd className={value ? '' : 'is-empty'}>{value || 'Not set'}</dd>
          </div>
        ))}
      </dl>
      {editing && <p className="ch-note">Their names and facts are open below.</p>}
    </section>
  );
}

/* ── Recent activity: their posts, events and episodes, newest first ────────── */
const activityDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const activityWhen = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function activityOf(appearances, trail) {
  const items = [];
  for (const p of trail?.posts || []) {
    items.push({ key: `post-${p.id}`, kind: 'post', title: p.status === 'draft' ? 'Drafted a post' : 'Posted to The Pulse', sub: shortText(p.text, 70) || null, at: activityDate(p.at) });
  }
  for (const ev of appearances?.events || []) {
    items.push({
      key: `event-${ev.id}`, kind: 'event', title: ev.role === 'host' ? 'Hosts an event' : 'Guest at an event', sub: ev.name,
      at: activityDate(ev.event_date), when: activityDate(ev.event_date) ? null : ev.event_date || null,
      to: ev.show_id ? `/shows/${ev.show_id}/events/${ev.id}` : null,
    });
  }
  for (const ep of appearances?.episodes || []) {
    items.push({ key: `episode-${ep.id}`, kind: 'episode', title: `Featured in Episode ${ep.episode_number ?? '?'}`, sub: ep.title || null, at: null, to: `/episodes/${ep.id}` });
  }
  // Dated first, newest first; the rest after, in the order they came.
  return items.map((x, i) => ({ ...x, i }))
    .sort((a, b) => (a.at && b.at ? b.at - a.at : a.at ? -1 : b.at ? 1 : a.i - b.i));
}

const ACTIVITY_ICONS = { post: FileText, event: CalendarDays, episode: CirclePlay };

export function RecentActivity({ appearances, trail }) {
  const items = activityOf(appearances, trail);
  const { pageItems, pager } = usePaged(items, 4);
  return (
    <section className="ch-card" aria-labelledby="ch-activity" data-testid="ch-activity">
      <h2 id="ch-activity" className="ch-h2"><Activity size={20} aria-hidden="true" className="ch-h2-icon" /> Recent activity</h2>
      {!appearances && !trail ? <p className="ch-note">Loading…</p>
        : items.length === 0 ? <p className="ch-note">Nothing yet: no posts, events or episodes.</p> : (
          <ul className="ch-activity">
            {pageItems.map((x) => {
              const Icon = ACTIVITY_ICONS[x.kind];
              const body = (<>
                <span className={`ch-activity-icon is-${x.kind}`} aria-hidden="true"><Icon size={15} /></span>
                <span className="ch-activity-text"><strong>{x.title}</strong>{x.sub && <span>{x.sub}</span>}</span>
                {(x.at || x.when) && <span className="ch-activity-when">{x.at ? activityWhen(x.at) : x.when}</span>}
              </>);
              return <li key={x.key}>{x.to ? <Link className="ch-activity-row" to={x.to}>{body}</Link> : <div className="ch-activity-row">{body}</div>}</li>;
            })}
          </ul>
        )}
      <Pager {...pager} label="Recent activity" />
    </section>
  );
}

/* ── Profile images: their portrait and cover (POST/DELETE …/photo?kind=) ───── */
const PHOTO_KINDS = [
  { kind: 'portrait', field: 'portrait_url', label: 'Profile photo' },
  { kind: 'cover',    field: 'cover_url',    label: 'Cover photo' },
];

export function ProfileImages({ character, onSaved }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const upload = async (kind, field, file) => {
    if (!file) return;
    setBusy(kind); setNote(null);
    try {
      const res = await uploadPhotoApi(character.id, kind, file);
      onSaved({ [field]: res.data?.[field] || null });
      setNote({ text: kind === 'portrait' ? 'Profile photo updated.' : 'Cover photo updated.' });
    } catch (err) {
      console.error('[CharacterProfilePage] photo upload failed:', err);
      setNote({ error: true, text: err.response?.data?.error || err.message || 'Upload failed.' });
    } finally { setBusy(null); }
  };
  const remove = async (kind, field) => {
    setBusy(kind); setNote(null);
    try {
      await removePhotoApi(character.id, kind);
      onSaved({ [field]: null });
    } catch (err) {
      console.error('[CharacterProfilePage] photo remove failed:', err);
      setNote({ error: true, text: err.response?.data?.error || err.message || 'Remove failed.' });
    } finally { setBusy(null); }
  };
  return (
    <section className="ch-card" aria-labelledby="ch-images" data-testid="ch-images">
      <h2 id="ch-images" className="ch-h2"><ImagePlus size={20} aria-hidden className="ch-h2-icon" /> Profile images</h2>
      <div className="ch-photos">
        {PHOTO_KINDS.map(({ kind, field, label }) => {
          const url = character[field];
          return (
            <figure key={kind} className={`ch-photo is-${kind}`}>
              <div className="ch-photo-frame">
                {url ? <img src={url} alt={`${label} of ${character.display_name || 'this character'}`} /> : <span className="ch-photo-empty">No {label.toLowerCase()} yet</span>}
              </div>
              <figcaption className="ch-photo-actions">
                <label className={`ch-btn-chip ch-photo-pick${busy ? ' is-busy' : ''}`}>
                  {busy === kind ? 'Uploading…' : url ? 'Replace' : 'Add photo'}
                  <input type="file" accept="image/*" className="ch-visually-hidden" disabled={!!busy}
                    aria-label={`${url ? 'Replace' : 'Add'} ${label.toLowerCase()}`}
                    onChange={(e) => { upload(kind, field, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {url && (
                  <button type="button" className="ch-icon-btn" disabled={!!busy} aria-label={`Remove ${label.toLowerCase()}`}
                    onClick={() => remove(kind, field)}><Trash2 size={15} aria-hidden /></button>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {note && <p className={`ch-note${note.error ? ' is-error' : ''}`} role={note.error ? 'alert' : 'status'}>{note.text}</p>}
    </section>
  );
}

/* ── Stats: counts the page already loads, nothing invented ─────────────────── */
export function TheirStats({ feedProfile, facts = null, appearances, relationships, entanglements }) {
  const ties = listOf(relationships).length + listOf(entanglements).length;
  const followers = followerLabelOf(facts, feedProfile);
  const stats = [
    { key: 'followers', label: 'Followers', value: followers || '—', icon: Users, tone: 'pink' },
    { key: 'posts', label: 'Posts', value: appearances?.feed?.posts ?? (appearances ? 0 : '…'), icon: FileText, tone: 'lavender' },
    { key: 'events', label: 'Events', value: appearances ? (appearances.events || []).length : '…', icon: CalendarDays, tone: 'gold' },
    { key: 'episodes', label: 'Episodes', value: appearances ? (appearances.episodes || []).length : '…', icon: CirclePlay, tone: 'green' },
    { key: 'ties', label: 'Connections', value: ties, icon: Link2, tone: 'blue' },
  ];
  return (
    <section className="ch-card" aria-labelledby="ch-stats" data-testid="ch-stats">
      <h2 id="ch-stats" className="ch-h2">Key stats</h2>
      <ul className="ch-stats">
        {stats.map(({ key, label, value, icon: Icon, tone }) => (
          <li key={key} className={`ch-stat is-${tone}`}>
            <span className="ch-stat-ring"><Icon size={20} aria-hidden /></span>
            <strong className="ch-stat-value">{value}</strong>
            <span className="ch-stat-label">{label}</span>
          </li>
        ))}
      </ul>
      {!feedProfile && <p className="ch-note">Followers and posts come from their Pulse profile.</p>}
    </section>
  );
}

/* ── Their events: the ones they host or attend (cast appearances) ──────────── */
export function TheirEvents({ appearances }) {
  const events = appearances?.events || [];
  const { pageItems, pager } = usePaged(events, 4);
  return (
    <section className="ch-card" aria-labelledby="ch-events" data-testid="ch-events">
      <h2 id="ch-events" className="ch-h2"><CalendarDays size={20} aria-hidden className="ch-h2-icon" /> Their events</h2>
      {!appearances ? <p className="ch-note">Loading…</p>
        : events.length === 0 ? <p className="ch-note">No events yet: they host or attend none.</p> : (
          <ul className="ch-events">
            {pageItems.map((ev) => (
              <li key={ev.id}>
                <Link className="ch-event" to={`/shows/${ev.show_id}/events/${ev.id}`}>
                  <span className="ch-event-badge"><CalendarDays size={20} aria-hidden /></span>
                  <span className="ch-event-text">
                    <strong>{ev.name}</strong>
                    <span className="ch-event-meta">
                      {[ev.event_date, ev.venue_name].filter(Boolean).join(' · ') || 'No date yet'}
                    </span>
                    <span className="ch-event-meta">
                      {ev.role === 'host' ? 'Hosting' : 'Guest'}{ev.episode ? ` · Episode ${ev.episode.episode_number ?? '?'}` : ''}
                    </span>
                  </span>
                  <ArrowRight size={16} aria-hidden className="ch-show-go" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      <Pager {...pager} label="Events" />
    </section>
  );
}

/* ── Connections on the Overview: their closest ties, the full list a tab away ─ */
// An API that answers with an object where a list belongs counts as none.
const listOf = (v) => (Array.isArray(v) ? v : []);

export function ConnectionsCard({ relationships: rels, entanglements: ents, openTab }) {
  const relationships = listOf(rels);
  const entanglements = listOf(ents);
  const rows = relationships.slice(0, 4);
  const total = relationships.length + entanglements.length;
  return (
    <section className="ch-card" aria-labelledby="ch-ties" data-testid="ch-ties">
      <div className="ch-card-head">
        <h2 id="ch-ties" className="ch-h2"><Users size={20} aria-hidden className="ch-h2-icon" /> Their people</h2>
        {total > 0 && <button type="button" className="ch-pill-btn" onClick={() => openTab('connections')}>See all {total}</button>}
      </div>
      {rows.length === 0 ? (
        <p className="ch-note">{entanglements.length ? `${entanglements.length} Pulse tie${entanglements.length === 1 ? '' : 's'}, no relationships yet.` : 'No relationships yet.'}</p>
      ) : (
        <ul className="ch-ties">
          {rows.map((r) => {
            const who = r.related_name || r.character_b_name || r.character_a_name || 'Someone';
            const score = closenessOf(r) ?? undefined;
            return (
              <li key={r.id} className="ch-tie">
                <span className="ch-tie-avatar" aria-hidden="true">{who.charAt(0).toUpperCase()}</span>
                <span className="ch-tie-text">
                  <strong>{who}</strong>
                  <span>{[r.relationship_type, r.tension_state].filter(Boolean).join(' · ') || 'Connected'}</span>
                </span>
                {score !== undefined && (
                  <span className="ch-tie-meter" role="img" aria-label={`${r.tension_state}: ${score >= 60 ? 'close' : score >= 35 ? 'mixed' : 'strained'}`}>
                    <span style={{ width: `${score}%` }} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Inner life: what the merge kept aside ────────────────────────────────── */

// What the merge of the depth fields kept aside (2026-10-17): a value that
// differed from the one kept, or had no place in the new lists.
function DepthArchive({ character }) {
  const kept = archivedDepth(character);
  if (!kept.length) return null;
  return (
    <details className="cp-section cp-archived" data-testid="cp-depth-archive">
      <summary className="cp-section-title">Kept from retired fields ({kept.length})</summary>
      <p className="cp-archived-hint">When the inner life fields were merged into one place, these values differed from the one kept, or had no place in the new lists. Copy anything you want into its section.</p>
      <ul className="cp-archived-list">
        {kept.map(([key, value]) => (
          <li key={key}><span className="cp-meta-label">{words(key.replace(/^de_/, ''))}</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</li>
        ))}
      </ul>
    </details>
  );
}

/* Inner life display helpers (the one-home merge, 2026-10-17). */
/** The values the merge kept aside, as [field, value] pairs. */
export function archivedDepth(character) {
  const archive = character?.extra_fields?.depth_archive;
  return archive && typeof archive === 'object' ? Object.entries(archive).filter(([, v]) => v !== null && v !== '') : [];
}

/* ── Connections (Evoni's mock, 2026-10-18, step 4) ───────────────────────────
   Their relationships with counts, filters, search, sort and pages; a map of
   the closest; their key relationships; when each began; their feed ties
   (entanglements) and where they belong. The groups and closeness are
   lib/characterConnections. */

const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label]));

function Avatar({ src, name, size = 44 }) {
  return src
    ? <img className="ch-avatar-sm" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="ch-avatar-sm is-initial" aria-hidden="true" style={{ width: size, height: size }}>{(name || '?').charAt(0).toUpperCase()}</span>;
}

const toPerson = (r) => (r.related_id ? `/character/${r.related_id}` : null);
// The Relationships page with this person selected (?char=; 2026-10-23).
export const relationshipsFor = (character, extra = '') => (character?.id ? `/relationships?char=${encodeURIComponent(character.id)}${extra}` : '/relationships');
const sinceOf = (r) => (activityDate(r.created_at) ? activityWhen(activityDate(r.created_at)) : null);

export function RelationshipOverview({ character, relationships }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('closeness');
  const stats = connectionStats(relationships);
  const rows = filterConnections(relationships, { filter, query, sort });
  const { pageItems, pager } = usePaged(rows);
  const name = (character.selected_name || character.display_name || 'they').split(' ')[0];
  const filters = [
    { key: 'all', label: 'All', n: stats.total },
    { key: 'close', label: 'Close', n: stats.close },
    ...GROUPS.map((g) => ({ key: g.key, label: g.label, n: stats.groups[g.key] })).filter((f) => f.n > 0),
  ];
  const tiles = [
    { key: 'total', label: 'Total connections', n: stats.total, icon: Users, tone: 'pink' },
    { key: 'close', label: 'Close', n: stats.close, icon: Heart, tone: 'green' },
    { key: 'working', label: 'Working with', n: stats.groups.working, icon: Briefcase, tone: 'lavender' },
    { key: 'rival', label: 'Rivals', n: stats.groups.rival, icon: Crown, tone: 'gold' },
  ];
  return (
    <section className="ch-card" aria-labelledby="ch-ro" data-testid="ch-rel-overview">
      <div className="ch-card-head">
        <span className="ch-head-icon" aria-hidden="true"><Share2 size={20} /></span>
        <span className="ch-head-text">
          <h2 id="ch-ro" className="ch-h2">Relationship overview</h2>
          <span className="ch-note">The people in {name}&rsquo;s world and how they connect.</span>
        </span>
        <Link className="ch-pill-btn" to={relationshipsFor(character)}><Plus size={14} aria-hidden="true" /> Add connection</Link>
      </div>
      <ul className="ch-ro-tiles">
        {tiles.map(({ key, label, n, icon: Icon, tone }) => (
          <li key={key} className={`ch-ro-tile is-${tone}`}>
            <Icon size={20} aria-hidden="true" />
            <strong>{n}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {stats.total === 0 ? (
        <p className="ch-note">No relationships yet. Add them in the <Link to={relationshipsFor(character)}>Relationship Engine</Link>.</p>
      ) : (
        <>
          <div className="ch-filter" role="group" aria-label="Show connections">
            {filters.map((f) => (
              <button key={f.key} type="button" className={`ch-filter-btn${filter === f.key ? ' is-on' : ''}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} ({f.n})
              </button>
            ))}
          </div>
          <div className="ch-ro-tools">
            <label className="ch-ro-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" value={query} placeholder="Search connections…" aria-label="Search connections" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ch-ro-sort">
              <span className="ch-visually-hidden">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort connections">
                {SORTS.map((o) => <option key={o.key} value={o.key}>Sort: {o.label}</option>)}
              </select>
            </label>
          </div>
          {rows.length === 0 ? <p className="ch-note">No one matches.</p> : (
            <ul className="ch-conn-list">
              {pageItems.map((r) => {
                const tension = TENSION[r.tension_state];
                const to = toPerson(r);
                const since = sinceOf(r);
                return (
                  <li key={r.id} className="ch-conn" data-testid="ch-conn">
                    <Avatar src={r.related_portrait} name={nameOf(r)} />
                    <span className="ch-conn-text">
                      <span className="ch-conn-top">
                        {to ? <Link to={to} className="ch-conn-name">{nameOf(r)}</Link> : <strong className="ch-conn-name">{nameOf(r)}</strong>}
                        <span className="ch-chip">{typeLabel(r)}</span>
                        {tension && <span className={`ch-tension is-${r.tension_state}`}>{tension.label}</span>}
                      </span>
                      {noteOf(r) && <span className="ch-conn-note">{shortText(noteOf(r), 140)}</span>}
                    </span>
                    <span className="ch-conn-meta">
                      <span>{GROUP_LABEL[groupOf(r)]}</span>
                      {since && <span>Since {since}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager {...pager} label="Connections" />
        </>
      )}
    </section>
  );
}

export function ConnectionMap({ character, relationships }) {
  const size = 300;
  const points = mapPoints(relationships, 6, size);
  const c = size / 2;
  const used = GROUPS.map((g) => g.key).filter((k) => points.some((p) => groupOf(p.r) === k));
  return (
    <section className="ch-card" aria-labelledby="ch-cm" data-testid="ch-conn-map">
      <div className="ch-card-head">
        <h2 id="ch-cm" className="ch-h2"><Share2 size={20} aria-hidden="true" className="ch-h2-icon" /> Connection map</h2>
        <Link className="ch-pill-btn" to={relationshipsFor(character, '&tab=web')}>View full map</Link>
      </div>
      {points.length === 0 ? <p className="ch-note">No one to map yet.</p> : (
        <>
          <div className="ch-cm" style={{ aspectRatio: '1 / 1' }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="ch-cm-lines" aria-hidden="true">
              {points.map((p) => <line key={p.r.id} x1={c} y1={c} x2={p.x} y2={p.y} className={`ch-cm-line is-${groupOf(p.r)}`} />)}
            </svg>
            <span className="ch-cm-node is-centre" style={{ left: '50%', top: '50%' }}>
              <Avatar src={character.portrait_url} name={character.display_name} size={64} />
            </span>
            {points.map((p) => (
              <span key={p.r.id} className="ch-cm-node" style={{ left: `${(p.x / size) * 100}%`, top: `${(p.y / size) * 100}%` }}>
                <Avatar src={p.r.related_portrait} name={nameOf(p.r)} size={40} />
                <span className="ch-cm-name">{nameOf(p.r)}</span>
                <span className="ch-cm-type">{typeLabel(p.r)}</span>
              </span>
            ))}
          </div>
          <ul className="ch-cm-legend" aria-label="Line colours">
            {used.map((g) => <li key={g} className={`is-${g}`}><span aria-hidden="true" />{GROUP_LABEL[g]}</li>)}
          </ul>
          {listOf(relationships).length > points.length && <p className="ch-note">The {points.length} closest of {listOf(relationships).length}.</p>}
        </>
      )}
    </section>
  );
}

export function KeyRelationships({ relationships }) {
  const rows = keyRelationships(relationships);
  return (
    <section className="ch-card" aria-labelledby="ch-kr" data-testid="ch-key-rels">
      <h2 id="ch-kr" className="ch-h2"><Heart size={20} aria-hidden="true" className="ch-h2-icon" /> Key relationships</h2>
      {rows.length === 0 ? <p className="ch-note">No relationships yet.</p> : (
        <ul className="ch-kr">
          {rows.map((r) => {
            const score = closenessOf(r);
            const to = toPerson(r);
            return (
              <li key={r.id} className="ch-kr-item">
                <Avatar src={r.related_portrait} name={nameOf(r)} size={56} />
                <span className="ch-kr-text">
                  <span className="ch-conn-top"><strong>{nameOf(r)}</strong><span className="ch-chip">{typeLabel(r)}</span></span>
                  {score !== null && (
                    <span className="ch-tie-meter" role="img" aria-label={`${TENSION[r.tension_state].label}`}><span style={{ width: `${score}%` }} /></span>
                  )}
                  {noteOf(r) && <span className="ch-conn-note">{shortText(noteOf(r), 120)}</span>}
                  {to && <Link className="ch-link ch-more" to={to}>View <ArrowRight size={14} aria-hidden="true" /></Link>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RelationshipHistory({ relationships }) {
  const rows = connectionHistory(relationships);
  const { pageItems, pager } = usePaged(rows, 4);
  return (
    <section className="ch-card" aria-labelledby="ch-rh" data-testid="ch-rel-history">
      <h2 id="ch-rh" className="ch-h2"><CalendarDays size={20} aria-hidden="true" className="ch-h2-icon" /> Relationship history</h2>
      {rows.length === 0 ? <p className="ch-note">No dates yet.</p> : (
        <ol className="ch-rh">
          {pageItems.map((r) => (
            <li key={r.id} className={`ch-rh-item is-${groupOf(r)}`}>
              <span className="ch-rh-when">{sinceOf(r)}</span>
              <span className="ch-rh-text"><strong>Connected with {nameOf(r)}</strong><span>{typeLabel(r)}</span></span>
            </li>
          ))}
        </ol>
      )}
      <Pager {...pager} label="Relationship history" />
    </section>
  );
}

export function FeedTies({ entanglements }) {
  const rows = listOf(entanglements);
  const { pageItems, pager } = usePaged(rows);
  return (
    <section className="ch-card" aria-labelledby="ch-ft" data-testid="ch-feed-ties">
      <h2 id="ch-ft" className="ch-h2"><Link2 size={20} aria-hidden="true" className="ch-h2-icon" /> Pulse ties</h2>
      <p className="ch-note">Pulse people whose posts reach them, and how.</p>
      {rows.length === 0 ? <p className="ch-note">No Pulse ties yet.</p> : (
        <ul className="ch-ft">
          {pageItems.map((e, i) => (
            <li key={e.id || i} className="ch-ft-item">
              {e.profile ? (
                <Link className="ch-conn-name" to={`/pulse?profile=${e.profile.id}`}>
                  {e.profile.display_name || `@${String(e.profile.handle || '').replace(/^@/, '')}`}
                </Link>
              ) : <strong className="ch-conn-name">Someone on The Pulse</strong>}
              <span className="ch-ft-meta">
                {[words(e.dimension), e.directionality ? words(e.directionality) : null].filter(Boolean).join(' · ')}
              </span>
              <span className="ch-ft-chips">
                <span className={`ch-tension is-${e.intensity === 'high' ? 'volatile' : e.intensity === 'medium' ? 'simmering' : 'calm'}`}>{words(e.intensity || 'low')}</span>
                {e.turbulence_flag && <span className="ch-tension is-fractured" title={e.turbulence_reason || ''}>Turbulent</span>}
                {e.is_active === false && <span className="ch-chip">Ended</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Pager {...pager} label="Pulse ties" />
    </section>
  );
}

function BelongingMap({ character }) {
  const map = objOf(character.belonging_map);
  const belongs = Array.isArray(map.belongs_to) ? map.belongs_to : [];
  const excluded = Array.isArray(map.excluded_from) ? map.excluded_from : [];
  if (!belongs.length && !excluded.length) return null;
  return (
    <section className="ch-card" aria-labelledby="ch-bm" data-testid="ch-belonging">
      <h2 id="ch-bm" className="ch-h2"><Users size={20} aria-hidden="true" className="ch-h2-icon" /> Where they belong</h2>
      {belongs.length > 0 && (
        <div className="ch-fb-block">
          <h3 className="ch-fb-h">Belongs to</h3>
          <ul className="ch-rules-list">{belongs.map((g, i) => <li key={i}><strong>{g.name}</strong>{g.type ? ` · ${g.type}` : ''}</li>)}</ul>
        </div>
      )}
      {excluded.length > 0 && (
        <div className="ch-fb-block">
          <h3 className="ch-fb-h">Kept out of</h3>
          <ul className="ch-rules-list">{excluded.map((g, i) => <li key={i}><strong>{g.name}</strong>{g.why ? ` · ${g.why}` : ''}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function TabConnections({ character, relationships, entanglements }) {
  return (
    <div className="ch-overview ch-conn-grid">
      <div className="ch-col">
        <RelationshipOverview character={character} relationships={relationships} />
      </div>
      <div className="ch-col">
        <ConnectionMap character={character} relationships={relationships} />
        <RelationshipHistory relationships={relationships} />
      </div>
      <div className="ch-col">
        <KeyRelationships relationships={relationships} />
        <FeedTies entanglements={entanglements} />
        <BelongingMap character={character} />
      </div>
    </div>
  );
}

/* ── Voice & Feed (Evoni's mock, 2026-10-18, step 3) ─────────────────────────
   Their voice profile (voice_signature on the character), their feed
   behavior (the feed profile's posting voice, frequency, comment energy and
   what they post), their posts with a filter and pages, the public voice
   against the private one, and drafting new posts. */

const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : typeof v === 'string' && v.trim() ? [v.trim()] : []);
const feedProfileLink = (fp) => (fp?.id
  ? `/world-studio?tab=feed&layer=${fp.feed_layer === 'real_world' ? 'real_world' : 'lalaverse'}&profile=${fp.id}`
  : '/pulse');

/** The voice signature as rows: how they speak, their words, inside, how they react, what they never say. */
export function voiceRows(character) {
  const vs = objOf(character?.voice_signature);
  const voice = voiceOf(character, null) || {};
  return [
    { key: 'speech_pattern', label: 'How they speak', text: textOf(vs.speech_pattern) },
    { key: 'vocabulary_tone', label: 'Their words', text: textOf(vs.vocabulary_tone) },
    { key: 'internal_monologue_style', label: 'Inner voice', text: textOf(vs.internal_monologue_style) },
    { key: 'emotional_reactivity', label: 'How they react', text: textOf(vs.emotional_reactivity) },
    { key: 'never', label: 'Never says outright', text: textOf(voice.neverSays), readOnly: true },
  ].filter((r) => r.text || !r.readOnly);
}

const VOICE_FIELDS = ['speech_pattern', 'vocabulary_tone', 'internal_monologue_style', 'emotional_reactivity'];

export function VoiceProfile({ character, feedProfile, onSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const vs = objOf(character.voice_signature);
  const sample = voiceOf(character, feedProfile)?.sample || null;
  const phrases = asList(vs.catchphrases);
  const rows = voiceRows(character);
  const locked = character.status === 'finalized';
  const name = character.display_name || character.selected_name;

  const open = () => {
    setNote(null);
    setForm({ ...Object.fromEntries(VOICE_FIELDS.map((k) => [k, textOf(vs[k])])), catchphrases: phrases.join(', ') });
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setNote(null);
    const next = {
      ...vs,
      ...Object.fromEntries(VOICE_FIELDS.map((k) => [k, form[k].trim() || null])),
      catchphrases: form.catchphrases.split(',').map((x) => x.trim()).filter(Boolean),
    };
    try {
      await updateCharacterApi(character.id, { voice_signature: next });
      onSaved({ voice_signature: next });
      setForm(null);
      setNote({ text: 'Saved.' });
    } catch (err) {
      console.error('[CharacterProfilePage] save voice failed:', err);
      setNote({ error: true, text: err.response?.data?.error || 'Could not save their voice.' });
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample);
      setNote({ text: 'Copied.' });
    } catch (err) {
      console.error('[CharacterProfilePage] copy sample failed:', err);
      setNote({ error: true, text: 'Could not copy it.' });
    }
  };

  return (
    <section className="ch-card" aria-labelledby="ch-vp" data-testid="ch-voice-profile">
      <div className="ch-card-head">
        <span className="ch-head-icon" aria-hidden="true"><Mic size={20} /></span>
        <span className="ch-head-text">
          <h2 id="ch-vp" className="ch-h2">Voice profile</h2>
          <span className="ch-note">How they speak, write and express themselves</span>
        </span>
        {!form && !locked && <button type="button" className="ch-pill-btn" onClick={open}>Edit</button>}
      </div>
      {sample ? (
        <div className="ch-sample">
          <span className="ch-sample-mark" aria-hidden="true"><Quote size={16} /></span>
          <span><strong>{name}</strong> {sample}</span>
          <button type="button" className="ch-icon-btn ch-sample-copy" aria-label="Copy the sample post" onClick={copy}><Copy size={15} aria-hidden /></button>
        </div>
      ) : <p className="ch-note">No sample post yet. It comes from their Pulse profile.</p>}
      {phrases.length > 0 && (
        <div className="ch-chips" role="group" aria-label="Their catchphrases">
          {phrases.map((p) => <span key={p} className="ch-chip">{p}</span>)}
        </div>
      )}
      {form ? (
        <form className="ch-facts-form" onSubmit={save}>
          {VOICE_FIELDS.map((k) => (
            <label key={k}>{rows.find((r) => r.key === k)?.label}
              <textarea rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <label>Catchphrases<input value={form.catchphrases} placeholder="Separate with commas" onChange={(e) => setForm({ ...form, catchphrases: e.target.value })} /></label>
          <span className="ch-facts-row">
            <button type="submit" className="ch-btn" disabled={busy}>{busy ? 'Saving…' : 'Save voice'}</button>
            <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
          </span>
        </form>
      ) : (
        <div className="ch-rules">
          <h3 className="ch-rules-h"><BadgeCheck size={16} aria-hidden="true" /> How they sound</h3>
          <ul className="ch-rules-list">
            {rows.map((r) => (
              <li key={r.key} className={r.text ? '' : 'is-empty'}>
                <span className="ch-wf-kind">{r.label}</span>
                {r.text || 'Not written yet'}
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className={`ch-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}
    </section>
  );
}

/** Who the feed sees, and what only the writers know. */
export function PublicPrivateVoice({ character, feedProfile }) {
  const mask = objOf(character.the_mask);
  const pub = textOf(feedProfile?.public_persona) || textOf(feedProfile?.content_persona) || textOf(feedProfile?.vibe_sentence)
    || textOf(character.mask_persona) || textOf(mask.description);
  const priv = textOf(feedProfile?.private_reality) || textOf(character.truth_persona)
    || dimensionText(dimension(character.deep_profile, 'ambition_identity')) || null;
  return (
    <section className="ch-card" aria-labelledby="ch-pp" data-testid="ch-public-private">
      <h2 id="ch-pp" className="ch-h2"><Lock size={20} aria-hidden="true" className="ch-h2-icon" /> Public and private voice</h2>
      <div className="ch-wfs">
        <div className="ch-wf is-want">
          <h3 className="ch-wf-h"><Eye size={16} aria-hidden="true" /> Public voice</h3>
          <span className="ch-wf-kind">What The Pulse sees</span>
          <p className="ch-pp-text">{pub || 'Not written yet.'}</p>
        </div>
        <div className="ch-wf is-fear">
          <h3 className="ch-wf-h"><Lock size={16} aria-hidden="true" /> Private voice</h3>
          <span className="ch-wf-kind">For writers only</span>
          <p className="ch-pp-text">{priv || 'Not written yet.'}</p>
        </div>
      </div>
      {mask.feed_profile_is_mask && (
        <p className="ch-note">Their Pulse profile is their mask: the gap between who they perform online and who they are is the story.</p>
      )}
    </section>
  );
}

// The account's status as The Pulse names it (current_state).
const ACCOUNT_STATES = {
  rising:        { label: 'Rising' },
  peaking:       { label: 'Peaking' },
  plateauing:    { label: 'Plateauing' },
  controversial: { label: 'Controversial' },
  cancelled:     { label: 'Cancelled' },
  gone_dark:     { label: 'Gone Dark' },
  reinventing:   { label: 'Reinventing' },
  posthumous:    { label: 'Posthumous' },
  rebuilding:    { label: 'Rebuilding' },
  crossed:       { label: 'Crossed' },
};

const FEED_EDIT = [
  ['posting_voice', 'Posting style'],
  ['comment_energy', 'How they comment'],
  ['content_persona', 'Who they perform'],
];

export function FeedBehavior({ character, feedProfile, appearances, onFeedSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  // The follower count from their facts (the ledger), as Quick facts shows it.
  const [facts, setFacts] = useState(null);
  const hasProfile = Boolean(feedProfile);
  useEffect(() => {
    if (!hasProfile) return undefined;
    let live = true;
    Promise.resolve(getFactsApi(character.id))
      .then((res) => { if (live) setFacts(res?.data?.facts || null); })
      .catch((err) => console.error('[CharacterProfilePage] feed behavior facts load failed:', err));
    return () => { live = false; };
  }, [character.id, hasProfile]);
  // Whether they are on the feed at all, not how their account is doing
  // (Evoni, 2026-10-16: it said "Active" beside "Gone Dark").
  const onFeed = character.social_presence || character.feed_profile_id;
  const presence = <span className={`ch-presence${onFeed ? ' is-on' : ''}`}>{onFeed ? 'On The Pulse' : 'Not on The Pulse'}</span>;
  const head = (
    <div className="ch-card-head">
      <span className="ch-head-icon" aria-hidden="true"><Smartphone size={20} /></span>
      <span className="ch-head-text">
        <h2 id="ch-fb" className="ch-h2">Pulse behavior</h2>
        <span className="ch-note">What they post, how often, and how they come across</span>
      </span>
      {feedProfile && !form && <button type="button" className="ch-pill-btn" onClick={() => setForm(Object.fromEntries(FEED_EDIT.map(([k]) => [k, textOf(feedProfile[k])])))}>Edit</button>}
    </div>
  );
  if (!feedProfile) {
    return (
      <section className="ch-card" aria-labelledby="ch-fb" data-testid="ch-feed-behavior">
        {head}
        <p className="ch-fb-who">{presence}</p>
        <p className="ch-note">
          {character.feed_profile_id
            ? 'Their Pulse profile could not be loaded. Reload the page to try again.'
            : <>Not on The Pulse yet. Match them to a Pulse person on <Link to="/character-registry">The cast</Link>.</>}
        </p>
      </section>
    );
  }
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setNote(null);
    const body = Object.fromEntries(FEED_EDIT.map(([k]) => [k, form[k].trim() || null]));
    try {
      await updateSocialProfileApi(feedProfile.id, body);
      onFeedSaved(body);
      setForm(null);
      setNote({ text: 'Saved.' });
    } catch (err) {
      console.error('[CharacterProfilePage] save feed behavior failed:', err);
      setNote({ error: true, text: err.response?.data?.error || 'Could not save it.' });
    } finally { setBusy(false); }
  };
  const tags = asList(feedProfile.aesthetic_dna?.vibe_tags);
  const tiles = [
    { key: 'freq', label: 'How often', icon: CalendarDays, text: textOf(feedProfile.post_frequency) },
    { key: 'followers', label: 'Followers', icon: Users, text: followerLabelOf(facts, feedProfile) || null },
    { key: 'posts', label: 'Posts', icon: FileText, text: appearances?.feed ? String(appearances.feed.posts ?? 0) : null },
    { key: 'state', label: 'Account', icon: TrendingUp, text: feedProfile.current_state ? ACCOUNT_STATES[feedProfile.current_state]?.label || words(feedProfile.current_state) : null },
  ].filter((t) => t.text);
  return (
    <section className="ch-card" aria-labelledby="ch-fb" data-testid="ch-feed-behavior">
      {head}
      <p className="ch-fb-who">
        {presence}
        <strong>{atHandle(feedProfile.handle)}</strong>
        {feedProfile.display_name && <span>{feedProfile.display_name}</span>}
        <span>{platformLabel(feedProfile.platform)}</span>
      </p>
      {form ? (
        <form className="ch-facts-form" onSubmit={save}>
          {FEED_EDIT.map(([k, label]) => (
            <label key={k}>{label}<textarea rows={3} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
          ))}
          <span className="ch-facts-row">
            <button type="submit" className="ch-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
          </span>
        </form>
      ) : (
        <>
          <div className="ch-fb-block is-style">
            <h3 className="ch-fb-h">Posting style</h3>
            <p>{textOf(feedProfile.posting_voice) || 'Not written yet.'}</p>
          </div>
          {tiles.length > 0 && (
            <ul className="ch-fb-tiles">
              {tiles.map(({ key, label, icon: Icon, text }) => (
                <li key={key} className="ch-fb-tile">
                  <span className="ch-qf-icon" aria-hidden="true"><Icon size={14} /></span>
                  <span><span className="ch-fb-tile-label">{label}</span><strong>{text}</strong></span>
                </li>
              ))}
            </ul>
          )}
          {textOf(feedProfile.content_category) && (
            <div className="ch-fb-block">
              <h3 className="ch-fb-h">What they post</h3>
              <p>{feedProfile.content_category}</p>
            </div>
          )}
          {textOf(feedProfile.comment_energy) && (
            <div className="ch-fb-block">
              <h3 className="ch-fb-h">How they comment</h3>
              <p>{feedProfile.comment_energy}</p>
            </div>
          )}
          {tags.length > 0 && (
            <div className="ch-fb-block">
              <h3 className="ch-fb-h">Topics and aesthetic</h3>
              <div className="ch-chips">{tags.map((t) => <span key={t} className="ch-chip">{t}</span>)}</div>
            </div>
          )}
        </>
      )}
      {note && <p className={`ch-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}
    </section>
  );
}

const POST_FILTERS = [['all', 'All'], ['posted', 'Posted'], ['draft', 'Drafts']];

export function PostExamples({ character, feedProfile, trail, onDraft }) {
  const [filter, setFilter] = useState('all');
  const posts = (trail?.posts || []).filter((p) => filter === 'all' || (filter === 'draft' ? p.status === 'draft' : p.status !== 'draft'));
  const { pageItems, pager } = usePaged(posts);
  return (
    <section className="ch-card" aria-labelledby="ch-px" data-testid="ch-post-examples">
      <div className="ch-card-head">
        <span className="ch-head-icon" aria-hidden="true"><ImagePlus size={20} /></span>
        <span className="ch-head-text">
          <h2 id="ch-px" className="ch-h2">Post examples</h2>
          <span className="ch-note">How they sound on The Pulse</span>
        </span>
      </div>
      <div className="ch-filter" role="group" aria-label="Show posts">
        {POST_FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`ch-filter-btn${filter === k ? ' is-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      {!trail ? <p className="ch-note">Loading…</p>
        : trail.error ? <p className="ch-note" role="alert">{trail.error}</p>
        : posts.length === 0 ? <p className="ch-note">{filter === 'all' ? 'No posts yet.' : filter === 'draft' ? 'No drafts.' : 'Nothing posted yet.'}</p>
        : (
          <ul className="ch-px">
            {pageItems.map((p) => (
              <li key={p.id} className="ch-px-item">
                <span className="ch-px-text">{shortText(p.text, 200)}</span>
                <span className={`ch-px-status${p.status === 'draft' ? ' is-draft' : ''}`}>{p.status === 'draft' ? 'Draft' : 'Posted'}</span>
                <span className="ch-px-meta">
                  {[p.episode_number != null ? `Episode ${p.episode_number}` : null, activityDate(p.at) ? activityWhen(activityDate(p.at)) : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      <Pager {...pager} label="Posts" />
      <div className="ch-px-actions">
        {character.feed_profile_id && <button type="button" className="ch-btn" onClick={onDraft}><Plus size={15} aria-hidden="true" /> Draft new posts</button>}
        {feedProfile && <Link className="ch-btn-soft ch-px-link" to={feedProfileLink(feedProfile)}><ExternalLink size={15} aria-hidden="true" /> View Pulse profile</Link>}
      </div>
    </section>
  );
}

function TabVoice({ character, feedProfile, appearances, onSaved, onFeedSaved }) {
  const trail = useStoryTrail(character.id);
  const draftRef = useRef(null);
  const [drafting, setDrafting] = useState(false);
  useEffect(() => {
    if (drafting) draftRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [drafting]);
  return (
    <div className="ch-overview ch-voice-grid">
      <div className="ch-col">
        <VoiceProfile character={character} feedProfile={feedProfile} onSaved={onSaved} />
        <PublicPrivateVoice character={character} feedProfile={feedProfile} />
      </div>
      <div className="ch-col">
        <FeedBehavior character={character} feedProfile={feedProfile} appearances={appearances} onFeedSaved={onFeedSaved} />
        {character.feed_profile_id && <PostingSchedule profileId={character.feed_profile_id} />}
        {character.feed_profile_id && <PulseTrust profileId={character.feed_profile_id} />}
      </div>
      <div className="ch-col">
        <OnThePulse character={character} />
        <PostExamples character={character} feedProfile={feedProfile} trail={trail} onDraft={() => setDrafting(true)} />
        {/* Evoni, 2026-10-17: drafting their posts belongs with their voice and feed. */}
        {drafting && character.feed_profile_id && (
          <div className="ch-card" ref={draftRef}><GeneratePosts characterId={character.id} /></div>
        )}
      </div>
    </div>
  );
}

/**
 * On The Pulse (Evoni, 2026-10-18: "when a character has a voice and even
 * makes post they are not showing up on the pulse"): how many of their posts
 * are live, waiting in Review, scheduled or held, and anything else keeping
 * them off The Pulse (services/pulseVisibility). Whether Lala has met them
 * does not matter (Evoni, 2026-10-18).
 */
export function OnThePulse({ character }) {
  const [v, setV] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await pulseVisibilityApi(character.id);
      setV(data); setError(null);
    } catch (err) {
      console.error('[CharacterProfilePage] Pulse visibility could not be read:', err);
      setError('Could not check The Pulse.');
    }
  }, [character.id]);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="ch-card" data-testid="on-the-pulse"><p className="ch-note">{error}</p></div>;
  if (!v) return null;
  const next = v.scheduled?.[0]?.release_at ? new Date(v.scheduled[0].release_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <div className="ch-card ch-pulse-vis" data-testid="on-the-pulse">
      <h3 className="ch-fb-h">On The Pulse</h3>
      {v.profile ? (
        <ul className="ch-pulse-vis-counts">
          <li><strong>{v.live_count}</strong> live</li>
          <li><strong>{v.draft_count}</strong> waiting in <Link to="/admin?tab=pulse&sub=review">Review</Link></li>
          {v.scheduled?.length > 0 && <li><strong>{v.scheduled.length}</strong> scheduled{next ? ` (next: ${next})` : ''}</li>}
          {v.held_count > 0 && <li><strong>{v.held_count}</strong> held</li>}
        </ul>
      ) : null}
      {(v.reasons || []).map((r) => <p key={r} className="ch-note">{r}</p>)}
      {!v.reasons?.length && <p className="ch-note">Their live posts show on The Pulse.</p>}
    </div>
  );
}

/* ── Tab 5: World ────────────────────────────────────────────────────────────── */

function GhostPromote({ character, ghost, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const promote = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await promoteGhostApi(character.id, ghost.name, character.registry_id);
      const made = res.data?.character;
      onSaved({ ghost_characters: (character.ghost_characters || []).map((g) => (
        g.name === ghost.name ? { ...g, promoted: true, promoted_id: made?.id } : g)) });
    } catch (err) {
      console.error('[CharacterProfilePage] promote ghost failed:', err);
      setNote(err.response?.data?.error || 'Could not promote them.');
    } finally { setBusy(false); }
  };
  return (<>
    <button type="button" className="cp-btn-promote" disabled={busy} onClick={promote}>{busy ? 'Promoting…' : 'Promote'}</button>
    {note && <span className="ch-note is-error" role="status">{note}</span>}
  </>);
}

/* ── In the World (Evoni's mock, 2026-10-18, step 5) ───────────────────────────
   Where they live and what they are in the LalaVerse, the DREAM city map
   with their home, their events by date, their story in the world (living
   state, arc, threads, ambition), their places, their latest posts, the
   people their story names who are not built yet, and their family. */

const WORLDS = [['book-1', 'Book 1 — JustAWoman’s World'], ['lalaverse', 'LalaVerse'], ['series-2', 'Series 2']];

export function WorldPresence({ character, feedProfile, appearances, onSaved }) {
  const [note, setNote] = useState(null);
  const city = cityOf(character, feedProfile);
  const dream = dreamCityOf(city.label);
  const hosts = (appearances?.events || []).some((e) => e.role === 'host');
  const role = [roleOf(character), hosts ? 'Event host' : null].filter(Boolean).join(' · ');
  const locked = character.status === 'finalized';
  const setWorld = async (world) => {
    if (!world) return;
    setNote(null);
    try {
      await updateCharacterApi(character.id, { world });
      onSaved({ world });
    } catch (err) {
      console.error('[CharacterProfilePage] world update failed:', err);
      setNote('Could not change their world.');
    }
  };
  const rows = [
    { key: 'city', label: 'Home city', icon: MapPin, value: city.label, sub: dream ? `Capital of ${dream.capital.toLowerCase()}` : null },
    { key: 'home', label: 'Lives at', icon: Building2, value: appearances?.place?.name || null, sub: appearances?.place ? 'Their home place' : null },
    { key: 'appearance', label: 'Appears as', icon: Eye, value: character.appearance_mode ? words(character.appearance_mode) : null },
    { key: 'role', label: 'World role', icon: Star, value: role || null },
  ];
  return (
    <section className="ch-card" aria-labelledby="ch-wp" data-testid="ch-world-presence">
      <div className="ch-card-head">
        <span className="ch-head-icon" aria-hidden="true"><Globe2 size={20} /></span>
        <span className="ch-head-text">
          <h2 id="ch-wp" className="ch-h2">World presence</h2>
          <span className="ch-note">Where they live and what they are in the world</span>
        </span>
      </div>
      <ul className="ch-wp">
        {rows.map(({ key, label, icon: Icon, value, sub }) => (
          <li key={key} className="ch-wp-row">
            <span className="ch-wp-icon" aria-hidden="true"><Icon size={18} /></span>
            <span className="ch-wp-label">{label}</span>
            <span className="ch-wp-value">
              <strong className={value ? '' : 'is-empty'}>{value || 'Not set'}</strong>
              {sub && <span>{sub}</span>}
            </span>
          </li>
        ))}
        <li className="ch-wp-row">
          <span className="ch-wp-icon" aria-hidden="true"><BookOpen size={18} /></span>
          <label className="ch-wp-label" htmlFor="ch-world-select">Story world</label>
          <span className="ch-wp-value">
            <select id="ch-world-select" className="ch-wp-select" value={character.world || ''} disabled={locked} onChange={(e) => setWorld(e.target.value)}>
              {/* No world set reads as not set, not as Book 1. */}
              {!character.world && <option value="">Not set</option>}
              {WORLDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </span>
        </li>
      </ul>
      {city.differs && <p className="ch-note is-error">Their Pulse profile says {city.differs.feed}; their character record says {city.differs.own}.</p>}
      {note && <p className="ch-note is-error" role="alert">{note}</p>}
    </section>
  );
}

export function LalaVerseMap({ character, feedProfile }) {
  const home = dreamCityOf(cityOf(character, feedProfile).label);
  return (
    <section className="ch-card" aria-labelledby="ch-map" data-testid="ch-lalaverse-map">
      <div className="ch-card-head">
        <span className="ch-head-icon" aria-hidden="true"><MapPin size={20} /></span>
        <span className="ch-head-text">
          <h2 id="ch-map" className="ch-h2">LalaVerse map</h2>
          <span className="ch-note">The five DREAM cities{home ? `; they live in ${home.label}` : ''}</span>
        </span>
      </div>
      <div className="ch-map" role="list" aria-label="DREAM cities">
        {DREAM_CITIES.map((c) => (
          <span key={c.key} role="listitem" className={`ch-map-pin${home?.key === c.key ? ' is-home' : ''}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            <MapPin size={16} aria-hidden="true" />
            <span><strong>{c.label}</strong><span>{c.capital}{home?.key === c.key ? ' (Home)' : ''}</span></span>
          </span>
        ))}
      </div>
      {!home && <p className="ch-note">No home city in the LalaVerse yet. Set it in their facts or Pulse profile.</p>}
    </section>
  );
}

const eventTime = (ev) => {
  const d = activityDate(ev.event_date);
  return d ? d.getTime() : null;
};

export function WorldEvents({ appearances, now = Date.now() }) {
  const events = [...(appearances?.events || [])].sort((a, b) => {
    const ta = eventTime(a); const tb = eventTime(b);
    if (ta === null || tb === null) return (ta === null) - (tb === null);
    // Upcoming soonest first, then past most recent first.
    const fa = ta >= now; const fb = tb >= now;
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? ta - tb : tb - ta;
  });
  const { pageItems, pager } = usePaged(events, 3);
  return (
    <section className="ch-card" aria-labelledby="ch-we" data-testid="ch-world-events">
      <h2 id="ch-we" className="ch-h2"><CalendarDays size={20} aria-hidden="true" className="ch-h2-icon" /> Their events</h2>
      {!appearances ? <p className="ch-note">Loading…</p>
        : events.length === 0 ? <p className="ch-note">No events yet: they host or attend none.</p> : (
          <ul className="ch-we">
            {pageItems.map((ev) => {
              const t = eventTime(ev);
              const when = t !== null ? activityWhen(new Date(t)) : ev.event_date || 'No date yet';
              return (
                <li key={ev.id}>
                  <Link className="ch-we-item" to={`/shows/${ev.show_id}/events/${ev.id}`}>
                    <span className="ch-we-text">
                      <strong>{ev.name}</strong>
                      <span className="ch-conn-top">
                        <span className={`ch-tension ${ev.role === 'host' ? 'is-volatile' : 'is-healing'}`}>{ev.role === 'host' ? 'Host' : 'Guest'}</span>
                        {ev.episode && <span className="ch-tension">Episode {ev.episode.episode_number ?? '?'}</span>}
                        {t !== null && t < now && <span className="ch-chip">Past</span>}
                      </span>
                      <span className="ch-we-meta">{[`${when}${ev.event_time ? ` · ${ev.event_time}` : ''}`, ev.venue_name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" className="ch-show-go" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      <Pager {...pager} label="Their events" />
    </section>
  );
}

export function StoryInWorld({ character, gen }) {
  const living = hasValue(character.living_state) ? objOf(character.living_state) : null;
  const threads = [character.plot_threads, character.extra_fields?.plot_threads].find((t) => Array.isArray(t) && t.length) || [];
  const ambition = dimensionText(dimension(character.deep_profile, 'ambition_identity'));
  const { pageItems, pager } = usePaged(threads, 4);
  const chips = [
    character.arc_stage ? `Arc: ${words(character.arc_stage)}` : null,
    character.time_orientation ? `Lives in the ${words(character.time_orientation).toLowerCase()}` : null,
  ].filter(Boolean);
  const fields = living ? [['Right now', living.current_situation], ['The tension', living.active_tension], ['Momentum', living.momentum]].filter(([, v]) => textOf(v)) : [];
  return (
    <section className="ch-card" aria-labelledby="ch-sw" data-testid="ch-story-world">
      <h2 id="ch-sw" className="ch-h2"><BookOpen size={20} aria-hidden="true" className="ch-h2-icon" /> Their story in the world</h2>
      {fields.length ? (
        <ul className="ch-rules-list">
          {fields.map(([k, v]) => <li key={k}><span className="ch-wf-kind">{k}</span>{v}</li>)}
        </ul>
      ) : <EmptyState label="Living state not generated yet." gen={gen} fields={['living_state']} />}
      {chips.length > 0 && <div className="ch-chips">{chips.map((c) => <span key={c} className="ch-chip">{c}</span>)}</div>}
      {ambition && (
        <div className="ch-fb-block">
          <h3 className="ch-fb-h">Career and ambition</h3>
          <p>{ambition}</p>
        </div>
      )}
      {threads.length > 0 && (
        <div className="ch-fb-block">
          <h3 className="ch-fb-h">Plot threads</h3>
          <ul className="ch-rules-list">
            {pageItems.map((t, i) => (
              <li key={t.id || i}>{typeof t === 'string' ? t : t.title || t.name || t.label}{t.status ? ` · ${words(t.status)}` : ''}</li>
            ))}
          </ul>
          <Pager {...pager} label="Plot threads" />
        </div>
      )}
    </section>
  );
}

export function WorldPlaces({ character, openTab }) {
  const [data, setData] = useState(null);
  const id = character.id;
  useEffect(() => {
    let live = true;
    getPlacesApi(id)
      .then((res) => { if (live) setData(res.data || { places: [] }); })
      .catch((err) => {
        console.error('[CharacterProfilePage] world places load failed:', err);
        if (live) setData({ places: [], error: err.response?.data?.error || 'Could not load their places.' });
      });
    return () => { live = false; };
  }, [id]);
  const places = data?.places || [];
  const { pageItems, pager } = usePaged(places, 4);
  return (
    <section className="ch-card" aria-labelledby="ch-wpl" data-testid="ch-world-places">
      <div className="ch-card-head">
        <h2 id="ch-wpl" className="ch-h2"><MapPin size={20} aria-hidden="true" className="ch-h2-icon" /> Their places</h2>
        {openTab && <button type="button" className="ch-pill-btn" onClick={() => openTab('places')}>View all</button>}
      </div>
      {!data ? <p className="ch-note">Loading…</p>
        : data.error ? <p className="ch-note is-error">{data.error}</p>
        : places.length === 0 ? <p className="ch-note">No places yet: no home, closet or place of work.</p> : (
          <ul className="ch-wpl">
            {pageItems.map((p) => (
              <li key={`${p.role}-${p.scene_set_id}`} className="ch-wpl-item">
                {p.image_url ? <img src={p.image_url} alt="" /> : <span className="ch-wpl-empty" aria-hidden="true"><MapPin size={20} /></span>}
                <strong>{p.scene_set_name}</strong>
                <span>{PLACE_LABEL[p.role] || p.label || 'Place'}</span>
              </li>
            ))}
          </ul>
        )}
      <Pager {...pager} label="Their places" />
    </section>
  );
}

export function WorldFeed({ trail, openTab }) {
  const posts = (trail?.posts || []).filter((p) => p.status !== 'draft').slice(0, 3);
  return (
    <section className="ch-card" aria-labelledby="ch-wf" data-testid="ch-world-feed">
      <div className="ch-card-head">
        <h2 id="ch-wf" className="ch-h2"><Radio size={20} aria-hidden="true" className="ch-h2-icon" /> On The Pulse lately</h2>
        {openTab && <button type="button" className="ch-pill-btn" onClick={() => openTab('voice')}>View all</button>}
      </div>
      {!trail ? <p className="ch-note">Loading…</p>
        : posts.length === 0 ? <p className="ch-note">Nothing posted yet.</p> : (
          <ul className="ch-activity">
            {posts.map((p) => (
              <li key={p.id}>
                <div className="ch-activity-row">
                  <span className="ch-activity-icon is-post" aria-hidden="true"><FileText size={15} /></span>
                  <span className="ch-activity-text"><strong>{shortText(p.text, 70)}</strong>{p.episode_number != null && <span>Episode {p.episode_number}</span>}</span>
                  {activityDate(p.at) && <span className="ch-activity-when">{activityWhen(activityDate(p.at))}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

function GhostsCard({ character, onSaved }) {
  const ghosts = Array.isArray(character.ghost_characters) ? character.ghost_characters : [];
  const { pageItems, pager } = usePaged(ghosts);
  if (!ghosts.length) return null;
  return (
    <section className="ch-card" aria-labelledby="ch-gh" data-testid="ch-ghosts">
      <h2 id="ch-gh" className="ch-h2"><Users size={20} aria-hidden="true" className="ch-h2-icon" /> Not built yet <span className="ch-chip">{ghosts.length}</span></h2>
      <p className="ch-note">People their story names who aren&rsquo;t in the registry yet.</p>
      <ul className="ch-ft">
        {pageItems.map((g, i) => (
          <li key={`${g.name}-${i}`} className="ch-ft-item">
            <strong className="ch-conn-name">{g.name}</strong>
            {g.relation && <span className="ch-ft-meta">{g.relation}</span>}
            <span className="ch-ft-chips">
              {!g.promoted && <GhostPromote character={character} ghost={g} onSaved={onSaved} />}
              {g.promoted && (g.promoted_id
                ? <Link className="cp-promoted-badge" to={`/character/${g.promoted_id}`}>&uarr; In Registry</Link>
                : <span className="cp-promoted-badge">&uarr; In Registry</span>)}
            </span>
          </li>
        ))}
      </ul>
      <Pager {...pager} label="Not built yet" />
    </section>
  );
}

// Their family: ties, their named family, + Add family, Make them a
// character and Import family (components/CharacterFamily; Evoni, 2026-10-23).
// It took the place of the read-only FamilyCard.

function TabWorld({ character, feedProfile, appearances, onSaved, gen, openTab }) {
  const trail = useStoryTrail(character.id);
  return (
    <div className="ch-overview ch-world-grid">
      <div className="ch-col">
        <WorldPresence character={character} feedProfile={feedProfile} appearances={appearances} onSaved={onSaved} />
        <StoryInWorld character={character} gen={gen} />
      </div>
      <div className="ch-col">
        <LalaVerseMap character={character} feedProfile={feedProfile} />
        <WorldPlaces character={character} openTab={openTab} />
        <FamilySection character={character} />
      </div>
      <div className="ch-col">
        <WorldEvents appearances={appearances} />
        <WorldFeed trail={trail} openTab={openTab} />
        <GhostsCard character={character} onSaved={onSaved} />
      </div>
    </div>
  );
}

/* ── Story & Events (Evoni's mock, 2026-10-18, step 6) ─────────────────────────
   Everything their story is made of, in one tab with its own sections: an
   overview (counts, their latest episode, what is coming up, recent posts,
   Lala's goals at their events, the timeline ahead), then each list in full
   with pages. Episodes and events are their cast appearances; posts,
   stories and chapters are their story trail. */

const STORY_SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'episodes', label: 'Episodes', icon: CirclePlay },
  { key: 'posts', label: 'Pulse posts', icon: FileText },
  { key: 'stories', label: 'Stories & chapters', icon: BookOpen },
  { key: 'timeline', label: 'Timeline', icon: Activity },
];

const upcomingOf = (appearances, now) => (appearances?.events || []).filter((e) => (eventTime(e) ?? -1) >= now);

/** Lala's goals at their events, each with the event it comes from. */
export const goalsOf = (appearances) => (appearances?.events || []).flatMap((ev) => (ev.goals || []).map((g, i) => ({
  key: `${ev.id}-${g.id || i}`, label: g.label, event: ev,
})));

function StoryTiles({ appearances, trail, now }) {
  const posts = trail?.posts || [];
  const live = posts.filter((p) => p.status !== 'draft').length;
  const tiles = [
    { key: 'episodes', label: 'Episodes', n: (appearances?.episodes || []).length, sub: null, icon: CirclePlay, tone: 'pink' },
    { key: 'events', label: 'Events', n: (appearances?.events || []).length, sub: `${upcomingOf(appearances, now).length} upcoming`, icon: CalendarDays, tone: 'green' },
    { key: 'posts', label: 'Pulse posts', n: posts.length, sub: `${live} posted`, icon: FileText, tone: 'lavender' },
    { key: 'goals', label: "Lala's goals", n: goalsOf(appearances).length, sub: 'at their events', icon: Star, tone: 'gold' },
    { key: 'stories', label: 'Stories & chapters', n: (trail?.stories || []).length + (trail?.chapters || []).length, sub: null, icon: BookOpen, tone: 'pink' },
  ];
  return (
    <ul className="ch-st-tiles" data-testid="ch-story-tiles">
      {tiles.map(({ key, label, n, sub, icon: Icon, tone }) => (
        <li key={key} className={`ch-ro-tile is-${tone}`}>
          <Icon size={20} aria-hidden="true" />
          <strong>{n}</strong>
          <span>{label}</span>
          {sub && <span className="ch-st-sub">{sub}</span>}
        </li>
      ))}
    </ul>
  );
}

function EpisodeList({ appearances, limit }) {
  const episodes = [...(appearances?.episodes || [])].sort((a, b) => (b.episode_number ?? -1) - (a.episode_number ?? -1));
  const eventFor = (ep) => (appearances?.events || []).find((ev) => ev.episode?.id === ep.id || ev.episode?.episode_number === ep.episode_number);
  const { pageItems, pager } = usePaged(episodes, limit || 5);
  const rows = limit ? episodes.slice(0, limit) : pageItems;
  if (!appearances) return <p className="ch-note">Loading…</p>;
  if (!episodes.length) return <p className="ch-note">Not in an episode yet.</p>;
  return (
    <>
      <ul className="ch-we">
        {rows.map((ep) => {
          const ev = eventFor(ep);
          return (
            <li key={ep.id}>
              <Link className="ch-we-item" to={`/episodes/${ep.id}`}>
                <span className="ch-ep-badge">Episode {ep.episode_number ?? '?'}</span>
                <span className="ch-we-text">
                  <strong>{ep.title || 'Untitled'}</strong>
                  {ev && <span className="ch-we-meta">{[ev.name, ev.role === 'host' ? 'Hosting' : 'Guest'].join(' · ')}</span>}
                </span>
                <ArrowRight size={16} aria-hidden="true" className="ch-show-go" />
              </Link>
            </li>
          );
        })}
      </ul>
      {!limit && <Pager {...pager} label="Episodes" />}
    </>
  );
}

function EventCards({ events, now }) {
  return (
    <ul className="ch-ev-cards">
      {events.map((ev) => {
        const t = eventTime(ev);
        const d = t !== null ? new Date(t) : null;
        const purpose = eventPurpose(ev);
        return (
          <li key={ev.id}>
            <Link className="ch-ev-card" to={`/shows/${ev.show_id}/events/${ev.id}`}>
              <span className="ch-ev-date">
                {d ? (<>
                  <span>{d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
                  <strong>{d.getUTCDate()}</strong>
                  <span>{d.getUTCFullYear()}</span>
                </>) : <span>No date</span>}
              </span>
              <span className="ch-we-text">
                <span className="ch-conn-top">
                  <span className={`ch-tension ${ev.role === 'host' ? 'is-volatile' : 'is-healing'}`}>{ev.role === 'host' ? 'Host' : 'Guest'}</span>
                  {t !== null && t < now && <span className="ch-chip">Past</span>}
                </span>
                <strong>{ev.name}</strong>
                <span className="ch-we-meta">{[ev.event_time, ev.venue_name].filter(Boolean).join(' · ') || ' '}</span>
                {purpose && <span className="ch-conn-note">{shortText(purpose, 160)}</span>}
              </span>
              <ArrowRight size={16} aria-hidden="true" className="ch-show-go" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StoriesChapters({ trail }) {
  const stories = trail?.stories || [];
  const chapters = trail?.chapters || [];
  const s = usePaged(stories);
  const c = usePaged(chapters);
  if (!trail) return <p className="ch-note">Loading…</p>;
  if (trail.error) return <p className="ch-note" role="alert">{trail.error}</p>;
  if (!stories.length && !chapters.length) return <p className="ch-note">Not in a story or chapter yet.</p>;
  return (
    <>
      {stories.length > 0 && (
        <div className="ch-trail">
          <h3 className="ch-trail-h">Stories</h3>
          <ul className="ch-trail-list">
            {s.pageItems.map((st) => (
              <li key={st.id}>
                <Link to={st.show_id ? `/stories?show=${st.show_id}` : '/stories'} className="ch-trail-text">{st.title || 'Untitled'}</Link>
                <span className="ch-trail-meta">{[STORY_FORMATS[st.format] || st.format, st.episode_number != null ? `Episode ${st.episode_number}` : null, st.status].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <Pager {...s.pager} label="Stories" />
        </div>
      )}
      {chapters.length > 0 && (
        <div className="ch-trail">
          <h3 className="ch-trail-h">Chapters</h3>
          <ul className="ch-trail-list">
            {c.pageItems.map((ch) => (
              <li key={ch.id}>
                <Link to={`/chapter/${ch.book_id}/${ch.id}`} className="ch-trail-text">{ch.title || `Chapter ${ch.chapter_number ?? ''}`.trim()}</Link>
                <span className="ch-trail-meta">{[ch.book_title, ch.written ? null : 'not written yet'].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <Pager {...c.pager} label="Chapters" />
        </div>
      )}
    </>
  );
}

/** Their story in order: dated posts and events oldest first, then episodes. */
export const timelineOf = (appearances, trail) => {
  const all = activityOf(appearances, trail);
  const dated = all.filter((x) => x.at).sort((a, b) => a.at - b.at);
  return [...dated, ...all.filter((x) => !x.at)];
};

/** `size` items of the timeline from today on (the latest ones when less is ahead). */
export const timelineNow = (items, now, size) => {
  const ahead = items.findIndex((x) => x.at && x.at.getTime() >= now);
  const dated = items.filter((x) => x.at).length;
  const from = ahead === -1 ? Math.max(0, dated - size) : Math.max(0, Math.min(ahead, dated - size));
  return items.slice(from, from + size);
};

// The whole timeline with pages; with `now`, only the stretch from today (the overview's strip).
function StoryTimeline({ appearances, trail, size = 6, now = null }) {
  const items = timelineOf(appearances, trail);
  const { pageItems, pager } = usePaged(items, size);
  const shown = now === null ? pageItems : timelineNow(items, now, size);
  if (!items.length) return <p className="ch-note">Nothing on their timeline yet.</p>;
  return (
    <>
      <ol className="ch-tl">
        {shown.map((x) => {
          const Icon = ACTIVITY_ICONS[x.kind];
          const body = (<>
            <span className={`ch-activity-icon is-${x.kind}`} aria-hidden="true"><Icon size={15} /></span>
            <span className="ch-tl-when">{x.at ? activityWhen(x.at) : x.when || 'No date'}</span>
            <strong>{x.title}</strong>
            {x.sub && <span className="ch-tl-sub">{x.sub}</span>}
          </>);
          return <li key={x.key} className="ch-tl-item">{x.to ? <Link className="ch-tl-body" to={x.to}>{body}</Link> : <div className="ch-tl-body">{body}</div>}</li>;
        })}
      </ol>
      {now === null && <Pager {...pager} label="Timeline" />}
    </>
  );
}

function StoryCard({ id, title, icon: Icon, action, children, testid }) {
  return (
    <section className="ch-card" aria-labelledby={id} data-testid={testid}>
      <div className="ch-card-head">
        <h2 id={id} className="ch-h2"><Icon size={20} aria-hidden="true" className="ch-h2-icon" /> {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TabStory({ character, feedProfile, appearances, openTab, now = Date.now() }) {
  const [section, setSection] = useState('overview');
  const trail = useStoryTrail(character.id);
  const go = (key) => <button type="button" className="ch-pill-btn" onClick={() => setSection(key)}>View all</button>;
  const upcoming = [...upcomingOf(appearances, now)].sort((a, b) => eventTime(a) - eventTime(b));
  const allEvents = [...(appearances?.events || [])].sort((a, b) => {
    const ta = eventTime(a); const tb = eventTime(b);
    if (ta === null || tb === null) return (ta === null) - (tb === null);
    return tb - ta;
  });
  const events = usePaged(allEvents, 4);
  const goals = goalsOf(appearances);
  const goalPages = usePaged(goals);
  const recent = (trail?.posts || []).slice(0, 4);
  return (
    <div className="ch-story" data-testid="ch-story-tab">
      <nav className="ch-st-nav" aria-label="Story sections">
        {STORY_SECTIONS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className={`ch-st-link${section === key ? ' is-on' : ''}`} aria-pressed={section === key} onClick={() => setSection(key)}>
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {section === 'overview' && (
        <>
          <StoryTiles appearances={appearances} trail={trail} now={now} />
          <div className="ch-overview">
            <div className="ch-col">
              <StoryCard id="ch-st-ep" title="Latest episode" icon={CirclePlay} testid="ch-st-latest" action={go('episodes')}>
                <EpisodeList appearances={appearances} limit={1} />
              </StoryCard>
              <StoryCard id="ch-st-goals" title="Lala's goals at their events" icon={Star} testid="ch-st-goals">
                {goals.length === 0 ? <p className="ch-note">No goals at their events yet.</p> : (
                  <>
                    <ul className="ch-rules-list">
                      {goalPages.pageItems.map((g) => <li key={g.key}><strong>{g.label}</strong><span className="ch-wf-kind">At {g.event.name}</span></li>)}
                    </ul>
                    <Pager {...goalPages.pager} label="Goals" />
                  </>
                )}
              </StoryCard>
            </div>
            <div className="ch-col">
              <StoryCard id="ch-st-up" title="Coming up" icon={CalendarDays} testid="ch-st-upcoming" action={go('events')}>
                {!appearances ? <p className="ch-note">Loading…</p>
                  : upcoming.length === 0 ? <p className="ch-note">Nothing coming up.</p>
                  : <EventCards events={upcoming.slice(0, 2)} now={now} />}
              </StoryCard>
            </div>
            <div className="ch-col">
              <StoryCard id="ch-st-posts" title="Recent Pulse posts" icon={FileText} testid="ch-st-posts" action={go('posts')}>
                {!trail ? <p className="ch-note">Loading…</p> : recent.length === 0 ? <p className="ch-note">No posts yet.</p> : (
                  <ul className="ch-px">
                    {recent.map((p) => (
                      <li key={p.id} className="ch-px-item">
                        <span className="ch-px-text">{shortText(p.text, 90)}</span>
                        <span className={`ch-px-status${p.status === 'draft' ? ' is-draft' : ''}`}>{p.status === 'draft' ? 'Draft' : 'Posted'}</span>
                        <span className="ch-px-meta">{activityDate(p.at) ? activityWhen(activityDate(p.at)) : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </StoryCard>
            </div>
          </div>
          <StoryCard id="ch-st-tl" title="Story timeline" icon={Activity} testid="ch-st-timeline" action={go('timeline')}>
            <StoryTimeline appearances={appearances} trail={trail} size={4} now={now} />
          </StoryCard>
        </>
      )}

      {section === 'events' && (
        <StoryCard id="ch-st-events" title="Their events" icon={CalendarDays} testid="ch-st-events">
          {!appearances ? <p className="ch-note">Loading…</p>
            : allEvents.length === 0 ? <p className="ch-note">No events yet: they host or attend none.</p>
            : <><EventCards events={events.pageItems} now={now} /><Pager {...events.pager} label="Events" /></>}
        </StoryCard>
      )}
      {section === 'episodes' && (
        <StoryCard id="ch-st-eps" title="Their episodes" icon={CirclePlay} testid="ch-st-episodes">
          <EpisodeList appearances={appearances} />
        </StoryCard>
      )}
      {section === 'posts' && (
        <PostExamples character={character} feedProfile={feedProfile} trail={trail} onDraft={() => openTab('voice')} />
      )}
      {section === 'stories' && (
        <StoryCard id="ch-st-stories" title="Stories and chapters" icon={BookOpen} testid="ch-st-stories">
          <StoriesChapters trail={trail} />
        </StoryCard>
      )}
      {section === 'timeline' && (
        <StoryCard id="ch-st-tl-full" title="Story timeline" icon={Activity} testid="ch-st-timeline-full">
          <StoryTimeline appearances={appearances} trail={trail} />
        </StoryCard>
      )}
    </div>
  );
}

/* ── Settings (Evoni's mock, 2026-10-18, step 8: "what already works") ───────────
   Their status (draft, accepted, declined, finalized: finalized locks
   editing), whether The cast keeps them, their feed profile, sharing and
   export, and the danger zone: archive (they leave the cast and the page),
   then bring them back or delete them for good, which asks for their name
   typed out and is refused while an episode or anything else still uses
   them. The mock's notifications, permissions and automations have nothing
   behind them yet. */

const STATUSES = [
  ['draft', 'Draft', 'Still being written.'],
  ['accepted', 'Accepted', 'In the cast; editable.'],
  ['declined', 'Declined', 'Not used.'],
  ['finalized', 'Finalized', 'Locked: nothing on this page can be edited until you change it back.'],
];

function SettingRow({ label, hint, children, htmlFor }) {
  return (
    <div className="ch-set-row">
      <div className="ch-set-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {hint && <span className="ch-note">{hint}</span>}
      </div>
      <div className="ch-set-control">{children}</div>
    </div>
  );
}

export function TabSettings({ character, feedProfile, onSaved, onExport, onDeleted }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [archived, setArchived] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const name = character.display_name || character.selected_name || 'this character';
  const kept = character.cast_review === 'kept';
  const link = typeof window !== 'undefined' ? `${window.location.origin}/character/${character.id}` : `/character/${character.id}`;

  const act = async (what, call, done) => {
    setBusy(what); setNote(null);
    try {
      await call();
      if (done) setNote({ text: done });
      return true;
    } catch (err) {
      console.error(`[CharacterProfilePage] settings ${what} failed:`, err);
      setNote({ error: true, text: err.response?.data?.error || 'That did not work. Try again.' });
      return false;
    } finally { setBusy(null); }
  };
  const setStatus = (status) => act('status', async () => {
    const res = await setStatusApi(character.id, status);
    onSaved({ status: res.data?.character?.status || status });
  }, 'Status saved.');
  const setKept = (next) => act('keep', async () => {
    const res = await keepApi(character.id, next);
    onSaved({ cast_review: res.data?.cast_review ?? (next ? 'kept' : null) });
  }, next ? 'Kept in the cast.' : 'No longer marked as kept.');
  const copyLink = () => act('copy', () => navigator.clipboard.writeText(link), 'Link copied.');
  const archive = () => act('archive', async () => { await archiveApi(character.id); setArchived(true); },
    `${name} is archived: out of the cast, The Pulse and this page once you leave it.`);
  const restore = () => act('restore', async () => { await restoreApi(character.id); setArchived(false); setConfirming(false); setTyped(''); },
    `${name} is back.`);
  const removeForGood = async () => {
    if (await act('delete', () => deleteForGoodApi(character.id))) onDeleted();
  };

  return (
    <div className="ch-overview ch-settings" data-testid="ch-settings">
      <div className="ch-col">
        <section className="ch-card" aria-labelledby="ch-set-vis">
          <h2 id="ch-set-vis" className="ch-h2"><Users size={20} aria-hidden="true" className="ch-h2-icon" /> Profile and status</h2>
          <SettingRow label="Status" htmlFor="ch-set-status" hint={STATUSES.find(([k]) => k === character.status)?.[2]}>
            <select id="ch-set-status" className="ch-wp-select" value={character.status || 'draft'} disabled={!!busy || archived} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </SettingRow>
          <SettingRow label="Kept in the cast" hint="The cast's review: kept characters are past review.">
            <label className="ch-switch">
              <input type="checkbox" role="switch" checked={kept} disabled={!!busy || archived} onChange={(e) => setKept(e.target.checked)} aria-label="Kept in the cast" />
              <span aria-hidden="true" />
              {kept ? 'Kept' : 'Not yet'}
            </label>
          </SettingRow>
        </section>
      </div>

      <div className="ch-col">
        <section className="ch-card" aria-labelledby="ch-set-feed">
          <h2 id="ch-set-feed" className="ch-h2"><Smartphone size={20} aria-hidden="true" className="ch-h2-icon" /> Pulse profile</h2>
          <SettingRow label="On The Pulse as" hint="One Pulse person per character.">
            {feedProfile
              ? <span className="ch-set-value"><strong>{atHandle(feedProfile.handle)}</strong>{feedProfile.display_name ? ` · ${feedProfile.display_name}` : ''}</span>
              : <span className="ch-note">No Pulse profile.</span>}
          </SettingRow>
          <Link className="ch-btn-soft ch-px-link" to="/character-registry">{feedProfile ? 'Match a different Pulse person on The cast' : 'Match them to a Pulse person on The cast'}</Link>
        </section>
        <section className="ch-card" aria-labelledby="ch-set-share">
          <h2 id="ch-set-share" className="ch-h2"><LinkIcon size={20} aria-hidden="true" className="ch-h2-icon" /> Sharing and export</h2>
          <SettingRow label="Export profile" hint="Their whole record as a file.">
            <button type="button" className="ch-pill-btn" onClick={onExport}><Download size={14} aria-hidden="true" /> Export profile</button>
          </SettingRow>
          <SettingRow label="Link to this page" hint="For the studio team; it needs a sign-in.">
            <span className="ch-set-link">
              <input readOnly value={link} aria-label="Link to this page" onFocus={(e) => e.target.select()} />
              <button type="button" className="ch-icon-btn" aria-label="Copy the link" onClick={copyLink}><Copy size={15} aria-hidden /></button>
            </span>
          </SettingRow>
        </section>
      </div>

      <div className="ch-col">
        <section className="ch-card ch-danger" aria-labelledby="ch-set-danger" data-testid="ch-danger">
          <h2 id="ch-set-danger" className="ch-h2"><AlertTriangle size={20} aria-hidden="true" className="ch-h2-icon" /> Danger zone</h2>
          {!archived ? (
            <SettingRow label="Archive" hint="Takes them out of the cast and The Pulse. You can bring them back.">
              <button type="button" className="ch-danger-btn" disabled={!!busy} onClick={archive}>
                <Archive size={14} aria-hidden="true" /> {busy === 'archive' ? 'Archiving…' : `Archive ${name}`}
              </button>
            </SettingRow>
          ) : (
            <>
              <SettingRow label="Bring back" hint="Undo the archive.">
                <button type="button" className="ch-pill-btn" disabled={!!busy} onClick={restore}>
                  <RotateCcw size={14} aria-hidden="true" /> {busy === 'restore' ? 'Bringing back…' : 'Bring back'}
                </button>
              </SettingRow>
              <SettingRow label="Delete permanently" hint="Removes them for good. Refused while an episode or anything else still uses them.">
                {!confirming ? (
                  <button type="button" className="ch-danger-btn" disabled={!!busy} onClick={() => setConfirming(true)}>
                    <Trash2 size={14} aria-hidden="true" /> Delete permanently
                  </button>
                ) : (
                  <span className="ch-set-confirm">
                    <label htmlFor="ch-set-typed">Type <strong>{name}</strong> to delete them for good.</label>
                    <input id="ch-set-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
                    <span className="ch-facts-row">
                      <button type="button" className="ch-danger-btn is-solid" disabled={!!busy || typed.trim() !== name} onClick={removeForGood}>
                        {busy === 'delete' ? 'Deleting…' : 'Delete for good'}
                      </button>
                      <button type="button" className="ch-btn-soft" disabled={!!busy} onClick={() => { setConfirming(false); setTyped(''); }}>Cancel</button>
                    </span>
                  </span>
                )}
              </SettingRow>
            </>
          )}
        </section>
      </div>
      {note && <p className={`ch-note ch-set-note${note.error ? ' is-error' : ''}`} role={note.error ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}

/* ── MAIN COMPONENT ──────────────────────────────────────────────────────────── */

export default function CharacterProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [character, setCharacter]         = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [entanglements, setEntanglements] = useState([]);
  const [feedProfile, setFeedProfile]     = useState(null);
  const [appearances, setAppearances]     = useState(null);
  // The open tab lives in the link (?tab=), so it can be shared, reopened and
  // gone back to; Overview has no ?tab.
  const [searchParams, setSearchParams]   = useSearchParams();
  const activeTab = tabOf(searchParams.get('tab'));
  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (tabOf(tab) === 'overview') nextParams.delete('tab'); else nextParams.set('tab', tab);
      return nextParams;
    });
  }, [setSearchParams]);
  const tabBarRef = useRef(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  // An archived character opened by an ADMIN: shown with "Bring back" (the profile audit, 2026-10-19).
  const [archived, setArchived]           = useState(false);
  const [restoring, setRestoring]         = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setAppearances(null);
    setArchived(false);
    try {
      // Everything starts at once (the profile audit, 2026-10-19): where they
      // show up needs only the id, and their Pulse profile starts as soon as
      // the character says which one, not after relationships and
      // entanglements too.
      getAppearancesApi(id)
        .then((res) => setAppearances(res.data))
        .catch((err) => { console.error('[CharacterProfilePage] appearances load failed:', err); setAppearances({ linked: false, events: [], episodes: [] }); });
      const charP = getCharacterApi(id);
      const feedP = charP.then((res) => {
        const fid = (res.data?.character || res.data)?.feed_profile_id;
        return fid ? getSocialProfileApi(fid) : null;
      }).catch((err) => { console.error('[CharacterProfilePage] feed profile load failed:', err); return null; });
      const [charRes, relRes, entRes] = await Promise.all([
        charP,
        getCharacterRelationshipsApi(id).catch((err) => { console.error('[CharacterProfilePage] relationships load failed:', err); return null; }),
        getCharacterEntanglementsApi(id).catch((err) => { console.error('[CharacterProfilePage] entanglements load failed:', err); return null; }),
      ]);

      const charData = charRes.data;
      const char = charData.character || charData;
      setCharacter(char);
      setArchived(Boolean(charData.archived));

      if (relRes) {
        const relData = relRes.data;
        setRelationships(relData.relationships || relData || []);
      }

      if (entRes) {
        const entData = entRes.data;
        setEntanglements(entData.entanglements || entData || []);
      }

      // Their profile, already on its way.
      const feedRes = await feedP;
      if (feedRes) {
        const feedData = feedRes.data;
        setFeedProfile(feedData.profile || feedData);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Character not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // The breadcrumb names them (components/Breadcrumbs, lib/pageTitle).
  const crumbName = character ? (character.display_name || character.selected_name || null) : null;
  const crumbPath = `/character/${id}`;
  useEffect(() => {
    setPageTitle(crumbPath, crumbName);
    return () => clearPageTitle(crumbPath);
  }, [crumbPath, crumbName]);

  // The tab bar scrolls sideways when its tabs don't fit: keep the open tab
  // in view by scrolling the bar itself. scrollIntoView also scrolled the
  // page's own layout sideways at laptop width (the profile audit, 2026-10-19).
  useEffect(() => {
    const bar = tabBarRef.current;
    const el = bar?.querySelector('.ch-tab.is-on');
    if (!bar || !el) return;
    const target = el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2;
    bar.scrollLeft = Math.max(0, target);
  }, [activeTab, loading]);

  const onSaved = useCallback((patch) => setCharacter((prev) => ({ ...prev, ...patch })), []);
  const onFeedSaved = useCallback((patch) => setFeedProfile((prev) => (prev ? { ...prev, ...patch } : prev)), []);
  const gen = useInteriorGenerate(character, onSaved);

  // Export: the character as JSON, to keep or share.
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.character_key || character.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="cp-loading">
      <div className="cp-loading-pulse" />
    </div>
  );

  if (error || !character) return (
    <div className="cp-error">
      <p>{error || 'Character not found'}</p>
      <button onClick={() => navigate(-1)}>&larr; Back</button>
    </div>
  );

  // Their real name when known; else the name they go by.
  const socialName = feedProfile?.display_name || character.display_name || null;
  const name = realNameOf(character, feedProfile) || character.display_name || character.name || 'Unnamed';
  // The saved stage, with what their fields already reach beside it (lib/characterPage depthStageOf).
  const { level: savedLevel, ready } = depthStageOf(character);
  const { index: depthIndex, step } = depthOf(savedLevel);
  // Deepen names the step after what their fields already reach.
  const { next } = depthOf(ready || savedLevel);
  // Inner life shows its own note for the same run.
  const deepenNote = gen.note?.key === 'all' && activeTab !== 'inner' ? gen.note : null;
  const handle = feedProfile?.handle ? `@${feedProfile.handle.replace(/^@/, '')}` : null;
  const { label: city, differs: cityDiffers } = cityOf(character, feedProfile);
  const archetype = archetypeOf(feedProfile);
  const firstEpisode = appearances?.episodes?.[0];
  const role = roleOf(character);
  const hosts = (appearances?.events || []).some((ev) => ev.role === 'host');
  // What they are, in a line: what they are known for, their role, that they host.
  const roles = [archetype, role, hosts ? 'Event host' : null].filter(Boolean);
  const hasVoice = !!voiceOf(character, feedProfile);

  return (
    <div className="ch-page">
      {archived && (
        <div className="ch-archived" role="status" data-testid="ch-archived">
          <strong>Archived.</strong> They are off The Cast and out of every writer until you bring them back.
          <button type="button" className="ch-pill-btn" disabled={!!restoring} onClick={async () => {
            setRestoring('busy');
            try {
              await restoreApi(character.id);
              await load();
              setRestoring(null);
            } catch (err) {
              console.error('[CharacterProfilePage] bring back failed:', err);
              setRestoring(err.response?.data?.error || 'Could not bring them back.');
            }
          }}>{restoring === 'busy' ? 'Bringing back…' : 'Bring back'}</button>
          {restoring && restoring !== 'busy' && <span className="ch-note is-error">{restoring}</span>}
        </div>
      )}
      <header className={`ch-hero${character.cover_url ? ' has-cover' : ''}`}>
        {character.cover_url && <img className="ch-hero-cover" src={character.cover_url} alt="" aria-hidden="true" />}
        <div className="ch-avatar" aria-hidden="true">
          {character.portrait_url ? <img src={character.portrait_url} alt="" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="ch-hero-text">
          <div className="ch-hero-kicker">
            <Link to="/character-registry" className="ch-back">The cast</Link>
            <span className="ch-status">{step.label}</span>
          </div>
          <h1 className="ch-name">{name}</h1>
          {/* Their real name heads the page; the name they post under follows. */}
          {socialName && socialName !== name && <p className="ch-aka" data-testid="ch-aka">Online as {socialName}</p>}
          {(handle || city) && (
            <p className="ch-sub">
              {handle && <span className="ch-sub-item"><Instagram size={16} aria-hidden />{handle}</span>}
              {city && <span className="ch-sub-item"><MapPin size={16} aria-hidden />{city}</span>}
            </p>
          )}
          {roles.length > 0 && <p className="ch-roles">{roles.join(' · ')}</p>}
          <div className="ch-chips">
            {firstEpisode && <span className="ch-chip is-green">In Episode {firstEpisode.episode_number ?? '?'}</span>}
            {hasVoice && <span className="ch-chip is-gold">Has voice</span>}
            {character.feed_profile_id && <span className="ch-chip is-blue">Pulse profile</span>}
            {cityDiffers && (
              <span className="ch-chip is-warn" data-testid="ch-city-differs"
                title="Their Pulse profile and their character record name different cities. Change one so they agree.">
                City differs: feed says {cityDiffers.feed}, character says {cityDiffers.own}
              </span>
            )}
          </div>
        </div>
        <div className="ch-alive">
          <div className="ch-kicker is-pink"><Crown size={16} aria-hidden /> How alive they are</div>
          <ol className="ch-steps" aria-label={`How alive: ${step.label}`}>
            {DEPTH_STEPS.map((s, i) => (
              <li key={s.key} className={i <= depthIndex ? 'is-on' : ''} aria-current={i === depthIndex ? 'step' : undefined}>
                <span className="ch-step-bar" />
                <span className="ch-step-label">{s.label}</span>
              </li>
            ))}
          </ol>
          {next && (
            <button type="button" className="ch-btn-deepen" disabled={!!gen.busy || gen.locked}
              title="Drafts the missing inner life from who they already are, for you to look over before it is saved"
              onClick={() => { setActiveTab('inner'); gen.preview(); }}>
              {gen.busy === 'all' ? 'Deepening… (about a minute)' : <>&uarr; Deepen to {next.label}</>}
            </button>
          )}
          {ready && <p className="ch-note" data-testid="ch-ready">Ready to be {depthOf(ready).step.label}</p>}
          {deepenNote && <p className={`ch-note${deepenNote.error ? ' is-error' : ''}`} role="status">{deepenNote.text}</p>}
          <button type="button" className="ch-btn-export" onClick={exportJson}><Download size={16} aria-hidden /> Export Profile</button>
        </div>
      </header>

      <nav className="ch-tabs" aria-label="Character sections" ref={tabBarRef}>
        {TABS.map((tab) => (
          <Link key={tab.id} to={tab.id === 'overview' ? '?' : `?tab=${tab.id}`}
            className={`ch-tab${activeTab === tab.id ? ' is-on' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); setActiveTab(tab.id); }}>
            <tab.icon size={17} aria-hidden />{tab.label}
          </Link>
        ))}
      </nav>

      <div className="ch-panel">
        {activeTab === 'overview' && <TabOverview character={character} appearances={appearances} feedProfile={feedProfile} relationships={relationships} entanglements={entanglements} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} openTab={setActiveTab} />}
        {activeTab === 'person' && <PersonPage key={character.id} character={character} openTab={setActiveTab} />}
        {activeTab === 'inner' && (
          <div className="ch-card">
            <InnerLifeWorkspace character={character} gen={gen} onSaved={onSaved}
              typeCard={<TheirType character={character} />} archive={<DepthArchive character={character} />} />
          </div>
        )}
        {activeTab === 'voice' && (
          <TabVoice character={character} feedProfile={feedProfile} appearances={appearances} onSaved={onSaved} onFeedSaved={onFeedSaved} />
        )}
        {activeTab === 'connections' && <TabConnections character={character} relationships={listOf(relationships)} entanglements={listOf(entanglements)} />}
        {activeTab === 'world' && <TabWorld character={character} feedProfile={feedProfile} appearances={appearances} onSaved={onSaved} gen={gen} openTab={setActiveTab} />}
        {activeTab === 'places' && (
          <>
            <div className="ch-card"><CharacterPlacesTab key={character.id} character={character} appearances={appearances} /></div>
            <div className="ch-card"><CharacterGalleryTab key={character.id} character={character} openTab={setActiveTab} hide={['places']} /></div>
          </>
        )}
        {activeTab === 'story' && <TabStory character={character} feedProfile={feedProfile} appearances={appearances} openTab={setActiveTab} />}
        {activeTab === 'talk' && <div className="ch-card"><CharacterTalkTab key={character.id} character={character} onSaved={onSaved} /></div>}
        {activeTab === 'settings' && <TabSettings character={character} feedProfile={feedProfile} onSaved={onSaved} onExport={exportJson} onDeleted={() => navigate('/character-registry')} />}
        {activeTab === 'appearance' && <CharacterAppearanceTab key={character.id} character={character} onPortraitChanged={(url) => onSaved({ portrait_url: url })} />}
      </div>
    </div>
  );
}
