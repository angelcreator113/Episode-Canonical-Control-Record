/**
 * Gallery (Evoni, 2026-10-18: "we need a separate tab for the gallery now
 * this tab will get over crowded"): every picture already linked to the
 * character, grouped: portraits, places, wardrobe, events and posts.
 * Reads GET /api/v1/cast/characters/:id/gallery (services/characterGallery);
 * portraits are made on the Appearance tab and places linked on the Places &
 * Gallery tab. A picture opens larger on click.
 * Evoni, 2026-10-18: "maybe the gallery and places tab should be one": it
 * sits under their places there, with `hide` leaving out the places group
 * the place editor above already shows.
 * Visual Memory, phase 1 (2026-10-18): a "Tagged" group holds the shared
 * library's pictures tagged with them; an ADMIN (the read's `can_edit`) can
 * add a picture, tag it with whoever else is in it, and in the larger view
 * edit its tags, status and who may see it (GalleryLibrary).
 *
 * The camera roll (Evoni, 2026-10-19: "every character in LalaWorld should
 * have an official headshot, but their other photos should look like
 * moments from an actual life ... photographs should have a purpose"), laid
 * out as her mockup: on the left the albums with their counts, the tools and
 * the photo rules; on the right the Official Portrait row (the main headshot
 * first), Recent Photos, the Albums and, for an ADMIN, the camera-roll
 * planner (CameraRollPlanner). Reads GET /api/v1/camera-roll/characters/:id;
 * when that is not there the tab shows the gallery as before. The groups from
 * their world (places, wardrobe, events, posts, tagged) stay, under the
 * albums.
 */
import { useState, useEffect, useCallback, useContext } from 'react';
import {
  Images, UserRound, MapPin, Shirt, CalendarDays, FileText, X, ExternalLink, Tag, Crown, Camera,
  FolderOpen, ShieldCheck, Wrench, Sparkles, ArrowRight,
} from 'lucide-react';
import api from '../../services/api';
import AuthContext from '../../contexts/AuthContext';
import { isAdmin } from '../../utils/authGroups';
import { AddPicture, PictureLibrary, BringExisting } from './GalleryLibrary';
import CameraRollPlanner, { ALBUMS, PURPOSE_WORDS, TAKEN_BY_WORDS, storyDate } from './CameraRollPlanner';
import NeedsPicture from '../PostMedia/NeedsPicture';
import './CharacterGalleryTab.css';

const GROUP_ICONS = { portraits: UserRound, places: MapPin, wardrobe: Shirt, events: CalendarDays, posts: FileText, tagged: Tag };
// Where each kind of picture is added, for a group with none yet.
const EMPTY = {
  portraits: ['No portraits yet. Make one on the Appearance tab.', 'appearance'],
  places: ['No places with pictures yet. Link their home, closet or work on the Places & Gallery tab.', 'places'],
  wardrobe: ['No wardrobe pieces name them yet.', null],
  events: ['No event invitations or event sets yet.', 'story'],
  posts: ['No posts with photos yet.', 'voice'],
  tagged: ['No other pictures are tagged with them yet.', null],
};
const TAB_WORDS = { appearance: 'Appearance', places: 'Places & Gallery', story: 'Story & Events', voice: 'Voice & Pulse' };
const RECENT = 7;
const ALBUM_LABEL = Object.fromEntries(ALBUMS.map((a) => [a.key, a.label]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A camera-roll photo as a gallery item: its moment and reason ride along for the larger view. */
const rollItem = (p) => ({
  id: `roll:${p.asset_id || p.moment_id || p.url}`,
  url: p.url,
  caption: p.caption || 'A moment from their camera roll',
  source: 'camera_roll',
  roll: { purpose: p.purpose, taken_by: p.taken_by, story_date: p.story_date, album: p.album },
});

/** The camera-roll read, or null when it is not there (an older server, or an error). */
function rollOf(data) {
  const d = data?.data;
  return d && Array.isArray(d.photos) && Array.isArray(d.moments) ? d : null;
}

function Thumb({ item, onOpen, badge = null, action = null }) {
  return (
    <li className="gal-item">
      <div className="gal-thumb-wrap">
        <button type="button" className="gal-thumb" onClick={() => onOpen(item)} aria-label={`Open: ${item.caption}`}>
          <img src={item.url} alt={item.caption} loading="lazy" />
        </button>
        {badge && <span className="gal-badge">{badge}</span>}
      </div>
      <span className="gal-caption">{item.caption}</span>
      {action}
    </li>
  );
}

export default function CharacterGalleryTab({ character, openTab, hide = [] }) {
  // The context itself, not useAuth(): the tab also renders outside an AuthProvider (tests, embeds).
  const auth = useContext(AuthContext);
  const [state, setState] = useState({ loading: true, groups: [], linked: false, canEdit: false });
  const [roll, setRoll] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState('all');
  const [planner, setPlanner] = useState(false);
  const [organize, setOrganize] = useState(false);
  const [headshotError, setHeadshotError] = useState(null);
  const name = character.selected_name || character.display_name;

  const loadGallery = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/cast/characters/${character.id}/gallery`);
      setState({ loading: false, groups: data.groups || [], linked: !!data.linked, canEdit: !!data.can_edit });
    } catch (err) {
      console.error('[CharacterGalleryTab] the gallery could not be read:', err);
      setState({ loading: false, groups: [], linked: false, canEdit: false });
      setError(err?.response?.data?.error || 'The gallery could not be loaded.');
    }
  }, [character.id]);

  const loadRoll = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/camera-roll/characters/${character.id}`);
      setRoll(rollOf(data));
    } catch (err) {
      // No camera roll on this server yet, or it failed: the gallery shows as before.
      console.error('[CharacterGalleryTab] the camera roll could not be read:', err);
      setRoll(null);
    }
  }, [character.id]);

  const load = useCallback(() => Promise.all([loadGallery(), loadRoll()]), [loadGallery, loadRoll]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (state.loading) return <p className="gal-muted">Loading…</p>;

  const admin = isAdmin(auth?.user) || state.canEdit;
  const eligible = !!roll && roll.eligible !== false;
  const groups = state.groups.filter((g) => !hide.includes(g.key));
  const portraitGroup = groups.find((g) => g.key === 'portraits');
  const photos = roll ? roll.photos.filter((p) => p.url).map(rollItem) : [];
  const rollUrls = new Set(photos.map((p) => p.url));
  // Their world: everything but the portraits (the Official Portrait row) and
  // the camera-roll photos the library also lists under Tagged.
  const world = groups
    .filter((g) => g.key !== 'portraits')
    .map((g) => ({ ...g, items: (g.items || []).filter((it) => !rollUrls.has(it.url)) }));

  const headshot = roll?.headshot?.url ? roll.headshot : null;
  const portraitItems = (portraitGroup?.items || []).filter((it) => !headshot || it.url !== headshot.url);
  const official = [
    ...(headshot ? [{ id: `headshot:${headshot.asset_id || headshot.url}`, url: headshot.url, caption: `${name}'s official headshot`, source: 'headshot', headshot: true }] : []),
    ...portraitItems,
  ];

  const albumCount = (key) => {
    const given = roll?.albums?.find((a) => a.key === key);
    return given ? given.count : photos.filter((p) => p.roll.album === key).length;
  };
  const seen = new Set();
  const total = [...official, ...photos, ...world.flatMap((g) => g.items)]
    .filter((it) => it.url && !seen.has(it.url) && seen.add(it.url)).length;

  const canPlan = admin && eligible;
  const openMoments = (roll?.moments || []).filter((m) => ['proposed', 'kept', 'failed'].includes(m.status));
  const showPlanner = canPlan && (planner || openMoments.length > 0 || photos.length === 0);

  const setHeadshot = async (item) => {
    setHeadshotError(null);
    try {
      const body = item.asset?.id ? { asset_id: item.asset.id } : { url: item.url };
      await api.put(`/api/v1/camera-roll/characters/${character.id}/headshot`, body);
      await loadRoll();
    } catch (err) {
      console.error('[CharacterGalleryTab] the headshot could not be set:', err);
      setHeadshotError(err?.response?.data?.error || 'The headshot could not be set. Try again.');
    }
  };

  const createNew = () => {
    setView('all');
    setPlanner(true);
    setTimeout(() => document.getElementById('cr-h')?.scrollIntoView?.({ block: 'nearest' }), 0);
  };

  // The library entry behind a picture, for the ADMIN's tag editor in the larger view.
  const libraryItem = (item) => (item.source === 'camera_roll'
    ? state.groups.flatMap((g) => g.items || []).find((it) => it.url === item.url && it.asset) || null
    : item);

  const nav = [
    { key: 'all', label: 'All Photos', icon: Images, count: total },
    { key: 'portraits', label: 'Official Portraits', icon: Crown, count: official.length },
    ...(roll ? [
      { key: 'roll', label: 'Camera roll', icon: Camera, count: photos.length },
      ...ALBUMS.map((a) => ({ key: a.key, label: a.label, icon: FolderOpen, count: albumCount(a.key) })),
    ] : []),
  ];
  const worldNav = world.map((g) => ({ key: `w:${g.key}`, label: g.label, icon: GROUP_ICONS[g.key] || Images, count: g.items.length }));

  const grid = (items, empty) => (items.length
    ? <ul className="gal-grid">{items.map((it) => <Thumb key={it.id} item={it} onOpen={setOpen} />)}</ul>
    : <p className="gal-muted">{empty}</p>);

  const portraitRow = (
    <section className="gal-panel" aria-labelledby="gal-h-official" data-testid="gallery-official">
      <header className="gal-panel-head">
        <div>
          <h4 id="gal-h-official" className="gal-panel-title"><Crown size={18} aria-hidden /> Official Portrait</h4>
          <p className="gal-muted">Their one official headshot: it keeps their face the same in every photo.</p>
        </div>
      </header>
      {roll && !headshot && (
        <p className="gal-muted">
          No official headshot yet.{admin && eligible ? ' Set one of their portraits below as the headshot, or make one on the Appearance tab.' : ''}
        </p>
      )}
      {headshotError && <p className="gal-error" role="alert">{headshotError}</p>}
      {official.length ? (
        <ul className="gal-grid is-row">
          {official.map((it) => (
            <Thumb key={it.id} item={it} onOpen={setOpen}
              badge={it.headshot ? 'Main headshot' : null}
              action={!it.headshot && admin && eligible
                ? <button type="button" className="gal-link" onClick={() => setHeadshot(it)}>Set as headshot</button>
                : null} />
          ))}
        </ul>
      ) : (
        <p className="gal-muted">
          {EMPTY.portraits[0]}
          {openTab && <> <button type="button" className="gal-link" onClick={() => openTab('appearance')}>Open Appearance</button></>}
        </p>
      )}
    </section>
  );

  const recent = roll && (
    <section className="gal-panel" aria-labelledby="gal-h-recent" data-testid="gallery-recent">
      <header className="gal-panel-head">
        <div>
          <h4 id="gal-h-recent" className="gal-panel-title"><Camera size={18} aria-hidden /> Recent Photos</h4>
          <p className="gal-muted">{name}&rsquo;s latest moments from their camera roll.</p>
        </div>
        {photos.length > RECENT && (
          <button type="button" className="gal-pill" onClick={() => setView('roll')}>View all photos <ArrowRight size={14} aria-hidden /></button>
        )}
      </header>
      {grid(photos.slice(0, RECENT), canPlan ? 'No camera-roll photos yet. Plan their camera roll to make some.' : 'No camera-roll photos yet.')}
    </section>
  );

  const albums = roll && (
    <section className="gal-panel" aria-labelledby="gal-h-albums" data-testid="gallery-albums">
      <header className="gal-panel-head">
        <div>
          <h4 id="gal-h-albums" className="gal-panel-title"><FolderOpen size={18} aria-hidden /> Albums</h4>
          <p className="gal-muted">Their photos, sorted by the part of their life they come from.</p>
        </div>
      </header>
      <ul className="gal-albums">
        {ALBUMS.map((a) => {
          const cover = photos.find((p) => p.roll.album === a.key);
          const n = albumCount(a.key);
          return (
            <li key={a.key}>
              <button type="button" className="gal-album" onClick={() => setView(a.key)} aria-label={`${a.label}, ${plural(n, 'photo')}`}>
                <span className="gal-album-cover">{cover ? <img src={cover.url} alt="" loading="lazy" /> : <Images size={22} aria-hidden />}</span>
                <span className="gal-album-label">{a.label}</span>
                <span className="gal-album-count">{plural(n, 'photo')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const worldSection = (
    <div className="gal-world" data-testid="gallery-world">
      {world.map((g) => {
        const Icon = GROUP_ICONS[g.key] || Images;
        const [emptyText, tab] = EMPTY[g.key] || ['Nothing here yet.', null];
        return (
          <section key={g.key} className="gal-group" data-testid={`gallery-${g.key}`} aria-labelledby={`gal-h-${g.key}`}>
            <h4 id={`gal-h-${g.key}`} className="gal-group-title">
              <Icon size={15} aria-hidden /> {g.label} <span className="gal-count">{g.items.length}</span>
            </h4>
            {g.items.length ? (
              <ul className="gal-grid">{g.items.map((it) => <Thumb key={it.id} item={it} onOpen={setOpen} />)}</ul>
            ) : (
              <p className="gal-muted">
                {emptyText}
                {tab && openTab && (
                  <> <button type="button" className="gal-link" onClick={() => openTab(tab)}>Open {TAB_WORDS[tab]}</button></>
                )}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );

  let main;
  if (view === 'portraits') {
    main = portraitRow;
  } else if (view === 'roll') {
    main = (
      <section className="gal-panel" data-testid="gallery-view">
        <h4 className="gal-panel-title"><Camera size={18} aria-hidden /> Camera roll</h4>
        {grid(photos, 'No camera-roll photos yet.')}
      </section>
    );
  } else if (ALBUM_LABEL[view]) {
    main = (
      <section className="gal-panel" data-testid="gallery-view">
        <h4 className="gal-panel-title"><FolderOpen size={18} aria-hidden /> {ALBUM_LABEL[view]}</h4>
        {grid(photos.filter((p) => p.roll.album === view), `No ${ALBUM_LABEL[view]} photos yet.`)}
      </section>
    );
  } else if (view.startsWith('w:')) {
    const g = world.find((x) => `w:${x.key}` === view);
    main = g ? (
      <section className="gal-panel" data-testid="gallery-view">
        <h4 className="gal-panel-title">{g.label}</h4>
        {grid(g.items, (EMPTY[g.key] || ['Nothing here yet.'])[0])}
      </section>
    ) : null;
  } else {
    main = (
      <>
        {portraitRow}
        {recent}
        {albums}
        {roll && roll.eligible === false && roll.reason && (
          <p className="gal-muted gal-note" data-testid="camera-roll-ineligible">{roll.reason}</p>
        )}
        {showPlanner && (
          <CameraRollPlanner characterId={character.id} name={name} target={roll.target} moments={roll.moments} photoCount={photos.length} onChanged={loadRoll} />
        )}
        {worldSection}
      </>
    );
  }

  const navButton = (n) => {
    const Icon = n.icon;
    return (
      <li key={n.key}>
        <button type="button" className={`gal-nav-item${view === n.key ? ' is-active' : ''}`} aria-pressed={view === n.key} onClick={() => setView(n.key)}>
          <Icon size={16} aria-hidden /> <span className="gal-nav-label">{n.label}</span> <span className="gal-nav-count">{n.count}</span>
        </button>
      </li>
    );
  };

  const viewing = open ? libraryItem(open) : null;

  return (
    <div className="gal" data-testid="character-gallery">
      <aside className="gal-side">
        <nav className="gal-card" aria-label="Albums">
          <h3 className="gal-card-title"><Images size={18} aria-hidden /> Gallery</h3>
          <ul className="gal-nav">{nav.map(navButton)}</ul>
          {worldNav.length > 0 && (
            <>
              <p className="gal-nav-heading">From their world</p>
              <ul className="gal-nav">{worldNav.map(navButton)}</ul>
            </>
          )}
        </nav>

        {admin && (
          <div className="gal-card" data-testid="gallery-tools">
            <h3 className="gal-card-title"><Wrench size={18} aria-hidden /> Tools</h3>
            {state.canEdit && <AddPicture character={character} onAdded={load} />}
            {canPlan && (
              <button type="button" className="gal-tool" onClick={createNew}><Sparkles size={15} aria-hidden /> Create New Photo</button>
            )}
            {state.canEdit && (
              <button type="button" className="gal-tool" aria-expanded={organize} onClick={() => setOrganize((o) => !o)}>
                <Tag size={15} aria-hidden /> Organize &amp; Tag
              </button>
            )}
            {organize && (
              <div className="gal-organize">
                <p className="gal-muted">Open a photo to change its tags, who may see it and its status.</p>
                <BringExisting onDone={load} />
              </div>
            )}
          </div>
        )}

        <div className="gal-card gal-rules">
          <h3 className="gal-card-title"><ShieldCheck size={18} aria-hidden /> Photo Rules</h3>
          <p className="gal-muted">Every photo has a reason: a moment from their life, who took it and why. The official headshot keeps their face the same in every photo.</p>
        </div>
      </aside>

      <div className="gal-main">
        <p className="gal-muted gal-summary">
          {total ? `${plural(total, 'picture')} of ${name} and their world, from across the app.` : `No pictures of ${name} yet.`}
          {!state.linked && ' With no Pulse profile, their events and posts are not here yet.'}
        </p>
        {error && <p className="gal-error" role="alert">{error}</p>}
        {state.canEdit && state.linked && <NeedsPicture characterId={character.id} />}
        {main}
      </div>

      {open && (
        <div className="gal-viewer" role="dialog" aria-modal="true" aria-label={open.caption} onClick={() => setOpen(null)}>
          <figure className="gal-viewer-inner" onClick={(e) => e.stopPropagation()}>
            <img src={open.url} alt={open.caption} />
            <figcaption>
              <span>{open.caption}</span>
              <a href={open.url} target="_blank" rel="noreferrer" className="gal-link"><ExternalLink size={13} aria-hidden /> Open image</a>
              <button type="button" className="gal-close" onClick={() => setOpen(null)} aria-label="Close"><X size={16} aria-hidden /></button>
            </figcaption>
            {open.roll && (
              <dl className="gal-reason" data-testid="photo-reason">
                {open.roll.purpose && <div><dt>Why it exists</dt><dd>{PURPOSE_WORDS[open.roll.purpose] || open.roll.purpose}</dd></div>}
                {open.roll.taken_by && <div><dt>Who took it</dt><dd>{TAKEN_BY_WORDS[open.roll.taken_by] || open.roll.taken_by}</dd></div>}
                {open.roll.story_date && <div><dt>When</dt><dd>{storyDate(open.roll.story_date)}</dd></div>}
                {open.roll.album && <div><dt>Album</dt><dd>{ALBUM_LABEL[open.roll.album] || open.roll.album}</dd></div>}
              </dl>
            )}
            {state.canEdit && viewing && <PictureLibrary item={viewing} character={character} onChanged={load} />}
          </figure>
        </div>
      )}
    </div>
  );
}
