/**
 * Templates › YouTube thumbnails (Evoni, 2026-10-17): make an episode's
 * 1280x720 YouTube thumbnail from its show's style. Pick the show and the
 * episode; the title, the show's name and "EP n" fill in. Choose the layout,
 * the background, Lala and JustAWoman. The pictures are in folders
 * (2026-10-21): Scene sets, Character poses (Lala, JustAWoman › Front, Back,
 * Side, Glamour; Lala's starred pose picked first), This episode's outfit,
 * Asset library and Documents; or upload one.
 * the colours and how dark the background is. The preview is rendered by
 * the server, so it is the file that is saved. Save makes it the episode's
 * primary thumbnail (Production's Thumbnail step); Save style keeps the
 * layout, colours and Lala for every episode of the show.
 *
 * ?show= and ?episode= open it on an episode (Production's Thumbnail step).
 *
 * The one place an episode's thumbnail is edited (Evoni, 2026-10-20): the
 * episode's saved thumbnails are listed under the preview, its current one
 * first; any of them can be made the episode's thumbnail again, and one that
 * is not current can be deleted. Every other page links here
 * (thumbnailStudioHref); /thumbnails/:episodeId redirects here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Youtube, Upload, Download, Save, Palette, ImageOff, Check, LayoutTemplate, Sparkles, Star, Trash2, History, Folder, ChevronRight } from 'lucide-react';
import {
  youtubeThumbnailsApi, LAYOUTS, ACCENTS, TEXT_COLORS, episodeWords, defaultPose, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import './YouTubeThumbnailStudio.css';

const PREVIEW_DELAY_MS = 500;

function PickButton({ it, value, upload, onPick }) {
  return (
    <button type="button" className={`yts-pick${value === it.url && !upload ? ' is-on' : ''}`} aria-pressed={value === it.url && !upload}
      onClick={() => onPick(it.url)} title={it.label}>
      <img src={it.url} alt={it.label || ''} loading="lazy" />
    </button>
  );
}

/**
 * A picture picker in folders (Evoni, 2026-10-21): None and Upload, where
 * it is ("All folders › Character poses › Lala"), the folders here, and the
 * pictures here. It opens in the first of `start` that has pictures (the
 * background in Scene sets, Lala in her poses); any folder is a click away.
 */
function FolderPicker({ title, tree, start, value, onPick, upload, onUpload, onNone, noneLabel, testid, whole = false }) {
  const inputRef = useRef(null);
  const startKey = firstFolder(tree, start);
  const [at, setAt] = useState(startKey);
  useEffect(() => { setAt(startKey); }, [startKey]);
  const path = folderPath(tree, at);
  const here = path.at(-1) || null;
  const folders = here ? (here.folders || []) : (tree || []);
  const items = here?.items || [];
  const grid = `yts-grid${whole ? ' is-whole' : ''}`;
  const none = (
    <button type="button" className={`yts-pick is-none${!value && !upload ? ' is-on' : ''}`} aria-pressed={!value && !upload} onClick={onNone}>
      <ImageOff size={18} aria-hidden /><span>{noneLabel}</span>
    </button>
  );
  const add = (
    <button type="button" className={`yts-pick is-upload${upload ? ' is-on' : ''}`} aria-pressed={Boolean(upload)} onClick={() => inputRef.current?.click()}>
      <Upload size={18} aria-hidden /><span>{upload ? upload.name : 'Upload'}</span>
    </button>
  );
  return (
    <fieldset className="yts-field" data-testid={testid}>
      <legend className="yts-label">{title}</legend>
      <div className={grid}>{none}{add}</div>
      <nav className="yts-crumbs" aria-label={`${title}: where you are`} data-testid={`${testid}-crumbs`}>
        <button type="button" onClick={() => setAt(null)} aria-current={here ? undefined : 'location'}>All folders</button>
        {path.map((f) => (
          <React.Fragment key={f.key}>
            <ChevronRight size={12} aria-hidden />
            <button type="button" onClick={() => setAt(f.key)} aria-current={f === here ? 'location' : undefined}>{f.label}</button>
          </React.Fragment>
        ))}
      </nav>
      {folders.length > 0 && (
        <div className="yts-folders">
          {folders.map((f) => {
            const cover = folderCover(f);
            const n = folderCount(f);
            return (
              <button key={f.key} type="button" className="yts-folder" onClick={() => setAt(f.key)} data-testid={`${testid}-folder-${f.key}`}
                aria-label={`${f.label}, ${n} ${n === 1 ? 'picture' : 'pictures'}`}>
                <span className="yts-folder-art">{cover ? <img src={cover} alt="" loading="lazy" /> : <Folder size={20} aria-hidden />}</span>
                <span className="yts-folder-name"><Folder size={12} aria-hidden /> {f.label}</span>
                <span className="yts-folder-count" aria-hidden>{n} {n === 1 ? 'picture' : 'pictures'}</span>
              </button>
            );
          })}
        </div>
      )}
      {items.length > 0 && (
        <div className={grid} data-testid={`${testid}-pictures`}>
          {items.map((it) => <PickButton key={it.url} it={it} value={value} upload={upload} onPick={onPick} />)}
        </div>
      )}
      {!folders.length && !items.length && <p className="yts-note">No pictures yet. Upload one.</p>}
      <input ref={inputRef} type="file" accept="image/*" hidden data-testid={`${testid}-input`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </fieldset>
  );
}

export default function YouTubeThumbnailStudio() {
  const [params, setParams] = useSearchParams();
  const [shows, setShows] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [showId, setShowId] = useState(params.get('show') || '');
  const [episodeId, setEpisodeId] = useState(params.get('episode') || '');
  const [sources, setSources] = useState(null);
  const [spec, setSpec] = useState(null);
  const [files, setFiles] = useState({ background: null, lala: null, jaw: null });
  const [preview, setPreview] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState([]);
  const renderId = useRef(0);

  // Shows, then the chosen show's episodes.
  useEffect(() => {
    youtubeThumbnailsApi.shows().then(setShows).catch((err) => {
      console.error('[YouTubeThumbnails] shows load failed:', err);
      setMessage({ type: 'error', text: 'Could not load the shows.' });
    });
  }, []);
  useEffect(() => {
    if (!showId) { setEpisodes([]); return; }
    youtubeThumbnailsApi.episodes(showId).then(setEpisodes).catch((err) => {
      console.error('[YouTubeThumbnails] episodes load failed:', err);
      setMessage({ type: 'error', text: 'Could not load the episodes.' });
    });
  }, [showId]);

  // The episode's pictures and its show's style.
  useEffect(() => {
    if (!episodeId) { setSources(null); setSpec(null); return; }
    let live = true;
    setSaved(null);
    youtubeThumbnailsApi.sources(episodeId).then((src) => {
      if (!live || !src) return;
      setSources(src);
      if (src.show?.id && src.show.id !== showId) setShowId(src.show.id);
      setFiles({ background: null, lala: null, jaw: null });
      setSpec({
        ...src.style,
        ...episodeWords(src.episode, src.show),
        backgroundUrl: src.backgrounds?.[0]?.url || null,
        // This episode's starred Lala pose first (her look changes each
        // episode), then the show's saved Lala, then the Asset Library's.
        lalaUrl: defaultPose(src.poses?.lala)?.url || src.style?.lalaUrl || src.cutouts?.[0]?.url || null,
        // JustAWoman joins only when picked.
        jawUrl: null,
      });
    }).catch((err) => {
      console.error('[YouTubeThumbnails] sources load failed:', err);
      if (live) setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not load the episode.' });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  // The episode's saved thumbnails, its current one first.
  const loadHistory = useCallback(async (id) => {
    if (!id) { setHistory([]); return; }
    try {
      setHistory(await youtubeThumbnailsApi.saved(id));
    } catch (err) {
      console.error('[YouTubeThumbnails] saved thumbnails load failed:', err);
      setHistory([]);
      setMessage({ type: 'error', text: 'Could not load the saved thumbnails.' });
    }
  }, []);
  useEffect(() => { loadHistory(episodeId); }, [episodeId, loadHistory]);

  // The preview, a moment after the last change; an older render never replaces a newer one.
  useEffect(() => {
    if (!spec || !spec.title?.trim()) return undefined;
    const id = ++renderId.current;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const blob = await youtubeThumbnailsApi.render(spec, files);
        if (id !== renderId.current) return;
        setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        setMessage((m) => (m?.type === 'error' ? null : m));
      } catch (err) {
        console.error('[YouTubeThumbnails] preview failed:', err);
        if (id === renderId.current) setMessage({ type: 'error', text: 'The preview could not be made. Check the pictures.' });
      } finally {
        if (id === renderId.current) setRendering(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(t);
  }, [spec, files]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = useCallback((patch) => { setSpec((s) => ({ ...s, ...patch })); setSaved(null); }, []);
  const pickShow = (id) => { setShowId(id); setEpisodeId(''); setParams(id ? { show: id } : {}); };
  const pickEpisode = (id) => { setEpisodeId(id); setParams(id ? { show: showId, episode: id } : { show: showId }); };

  const save = async () => {
    setBusy(true);
    try {
      const out = await youtubeThumbnailsApi.save(episodeId, spec, files);
      setSaved(out);
      setMessage({ type: 'ok', text: "Saved as the episode's thumbnail." });
      loadHistory(episodeId);
    } catch (err) {
      console.error('[YouTubeThumbnails] save failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The thumbnail could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const makeCurrent = async (thumb) => {
    setBusy(true);
    try {
      await youtubeThumbnailsApi.makePrimary(episodeId, thumb.id);
      setMessage({ type: 'ok', text: "That one is the episode's thumbnail again." });
      await loadHistory(episodeId);
    } catch (err) {
      console.error('[YouTubeThumbnails] make current failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not change the thumbnail.' });
    } finally {
      setBusy(false);
    }
  };

  const removeSaved = async (thumb) => {
    if (!window.confirm('Delete this saved thumbnail? This cannot be undone.')) return;
    setBusy(true);
    try {
      await youtubeThumbnailsApi.removeSaved(episodeId, thumb.id);
      setHistory((h) => h.filter((t) => t.id !== thumb.id));
    } catch (err) {
      console.error('[YouTubeThumbnails] delete failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not delete the thumbnail.' });
    } finally {
      setBusy(false);
    }
  };

  const saveStyle = async () => {
    if (!sources?.show?.id) return;
    setBusy(true);
    try {
      // An episode's pose is that episode's look: the show keeps its own Lala.
      const isPose = (sources?.poses?.lala || []).some((p) => p.url === spec.lalaUrl);
      const lalaUrl = files.lala ? null : isPose ? (sources?.style?.lalaUrl || null) : spec.lalaUrl;
      const style = { layout: spec.layout, accent: spec.accent, textColor: spec.textColor, dim: spec.dim, lalaUrl };
      await youtubeThumbnailsApi.saveStyle(sources.show.id, style);
      setMessage({ type: 'ok', text: `Style saved for ${sources.show.name}: every episode starts from it.` });
    } catch (err) {
      console.error('[YouTubeThumbnails] style save failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The style could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const fileName = useMemo(() => {
    const n = sources?.episode?.episode_number;
    return `${(sources?.show?.name || 'thumbnail').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${n ? `-ep${n}` : ''}.png`;
  }, [sources]);

  return (
    <div className="yts">
      <header className="yts-banner">
        <div>
          <p className="yts-kicker"><Link to="/template-studio">Templates</Link> · YouTube</p>
          <h1 className="yts-title"><Youtube size={30} aria-hidden /> YouTube thumbnails</h1>
          <p className="yts-sub">Each episode's thumbnail, from its show's style. 1280 × 720.</p>
        </div>
        <div className="yts-choose">
          <label className="yts-select">
            <span>Show</span>
            <select value={showId} onChange={(e) => pickShow(e.target.value)} aria-label="Show">
              <option value="">Choose a show</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="yts-select">
            <span>Episode</span>
            <select value={episodeId} onChange={(e) => pickEpisode(e.target.value)} aria-label="Episode" disabled={!showId}>
              <option value="">Choose an episode</option>
              {episodes.map((e) => <option key={e.id} value={e.id}>{e.episode_number ? `${e.episode_number}. ` : ''}{e.title || 'Untitled'}</option>)}
            </select>
          </label>
        </div>
      </header>

      {message && <p className={`yts-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {!spec ? (
        <div className="yts-empty"><LayoutTemplate size={36} aria-hidden /><p>Choose a show and an episode to make its thumbnail.</p></div>
      ) : (
        <>
        <div className="yts-work">
          <section className="yts-stage" aria-label="Preview">
            <div className={`yts-preview${rendering ? ' is-rendering' : ''}`}>
              {preview ? <img src={preview} alt="Thumbnail preview" data-testid="yts-preview" /> : <span className="yts-note">Making the preview…</span>}
            </div>
            <div className="yts-actions">
              <button type="button" className="yts-btn is-primary" onClick={save} disabled={busy || !spec.title?.trim()} data-testid="yts-save">
                <Save size={16} aria-hidden /> Save as episode thumbnail
              </button>
              <button type="button" className="yts-btn" onClick={saveStyle} disabled={busy || !sources?.show?.id} data-testid="yts-save-style">
                <Palette size={16} aria-hidden /> Save style for {sources?.show?.name || 'the show'}
              </button>
              {preview && <a className="yts-btn" href={preview} download={fileName}><Download size={16} aria-hidden /> Download</a>}
            </div>
            {saved && (
              <p className="yts-saved"><Check size={16} aria-hidden /> Saved. <Link to={`/episodes/${episodeId}?tab=production`}>Back to Production</Link></p>
            )}
          </section>

          <section className="yts-panel" aria-label="Thumbnail settings">
            <fieldset className="yts-field">
              <legend className="yts-label">Layout</legend>
              <div className="yts-layouts">
                {LAYOUTS.map((l) => (
                  <button key={l.key} type="button" className={`yts-layout is-${l.key}${spec.layout === l.key ? ' is-on' : ''}`} aria-pressed={spec.layout === l.key} onClick={() => set({ layout: l.key })}>
                    <span className="yts-layout-art" aria-hidden><i /><b /></span>{l.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="yts-field">
              <span className="yts-label">Title</span>
              <input className="yts-input" value={spec.title} maxLength={90} onChange={(e) => set({ title: e.target.value })} aria-label="Title" />
            </label>
            <div className="yts-row">
              <label className="yts-field">
                <span className="yts-label">Show name line</span>
                <input className="yts-input" value={spec.kicker} maxLength={48} onChange={(e) => set({ kicker: e.target.value })} aria-label="Show name line" />
              </label>
              <label className="yts-field is-small">
                <span className="yts-label">Badge</span>
                <input className="yts-input" value={spec.badge} maxLength={12} onChange={(e) => set({ badge: e.target.value })} aria-label="Badge" />
              </label>
            </div>

            <FolderPicker title="Background" testid="yts-backgrounds" tree={sources?.folders} start={['scene-sets']} value={spec.backgroundUrl} upload={files.background}
              noneLabel="Plain" onPick={(url) => { setFiles((f) => ({ ...f, background: null })); set({ backgroundUrl: url }); }}
              onUpload={(f) => { setFiles((x) => ({ ...x, background: f })); setSaved(null); }}
              onNone={() => { setFiles((f) => ({ ...f, background: null })); set({ backgroundUrl: null }); }} />

            {spec.layout !== 'center' && (
              <FolderPicker title="Lala" testid="yts-lala" whole value={spec.lalaUrl} upload={files.lala}
                tree={sources?.folders} start={['poses/lala', 'library/lala']}
                noneLabel="No Lala" onPick={(url) => { setFiles((f) => ({ ...f, lala: null })); set({ lalaUrl: url }); }}
                onUpload={(f) => { setFiles((x) => ({ ...x, lala: f })); setSaved(null); }}
                onNone={() => { setFiles((f) => ({ ...f, lala: null })); set({ lalaUrl: null }); }} />
            )}
            {spec.layout !== 'center' && (
              <FolderPicker title="JustAWoman" testid="yts-jaw" whole value={spec.jawUrl} upload={files.jaw}
                tree={sources?.folders} start={['poses/justawoman']}
                noneLabel="No JustAWoman" onPick={(url) => { setFiles((f) => ({ ...f, jaw: null })); set({ jawUrl: url }); }}
                onUpload={(f) => { setFiles((x) => ({ ...x, jaw: f })); setSaved(null); }}
                onNone={() => { setFiles((f) => ({ ...f, jaw: null })); set({ jawUrl: null }); }} />
            )}
            {spec.layout !== 'center' && !(sources?.poses?.lala || []).length && !(sources?.poses?.justawoman || []).length && (
              <p className="yts-note" data-testid="yts-poses-note"><Sparkles size={14} aria-hidden /> Add Lala and JustAWoman photos on the episode's <Link to={`/episodes/${episodeId}?tab=files`}>Files tab</Link>, labelled by pose; they show here once their background is removed. Or upload a PNG cut-out.</p>
            )}

            <fieldset className="yts-field">
              <legend className="yts-label">Accent</legend>
              <div className="yts-swatches">
                {ACCENTS.map((c) => (
                  <button key={c} type="button" className={`yts-swatch${spec.accent === c ? ' is-on' : ''}`} style={{ background: c }}
                    aria-label={`Accent ${c}`} aria-pressed={spec.accent === c} onClick={() => set({ accent: c })} />
                ))}
              </div>
            </fieldset>
            <div className="yts-row">
              <label className="yts-field">
                <span className="yts-label">Title colour</span>
                <select className="yts-input" value={spec.textColor} onChange={(e) => set({ textColor: e.target.value })} aria-label="Title colour">
                  {TEXT_COLORS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="yts-field">
                <span className="yts-label">Darken the background</span>
                <input type="range" min="0" max="0.8" step="0.05" value={spec.dim} onChange={(e) => set({ dim: Number(e.target.value) })} aria-label="Darken the background" />
              </label>
            </div>
          </section>
        </div>
        {history.length > 0 && (
          <section className="yts-history" aria-label="Saved thumbnails" data-testid="yts-history">
            <h2 className="yts-label"><History size={14} aria-hidden /> Saved thumbnails</h2>
            <ul className="yts-history-grid">
              {history.map((t) => (
                <li key={t.id} className={`yts-history-item${t.isPrimary ? ' is-current' : ''}`} data-testid={`yts-saved-${t.id}`}>
                  <img src={t.url} alt={t.isPrimary ? "The episode's thumbnail" : 'An earlier thumbnail'} loading="lazy" />
                  <div className="yts-history-row">
                    {t.isPrimary ? (
                      <span className="yts-history-badge"><Star size={13} aria-hidden /> Episode thumbnail</span>
                    ) : (
                      <>
                        <button type="button" className="yts-history-btn" onClick={() => makeCurrent(t)} disabled={busy}>
                          <Star size={13} aria-hidden /> Use this one
                        </button>
                        <button type="button" className="yts-history-btn is-danger" onClick={() => removeSaved(t)} disabled={busy} aria-label="Delete this saved thumbnail">
                          <Trash2 size={13} aria-hidden />
                        </button>
                      </>
                    )}
                    {t.savedAt && <span className="yts-history-date">{new Date(t.savedAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
      )}
    </div>
  );
}
