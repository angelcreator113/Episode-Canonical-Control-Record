/**
 * Production → Money → Event spending (the event cost split ruling, Evoni
 * 2026-09-30; docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa)).
 *
 * "Event spending (drinks, valet, photo booth and other things Lala chooses
 * during the event) lives in the episode's Money tab, editable until
 * Complete, each line quantity × unit price, auto-drafted from the event's
 * extras as suggestions, charged at Complete like other costs."
 *
 * The lines come with the Money view (`spending`: lines, total, editable)
 * and are written through /world/:showId/episodes/:episodeId/spending. A
 * drafted line reads Auto-drafted while it equals its drafted copy, then
 * Edited (doctrine rule 14); a line added here has no note. Once the
 * episode is complete (`editable` false) the lines are read-only: Complete
 * has charged them. They are never in the balance or the net before then.
 *
 * `onChanged` reloads the Money view after a write.
 *
 * Styles live in EpisodeMoneyTab.css (the Money tab's one CSS file).
 */
import React, { useState } from 'react';
import { ShoppingBag, Pencil, Plus, Trash2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const spendingUrl = (showId, episodeId) => `/api/v1/world/${showId}/episodes/${episodeId}/spending`;

export const createSpendingApi = (showId, episodeId, body) => api.post(spendingUrl(showId, episodeId), body);
export const updateSpendingApi = (showId, episodeId, id, body) => api.put(`${spendingUrl(showId, episodeId)}/${id}`, body);
export const deleteSpendingApi = (showId, episodeId, id) => api.delete(`${spendingUrl(showId, episodeId)}/${id}`);

export const SPENDING_LABEL_MAX = 200;
export const SPENDING_QUANTITY_MAX = 999;

const coins = (n) => Number(n || 0).toLocaleString();

/** The rule 14 note of a line: Auto-drafted (and from where), Edited, or none. */
export function spendingNote(line) {
  if (line.draft_state === 'edited') return 'Edited';
  if (line.draft_state === 'auto_drafted') {
    return line.source === 'carried' ? 'Auto-drafted · from the event\'s costs' : 'Auto-drafted · event extras';
  }
  if (line.source === 'carried') return 'From the event\'s costs';
  return null;
}

/** Validates the form; returns { body } or { error }. */
export function buildSpendingBody(draft) {
  const label = String(draft.label || '').trim();
  if (!label) return { error: 'Name the line.' };
  if (label.length > SPENDING_LABEL_MAX) return { error: `Keep the name under ${SPENDING_LABEL_MAX} characters.` };
  const quantity = Number(draft.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SPENDING_QUANTITY_MAX) {
    return { error: `Quantity is a whole number from 1 to ${SPENDING_QUANTITY_MAX}.` };
  }
  const unitPrice = Number(draft.unit_price);
  if (draft.unit_price === '' || !Number.isInteger(unitPrice) || unitPrice < 0) {
    return { error: 'Unit price is a whole number of coins, 0 or more.' };
  }
  return { body: { label, quantity, unit_price: unitPrice } };
}

const EMPTY_DRAFT = { label: '', quantity: '1', unit_price: '' };

export default function EpisodeSpendingSection({ showId, episodeId, spending, onChanged }) {
  const lines = spending?.lines || [];
  const editable = Boolean(spending?.editable);
  const [form, setForm] = useState(null); // null | 'new' | line id
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const openForm = (line) => {
    setError(null);
    setForm(line ? line.id : 'new');
    setDraft(line
      ? { label: line.label, quantity: String(line.quantity), unit_price: String(line.unit_price) }
      : EMPTY_DRAFT);
  };
  const closeForm = () => { setForm(null); setError(null); };

  const run = async (write, fallback) => {
    setSaving(true);
    setError(null);
    try {
      await write();
      setForm(null);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error('[EpisodeSpendingSection] write failed:', err);
      setError(err?.response?.data?.error || err?.message || fallback);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const built = buildSpendingBody(draft);
    if (built.error) { setError(built.error); return; }
    run(() => (form === 'new'
      ? createSpendingApi(showId, episodeId, built.body)
      : updateSpendingApi(showId, episodeId, form, built.body)), 'Failed to save the line');
  };

  const remove = (line) => run(() => deleteSpendingApi(showId, episodeId, line.id), 'Failed to remove the line');

  return (
    <section className="em-section" data-testid="em-spending">
      <div className="em-heading-row">
        <h3 className="em-heading"><ShoppingBag size={14} aria-hidden /> Event spending</h3>
        {editable && !form && (
          <button type="button" className="em-link" data-testid="em-spending-add" onClick={() => openForm(null)} disabled={saving}>
            <Plus size={12} aria-hidden /> Add
          </button>
        )}
      </div>
      <p className="em-explain">
        {editable
          ? 'What Lala buys during the event: drinks, valet, photo booth and the like. Each line is quantity × unit price. Editable until Complete, which charges each line.'
          : 'Charged at Complete, one line each. The episode is complete, so these lines are read-only.'}
      </p>

      {lines.length === 0 ? (
        <div className="em-empty">
          {editable ? 'No event spending yet. Add what Lala buys during the event.' : 'This episode had no event spending.'}
        </div>
      ) : (
        <ul className="em-rows" data-testid="em-spending-list">
          {lines.map((l) => {
            const note = spendingNote(l);
            return (
              <li key={l.id} className="em-spend" data-testid={`em-spending-line-${l.id}`}>
                <span className="em-spend-label">{l.label}</span>
                <span className="em-spend-qty">{l.quantity} × {coins(l.unit_price)}</span>
                <span className="em-spend-total">−{coins(l.total)}</span>
                {(note || editable) && (
                  <span className="em-spend-meta">
                    {note && <span className="em-spend-note">{note}</span>}
                    {editable && !form && (
                      <span className="em-spend-actions">
                        <button type="button" className="em-link" data-testid={`em-spending-edit-${l.id}`} onClick={() => openForm(l)} disabled={saving}>
                          <Pencil size={12} aria-hidden /> Edit
                        </button>
                        <button type="button" className="em-link em-link-danger" data-testid={`em-spending-remove-${l.id}`} onClick={() => remove(l)} disabled={saving}>
                          <Trash2 size={12} aria-hidden /> Remove
                        </button>
                      </span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="em-spend-sum" data-testid="em-spending-total">
          {editable ? 'Complete will charge' : 'Charged'} {coins(spending.total)} coins
        </div>
      )}

      {form && editable && (
        <div className="em-form" data-testid="em-spending-form">
          <label className="em-field em-field-wide">
            <span>What</span>
            <input
              type="text" value={draft.label} maxLength={SPENDING_LABEL_MAX} data-testid="em-spending-label"
              placeholder="Drinks" onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </label>
          <label className="em-field">
            <span>Quantity</span>
            <input
              type="number" min={1} max={SPENDING_QUANTITY_MAX} step={1} inputMode="numeric" value={draft.quantity}
              data-testid="em-spending-quantity" onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
            />
          </label>
          <label className="em-field">
            <span>Unit price (coins)</span>
            <input
              type="number" min={0} step={1} inputMode="numeric" value={draft.unit_price}
              data-testid="em-spending-unit-price" onChange={(e) => setDraft((d) => ({ ...d, unit_price: e.target.value }))}
            />
          </label>
          <div className="em-form-actions">
            <button type="button" className="em-button" data-testid="em-spending-save" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="em-link" onClick={closeForm} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="em-form-error" role="alert"><AlertCircle size={12} aria-hidden /> {error}</p>}
    </section>
  );
}
