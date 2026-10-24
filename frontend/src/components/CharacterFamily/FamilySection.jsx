/**
 * The character page's Family section (Evoni, 2026-10-23: "how can we give
 * family to characters? It helps with relationships"; "I want them all").
 * It took the place of the read-only family tree card.
 *
 *   their family ties     from the relationships (one row per pair, both
 *                         directions; routes/families GET /character/:id)
 *   their named family    "The Colemans", with characters, Pulse profiles
 *                         and names not built yet
 *   + Add family          pick a character or a Pulse profile, or type a
 *                         name; their role; the kind of family
 *   Make them a character a name or a Pulse profile becomes a character,
 *                         tied to them, in one step
 *   Import family         once: their generated family tree becomes a
 *                         named family
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, UserPlus, Download, X } from 'lucide-react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import { atHandle } from '../../pages/feed/feedConstants';
import './FamilySection.css';

export const KINDS = [
  ['blood', 'Blood'], ['step', 'Step'], ['adoptive', 'Adoptive'], ['married', 'Married in'], ['chosen', 'Chosen'],
];
const KIND_LABEL = Object.fromEntries(KINDS);
const ROLE_SUGGESTIONS = [
  'mother', 'father', 'sister', 'brother', 'daughter', 'son', 'aunt', 'uncle', 'niece', 'nephew', 'cousin',
  'grandmother', 'grandfather', 'stepmother', 'stepfather', 'stepsister', 'stepbrother', 'half-sister', 'half-brother',
  'sister-in-law', 'brother-in-law', 'godmother', 'chosen family',
];

export const getFamilyApi = (id) => apiClient.get(`${API_URL}/families/character/${id}`);
export const getFamilyPeopleApi = (id) => apiClient.get(`${API_URL}/families/people`, { params: { character_id: id } });
export const addFamilyApi = (payload) => apiClient.post(`${API_URL}/families/ties`, payload);
export const removeTieApi = (relId) => apiClient.delete(`${API_URL}/families/ties/${relId}`);
export const makeCharacterApi = (payload) => apiClient.post(`${API_URL}/families/make-character`, payload);
export const importFamilyApi = (id) => apiClient.post(`${API_URL}/families/import/${id}`);

/** The kind a role implies, as the server reads it (services/familyTies kindOf). */
export function kindOfRole(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('step')) return 'step';
  if (r.includes('adopt')) return 'adoptive';
  if (r.includes('chosen')) return 'chosen';
  if (r.includes('in-law') || r.includes('in law')) return 'married';
  return 'blood';
}

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

/** Their family as the server reads it, with a reload and a setter for write replies. */
function useFamily(characterId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await getFamilyApi(characterId);
      setData(res.data || null);
      setError(null);
    } catch (err) {
      console.error('[FamilySection] family load failed:', err);
      setError(errorOf(err, 'Could not load their family.'));
    }
  }, [characterId]);
  useEffect(() => { if (characterId) load(); }, [characterId, load]);
  return { data, setData, error, load };
}

function KindChip({ kind }) {
  if (!kind) return null;
  return <span className={`cf-kind is-${kind}`}>{KIND_LABEL[kind] || kind}</span>;
}

/* ── + Add family ───────────────────────────────────────────────────── */

const SOURCES = [['character', 'A character'], ['profile', 'A Pulse profile'], ['name', 'Type a name']];

export function AddFamilyForm({ character, onDone, onCancel }) {
  const name = character.selected_name || character.display_name || 'them';
  const [source, setSource] = useState('character');
  const [people, setPeople] = useState({ characters: [], profiles: [] });
  const [pick, setPick] = useState('');
  const [typed, setTyped] = useState('');
  const [role, setRole] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let live = true;
    getFamilyPeopleApi(character.id)
      .then((res) => { if (live) setPeople({ characters: res.data?.characters || [], profiles: res.data?.profiles || [] }); })
      .catch((err) => console.error('[FamilySection] people load failed:', err));
    return () => { live = false; };
  }, [character.id]);

  const options = source === 'character' ? people.characters : source === 'profile' ? people.profiles : [];
  const chosen = source === 'name' ? typed.trim() : (options.find((o) => String(o.id) === pick)?.name || '');
  const theKind = kind || kindOfRole(role);
  const ready = chosen && role.trim();

  const save = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setNote(null);
    try {
      const payload = { character_id: character.id, role: role.trim(), kind: theKind };
      if (source === 'character') payload.other_character_id = pick;
      else if (source === 'profile') payload.social_profile_id = Number(pick);
      else payload.ghost_name = typed.trim();
      const res = await addFamilyApi(payload);
      onDone(res.data);
    } catch (err) {
      console.error('[FamilySection] add family failed:', err);
      setNote(errorOf(err, 'Could not add them.'));
    } finally { setBusy(false); }
  };

  return (
    <form className="cf-form" onSubmit={save} aria-label="Add family">
      <div className="cf-seg" role="radiogroup" aria-label="Who">
        {SOURCES.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={source === k}
            className={`cf-seg-btn${source === k ? ' is-on' : ''}`}
            onClick={() => { setSource(k); setPick(''); }}>{l}</button>
        ))}
      </div>
      {source === 'name' ? (
        <label className="cf-field">
          <span>Their name</span>
          <input className="ch-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ruth Coleman" />
        </label>
      ) : (
        <label className="cf-field">
          <span>{source === 'character' ? 'Character' : 'Pulse profile'}</span>
          <select className="ch-input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick someone…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.handle ? ` (${atHandle(o.handle)})` : ''}</option>
            ))}
          </select>
        </label>
      )}
      <div className="cf-form-row">
        <label className="cf-field">
          <span>Their role</span>
          <input className="ch-input" list="cf-roles" value={role} onChange={(e) => setRole(e.target.value)} placeholder="sister, aunt, chosen family…" />
          <datalist id="cf-roles">{ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        <label className="cf-field">
          <span>Kind</span>
          <select className="ch-input" value={theKind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <p className="ch-note" aria-live="polite">
        {ready ? <>{chosen} is {name}&rsquo;s <strong>{role.trim()}</strong> ({(KIND_LABEL[theKind] || theKind).toLowerCase()}).</> : 'Pick who they are and their role.'}
      </p>
      {note && <p className="ch-note is-error" role="status">{note}</p>}
      <div className="ch-row">
        <button type="submit" className="ch-btn" disabled={!ready || busy}>{busy ? 'Adding…' : 'Add to family'}</button>
        <button type="button" className="ch-btn-soft" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* ── Make them a character ──────────────────────────────────────────── */

function MakeCharacter({ character, payload, label, onDone }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const make = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await makeCharacterApi({ character_id: character.id, ...payload });
      onDone(res.data);
    } catch (err) {
      console.error('[FamilySection] make character failed:', err);
      setNote(errorOf(err, 'Could not make them a character.'));
    } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className="cf-make" disabled={busy} onClick={make} aria-label={`Make ${label} a character`}>
        <UserPlus size={14} aria-hidden="true" /> {busy ? 'Making…' : 'Make them a character'}
      </button>
      {note && <span className="ch-note is-error" role="status">{note}</span>}
    </>
  );
}

/* ── the section ────────────────────────────────────────────────────── */

export default function FamilySection({ character }) {
  const { data, setData, error } = useFamily(character?.id);
  const [adding, setAdding] = useState(false);
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const name = character?.selected_name || character?.display_name || 'They';

  const took = (reply) => {
    if (reply?.ties) setData(reply);
    if (reply?.character) setMade(reply.character);
    setAdding(false);
  };
  const removeTie = async (t) => {
    setBusy(t.id); setNote(null);
    try {
      await removeTieApi(t.id);
      setData((d) => ({ ...d, ties: d.ties.filter((x) => x.id !== t.id) }));
    } catch (err) {
      console.error('[FamilySection] remove tie failed:', err);
      setNote(errorOf(err, 'Could not take the family off.'));
    } finally { setBusy(null); }
  };
  const importTree = async () => {
    setBusy('import'); setNote(null);
    try {
      const res = await importFamilyApi(character.id);
      setData(res.data);
    } catch (err) {
      console.error('[FamilySection] import failed:', err);
      setNote(errorOf(err, 'Could not import their family.'));
    } finally { setBusy(null); }
  };

  if (!character) return null;
  const ties = data?.ties || [];
  const families = data?.families || [];
  const tree = data?.family_tree || { members: [] };
  const tiedIds = new Set(ties.map((t) => String(t.other_id)));
  const notImported = !tree.imported_at && tree.members.length > 0;

  return (
    <section className="ch-card cf" aria-labelledby="ch-fam" data-testid="ch-family">
      <div className="ch-card-head">
        <h2 id="ch-fam" className="ch-h2"><Heart size={20} aria-hidden="true" className="ch-h2-icon" /> Family</h2>
        {!adding && (
          <button type="button" className="ch-btn-chip cf-add" onClick={() => { setAdding(true); setMade(null); }}>
            <Plus size={14} aria-hidden="true" /> Add family
          </button>
        )}
      </div>
      {tree.generational_wound && <p className="ch-note">Generational wound: {tree.generational_wound}</p>}
      {error && <p className="ch-note is-error" role="status">{error}</p>}
      {note && <p className="ch-note is-error" role="status">{note}</p>}
      {made && (
        <p className="ch-note cf-made" role="status">
          <Link to={`/character/${made.id}`}>{made.name}</Link> is a character now, and in {name}&rsquo;s family.
        </p>
      )}
      {adding && <AddFamilyForm character={character} onDone={took} onCancel={() => setAdding(false)} />}

      {data && (
        <div className="cf-block">
          <h3 className="cf-h3">Their family</h3>
          {ties.length === 0 ? (
            <p className="ch-note">No family ties yet. Add family to give {name} a sister, a mother, chosen family…</p>
          ) : (
            <ul className="ch-ft" aria-label="Family ties">
              {ties.map((t) => (
                <li key={t.id} className={`ch-ft-item cf-tie is-${t.kind || 'blood'}`}>
                  <div className="cf-line">
                    <Link className="ch-conn-name" to={`/character/${t.other_id}`}>{t.other_name}</Link>
                    <span className="cf-role">{t.role || 'family'}</span>
                    <KindChip kind={t.kind} />
                    <button type="button" className="cf-x" aria-label={`Remove ${t.other_name} from ${name}'s family`}
                      disabled={busy === t.id} onClick={() => removeTie(t)}><X size={14} aria-hidden="true" /></button>
                  </div>
                  {(t.tension || t.my_role) && (
                    <span className="ch-ft-meta">{t.my_role ? `${name} is their ${t.my_role}` : ''}{t.tension ? `${t.my_role ? ' · ' : ''}${t.tension}` : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {families.map((f) => {
        const others = f.members.filter((m) => String(m.registry_character_id) !== String(character.id) && !tiedIds.has(String(m.registry_character_id)));
        return (
          <div key={f.id} className="cf-block" data-testid="cf-named-family">
            <h3 className="cf-h3">{f.name}{f.home_city ? <span className="cf-city"> · {f.home_city}</span> : null}</h3>
            {f.notes && <p className="ch-note">{f.notes}</p>}
            {others.length === 0 ? <p className="ch-note">Everyone in it is above.</p> : (
              <ul className="ch-ft" aria-label={`${f.name} members`}>
                {others.map((m) => (
                  <li key={m.id} className="ch-ft-item">
                    <div className="cf-line">
                      {m.kind === 'character'
                        ? <Link className="ch-conn-name" to={`/character/${m.registry_character_id}`}>{m.name}</Link>
                        : <strong className="ch-conn-name">{m.name}</strong>}
                      {m.role && <span className="cf-role">{m.role_of_name && String(m.role_of_character_id) !== String(character.id) ? `${m.role_of_name}'s ${m.role}` : m.role}</span>}
                      {m.kind === 'ghost' && <span className="ch-chip is-plain">Not built yet</span>}
                      {m.kind === 'profile' && <span className="ch-chip is-blue">On the Pulse{m.handle ? ` · ${atHandle(m.handle)}` : ''}</span>}
                    </div>
                    {m.notes && <span className="ch-ft-meta">{m.notes}</span>}
                    {m.kind !== 'character' && (
                      <span className="ch-ft-chips"><MakeCharacter character={character} payload={{ member_id: m.id }} label={m.name} onDone={took} /></span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {notImported && (
        <div className="cf-block cf-tree" data-testid="cf-tree">
          <div className="cf-tree-head">
            <h3 className="cf-h3">From their generated family tree</h3>
            <button type="button" className="ch-btn-soft cf-import" disabled={busy === 'import'} onClick={importTree}>
              <Download size={14} aria-hidden="true" /> {busy === 'import' ? 'Importing…' : 'Import family'}
            </button>
          </div>
          <p className="ch-note">Import family once to make these people a named family: anyone already a character is tied to {name}; the rest wait as names.</p>
          <ul className="ch-ft" aria-label="Generated family tree">
            {tree.members.map((m) => (
              <li key={m.index} className="ch-ft-item">
                <div className="cf-line">
                  {m.matched_character_id
                    ? <Link className="ch-conn-name" to={`/character/${m.matched_character_id}`}>{m.name}</Link>
                    : <strong className="ch-conn-name">{m.name}</strong>}
                  {m.relation && <span className="cf-role">{m.relation}</span>}
                </div>
                {m.sketch && <span className="ch-conn-note">{m.sketch}</span>}
                {!m.matched_character_id && m.relation && (
                  <span className="ch-ft-chips"><MakeCharacter character={character} payload={{ tree_index: m.index }} label={m.name} onDone={took} /></span>
                )}
                {m.matched_character_id && <span className="ch-ft-chips"><span className="cp-promoted-badge">In the registry</span></span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
