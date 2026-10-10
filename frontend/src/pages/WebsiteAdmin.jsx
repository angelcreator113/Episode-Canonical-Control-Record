/**
 * Website (Task #2822): where Evoni uploads, previews and publishes the
 * public landing page's images and video. Admin routes from #2821
 * (/api/v1/website-slots, sign-in plus the admin role). Only Published items
 * appear on the site; a spot with nothing published uses the built-in image.
 *
 * Sections: Hero; Flagship and world (Lala art and the three pillars);
 * Featured production (a YouTube link or a clip of 30 seconds or less, its
 * poster frame, and captions for a clip with speech); Inside Prime Studios
 * (the four brand cards; Fashion as Storytelling can use an approved style
 * sheet instead); Brand (the logo).
 *
 * Each card: preview, status pill (Published, Draft, Default, Empty), alt
 * text (required to publish), Upload/Replace, Publish/Unpublish and
 * Preview on site. Uploads are off until the public site storage is set up
 * (the server answers 503 SITE_STORAGE_NOT_CONFIGURED); YouTube links work.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, FileImage, Loader2, Upload, Youtube } from 'lucide-react';
import api from '../services/api';
import './WebsiteAdmin.css';

const BASE = '/api/v1/website-slots';
export const websiteApi = {
  list: () => api.get(BASE).then((r) => r.data?.data),
  upload: (slot, file, kind = 'media') => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`${BASE}/${slot}/${kind}`, form).then((r) => r.data?.data);
  },
  youtube: (slot, url) => api.put(`${BASE}/${slot}/youtube`, { url }).then((r) => r.data?.data),
  details: (slot, body) => api.patch(`${BASE}/${slot}`, body).then((r) => r.data?.data),
  publish: (slot) => api.post(`${BASE}/${slot}/publish`).then((r) => r.data?.data),
  unpublish: (slot) => api.post(`${BASE}/${slot}/unpublish`).then((r) => r.data?.data),
};

// Where each slot shows on the site, for "Preview on site".
const SITE_ANCHOR = {
  hero: 'site-main', flagship_lala: 'flagship', pillar_fashion: 'our-world', pillar_characters: 'our-world', pillar_places: 'our-world',
  featured_video: 'featured-production', brand_world: 'inside-prime-studios', brand_books: 'inside-prime-studios',
  brand_studio: 'inside-prime-studios', brand_fashion: 'inside-prime-studios', logo: 'site-main',
};
// Slots the site draws something for when nothing is published.
const HAS_BUILT_IN = new Set(['hero', 'featured_video', 'logo']);

export const SECTIONS = [
  { id: 'hero', title: 'Hero', slots: [['hero', 'Hero image (the LalaVerse map)']] },
  { id: 'world', title: 'Flagship and world', slots: [
    ['flagship_lala', 'Lala art (flagship show)'], ['pillar_fashion', 'Fashion With Meaning'],
    ['pillar_characters', 'Characters With Lives'], ['pillar_places', 'Places Worth Exploring'],
  ] },
  { id: 'featured', title: 'Featured production', slots: [['featured_video', 'Featured video']] },
  { id: 'studio', title: 'Inside Prime Studios', slots: [
    ['brand_world', 'A World of Its Own'], ['brand_books', 'The Book Series'],
    ['brand_studio', 'Made in Our Own Studio'], ['brand_fashion', 'Fashion as Storytelling'],
  ] },
  { id: 'brand', title: 'Brand', slots: [['logo', 'Logo']] },
];

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';
const hasMedia = (s) => Boolean(s?.url || s?.youtube_id);

/** Published, Draft, Default (the site has a built-in) or Empty. */
export function slotStatus(slot) {
  if (hasMedia(slot)) return slot.status === 'published' ? 'Published' : 'Draft';
  return HAS_BUILT_IN.has(slot.slot_key) ? 'Default' : 'Empty';
}

function FilePick({ label, accept, onFile, disabled, icon: Icon = Upload }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className="wsa-btn" disabled={disabled} onClick={() => ref.current?.click()}>
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
      <input ref={ref} type="file" accept={accept} hidden aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
    </>
  );
}

function AltField({ slot, disabled, onSave }) {
  const [draft, setDraft] = useState(slot.alt_text || '');
  useEffect(() => { setDraft(slot.alt_text || ''); }, [slot.alt_text]);
  const id = `wsa-alt-${slot.slot_key}`;
  return (
    <label className="wsa-field" htmlFor={id}>
      <span>Alt text (required to publish)</span>
      <input id={id} type="text" maxLength={300} value={draft} disabled={disabled} placeholder="Describe the image for people who can't see it"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (slot.alt_text || '')) onSave(draft); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}

function Preview({ slot }) {
  if (slot.media_type === 'video_clip' && slot.url) {
    return <video src={slot.url} poster={slot.poster_url || undefined} controls preload="metadata" aria-label={slot.alt_text || 'Clip'} />;
  }
  if (slot.media_type === 'youtube') {
    // Nothing loads from YouTube here either: the poster, or the video id.
    return slot.poster_url
      ? <img src={slot.poster_url} alt={slot.alt_text || 'Video poster'} />
      : <span className="wsa-preview-empty"><Youtube size={22} aria-hidden="true" /> YouTube video {slot.youtube_id}</span>;
  }
  if (slot.url) return <img src={slot.url} alt={slot.alt_text || ''} />;
  return <span className="wsa-preview-empty">{HAS_BUILT_IN.has(slot.slot_key) ? 'Using the built-in design' : 'Nothing here yet'}</span>;
}

function SlotCard({ slot, label, storageReady, busy, run, extra }) {
  const status = slotStatus(slot);
  const allowsClip = slot.allowed_media.includes('video_clip');
  const allowsImage = slot.allowed_media.includes('image');
  const live = slot.status === 'published';
  return (
    <article className="wsa-card" data-testid={`wsa-slot-${slot.slot_key}`}>
      <header className="wsa-card-head">
        <h3>{label}</h3>
        <span className={`wsa-pill is-${status.toLowerCase()}`} data-testid={`wsa-status-${slot.slot_key}`}>{status}</span>
      </header>
      <div className="wsa-preview"><Preview slot={slot} /></div>
      <AltField slot={slot} disabled={busy} onSave={(v) => run(() => websiteApi.details(slot.slot_key, { alt_text: v }))} />
      {extra}
      <div className="wsa-actions">
        {(allowsImage || allowsClip) && (
          <FilePick
            label={`${hasMedia(slot) && slot.media_type !== 'youtube' ? 'Replace' : 'Upload'}${allowsClip && allowsImage ? ' image or clip' : allowsClip ? ' clip' : ''}`}
            accept={[allowsImage && 'image/png,image/jpeg,image/webp', allowsClip && 'video/mp4'].filter(Boolean).join(',')}
            disabled={busy || !storageReady}
            onFile={(f) => run(() => websiteApi.upload(slot.slot_key, f))}
          />
        )}
        {live ? (
          <button type="button" className="wsa-btn" disabled={busy} onClick={() => run(() => websiteApi.unpublish(slot.slot_key))}>Unpublish</button>
        ) : (
          <button type="button" className="wsa-btn wsa-btn-primary" disabled={busy || !hasMedia(slot)} onClick={() => run(() => websiteApi.publish(slot.slot_key))}>Publish</button>
        )}
        <Link className="wsa-btn wsa-btn-quiet" to={`/site-preview?drafts=1#${SITE_ANCHOR[slot.slot_key]}`} target="_blank" rel="noopener">
          <Eye size={16} aria-hidden="true" /> Preview on site
        </Link>
      </div>
    </article>
  );
}

// Featured production: a YouTube link or a 30-second clip, a poster frame,
// and captions for a clip with speech.
function FeaturedExtra({ slot, storageReady, busy, run }) {
  const [mode, setMode] = useState(slot.media_type === 'video_clip' ? 'clip' : 'youtube');
  const [url, setUrl] = useState(slot.youtube_id ? `https://youtu.be/${slot.youtube_id}` : '');
  useEffect(() => { if (slot.media_type === 'video_clip') setMode('clip'); else if (slot.media_type === 'youtube') setMode('youtube'); }, [slot.media_type]);
  return (
    <div className="wsa-extra">
      <div className="wsa-switch" role="radiogroup" aria-label="Featured video source">
        <button type="button" role="radio" aria-checked={mode === 'youtube'} className={mode === 'youtube' ? 'is-on' : ''} onClick={() => setMode('youtube')}>YouTube link</button>
        <button type="button" role="radio" aria-checked={mode === 'clip'} className={mode === 'clip' ? 'is-on' : ''} onClick={() => setMode('clip')}>Upload a clip (30s max)</button>
      </div>
      {mode === 'youtube' ? (
        <div className="wsa-row">
          <label className="wsa-field" htmlFor="wsa-youtube">
            <span>YouTube link (youtube.com or youtu.be)</span>
            <input id="wsa-youtube" type="url" value={url} disabled={busy} placeholder="https://youtu.be/…" onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button type="button" className="wsa-btn" disabled={busy || !url.trim()} onClick={() => run(() => websiteApi.youtube('featured_video', url))}>
            <Youtube size={16} aria-hidden="true" /> Use this video
          </button>
        </div>
      ) : (
        <p className="wsa-hint">Upload the MP4 with the button below; clips over 30 seconds or 25 MB are refused.</p>
      )}
      <div className="wsa-row">
        <FilePick label={slot.poster_url ? 'Replace poster frame' : 'Upload poster frame'} accept="image/png,image/jpeg,image/webp"
          icon={FileImage} disabled={busy || !storageReady || !hasMedia(slot)} onFile={(f) => run(() => websiteApi.upload('featured_video', f, 'poster'))} />
        {slot.media_type === 'video_clip' && (
          <FilePick label={slot.captions_url ? 'Replace captions (.vtt)' : 'Upload captions (.vtt)'} accept=".vtt,text/vtt"
            disabled={busy || !storageReady} onFile={(f) => run(() => websiteApi.upload('featured_video', f, 'captions'))} />
        )}
      </div>
      {slot.media_type === 'video_clip' && (
        <label className="wsa-check">
          <input type="checkbox" checked={slot.has_speech} disabled={busy}
            onChange={(e) => run(() => websiteApi.details('featured_video', { has_speech: e.target.checked }))} />
          Someone speaks in this clip (captions are then required)
        </label>
      )}
    </div>
  );
}

// Fashion as Storytelling: an approved style sheet instead of an image. The
// sheet is drawn in the browser, as a JPEG, and uploaded as the slot's image.
function StyleSheetExtra({ storageReady, busy, run, setNote }) {
  const [episodes, setEpisodes] = useState(null);
  const [choice, setChoice] = useState('');
  const [capture, setCapture] = useState(null);
  const captureRef = useRef(null);

  const loadEpisodes = async () => {
    try {
      const res = await api.get('/api/v1/episodes', { params: { limit: 100 } });
      const rows = res.data?.data || res.data?.episodes || [];
      setEpisodes(rows.map((e) => ({ id: e.id, label: `Episode ${e.episode_number ?? '?'} · ${e.title || 'Untitled'}` })));
    } catch (err) {
      console.error('[Website] episodes could not be read:', err);
      setNote('The episodes could not be read.');
    }
  };

  const useSheet = () => run(async () => {
    const { styleSheetApi, sheetToPng } = await import('../components/Episodes/EpisodeStyleSheetPanel');
    const sheet = await styleSheetApi.get(choice);
    if (sheet.status !== 'approved') throw new Error('That episode\'s style sheet is not approved yet. Approve it in the episode\'s Wardrobe first.');
    setCapture(sheet);
    let blob;
    try {
      // Wait for the off-screen template (it loads lazily) and its fonts.
      for (let i = 0; i < 40 && !captureRef.current; i++) await new Promise((r) => setTimeout(r, 50));
      if (document.fonts?.ready) await document.fonts.ready;
      blob = await sheetToPng(captureRef.current, 'image/jpeg', 0.9);
    } finally {
      setCapture(null);
    }
    const file = new File([blob], `style-sheet-episode-${sheet.episode?.number ?? 'x'}.jpg`, { type: 'image/jpeg' });
    return websiteApi.upload('brand_fashion', file);
  });

  return (
    <div className="wsa-extra">
      {episodes === null ? (
        <button type="button" className="wsa-btn wsa-btn-quiet" disabled={busy || !storageReady} onClick={loadEpisodes}>Use an approved style sheet instead</button>
      ) : (
        <div className="wsa-row">
          <label className="wsa-field" htmlFor="wsa-sheet-episode">
            <span>Episode whose approved style sheet to use</span>
            <select id="wsa-sheet-episode" value={choice} disabled={busy} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose an episode</option>
              {episodes.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
          <button type="button" className="wsa-btn" disabled={busy || !choice} onClick={useSheet}>Use this style sheet</button>
        </div>
      )}
      {capture && <StyleSheetCapture sheet={capture} captureRef={captureRef} />}
    </div>
  );
}

function StyleSheetCapture({ sheet, captureRef }) {
  const [Template, setTemplate] = useState(null);
  useEffect(() => { import('../components/Episodes/StyleSheetTemplate').then((m) => setTemplate(() => m.default)); }, []);
  if (!Template) return null;
  return <div className="wsa-capture" aria-hidden="true"><Template ref={captureRef} sheet={sheet} /></div>;
}

export default function WebsiteAdmin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await websiteApi.list());
      setError(null);
    } catch (err) {
      console.error('[Website] slots could not be read:', err);
      setError(err?.response?.status === 403 ? 'The Website page is for admins.' : errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      await load();
    } catch (err) {
      console.error('[Website] action failed:', err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (loading) return <div className="wsa-page wsa-loading"><Loader2 size={18} className="wsa-spin" aria-hidden="true" /> Loading the Website page…</div>;
  if (!data) return <div className="wsa-page"><p className="wsa-error" role="alert">{error || 'The Website page could not be loaded.'}</p></div>;

  const slots = Object.fromEntries((data.slots || []).map((s) => [s.slot_key, s]));
  const counts = { published: 0, draft: 0, fallback: 0 };
  for (const s of data.slots || []) {
    const st = slotStatus(s);
    if (st === 'Published') counts.published++;
    else if (st === 'Draft') counts.draft++;
    else counts.fallback++;
  }

  return (
    <div className="wsa-page" data-testid="website-admin">
      <header className="wsa-header">
        <div>
          <h1>Website</h1>
          <p className="wsa-counts" data-testid="wsa-counts">
            {counts.published} published · {counts.draft} draft · {counts.fallback} using default
          </p>
        </div>
        <Link className="wsa-btn" to="/site-preview" target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden="true" /> View the site</Link>
      </header>
      <p className="wsa-note">Only Published items appear on the site. Empty spots use the built-in images.</p>
      {!data.storage_ready && (
        <p className="wsa-warning" role="status" data-testid="wsa-storage-off">
          Uploads are off until the public site storage is set up. YouTube links still work.
        </p>
      )}
      {note && <p className="wsa-error" role="alert">{note}</p>}

      {SECTIONS.map((sec) => (
        <section key={sec.id} className="wsa-section" aria-labelledby={`wsa-sec-${sec.id}`}>
          <h2 id={`wsa-sec-${sec.id}`}>{sec.title}</h2>
          <div className="wsa-grid">
            {sec.slots.map(([key, label]) => {
              const slot = slots[key];
              if (!slot) return null;
              let extra = null;
              if (key === 'featured_video') extra = <FeaturedExtra slot={slot} storageReady={data.storage_ready} busy={busy} run={run} />;
              if (key === 'brand_fashion') extra = <StyleSheetExtra storageReady={data.storage_ready} busy={busy} run={run} setNote={setNote} />;
              if (key === 'logo') {
                extra = (
                  <label className="wsa-check is-disabled">
                    <input type="checkbox" disabled aria-describedby="wsa-logo-why" />
                    Use the logo from Show Settings
                    <span id="wsa-logo-why" className="wsa-hint"> (Show Settings has no logo yet; upload one here.)</span>
                  </label>
                );
              }
              return <SlotCard key={key} slot={slot} label={label} storageReady={data.storage_ready} busy={busy} run={run} extra={extra} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
