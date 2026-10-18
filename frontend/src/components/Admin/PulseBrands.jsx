/**
 * Admin › The Pulse › Brands (Evoni, 2026-10-18: "start the brands on the
 * pulse"; services/brandPulse, /api/v1/brand-pulse). Each LalaVerse brand:
 * its Pulse account, its representative, "Draft a post" (as the brand or
 * signed by the rep), its recent posts and their state, replies waiting, the
 * posts it could answer, and its deals with whether each can be announced.
 * "Draft this week for every brand" drafts a week in one call; passing
 * posts are scheduled, the rest wait in Review. A deal announcement always
 * waits in Review, and only the account or a founder announces one.
 * Styles: PulseBrands.css (pb-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Handshake, Megaphone, MessageSquareReply, Sparkles, Store } from 'lucide-react';
import api from '../../services/api';
import './PulseBrands.css';

const REVIEW = '/admin?tab=pulse&sub=review';
const errorOf = (err, fallback) => err.response?.data?.error || fallback;

/** A brand post's state, in words. */
export function postState(p) {
  if (p.status === 'live') return 'Live';
  if (p.release_state === 'scheduled' && p.release_at) {
    return `Scheduled for ${new Date(p.release_at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
  }
  const review = Array.isArray(p.review) ? p.review : [];
  if (review.includes('brand_deal')) return 'Deal announcement: in Review';
  if (review.length) return 'In Review';
  return 'Draft';
}

function BrandCard({ brand, showId, onChanged }) {
  const [rep, setRep] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [answerable, setAnswerable] = useState(null);
  const [deals, setDeals] = useState(null);

  const act = async (key, fn) => {
    setBusy(key); setError(null); setNote(null);
    try { await fn(); } catch (err) {
      console.error(`[PulseBrands] ${key} failed for ${brand.name}:`, err);
      setError(errorOf(err, 'That did not work. Try again.'));
    } finally { setBusy(null); }
  };

  const draft = () => act('draft', async () => {
    const { data } = await api.post(`/api/v1/brand-pulse/brands/${brand.id}/draft`, { show_id: showId, rep: rep || null, about: about.trim() || null });
    setNote(data.published ? 'Posted: it passed the gate.' : 'Drafted: it waits in Review.');
    setAbout('');
    onChanged();
  });
  const loadAnswerable = () => act('replies', async () => {
    const { data } = await api.get(`/api/v1/brand-pulse/brands/${brand.id}/replies?show_id=${showId}`);
    setAnswerable(data.posts || []);
  });
  const reply = (postId) => act(`reply-${postId}`, async () => {
    await api.post(`/api/v1/brand-pulse/brands/${brand.id}/replies`, { post_id: postId, rep: rep || null });
    setAnswerable((list) => (list || []).filter((p) => p.id !== postId));
    setNote('Reply drafted: it waits in Review.');
    onChanged();
  });
  const loadDeals = () => act('deals', async () => {
    const { data } = await api.get(`/api/v1/brand-pulse/brands/${brand.id}/deals?show_id=${showId}`);
    setDeals(data.deals || []);
  });
  const announce = (dealId) => act(`deal-${dealId}`, async () => {
    await api.post(`/api/v1/brand-pulse/brands/${brand.id}/deals/${dealId}/announce`, { rep: rep || null });
    setNote('Announcement drafted: it waits in Review.');
    onChanged();
  });

  return (
    <li className="pb-card" data-testid={`pb-brand-${brand.slug}`}>
      <div className="pb-card-head">
        <h4 className="pb-name">{brand.name}</h4>
        {brand.account ? <span className="pb-handle">@{brand.account.handle}</span> : <span className="pb-muted">No Pulse account yet</span>}
      </div>
      {brand.principle && <p className="pb-principle">{brand.principle}</p>}
      {brand.reps.length > 0 && (
        <p className="pb-muted">
          {brand.reps.map((r) => `${r.name}, ${r.title} (${r.authority})`).join(' · ')}
        </p>
      )}

      {brand.account && (
        <>
          <div className="pb-draft">
            <label className="pb-label" htmlFor={`pb-who-${brand.slug}`}>Who posts</label>
            <select id={`pb-who-${brand.slug}`} className="pb-input" value={rep} onChange={(e) => setRep(e.target.value)}>
              <option value="">{brand.name}</option>
              {brand.reps.map((r) => <option key={r.key} value={r.key}>{r.name}, signed</option>)}
            </select>
            <label className="pb-label" htmlFor={`pb-about-${brand.slug}`}>About (optional)</label>
            <input id={`pb-about-${brand.slug}`} className="pb-input" value={about} maxLength={500}
              placeholder="A drop, behind the scenes, or one of its beliefs" onChange={(e) => setAbout(e.target.value)} />
            <div className="pb-actions">
              <button type="button" className="pb-btn is-primary" disabled={!!busy} onClick={draft}>
                <Sparkles size={14} aria-hidden /> {busy === 'draft' ? 'Drafting…' : 'Draft a post'}
              </button>
              <button type="button" className="pb-btn" disabled={!!busy} onClick={loadAnswerable}>
                <MessageSquareReply size={14} aria-hidden /> Posts it could answer
              </button>
              <button type="button" className="pb-btn" disabled={!!busy} onClick={loadDeals}>
                <Handshake size={14} aria-hidden /> Deals
              </button>
            </div>
          </div>

          {note && <p className="pb-note" role="status">{note}</p>}
          {error && <p className="pb-error" role="alert">{error}</p>}

          {answerable && (
            <div className="pb-section">
              <h5 className="pb-h5">Posts it could answer</h5>
              {answerable.length === 0 ? <p className="pb-muted">No post names {brand.name} or wears it right now.</p> : (
                <ul className="pb-list">
                  {answerable.map((p) => (
                    <li key={p.id} className="pb-item">
                      <span className="pb-item-text"><b>@{p.poster_handle}</b> {p.content_text}</span>
                      <button type="button" className="pb-btn" disabled={!!busy} onClick={() => reply(p.id)}>
                        {busy === `reply-${p.id}` ? 'Drafting…' : 'Draft a reply'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {deals && (
            <div className="pb-section" data-testid={`pb-deals-${brand.slug}`}>
              <h5 className="pb-h5">Deals</h5>
              {deals.length === 0 ? <p className="pb-muted">No {brand.name} deals in this show.</p> : (
                <ul className="pb-list">
                  {deals.map((d) => (
                    <li key={d.id} className="pb-item">
                      <span className="pb-item-text"><b>{d.name}</b> · {d.status}</span>
                      {d.announce.ok ? (
                        <button type="button" className="pb-btn" disabled={!!busy} onClick={() => announce(d.id)}>
                          <Megaphone size={14} aria-hidden /> {busy === `deal-${d.id}` ? 'Drafting…' : 'Draft the announcement'}
                        </button>
                      ) : <span className="pb-muted">{d.announce.reason}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="pb-muted">An announcement always waits in Review. Only the {brand.name} account or a founder announces a signed deal.</p>
            </div>
          )}

          <div className="pb-section">
            <h5 className="pb-h5">Recent posts</h5>
            {brand.posts.length === 0 ? <p className="pb-muted">Nothing posted yet.</p> : (
              <ul className="pb-list">
                {brand.posts.map((p) => (
                  <li key={p.id} className="pb-item">
                    <span className="pb-item-text">{p.content_text}</span>
                    <span className="pb-state">{postState(p)}</span>
                  </li>
                ))}
              </ul>
            )}
            {brand.replies.length > 0 && (
              <p className="pb-muted">{brand.replies.length} repl{brand.replies.length === 1 ? 'y waits' : 'ies wait'} in <Link to={REVIEW}>Review</Link>.</p>
            )}
          </div>
        </>
      )}
    </li>
  );
}

export default function PulseBrands({ showId }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/api/v1/brand-pulse?show_id=${showId}`);
      setData(d);
    } catch (err) {
      console.error('[PulseBrands] the brands could not be read:', err);
      setError(errorOf(err, 'The brands could not be loaded.'));
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key); setError(null); setNote(null);
    try { await fn(); await load(); } catch (err) {
      console.error(`[PulseBrands] ${key} failed:`, err);
      setError(errorOf(err, 'That did not work. Try again.'));
    } finally { setBusy(null); }
  };
  const giveAccounts = () => run('accounts', async () => {
    const { data: d } = await api.post('/api/v1/brand-pulse/accounts');
    setNote(d.created.length ? `Made ${d.created.length} account${d.created.length === 1 ? '' : 's'}: ${d.created.map((c) => `@${c.handle}`).join(', ')}.` : 'Every brand already has its account.');
  });
  const draftWeek = () => run('week', async () => {
    const { data: d } = await api.post('/api/v1/brand-pulse/draft-week', { show_id: showId });
    const scheduled = d.routed.filter((r) => r.scheduled_at).length;
    setNote(`Drafted ${d.routed.length} post${d.routed.length === 1 ? '' : 's'}: ${scheduled} scheduled, ${d.routed.length - scheduled} in Review${d.failed.length ? `, ${d.failed.length} could not be read` : ''}.`);
  });

  if (!data && !error) return <p className="pb-muted">Loading…</p>;
  const brands = data?.brands || [];
  return (
    <section className="pb" data-testid="pulse-brands" aria-labelledby="pb-heading">
      <header className="pb-head">
        <h3 id="pb-heading" className="pb-h3"><Store size={18} aria-hidden /> Brands on The Pulse</h3>
        <p className="pb-muted">
          The six houses post in their own voice, from the personalities you approved. Everyday posts go through the gate like anyone&rsquo;s; replies and deal announcements wait for you in <Link to={REVIEW}>Review</Link>.
        </p>
        <div className="pb-actions">
          {data?.accounts_missing > 0 && (
            <button type="button" className="pb-btn is-primary" disabled={!!busy} onClick={giveAccounts}>
              <Store size={14} aria-hidden /> {busy === 'accounts' ? 'Making them…' : 'Give the brands their Pulse accounts'}
            </button>
          )}
          <button type="button" className="pb-btn" disabled={!!busy || data?.accounts_missing === brands.length} onClick={draftWeek}>
            <CalendarPlus size={14} aria-hidden /> {busy === 'week' ? 'Drafting the week…' : 'Draft this week for every brand'}
          </button>
        </div>
        <p className="pb-muted pb-small">Each draft uses one of today&rsquo;s manual Pulse requests; the week is one request for every brand.</p>
      </header>
      {note && <p className="pb-note" role="status">{note}</p>}
      {error && <p className="pb-error" role="alert">{error}</p>}
      <ul className="pb-cards">
        {brands.map((b) => <BrandCard key={b.id} brand={b} showId={showId} onChanged={load} />)}
      </ul>
      {data && brands.length === 0 && <p className="pb-muted">No LalaVerse brands yet.</p>}
    </section>
  );
}
