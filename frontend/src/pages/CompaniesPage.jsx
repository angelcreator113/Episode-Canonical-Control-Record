/**
 * Brands and companies (Evoni, 2026-10-18: "yes start the brand and company
 * profile pages"): every company in Lala's world, fashion brands first, then
 * magazines and press outlets, agencies and venues; each opens its profile
 * (/brands/:slug, pages/BrandProfilePage). Evoni adds a company here
 * (POST /api/v1/companies). It is the LalaVerse hub's Brands tab (Evoni,
 * 2026-10-19: "Brand & companies page being as a tab inside lalaverse");
 * /brands redirects there, and the hub's banner stands in for the heading.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import { atHandle } from './feed/feedConstants';
import './CompaniesPage.css';

const KINDS = [['', 'All'], ['brand', 'Fashion brands'], ['outlet', 'Press'], ['agency', 'Agencies'], ['venue', 'Venues']];
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

function NewCompany({ onMade }) {
  const [form, setForm] = useState({ name: '', kind: 'brand', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/api/v1/companies', form);
      onMade(data.company);
    } catch (err) {
      console.error('[CompaniesPage] the company could not be added:', err);
      setError(errorOf(err, 'That did not save. Try again.'));
    } finally { setBusy(false); }
  };
  return (
    <form className="co-new" onSubmit={save} data-testid="co-new">
      <label className="co-field"><span>Name</span><input className="co-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="co-field"><span>Kind</span>
        <select className="co-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="brand">Fashion brand</option><option value="outlet">Magazine or press outlet</option><option value="agency">Agency</option><option value="venue">Venue</option>
        </select>
      </label>
      <label className="co-field"><span>What it is (optional)</span><textarea className="co-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      {error && <p className="co-error" role="alert">{error}</p>}
      <button type="submit" className="co-btn is-primary" disabled={busy || !form.name.trim()}>{busy ? 'Adding…' : 'Add the company'}</button>
    </form>
  );
}

export default function CompaniesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const admin = isAdmin(user);
  const [kind, setKind] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/companies${kind ? `?kind=${kind}` : ''}`);
      setList(data.companies || []);
      setError(null);
    } catch (err) {
      console.error('[CompaniesPage] the companies could not be read:', err);
      setError(errorOf(err, 'The companies could not be loaded.'));
      setList([]);
    }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className={`co${embedded ? ' is-embedded' : ''}`} data-testid="companies">
      {!embedded && (
        <header className="co-head">
          <h1 className="co-title"><Store size={22} aria-hidden /> Brands &amp; companies</h1>
          <p className="co-muted">Every company in Lala&rsquo;s world: the fashion houses, the press, agencies and venues. Open one to see its profile.</p>
        </header>
      )}
      <div className="co-filters" role="group" aria-label="Kind">
        {KINDS.map(([key, label]) => (
          <button key={key || 'all'} type="button" className={`co-chip${kind === key ? ' is-on' : ''}`} aria-pressed={kind === key} onClick={() => setKind(key)}>{label}</button>
        ))}
        {admin && <button type="button" className="co-btn" onClick={() => setAdding((a) => !a)}><Plus size={14} aria-hidden /> New company</button>}
      </div>
      {adding && <NewCompany onMade={(c) => navigate(`/brands/${c.slug}`)} />}
      {error && <p className="co-error" role="alert">{error}</p>}
      {!list ? <p className="co-muted">Loading…</p> : list.length === 0 ? <p className="co-muted">No companies here yet.</p> : (
        <ul className="co-cards">
          {list.map((c) => (
            <li key={c.id} className="co-card" data-testid={`co-${c.slug}`}>
              <span className="co-kind">{c.kind_label}</span>
              <Link className="co-name" to={`/brands/${c.slug}`}>{c.name}</Link>
              {(c.defining_principle || c.description) && <p className="co-muted">{c.defining_principle || c.description}</p>}
              <p className="co-meta">
                {c.handle && <span>{atHandle(c.handle)}</span>}
                {c.deals > 0 && <span>{c.deals} deal{c.deals === 1 ? '' : 's'}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
