/**
 * The editor's left panel (plan §3.4): the episode's own media. Assets are
 * its raw clips and linked angles; Scenes its linked scene sets; Audio its
 * approved Voice Studio takes. Nothing is invented: an empty list says where
 * the media comes from.
 *
 * Editing (P3): a tile is dragged onto the lane that takes it, or placed at
 * the playhead with its + button. Angles go to the Scene lane, Prime's takes
 * to the Prime PIP lane, approved takes to the Dialogue lane. Music and SFX
 * wait for the library (R8.8).
 *
 * Gate 2a (D3, D4): Lala's and guests' clips go over the scene on the
 * Performer lane (their +), or are dragged onto the Scene lane to be the
 * background. Other raw clips are scene clips. The Text tab adds captions,
 * titles and lower thirds at the playhead.
 *
 * Prepare From Existing Work, B1 (2026-11-03): the Existing work tab lists the
 * scene plan, footage and approved takes beat by beat (ExistingWork). Clips
 * with no beat stay listed when a beat is focused (marked "No beat"), and a
 * tile says the producer's ★ and a whole-episode take's beat marks.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronDown, Search, Video, Image as ImageIcon, AudioLines, CirclePlus } from 'lucide-react';
import { beatLabel } from '../../lib/editorModel';
import ExistingWork from './ExistingWork';

const TABS = [
  { key: 'assets', label: 'Assets' },
  { key: 'work', label: 'Existing work' },
  { key: 'scenes', label: 'Scenes' },
  { key: 'audio', label: 'Audio' },
  { key: 'text', label: 'Text' },
  { key: 'transitions', label: 'Transitions' },
];

const PERFORMER = { lala: 'Lala', justawoman: 'Prime', guest: 'Guest' };

const duration = (seconds) => {
  const s = Math.round(Number(seconds) || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const inBeat = (clip, beat) => {
  if (beat == null) return true;
  const start = Number(clip.beat_number);
  const end = Number(clip.end_beat_number) || start;
  return Number.isInteger(start) && beat >= start && beat <= end;
};

/** What a tile places: { kind, id, label, ... } (EditorTimeline LANE_TAKES names the lanes). */
export function assetOfClip(c) {
  const label = c.label || c.original_filename || 'Untitled clip';
  if (c.performer === 'justawoman') return { kind: 'prime_clip', id: c.id, label };
  const performer = c.performer === 'lala' || c.performer === 'guest';
  const ms = Number(c.duration_seconds) > 0 ? Math.floor(Number(c.duration_seconds) * 1000) : null;
  return { kind: 'scene_clip_source', id: c.id, label, source_kind: 'raw_clip', ...(performer ? { performer: c.performer, duration_ms: ms } : {}) };
}

/** The text styles the Text tab adds (D4), with where each sits by default at 1920×1080. */
export const TEXT_STYLES = [
  { style_key: 'caption', label: 'Caption', hint: 'Subtitle-style text across the bottom', layout: { x: 240, y: 900, w: 1440, h: 110 } },
  { style_key: 'title', label: 'Title', hint: 'Large text in the middle of the frame', layout: { x: 160, y: 420, w: 1600, h: 240 } },
  { style_key: 'lower_third', label: 'Lower third', hint: 'A name or place on a band at the lower left', layout: { x: 96, y: 820, w: 900, h: 140 } },
];
export const TEXT_MS = 3000;
const assetOfAngle = (a, kind) => ({ kind, id: a.id, label: `${a.set_name || 'Scene'} · ${a.angle_label || a.angle_name || 'Angle'}`, source_kind: kind });
const assetOfTake = (t) => ({ kind: 'take', id: t.approval_id, label: `Beat ${t.beat_number} · line ${t.line_index + 1}`, beat_number: t.beat_number, line_index: t.line_index });

const placeTitle = (asset) => (asset.performer ? 'Place over the scene at the playhead (drag onto the Scene lane to make it the background)' : 'Place at the playhead');

function Placeable({ asset, editable, onPlace, onDragAsset, children, className = 'tle-tile' }) {
  if (!asset || !editable) return <li className={className}>{children}</li>;
  return (
    <li className={`${className} is-placeable`} draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', asset.label); onDragAsset?.(asset); }}
      onDragEnd={() => onDragAsset?.(null)}>
      {children}
      <button type="button" className="tle-tile-place" onClick={() => onPlace?.(asset)} aria-label={`Place ${asset.label} at the playhead`} title={placeTitle(asset)}>
        <CirclePlus size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

function Tile({ image, label, badge, meta, kind, asset, editable, onPlace, onDragAsset }) {
  return (
    <Placeable asset={asset} editable={editable} onPlace={onPlace} onDragAsset={onDragAsset}>
      <div className="tle-tile-thumb">
        {image ? <img src={image} alt="" loading="lazy" /> : (
          <span className="tle-tile-none" aria-hidden="true">{kind === 'image' ? <ImageIcon size={18} /> : <Video size={18} />}</span>
        )}
        {badge && <span className="tle-tile-badge">{badge}</span>}
      </div>
      <div className="tle-tile-name" title={label}>{label}</div>
      {meta && <div className="tle-tile-meta">{meta}</div>}
    </Placeable>
  );
}

const noBeat = (c) => !(Number.isInteger(Number(c.beat_number)) && Number(c.beat_number) >= 1);
const markCount = (c) => (Array.isArray(c.beat_marks) ? c.beat_marks.length : 0);
const NO_SOURCES = { loading: false, data: null, error: null };

export default function AssetBrowser({
  episodeId, rawClips, sceneSets, takes, sources = NO_SOURCES, placedAngles, focusBeat, editable = false, onPlace, onDragAsset,
}) {
  const place = { editable, onPlace, onDragAsset };
  const [tab, setTab] = useState('assets');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const q = query.trim().toLowerCase();
  const matches = (text) => !q || String(text || '').toLowerCase().includes(q);

  const angles = useMemo(() => (sceneSets.data || []).flatMap((set) => (set.angles || []).map((a) => ({ ...a, set_name: set.name }))), [sceneSets.data]);
  // A clip with no beat is never hidden by Beat Focus: it may belong anywhere (B1).
  const clips = (rawClips.data || []).filter((c) => inBeat(c, focusBeat) || noBeat(c));
  const stills = angles.filter((a) => a.still_image_url);
  const angleVideos = angles.filter((a) => a.video_clip_url);
  const takeList = (takes.data?.takes || []).filter((t) => focusBeat == null || t.beat_number === focusBeat);

  const assetItems = [
    ...clips.map((c) => ({ key: `c${c.id}`, kind: 'video', asset: assetOfClip(c), image: c.thumbnail_url, label: c.label || c.original_filename || 'Untitled clip',
      badge: duration(c.duration_seconds),
      meta: [c.is_favorite ? '★' : null, PERFORMER[c.performer] || c.performer, noBeat(c) ? 'No beat' : `Beat ${c.beat_number}`,
        markCount(c) ? `${markCount(c)} beat mark${markCount(c) === 1 ? '' : 's'}` : null, c.key_status === 'done' ? 'cutout' : null].filter(Boolean).join(' · ') })),
    ...angleVideos.map((a) => ({ key: `v${a.id}`, kind: 'video', asset: assetOfAngle(a, 'angle_video'), image: a.thumbnail_url || a.still_image_url, label: `${a.set_name || 'Scene'} · ${a.angle_label || a.angle_name}`, meta: 'Angle video' })),
    ...stills.map((a) => ({ key: `s${a.id}`, kind: 'image', asset: assetOfAngle(a, 'angle_still'), image: a.thumbnail_url || a.still_image_url, label: `${a.set_name || 'Scene'} · ${a.angle_label || a.angle_name}`, meta: 'Angle still' })),
  ];
  const counts = {
    all: assetItems.length + takeList.length,
    video: assetItems.filter((i) => i.kind === 'video').length,
    audio: takeList.length,
    image: assetItems.filter((i) => i.kind === 'image').length,
  };
  const shownAssets = assetItems.filter((i) => (filter === 'all' || filter === i.kind) && matches(i.label));
  const shownTakes = (filter === 'all' || filter === 'audio') ? takeList.filter((t) => matches(`beat ${t.beat_number} line ${t.line_index + 1}`)) : [];

  const loading = rawClips.loading || sceneSets.loading || takes.loading;

  return (
    <section className="tle-panel tle-browser" aria-label="Media">
      <div className="tle-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tle-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="tle-browser-actions">
        <Link className="tle-btn tle-btn-primary tle-add" to={`/episodes/${episodeId}?tab=files`} title="Upload footage in the episode's Files tab">
          <Plus size={16} aria-hidden="true" /> Add Media
        </Link>
        <span className="tle-btn tle-btn-primary tle-add-more" aria-hidden="true"><ChevronDown size={16} /></span>
      </div>
      <label className="tle-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" placeholder="Search assets…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search assets" />
      </label>
      {focusBeat != null && <p className="tle-browser-note">Showing beat {focusBeat}: {beatLabel(focusBeat)}</p>}
      {tab !== 'work' && sources.data?.summary?.plan_rows > 0 && (
        <p className="tle-browser-note">
          This episode has a scene plan for {sources.data.summary.beats_planned} {sources.data.summary.beats_planned === 1 ? 'beat' : 'beats'}.{' '}
          <button type="button" className="tle-linkbtn" onClick={() => setTab('work')}>See Existing work</button>
        </p>
      )}

      <div className="tle-browser-body">
        {tab === 'assets' && (
          <>
            <div className="tle-chips" role="group" aria-label="Filter">
              {[['all', 'All'], ['video', 'Video'], ['audio', 'Audio'], ['image', 'Images']].map(([k, label]) => (
                <button key={k} type="button" className={`tle-chip${filter === k ? ' is-active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} ({counts[k]})</button>
              ))}
            </div>
            {loading && <p className="tle-empty">Loading the episode's media…</p>}
            {rawClips.error && <p className="tle-empty tle-error" role="alert">Raw clips could not be loaded: {rawClips.error}</p>}
            {!loading && !shownAssets.length && !shownTakes.length && (
              <p className="tle-empty">No media here yet. Upload footage in the episode's <Link to={`/episodes/${episodeId}?tab=files`}>Files</Link> tab and link scene sets on its Overview.</p>
            )}
            <ul className="tle-grid">
              {shownAssets.map((i) => <Tile key={i.key} {...i} {...place} />)}
              {shownTakes.map((t) => (
                <Placeable key={`t${t.approval_id}`} className="tle-tile tle-tile-audio" asset={assetOfTake(t)} {...place}>
                  <div className="tle-tile-thumb"><span className="tle-tile-none" aria-hidden="true"><AudioLines size={18} /></span>
                    <span className="tle-tile-badge">{duration(((t.out_ms || 0) - (t.in_ms || 0)) / 1000)}</span></div>
                  <div className="tle-tile-name">Beat {t.beat_number} · line {t.line_index + 1}</div>
                  <div className="tle-tile-meta">Approved take</div>
                </Placeable>
              ))}
            </ul>
          </>
        )}

        {tab === 'work' && (
          <ExistingWork episodeId={episodeId} sources={sources} rawClips={rawClips} takes={takes} placedAngles={placedAngles}
            focusBeat={focusBeat} {...place} />
        )}

        {tab === 'scenes' && (
          <>
            {sceneSets.error && <p className="tle-empty tle-error" role="alert">Scene sets could not be loaded: {sceneSets.error}</p>}
            {!sceneSets.loading && !(sceneSets.data || []).length && <p className="tle-empty">No scene sets are linked to this episode. Link them on the episode's <Link to={`/episodes/${episodeId}`}>Overview</Link>.</p>}
            {(sceneSets.data || []).map((set) => (
              <div key={set.id} className="tle-set">
                <h3 className="tle-set-name">{set.name || 'Scene set'}</h3>
                <ul className="tle-grid">
                  {(set.angles || []).filter((a) => matches(`${set.name} ${a.angle_label || a.angle_name}`)).flatMap((a) => {
                    const withSet = { ...a, set_name: set.name };
                    const tiles = [];
                    if (a.still_image_url) tiles.push(<Tile key={`${a.id}-s`} kind="image" image={a.thumbnail_url || a.still_image_url} label={a.angle_label || a.angle_name || 'Angle'} meta="still" asset={assetOfAngle(withSet, 'angle_still')} {...place} />);
                    if (a.video_clip_url) tiles.push(<Tile key={`${a.id}-v`} kind="video" image={a.thumbnail_url || a.still_image_url} label={a.angle_label || a.angle_name || 'Angle'} meta="video" asset={assetOfAngle(withSet, 'angle_video')} {...place} />);
                    if (!tiles.length) tiles.push(<Tile key={a.id} kind="image" label={a.angle_label || a.angle_name || 'Angle'} meta="no media yet" />);
                    return tiles;
                  })}
                </ul>
              </div>
            ))}
          </>
        )}

        {tab === 'audio' && (
          <>
            <h3 className="tle-set-name">Dialogue: approved takes</h3>
            {takes.data && !takes.data.available && <p className="tle-empty">Voice Studio is switched off here, so there are no approved takes to show.</p>}
            {takes.error && <p className="tle-empty tle-error" role="alert">Takes could not be loaded: {takes.error}</p>}
            {takes.data?.available && !takeList.length && <p className="tle-empty">No approved takes yet. Record and approve them in <Link to={`/episodes/${episodeId}?tab=voice`}>Voice</Link>.</p>}
            <ul className="tle-list">
              {takeList.filter((t) => matches(`beat ${t.beat_number} line ${t.line_index + 1}`)).map((t) => (
                <Placeable key={t.approval_id} className="tle-list-row" asset={assetOfTake(t)} {...place}>
                  <AudioLines size={14} aria-hidden="true" /> Beat {t.beat_number} · line {t.line_index + 1}
                  <span className="tle-muted"> {duration(((t.out_ms || 0) - (t.in_ms || 0)) / 1000)}</span>
                </Placeable>
              ))}
            </ul>
            <h3 className="tle-set-name">Music and SFX</h3>
            <p className="tle-empty tle-pending">Pending: the music and SFX library with licence records (design R8.8). No sound is invented in its place.</p>
          </>
        )}

        {tab === 'text' && (
          <>
            <ul className="tle-list">
              {TEXT_STYLES.map((t) => (
                <li key={t.style_key} className={`tle-list-row${editable ? '' : ' is-disabled'}`}>
                  <button type="button" className="tle-btn tle-btn-small" disabled={!editable}
                    onClick={() => onPlace?.({ kind: 'caption', id: t.style_key, label: t.label, style_key: t.style_key, layout: t.layout })}>
                    <CirclePlus size={14} aria-hidden="true" /> Add {t.label.toLowerCase()}
                  </button>
                  <span className="tle-muted"> {t.hint}</span>
                </li>
              ))}
            </ul>
            <p className="tle-empty">Added at the playhead for {TEXT_MS / 1000} seconds on the Captions lane. Move and resize it in the preview; change its words, style and length in the inspector.</p>
            <p className="tle-empty tle-pending">The render draws them from the same text, place and style (D4): it waits for the render host (Gates 3–6).</p>
          </>
        )}

        {tab === 'transitions' && (
          <>
            <ul className="tle-list">
              {['Cut', 'Crossfade', 'Dip to black'].map((t) => <li key={t} className="tle-list-row is-disabled" aria-disabled="true">{t}</li>)}
            </ul>
            <p className="tle-empty tle-pending">Placing transitions waits for Gate 2, when the preview and the render can draw them (cut, crossfade, dip to black).</p>
          </>
        )}
      </div>
    </section>
  );
}
