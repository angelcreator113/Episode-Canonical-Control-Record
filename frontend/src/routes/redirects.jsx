/**
 * Addresses that moved, kept working (Task #3157; pinned by
 * redirects.test.jsx, and App.jsx mounts them):
 *   /feed     → /pulse, with its query and hash. The Feed is The Pulse
 *               (Task #2912); its old ?layer= and other links still open
 *               the same view.
 *   /website  → /admin?tab=website. The Website page is Admin's Website tab
 *               (Task #2913).
 */
import { Navigate, useLocation } from 'react-router-dom';

export function PulseRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/pulse${search}${hash}`} replace />;
}

export function WebsiteRedirect() {
  return <Navigate to="/admin?tab=website" replace />;
}
