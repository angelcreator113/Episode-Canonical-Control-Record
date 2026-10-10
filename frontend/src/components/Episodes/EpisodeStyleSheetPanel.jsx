/**
 * Production → Wardrobe → Style sheet (docs/design/2026-10-landing-and-
 * stylesheet.md Part 2, "Style sheet panel"; Task #2814): the sheet's
 * status (Draft or Approved) and readiness (x of 11), the four Lala photos
 * it shares with the Lookbook, "Filled in for you" rows each with its
 * source and state, then Preview, Approve and Download PNG.
 *
 * The palette is taken in the browser from the saved pieces' images and
 * can be adjusted; mood words come from the event's keywords; the tagline
 * is hers to write (no AI). Cost: $0, every photo is hers.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Eye, Loader2, Lock, RotateCcw, Upload } from 'lucide-react';
import api from '../../services/api';
import { lookbookApi } from './EpisodeLookbookTab';
import StyleSheetTemplate, { SHEET_HEIGHT, SHEET_WIDTH } from './StyleSheetTemplate';
import { extractPalette } from '../../lib/stylePalette';
import './EpisodeStyleSheetPanel.css';

const sheetBase = (episodeId) => `/api/v1/episodes/${episodeId}/style-sheet`;
export const styleSheetApi = {
  get: (episodeId) => api.get(sheetBase(episodeId)).then((r) => r.data?.data),
  approve: (episodeId) => api.post(`${sheetBase(episodeId)}/approve`).then((r) => r.data?.data),
  reopen: (episodeId) => api.post(`${sheetBase(episodeId)}/reopen`).then((r) => r.data?.data),
};

const STATE_LABEL = { ready: 'Ready', partial: 'Partly filled', missing: 'Missing' };
const LOOK_SLOTS = [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['hero', 'Hero']];
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** The PNG (or another image type) of a full-size template node (html2canvas, loaded on demand). */
export async function sheetToPng(node, type = 'image/png', quality) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(node, { scale: 1, width: SHEET_WIDTH, height: SHEET_HEIGHT, backgroundColor: null, logging: false });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))), type, quality));
}

export default function EpisodeStyleSheetPanel({ episode }) {
  const episodeId = episode?.id;
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [palette, setPalette] = useState(null); // shown palette (saved, or taken from the pieces)
  const [preview, setPreview] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef(null);
  const previewWrap = useRef(null);
  const [scale, setScale] = useState(0.4);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      const data = await styleSheetApi.get(episodeId);
      setSheet(data);
      setError(null);
    } catch (err) {
      console.error('[StyleSheet] load failed:', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [episodeId]);
  useEffect(() => { load(); }, [load]);

  // The saved palette, else five colours taken from the piece images.
  useEffect(() => {
    let cancelled = false;
    if (!sheet) return undefined;
    if (sheet.palette) { setPalette(sheet.palette); return undefined; }
    if (!sheet.palette_sources?.length) { setPalette(null); return undefined; }
    extractPalette(sheet.palette_sources).then((p) => { if (!cancelled) setPalette(p.length ? p : null); })
      .catch((err) => console.error('[StyleSheet] palette extraction failed:', err));
    return () => { cancelled = true; };
  }, [sheet]);

  // The preview fits its column.
  useEffect(() => {
    if (!preview || !previewWrap.current) return undefined;
    const fit = () => setScale(Math.min(1, (previewWrap.current?.clientWidth || 400) / SHEET_WIDTH));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [preview]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      await fn();
      setError(null);
    } catch (err) {
      console.error('[StyleSheet] action failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const savePalette = (next) => run(async () => { await lookbookApi.save(episodeId, { palette: next }); await load(); });
  const saveTagline = (value) => run(async () => { await lookbookApi.save(episodeId, { tagline: value }); await load(); });
  const uploadLook = (spot, files) => run(async () => { await lookbookApi.upload(episodeId, files.slice(0, 1), spot); await load(); });
  const chooseVenue = (imageId) => run(async () => {
    const order = [imageId, ...(sheet.venue.options || []).map((o) => o.id).filter((id) => id !== imageId)];
    for (let i = 0; i < order.length; i++) await lookbookApi.move(episodeId, order[i], { sort_order: i });
    await load();
  });
  const approve = () => run(async () => {
    // The palette she sees is the one approved: save one taken from the pieces first.
    if (!sheet.palette && palette?.length) await lookbookApi.save(episodeId, { palette });
    setSheet(await styleSheetApi.approve(episodeId));
  });
  const reopen = () => run(async () => setSheet(await styleSheetApi.reopen(episodeId)));
  const download = () => run(async () => {
    setCapturing(true);
    try {
      await nextFrame();
      if (document.fonts?.ready) await document.fonts.ready;
      const blob = await sheetToPng(captureRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const n = sheet.episode?.number != null ? String(sheet.episode.number).padStart(2, '0') : 'episode';
      a.href = url;
      a.download = `style-sheet-episode-${n}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setCapturing(false);
    }
  });

  if (loading) return <section className="ssp-panel ssp-loading"><Loader2 size={16} className="ssp-spin" aria-hidden="true" /> Loading the style sheet…</section>;
  if (!sheet) return <section className="ssp-panel"><p className="ssp-error" role="alert">{error || 'The style sheet could not be loaded.'}</p></section>;

  const approved = sheet.status === 'approved';
  const locked = busy || approved;
  const { done, total } = sheet.readiness || { done: 0, total: 11 };
  const rows = sheet.rows || [];

  return (
    <section className="ssp-panel" aria-labelledby="ssp-title" data-testid="style-sheet-panel">
      <header className="ssp-header">
        <h3 id="ssp-title" className="ssp-title">Style sheet</h3>
        <span className={`ssp-status ${approved ? 'is-approved' : 'is-draft'}`} data-testid="ssp-status">
          {approved ? <><Lock size={12} aria-hidden="true" /> Approved</> : 'Draft'}
        </span>
        {sheet.stale && <span className="ssp-status is-stale">Out of date: the event or look changed since approval</span>}
      </header>

      <div className="ssp-ready">
        <div className="ssp-bar" role="progressbar" aria-label="Style sheet readiness" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${Math.round((done / (total || 11)) * 100)}%` }} />
        </div>
        <span className="ssp-ready-label" data-testid="ssp-ready">{done} of {total}</span>
      </div>

      {error && <p className="ssp-error" role="alert">{error}</p>}

      <div className="ssp-look" aria-label="Lala in the look (shared with the Lookbook)">
        {LOOK_SLOTS.map(([k, label]) => (
          <figure key={k} className="ssp-look-slot" data-testid={`ssp-look-${k}`}>
            <div className="ssp-look-frame">{sheet.look?.[k] ? <img src={sheet.look[k]} alt={`${label} photo`} /> : <span>No photo</span>}</div>
            <figcaption>
              <span>{label}</span>
              <label className={`ssp-mini-btn${locked ? ' is-disabled' : ''}`}>
                <Upload size={14} aria-hidden="true" /> {sheet.look?.[k] ? 'Replace' : 'Add'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={locked} aria-label={`${sheet.look?.[k] ? 'Replace' : 'Add'} ${label}`}
                  onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) uploadLook(k, f); }} />
              </label>
            </figcaption>
          </figure>
        ))}
      </div>

      <h4 className="ssp-h4">Filled in for you</h4>
      <ul className="ssp-rows">
        {rows.map((r) => (
          <li key={r.key} className="ssp-row" data-testid={`ssp-row-${r.key}`}>
            <div className="ssp-row-head">
              <span className="ssp-row-label">{r.label}</span>
              <span className="ssp-row-source">{r.source}</span>
              <span className={`ssp-state is-${r.state}`}>{STATE_LABEL[r.state] || r.state}</span>
            </div>
            {r.key !== 'tagline' && <p className="ssp-row-detail">{r.detail}</p>}

            {r.key === 'venue' && (sheet.venue.options || []).length > 1 && (
              <label className="ssp-field">
                <span>Angle on the sheet</span>
                <select value={sheet.venue.chosen_image_id || ''} disabled={locked} onChange={(e) => chooseVenue(e.target.value)}>
                  {sheet.venue.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}

            {r.key === 'palette' && (
              <div className="ssp-palette">
                {(palette || []).map((s, i) => (
                  <label key={i} className="ssp-swatch" title={s.hex}>
                    <input type="color" value={s.hex.toLowerCase()} disabled={locked} aria-label={`Palette colour ${i + 1}`}
                      onChange={(e) => setPalette(palette.map((p, j) => (j === i ? { hex: e.target.value.toUpperCase(), source: 'edited' } : p)))}
                      onBlur={() => { if (palette.some((p) => p.source === 'edited')) savePalette(palette); }} />
                  </label>
                ))}
                {sheet.palette && !locked && sheet.palette_sources?.length > 0 && (
                  <button type="button" className="ssp-btn ssp-btn-quiet" onClick={async () => { const p = await extractPalette(sheet.palette_sources); if (p.length) savePalette(p); }}>
                    <RotateCcw size={14} aria-hidden="true" /> Take from the pieces again
                  </button>
                )}
              </div>
            )}

            {r.key === 'tagline' && (
              <TaglineField value={sheet.tagline} disabled={locked} onSave={saveTagline} />
            )}
          </li>
        ))}
      </ul>

      <div className="ssp-actions">
        <button type="button" className="ssp-btn" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
          <Eye size={16} aria-hidden="true" /> {preview ? 'Hide preview' : 'Preview style sheet'}
        </button>
        {approved ? (
          <>
            <button type="button" className="ssp-btn ssp-btn-primary" disabled={busy} onClick={download}>
              <Download size={16} aria-hidden="true" /> Download PNG
            </button>
            <button type="button" className="ssp-btn" disabled={busy} onClick={reopen}>Reopen</button>
          </>
        ) : (
          <button type="button" className="ssp-btn ssp-btn-primary" disabled={busy} onClick={approve}>
            <CheckCircle2 size={16} aria-hidden="true" /> Approve
          </button>
        )}
        <span className="ssp-cost">Cost: $0 — every photo is yours, nothing is generated.</span>
      </div>

      {preview && (
        <div className="ssp-preview" ref={previewWrap} style={{ height: SHEET_HEIGHT * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SHEET_WIDTH }}>
            <StyleSheetTemplate sheet={sheet} palette={palette} />
          </div>
        </div>
      )}

      {capturing && (
        <div className="ssp-capture" aria-hidden="true">
          <StyleSheetTemplate ref={captureRef} sheet={sheet} palette={palette} />
        </div>
      )}
    </section>
  );
}

function TaglineField({ value, disabled, onSave }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  return (
    <label className="ssp-field">
      <span>Tagline (prints in script on the footer)</span>
      <input type="text" maxLength={200} value={draft} disabled={disabled} placeholder="Write a line for the footer"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if ((draft || '') !== (value || '')) onSave(draft); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}
