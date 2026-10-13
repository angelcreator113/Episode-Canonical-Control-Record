import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar, Camera, Clapperboard, Compass, Home, ImagePlus, Inbox, MapPin, MessageCircle,
  PlusSquare, Search, Sparkles, User, Users, X,
} from 'lucide-react';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import { loadCities, loadPulseCities } from '../lib/pulseCities';
import PulsePost, { Avatar, cityName } from '../components/Pulse/PulsePost';
import PulseStories, { recentPosters } from '../components/Pulse/PulseStories';
import PulseCity from '../components/Pulse/PulseCity';
import PulseMessages from '../components/Pulse/PulseMessages';
import { CitiesCard, CityStrip, TrendingCard, UpcomingCard, UpcomingRow, LatestFitCard, UPLOADS } from '../components/Pulse/PulseSides';
import { RevealChip } from '../components/Pulse/PulseReveal';
import { revealKey, loadRevealLabels } from '../lib/pulseReveals';
import { storyLabel } from '../lib/storyClock';
import { RELATIONSHIP_POST_TYPE, STATUSES, relationshipText, latestStatus } from '../lib/feedRelationship';
import { posterOf } from '../lib/pulsePosts';
import './SocialMediaPage.css';

// Moved to lib/pulsePosts and components/Admin/PulseReviewPost (Task 2925);
// re-exported for existing callers.
export { posterOf, whenLabel } from '../lib/pulsePosts';
export { cityName, PulsePost };
export { Reactions, BeatPicker, PostCard } from '../components/Admin/PulseReviewPost';

/**
 * The Pulse (docs/design/2026-10-the-pulse.md §2, §3; Task 2926): LalaVerse's
 * social network, what Lala sees and what the audience sees. Nothing behind
 * the curtain appears here (§1, §2 rule 5): drafts, releases, reactions
 * moderation, beats, episode links and story labels are in Admin › The
 * Pulse › Review (Task 2925).
 *
 * The frame follows Evoni's mockup: a header with the cover, "The Pulse" and
 * Lala's avatar and followers; navigation on the left; the feed in the
 * middle; upcoming events and people on the right. On a phone: one column
 * and a bottom bar (Home, Explore, Create, Inbox, Profile).
 *
 * Admins see a Director toggle. Director view shows each empty image spot as
 * a dashed "+ Add" that opens Admin › The Pulse › Uploads, and the links into
 * the studio; Lala's view leaves empty spots out (§2 rule 4).
 *
 * Views (?tab=): posts (Feed, default), events, people (Characters), profile,
 * messages (Lala's DMs at the story moment, Task 2985), cities (Dream
 * Cities; ?city=<key> opens one city's feed and local trends, Task 2987).
 * The old ?layer= and ?profile= links open Characters, as they always did.
 */

/** World Studio's Feed tab, where Feed profiles are made, on the LalaVerse; at one profile when given. */
export const profileHome = (p) => `/world-studio?tab=feed&layer=lalaverse${p?.id ? `&profile=${p.id}` : ''}`;
export const TABS = [
  { key: 'posts', label: 'Feed' },
  { key: 'events', label: 'Events' },
  { key: 'people', label: 'Characters' },
  { key: 'profile', label: 'Profile' },
  { key: 'messages', label: 'Messages' },
  { key: 'cities', label: 'Dream Cities' },
];
const PAGE = 50;

/** A ?at= story order (Task 2941): a non-negative whole number, else null. */
export function storyOrderParam(value) {
  return typeof value === 'string' && /^\d{1,6}$/.test(value) ? Number(value) : null;
}

const withoutAt = (params) => {
  const next = new URLSearchParams(params);
  next.delete('at');
  const s = next.toString();
  return s ? `?${s}` : '';
};

export function tabFromParams(params) {
  const tab = params.get('tab');
  if (tab && TABS.some((t) => t.key === tab)) return tab;
  if (params.get('layer') || params.get('profile')) return 'people';
  return 'posts';
}

/** A spot Director view shows as "+ Add …" (opening Uploads) and Lala's view leaves out. */
function AddSpot({ director, label, className = '' }) {
  if (!director) return null;
  return (
    <Link className={`pl-add-spot ${className}`} to={UPLOADS}>
      <ImagePlus size={18} aria-hidden="true" /> + Add {label}
    </Link>
  );
}

function PulseHeader({ cover, lala, search, onSearch, director, showSearch, coverLabel }) {
  const owner = lala?.profile || null;
  const name = owner?.display_name || 'Lala';
  return (
    <header className="pl-header" data-testid="pl-header">
      {cover?.url
        ? <img className="pl-cover" src={cover.url} alt={cover.teaser ? '' : (cover.alt || '')} data-testid="pl-cover" data-first-look={cover.teaser ? (cover.teaser_style || 'crop') : undefined} />
        : <div className="pl-cover pl-cover-empty" aria-hidden="true" />}
      {cover?.teaser && <span className="pl-first-look-label pl-cover-first-look" data-testid="pl-cover-first-look">First look</span>}
      {director && coverLabel && <span className="pl-cover-chip"><RevealChip label={coverLabel} /></span>}
      <div className="pl-header-inner">
        <p className="pl-wordmark"><span>LaLaVerse</span><small>Social</small></p>
        <div className="pl-title">
          <h1><span className="pl-title-the">The</span> Pulse</h1>
          <p className="pl-tagline">Every city has a story.</p>
        </div>
        <div className="pl-header-side">
          {showSearch && (
            <label className="pl-search">
              <Search size={16} aria-hidden="true" />
              <span className="pl-sr">Search posts</span>
              <input type="search" placeholder="Search The Pulse" value={search} onChange={(e) => onSearch(e.target.value)} />
            </label>
          )}
          <p className="pl-me">
            <Avatar name={name} url={lala?.portrait_url} size={36} />
            {owner?.follower_count_approx && <span className="pl-followers" data-testid="pl-followers">{owner.follower_count_approx} followers</span>}
          </p>
        </div>
      </div>
      {!cover?.url && <AddSpot director={director} label="cover" className="pl-add-cover" />}
    </header>
  );
}

const NAV = [
  { key: 'posts', label: 'Feed', Icon: Home },
  { key: 'cities', label: 'Dream Cities', Icon: MapPin },
  { key: 'events', label: 'Events', Icon: Calendar },
  { key: 'stories', label: 'Stories', Icon: Sparkles },
  { key: 'people', label: 'Characters', Icon: Users },
  { key: 'messages', label: 'Messages', Icon: MessageCircle },
];
const EXPLORE = ['Trending', 'Fashion', 'Beauty', 'Music', 'Lifestyle', 'Creator Hub'];
const LIVE = new Set(TABS.map((t) => t.key));

function LeftNav({ tab, onTab }) {
  return (
    <nav className="pl-nav" aria-label="The Pulse">
      <ul>
        {NAV.map(({ key, label, Icon }) => (
          <li key={key}>
            {LIVE.has(key) ? (
              <button type="button" className={tab === key ? 'pl-nav-item active' : 'pl-nav-item'} aria-current={tab === key ? 'page' : undefined} onClick={() => onTab(key)}>
                <Icon size={18} aria-hidden="true" /> {label}
              </button>
            ) : (
              <span className="pl-nav-item quiet" aria-disabled="true" title="Coming to The Pulse"><Icon size={18} aria-hidden="true" /> {label}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="pl-nav-label">Explore</p>
      <ul className="pl-explore">
        {EXPLORE.map((label) => <li key={label}><span aria-disabled="true" title="Coming to The Pulse">{label}</span></li>)}
      </ul>
    </nav>
  );
}

function Composer({ show, lala, director, onShared }) {
  const owner = lala?.profile || null;
  const ownerName = owner?.display_name || owner?.creator_name || 'Lala';
  const ownerHandle = owner?.handle || 'lala';
  const [text, setText] = useState('');
  const [kind, setKind] = useState('update');
  const [friendId, setFriendId] = useState('');
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (kind !== 'friends' || people.length) return;
    api.get('/api/v1/social-profiles?feed_layer=lalaverse&limit=100')
      .then((r) => setPeople((r.data?.profiles || []).filter((p) => !p.is_justawoman_record && p.handle !== ownerHandle)))
      .catch((err) => console.error('[ThePulse] people could not be read:', err.response?.status || err.message));
  }, [kind, people.length, ownerHandle]);

  const friend = people.find((p) => String(p.id) === String(friendId));
  const composed = kind === 'update' ? text.trim()
    : kind === 'status' ? relationshipText({ kind: 'status', status: text })
      : relationshipText({ kind: 'friends', withName: friend ? (friend.display_name || friend.handle) : '' });

  const share = async () => {
    if (!composed || !show?.id) return;
    setBusy(true); setError(null); setNote(null);
    try {
      // Lala's posts always wait for Evoni (spec §7): a draft with the
      // current story time, released from Admin › The Pulse › Review.
      await api.post('/api/v1/feed-posts', {
        show_id: show.id, content_text: composed, poster_handle: ownerHandle,
        poster_display_name: ownerName, social_profile_id: owner?.id || null, poster_platform: 'lalaverse',
        status: 'draft',
        ...(kind === 'update' ? {} : { post_type: RELATIONSHIP_POST_TYPE }),
      });
      setText(''); setFriendId(''); setKind('update');
      setNote(director ? 'Saved as a draft in Admin › The Pulse › Review.' : 'Sent.');
      onShared?.();
    } catch (err) {
      console.error('[ThePulse] share failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'That could not be sent.');
    } finally { setBusy(false); }
  };

  return (
    <form className="pl-composer" id="pl-composer" onSubmit={(e) => { e.preventDefault(); share(); }}>
      <Avatar name={ownerName} url={lala?.portrait_url} size={38} />
      <div className="pl-composer-body">
        {kind === 'friends' ? (
          <select aria-label="Now friends with" value={friendId} onChange={(e) => setFriendId(e.target.value)}>
            <option value="">Now friends with…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.handle}</option>)}
          </select>
        ) : (
          <textarea aria-label={kind === 'status' ? 'Relationship status' : "What's happening in LaLaVerse?"}
            placeholder={kind === 'status' ? "It's complicated" : "What's happening in LaLaVerse?"}
            rows={kind === 'status' ? 1 : 2} value={text} onChange={(e) => setText(e.target.value)} />
        )}
        {kind === 'status' && (
          <p className="pl-chips">{STATUSES.map((s) => <button key={s} type="button" className="pl-chip" onClick={() => setText(s)}>{s}</button>)}</p>
        )}
        <div className="pl-composer-row">
          <span className="pl-quiet-tools">
            <span aria-disabled="true" title="Photos are coming to The Pulse"><Camera size={16} aria-hidden="true" /> Photo</span>
            <span aria-disabled="true" title="Places are coming to The Pulse"><MapPin size={16} aria-hidden="true" /> Location</span>
          </span>
          <span className="pl-kinds" role="group" aria-label="What to share">
            <label><input type="radio" name="pl-kind" checked={kind === 'update'} onChange={() => setKind('update')} /> Post</label>
            <label><input type="radio" name="pl-kind" checked={kind === 'status'} onChange={() => setKind('status')} /> Relationship</label>
            <label><input type="radio" name="pl-kind" checked={kind === 'friends'} onChange={() => setKind('friends')} /> Friends</label>
          </span>
          <button type="submit" className="pl-button" disabled={busy || !composed}>{busy ? 'Sending…' : 'Share'}</button>
        </div>
        {note && <p className="pl-note" role="status">{note}</p>}
        {error && <p className="pl-error" role="alert">{error}</p>}
      </div>
    </form>
  );
}

function Feed({ show, lala, director, search, cities, labels, cityStates, viewAt, onCity }) {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [person, setPerson] = useState(null); // { handle, name } the feed is filtered to

  const load = useCallback(async (offset = 0) => {
    if (!show?.id) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ show_id: show.id, status: 'live', with: 'comments', limit: String(PAGE), offset: String(offset) });
      if (viewAt) qs.set('at', viewAt);
      const r = await api.get(`/api/v1/feed-posts?${qs}`);
      const page = r.data?.data || [];
      setPosts((prev) => (offset === 0 ? page : [...prev, ...page]));
      setHasMore(Boolean(r.data?.hasMore));
    } catch (err) {
      console.error('[ThePulse] posts could not be read:', err.response?.status || err.message);
      setError('The Pulse could not be loaded.');
    } finally { setLoading(false); }
  }, [show?.id, viewAt]);
  useEffect(() => { load(0); }, [load]);

  const owner = lala?.profile || null;
  const lalaHandle = owner?.handle || 'lala';
  const people = useMemo(() => recentPosters(posts, { lalaHandle }), [posts, lalaHandle]);
  const lalaStory = { handle: lalaHandle, name: owner?.display_name || 'Lala', photo: lala?.portrait_url || null, city: lala?.home_city || null };
  const pick = (handle, name) => setPerson((cur) => (cur?.handle === handle ? null : { handle, name }));

  const q = search.trim().toLowerCase();
  const byPerson = person ? posts.filter((p) => (p.poster_handle || p.socialProfile?.handle) === person.handle) : posts;
  const visible = q
    ? byPerson.filter((p) => (p.content_text || '').toLowerCase().includes(q) || posterOf(p).name.toLowerCase().includes(q) || posterOf(p).handle.toLowerCase().includes(q))
    : byPerson;

  return (
    <>
      <PulseStories lala={lalaStory} people={people} cities={cities} active={person?.handle} onPerson={pick} cityStates={cityStates} onCity={onCity} />
      <CityStrip cities={cities} onCity={onCity} />
      <Composer show={show} lala={lala} director={director} />
      {person && (
        <p className="pl-filter" data-testid="pl-filter">
          Showing {person.name}
          <button type="button" aria-label={`Show everyone, not only ${person.name}`} onClick={() => setPerson(null)}><X size={14} aria-hidden="true" /></button>
        </p>
      )}
      {error && <p className="pl-error" role="alert">{error}</p>}
      {loading && posts.length === 0 && <p className="pl-quiet">Loading…</p>}
      {!loading && !error && posts.length === 0 && <p className="pl-empty" data-testid="pl-empty">Nothing posted yet.</p>}
      {!loading && posts.length > 0 && visible.length === 0 && (
        <p className="pl-empty">{q ? `No posts match “${search.trim()}”.` : `Nothing from ${person?.name} yet.`}</p>
      )}
      {visible.map((p) => (
        <PulsePost key={p.id} post={p}
          revealLabel={director ? (labels?.get(revealKey('post', p.id)) || labels?.get(revealKey('image', p.id, 'post_photo'))) : null} />
      ))}
      {hasMore && !loading && <button type="button" className="pl-button pl-more" onClick={() => load(posts.length)}>Older posts</button>}
    </>
  );
}

function EventsView({ events }) {
  return (
    <section className="pl-card" aria-labelledby="pl-events-heading" data-testid="pl-events">
      <h2 id="pl-events-heading" className="pl-card-title">Upcoming Events</h2>
      {events.length === 0 && <p className="pl-quiet">Nothing coming up.</p>}
      <ul className="pl-events">{events.map((e) => <UpcomingRow key={e.id} event={e} />)}</ul>
    </section>
  );
}

function CharactersView({ show, director, viewAt }) {
  const [friends, setFriends] = useState(null);
  useEffect(() => {
    if (!show?.id) return undefined;
    let cancelled = false;
    // Lala's view leaves out friends she has not met yet (Task 2939).
    api.get(`/api/v1/social-profiles/lala?show_id=${encodeURIComponent(show.id)}&friends=all${viewAt ? `&at=${viewAt}` : ''}`)
      .then((res) => { if (!cancelled) setFriends(res?.data?.data?.friends || false); })
      .catch((err) => { console.error('[ThePulse] friends could not be read:', err.response?.status || err.message); if (!cancelled) setFriends(false); });
    return () => { cancelled = true; };
  }, [show?.id, viewAt]);

  return (
    <section className="pl-card" aria-labelledby="pl-people-heading" data-testid="pl-people">
      <div className="pl-card-head">
        <h2 id="pl-people-heading" className="pl-card-title">Lala's friends{friends ? ` (${friends.total})` : ''}</h2>
        {director && <Link className="pl-studio-link" to={profileHome()} data-testid="pl-add-people">Add people in World Studio</Link>}
      </div>
      {friends === null && <p className="pl-quiet">Loading…</p>}
      {friends === false && <p className="pl-error" role="alert">Friends could not be read.</p>}
      {friends && friends.total === 0 && <p className="pl-quiet" data-testid="pl-friends-empty">No friends yet.</p>}
      {friends && friends.total > 0 && (
        <ul className="pl-people">
          {friends.list.map((p) => (
            <li key={p.id} className="pl-person" data-testid="pl-friend">
              <Avatar name={p.display_name || p.handle} size={40} />
              <span><b>{p.display_name || p.handle}</b>{p.handle && <small className="pl-meta">@{String(p.handle).replace(/^@/, '')}</small>}</span>
              {director && <Link className="pl-studio-link" to={profileHome(p)}>Open profile</Link>}
            </li>
          ))}
        </ul>
      )}
      {friends && friends.total > friends.list.length && <p className="pl-quiet">Showing {friends.list.length} of {friends.total}.</p>}
    </section>
  );
}

function ProfileView({ lala, relationship, director }) {
  const owner = lala?.profile || null;
  const name = owner?.display_name || 'Lala';
  const friends = lala?.friends;
  return (
    <section className="pl-card" aria-labelledby="pl-profile-heading" data-testid="pl-profile">
      <div className="pl-profile-head">
        <Avatar name={name} url={lala?.portrait_url} size={88} />
        <div>
          <h2 id="pl-profile-heading" className="pl-card-title">{name}</h2>
          {owner?.handle && <p className="pl-meta">@{String(owner.handle).replace(/^@/, '')}</p>}
        </div>
      </div>
      <dl className="pl-facts">
        {lala?.home_city && <><dt>Lives in</dt><dd data-testid="pl-city">{lala.home_city}</dd></>}
        {relationship && <><dt>Relationship</dt><dd data-testid="pl-rel-status">{relationship}</dd></>}
        {lala?.career && <><dt>Career</dt><dd data-testid="pl-career">{lala.career.label}</dd></>}
        {owner?.follower_count_approx && <><dt>Followers</dt><dd>{owner.follower_count_approx}</dd></>}
      </dl>
      {friends && friends.total > 0 && (
        <>
          <p className="pl-nav-label">Friends · {friends.total}</p>
          <ul className="pl-friend-grid">
            {friends.list.map((p) => <li key={p.id} data-testid="pl-profile-friend"><Avatar name={p.display_name || p.handle} size={44} /><span>{p.display_name || p.handle}</span></li>)}
          </ul>
        </>
      )}
      {director && <Link className="pl-studio-link" to={profileHome(owner)}>Edit Lala's profile in World Studio</Link>}
    </section>
  );
}

function RightColumn({ cities, trending, events, mayKnow, director, labels, cityStates, onCity }) {
  return (
    <>
      <CitiesCard cities={cities} director={director} states={cityStates} labels={labels} onCity={onCity} />
      <TrendingCard topics={trending} director={director} />
      <UpcomingCard events={events} labels={director ? labels : null} />
      {mayKnow.length > 0 && (
        <section className="pl-card" aria-labelledby="pl-may-know-heading" data-testid="pl-may-know">
          <h2 id="pl-may-know-heading" className="pl-card-title">People you may know</h2>
          <ul className="pl-people">
            {mayKnow.map((p) => <li key={p.id} className="pl-person" data-testid="pl-may-know-person"><Avatar name={p.display_name || p.handle} size={36} /><b>{p.display_name || p.handle}</b></li>)}
          </ul>
        </section>
      )}
    </>
  );
}

function BottomNav({ tab, onTab, onCreate }) {
  const item = (key, label, Icon, onClick, disabled = false) => (
    <button type="button" className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined}
      onClick={onClick} disabled={disabled} title={disabled ? 'Coming to The Pulse' : undefined}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </button>
  );
  return (
    <nav className="pl-bottom" aria-label="The Pulse on a phone">
      {item('posts', 'Home', Home, () => onTab('posts'))}
      {item('events', 'Explore', Compass, () => onTab('events'))}
      {item('create', 'Create', PlusSquare, onCreate)}
      {item('messages', 'Inbox', Inbox, () => onTab('messages'))}
      {item('profile', 'Profile', User, () => onTab('profile'))}
    </nav>
  );
}

export default function SocialMediaPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParams(params);
  const { show, loaded } = useActiveShow();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [directorOn, setDirectorOn] = useState(false);
  const director = admin && directorOn;
  // The story moment Lala's view reads at (Task 2941): the present, or for an
  // admin a ?at= order from Admin › The Pulse › Story clock. Director view
  // reads everything live (null).
  const atOverride = admin ? storyOrderParam(params.get('at')) : null;
  const viewAt = director ? null : (atOverride === null ? 'present' : String(atOverride));
  const [search, setSearch] = useState('');
  const [cover, setCover] = useState(null);
  const [lala, setLala] = useState(null);
  const [events, setEvents] = useState([]);
  const [mayKnow, setMayKnow] = useState([]);
  const [cities, setCities] = useState([]);
  const [trending, setTrending] = useState([]);
  const [fit, setFit] = useState(null);
  const [labels, setLabels] = useState(null); // Director view: each item's reveal label
  const [cityStates, setCityStates] = useState({}); // Lala's view: the cities' image states
  const [relPosts, setRelPosts] = useState([]);
  const createRequest = useRef(false);

  const switchTab = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', key);
    next.delete('layer');
    next.delete('profile');
    next.delete('city');
    return next;
  });
  // A Dream City's feed (Task 2987): ?tab=cities&city=<key>; null goes back to the list.
  const openCity = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', 'cities');
    next.delete('layer');
    next.delete('profile');
    if (key) next.set('city', key); else next.delete('city');
    return next;
  });

  useEffect(() => {
    if (!show?.id) return;
    const id = encodeURIComponent(show.id);
    // Lala's view is The Pulse as of the present in story time (Task 2937);
    // Director view reads everything live.
    const atParam = viewAt ? `&at=${viewAt}` : '';
    const safe = async (p, label) => {
      try { return await p; } catch (err) { console.error(`[ThePulse] ${label} could not be read:`, err.response?.status || err.message); return null; }
    };
    let alive = true;
    (async () => {
      const [c, who, side, rel, trend, latest] = await Promise.all([
        safe(api.get(`/api/v1/shows/${show.id}/pulse-cover${viewAt ? `?at=${viewAt}` : ''}`), 'cover'),
        safe(api.get(`/api/v1/social-profiles/lala?show_id=${id}${atParam}`), "Lala's profile"),
        safe(api.get(`/api/v1/social-profiles/lala/sidebar?show_id=${id}${atParam}`), 'events'),
        safe(api.get(`/api/v1/feed-posts?show_id=${id}&post_type=relationship&status=live&limit=50${atParam}`), 'relationship posts'),
        // Trends as of the same story moment as the feed (Task 2987).
        safe(api.get(`/api/v1/feed-enhanced/${id}/trending${viewAt ? `?at=${viewAt}` : ''}`), 'trending'),
        safe(api.get(`/api/v1/pulse-fits/latest?show_id=${id}${atParam}`), 'latest fit'),
      ]);
      if (!alive) return;
      setCover(c?.data?.cover || null);
      setLala(who?.data?.data || false);
      setEvents(Array.isArray(side?.data?.data?.upcoming) ? side.data.data.upcoming : []);
      setMayKnow(Array.isArray(side?.data?.data?.may_know) ? side.data.data.may_know : []);
      setRelPosts(rel?.data?.data || []);
      setTrending(Array.isArray(trend?.data?.data) ? trend.data.data : []);
      setFit(latest?.data?.latest || null);
    })();
    return () => { alive = false; };
  }, [show?.id, viewAt]);

  // The Dream Cities. Lala's view reads them as she sees them at the moment
  // (Task 3041): a first look's image is its teaser, so the full one never
  // reaches the page early. Director view reads the saved list as it is.
  useEffect(() => {
    if (!director && !show?.id) return undefined;   // Lala's view waits for the show
    let alive = true;
    setCityStates({});
    const read = director
      ? loadCities().then((list) => { if (alive) setCities((list || []).filter((c) => c?.key)); })
      : loadPulseCities(show.id, viewAt).then((r) => { if (alive) { setCities(r.cities); setCityStates(r.states); } });
    read.catch((err) => console.error('[ThePulse] the Dream Cities could not be read:', err.response?.status || err.message));
    return () => { alive = false; };
  }, [show?.id, director, viewAt]);

  // Reveals (Task 2939): Director view reads each item's reveal label for its
  // chip (Lala's view gets everything applied by the server in each read,
  // the cities included).
  useEffect(() => {
    if (!show?.id || !director) return undefined;
    let alive = true;
    setLabels(null);
    loadRevealLabels(show.id).then((m) => { if (alive) setLabels(m); })
      .catch((err) => console.error('[ThePulse] reveals could not be read:', err.response?.status || err.message));
    return () => { alive = false; };
  }, [show?.id, director]);

  useEffect(() => {
    if (tab === 'posts' && createRequest.current) {
      createRequest.current = false;
      document.getElementById('pl-composer')?.querySelector('textarea, select')?.focus();
    }
  }, [tab]);
  const onCreate = () => {
    if (tab === 'posts') document.getElementById('pl-composer')?.querySelector('textarea, select')?.focus();
    else { createRequest.current = true; switchTab('posts'); }
  };

  const owner = lala?.profile || null;
  const relationship = useMemo(() => latestStatus(relPosts, owner?.handle || 'lala') || owner?.relationship_status || null, [relPosts, owner]);

  return (
    <div className={director ? 'pl-page pl-director' : 'pl-page'} data-testid="pl-page">
      <PulseHeader cover={cover} lala={lala} search={search} onSearch={setSearch} director={director} showSearch={tab === 'posts'}
        coverLabel={labels?.get(revealKey('image', show?.id, 'cover'))} />
      {admin && (
        <div className="pl-toggle-bar">
          <button type="button" className={director ? 'pl-toggle on' : 'pl-toggle'} aria-pressed={director} onClick={() => setDirectorOn((v) => !v)} data-testid="pl-director-toggle">
            <Clapperboard size={16} aria-hidden="true" />
            {director ? 'Director view: empty spots shown' : "Lala's screen (what the audience sees)"}
          </button>
        </div>
      )}
      {!director && atOverride !== null && (
        <p className="pl-at-banner" role="status" data-testid="pl-at-banner">
          The Pulse as of {storyLabel(atOverride) || `story moment ${atOverride}`}
          {' '}<Link to={{ search: withoutAt(params) }}>Back to now</Link>
        </p>
      )}
      {loaded && !show ? (
        <p className="pl-empty pl-no-show" data-testid="pl-no-show">Nothing here yet.</p>
      ) : (
        <div className="pl-grid">
          <aside className="pl-left"><LeftNav tab={tab} onTab={switchTab} /><LatestFitCard fit={fit} director={director} revealLabel={fit?.source === 'fit' && fit.id ? labels?.get(revealKey('image', fit.id, 'fit')) : null} /></aside>
          <main className="pl-center">
            {tab === 'posts' && <Feed show={show} lala={lala} director={director} search={search} cities={cities} labels={labels} cityStates={cityStates} viewAt={viewAt} onCity={openCity} />}
            {tab === 'cities' && <PulseCity show={show} cities={cities} cityKey={params.get('city')} viewAt={viewAt} onCity={openCity} />}
            {tab === 'events' && <EventsView events={events} />}
            {tab === 'people' && <CharactersView show={show} director={director} viewAt={viewAt} />}
            {tab === 'profile' && <ProfileView lala={lala} relationship={relationship} director={director} />}
            {tab === 'messages' && <PulseMessages show={show} lala={lala} viewAt={viewAt} />}
          </main>
          <aside className="pl-right"><RightColumn cities={cities} trending={trending} events={events} mayKnow={mayKnow} director={director} labels={labels} cityStates={cityStates} onCity={openCity} /></aside>
        </div>
      )}
      <BottomNav tab={tab} onTab={switchTab} onCreate={onCreate} />
    </div>
  );
}
