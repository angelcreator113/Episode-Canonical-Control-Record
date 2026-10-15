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
import { Sparkles, ArrowRight } from 'lucide-react';
import { API_URL } from '../config/api';
import CharacterDepthPanel from '../components/CharacterDepthPanel';
import { platformLabel } from './feed/feedConstants';
import apiClient from '../services/api';
import { ROLE_LABELS } from '../constants/characterConstants';
import { findLala } from '../lib/theCast';
import { DEPTH_STEPS, depthOf, depthLevelOf, cityLabel, archetypeOf, showUpRows, withLala, voiceOf } from '../lib/characterPage';
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
export const updateSocialProfileApi = (profileId, payload) =>
  apiClient.put(`${API_URL}/social-profiles/${profileId}`, payload);
export const getSocialProfileApi = (profileId) =>
  apiClient.get(`${API_URL}/social-profiles/${profileId}`);
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
  rebuilding:    { label: 'Rebuilding',    color: '#7ab3d4', bg: '#eef5fb' },
  crossed:       { label: 'Crossed',       color: '#d4789a', bg: '#fdf0f4' },
};

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'inner',       label: 'Inner life' },
  { id: 'voice',       label: 'Voice & feed' },
  { id: 'connections', label: 'Connections' },
  { id: 'world',       label: 'In the world' },
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

function TabOverview({ character, appearances, feedProfile, onSaved, onFeedSaved, gen }) {
  return (
    <div className="ch-overview">
      <div className="ch-col">
        <TheirNames character={character} feedProfile={feedProfile} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} />
        <WhoTheyAre character={character} onSaved={onSaved} />
        <WhereTheyShowUp appearances={appearances} feedProfile={feedProfile} />
      </div>
      <div className="ch-col">
        <TheirVoice character={character} feedProfile={feedProfile} />
        <WithLala appearances={appearances} />
      </div>
    </div>
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
        {/* A matched feed profile is a social presence; Match never set the flag. */}
        <span className={`cp-social-toggle ${character.social_presence || character.feed_profile_id ? 'cp-social-on' : 'cp-social-off'}`}>
          {character.social_presence || character.feed_profile_id ? 'Active' : 'None'}
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
                  <span className="cp-feed-handle">@{feedProfile.handle}</span>
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
                    {feedProfile.follower_count?.toLocaleString() || feedProfile.follower_count_approx || '\u2014'}
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
  const city = cityLabel(feedProfile?.city);
  const archetype = archetypeOf(feedProfile);
  const firstEpisode = appearances?.episodes?.[0];
  const role = roleOf(character);

  return (
    <div className="ch-page">
      <header className="ch-hero">
        <div className="ch-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
        <div className="ch-hero-text">
          <Link to="/character-registry" className="ch-back">&larr; The cast</Link>
          <h1 className="ch-name">{name}</h1>
          {/* Their real name heads the page; the name they post under follows. */}
          {socialName && socialName !== name && <p className="ch-aka" data-testid="ch-aka">Online as {socialName}</p>}
          <p className="ch-sub">{[handle, role, city].filter(Boolean).join(' · ')}</p>
          <div className="ch-chips">
            {archetype && <span className="ch-chip">{archetype}</span>}
            {character.feed_profile_id && <span className="ch-chip is-blue">Feed profile</span>}
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
          <button type="button" className="ch-link" onClick={exportJson}>Export</button>
        </div>
      </header>

      <nav className="ch-tabs" aria-label="Character sections">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={`ch-tab${activeTab === tab.id ? ' is-on' : ''}`}
            aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="ch-panel">
        {activeTab === 'overview' && <TabOverview character={character} appearances={appearances} feedProfile={feedProfile} onSaved={onSaved} onFeedSaved={onFeedSaved} gen={gen} />}
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
            <div className="ch-card"><TabOnline character={character} feedProfile={feedProfile} appearances={appearances} /></div>
          </div>
        )}
        {activeTab === 'connections' && <div className="ch-card"><TabConnections character={character} relationships={relationships} entanglements={entanglements} /></div>}
        {activeTab === 'world' && <div className="ch-card"><TabWorld character={character} onSaved={onSaved} gen={gen} /></div>}
      </div>
    </div>
  );
}
