/**
 * CharacterProfilePage.jsx — the character page
 *
 * Route: /character/:id
 * Evoni's STUDIO BY SABLE mock (2026-10-08): a header with the character's
 * feed handle, chips and how alive they are, then five tabs. Overview is
 * "Who they are" (editable; Rewrite drafts it from the profile), "Where
 * they show up" (lib/characterPage, from GET /api/v1/cast/characters/:id/
 * appearances), their voice and what is between them and Lala. Inner life
 * holds the interior, DEPTH and the deep profile; Voice & feed the feed
 * profile; Connections and In the world as before.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowRight, LayoutDashboard, Heart, Mic, Users, Globe2, ImagePlus, Trash2,
  BarChart3, CalendarDays, Download, Link2, MapPin,
} from 'lucide-react';
import CharacterPlacesTab from '../components/CharacterPlaces/CharacterPlacesTab';
import { API_URL } from '../config/api';
import CharacterDepthPanel from '../components/CharacterDepthPanel';
import { platformLabel, atHandle, followersOf } from './feed/feedConstants';
import apiClient from '../services/api';
import { ROLE_LABELS } from '../constants/characterConstants';
import { findLala } from '../lib/theCast';
import { DEPTH_STEPS, depthOf, depthLevelOf, cityOf, archetypeOf, showUpRows, withLala, voiceOf } from '../lib/characterPage';
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
export const getFactsApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/facts`);
export const putFactsApi = (id, body) =>
  apiClient.put(`${API_URL}/cast/characters/${id}/facts`, body);
export const suggestFactsApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/facts/suggest`);
export const getCheckApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/check`);
export const markIntentionalApi = (id, flagId, note) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/intentional`, { flag_id: flagId, note });
export const fixFlagApi = (id, flagId, text) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/check/fix`, text === undefined ? { flag_id: flagId } : { flag_id: flagId, text });
export const unmarkIntentionalApi = (id, flagId) =>
  apiClient.delete(`${API_URL}/cast/characters/${id}/check/intentional/${flagId}`);
export const postIdeasApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/posts/ideas`);
export const makeActiveApi = (id) =>
  apiClient.put(`${API_URL}/character-registry/characters/${id}`, { depth_level: 'active' });
export const setRegistryShowApi = (registryId, showId) =>
  apiClient.put(`${API_URL}/character-registry/registries/${registryId}`, { show_id: showId });
export const buildVoiceApi = (id) =>
  apiClient.post(`${API_URL}/pulse-voices/${id}/build`);
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

/* ── Config ──────────────────────────────────────────────────────────────────── */

const STATE_CONFIG = {
  rising:        { label: 'Rising',        color: '#6a9e60', bg: '#f0f7ee' },
  peaking:       { label: 'Peaking',       color: '#c9a84c', bg: '#fdf6ee' },
  plateauing:    { label: 'Plateauing',    color: '#888',    bg: '#f5f5f5' },
  controversial: { label: 'Controversial', color: '#d47a3a', bg: '#fdf3ee' },
  cancelled:     { label: 'Cancelled',     color: '#c44',    bg: '#fdf0f0' },
  gone_dark:     { label: 'Gone Dark',     color: '#555',    bg: '#eee' },
  reinventing:   { label: 'Reinventing',   color: '#7ab3d4', bg: '#eef5fb' },
  posthumous:    { label: 'Posthumous',    color: '#555',    bg: '#eee' },
  rebuilding:    { label: 'Rebuilding',    color: '#7ab3d4', bg: '#eef5fb' },
  crossed:       { label: 'Crossed',       color: '#d4789a', bg: '#fdf0f4' },
};

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { id: 'inner',       label: 'Inner life',   icon: Heart },
  { id: 'voice',       label: 'Voice & feed', icon: Mic },
  { id: 'connections', label: 'Connections',  icon: Users },
  { id: 'world',       label: 'In the world', icon: Globe2 },
  // Evoni, 2026-10-17: their home, closet and place of work, and the events they host.
  { id: 'places',      label: 'Places',       icon: MapPin },
];

const DIMENSION_KEYS = [
  'life_stage', 'the_body', 'class_money', 'religion_meaning',
  'race_culture', 'sexuality_desire', 'family_architecture', 'friendship_loyalty',
  'ambition_identity', 'habits_rituals', 'speech_silence', 'grief_loss',
  'politics_justice', 'the_unseen',
];

// The older deep-profile endpoints name ten dimensions with "_and_"
// (class_and_money); generation v2 does not (class_money). Read both.
const DIMENSION_ALIASES = {
  class_money: 'class_and_money', religion_meaning: 'religion_and_meaning', race_culture: 'race_and_culture',
  sexuality_desire: 'sexuality_and_desire', friendship_loyalty: 'friendship_and_loyalty',
  ambition_identity: 'ambition_and_identity', habits_rituals: 'habits_and_rituals',
  speech_silence: 'speech_and_silence', grief_loss: 'grief_and_loss', politics_justice: 'politics_and_justice',
};
const dimension = (dp, key) => (dp ? dp[key] || dp[DIMENSION_ALIASES[key]] || null : null);

const DIMENSION_ICONS = {
  life_stage:          '\u23F3',
  the_body:            '\u270F\uFE0F',
  class_money:         '\uD83D\uDD25',
  religion_meaning:    '\u2726',
  race_culture:        '\uD83C\uDF0D',
  sexuality_desire:    '\uD83D\uDD25',
  family_architecture: '\uD83C\uDFE0',
  friendship_loyalty:  '\uD83D\uDC9B',
  ambition_identity:   '\uD83C\uDFAF',
  habits_rituals:      '\uD83C\uDF11',
  speech_silence:      '\uD83D\uDCAD',
  grief_loss:          '\uD83C\uDF0A',
  politics_justice:    '\u2696\uFE0F',
  the_unseen:          '\uD83D\uDD2E',
};

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
 * (its fields joined, or 'all'); `note` says what came of the last one.
 */
function useInteriorGenerate(character, onSaved) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const id = character?.id;
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
      console.error('[CharacterProfilePage] generate inner life failed:', err);
      setNote({ key, error: true, text: err.response?.data?.error || err.message || 'Could not generate it.' });
    } finally { setBusy(null); }
  }, [id, onSaved]);
  return { busy, note, run, locked: character?.status === 'finalized' };
}

/* ── Overview ────────────────────────────────────────────────────────────────── */

function WhoTheyAre({ character, onSaved }) {
  const [editing, setEditing] = useState(false);
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
        {!editing && !locked && <button type="button" className="ch-link" onClick={() => edit(prose)}>Edit</button>}
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
        ? <p className="ch-prose" data-testid="ch-prose">{prose}</p>
        : <p className="ch-note">Nothing written yet.</p>}
      {note && <p className="ch-note" role="status">{note}</p>}
      {!editing && !locked && (
        <button type="button" className="ch-btn-chip" disabled={busy} onClick={rewrite}>
          <Sparkles size={14} aria-hidden="true" /> {busy ? 'Drafting…' : 'Rewrite from profile'}
        </button>
      )}
    </section>
  );
}

function WhereTheyShowUp({ appearances, feedProfile }) {
  const rows = showUpRows(appearances, feedProfile);
  return (
    <section className="ch-card" aria-labelledby="ch-where">
      <div className="ch-card-head">
        <h2 id="ch-where" className="ch-h2">Where they show up</h2>
        <span className="ch-note">Everything in the show that points at them</span>
      </div>
      {!appearances ? <p className="ch-note">Loading…</p>
        : !appearances.linked ? <p className="ch-note">No feed profile yet, so nothing in the show points at them. Match them to a feed person on <Link to="/character-registry">The cast</Link>.</p>
        : rows.length === 0 ? <p className="ch-note">Not in the show yet: no event, home or posts.</p>
        : (
          <ul className="ch-shows" data-testid="ch-shows">
            {rows.map((r, i) => {
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
    </section>
  );
}

function TheirVoice({ character, feedProfile }) {
  const voice = voiceOf(character, feedProfile);
  const name = character.display_name || character.selected_name;
  return (
    <section className="ch-card is-blue" aria-labelledby="ch-voice" data-testid="ch-voice">
      <h2 id="ch-voice" className="ch-kicker is-blue">Their voice</h2>
      {!voice ? <p className="ch-note">No voice yet. It comes from their feed profile and voice signature.</p> : (<>
        {voice.sample && <p className="ch-sample"><strong>{name}</strong> {voice.sample}</p>}
        {/* The habit is a paragraph of direction, too long for a pill. */}
        {voice.habit && <p className="ch-voice-habit">{voice.habit}</p>}
        <div className="ch-chips">
          {voice.phrase && <span className="ch-chip">{voice.phrase}</span>}
          {voice.innerVoice && <span className="ch-chip">inner voice: {voice.innerVoice}</span>}
          {voice.neverSays && <span className="ch-chip">never says outright: {voice.neverSays}</span>}
        </div>
        <p className="ch-note">How they sound on the feed and in their head.</p>
      </>)}
    </section>
  );
}

function WithLala({ appearances }) {
  const line = withLala(appearances);
  return (
    <section className="ch-card" aria-labelledby="ch-lala" data-testid="ch-lala">
      <h2 id="ch-lala" className="ch-kicker is-pink">With Lala</h2>
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
          <p className="ch-note">No feed profile yet. Match them to a feed person on <Link to="/character-registry">The cast</Link>.</p>
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
            ) : <p className="ch-note">No feed profile yet, so no handle, followers or account status.</p>}
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
            <span className="ch-facts-row">
              <button type="submit" className="ch-btn" disabled={busy}>{busy ? 'Saving…' : 'Save facts'}</button>
              <button type="button" className="ch-btn-soft" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
            </span>
          </form>
        )}
      {note && <p className={note.kind === 'error' ? 'ch-note is-error' : 'ch-note'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
      {facts && !facts.error && !form && <ProfileCheck characterId={id} />}
    </section>
  );
}

/**
 * The consistency check (Character Consistency Engine step 3): every place
 * the narrator's text disagrees with their facts. The check never edits;
 * each finding can be fixed (the suggested wording, or Evoni's own), or
 * marked intentional and listed as such. What they post and author-only
 * notes are not checked (a gap there is the mask).
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

  return (
    <div className="ch-check" data-testid="ch-check">
      <button type="button" className="ch-btn-soft" disabled={busy} onClick={run}>
        {busy ? 'Checking…' : result ? 'Check again' : 'Check their profile against these facts'}
      </button>
      {error && <p className="ch-note is-error" role="alert">{error}</p>}
      {result && (
        <>
          <p className="ch-note">
            {result.flags.length === 0 ? 'Everything agrees with their facts.' : `${result.flags.length} place${result.flags.length === 1 ? '' : 's'} disagree${result.flags.length === 1 ? 's' : ''} with their facts.`}
            {' '}Checked {result.checked} text field{result.checked === 1 ? '' : 's'}; what they post ({result.skipped.mask}) and author-only notes ({result.skipped.author}) are not checked.
          </p>
          {result.flags.length > 0 && (
            <ul className="ch-check-list">
              {result.flags.map((f) => (
                <li key={f.id}>
                  <span className="ch-check-what"><b>{f.field_label}</b> says &ldquo;{f.found}&rdquo;; the facts say {f.expected}.</span>
                  <span className="ch-check-excerpt">{f.excerpt}</span>
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
export function TheirStory({ character }) {
  const [trail, setTrail] = useState(null);
  const id = character.id;
  useEffect(() => {
    let live = true;
    getStoryTrailApi(id)
      .then((res) => { if (live) setTrail(res.data || {}); })
      .catch((err) => {
        console.error('[CharacterProfilePage] story trail load failed:', err);
        if (live) setTrail({ error: err.response?.data?.error || 'Could not load their story.' });
      });
    return () => { live = false; };
  }, [id]);

  const posts = trail?.posts || [];
  const stories = trail?.stories || [];
  const chapters = trail?.chapters || [];
  const counts = trail?.post_counts || { live: 0, draft: 0 };
  const empty = trail && !trail.error && posts.length === 0 && stories.length === 0 && chapters.length === 0;

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
                  {posts.map((p) => (
                    <li key={p.id}>
                      <span className="ch-trail-text">{shortText(p.text)}</span>
                      <span className="ch-trail-meta">{[p.status === 'draft' ? 'Draft' : null, p.episode_number != null ? `Episode ${p.episode_number}` : null].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stories.length > 0 && (
              <div className="ch-trail">
                <h3 className="ch-trail-h">Stories</h3>
                <ul className="ch-trail-list">
                  {stories.map((st) => (
                    <li key={st.id}>
                      <Link to={st.show_id ? `/stories?show=${st.show_id}` : '/stories'} className="ch-trail-text">{st.title || 'Untitled'}</Link>
                      <span className="ch-trail-meta">{[STORY_FORMATS[st.format] || st.format, st.episode_number != null ? `Episode ${st.episode_number}` : null, st.status].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {chapters.length > 0 && (
              <div className="ch-trail">
                <h3 className="ch-trail-h">Chapters</h3>
                <ul className="ch-trail-list">
                  {chapters.map((c) => (
                    <li key={c.id}>
                      <Link to={`/chapter/${c.book_id}/${c.id}`} className="ch-trail-text">{c.title || `Chapter ${c.chapter_number ?? ''}`.trim()}</Link>
                      <span className="ch-trail-meta">{[c.book_title, c.written ? null : 'not written yet'].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
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
      <h2 id="ch-places" className="ch-kicker is-pink">Their places</h2>
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
          {places.length > 0 && !character.feed_profile_id && <p className="ch-note">Sharing on The Pulse needs a feed profile.</p>}
        </>)}
      {note && (
        <p className={`ch-note${note.error ? ' is-error' : ''}`} role="status">
          {note.text}{note.shared && <> <Link to={PULSE_REVIEW}>Open Review</Link></>}
        </p>
      )}
    </section>
  );
}

function TabOverview({ character, appearances, feedProfile, relationships, entanglements, onSaved, onFeedSaved, gen, openTab }) {
  return (
    <div className="ch-overview">
      <div className="ch-col">
        <TheirNames character={character} feedProfile={feedProfile} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} />
        <TheirFacts character={character} onFeedSaved={onFeedSaved} />
        <ProfileImages character={character} onSaved={onSaved} />
        <TheirStory character={character} />
      </div>
      <div className="ch-col">
        <WhoTheyAre character={character} onSaved={onSaved} />
        <TheirStats feedProfile={feedProfile} appearances={appearances} relationships={relationships} entanglements={entanglements} />
        <WhereTheyShowUp appearances={appearances} feedProfile={feedProfile} />
        <TheirEvents appearances={appearances} />
      </div>
      <div className="ch-col">
        <TheirVoice character={character} feedProfile={feedProfile} />
        <WithLala appearances={appearances} />
        <ConnectionsCard relationships={relationships} entanglements={entanglements} openTab={openTab} />
        <TheirPlaces character={character} />
      </div>
    </div>
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
      <h2 id="ch-images" className="ch-kicker is-pink"><ImagePlus size={16} aria-hidden /> Profile images</h2>
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
export function TheirStats({ feedProfile, appearances, relationships, entanglements }) {
  const ties = listOf(relationships).length + listOf(entanglements).length;
  const followers = feedProfile ? followersOf(feedProfile) : '';
  const stats = [
    { key: 'followers', label: 'Followers', value: followers || '—', icon: Users, tone: 'pink' },
    { key: 'posts', label: 'Posts', value: appearances?.feed?.posts ?? (appearances ? 0 : '…'), icon: Sparkles, tone: 'lavender' },
    { key: 'episodes', label: 'Episodes', value: appearances ? (appearances.episodes || []).length : '…', icon: BarChart3, tone: 'gold' },
    { key: 'events', label: 'Events', value: appearances ? (appearances.events || []).length : '…', icon: CalendarDays, tone: 'green' },
    { key: 'ties', label: 'Connections', value: ties, icon: Link2, tone: 'blue' },
  ];
  return (
    <section className="ch-card" aria-labelledby="ch-stats" data-testid="ch-stats">
      <h2 id="ch-stats" className="ch-kicker is-pink"><BarChart3 size={16} aria-hidden /> Stats &amp; influence</h2>
      <ul className="ch-stats">
        {stats.map(({ key, label, value, icon: Icon, tone }) => (
          <li key={key} className={`ch-stat is-${tone}`}>
            <span className="ch-stat-ring"><Icon size={20} aria-hidden /></span>
            <strong className="ch-stat-value">{value}</strong>
            <span className="ch-stat-label">{label}</span>
          </li>
        ))}
      </ul>
      {!feedProfile && <p className="ch-note">Followers and posts come from their feed profile.</p>}
    </section>
  );
}

/* ── Their events: the ones they host or attend (cast appearances) ──────────── */
export function TheirEvents({ appearances }) {
  const events = appearances?.events || [];
  return (
    <section className="ch-card" aria-labelledby="ch-events" data-testid="ch-events">
      <h2 id="ch-events" className="ch-kicker is-pink"><CalendarDays size={16} aria-hidden /> Their events</h2>
      {!appearances ? <p className="ch-note">Loading…</p>
        : events.length === 0 ? <p className="ch-note">No events yet: they host or attend none.</p> : (
          <ul className="ch-events">
            {events.slice(0, 4).map((ev) => (
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
    </section>
  );
}

/* ── Connections on the Overview: their closest ties, the full list a tab away ─ */
const TENSION_SCORE = { calm: 90, healing: 70, simmering: 45, volatile: 25, fractured: 10 };
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
        <h2 id="ch-ties" className="ch-kicker is-pink"><Users size={16} aria-hidden /> Their people</h2>
        {total > 0 && <button type="button" className="ch-link" onClick={() => openTab('connections')}>See all {total}</button>}
      </div>
      {rows.length === 0 ? (
        <p className="ch-note">{entanglements.length ? `${entanglements.length} feed tie${entanglements.length === 1 ? '' : 's'}, no relationships yet.` : 'No relationships yet.'}</p>
      ) : (
        <ul className="ch-ties">
          {rows.map((r) => {
            const who = r.related_name || r.character_b_name || r.character_a_name || 'Someone';
            const score = TENSION_SCORE[r.tension_state];
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

/* ── Tab 2: Interior ─────────────────────────────────────────────────────────── */

function TabInterior({ character, gen }) {
  const want    = character.want_architecture;
  const wound   = character.wound;
  const mask    = character.the_mask;
  // The column, or the older generate-section shape in extra_fields.
  const dilemma = character.dilemma || character.extra_fields?.dilemma || null;
  const triggers = character.triggers;
  const missing = ['want_architecture', 'wound', 'the_mask', 'triggers', 'dilemma', 'deep_profile', 'living_state',
    'self_narrative', 'operative_cosmology', 'foreclosed_possibility', 'experience_of_joy', 'change_capacity']
    .filter((f) => !hasValue(character[f]));
  const allNote = gen.note?.key === 'all' ? gen.note : null;

  return (
    <div className="cp-tab-content">
      {missing.length > 0 && !gen.locked && (
        <div className="cp-fill-all">
          <p className="ch-note">{missing.length} {missing.length === 1 ? 'part' : 'parts'} of their inner life {missing.length === 1 ? 'is' : 'are'} empty. Fill them in from who they already are; nothing written is changed.</p>
          <button type="button" className="ch-btn" disabled={!!gen.busy} onClick={() => gen.run()}>
            {gen.busy === 'all' ? 'Filling in… (about a minute)' : 'Fill in everything missing'}
          </button>
          {allNote && <p className={`ch-note${allNote.error ? ' is-error' : ''}`} role="status">{allNote.text}</p>}
        </div>
      )}

      {/* Want Architecture — three cards */}
      <section className="cp-section">
        <h3 className="cp-section-title">Want Architecture</h3>
        {want ? (
          <div className="cp-want-row">
            <div className="cp-want-card cp-want-surface">
              <span className="cp-want-label">Surface Want</span>
              <p>{want.surface_want}</p>
            </div>
            <div className="cp-want-card cp-want-real">
              <span className="cp-want-label">Real Want</span>
              <p>{want.real_want}</p>
            </div>
            <div className="cp-want-card cp-want-forbidden">
              <span className="cp-want-label">Forbidden Want</span>
              <p>{want.forbidden_want}</p>
            </div>
          </div>
        ) : <EmptyState label="Want architecture not generated yet." gen={gen} fields={['want_architecture']} />}
      </section>

      {/* Wound */}
      <section className="cp-section">
        <h3 className="cp-section-title">Wound</h3>
        {wound ? (
          <div className="cp-wound-block">
            <p className="cp-wound-desc">{wound.description}</p>
            {wound.origin_period && (
              <p className="cp-wound-meta">Origin: {wound.origin_period}</p>
            )}
            {wound.downstream_effects && (
              <p className="cp-wound-effects">{wound.downstream_effects}</p>
            )}
            {wound.deep_profile_dimensions_affected?.length > 0 && (
              <div className="cp-dim-tags">
                {wound.deep_profile_dimensions_affected.map(d => (
                  <span key={d} className="cp-dim-tag">{d.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Wound not defined yet." gen={gen} fields={['wound']} />}
      </section>

      {/* The Mask */}
      <section className="cp-section">
        <h3 className="cp-section-title">The Mask</h3>
        {mask ? (
          <div className="cp-mask-block">
            <p>{mask.description}</p>
            {mask.feed_profile_is_mask && (
              <div className="cp-mask-callout">
                <span className="cp-mask-dot" /> This character&rsquo;s Feed profile IS their mask
              </div>
            )}
            {mask.divergence_map?.length > 0 && (
              <div className="cp-divergence-list">
                <span className="cp-meta-label">Divergences</span>
                {mask.divergence_map.map((d, i) => (
                  <p key={i} className="cp-divergence-item">&middot; {d}</p>
                ))}
              </div>
            )}
          </div>
        ) : <EmptyState label="Mask not defined yet." gen={gen} fields={['the_mask']} />}
      </section>

      {/* Dilemma — two column */}
      <section className="cp-section">
        <h3 className="cp-section-title">Central Dilemma</h3>
        {dilemma ? (
          <div className="cp-dilemma-block">
            <p className="cp-dilemma-tension">{dilemma.central_tension || dilemma.central_dilemma}</p>
            <div className="cp-dilemma-options">
              <div className="cp-dilemma-option">
                <span className="cp-option-label">A</span>
                <p>{dilemma.option_a}</p>
              </div>
              <div className="cp-dilemma-vs">vs</div>
              <div className="cp-dilemma-option">
                <span className="cp-option-label">B</span>
                <p>{dilemma.option_b}</p>
              </div>
            </div>
            {(dilemma.what_both_cost || dilemma.stakes) && (
              <p className="cp-dilemma-cost">Either way: {dilemma.what_both_cost || dilemma.stakes}</p>
            )}
          </div>
        ) : <EmptyState label="Dilemma not generated yet." gen={gen} fields={['dilemma']} />}
      </section>

      {/* Triggers */}
      <section className="cp-section">
        <h3 className="cp-section-title">Triggers</h3>
        {triggers?.length > 0 ? (
          <div className="cp-trigger-pills">
            {triggers.map((t, i) => (
              <span key={i} className="cp-trigger-pill">{typeof t === 'string' ? t : t.label || t.name}</span>
            ))}
          </div>
        ) : <EmptyState label="Triggers not defined yet." gen={gen} fields={['triggers']} />}
      </section>

      {/* Blind Spot — author only */}
      {character.blind_spot && (
        <section className="cp-section cp-author-only">
          <h3 className="cp-section-title">
            Blind Spot
            <span className="cp-author-badge">Author Only</span>
          </h3>
          <p className="cp-blind-spot-text">{character.blind_spot}</p>
        </section>
      )}

      {/* Interior architecture labeled blocks */}
      {(character.change_capacity || character.self_narrative || character.operative_cosmology ||
        character.foreclosed_possibility || character.experience_of_joy || character.time_orientation) && (
        <section className="cp-section">
          <h3 className="cp-section-title">Interior Architecture</h3>
          <div className="cp-interior-grid">
            {[
              { label: 'Change Capacity',        value: character.change_capacity
                ? (typeof character.change_capacity === 'string'
                  ? character.change_capacity
                  // The generator writes { mobility, conditions_for_change, armor_type }.
                  : [character.change_capacity.mobility,
                    character.change_capacity.conditions_for_change && `Would change if: ${character.change_capacity.conditions_for_change}`,
                    character.change_capacity.armor_type && `Armor: ${character.change_capacity.armor_type}`,
                    character.change_capacity.description].filter(Boolean).join(' · ') || null)
                : null },
              { label: 'Self-Narrative',          value: character.self_narrative },
              { label: 'Operative Cosmology',     value: character.operative_cosmology },
              { label: 'Foreclosed Possibility',  value: character.foreclosed_possibility },
              { label: 'Experience of Joy',       value: character.experience_of_joy },
              { label: 'Time Orientation',        value: character.time_orientation?.replace?.(/_/g, ' ') || character.time_orientation },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="cp-interior-field">
                <span className="cp-meta-label">{f.label}</span>
                <p>{f.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Tab 3: Connections ──────────────────────────────────────────────────────── */

function TabConnections({ character, relationships, entanglements }) {
  return (
    <div className="cp-tab-content">
      {/* Relationships */}
      <section className="cp-section">
        <h3 className="cp-section-title">
          {relationships.length > 0 ? `${relationships.length} Relationships` : 'Relationships'}
        </h3>
        {relationships.length > 0 ? (
          <div className="cp-rel-list">
            {relationships.map((r, i) => (
              <div key={i} className="cp-rel-row">
                <div className="cp-rel-avatar">
                  {(r.related_name || r.name || '?')[0].toUpperCase()}
                </div>
                <div className="cp-rel-info">
                  <span className="cp-rel-name">{r.related_name || r.name}</span>
                  <span className="cp-rel-type">{r.relationship_type || r.type}</span>
                </div>
                <div className="cp-rel-meta">
                  {r.tension_state && (
                    <span className={`cp-tension-badge cp-tension-${r.tension_state}`}>
                      {r.tension_state}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState label="No relationships defined yet.">
          <Link className="ch-link" to="/feed-relationships">Open Relationship Map</Link>
        </EmptyState>}
      </section>

      {/* Entanglements */}
      <section className="cp-section">
        <h3 className="cp-section-title">Entanglements</h3>
        {entanglements.length > 0 ? (
          <div className="cp-entanglement-list">
            {entanglements.map((e, i) => (
              <div key={e.id || i} className="cp-entanglement-row">
                {e.profile && (
                  <Link className="cp-entanglement-who" to={`/pulse?profile=${e.profile.id}`}>
                    {e.profile.display_name || `@${String(e.profile.handle || '').replace(/^@/, '')}`}
                  </Link>
                )}
                <span className="cp-entanglement-dim">{(e.dimension || '').replace(/_/g, ' ')}</span>
                <span className={`cp-entanglement-intensity cp-intensity-${e.intensity || 'low'}`}>
                  {e.intensity || 'low'}
                </span>
                <span className="cp-entanglement-dir">{e.directionality ? e.directionality.replace(/_/g, ' ') : '\u2014'}</span>
                {e.turbulence_flag && <span className="cp-entanglement-unresolved" title={e.turbulence_reason || ''}>turbulent</span>}
                {e.is_active === false && <span className="cp-entanglement-dir">ended</span>}
              </div>
            ))}
          </div>
        ) : <EmptyState label="No entanglements yet." />}
      </section>

      {/* Belonging Map */}
      {character.belonging_map && (
        <section className="cp-section">
          <h3 className="cp-section-title">Belonging Map</h3>
          {character.belonging_map.belongs_to?.length > 0 && (
            <div className="cp-belonging-group">
              <span className="cp-meta-label">Belongs To</span>
              {character.belonging_map.belongs_to.map((g, i) => (
                <div key={i} className="cp-belonging-item">
                  <span className="cp-belonging-name">{g.name}</span>
                  <span className="cp-belonging-type">{g.type}</span>
                </div>
              ))}
            </div>
          )}
          {character.belonging_map.excluded_from?.length > 0 && (
            <div className="cp-belonging-group cp-excluded">
              <span className="cp-meta-label">Excluded From</span>
              {character.belonging_map.excluded_from.map((g, i) => (
                <div key={i} className="cp-belonging-item">
                  <span className="cp-belonging-name">{g.name}</span>
                  <p className="cp-belonging-why">{g.why}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Tab 4: Online ───────────────────────────────────────────────────────────── */

function TabOnline({ character, feedProfile, appearances }) {
  const hasFeed  = !!feedProfile || character.social_presence;
  const stateCfg = feedProfile?.current_state
    ? STATE_CONFIG[feedProfile.current_state] || null
    : null;

  // Build persona gap data
  const performAs = feedProfile?.content_persona || feedProfile?.public_persona || feedProfile?.vibe_sentence || null;
  const realAs    = character.the_mask?.description || dimensionText(dimension(character.deep_profile, 'ambition_identity')) || null;

  return (
    <div className="cp-tab-content">
      {/* Social presence indicator */}
      <section className="cp-section">
        <h3 className="cp-section-title">Social Presence</h3>
        {/* Whether they are on the feed at all, not how their account is
            doing: that is the status on their account card (current_state).
            It said "Active" beside "Gone Dark" (Evoni, 2026-10-16). */}
        <span className={`cp-social-toggle ${character.social_presence || character.feed_profile_id ? 'cp-social-on' : 'cp-social-off'}`}>
          {character.social_presence || character.feed_profile_id ? 'On the feed' : 'Not on the feed'}
        </span>
      </section>

      {!hasFeed ? (
        <section className="cp-section">
          <div className="cp-empty-state">
            <p className="cp-empty-label">No Feed profile</p>
            <p className="cp-offline-note">
              {character.feed_profile_id
                ? 'Their feed profile could not be loaded. Reload the page to try again.'
                : <>Not on the feed yet. Match them to a feed person on <Link to="/character-registry">The cast</Link>.</>}
            </p>
          </div>
        </section>
      ) : (
        <>
          {feedProfile && (
            <section className="cp-section cp-feed-section">
              <div className="cp-feed-header">
                <div className="cp-feed-avatar">
                  {(feedProfile.handle || feedProfile.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="cp-feed-identity">
                  <span className="cp-feed-handle">{atHandle(feedProfile.handle)}</span>
                  <span className="cp-feed-display">{feedProfile.display_name}</span>
                  <span className="cp-feed-platform">{platformLabel(feedProfile.platform)}</span>
                  {feedProfile.registry_character_id && (
                    <span className="cp-registry-badge" title="Linked to registry character" style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:8,background:'#eef0fb',color:'#6366f1',marginLeft:4}}>Registry</span>
                  )}
                </div>
                <a href={`/pulse?profile=${feedProfile.id}&layer=${feedProfile.feed_layer}`}
                   style={{fontSize:12,fontWeight:600,color:'#6366f1',textDecoration:'none',marginLeft:'auto',whiteSpace:'nowrap'}}>
                  View in The Pulse &rarr;
                </a>
                {stateCfg && (
                  <span className="cp-state-badge" style={{ background: stateCfg.bg, color: stateCfg.color }}>
                    {stateCfg.label}
                  </span>
                )}
              </div>

              {/* A feed profile has no bio, content_posture, post_count or
                  vibe_tags column: these read its vibe sentence, what it
                  posts, the posts The Pulse holds and its aesthetic's tags. */}
              {feedProfile.vibe_sentence && (
                <p className="cp-feed-bio">&ldquo;{feedProfile.vibe_sentence}&rdquo;</p>
              )}

              {feedProfile.content_category && (
                <div className="cp-feed-posture">
                  <span className="cp-meta-label">What they post</span>
                  <p>{feedProfile.content_category}</p>
                </div>
              )}

              <div className="cp-feed-stats">
                <div className="cp-feed-stat">
                  <span className="cp-stat-num">
                    {followersOf(feedProfile) || '\u2014'}
                  </span>
                  <span className="cp-stat-label">followers</span>
                </div>
                <div className="cp-feed-stat">
                  <span className="cp-stat-num">{appearances?.feed?.posts ?? '\u2014'}</span>
                  <span className="cp-stat-label">posts</span>
                </div>
              </div>

              {feedProfile.aesthetic_dna?.vibe_tags?.length > 0 && (
                <div className="cp-vibe-tags">
                  {feedProfile.aesthetic_dna.vibe_tags.map(t => (
                    <span key={t} className="cp-vibe-tag">{t}</span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Persona Gap — side by side */}
          {(performAs || realAs) && (
            <section className="cp-section cp-author-only">
              <h3 className="cp-section-title">
                Persona Gap
                <span className="cp-author-badge">Author Only</span>
              </h3>
              <div className="cp-persona-gap">
                <div className="cp-gap-side cp-gap-perform">
                  <span className="cp-gap-label">Who they perform</span>
                  <p>{performAs || 'Not defined'}</p>
                </div>
                <div className="cp-gap-divider" />
                <div className="cp-gap-side cp-gap-real">
                  <span className="cp-gap-label">Who they are</span>
                  <p>{realAs || 'Not defined'}</p>
                </div>
              </div>
            </section>
          )}

          {/* Mask connection callout */}
          {character.the_mask?.feed_profile_is_mask && (
            <section className="cp-section">
              <h3 className="cp-section-title">Mask Status</h3>
              <p className="cp-mask-note">
                This character&rsquo;s Feed profile IS their mask. The gap between
                who they perform online and who they actually are is the story.
              </p>
            </section>
          )}
        </>
      )}
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

function TabWorld({ character, onSaved, gen }) {
  // living_context (the backfill's shape) has none of these three fields, so it read as an empty grid.
  const living = hasValue(character.living_state) ? character.living_state : null;
  const plotThreads = character.plot_threads || character.extra_fields?.plot_threads || [];
  const dp     = character.deep_profile;

  return (
    <div className="cp-tab-content">
      {/* Details (the old Overview's meta; its World picker's save never reached the page's state) */}
      <section className="cp-section cp-meta-grid">
        <div className="cp-meta-item">
          <span className="cp-meta-label">Role</span>
          <span className="cp-meta-value">{roleOf(character) || '\u2014'}</span>
        </div>
        <div className="cp-meta-item">
          <span className="cp-meta-label">Appearance</span>
          <span className="cp-meta-value">{character.appearance_mode || '\u2014'}</span>
        </div>
        <div className="cp-meta-item">
          <label className="cp-meta-label" htmlFor="cp-world">World</label>
          <select
            id="cp-world"
            className="cp-meta-select"
            value={character.world || ''}
            onChange={async (e) => {
              const world = e.target.value;
              if (!world) return;
              try {
                await updateCharacterApi(character.id, { world });
                onSaved({ world });
              } catch (err) { console.error('[CharacterProfilePage] world update failed:', err); }
            }}
            disabled={character.status === 'finalized'}
          >
            {/* No world set reads as not set, not as Book 1. */}
            {!character.world && <option value="">Not set</option>}
            <option value="book-1">Book 1 — JustAWoman&rsquo;s World</option>
            <option value="lalaverse">LalaVerse</option>
            <option value="series-2">Series 2</option>
          </select>
        </div>
      </section>

      {/* Living State */}
      <section className="cp-section">
        <h3 className="cp-section-title">Living State</h3>
        {living ? (
          <div className="cp-living-grid">
            {living.current_situation && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Current Situation</span>
                <p>{living.current_situation}</p>
              </div>
            )}
            {living.active_tension && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Active Tension</span>
                <p>{living.active_tension}</p>
              </div>
            )}
            {living.momentum && (
              <div className="cp-living-field">
                <span className="cp-meta-label">Momentum</span>
                <p>{living.momentum}</p>
              </div>
            )}
          </div>
        ) : <EmptyState label="Living state not generated yet." gen={gen} fields={['living_state']} />}
      </section>

      {/* Arc Stage */}
      {character.arc_stage && (
        <section className="cp-section">
          <h3 className="cp-section-title">Arc Stage</h3>
          <span className="cp-arc-badge">{character.arc_stage.replace?.(/_/g, ' ') || character.arc_stage}</span>
        </section>
      )}

      {/* Plot Threads */}
      {plotThreads.length > 0 && (
        <section className="cp-section">
          <h3 className="cp-section-title">Plot Threads</h3>
          <div className="cp-thread-list">
            {plotThreads.map((t, i) => (
              <div key={t.id || i} className="cp-thread-row">
                <span className="cp-thread-name">{typeof t === 'string' ? t : t.title || t.name || t.label}</span>
                {t.status && <span className="cp-thread-status">{t.status}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Career / Ambition from deep profile */}
      {dimensionText(dimension(dp, 'ambition_identity')) && (
        <section className="cp-section">
          <h3 className="cp-section-title">Career &amp; Ambition</h3>
          <p className="cp-career-text">{dimensionText(dimension(dp, 'ambition_identity'))}</p>
        </section>
      )}

      {/* Time orientation */}
      {character.time_orientation && (
        <section className="cp-section">
          <h3 className="cp-section-title">Time Orientation</h3>
          <span className="cp-time-badge">
            {character.time_orientation.replace?.(/_/g, ' ') || character.time_orientation}
          </span>
        </section>
      )}

      {/* Ghost Characters */}
      {character.ghost_characters?.length > 0 && (
        <section className="cp-section">
          <h3 className="cp-section-title">
            Ghost Characters
            <span className="cp-ghost-count">{character.ghost_characters.length}</span>
          </h3>
          <p className="cp-ghost-note">
            Characters mentioned in this character&rsquo;s story who haven&rsquo;t been built yet.
          </p>
          <div className="cp-ghost-list">
            {character.ghost_characters.map((g, i) => (
              <div key={i} className={`cp-ghost-item ${g.promoted ? 'cp-ghost-promoted' : ''}`}>
                <span className="cp-ghost-name">{g.name}</span>
                <span className="cp-ghost-relation">{g.relation}</span>
                {!g.promoted && <GhostPromote character={character} ghost={g} onSaved={onSaved} />}
                {g.promoted && (g.promoted_id
                  ? <Link className="cp-promoted-badge" to={`/character/${g.promoted_id}`}>&uarr; In Registry</Link>
                  : <span className="cp-promoted-badge">&uarr; In Registry</span>)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Family Tree */}
      {character.family_tree && (
        <section className="cp-section">
          <h3 className="cp-section-title">Family</h3>
          {character.family_tree.generational_wound && (
            <p className="cp-generational-wound">
              Generational wound: {character.family_tree.generational_wound}
            </p>
          )}
          {character.family_tree.members?.length > 0 && (
            <div className="cp-family-list">
              {character.family_tree.members.map((m, i) => (
                <div key={i} className="cp-family-member">
                  <span className="cp-member-name">{m.name}</span>
                  <span className="cp-member-relation">{m.relation}</span>
                  {m.personality_sketch && <p className="cp-member-sketch">{m.personality_sketch}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Tab 6: Deep Profile ─────────────────────────────────────────────────────── */

// A dimension is text (generation v2) or an object of notes (the older
// deep-profile endpoints); an object used to crash the page when opened.
function dimensionText(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const parts = Object.entries(value).filter(([, v]) => hasValue(v))
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    return parts.length ? parts.join('\n') : null;
  }
  return String(value);
}

function TabDeepProfile({ character, gen }) {
  const dp = character.deep_profile;
  const [open, setOpen] = useState(null);

  if (!hasValue(dp)) {
    return (
      <div className="cp-tab-content">
        <EmptyState label="Deep Profile not generated yet." gen={gen} fields={['deep_profile']} />
      </div>
    );
  }

  const populated = DIMENSION_KEYS.filter(k => dimensionText(dimension(dp, k)));
  const isComplete = populated.length === 14;

  return (
    <div className="cp-tab-content">
      {/* Completion indicator */}
      <div className="cp-dp-status">
        <span className="cp-dp-count">{populated.length}/14 dimensions</span>
        {isComplete && <span className="cp-dp-complete">Complete</span>}
      </div>

      <div className="cp-dp-list">
        {DIMENSION_KEYS.map(key => {
          const value  = dimensionText(dimension(dp, key));
          const label  = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const icon   = DIMENSION_ICONS[key] || '\u00B7';
          const isOpen = open === key;

          return (
            <div
              key={key}
              className={`cp-dp-row ${isOpen ? 'cp-dp-open' : ''} ${!value ? 'cp-dp-empty' : ''}`}
              onClick={() => value && setOpen(isOpen ? null : key)}
            >
              <div className="cp-dp-header">
                <span className="cp-dp-icon">{icon}</span>
                <span className="cp-dp-label">{label}</span>
                {value
                  ? <span className="cp-dp-chevron">{isOpen ? '\u2191' : '\u2193'}</span>
                  : <span className="cp-dp-missing">not generated</span>}
              </div>
              {isOpen && value && <p className="cp-dp-content">{value}</p>}
            </div>
          );
        })}
      </div>
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
  const [activeTab, setActiveTab]         = useState('overview');
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setAppearances(null);
    try {
      const [charRes, relRes, entRes] = await Promise.all([
        getCharacterApi(id),
        getCharacterRelationshipsApi(id).catch((err) => { console.error('[CharacterProfilePage] relationships load failed:', err); return null; }),
        getCharacterEntanglementsApi(id).catch((err) => { console.error('[CharacterProfilePage] entanglements load failed:', err); return null; }),
      ]);

      const charData = charRes.data;
      const char = charData.character || charData;
      setCharacter(char);

      if (relRes) {
        const relData = relRes.data;
        setRelationships(relData.relationships || relData || []);
      }

      if (entRes) {
        const entData = entRes.data;
        setEntanglements(entData.entanglements || entData || []);
      }

      // Where they show up (through the feed profile) and the profile itself.
      getAppearancesApi(id)
        .then((res) => setAppearances(res.data))
        .catch((err) => { console.error('[CharacterProfilePage] appearances load failed:', err); setAppearances({ linked: false, events: [], episodes: [] }); });
      if (char.feed_profile_id) {
        const feedRes = await getSocialProfileApi(char.feed_profile_id).catch((err) => { console.error('[CharacterProfilePage] feed profile load failed:', err); return null; });
        if (feedRes) {
          const feedData = feedRes.data;
          setFeedProfile(feedData.profile || feedData);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Character not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
  const { index: depthIndex, step, next } = depthOf(depthLevelOf(character));
  // Inner life shows its own note for the same run.
  const deepenNote = gen.note?.key === 'all' && activeTab !== 'inner' ? gen.note : null;
  const handle = feedProfile?.handle ? `@${feedProfile.handle.replace(/^@/, '')}` : null;
  const { label: city, differs: cityDiffers } = cityOf(character, feedProfile);
  const archetype = archetypeOf(feedProfile);
  const firstEpisode = appearances?.episodes?.[0];
  const role = roleOf(character);

  return (
    <div className="ch-page">
      <header className={`ch-hero${character.cover_url ? ' has-cover' : ''}`}>
        {character.cover_url && <img className="ch-hero-cover" src={character.cover_url} alt="" aria-hidden="true" />}
        <div className="ch-avatar" aria-hidden="true">
          {character.portrait_url ? <img src={character.portrait_url} alt="" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="ch-hero-text">
          <Link to="/character-registry" className="ch-back">&larr; The cast</Link>
          <h1 className="ch-name">{name}</h1>
          {/* Their real name heads the page; the name they post under follows. */}
          {socialName && socialName !== name && <p className="ch-aka" data-testid="ch-aka">Online as {socialName}</p>}
          <p className="ch-sub">{[handle, role, city].filter(Boolean).join(' · ')}</p>
          <div className="ch-chips">
            {archetype && <span className="ch-chip">{archetype}</span>}
            {character.feed_profile_id && <span className="ch-chip is-blue">Feed profile</span>}
            {cityDiffers && (
              <span className="ch-chip is-warn" data-testid="ch-city-differs"
                title="Their feed profile and their character record name different cities. Change one so they agree.">
                City differs: feed says {cityDiffers.feed}, character says {cityDiffers.own}
              </span>
            )}
            {firstEpisode && <span className="ch-chip is-green">In Episode {firstEpisode.episode_number ?? '?'}</span>}
            <span className="ch-chip is-plain">{step.label}</span>
          </div>
        </div>
        <div className="ch-alive">
          <div className="ch-kicker is-pink">How alive they are</div>
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
              title="Fills in the missing inner life from who they already are"
              onClick={() => { setActiveTab('inner'); gen.run(); }}>
              {gen.busy === 'all' ? 'Deepening… (about a minute)' : <>&uarr; Deepen to {next.label}</>}
            </button>
          )}
          {deepenNote && <p className={`ch-note${deepenNote.error ? ' is-error' : ''}`} role="status">{deepenNote.text}</p>}
          <button type="button" className="ch-link" onClick={exportJson}><Download size={14} aria-hidden /> Export</button>
        </div>
      </header>

      <nav className="ch-tabs" aria-label="Character sections">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={`ch-tab${activeTab === tab.id ? ' is-on' : ''}`}
            aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={17} aria-hidden />{tab.label}
          </button>
        ))}
      </nav>

      <div className="ch-panel">
        {activeTab === 'overview' && <TabOverview character={character} appearances={appearances} feedProfile={feedProfile} relationships={relationships} entanglements={entanglements} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} openTab={setActiveTab} />}
        {activeTab === 'inner' && <TheirType character={character} />}
        {activeTab === 'inner' && (
          <div className="ch-card">
            <TabInterior character={character} gen={gen} />
            <section className="cp-section">
              <h3 className="cp-section-title">DEPTH</h3>
              <CharacterDepthPanel characterId={character.id} characterName={name} />
            </section>
            <section className="cp-section">
              <h3 className="cp-section-title">Deep Profile</h3>
              <TabDeepProfile character={character} gen={gen} />
            </section>
          </div>
        )}
        {activeTab === 'voice' && (
          <div className="ch-voice-tab">
            <TheirVoice character={character} feedProfile={feedProfile} />
            {/* Evoni, 2026-10-17: drafting their posts belongs with their voice and feed. */}
            {character.feed_profile_id && <div className="ch-card"><GeneratePosts characterId={character.id} /></div>}
            <div className="ch-card"><TabOnline character={character} feedProfile={feedProfile} appearances={appearances} /></div>
          </div>
        )}
        {activeTab === 'connections' && <div className="ch-card"><TabConnections character={character} relationships={relationships} entanglements={entanglements} /></div>}
        {activeTab === 'world' && <div className="ch-card"><TabWorld character={character} onSaved={onSaved} gen={gen} /></div>}
        {activeTab === 'places' && <div className="ch-card"><CharacterPlacesTab key={character.id} character={character} /></div>}
      </div>
    </div>
  );
}
