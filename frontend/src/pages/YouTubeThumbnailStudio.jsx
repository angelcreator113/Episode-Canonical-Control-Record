/**
 * Templates › YouTube thumbnails (Evoni, 2026-10-17): make an episode's
 * 1280x720 YouTube thumbnail from its show's style. Pick the show and the
 * episode; the title, the show's name and "EP n" fill in. Choose the layout,
 * the background (the episode's scene angles, the show cover, or an upload),
 * the Lala cut-out (the show's background-removed images, or an upload),
 * the colours and how dark the background is. The preview is rendered by
 * the server, so it is the file that is saved. Save makes it the episode's
 * primary thumbnail (Production's Thumbnail step); Save style keeps the
 * layout, colours and Lala for every episode of the show.
 *
 * ?show= and ?episode= open it on an episode (Production's Thumbnail step).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Youtube, Upload, Download, Save, Palette, ImageOff, Check, LayoutTemplate, Sparkles } from 'lucide-react';
import { youtubeThumbnailsApi, LAYOUTS, ACCENTS, TEXT_COLORS, episodeWords } from '../lib/youtubeThumbnailsApi';
import './YouTubeThumbnailStudio.css';

const PREVIEW_DELAY_MS = 500;

function Picker({ title, items, value, onPick, upload, onUpload, onNone, noneLabel, testid, whole = false }) {
  const inputRef = useRef(null);
  return (
    <fieldset className="yts-field" data-testid={testid}>
      <legend className="yts-label">{title}</legend>
      <div className={`yts-grid${whole ? ' is-whole' : ''}`}>
        <button type="button" className={`yts-pick is-none${!value && !upload ? ' is-on' : ''}`} aria-pressed={!value && !upload} onClick={onNone}>
          <ImageOff size={18} aria-hidden /><span>{noneLabel}</span>
        </button>
        {items.map((it) => (
          <button key={it.url} type="button" className={`yts-pick${value === it.url && !upload ? ' is-on' : ''}`} aria-pressed={value === it.url && !upload}
            onClick={() => onPick(it.url)} title={it.label}>
            <img src={it.url} alt={it.label || ''} loading="lazy" />
          </button>
        ))}
        <button type="button" className={`yts-pick is-upload${upload ? ' is-on' : ''}`} aria-pressed={Boolean(upload)} onClick={() => inputRef.current?.click()}>
          <Upload size={18} aria-hidden /><span>{upload ? upload.name : 'Upload'}</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" hidden data-testid={`${testid}-input`}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </div>
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
  const [files, setFiles] = useState({ background: null, lala: null });
  const [preview, setPreview] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [saved, setSaved] = useState(null);
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
      setFiles({ background: null, lala: null });
      setSpec({
        ...src.style,
        ...episodeWords(src.episode, src.show),
        backgroundUrl: src.backgrounds?.[0]?.url || null,
        lalaUrl: src.style?.lalaUrl || src.cutouts?.[0]?.url || null,
      });
    }).catch((err) => {
      console.error('[YouTubeThumbnails] sources load failed:', err);
      if (live) setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not load the episode.' });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

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
    } catch (err) {
      console.error('[YouTubeThumbnails] save failed:', err);
      setMessage({ type: 'error', text: err?.response?.data?.error || 'The thumbnail could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const saveStyle = async () => {
    if (!sources?.show?.id) return;
    setBusy(true);
    try {
      const style = { layout: spec.layout, accent: spec.accent, textColor: spec.textColor, dim: spec.dim, lalaUrl: files.lala ? null : spec.lalaUrl };
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
              <p className="yts-saved"><Check size={16} aria-hidden /> Saved. <Link to={`/thumbnails/${episodeId}`}>Open the thumbnail gallery</Link> · <Link to={`/episodes/${episodeId}?tab=production`}>Back to Production</Link></p>
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

            <Picker title="Background" testid="yts-backgrounds" items={sources?.backgrounds || []} value={spec.backgroundUrl} upload={files.background}
              noneLabel="Plain" onPick={(url) => { setFiles((f) => ({ ...f, background: null })); set({ backgroundUrl: url }); }}
              onUpload={(f) => { setFiles((x) => ({ ...x, background: f })); setSaved(null); }}
              onNone={() => { setFiles((f) => ({ ...f, background: null })); set({ backgroundUrl: null }); }} />

            {spec.layout !== 'center' && (
              <Picker title="Lala" testid="yts-lala" whole items={sources?.cutouts || []} value={spec.lalaUrl} upload={files.lala}
                noneLabel="No Lala" onPick={(url) => { setFiles((f) => ({ ...f, lala: null })); set({ lalaUrl: url }); }}
                onUpload={(f) => { setFiles((x) => ({ ...x, lala: f })); setSaved(null); }}
                onNone={() => { setFiles((f) => ({ ...f, lala: null })); set({ lalaUrl: null }); }} />
            )}
            {spec.layout !== 'center' && !(sources?.cutouts || []).length && (
              <p className="yts-note"><Sparkles size={14} aria-hidden /> Lala images with their background removed (Asset Library) show here; or upload a PNG cut-out.</p>
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
      )}
    </div>
  );
}
