/**
 * Production → Lookbook (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2; Task #2813): where Evoni uploads the episode's photos and sorts
 * them into the spots the style sheet uses. Her photos are used as-is;
 * nothing is generated here and nothing costs.
 *
 * Sections, in the spec's order: the header with its counters ("Preview
 * style sheet" opens Wardrobe, where the style sheet panel is); the batch
 * drop zone and the "To sort" tray (tap a photo, then a spot); Lala in the
 * look (Front, Side, Back, Hero); Hair and Nails (a photo and a name each);
 * Beauty details (Eyes, Lips, Skin, with notes); Venue, pre-filled from the
 * episode's event scene set with "In lookbook" toggles and "Upload your
 * own"; Key inspo (two of her photos and two textures cut automatically
 * from the saved look's pieces).
 *
 * Data: GET/PUT /episodes/:id/lookbook, POST/PATCH/DELETE its images, and
 * PUT its venue toggle (Task #2812). Reloads keep the page in place: the
 * spinner shows only on the first load.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import api from '../../services/api';
import './EpisodeLookbookTab.css';

const base = (episodeId) => `/api/v1/episodes/${episodeId}/lookbook`;
export const lookbookApi = {
  get: (episodeId) => api.get(base(episodeId)).then((r) => r.data?.data),
  save: (episodeId, fields) => api.put(base(episodeId), fields).then((r) => r.data?.data),
  upload: (episodeId, files, category) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    if (category) form.append('category', category);
    return api.post(`${base(episodeId)}/images`, form).then((r) => r.data?.data?.lookbook);
  },
  move: (episodeId, imageId, changes) => api.patch(`${base(episodeId)}/images/${imageId}`, changes).then((r) => r.data?.data?.lookbook),
  remove: (episodeId, imageId) => api.delete(`${base(episodeId)}/images/${imageId}`).then((r) => r.data?.data?.lookbook),
  venue: (episodeId, body) => api.put(`${base(episodeId)}/venue`, body).then((r) => r.data?.data),
};

// The spots a tray photo can be sorted into, with their labels.
export const SPOTS = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
  { key: 'hero', label: 'Hero' },
  { key: 'hair', label: 'Hair' },
  { key: 'nails', label: 'Nails' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'lips', label: 'Lips' },
  { key: 'skin', label: 'Skin' },
  { key: 'venue', label: 'Venue' },
  { key: 'inspo', label: 'Inspo' },
];
const LOOK_SLOTS = ['front', 'side', 'back', 'hero'];
const BEAUTY_SLOTS = ['eyes', 'lips', 'skin'];
const MAX_INSPO = 2;
const ACCEPT = 'image/png,image/jpeg,image/webp';
const spotLabel = (key) => SPOTS.find((s) => s.key === key)?.label || key;

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

function FileButton({ label, onFiles, multiple = false, disabled, className = '', icon: Icon = Upload }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" className={`elb-btn ${className}`} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        aria-label={label}
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

// One single-photo spot: its photo, or an upload button. A new photo
// replaces the one there (the server keeps one live photo per spot).
function Slot({ spot, image, busy, onUpload, onRemove, label = spotLabel(spot), wide = false }) {
  return (
    <figure className={`elb-slot${wide ? ' elb-slot-wide' : ''}`} data-testid={`elb-slot-${spot}`}>
      <div className="elb-slot-frame">
        {image ? <img src={image.image_url} alt={`${label} photo`} loading="lazy" /> : <span className="elb-slot-empty">No photo yet</span>}
      </div>
      <figcaption className="elb-slot-caption">
        <span className="elb-slot-label">{label}</span>
        <span className="elb-slot-actions">
          <FileButton label={image ? `Replace ${label}` : `Add ${label}`} icon={image ? Upload : Plus} onFiles={(files) => onUpload(files.slice(0, 1), spot)} disabled={busy} className="elb-btn-small" />
          {image && (
            <button type="button" className="elb-icon-btn" aria-label={`Remove ${label} photo`} disabled={busy} onClick={() => onRemove(image.id)}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

// A text field saved when it loses focus (or on Enter for one line).
function SavedField({ id, label, value, placeholder, maxLength, multiline = false, disabled, onSave }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  const commit = () => { if ((draft || '') !== (value || '')) onSave(draft); };
  const props = {
    id,
    className: 'elb-input',
    value: draft,
    placeholder,
    maxLength,
    disabled,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
  };
  return (
    <label className="elb-field" htmlFor={id}>
      <span className="elb-field-label">{label}</span>
      {multiline ? <textarea rows={2} {...props} /> : <input type="text" {...props} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
    </label>
  );
}

export default function EpisodeLookbookTab({ episode, onOpenTab }) {
  const episodeId = episode?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // a tray photo being sorted
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      setData(await lookbookApi.get(episodeId));
      setError(null);
    } catch (err) {
      console.error('[Lookbook] load failed:', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [episodeId]);
  useEffect(() => { load(); }, [load]);

  // Every write returns the Lookbook; the page updates in place.
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) setData(next);
      setError(null);
    } catch (err) {
      console.error('[Lookbook] save failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const upload = (files, category) => run(() => lookbookApi.upload(episodeId, files, category));
  const remove = (imageId) => run(() => lookbookApi.remove(episodeId, imageId));
  const move = (imageId, changes) => run(() => lookbookApi.move(episodeId, imageId, changes));
  const saveField = (fields) => run(() => lookbookApi.save(episodeId, fields));
  const toggleVenue = (opt) => run(() => lookbookApi.venue(episodeId, { source: opt.source, ref_id: opt.ref_id, in_lookbook: !opt.in_lookbook }));

  if (loading) {
    return <div className="elb-tab elb-loading"><Loader2 size={18} className="elb-spin" aria-hidden="true" /> Loading the Lookbook…</div>;
  }
  if (!data) {
    return <div className="elb-tab"><p className="elb-error" role="alert">{error || 'The Lookbook could not be loaded.'}</p></div>;
  }

  const img = (spot) => data.images?.[spot]?.[0] || null;
  const tray = data.images?.unsorted || [];
  const approved = data.sheet_status === 'approved';
  const locked = busy || approved;
  const uploadedVenue = (data.images?.venue || []).filter((i) => i.source === 'upload');
  const inspo = (data.images?.inspo || []).filter((i) => i.source === 'upload');
  const notes = data.beauty_notes || {};
  const { done, total, missing } = data.readiness || { done: 0, total: 11, missing: [] };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (locked) return;
    const files = [...(e.dataTransfer?.files || [])].filter((f) => ACCEPT.split(',').includes(f.type));
    if (files.length) upload(files);
  };

  return (
    <div className="elb-tab" data-testid="episode-lookbook-tab">
      <header className="elb-header">
        <div>
          <h2 className="elb-title">Lookbook</h2>
          <p className="elb-counters">
            <span data-testid="elb-images-in">{data.images_in} {data.images_in === 1 ? 'image' : 'images'} in</span>
            <span aria-hidden="true"> · </span>
            <span data-testid="elb-ready">style sheet ready ({done} of {total})</span>
          </p>
          {missing.length > 0 && <p className="elb-missing">Still to add: {missing.map(spotLabel).join(', ')}</p>}
        </div>
        <button type="button" className="elb-btn elb-btn-primary" disabled={!onOpenTab} onClick={() => onOpenTab && onOpenTab('wardrobe')}
          title="The style sheet lives in Wardrobe">
          Preview style sheet
        </button>
      </header>

      {approved && <p className="elb-note">The style sheet is approved, so the Lookbook is read-only until it is reopened.</p>}
      {error && <p className="elb-error" role="alert">{error}</p>}

      {/* Batch drop zone and the To sort tray */}
      <section className="elb-section" aria-labelledby="elb-sort-heading">
        <div
          className={`elb-drop${dragging ? ' is-dragging' : ''}`}
          data-testid="elb-drop"
          onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={22} aria-hidden="true" />
          <p>Drop the episode's photos here; they land in To sort.</p>
          <FileButton label="Choose photos" multiple onFiles={(files) => upload(files)} disabled={locked} />
        </div>
        <h3 id="elb-sort-heading" className="elb-h3">To sort <span className="elb-count">{tray.length}</span></h3>
        {tray.length === 0 ? (
          <p className="elb-empty">Nothing to sort.</p>
        ) : (
          <ul className="elb-tray">
            {tray.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`elb-thumb${selected === t.id ? ' is-selected' : ''}`}
                  aria-pressed={selected === t.id}
                  aria-label={`Sort ${t.file_name || 'photo'}`}
                  disabled={locked}
                  onClick={() => setSelected(selected === t.id ? null : t.id)}
                >
                  <img src={t.image_url} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && tray.some((t) => t.id === selected) && (
          <div className="elb-picker" role="group" aria-label="Sort this photo into">
            {SPOTS.map((s) => (
              <button key={s.key} type="button" className="elb-chip" disabled={locked}
                onClick={() => { const id = selected; setSelected(null); move(id, { category: s.key }); }}>
                {s.label}
              </button>
            ))}
            <button type="button" className="elb-chip elb-chip-danger" disabled={locked}
              onClick={() => { const id = selected; setSelected(null); remove(id); }}>
              <X size={14} aria-hidden="true" /> Remove
            </button>
          </div>
        )}
      </section>

      {/* Lala in the look */}
      <section className="elb-section" aria-labelledby="elb-look-heading">
        <h3 id="elb-look-heading" className="elb-h3">Lala in the look</h3>
        <div className="elb-grid elb-grid-4">
          {LOOK_SLOTS.map((s) => <Slot key={s} spot={s} image={img(s)} busy={locked} onUpload={upload} onRemove={remove} />)}
        </div>
      </section>

      {/* Hair and Nails */}
      <section className="elb-section" aria-labelledby="elb-hair-heading">
        <h3 id="elb-hair-heading" className="elb-h3">Hair and nails</h3>
        <div className="elb-grid elb-grid-2">
          <div className="elb-pair">
            <Slot spot="hair" image={img('hair')} busy={locked} onUpload={upload} onRemove={remove} />
            <SavedField id="elb-hair-name" label="Hair name" value={data.hair_name} placeholder="e.g. soft glam waves" maxLength={120} disabled={locked} onSave={(v) => saveField({ hair_name: v })} />
          </div>
          <div className="elb-pair">
            <Slot spot="nails" image={img('nails')} busy={locked} onUpload={upload} onRemove={remove} />
            <SavedField id="elb-nails-name" label="Nails name" value={data.nails_name} placeholder="e.g. crimson almond" maxLength={120} disabled={locked} onSave={(v) => saveField({ nails_name: v })} />
          </div>
        </div>
      </section>

      {/* Beauty details */}
      <section className="elb-section" aria-labelledby="elb-beauty-heading">
        <h3 id="elb-beauty-heading" className="elb-h3">Beauty details</h3>
        <div className="elb-grid elb-grid-3">
          {BEAUTY_SLOTS.map((s) => (
            <div key={s} className="elb-pair">
              <Slot spot={s} image={img(s)} busy={locked} onUpload={upload} onRemove={remove} />
              <SavedField id={`elb-note-${s}`} label={`${spotLabel(s)} notes (optional)`} value={notes[s]} maxLength={600} multiline disabled={locked}
                onSave={(v) => saveField({ beauty_notes: { ...notes, [s]: v } })} />
            </div>
          ))}
        </div>
      </section>

      {/* Venue */}
      <section className="elb-section" aria-labelledby="elb-venue-heading">
        <h3 id="elb-venue-heading" className="elb-h3">Venue</h3>
        <p className="elb-sub">
          {data.scene_set
            ? <>From {data.event?.name ? `${data.event.name}'s` : "the event's"} scene set, {data.scene_set.name}. Tap an image to put it in the Lookbook.</>
            : data.event ? 'The event has no scene set yet; upload your own venue photos.' : 'This episode has no event yet; upload your own venue photos.'}
        </p>
        <ul className="elb-grid elb-grid-4 elb-venue">
          {(data.venue_options || []).map((o) => (
            <li key={`${o.source}-${o.ref_id}`}>
              <button type="button" className={`elb-venue-card${o.in_lookbook ? ' is-in' : ''}`} aria-pressed={o.in_lookbook} disabled={locked} onClick={() => toggleVenue(o)}>
                <img src={o.image_url} alt={`${o.label}, ${data.scene_set?.name || 'venue'}`} loading="lazy" />
                <span className="elb-venue-state">{o.in_lookbook ? <><Check size={14} aria-hidden="true" /> In lookbook</> : `${o.label} · tap to add`}</span>
              </button>
            </li>
          ))}
          {uploadedVenue.map((v) => (
            <li key={v.id}>
              <div className={`elb-venue-card${v.in_lookbook ? ' is-in' : ''}`}>
                <img src={v.image_url} alt="Your venue photo" loading="lazy" />
                <span className="elb-venue-row">
                  <button type="button" className="elb-chip" aria-pressed={v.in_lookbook} disabled={locked} onClick={() => move(v.id, { in_lookbook: !v.in_lookbook })}>
                    {v.in_lookbook ? <><Check size={14} aria-hidden="true" /> In lookbook</> : 'Add to lookbook'}
                  </button>
                  <button type="button" className="elb-icon-btn" aria-label="Remove venue photo" disabled={locked} onClick={() => remove(v.id)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <FileButton label="Upload your own" multiple onFiles={(files) => upload(files, 'venue')} disabled={locked} />
      </section>

      {/* Key inspo */}
      <section className="elb-section" aria-labelledby="elb-inspo-heading">
        <h3 id="elb-inspo-heading" className="elb-h3">Key inspo</h3>
        <div className="elb-grid elb-grid-4">
          {Array.from({ length: MAX_INSPO }, (_, i) => inspo[i] || null).map((p, i) => (
            p ? (
              <Slot key={p.id} spot={`inspo-${i}`} image={p} label={`Inspo ${i + 1}`} busy={locked} onUpload={(files) => run(async () => { await lookbookApi.remove(episodeId, p.id); return lookbookApi.upload(episodeId, files, 'inspo'); })} onRemove={remove} />
            ) : (
              <Slot key={`inspo-empty-${i}`} spot={`inspo-${i}`} image={null} label={`Inspo ${i + 1}`} busy={locked} onUpload={(files) => upload(files, 'inspo')} onRemove={remove} />
            )
          ))}
          {Array.from({ length: 2 }, (_, i) => data.texture_pieces?.[i] || null).map((piece, i) => (
            <figure key={`texture-${i}`} className="elb-slot" data-testid={`elb-texture-${i}`}>
              <div className="elb-slot-frame">
                {piece
                  ? <div className="elb-texture" style={{ backgroundImage: `url("${piece.image_url}")` }} role="img" aria-label={`Texture from ${piece.name || 'a piece'}`} />
                  : <span className="elb-slot-empty">Appears once the look has piece images</span>}
              </div>
              <figcaption className="elb-slot-caption">
                <span className="elb-slot-label">Texture {i + 1}</span>
                <span className="elb-sub">{piece ? `Made automatically from ${piece.name || 'a piece'}` : 'Made automatically'}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
