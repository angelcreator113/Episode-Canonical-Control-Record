/**
 * Opportunities: a brand's offers and bookings, from offered to paid, with
 * beat 14 attach, undo, release and "Schedule as Event". Moved out of
 * WorldAdmin.jsx (2026-10-25) when it became the Season page's Opportunities
 * tab; Producer Mode's old ?tab=opportunities link opens it there.
 * `S` is Producer Mode's style object (components/Show/producerStyles).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import DeliverableProgress from '../Deliverables/DeliverableProgress';
import { Beat14AttachForm, HeldForBeat14, HeldWhy, canAttachToBeat14, canUndo, isCompletedEpisode, releaseText, scheduleEarlyText } from './OpportunityBeat14';

// ─── OPPORTUNITIES TAB COMPONENT ─────────────────────────────────────────────
export default function OpportunitiesTab({ showId, api, S, setToast, loadData, episodes = [] }) {
  const [opps, setOpps] = useState([]);
  const [oppLoading, setOppLoading] = useState(true);
  // ?deal_with=<company> (the Season page's "Add a deal" on a need with a
  // company in it, Evoni 2026-10-24) opens the form with that company typed;
  // the server links the name to the company (services/brandProfile.linkDeal).
  const [dealParams] = useSearchParams();
  const [oppForm, setOppForm] = useState(() => {
    const dealWith = (dealParams.get('deal_with') || '').trim();
    return dealWith ? { name: '', opportunity_type: 'brand_deal', category: 'fashion', prestige: 5, payment_amount: 0, brand_or_company: dealWith.slice(0, 200) } : null;
  });
  // The card whose "Attach to beat 14…" form is open (Evoni, 2026-10-19).
  const [attachingId, setAttachingId] = useState(null);
  const OPP_TYPES = ['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'podcast', 'interview', 'award_show'];
  // Text tokens, each at least 4.5:1 on the card and on its own 12% tint
  // (Script page audit 3, 2026-10-19: amber "offered" was 2.15:1).
  const OPP_STATUS_COLORS = { offered: 'var(--warning-text)', considering: 'var(--lala-lavender-text)', negotiating: 'var(--accent-dark)', booked: 'var(--success-text)', preparing: 'var(--info-text)', active: 'var(--success-text)', completed: 'var(--primary-text)', paid: 'var(--primary-text)', declined: 'var(--text-muted)', cancelled: 'var(--danger-text)', archived: 'var(--text-muted)' };
  const tint = (c) => `color-mix(in srgb, ${c} 12%, transparent)`;
  // Payments are coins: careerPipelineService adds payment_amount to a coins
  // goal (Script page audit 3, 2026-10-19: the tab showed dollars).
  const coinsText = (n) => `${Math.round(n).toLocaleString()} coins`;
  // Focus goes back to the card when its attach form closes (Script page audit 3, 2026-10-19).
  const focusCardRef = useRef(null);
  useEffect(() => {
    const id = focusCardRef.current;
    if (id == null || attachingId != null) return;
    focusCardRef.current = null;
    const card = document.querySelector(`[data-opp-card="${id}"]`);
    (card?.querySelector(`[data-testid="opp-beat14-open-${id}"]`) || card?.querySelector('a, button'))?.focus();
  });

  const loadOpps = useCallback(() => api.get(`/api/v1/opportunities/${showId}`)
    .then(r => { setOpps(r.data.opportunities || []); setOppLoading(false); })
    .catch((err) => { console.error('[OpportunitiesTab] the opportunities could not be read:', err); setOppLoading(false); }), [showId, api]);
  useEffect(() => { loadOpps(); }, [loadOpps]);

  // The companies a deal can be with (Evoni, 2026-10-18: brand and company
  // profiles): picked from the list, or typed; the server links a typed name
  // to the company of that name (services/brandProfile.linkDeal).
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    api.get('/api/v1/companies').then(r => setCompanies(r.data.companies || [])).catch((err) => { console.error('[OpportunitiesTab] the companies could not be read:', err); setCompanies([]); });
  }, []);
  const companyById = new Map(companies.map(c => [c.id, c]));

  const createOpp = async () => {
    if (!oppForm?.name) return;
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}`, oppForm);
      if (res.data.success) { setOpps(prev => [res.data.opportunity, ...prev]); setOppForm(null); setToast('Opportunity created'); }
    } catch (err) { console.error('[OpportunitiesTab] create failed:', err); setToast('Failed: ' + (err.response?.data?.error || err.message)); }
  };

  // Ask before the steps that do more than move a status (Evoni,
  // 2026-10-19: a click meant to set one up marked it complete): completed
  // and paid run the career pipeline.
  const advanceOpp = async (opp, toStatus) => {
    if (['completed', 'paid'].includes(toStatus)
      && !window.confirm(`Mark ${opp.name} ${toStatus}? This also checks career goals and can unlock new opportunities.`)) return;
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}/${opp.id}/advance`, { to_status: toStatus });
      if (res.data.success) { setOpps(prev => prev.map(o => o.id === opp.id ? res.data.opportunity : o)); setToast(`${opp.name} → ${toStatus}`); }
    } catch (err) { console.error('[OpportunitiesTab] advance failed:', err); setToast(err.response?.data?.error || 'Failed'); }
  };

  // Undo the last step (POST …/undo): only the status goes back; what the
  // career pipeline did is not undone.
  const undoOpp = async (opp) => {
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}/${opp.id}/undo`);
      if (res.data.success) { setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, ...res.data.opportunity } : o)); setToast(`${opp.name} → back to ${res.data.opportunity.status}`); }
    } catch (err) { console.error('[OpportunitiesTab] undo failed:', err); setToast(err.response?.data?.error || 'Could not undo'); }
  };

  // Release offer on a held one (POST …/release; Evoni, 2026-10-23): it is
  // offered now and stays its episode's beat 14 invitation. Asks first only
  // while the episode is not completed, as it skips waiting for the result.
  const releaseOpp = async (opp) => {
    if (!isCompletedEpisode(opp.beat14_episode) && !window.confirm(releaseText(opp))) return;
    try {
      const res = await api.post(`/api/v1/opportunities/${showId}/${opp.id}/release`);
      if (res.data.success) { setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, ...res.data.opportunity } : o)); setToast(`${opp.name} is offered`); }
    } catch (err) { console.error('[OpportunitiesTab] release failed:', err); setToast(err.response?.data?.error || 'Could not release it'); }
  };

  const toEvent = async (opp) => {
    const early = opp.status === 'held';
    if (!window.confirm(early ? scheduleEarlyText(opp) : `Schedule ${opp.name} as an event? This creates a world event for it and marks it booked.`)) return;
    try {
      setToast(`Scheduling "${opp.name}" as event...`);
      const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
      if (res.data.success) {
        setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, event_id: res.data.data.event_id, status: 'booked' } : o));
        loadData();
        setToast(`"${opp.name}" scheduled — event created with ${res.data.data.guests || 0} guests`);
      }
    } catch (err) { console.error('[OpportunitiesTab] schedule as event failed:', err); setToast('Failed: ' + (err.response?.data?.error || err.message)); }
  };

  const pipeline = {};
  opps.forEach(o => { const s = o.status || 'offered'; if (!pipeline[s]) pipeline[s] = []; pipeline[s].push(o); });
  const totalValue = opps.reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);
  const bookedValue = opps.filter(o => ['booked','preparing','active','completed','paid'].includes(o.status)).reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);

  return (
    <div style={S.content} data-testid="opp-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ ...S.cardTitle, margin: '0 0 4px' }}>Opportunities</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opps.length} total · {coinsText(bookedValue)} booked · {coinsText(totalValue)} pipeline</div>
        </div>
        <button onClick={() => setOppForm({ name: '', opportunity_type: 'modeling', category: 'fashion', prestige: 5, payment_amount: 0 })} style={S.primaryBtn}>+ New Opportunity</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['offered','considering','negotiating','held','booked','preparing','active','completed','paid'].map(s => {
          const count = pipeline[s]?.length || 0;
          if (!count) return null;
          if (s === 'held') return <span key={s} className="ob14-chip-held">held for beat 14: {count}</span>;
          return <span key={s} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: tint(OPP_STATUS_COLORS[s] || 'var(--text-muted)'), color: OPP_STATUS_COLORS[s] || 'var(--text-muted)' }}>{s}: {count}</span>;
        })}
      </div>
      {oppForm && (
        <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>New Opportunity</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={S.fLabel}>Name</label><input value={oppForm.name} onChange={e => setOppForm({ ...oppForm, name: e.target.value })} placeholder="Velour Magazine Cover" style={S.sel} /></div>
            <div><label style={S.fLabel}>Type</label><select value={oppForm.opportunity_type} onChange={e => setOppForm({ ...oppForm, opportunity_type: e.target.value })} style={S.sel}>{OPP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label style={S.fLabel}>Category</label><select value={oppForm.category} onChange={e => setOppForm({ ...oppForm, category: e.target.value })} style={S.sel}>{['fashion','beauty','lifestyle','luxury','entertainment','media'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={S.fLabel} htmlFor="opp-company">Brand or company</label>
              <input id="opp-company" list="opp-companies" value={oppForm.brand_or_company || ''} onChange={e => setOppForm({ ...oppForm, brand_or_company: e.target.value })} style={S.sel} />
              <datalist id="opp-companies">{companies.map(c => <option key={c.id} value={c.name}>{c.kind_label}</option>)}</datalist>
              <Link to="/universe?tab=brands" style={{ fontSize: 10 }}>New company</Link>
            </div>
            <div><label style={S.fLabel}>Payment (coins)</label><input type="number" value={oppForm.payment_amount || 0} onChange={e => setOppForm({ ...oppForm, payment_amount: parseInt(e.target.value) || 0 })} style={S.sel} /></div>
            <div><label style={S.fLabel}>Prestige</label><input type="number" min={1} max={10} value={oppForm.prestige || 5} onChange={e => setOppForm({ ...oppForm, prestige: parseInt(e.target.value) || 5 })} style={S.sel} /></div>
            <div><label style={S.fLabel}>Season</label><input value={oppForm.season || ''} onChange={e => setOppForm({ ...oppForm, season: e.target.value })} placeholder="FW26" style={S.sel} /></div>
          </div>
          <div style={{ marginBottom: 8 }}><label style={S.fLabel}>Narrative Stakes</label><textarea value={oppForm.narrative_stakes || ''} onChange={e => setOppForm({ ...oppForm, narrative_stakes: e.target.value })} rows={2} placeholder="Why this matters..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} /></div>
          <div style={{ display: 'flex', gap: 6 }}><button onClick={createOpp} style={S.primaryBtn}>Create</button><button onClick={() => setOppForm(null)} style={S.smBtn}>Cancel</button></div>
        </div>
      )}
      {oppLoading ? <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opps.map(opp => {
            const held = opp.status === 'held';
            const sc = held ? 'var(--lala-gold)' : (OPP_STATUS_COLORS[opp.status] || 'var(--text-muted)');
            const NEXT = { offered: 'considering', considering: 'negotiating', negotiating: 'booked', booked: 'preparing', preparing: 'active', active: 'completed', completed: 'paid' };
            return (
              <div key={opp.id} data-opp-card={opp.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${sc}`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{opp.name}</div>
                    <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {held
                        ? <HeldForBeat14 opp={opp} />
                        : <span style={{ padding: '1px 6px', borderRadius: 4, background: tint(sc), color: sc, fontWeight: 600, fontSize: 10 }}>{opp.status}</span>}
                      <span>{opp.opportunity_type?.replace(/_/g, ' ')}</span>
                      {opp.company_id && companyById.get(opp.company_id)
                        ? <Link to={`/brands/${companyById.get(opp.company_id).slug}`}>{opp.brand_or_company || companyById.get(opp.company_id).name}</Link>
                        : opp.brand_or_company && <span>{opp.brand_or_company}</span>}
                    </div>
                  </div>
                  {parseFloat(opp.payment_amount) > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-text)' }} data-testid={`opp-payment-${opp.id}`}>{coinsText(parseFloat(opp.payment_amount))}</div>}
                </div>
                {opp.narrative_stakes && <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{opp.narrative_stakes}</div>}
                {held && <HeldWhy opp={opp} />}
                <div className="ob14-card-actions" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {NEXT[opp.status] && <button onClick={() => advanceOpp(opp, NEXT[opp.status])} data-testid={`opp-move-${opp.id}`} style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${sc}`, background: 'transparent', color: sc, fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>Move to {NEXT[opp.status]}</button>}
                  {canAttachToBeat14(opp) && attachingId !== opp.id && (
                    <button type="button" className="ob14-btn" onClick={() => setAttachingId(opp.id)} data-testid={`opp-beat14-open-${opp.id}`}>Attach to beat 14…</button>
                  )}
                  {canUndo(opp) && (
                    <button type="button" className="ob14-btn" onClick={() => undoOpp(opp)} data-testid={`opp-undo-${opp.id}`} title="Puts its status back one step. What completing or paying did (career goals, unlocked opportunities) stays.">Undo last step</button>
                  )}
                  {opp.status === 'offered' && <button onClick={() => advanceOpp(opp, 'declined')} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>Decline</button>}
                  {!opp.event_id && ['offered','considering','negotiating','booked','preparing','active'].includes(opp.status) && (
                    <button type="button" className="ob14-btn-gold" onClick={() => toEvent(opp)} data-testid={`opp-schedule-${opp.id}`}>📅 Schedule as Event</button>
                  )}
                  {held && !opp.event_id && (
                    <>
                      <button type="button" className="ob14-btn ob14-btn-icon" onClick={() => releaseOpp(opp)} data-testid={`opp-release-${opp.id}`}><Send size={12} aria-hidden="true" />Release offer</button>
                      <button type="button" className="ob14-btn-gold" onClick={() => toEvent(opp)} data-testid={`opp-schedule-now-${opp.id}`}>📅 Schedule as Event now</button>
                    </>
                  )}
                  {opp.event_id && <span style={{ fontSize: 9, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', borderRadius: 4, fontWeight: 600 }}>✓ Event scheduled</span>}
                </div>
                {attachingId === opp.id && (
                  <Beat14AttachForm showId={showId} opp={opp} episodes={episodes} api={api}
                    onCancel={() => { focusCardRef.current = opp.id; setAttachingId(null); }}
                    onDone={async (ep) => { focusCardRef.current = opp.id; setAttachingId(null); setToast(`${opp.name} is beat 14's opportunity in ${ep?.title || (ep?.episode_number != null ? `Episode ${ep.episode_number}` : 'the episode')}`); await loadOpps(); }} />
                )}
                {/* Deliverables that check themselves (Evoni, 2026-10-19): "Pulse stories: 2 of 3". */}
                {opp.event_id && <DeliverableProgress opportunityId={opp.id} compact />}
              </div>
            );
          })}
          {opps.length === 0 && !oppForm && (
            <div style={{ textAlign: 'center', padding: 30, background: '#FAF7F0', borderRadius: 12, border: '1px solid #e8e0d0' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>💼</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No opportunities yet</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Modeling gigs, runway shows, magazine covers — they start here.</div>
              <button onClick={() => setOppForm({ name: '', opportunity_type: 'modeling', category: 'fashion', prestige: 5, payment_amount: 0 })} style={S.primaryBtn}>+ Create First Opportunity</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
