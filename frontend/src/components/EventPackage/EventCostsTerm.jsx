/**
 * EventCostsTerm — a deal event's itemised costs, in the Event Package's
 * Terms area (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md §5, Law 7).
 *
 * Each row is one cost and says who pays it: Lala (Finalize charges it as
 * its own expense) or the host or brand (comped, never charged). Saved
 * through /world/:showId/events/:eventId/costs. "Draft entry" adds, for a
 * self-funded deal, an "Entry / ticket" row at the event's coin cost that
 * Lala pays (comped by the host when entry is covered; Evoni, 2026-09-30).
 * The extras (drinks, valet, photo booth) are event spending since the
 * event cost split (2026-09-30): the episode's Money tab drafts and edits
 * them; an extras row drafted before the split still shows here and moves
 * there at Start Episode. A drafted row reads "Auto-drafted · event extras" or
 * "Auto-drafted · from event cost" until its amount changes, then Edited
 * (doctrine rule 14).
 *
 * The rows lock with the terms at Start Episode (`locked`), when the routes
 * start refusing writes (409). A legacy event (no deal type) has no rows:
 * it is charged its entry cost and extras as before, so the section is not
 * shown for it (EventTermsSection renders this only for a deal).
 *
 * `refreshKey` reloads the rows, for Propose terms, which drafts the entry
 * line on a deal's first proposal.
 *
 * Styles live in pages/EventPackagePage.css (one CSS file per page).
 */
import { useState, useEffect, useCallback } from 'react';
import { Receipt, Pencil, Plus, Trash2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import api from '../../services/api';
import {
  COST_KINDS, TERMS_COST_KINDS, COST_PAID_BY, COST_PAID_BY_LABELS, COST_LABEL_MAX,
  costKindLabel, costName, costDraftFrom, buildCostBody, costDraftNote, costTotals,
} from '../../utils/eventCosts';

const costsUrl = (showId, eventId) => `/api/v1/world/${showId}/events/${eventId}/costs`;

export const listCostsApi = (showId, eventId) => api.get(costsUrl(showId, eventId));
export const createCostApi = (showId, eventId, body) => api.post(costsUrl(showId, eventId), body);
export const updateCostApi = (showId, eventId, id, body) => api.put(`${costsUrl(showId, eventId)}/${id}`, body);
export const deleteCostApi = (showId, eventId, id) => api.delete(`${costsUrl(showId, eventId)}/${id}`);
export const draftExtrasApi = (showId, eventId) => api.post(`${costsUrl(showId, eventId)}/draft-extras`, {});

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function EventCostsTerm({ showId, eventId, locked, refreshKey, onSaved, onToast }) {
  const toast = (msg) => { if (onToast) onToast(msg); };

  const [costs, setCosts] = useState([]);
  const [drafted, setDrafted] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null); // null | { id: null } (add) | { id } (edit)
  const [draft, setDraft] = useState(costDraftFrom(null));
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await listCostsApi(showId, eventId);
      setCosts(Array.isArray(res.data?.costs) ? res.data.costs : []);
      setDrafted(res.data?.drafted || {});
    } catch (err) {
      console.error('[EventCosts] load failed:', err);
      setLoadError(errorMessage(err, 'Failed to load costs'));
    } finally {
      setLoading(false);
    }
  }, [showId, eventId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // A refusal because the terms locked elsewhere reloads the page, which
  // then shows the event as used.
  const onWriteError = (err, fallback) => {
    console.error('[EventCosts] write failed:', err);
    setFormError(errorMessage(err, fallback));
    toast(errorMessage(err, fallback));
    if (err?.response?.status === 409 && onSaved) onSaved();
  };

  const openForm = (cost) => {
    if (locked) return;
    setDraft(costDraftFrom(cost || null));
    setFormError(null);
    setForm({ id: cost ? cost.id : null });
  };
  const closeForm = () => { if (!saving) { setForm(null); setFormError(null); } };

  const save = async () => {
    if (locked || saving || !form) return;
    const built = buildCostBody(draft);
    if (built.error) { setFormError(built.error); return; }
    setSaving(true);
    try {
      if (form.id) await updateCostApi(showId, eventId, form.id, built.body);
      else await createCostApi(showId, eventId, built.body);
      toast(form.id ? 'Cost saved' : 'Cost added');
      setForm(null);
      await load();
    } catch (err) {
      onWriteError(err, 'Failed to save the cost');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cost) => {
    if (locked || saving) return;
    setSaving(true);
    try {
      await deleteCostApi(showId, eventId, cost.id);
      toast('Cost removed');
      await load();
    } catch (err) {
      onWriteError(err, 'Failed to remove the cost');
    } finally {
      setSaving(false);
    }
  };

  const draftExtras = async () => {
    if (locked || saving) return;
    setSaving(true);
    try {
      const res = await draftExtrasApi(showId, eventId);
      const added = Array.isArray(res.data?.drafted) ? res.data.drafted.length : 0;
      toast(added ? 'Drafted the entry line' : 'Nothing to draft: the entry line is drafted, or this deal has none');
      await load();
    } catch (err) {
      onWriteError(err, 'Failed to draft the entry line');
    } finally {
      setSaving(false);
    }
  };

  const totals = costTotals(costs);

  return (
    <div className="epp-term" data-testid="terms-costs">
      <div className="epp-term-head">
        <span className="epp-term-title"><Receipt size={14} aria-hidden="true" /> Costs</span>
        {!locked && !form && (
          <span className="epp-term-head-actions">
            <button type="button" className="epp-inline-link" data-testid="terms-costs-draft-extras" onClick={draftExtras} disabled={saving}>
              <Sparkles size={11} aria-hidden="true" /> Draft entry
            </button>
            <button type="button" className="epp-inline-link" data-testid="terms-cost-add" onClick={() => openForm(null)} disabled={saving}>
              <Plus size={11} aria-hidden="true" /> Add
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="epp-empty"><Loader2 size={12} className="epp-spin-icon" aria-hidden="true" /> Loading…</div>
      ) : loadError ? (
        <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {loadError}</p>
      ) : costs.length ? (
        <ul className="epp-term-list" data-testid="terms-cost-list">
          {costs.map((c) => {
            const note = costDraftNote(c, drafted);
            const comped = c.paid_by !== 'lala';
            return (
              <li key={c.id} className="epp-term-item" data-testid={`terms-cost-${c.id}`}>
                <div className="epp-term-item-main">
                  <span className="epp-term-item-text">{costName(c)}</span>
                  <span className="epp-term-meta">
                    <span>{costKindLabel(c.kind)}</span>
                    <span data-testid={`terms-cost-amount-${c.id}`} className={comped ? 'epp-cost-comped' : undefined}>
                      {Number(c.amount).toLocaleString()} coins
                    </span>
                    <span data-testid={`terms-cost-payer-${c.id}`}>{COST_PAID_BY_LABELS[c.paid_by] || c.paid_by}</span>
                    {note && <span className="epp-term-state" data-testid={`terms-cost-note-${c.id}`}>{note}</span>}
                  </span>
                </div>
                {!locked && (
                  <span className="epp-term-item-actions">
                    <button type="button" className="epp-icon-btn" aria-label={`Edit ${costName(c)}`} onClick={() => openForm(c)} disabled={saving}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" className="epp-icon-btn" aria-label={`Remove ${costName(c)}`} onClick={() => remove(c)} disabled={saving}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : <div className="epp-empty">None set</div>}

      {costs.length > 0 && (
        <div className="epp-term-value" data-testid="terms-cost-totals">
          Lala pays {totals.lala.toLocaleString()} coins
          {totals.comped > 0 && <span className="epp-term-state"> · comped {totals.comped.toLocaleString()}</span>}
        </div>
      )}

      {form && !locked && (
        <div className="epp-term-form" data-testid="terms-cost-form">
          <div className="epp-term-row">
            <label className="epp-term-field">
              <span>Kind</span>
              <select value={draft.kind} data-testid="terms-cost-kind" onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
                {(draft.kind === 'extras' ? COST_KINDS : TERMS_COST_KINDS).map((k) => <option key={k} value={k}>{costKindLabel(k)}</option>)}
              </select>
            </label>
            <label className="epp-term-field">
              <span>Amount (coins)</span>
              <input
                type="number" min={0} step={1} inputMode="numeric" value={draft.amount} data-testid="terms-cost-amount"
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              />
            </label>
          </div>
          <label className="epp-term-field">
            <span>Label</span>
            <input
              type="text" maxLength={COST_LABEL_MAX} placeholder="e.g. Car to the venue" value={draft.label} data-testid="terms-cost-label"
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </label>
          <label className="epp-term-field">
            <span>Who pays</span>
            <select value={draft.paid_by} data-testid="terms-cost-paid-by" onChange={(e) => setDraft((d) => ({ ...d, paid_by: e.target.value }))}>
              {COST_PAID_BY.map((p) => <option key={p} value={p}>{COST_PAID_BY_LABELS[p]}</option>)}
            </select>
          </label>
          {formError && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {formError}</p>}
          <div className="epp-term-actions">
            <button type="button" className="epp-btn epp-btn-small" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-cost-save" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <p className="epp-term-note">
        {locked
          ? 'Locked at Start Episode. Complete charges each cost Lala pays; comped costs are never charged.'
          : 'Each cost Lala pays is charged at Complete, one line each; a cost the host or brand comps is never charged. Draft entry adds a self-funded or entry-covered deal\'s entry from the event cost. Drinks, valet and other spending during the event are on the episode\'s Money tab.'}
      </p>
    </div>
  );
}
