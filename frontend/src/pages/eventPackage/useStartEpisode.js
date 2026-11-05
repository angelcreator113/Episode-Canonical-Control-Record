/**
 * Start Episode, moved out of EventPackagePage.jsx (Task #54): blocked while
 * any gate item is missing; with warnings open it asks first (Start Anyway,
 * Task #1775); with none it starts directly. Then the Episode Locations step
 * (L3, §8(hh)): the proposal shown before anything is created (null while
 * closed). Then "Who's new in Lala's life this episode?" (Task #3202; the
 * cast read §8d): a new friend, existing friends featured, or no one new,
 * before generate-episode. A new friend joins the guests and, once the
 * episode exists, is revealed in it (pulse_reveals, item_type character,
 * hidden until Lala arrives). When the event's offer is not accepted yet,
 * the server asks for an explicit offer decision (OfferDecisionDialog).
 */
import { useState } from 'react';
import api from '../../services/api';
import useOfferDecision from '../../hooks/useOfferDecision';

export default function useStartEpisode({ showId, eventId, gatesMet, used, moneyPending, readiness, moneyWarnings, setToast, navigate, joinFromWhosNew }) {
  const [starting, setStarting] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [locationsStep, setLocationsStep] = useState(null);
  // The locations confirmed, waiting on "Who's new" (null while closed).
  const [whosNewStep, setWhosNewStep] = useState(null);
  // The explicit offer decision, asked only when the server says the event's
  // offer is not accepted yet (hooks/useOfferDecision).
  const offerDecision = useOfferDecision();

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

  // Locations confirmed: ask who's new before anything is created. The
  // locations step stays mounted (hidden), so Back returns to it as edited.
  const confirmStartEpisode = (locations) => {
    if (!gatesMet || used || starting) return;
    setWhosNewStep({ locations });
  };

  // "Who's new" answered (Task #3202). feature: profiles to feature; add:
  // a new friend's profile to add as a guest; reveal: that profile, revealed
  // in the new episode. "No one new" passes nothing and changes nothing.
  const finishStartEpisode = async ({ feature = [], add = [], reveal = null } = {}) => {
    if (!gatesMet || used || starting || !whosNewStep) return;
    const { locations } = whosNewStep;
    setStarting(true);
    try {
      if ((feature.length || add.length) && joinFromWhosNew) {
        try {
          await joinFromWhosNew({ feature, add });
        } catch (err) {
          console.error('[EventPackage] who\'s new guests save failed:', err);
          setToast(err.response?.data?.error || err.message || 'The guests could not be saved, so the episode was not started.');
          return;
        }
      }
      // An offer not accepted yet is asked about (409 OFFER_DECISION_REQUIRED;
      // OfferDecisionDialog), then only the start is sent again, with the
      // decision; the guests above are not saved twice.
      const res = await offerDecision.run((decision) => api.post(`/api/v1/world/${showId}/events/${eventId}/generate-episode`, {
        draft_script: false, locations, ...(decision ? { offer_decision: decision } : {}),
      }));
      if (res.data.success) {
        const ep = res.data.data.episode;
        setWhosNewStep(null);
        setLocationsStep(null);
        // The new friend is revealed in this episode: hidden on The Pulse
        // until Lala arrives at the event (pulseReveals, moment lala_arrives).
        // The episode exists either way; a failed reveal is said, not undone.
        if (reveal?.id && ep?.id) {
          try {
            await api.put('/api/v1/pulse-reveals', {
              show_id: showId, item_type: 'character', item_id: String(reveal.id), episode_id: ep.id, moment: 'lala_arrives', mode: 'hidden',
            });
          } catch (err) {
            console.error('[EventPackage] new friend reveal failed:', err);
            setToast(`The episode was started, but ${reveal.display_name || 'the new friend'} could not be set to be revealed in it. Set it in Admin › The Pulse.`);
          }
        }
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
      // Cancelled at the offer decision: nothing was started; the step stays open.
      if (err?.offerDecisionCancelled) return;
      console.error('[EventPackage] start episode failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to start episode');
    } finally {
      setStarting(false);
    }
  };

  return {
    starting, startConfirmOpen, setStartConfirmOpen, locationsStep, setLocationsStep,
    whosNewStep, setWhosNewStep, offerDecision,
    requestStartEpisode, handleStartEpisode, confirmStartEpisode, finishStartEpisode,
  };
}
