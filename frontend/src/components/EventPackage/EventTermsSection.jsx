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
 * The Package owns the accepted terms (§8(t) item 2). Editing stops at
 * Start Episode (`locked`, the page's used_in_episode_id check), which is
 * also when the deliverable routes start refusing writes (409).
 *
 * Deliverables show their status (every row is pending in slice 1a);
 * nothing here records fulfilment.
 *
 * Styles live in pages/EventPackagePage.css (one CSS file per page).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, ClipboardList, Ban, Coins, Lock, Pencil, Plus, Trash2, Loader2, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import {
  REQUIREMENT_KEYS, describeRequirements, requirementsDraftFrom, buildRequirementsUpdate,
  restrictionsOf, restrictionLabel, buildRestrictionAdd, buildRestrictionRemove,
  describeCompensation, compensationDraftFrom, buildCompensationUpdate,
  buildDeliverableBody, deliverableDraftFrom,
  RESTRICTION_MAX, DELIVERABLE_DESCRIPTION_MAX, DELIVERABLE_TYPE_MAX, DELIVERABLE_DUE_MAX,
} from '../../utils/eventTerms';

const deliverablesUrl = (showId, eventId) => `/api/v1/world/${showId}/events/${eventId}/deliverables`;

export const listDeliverablesApi = (showId, eventId) => api.get(deliverablesUrl(showId, eventId));
export const createDeliverableApi = (showId, eventId, body) => api.post(deliverablesUrl(showId, eventId), body);
export const updateDeliverableApi = (showId, eventId, id, body) => api.put(`${deliverablesUrl(showId, eventId)}/${id}`, body);
export const deleteDeliverableApi = (showId, eventId, id) => api.delete(`${deliverablesUrl(showId, eventId)}/${id}`);

const STATUS_LABELS = { pending: 'Pending', completed: 'Completed', submitted: 'Submitted', approved: 'Approved' };

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
  const [termSaving, setTermSaving] = useState(null); // 'requirements' | 'restrictions' | 'compensation'

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
              {deliverables.map((d) => (
                <li key={d.id} className="epp-term-item" data-testid={`terms-deliverable-${d.id}`}>
                  <div className="epp-term-item-main">
                    <span className="epp-term-item-text">{d.description}</span>
                    <span className="epp-term-meta">
                      {d.deliverable_type && <span>{d.deliverable_type}</span>}
                      {d.due_date && <span>Due {d.due_date}</span>}
                      {d.required === false && <span>Optional</span>}
                      <span className={`epp-term-status is-${d.status || 'pending'}`}>{STATUS_LABELS[d.status] || 'Pending'}</span>
                    </span>
                  </div>
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
              ))}
            </ul>
          ) : <div className="epp-empty">None set</div>}
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
                  <input
                    type="text" maxLength={DELIVERABLE_TYPE_MAX} placeholder="post, story, appearance…"
                    value={delivDraft.deliverable_type}
                    onChange={(e) => setDelivDraft((d) => ({ ...d, deliverable_type: e.target.value }))}
                  />
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
