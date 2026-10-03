/**
 * Recommended featured attendees in the Event Package's People section
 * (Evoni, 2026-10-03, episode creation step 5): the few people the story
 * should use, each with a story role and why, and Feature.
 *
 * Candidates are the event's invited guests and the Feed's most relevant
 * LalaVerse creators (GET /social-profiles?feed_layer=lalaverse&sort=score);
 * an invited guest not in that page is read by id. Ranked by
 * recommendGuests, with no AI. Feature is the page's own save (onFeature):
 * an invited guest becomes featured with the role, anyone else is added to
 * the guest list featured, the same shape Add from Feed writes.
 *
 * Props: guests (guest_profiles), organizerProfileId, venueLocationId,
 * slots (how many more can be featured), onFeature(rec), saving.
 */
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '../../services/api';
import { recommendGuests } from '../../utils/recommendGuests';

const FEED_URL = '/api/v1/social-profiles?feed_layer=lalaverse&sort=score&limit=40';
const MAX_LOOKUPS = 8;
const roleLabel = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : '');

export default function EventGuestRecommendations({ guests, organizerProfileId, venueLocationId, slots, onFeature, saving }) {
  const [profiles, setProfiles] = useState(null);
  const invitedKey = (guests || []).map((g) => g.profile_id).filter((id) => id != null).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(FEED_URL);
        const list = res.data?.profiles || [];
        const have = new Set(list.map((p) => String(p.id)));
        const missing = invitedKey ? invitedKey.split(',').filter((id) => !have.has(id)).slice(0, MAX_LOOKUPS) : [];
        const extra = await Promise.all(missing.map((id) => api.get(`/api/v1/social-profiles/${id}`)
          .then((r) => r.data?.profile || null)
          .catch((err) => { console.error('[EventGuests] profile load failed:', id, err); return null; })));
        if (!cancelled) setProfiles([...list, ...extra.filter(Boolean)]);
      } catch (err) {
        console.error('[EventGuests] Feed load failed:', err);
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => { cancelled = true; };
  }, [invitedKey]);

  if (profiles === null || slots <= 0) return null;
  const recs = recommendGuests({ guests, profiles, organizerProfileId, venueLocationId, count: Math.min(3, slots) });
  if (!recs.length) return null;

  return (
    <div className="epp-guest-recs" data-testid="guest-recs">
      <div className="epp-looks-head"><Sparkles size={13} aria-hidden="true" /> Recommended for the story</div>
      <ul className="epp-guest-recs-list">
        {recs.map((rec) => (
          <li key={rec.profile_id} className="epp-guest-rec" data-testid={`guest-rec-${rec.profile_id}`}>
            <div className="epp-guest-rec-main">
              <span className="epp-host-name">{rec.display_name}</span>
              <span className="epp-guest-rec-role" data-testid="guest-rec-role">{roleLabel(rec.role)}</span>
            </div>
            <div className="epp-guest-rec-why" data-testid="guest-rec-why">
              {rec.reason}{rec.invited ? '' : ' · not invited yet'}
            </div>
            <button
              type="button" className="epp-btn epp-btn-small epp-look-use" data-testid="guest-rec-feature"
              onClick={() => onFeature(rec)} disabled={saving}
            >
              Feature as {roleLabel(rec.role)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
