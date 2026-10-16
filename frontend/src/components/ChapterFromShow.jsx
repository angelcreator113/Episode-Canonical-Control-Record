/**
 * ChapterFromShow — Write Mode's "From the show" section.
 *
 * The book follows the show (Evoni, 2026-10-15; docs/CANON.md): the episode
 * is what the viewer sees, the short story is the event in full, and the
 * chapter is everything the viewer does not see, in JustAWoman's point of
 * view. Here a chapter is tied to its episode, written from it (a preview,
 * inserted only when accepted), checked against the episode's short story,
 * and the book's ledger shows what each episode still owes. The episode of
 * the consciousness transfer is set here too: the chapter writer puts the
 * Lala bleed in the first chapter after it (none until it is set).
 *
 * API: routes/bookFromShowRoutes.js (/api/v1/book-from-show).
 */
import { useCallback, useEffect, useState } from 'react';
import apiClient from '../services/api';
import { rememberedShowId } from '../utils/activeShow';

const API = '/api/v1/book-from-show';

export const getLedgerApi = (bookId, showId) =>
  apiClient.get(`${API}/books/${bookId}/ledger`, { params: showId ? { show_id: showId } : {} });
export const getChapterEpisodeApi = (chapterId) => apiClient.get(`${API}/chapters/${chapterId}/episode`);
export const setChapterEpisodeApi = (chapterId, episodeId) =>
  apiClient.put(`${API}/chapters/${chapterId}/episode`, { episode_id: episodeId });
export const writeFromEpisodeApi = (chapterId) =>
  apiClient.post(`${API}/chapters/${chapterId}/write-from-episode`, {}, { timeout: 180000 });
export const checkAgainstStoryApi = (chapterId, prose) =>
  apiClient.post(`${API}/chapters/${chapterId}/check-against-story`, { prose }, { timeout: 120000 });
export const setTransferApi = (showId, episodeId) =>
  apiClient.put(`${API}/shows/${showId}/transfer`, { episode_id: episodeId });
const listShowsApi = () => apiClient.get('/api/v1/shows');

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

function episodeLabel(ep) {
  const story = ep.short_story ? 'short story ✓' : 'no short story';
  const chapter = ep.chapter ? (ep.chapter.written ? 'chapter written' : 'chapter started') : 'no chapter';
  return `Episode ${ep.episode_number ?? '?'}: ${ep.title || 'Untitled'} · ${story} · ${chapter}`;
}

export default function ChapterFromShow({ bookId, chapterId, prose, onPreview }) {
  const [ledger, setLedger] = useState(null);
  const [shows, setShows] = useState(null);       // only when the book names no show
  const [showId, setShowId] = useState(() => rememberedShowId() || null);
  const [linked, setLinked] = useState(null);     // { episode, short_story }
  const [busy, setBusy] = useState(null);         // 'link' | 'write' | 'check' | 'transfer'
  const [error, setError] = useState(null);
  const [issues, setIssues] = useState(null);
  const [showLedger, setShowLedger] = useState(false);

  const loadLedger = useCallback(async (sid) => {
    try {
      const res = await getLedgerApi(bookId, sid);
      setLedger(res.data);
      setShows(null);
      setError(null);
    } catch (err) {
      if (err?.response?.data?.needs_show) {
        try {
          const res = await listShowsApi();
          const list = res.data?.data || res.data?.shows || [];
          if (list.length === 1) { setShowId(list[0].id); return; }
          setShows(list);
        } catch (showsErr) {
          console.error('[ChapterFromShow] shows did not load:', showsErr);
          setError('The shows did not load.');
        }
        return;
      }
      console.error('[ChapterFromShow] ledger did not load:', err);
      setError(errorOf(err, 'The book\'s episodes did not load.'));
    }
  }, [bookId]);

  const loadLinked = useCallback(async () => {
    try {
      const res = await getChapterEpisodeApi(chapterId);
      setLinked(res.data);
    } catch (err) {
      console.error('[ChapterFromShow] chapter episode did not load:', err);
      setError(errorOf(err, 'This chapter\'s episode did not load.'));
    }
  }, [chapterId]);

  useEffect(() => { if (bookId) loadLedger(showId); }, [bookId, showId, loadLedger]);
  useEffect(() => { if (chapterId) { setIssues(null); loadLinked(); } }, [chapterId, loadLinked]);

  const link = async (episodeId) => {
    setBusy('link'); setError(null); setIssues(null);
    try {
      await setChapterEpisodeApi(chapterId, episodeId || null);
      await Promise.all([loadLinked(), loadLedger(showId)]);
    } catch (err) {
      console.error('[ChapterFromShow] link failed:', err);
      setError(errorOf(err, 'The episode was not saved.'));
    }
    setBusy(null);
  };

  const setTransfer = async (episodeId) => {
    if (!ledger?.show_id) return;
    setBusy('transfer'); setError(null);
    try {
      await setTransferApi(ledger.show_id, episodeId || null);
      await loadLedger(showId);
    } catch (err) {
      console.error('[ChapterFromShow] transfer not saved:', err);
      setError(errorOf(err, 'The transfer episode was not saved.'));
    }
    setBusy(null);
  };

  const write = async () => {
    setBusy('write'); setError(null);
    try {
      const res = await writeFromEpisodeApi(chapterId);
      if (res.data?.prose) onPreview?.(res.data.prose);
      else setError('The draft came back empty. Try again.');
    } catch (err) {
      console.error('[ChapterFromShow] write from episode failed:', err);
      setError(errorOf(err, 'The chapter was not written. Try again.'));
    }
    setBusy(null);
  };

  const check = async () => {
    setBusy('check'); setError(null); setIssues(null);
    try {
      const res = await checkAgainstStoryApi(chapterId, prose || '');
      setIssues(res.data?.issues || []);
    } catch (err) {
      console.error('[ChapterFromShow] check failed:', err);
      setError(errorOf(err, 'The check did not run. Try again.'));
    }
    setBusy(null);
  };

  const episodes = ledger?.episodes || [];
  const current = linked?.episode || null;
  const owed = ledger?.owed;

  return (
    <div className="wm-ctx-field wm-from-show" data-testid="chapter-from-show">
      <label className="wm-ctx-label" htmlFor="wm-from-show-episode">From the show</label>
      <p className="wm-from-show-note">The episode is what the viewer sees, the short story is the event in full, and this chapter is everything the viewer does not see.</p>

      {shows && (
        <select className="wm-reference-select" value="" onChange={(e) => e.target.value && setShowId(e.target.value)} aria-label="Which show">
          <option value="">Which show is this book written from?</option>
          {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {ledger && (
        <select
          id="wm-from-show-episode"
          className="wm-reference-select"
          value={current?.id || ''}
          disabled={busy === 'link'}
          onChange={(e) => link(e.target.value)}
        >
          <option value="">Not tied to an episode</option>
          {episodes.map((ep) => <option key={ep.id} value={ep.id}>{episodeLabel(ep)}</option>)}
        </select>
      )}

      {current && (
        <div className="wm-from-show-actions">
          <button type="button" className="wm-ctx-btn" disabled={!!busy} onClick={write}>
            {busy === 'write' ? 'Writing…' : 'Write this chapter from the episode'}
          </button>
          <button type="button" className="wm-ctx-btn" disabled={!!busy || !linked?.short_story || !prose?.trim()} onClick={check}
            title={!linked?.short_story ? 'This episode has no short story yet' : undefined}>
            {busy === 'check' ? 'Checking…' : 'Check against the short story'}
          </button>
          {!linked?.short_story && <p className="wm-from-show-note">This episode has no short story yet, so the chapter is written from the episode alone.</p>}
        </div>
      )}

      {issues && (
        issues.length === 0
          ? <p className="wm-from-show-ok" role="status">No contradictions with the short story.</p>
          : (
            <ul className="wm-from-show-issues" aria-label="Where the chapter contradicts the short story">
              {issues.map((i, n) => (
                <li key={n}><strong>Chapter:</strong> {i.chapter_says}<br /><strong>Short story:</strong> {i.story_says}{i.why && <><br /><em>{i.why}</em></>}</li>
              ))}
            </ul>
          )
      )}

      {error && <p className="wm-from-show-error" role="alert">{error}</p>}

      {ledger && (
        <div className="wm-from-show-transfer">
          <label className="wm-ctx-label" htmlFor="wm-from-show-transfer">The consciousness transfer happens in</label>
          <select id="wm-from-show-transfer" className="wm-reference-select" value={ledger.transfer?.episode_id || ''}
            disabled={busy === 'transfer'} onChange={(e) => setTransfer(e.target.value)}>
            <option value="">Not decided yet</option>
            {episodes.map((ep) => <option key={ep.id} value={ep.id}>Episode {ep.episode_number ?? '?'}: {ep.title || 'Untitled'}</option>)}
          </select>
          <p className="wm-from-show-note">{ledger.transfer
            ? 'The Lala bleed comes in the first chapter after it: one intrusive thought, once.'
            : 'Until it is set, no chapter carries the Lala bleed.'}</p>
        </div>
      )}

      {owed && (
        <div className="wm-from-show-ledger">
          <button type="button" className="wm-from-show-toggle" aria-expanded={showLedger} onClick={() => setShowLedger((v) => !v)}>
            The book owes: {owed.short_stories} short {owed.short_stories === 1 ? 'story' : 'stories'}, {owed.beat11} beat 11 {owed.beat11 === 1 ? 'piece' : 'pieces'}, {owed.chapters} {owed.chapters === 1 ? 'chapter' : 'chapters'}
          </button>
          {showLedger && (
            <ul className="wm-from-show-list">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <span>Ep {ep.episode_number ?? '?'}: {ep.title || 'Untitled'}</span>
                  <span>{ep.short_story ? 'Story ✓' : 'Story –'}</span>
                  <span>{ep.short_story?.has_beat11 ? 'Beat 11 ✓' : 'Beat 11 –'}</span>
                  <span>{ep.chapter?.written ? 'Chapter ✓' : 'Chapter –'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
