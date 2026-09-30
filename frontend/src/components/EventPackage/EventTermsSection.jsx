/**
 * EventTermsSection — the Event Package's Terms area (Task #1814, slice 1a).
 *
 * The four kinds of term (docs/EVENT_EPISODE_FLOW.md §8(t) item 1), one
 * sub-section each, each saved to its own home:
 *   Access requirements — event.requirements, through the event PUT
 *   Deliverables        — event_deliverables, through
 *                         /world/:showId/events/:eventId/deliverables
 *   Restrictions        — event.restrictions, through the event PUT
 *   Compensation        — event.is_paid / payment_amount, through the event PUT
 *
 * Deal type (deal build PR 2, Task #2330; docs/DEAL_DESIGN.md §2.2) sits
 * above Compensation: event.deal_type, through the event PUT. The server
 * drafts it at creation by a fixed rule, so it reads "Auto-drafted ·
 * <source>" until Evoni changes it, then Edited (doctrine rule 14). It
 * locks with the terms.
 *
 * Deal price (deal build PR 3, Task #2341; docs/DEAL_DESIGN.md §12;
 * Evoni's Deal PR 3 ruling, EVENT_EPISODE_FLOW.md §8(cc)) sits below it: the
 * components the deal type carries (appearance fee, partnership base,
 * performance fee — each its own event column, through the event PUT), the
 * "also requires an appearance" switch for a brand partnership, the gifted
 * value of a gifted deal, and each deliverable's fee (through the deliverable
 * routes). "Propose terms" drafts them from the rate card (POST
 * .../propose-terms), with the premiums Evoni picks for each component; the
 * numbers read "Auto-drafted · pricing v<N>" until she changes them, then
 * Edited. A missing price reads "Price required", and Start Episode refuses
 * until it has one. All lock with the terms.
 *
 * The Package owns the accepted terms (§8(t) item 2). Editing stops at
 * Start Episode (`locked`, the page's used_in_episode_id check), which is
 * also when the deliverable routes start refusing writes (409).
 *
 * Fulfilment (Task #1815, slice 1b) is recorded here too, once the terms
 * are locked: each deliverable shows its status and the date of each step
 * reached, and one button moves it to the next status
 * (pending → completed → submitted → approved) through
 * POST .../deliverables/:id/status. Nothing is shown at approved. Before
 * Start Episode the terms are still being edited and there is no button.
 * Deliverables are not tasks (§8(t) item 3), so they are recorded here,
 * on the terms, not on the Run Sheet's social task list; completing the
 * episode never moves them (§8(t) item 4).
 *
 * Costs (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md §5) sit below
 * Deal price for a deal event: its itemised costs and who pays each
 * (EventCostsTerm), locking with the terms.
 *
 * Styles live in pages/EventPackagePage.css (one CSS file per page).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, ClipboardList, Ban, Coins, Lock, Pencil, Plus, Trash2, Loader2, AlertCircle, Check, Handshake, Calculator,
} from 'lucide-react';
import api from '../../services/api';
import {
  REQUIREMENT_KEYS, describeRequirements, requirementsDraftFrom, buildRequirementsUpdate,
  restrictionsOf, restrictionLabel, buildRestrictionAdd, buildRestrictionRemove,
  describeCompensation, compensationDraftFrom, buildCompensationUpdate,
  buildDeliverableBody, deliverableDraftFrom, DELIVERABLE_OWED_TO_LABELS,
  DELIVERABLE_STATUS_LABELS, deliverableStatusOf, nextDeliverableStatus, deliverableAdvanceLabel, deliverableTimeline,
  RESTRICTION_MAX, DELIVERABLE_DESCRIPTION_MAX, DELIVERABLE_DUE_MAX,
  DEAL_TYPES, DEAL_TYPE_LABELS, describeDealType, buildDealTypeUpdate,
  DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS, deliverableTypeLabel, hasRateAnchor,
  dealPlanFor, describeComponentFee, describeGiftedValue, describeDeliverableFee, missingPriceLabels,
  buildComponentFeeUpdate, premiumChoicesFrom, buildProposeBody,
} from '../../utils/eventTerms';
import EventCostsTerm from './EventCostsTerm';

const deliverablesUrl = (showId, eventId) => `/api/v1/world/${showId}/events/${eventId}/deliverables`;

export const listDeliverablesApi = (showId, eventId) => api.get(deliverablesUrl(showId, eventId));
export const createDeliverableApi = (showId, eventId, body) => api.post(deliverablesUrl(showId, eventId), body);
export const updateDeliverableApi = (showId, eventId, id, body) => api.put(`${deliverablesUrl(showId, eventId)}/${id}`, body);
export const deleteDeliverableApi = (showId, eventId, id) => api.delete(`${deliverablesUrl(showId, eventId)}/${id}`);
export const advanceDeliverableApi = (showId, eventId, id, status) => api.post(`${deliverablesUrl(showId, eventId)}/${id}/status`, { status });
export const rateCardApi = () => api.get('/api/v1/deal-rates');
export const proposeTermsApi = (showId, eventId, body) => api.post(`/api/v1/world/${showId}/events/${eventId}/propose-terms`, body);

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function EventTermsSection({ showId, eventId, event, locked, putEvent, onSaved, onToast }) {
  const toast = (msg) => { if (onToast) onToast(msg); };

  // ── Deliverables ──
  const [deliverables, setDeliverables] = useState([]);
  const [delivLoading, setDelivLoading] = useState(true);
  const [delivLoadError, setDelivLoadError] = useState(null);
  const [delivForm, setDelivForm] = useState(null); // null | { id: null } (add) | { id } (edit)
  const [delivDraft, setDelivDraft] = useState(deliverableDraftFrom(null));
  const [delivFormError, setDelivFormError] = useState(null);
  const [delivSaving, setDelivSaving] = useState(false);

  const loadDeliverables = useCallback(async () => {
    setDelivLoading(true); setDelivLoadError(null);
    try {
      const res = await listDeliverablesApi(showId, eventId);
      setDeliverables(Array.isArray(res.data?.deliverables) ? res.data.deliverables : []);
    } catch (err) {
      console.error('[EventTerms] deliverables load failed:', err);
      setDelivLoadError(errorMessage(err, 'Failed to load deliverables'));
    } finally {
      setDelivLoading(false);
    }
  }, [showId, eventId]);

  useEffect(() => { loadDeliverables(); }, [loadDeliverables]);

  // A refusal because the terms locked elsewhere reloads the page, which
  // then shows the event as used.
  const onDeliverableWriteError = (err, fallback) => {
    console.error('[EventTerms] deliverable write failed:', err);
    setDelivFormError(errorMessage(err, fallback));
    if (err?.response?.status === 409 && onSaved) onSaved();
  };

  const openDeliverableForm = (d) => {
    if (locked) return;
    setDelivDraft(deliverableDraftFrom(d || null));
    setDelivFormError(null);
    setDelivForm({ id: d ? d.id : null });
  };
  const closeDeliverableForm = () => { if (!delivSaving) { setDelivForm(null); setDelivFormError(null); } };

  const saveDeliverable = async () => {
    if (locked || delivSaving || !delivForm) return;
    const built = buildDeliverableBody(delivDraft);
    if (built.error) { setDelivFormError(built.error); return; }
    setDelivSaving(true);
    try {
      if (delivForm.id) await updateDeliverableApi(showId, eventId, delivForm.id, built.body);
      else await createDeliverableApi(showId, eventId, built.body);
      toast(delivForm.id ? 'Deliverable saved' : 'Deliverable added');
      setDelivForm(null);
      await loadDeliverables();
    } catch (err) {
      onDeliverableWriteError(err, 'Failed to save deliverable');
    } finally {
      setDelivSaving(false);
    }
  };

  // ── Fulfilment: after Start Episode only ──
  const [advancingId, setAdvancingId] = useState(null);
  const [advanceError, setAdvanceError] = useState(null); // { id, message }

  const advanceDeliverable = async (d) => {
    const next = nextDeliverableStatus(deliverableStatusOf(d));
    if (!locked || !next || advancingId) return;
    setAdvancingId(d.id); setAdvanceError(null);
    try {
      const res = await advanceDeliverableApi(showId, eventId, d.id, next);
      const updated = res.data?.deliverable;
      if (updated?.id) setDeliverables((list) => list.map((row) => (row.id === updated.id ? updated : row)));
      else await loadDeliverables();
      toast(`Marked ${DELIVERABLE_STATUS_LABELS[next].toLowerCase()}`);
    } catch (err) {
      console.error('[EventTerms] deliverable status change failed:', err);
      setAdvanceError({ id: d.id, message: errorMessage(err, 'Failed to record the status') });
      // A refusal (moved elsewhere, not started) means the row on screen is
      // stale: reload it.
      if (err?.response?.status === 400 || err?.response?.status === 409) await loadDeliverables();
    } finally {
      setAdvancingId(null);
    }
  };

  // "No fee (0)" (Evoni, 2026-09-30): one click sets a deliverable that pays
  // nothing to 0, so it no longer reads "Price required" or holds Start
  // Episode. 0 is a price; a missing number is not.
  const setNoFee = async (d) => {
    if (locked || delivSaving) return;
    setDelivSaving(true);
    try {
      await updateDeliverableApi(showId, eventId, d.id, { fee: 0 });
      toast('Set to no fee (0)');
      await loadDeliverables();
    } catch (err) {
      onDeliverableWriteError(err, 'Failed to set no fee');
      toast(errorMessage(err, 'Failed to set no fee'));
    } finally {
      setDelivSaving(false);
    }
  };

  const removeDeliverable = async (d) => {
    if (locked || delivSaving) return;
    setDelivSaving(true);
    try {
      await deleteDeliverableApi(showId, eventId, d.id);
      toast('Deliverable removed');
      await loadDeliverables();
    } catch (err) {
      onDeliverableWriteError(err, 'Failed to remove deliverable');
      toast(errorMessage(err, 'Failed to remove deliverable'));
    } finally {
      setDelivSaving(false);
    }
  };

  // ── Event-PUT terms: requirements, restrictions, compensation ──
  const [reqDraft, setReqDraft] = useState(null);
  const [compDraft, setCompDraft] = useState(null);
  const [restrictionText, setRestrictionText] = useState('');
  const [restrictionError, setRestrictionError] = useState(null);
  const [dealDraft, setDealDraft] = useState(null); // null, or the chosen deal type ('' = none)
  const [termSaving, setTermSaving] = useState(null); // 'requirements' | 'restrictions' | 'compensation' | 'deal type'

  const saveEventTerm = async (which, body, okMessage) => {
    if (locked || termSaving) return false;
    setTermSaving(which);
    try {
      await putEvent(body);
      toast(okMessage);
      if (onSaved) await onSaved();
      return true;
    } catch (err) {
      console.error(`[EventTerms] ${which} save failed:`, err);
      toast(errorMessage(err, `Failed to save ${which}`));
      return false;
    } finally {
      setTermSaving(null);
    }
  };

  const requirements = describeRequirements(event);
  const reqUpdate = reqDraft ? buildRequirementsUpdate(event, reqDraft) : null;
  const saveRequirements = async () => {
    if (!reqUpdate || reqUpdate.unchanged || reqUpdate.errors.length) return;
    if (await saveEventTerm('requirements', reqUpdate.body, 'Access requirements saved')) setReqDraft(null);
  };

  const restrictions = restrictionsOf(event);
  const addRestriction = async () => {
    const built = buildRestrictionAdd(event, restrictionText);
    if (built.error) { setRestrictionError(built.error); return; }
    setRestrictionError(null);
    if (await saveEventTerm('restrictions', built.body, 'Restriction added')) setRestrictionText('');
  };
  const removeRestriction = (index) => {
    saveEventTerm('restrictions', buildRestrictionRemove(event, index).body, 'Restriction removed');
  };

  const dealType = describeDealType(event);
  const dealUpdate = dealDraft !== null ? buildDealTypeUpdate(event, dealDraft) : null;
  const saveDealType = async () => {
    if (!dealUpdate || dealUpdate.unchanged || dealUpdate.error) return;
    if (await saveEventTerm('deal type', dealUpdate.body, 'Deal type saved')) setDealDraft(null);
  };

  // ── Deal price (Task #2341) ──
  const plan = dealPlanFor(event);
  const missingPrices = missingPriceLabels(event, deliverables);
  const [feeDraft, setFeeDraft] = useState(null); // null, or { field, value } for one component
  const [pricing, setPricing] = useState(null); // null, or { card, selection, loading, error, gaps }
  const [proposing, setProposing] = useState(false);
  // Bumped after a proposal, which drafts a new deal's extras as cost rows.
  const [costsKey, setCostsKey] = useState(0);

  const saveComponentFee = async (label) => {
    if (!feeDraft) return;
    const built = buildComponentFeeUpdate(feeDraft.field, feeDraft.value);
    if (built.error) { toast(`${label}: ${built.error}`); return; }
    if (await saveEventTerm(label.toLowerCase(), built.body, `${label} saved`)) setFeeDraft(null);
  };

  const emptySelection = () => ({ components: {}, deliverables: {} });

  const openPricing = async () => {
    if (locked) return;
    setPricing({ card: null, selection: emptySelection(), loading: true, error: null, gaps: [] });
    try {
      const res = await rateCardApi();
      setPricing((p) => ({ ...p, card: res.data?.card || null, loading: false }));
    } catch (err) {
      console.error('[EventTerms] rate card load failed:', err);
      setPricing((p) => ({ ...p, loading: false, error: errorMessage(err, 'Failed to load the rate card') }));
    }
  };

  // Ruling 3: a premium is chosen for one component, and applies only to it.
  const choosePremium = (group, line, kind, key) => setPricing((p) => {
    const selection = { components: { ...p.selection.components }, deliverables: { ...p.selection.deliverables } };
    selection[group][line] = { ...(selection[group][line] || {}), [kind]: key };
    return { ...p, selection };
  });

  const runProposal = async () => {
    if (locked || proposing || !pricing) return;
    setProposing(true);
    try {
      const res = await proposeTermsApi(showId, eventId, buildProposeBody(pricing.selection));
      const gaps = res.data?.proposal?.gaps || [];
      toast(gaps.length ? 'Terms proposed; some lines need a price' : 'Terms proposed');
      setPricing((p) => ({ ...p, error: null, gaps }));
      setCostsKey((k) => k + 1);
      await loadDeliverables();
      if (onSaved) await onSaved();
    } catch (err) {
      console.error('[EventTerms] propose terms failed:', err);
      setPricing((p) => ({ ...p, error: errorMessage(err, 'Failed to propose terms') }));
      if (err?.response?.status === 409 && onSaved) onSaved();
    } finally {
      setProposing(false);
    }
  };

  const premiumChoices = premiumChoicesFrom(pricing?.card);
  const premiumSelects = (group, line, chosen) => (
    <div className="epp-term-premiums" data-testid={`terms-premiums-${line}`}>
      {premiumChoices.map((c) => (
        <label key={c.kind} className="epp-term-field">
          <span>{c.label}</span>
          <select
            value={chosen?.[c.kind] || ''} data-testid={`terms-premium-${line}-${c.kind}`}
            onChange={(e) => choosePremium(group, line, c.kind, e.target.value)}
          >
            <option value="">None</option>
            {c.options.map((o) => (
              <option key={o.key} value={o.key} disabled={!o.usable}>
                {o.key}{o.usable ? ` (+${o.percent}%)` : ' (set before use)'}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );

  // One component row: its number, its rule 14 note, and an Edit form.
  const componentRow = (field, label, described, priced) => (
    <div key={field} className="epp-term-component" data-testid={`terms-component-${field}`}>
      <div className="epp-term-head">
        <span className="epp-term-premium-title">{label}</span>
        {!locked && feeDraft?.field !== field && (
          <button
            type="button" className="epp-inline-link" data-testid={`terms-component-edit-${field}`}
            onClick={() => setFeeDraft({ field, value: described.value == null ? '' : String(described.value) })}
          >
            <Pencil size={11} aria-hidden="true" /> Edit
          </button>
        )}
      </div>
      {feeDraft?.field === field ? (
        <div className="epp-term-form">
          <label className="epp-term-field">
            <span>{label} (coins)</span>
            <input
              type="number" min={0} step={1} inputMode="numeric" value={feeDraft.value} data-testid={`terms-component-input-${field}`}
              onChange={(e) => setFeeDraft({ field, value: e.target.value })}
            />
          </label>
          <div className="epp-term-actions">
            <button type="button" className="epp-btn epp-btn-small" onClick={() => setFeeDraft(null)} disabled={!!termSaving}>Cancel</button>
            <button type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid={`terms-component-save-${field}`} onClick={() => saveComponentFee(label)} disabled={!!termSaving}>
              {termSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className={`epp-term-value${priced && described.value == null ? ' is-price-required' : ''}`} data-testid={`terms-component-summary-${field}`}>
          {described.label}
          {described.note && <span className="epp-term-state"> · {described.note}</span>}
        </div>
      )}
    </div>
  );

  const compensation = describeCompensation(event);
  const compUpdate = compDraft ? buildCompensationUpdate(event, compDraft) : null;
  const saveCompensation = async () => {
    if (!compUpdate || compUpdate.unchanged || compUpdate.errors.length) return;
    if (await saveEventTerm('compensation', compUpdate.body, 'Compensation saved')) setCompDraft(null);
  };

  return (
    <section className="epp-section epp-terms" data-testid="terms-section">
      <div className="epp-section-header">
        <h2 className="epp-section-title">Terms</h2>
        {locked && (
          <span className="epp-terms-locked" data-testid="terms-locked">
            <Lock size={12} aria-hidden="true" /> Locked at Start Episode
          </span>
        )}
      </div>
      <p className="epp-terms-intro">
        What Lala must have to take part, what she owes, what she agrees not to do, and what she is paid.
      </p>

      <div className="epp-terms-grid">
        {/* Access requirements */}
        <div className="epp-term" data-testid="terms-access">
          <div className="epp-term-head">
            <span className="epp-term-title"><KeyRound size={14} aria-hidden="true" /> Access requirements</span>
            {!locked && !reqDraft && (
              <button type="button" className="epp-inline-link" data-testid="terms-access-edit" onClick={() => setReqDraft(requirementsDraftFrom(event))}>
                <Pencil size={11} aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          {!reqDraft && (requirements.length ? (
            <ul className="epp-requirements-list">
              {requirements.map((r) => <li key={r.key}>{r.label}: {r.value}</li>)}
            </ul>
          ) : <div className="epp-empty">None set</div>)}
          {reqDraft && (
            <div className="epp-term-form">
              {REQUIREMENT_KEYS.map(({ key, label }) => (
                <label key={key} className="epp-term-field">
                  <span>{label}</span>
                  <input
                    type="number" min={0} step={1} inputMode="numeric" value={reqDraft[key]}
                    placeholder="No minimum" data-testid={`terms-access-input-${key}`}
                    onChange={(e) => setReqDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <p className="epp-term-note">Checked by the next-event suggester; not a gate on Start Episode.</p>
              {reqUpdate?.errors.map((e) => <p key={e.key} className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {e.message}</p>)}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setReqDraft(null)} disabled={termSaving === 'requirements'}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-access-save"
                  onClick={saveRequirements} disabled={!!termSaving || !reqUpdate || reqUpdate.unchanged || reqUpdate.errors.length > 0}
                >
                  {termSaving === 'requirements' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Deliverables */}
        <div className="epp-term" data-testid="terms-deliverables">
          <div className="epp-term-head">
            <span className="epp-term-title"><ClipboardList size={14} aria-hidden="true" /> Deliverables</span>
            {!locked && !delivForm && (
              <button type="button" className="epp-inline-link" data-testid="terms-deliverable-add" onClick={() => openDeliverableForm(null)}>
                <Plus size={11} aria-hidden="true" /> Add
              </button>
            )}
          </div>
          {delivLoading ? (
            <div className="epp-empty"><Loader2 size={12} className="epp-spin-icon" aria-hidden="true" /> Loading…</div>
          ) : delivLoadError ? (
            <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {delivLoadError}</p>
          ) : deliverables.length ? (
            <ul className="epp-term-list" data-testid="terms-deliverable-list">
              {deliverables.map((d) => {
                const status = deliverableStatusOf(d);
                const next = locked ? nextDeliverableStatus(status) : null;
                const timeline = deliverableTimeline(d);
                return (
                <li key={d.id} className={`epp-term-item${locked ? ' is-fulfilment' : ''}`} data-testid={`terms-deliverable-${d.id}`}>
                  <div className="epp-term-item-main">
                    <span className="epp-term-item-text">{d.description}</span>
                    <span className="epp-term-meta">
                      <span data-testid={`terms-deliverable-owed-${d.id}`}>{DELIVERABLE_OWED_TO_LABELS[d.owed_to === 'brand' ? 'brand' : 'host']}</span>
                      {d.deliverable_type && <span data-testid={`terms-deliverable-type-${d.id}`}>{deliverableTypeLabel(d.deliverable_type)}</span>}
                      {(() => {
                        const fee = describeDeliverableFee(event, d);
                        return fee.label && (
                          <span className={fee.priceRequired ? 'is-price-required' : undefined} data-testid={`terms-deliverable-fee-${d.id}`}>
                            {fee.label}{fee.note ? ` · ${fee.note}` : ''}
                          </span>
                        );
                      })()}
                      {d.due_date && <span>Due {d.due_date}</span>}
                      {d.required === false && <span>Optional</span>}
                      <span className={`epp-term-status is-${status}`} data-testid={`terms-deliverable-status-${d.id}`}>{DELIVERABLE_STATUS_LABELS[status]}</span>
                    </span>
                    {timeline.length > 0 && (
                      <span className="epp-term-timeline" data-testid={`terms-deliverable-timeline-${d.id}`}>
                        {timeline.map((t) => (
                          <span key={t.status} className="epp-term-timeline-step">
                            {t.label} <time dateTime={t.at}>{t.text}</time>
                          </span>
                        ))}
                      </span>
                    )}
                    {advanceError?.id === d.id && (
                      <span className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {advanceError.message}</span>
                    )}
                  </div>
                  {next && (
                    <button
                      type="button" className="epp-btn epp-btn-small epp-term-advance"
                      data-testid={`terms-deliverable-advance-${d.id}`}
                      onClick={() => advanceDeliverable(d)} disabled={!!advancingId}
                    >
                      {advancingId === d.id
                        ? <Loader2 size={12} className="epp-spin-icon" aria-hidden="true" />
                        : <Check size={12} aria-hidden="true" />}
                      {deliverableAdvanceLabel(next)}
                    </button>
                  )}
                  {!locked && describeDeliverableFee(event, d).priceRequired && (
                    <button
                      type="button" className="epp-btn epp-btn-small" data-testid={`terms-deliverable-nofee-${d.id}`}
                      onClick={() => setNoFee(d)} disabled={delivSaving}
                    >
                      No fee (0)
                    </button>
                  )}
                  {!locked && (
                    <span className="epp-term-item-actions">
                      <button type="button" className="epp-icon-btn" aria-label={`Edit ${d.description}`} onClick={() => openDeliverableForm(d)} disabled={delivSaving}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" className="epp-icon-btn" aria-label={`Remove ${d.description}`} onClick={() => removeDeliverable(d)} disabled={delivSaving}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </li>
                );
              })}
            </ul>
          ) : <div className="epp-empty">None set</div>}
          {locked && deliverables.length > 0 && (
            <p className="epp-term-note">
              Record each step as it happens. Completing the episode does not change these.
            </p>
          )}
          {delivForm && !locked && (
            <div className="epp-term-form" data-testid="terms-deliverable-form">
              <label className="epp-term-field">
                <span>What she delivers</span>
                <textarea
                  rows={2} maxLength={DELIVERABLE_DESCRIPTION_MAX} value={delivDraft.description}
                  data-testid="terms-deliverable-description"
                  onChange={(e) => setDelivDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </label>
              <div className="epp-term-row">
                <label className="epp-term-field">
                  <span>Type</span>
                  <select
                    value={delivDraft.deliverable_type} data-testid="terms-deliverable-type"
                    onChange={(e) => setDelivDraft((d) => ({ ...d, deliverable_type: e.target.value }))}
                  >
                    <option value="">{delivDraft.legacy_type ? `${delivDraft.legacy_type} (choose a type)` : 'Choose a type'}</option>
                    {DELIVERABLE_TYPES.map((t) => <option key={t} value={t}>{DELIVERABLE_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <label className="epp-term-field">
                  <span>Due</span>
                  <input
                    type="text" maxLength={DELIVERABLE_DUE_MAX} placeholder="e.g. 2026-11-07"
                    value={delivDraft.due_date}
                    onChange={(e) => setDelivDraft((d) => ({ ...d, due_date: e.target.value }))}
                  />
                </label>
              </div>
              <label className="epp-term-field">
                <span>Owed to</span>
                <select
                  value={delivDraft.owed_to} data-testid="terms-deliverable-owed-to"
                  onChange={(e) => setDelivDraft((d) => ({ ...d, owed_to: e.target.value }))}
                >
                  <option value="host">{DELIVERABLE_OWED_TO_LABELS.host}</option>
                  <option value="brand">{DELIVERABLE_OWED_TO_LABELS.brand}</option>
                </select>
              </label>
              <label className="epp-term-field">
                <span>Fee (coins)</span>
                <input
                  type="number" min={0} step={1} inputMode="numeric" value={delivDraft.fee} data-testid="terms-deliverable-fee"
                  onChange={(e) => setDelivDraft((d) => ({ ...d, fee: e.target.value }))}
                />
              </label>
              {plan.deliverables && !hasRateAnchor(delivDraft.deliverable_type) && (
                <p className="epp-term-note" data-testid="terms-deliverable-manual-note">
                  {delivDraft.deliverable_type === 'other'
                    ? 'Other is never priced automatically: set its fee.'
                    : 'Priced by hand: only a Reel or a Story Set (3) takes a rate from the card.'}
                </p>
              )}
              <label className="epp-term-check">
                <input
                  type="checkbox" checked={delivDraft.required}
                  onChange={(e) => setDelivDraft((d) => ({ ...d, required: e.target.checked }))}
                />
                Required
              </label>
              {delivFormError && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {delivFormError}</p>}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={closeDeliverableForm} disabled={delivSaving}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-deliverable-save"
                  onClick={saveDeliverable} disabled={delivSaving || !delivDraft.description.trim()}
                >
                  {delivSaving ? 'Saving…' : delivForm.id ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Restrictions */}
        <div className="epp-term" data-testid="terms-restrictions">
          <div className="epp-term-head">
            <span className="epp-term-title"><Ban size={14} aria-hidden="true" /> Restrictions</span>
          </div>
          {restrictions.length ? (
            <ul className="epp-term-list">
              {restrictions.map((r, i) => (
                <li key={`${i}-${r.description}`} className="epp-term-item">
                  <div className="epp-term-item-main">
                    <span className="epp-term-item-text">{r.description}</span>
                    <span className="epp-term-meta"><span>{restrictionLabel(r.type)}</span></span>
                  </div>
                  {!locked && (
                    <span className="epp-term-item-actions">
                      <button type="button" className="epp-icon-btn" aria-label={`Remove ${r.description}`} onClick={() => removeRestriction(i)} disabled={!!termSaving}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <div className="epp-empty">None set</div>}
          {!locked && (
            <div className="epp-term-add">
              <input
                type="text" maxLength={RESTRICTION_MAX} placeholder="e.g. No competing beauty brands for 90 days"
                value={restrictionText} data-testid="terms-restriction-input"
                onChange={(e) => { setRestrictionText(e.target.value); setRestrictionError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRestriction(); } }}
              />
              <button
                type="button" className="epp-btn epp-btn-small" data-testid="terms-restriction-add"
                onClick={addRestriction} disabled={!!termSaving || !restrictionText.trim()}
              >
                <Plus size={12} aria-hidden="true" /> Add
              </button>
            </div>
          )}
          {restrictionError && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {restrictionError}</p>}
        </div>

        {/* Deal type */}
        <div className="epp-term" data-testid="terms-deal-type">
          <div className="epp-term-head">
            <span className="epp-term-title"><Handshake size={14} aria-hidden="true" /> Deal type</span>
            {!locked && dealDraft === null && (
              <button type="button" className="epp-inline-link" data-testid="terms-deal-type-edit" onClick={() => setDealDraft(dealType.value || '')}>
                <Pencil size={11} aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          {dealDraft === null && (
            <div className="epp-term-value" data-testid="terms-deal-type-summary">
              {dealType.label}
              {dealType.note && <span className="epp-term-state" data-testid="terms-deal-type-state"> · {dealType.note}</span>}
            </div>
          )}
          {dealDraft !== null && (
            <div className="epp-term-form">
              <label className="epp-term-field">
                <span>Deal type</span>
                <select value={dealDraft} data-testid="terms-deal-type-select" onChange={(e) => setDealDraft(e.target.value)}>
                  <option value="">Not set</option>
                  {DEAL_TYPES.map((t) => <option key={t} value={t}>{DEAL_TYPE_LABELS[t] || t}</option>)}
                </select>
              </label>
              {dealUpdate?.error && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {dealUpdate.error}</p>}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setDealDraft(null)} disabled={termSaving === 'deal type'}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-deal-type-save"
                  onClick={saveDealType} disabled={!!termSaving || !dealUpdate || dealUpdate.unchanged || !!dealUpdate.error}
                >
                  {termSaving === 'deal type' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
          <p className="epp-term-note">What kind of arrangement this is. It decides how the deal will pay; nothing is paid from it yet.</p>
        </div>

        {/* Deal price (Task #2341) */}
        <div className="epp-term" data-testid="terms-pricing">
          <div className="epp-term-head">
            <span className="epp-term-title"><Calculator size={14} aria-hidden="true" /> Deal price</span>
            {!locked && !pricing && (
              <button type="button" className="epp-inline-link" data-testid="terms-propose-open" onClick={openPricing} disabled={!plan.cash}>
                <Calculator size={11} aria-hidden="true" /> Propose terms
              </button>
            )}
          </div>
          {!event?.deal_type && <div className="epp-empty" data-testid="terms-pricing-empty">Choose a deal type to price the deal.</div>}
          {plan.known && !plan.cash && (
            <p className="epp-term-note" data-testid="terms-no-cash">
              {plan.giftedValue ? 'Gifted: no cash income. The gifted value is recorded, never paid.' : 'No cash income for this deal type.'}
            </p>
          )}
          {plan.appearanceIfRequired && (
            <label className="epp-term-check">
              <input
                type="checkbox" checked={event?.appearance_required === true} disabled={locked || !!termSaving}
                data-testid="terms-appearance-required"
                onChange={(e) => saveEventTerm('appearance', { appearance_required: e.target.checked }, e.target.checked ? 'Appearance added to the partnership' : 'Appearance removed from the partnership')}
              />
              The partnership also requires Lala to attend or appear (adds the appearance fee)
            </label>
          )}
          {plan.components.map((c) => componentRow(c.field, c.label, describeComponentFee(event, c.field), true))}
          {plan.giftedValue && componentRow('gifted_value', 'Gifted value', describeGiftedValue(event), false)}
          {!locked && missingPrices.length > 0 && (
            <p className="epp-term-error" data-testid="terms-price-missing">
              <AlertCircle size={12} aria-hidden="true" /> Start Episode waits on a price for: {missingPrices.join(', ')}.
            </p>
          )}
          {pricing && !locked && (
            <div className="epp-term-form" data-testid="terms-propose-panel">
              {pricing.loading && <p className="epp-term-note"><Loader2 size={12} className="epp-spin-icon" aria-hidden="true" /> Loading the rate card…</p>}
              {!pricing.loading && pricing.card && (
                <>
                  <p className="epp-term-note">Rate card v{pricing.card.version}. Premiums add up, and apply only to the component they are chosen for.</p>
                  {plan.components.map((c) => (
                    <div key={c.key} className="epp-term-premium-line">
                      <span className="epp-term-premium-title">{c.label}</span>
                      {premiumSelects('components', c.key, pricing.selection.components[c.key])}
                    </div>
                  ))}
                  {plan.deliverables && deliverables.filter((d) => hasRateAnchor(d.deliverable_type)).map((d) => (
                    <div key={d.id} className="epp-term-premium-line">
                      <span className="epp-term-premium-title">{d.description}</span>
                      {premiumSelects('deliverables', d.id, pricing.selection.deliverables[d.id])}
                    </div>
                  ))}
                </>
              )}
              {!pricing.loading && !pricing.card && !pricing.error && <p className="epp-term-note">There is no rate card yet.</p>}
              {pricing.gaps.length > 0 && (
                <ul className="epp-term-gaps" data-testid="terms-propose-gaps">
                  {pricing.gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              )}
              {pricing.error && <p className="epp-term-error" data-testid="terms-propose-error"><AlertCircle size={12} aria-hidden="true" /> {pricing.error}</p>}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setPricing(null)} disabled={proposing}>Close</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-propose-run"
                  onClick={runProposal} disabled={proposing || pricing.loading || !pricing.card}
                >
                  {proposing ? 'Proposing…' : 'Propose'}
                </button>
              </div>
            </div>
          )}
          {plan.cash && (
            <p className="epp-term-note">
              Rates are baselines, not fixed payouts: a proposal fills each component and each Reel or Story Set (3) from the rate card; Post, Photo Set and Other are priced by hand. Every number stays editable until the terms lock.
            </p>
          )}
        </div>

        {/* Costs (deal build PR 4, Task #2365): a deal event's itemised costs */}
        {event?.deal_type && (
          <EventCostsTerm
            showId={showId} eventId={eventId} locked={locked} refreshKey={costsKey}
            onSaved={onSaved} onToast={onToast}
          />
        )}

        {/* Compensation */}
        <div className="epp-term" data-testid="terms-compensation">
          <div className="epp-term-head">
            <span className="epp-term-title"><Coins size={14} aria-hidden="true" /> Compensation</span>
            {!locked && !compDraft && (
              <button type="button" className="epp-inline-link" data-testid="terms-compensation-edit" onClick={() => setCompDraft(compensationDraftFrom(event))}>
                <Pencil size={11} aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          {!compDraft && <div className="epp-term-value" data-testid="terms-compensation-summary">{compensation.summary}</div>}
          {compDraft && (
            <div className="epp-term-form">
              <label className="epp-term-check">
                <input
                  type="checkbox" checked={compDraft.is_paid} data-testid="terms-compensation-paid"
                  onChange={(e) => setCompDraft((d) => ({ ...d, is_paid: e.target.checked }))}
                />
                Paid appearance
              </label>
              {compDraft.is_paid && (
                <label className="epp-term-field">
                  <span>Payment (coins)</span>
                  <input
                    type="number" min={1} step={1} inputMode="numeric" value={compDraft.payment_amount}
                    data-testid="terms-compensation-amount"
                    onChange={(e) => setCompDraft((d) => ({ ...d, payment_amount: e.target.value }))}
                  />
                </label>
              )}
              {compUpdate?.errors.map((e) => <p key={e.key} className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {e.message}</p>)}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setCompDraft(null)} disabled={termSaving === 'compensation'}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-compensation-save"
                  onClick={saveCompensation} disabled={!!termSaving || !compUpdate || compUpdate.unchanged || compUpdate.errors.length > 0}
                >
                  {termSaving === 'compensation' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
          <p className="epp-term-note">Contractual pay for the appearance. Rewards are separate and not edited here.</p>
        </div>
      </div>
    </section>
  );
}
