/**
 * StakesDialog — Edit stakes (Task #1771): prestige, strictness, deadline
 * type, career tier and the story texts; cost stays read-only.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { X, Lock, AlertCircle } from 'lucide-react';
import { DEADLINE_TYPES, CAREER_TIERS, STAKES_TEXTS, COST_READ_ONLY_REASON } from '../../utils/eventStakes';

export default function StakesDialog({ stakesEditor }) {
  const { stakesDraft, setStakesDraft, stakesSaving, stakesUpdate, saveStakes } = stakesEditor;
  const closeStakes = () => { if (!stakesSaving) setStakesDraft(null); };
  const setDraft = (key, value) => setStakesDraft((d) => ({ ...d, [key]: value }));
  const numberSelect = (key, label, max, labelFor) => (
    <label className="epp-stakes-field">
      <span>{label}</span>
      <select value={stakesDraft[key]} onChange={(e) => setDraft(key, e.target.value)} data-testid={`stakes-input-${key}`}>
        {stakesDraft[key] === '' && <option value="" disabled>Not set</option>}
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={String(n)}>{labelFor ? labelFor(n) : n}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="epp-modal-backdrop" onClick={closeStakes}>
      <div className="epp-modal" role="dialog" aria-modal="true" aria-label="Edit stakes" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Edit stakes</h3>
          <button className="epp-icon-btn" onClick={closeStakes} aria-label="Close" disabled={stakesSaving}>
            <X size={16} />
          </button>
        </div>
        <div className="epp-basics-dialog epp-stakes-dialog">
          {numberSelect('prestige', 'Prestige (1–10)', 10)}
          {numberSelect('strictness', 'Strictness (1–10)', 10)}
          <label className="epp-stakes-field">
            <span>Deadline type</span>
            <select value={stakesDraft.deadline_type} onChange={(e) => setDraft('deadline_type', e.target.value)} data-testid="stakes-input-deadline_type">
              {stakesDraft.deadline_type === '' && <option value="" disabled>Not set</option>}
              {DEADLINE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          {numberSelect('career_tier', 'Career tier', 5, (n) => `${n}: ${CAREER_TIERS[n].label}`)}
          {STAKES_TEXTS.map(({ key, label, placeholder }) => (
            <label key={key} className="epp-stakes-field epp-stakes-text">
              <span>{label}</span>
              <textarea
                rows={2} value={stakesDraft[key]} placeholder={placeholder}
                onChange={(e) => setDraft(key, e.target.value)} data-testid={`stakes-input-${key}`}
              />
            </label>
          ))}
          <p className="epp-basics-note"><Lock size={13} aria-hidden="true" /> {COST_READ_ONLY_REASON}</p>
          {stakesUpdate?.errors.map((e) => <p key={e.key} className="epp-invitation-error"><AlertCircle size={13} /> {e.message}</p>)}
        </div>
        <div className="epp-modal-footer epp-basics-actions">
          <div className="epp-basics-spacer" />
          <button type="button" className="epp-btn epp-btn-small" onClick={closeStakes} disabled={stakesSaving}>Cancel</button>
          <button
            type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="stakes-save"
            onClick={saveStakes} disabled={stakesSaving || !stakesUpdate || stakesUpdate.unchanged || stakesUpdate.errors.length > 0}
          >
            {stakesSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
