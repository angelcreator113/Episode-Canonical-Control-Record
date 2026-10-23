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
 *
 * A Feed that fails to load says so in one line with Retry, rather than the
 * recommendations silently not appearing.
 *
 * Under each one's why, the facts behind it (Evoni, 2026-10-23), from the
 * profiles already read (utils/eventGuestReasons): her tie to the
 * organizer, the same district as the organizer, Lala following her, a
 * high Pulse following, a rising trajectory. None when the data has none.
 * The organizer's profile is read too (one lookup, like an invited guest
 * missing from the Feed's page) for the district.
 */
import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, RotateCw } from 'lucide-react';
import api from '../../services/api';
import { recommendGuests } from '../../utils/recommendGuests';
import { guestReasons } from '../../utils/eventGuestReasons';
import './EventGuestRecommendations.css';

const FEED_URL = '/api/v1/social-profiles?feed_layer=lalaverse&sort=score&limit=40';
const MAX_LOOKUPS = 8;
const roleLabel = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : '');

export default function EventGuestRecommendations({ guests, organizerProfileId, venueLocationId, slots, onFeature, saving }) {
  const [profiles, setProfiles] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const invitedKey = (guests || []).map((g) => g.profile_id).filter((id) => id != null).join(',');
  // The profiles read by id: the invited guests, and the organizer (for her district).
  const lookupKey = [invitedKey, organizerProfileId == null ? '' : String(organizerProfileId)].filter(Boolean).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(FEED_URL);
        const list = res.data?.profiles || [];
        const have = new Set(list.map((p) => String(p.id)));
        const missing = lookupKey ? [...new Set(lookupKey.split(','))].filter((id) => !have.has(id)).slice(0, MAX_LOOKUPS) : [];
        const extra = await Promise.all(missing.map((id) => api.get(`/api/v1/social-profiles/${id}`)
          .then((r) => r.data?.profile || null)
          .catch((err) => { console.error('[EventGuests] profile load failed:', id, err); return null; })));
        if (!cancelled) { setProfiles([...list, ...extra.filter(Boolean)]); setFailed(false); }
      } catch (err) {
        console.error('[EventGuests] Feed load failed:', err);
        if (!cancelled) { setProfiles(null); setFailed(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [lookupKey, attempt]);

  if (slots <= 0) return null;
  if (failed) {
    return (
      <p className="epp-looks-note" data-testid="guest-recs-failed">
        <AlertCircle size={12} aria-hidden="true" /> Couldn&apos;t load recommendations.{' '}
        <button type="button" className="epp-inline-link" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }} data-testid="guest-recs-retry">
          <RotateCw size={11} aria-hidden="true" /> Retry
        </button>
      </p>
    );
  }
  if (profiles === null) return null;
  const recs = recommendGuests({ guests, profiles, organizerProfileId, venueLocationId, count: Math.min(3, slots) });
  if (!recs.length) return null;
  const byId = new Map(profiles.map((p) => [String(p.id), p]));
  const guestById = new Map((guests || []).filter((g) => g?.profile_id != null).map((g) => [String(g.profile_id), g]));
  const organizer = organizerProfileId == null ? null : byId.get(String(organizerProfileId)) || null;
  const reasonsOf = (rec) => guestReasons({
    profile: byId.get(String(rec.profile_id)) || null,
    guest: guestById.get(String(rec.profile_id)) || null,
    organizer,
  });

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
            {(() => {
              const reasons = reasonsOf(rec);
              return reasons.length > 0 && (
                <ul className="egr-reasons" aria-label={`Why ${rec.display_name}`} data-testid="guest-rec-reasons">
                  {reasons.map((r) => <li key={r} className="egr-reason">{r}</li>)}
                </ul>
              );
            })()}
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
