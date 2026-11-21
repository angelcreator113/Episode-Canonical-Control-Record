/**
 * The season's next open slot for a show, from one read of the season
 * roadmap. Moved here unchanged from components/Show/ShowOverview (its "Up
 * Next" card), so another page can show the same slot.
 *
 * { loading, slot, failed, hasSeason, reload }: `slot` is the roadmap's slot
 * numbered `next_slot_number`, or null; `hasSeason` is false when the show
 * has no season; `reload` reads again (the card's Retry).
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function useNextSlot(showId) {
  const [state, setState] = useState({ loading: true, slot: null, failed: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, failed: false }));
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/roadmap`);
      const roadmap = r.data?.roadmap || null;
      const slots = (roadmap?.phases || []).flatMap((p) => p.slots || []);
      const slot = roadmap?.next_slot_number ? slots.find((s) => s.slot_number === roadmap.next_slot_number) || null : null;
      setState({ loading: false, slot, failed: false, hasSeason: Boolean(roadmap) });
    } catch (err) {
      console.error('[ShowOverview] season roadmap load failed:', err);
      setState({ loading: false, slot: null, failed: true });
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
