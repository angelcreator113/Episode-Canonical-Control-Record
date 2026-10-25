/**
 * Stakes and money (Task #1771): the edit dialog's draft (null = closed)
 * and its save, moved out of EventPackagePage.jsx (Task #54).
 *
 * Saves the stakes inputs Evoni changed through the existing PUT. Every
 * key buildStakesUpdate can put in the body (prestige, strictness,
 * deadline_type, career_tier) is in the route's allowedFields; cost_coins
 * is never sent from here.
 */
import { useState } from 'react';
import { stakesDraftFrom, buildStakesUpdate } from '../../utils/eventStakes';

export default function useStakesEditor({ event, used, putEvent, load, setToast }) {
  const [stakesDraft, setStakesDraft] = useState(null);
  const [stakesSaving, setStakesSaving] = useState(false);

  const openStakesEditor = () => {
    if (used) return;
    setStakesDraft(stakesDraftFrom(event));
  };
  const stakesUpdate = stakesDraft ? buildStakesUpdate(event, stakesDraft) : null;

  const saveStakes = async () => {
    if (used || stakesSaving || !stakesUpdate || stakesUpdate.unchanged || stakesUpdate.errors.length) return;
    setStakesSaving(true);
    try {
      await putEvent(stakesUpdate.body);
      setStakesDraft(null);
      setToast('Stakes saved');
      await load();
    } catch (err) {
      console.error('[EventPackage] saveStakes failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to save stakes');
    } finally {
      setStakesSaving(false);
    }
  };

  return { stakesDraft, setStakesDraft, stakesSaving, stakesUpdate, openStakesEditor, saveStakes };
}
