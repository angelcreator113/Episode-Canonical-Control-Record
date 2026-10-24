/**
 * Heritage in the family (Evoni, 2026-10-24: "how can we be sure race makes
 * sense in the family trees?"; "I want them all and show me first").
 * Prime Studios · LalaVerse
 *
 * Real families include mixed heritage, adoption, step and chosen family.
 * These pieces help Evoni notice; they never enforce sameness, never block a
 * save, and never change anyone's heritage on their own
 * (routes/families GET /heritage, services/familyHeritage).
 *
 *   useHeritage(params)    the heritage report: people, flags, intended, gaps, starter tags
 *   heritageLabel(person)  their heritage in words: their own wording, else their tags
 *   HeritagePicker         the starter tags (multi-select) and "add your own"
 *   HeritageEditor         the picker with "in their words" and Save (writes the character; ADMIN)
 *   HeritageLine           under a name: their heritage, or "Heritage not set" with the
 *                          inline edit; "—" for someone who is not a character
 *   HeritagePanel          "Heritage: 2 to look at": the gentle check's notes, each with
 *                          "Look at it" and "This is intended", and the gap list
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Check, Undo2 } from 'lucide-react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import './Heritage.css';

export const getHeritageApi = (params) => apiClient.get(`${API_URL}/families/heritage`, { params });
export const saveHeritageApi = (id, body) => apiClient.put(`${API_URL}/families/heritage/${id}`, body);
export const markIntendedApi = (key) => apiClient.post(`${API_URL}/families/heritage/intended/${encodeURIComponent(key)}`);
export const clearIntendedApi = (key) => apiClient.delete(`${API_URL}/families/heritage/intended/${encodeURIComponent(key)}`);
export const getRelativeSuggestionApi = (params) => apiClient.get(`${API_URL}/families/make-character/suggestion`, { params });

export const PRINCIPLE = 'Real families include mixed heritage, adoption, step and chosen family. This only points things out for you to look at: it never blocks a save or changes anyone’s heritage.';

const key = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

/** Their heritage in words: their own wording when written, else their tags; null when neither. */
export function heritageLabel(p) {
  if (!p) return null;
  if (p.ethnicity) return p.ethnicity;
  const tags = Array.isArray(p.heritage_tags) ? p.heritage_tags : [];
  return tags.length ? tags.join(' · ') : null;
}

/** The heritage report for { family_id } / { character_id } / {} (everyone). skip: not yet. */
export function useHeritage(params = {}, { skip = false } = {}) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const paramKey = JSON.stringify(params);
  const load = useCallback(async () => {
    try {
      const res = await getHeritageApi(JSON.parse(paramKey));
      setReport(res?.data || null);
      setError(null);
    } catch (err) {
      console.error('[Heritage] heritage load failed:', err);
      setError(errorOf(err, 'Could not load heritage.'));
    }
  }, [paramKey]);
  useEffect(() => { if (!skip) load(); }, [skip, load]);
  const byId = Object.fromEntries((report?.people || []).map((p) => [String(p.id), p]));
  return { report, byId, error, reload: load };
}

/** The starter tags as toggles, their own tags, and "add your own". */
export function HeritagePicker({ tags = [], onTags, starterTags = [], idPrefix = 'hp' }) {
  const [own, setOwn] = useState('');
  const keys = new Set(tags.map(key));
  const starterKeys = new Set(starterTags.map(key));
  const toggle = (t) => onTags(keys.has(key(t)) ? tags.filter((x) => key(x) !== key(t)) : [...tags, t]);
  const add = () => {
    const t = own.trim().replace(/\s+/g, ' ');
    if (t && !keys.has(key(t))) onTags([...tags, t]);
    setOwn('');
  };
  const custom = tags.filter((t) => !starterKeys.has(key(t)));
  return (
    <div className="hx-picker">
      <div className="hx-chips" role="group" aria-label="Heritage tags">
        {starterTags.map((t) => (
          <button key={t} type="button" className={`hx-chip${keys.has(key(t)) ? ' is-on' : ''}`} aria-pressed={keys.has(key(t))} onClick={() => toggle(t)}>{t}</button>
        ))}
        {custom.map((t) => (
          <button key={t} type="button" className="hx-chip is-on is-own" aria-pressed="true" aria-label={`Remove ${t}`} onClick={() => toggle(t)}>
            {t} <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="hx-own">
        <label className="hx-sr" htmlFor={`${idPrefix}-own`}>Add your own tag</label>
        <input id={`${idPrefix}-own`} className="hx-input" value={own} placeholder="Add your own…" maxLength={60}
          onChange={(e) => setOwn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="hx-btn-soft" onClick={add} disabled={!own.trim()}><Plus size={14} aria-hidden="true" /> Add</button>
      </div>
    </div>
  );
}

/** The inline edit: tags, their own words, Save. Writes the character (ADMIN on the server). */
export function HeritageEditor({ person, starterTags, onSaved, onCancel }) {
  const [tags, setTags] = useState(person?.heritage_tags || []);
  const [words, setWords] = useState(person?.ethnicity || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const save = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await saveHeritageApi(person.id, { heritage_tags: tags, ethnicity: words });
      onSaved?.(res.data?.person);
    } catch (err) {
      console.error('[Heritage] save failed:', err);
      setNote(errorOf(err, 'Could not save their heritage.'));
    } finally { setBusy(false); }
  };
  return (
    <div className="hx-editor" role="group" aria-label={`Heritage for ${person?.name || 'them'}`}>
      <HeritagePicker tags={tags} onTags={setTags} starterTags={starterTags} idPrefix={`hx-${person?.id}`} />
      <label className="hx-field">
        <span>In their words (optional)</span>
        <input className="hx-input" value={words} maxLength={150} placeholder="e.g. Black and Korean" onChange={(e) => setWords(e.target.value)} />
      </label>
      {note && <p className="hx-note is-error" role="status">{note}</p>}
      <div className="hx-row">
        <button type="button" className="hx-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save heritage'}</button>
        <button type="button" className="hx-btn-soft" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * Under a name. kind 'ghost' / 'profile': "—" (they are not a character
 * yet) with makeHref, the page where Make them a character is.
 */
export function HeritageLine({ person, kind = 'character', starterTags = [], onSaved, makeHref = null, name, unset = false }) {
  const [editing, setEditing] = useState(false);
  if (kind !== 'character') {
    return (
      <span className="hx-line is-none">
        <span aria-label="No heritage: not a character yet">—</span>
        {makeHref && <Link className="hx-link" to={makeHref}>Make them a character</Link>}
      </span>
    );
  }
  if (!person) return null;
  // unset: the gap list's line, for someone with words but no tags yet.
  const label = unset ? null : heritageLabel(person);
  if (editing) {
    return <HeritageEditor person={person} starterTags={starterTags} onCancel={() => setEditing(false)} onSaved={(p) => { setEditing(false); onSaved?.(p); }} />;
  }
  return (
    <span className={`hx-line${label ? '' : ' is-unset'}`}>
      <span>{label || 'Heritage not set'}</span>
      <button type="button" className="hx-edit" onClick={() => setEditing(true)} aria-label={`${label ? 'Edit' : 'Set'} heritage for ${name || person.name}`}>
        {label ? 'edit' : 'set'}
      </button>
    </span>
  );
}

/**
 * The quiet panel: "Heritage: 2 to look at", then each note, the notes
 * marked intended (with Undo) and the gap list. Closed until opened unless
 * startOpen.
 */
export function HeritagePanel({ report, onChanged, startOpen = false, scopeName = null }) {
  const [open, setOpen] = useState(startOpen);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  if (!report) return null;
  const flags = report.flags || [];
  const intended = report.intended || [];
  const gaps = report.gaps || [];
  const act = async (fn, k, fallback) => {
    setBusy(k); setNote(null);
    try { await fn(k); await onChanged?.(); } catch (err) {
      console.error('[Heritage] note update failed:', err);
      setNote(errorOf(err, fallback));
    } finally { setBusy(null); }
  };
  const summary = [
    flags.length ? `${flags.length} to look at` : 'nothing to look at',
    gaps.length ? `${gaps.length} not set` : null,
  ].filter(Boolean).join(' · ');
  return (
    <section className={`hx-panel${flags.length ? ' has-flags' : ''}`} aria-label="Heritage in the family" data-testid="hx-panel">
      <button type="button" className="hx-panel-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <strong>Heritage:</strong> {summary}{scopeName ? <span className="hx-scope"> · {scopeName}</span> : null}
      </button>
      {open && (
        <div className="hx-panel-body">
          <p className="hx-note">{PRINCIPLE}</p>
          {note && <p className="hx-note is-error" role="status">{note}</p>}
          {flags.length > 0 && (
            <ul className="hx-flags" aria-label="Heritage to look at">
              {flags.map((f) => (
                <li key={f.key} className="hx-flag">
                  <p className="hx-flag-text">{f.sentence}</p>
                  <div className="hx-row">
                    <Link className="hx-btn-soft" to={`/character/${f.person_id}`}>Look at it</Link>
                    <button type="button" className="hx-btn-soft" disabled={busy === f.key}
                      onClick={() => act(markIntendedApi, f.key, 'Could not save that.')}>
                      <Check size={14} aria-hidden="true" /> This is intended
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {intended.length > 0 && (
            <div className="hx-block">
              <h4 className="hx-h4">Marked intended · {intended.length}</h4>
              <p className="hx-note">Quiet until either person’s heritage tags change.</p>
              <ul className="hx-flags is-quiet" aria-label="Marked intended">
                {intended.map((f) => (
                  <li key={f.key} className="hx-flag is-intended">
                    <p className="hx-flag-text">{f.sentence}</p>
                    <button type="button" className="hx-btn-soft" disabled={busy === f.key}
                      onClick={() => act(clearIntendedApi, f.key, 'Could not undo that.')}>
                      <Undo2 size={14} aria-hidden="true" /> Undo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="hx-block">
              <h4 className="hx-h4">Family members with no heritage set · {gaps.length}</h4>
              <ul className="hx-gaps" aria-label="Family members with no heritage set">
                {gaps.map((p) => (
                  <li key={p.id} className="hx-gap">
                    <Link className="hx-gap-name" to={`/character/${p.id}`}>{p.name}</Link>
                    {p.ethnicity && <span className="hx-note">In their words: “{p.ethnicity}” · no tags yet</span>}
                    <HeritageLine person={p} unset starterTags={report.starter_tags} onSaved={onChanged} name={p.name} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
