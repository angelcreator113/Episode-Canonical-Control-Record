/**
 * ThisWeekPage — "This week's episode" (route /this-week; Sidebar › Stories).
 *
 * The book follows the show (Evoni, 2026-10-15; docs/CANON.md). Each episode
 * is told three ways, and this page walks one episode through them in order:
 *   1. the episode       what the viewer sees (its page, its Scene Planner)
 *   2. the short story   the event in full (written here, read on Stories)
 *   3. the beat 11 piece the short story's animated moment at beat 11
 *   4. the chapter       everything the viewer does not see, in JustAWoman's
 *                        point of view (started here, written in Write Mode)
 * It opens on the first episode that still owes something.
 *
 * APIs: /api/v1/book-from-show (ledger, chapter's episode), the show's
 * generate-story, and the storyteller books and chapters.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';
import Beat11Piece from '../components/Beat11Piece';
import './ThisWeekPage.css';

const BOOK_KEY = 'this-week-book';

export const listBooksApi = (showId) => api.get('/api/v1/storyteller/books', { params: showId ? { show_id: showId } : {} });
export const getLedgerApi = (bookId, showId) => api.get(`/api/v1/book-from-show/books/${bookId}/ledger`, { params: { show_id: showId } });
export const writeShortStoryApi = (showId, episodeId) =>
  api.post(`/api/v1/world/${showId}/episodes/${episodeId}/generate-story`, { format: 'short_story' }, { timeout: 180000 });
export const createChapterApi = (bookId, title) => api.post(`/api/v1/storyteller/books/${bookId}/chapters`, { title });
export const linkChapterApi = (chapterId, episodeId) =>
  api.put(`/api/v1/book-from-show/chapters/${chapterId}/episode`, { episode_id: episodeId });

const readStored = () => { try { return window.localStorage.getItem(BOOK_KEY); } catch (err) { console.error('[ThisWeek] stored book unreadable:', err); return null; } };
const store = (id) => { try { window.localStorage.setItem(BOOK_KEY, id); } catch (err) { console.error('[ThisWeek] book not remembered:', err); } };
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

/** The first episode that still owes something, else the last one. */
export function episodeToOpen(episodes) {
  const owes = (ep) => !ep.short_story || !ep.short_story.has_beat11 || !ep.chapter?.written;
  return (episodes || []).find(owes) || (episodes || [])[episodes.length - 1] || null;
}

function Step({ n, title, done, children }) {
  return (
    <li className={`tw-step${done ? ' is-done' : ''}`}>
      <div className="tw-step-head">
        <span className="tw-step-n" aria-hidden="true">{done ? '✓' : n}</span>
        <h2 className="tw-step-title">{title}</h2>
        <span className="tw-step-state">{done ? 'Done' : 'To do'}</span>
      </div>
      <div className="tw-step-body">{children}</div>
    </li>
  );
}

export default function ThisWeekPage() {
  const navigate = useNavigate();
  const { shows, show, showId, loaded: showsLoaded, needsChoice, choose } = useActiveShow();
  const [books, setBooks] = useState(null);
  const [bookId, setBookId] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [episodeId, setEpisodeId] = useState(null);
  const [busy, setBusy] = useState(null);     // 'story' | 'chapter'
  const [error, setError] = useState(null);

  // The show's books; the Book 1 book may name no show, so all books when the show has none.
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
        setBookId((list.find((b) => b.id === stored) || list[0])?.id || null);
      } catch (err) {
        console.error('[ThisWeek] books did not load:', err);
        if (live) setError('The books did not load.');
      }
    })();
    return () => { live = false; };
  }, [showId]);

  const loadLedger = useCallback(async (keepEpisode) => {
    if (!bookId || !showId) return;
    try {
      const res = await getLedgerApi(bookId, showId);
      setLedger(res.data);
      setEpisodeId((cur) => (keepEpisode && cur) || episodeToOpen(res.data?.episodes)?.id || null);
      setError(null);
    } catch (err) {
      console.error('[ThisWeek] ledger did not load:', err);
      setError(errorOf(err, 'The episodes did not load.'));
    }
  }, [bookId, showId]);

  useEffect(() => { loadLedger(false); }, [loadLedger]);

  const episodes = ledger?.episodes || [];
  const ep = useMemo(() => episodes.find((e) => e.id === episodeId) || null, [episodes, episodeId]);

  const writeStory = async () => {
    setBusy('story'); setError(null);
    try {
      await writeShortStoryApi(showId, ep.id);
      await loadLedger(true);
    } catch (err) {
      console.error('[ThisWeek] short story not written:', err);
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
      console.error('[ThisWeek] chapter not started:', err);
      setError(errorOf(err, 'The chapter was not started. Try again.'));
      setBusy(null);
    }
  };

  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open this week's episode" />;
  if (!showsLoaded || (showId && books === null && !error)) return <div className="tw-page"><p className="tw-note">Loading…</p></div>;

  return (
    <div className="tw-page">
      <header className="tw-head">
        <h1 className="tw-h1">This week's episode</h1>
        <p className="tw-note">
          {show ? `${show.name || show.title} · ` : ''}The episode is what the viewer sees, the short story is the event in full,
          and the chapter is everything the viewer does not see, in JustAWoman's point of view.
        </p>
      </header>

      <div className="tw-pickers">
        {books && books.length > 1 && (
          <label className="tw-field">
            <span>Book</span>
            <select value={bookId || ''} onChange={(e) => { setBookId(e.target.value); store(e.target.value); }}>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title || 'Untitled book'}</option>)}
            </select>
          </label>
        )}
        {episodes.length > 0 && (
          <label className="tw-field">
            <span>Episode</span>
            <select value={episodeId || ''} onChange={(e) => setEpisodeId(e.target.value)}>
              {episodes.map((e) => <option key={e.id} value={e.id}>Episode {e.episode_number ?? '?'}: {e.title || 'Untitled'}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && <p className="tw-error" role="alert">{error}</p>}
      {books && books.length === 0 && <p className="tw-note">No book yet. Make one in the Universe, then come back.</p>}
      {ledger && episodes.length === 0 && <p className="tw-note">This show has no episodes yet.</p>}

      {ep && (
        <ol className="tw-steps" aria-label={`Episode ${ep.episode_number ?? ''} steps`}>
          <Step n={1} title={`The episode: ${ep.title || 'Untitled'}`} done={ep.status === 'published' || ep.status === 'complete' || ep.status === 'completed'}>
            <p className="tw-note">What the viewer sees.{ep.status ? ` Status: ${ep.status}.` : ''}</p>
            <div className="tw-actions">
              <Link className="tw-btn" to={`/episodes/${ep.id}`}>Open the episode</Link>
              <Link className="tw-btn" to={`/episodes/${ep.id}/plan`}>Scene Planner</Link>
            </div>
          </Step>

          <Step n={2} title="The short story" done={!!ep.short_story}>
            <p className="tw-note">The event in full.{ep.short_story ? ` ${ep.short_story.word_count || 0} words, ${ep.short_story.status}.` : ''}</p>
            <div className="tw-actions">
              {ep.short_story
                ? <Link className="tw-btn" to="/stories">Read it on Stories</Link>
                : <button type="button" className="tw-btn is-primary" disabled={!!busy} onClick={writeStory}>{busy === 'story' ? 'Writing…' : 'Write the short story'}</button>}
            </div>
          </Step>

          <Step n={3} title="The beat 11 piece" done={!!ep.short_story?.has_beat11}>
            <p className="tw-note">The animated moment at beat 11 that makes viewers ask what happened at the event. It shows on the Scene Planner's beat 11.</p>
            {ep.short_story
              ? <Beat11Piece storyId={ep.short_story.id} key={ep.short_story.id} />
              : <p className="tw-note">Write the short story first.</p>}
          </Step>

          <Step n={4} title="The chapter" done={!!ep.chapter?.written}>
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

      {ledger?.owed && (
        <p className="tw-owed">
          The book owes {ledger.owed.short_stories} short {ledger.owed.short_stories === 1 ? 'story' : 'stories'}, {ledger.owed.beat11} beat 11 {ledger.owed.beat11 === 1 ? 'piece' : 'pieces'} and {ledger.owed.chapters} {ledger.owed.chapters === 1 ? 'chapter' : 'chapters'}.
          {ledger.transfer ? ` The consciousness transfer is in Episode ${ledger.transfer.episode_number}.` : ' The consciousness transfer is not placed yet.'}
        </p>
      )}
    </div>
  );
}
