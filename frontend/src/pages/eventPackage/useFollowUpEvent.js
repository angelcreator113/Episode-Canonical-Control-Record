/**
 * Make a follow-up event (Evoni, 2026-10-25): a new event with the same
 * host, brand and organizer, the venue's type and the deal type (lib/
 * eventFlow followUpBody), through the existing create route, then opened
 * in the editor. The deal type is set after the create (the route drafts
 * its own first), with the new row's version. Nothing else is copied.
 */
import { useState } from 'react';
import api from '../../services/api';
import { seasonPageHref } from '../../lib/seasonPage';
import { followUpBody } from '../../lib/eventActions';

export default function useFollowUpEvent({ showId, event, organizer, venueLocation, navigate, setToast }) {
  const [creating, setCreating] = useState(false);
  const create = async () => {
    if (creating) return;
    setCreating(true);
    const { body, dealType } = followUpBody(event, { organizer, venueLocation });
    try {
      const res = await api.post(`/api/v1/world/${showId}/events`, body);
      const created = res.data?.event;
      if (!created?.id) throw new Error('The new event came back without an id');
      if (dealType && created.deal_type !== dealType) {
        try {
          const fresh = await api.get(`/api/v1/world/${showId}/events/${created.id}`);
          await api.put(`/api/v1/world/${showId}/events/${created.id}`, { deal_type: dealType, expected_updated_at: fresh.data?.event?.updated_at });
        } catch (dealErr) {
          console.error('[EventPackage] follow-up deal type failed:', dealErr);
          setToast('The follow-up was created; set its deal type in the editor.');
        }
      }
      navigate(seasonPageHref(showId, 'events', { event: created.id }));
    } catch (err) {
      console.error('[EventPackage] follow-up create failed:', err);
      setToast(err.response?.data?.error || err.message || 'Couldn’t create the follow-up event');
      setCreating(false);
    }
  };
  return { creating, create, preview: followUpBody(event, { organizer, venueLocation }).body.name };
}
