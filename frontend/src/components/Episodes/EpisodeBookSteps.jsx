/**
 * EpisodeBookSteps — the book follows the show, for one episode, on its
 * Results › Story tab (Evoni, 2026-10-19: "This week's episode should be a
 * tab under results... Story"). It was the /this-week page; that route now
 * only opens the episode that still owes something here (pages/ThisWeekPage).
 *
 * The book follows the show (Evoni, 2026-10-15; docs/CANON.md). Each episode
 * is told three ways after the episode itself:
 *   1. the short story   the event in full (written here, read on Stories)
 *   2. the beat 11 piece the short story's animated moment at beat 11
 *   3. the chapter       everything the viewer does not see, in JustAWoman's
 *                        point of view (started here, written in Write Mode)
 * Below, "Plan the next chapters" plans the book from the episodes that still
 * owe a chapter (it replaces the Story Engine's fixed 50-chapter plan): a
 * preview to edit, then added to the book. It plans across episodes, so it
 * is the same on every episode's Story tab.
 *
 * APIs: /api/v1/book-from-show (ledger, chapter's episode), the show's
 * generate-story, and the storyteller books and chapters.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Beat11Piece from '../Beat11Piece';
import './EpisodeBookSteps.css';

const BOOK_KEY = 'this-week-book';

export const listBooksApi = (showId) => api.get('/api/v1/storyteller/books', { params: showId ? { show_id: showId } : {} });
export const getLedgerApi = (bookId, showId) => api.get(`/api/v1/book-from-show/books/${bookId}/ledger`, { params: { show_id: showId } });
export const writeShortStoryApi = (showId, episodeId) =>
  api.post(`/api/v1/world/${showId}/episodes/${episodeId}/generate-story`, { format: 'short_story' }, { timeout: 180000 });
export const createChapterApi = (bookId, title) => api.post(`/api/v1/storyteller/books/${bookId}/chapters`, { title });
export const linkChapterApi = (chapterId, episodeId) =>
  api.put(`/api/v1/book-from-show/chapters/${chapterId}/episode`, { episode_id: episodeId });
export const planChaptersApi = (bookId, showId, count) =>
  api.post(`/api/v1/book-from-show/books/${bookId}/plan`, { show_id: showId, count }, { timeout: 180000 });
export const applyPlanApi = (bookId, showId, items) =>
  api.post(`/api/v1/book-from-show/books/${bookId}/plan/apply`, { show_id: showId, items });

const readStored = () => { try { return window.localStorage.getItem(BOOK_KEY); } catch (err) { console.error('[EpisodeBookSteps] stored book unreadable:', err); return null; } };
const store = (id) => { try { window.localStorage.setItem(BOOK_KEY, id); } catch (err) { console.error('[EpisodeBookSteps] book not remembered:', err); } };
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

/** The first episode that still owes something, else the last one. */
export function episodeToOpen(episodes) {
  const owes = (ep) => !ep.short_story || !ep.short_story.has_beat11 || !ep.chapter?.written;
  return (episodes || []).find(owes) || (episodes || [])[episodes.length - 1] || null;
}

/**
 * The show's books and the chosen book's ledger. The Book 1 book may name no
 * show, so all books when the show has none. Shared by the Story tab and the
 * /this-week redirect.
 */
export function useBookLedger(showId) {
  const [books, setBooks] = useState(null);
  const [bookId, setBookIdState] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!showId) return;
    let live = true;
    (async () => {
      try {
        let list = (await listBooksApi(showId)).data?.books || [];
        if (list.length === 0) list = (await listBooksApi(null)).data?.books || [];
        if (!live) return;
        setBooks(list);
        const stored = readStored();
        setBookIdState((list.find((b) => b.id === stored) || list[0])?.id || null);
      } catch (err) {
        console.error('[EpisodeBookSteps] books did not load:', err);
        if (live) { setBooks([]); setError('The books did not load.'); }
      }
    })();
    return () => { live = false; };
  }, [showId]);

  const loadLedger = useCallback(async () => {
    if (!bookId || !showId) return;
    try {
      const res = await getLedgerApi(bookId, showId);
      setLedger(res.data);
      setError(null);
    } catch (err) {
      console.error('[EpisodeBookSteps] ledger did not load:', err);
      setError(errorOf(err, 'The episodes did not load.'));
    }
  }, [bookId, showId]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const setBookId = (id) => { setBookIdState(id); store(id); };
  return { books, bookId, setBookId, ledger, loadLedger, error, setError };
}

/** Plan the next chapters from the episodes (book-from-show plan, then apply). */
export function PlanChapters({ bookId, showId, onApplied }) {
  const [count, setCount] = useState(4);
  const [plan, setPlan] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(null);   // 'plan' | 'apply'
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const makePlan = async () => {
    setBusy('plan'); setError(null); setMessage(null);
    try {
      const res = await planChaptersApi(bookId, showId, count);
      const items = res.data?.plan || [];
      setPlan(items);
      setPicked(new Set(items.map((p) => p.episode_id)));
      if (items.length === 0) setMessage(res.data?.message || 'Nothing to plan.');
    } catch (err) {
      console.error('[EpisodeBookSteps] plan failed:', err);
      setError(errorOf(err, 'The plan was not made. Try again.'));
    }
    setBusy(null);
  };

  const edit = (id, field, value) => setPlan((cur) => cur.map((p) => (p.episode_id === id ? { ...p, [field]: value } : p)));
  const toggle = (id) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const apply = async () => {
    setBusy('apply'); setError(null);
    try {
      const items = plan.filter((p) => picked.has(p.episode_id));
      const res = await applyPlanApi(bookId, showId, items);
      setMessage(`${res.data.created} chapter${res.data.created === 1 ? '' : 's'} added${res.data.filled ? `, ${res.data.filled} filled in` : ''}.`);
      setPlan(null);
      onApplied?.();
    } catch (err) {
      console.error('[EpisodeBookSteps] plan not added:', err);
      setError(errorOf(err, 'The plan was not added. Try again.'));
    }
    setBusy(null);
  };

  return (
    <section className="tw-plan" aria-labelledby="tw-plan-h">
      <h2 id="tw-plan-h" className="tw-plan-h">Plan the next chapters</h2>
      <p className="tw-note">From the episodes that still owe a chapter: what the viewer does not see, in JustAWoman's point of view. Edit it, then add it to the book. An existing chapter only gets its empty plan fields filled.</p>
      <div className="tw-actions">
        <label className="tw-inline">
          <span>Episodes</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="tw-btn is-primary" disabled={!!busy || !bookId} onClick={makePlan}>{busy === 'plan' ? 'Planning…' : 'Plan'}</button>
      </div>
      {error && <p className="tw-error" role="alert">{error}</p>}
      {message && <p className="tw-note" role="status">{message}</p>}
      {plan && plan.length > 0 && (
        <>
          <ol className="tw-plan-list">
            {plan.map((p) => (
              <li key={p.episode_id} className="tw-plan-item">
                <label className="tw-plan-pick">
                  <input type="checkbox" checked={picked.has(p.episode_id)} onChange={() => toggle(p.episode_id)} />
                  <span>Episode {p.episode_number ?? '?'}: {p.episode_title || 'Untitled'}{p.chapter_id ? ' (has a chapter: fills its empty plan only)' : ''}{p.bleed ? ' · the Lala bleed' : ''}</span>
                </label>
                <input className="tw-plan-title" aria-label={`Chapter title for episode ${p.episode_number ?? ''}`} value={p.title} onChange={(e) => edit(p.episode_id, 'title', e.target.value)} />
                <textarea className="tw-plan-text" aria-label={`Goal for episode ${p.episode_number ?? ''}`} rows={2} value={p.scene_goal} onChange={(e) => edit(p.episode_id, 'scene_goal', e.target.value)} />
                <textarea className="tw-plan-text" aria-label={`Notes for episode ${p.episode_number ?? ''}`} rows={4} value={p.chapter_notes} onChange={(e) => edit(p.episode_id, 'chapter_notes', e.target.value)} />
                {(p.emotional_state_start || p.emotional_state_end) && (
                  <p className="tw-note">She starts: {p.emotional_state_start || '—'} · She ends: {p.emotional_state_end || '—'}</p>
                )}
              </li>
            ))}
          </ol>
          <div className="tw-actions">
            <button type="button" className="tw-btn is-primary" disabled={!!busy || picked.size === 0} onClick={apply}>{busy === 'apply' ? 'Adding…' : `Add ${picked.size} to the book`}</button>
          </div>
        </>
      )}
    </section>
  );
}

function Step({ n, title, done, children }) {
  return (
    <li className={`tw-step${done ? ' is-done' : ''}`}>
      <div className="tw-step-head">
        <span className="tw-step-n" aria-hidden="true">{done ? '✓' : n}</span>
        <h3 className="tw-step-title">{title}</h3>
        <span className="tw-step-state">{done ? 'Done' : 'To do'}</span>
      </div>
      <div className="tw-step-body">{children}</div>
    </li>
  );
}

/**
 * The episode's place in the book. refreshKey reloads the ledger (the Story
 * tab bumps it when a format card writes the short story); onStoryWritten
 * tells the tab when this block wrote it.
 */
export default function EpisodeBookSteps({ episode, refreshKey = 0, onStoryWritten }) {
  const navigate = useNavigate();
  const showId = episode?.show_id || episode?.showId || null;
  const { books, bookId, setBookId, ledger, loadLedger, error, setError } = useBookLedger(showId);
  const [busy, setBusy] = useState(null);     // 'story' | 'chapter'

  useEffect(() => { if (refreshKey) loadLedger(); }, [refreshKey, loadLedger]);

  const ep = useMemo(() => (ledger?.episodes || []).find((e) => e.id === episode?.id) || null, [ledger, episode?.id]);

  const writeStory = async () => {
    setBusy('story'); setError(null);
    try {
      await writeShortStoryApi(showId, ep.id);
      await loadLedger();
      onStoryWritten?.();
    } catch (err) {
      console.error('[EpisodeBookSteps] short story not written:', err);
      setError(errorOf(err, 'The short story was not written. Try again.'));
    }
    setBusy(null);
  };

  const startChapter = async () => {
    setBusy('chapter'); setError(null);
    try {
      const title = `Episode ${ep.episode_number ?? ''}: ${ep.title || 'Untitled'}`.replace(/\s+:/, ':');
      const created = (await createChapterApi(bookId, title)).data?.chapter;
      if (!created?.id) throw new Error('No chapter came back');
      await linkChapterApi(created.id, ep.id);
      navigate(`/chapter/${bookId}/${created.id}`);
    } catch (err) {
      console.error('[EpisodeBookSteps] chapter not started:', err);
      setError(errorOf(err, 'The chapter was not started. Try again.'));
      setBusy(null);
    }
  };

  if (!showId) return null;

  return (
    <section className="tw-book" aria-labelledby="tw-book-h" data-testid="episode-book-steps">
      <h2 id="tw-book-h" className="tw-book-h">The book follows the show</h2>
      <p className="tw-note">
        The episode is what the viewer sees, the short story is the event in full,
        and the chapter is everything the viewer does not see, in JustAWoman's point of view.
      </p>

      {books && books.length > 1 && (
        <div className="tw-pickers">
          <label className="tw-field">
            <span>Book</span>
            <select value={bookId || ''} onChange={(e) => setBookId(e.target.value)}>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title || 'Untitled book'}</option>)}
            </select>
          </label>
        </div>
      )}

      {error && <p className="tw-error" role="alert">{error}</p>}
      {books === null && !error && <p className="tw-note">Loading…</p>}
      {books && books.length === 0 && !error && <p className="tw-note">No book yet. Make one in the Universe, then come back.</p>}
      {ledger && !ep && <p className="tw-note">This episode is not in the book's list of episodes yet.</p>}

      {ep && (
        <ol className="tw-steps" aria-label={`Episode ${ep.episode_number ?? ''} in the book`}>
          <Step n={1} title="The short story" done={!!ep.short_story}>
            <p className="tw-note">The event in full.{ep.short_story ? ` ${ep.short_story.word_count || 0} words, ${ep.short_story.status}.` : ''}</p>
            <div className="tw-actions">
              {ep.short_story
                ? <Link className="tw-btn" to="/stories">Read it on Stories</Link>
                : <button type="button" className="tw-btn is-primary" disabled={!!busy} onClick={writeStory}>{busy === 'story' ? 'Writing…' : 'Write the short story'}</button>}
            </div>
          </Step>

          <Step n={2} title="The beat 11 piece" done={!!ep.short_story?.has_beat11}>
            <p className="tw-note">The animated moment at beat 11 that makes viewers ask what happened at the event. It shows on the Scene Planner's beat 11.</p>
            {ep.short_story
              ? <Beat11Piece storyId={ep.short_story.id} key={ep.short_story.id} />
              : <p className="tw-note">Write the short story first.</p>}
            <div className="tw-actions">
              <Link className="tw-btn" to={`/episodes/${ep.id}/plan`}>Scene Planner</Link>
            </div>
          </Step>

          <Step n={3} title="The chapter" done={!!ep.chapter?.written}>
            <p className="tw-note">Everything the viewer does not see, in JustAWoman's point of view.{ep.chapter ? ` "${ep.chapter.title || 'Untitled'}"${ep.chapter.written ? '' : ', not written yet'}.` : ''}</p>
            <div className="tw-actions">
              {ep.chapter
                ? <Link className="tw-btn is-primary" to={`/chapter/${bookId}/${ep.chapter.id}`}>Open in Write Mode</Link>
                : <button type="button" className="tw-btn is-primary" disabled={!!busy || !bookId} onClick={startChapter}>{busy === 'chapter' ? 'Starting…' : 'Start the chapter'}</button>}
            </div>
            {ep.chapter && !ep.chapter.written && <p className="tw-note">In Write Mode, "From the show" › "Write this chapter from the episode" drafts it.</p>}
          </Step>
        </ol>
      )}

      {ledger && bookId && <PlanChapters bookId={bookId} showId={showId} onApplied={loadLedger} />}

      {ledger?.owed && (
        <p className="tw-owed">
          The book owes {ledger.owed.short_stories} short {ledger.owed.short_stories === 1 ? 'story' : 'stories'}, {ledger.owed.beat11} beat 11 {ledger.owed.beat11 === 1 ? 'piece' : 'pieces'} and {ledger.owed.chapters} {ledger.owed.chapters === 1 ? 'chapter' : 'chapters'}.
          {ledger.transfer ? ` The consciousness transfer is in Episode ${ledger.transfer.episode_number}.` : ' The consciousness transfer is not placed yet.'}
        </p>
      )}
    </section>
  );
}
