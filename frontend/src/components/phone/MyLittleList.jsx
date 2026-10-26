/**
 * My Little List ♡ — Lala's own list on her phone (Evoni, 2026-10-26, Phase
 * 2 of the redesign of the Shopping List / To-Do overlay). A personal notes
 * app, not a production checklist: what she knows at this beat and line, in
 * her words (GET /episodes/:id/my-little-list; lib/myLittleList). It never
 * reads the production lists (/todo, /todo/social, /todo/at), so no label,
 * brand, deliverable or source reaches the phone.
 *
 * Warm cream, blush and lavender; rounded rows; a gentle tick; a small
 * progress line. Sized from its container (cqw), so it fills a phone
 * content area or the producer's panel alike.
 *
 * interactive: ticks, notes, her reminders (add, edit, remove) and Close
 * / Minimise work. Without it (a screen shown in the Phone Hub or a
 * preview) the list is read only, and the rows still show their hover and
 * press states. A tick the game owns (her outfit, the deal) is refused by
 * the server and said so ("That one ticks itself as she plays").
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Minus, X, Plus, Pencil, Trash2 } from 'lucide-react';
import { APP_NAME, fetchList, tickItem, editItem, addReminder, removeItem, progressPercent, refusalText } from '../../lib/myLittleList';
import './MyLittleList.css';

export default function MyLittleList({ episodeId, beat = null, line = null, interactive = false, onClose = null, reloadKey = 0 }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [openNotes, setOpenNotes] = useState(() => new Set());
  const [justTicked, setJustTicked] = useState(null);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      const next = await fetchList(episodeId, beat, line);
      if (live.current) { setList(next); setFailed(false); }
    } catch (err) {
      console.error('[MyLittleList] load failed:', err);
      if (live.current) setFailed(true);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [episodeId, beat, line]);

  useEffect(() => { setLoading(true); load(); }, [load, reloadKey]);

  const say = (text) => { setMessage(text); };

  const toggle = async (item) => {
    if (!interactive || busy) return;
    if (!item.can_check) { say('That one ticks itself as she plays.'); return; }
    const done = !item.done;
    // Optimistic: tick now, put it back if the server says no.
    setList((l) => ({
      ...l,
      items: l.items.map((i) => (i.key === item.key ? { ...i, done } : i)),
      progress: { ...l.progress, done: l.progress.done + (done ? 1 : -1) },
    }));
    if (done) setJustTicked(item.key);
    setMessage('');
    try {
      await tickItem(episodeId, item.key, done, beat, line);
    } catch (err) {
      console.error('[MyLittleList] tick failed:', err);
      say(refusalText(err));
      await load();
    }
  };

  const run = async (fn, then = null) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      if (then) then();
      await load();
    } catch (err) {
      console.error('[MyLittleList] change failed:', err);
      say(refusalText(err));
    } finally {
      if (live.current) setBusy(false);
    }
  };

  const submitNew = (e) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    run(() => addReminder(episodeId, title), () => { setDraft(''); setAdding(false); });
  };

  const submitEdit = (e, item) => {
    e.preventDefault();
    const title = editing?.text?.trim();
    if (!title || title === item.title) { setEditing(null); return; }
    run(() => editItem(episodeId, item.key, title, beat, line), () => setEditing(null));
  };

  const toggleNote = (key) => setOpenNotes((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!episodeId) {
    return <div className="mll mll-empty-card" data-testid="my-little-list"><span className="mll-title">{APP_NAME}</span><span className="mll-muted">Shown in an episode</span></div>;
  }

  const progress = list?.progress || { done: 0, total: 0 };
  const pct = progressPercent(progress);

  if (minimised) {
    return (
      <div className="mll-wrap">
        <button type="button" className="mll mll-pill" data-testid="mll-minimised" onClick={() => setMinimised(false)} aria-label={`Open ${APP_NAME}`}>
          <span className="mll-title">{APP_NAME}</span>
          <span className="mll-count">{progress.done}/{progress.total}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mll-wrap">
      <section className="mll" data-testid="my-little-list" aria-label={APP_NAME}>
        <header className="mll-head">
          <h3 className="mll-title">{APP_NAME}</h3>
          <div className="mll-head-actions">
            <button type="button" className="mll-icon-btn" onClick={() => setMinimised(true)} aria-label="Minimise" data-testid="mll-minimise"><Minus aria-hidden="true" /></button>
            {onClose && <button type="button" className="mll-icon-btn" onClick={onClose} aria-label="Close" data-testid="mll-close"><X aria-hidden="true" /></button>}
          </div>
        </header>

        {!loading && !failed && progress.total > 0 && (
          <div className="mll-progress" data-testid="mll-progress" aria-label={`${progress.done} of ${progress.total} done`}>
            <div className="mll-progress-bar"><span style={{ width: `${pct}%` }} /></div>
            <span className="mll-count">{progress.done} of {progress.total}</span>
          </div>
        )}

        <div className="mll-scroll">
          {loading && <p className="mll-muted" data-testid="mll-loading">Opening her list…</p>}
          {!loading && failed && <p className="mll-muted" role="alert" data-testid="mll-error">Her list didn&apos;t open. Try again in a moment.</p>}
          {!loading && !failed && list?.items.length === 0 && <p className="mll-muted" data-testid="mll-empty">Nothing on her list yet.</p>}
          {!loading && !failed && list?.items.length > 0 && (
            <ul className="mll-rows">
              {list.items.map((item) => {
                const noteOpen = openNotes.has(item.key);
                const isEditing = editing?.key === item.key;
                return (
                  <li key={item.key} className={`mll-row${item.done ? ' is-done' : ''}${justTicked === item.key ? ' just-ticked' : ''}`} data-testid="mll-row" data-done={item.done ? 'true' : 'false'}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={item.title}
                      className={`mll-box${item.can_check ? '' : ' is-auto'}`}
                      onClick={() => toggle(item)}
                      disabled={!interactive}
                      data-testid="mll-box"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
                    </button>
                    <div className="mll-body">
                      {isEditing ? (
                        <form onSubmit={(e) => submitEdit(e, item)} className="mll-edit">
                          <input
                            autoFocus
                            value={editing.text}
                            maxLength={80}
                            onChange={(e) => setEditing({ key: item.key, text: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                            aria-label="Edit item"
                            data-testid="mll-edit-input"
                          />
                        </form>
                      ) : (
                        <span className="mll-text">{item.title}</span>
                      )}
                      {item.note && noteOpen && <p className="mll-note" data-testid="mll-note">{item.note}</p>}
                    </div>
                    <div className="mll-row-actions">
                      {item.note && (
                        <button type="button" className={`mll-icon-btn${noteOpen ? ' is-open' : ''}`} onClick={() => toggleNote(item.key)} aria-expanded={noteOpen} aria-label={noteOpen ? 'Hide note' : 'Show note'} data-testid="mll-note-toggle"><ChevronDown aria-hidden="true" /></button>
                      )}
                      {interactive && item.can_edit && !isEditing && (
                        <button type="button" className="mll-icon-btn" onClick={() => setEditing({ key: item.key, text: item.title })} aria-label={`Edit ${item.title}`} data-testid="mll-edit"><Pencil aria-hidden="true" /></button>
                      )}
                      {interactive && item.can_remove && (
                        <button type="button" className="mll-icon-btn" onClick={() => run(() => removeItem(episodeId, item.key, beat, line))} aria-label={`Remove ${item.title}`} data-testid="mll-remove"><Trash2 aria-hidden="true" /></button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {message && <p className="mll-message" role="status" data-testid="mll-message">{message}</p>}

        {interactive && !loading && !failed && (
          adding ? (
            <form className="mll-add-form" onSubmit={submitNew}>
              <input
                autoFocus
                value={draft}
                maxLength={80}
                placeholder="Remind me to…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                aria-label="New reminder"
                data-testid="mll-add-input"
              />
              <button type="submit" className="mll-add-save" disabled={busy || !draft.trim()} data-testid="mll-add-save">Add</button>
            </form>
          ) : (
            <button type="button" className="mll-add" onClick={() => setAdding(true)} data-testid="mll-add"><Plus aria-hidden="true" /> Add a reminder</button>
          )
        )}
      </section>
    </div>
  );
}
