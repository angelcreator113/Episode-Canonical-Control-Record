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
 * Writes that succeed are never reported as failed because the page's
 * refresh after them (onSaved) failed: that reads "couldn't refresh".
 * Removing a deliverable, restriction or relationship goal is done at once,
 * with "Removed ‘…’ · Undo" in its box for a few seconds (useUndo; Evoni,
 * 2026-10-23, undo instead of confirm). Undo puts a restriction or goal back
 * where it was (event PUT) and adds a deliverable back with the same fields
 * (a new row: a drafted row's "Auto-drafted" note does not come back). A
 * deliverable that cannot be put back as it was still asks first: one with
 * fulfilment recorded (a status past pending, after the terms were
 * reopened), since a new row starts pending, and one whose stored type is
 * free text from before the fixed list, which the routes no longer accept.
 *
 * "Price N items" (Evoni, 2026-10-23): with lines reading "Price required"
 * (deliverable fees, the deal's fee components, costs Lala pays), one
 * button opens the first with its number focused, and each save opens the
 * next (utils/eventPriceWalk). Cancel or Stop pricing ends the walk.
 * `onPriceInputsChange({ deliverables, costs })` (optional) receives the
 * deliverable and cost rows as they load, for the readiness price gate
 * (computeEventPackageReadiness's `prices`); a list that failed to load is
 * passed as null.
 *
 * Styles live in pages/EventPackagePage.css (one CSS file per page).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  KeyRound, ClipboardList, Ban, Coins, Lock, Pencil, Plus, Trash2, Loader2, AlertCircle, Check, Handshake, Calculator, Tag,
} from 'lucide-react';
import api from '../../services/api';
import { saveErrorMessage as errorMessage } from '../../utils/eventSaveVersion';
import {
  REQUIREMENT_KEYS, describeRequirements, requirementsDraftFrom, buildRequirementsUpdate,
  restrictionsOf, restrictionLabel, buildRestrictionAdd, buildRestrictionRemove,
  describeCompensation, compensationDraftFrom, buildCompensationUpdate,
  buildDeliverableBody, deliverableDraftFrom, DELIVERABLE_OWED_TO_LABELS,
  DELIVERABLE_STATUS_LABELS, deliverableStatusOf, nextDeliverableStatus, deliverableAdvanceLabel, deliverableTimeline,
  RESTRICTION_MAX, DELIVERABLE_DESCRIPTION_MAX, DELIVERABLE_DUE_MAX,
  DEAL_COMPONENT_KEYS, DEAL_COMPONENT_LABELS, describeDealComponents, buildDealComponentsUpdate, isDealEvent, dealLabelFor,
  DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS, deliverableTypeLabel, hasRateAnchor,
  DELIVERABLE_FORMATS, PLATFORM_LABELS, quantityWord,
  dealPlanFor, describeComponentFee, describeGiftedValue, describeDeliverableFee, deliverableNotes, missingPriceLabels,
  buildComponentFeeUpdate, premiumChoicesFrom, buildProposeBody,
  BONUS_TIERS, BONUS_TIER_LABELS, describeBonusTerms, bonusDraftFrom, buildBonusTermsUpdate,
  bonusDraftNote, relationshipGoalsOf, relationshipGoalsDraftNote, buildRelationshipGoalRemove,
} from '../../utils/eventTerms';
import EventCostsTerm from './EventCostsTerm';
import UndoNotice from './UndoNotice';
import { useUndo } from './useUndo';
import { unpricedItems, nextUnpriced, getPriceWalk, setPriceWalk, retainPriceWalk } from '../../utils/eventPriceWalk';
import DeliverableProgress from '../Deliverables/DeliverableProgress';
import BlockedReason from './BlockedReason';
import { blockedReasons } from '../../lib/eventFlow';
import './EventTermsSection.css';

// The deliverable formats that go out as a Pulse post (services/postMedia FORMAT_FOR_DELIVERABLE).
const POSTED_DELIVERABLES = new Set(['pulse_post', 'carousel_post', 'pulse_stories', 'pulse_video', 'grwm_video', 'try_on_haul', 'go_live']);
const deliverablesUrl = (showId, eventId) => `/api/v1/world/${showId}/events/${eventId}/deliverables`;

export const listDeliverablesApi = (showId, eventId) => api.get(deliverablesUrl(showId, eventId));
export const createDeliverableApi = (showId, eventId, body) => api.post(deliverablesUrl(showId, eventId), body);
export const updateDeliverableApi = (showId, eventId, id, body) => api.put(`${deliverablesUrl(showId, eventId)}/${id}`, body);
export const deleteDeliverableApi = (showId, eventId, id) => api.delete(`${deliverablesUrl(showId, eventId)}/${id}`);
export const advanceDeliverableApi = (showId, eventId, id, status) => api.post(`${deliverablesUrl(showId, eventId)}/${id}/status`, { status });
export const rateCardApi = () => api.get('/api/v1/deal-rates');
export const proposeTermsApi = (showId, eventId, body) => api.post(`/api/v1/world/${showId}/events/${eventId}/propose-terms`, body);

export const REFRESH_FAILED_MESSAGE = "Saved — couldn't refresh the page. Reload to see the change.";

// An item put back where it was, or at the end when the list got shorter.
// A list that still holds it (the page's refresh after the removal failed,
// so the event on screen is the one before it) is saved as it is.
const insertAt = (list, index, item, same) => {
  const next = [...(list || [])];
  if (next.some((x) => same(x, item))) return next;
  next.splice(Math.min(Math.max(0, index), next.length), 0, item);
  return next;
};
const sameRestriction = (a, b) => a?.description === b?.description && (a?.type || 'other') === (b?.type || 'other');
const sameGoal = (a, b) => (a?.slot ?? null) === (b?.slot ?? null) && a?.label === b?.label;

// A removed deliverable Undo can add back as it was: still pending (a new
// row starts pending, with no fulfilment dates), and of a listed type or none
// (free text from before the fixed list is refused by the routes).
export function deliverableRestorable(d) {
  const status = d?.status || 'pending';
  if (status !== 'pending' || d?.completed_at || d?.submitted_at || d?.approved_at) return false;
  return !d?.deliverable_type || DELIVERABLE_TYPES.includes(d.deliverable_type);
}

/** The POST body that adds a removed deliverable back with the same fields. */
export function deliverableRestoreBody(d) {
  const body = {
    description: d.description,
    deliverable_type: d.deliverable_type || null,
    platform: d.platform ?? null,
    due_date: d.due_date ?? null,
    required: d.required !== false,
    owed_to: d.owed_to === 'brand' ? 'brand' : 'host',
    fee: d.fee ?? null,
  };
  if (d.quantity != null) body.quantity = Number(d.quantity);
  return body;
}

// The page's combined GET (Task #54) hands the deliverables and costs in as
// `initialDeliverables` / `initialCosts`: { data } (that route's answer,
// minus success) or { error }. Given, the first read is skipped and its
// answer, or "Failed to load …", is shown; left out, each reads its own.
const seededRows = (seed) => (Array.isArray(seed?.data?.deliverables) ? seed.data.deliverables : []);

export default function EventTermsSection({ showId, eventId, event, locked, putEvent, onSaved, onToast, onPriceInputsChange, initialDeliverables, initialCosts }) {
  const toast = (msg) => { if (onToast) onToast(msg); };

  // The page's refresh after a write that already succeeded: a failure is
  // logged and said as a refresh failure, never as a failed save (which
  // would invite saving, or paying, twice).
  const refreshPage = async () => {
    if (!onSaved) return true;
    try {
      await onSaved();
      return true;
    } catch (err) {
      console.error('[EventTerms] refresh after save failed:', err);
      toast(REFRESH_FAILED_MESSAGE);
      return false;
    }
  };

  // ── Deliverables ──
  const [deliverables, setDeliverables] = useState(() => seededRows(initialDeliverables));
  const [delivLoading, setDelivLoading] = useState(initialDeliverables === undefined);
  const [delivLoadError, setDelivLoadError] = useState(initialDeliverables?.error ? 'Failed to load deliverables' : null);
  // The page's combined GET answered this event's deliverables (Task #54).
  const delivSeededFor = useRef(initialDeliverables !== undefined ? `${showId}|${eventId}` : null);
  const [delivForm, setDelivForm] = useState(null); // null | { id: null } (add) | { id } (edit)
  const [delivDraft, setDelivDraft] = useState(deliverableDraftFrom(null));
  const [delivFormError, setDelivFormError] = useState(null);
  const [delivSaving, setDelivSaving] = useState(false);

  // The price gate's inputs, reported to the page (onPriceInputsChange).
  const priceInputs = useRef({ deliverables: null, costs: null });
  const priceInputsRef = useRef(onPriceInputsChange);
  priceInputsRef.current = onPriceInputsChange;
  const reportPriceInputs = useCallback((patch) => {
    priceInputs.current = { ...priceInputs.current, ...patch };
    priceInputsRef.current?.(priceInputs.current);
  }, []);

  const loadDeliverables = useCallback(async () => {
    setDelivLoading(true); setDelivLoadError(null);
    try {
      const res = await listDeliverablesApi(showId, eventId);
      const rows = Array.isArray(res.data?.deliverables) ? res.data.deliverables : [];
      setDeliverables(rows);
      reportPriceInputs({ deliverables: rows });
    } catch (err) {
      console.error('[EventTerms] deliverables load failed:', err);
      setDelivLoadError(errorMessage(err, 'Failed to load deliverables'));
      reportPriceInputs({ deliverables: null });
    } finally {
      setDelivLoading(false);
    }
  }, [showId, eventId, reportPriceInputs]);

  useEffect(() => {
    if (delivSeededFor.current === `${showId}|${eventId}`) {
      reportPriceInputs({ deliverables: initialDeliverables.error ? null : seededRows(initialDeliverables) });
      return;
    }
    loadDeliverables();
  }, [loadDeliverables]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const closeDeliverableForm = () => {
    if (delivSaving) return;
    if (delivForm?.id && walkOn(`deliverable:${delivForm.id}`)) endWalk();
    setDelivForm(null); setDelivFormError(null);
  };

  const saveDeliverable = async () => {
    if (locked || delivSaving || !delivForm) return;
    const built = buildDeliverableBody(delivDraft);
    if (built.error) { setDelivFormError(built.error); return; }
    setDelivSaving(true);
    try {
      if (delivForm.id) await updateDeliverableApi(showId, eventId, delivForm.id, built.body);
      else await createDeliverableApi(showId, eventId, built.body);
      toast(delivForm.id ? 'Deliverable saved' : 'Deliverable added');
      const savedId = delivForm.id;
      if (savedId) advanceWalk(`deliverable:${savedId}`);
      // A form the price walk opened meanwhile for another row stays open.
      setDelivForm((f) => (f && savedId && f.id !== savedId ? f : null));
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
      advanceWalk(`deliverable:${d.id}`);
      setDelivForm((f) => (f?.id === d.id ? null : f));
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
    const name = d.description || deliverableTypeLabel(d) || 'Deliverable';
    // Undo adds the row back; one it could not add back as it was asks first.
    const restorable = deliverableRestorable(d);
    if (!restorable && !window.confirm(`Remove the deliverable "${name}"?`)) return;
    setDelivSaving(true);
    try {
      await deleteDeliverableApi(showId, eventId, d.id);
      if (restorable) {
        const body = deliverableRestoreBody(d);
        delivUndo.offer({
          message: `Removed '${name}'`,
          undo: async (ctx) => {
            await createDeliverableApi(showId, eventId, body);
            await ctx.loadDeliverables?.();
          },
        });
      } else {
        toast('Deliverable removed');
      }
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
  // With no restrictions the box is one line; + Add opens the input.
  const [restrictionAddOpen, setRestrictionAddOpen] = useState(false);
  const [restrictionError, setRestrictionError] = useState(null);
  const [dealDraft, setDealDraft] = useState(null); // null, or the chosen deal type ('' = none)
  const [termSaving, setTermSaving] = useState(null); // 'requirements' | 'restrictions' | 'compensation' | 'deal type'

  // afterSave (optional) runs once the save succeeded, before the page's
  // refresh remounts this section: an Undo offer or the price walk's next
  // step made there is still seen by the remounted section.
  const saveEventTerm = async (which, body, okMessage, afterSave = null) => {
    if (locked || termSaving) return false;
    setTermSaving(which);
    try {
      await putEvent(body);
    } catch (err) {
      console.error(`[EventTerms] ${which} save failed:`, err);
      toast(errorMessage(err, `Failed to save ${which}`));
      setTermSaving(null);
      return false;
    }
    // Saved: the refresh's own failure is said as one (refreshPage).
    if (okMessage) toast(okMessage);
    afterSave?.();
    await refreshPage();
    setTermSaving(null);
    return true;
  };

  const requirements = describeRequirements(event);
  const reqUpdate = reqDraft ? buildRequirementsUpdate(event, reqDraft) : null;
  const saveRequirements = async () => {
    if (!reqUpdate || reqUpdate.unchanged || reqUpdate.errors.length) return;
    if (await saveEventTerm('requirements', reqUpdate.body, 'Access requirements saved')) setReqDraft(null);
  };

  const restrictions = restrictionsOf(event);
  // Undo's context: the newest mounted Terms' event and writers (the page
  // remounts this section after the refresh a removal makes).
  const undoContext = { event, putEvent, loadDeliverables, refreshPage };
  const delivUndo = useUndo(`terms-deliverables:${eventId}`, undoContext);
  const restrictionUndo = useUndo(`terms-restrictions:${eventId}`, undoContext);
  const goalUndo = useUndo(`terms-goals:${eventId}`, undoContext);
  const addRestriction = async () => {
    const built = buildRestrictionAdd(event, restrictionText);
    if (built.error) { setRestrictionError(built.error); return; }
    setRestrictionError(null);
    if (await saveEventTerm('restrictions', built.body, 'Restriction added')) setRestrictionText('');
  };
  const removeRestriction = (index) => {
    const r = restrictions[index];
    if (!r) return;
    saveEventTerm('restrictions', buildRestrictionRemove(event, index).body, null, () => restrictionUndo.offer({
      message: `Removed '${r.description}'`,
      undo: async (ctx) => {
        const list = restrictionsOf(ctx.event);
        await ctx.putEvent({ restrictions: insertAt(list, index, r, sameRestriction) });
        await ctx.refreshPage?.();
      },
    }));
  };

  // D14 (2026-09-30): the deal is the components Evoni ticks; its label is
  // derived. dealDraft is null, or the ticked keys while editing.
  const deal = describeDealComponents(event);
  const dealUpdate = dealDraft !== null ? buildDealComponentsUpdate(event, dealDraft) : null;
  // D13: saving the components drafts the whole Terms section on the
  // server (deliverables, prices, entry, bonus, goals), so the lists reload.
  const saveDealType = async () => {
    if (!dealUpdate || dealUpdate.unchanged || dealUpdate.error) return;
    if (await saveEventTerm('deal', dealUpdate.body, 'Deal saved; the terms are drafted from it')) {
      setDealDraft(null);
      setCostsKey((k) => k + 1);
      await loadDeliverables();
    }
  };
  const toggleComponent = (key) => setDealDraft((list) => (
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
  ));

  // ── Deal price (Task #2341) ──
  const plan = dealPlanFor(event);
  const missingPrices = missingPriceLabels(event, deliverables);
  const [feeDraft, setFeeDraft] = useState(null); // null, or { field, value } for one component
  const [bonusDraft, setBonusDraft] = useState(null); // null, or { slay, pass, safe } strings
  const [bonusError, setBonusError] = useState(null);
  const [pricing, setPricing] = useState(null); // null, or { card, selection, loading, error, gaps }
  const [proposing, setProposing] = useState(false);
  // Bumped after a proposal or a deal save, which draft the entry line (and
  // travel when Lala travels) as cost rows (D13).
  const [costsKey, setCostsKey] = useState(0);

  // ── Price all (Evoni, 2026-10-23): "Price N items" ──
  // The costs as EventCostsTerm loads them (null until then, or failed).
  const [costRows, setCostRows] = useState(null);
  const [costsLoaded, setCostsLoaded] = useState(false);
  const [walk, setWalkState] = useState(() => getPriceWalk(eventId));
  useEffect(() => retainPriceWalk(eventId), [eventId]);
  const setWalk = (w) => setWalkState(setPriceWalk(eventId, w));
  const unpriced = locked ? [] : unpricedItems({ event, deliverables: delivLoadError ? [] : deliverables, costs: costRows || [] });
  const walkReady = !delivLoading && (!isDealEvent(event) || costsLoaded);
  const walkOn = (key) => getPriceWalk(eventId)?.current === key;
  const endWalk = () => setWalk(null);
  const startWalk = () => {
    const first = unpriced[0];
    if (first) setWalk({ current: first.key, done: [first.key] });
  };
  // The next item not yet offered, or the end of the walk.
  const walkOnFrom = (w) => {
    const next = nextUnpriced(unpriced, w.done);
    if (next) setWalk({ current: next.key, done: [...w.done, next.key] });
    else { setWalk(null); toast('That was the last price to set'); }
  };
  // After the item the walk is on was saved.
  const advanceWalk = (fromKey) => {
    const w = getPriceWalk(eventId);
    if (w && w.current === fromKey) walkOnFrom(w);
  };
  const walkItem = walk ? unpriced.find((i) => i.key === walk.current) || null : null;

  // Opens what the walk is on (also in a section remounted mid-walk); an
  // item priced or removed elsewhere moves the walk on.
  useEffect(() => {
    if (!walk || locked || !walkReady) return;
    if (!walkItem) {
      walkOnFrom(walk);
      return;
    }
    if (walkItem.kind === 'deliverable' && delivForm?.id !== walkItem.id) {
      const d = deliverables.find((x) => x.id === walkItem.id);
      if (d) openDeliverableForm(d);
    }
    if (walkItem.kind === 'component' && feeDraft?.field !== walkItem.id) {
      setFeeDraft({ field: walkItem.id, value: event?.[walkItem.id] == null ? '' : String(event[walkItem.id]) });
    }
  }, [walk, walkReady, locked, deliverables, costRows, event]); // eslint-disable-line react-hooks/exhaustive-deps

  // The number to type, focused (a cost's is focused by EventCostsTerm).
  const sectionRef = useRef(null);
  useEffect(() => {
    if (!walkItem || walkItem.kind === 'cost') return;
    const selector = walkItem.kind === 'component'
      ? `[data-testid="terms-component-input-${walkItem.id}"]`
      : '[data-testid="terms-deliverable-fee"]';
    const el = sectionRef.current?.querySelector(selector);
    if (el && document.activeElement !== el) {
      el.focus();
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }, [walkItem?.key, feeDraft?.field, delivForm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveComponentFee = async (label) => {
    if (!feeDraft) return;
    const built = buildComponentFeeUpdate(feeDraft.field, feeDraft.value);
    if (built.error) { toast(`${label}: ${built.error}`); return; }
    const { field } = feeDraft;
    if (await saveEventTerm(label.toLowerCase(), built.body, `${label} saved`, () => advanceWalk(`component:${field}`))) {
      // A fee the price walk opened meanwhile stays open.
      setFeeDraft((d) => (d?.field === field ? null : d));
    }
  };

  // D13 answer 6: the relationship goals drafted with the deliverables.
  const relationshipGoals = relationshipGoalsOf(event);
  const relationshipGoalsNote = relationshipGoalsDraftNote(event);
  const removeRelationshipGoal = (index) => {
    const g = relationshipGoals[index];
    if (!g) return;
    saveEventTerm('goals', buildRelationshipGoalRemove(event, index).body, null, () => goalUndo.offer({
      message: `Removed '${g.label}'`,
      undo: async (ctx) => {
        const list = relationshipGoalsOf(ctx.event);
        await ctx.putEvent({ canon_consequences: { automation: { relationship_goals: insertAt(list, index, g, sameGoal) } } });
        await ctx.refreshPage?.();
      },
    }));
  };

  // Performance bonus (deal build PR 5): only when the deal contains one.
  const bonus = describeBonusTerms(event);
  const bonusNote = bonusDraftNote(event);
  const saveBonus = async () => {
    const built = buildBonusTermsUpdate(bonusDraft);
    if (built.error) { setBonusError(built.error); return; }
    setBonusError(null);
    if (await saveEventTerm('performance bonus', built.body, 'Performance bonus saved')) setBonusDraft(null);
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
    let gaps;
    try {
      const res = await proposeTermsApi(showId, eventId, buildProposeBody(pricing.selection));
      gaps = res.data?.proposal?.gaps || [];
    } catch (err) {
      console.error('[EventTerms] propose terms failed:', err);
      setPricing((p) => ({ ...p, error: errorMessage(err, 'Failed to propose terms') }));
      if (err?.response?.status === 409) await refreshPage();
      setProposing(false);
      return;
    }
    toast(gaps.length ? 'Terms proposed; some lines need a price' : 'Terms proposed');
    setPricing((p) => ({ ...p, error: null, gaps }));
    setCostsKey((k) => k + 1);
    await loadDeliverables();
    await refreshPage();
    setProposing(false);
  };

  // Propose terms needs a paid part in the deal; "Pick one" opens the Deal's
  // form above with its first box focused.
  const proposeBlocked = blockedReasons({ plan, termsLocked: locked }).propose;
  const openDealForm = () => {
    setDealDraft(deal.components || []);
    setTimeout(() => {
      const form = document.querySelector('[data-testid="terms-deal-components-form"]');
      if (form && typeof form.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form?.querySelector('input, button')?.focus({ preventScroll: true });
    }, 0);
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
            <button type="button" className="epp-btn epp-btn-small" onClick={() => { if (walkOn(`component:${field}`)) endWalk(); setFeeDraft(null); }} disabled={!!termSaving}>Cancel</button>
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
    <section className="epp-section epp-terms" data-testid="terms-section" ref={sectionRef}>
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
      {!locked && (walk || (walkReady && unpriced.length > 0)) && (
        <div className={`ets-pricewalk${walk ? ' is-on' : ''}`} data-testid="terms-price-walk">
          {walk ? (
            <>
              <span className="ets-pricewalk-text" data-testid="terms-price-walk-status">
                Pricing {walkItem ? <strong>{walkItem.label}</strong> : '…'}
                {': '}{Math.max(0, unpriced.filter((i) => !walk.done.includes(i.key)).length)} more after this. Save to go on.
              </span>
              <button type="button" className="epp-btn epp-btn-small" onClick={endWalk} data-testid="terms-price-stop">Stop pricing</button>
            </>
          ) : (
            <>
              <span className="ets-pricewalk-text">
                <AlertCircle size={12} aria-hidden="true" /> {unpriced.length === 1 ? '1 line reads' : `${unpriced.length} lines read`} &ldquo;Price required&rdquo;.
              </span>
              <button type="button" className="epp-btn epp-btn-small ets-pricewalk-go" onClick={startWalk} data-testid="terms-price-all">
                <Tag size={12} aria-hidden="true" /> Price {unpriced.length} {unpriced.length === 1 ? 'item' : 'items'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="epp-terms-grid">
        {/* Access requirements */}
        {/* An empty term is one line under the filled ones (Evoni's review,
            item 6): its title, None set, and its action. */}
        <div className={`epp-term${!reqDraft && !requirements.length ? ' is-empty' : ''}`} data-testid="terms-access">
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
        <div className={`epp-term${!delivForm && !delivLoading && !delivLoadError && !deliverables.length ? ' is-empty' : ''}`} data-testid="terms-deliverables">
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
                      {d.deliverable_type && <span data-testid={`terms-deliverable-type-${d.id}`}>{deliverableTypeLabel(d)}{d.platform && PLATFORM_LABELS[d.platform] && d.platform !== DELIVERABLE_FORMATS[d.deliverable_type]?.platforms[0] ? ` · ${PLATFORM_LABELS[d.platform]}` : ''}</span>}
                      {(() => {
                        const { fee } = deliverableNotes(event, d);
                        return fee.label && (
                          <span className={fee.priceRequired ? 'is-price-required' : undefined} data-testid={`terms-deliverable-fee-${d.id}`}>
                            {fee.label}{fee.note ? ` · ${fee.note}` : ''}
                          </span>
                        );
                      })()}
                      {d.due_date && <span>Due {d.due_date}</span>}
                      {d.required === false && <span>Optional</span>}
                      {(() => {
                        const draftNote = deliverableNotes(event, d).draft;
                        return draftNote && <span data-testid={`terms-deliverable-draft-${d.id}`}>{draftNote}</span>;
                      })()}
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
          <UndoNotice undo={delivUndo} testId="terms-deliverable-undo" />
          {/* Deliverables that check themselves (2026-10-19): the Pulse posts that count. */}
          {deliverables.some((d) => POSTED_DELIVERABLES.has(d.deliverable_type)) && (
            <DeliverableProgress key={deliverables.map((d) => `${d.id}:${d.quantity}`).join(',')} eventId={eventId} />
          )}
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
                    onChange={(e) => {
                      // D15: a new format starts at its own account and quantity.
                      const type = e.target.value;
                      const f = DELIVERABLE_FORMATS[type];
                      setDelivDraft((d) => ({
                        ...d,
                        deliverable_type: type,
                        platform: f ? (f.platforms.includes(d.platform) ? d.platform : (f.platforms[0] || '')) : '',
                        quantity: f ? String(f.defaultQuantity) : '',
                      }));
                    }}
                  >
                    <option value="">{delivDraft.legacy_type ? `${delivDraft.legacy_type} (choose a type)` : 'Choose a type'}</option>
                    {DELIVERABLE_TYPES.map((t) => <option key={t} value={t}>{DELIVERABLE_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                {DELIVERABLE_FORMATS[delivDraft.deliverable_type]?.platforms.length > 1 && (
                  <label className="epp-term-field">
                    <span>Account</span>
                    <select
                      value={delivDraft.platform || DELIVERABLE_FORMATS[delivDraft.deliverable_type].platforms[0]} data-testid="terms-deliverable-platform"
                      onChange={(e) => setDelivDraft((d) => ({ ...d, platform: e.target.value }))}
                    >
                      {DELIVERABLE_FORMATS[delivDraft.deliverable_type].platforms.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                    </select>
                  </label>
                )}
                {DELIVERABLE_FORMATS[delivDraft.deliverable_type] && (
                  <label className="epp-term-field">
                    <span>{quantityWord(DELIVERABLE_FORMATS[delivDraft.deliverable_type])}</span>
                    <input
                      type="number" min={1} step={1} inputMode="numeric" value={delivDraft.quantity} data-testid="terms-deliverable-quantity"
                      onChange={(e) => setDelivDraft((d) => ({ ...d, quantity: e.target.value }))}
                    />
                  </label>
                )}
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
                    : 'Choose a format to price it from the rate card.'}
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
          <UndoNotice undo={goalUndo} testId="terms-goal-undo" />
          {relationshipGoals.length > 0 && (
            <div className="epp-term-goals" data-testid="terms-relationship-goals">
              <span className="epp-term-premium-title">Lala's goals (not owed)</span>
              <ul className="epp-term-list">
                {relationshipGoals.map((g, i) => (
                  <li key={g.slot || i} className="epp-term-item" data-testid={`terms-relationship-goal-${i}`}>
                    <div className="epp-term-item-main">
                      <span className="epp-term-item-text">{g.label}</span>
                      {g.description && <span className="epp-term-meta"><span>{g.description}</span></span>}
                    </div>
                    {!locked && (
                      <span className="epp-term-item-actions">
                        <button
                          type="button" className="epp-icon-btn" aria-label={`Remove ${g.label}`}
                          data-testid={`terms-relationship-goal-remove-${i}`} onClick={() => removeRelationshipGoal(i)} disabled={!!termSaving}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="epp-term-note">
                {relationshipGoalsNote ? `${relationshipGoalsNote}. ` : ''}Start Episode adds these to Lala's goals; they count toward her goal limit.
              </p>
            </div>
          )}
        </div>

        {/* Restrictions */}
        <div className={`epp-term${!restrictions.length && !restrictionAddOpen ? ' is-empty' : ''}`} data-testid="terms-restrictions">
          <div className="epp-term-head">
            <span className="epp-term-title"><Ban size={14} aria-hidden="true" /> Restrictions</span>
            {!locked && !restrictions.length && !restrictionAddOpen && (
              <button type="button" className="epp-inline-link" data-testid="terms-restriction-open" onClick={() => setRestrictionAddOpen(true)}>
                <Plus size={11} aria-hidden="true" /> Add
              </button>
            )}
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
          <UndoNotice undo={restrictionUndo} testId="terms-restriction-undo" />
          {!locked && (restrictions.length > 0 || restrictionAddOpen) && (
            <div className="epp-term-add">
              <input
                type="text" maxLength={RESTRICTION_MAX} placeholder="e.g. No competing beauty brands for 90 days"
                value={restrictionText} data-testid="terms-restriction-input" autoFocus={restrictionAddOpen && !restrictions.length}
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

        {/* Deal: its components (D14) */}
        <div className="epp-term" data-testid="terms-deal-type">
          <div className="epp-term-head">
            <span className="epp-term-title"><Handshake size={14} aria-hidden="true" /> Deal</span>
            {!locked && dealDraft === null && (
              <button type="button" className="epp-inline-link" data-testid="terms-deal-type-edit" onClick={() => setDealDraft(deal.components || [])}>
                <Pencil size={11} aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          {dealDraft === null && (
            <>
              <div className="epp-term-value" data-testid="terms-deal-type-summary">
                {deal.label}
                {deal.note && <span className="epp-term-state" data-testid="terms-deal-type-state"> · {deal.note}</span>}
              </div>
              {deal.components && deal.components.length > 0 && (
                <span className="epp-term-meta" data-testid="terms-deal-components-summary">
                  {deal.components.map((k) => <span key={k}>{DEAL_COMPONENT_LABELS[k]}</span>)}
                </span>
              )}
            </>
          )}
          {dealDraft !== null && (
            <div className="epp-term-form" data-testid="terms-deal-components-form">
              <fieldset className="epp-term-checks">
                <legend>What the deal includes</legend>
                {DEAL_COMPONENT_KEYS.map((k) => (
                  <label key={k} className="epp-term-check">
                    <input
                      type="checkbox" checked={dealDraft.includes(k)} data-testid={`terms-deal-component-${k}`}
                      onChange={() => toggleComponent(k)}
                    />
                    {DEAL_COMPONENT_LABELS[k]}
                  </label>
                ))}
              </fieldset>
              <p className="epp-term-note" data-testid="terms-deal-components-label">
                Reads as: {dealUpdate?.body?.deal_components ? dealLabelFor(dealUpdate.body.deal_components) : deal.label}
              </p>
              {dealUpdate?.error && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {dealUpdate.error}</p>}
              <div className="epp-term-actions">
                <button type="button" className="epp-btn epp-btn-small" onClick={() => setDealDraft(null)} disabled={termSaving === 'deal'}>Cancel</button>
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-deal-type-save"
                  onClick={saveDealType} disabled={!!termSaving || !dealUpdate || dealUpdate.unchanged || !!dealUpdate.error}
                >
                  {termSaving === 'deal' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
          <p className="epp-term-note">Tick what the deal includes; its name follows. It decides how the deal pays: its fees at Complete, each deliverable's fee on approval.</p>
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
          {!plan.known && <div className="epp-empty" data-testid="terms-pricing-empty">Tick what the deal includes to price it.</div>}
          {plan.known && !plan.cash && (
            <p className="epp-term-note" data-testid="terms-no-cash">
              {plan.giftedValue ? 'Gifted: no cash income. The gifted value is recorded, never paid.' : 'No cash income for this deal.'}
            </p>
          )}
          {/* Why Propose terms is off, with the step that turns it on (2026-10-25). */}
          {!locked && !pricing && dealDraft === null && (
            <BlockedReason reason={proposeBlocked} onAction={openDealForm} testId="terms-propose-blocked" />
          )}
          {/* D14: a partnership that requires an appearance ticks Paid to appear (Terms > Deal). */}
          {plan.components.map((c) => componentRow(c.field, c.label, describeComponentFee(event, c.field), true))}
          {plan.giftedValue && componentRow('gifted_value', 'Gifted value', describeGiftedValue(event), false)}
          {plan.cash && (
            <div className="epp-term-component" data-testid="terms-bonus">
              <div className="epp-term-head">
                <span className="epp-term-premium-title">Performance bonus</span>
                {!locked && !bonusDraft && (
                  <button type="button" className="epp-inline-link" data-testid="terms-bonus-edit" onClick={() => { setBonusError(null); setBonusDraft(bonusDraftFrom(event)); }}>
                    <Pencil size={11} aria-hidden="true" /> Edit
                  </button>
                )}
              </div>
              {bonusDraft ? (
                <div className="epp-term-form">
                  <div className="epp-term-premiums">
                    {BONUS_TIERS.map((t) => (
                      <label key={t} className="epp-term-field">
                        <span>If {BONUS_TIER_LABELS[t]} (coins)</span>
                        <input
                          type="number" min={1} step={1} inputMode="numeric" placeholder="None" value={bonusDraft[t]}
                          data-testid={`terms-bonus-input-${t}`}
                          onChange={(e) => setBonusDraft((d) => ({ ...d, [t]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                  {bonusError && <p className="epp-term-error"><AlertCircle size={12} aria-hidden="true" /> {bonusError}</p>}
                  <div className="epp-term-actions">
                    <button type="button" className="epp-btn epp-btn-small" onClick={() => setBonusDraft(null)} disabled={!!termSaving}>Cancel</button>
                    <button type="button" className="epp-btn epp-btn-small epp-btn-primary" data-testid="terms-bonus-save" onClick={saveBonus} disabled={!!termSaving}>
                      {termSaving === 'performance bonus' ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="epp-term-value" data-testid="terms-bonus-summary">
                  {bonus.label}
                  {bonusNote && <span className="epp-term-state" data-testid="terms-bonus-note"> · {bonusNote}</span>}
                </div>
              )}
              <p className="epp-term-note">Paid at Complete only for a tier the deal names. A SLAY pays nothing on its own.</p>
            </div>
          )}
          {!locked && missingPrices.length > 0 && (
            <p className="epp-term-error" data-testid="terms-price-missing">
              <AlertCircle size={12} aria-hidden="true" /> Start Episode waits on a price for: {missingPrices.join(', ')}.
            </p>
          )}
          {/* Unpriced deliverables can't be listed when the deliverables did
              not load: say so rather than reading as if none were missing. */}
          {!locked && plan.cash && plan.deliverables && delivLoadError && (
            <p className="epp-term-error" data-testid="terms-price-unchecked">
              <AlertCircle size={12} aria-hidden="true" /> The deliverables did not load, so their prices could not be checked.{' '}
              <button type="button" className="epp-inline-link" onClick={() => loadDeliverables()} data-testid="terms-deliverables-retry">Try again</button>
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
              Rates are baselines, not fixed payouts: a proposal fills each component and each deliverable format from the rate card; only Other is priced by hand. Every number stays editable until the terms lock.
            </p>
          )}
        </div>

        {/* Costs (deal build PR 4, Task #2365): a deal event's itemised costs */}
        {isDealEvent(event) && (
          <EventCostsTerm
            showId={showId} eventId={eventId} locked={locked} refreshKey={costsKey} initial={initialCosts}
            onSaved={onSaved} onToast={onToast}
            onCostsChange={(costs) => { reportPriceInputs({ costs }); setCostRows(costs); setCostsLoaded(true); }}
            pricingId={walk && walk.current.startsWith('cost:') ? walk.current.slice(5) : null}
            onPriced={(id) => advanceWalk(`cost:${id}`)}
            onPricingCancel={endWalk}
          />
        )}

        {/* Compensation */}
        <div className="epp-term" data-testid="terms-compensation">
          <div className="epp-term-head">
            <span className="epp-term-title"><Coins size={14} aria-hidden="true" /> Compensation</span>
            {!locked && !compDraft && !isDealEvent(event) && (
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
          <p className="epp-term-note" data-testid="terms-compensation-note">
            {isDealEvent(event)
              ? 'For a deal, pay comes from Deal price above; this older payment is not paid.'
              : 'Contractual pay for the appearance. Rewards are separate and not edited here.'}
          </p>
        </div>
      </div>
    </section>
  );
}
