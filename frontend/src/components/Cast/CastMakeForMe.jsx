/**
 * CastMakeForMe — "Make one for me" on The Cast (Evoni, 2026-10-19: "Add
 * character" should be made for her, like the feed's "+ Generate 5").
 *
 * An optional one-line idea, then Make 1 or Make 3: one AI call
 * (POST /api/v1/character-generation/cast/propose, services/castGenerate).
 * Each proposal shows name, role, summary, city and traits with Keep, Try
 * again and Edit. Nothing is saved until Keep (POST .../cast/keep), which
 * makes the character and, in the LalaVerse, their Pulse profile. Edit hands
 * the proposal to the page's own New character form, prefilled.
 */

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Check, Pencil, X } from 'lucide-react';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';
import './CastMakeForMe.css';

const ROLE_LABELS = { pressure: 'Pressure', mirror: 'Mirror', support: 'Support', shadow: 'Shadow', special: 'Special' };
const CITY_LABELS = {
  dazzle_district: 'Dazzle District', radiance_row: 'Radiance Row', echo_park: 'Echo Park',
  ascent_tower: 'Ascent Tower', maverick_harbor: 'Maverick Harbor', outside_lalaverse: 'Outside the LalaVerse',
};

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export default function CastMakeForMe({ registries = [], registryId = null, onClose, onKept, onEdit }) {
  const [chosenId, setChosenId] = useState(registryId || (registries.length === 1 ? registries[0].id : null));
  const [idea, setIdea] = useState('');
  const [proposals, setProposals] = useState([]);
  const [busy, setBusy] = useState(null); // 'make' | index being kept
  const [lastCount, setLastCount] = useState(1);
  const [error, setError] = useState(null);
  const registry = registries.find((r) => r.id === chosenId) || null;

  const make = async (count) => {
    if (!registry) { setError('Choose the registry the character belongs to.'); return; }
    setBusy('make'); setError(null); setLastCount(count);
    try {
      const res = await api.post('/api/v1/character-generation/cast/propose', { registry_id: registry.id, idea: idea.trim(), count });
      setProposals(res.data?.proposals || []);
    } catch (err) {
      console.error('[CastMakeForMe] propose failed:', err);
      setError(err?.response?.status === 403 ? 'Only an admin can make characters.' : errorText(err, 'Nothing could be made. Try again.'));
    } finally { setBusy(null); }
  };

  const keep = async (proposal, i) => {
    setBusy(i); setError(null);
    try {
      const res = await api.post('/api/v1/character-generation/cast/keep', { registry_id: registry.id, proposal });
      setProposals((list) => list.filter((_, j) => j !== i));
      onKept?.(res.data?.character, registry);
    } catch (err) {
      console.error('[CastMakeForMe] keep failed:', err);
      setError(errorText(err, 'It could not be saved. Nothing was saved.'));
    } finally { setBusy(null); }
  };

  return (
    <div className="cast-modal-backdrop" onClick={onClose}>
      <div className="cast-modal cmfm" role="dialog" aria-modal="true" aria-labelledby="cmfm-title" data-testid="cmfm" onClick={(e) => e.stopPropagation()}>
        <div className="cmfm-head">
          <h3 id="cmfm-title" className="cast-modal-title"><Sparkles size={18} aria-hidden /> Make one for me</h3>
          <button type="button" className="cmfm-close" aria-label="Close" onClick={onClose}><X size={18} aria-hidden /></button>
        </div>
        <div className="cast-form">
          {(registries.length > 1 || !registry) && (
            <div>
              <label className="cast-label" htmlFor="cmfm-registry">Registry</label>
              <select id="cmfm-registry" data-testid="cmfm-registry" className={`cast-input${registry ? '' : ' is-wanting'}`}
                value={chosenId || ''} onChange={(e) => setChosenId(e.target.value || null)}>
                <option value="" disabled>Choose a registry…</option>
                {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="cast-label" htmlFor="cmfm-idea">An idea (optional)</label>
            <input id="cmfm-idea" data-testid="cmfm-idea" className="cast-input" maxLength={200} value={idea}
              onChange={(e) => setIdea(e.target.value)} placeholder="a rival stylist in Dazzle District" />
            <p className="cast-note cmfm-hint">Leave it empty and the cast&apos;s gaps decide. One AI call per click; nothing is saved until you keep one.</p>
          </div>
          <div className="cmfm-make">
            <button type="button" className="cast-btn-primary" data-testid="cmfm-make-1" disabled={busy !== null || !registry} onClick={() => make(1)}>
              <Sparkles size={16} aria-hidden /> {busy === 'make' && lastCount === 1 ? 'Making…' : 'Make 1'}
            </button>
            <button type="button" className="cast-btn-soft" data-testid="cmfm-make-3" disabled={busy !== null || !registry} onClick={() => make(3)}>
              {busy === 'make' && lastCount === 3 ? 'Making…' : 'Make 3'}
            </button>
          </div>
          {error && <p role="alert" className="cmfm-error" data-testid="cmfm-error">{error}</p>}
        </div>

        {proposals.length > 0 && (
          <ul className="cmfm-list" data-testid="cmfm-proposals">
            {proposals.map((p, i) => (
              <li key={`${p.display_name}-${i}`} className="cmfm-card" data-testid="cmfm-proposal">
                <div className="cmfm-card-head">
                  <span className="cmfm-icon" aria-hidden="true">{p.icon || '👤'}</span>
                  <div>
                    <strong className="cmfm-name">{p.display_name}</strong>
                    {p.selected_name && p.selected_name !== p.display_name && <span className="cmfm-real">{p.selected_name}</span>}
                  </div>
                </div>
                <div className="cmfm-chips">
                  <span className="cast-chip is-lavender">{ROLE_LABELS[p.role_type] || p.role_type}</span>
                  {p.role_label && <span className="cast-chip is-gold">{p.role_label}</span>}
                  {p.current_city && <span className="cast-chip is-green">{CITY_LABELS[p.current_city] || p.current_city}</span>}
                  {p.pulse?.handle && <span className="cast-chip is-lavender">{atHandle(p.pulse.handle)}</span>}
                </div>
                {p.description && <p className="cmfm-summary">{p.description}</p>}
                <dl className="cmfm-traits">
                  {p.signature_trait && <><dt>Trait</dt><dd>{p.signature_trait}</dd></>}
                  {p.core_desire && <><dt>Wants</dt><dd>{p.core_desire}</dd></>}
                  {p.core_fear && <><dt>Fears</dt><dd>{p.core_fear}</dd></>}
                </dl>
                <div className="cmfm-actions">
                  <button type="button" className="cast-btn-primary" data-testid="cmfm-keep" disabled={busy !== null} onClick={() => keep(p, i)}>
                    <Check size={16} aria-hidden /> {busy === i ? 'Keeping…' : 'Keep'}
                  </button>
                  <button type="button" className="cast-btn-soft" data-testid="cmfm-again" disabled={busy !== null} onClick={() => make(lastCount)}>
                    <RefreshCw size={16} aria-hidden /> Try again
                  </button>
                  <button type="button" className="cast-btn-soft" data-testid="cmfm-edit" disabled={busy !== null} onClick={() => onEdit?.(p, registry)}>
                    <Pencil size={16} aria-hidden /> Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
