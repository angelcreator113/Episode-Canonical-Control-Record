/**
 * ThisWeekPage — route /this-week, kept so old links work. The book's steps
 * for an episode (short story, beat 11 piece, chapter, "Plan the next
 * chapters") live on each episode's Results › Story tab now
 * (components/Episodes/EpisodeBookSteps; Evoni, 2026-10-19: "This week's
 * episode should be a tab under results... Story"). This page opens the
 * active show's episode that still owes something (episodeToOpen) there.
 */
import { Navigate } from 'react-router-dom';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';
import { useBookLedger, episodeToOpen } from '../components/Episodes/EpisodeBookSteps';
import '../components/Episodes/EpisodeBookSteps.css';

export { episodeToOpen, PlanChapters } from '../components/Episodes/EpisodeBookSteps';

/** Where /this-week lands: the episode's Results › Story (utils/episodeTabs). */
export const storyTabPath = (episodeId) => `/episodes/${episodeId}?tab=story`;

export default function ThisWeekPage() {
  const { shows, showId, loaded: showsLoaded, needsChoice, choose } = useActiveShow();
  const { books, ledger, error } = useBookLedger(showId);

  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open this week's episode" />;
  const ep = episodeToOpen(ledger?.episodes || []);
  if (ep) return <Navigate to={storyTabPath(ep.id)} replace />;

  const loading = !showsLoaded || (showId && !error && (books === null || (books.length > 0 && !ledger)));
  return (
    <div className="tw-page">
      <header className="tw-head">
        <h1 className="tw-h1">This week's episode</h1>
      </header>
      {loading && <p className="tw-note">Loading…</p>}
      {error && <p className="tw-error" role="alert">{error}</p>}
      {!loading && !error && books && books.length === 0 && <p className="tw-note">No book yet. Make one in the Universe, then come back.</p>}
      {!loading && !error && ledger && <p className="tw-note">This show has no episodes yet.</p>}
    </div>
  );
}
