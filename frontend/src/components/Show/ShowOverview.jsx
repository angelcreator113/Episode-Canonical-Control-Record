/**
 * Producer Mode → Overview, to Evoni's mock of 2026-10-17 (the whole
 * Overview redone; she does not need the old content).
 *
 * Main column:
 *   - Now producing: the chosen episode (the first in production unless
 *     another is picked in the Season / Episode switcher), its title,
 *     description and thumbnail (Edit Thumbnail opens Templates › YouTube
 *     thumbnails), its production checklist as one card per section (the
 *     same checks as the episode's Production tab), and Continue Episode,
 *     Open Script, Lala's Phone, Open Files;
 *   - Episode Assets: the episode's raw clips, scene sets, images, music
 *     cues, phone screens and overlays, each a tab with its count;
 *   - Needs your attention: events whose setup is incomplete.
 * Beside them: Lala now (her stats; History), the episode's money (the
 * linked event's forecast), Main Characters (Lala, JustAWoman, the show's
 * supporting cast and the episode's guests; Manage Cast) and Up next (the
 * season's next slot and the next ready event).
 * A brand-new show sees its first steps.
 *
 * Props: showId, episodes, events, charState, wardrobeCount, goTo(tabKey)
 * to open a Producer Mode section.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, FileText, Smartphone, FolderOpen, MoreHorizontal, ClipboardList, MapPin, Clapperboard, Shirt, Sparkles, Layers, Hash, Brain,
  CircleCheck, Image as ImageIcon, Music, Film, ChevronRight, AlertTriangle, Coins, Star, Heart, BarChart3, Zap, UserRound, ImageOff, Pencil,
} from 'lucide-react';
import api from '../../services/api';
import { thumbnailStudioHref } from '../../lib/thumbnailStudioHref';
import { currentThumbnail } from '../../lib/youtubeThumbnailsApi';
import { computeEventPackageReadiness, computeEventState, describeMissing } from '../../utils/eventReadinessSections';
import { CHECKLIST_SECTIONS, computeSectionState, checklistFixTarget, loadProductionChecks } from '../Episodes/EpisodeProductionChecklist';
import './ShowOverview.css';

export const IN_PRODUCTION = ['draft', 'scripted', 'in_build', 'in_review'];
const STATUS_LABEL = { draft: 'Draft', scripted: 'Scripted', in_build: 'In build', in_review: 'In review', scheduled: 'Scheduled', published: 'Published', archived: 'Archived' };
const STAT_LABEL = { coins: 'Coins', reputation: 'Reputation', brand_trust: 'Brand Trust', influence: 'Influence', stress: 'Stress' };
const STAT_ORDER = ['coins', 'reputation', 'brand_trust', 'influence', 'stress'];
const STAT_ICON = { coins: Coins, reputation: Star, brand_trust: Heart, influence: BarChart3, stress: Zap };
const SECTION_ICON = { brief: ClipboardList, world: MapPin, scene: Clapperboard, wardrobe: Shirt, lookbook: Sparkles, overlays: Smartphone, onscreen: Layers, social: Hash, intelligence: Brain };

const time = (d) => (d ? new Date(d).getTime() || 0 : 0);

/** The episodes in production, in episode order. */
export function episodesInProduction(episodes) {
  return (episodes || [])
    .filter((e) => IN_PRODUCTION.includes(e.status) && e.evaluation_status !== 'accepted')
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
}

/** Events whose setup is incomplete, with what each is missing. */
export function eventsNeedingAttention(events) {
  return (events || []).map((ev) => {
    const readiness = computeEventPackageReadiness(ev);
    const state = computeEventState(ev, readiness);
    if (state !== 'needs_organizer' && state !== 'needs_setup') return null;
    const missing = state === 'needs_organizer' ? ['Organizer'] : describeMissing(readiness.blocking);
    return { event: ev, state, missing };
  }).filter(Boolean);
}

/** The next ready event: soonest dated first, then undated. */
export function nextReadyEvent(events) {
  const ready = (events || []).filter((ev) => computeEventState(ev) === 'ready');
  return ready.sort((a, b) => {
    const da = a.event_date ? time(a.event_date) : Infinity;
    const db = b.event_date ? time(b.event_date) : Infinity;
    return da - db;
  })[0] || null;
}

/** The checklist's sections that report a state (a section may still set unavailableReason). */
const LIVE_SECTIONS = CHECKLIST_SECTIONS.filter((sec) => !sec.unavailableReason);

/**
 * The checklist at a glance: items done of all items, and each section's
 * state with a short label: "Complete", "Not started" when nothing in it is
 * done, else its required items done ("0 of 1" while only optional items
 * are), or all its items for a section with none required. first_missing is
 * the first required item still open (for the card's fix link).
 */
export function checklistSummary(checks) {
  const items = LIVE_SECTIONS.flatMap((sec) => sec.items);
  const done = items.filter((item) => checks[item.id]).length;
  const sections = LIVE_SECTIONS.map((sec) => {
    const { state } = computeSectionState(sec, checks);
    const required = sec.items.filter((item) => item.required);
    const counted = required.length ? required : sec.items;
    const n = counted.filter((item) => checks[item.id]).length;
    const label = state === 'complete' ? 'Complete' : state === 'needs_setup' ? 'Not started' : `${n} of ${counted.length}`;
    const firstMissing = (required.length ? required : sec.items).find((item) => !checks[item.id]) || null;
    return { id: sec.id, title: sec.label, state, label, first_missing: firstMissing?.id || null };
  });
  return { done, total: items.length, sections };
}

/** The seasons the show's episodes are in (1 when none says), ascending. */
export function seasonsOf(episodes) {
  const set = new Set((episodes || []).map((e) => Number(e.season_number) || 1));
  return [...set].sort((a, b) => a - b);
}

/** The episode the Overview opens on: the first in production, else the newest by number. */
export function defaultEpisode(episodes) {
  const producing = episodesInProduction(episodes);
  if (producing[0]) return producing[0];
  return [...(episodes || [])].sort((a, b) => (b.episode_number || 0) - (a.episode_number || 0))[0] || null;
}

/**
 * Main Characters: Lala first (Host / Creator, Primary), JustAWoman next
 * (Supporting), then the show's other supporting cast from its registries
 * (two at most), then the episode's guests (from its raw clips).
 */
export function mainCharacters(registryCharacters = [], clips = []) {
  const chars = (registryCharacters || []).filter((c) => c && c.status !== 'declined');
  const byKey = (k) => chars.find((c) => String(c.character_key || '').toLowerCase() === k);
  const lala = byKey('lala');
  const jaw = byKey('justawoman');
  const rows = [
    { key: 'lala', name: lala?.display_name || 'Lala', role: 'Host / Creator', tag: 'Primary', portrait: lala?.portrait_url || null },
    { key: 'justawoman', name: jaw?.display_name || 'JustAWoman', role: 'Real life', tag: 'Supporting', portrait: jaw?.portrait_url || null },
  ];
  const support = chars
    .filter((c) => !['lala', 'justawoman'].includes(String(c.character_key || '').toLowerCase()) && ['support', 'mirror', 'pressure'].includes(c.role_type))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .slice(0, 2);
  support.forEach((c) => rows.push({ key: c.id, name: c.display_name || 'Character', role: c.role_label || String(c.role_type || '').replace(/^\w/, (m) => m.toUpperCase()), tag: 'Supporting', portrait: c.portrait_url || null }));
  const guests = [...new Set((clips || []).filter((c) => c.performer === 'guest').map((c) => (c.guest_name || '').trim()).filter(Boolean))];
  rows.push({ key: 'guests', name: 'Guests', role: guests.length ? guests.join(', ') : 'Featured', tag: 'Guest', portrait: null });
  return rows;
}

const listOf = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);
const imgOf = (...urls) => urls.find((u) => typeof u === 'string' && u) || null;

/**
 * The episode's assets, one tab each: { key, label, items: [{ id, title, image, tags[] }] }.
 * Read from the routes each tab already uses; a tab that fails to load is empty.
 */
export function assetTabs({ clips = [], sceneSets = [], images = [], cues = [], phone = [], placements = [] } = {}) {
  const performer = { lala: 'Lala', justawoman: 'JustAWoman', guest: 'Guest' };
  return [
    { key: 'clips', label: 'Raw Clips', items: clips.map((c) => ({ id: c.id, title: c.label || c.original_filename || 'Clip', image: imgOf(c.thumbnail_url), tags: [performer[c.performer] || c.performer, c.beat_number ? `Scene ${c.beat_number}` : null].filter(Boolean), length: c.duration_seconds })) },
    { key: 'sets', label: 'Scene Sets', items: sceneSets.map((s) => ({ id: s.id, title: s.name || 'Scene set', image: imgOf(s.cover_image_url, s.base_still_url, (s.angles || []).find((a) => a.still_image_url)?.still_image_url), tags: [s.isPrimary ? 'Primary' : null, s.scene_type ? String(s.scene_type).replace(/_/g, ' ').toLowerCase() : null].filter(Boolean) })) },
    { key: 'images', label: 'Images', items: images.filter((a) => !a.media_type || a.media_type === 'image').map((a) => ({ id: a.id, title: a.name || a.file_name || 'Image', image: imgOf(a.s3_url_processed, a.s3_url_raw, a.thumbnail_url), tags: [a.asset_role || a.asset_type].filter(Boolean).map((t) => String(t).split('.').pop().replace(/_/g, ' ').toLowerCase()) })) },
    { key: 'audio', label: 'Audio', items: cues.map((m) => ({ id: m.id, title: m.title || m.cue_name || m.name || m.mood || 'Music cue', image: null, tags: [m.mood, m.beat_number ? `Scene ${m.beat_number}` : null].filter(Boolean) })) },
    { key: 'phone', label: 'Phone Screens', items: phone.filter((p) => p.generated !== false && (p.url || p.image_url)).map((p) => ({ id: p.id || p.name, title: p.name || p.overlay_type || 'Screen', image: imgOf(p.url, p.image_url), tags: [] })) },
    { key: 'overlays', label: 'Overlays', items: placements.map((p) => ({ id: p.id, title: p.asset?.name || p.label || p.placement_type || 'Overlay', image: imgOf(p.asset?.s3_url_processed, p.asset?.s3_url_raw), tags: [p.placement_type].filter(Boolean) })) },
  ];
}

function useNextSlot(showId) {
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

function useProductionChecks(episode, showId) {
  const [state, setState] = useState({ loading: Boolean(episode), checks: null, linkedEvent: null });
  useEffect(() => {
    if (!episode?.id) { setState({ loading: false, checks: null, linkedEvent: null }); return undefined; }
    let cancelled = false;
    setState({ loading: true, checks: null, linkedEvent: null });
    loadProductionChecks(episode, showId).then(({ checks, linkedEvent }) => {
      if (!cancelled) setState({ loading: false, checks, linkedEvent });
    }).catch((err) => {
      console.error('[ShowOverview] production checks failed:', err);
      if (!cancelled) setState({ loading: false, checks: null, linkedEvent: null });
    });
    return () => { cancelled = true; };
  }, [episode?.id, showId]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** The linked event's money forecast: what the deal pays, the look, the spending, the balance after. */
function useEventForecast(showId, eventId) {
  const [state, setState] = useState({ loading: false, forecast: null, failed: false });
  const load = useCallback(async () => {
    if (!eventId) { setState({ loading: false, forecast: null, failed: false }); return; }
    setState({ loading: true, forecast: null, failed: false });
    try {
      const r = await api.get(`/api/v1/world/${showId}/events/${eventId}/financial-forecast`);
      setState({ loading: false, forecast: r.data?.success === false ? null : r.data, failed: r.data?.success === false });
    } catch (err) {
      console.error('[ShowOverview] financial forecast load failed:', err);
      setState({ loading: false, forecast: null, failed: true });
    }
  }, [showId, eventId]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/** A GET that never throws: its body, or null (logged). */
const quietGet = (url, what) => Promise.resolve().then(() => api.get(url)).then((r) => r?.data ?? null).catch((err) => {
  console.error(`[ShowOverview] ${what} load failed:`, err);
  return null;
});

/** The episode's assets for the Episode Assets tabs. */
function useEpisodeAssets(episodeId, showId) {
  const [state, setState] = useState({ loading: false, data: null });
  useEffect(() => {
    if (!episodeId) { setState({ loading: false, data: null }); return undefined; }
    let live = true;
    setState({ loading: true, data: null });
    Promise.all([
      quietGet(`/api/v1/episode-clips/${episodeId}`, 'raw clips'),
      quietGet(`/api/v1/episodes/${episodeId}/scene-sets`, 'scene sets'),
      quietGet(`/api/v1/assets?episode_id=${episodeId}&limit=60`, 'images'),
      quietGet(`/api/v1/episodes/${episodeId}/music-cues`, 'music cues'),
      showId ? quietGet(`/api/v1/ui-overlays/${showId}?episode_id=${episodeId}`, 'phone screens') : null,
      quietGet(`/api/v1/episodes/${episodeId}/timeline/placements`, 'overlays'),
    ]).then(([clips, sets, images, cues, phone, placements]) => {
      if (!live) return;
      setState({
        loading: false,
        data: {
          clips: listOf(clips), sceneSets: listOf(sets), images: listOf(images?.data ?? images?.assets ?? images),
          cues: listOf(cues?.data ?? cues?.cues ?? cues), phone: listOf(phone), placements: listOf(placements),
        },
      });
    });
    return () => { live = false; };
  }, [episodeId, showId]);
  return state;
}

/** The episode's primary thumbnail's URL, or null. */
function useThumbnail(episode) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!episode?.id) { setUrl(null); return undefined; }
    let live = true;
    setUrl(episode.thumbnail_url || null);
    // The editor's saved list: its current thumbnail, if one was saved before thumbnail_url was set.
    Promise.resolve().then(() => currentThumbnail(episode.id))
      .then((thumb) => { if (live && thumb?.url) setUrl(thumb.url); })
      .catch((err) => console.error('[ShowOverview] thumbnail load failed:', err));
    return () => { live = false; };
  }, [episode?.id, episode?.thumbnail_url]);
  return url;
}

/** The show's registry characters, for Main Characters. */
function useRegistryCharacters(showId) {
  const [chars, setChars] = useState([]);
  useEffect(() => {
    if (!showId) return undefined;
    let live = true;
    quietGet(`/api/v1/registries?show_id=${showId}`, 'cast').then((body) => {
      if (!live || !body) return;
      setChars((body.registries || []).flatMap((r) => r.characters || []));
    });
    return () => { live = false; };
  }, [showId]);
  return chars;
}

const coins = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—');
const fmtLength = (s) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n > 0 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : null;
};

function NowProducing({ showId, episodes, episode, onPick, checksState }) {
  const [menu, setMenu] = useState(false);
  const thumb = useThumbnail(episode);
  const seasons = seasonsOf(episodes);
  const season = Number(episode?.season_number) || 1;
  const inSeason = (episodes || []).filter((e) => (Number(e.season_number) || 1) === season)
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  if (!episode) {
    return (
      <section className="pov-card pov-now" data-testid="sov-producing">
        <span className="pov-eyebrow">Now producing</span>
        <p className="pov-empty">Nothing in production. <Link to={`/shows/${showId}/new-episode`}>New Episode</Link></p>
      </section>
    );
  }
  const summary = checksState.checks ? checklistSummary(checksState.checks) : null;
  const pct = summary && summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const producing = IN_PRODUCTION.includes(episode.status);
  const status = String(episode.status || 'draft');
  const fix = (sec) => {
    const target = sec.first_missing ? checklistFixTarget(sec.first_missing, { episode, showId }) : null;
    return target?.href || `/episodes/${episode.id}?tab=checklist`;
  };
  return (
    <section className="pov-card pov-now" data-testid="sov-producing">
      <div className="pov-now-top">
        <div className="pov-chips">
          <span className={`pov-chip ${producing ? 'is-live' : ''}`}>{producing ? 'Now producing' : 'Episode'}</span>
          <span className="pov-chip is-status">{STATUS_LABEL[status] || status}</span>
        </div>
        <div className="pov-switch">
          <select aria-label="Season" value={season}
            onChange={(e) => { const s = Number(e.target.value); const first = (episodes || []).filter((x) => (Number(x.season_number) || 1) === s).sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0))[0]; if (first) onPick(first.id); }}>
            {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
          </select>
          <select aria-label="Episode" value={episode.id} onChange={(e) => onPick(e.target.value)}>
            {inSeason.map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `Episode ${e.episode_number}` : (e.title || 'Episode')}</option>)}
          </select>
        </div>
      </div>

      <div className="pov-now-body">
        <div className="pov-now-text">
          <h2 className="pov-now-title">{episode.title || 'Untitled'}</h2>
          {(episode.logline || episode.description) && <p className="pov-now-logline">{episode.logline || episode.description}</p>}
        </div>
        <Link className="pov-thumb" to={thumbnailStudioHref({ showId, episodeId: episode.id })} data-testid="sov-thumbnail">
          {thumb ? <img src={thumb} alt={`Thumbnail for ${episode.title || 'the episode'}`} /> : <span className="pov-thumb-empty"><ImageOff size={24} aria-hidden /> No thumbnail yet</span>}
          <span className="pov-thumb-edit"><Pencil size={14} aria-hidden /> {thumb ? 'Edit Thumbnail' : 'Make Thumbnail'}</span>
        </Link>
      </div>

      <div className="pov-checklist" data-testid="sov-checklist">
        <div className="pov-checklist-head">
          <h3 className="pov-h3"><ClipboardList size={18} aria-hidden /> Production Checklist</h3>
          <span className="pov-count">{summary ? `${summary.done} of ${summary.total} complete` : checksState.loading ? 'Checking…' : ''}</span>
          <Link className="pov-pill-link" to={`/episodes/${episode.id}?tab=checklist`}>View All</Link>
        </div>
        <div className="pov-bar-row">
          <div className="pov-bar" role="progressbar" aria-label="Production checklist" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="pov-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          {summary && <span className="pov-pct">{pct}%</span>}
        </div>
        {summary && (
          <ul className="pov-sections">
            {summary.sections.map((sec) => {
              const Icon = SECTION_ICON[sec.id] || ClipboardList;
              return (
                <li key={sec.id}>
                  <Link className={`pov-section is-${sec.state}`} to={fix(sec)} data-testid={`sov-section-${sec.id}`}>
                    <span className="pov-section-icon"><Icon size={22} aria-hidden />{sec.state === 'complete' && <CircleCheck size={14} className="pov-section-done" aria-hidden />}</span>
                    <span className="pov-section-text">
                      <span className="pov-section-title">{sec.title}</span>
                      <span className="pov-section-state">{sec.state === 'in_progress' ? `In progress · ${sec.label.replace(' of ', '/')}` : sec.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pov-actions">
        <Link className="pov-btn is-primary" to={`/episodes/${episode.id}?tab=production`}><Play size={18} aria-hidden /> Continue Episode</Link>
        <Link className="pov-btn" to={`/episodes/${episode.id}?tab=scripts`}><FileText size={18} aria-hidden /> Open Script</Link>
        <Link className="pov-btn" to={`/episodes/${episode.id}?tab=phone`}><Smartphone size={18} aria-hidden /> Lala's Phone</Link>
        <Link className="pov-btn" to={`/episodes/${episode.id}?tab=files`}><FolderOpen size={18} aria-hidden /> Open Files</Link>
        <div className="pov-more">
          <button type="button" className="pov-btn is-icon" aria-label="More for this episode" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal size={18} aria-hidden />
          </button>
          {menu && (
            <div className="pov-menu" role="menu">
              <Link role="menuitem" to={`/episodes/${episode.id}?tab=overview`} onClick={() => setMenu(false)}>Episode overview</Link>
              <Link role="menuitem" to={`/episodes/${episode.id}?tab=scenes`} onClick={() => setMenu(false)}>Scenes</Link>
              <Link role="menuitem" to={`/episodes/${episode.id}?tab=wardrobe`} onClick={() => setMenu(false)}>Wardrobe</Link>
              <Link role="menuitem" to={`/episodes/${episode.id}/timeline`} onClick={() => setMenu(false)}>Timeline editor</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EpisodeAssets({ episode, showId }) {
  const { loading, data } = useEpisodeAssets(episode?.id, showId);
  const [tab, setTab] = useState('clips');
  if (!episode) return null;
  const tabs = assetTabs(data || {});
  const active = tabs.find((t) => t.key === tab) || tabs[0];
  return (
    <section className="pov-card" data-testid="sov-assets">
      <div className="pov-card-head">
        <h3 className="pov-h3"><Film size={18} aria-hidden /> Episode Assets</h3>
        <Link className="pov-link" to={`/episodes/${episode.id}?tab=files`}>View All Files</Link>
      </div>
      <div className="pov-tabs" role="tablist" aria-label="Episode assets">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === active.key} className={`pov-tab${t.key === active.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} ({loading ? '…' : t.items.length})
          </button>
        ))}
      </div>
      {loading ? <p className="pov-empty">Loading the assets…</p> : active.items.length === 0 ? (
        <p className="pov-empty">No {active.label.toLowerCase()} for this episode yet.</p>
      ) : (
        <ul className="pov-strip">
          {active.items.slice(0, 10).map((it) => (
            <li key={it.id} className="pov-asset">
              <span className="pov-asset-img">
                {it.image ? <img src={it.image} alt="" loading="lazy" /> : active.key === 'audio' ? <Music size={26} aria-hidden /> : <ImageIcon size={26} aria-hidden />}
                {fmtLength(it.length) && <span className="pov-asset-len">{fmtLength(it.length)}</span>}
              </span>
              <span className="pov-asset-title" title={it.title}>{it.title}</span>
              {it.tags.length > 0 && <span className="pov-tags">{it.tags.slice(0, 2).map((tg) => <span key={tg} className="pov-tag">{tg}</span>)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EpisodeMoney({ episode, showId, linkedEvent, checksLoading, goTo }) {
  const { loading, forecast, failed, reload } = useEventForecast(showId, linkedEvent?.id);
  const name = episode.episode_number ? `Episode ${episode.episode_number}` : 'This episode';
  const look = (forecast?.expenses?.outfit_retail || 0) + (forecast?.expenses?.outfit_rentals || 0);
  const spending = Math.max(0, (forecast?.expenses?.total || 0) - look);
  return (
    <section className="pov-card" data-testid="sov-money">
      <div className="pov-card-head">
        <span className="pov-eyebrow">{name} money</span>
        <button type="button" className="pov-link" onClick={() => goTo('finances')}>View Details</button>
      </div>
      {checksLoading || loading ? <p className="pov-empty">Working out the money…</p>
        : !linkedEvent ? <p className="pov-empty">No event is linked to this episode yet, so there is no deal to count. <button type="button" className="pov-link" onClick={() => goTo('events')}>Events</button></p>
          : failed || !forecast ? <p className="pov-empty">Couldn't work out the money. <button type="button" className="pov-link" onClick={reload}>Retry</button></p>
            : (
              <dl className="pov-ledger">
                <div><dt>Deal pays <span>(at complete)</span></dt><dd className="is-plus">+{coins(forecast.income?.total)}</dd></div>
                <div><dt>Lala's look</dt><dd className="is-minus">−{coins(look)}</dd></div>
                <div><dt>Event spending</dt><dd className="is-minus">−{coins(spending)}</dd></div>
                <div className="pov-ledger-total"><dt>Coins after this episode</dt><dd>{coins(forecast.projected_balance?.baseline)}</dd></div>
              </dl>
            )}
    </section>
  );
}

function MainCharacters({ showId, episodeId }) {
  const registry = useRegistryCharacters(showId);
  const [clips, setClips] = useState([]);
  useEffect(() => {
    if (!episodeId) { setClips([]); return undefined; }
    let live = true;
    quietGet(`/api/v1/episode-clips/${episodeId}`, 'guests').then((body) => { if (live) setClips(listOf(body)); });
    return () => { live = false; };
  }, [episodeId]);
  const rows = mainCharacters(registry, clips);
  return (
    <section className="pov-card" data-testid="sov-cast">
      <div className="pov-card-head">
        <h3 className="pov-h3"><Star size={18} aria-hidden /> Main Characters</h3>
        <Link className="pov-link" to="/character-registry">Manage Cast</Link>
      </div>
      <ul className="pov-cast">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="pov-avatar">{r.portrait ? <img src={r.portrait} alt="" loading="lazy" /> : <UserRound size={20} aria-hidden />}</span>
            <span className="pov-cast-text"><strong>{r.name}</strong><span>{r.role}</span></span>
            <span className={`pov-cast-tag is-${r.tag.toLowerCase()}`}>{r.tag}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ShowOverview({ showId, episodes = [], events = [], charState = null, wardrobeCount = 0, goTo = () => {} }) {
  const attention = useMemo(() => eventsNeedingAttention(events), [events]);
  const nextEvent = useMemo(() => nextReadyEvent(events), [events]);
  const next = useNextSlot(showId);
  const isNew = episodes.length === 0 && events.length === 0;
  const [pickedId, setPickedId] = useState(null);
  const episode = useMemo(() => episodes.find((e) => e.id === pickedId) || defaultEpisode(episodes), [episodes, pickedId]);
  const checksState = useProductionChecks(episode, showId);
  const state = charState?.state || {};
  const stats = [...STAT_ORDER.filter((k) => k in state), ...Object.keys(state).filter((k) => !STAT_ORDER.includes(k))];

  return (
    <div className="pov" data-testid="show-overview">
      {isNew && (
        <section className="pov-card pov-start" data-testid="sov-first-steps">
          <h2 className="pov-h3">Start this show</h2>
          <ol>
            <li className={wardrobeCount > 0 ? 'is-done' : ''}><button type="button" onClick={() => goTo('wardrobe-items')}>Add wardrobe pieces</button></li>
            <li><button type="button" onClick={() => goTo('events')}>Create an event</button></li>
            <li>Start its episode from the event</li>
          </ol>
        </section>
      )}

      <div className="pov-layout">
        <div className="pov-col">
          <NowProducing showId={showId} episodes={episodes} episode={episode} onPick={setPickedId} checksState={checksState} />
          <EpisodeAssets episode={episode} showId={showId} />

          <section className="pov-card" data-testid="sov-attention">
            <div className="pov-card-head">
              <h3 className="pov-h3"><AlertTriangle size={18} aria-hidden /> Needs Your Attention ({attention.length})</h3>
              {attention.length > 0 && <button type="button" className="pov-link" onClick={() => goTo('events')}>View All</button>}
            </div>
            {attention.length === 0 ? (
              <p className="pov-empty">Nothing needs attention.</p>
            ) : (
              <ul className="pov-attention">
                {attention.slice(0, 3).map(({ event, missing }) => (
                  <li key={event.id}>
                    <span className="pov-attention-icon"><AlertTriangle size={18} aria-hidden /></span>
                    <span className="pov-attention-text">
                      <strong>{event.name || 'Untitled event'}</strong>
                      <span>Missing: {missing.join(', ')}</span>
                    </span>
                    <Link className="pov-btn is-small" to={`/shows/${showId}/events/${event.id}`}>Finish setup</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="pov-side">
          {stats.length > 0 && (
            <section className="pov-card pov-lala" data-testid="sov-lala">
              <div className="pov-card-head">
                <span className="pov-eyebrow">Lala now</span>
                <button type="button" className="pov-link" onClick={() => goTo('characters-list')}>History</button>
              </div>
              <div className="pov-stats">
                {stats.map((k) => {
                  const Icon = STAT_ICON[k] || Star;
                  return (
                    <div key={k} className={`pov-stat is-${k}`}>
                      <span className="pov-stat-label">{STAT_LABEL[k] || String(k).replace(/_/g, ' ')}</span>
                      <span className="pov-stat-value"><Icon size={20} aria-hidden /> {k === 'coins' ? coins(state[k]) : state[k]}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {episode && (
            <EpisodeMoney episode={episode} showId={showId} linkedEvent={checksState.linkedEvent} checksLoading={checksState.loading} goTo={goTo} />
          )}

          <MainCharacters showId={showId} episodeId={episode?.id} />

          <section className="pov-card" data-testid="sov-next">
            <div className="pov-card-head">
              <h3 className="pov-h3"><Sparkles size={18} aria-hidden /> Up Next</h3>
              <button type="button" className="pov-link" onClick={() => goTo('season')}>View Plan</button>
            </div>
            <ul className="pov-next">
              <li data-testid="sov-next-slot">
                {next.loading ? <span className="pov-empty">Loading the season…</span>
                  : next.failed ? (
                    <span className="pov-empty">Couldn't load the season. <button type="button" className="pov-link" onClick={next.reload}>Retry</button></span>
                  ) : next.slot ? (
                    <button type="button" className="pov-next-row" onClick={() => goTo('season')}>
                      <span className="pov-next-text">
                        <strong>Next slot: {next.slot.label}</strong>
                        {next.slot.intention?.story_purpose && <span>{next.slot.intention.story_purpose}</span>}
                      </span>
                      <ChevronRight size={20} aria-hidden />
                    </button>
                  ) : <span className="pov-empty">{next.hasSeason ? 'Every slot this season is filled.' : 'No season planned yet.'} <button type="button" className="pov-link" onClick={() => goTo('season')}>Season Plan</button></span>}
              </li>
              <li data-testid="sov-next-event">
                {nextEvent ? (
                  <div className="pov-next-row is-event">
                    <span className="pov-next-text">
                      <strong>{nextEvent.name}</strong>
                      <span>Ready{nextEvent.event_date ? ` · ${new Date(nextEvent.event_date).toLocaleDateString()}` : ''}</span>
                    </span>
                    <Link className="pov-btn is-small" to={`/shows/${showId}/events/${nextEvent.id}`}>Start Episode</Link>
                  </div>
                ) : (
                  <span className="pov-empty">No event is ready yet. <button type="button" className="pov-link" onClick={() => goTo('events')}>Pick an event</button></span>
                )}
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
