/**
 * Episode title approval and title card (Task #2386, ruling P11, Evoni
 * 2026-09-30): "An episode title can be approved. Approving it offers
 * "Design title card" with its cost shown. ... Changing an approved title
 * marks the card outdated and offers a redesign."
 *
 * Rendered in Production → Overlays (P15, EpisodeOverlaysTab), which passes
 * showCardImage={false} (it shows the previews itself) and onChange (called
 * after approve, design or an overlay save). All state comes
 * from GET /api/v1/episodes/:id/title-card (episodeTitleCardService):
 *   - not approved           → "Approve title"
 *   - approved, no card      → "Design title card — est. $0.04"
 *   - card current           → the card thumbnail
 *   - card outdated          → "Title changed — card outdated" and
 *                              "Approve title & redesign (est. $0.04)"
 * The estimate is the server's, priced from the same options the card is
 * generated with; an unpriced model reads "price not set".
 *
 * P11 as amended (2026-09-30): "The episode title card is a title overlay:
 * the title set in real typefaces (never AI-rendered letters) ... rendered
 * as a transparent PNG. An optional soft translucent backing band (20–40%
 * opacity) can be switched on for readability. Approving the title offers
 * 2–3 lettering style variants to choose from, at no image cost; an
 * optional AI-generated decorative flourish behind the letters is offered
 * separately with its cost shown. The current framed card remains
 * available as a full-screen card option." TitleOverlayPanel offers the
 * lettering styles (GET /title-overlay/variants), saves the choice (POST
 * /title-overlay) and adds the flourish (POST /title-overlay/flourish); the
 * framed card's button now reads "Full-screen framed card".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clapperboard, RefreshCw, TriangleAlert, Type, Sparkles, Pencil, Trash2, Upload } from 'lucide-react';
import api from '../../services/api';
import './EpisodeTitleCard.css';

export const getTitleCardApi = async (episodeId) =>
  (await api.get(`/api/v1/episodes/${episodeId}/title-card`))?.data?.data;
export const approveTitleApi = async (episodeId, title) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title/approve`, { title }))?.data?.data;
export const designTitleCardApi = async (episodeId) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title-card`))?.data?.data;
export const getOverlayVariantsApi = async (episodeId) =>
  (await api.get(`/api/v1/episodes/${episodeId}/title-overlay/variants`))?.data?.data;
export const saveTitleOverlayApi = async (episodeId, body) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title-overlay`, body))?.data?.data;
export const addFlourishApi = async (episodeId) =>
  (await api.post(`/api/v1/episodes/${episodeId}/title-overlay/flourish`))?.data?.data;
// Evoni, 2026-10-07: "i need to be able to edit/delete episode title".
export const setTitleWordsApi = async (episodeId, title) =>
  (await api.put(`/api/v1/episodes/${episodeId}/title-overlay/words`, { title }))?.data?.data;
export const deleteTitleOverlayApi = async (episodeId) =>
  (await api.delete(`/api/v1/episodes/${episodeId}/title-overlay`))?.data?.data;
// Evoni, 2026-10-09: her own title image as the overlay, and the framed card deletable.
export const uploadTitleOverlayApi = async (episodeId, file) => {
  const form = new FormData();
  form.append('file', file);
  return (await api.post(`/api/v1/episodes/${episodeId}/title-overlay/upload`, form))?.data?.data;
};
export const deleteTitleCardApi = async (episodeId) =>
  (await api.delete(`/api/v1/episodes/${episodeId}/title-card`))?.data?.data;

export function formatEstimate(estimate) {
  if (!estimate || typeof estimate.usd !== 'number') return 'price not set';
  return `$${estimate.usd.toFixed(2)}`;
}

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

// part (Evoni, 2026-10-07, the Overlays tab as one card per overlay): 'overlay'
// shows only the title overlay's controls (words, delete, approve, lettering,
// flourish), 'card' only the full-screen framed card's (approve, design);
// without it, both, as before.
export default function EpisodeTitleCard({ episode, showCardImage = true, onChange, part = null }) {
  const episodeId = episode?.id;
  const title = episode?.title || '';
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null); // 'approve' | 'design' | 'words' | 'delete' | null
  const [error, setError] = useState(null);
  const [words, setWords] = useState(null); // the words being edited, or null

  const load = useCallback(() => {
    if (!episodeId) return;
    getTitleCardApi(episodeId)
      .then((data) => { setState(data && typeof data === 'object' && 'approved' in data ? data : null); setError(null); })
      .catch((err) => {
        console.error('[EpisodeTitleCard] load failed:', err);
        setError(errorText(err));
      });
  }, [episodeId]);

  // Reload when the title changes (an edit makes the card outdated).
  useEffect(() => { load(); }, [load, title]);

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      setState(await approveTitleApi(episodeId, title));
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] approve failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const design = async () => {
    setBusy('design');
    setError(null);
    try {
      if (state?.offer?.requires_approval) await approveTitleApi(episodeId, title);
      const data = await designTitleCardApi(episodeId);
      setState(data?.state || null);
      if (!data?.state) load();
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] design failed:', err);
      // A budget refusal (429) or an unapproved title (409) says why.
      setError(errorText(err));
      load();
    } finally {
      setBusy(null);
    }
  };

  // The overlay's words are the episode's title: saving renames and approves
  // it, and redraws an existing overlay in its style, at no image cost.
  const saveWords = async (e) => {
    e?.preventDefault?.();
    const next = (words || '').trim();
    if (!next) { setError('Type the words for the title.'); return; }
    setBusy('words');
    setError(null);
    try {
      setState(await setTitleWordsApi(episodeId, next));
      setWords(null);
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] changing the words failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteOverlay = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete the title overlay? It leaves the episode and its timeline. The title stays.')) return;
    setBusy('delete');
    setError(null);
    try {
      await deleteTitleOverlayApi(episodeId);
      setState((st) => ({ ...st, overlay: null }));
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] delete overlay failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const uploadOverlay = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('upload');
    setError(null);
    try {
      setState(await uploadTitleOverlayApi(episodeId, file));
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] title image upload failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteCard = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete the full-screen framed card? It leaves the episode and its timeline. The title stays.')) return;
    setBusy('delete-card');
    setError(null);
    try {
      setState(await deleteTitleCardApi(episodeId));
      onChange?.();
    } catch (err) {
      console.error('[EpisodeTitleCard] delete card failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  if (!episodeId || !state) {
    return error ? <div className="etc-panel"><p className="etc-error" role="alert">{error}</p></div> : null;
  }

  const { approved, card, offer } = state;
  const outdated = Boolean(card?.outdated);
  const cost = formatEstimate(offer?.estimate);
  const showOverlay = part !== 'card';
  const showCard = part !== 'overlay';

  return (
    <div className="etc-panel" data-testid={part ? `episode-title-card-${part}` : 'episode-title-card'}>
      {!showOverlay ? null : words !== null ? (
        <form className="etc-words" onSubmit={saveWords} data-testid="etc-words-form">
          <label className="etc-words-label" htmlFor={`etc-words-${episodeId}`}>The title&apos;s words</label>
          <input
            id={`etc-words-${episodeId}`} className="etc-words-input" value={words} maxLength={255} autoFocus
            onChange={(e) => setWords(e.target.value)} data-testid="etc-words-input"
          />
          <p className="etc-words-hint">This becomes the episode&apos;s title{state.overlay ? ', and the overlay is redrawn in its style at no cost' : ''}.</p>
          <div className="etc-row">
            <button type="submit" className="etc-btn etc-btn-primary" disabled={busy !== null || !words.trim()} data-testid="etc-words-save">
              {busy === 'words' ? 'Saving…' : 'Save words'}
            </button>
            <button type="button" className="etc-btn" onClick={() => setWords(null)} disabled={busy !== null}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="etc-row">
          <button type="button" className="etc-btn" onClick={() => setWords(title)} disabled={busy !== null} data-testid="etc-words-edit">
            <Pencil size={14} aria-hidden="true" /> Edit words
          </button>
          <label className={`etc-btn${busy !== null ? ' is-disabled' : ''}`} data-testid="etc-overlay-upload">
            <Upload size={14} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : 'Upload your own title'}
            <input
              type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadOverlay} disabled={busy !== null}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
              data-testid="etc-overlay-upload-input"
            />
          </label>
          {state.overlay && (
            <button type="button" className="etc-btn etc-btn-danger" onClick={deleteOverlay} disabled={busy !== null} data-testid="etc-overlay-delete">
              <Trash2 size={14} aria-hidden="true" /> {busy === 'delete' ? 'Deleting…' : 'Delete overlay'}
            </button>
          )}
        </div>
      )}
      <div className="etc-row">
        {approved ? (
          <span className="etc-approved" data-testid="etc-approved">
            <BadgeCheck size={14} aria-hidden="true" /> Title approved
          </span>
        ) : !outdated && (
          <button type="button" className="etc-btn" onClick={approve} disabled={busy !== null || !title.trim()}>
            <BadgeCheck size={14} aria-hidden="true" />
            {busy === 'approve' ? 'Approving…' : 'Approve title'}
          </button>
        )}

        {showCard && outdated && (
          <span className="etc-outdated" data-testid="etc-outdated">
            <TriangleAlert size={14} aria-hidden="true" /> Title changed — card outdated
          </span>
        )}

        {showCard && offer?.offered && (
          <button type="button" className="etc-btn etc-btn-primary" onClick={design} disabled={busy !== null}>
            {offer.kind === 'redesign' ? <RefreshCw size={14} aria-hidden="true" /> : <Clapperboard size={14} aria-hidden="true" />}
            {busy === 'design'
              ? 'Designing…'
              : offer.kind === 'redesign'
                ? `${offer.requires_approval ? 'Approve title & redesign' : 'Redesign title card'} (est. ${cost})`
                : `Full-screen framed card — est. ${cost}`}
          </button>
        )}

        {showCard && card?.asset_id && (
          <button type="button" className="etc-btn etc-btn-danger" onClick={deleteCard} disabled={busy !== null} data-testid="etc-card-delete">
            <Trash2 size={14} aria-hidden="true" /> {busy === 'delete-card' ? 'Deleting…' : 'Delete card'}
          </button>
        )}
      </div>

      {showOverlay && approved && state.overlay_offer?.offered && (
        <TitleOverlayPanel
          episodeId={episodeId}
          overlay={state.overlay || null}
          flourishEstimate={state.overlay_offer.flourish_estimate}
          showPreview={showCardImage}
          onSaved={(overlay) => { setState((st) => ({ ...st, overlay })); onChange?.(); }}
        />
      )}
      {showOverlay && !approved && state.overlay?.outdated && (
        <span className="etc-outdated" data-testid="etc-overlay-outdated">
          <TriangleAlert size={14} aria-hidden="true" /> Title changed — overlay outdated; approve the title to restyle it
        </span>
      )}

      {showCard && showCardImage && card?.image_url && (
        <img
          className={`etc-thumb${outdated ? ' etc-thumb-outdated' : ''}`}
          src={card.image_url}
          alt={`Full-screen title card for “${card.designed_for || ''}”`}
          data-testid="etc-thumb"
        />
      )}

      {error && <p className="etc-error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * The title overlay: lettering styles at no image cost, an optional
 * backing band (20–40%), and the optional AI flourish with its estimate.
 */
export function TitleOverlayPanel({ episodeId, overlay, flourishEstimate, onSaved, showPreview = true }) {
  const [options, setOptions] = useState(null); // { variants, band }
  const [variant, setVariant] = useState(overlay?.style?.variant || null);
  const [bandOn, setBandOn] = useState(Boolean(overlay?.style?.band?.enabled));
  const [opacity, setOpacity] = useState(Math.round((overlay?.style?.band?.opacity || 0.3) * 100));
  const [busy, setBusy] = useState(null); // 'variants' | 'save' | 'flourish'
  const [error, setError] = useState(null);

  const openStyles = async () => {
    setBusy('variants');
    setError(null);
    try {
      const data = await getOverlayVariantsApi(episodeId);
      setOptions(data);
      if (!variant) setVariant(data?.variants?.[0]?.key || 'classic');
    } catch (err) {
      console.error('[EpisodeTitleCard] lettering styles failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async (extra = {}) => {
    setBusy('save');
    setError(null);
    try {
      const saved = await saveTitleOverlayApi(episodeId, {
        variant, band: { enabled: bandOn, opacity: opacity / 100 }, ...extra,
      });
      onSaved(saved);
      setOptions(null);
    } catch (err) {
      console.error('[EpisodeTitleCard] save overlay failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const addFlourish = async () => {
    setBusy('flourish');
    setError(null);
    try {
      onSaved(await addFlourishApi(episodeId));
    } catch (err) {
      console.error('[EpisodeTitleCard] flourish failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const hasFlourish = Boolean(overlay?.style?.flourish);

  return (
    <div className="etc-overlay" data-testid="etc-overlay">
      <div className="etc-row">
        <button type="button" className="etc-btn etc-btn-primary" onClick={openStyles} disabled={busy !== null} data-testid="etc-overlay-styles">
          <Type size={14} aria-hidden="true" />
          {busy === 'variants' ? 'Setting the title…' : overlay ? 'Restyle title overlay — no image cost' : 'Title overlay: choose a lettering style — no image cost'}
        </button>
        {overlay && !overlay.outdated && (
          hasFlourish ? (
            <button type="button" className="etc-btn" onClick={() => save({ flourish: false })} disabled={busy !== null} data-testid="etc-flourish-remove">
              Remove flourish
            </button>
          ) : (
            <button type="button" className="etc-btn" onClick={addFlourish} disabled={busy !== null} data-testid="etc-flourish-add">
              <Sparkles size={14} aria-hidden="true" />
              {busy === 'flourish' ? 'Adding flourish…' : `Add AI flourish behind the letters — est. ${formatEstimate(flourishEstimate)}`}
            </button>
          )
        )}
      </div>

      {options && (
        <div className="etc-variants" role="radiogroup" aria-label="Lettering style" data-testid="etc-variants">
          {options.variants.map((v) => (
            <button
              key={v.key} type="button" role="radio" aria-checked={variant === v.key}
              className={`etc-variant${variant === v.key ? ' is-chosen' : ''}`}
              onClick={() => setVariant(v.key)} data-testid={`etc-variant-${v.key}`}
            >
              <img className="etc-variant-img" src={v.preview} alt={`${v.label} lettering`} />
              <span>{v.label}</span>
            </button>
          ))}
          <label className="etc-band">
            <input type="checkbox" checked={bandOn} onChange={(e) => setBandOn(e.target.checked)} data-testid="etc-band-toggle" />
            Soft backing band for readability
          </label>
          {bandOn && (
            <label className="etc-band">
              Band opacity {opacity}%
              <input
                type="range" min={20} max={40} step={5} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))} data-testid="etc-band-opacity"
              />
            </label>
          )}
          <div className="etc-row">
            <button type="button" className="etc-btn etc-btn-primary" onClick={() => save()} disabled={busy !== null || !variant} data-testid="etc-overlay-save">
              {busy === 'save' ? 'Saving…' : 'Save title overlay'}
            </button>
            <button type="button" className="etc-btn" onClick={() => setOptions(null)} disabled={busy !== null}>Cancel</button>
          </div>
        </div>
      )}

      {showPreview && overlay?.image_url && (
        <div className={`etc-overlay-preview${overlay.outdated ? ' etc-thumb-outdated' : ''}`}>
          <img src={overlay.image_url} alt={`Title overlay for “${overlay.designed_for || ''}”`} data-testid="etc-overlay-thumb" />
        </div>
      )}
      {overlay?.outdated && (
        <span className="etc-outdated" data-testid="etc-overlay-outdated">
          <TriangleAlert size={14} aria-hidden="true" /> Title changed — restyle the overlay
        </span>
      )}

      {error && <p className="etc-error" role="alert">{error}</p>}
    </div>
  );
}
