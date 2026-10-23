/**
 * The Event Venue Look, in the Event Package's Place section (Evoni's
 * ruling L1, 2026-10-02, and her answers Q1-Q10; docs/EVENT_EPISODE_FLOW.md
 * §8(hh)).
 *
 *   L1. "Each event carries an Event Venue Look: overall look, décor and
 *   colours, lighting and time, event areas, signage, must include/avoid,
 *   and reference images. 'Draft from event details' fills it from the
 *   host, description, activity and dress code; it is labelled Auto-drafted
 *   and editable. It feeds the Scene Brief's event layer. The venue is the
 *   place; the look is how it's dressed for this occasion."
 *
 * Each part is labelled Auto-drafted or Edited. A redraft keeps the parts
 * Evoni edited, with no confirm (Q8). Reference images are shown, and used
 * as references only when ticked, at most 3 (Q6). Editable while the
 * event's episode is a draft; locked once it is accepted (Q9).
 *
 * Props: showId, eventId, onToast(msg), onSaved() (reloads the event, so
 * the page's save version follows the look's write).
 *
 * A failed load says so with Try again, and Write / Draft stay off until a
 * load succeeds: the editor would otherwise open empty and its Save would
 * replace the stored look with nothing. A write that succeeds but whose
 * page refresh (onSaved) fails reads "Saved — couldn't refresh", never as
 * a failed save.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Sparkles, X, ImagePlus, Lock, AlertCircle, RotateCw } from 'lucide-react';
import api from '../../services/api';
import ShowMoreToggle from '../ShowMoreToggle';
import { visibleSlice } from '../../lib/showMore';

export const LOOK_PARTS = [
  { key: 'overall', label: 'Overall look' },
  { key: 'decor', label: 'Décor and colours' },
  { key: 'lighting', label: 'Lighting and time' },
  { key: 'areas', label: 'Event areas' },
  { key: 'signage', label: 'Signage' },
  { key: 'must_include', label: 'Must include' },
  { key: 'must_avoid', label: 'Must avoid' },
];
const TICKED_MAX = 3;
// Place shows the first two parts; the rest and the reference images fold (2026-10-05).
export const PARTS_SHOWN = 2;

const hasContent = (look) => Boolean(look) && (
  LOOK_PARTS.some(({ key }) => (key === 'areas' ? look.areas?.length : look[key]))
  || look.references?.length > 0
);

function SourceLabel({ source, testId }) {
  if (!source) return null;
  const edited = source === 'edited';
  const Icon = edited ? Pencil : Sparkles;
  return (
    <span className="epp-basic-state" data-testid={testId}>
      <Icon size={11} aria-hidden="true" /> {edited ? 'Edited' : 'Auto-drafted · AI draft'}
    </span>
  );
}

export const REFRESH_FAILED_MESSAGE = "Saved — couldn't refresh the page. Reload to see the change.";

// Calls the page's refresh after a write that already succeeded. Its
// failure is logged and reported as a refresh failure, never as the write's.
async function refreshAfterWrite(onSaved, onToast) {
  try {
    await onSaved?.();
    return true;
  } catch (err) {
    console.error('[EventVenueLook] refresh after save failed:', err);
    onToast?.(REFRESH_FAILED_MESSAGE);
    return false;
  }
}

function toDraft(look) {
  return {
    overall: look?.overall || '',
    decor: look?.decor || '',
    lighting: look?.lighting || '',
    areas: (look?.areas || []).join('\n'),
    signage: look?.signage || '',
    must_include: look?.must_include || '',
    must_avoid: look?.must_avoid || '',
    references: (look?.references || []).map((r) => ({ ...r })),
  };
}

function LookEditor({ showId, eventId, look, onClose, onSaved, onToast }) {
  const [draft, setDraft] = useState(() => toDraft(look));
  const [initial] = useState(() => JSON.stringify(toDraft(look)));
  const dirty = JSON.stringify(draft) !== initial;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const ticked = draft.references.filter((r) => r.use_as_reference).length;
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('assetType', 'CUSTOM_GRAPHIC');
      form.append('show_id', showId);
      form.append('metadata', JSON.stringify({ purpose: 'venue_look_reference', event_id: eventId }));
      const res = await api.post('/api/v1/assets', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const asset = res.data?.data;
      if (!asset?.id) throw new Error('The upload returned no image');
      setDraft((d) => ({
        ...d,
        references: [...d.references, { asset_id: asset.id, use_as_reference: false, url: asset.s3_url_processed || asset.s3_url_raw || null }],
      }));
    } catch (err) {
      console.error('[EventVenueLook] reference upload failed:', err);
      setError(err.response?.data?.message || err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...Object.fromEntries(LOOK_PARTS.filter(({ key }) => key !== 'areas').map(({ key }) => [key, draft[key]])),
        areas: draft.areas.split('\n').map((a) => a.trim()).filter(Boolean),
        references: draft.references.map(({ asset_id, use_as_reference }) => ({ asset_id, use_as_reference })),
      };
      await api.put(`/api/v1/world/${showId}/events/${eventId}/venue-look`, { venue_look: body });
    } catch (err) {
      console.error('[EventVenueLook] save failed:', err);
      setError(err.response?.data?.error || err.message);
      setSaving(false);
      return;
    }
    // The look is saved: a refresh failure is said as one, not as a failed save.
    const refreshed = await refreshAfterWrite(onSaved, onToast);
    if (refreshed) onToast?.('Venue look saved');
    setSaving(false);
    onClose();
  };

  // A click outside the dialog closes it; with unsaved edits it asks first.
  const closeFromBackdrop = () => {
    if (saving) return;
    if (dirty && !window.confirm('Discard your unsaved changes to the venue look?')) return;
    onClose();
  };

  return (
    <div className="epp-modal-backdrop" onClick={closeFromBackdrop}>
      <div className="epp-modal evl-modal" role="dialog" aria-label="Edit venue look" data-testid="venue-look-editor" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Venue look</h3>
          <button className="epp-icon-btn" onClick={onClose} aria-label="Close" disabled={saving}><X size={16} /></button>
        </div>
        <div className="evl-editor-body">
          <p className="evl-hint">How the venue is dressed for this occasion. The venue is the place; the look is the occasion.</p>
          {LOOK_PARTS.map(({ key, label }) => (
            <label key={key} className="evl-field">
              <span>{label}{key === 'areas' ? ' (one per line)' : ''}</span>
              <textarea
                rows={key === 'overall' || key === 'decor' ? 3 : 2}
                value={draft[key]}
                onChange={(e) => set(key, e.target.value)}
                aria-label={label}
                data-testid={`venue-look-input-${key}`}
              />
            </label>
          ))}
          <div className="evl-field">
            <span>Reference images</span>
            <p className="evl-hint">Shown to you; sent to generation only when ticked (at most {TICKED_MAX}).</p>
            <div className="evl-refs">
              {draft.references.map((r, i) => (
                <div key={r.asset_id} className="evl-ref" data-testid={`venue-look-ref-${r.asset_id}`}>
                  {r.url ? <img src={r.url} alt={`Reference ${i + 1}`} /> : <div className="evl-ref-empty">No preview</div>}
                  <label className="evl-ref-tick">
                    <input
                      type="checkbox"
                      checked={r.use_as_reference}
                      disabled={!r.use_as_reference && ticked >= TICKED_MAX}
                      onChange={(e) => setDraft((d) => ({ ...d, references: d.references.map((x) => (x.asset_id === r.asset_id ? { ...x, use_as_reference: e.target.checked } : x)) }))}
                      data-testid={`venue-look-ref-tick-${r.asset_id}`}
                    />
                    Use as reference
                  </label>
                  <button type="button" className="epp-inline-link" onClick={() => setDraft((d) => ({ ...d, references: d.references.filter((x) => x.asset_id !== r.asset_id) }))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <label className="epp-btn epp-btn-small evl-upload">
              <ImagePlus size={14} aria-hidden="true" /> {uploading ? 'Uploading…' : 'Add image'}
              <input type="file" accept="image/*" hidden disabled={uploading} aria-label="Add reference image"
                onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {error && <p className="evl-error" role="alert">{error}</p>}
        </div>
        <div className="epp-modal-footer epp-basics-actions">
          <button type="button" className="epp-btn epp-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="epp-btn epp-btn-primary" onClick={save} disabled={saving || uploading} data-testid="venue-look-save">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventVenueLook({ showId, eventId, onToast, onSaved }) {
  const [look, setLook] = useState(null);
  const [editable, setEditable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${eventId}/venue-look`);
      setLook(res.data?.data?.venue_look || null);
      setEditable(res.data?.data?.editable !== false);
      setLoadFailed(false);
    } catch (err) {
      console.error('[EventVenueLook] load failed:', err);
      setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [showId, eventId]);

  useEffect(() => { load(); }, [load]);

  const draftLook = async () => {
    if (loadFailed) return;
    setDrafting(true);
    let data;
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/venue-look/draft`, {});
      data = res.data?.data || {};
    } catch (err) {
      console.error('[EventVenueLook] draft failed:', err);
      onToast?.(err.response?.data?.error || err.message || 'Drafting the venue look failed');
      setDrafting(false);
      return;
    }
    setLook(data.venue_look || null);
    const kept = (data.kept_edited || []).map((k) => LOOK_PARTS.find((p) => p.key === k)?.label).filter(Boolean);
    if (await refreshAfterWrite(onSaved, onToast)) {
      onToast?.(kept.length ? `Venue look drafted; kept your edits to ${kept.join(', ')}` : 'Venue look drafted');
    }
    setDrafting(false);
  };

  // After the editor's save: re-read the look (load catches its own
  // failure), then the page; a throw here would reach the editor as a
  // failed save, so the page refresh is passed through as is and the
  // editor's refreshAfterWrite reports it.
  const saved = async () => {
    await load();
    await onSaved?.();
  };

  // The parts with something in them, then the reference images as one more.
  const filled = hasContent(look) ? [
    ...LOOK_PARTS.map(({ key, label }) => ({ key, label, value: key === 'areas' ? (look.areas || []).join(', ') : look[key] })).filter((p) => p.value),
    ...(look.references?.length ? [{ key: 'references', label: 'Reference images' }] : []),
  ] : [];
  const parts = visibleSlice(filled, open, PARTS_SHOWN);

  return (
    <div className="evl" data-testid="venue-look">
      <div className="evl-head">
        <span className="epp-fields-label">Venue look</span>
        {editable ? (
          <div className="evl-actions">
            <button type="button" className="epp-btn epp-btn-small" onClick={draftLook} disabled={drafting || !loaded || loadFailed} data-testid="venue-look-draft">
              <Sparkles size={14} aria-hidden="true" /> {drafting ? 'Drafting…' : 'Draft from event details'}
            </button>
            <button type="button" className="epp-btn epp-btn-small" onClick={() => setEditing(true)} disabled={!loaded || loadFailed} data-testid="venue-look-edit">
              <Pencil size={14} aria-hidden="true" /> {hasContent(look) ? 'Edit' : 'Write'}
            </button>
          </div>
        ) : (
          <span className="evl-locked" data-testid="venue-look-locked"><Lock size={12} aria-hidden="true" /> Locked: the episode is accepted</span>
        )}
      </div>
      {loadFailed ? (
        <p className="evl-error" role="alert" data-testid="venue-look-load-failed">
          <AlertCircle size={12} aria-hidden="true" /> Couldn&apos;t load the venue look, so it can&apos;t be edited yet.{' '}
          <button type="button" className="epp-inline-link" onClick={() => load()} data-testid="venue-look-retry">
            <RotateCw size={11} aria-hidden="true" /> Try again
          </button>
        </p>
      ) : !hasContent(look) ? (
        <p className="evl-empty">No venue look yet. Draft it from the event details, or write it.</p>
      ) : (
        <>
        <dl className="evl-parts" id="evl-parts">
          {parts.shown.map(({ key, label, value }) => {
            if (key === 'references') return (
              <div key={key}>
                <dt>Reference images</dt>
                <dd className="evl-refs">
                  {look.references.map((r, i) => (
                    <figure key={r.asset_id} className="evl-ref">
                      {r.url ? <img src={r.url} alt={`Reference ${i + 1}`} /> : <div className="evl-ref-empty">No preview</div>}
                      {r.use_as_reference && <figcaption>Used as reference</figcaption>}
                    </figure>
                  ))}
                </dd>
              </div>
            );
            return (
              <div key={key} data-testid={`venue-look-part-${key}`}>
                <dt>{label} <SourceLabel source={look.sources?.[key]} testId={`venue-look-source-${key}`} /></dt>
                <dd>{value}</dd>
              </div>
            );
          })}
        </dl>
        <ShowMoreToggle open={open} hidden={parts.hidden} onToggle={() => setOpen((o) => !o)} noun={parts.hidden === 1 ? 'part' : 'parts'} testId="venue-look-more" controls="evl-parts" />
        </>
      )}
      {editing && !loadFailed && (
        <LookEditor showId={showId} eventId={eventId} look={look} onClose={() => setEditing(false)} onSaved={saved} onToast={onToast} />
      )}
    </div>
  );
}
