/**
 * Assets → Overlays: the show's overlay library (Evoni, 2026-10-07: "show
 * level overlays hold overlays that can be used for any episode while
 * episode overlays are for that episode only").
 *
 * The production overlays (titles, lower thirds, buttons, frames), 16:9,
 * each a type with its image: made with AI from the type's prompt, or
 * uploaded. Each card says whether it is ready and which episodes use it
 * (GET /ui-overlays/:showId/usage, lib/showOverlays). An episode's own
 * overlays (its title card, invitation, task list) live in its Production
 * → Overlays tab.
 *
 * Same backend as the Phone Hub (/api/v1/ui-overlays/), category
 * 'production'.
 *
 * New overlay starts from a picture (Evoni, 2026-10-07: "i need to be able
 * to upload pictures in producer mode overlays"): upload one, or describe
 * it for Make with AI. With a picture, the type is made and the picture
 * uploaded to it (POST /types, then POST /upload/:type_key).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader2, Upload, Trash2, Download, X, Plus, ImageOff, Ruler } from 'lucide-react';
import api from '../services/api';
import { episodesUsing, usageLine, libraryTiles, overlayState } from '../lib/showOverlays';
import './ProductionOverlaysTab.css';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/** The upload limit (multer in uiOverlayRoutes). */
const MAX_BYTES = 10 * 1024 * 1024;

/** Why a picture can't be used, in plain words; null when it can. */
export function pictureProblem(file) {
  if (!file) return null;
  if (!String(file.type || '').startsWith('image/')) return 'Choose an image (PNG or JPG).';
  if (file.size > MAX_BYTES) return 'The picture is over 10 MB. Choose a smaller one.';
  return null;
}

/** A name from a file name: "lower-third_gold.png" → "Lower third gold". */
export function nameFromFile(file) {
  const base = String(file?.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

export default function ProductionOverlaysTab({ showId: propShowId }) {
  const [showId, setShowId] = useState(propShowId || null);
  const [shows, setShows] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // `${id}:generate` | `${id}:upload` | `${id}:delete`
  const [toast, setToast] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sizesOpen, setSizesOpen] = useState(false);
  const fileInputRef = useRef(null);
  const uploadTarget = useRef(null);

  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Without a show from the page, the first show (and a picker).
  useEffect(() => {
    if (propShowId) { setShowId(propShowId); return; }
    api.get('/api/v1/shows').then((r) => {
      const list = r.data?.data || [];
      setShows(list);
      setShowId((cur) => cur || list[0]?.id || null);
    }).catch((err) => console.error('[ShowOverlays] shows load failed:', err));
  }, [propShowId]);

  const load = useCallback((withSpinner) => {
    if (!showId) return;
    if (withSpinner) setLoading(true);
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then((r) => setOverlays((r.data?.data || []).filter((o) => o.category === 'production')))
      .catch((err) => { console.error('[ShowOverlays] load failed:', err); setOverlays([]); })
      .finally(() => setLoading(false));
    api.get(`/api/v1/ui-overlays/${showId}/usage`)
      .then((r) => setUsage(r.data?.data || {}))
      .catch((err) => { console.error('[ShowOverlays] usage load failed:', err); setUsage({}); });
  }, [showId]);

  useEffect(() => { load(true); }, [load]);

  const generate = async (overlay) => {
    if (busy) return;
    setBusy(`${overlay.id}:generate`);
    try {
      await api.post(`/api/v1/ui-overlays/${showId}/generate/${overlay.id}`);
      flash(`${overlay.name} made`);
      load(false);
    } catch (err) {
      console.error('[ShowOverlays] generate failed:', err);
      flash(errorText(err), 'error');
    }
    setBusy(null);
  };

  const pickUpload = (overlay) => {
    uploadTarget.current = overlay;
    fileInputRef.current?.click();
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    const overlay = uploadTarget.current;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !overlay) return;
    setBusy(`${overlay.id}:upload`);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/api/v1/ui-overlays/${showId}/upload/${overlay.id}`, fd);
      flash(`${overlay.name} uploaded`);
      load(false);
    } catch (err) {
      console.error('[ShowOverlays] upload failed:', err);
      flash(errorText(err), 'error');
    }
    setBusy(null);
  };

  const remove = async (overlay) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${overlay.name}"? Episodes that use it lose it.`)) return;
    setBusy(`${overlay.id}:delete`);
    try {
      if (overlay.custom && overlay.custom_id) await api.delete(`/api/v1/ui-overlays/${showId}/types/${overlay.custom_id}`);
      if (overlay.asset_id) await api.delete(`/api/v1/ui-overlays/${showId}/asset/${overlay.asset_id}`);
      setOverlays((prev) => prev.filter((o) => o.id !== overlay.id));
      flash(`${overlay.name} deleted`);
    } catch (err) {
      console.error('[ShowOverlays] delete failed:', err);
      flash(errorText(err), 'error');
    }
    setBusy(null);
  };

  const download = async (overlay) => {
    if (!overlay?.url) return;
    try {
      const blob = await (await fetch(overlay.url)).blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${overlay.id || 'overlay'}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error('[ShowOverlays] download failed, opening instead:', err);
      window.open(overlay.url, '_blank', 'noopener');
    }
  };

  // Returns an error to show in the dialog, or null once it is added.
  const create = async (form, file) => {
    let made;
    try {
      const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, { ...form, category: 'production' });
      made = res.data?.data || {};
    } catch (err) {
      console.error('[ShowOverlays] create failed:', err);
      return err?.response?.status === 409 ? 'There is already an overlay with that name.' : errorText(err);
    }
    const name = made.name || form.name;
    if (file && made.type_key) {
      try {
        const fd = new FormData();
        fd.append('image', file);
        await api.post(`/api/v1/ui-overlays/${showId}/upload/${made.type_key}`, fd);
        flash(`${name} added`);
      } catch (err) {
        // The overlay is made; its card's Upload can try the picture again.
        console.error('[ShowOverlays] upload after create failed:', err);
        flash(`${name} added, but the picture didn't upload: ${errorText(err)}. Use Upload on its card.`, 'error');
      }
    } else {
      flash(`${name} added`);
    }
    setCreateOpen(false);
    load(false);
    return null;
  };

  const tiles = libraryTiles(overlays, usage);

  return (
    <div className="sol" data-testid="show-overlays">
      {toast && <div className={`sol-toast is-${toast.type}`} role="status">{toast.msg}</div>}

      <header className="sol-hero">
        <div className="sol-hero-text">
          <h2 className="sol-title">Overlays</h2>
          <p className="sol-sub">
            On-screen pieces any episode can use: titles, lower thirds, buttons and frames.
            An episode&apos;s own overlays (its title card, invitation, task list) are in its Production → Overlays.
          </p>
          {!propShowId && shows.length > 0 && (
            <select className="sol-show-select" aria-label="Show" value={showId || ''} onChange={(e) => setShowId(e.target.value)}>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name || s.title}</option>)}
            </select>
          )}
        </div>
        <ul className="sol-tiles" aria-label="Overlays at a glance">
          {tiles.map((t) => (
            <li key={t.key} className="sol-tile" data-testid={`sol-tile-${t.key}`}>
              <span className="sol-tile-value">{t.value}</span>
              <span className="sol-tile-label">{t.label}</span>
            </li>
          ))}
        </ul>
        <div className="sol-hero-actions">
          <button type="button" className="sol-link" onClick={() => setSizesOpen((o) => !o)} aria-expanded={sizesOpen} data-testid="sol-sizes-toggle">
            <Ruler size={14} aria-hidden="true" /> Sizes
          </button>
          <button type="button" className="sol-btn is-primary" onClick={() => setCreateOpen(true)} disabled={!showId} data-testid="sol-new">
            <Plus size={15} aria-hidden="true" /> New overlay
          </button>
        </div>
      </header>

      {sizesOpen && (
        <section className="sol-sizes" data-testid="sol-sizes">
          <strong>Upload sizes</strong>
          <span>Full screen (HD): <b>1920 × 1080</b> px, 16:9</span>
          <span>Full screen (4K): <b>3840 × 2160</b> px, 16:9</span>
          <span>Buttons and icons: <b>512 × 512</b> px, square</span>
          <span className="sol-sizes-note">PNG with transparency for pieces that sit over the video; JPG for full-frame cards.</span>
        </section>
      )}

      {loading ? (
        <p className="sol-muted"><Loader2 size={16} className="sol-spin" aria-hidden="true" /> Loading overlays…</p>
      ) : overlays.length === 0 ? (
        <section className="sol-empty" data-testid="sol-empty">
          <ImageOff size={28} aria-hidden="true" />
          <h3>No overlays yet</h3>
          <p>Upload a picture or make one with AI. Add the show&apos;s on-screen pieces once; every episode can use them.</p>
          <button type="button" className="sol-btn is-primary" onClick={() => setCreateOpen(true)} disabled={!showId}>
            <Plus size={15} aria-hidden="true" /> New overlay
          </button>
        </section>
      ) : (
        <ul className="sol-grid">
          {overlays.map((o) => {
            const state = overlayState(o);
            const episodes = episodesUsing(o, usage);
            const isBusy = (what) => busy === `${o.id}:${what}`;
            return (
              <li key={o.id} className={`sol-card is-${state}`} data-testid={`sol-card-${o.id}`}>
                <div className="sol-preview">
                  {o.url ? <img src={o.url} alt={o.name} loading="lazy" /> : <span className="sol-preview-empty"><ImageOff size={22} aria-hidden="true" /> Not made yet</span>}
                </div>
                <div className="sol-card-body">
                  <div className="sol-card-head">
                    <h3 className="sol-card-name">{o.name}</h3>
                    <span className={`sol-pill is-${state}`} data-testid={`sol-state-${o.id}`}>{state === 'ready' ? 'Ready' : 'Not made'}</span>
                  </div>
                  {o.description && <p className="sol-card-desc">{o.description}</p>}
                  <p className={`sol-usage${episodes.length ? ' is-used' : ''}`} data-testid={`sol-usage-${o.id}`}
                    title={episodes.map((e) => `Episode ${e.episode_number ?? '?'}: ${e.title || 'Untitled'}`).join('\n') || undefined}>
                    {usageLine(episodes)}
                  </p>
                  <div className="sol-actions">
                    <button type="button" className="sol-btn" onClick={() => generate(o)} disabled={!!busy} data-testid={`sol-generate-${o.id}`}>
                      {isBusy('generate') ? <Loader2 size={14} className="sol-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                      {state === 'ready' ? 'Remake' : 'Make with AI'}
                    </button>
                    <button type="button" className="sol-btn" onClick={() => pickUpload(o)} disabled={!!busy} data-testid={`sol-upload-${o.id}`}>
                      {isBusy('upload') ? <Loader2 size={14} className="sol-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />} Upload
                    </button>
                    {o.url && (
                      <button type="button" className="sol-icon" onClick={() => download(o)} aria-label={`Download ${o.name}`}>
                        <Download size={15} />
                      </button>
                    )}
                    <button type="button" className="sol-icon is-danger" onClick={() => remove(o)} disabled={!!busy} aria-label={`Delete ${o.name}`} data-testid={`sol-delete-${o.id}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={upload} hidden data-testid="sol-file" />

      {createOpen && <CreateOverlayDialog onClose={() => setCreateOpen(false)} onCreate={create} />}
    </div>
  );
}

function CreateOverlayDialog({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', prompt: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready = form.name.trim() && (file || form.prompt.trim());

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    const problem = pictureProblem(chosen);
    if (problem) { setError(problem); return; }
    setError(null);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setForm((f) => (f.name.trim() ? f : { ...f, name: nameFromFile(chosen) }));
  };

  const clearPicture = () => { setFile(null); setPreview(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    const problem = await onCreate({ name: form.name.trim(), description: form.description.trim(), prompt: form.prompt.trim() }, file);
    if (problem) { setError(problem); setSaving(false); }
  };

  return (
    <div className="sol-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="sol-dialog" role="dialog" aria-label="New overlay" onClick={(e) => e.stopPropagation()}>
        <div className="sol-dialog-head">
          <h3>New overlay</h3>
          <button type="button" className="sol-icon" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="sol-form" onSubmit={submit}>
          {preview ? (
            <div className="sol-picture" data-testid="sol-new-preview">
              <img src={preview} alt="The picture to upload" />
              <div className="sol-picture-bar">
                <span className="sol-picture-name">{file?.name}</span>
                <button type="button" className="sol-link" onClick={clearPicture} disabled={saving}>Remove</button>
              </div>
            </div>
          ) : (
            <label className="sol-drop" data-testid="sol-new-drop">
              <input type="file" accept="image/*" onChange={pick} hidden data-testid="sol-new-file" />
              <Upload size={22} aria-hidden="true" />
              <strong>Upload a picture</strong>
              <span>PNG or JPG, up to 10 MB. 1920 × 1080 for full screen.</span>
            </label>
          )}
          <label>
            <span>Name</span>
            <input value={form.name} onChange={set('name')} placeholder="Show title card, lower third, exit button…" maxLength={100} autoFocus />
          </label>
          <label>
            <span>What it&apos;s for <em>(optional)</em></span>
            <input value={form.description} onChange={set('description')} placeholder="Where it appears in an episode" maxLength={200} />
          </label>
          <label>
            <span>{file ? <>What to draw <em>(optional, for Remake with AI)</em></> : <>Or describe it for AI</>}</span>
            <textarea value={form.prompt} onChange={set('prompt')} rows={3} placeholder="Describe it for Make with AI" />
          </label>
          {error && <p className="sol-form-error" role="alert" data-testid="sol-new-error">{error}</p>}
          {!ready && !error && <p className="sol-form-hint" data-testid="sol-new-missing">{!form.name.trim() ? 'Add a name' : 'Upload a picture or describe it for AI'}</p>}
          <div className="sol-form-actions">
            <button type="button" className="sol-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="sol-btn is-primary" disabled={!ready || saving}>{saving ? 'Adding…' : 'Add overlay'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
