/**
 * The Season page's "Needs attention" for a page that is not the Season page
 * (the daily update, Evoni 2026-10-26, Season page round 3: "Needs attention
 * in the daily update"). It makes the Season page's own reads (the season in
 * progress, its roadmap, the show's events, episodes and opportunities, the
 * release schedule and the goal coverage) and runs the same attentionItems
 * (lib/seasonAttention) over them, so the daily update lists the same items
 * in the same words. The Season page itself already holds these reads and
 * calls attentionItems directly.
 *
 *   useSeasonAttention({ api, showId }) → { items, arc, loading, error }
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchAllEpisodes } from './fetchAllPages';
import { attentionItems } from './seasonAttention';
import { useReleaseSchedule } from './releaseSchedule';
import { useGoalCoverage } from './goalCoverage';

export function useSeasonAttention({ api, showId }) {
  const [state, setState] = useState({ arc: null, roadmap: null, events: [], episodes: [], opps: [], loaded: false, error: null });
  useEffect(() => {
    if (!api || !showId) return undefined;
    let cancelled = false;
    const read = (label, p, fallback) => p.catch((err) => {
      console.error(`[seasonAttentionLoad] ${label} could not be read:`, err);
      return fallback;
    });
    (async () => {
      const [arcRes, roadmapRes, eventsRes, episodes, oppsRes] = await Promise.all([
        read('the season', api.get(`/api/v1/world/${showId}/arc`), null),
        read('the roadmap', api.get(`/api/v1/world/${showId}/season/roadmap`), null),
        read('the events', api.get(`/api/v1/world/${showId}/events`), null),
        read('the episodes', fetchAllEpisodes(api, showId), { items: [] }),
        read('the opportunities', api.get(`/api/v1/opportunities/${showId}`), null),
      ]);
      if (cancelled) return;
      setState({
        arc: arcRes?.data?.arc || null,
        roadmap: roadmapRes?.data?.roadmap || null,
        events: eventsRes?.data?.events || [],
        episodes: episodes?.items || [],
        opps: oppsRes?.data?.opportunities || [],
        loaded: true,
        error: arcRes ? null : 'The season could not be read.',
      });
    })();
    return () => { cancelled = true; };
  }, [api, showId]);
  const release = useReleaseSchedule({ api, showId });
  const coverage = useGoalCoverage({ api, showId });
  const items = useMemo(() => (state.arc ? attentionItems({
    showId, arc: state.arc, roadmap: state.roadmap, events: state.events, episodes: state.episodes,
    coverage: coverage.data, release: release.view, opps: state.opps, isCurrent: true,
  }) : []), [showId, state, coverage.data, release.view]);
  const loading = !state.loaded || (!release.view && !release.error);
  return { items, arc: state.arc, loading, error: state.error };
}
