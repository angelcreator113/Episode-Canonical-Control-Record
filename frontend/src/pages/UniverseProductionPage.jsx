/**
 * /universe/production (audit IA-01, 2026-10-03). It used to render its
 * own Game Director dashboard (ProductionTab: world state, character
 * meters, an episode browser, a tool strip) for a picked show: a third
 * production landing surface beside Producer Mode, which has the same
 * sections as its Overview and Episodes tabs, and nothing linked here any
 * more. The route now opens the active show's Producer Mode on Episodes →
 * Production; with several shows and none active it asks which, as every
 * show page does (useActiveShow); with none it goes to the shows list.
 */
import { Navigate } from 'react-router-dom';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';

export const showProductionPath = (showId) => `/shows/${encodeURIComponent(showId)}/world?tab=episodes-production`;

export default function UniverseProductionPage() {
  const { shows, showId, loaded, failed, needsChoice, choose } = useActiveShow();
  if (!loaded) return <div className="up-loading">Opening production…</div>;
  if (showId) return <Navigate to={showProductionPath(showId)} replace />;
  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open its production board" />;
  if (failed) {
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '24px auto', padding: '12px 16px', borderRadius: 8, background: '#FBEFF3', border: '1px solid #C06E87', fontSize: 13 }}>
        The shows could not be loaded, so there is no production board to open. <a href="/shows">Shows</a>
      </div>
    );
  }
  return <Navigate to="/shows" replace />;
}
