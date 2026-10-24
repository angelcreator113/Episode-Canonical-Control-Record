/**
 * Brands and companies (Evoni, 2026-10-18: "yes start the brand and company
 * profile pages"): every company in Lala's world, fashion brands first, then
 * magazines and press outlets, agencies and venues; each opens its profile
 * (/brands/:slug, pages/BrandProfilePage). Evoni adds a company here
 * (POST /api/v1/companies). It is the LalaVerse hub's Brands tab (Evoni,
 * 2026-10-19: "Brand & companies page being as a tab inside lalaverse");
 * /brands redirects there, and the hub's banner stands in for the heading.
 *
 * "Registry characters that look like companies" (Evoni, 2026-10-24: some
 * companies were made as characters too, so "Lala ↔ The Column" showed as a
 * relationship pair): for an admin, each registry character whose name is a
 * company's, or reads like one ("The …", "… Atelier"), with that company to
 * link it to, or "Make a company" (the kind guessed). Each asks first;
 * nothing links by itself (GET /companies/look-alikes, PUT
 * /companies/:slug/registry-character).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Plus, Building2 } from 'lucide-react';
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

const KIND_OPTIONS = [['brand', 'Fashion brand'], ['outlet', 'Magazine or press outlet'], ['agency', 'Agency'], ['venue', 'Venue']];

/** One look-alike: Link (or Make a company), with a confirm step in the row. */
function LookAlikeRow({ item, onDone }) {
  const [asking, setAsking] = useState(false);
  const [kind, setKind] = useState(item.guessed_kind || 'brand');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const make = !item.company;
  const link = async () => {
    setBusy(true); setError(null);
    try {
      let slug = item.company?.slug;
      let name = item.company?.name;
      if (make) {
        const { data } = await api.post('/api/v1/companies', { name: item.name, kind });
        slug = data.company.slug;
        name = data.company.name;
      }
      const { data } = await api.put(`/api/v1/companies/${encodeURIComponent(slug)}/registry-character`, { character_id: item.character_id });
      onDone(item, { slug, name, conflicts: data?.conflicts || [], made: make });
    } catch (err) {
      console.error('[CompaniesPage] the character could not be linked:', err);
      setError(errorOf(err, 'That did not link. Try again.'));
      setBusy(false);
    }
  };
  const why = item.company
    ? <>Same name as the company <Link to={`/brands/${item.company.slug}`}>{item.company.name}</Link></>
    : 'Reads like a company, and no company has this name';
  return (
    <li className="co-look-row" data-testid={`co-look-${item.character_id}`}>
      <div className="co-look-text">
        <Link className="co-look-name" to={`/character/${item.character_id}`}>{item.name}</Link>
        <span className="co-muted">{why}</span>
        {item.taken_by && <span className="co-muted">{item.company.name} is <Link to={`/character/${item.taken_by.id}`}>{item.taken_by.name}</Link> already.</span>}
      </div>
      {asking ? (
        <div className="co-look-confirm" role="group" aria-label={`Link ${item.name}`}>
          <p className="co-look-ask">
            {make
              ? <>Make <strong>{item.name}</strong> a company and mark this character as it?</>
              : <>Mark <strong>{item.name}</strong> as the company <strong>{item.company.name}</strong>?</>}
            {' '}Its relationships then take company types, never a romance or family.
          </p>
          {make && (
            <label className="co-field"><span>Kind</span>
              <select className="co-input" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy}>
                {KIND_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          )}
          {error && <p className="co-error" role="alert">{error}</p>}
          <div className="co-look-actions">
            <button type="button" className="co-btn is-primary" onClick={link} disabled={busy}>
              {busy ? 'Linking…' : make ? 'Make it and link' : 'Yes, link'}
            </button>
            <button type="button" className="co-btn" onClick={() => { setAsking(false); setError(null); }} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : !item.taken_by && (
        <button type="button" className="co-btn" onClick={() => setAsking(true)}>{make ? 'Make a company' : 'Link'}</button>
      )}
    </li>
  );
}

/** The registry characters that look like companies (admin only). */
function LookAlikes({ onLinked }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState([]);
  useEffect(() => {
    let live = true;
    api.get('/api/v1/companies/look-alikes')
      .then(({ data }) => { if (live) setItems(Array.isArray(data?.characters) ? data.characters : []); })
      .catch((err) => {
        console.error('[CompaniesPage] the look-alikes could not be read:', err);
        if (live) { setItems([]); setError(errorOf(err, 'The registry characters could not be checked.')); }
      });
    return () => { live = false; };
  }, []);
  if (!items) return null;
  if (!items.length && !done.length && !error) return null;
  const finished = (item, result) => {
    setItems((list) => list.filter((x) => x.character_id !== item.character_id));
    setDone((list) => [...list, { ...result, character: item.name, character_id: item.character_id }]);
    onLinked?.();
  };
  return (
    <section className="co-look" aria-labelledby="co-look-title" data-testid="co-look-alikes">
      <h2 id="co-look-title" className="co-look-title"><Building2 size={18} aria-hidden /> Registry characters that look like companies</h2>
      <p className="co-muted">A company made as a character shows up in relationship pairs. Link each one to its company: it then takes company types (client or partner, sponsor, press …), never a romance or family. Nothing links until you say so.</p>
      {error && <p className="co-error" role="alert">{error}</p>}
      {done.map((d) => (
        <p key={d.character_id} className="co-look-done" role="status">
          {d.character} is now <Link to={`/brands/${d.slug}`}>{d.name}</Link>{d.made ? ' (a new company)' : ''}.
          {d.conflicts.length > 0 && ` ${d.conflicts.length} of its relationships ${d.conflicts.length === 1 ? 'is' : 'are'} a romance or family (${d.conflicts.map((c) => c.with).join(', ')}): change ${d.conflicts.length === 1 ? 'it' : 'them'} on the Relationships page.`}
        </p>
      ))}
      {items.length > 0 && (
        <ul className="co-look-list">
          {items.map((it) => <LookAlikeRow key={it.character_id} item={it} onDone={finished} />)}
        </ul>
      )}
    </section>
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
      {admin && <LookAlikes onLinked={load} />}
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
