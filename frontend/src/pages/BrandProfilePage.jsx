/**
 * A brand's or company's profile (Evoni, 2026-10-18: "do the brand and
 * companies get their own profiles that customed for a brand instead of a
 * character?" ... "yes start the brand and company profile pages").
 * /brands/:slug, for every kind (fashion brand, magazine or press outlet,
 * agency, venue); the tabs are the ones its kind has (GET
 * /api/v1/companies/:slug, services/brandProfile, constants/companyKinds):
 *
 *   Identity        its established history, what it believes and its tone,
 *                   kept apart (the Brand Canon Protection Rule); only Evoni
 *                   edits them, no AI writes here
 *   People          its founder and representatives with their authority
 *   On The Pulse    its account, posting schedule, posts and replies waiting,
 *                   and "Draft a post" (/api/v1/brand-pulse)
 *   Business        its deals, each with its deliverables' progress
 *                   (DeliverableProgress, compact; Evoni, 2026-10-19)
 *   Pictures        its library pictures (GET /api/v1/media, entity 'brand'),
 *                   by the library's own visibility rules (Evoni, 2026-10-19)
 *   Wardrobe        the pieces that are its
 *   Press & events  coverage of it and events it hosted (an outlet: what it
 *                   published; a venue: events held there)
 *   Relationships   how it sees the other brands
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Pencil, Sparkles, Users, Store, Shirt, Newspaper, Handshake, Link2, Radio, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/authGroups';
import { rememberedShowId } from '../utils/activeShow';
import { atHandle } from './feed/feedConstants';
import PostingSchedule from '../components/PostingSchedule/PostingSchedule';
import DeliverableProgress from '../components/Deliverables/DeliverableProgress';
import './BrandProfilePage.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const words = (v) => String(v || '').replace(/_/g, ' ');
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

const TAB_ICONS = { identity: Building2, people: Users, pulse: Radio, business: Handshake, pictures: ImageIcon, wardrobe: Shirt, press: Newspaper, relationships: Link2 };

// What each authority level means, in words (constants/brandPersonalities).
export const AUTHORITY_WORDS = Object.freeze({
  creative: { propose: 'Proposes', approve: 'Approves' },
  negotiate: { propose: 'Proposes terms', within_approved: 'Within an approved budget', full: 'Full' },
  spend: { none: 'None', delegated: 'Within delegated limits', full: 'Full' },
  finalize: { none: 'No', founder: 'Yes, as founder' },
});
const AUTHORITY_LABELS = [['creative', 'Creative'], ['negotiate', 'Negotiates'], ['spend', 'Spends'], ['finalize', 'Finalizes']];

// The identity fields Evoni edits (services/brandProfile EDITABLE_*).
const HISTORY_EDIT = [['founder', 'Founder'], ['description', 'What it is'], ['category', 'Category'], ['aesthetic', 'Aesthetic'], ['niche', 'Niche'], ['press_angle', 'How the press tells it'], ['website', 'Website']];
const BELIEF_EDIT = [['defining_principle', 'Defining principle'], ['beliefs', 'What it believes'], ['earns_trust', 'Earns its trust (one per line)'], ['damages_trust', 'Damages its trust (one per line)']];
const TONE_EDIT = [['direction', 'Its tone'], ['creator_selection', 'How it chooses creators'], ['deal_behavior', 'How it deals'], ['preferred_content', 'The content it wants (one per line)']];
const LONG = new Set(['description', 'founder', 'beliefs', 'earns_trust', 'damages_trust', 'preferred_content', 'press_angle']);

const valueText = (v) => (Array.isArray(v) ? v.join('\n') : v || '');

function Facts({ title, note, facts }) {
  return (
    <section className="bp-block">
      <h3 className="bp-h3">{title}</h3>
      {note && <p className="bp-muted">{note}</p>}
      {facts.length ? (
        <dl className="bp-facts">
          {facts.map((f) => (
            <div key={f.key} className="bp-fact">
              <dt>{f.label}</dt>
              <dd>{Array.isArray(f.value) ? <ul className="bp-list">{f.value.map((x) => <li key={x}>{x}</li>)}</ul> : f.value}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="bp-muted">Nothing written yet.</p>}
    </section>
  );
}

function IdentityEdit({ data, onSaved, onCancel }) {
  const fromFacts = (layer) => Object.fromEntries((data.identity[layer] || []).map((f) => [f.key, valueText(f.value)]));
  const [form, setForm] = useState(() => ({ name: data.company.name, kind: data.company.kind, ...fromFacts('history'), ...fromFacts('beliefs'), ...fromFacts('tone') }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const field = ([key, label]) => (
    <label key={key} className="bp-field">
      <span>{label}</span>
      {LONG.has(key)
        ? <textarea className="bp-input" rows={3} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        : <input className="bp-input" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
    </label>
  );
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data: next } = await api.put(`/api/v1/companies/${data.company.slug}`, form);
      onSaved(next);
    } catch (err) {
      console.error('[BrandProfilePage] the identity did not save:', err);
      setError(errorOf(err, 'That did not save. Try again.'));
    } finally { setBusy(false); }
  };
  return (
    <form className="bp-edit" onSubmit={save} data-testid="bp-identity-edit">
      <label className="bp-field"><span>Name</span><input className="bp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="bp-field"><span>Kind</span>
        <select className="bp-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="brand">Fashion brand</option><option value="outlet">Magazine or press outlet</option><option value="agency">Agency</option><option value="venue">Venue</option>
        </select>
      </label>
      <h4 className="bp-h4">Its history (established canon)</h4>
      {HISTORY_EDIT.map(field)}
      <h4 className="bp-h4">What it believes</h4>
      {BELIEF_EDIT.map(field)}
      <h4 className="bp-h4">Its tone</h4>
      {TONE_EDIT.map(field)}
      {error && <p className="bp-error" role="alert">{error}</p>}
      <div className="bp-actions">
        <button type="submit" className="bp-btn is-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="bp-btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function Identity({ data, admin, onSaved }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <IdentityEdit data={data} onSaved={(next) => { setEditing(false); onSaved(next); }} onCancel={() => setEditing(false)} />;
  return (
    <div className="bp-tab" data-testid="bp-identity">
      {admin && <button type="button" className="bp-btn" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden /> Edit</button>}
      <Facts title="Its history" note="Established canon. Only you change it; no writer adds to it." facts={data.identity.history} />
      <Facts title="What it believes" facts={data.identity.beliefs} />
      <Facts title="Its tone" facts={data.identity.tone} />
    </div>
  );
}

function People({ people }) {
  return (
    <div className="bp-tab" data-testid="bp-people">
      {people.founder && <p className="bp-lead"><strong>Founder:</strong> {people.founder}</p>}
      {people.people.length ? (
        <ul className="bp-cards">
          {people.people.map((p) => (
            <li key={p.key} className="bp-card">
              <p className="bp-name">{p.character_id ? <Link to={`/character/${p.character_id}`}>{p.name}</Link> : p.name}</p>
              {p.title && <p className="bp-muted">{p.title}{p.status === 'draft' ? ' · waiting for you to accept' : ''}</p>}
              {p.core_belief && <p className="bp-quote">{p.core_belief}</p>}
              {p.authority && (
                <dl className="bp-authority">
                  {p.authority.label && <div className="bp-fact"><dt>Authority</dt><dd>{p.authority.label}</dd></div>}
                  {AUTHORITY_LABELS.filter(([k]) => p.authority[k]).map(([k, label]) => (
                    <div key={k} className="bp-fact"><dt>{label}</dt><dd>{AUTHORITY_WORDS[k][p.authority[k]] || words(p.authority[k])}</dd></div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No people linked yet.</p>}
    </div>
  );
}

function Pulse({ data, admin, onChanged }) {
  const { company, pulse } = data;
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const showId = rememberedShowId();
  const run = async (key, fn) => {
    setBusy(key); setError(null); setNote(null);
    try { await fn(); } catch (err) {
      console.error(`[BrandProfilePage] ${key} failed:`, err);
      setError(errorOf(err, 'That did not work. Try again.'));
    } finally { setBusy(null); }
  };
  const makeAccounts = () => run('accounts', async () => {
    await api.post('/api/v1/brand-pulse/accounts');
    onChanged();
  });
  const draft = () => run('draft', async () => {
    const { data: d } = await api.post(`/api/v1/brand-pulse/brands/${company.id}/draft`, { show_id: showId, about: about.trim() || null });
    setNote(d.scheduled_at ? `Scheduled: it passed the gate and goes out ${new Date(d.scheduled_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : 'Drafted: it waits in Review.');
    setAbout('');
    onChanged();
  });
  return (
    <div className="bp-tab" data-testid="bp-pulse">
      {pulse.account ? (
        <>
          <p className="bp-lead"><strong>{atHandle(pulse.account.handle)}</strong> <span className="bp-muted">its account on The Pulse</span></p>
          <details className="bp-schedule"><summary>Posting schedule</summary><PostingSchedule profileId={pulse.account.id} /></details>
          {admin && company.kind === 'brand' && (
            <div className="bp-draft">
              <label className="bp-field"><span>Draft a post about (optional)</span>
                <input className="bp-input" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A drop, a look behind the scenes, a belief" />
              </label>
              {showId
                ? <button type="button" className="bp-btn is-primary" disabled={!!busy} onClick={draft}><Sparkles size={14} aria-hidden /> {busy === 'draft' ? 'Drafting…' : 'Draft a post'}</button>
                : <p className="bp-muted">Open a show first, so the post knows which show it belongs to.</p>}
            </div>
          )}
        </>
      ) : (
        <p className="bp-muted">
          No Pulse account of its own.{pulse.from === 'people' ? ' These are its people\'s posts.' : ''}
          {admin && company.kind === 'brand' && <> <button type="button" className="bp-btn" disabled={!!busy} onClick={makeAccounts}>Give the brands their Pulse accounts</button></>}
        </p>
      )}
      {note && <p className="bp-note">{note}</p>}
      {error && <p className="bp-error" role="alert">{error}</p>}
      <h3 className="bp-h3">Posts</h3>
      {pulse.posts.length ? (
        <ul className="bp-rows">
          {pulse.posts.map((p) => (
            <li key={p.id} className="bp-row">
              <span className="bp-row-text"><strong>{atHandle(p.handle)}</strong> {p.text}</span>
              <span className="bp-state">{p.status === 'live' ? `Live ${when(p.at)}` : p.release_state === 'scheduled' ? `Scheduled ${when(p.at)}` : 'Draft'}</span>
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No posts yet.</p>}
      {pulse.replies.length > 0 && (
        <>
          <h3 className="bp-h3">Replies waiting for you</h3>
          <ul className="bp-rows">{pulse.replies.map((r) => <li key={r.id} className="bp-row"><span className="bp-row-text">To {atHandle(r.to)}: {r.text}</span></li>)}</ul>
          <Link className="bp-link" to="/admin?tab=pulse&sub=review">Open Review</Link>
        </>
      )}
    </div>
  );
}

function Business({ deals }) {
  return (
    <div className="bp-tab" data-testid="bp-business">
      {deals.length ? (
        <ul className="bp-rows">
          {deals.map((d) => (
            <li key={d.id} className="bp-row">
              <span className="bp-row-text">
                <strong>{d.name}</strong>{d.show && <span className="bp-muted"> · {d.show}</span>}
                {d.amount != null && <span className="bp-muted"> · ${d.amount.toLocaleString()}</span>}
                {d.dates.length > 0 && <span className="bp-muted"> · {d.dates.map((x) => `${x.kind} ${day(x.date)}`).join(' · ')}</span>}
                {!d.linked && <span className="bp-muted"> · named, not linked</span>}
                {d.event_id && <span className="bp-progress"><DeliverableProgress opportunityId={d.id} compact canEdit={false} /></span>}
              </span>
              <span className="bp-state">{words(d.status)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No deals yet.</p>}
      <Link className="bp-link" to="/admin?tab=opportunities">Open Opportunities</Link>
    </div>
  );
}

// Its library pictures; who sees what is the library's rule (mediaLibrary
// visibilityWhere): an ADMIN sees drafts and private ones, marked.
const PRIVATE_WORDS = { private: 'Studio only', internal: null, public: null };

function Pictures({ company, admin }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    api.get('/api/v1/media', { params: { entity_type: 'brand', entity_id: company.id } })
      .then(({ data }) => { if (live) setItems(data.items || []); })
      .catch((err) => {
        console.error('[BrandProfilePage] its pictures could not be read:', err);
        if (live) setError(errorOf(err, 'Its pictures could not be loaded.'));
      });
    return () => { live = false; };
  }, [company.id]);
  if (error) return <div className="bp-tab" data-testid="bp-pictures"><p className="bp-error" role="alert">{error}</p></div>;
  if (!items) return <div className="bp-tab" data-testid="bp-pictures"><p className="bp-muted">Loading…</p></div>;
  return (
    <div className="bp-tab" data-testid="bp-pictures">
      {items.length ? (
        <ul className="bp-grid">
          {items.map((a) => (
            <li key={a.id} className="bp-piece" data-testid="bp-picture">
              <img src={a.thumbnail_url || a.url} alt={a.caption || company.name} loading="lazy" />
              {a.caption && <span className="bp-piece-name">{a.caption}</span>}
              {admin && (a.status !== 'approved' || PRIVATE_WORDS[a.visibility]) && (
                <span className="bp-muted bp-small">{[a.status !== 'approved' && words(a.status), PRIVATE_WORDS[a.visibility]].filter(Boolean).join(' · ')}</span>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No library pictures are tagged with {company.name} yet.</p>}
    </div>
  );
}

function Wardrobe({ pieces }) {
  return (
    <div className="bp-tab" data-testid="bp-wardrobe">
      {pieces.length ? (
        <ul className="bp-grid">
          {pieces.map((w) => (
            <li key={w.id} className="bp-piece">
              {w.image ? <img src={w.image} alt={w.name} loading="lazy" /> : <span className="bp-noimg"><Shirt size={22} aria-hidden /></span>}
              <span className="bp-piece-name">{w.name}</span>
              {w.event && <span className="bp-muted bp-small">Worn at {w.event}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No wardrobe pieces are tagged with it yet.</p>}
    </div>
  );
}

function Press({ press, kind }) {
  const empty = !press.coverage.length && !press.posts.length && !press.events.length;
  return (
    <div className="bp-tab" data-testid="bp-press">
      {empty && <p className="bp-muted">{kind === 'venue' ? 'No events held here yet.' : kind === 'outlet' ? 'Nothing published yet.' : 'No coverage or events yet.'}</p>}
      {press.coverage.length > 0 && (
        <>
          <h3 className="bp-h3">{kind === 'outlet' ? 'Pieces it covered' : 'Coverage'}</h3>
          <ul className="bp-rows">
            {press.coverage.map((c) => (
              <li key={c.id} className="bp-row bp-row-col">
                <span className="bp-muted bp-small">{[c.author, c.brand, c.piece].filter(Boolean).join(' · ')}</span>
                <span className="bp-row-text">{c.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {press.posts.length > 0 && (
        <>
          <h3 className="bp-h3">{kind === 'outlet' ? 'On The Pulse' : 'The press on The Pulse'}</h3>
          <ul className="bp-rows">{press.posts.map((p) => <li key={p.id} className="bp-row"><span className="bp-row-text"><strong>{atHandle(p.handle)}</strong> {p.text}</span></li>)}</ul>
        </>
      )}
      {press.events.length > 0 && (
        <>
          <h3 className="bp-h3">{kind === 'venue' ? 'Events held here' : 'Events it hosted'}</h3>
          <ul className="bp-rows">
            {press.events.map((e) => (
              <li key={e.id} className="bp-row">
                <span className="bp-row-text"><strong>{e.name}</strong>{e.date && <span className="bp-muted"> · {e.date}</span>}{kind === 'brand' && e.venue && <span className="bp-muted"> · at {e.venue}</span>}</span>
                <span className="bp-state">{words(e.status)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Relationships({ list }) {
  return (
    <div className="bp-tab" data-testid="bp-relationships">
      {list.length ? (
        <ul className="bp-rows">
          {list.map((r) => (
            <li key={r.slug} className="bp-row bp-row-col">
              <span className="bp-row-text"><strong>{r.linked ? <Link to={`/brands/${r.slug}`}>{r.name}</Link> : r.name}</strong> <span className="bp-state">{r.kind}</span></span>
              {r.note && <span className="bp-muted">{r.note}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="bp-muted">No relationships with the other brands written yet.</p>}
    </div>
  );
}

export default function BrandProfilePage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth() || {};
  const admin = isAdmin(user);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/api/v1/companies/${encodeURIComponent(slug)}`);
      setData(d);
      setError(null);
    } catch (err) {
      console.error('[BrandProfilePage] the profile could not be read:', err);
      setError(err?.response?.status === 404 ? 'There is no company here.' : errorOf(err, 'The profile could not be loaded.'));
    }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="bp"><p className="bp-error" role="alert">{error}</p><Link className="bp-link" to="/universe?tab=brands">← LalaVerse › Brands</Link></div>;
  if (!data) return <div className="bp"><p className="bp-muted">Loading…</p></div>;

  const { company, sections } = data;
  const tab = sections.some((s) => s.key === params.get('tab')) ? params.get('tab') : sections[0].key;
  const open = (key) => setParams((p) => { const next = new URLSearchParams(p); next.set('tab', key); return next; }, { replace: true });

  return (
    <div className="bp" data-testid="brand-profile">
      <Link className="bp-link bp-back" to="/universe?tab=brands">← LalaVerse › Brands</Link>
      <header className="bp-head">
        <p className="bp-kind"><Store size={14} aria-hidden /> {company.kind_label}{company.category ? ` · ${words(company.category)}` : ''}</p>
        <h1 className="bp-title">{company.name}</h1>
        {company.defining_principle && <p className="bp-principle">{company.defining_principle}</p>}
        {data.pulse?.account && <p className="bp-muted">{atHandle(data.pulse.account.handle)} on The Pulse</p>}
      </header>
      <nav className="bp-tabs" role="tablist" aria-label={`${company.name} profile`}>
        {sections.map((s) => {
          const Icon = TAB_ICONS[s.key] || Building2;
          return (
            <button key={s.key} type="button" role="tab" aria-selected={tab === s.key} className={`bp-tabbtn${tab === s.key ? ' is-on' : ''}`} onClick={() => open(s.key)}>
              <Icon size={14} aria-hidden /> {s.label}
            </button>
          );
        })}
      </nav>
      <div role="tabpanel">
        {tab === 'identity' && <Identity data={data} admin={admin} onSaved={(next) => setData(next)} />}
        {tab === 'people' && data.people && <People people={data.people} />}
        {tab === 'pulse' && data.pulse && <Pulse data={data} admin={admin} onChanged={load} />}
        {tab === 'business' && data.business && <Business deals={data.business} />}
        {tab === 'pictures' && <Pictures company={company} admin={admin} />}
        {tab === 'wardrobe' && data.wardrobe && <Wardrobe pieces={data.wardrobe} />}
        {tab === 'press' && data.press && <Press press={data.press} kind={company.kind} />}
        {tab === 'relationships' && data.relationships && <Relationships list={data.relationships} />}
      </div>
    </div>
  );
}
