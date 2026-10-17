/**
 * The Inner life tab as a workspace (Evoni, 2026-10-17, step 2): five
 * sections (lib/innerLifeSections) in place of the always-open interior,
 * DEPTH panel and deep profile. Each subject reads as a short summary; Edit
 * opens that subject's fields and nothing else. Suggest asks the Depth
 * Engine for a draft, which fills only empty fields and saves nothing until
 * Save. The blind spot and the narrative gap are for the author (admin) only.
 *
 * Fill in everything missing (step 3) drafts first: a review lists what it
 * would write in each field, already-written fields are never replaced, and
 * a field with unsaved edits in the open editor is left out unless ticked.
 * The open editor keeps its words whatever is saved.
 *
 * Props: character, gen (useInteriorGenerate), onSaved(patch), typeCard (the
 * Their type card, shown at the top of Core psychology).
 */
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Sparkles, Search, Pencil } from 'lucide-react';
import AuthContext from '../../contexts/AuthContext';
import { isAdmin } from '../../utils/authGroups';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import {
  SECTIONS, DEEP_PROFILE, FORECLOSURE_CATEGORIES, draftOf, saveOf, filledCount, sectionProgress, summaryOf, applySuggestion,
  DIMENSION_KEYS, dimensionLabel, dimensionOf, dimensionText, searchDimensions, dimensionDraft, deepProfileWith, reviewRows,
} from '../../lib/innerLifeSections';
import './InnerLifeWorkspace.css';

const updateCharacterApi = (id, payload) => apiClient.put(`${API_URL}/character-registry/characters/${id}`, payload);
// A draft of one Depth Engine dimension; nothing is saved (routes/characterDepthRoutes).
const suggestDimensionApi = (id, dimension) => apiClient.post(`${API_URL}/character-depth/${id}/generate/${dimension}`);

const words = (s) => String(s || '').replace(/_/g, ' ');
const CLAMP = 220;

/* ── Reading ─────────────────────────────────────────────────────────────── */

function Clamped({ text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP;
  return (
    <>
      <p className={`il-text${long && !open ? ' is-clamped' : ''}`}>{text}</p>
      {long && <button type="button" className="il-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>}
    </>
  );
}

/* ── Editing ─────────────────────────────────────────────────────────────── */

function Slider({ id, value, onChange }) {
  if (value === null || value === undefined) {
    return <button type="button" className="il-chip" id={id} onClick={() => onChange(50)}>Not set · set it</button>;
  }
  return (
    <div className="il-slider">
      <input id={id} type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{value}</output>
      <button type="button" className="il-more" onClick={() => onChange(null)}>Clear</button>
    </div>
  );
}

function Foreclosed({ value, onChange }) {
  const v = value || { selected: [], origins: {}, visibility: {}, cracks: {} };
  const toggle = (c) => onChange({ ...v, selected: v.selected.includes(c) ? v.selected.filter((x) => x !== c) : [...v.selected, c] });
  const note = (part, c, x) => onChange({ ...v, [part]: { ...v[part], [c]: x } });
  return (
    <div className="il-foreclosed">
      <div className="il-chips" role="group" aria-label="Doors they have closed">
        {FORECLOSURE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`il-chip${v.selected.includes(c) ? ' is-on' : ''}`} aria-pressed={v.selected.includes(c)} onClick={() => toggle(c)}>{words(c)}</button>
        ))}
      </div>
      {v.selected.map((c) => (
        <fieldset key={c} className="il-door">
          <legend>{words(c)}</legend>
          <label>Why it closed<textarea rows={2} value={v.origins[c] || ''} onChange={(e) => note('origins', c, e.target.value)} /></label>
          <label>How visible it is to others (0 hidden, 100 obvious)
            <Slider id={`il-vis-${c}`} value={v.visibility[c] ?? null} onChange={(x) => note('visibility', c, x)} />
          </label>
          <label>What could open it again<textarea rows={2} value={v.cracks[c] || ''} onChange={(e) => note('cracks', c, e.target.value)} /></label>
        </fieldset>
      ))}
    </div>
  );
}

function Field({ fd, value, onChange }) {
  const id = `il-f-${fd.key}`;
  let input;
  if (fd.type === 'text') input = <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  else if (fd.type === 'select') {
    // A stored value from before the lists were merged still shows.
    const options = value && !fd.options.some((o) => o.value === value) ? [...fd.options, { value, label: words(value) }] : fd.options;
    input = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not chosen</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (fd.type === 'slider') input = <Slider id={id} value={value} onChange={onChange} />;
  else if (fd.type === 'foreclosed') return <div className="il-field"><span className="il-label">{fd.label}</span><Foreclosed value={value} onChange={onChange} /></div>;
  else input = <textarea id={id} rows={fd.type === 'list' ? 4 : 3} value={value} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className="il-field">
      <label className="il-label" htmlFor={id}>{fd.label}{fd.authorOnly && <span className="il-badge">Author only</span>}</label>
      {input}
    </div>
  );
}

function SubjectEditor({ character, subject, isAuthor, onSaved, onClose, onPending }) {
  const [form, setForm] = useState(() => draftOf(character, subject, isAuthor));
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const changes = saveOf(character, subject, form, isAuthor);
  const dirty = Object.keys(changes).length > 0;
  const fields = subject.fields.filter((fd) => isAuthor || !fd.authorOnly);
  // The columns with unsaved words, for Generate All's review.
  const pendingKey = Object.keys(changes).sort().join(',');
  useEffect(() => { onPending(pendingKey ? pendingKey.split(',') : []); }, [pendingKey, onPending]);
  useEffect(() => () => onPending([]), [onPending]);

  const save = async () => {
    setBusy('save'); setNote(null);
    try {
      const res = await updateCharacterApi(character.id, changes);
      onSaved(res.data?.character || changes);
      onClose();
    } catch (err) {
      console.error('[InnerLifeWorkspace] save failed:', err);
      setNote({ error: true, text: err.response?.data?.error || err.message || 'Could not save it.' });
      setBusy(null);
    }
  };

  const suggest = async () => {
    setBusy('suggest'); setNote(null);
    try {
      const res = await suggestDimensionApi(character.id, subject.dimension);
      const { form: next, filled } = applySuggestion(subject, form, res.data?.proposed, isAuthor);
      setForm(next);
      setNote({ text: filled.length
        ? `Suggested: ${filled.join('; ')}. Read it over; nothing is saved until you press Save.`
        : 'Nothing to add: every field it suggested already has words.' });
    } catch (err) {
      console.error('[InnerLifeWorkspace] suggest failed:', err);
      setNote({ error: true, text: err.response?.data?.error || err.message || 'Could not suggest anything.' });
    } finally { setBusy((b) => (b === 'suggest' ? null : b)); }
  };

  return (
    <form className="il-editor" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }} aria-label={`Edit ${subject.label}`}>
      {fields.map((fd) => (
        <Field key={fd.key} fd={fd} value={form[fd.key]} onChange={(v) => setForm((f) => ({ ...f, [fd.key]: v }))} />
      ))}
      <div className="il-actions">
        <button type="submit" className="il-btn" disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button type="button" className="il-btn-soft" disabled={busy === 'save'} onClick={onClose}>Cancel</button>
        {subject.dimension && (
          <button type="button" className="il-btn-soft" disabled={!!busy} onClick={suggest} title="Drafts the empty fields from who they already are">
            <Sparkles size={14} aria-hidden="true" /> {busy === 'suggest' ? 'Suggesting…' : 'Suggest empty fields'}
          </button>
        )}
      </div>
      {note && <p className={`il-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}
    </form>
  );
}

/* ── A subject ───────────────────────────────────────────────────────────── */

function Subject({ character, subject, isAuthor, locked, gen, editing, setEditing, onSaved, onPending }) {
  const { filled, total } = filledCount(character, subject, isAuthor);
  const summary = summaryOf(character, subject, isAuthor);
  const isOpen = editing === subject.key;
  const genKey = subject.generate?.join(',');
  const genNote = gen && genKey && gen.note?.key === genKey ? gen.note : null;
  return (
    <article className={`il-subject${isOpen ? ' is-editing' : ''}`} data-testid={`il-subject-${subject.key}`}>
      <header className="il-subject-head">
        <h4 className="il-subject-title">{subject.label}</h4>
        {subject.authorOnly && <span className="il-badge">Author only</span>}
        <span className={`il-count${filled === total ? ' is-full' : ''}`}>{filled}/{total}</span>
        {!locked && !isOpen && (
          <button type="button" className="il-edit" disabled={!!editing} onClick={() => setEditing(subject.key)} aria-label={`Edit ${subject.label}`}>
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
        )}
      </header>
      {isOpen ? (
        <SubjectEditor character={character} subject={subject} isAuthor={isAuthor} onSaved={onSaved} onClose={() => setEditing(null)} onPending={onPending} />
      ) : filled === 0 ? (
        <div className="cp-empty-state il-empty">
          <p className="cp-empty-label">{subject.label} not written yet.</p>
          {!locked && subject.generate && (
            <button type="button" className="il-btn-soft" disabled={!!gen.busy} onClick={() => gen.run(subject.generate)}>
              <Sparkles size={14} aria-hidden="true" /> {gen.busy === genKey ? 'Generating…' : 'Generate'}
            </button>
          )}
          {genNote && <p className={`il-note${genNote.error ? ' is-error' : ''}`} role="status">{genNote.text}</p>}
        </div>
      ) : summary.length ? (
        <dl className="il-summary">
          {summary.map((s) => (
            <div key={s.label}><dt>{s.label}</dt><dd><Clamped text={s.text} /></dd></div>
          ))}
        </dl>
      ) : (
        <p className="il-text is-faint">{filled} of {total} written; Edit to read them.</p>
      )}
    </article>
  );
}

/* ── The Deep profile ────────────────────────────────────────────────────── */

function DimensionEditor({ character, dimKey, onSaved, onClose, onPending }) {
  const [draft, setDraft] = useState(() => dimensionDraft(character.deep_profile, dimKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const before = JSON.stringify(dimensionDraft(character.deep_profile, dimKey));
  const dirty = JSON.stringify(draft) !== before;
  useEffect(() => { onPending(dirty ? ['deep_profile'] : []); }, [dirty, onPending]);
  useEffect(() => () => onPending([]), [onPending]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const deep_profile = deepProfileWith(character.deep_profile, dimKey, draft);
      const res = await updateCharacterApi(character.id, { deep_profile });
      onSaved(res.data?.character || { deep_profile });
      onClose();
    } catch (err) {
      console.error('[InnerLifeWorkspace] deep profile save failed:', err);
      setError(err.response?.data?.error || err.message || 'Could not save it.');
      setBusy(false);
    }
  };
  return (
    <form className="il-editor" onSubmit={save} aria-label={`Edit ${dimensionLabel(dimKey)}`}>
      {draft.parts ? draft.parts.map(([k, v], i) => (
        <div className="il-field" key={k}>
          <label className="il-label" htmlFor={`il-dp-${k}`}>{words(k)}</label>
          <textarea id={`il-dp-${k}`} rows={2} value={v} onChange={(e) => setDraft({ parts: draft.parts.map((p, j) => (j === i ? [k, e.target.value] : p)) })} />
        </div>
      )) : (
        <div className="il-field">
          <label className="il-label" htmlFor={`il-dp-${dimKey}`}>{dimensionLabel(dimKey)}</label>
          <textarea id={`il-dp-${dimKey}`} rows={5} value={draft.text} onChange={(e) => setDraft({ text: e.target.value })} />
        </div>
      )}
      <div className="il-actions">
        <button type="submit" className="il-btn" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="il-btn-soft" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      {error && <p className="il-note is-error" role="status">{error}</p>}
    </form>
  );
}

function DeepProfile({ character, locked, gen, editing, setEditing, onSaved, onPending }) {
  const dp = character.deep_profile;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const populated = DIMENSION_KEYS.filter((k) => dimensionText(dimensionOf(dp, k)));
  const shown = searchDimensions(dp, query);
  const genNote = gen.note?.key === 'deep_profile' ? gen.note : null;

  return (
    <div className="il-deep">
      <div className="il-deep-head">
        <span className="il-count is-big">{populated.length}/14 dimensions</span>
        {populated.length === 14 && <span className="il-badge is-gold">Complete</span>}
        <label className="il-search">
          <Search size={15} aria-hidden="true" />
          <span className="il-sr">Search the dimensions</span>
          <input type="search" placeholder="Search dimensions" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {populated.length === 0 && !locked && (
        <div className="cp-empty-state il-empty">
          <p className="cp-empty-label">Deep profile not generated yet.</p>
          <button type="button" className="il-btn-soft" disabled={!!gen.busy} onClick={() => gen.run(['deep_profile'])}>
            <Sparkles size={14} aria-hidden="true" /> {gen.busy === 'deep_profile' ? 'Generating…' : 'Generate'}
          </button>
          {genNote && <p className={`il-note${genNote.error ? ' is-error' : ''}`} role="status">{genNote.text}</p>}
        </div>
      )}
      {shown.length === 0 && <p className="il-text is-faint">No dimension matches “{query}”.</p>}
      <ul className="il-dims">
        {shown.map((key) => {
          const text = dimensionText(dimensionOf(dp, key));
          const isOpen = open === key || editing === `dp:${key}`;
          return (
            <li key={key} className={`il-dim${isOpen ? ' is-open' : ''}${text ? '' : ' is-empty'}`}>
              <div className="il-dim-head">
                <button type="button" className="il-dim-toggle" aria-expanded={isOpen} disabled={!text}
                  onClick={() => setOpen(open === key ? null : key)}>
                  <span className="il-dim-label">{dimensionLabel(key)}</span>
                  {!text && <span className="il-dim-missing">not written</span>}
                </button>
                {!locked && editing !== `dp:${key}` && (
                  <button type="button" className="il-edit" disabled={!!editing} onClick={() => setEditing(`dp:${key}`)} aria-label={`Edit ${dimensionLabel(key)}`}>
                    <Pencil size={13} aria-hidden="true" /> {text ? 'Edit' : 'Write'}
                  </button>
                )}
              </div>
              {editing === `dp:${key}` ? (
                <DimensionEditor character={character} dimKey={key} onSaved={onSaved} onClose={() => setEditing(null)} onPending={onPending} />
              ) : isOpen && text && <p className="il-text il-dim-text">{text}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Generate All: look it over before it is saved ───────────────────────── */

function Review({ character, gen, pending }) {
  const rows = useMemo(() => reviewRows(character, gen.review.proposed, pending), [character, gen.review, pending]);
  const [keep, setKeep] = useState(() => Object.fromEntries(rows.map((r) => [r.field, r.keep])));
  const chosen = rows.filter((r) => keep[r.field] && !r.written);
  const save = () => gen.apply(Object.fromEntries(chosen.map((r) => [r.field, gen.review.proposed[r.field]])));
  return (
    <section className="il-review" aria-labelledby="il-review-h" data-testid="il-review">
      <header className="il-review-head">
        <h3 id="il-review-h" className="il-review-title">Look it over before it is saved</h3>
        <p className="il-note">Drafted from who they already are. Nothing is saved until you press Save. Anything already written is never replaced, and any editor you have open keeps its words.</p>
      </header>
      <ul className="il-review-list">
        {rows.map((r) => (
          <li key={r.field} className={`il-review-row${r.written ? ' is-written' : ''}`}>
            <label className="il-review-pick">
              <input type="checkbox" checked={!!keep[r.field] && !r.written} disabled={r.written || gen.busy === 'apply'}
                onChange={(e) => setKeep((k) => ({ ...k, [r.field]: e.target.checked }))} />
              <span className="il-review-label">{r.label}</span>
              {r.written && <span className="il-badge is-gold">Already written · kept as is</span>}
              {r.unsaved && <span className="il-badge">You have unsaved edits here</span>}
            </label>
            {r.unsaved && <p className="il-note">Your edits stay in the editor. Tick this to save the draft into the parts that are empty now; when you save the editor, your words win.</p>}
            <dl className="il-review-lines">
              {r.lines.map(([k, text], i) => (
                <div key={i}>{k && <dt>{k}</dt>}<dd>{text}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="il-actions">
        <button type="button" className="il-btn" disabled={!chosen.length || gen.busy === 'apply'} onClick={save}>
          {gen.busy === 'apply' ? 'Saving…' : `Save ${chosen.length} of ${rows.length}`}
        </button>
        <button type="button" className="il-btn-soft" disabled={gen.busy === 'apply'} onClick={gen.discard}>Discard the draft</button>
      </div>
    </section>
  );
}

/* ── The workspace ───────────────────────────────────────────────────────── */

export default function InnerLifeWorkspace({ character, gen, onSaved, typeCard = null, archive = null }) {
  const auth = useContext(AuthContext);
  const isAuthor = isAdmin(auth?.user);
  const locked = character.status === 'finalized';
  const [sectionKey, setSectionKey] = useState('core');
  const [editing, setEditing] = useState(null);
  const [pending, setPendingState] = useState([]);
  const setPending = useCallback((cols) => setPendingState((prev) => (prev.join(',') === cols.join(',') ? prev : cols)), []);
  const section = SECTIONS.find((s) => s.key === sectionKey);
  const allNote = gen.note?.key === 'all' ? gen.note : null;

  const nav = useMemo(() => [
    ...SECTIONS.map((s) => {
      const { started, total } = sectionProgress(character, s, isAuthor);
      return { key: s.key, label: s.label, progress: `${started}/${total}` };
    }),
    { key: DEEP_PROFILE.key, label: DEEP_PROFILE.label, progress: `${DIMENSION_KEYS.filter((k) => dimensionText(dimensionOf(character.deep_profile, k))).length}/14` },
  ], [character, isAuthor]);

  const deepFilled = DIMENSION_KEYS.some((k) => dimensionText(dimensionOf(character.deep_profile, k)));
  const missing = SECTIONS.flatMap((s) => s.subjects)
    .filter((s) => s.generate && (isAuthor || !s.authorOnly) && filledCount(character, s, isAuthor).filled === 0).length
    + (deepFilled ? 0 : 1);

  const pick = (key) => { setSectionKey(key); setEditing(null); };

  return (
    <div className="il-workspace">
      <nav className="il-nav" aria-label="Inner life sections">
        {nav.map((n) => (
          <button key={n.key} type="button" className={`il-pill${sectionKey === n.key ? ' is-on' : ''}`} aria-pressed={sectionKey === n.key} onClick={() => pick(n.key)}>
            {n.label}<span className="il-pill-count">{n.progress}</span>
          </button>
        ))}
      </nav>

      {gen.review && !gen.locked ? (
        <Review key={Object.keys(gen.review.proposed).join(',')} character={character} gen={gen} pending={pending} />
      ) : (missing > 0 || allNote) && !gen.locked && (
        <div className="il-fill">
          {missing > 0 && <p className="il-note">{missing} {missing === 1 ? 'part' : 'parts'} of their inner life {missing === 1 ? 'is' : 'are'} empty. Draft them from who they already are; you look them over before anything is saved.</p>}
          {missing > 0 && (
            <button type="button" className="il-btn" disabled={!!gen.busy} onClick={() => gen.preview()}>
              {gen.busy === 'all' ? 'Drafting… (about a minute)' : 'Fill in everything missing'}
            </button>
          )}
          {allNote && <p className={`il-note${allNote.error ? ' is-error' : ''}`} role="status">{allNote.text}</p>}
        </div>
      )}

      {section ? (
        <section className="il-section" aria-labelledby={`il-h-${section.key}`}>
          <header className="il-section-head">
            <h3 id={`il-h-${section.key}`} className="il-section-title">{section.label}</h3>
            <p className="il-about">{section.about}</p>
          </header>
          {section.key === 'core' && typeCard}
          <div className="il-subjects">
            {section.subjects.filter((s) => isAuthor || !s.authorOnly).map((s) => (
              <Subject key={s.key} character={character} subject={s} isAuthor={isAuthor} locked={locked} gen={gen}
                editing={editing} setEditing={setEditing} onSaved={onSaved} onPending={setPending} />
            ))}
          </div>
        </section>
      ) : (
        <section className="il-section" aria-labelledby="il-h-deep">
          <header className="il-section-head">
            <h3 id="il-h-deep" className="il-section-title">{DEEP_PROFILE.label}</h3>
            <p className="il-about">{DEEP_PROFILE.about}</p>
          </header>
          <DeepProfile character={character} locked={locked} gen={gen} editing={editing} setEditing={setEditing} onSaved={onSaved} onPending={setPending} />
        </section>
      )}

      {archive}
    </div>
  );
}
