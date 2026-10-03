/**
 * The legacy creation doors (audit IA-03, 2026-10-03; docs/EVENT_EPISODE_FLOW.md
 * §6 ruling 2: "No blank SAL episodes… Existing blank-creation routes are
 * redirected later, not deleted now"). /episodes/create (CreateEpisode, the
 * generic form) and /shows/:showId/quick-episode (QuickEpisodeCreator's
 * create mode) made an episode with no host, event package or brief, so
 * it could reach production looking ready. Both now open the New Episode
 * starter, host → Event Package → episode, for the show they name
 * (:showId or ?show_id=), else the active show; with several shows and
 * none active they ask which; with none they go to the shows list.
 * QuickEpisodeCreator stays as the episode's edit page.
 */
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';

export const newEpisodePath = (showId) => `/shows/${encodeURIComponent(showId)}/new-episode`;

export default function NewEpisodeRedirect() {
  const { showId: routeShowId } = useParams();
  const [params] = useSearchParams();
  const named = routeShowId || params.get('show_id');
  // A named show needs no shows read.
  if (named) return <Navigate to={newEpisodePath(named)} replace />;
  return <ActiveShowNewEpisode />;
}

function ActiveShowNewEpisode() {
  const { shows, showId, loaded, failed, needsChoice, choose } = useActiveShow();
  if (!loaded) return <div className="up-loading">Opening New Episode…</div>;
  if (showId) return <Navigate to={newEpisodePath(showId)} replace />;
  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to start its episode" />;
  if (failed) {
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '24px auto', padding: '12px 16px', borderRadius: 8, background: '#FBEFF3', border: '1px solid #C06E87', fontSize: 13 }}>
        The shows could not be loaded, so there is no show to start an episode in. <a href="/shows">Shows</a>
      </div>
    );
  }
  return <Navigate to="/shows" replace />;
}
