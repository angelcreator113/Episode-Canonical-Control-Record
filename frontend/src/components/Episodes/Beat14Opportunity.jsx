// Beat 14's opportunity (Evoni, 2026-10-19: "during beat 14 we should include
// an opportunity invitation from someone at the event, so I need to be able
// to attach an opportunity to beat 14"). Shown in the Script tab's side panel
// when beat 14 is open: what is attached, or a picker to attach an open
// opportunity or make a new one. Whoever offers it is someone at the event,
// its host or a guest. It is offered when the episode lands, expires when it
// fails, in place of the random follow-up offer (services/beat14Opportunity).
//
// The open ones come ranked by fit with the event (Evoni, 2026-10-25;
// services/beat14Fit): each with its reasons as chips ("Same brand as the
// host", "Runway suits a showcase", "Moves Grow audience to 100K"), the
// best marked "Best fit", the rest below. "Suggest one" drafts a new one
// from someone at the event into the New form (GET …/beat14/suggest, no
// AI); nothing saves until Attach.
import { useState, useRef, useEffect } from 'react';
import { Gift, Sparkles, Star } from 'lucide-react';
import api from '../../services/api';
import { letGoText, replaceText } from '../Show/OpportunityBeat14';

/** The candidates the event fits (a reason or more), and the rest, in the server's order. */
export function splitByFit(candidates = []) {
  const ranked = candidates.filter((c) => (c.fit?.reasons || []).length > 0);
  const rest = candidates.filter((c) => !(c.fit?.reasons || []).length);
  return { ranked, rest, best: ranked.filter((c) => c.fit?.best) };
}

const TYPES = [
  ['brand_deal', 'Brand deal'], ['campaign', 'Campaign'], ['editorial', 'Editorial'], ['modeling', 'Modeling'],
  ['runway', 'Runway'], ['ambassador', 'Ambassador'], ['podcast', 'Podcast'], ['interview', 'Interview'],
  ['panel', 'Panel'], ['award_show', 'Award show'], ['pr_gifting', 'PR gifting'], ['casting_call', 'Casting call'],
];

export default function Beat14Opportunity({ showId, episodeId, data, onChange, designedIntent = null }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState('new');
  const [pick, setPick] = useState('');
  const [from, setFrom] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('brand_deal');
  const [pitch, setPitch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // The other open ones, below the ranked ones, are folded until asked for.
  const [showRest, setShowRest] = useState(false);
  // "Suggest one": a note under the drafted form, and the read in flight.
  const [drafted, setDrafted] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  // Opens on the open ones when one of them is a best fit (once per episode).
  const openedOn = useRef(null);
  useEffect(() => {
    if (!data || data.opportunity || openedOn.current === episodeId) return;
    openedOn.current = episodeId;
    if ((data.candidates || []).some((c) => c.fit?.best)) setMode('pick');
  }, [data, episodeId]);
  // Where focus goes once the panel has redrawn (Script page audit 3,
  // 2026-10-19: Change, Cancel, Save and Remove each left it on the page):
  // 'form' its first control, 'change' the Change button.
  const boxRef = useRef(null);
  const focusNext = useRef(null);
  useEffect(() => {
    if (!focusNext.current || busy) return;
    const box = boxRef.current;
    const target = focusNext.current === 'change'
      ? box?.querySelector('[data-testid="script-beat14-change"]')
      : box?.querySelector('[data-testid="script-beat14-form"] select, [data-testid="script-beat14-form"] input, [data-testid="script-beat14-form"] textarea');
    focusNext.current = null;
    (target || box?.querySelector('button, select, input'))?.focus();
  });

  if (!data) return null;
  const { opportunity, people = [], candidates = [] } = data;
  const url = `/api/v1/opportunities/${showId}/episode/${episodeId}/beat14`;
  const fail = designedIntent === 'fail';
  // Change keeps what is attached (Script page audit, 2026-10-19): the
  // current opportunity is among the choices, picked, with its sender, so
  // only the sender can be changed.
  const choices = opportunity && !candidates.some((c) => c.id === opportunity.id) ? [opportunity, ...candidates] : candidates;
  const { ranked, rest, best } = splitByFit(candidates);
  const attachedChoice = opportunity && !candidates.some((c) => c.id === opportunity.id) ? opportunity : null;
  // Nothing open fits well: "Suggest one" is offered up front.
  const noGoodFit = !opportunity && best.length === 0;
  const startChange = () => {
    focusNext.current = 'form';
    setEditing(true);
    setError(null);
    setMode('pick');
    setPick(String(opportunity.id));
    setFrom(opportunity.connector_profile_id != null ? String(opportunity.connector_profile_id) : '');
  };
  const cancel = () => { focusNext.current = 'change'; setEditing(false); setError(null); setMode('new'); setPick(''); setDrafted(null); };

  // Draft one from the person picked in From, else the host (the server
  // chooses). Only fills the New form.
  const suggest = async () => {
    setError(null);
    setSuggesting(true);
    try {
      const res = await api.get(`${url}/suggest${from ? `?from=${encodeURIComponent(from)}` : ''}`);
      const draft = res?.data?.data?.draft;
      if (!draft) { setError('Nobody at the event can offer one yet.'); return; }
      setMode('new');
      setName(draft.name || '');
      setType(TYPES.some(([v]) => v === draft.opportunity_type) ? draft.opportunity_type : 'brand_deal');
      setPitch(draft.pitch || '');
      setFrom(String(draft.connector_profile_id));
      const who = people.find((p) => p.profile_id === draft.connector_profile_id);
      setDrafted(`Drafted from ${data.event?.name || 'the event'}${who ? ` and ${who.name}` : ''}${draft.goal ? `, to move ${draft.goal.title}` : ''}. Edit it as you like: nothing is saved until you attach it.`);
      focusNext.current = 'form';
    } catch (err) {
      console.error('[Beat14Opportunity] suggest failed:', err);
      setError(err?.response?.data?.error || 'Could not draft one.');
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!from) { setError('Choose who at the event offers it.'); return; }
    if (mode === 'new' && !name.trim()) { setError('Name the opportunity.'); return; }
    if (mode === 'pick' && !pick) { setError('Choose an opportunity.'); return; }
    // Saving another one lets the attached one go: ask first, as the show
    // tab does (Script page audit 3, 2026-10-19).
    if (opportunity && (mode === 'new' || String(pick) !== String(opportunity.id))
      && !window.confirm(`${replaceText('this episode', opportunity)} Save the new one instead?`)) return;
    setBusy(true);
    try {
      const body = mode === 'new'
        ? { create: { name: name.trim(), opportunity_type: type, pitch: pitch.trim(), connector_profile_id: Number(from) } }
        : { opportunity_id: pick, connector_profile_id: Number(from) };
      await api.put(url, body);
      setEditing(false);
      setName(''); setPitch(''); setPick(''); setMode('new'); setDrafted(null);
      focusNext.current = 'change';
      await onChange();
    } catch (err) {
      console.error('[Beat14Opportunity] attach failed:', err);
      setError(err?.response?.data?.error || 'Could not attach the opportunity.');
    } finally {
      setBusy(false);
    }
  };

  // Remove can delete it (one made for beat 14): it asks first (Script page
  // audit 3, 2026-10-19: one tap deleted it without a word).
  const remove = async () => {
    setError(null);
    if (!window.confirm(`Remove ${opportunity.name} from beat 14? ${letGoText(opportunity)}`)) return;
    focusNext.current = 'form';
    setBusy(true);
    try {
      await api.delete(url);
      await onChange();
    } catch (err) {
      console.error('[Beat14Opportunity] remove failed:', err);
      setError(err?.response?.data?.error || 'Could not remove the opportunity.');
    } finally {
      setBusy(false);
    }
  };

  const showForm = editing || !opportunity;
  return (
    <section ref={boxRef} className="esp-cover esp-beat14" data-testid="script-beat14-opportunity">
      <h3 className="esp-side-title"><Gift size={14} aria-hidden="true" /> Opportunity · Beat 14</h3>
      {opportunity && !editing && (
        <div data-testid="script-beat14-attached">
          <p className="esp-beat14-name"><strong>{opportunity.name}</strong>{opportunity.contact_name ? ` · from ${opportunity.contact_name}` : ''}</p>
          <p className="esp-uses-note">
            {/* Once completed, its status says what happened (Script page audit, 2026-10-19). */}
            {opportunity.status === 'expired'
              ? 'The episode did not land, so the invitation never came in beat 14: it expired.'
              : opportunity.status && opportunity.status !== 'held'
                // Released or scheduled early from the show tab (Evoni, 2026-10-23).
                ? (opportunity.released
                  ? 'Beat 14 ends on this invitation. It was offered by hand from the Opportunities tab, so the episode\'s result does not change it.'
                  : 'Beat 14 ends on this invitation. It was offered when the episode was completed.')
                : fail
                  ? 'This episode is designed to fail, so the invitation does not come in beat 14, and it expires when the episode is completed.'
                  : 'Beat 14 ends on this invitation. It is offered when the episode is completed, if the episode lands; if it fails, it expires.'}
          </p>
          {/* Only a held one can still change (Script tab audit 6, 2026-10-24):
              once offered or expired the server answers 409 to both. */}
          {opportunity.status === 'held' && (
            <div className="esp-beat14-actions">
              <button type="button" className="esp-btn is-small" disabled={busy} onClick={startChange} data-testid="script-beat14-change">Change</button>
              <button type="button" className="esp-btn is-small" disabled={busy} onClick={remove} data-testid="script-beat14-remove">Remove</button>
            </div>
          )}
        </div>
      )}
      {showForm && (people.length === 0 ? (
        <>
          <p className="esp-cover-empty" data-testid="script-beat14-nobody">Nobody at this episode&apos;s event can offer it yet: add the host or guests in the Event Package.</p>
          {/* Never stuck editing (Script page audit, 2026-10-19). */}
          {editing && (
            <div className="esp-beat14-actions">
              <button type="button" className="esp-btn is-small" disabled={busy} onClick={cancel} data-testid="script-beat14-cancel">Cancel</button>
            </div>
          )}
        </>
      ) : (
        <div className="esp-beat14-form" data-testid="script-beat14-form">
          {!opportunity && <p className="esp-uses-note">The invitation someone at the event offers at the end of the episode. It is offered if the episode lands, and replaces the random follow-up offer.</p>}
          {noGoodFit && (
            <p className="esp-beat14-nofit" data-testid="script-beat14-nofit">
              {candidates.length ? 'Nothing open fits this event well.' : 'Nothing is open to attach.'} Suggest one from someone at the event?
            </p>
          )}
          {/* Two buttons, one pressed: a segmented choice, not tabs (Script page re-audit, 2026-10-19). */}
          <div className="esp-beat14-modes" role="group" aria-label="Opportunity">
            <button type="button" aria-pressed={mode === 'new'} className="esp-btn is-small" onClick={() => setMode('new')} data-testid="script-beat14-mode-new">New</button>
            <button type="button" aria-pressed={mode === 'pick'} className="esp-btn is-small" onClick={() => setMode('pick')} disabled={!choices.length} data-testid="script-beat14-mode-pick">{opportunity ? 'Attached or open' : 'Open ones'} ({choices.length})</button>
          </div>
          {mode === 'pick' ? (
            <div className="esp-beat14-picklist" role="radiogroup" aria-label="Opportunity" data-testid="script-beat14-pick">
              {attachedChoice && <Choice c={attachedChoice} attached picked={pick} onPick={setPick} />}
              {ranked.length > 0 && <p className="esp-beat14-group">Best fits for this event</p>}
              {ranked.map((c) => <Choice key={c.id} c={c} attached={!!opportunity && c.id === opportunity.id} picked={pick} onPick={setPick} />)}
              {rest.length > 0 && ranked.length > 0 && (
                <button type="button" className="esp-beat14-more" aria-expanded={showRest} onClick={() => setShowRest((v) => !v)} data-testid="script-beat14-rest-toggle">
                  {showRest ? 'Hide the others' : `The other open ones (${rest.length})`}
                </button>
              )}
              {(showRest || ranked.length === 0 || rest.some((c) => String(c.id) === String(pick))) && rest.map((c) => <Choice key={c.id} c={c} attached={!!opportunity && c.id === opportunity.id} picked={pick} onPick={setPick} />)}
            </div>
          ) : (
            <>
              {drafted && <p className="esp-uses-note" role="status" data-testid="script-beat14-drafted">{drafted}</p>}
              <label className="esp-beat14-field">What it is
                <input type="text" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} placeholder="Studio by Sable campaign shoot" data-testid="script-beat14-name" />
              </label>
              <label className="esp-beat14-field">Kind
                <select value={type} onChange={(e) => setType(e.target.value)} data-testid="script-beat14-type">
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="esp-beat14-field">The pitch (optional)
                <textarea rows={pitch.length > 80 ? 4 : 2} value={pitch} maxLength={2000} onChange={(e) => setPitch(e.target.value)} data-testid="script-beat14-pitch" />
              </label>
            </>
          )}
          <label className="esp-beat14-field">From
            <select value={from} onChange={(e) => setFrom(e.target.value)} data-testid="script-beat14-from">
              <option value="">Who at the event…</option>
              {people.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.name}{p.role === 'host' ? ' (host)' : ''}</option>)}
            </select>
          </label>
          <div className="esp-beat14-actions">
            <button type="button" className="esp-btn-primary is-small" disabled={busy} onClick={save} data-testid="script-beat14-save">{opportunity ? 'Save' : 'Attach to Beat 14'}</button>
            {/* Quiet unless nothing fits; it only fills the New form. */}
            <button type="button" className={noGoodFit ? 'esp-btn is-small esp-beat14-suggest is-up' : 'esp-btn is-small esp-beat14-suggest'} disabled={busy || suggesting} onClick={suggest} data-testid="script-beat14-suggest">
              <Sparkles size={13} aria-hidden="true" />{suggesting ? 'Drafting…' : 'Suggest one'}
            </button>
            {editing && <button type="button" className="esp-btn is-small" disabled={busy} onClick={cancel} data-testid="script-beat14-cancel">Cancel</button>}
          </div>
        </div>
      ))}
      {error && <p className="esp-error" role="alert" data-testid="script-beat14-error">{error}</p>}
    </section>
  );
}

/** One open opportunity to pick: name, brand, "Best fit", and why it fits. */
function Choice({ c, attached = false, picked, onPick }) {
  const id = String(c.id);
  const on = String(picked) === id;
  const reasons = c.fit?.reasons || [];
  return (
    <label className={on ? 'esp-beat14-choice is-on' : 'esp-beat14-choice'} data-testid={`script-beat14-pick-${id}`}>
      <input type="radio" name="beat14-pick" value={id} checked={on} onChange={() => onPick(id)} />
      <span className="esp-beat14-choice-body">
        <span className="esp-beat14-choice-name">
          {c.name}{c.brand_or_company ? ` · ${c.brand_or_company}` : ''}{attached ? ' (attached)' : ''}
          {c.fit?.best && <span className="esp-beat14-best" data-testid={`script-beat14-best-${id}`}><Star size={11} aria-hidden="true" />Best fit</span>}
        </span>
        {reasons.length > 0 && (
          <span className="esp-beat14-reasons" data-testid={`script-beat14-reasons-${id}`}>
            {reasons.map((r) => <span key={r.kind + r.text} className={`esp-beat14-reason is-${r.kind}`}>{r.text}</span>)}
          </span>
        )}
      </span>
    </label>
  );
}
