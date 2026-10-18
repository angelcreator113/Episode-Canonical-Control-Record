/**
 * Times & seasons of a venue's everyday look (Evoni, 2026-10-15: "Each
 * venue needs its everyday look ... also the time of day and seasons";
 * time of day changes every view, season only exterior views;
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 2).
 *
 * Shown on the location's everyday set. Each slot (five times, four
 * seasons) is empty, generating, failed or an image, uploaded or generated.
 * "Generate" shows the cost first (S2) and makes one Kontext edit: a
 * re-light of the everyday look for a time, a re-season of the Front view
 * for a season. Reads GET /scene-sets/:setId/look-variants.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, Sparkles, Upload, X } from 'lucide-react';
import api from '../../services/api';
import './LookVariants.css';

// While a slot generates, the row refreshes every pollMs; the server ends a
// run stuck for 10 minutes (failed, or back to its previous image), so the
// refresh ends.
export const POLL_MS = 4000;
const POLL_MAX = 180;

const generatingIn = (data) => [...(data?.time || []), ...(data?.season || [])].some((s) => s.variant?.status === 'generating');

// refreshKey: changes when the set's Front view does (seventh audit), so a
// Front made or replaced in the same panel is read again.
export default function LookVariants({ setId, onToast, pollMs = POLL_MS, refreshKey = '' }) {
  const base = `/api/v1/scene-sets/${setId}/look-variants`;
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind, value, label, estimate }
  const [busy, setBusy] = useState(null); // `${kind}:${value}`
  const fileInput = useRef(null);
  const uploadTarget = useRef(null);
  const last = useRef(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  // Says when a slot this row saw generating finishes or fails.
  const announce = (prev, next) => {
    for (const kind of ['time', 'season']) {
      for (const slot of next?.[kind] || []) {
        const before = (prev?.[kind] || []).find((s) => s.value === slot.value);
        if (before?.variant?.status !== 'generating') continue;
        // A failed re-run keeps the previous image: complete, with the error.
        const failed = slot.variant?.status === 'failed' || (slot.variant?.status === 'complete' && slot.variant.error);
        if (slot.variant?.status === 'complete' && !failed) toastRef.current?.(`${slot.label} is ready`);
        if (failed) toastRef.current?.(`${slot.label} could not be generated${slot.variant.error ? `: ${slot.variant.error}` : ''}`, 'error');
      }
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get(base);
      // Only a reply with both rows is shown; anything else shows nothing.
      const raw = res.data?.data;
      const next = raw && Array.isArray(raw.time) && Array.isArray(raw.season) ? raw : null;
      if (last.current) announce(last.current, next);
      last.current = next;
      setData(next);
      setLoadFailed(false);
      return next;
    } catch (err) {
      console.error('[LookVariants] load failed:', err);
      if (!last.current) setLoadFailed(true);
      return null;
    }
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, refreshKey]);

  const generating = generatingIn(data);
  useEffect(() => {
    if (!generating) return undefined;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      const next = await load();
      if ((next && !generatingIn(next)) || polls >= POLL_MAX) clearInterval(timer);
    }, pollMs);
    return () => clearInterval(timer);
  }, [generating, load, pollMs]);

  const ask = async (kind, slot) => {
    setBusy(`${kind}:${slot.value}`);
    try {
      const res = await api.post(`${base}/${kind}/${slot.value}/estimate`, {});
      setConfirm({ kind, value: slot.value, label: slot.label, estimate: res.data?.data?.estimate || null });
    } catch (err) {
      console.error('[LookVariants] estimate failed:', err);
      onToast?.(err.response?.data?.error || 'Could not prepare this variant', 'error');
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    const { kind, value } = confirm;
    setConfirm(null);
    setBusy(`${kind}:${value}`);
    try {
      await api.post(`${base}/${kind}/${value}/generate`, {});
      await load();
    } catch (err) {
      console.error('[LookVariants] generate failed:', err);
      onToast?.(err.response?.data?.error || 'Could not generate this variant', 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (kind, value) => {
    uploadTarget.current = { kind, value };
    fileInput.current?.click();
  };

  const upload = async (file) => {
    const target = uploadTarget.current;
    if (!file || !target) return;
    setBusy(`${target.kind}:${target.value}`);
    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`${base}/${target.kind}/${target.value}/upload`, form);
      await load();
      onToast?.('Uploaded');
    } catch (err) {
      console.error('[LookVariants] upload failed:', err);
      onToast?.(err.response?.data?.error || 'Could not upload this variant', 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind, slot) => {
    // A generated variant was paid for: one click no longer deletes it.
    if (!window.confirm(`Remove ${slot.label}? Its image is deleted; making it again costs another generation.`)) return;
    setBusy(`${kind}:${slot.value}`);
    try {
      await api.delete(`${base}/${kind}/${slot.value}`);
      await load();
    } catch (err) {
      console.error('[LookVariants] remove failed:', err);
      onToast?.(err.response?.data?.error || 'Could not remove this variant', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loadFailed) {
    return (
      <p className="lv-error" data-testid="look-variants-load-failed">
        Couldn't load the times and seasons. <button type="button" className="lv-link" onClick={() => load()}>Try again</button>
      </p>
    );
  }
  if (!data) return null;

  const renderSlot = (kind, slot) => {
    const v = slot.variant;
    const key = `${kind}:${slot.value}`;
    const isBusy = busy === key;
    const seasonBlocked = kind === 'season' && !data.front_view_url;
    return (
      <figure key={key} className="lv-slot" data-testid={`look-variant-${kind}-${slot.value}`}>
        {v?.status === 'complete' && v.image_url
          ? <img src={v.image_url} alt={`${slot.label}`} />
          : (
            <div className="lv-empty">
              {v?.status === 'generating' || isBusy ? <Loader size={14} className="spin" aria-label="Working" /> : (v?.status === 'failed' ? '!' : '')}
            </div>
          )}
        <figcaption>
          {slot.label}
          {v?.source === 'uploaded' && v.status === 'complete' ? ' · uploaded' : ''}
        </figcaption>
        {v?.status === 'failed' && <span className="lv-error" title={v.error || ''}>Failed</span>}
        {v?.status === 'complete' && v.error && <span className="lv-error" title={v.error}>Last try failed</span>}
        {v?.status === 'complete' && v.stale && (
          <span className="lv-error" title={kind === 'season' ? "Made from an old Front view: beats don't use it" : "Made from an old everyday look: beats don't use it"} data-testid={`look-variant-stale-${kind}-${slot.value}`}>Old</span>
        )}
        {v?.status !== 'generating' && (
          <span className="lv-actions">
            <button type="button" className="lv-btn" disabled={isBusy || seasonBlocked}
              title={seasonBlocked ? 'Make this set\'s Front zone image first: the weather shows outside' : `Generate ${slot.label}`}
              onClick={() => ask(kind, slot)} data-testid={`look-variant-generate-${kind}-${slot.value}`}>
              <Sparkles size={11} aria-hidden="true" />
            </button>
            <button type="button" className="lv-btn" disabled={isBusy} title={`Upload ${slot.label}`}
              onClick={() => pickFile(kind, slot.value)} data-testid={`look-variant-upload-${kind}-${slot.value}`}>
              <Upload size={11} aria-hidden="true" />
            </button>
            {v && (
              <button type="button" className="lv-btn" disabled={isBusy} title={`Remove ${slot.label}`}
                onClick={() => remove(kind, slot)} data-testid={`look-variant-remove-${kind}-${slot.value}`}>
                <X size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        )}
      </figure>
    );
  };

  return (
    <div className="lv" data-testid="look-variants" onClick={(e) => e.stopPropagation()}>
      <span className="lv-label">Times of day</span>
      <div className="lv-row">{data.time.map((s) => renderSlot('time', s))}</div>
      <span className="lv-label">Weather <span className="lv-hint">(the outside: made from the Front view)</span></span>
      {!data.front_view_url && (
        <p className="lv-hint" data-testid="look-variants-no-front">Make this set's Front zone image to generate the weather, or upload your own.</p>
      )}
      <div className="lv-row">{data.season.map((s) => renderSlot('season', s))}</div>

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="look-variant-file"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />

      {confirm && (
        <div className="lv-confirm" role="dialog" aria-label={`Generate ${confirm.label}`} data-testid="look-variant-confirm">
          <span>
            Generate {confirm.label}{confirm.estimate?.usd != null ? ` — est. $${Number(confirm.estimate.usd).toFixed(2)}` : ''}?
            {' '}{confirm.kind === 'time' ? 'A re-light of the everyday look.' : 'The Front view in this weather.'}
          </span>
          <button type="button" className="lv-btn lv-btn-primary" onClick={generate} data-testid="look-variant-confirm-yes">Generate</button>
          <button type="button" className="lv-btn" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
