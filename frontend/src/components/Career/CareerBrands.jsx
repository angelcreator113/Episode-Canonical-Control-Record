/**
 * Brands worked with, in the Season Plan beside Career Goals (Task #3181;
 * Evoni, 2026-10-14: derived from executed agreements and past deals, with
 * a per-brand hide, no separate list). Each brand Lala has worked with, and
 * the episodes she worked with it; Hide leaves it off her Career list,
 * Show puts it back. The list itself is derived on the server
 * (GET /shows/:id/career-list); only the hidden names are saved
 * (PUT /shows/:id/career-list/hidden-brands, show settings).
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../services/api';
import './CareerBrands.css';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';
const episodesText = (episodes) => (episodes || []).map((e) => `Episode ${e.number ?? '?'}`).join(', ');

export default function CareerBrands({ showId }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!showId) return;
    api.get(`/api/v1/shows/${showId}/career-list`)
      .then((r) => { setList(r.data?.data || null); setError(null); })
      .catch((err) => { console.error('[CareerBrands] load failed:', err); setError(errorText(err)); });
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const saveHidden = async (hidden) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/v1/shows/${showId}/career-list/hidden-brands`, { brands: hidden });
      load();
    } catch (err) {
      console.error('[CareerBrands] saving hidden brands failed:', err);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  if (!showId) return null;
  const brands = list?.brands || [];
  const hidden = list?.hidden_brands || [];
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

  return (
    <section className="cb" aria-labelledby="cb-title" data-testid="career-brands">
      <h3 id="cb-title" className="cb-title">Brands worked with</h3>
      <p className="cb-line">From her past deals. Hide a brand to leave it off Lala&apos;s Career list.</p>
      {error && <p className="cb-error" role="alert">{error}</p>}
      {!list && !error && <p className="cb-muted"><Loader2 size={14} className="cb-spin" aria-hidden="true" /> Loading…</p>}
      {list && !brands.length && !hidden.length && <p className="cb-muted" data-testid="career-brands-none">No brands yet: they appear once an episode with a deal is accepted.</p>}
      {brands.length > 0 && (
        <ul className="cb-list">
          {brands.map((b) => (
            <li key={b.name} className="cb-item" data-testid="career-brand">
              <span className="cb-name">{b.name}</span>
              <span className="cb-eps">{episodesText(b.episodes)}</span>
              <button type="button" className="cb-btn" disabled={saving} onClick={() => saveHidden([...hidden, b.name])} aria-label={`Hide ${b.name}`}>
                <EyeOff size={14} aria-hidden="true" /> Hide
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden.length > 0 && (
        <div className="cb-hidden" data-testid="career-brands-hidden">
          <span className="cb-muted">Hidden:</span>
          {hidden.map((name) => (
            <button key={name} type="button" className="cb-chip" disabled={saving} onClick={() => saveHidden(hidden.filter((h) => !same(h, name)))} aria-label={`Show ${name}`}>
              <Eye size={13} aria-hidden="true" /> {name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
