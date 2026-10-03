import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { activeShowId, rememberShow } from '../utils/activeShow';

/**
 * The show a page works on (audit CTX-01, 2026-10-03): the shows list and
 * the active one by utils/activeShow's rule (the show in the URL, else the
 * show last opened, else the only show). With several shows and nothing to
 * go on, needsChoice is true and the page asks Evoni (ShowChooser) instead
 * of taking the first show the API returned. choose(id) makes a show the
 * active one everywhere.
 *
 * Returns { shows, show, showId, loaded, failed, needsChoice, choose }.
 */
export default function useActiveShow() {
  const location = useLocation();
  const [shows, setShows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chosenId, setChosenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/shows')
      .then((r) => {
        if (cancelled) return;
        const list = r.data?.data || r.data?.shows || r.data;
        setShows(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error('[useActiveShow] shows load failed:', err.response?.status || err.message);
        if (!cancelled) setFailed(true);
      })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const activeId = chosenId && shows.some((s) => String(s.id) === String(chosenId))
    ? String(chosenId)
    : activeShowId({ pathname: location.pathname, shows });
  const show = useMemo(() => shows.find((s) => String(s.id) === String(activeId)) || null, [shows, activeId]);
  const choose = useCallback((id) => { rememberShow(id); setChosenId(id); }, []);

  return {
    shows,
    show,
    showId: show ? String(show.id) : null,
    loaded,
    failed,
    needsChoice: loaded && !failed && shows.length > 1 && !show,
    choose,
  };
}
