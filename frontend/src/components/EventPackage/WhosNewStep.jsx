/**
 * WhosNewStep — "Who's new in Lala's life this episode?" (Task #3202; the
 * cast read §8d, docs/reads/2026-10-14-cast-generator-read.md). Start
 * Episode asks it after the locations step and before generate-episode.
 *
 *   Introduce a new friend   "Make one for me" (POST /character-generation/
 *       cast/propose, seeded by this event), then Keep (POST .../cast/keep)
 *       makes the character and their Pulse profile. They join the event's
 *       guests and are revealed in the new episode (useStartEpisode).
 *   Feature existing friends the people closest to Lala on The Pulse (GET
 *       /social-profiles/lala/close-friends), up to the free featured slots.
 *   No one new               changes nothing.
 *
 * Nothing is saved until the last button: Keep saves the new friend, then
 * onFinish starts the episode.
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { chooseRegistry } from '../../lib/theCast';
import { MAX_FEATURED_GUESTS } from '../../lib/eventPackageFields';
import '../EpisodeLocationsStep.css';
import './WhosNewStep.css';

const CHOICES = [
  { key: 'new', label: 'Introduce a new friend', hint: 'Someone Lala meets at this event, made for her and revealed in this episode.' },
  { key: 'feature', label: 'Feature existing friends', hint: 'The people closest to Lala on The Pulse, as featured guests.' },
  { key: 'none', label: 'No one new', hint: 'Start the episode as it is.' },
];

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

/** The idea "Make one for me" is seeded with: this event, its host and its place. */
export function ideaForEvent(event) {
  const host = event?.host_brand || event?.host || event?.canon_consequences?.automation?.host_display_name;
  const place = event?.venue_name || event?.canon_consequences?.automation?.venue_name || event?.location_hint;
  return [`A new friend Lala meets at ${event?.name || 'this event'}`, host && `hosted by ${host}`, place && `at ${place}`]
    .filter(Boolean).join(', ').slice(0, 200);
}

export default function WhosNewStep({ showId, event, guestList = [], busy = false, onFinish, onCancel }) {
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  const [registryId, setRegistryId] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [friends, setFriends] = useState(null); // null: not loaded
  const [picked, setPicked] = useState([]);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const featuredCount = guestList.filter((g) => g.featured).length;
  const freeSlots = Math.max(0, MAX_FEATURED_GUESTS - featuredCount);
  const disabled = busy || working;

  const propose = async () => {
    setWorking(true); setError(null);
    try {
      let reg = registryId;
      if (!reg) {
        const res = await api.get(`/api/v1/character-registry/registries?show_id=${encodeURIComponent(showId)}`);
        reg = chooseRegistry(res.data?.registries || [], { showId });
        if (!reg) { setError('This show has no character registry to make a friend in.'); return; }
        setRegistryId(reg);
      }
      const res = await api.post('/api/v1/character-generation/cast/propose', { registry_id: reg, idea: ideaForEvent(event), count: 1 });
      setProposal(res.data?.proposals?.[0] || null);
      if (!res.data?.proposals?.length) setError('Nothing was proposed. Try again.');
    } catch (err) {
      console.error('[WhosNewStep] propose failed:', err);
      setError(err?.response?.status === 403 ? 'Only an admin can make characters.' : errorText(err, 'Nothing could be made. Try again.'));
    } finally { setWorking(false); }
  };

  const loadFriends = async () => {
    setWorking(true); setError(null);
    try {
      const featured = guestList.filter((g) => g.featured).map((g) => g.profile_id).filter((id) => /^\d+$/.test(String(id)));
      const qs = new URLSearchParams({ show_id: showId });
      if (featured.length) qs.set('exclude', featured.join(','));
      const res = await api.get(`/api/v1/social-profiles/lala/close-friends?${qs.toString()}`);
      setFriends(res.data?.data?.friends || []);
    } catch (err) {
      console.error('[WhosNewStep] close friends load failed:', err);
      setFriends([]);
      setError(errorText(err, "Lala's friends could not be loaded."));
    } finally { setWorking(false); }
  };

  const choose = (key) => {
    setChoice(key); setError(null);
    if (key === 'new' && !proposal) propose();
    if (key === 'feature' && friends === null) loadFriends();
  };

  const togglePick = (f) => setPicked((list) => (list.some((p) => p.id === f.id)
    ? list.filter((p) => p.id !== f.id)
    : list.length < freeSlots ? [...list, f] : list));

  // Kept already (the start after it failed): start again, never keep twice.
  const [kept, setKept] = useState(null);
  const keepAndStart = async () => {
    if (kept) { onFinish?.({ add: [kept], reveal: kept }); return; }
    if (!proposal || !registryId) return;
    setWorking(true); setError(null);
    try {
      const res = await api.post('/api/v1/character-generation/cast/keep', { registry_id: registryId, proposal });
      const profile = res.data?.profile;
      if (!profile?.id) { setError('The friend was made without a Pulse profile, so they cannot join the guests.'); return; }
      const friend = { id: profile.id, handle: profile.handle, display_name: profile.display_name || proposal.display_name };
      setKept(friend);
      setWorking(false);
      onFinish?.({ add: [friend], reveal: friend });
    } catch (err) {
      console.error('[WhosNewStep] keep failed:', err);
      setError(errorText(err, 'The friend could not be saved. Nothing was saved.'));
    } finally { setWorking(false); }
  };

  const start = () => {
    if (choice === 'new') return keepAndStart();
    if (choice === 'feature') return onFinish?.({ feature: picked });
    return onFinish?.({});
  };

  const startLabel = busy ? 'Starting…'
    : choice === 'new' ? (kept ? 'Start the episode' : 'Keep and start the episode')
      : choice === 'feature' ? (picked.length ? `Feature ${picked.length} and start` : 'Start without featuring')
        : 'Start Episode';
  const canStart = choice === 'none' || (choice === 'feature' && friends !== null) || (choice === 'new' && Boolean(proposal));

  return (
    <div className="els-overlay" role="dialog" aria-modal="true" aria-labelledby="wn-title"
      onKeyDown={(e) => { if (e.key === 'Escape' && !disabled) { e.stopPropagation(); onCancel?.(); } }}>
      <div className="els-panel wn" data-testid="whos-new-step">
        <h2 id="wn-title" className="els-title" tabIndex={-1} ref={titleRef}>Who&apos;s new in Lala&apos;s life this episode?</h2>
        <div className="wn-choices" role="radiogroup" aria-label="Who's new">
          {CHOICES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={choice === c.key} disabled={disabled}
              className={`wn-choice${choice === c.key ? ' is-on' : ''}`} data-testid={`wn-${c.key}`} onClick={() => choose(c.key)}>
              <strong>{c.label}</strong><span>{c.hint}</span>
            </button>
          ))}
        </div>

        {choice === 'new' && (
          <div className="wn-body" data-testid="wn-new-body">
            {working && !proposal && <p className="els-sub">Making a friend for this event…</p>}
            {proposal && (
              <div className="wn-proposal" data-testid="wn-proposal">
                <strong>{proposal.icon} {proposal.display_name}</strong>
                {proposal.role_label && <span className="wn-meta">{proposal.role_label}</span>}
                {proposal.reason && <p className="wn-reason">{proposal.reason}</p>}
                {proposal.description && <p>{proposal.description}</p>}
                {!kept && <button type="button" className="els-btn" data-testid="wn-again" disabled={disabled} onClick={propose}>Try again</button>}
              </div>
            )}
          </div>
        )}

        {choice === 'feature' && (
          <div className="wn-body" data-testid="wn-feature-body">
            <p className="els-sub">{freeSlots
              ? `Up to ${freeSlots} more can be featured (${featuredCount}/${MAX_FEATURED_GUESTS} now).`
              : `All ${MAX_FEATURED_GUESTS} featured places are taken; remove one on the page first.`}</p>
            {friends === null && working && <p className="els-sub">Finding Lala&apos;s closest friends…</p>}
            {friends !== null && !friends.length && <p className="els-sub" data-testid="wn-no-friends">No friends of Lala on The Pulse yet.</p>}
            {friends?.length > 0 && (
              <ul className="wn-friends">
                {friends.map((f) => {
                  const on = picked.some((p) => p.id === f.id);
                  return (
                    <li key={f.id}>
                      <label className="wn-friend">
                        <input type="checkbox" checked={on} disabled={disabled || (!on && picked.length >= freeSlots)}
                          onChange={() => togglePick(f)} data-testid={`wn-friend-${f.id}`} />
                        <span>{f.display_name || f.handle}</span>
                        <span className="wn-meta">{Math.round((f.closeness || 0) * 100)}% close{f.friend ? ' · friend' : ''}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {error && <p className="els-error" role="alert" data-testid="wn-error">{error}</p>}

        <div className="els-actions">
          <button type="button" className="els-btn" onClick={onCancel} disabled={disabled}>Back</button>
          <button type="button" className="els-btn els-primary" data-testid="wn-start" onClick={start} disabled={disabled || !canStart}>
            {working && choice === 'new' && proposal ? 'Keeping…' : startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
