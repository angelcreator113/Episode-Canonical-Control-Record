import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { RELATIONSHIP_POST_TYPE, STATUSES, relationshipText, latestStatus } from '../lib/feedRelationship';
import { posterOf, whenLabel, initial, toneOf } from '../lib/pulsePosts';
import { PostCard, RequestPost } from '../components/Admin/PulseReviewPost';
import './SocialMediaPage.css';

// Moved to lib/pulsePosts and components/Admin/PulseReviewPost (Task 2925);
// re-exported for the page's existing callers and tests.
export { posterOf, whenLabel } from '../lib/pulsePosts';
export { Reactions, BeatPicker, PostCard } from '../components/Admin/PulseReviewPost';

/**
 * Social Media (the Feed project; redesigned 2026-10-04 to Evoni's mock:
 * a 2009 profile-and-wall, "lalaverse" on a purple banner). Posts is
 * Lala's wall: her profile on the left, the wall in the middle (status,
 * "What's on your mind?", the live posts with their comments), requests,
 * upcoming events and people she may know on the right. Friends lists
 * Lala's friends; profiles are made in one place, World Studio's Feed tab
 * (2026-10-11), which every profile link here opens. The Episode's own
 * Lala's Phone tab is untouched.
 *
 * Deep links: ?tab=posts|people; the old ?layer= and ?profile= links
 * (with no ?tab=) open Friends, as they always did.
 */

/** World Studio's Feed tab, where Feed profiles are made, on the LalaVerse; at one profile when given. */
export const profileHome = (p) => `/world-studio?tab=feed&layer=lalaverse${p?.id ? `&profile=${p.id}` : ''}`;
export const TABS = [
  { key: 'posts', label: 'Home' },
  { key: 'people', label: 'Friends' },
];
/**
 * An event's day and time as the event has them (2026-10-11): "Thu, Nov 12 ·
 * 6:30 PM". A date stored as YYYY-MM-DD reads as a day; any other text is
 * shown as typed. Nothing when the event has neither.
 */
export function eventWhen(date, time) {
  const t = typeof time === 'string' && time.trim() ? time.trim() : null;
  let d = typeof date === 'string' && date.trim() ? date.trim() : null;
  const m = d && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!Number.isNaN(day.getTime())) d = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return [d, t].filter(Boolean).join(' · ');
}
const WALL_TABS = [
  { key: 'wall', label: 'Wall' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'events', label: 'Events' },
  // Deleted posts are kept (soft delete) and shown here, to the signed-in author only (2026-10-11).
  { key: 'deleted', label: 'Deleted' },
];
const PAGE = 50;

export function tabFromParams(params) {
  const tab = params.get('tab');
  if (tab && TABS.some((t) => t.key === tab)) return tab;
  if (params.get('layer') || params.get('profile')) return 'people';
  return 'posts';
}

const Tile = ({ name, size = 'sm', tone = 'c' }) => <span className={`sm-tile sm-tile-${size} sm-tone-${tone}`} aria-hidden="true">{initial(name)}</span>;

function Box({ title, action, children, testId }) {
  return (
    <section className="sm-box" data-testid={testId}>
      <h3 className="sm-box-title">{title}{action && <span className="sm-box-action">{action}</span>}</h3>
      {children}
    </section>
  );
}

function Wall({ show, showLoaded, search, tabRequest, onInbox }) {
  // Lala's profile column (2026-10-11): her profile, portrait, home city,
  // career level and friends, each from its owner (GET /social-profiles/lala;
  // docs/reads/2026-10-11-feed-wiring-read.md). null: not read yet; false: could not be.
  const [lala, setLala] = useState(null);
  const [relPosts, setRelPosts] = useState([]);
  // The LalaVerse's people, for the composer's friend picker and People You May Know.
  const [friends, setFriends] = useState({ list: [], total: 0 });
  const [events, setEvents] = useState([]);
  const [mayKnow, setMayKnow] = useState([]);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Lala's own drafts from the wall, and the posts an episode drafted, which
  // wait for approval in Requests (Evoni, 2026-10-11): counted apart.
  const [wallDrafts, setWallDrafts] = useState(0);
  const [toApprove, setToApprove] = useState({ list: [], total: 0 });
  const draftsTotal = wallDrafts + toApprove.total;
  const [pending, setPending] = useState([]);
  const [wallTab, setWallTab] = useState('wall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftText, setDraftText] = useState('');
  // What the composer shares: a status update, or a relationship change
  // (a post too, docs/FEED_POSTS.md rule 8).
  const [kind, setKind] = useState('update');
  const [friendId, setFriendId] = useState('');
  const [sharing, setSharing] = useState(false);

  const loadPosts = useCallback(async (offset = 0, status = wallTab === 'drafts' ? 'draft' : 'live') => {
    if (!show?.id) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ show_id: show.id, status, with: 'comments', limit: String(PAGE), offset: String(offset) });
      const r = wallTab === 'deleted'
        ? await api.get(`/api/v1/feed-posts/deleted?show_id=${encodeURIComponent(show.id)}&limit=200`)
        : await api.get(`/api/v1/feed-posts?${qs}`);
      const page = r.data?.data || [];
      setPosts((prev) => (offset === 0 ? page : [...prev, ...page]));
      setTotal(r.data?.total ?? page.length);
      setHasMore(Boolean(r.data?.hasMore));
    } catch (err) {
      console.error('[SocialMedia] posts load failed:', err.response?.status || err.message);
      setError(err.response?.data?.error || 'The wall could not be loaded.');
    } finally { setLoading(false); }
  }, [show?.id, wallTab]);

  const loadSides = useCallback(async () => {
    if (!show?.id) return;
    const safe = async (p, fallback) => { try { return await p; } catch (err) { console.error('[SocialMedia] side load failed:', err.response?.status || err.message); return fallback; } };
    const [who, ppl, ev, drafts, pend, rel, epDrafts] = await Promise.all([
      safe(api.get(`/api/v1/social-profiles/lala?show_id=${encodeURIComponent(show.id)}`), null),
      safe(api.get('/api/v1/social-profiles?feed_layer=lalaverse&limit=12'), null),
      // The events she is going to and the guests she may know (2026-10-11).
      safe(api.get(`/api/v1/social-profiles/lala/sidebar?show_id=${encodeURIComponent(show.id)}`), null),
      safe(api.get(`/api/v1/feed-posts?show_id=${show.id}&status=draft&from=wall&limit=1`), null),
      safe(api.get(`/api/v1/feed-posts/comments/pending?show_id=${show.id}`), null),
      // Her relationship posts (docs/FEED_POSTS.md rule 8), not only the wall's first page.
      safe(api.get(`/api/v1/feed-posts?show_id=${show.id}&post_type=relationship&status=live&limit=50`), null),
      safe(api.get(`/api/v1/feed-posts?show_id=${show.id}&status=draft&from=episode&with=comments&limit=20`), null),
    ]);
    setLala(who?.data?.data || false);
    setRelPosts(rel?.data?.data || []);
    const list = (ppl?.data?.profiles || []).filter((p) => !p.is_justawoman_record);
    setFriends({ list, total: ppl?.data?.pagination?.total ?? ppl?.data?.total ?? list.length });
    setEvents(Array.isArray(ev?.data?.data?.upcoming) ? ev.data.data.upcoming : []);
    setMayKnow(Array.isArray(ev?.data?.data?.may_know) ? ev.data.data.may_know : []);
    setWallDrafts(drafts?.data?.total ?? 0);
    const epList = Array.isArray(epDrafts?.data?.data) ? epDrafts.data.data : [];
    setToApprove({ list: epList, total: epDrafts?.data?.total ?? epList.length });
    setPending(pend?.data?.data || []);
  }, [show?.id]);

  useEffect(() => { loadPosts(0); }, [loadPosts]);
  useEffect(() => { loadSides(); }, [loadSides]);
  useEffect(() => { if (tabRequest?.tab) setWallTab(tabRequest.tab); }, [tabRequest]);
  useEffect(() => { onInbox?.(draftsTotal + pending.length); }, [draftsTotal, pending.length, onInbox]);

  const owner = lala?.profile || null;
  const ownerName = owner?.display_name || owner?.creator_name || 'Lala';
  const ownerHandle = owner?.handle || 'lala';
  const status = useMemo(() => posts.find((p) => wallTab === 'wall' && (p.poster_handle || p.socialProfile?.handle) === ownerHandle) || null, [posts, ownerHandle, wallTab]);

  const friendPicked = friends.list.find((p) => String(p.id) === String(friendId));
  const composed = kind === 'update' ? draftText.trim()
    : kind === 'status' ? relationshipText({ kind: 'status', status: draftText })
      : relationshipText({ kind: 'friends', withName: friendPicked ? (friendPicked.display_name || friendPicked.handle) : '' });
  const share = async () => {
    if (!composed || !show?.id) return;
    setSharing(true); setError(null);
    try {
      await api.post('/api/v1/feed-posts', {
        show_id: show.id, content_text: composed, poster_handle: ownerHandle,
        poster_display_name: ownerName, social_profile_id: owner?.id || null, poster_platform: 'lalaverse',
        // A draft with the current story time (2026-10-11); Release makes it live.
        status: 'draft',
        ...(kind === 'update' ? {} : { post_type: RELATIONSHIP_POST_TYPE }),
      });
      setDraftText(''); setFriendId(''); setKind('update');
      if (wallTab !== 'drafts') setWallTab('drafts'); else await loadPosts(0, 'draft');
      await loadSides();
    } catch (err) { setError(err.response?.data?.error || 'The post could not be shared.'); }
    finally { setSharing(false); }
  };

  if (showLoaded && !show) return <p className="sm-empty" data-testid="sm-no-show">Pick a show first. The wall belongs to a show.</p>;

  const q = search.trim().toLowerCase();
  const visible = q ? posts.filter((p) => (p.content_text || '').toLowerCase().includes(q) || posterOf(p).name.toLowerCase().includes(q) || posterOf(p).handle.toLowerCase().includes(q)) : posts;
  const relationship = latestStatus([...posts, ...relPosts], ownerHandle) || owner?.relationship_status || null;
  const peopleLink = profileHome;
  // Each event opens its Event Package.
  const eventLink = (e) => `/shows/${show?.id}/events/${e.id}`;

  return (
    <div className="sm-wall">
      <aside className="sm-left">
        {lala?.portrait_url
          ? <img className="sm-portrait" src={lala.portrait_url} alt={ownerName} data-testid="sm-portrait" />
          : <Tile name={ownerName} size="xl" tone="l" />}
        <Link className="sm-small-link" to={peopleLink(owner)}>Edit My Profile</Link>
        <Box title="Information" testId="sm-info">
          <dl className="sm-dl">
            {lala?.home_city && <><dt>Current City</dt><dd data-testid="sm-city">{lala.home_city}</dd></>}
            {relationship && <><dt>Relationship Status</dt><dd data-testid="sm-rel-status">{relationship}</dd></>}
            {lala?.career && <><dt>Career level</dt><dd data-testid="sm-career">{lala.career.label}</dd></>}
            {owner?.follower_count_approx && <><dt>Followers</dt><dd>{owner.follower_count_approx}</dd></>}
          </dl>
          {lala && !lala.home_city && !relationship && !lala.career && <p className="sm-muted">Nothing set yet. Her home city is in Show Settings.</p>}
        </Box>
        <Box title="Friends" action={<Link to="/pulse?tab=people">See all</Link>} testId="sm-friends">
          {lala?.friends ? (
            <>
              <p className="sm-muted" data-testid="sm-friends-count">{lala.friends.total} friend{lala.friends.total === 1 ? '' : 's'}</p>
              <div className="sm-friend-grid">
                {lala.friends.list.map((p) => (
                  <Link key={p.id} to={peopleLink(p)} className="sm-friend" data-testid="sm-friend"><Tile name={p.display_name || p.handle} size="lg" tone={toneOf(p.handle)} /><span>{p.display_name || p.handle}</span></Link>
                ))}
                {lala.friends.total === 0 && <p className="sm-muted">No friends yet. A friend is a LalaVerse profile whose link to Lala is Direct.</p>}
              </div>
            </>
          ) : <p className="sm-muted">{lala === null ? 'Loading…' : 'Friends could not be read.'}</p>}
        </Box>
      </aside>

      <main className="sm-center">
        <h1 className="sm-owner">{ownerName}</h1>
        <p className="sm-status" data-testid="sm-status">
          {status ? <>{status.content_text} <small>{whenLabel(status.posted_at)}</small></> : <em>has not posted yet.</em>}
        </p>
        <nav className="sm-wall-tabs" role="tablist" aria-label="Wall sections">
          {WALL_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={wallTab === t.key} className={wallTab === t.key ? 'active' : ''} onClick={() => setWallTab(t.key)}>
              {t.label}{t.key === 'drafts' && draftsTotal > 0 ? ` (${draftsTotal})` : ''}
            </button>
          ))}
        </nav>

        {wallTab !== 'events' && wallTab !== 'deleted' && (
          <form className="sm-composer" onSubmit={(e) => { e.preventDefault(); share(); }}>
            <label htmlFor="sm-composer-text" className="sm-composer-label">
              {kind === 'update' ? <>What&apos;s on your mind?</> : kind === 'status' ? 'Relationship status' : 'Now friends with'}
            </label>
            {kind === 'friends' ? (
              <select id="sm-composer-text" className="sm-composer-select" value={friendId} onChange={(e) => setFriendId(e.target.value)}>
                <option value="">Pick a friend…</option>
                {friends.list.filter((p) => p.handle !== ownerHandle).map((p) => <option key={p.id} value={p.id}>{p.display_name || p.handle}</option>)}
              </select>
            ) : (
              <>
                <textarea id="sm-composer-text" rows={kind === 'status' ? 1 : 2} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder={kind === 'status' ? "It's complicated" : ''} />
                {kind === 'status' && <p className="sm-muted">{STATUSES.map((s) => <button key={s} type="button" className="sm-mini sm-status-pick" onClick={() => setDraftText(s)}>{s}</button>)}</p>}
              </>
            )}
            <div className="sm-composer-row">
              <span className="sm-composer-kinds" role="group" aria-label="What to share">
                <label><input type="radio" name="sm-kind" checked={kind === 'update'} onChange={() => setKind('update')} /> Status</label>
                <label><input type="radio" name="sm-kind" checked={kind === 'status'} onChange={() => setKind('status')} /> Relationship</label>
                <label><input type="radio" name="sm-kind" checked={kind === 'friends'} onChange={() => setKind('friends')} /> Friends</label>
              </span>
              <span className="sm-muted">Saves as a draft. Release it when it&apos;s time.</span>
              <button type="submit" className="sm-btn" disabled={sharing || !composed}>{sharing ? 'Sharing…' : 'Share'}</button>
            </div>
          </form>
        )}

        {error && <p className="sm-error" role="alert">{error}</p>}
        <p className="sm-count" data-testid="sm-count">
          {loading && posts.length === 0 ? 'Loading the wall…' : wallTab === 'events' ? `${events.length} upcoming event${events.length === 1 ? '' : 's'}` : `${total} ${wallTab === 'drafts' ? 'draft' : wallTab === 'deleted' ? 'deleted post' : 'post'}${total === 1 ? '' : 's'}${show?.name ? ` · ${show.name}` : ''}`}
        </p>

        {wallTab === 'events' ? (
          <ul className="sm-events" data-testid="sm-events">
            {events.map((e) => <li key={e.id}><Link to={eventLink(e)}><b>{e.name}</b></Link><br /><span className="sm-muted">{[e.venue, eventWhen(e.date, e.time), e.episode?.number != null ? `Episode ${e.episode.number}` : null].filter(Boolean).join(' · ')}</span></li>)}
            {events.length === 0 && <li className="sm-muted">No upcoming events. An event shows here once one of Lala&apos;s episodes is made from it.</li>}
          </ul>
        ) : (
          <>
            {!loading && !error && posts.length === 0 && (
              <div className="sm-empty" data-testid="sm-empty">
                {wallTab === 'drafts'
                  ? <p>No drafts. A draft is a post shared here, or written inside an episode, that is not live yet. Release it when it&apos;s time.</p>
                  : wallTab === 'deleted'
                    ? <p>No deleted posts. A deleted post is kept here and can be restored.</p>
                    : <><p>Nothing on the wall yet.</p><p>Share something above, or generate posts from an episode. Each one is what a character said, once, with its likes and comments.</p></>}
              </div>
            )}
            {visible.map((p) => <PostCard key={p.id} post={p} showId={show?.id} onChange={() => { loadPosts(0); loadSides(); }} />)}
            {hasMore && !loading && <button type="button" className="sm-btn sm-more" onClick={() => loadPosts(posts.length)}>Older posts</button>}
          </>
        )}
      </main>

      <aside className="sm-right">
        <Box title="Requests" testId="sm-requests">
          <ul className="sm-plain">
            <li data-testid="sm-to-approve-count">{toApprove.total} post{toApprove.total === 1 ? '' : 's'} to approve</li>
            <li><button type="button" className="sm-link-btn" onClick={() => setWallTab('drafts')}>{wallDrafts} draft post{wallDrafts === 1 ? '' : 's'}</button></li>
            <li>{pending.length} reaction{pending.length === 1 ? '' : 's'} to approve</li>
          </ul>
          {toApprove.list.map((p) => <RequestPost key={p.id} post={p} onChange={() => { loadPosts(0); loadSides(); }} />)}
          {toApprove.total > toApprove.list.length && <p className="sm-muted">Showing {toApprove.list.length} of {toApprove.total}; the rest are under Drafts.</p>}
          {pending.slice(0, 3).map((c) => <p key={c.id} className="sm-muted sm-pending">@{c.handle}: “{c.text}”{c.post?.poster_handle ? ` on @${c.post.poster_handle}'s post` : ''}</p>)}
        </Box>
        <Box title="Upcoming Events" testId="sm-upcoming">
          {events.slice(0, 2).map((e) => (
            <p key={e.id} className="sm-event" data-testid="sm-upcoming-event">
              <Link to={eventLink(e)}><b>{e.name}</b></Link>
              {e.venue && <><br /><span className="sm-muted">{e.venue}</span></>}
              {eventWhen(e.date, e.time) && <><br /><span className="sm-muted">{eventWhen(e.date, e.time)}</span></>}
            </p>
          ))}
          {events.length === 0 && <p className="sm-muted">None planned.</p>}
        </Box>
        <Box title="People You May Know" testId="sm-may-know">
          {mayKnow.map((p) => <p key={p.id} className="sm-person" data-testid="sm-may-know-person"><Tile name={p.display_name || p.handle} tone={toneOf(p.handle)} /><span><b>{p.display_name || p.handle}</b><br /><Link to={peopleLink(p)}>See profile</Link></span></p>)}
          {mayKnow.length === 0 && (events.some((e) => e.guest_count > 0)
            ? <p className="sm-muted">Everyone here already knows Lala.</p>
            : <p className="sm-muted">No one to meet yet: her upcoming events have no guest lists.</p>)}
        </Box>
      </aside>
    </div>
  );
}

/**
 * The Friends tab (2026-10-11): Lala's friends only, the LalaVerse profiles
 * whose link to her is Direct (GET /social-profiles/lala?friends=all). Each
 * opens its profile where profiles are made; so does "Add people".
 */
function FriendsTab({ show, showLoaded }) {
  const [friends, setFriends] = useState(null);
  useEffect(() => {
    if (!show?.id) return undefined;
    let cancelled = false;
    api.get(`/api/v1/social-profiles/lala?show_id=${encodeURIComponent(show.id)}&friends=all`)
      .then((res) => { if (!cancelled) setFriends(res?.data?.data?.friends || false); })
      .catch((err) => { console.error('[SocialMedia] friends load failed:', err.response?.status || err.message); if (!cancelled) setFriends(false); });
    return () => { cancelled = true; };
  }, [show?.id]);

  if (showLoaded && !show) return <p className="sm-empty" data-testid="sm-no-show">Pick a show first. Friends belong to Lala&apos;s show.</p>;
  return (
    <section className="sm-friends-tab" data-testid="sm-friends-tab">
      <div className="sm-friends-head">
        <h2 className="sm-friends-title">Friends{friends ? ` (${friends.total})` : ''}</h2>
        <Link className="sm-btn" to={profileHome()} data-testid="sm-add-people">Add people</Link>
      </div>
      {friends === null && <p className="sm-muted">Loading friends…</p>}
      {friends === false && <p className="sm-error" role="alert">Friends could not be read.</p>}
      {friends && friends.total === 0 && (
        <div className="sm-empty" data-testid="sm-friends-empty">
          <p>Lala has no friends here yet.</p>
          <p>A friend is a LalaVerse profile whose link to Lala is Direct. Make or edit profiles in <Link to={profileHome()}>World Studio › Feed</Link>.</p>
        </div>
      )}
      {friends && friends.total > 0 && (
        <ul className="sm-friends-list">
          {friends.list.map((p) => (
            <li key={p.id}>
              <Link to={profileHome(p)} className="sm-friend-row" data-testid="sm-friends-row">
                <Tile name={p.display_name || p.handle} size="md" tone={toneOf(p.handle)} />
                <span><b>{p.display_name || p.handle}</b>{p.handle && <small>@{String(p.handle).replace(/^@/, '')}</small>}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {friends && friends.total > friends.list.length && <p className="sm-muted">Showing {friends.list.length} of {friends.total}.</p>}
    </section>
  );
}

export default function SocialMediaPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParams(params);
  const { show, loaded } = useActiveShow();
  const [search, setSearch] = useState('');
  const [inbox, setInbox] = useState(0);
  const [tabRequest, setTabRequest] = useState(null);

  const switchTab = (key) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', key); return next; });
  const openInbox = () => { if (tab !== 'posts') switchTab('posts'); setTabRequest({ tab: 'drafts', at: Date.now() }); };

  return (
    <div className="sm-page">
      <header className="sm-banner">
        <span className="sm-wordmark">lalaverse</span>
        <nav className="sm-nav" role="tablist" aria-label="The Pulse sections">
          <button type="button" role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => switchTab('posts')}>Home</button>
          <button type="button" role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => { switchTab('posts'); setTabRequest({ tab: 'wall', at: Date.now() }); }}>Profile</button>
          <button type="button" role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'active' : ''} onClick={() => switchTab('people')}>Friends</button>
          <button type="button" className="sm-inbox" onClick={openInbox} title="Draft posts and reactions waiting for approval">Inbox{inbox > 0 ? ` (${inbox})` : ''}</button>
        </nav>
        {tab === 'posts' && <input className="sm-search" type="search" aria-label="Search posts" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        <span className="sm-banner-right">The Pulse</span>
      </header>
      {tab === 'posts' && <Wall show={show} showLoaded={loaded} search={search} tabRequest={tabRequest} onInbox={setInbox} />}
      {tab === 'people' && <FriendsTab show={show} showLoaded={loaded} />}
      <footer className="sm-footer">
        lalaverse · one post, one place · <Link to={profileHome()}>People</Link>{show?.id && <> · <Link to={`/shows/${show.id}/feed-timeline`}>Timeline &amp; generation</Link></>}
      </footer>
    </div>
  );
}
