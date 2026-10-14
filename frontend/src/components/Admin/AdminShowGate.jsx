/**
 * The show an Admin tab works on (Tasks #2914, #2919): the show in ?show=,
 * else the active show (utils/activeShow: the one last opened, else the only
 * one); with several shows and nothing to go on, a "Which show?" picker.
 * With several shows a selector switches. Picking a show remembers it and
 * drops the query keys in `resetKeys` (a tab's own sub-tab, for one).
 * A show opened by ?show= (a link, the /shows/:id/settings redirect) is
 * remembered too, so the rest of the app (the LalaVerse Overview, the
 * Sidebar) works on the show Admin is editing (Task #3140).
 * Styles: styles/AdminPanel.css.
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import showService from '../../services/showService';
import { activeShowId, rememberShow, showLabel } from '../../utils/activeShow';

export default function AdminShowGate({ children, resetKeys = [] }) {
  const [params, setParams] = useSearchParams();
  const [shows, setShows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    showService.getAllShows()
      .then((list) => { if (alive) setShows(list || []); })
      .catch((err) => {
        console.error('[Admin] shows could not be loaded:', err);
        if (alive) setError('The shows could not be loaded.');
      });
    return () => { alive = false; };
  }, []);

  // The show this tab works on is the active show everywhere: a show opened
  // by ?show= used to be edited here while the rest of the app stayed on the
  // remembered one (Task #3140).
  const asked = params.get('show');
  const askedKnown = !!shows && !!asked && shows.some((sh) => String(sh.id) === asked);
  useEffect(() => { if (askedKnown) rememberShow(asked); }, [askedKnown, asked]);

  const pick = (id) => {
    rememberShow(id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('show', id);
      for (const key of resetKeys) next.delete(key);
      return next;
    }, { replace: true });
  };

  if (error) return <p className="admin-subtitle" role="alert">{error}</p>;
  if (!shows) return <LoadingSpinner />;
  if (shows.length === 0) return <p className="admin-subtitle">No shows yet. <Link to="/shows">Create one</Link> first.</p>;

  const showId = askedKnown ? asked : activeShowId({ shows });
  const nameOf = (sh) => showLabel(sh, shows);

  if (!showId) {
    return (
      <section className="admin-show-pick" aria-labelledby="admin-show-pick-heading" data-testid="admin-show-pick">
        <h2 id="admin-show-pick-heading">Which show?</h2>
        <ul className="admin-tools-list">
          {shows.map((sh) => (
            <li key={sh.id}>
              <button type="button" className="admin-tool" onClick={() => pick(String(sh.id))}>
                <span className="admin-tool-text"><span className="admin-tool-label">{nameOf(sh)}</span></span>
                <ChevronRight className="admin-tool-chevron" size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      {shows.length > 1 && (
        <label className="admin-show-switch">
          Show{' '}
          <select value={showId} onChange={(e) => pick(e.target.value)} data-testid="admin-show-select">
            {shows.map((sh) => <option key={sh.id} value={String(sh.id)}>{nameOf(sh)}</option>)}
          </select>
        </label>
      )}
      {children(showId)}
    </>
  );
}
