/**
 * A whole season at once (Templates › YouTube thumbnails; Evoni,
 * 2026-10-21): one of the show's templates filled with each episode's words
 * and pictures (episodeContent, as the Studio does when an episode opens),
 * drawn small in a grid with how each reads at YouTube's sizes; the ones
 * ticked are saved as each episode's thumbnail, and kept as its
 * arrangement so the editor opens on it. Episodes that already have a
 * thumbnail are left out unless asked for; an episode's own arrangement is
 * used where it has one, unless asked not to.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, LayoutGrid, Pencil, RefreshCw, Save, TriangleAlert, X } from 'lucide-react';
import { youtubeThumbnailsApi, episodeContent, downloadBlob } from '../../lib/youtubeThumbnailsApi';
import { fillTemplate, presetLayers, youtubeWarnings, measurer, loadThumbnailFonts } from '../../lib/thumbnailLayers';

// Two at a time: quick enough, and gentle on the server that draws them.
const AT_ONCE = 2;
const LAYOUT = 'layout';

// "S2 · E1. Title" for an episode in the season's slots; "3. Title" for one in no slot.
const label = (e) => `${e.label ? `${e.label}. ` : e.episode_number || e.episode_number === 0 ? `${e.episode_number}. ` : ''}${e.title || 'Untitled'}`;
const reason = (err, fallback) => err?.response?.data?.error || fallback;

/** Runs work(item) for each item, AT_ONCE at a time; stops early when live() is false. */
async function eachAtOnce(items, work, live) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && live()) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
}

/** One episode in the grid: its picture, how it reads, tick to save, open it in the editor. */
function SeasonCard({ episode, card, onPick, onOpen }) {
  const state = card?.state || 'waiting';
  return (
    <li className={`yts-season-card is-${state}`} data-testid={`yts-season-${episode.id}`}>
      <div className="yts-season-picture">
        {card?.url ? <img src={card.url} alt={`${label(episode)}, as it would be saved`} />
          : <span className="yts-season-wait">{state === 'failed' ? 'Could not draw it' : state === 'drawing' ? 'Drawing…' : 'Not drawn yet'}</span>}
      </div>
      <p className="yts-season-name">{label(episode)}</p>
      {card?.from && <p className="yts-note">{card.from}</p>}
      {episode.thumbnailUrl && state !== 'saved' && <p className="yts-note">Has a thumbnail: saving replaces it (the old one is kept).</p>}
      {card?.error && <p className="yts-season-error" role="alert">{card.error}</p>}
      {card?.warnings != null && (
        <p className={`yts-note${card.warnings ? ' is-warn' : ''}`}>
          {card.warnings ? <><TriangleAlert size={14} aria-hidden /> {card.warnings} {card.warnings === 1 ? 'warning' : 'warnings'}: open it to fix</> : <><Check size={14} aria-hidden /> Reads at every size</>}
        </p>
      )}
      <div className="yts-season-actions">
        {state === 'saved' ? <span className="yts-season-saved"><Check size={15} aria-hidden /> Saved</span> : (
          <label className="yts-check">
            <input type="checkbox" checked={Boolean(card?.picked)} disabled={state !== 'ready'} onChange={(e) => onPick(e.target.checked)} />
            Save this one
          </label>
        )}
        <button type="button" className="yts-btn" onClick={onOpen}><Pencil size={15} aria-hidden /> Open in the editor</button>
      </div>
    </li>
  );
}

export default function ThumbnailSeason({ showId, onOpenEpisode, onClose }) {
  const [episodes, setEpisodes] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [keepOwn, setKeepOwn] = useState(true);
  const [withDone, setWithDone] = useState(false);
  const [cards, setCards] = useState({});
  const [running, setRunning] = useState(null); // 'drawing' | 'saving' | null
  const [message, setMessage] = useState(null);
  const run = useRef(0);
  const urls = useRef([]);

  const setCard = (id, patch) => setCards((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  const forget = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setCards({});
  };

  useEffect(() => () => { run.current += 1; urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  useEffect(() => {
    let live = true;
    setEpisodes(null);
    setMessage(null);
    forget();
    Promise.all([youtubeThumbnailsApi.season(showId), youtubeThumbnailsApi.templates(showId)]).then(([eps, list]) => {
      if (!live) return;
      const usable = (list || []).filter((t) => t.spec);
      setEpisodes(eps);
      setTemplates(usable);
      setTemplateId((usable.find((t) => t.isDefault) || usable[0])?.id || LAYOUT);
    }).catch((err) => {
      console.error('[ThumbnailSeason] the season did not load:', err);
      if (live) {
        setEpisodes([]);
        setMessage({ type: 'error', text: reason(err, 'Could not load the season.') });
      }
    });
    return () => { live = false; };
  }, [showId]);

  // What is drawn: the episodes without a thumbnail (or all, when asked). One
  // saved here stays in the grid, marked Saved, until the season is drawn again.
  const toDraw = useMemo(() => (episodes || []).filter((e) => withDone || !e.thumbnailUrl), [episodes, withDone]);
  const listed = useMemo(() => (episodes || []).filter((e) => toDraw.includes(e) || cards[e.id]?.state === 'saved'), [episodes, toDraw, cards]);
  const template = templates.find((t) => t.id === templateId) || null;
  const ready = listed.filter((e) => cards[e.id]?.state === 'ready');
  const picked = ready.filter((e) => cards[e.id]?.picked);

  // A different template, or which episodes, starts the grid again.
  const choose = (fn) => { run.current += 1; setRunning(null); forget(); setMessage(null); fn(); };

  /** The layers for one episode: its own arrangement, else the template (or the show's layout) with its words and pictures. */
  const layersFor = (src) => {
    if (keepOwn && src.draft) {
      const { savedAt, ...own } = src.draft;
      return { spec: own, own: true, from: 'Its own arrangement' };
    }
    if (template) return { spec: fillTemplate(template.spec, episodeContent(src)), own: false, from: `From "${template.name}"` };
    const look = { layout: src.style?.layout || 'lala-left', accent: src.style?.accent, textColor: src.style?.textColor, dim: src.style?.dim };
    return { spec: presetLayers(look.layout, episodeContent(src), look), own: false, from: 'From the show\'s layout' };
  };

  const draw = async () => {
    const mine = run.current + 1;
    run.current = mine;
    const live = () => run.current === mine;
    forget();
    setMessage(null);
    setRunning('drawing');
    await loadThumbnailFonts();
    await eachAtOnce(toDraw, async (e) => {
      setCard(e.id, { state: 'drawing' });
      try {
        const src = await youtubeThumbnailsApi.sources(e.id);
        const { spec, own, from } = layersFor(src);
        const blob = await youtubeThumbnailsApi.renderSmall(spec);
        if (!live()) return;
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setCard(e.id, { state: 'ready', url, spec, own, from, picked: true, warnings: youtubeWarnings(spec, measurer).length });
      } catch (err) {
        console.error(`[ThumbnailSeason] episode ${e.id} did not draw:`, err);
        if (live()) setCard(e.id, { state: 'failed', error: reason(err, 'Could not draw it. Check its pictures.') });
      }
    }, live);
    if (live()) setRunning(null);
  };

  // The ticked ones in one zip, full size as they would be saved (Evoni, 2026-10-22).
  const zipPicked = async () => {
    setRunning('zipping');
    setMessage(null);
    try {
      const blob = await youtubeThumbnailsApi.zip('season', picked.map((e) => ({ name: label(e), spec: cards[e.id].spec })));
      downloadBlob(blob, 'season.zip');
      setMessage({ type: 'ok', text: `${picked.length} ${picked.length === 1 ? 'thumbnail' : 'thumbnails'} in season.zip.` });
    } catch (err) {
      console.error('[ThumbnailSeason] zip failed:', err);
      setMessage({ type: 'error', text: reason(err, 'The zip could not be made.') });
    } finally {
      setRunning(null);
    }
  };

  const save = async () => {
    const mine = run.current + 1;
    run.current = mine;
    setRunning('saving');
    setMessage(null);
    let done = 0;
    let failed = 0;
    for (const e of picked) {
      if (run.current !== mine) return;
      const { spec, own } = cards[e.id];
      setCard(e.id, { state: 'saving', error: null });
      try {
        const saved = await youtubeThumbnailsApi.save(e.id, spec);
        // Kept as its arrangement too, so the editor opens on what was saved.
        if (!own) {
          try {
            await youtubeThumbnailsApi.saveDraft(e.id, spec);
          } catch (err) {
            console.error(`[ThumbnailSeason] episode ${e.id} saved, its arrangement not kept:`, err);
          }
        }
        done += 1;
        setCard(e.id, { state: 'saved' });
        setEpisodes((list) => list.map((x) => (x.id === e.id ? { ...x, thumbnailUrl: saved?.url || x.thumbnailUrl, hasDraft: true } : x)));
      } catch (err) {
        console.error(`[ThumbnailSeason] episode ${e.id} did not save:`, err);
        failed += 1;
        setCard(e.id, { state: 'ready', error: reason(err, 'Could not save it.') });
      }
    }
    if (run.current !== mine) return;
    setRunning(null);
    const n = (k) => `${k} ${k === 1 ? 'thumbnail' : 'thumbnails'}`;
    setMessage(failed
      ? { type: 'error', text: `Saved ${n(done)}; ${failed} could not be saved (see ${failed === 1 ? 'its card' : 'their cards'}).` }
      : { type: 'ok', text: `Saved ${n(done)}. Each is now its episode's thumbnail.` });
  };

  const drawn = listed.filter((e) => cards[e.id]).length;
  const noneLeft = episodes && !listed.length;

  return (
    <section className="yts-panel yts-season" aria-label="Whole season" data-testid="yts-season">
      <header className="yts-season-head">
        <h2 className="yts-label"><LayoutGrid size={18} aria-hidden /> Whole season</h2>
        <p className="yts-note">One template on every episode: check them here, save the ones you like.</p>
        <button type="button" className="yts-btn" onClick={onClose}><X size={15} aria-hidden /> Back to one episode</button>
      </header>

      <div className="yts-season-controls">
        <label className="yts-select">
          <span>Template</span>
          <select value={templateId} onChange={(e) => choose(() => setTemplateId(e.target.value))} aria-label="Template for the season" disabled={!episodes || Boolean(running)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
            <option value={LAYOUT}>The show's layout</option>
          </select>
        </label>
        <label className="yts-check">
          <input type="checkbox" checked={keepOwn} disabled={Boolean(running)} onChange={(e) => { const v = e.target.checked; choose(() => setKeepOwn(v)); }} />
          Keep an episode's own arrangement where it has one
        </label>
        <label className="yts-check">
          <input type="checkbox" checked={withDone} disabled={Boolean(running)} onChange={(e) => { const v = e.target.checked; choose(() => setWithDone(v)); }} />
          Include episodes that already have a thumbnail
        </label>
      </div>

      {message && <div className={`yts-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}><span>{message.text}</span></div>}

      {!episodes ? (
        <div className="yts-empty" role="status"><span className="yts-spinner" aria-hidden /><p>Loading the season…</p></div>
      ) : noneLeft ? (
        <div className="yts-empty"><Check size={32} aria-hidden /><p>{(episodes || []).length ? 'Every episode has a thumbnail.' : 'This show has no episodes yet.'}</p></div>
      ) : (
        <>
          <div className="yts-season-bar">
            {toDraw.length > 0 && (
              <button type="button" className="yts-btn is-primary" onClick={draw} disabled={Boolean(running)} data-testid="yts-season-draw">
                {drawn ? <RefreshCw size={15} aria-hidden /> : <LayoutGrid size={15} aria-hidden />}
                {running === 'drawing' ? `Drawing ${drawn} of ${toDraw.length}…` : `${drawn ? 'Draw again' : 'Draw'} ${toDraw.length} ${toDraw.length === 1 ? 'episode' : 'episodes'}`}
              </button>
            )}
            {ready.length > 0 && (
              <>
                <button type="button" className="yts-btn" onClick={() => setCards((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.state === 'ready' ? { ...v, picked: picked.length < ready.length } : v])))} disabled={Boolean(running)}>
                  {picked.length < ready.length ? 'Tick all' : 'Untick all'}
                </button>
                <button type="button" className="yts-btn is-primary" onClick={save} disabled={!picked.length || Boolean(running)} data-testid="yts-season-save">
                  <Save size={15} aria-hidden /> {running === 'saving' ? 'Saving…' : `Save ${picked.length} picked`}
                </button>
                <button type="button" className="yts-btn" onClick={zipPicked} disabled={!picked.length || Boolean(running)} data-testid="yts-season-zip">
                  <Download size={15} aria-hidden /> {running === 'zipping' ? 'Making the zip…' : `Download ${picked.length} as a zip`}
                </button>
              </>
            )}
          </div>
          <ul className="yts-season-grid">
            {listed.map((e) => (
              <SeasonCard key={e.id} episode={e} card={cards[e.id]} onPick={(v) => setCard(e.id, { picked: v })} onOpen={() => onOpenEpisode(e.id)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
