/**
 * SceneModelComparison — base-still model comparison (Task #2396).
 *
 * Evoni, 2026-09-30: two scene prompts, a base still from each model for
 * each prompt, side by side with their logged costs, to choose the default.
 * Evoni, 2026-10-02: each image is built "from a real scene set's Scene
 * Brief (place layer, environment, no-people rule), not free text". So the
 * two prompts are two scene sets at a World Location; the estimate step
 * shows the prompt each set's brief sends to every model.
 * Styles live in pages/SceneSetsTab.css (the page that renders this).
 *
 * Also exports BaseModelSelect: the per-set base model choice
 * (scene_sets.base_model; empty = the default).
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader, X, Sparkles, AlertCircle } from 'lucide-react';
import apiClient from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const listBaseModelsApi = () => apiClient.get(`${API_BASE}/scene-sets/base-models`);
export const startModelComparisonApi = (payload) =>
  apiClient.post(`${API_BASE}/scene-sets/model-comparison`, payload);
export const listModelComparisonsApi = () => apiClient.get(`${API_BASE}/scene-sets/model-comparison`);
export const getModelComparisonApi = (group) =>
  apiClient.get(`${API_BASE}/scene-sets/model-comparison/${group}`);
export const updateSceneSetBaseModelApi = (setId, baseModel) =>
  apiClient.put(`${API_BASE}/scene-sets/${setId}`, { base_model: baseModel || null });

const POLL_MS = 5000;

export function formatUsd(v) {
  if (v === null || v === undefined) return 'unpriced';
  return `$${Number(v).toFixed(3)}`;
}

function isSettled(data) {
  if (!data) return false;
  return data.columns.every(col => col.sets.every(s => s.generation_status === 'complete' || s.generation_status === 'failed'));
}

export function BaseModelSelect({ set, onSaved, onError }) {
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState(null);
  const [value, setValue] = useState(set.base_model || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    listBaseModelsApi()
      .then(r => { if (alive) { setModels(r.data.models || []); setDefaultModel(r.data.default_model); } })
      .catch(err => { console.error('[BaseModelSelect] could not load base models', err); });
    return () => { alive = false; };
  }, []);

  const onChange = async (e) => {
    const next = e.target.value;
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await updateSceneSetBaseModelApi(set.id, next);
      onSaved?.(next || null);
    } catch (err) {
      console.error('[BaseModelSelect] save failed', err);
      setValue(prev);
      onError?.(err.response?.data?.error || 'Could not save base model');
    }
    setSaving(false);
  };

  const defaultLabel = models.find(m => m.key === defaultModel)?.label || defaultModel || 'default';
  return (
    <label className="scene-sets-base-model">
      <span>Base still model</span>
      <select value={value} onChange={onChange} disabled={saving} aria-label="Base still model">
        <option value="">Default ({defaultLabel})</option>
        {models.map(m => (
          <option key={m.key} value={m.key}>
            {m.label} · {m.width}×{m.height} · {formatUsd(m.estimate_usd)}
          </option>
        ))}
      </select>
    </label>
  );
}

const COMPARE_PREFIX = '[Compare';

/** The scene sets a comparison can draw from: at a World Location, not a comparison copy. */
export function comparableSets(sets) {
  return (sets || [])
    .filter(s => s.world_location_id && !String(s.name || '').startsWith(COMPARE_PREFIX))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export default function SceneModelComparison({ sets = [], onClose }) {
  const [setIds, setSetIds] = useState(['', '']);
  const [sources, setSources] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState(null);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let alive = true;
    listModelComparisonsApi()
      .then(r => { if (alive) setHistory(r.data.groups || []); })
      .catch(err => { console.error('[ModelComparison] could not list comparisons', err); });
    return () => { alive = false; };
  }, [group]);

  const load = useCallback(async (g) => {
    try {
      const r = await getModelComparisonApi(g);
      setData(r.data.data);
      return r.data.data;
    } catch (err) {
      console.error('[ModelComparison] could not load comparison', err);
      setError(err.response?.data?.error || 'Could not load the comparison');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!group) return undefined;
    let timer = null;
    let alive = true;
    const tick = async () => {
      const d = await load(group);
      if (alive && d && !isSettled(d)) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [group, load]);

  const choices = comparableSets(sets);
  const ready = setIds.every(Boolean) && setIds[0] !== setIds[1];

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      await startModelComparisonApi({ scene_set_ids: setIds });
      setError('Unexpected: the server generated without confirmation');
    } catch (err) {
      const body = err.response?.data;
      if (body?.code === 'CONFIRM_REQUIRED') { setEstimate(body.estimate); setSources(body.sources || null); }
      else {
        console.error('[ModelComparison] estimate failed', err);
        setError(body?.error || 'Could not get the estimate');
      }
    }
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await startModelComparisonApi({ scene_set_ids: setIds, confirm: true });
      setEstimate(null);
      setSources(null);
      setData(null);
      setGroup(r.data.data.group);
    } catch (err) {
      console.error('[ModelComparison] start failed', err);
      setError(err.response?.data?.error || 'Could not start the comparison');
    }
    setBusy(false);
  };

  return (
    <section className="scene-sets-compare" aria-label="Compare base models">
      <div className="scene-sets-compare-head">
        <h3>Compare base models</h3>
        {onClose && (
          <button type="button" className="scene-sets-compare-close" onClick={onClose} aria-label="Close comparison">
            <X size={14} />
          </button>
        )}
      </div>
      <p className="scene-sets-compare-hint">
        Base stills only: each model draws each set's Scene Brief (its place, environment and the no-people rule). Each still is a new scene set named “[Compare …]”; the two sets are not changed.
      </p>

      {[0, 1].map(i => (
        <label key={i} className="scene-sets-compare-field">
          <span>Scene set {i + 1}</span>
          <select
            value={setIds[i]}
            onChange={e => { const next = [...setIds]; next[i] = e.target.value; setSetIds(next); setEstimate(null); setSources(null); }}
          >
            <option value="">Choose…</option>
            {choices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      ))}
      {choices.length < 2 && (
        <p className="scene-sets-compare-hint">Two scene sets linked to a World Location are needed.</p>
      )}

      {!estimate && (
        <button type="button" className="scene-sets-btn-generate" disabled={!ready || busy} onClick={review}>
          {busy ? <Loader size={12} className="spin" /> : <Sparkles size={12} />} Review estimate
        </button>
      )}

      {estimate && (
        <div className="scene-sets-compare-estimate" data-testid="compare-estimate">
          {sources?.map((src, i) => (
            <details key={src.scene_set_id} className="scene-sets-compare-brief" open>
              <summary>Set {i + 1}: {src.name}, the prompt every model is sent</summary>
              <p>{src.prompt}</p>
              {src.missing?.length > 0 && (
                <p className="scene-sets-compare-unpriced">Missing from the brief: {src.missing.map(m => m.label).join(', ')}</p>
              )}
            </details>
          ))}
          <ul>
            {estimate.per_model.map(m => (
              <li key={m.model_key}>
                {m.label}: {m.stills} × {formatUsd(m.per_still_usd)} = {formatUsd(m.usd)}
              </li>
            ))}
          </ul>
          <p className="scene-sets-compare-total">Estimated total: {formatUsd(estimate.total_usd)}</p>
          {estimate.unpriced?.length > 0 && (
            <p className="scene-sets-compare-unpriced">Plus unpriced parts: {estimate.unpriced.join(' ')}</p>
          )}
          <div className="scene-sets-compare-actions">
            <button type="button" className="scene-sets-btn-generate" disabled={busy} onClick={confirm}>
              {busy ? <Loader size={12} className="spin" /> : null} Confirm and generate
            </button>
            <button type="button" className="scene-sets-btn-details" disabled={busy} onClick={() => setEstimate(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="scene-sets-compare-error" role="alert"><AlertCircle size={12} /> {error}</p>
      )}

      {history.length > 0 && (
        <label className="scene-sets-compare-field">
          <span>Earlier comparisons</span>
          <select value={group || ''} onChange={e => { setData(null); setGroup(e.target.value || null); }}>
            <option value="">Choose…</option>
            {history.map(h => (
              <option key={h.group} value={h.group}>
                {new Date(h.created_at).toLocaleString()} · {h.set_count} sets
              </option>
            ))}
          </select>
        </label>
      )}

      {data && (
        <div className="scene-sets-compare-grid" data-testid="compare-grid">
          {data.columns.map(col => (
            <div key={col.model_key} className="scene-sets-compare-col">
              <h4>{col.label}</h4>
              <p className="scene-sets-compare-meta">
                {col.model} · {col.width}×{col.height}{col.quality ? ` · ${col.quality}` : ''}
                {col.model_key === data.default_model ? ' · current default' : ''}
              </p>
              {col.sets.map(s => (
                <figure key={s.id} className="scene-sets-compare-still">
                  {s.base_still_url
                    ? <img src={s.base_still_url} alt={`${col.label}, prompt ${s.prompt_index + 1}`} loading="lazy" />
                    : <div className="scene-sets-compare-placeholder">
                        {s.generation_status === 'failed' ? 'Failed' : <><Loader size={14} className="spin" /> Generating</>}
                      </div>}
                  <figcaption>
                    {s.source_name || `Prompt ${s.prompt_index + 1}`} · logged {formatUsd(s.logged_cost_usd)}
                    {s.input_tokens_unpriced ? ' + unpriced input tokens' : ''}
                  </figcaption>
                </figure>
              ))}
              <p className="scene-sets-compare-total">
                Logged total: {formatUsd(col.logged_total_usd)}{col.logged_complete ? '' : ' (incomplete)'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
