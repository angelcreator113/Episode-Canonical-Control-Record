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
 *
 * A real account's page (Evoni, 2026-10-19: "lets give each pulse profile a
 * gallery just like a real social media account"): Posts (pinned first, at
 * most three; a carousel marked; a words-only post as a typographic tile),
 * Tagged (photos others posted with them in it) and Highlights (their posted
 * camera-roll photos by album), all public pictures only
 * (GET /pulse-follows/profile/:handle/media). An ADMIN pins and unpins, and
 * sees where each post's picture stands (services/postPictures): being made,
 * waiting for tomorrow (Make now), failed (Retry), or what it cost.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, Pin, PinOff, UserCheck, UserPlus, Users } from 'lucide-react';
import api from '../../services/api';
import { Avatar, cityName, photoItemsOf } from './PulsePost';
import { followersText } from '../../lib/pulseAudience';
import './PulsePerson.css';

const POSTS = 24;
const clean = (h) => String(h || '').replace(/^@/, '');
const money = (n) => (typeof n === 'number' ? `$${n.toFixed(2)}` : null);

/** Pinned posts first, in pin order (newest pin first); the rest as read, newest first. */
export function orderPosts(posts, pinned = []) {
  const at = new Map(pinned.map((id, i) => [String(id), i]));
  const first = posts.filter((p) => at.has(String(p.id))).sort((a, b) => at.get(String(a.id)) - at.get(String(b.id)));
  return [...first, ...posts.filter((p) => !at.has(String(p.id)))];
}

/**
 * Where a post's picture stands, for an ADMIN: a short word for the tile, the
 * whole sentence (shown on hover and read aloud), and the button that moves it on.
 */
export function pictureLine(job) {
  if (!job || !job.state) return null;
  switch (job.state) {
    case 'pending':
    case 'making': return { short: 'Making…', text: 'Its picture is being made.' };
    case 'waiting_cap': return { short: 'Waiting', text: job.reason || "Today's post-picture limit is reached; it will be made tomorrow.", action: 'make_now' };
    case 'failed': return { short: 'Failed', text: job.error || 'The picture could not be made.', action: 'retry' };
    case 'made': return job.reused
      ? { short: 'From roll', text: 'A photo already in their camera roll (no cost).' }
      : { short: money(job.cost_usd) || 'Made', text: `Picture made${money(job.cost_usd) ? `, ${money(job.cost_usd)}` : ''}.` };
    case 'skipped': return { short: 'No picture', text: job.reason || 'No picture for this post.' };
    default: return null;
  }
}

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
  const [media, setMedia] = useState(null);      // { pinned, tagged, highlights }; false when it could not be read
  const [tab, setTab] = useState('posts');
  const [album, setAlbum] = useState(null);
  const [reload, setReload] = useState(0);
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
  }, [profileId, show?.id, viewAt, reload]);

  useEffect(() => {
    if (!profileId) return undefined;
    let alive = true;
    api.get(`/api/v1/pulse-follows/profile/${encodeURIComponent(clean(handle))}/media`)
      .then((r) => {
        const d = r.data?.data || {};
        const list = (v) => (Array.isArray(v) ? v : []);
        if (alive) setMedia({ pinned: list(d.pinned), tagged: list(d.tagged), highlights: list(d.highlights) });
      })
      .catch((err) => {
        console.error('[ThePulse] their tagged photos and highlights could not be read:', err.response?.status || err.message);
        if (alive) setMedia(false);
      });
    return () => { alive = false; };
  }, [profileId, handle, reload]);

  const setPin = async (post, on) => {
    setBusy(true); setError(null);
    try {
      if (on) await api.put(`/api/v1/pulse-follows/posts/${post.id}/pin`);
      else await api.delete(`/api/v1/pulse-follows/posts/${post.id}/pin`);
      setReload((n) => n + 1);
    } catch (err) {
      console.error('[ThePulse] the pin could not be saved:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The pin could not be saved.');
    } finally { setBusy(false); }
  };

  const makePicture = async (post, makeNow) => {
    setBusy(true); setError(null);
    try {
      await api.post(`/api/v1/post-media/posts/${post.id}/picture`, { make_now: makeNow });
      setReload((n) => n + 1);
    } catch (err) {
      console.error('[ThePulse] the post picture could not be made:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The picture could not be made.');
      setReload((n) => n + 1);
    } finally { setBusy(false); }
  };

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

      <div className="pp-tabs" role="tablist" aria-label="Their photos">
        {[['posts', 'Posts'], ['tagged', 'Tagged'], ['highlights', 'Highlights']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'pp-tab on' : 'pp-tab'}
            onClick={() => { setTab(key); setAlbum(null); }} data-testid={`pp-tab-${key}`}>
            {label}{key === 'tagged' && media && media.tagged.length > 0 ? ` (${media.tagged.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <>
          {posts === null && <p className="pl-quiet">Loading…</p>}
          {posts === false && <p className="pl-error" role="alert">Their posts could not be read.</p>}
          {Array.isArray(posts) && posts.length === 0 && <p className="pl-quiet" data-testid="pp-no-posts">Nothing posted yet.</p>}
          {Array.isArray(posts) && posts.length > 0 && (
            <ul className="pp-grid">
              {orderPosts(posts, media ? media.pinned : []).map((p) => {
                const photos = p.teaser ? [] : photoItemsOf(p);
                const photo = photos[0];
                const pinned = Boolean(media && media.pinned.map(String).includes(String(p.id)));
                const carousel = photos.length > 1 || p.post_format === 'carousel';
                const line = admin ? pictureLine(p.picture_job) : null;
                return (
                  <li key={p.id} className={photo ? 'pp-tile' : 'pp-tile pp-tile-text'} data-testid="pp-post">
                    {photo
                      ? <img src={photo.src} alt={photo.alt} className={p.photo_teaser ? 'pp-tile-blur' : undefined} />
                      : <p>{p.teaser ? 'First look' : String(p.content_text || '').slice(0, 140)}</p>}
                    {(pinned || carousel) && (
                      <span className="pp-tile-marks">
                        {pinned && <span className="pp-mark" role="img" aria-label="Pinned" data-testid="pp-pinned"><Pin size={13} aria-hidden="true" /></span>}
                        {carousel && <span className="pp-mark" role="img" aria-label="Carousel" data-testid="pp-carousel"><Layers size={13} aria-hidden="true" /></span>}
                      </span>
                    )}
                    {admin && (
                      <span className="pp-tile-admin">
                        <button type="button" className="pp-pin" disabled={busy} onClick={() => setPin(p, !pinned)}
                          aria-label={pinned ? 'Unpin post' : 'Pin post'} title={pinned ? 'Unpin' : 'Pin first on their profile (three at most)'} data-testid="pp-pin">
                          {pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
                        </button>
                        {line && (
                          <span className="pp-picture" data-testid="pp-picture" title={line.text}>
                            <span aria-hidden="true">{line.short}</span>
                            <span className="pp-sr">{line.text}</span>
                            {line.action === 'make_now' && (
                              <button type="button" className="pp-picture-btn" disabled={busy} onClick={() => makePicture(p, true)}
                                title="Makes it now: today's post-picture limit does not apply, the image budget still does" data-testid="pp-make-now">Make now</button>
                            )}
                            {line.action === 'retry' && (
                              <button type="button" className="pp-picture-btn" disabled={busy} onClick={() => makePicture(p, false)} data-testid="pp-retry">Retry</button>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'tagged' && (
        <>
          {media === null && <p className="pl-quiet">Loading…</p>}
          {media === false && <p className="pl-error" role="alert">Their tagged photos could not be read.</p>}
          {media && media.tagged.length === 0 && <p className="pl-quiet" data-testid="pp-no-tagged">Nobody has posted a photo with them in it yet.</p>}
          {media && media.tagged.length > 0 && (
            <ul className="pp-grid">
              {media.tagged.map((t) => (
                <li key={t.asset_id} className="pp-tile" data-testid="pp-tagged">
                  <img src={t.url} alt={t.caption || ''} />
                  {t.poster_handle && <span className="pp-tile-by">@{clean(t.poster_handle)}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'highlights' && (
        <>
          {media === null && <p className="pl-quiet">Loading…</p>}
          {media === false && <p className="pl-error" role="alert">Their highlights could not be read.</p>}
          {media && media.highlights.length === 0 && <p className="pl-quiet" data-testid="pp-no-highlights">No highlights yet.</p>}
          {media && media.highlights.length > 0 && (
            <ul className="pp-highlights">
              {media.highlights.map((h) => (
                <li key={h.key}>
                  <button type="button" className={album === h.key ? 'pp-highlight on' : 'pp-highlight'} onClick={() => setAlbum(album === h.key ? null : h.key)}
                    aria-pressed={album === h.key} data-testid="pp-highlight">
                    <span className="pp-highlight-ring">{h.cover ? <img src={h.cover} alt="" /> : null}</span>
                    <span className="pp-highlight-label">{h.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {media && album && (
            <ul className="pp-grid" data-testid="pp-highlight-photos">
              {(media.highlights.find((h) => h.key === album)?.photos || []).map((ph) => (
                <li key={ph.asset_id} className="pp-tile"><img src={ph.url} alt={ph.caption || ''} /></li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
