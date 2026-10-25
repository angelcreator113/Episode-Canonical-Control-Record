/**
 * Start Episode, moved out of EventPackagePage.jsx (Task #54): blocked while
 * any gate item is missing; with warnings open it asks first (Start Anyway,
 * Task #1775); with none it starts directly. Then the Episode Locations step
 * (L3, §8(hh)): the proposal shown before anything is created (null while
 * closed).
 */
import { useState } from 'react';
import api from '../../services/api';

export default function useStartEpisode({ showId, eventId, gatesMet, used, moneyPending, readiness, moneyWarnings, setToast, navigate }) {
  const [starting, setStarting] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [locationsStep, setLocationsStep] = useState(null);

  // After the warnings (if any), the Episode Locations step (L3; Evoni,
  // 2026-10-02): home, closet, the event's set and any extras, each
  // changeable. Nothing is created until Confirm (Q13).
  const handleStartEpisode = async () => {
    if (!gatesMet || used || starting) return;
    setStartConfirmOpen(false);
    setStarting(true);
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${eventId}/episode-locations`);
      setLocationsStep(res.data?.data || { locations: [], missing: ['event', 'home', 'closet'] });
    } catch (err) {
      console.error('[EventPackage] episode locations load failed:', err);
      setToast(err.response?.data?.error || err.message || 'Could not load the episode locations');
    } finally {
      setStarting(false);
    }
  };

  const requestStartEpisode = () => {
    if (!gatesMet || used || starting || moneyPending) return;
    if (readiness.warningItems.length || moneyWarnings.length) setStartConfirmOpen(true);
    else handleStartEpisode();
  };

  const confirmStartEpisode = async (locations) => {
    if (!gatesMet || used || starting) return;
    setStarting(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-episode`, { draft_script: false, locations });
      if (res.data.success) {
        const ep = res.data.data.episode;
        setLocationsStep(null);
        // Start Episode lands on the Overview, whose Planning card shows what
        // the episode inherited and the next decision (Evoni, 2026-10-03,
        // episode creation step 2). This replaces Production -> Assets
        // (Task #1905, 2026-09-25) for this caller only; EpisodeDetail's
        // default tab stays 'checklist'.
        if (ep?.id) navigate(`/episodes/${ep.id}?tab=overview`);
        else setToast('Episode created but no episode id was returned.');
      } else {
        setToast(res.data.error || 'Failed to start episode');
      }
    } catch (err) {
      console.error('[EventPackage] start episode failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to start episode');
    } finally {
      setStarting(false);
    }
  };

  return {
    starting, startConfirmOpen, setStartConfirmOpen, locationsStep, setLocationsStep,
    requestStartEpisode, handleStartEpisode, confirmStartEpisode,
  };
}
