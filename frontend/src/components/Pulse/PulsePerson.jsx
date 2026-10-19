/**
 * Someone's profile on The Pulse (Evoni, 2026-10-19: "when I click on a
 * character's profile inside of the pulse, all I see is their feed"): their
 * photo, @handle, name, bio and city; their audience number (the story's,
 * as Lala's header shows hers); how they and Lala follow each other ("Follows
 * Lala", "Lala follows", and "Friends" when both); and their posts.
 *
 * For an ADMIN: the two follow switches (routes/pulseFollowsRoutes) and a link
 * to their full character page. Lala's own profile is ProfileView in
 * pages/SocialMediaPage. Opened at /pulse?tab=profile&who=<handle>.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserCheck, UserPlus, Users } from 'lucide-react';
import api from '../../services/api';
import { Avatar, cityName, photoItemsOf } from './PulsePost';
import { followersText } from '../../lib/pulseAudience';
import './PulsePerson.css';

const POSTS = 24;
const clean = (h) => String(h || '').replace(/^@/, '');

/** The badges for how they and Lala follow each other. */
export function followBadges(relation) {
  if (!relation) return [];
  if (relation.friends) return [{ key: 'friends', text: 'Friends', Icon: Users }];
  return [
    relation.follows_lala && { key: 'follows-lala', text: 'Follows Lala', Icon: UserCheck },
    relation.lala_follows && { key: 'lala-follows', text: 'Lala follows', Icon: UserPlus },
  ].filter(Boolean);
}

function FollowSwitch({ label, on, busy, onChange, testId }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'pp-switch on' : 'pp-switch'}
      disabled={busy} onClick={() => onChange(!on)} data-testid={testId}>
      <span className="pp-switch-track" aria-hidden="true"><span className="pp-switch-knob" /></span>
      {label}
    </button>
  );
}

export default function PulsePerson({ show, handle, viewAt = null, admin = false, onBack = null }) {
  const [data, setData] = useState(null);       // null loading, false failed
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setPosts(null); setError(null);
    const qs = new URLSearchParams();
    if (show?.id) qs.set('show_id', show.id);
    if (show?.id && viewAt) qs.set('at', viewAt);
    api.get(`/api/v1/pulse-follows/profile/${encodeURIComponent(clean(handle))}${qs.toString() ? `?${qs}` : ''}`)
      .then((r) => { if (alive) setData(r.data?.data || false); })
      .catch((err) => {
        console.error('[ThePulse] profile could not be read:', err.response?.status || err.message);
        if (alive) setData(false);
      });
    return () => { alive = false; };
  }, [handle, show?.id, viewAt]);

  const profileId = data?.profile?.id;
  useEffect(() => {
    if (!profileId || !show?.id) return undefined;
    let alive = true;
    const qs = new URLSearchParams({ show_id: show.id, status: 'live', profile_id: String(profileId), limit: String(POSTS) });
    if (viewAt) qs.set('at', viewAt);
    api.get(`/api/v1/feed-posts?${qs}`)
      .then((r) => { if (alive) setPosts(r.data?.data || []); })
      .catch((err) => {
        console.error('[ThePulse] their posts could not be read:', err.response?.status || err.message);
        if (alive) setPosts(false);
      });
    return () => { alive = false; };
  }, [profileId, show?.id, viewAt]);

  const setFollow = async (path, on) => {
    setBusy(true); setError(null);
    try {
      const r = on
        ? await api.put(`/api/v1/pulse-follows/${profileId}/${path}`)
        : await api.delete(`/api/v1/pulse-follows/${profileId}/${path}`);
      setData((d) => ({ ...d, relation: r.data?.data || d.relation }));
    } catch (err) {
      console.error('[ThePulse] follow could not be saved:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'That could not be saved.');
    } finally { setBusy(false); }
  };

  if (data === null) return <section className="pl-card" data-testid="pl-person"><p className="pl-quiet">Loading…</p></section>;
  if (data === false) {
    return (
      <section className="pl-card" data-testid="pl-person">
        <p className="pl-error" role="alert">That profile could not be found.</p>
        {onBack && <button type="button" className="pp-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back</button>}
      </section>
    );
  }

  const { profile, relation, followers } = data;
  const city = cityName(profile.city) || profile.city;
  const badges = followBadges(relation);
  return (
    <section className="pl-card pp" aria-labelledby="pp-name" data-testid="pl-person">
      {onBack && <button type="button" className="pp-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back</button>}
      <div className="pp-head">
        <Avatar name={profile.display_name || profile.handle} url={profile.portrait_url} size={88} />
        <div className="pp-who">
          <h2 id="pp-name" className="pl-card-title">{profile.display_name || profile.handle}</h2>
          <p className="pl-meta">@{clean(profile.handle)}{city ? ` · ${city}` : ''}</p>
          {followersText(followers) && <p className="pp-followers" data-testid="pp-followers">{followersText(followers)}</p>}
          {badges.length > 0 && (
            <p className="pp-badges">
              {badges.map(({ key, text, Icon }) => (
                <span key={key} className={`pp-badge pp-badge-${key}`} data-testid="pp-badge"><Icon size={14} aria-hidden="true" /> {text}</span>
              ))}
            </p>
          )}
        </div>
      </div>
      {profile.bio && <p className="pp-bio" data-testid="pp-bio">{profile.bio}</p>}

      {admin && (
        <div className="pp-admin" data-testid="pp-admin">
          <FollowSwitch label="Follows Lala" on={Boolean(relation?.follows_lala)} busy={busy} testId="pp-follows-lala"
            onChange={(on) => setFollow('follows-lala', on)} />
          <FollowSwitch label="Lala follows them" on={Boolean(relation?.lala_follows)} busy={busy} testId="pp-lala-follows"
            onChange={(on) => setFollow('lala-follows', on)} />
          {data.character_id && <Link className="pl-studio-link" to={`/character/${data.character_id}`} data-testid="pp-character-link">Open full character page</Link>}
          {error && <p className="pl-error" role="alert">{error}</p>}
        </div>
      )}

      <h3 className="pp-section">Posts</h3>
      {posts === null && <p className="pl-quiet">Loading…</p>}
      {posts === false && <p className="pl-error" role="alert">Their posts could not be read.</p>}
      {Array.isArray(posts) && posts.length === 0 && <p className="pl-quiet" data-testid="pp-no-posts">Nothing posted yet.</p>}
      {Array.isArray(posts) && posts.length > 0 && (
        <ul className="pp-grid">
          {posts.map((p) => {
            const photo = p.teaser ? null : photoItemsOf(p)[0];
            return (
              <li key={p.id} className="pp-tile" data-testid="pp-post">
                {photo
                  ? <img src={photo.src} alt={photo.alt} className={p.photo_teaser ? 'pp-tile-blur' : undefined} />
                  : <p>{p.teaser ? 'First look' : String(p.content_text || '').slice(0, 140)}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
