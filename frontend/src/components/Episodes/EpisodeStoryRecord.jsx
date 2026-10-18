/**
 * The Episode Story Record (Evoni, 2026-10-17, stage C): what happened, what
 * each character knew and learned and how they changed, the secrets hinted
 * at or revealed, and what is left open. Drafted from the episode (after
 * completion, or here); it counts once approved: the short story and the
 * chapter writers read it, and its secrets move on with the audience
 * (services/episodeStoryRecord). Results → Story, above the story formats.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, Sparkles, Check, Plus, X } from 'lucide-react';
import api from '../../services/api';
import './EpisodeStoryRecord.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const formOf = (record) => ({
  what_happened: record?.what_happened || '',
  characters: (record?.characters || []).map((c) => ({ ...c })),
  secrets: (record?.secrets || []).map((s) => ({ ...s })),
  threads: (record?.threads || []).map((t) => ({ ...t })),
});
const body = (form) => ({
  what_happened: form.what_happened,
  characters: form.characters.map(({ character_id, knew, learned, changed }) => ({ character_id, knew, learned, changed })),
  secrets: form.secrets.map(({ secret_id, what, how }) => ({ secret_id, what, how })),
  threads: form.threads.map(({ thread_id, title, note }) => ({ thread_id, title, note })),
});

export default function EpisodeStoryRecord({ episodeId }) {
  const base = `/api/v1/book-from-show/episodes/${episodeId}/record`;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(formOf(null));
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const take = useCallback((d) => {
    const next = { record: d?.record || null, cast: d?.cast || [], threads: d?.threads || [] };
    setData(next);
    setForm(formOf(next.record));
  }, []);

  useEffect(() => {
    let live = true;
    api.get(base).then((res) => { if (live) take(res.data); }).catch((err) => {
      console.error('[EpisodeStoryRecord] load failed:', err);
      if (live) { take(null); setNote({ error: true, text: errorOf(err, 'The story record could not be loaded.') }); }
    });
    return () => { live = false; };
  }, [base, take]);

  const dirty = useMemo(() => data && JSON.stringify(body(form)) !== JSON.stringify(body(formOf(data.record))), [data, form]);
  const run = async (key, fn, failed, done) => {
    setBusy(key); setNote(null);
    try { take((await fn()).data); if (done) setNote({ text: done }); } catch (err) {
      console.error('[EpisodeStoryRecord] request failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
    } finally { setBusy(null); }
  };
  const draft = () => {
    // A redraft replaces what is here, approved or not.
    if (data?.record && !window.confirm('Redraft the record? It replaces this one, and it goes back to draft.')) return undefined;
    return redraft();
  };
  const redraft = () => run('draft', () => api.post(`${base}/draft`, {}, { timeout: 180000 }), 'The draft did not come back.', 'Drafted. Look it over, then approve it.');
  const save = () => run('save', () => api.put(base, body(form)), 'Your changes were not saved.', 'Saved as a draft.');
  const approve = () => run('approve', () => api.post(`${base}/approve`), 'It was not approved.', 'Approved. The short story and chapter writers now read it.');

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setAt = (key, i, patch) => setForm((f) => ({ ...f, [key]: f[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const dropAt = (key, i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));

  if (!data) return <section className="esr" aria-busy="true"><p className="esr-note">Loading the story record…</p></section>;
  const { record, cast } = data;
  const people = new Map(cast.map((c) => [c.id, c.name]));
  const listed = new Set(form.secrets.map((s) => s.secret_id));
  const spare = cast.flatMap((c) => c.secrets.filter((s) => !listed.has(s.id)).map((s) => ({ ...s, character_id: c.id, name: c.name })));
  const unlisted = cast.filter((c) => !form.characters.some((x) => x.character_id === c.id));
  const locked = !!busy;

  return (
    <section className="esr" aria-labelledby="esr-title" data-testid="episode-story-record">
      <header className="esr-head">
        <ScrollText size={18} aria-hidden="true" className="esr-icon" />
        <h3 id="esr-title" className="esr-title">Story record</h3>
        {record && <span className={`esr-badge is-${record.status}`}>{record.status === 'approved' ? 'Approved' : 'Draft'}</span>}
      </header>
      <p className="esr-note">
        What the audience saw: what happened, what each person knew and learned, the secrets hinted at, and what is left open.
        Once you approve it, the short story and the chapter writers read it, and its secrets move on with the audience.
      </p>
      {note && <p className={`esr-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}

      {!record ? (
        <div className="esr-actions">
          <button type="button" className="esr-btn" disabled={locked} onClick={draft}>
            <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Reading the episode…' : 'Draft the record'}
          </button>
        </div>
      ) : (
        <>
          <label className="esr-field">
            <span className="esr-label">What happened</span>
            <textarea rows={4} value={form.what_happened} onChange={(e) => set('what_happened', e.target.value)} />
          </label>

          <fieldset className="esr-group">
            <legend className="esr-label">The people</legend>
            {form.characters.length === 0 && <p className="esr-note">No one recorded yet.</p>}
            {form.characters.map((c, i) => (
              <div key={c.character_id} className="esr-person" data-testid={`esr-person-${c.character_id}`}>
                <div className="esr-row-head">
                  <strong className="esr-name">{c.name || people.get(c.character_id)}</strong>
                  <button type="button" className="esr-x" aria-label={`Remove ${c.name}`} onClick={() => dropAt('characters', i)}><X size={14} /></button>
                </div>
                {[['knew', 'Knew'], ['learned', 'Learned'], ['changed', 'Changed']].map(([k, label]) => (
                  <label key={k} className="esr-field is-inline">
                    <span className="esr-sublabel">{label}</span>
                    <input type="text" value={c[k] || ''} onChange={(e) => setAt('characters', i, { [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            ))}
            {unlisted.length > 0 && (
              <label className="esr-field is-inline">
                <span className="esr-sublabel">Add someone</span>
                <select value="" onChange={(e) => { const c = cast.find((x) => x.id === e.target.value); if (c) set('characters', [...form.characters, { character_id: c.id, name: c.name, knew: '', learned: '', changed: '' }]); }}>
                  <option value="">Choose…</option>
                  {unlisted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </fieldset>

          <fieldset className="esr-group">
            <legend className="esr-label">Secrets in this episode</legend>
            {form.secrets.length === 0 && <p className="esr-note">No secret was hinted at or revealed.</p>}
            {form.secrets.map((s, i) => (
              <div key={s.secret_id} className="esr-secret" data-testid={`esr-secret-${s.secret_id}`}>
                <div className="esr-row-head">
                  <span className="esr-secret-text">{people.get(s.character_id) ? `${people.get(s.character_id)}: ` : ''}{s.text}</span>
                  <button type="button" className="esr-x" aria-label="Remove this secret" onClick={() => dropAt('secrets', i)}><X size={14} /></button>
                </div>
                <div className="esr-pair">
                  <label className="esr-field is-inline">
                    <span className="esr-sublabel">The audience</span>
                    <select value={s.what} onChange={(e) => setAt('secrets', i, { what: e.target.value })}>
                      <option value="hinted">Hinted at</option>
                      <option value="revealed">Revealed</option>
                    </select>
                  </label>
                  <label className="esr-field is-inline">
                    <span className="esr-sublabel">How</span>
                    <input type="text" value={s.how || ''} onChange={(e) => setAt('secrets', i, { how: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
            {spare.length > 0 && (
              <label className="esr-field is-inline">
                <span className="esr-sublabel">Add a secret</span>
                <select value="" onChange={(e) => { const s = spare.find((x) => x.id === e.target.value); if (s) set('secrets', [...form.secrets, { secret_id: s.id, character_id: s.character_id, text: s.text, what: 'hinted', how: '' }]); }}>
                  <option value="">Choose…</option>
                  {spare.map((s) => <option key={s.id} value={s.id}>{s.name}: {s.text}</option>)}
                </select>
              </label>
            )}
          </fieldset>

          <fieldset className="esr-group">
            <legend className="esr-label">Left open</legend>
            {form.threads.map((t, i) => (
              <div key={i} className="esr-pair" data-testid={`esr-thread-${i}`}>
                <label className="esr-field is-inline">
                  <span className="esr-sublabel">The question</span>
                  <input type="text" value={t.title} onChange={(e) => setAt('threads', i, { title: e.target.value })} />
                </label>
                <label className="esr-field is-inline">
                  <span className="esr-sublabel">Where it stands</span>
                  <input type="text" value={t.note || ''} onChange={(e) => setAt('threads', i, { note: e.target.value })} />
                </label>
                <button type="button" className="esr-x" aria-label="Remove this thread" onClick={() => dropAt('threads', i)}><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="esr-btn-soft" onClick={() => set('threads', [...form.threads, { thread_id: null, title: '', note: '' }])}>
              <Plus size={14} aria-hidden="true" /> Add a thread
            </button>
          </fieldset>

          <div className="esr-actions">
            {dirty ? (
              <>
                <button type="button" className="esr-btn" disabled={locked} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
                <button type="button" className="esr-btn-soft" disabled={locked} onClick={() => setForm(formOf(record))}>Undo changes</button>
              </>
            ) : record.status === 'draft' && (
              <button type="button" className="esr-btn" disabled={locked} onClick={approve}>
                <Check size={14} aria-hidden="true" /> {busy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            )}
            <button type="button" className="esr-btn-soft" disabled={locked} onClick={draft}>
              <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Reading the episode…' : 'Redraft'}
            </button>
          </div>
          {dirty && record.status === 'approved' && <p className="esr-note">Saving changes puts it back to draft until you approve it again.</p>}
        </>
      )}
    </section>
  );
}
