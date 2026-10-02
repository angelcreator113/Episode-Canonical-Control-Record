/**
 * S8 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(dd)): "All scene image
 * work ... happens in one place: the scene set's panel in Scene Sets. Other
 * pages ... show status only, with one entry point: 'Open in Scene Sets →',
 * landing on the exact set and zone, with a way back to the page it came
 * from."
 *
 * OpenInSceneSets: the entry point, carrying the current page as `from`.
 * SceneSetsBackLink: Scene Sets' way back, to a page of this app only.
 */
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { sceneSetPath, isAppPath } from '../utils/sceneSets';

export default function OpenInSceneSets({ showId, setId, zone = null, from: fromPath = null, fromLabel = null, className = 'open-in-scene-sets', testId }) {
  const location = useLocation();
  if (!setId) return null;
  if (!showId) {
    return <span className={className} data-testid={testId}>Find this set in Scene Sets</span>;
  }
  // The page to come back to: the one given (a page whose URL drops its own
  // state, e.g. World Admin's open event), else this one.
  const from = fromPath || `${location.pathname}${location.search || ''}`;
  return (
    <Link className={className} data-testid={testId} to={sceneSetPath(showId, setId, { zone, from, fromLabel })}>
      Open in Scene Sets →
    </Link>
  );
}

export function SceneSetsBackLink({ className = 'scene-sets-back-link' }) {
  const [params] = useSearchParams();
  const from = params.get('from');
  if (!isAppPath(from)) return null;
  const label = params.get('fromLabel') || 'the page you came from';
  return <Link className={className} to={from} data-testid="scene-sets-back">← Back to {label}</Link>;
}
