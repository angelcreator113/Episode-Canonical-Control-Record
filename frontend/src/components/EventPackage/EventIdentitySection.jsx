/**
 * EventIdentitySection — section 1, The Event: the name (and Suggest
 * names), the Basics rows, Still to fill with Fill in, a pointer to Fill
 * what's missing (the page's AI drafts, under the header; it replaced this
 * section's Suggest with AI, Evoni 2026-10-25), and the invitation beside
 * them.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { Sparkles, Pencil, Loader2, AlertCircle, RefreshCw, X, ArrowUp } from 'lucide-react';
import { InvitationButton } from '../../pages/InvitationGenerator';
import EventBasicsRow from './EventBasicsRow';
import { BASICS_FIELDS, BASICS_ORDER, basicsStateLabel, basicsStateIcon } from '../../lib/eventPackageFields';
import BlockedReason from './BlockedReason';
import { blockedReasons } from '../../lib/eventFlow';

export default function EventIdentitySection({
  showId, event, basics, used, organizer, invitationAsset, nameDraft, reloadTick, fold, editor, names, aiPointer = null,
  invitationApprovalInfo, setInvitationApprovalInfo, invitationRegenSignal, load, openOrganizerPicker = null, hints = null,
}) {
  const { toFillShown, openBasicsEditor, basicsSaving, startFillIn } = editor;
  const {
    nameSuggestOpen, setNameSuggestOpen, nameSuggestions, nameSuggesting, nameSuggestError,
    customName, setCustomName, nameSaving, fetchNameSuggestions, openNameSuggest, saveEventName,
  } = names;
  const NameStateIcon = nameDraft ? basicsStateIcon(nameDraft) : null;
  return (
    <section id="epp-sec-identity" className={fold.cls('identity')}>
      <div className="epp-section-header">
        <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">1.</span> The Event</h2><p className="epp-section-sub">What guests see: the name, when, the dress code, and the invitation.</p></div>
        {fold.button('identity', 'The Event')}
        {!used && !nameSuggestOpen && (
          <button className="epp-btn epp-btn-small" onClick={openNameSuggest}>
            <Sparkles size={14} /> Suggest names
          </button>
        )}
      </div>
      {fold.line('identity')}
      <div id="epp-body-identity" className="epp-section-body" hidden={!fold.isOpen('identity')}>
      <div className="epp-split">
      <div className="epp-split-main">
      <dl className="epp-fields">
        {/* Task #2135 (rule 14): a drafted name reads Auto-drafted · AI
            draft, then Edited once changed; a name never drafted keeps
            the plain row. */}
        {nameDraft ? (
          <div className={`epp-basic is-${nameDraft.state}`} data-testid="basics-name" data-state={nameDraft.state}>
            <dt>
              Name
              <span className="epp-basic-state" data-testid="basics-name-state"><NameStateIcon size={11} aria-hidden="true" /> {basicsStateLabel(nameDraft)}</span>
            </dt>
            <dd>{event.name}</dd>
          </div>
        ) : (
          <div data-testid="basics-name"><dt>Name</dt><dd>{event.name}</dd></div>
        )}
        {BASICS_ORDER.map((key) => <EventBasicsRow key={key} fieldKey={key} basics={basics} used={used} editor={editor} />)}
        {event.host_brand && <div><dt>Brand</dt><dd>{event.host_brand}</dd></div>}
        <EventBasicsRow fieldKey="category" basics={basics} used={used} editor={editor} />
        <EventBasicsRow fieldKey="format" basics={basics} used={used} editor={editor} />
      </dl>
      {/* The host's usual dress code and the same-day clash (EventFieldHints). */}
      {hints}

      {toFillShown.length > 0 && (
        <div className="epp-to-fill" data-testid="basics-to-fill">
          <span className="epp-to-fill-label">Still to fill</span>
          <ul className="epp-to-fill-list">
            {toFillShown.map((key) => {
              const f = basics[key];
              return (
                <li key={key} className={`epp-to-fill-item is-${f.state}`} data-testid={`basics-${key}`} data-state={f.state}>
                  {used ? BASICS_FIELDS[key].label : (
                    <button type="button" className="epp-inline-link" onClick={() => openBasicsEditor(key)} disabled={basicsSaving}>
                      {BASICS_FIELDS[key].label}
                    </button>
                  )}
                  {f.state === 'waiting' && (
                    <span className="epp-to-fill-note" data-testid={`basics-${key}-state`}>{basicsStateLabel(f)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {!used && (
            <button type="button" className="epp-btn epp-btn-small epp-to-fill-go" data-testid="basics-fill-in" onClick={startFillIn} disabled={basicsSaving}>
              <Pencil size={13} aria-hidden="true" /> Fill in
            </button>
          )}
        </div>
      )}

      {/* The AI drafts live in one place, Fill what's missing under the
          header (Evoni, 2026-10-25: "Merge the Suggest with AI button into
          Fill what's missing"); this line points there. */}
      {!used && aiPointer && (
        <p className="epp-ai-pointer">
          <button type="button" className="epp-inline-link" data-testid="ai-pointer" onClick={aiPointer.onClick}>
            <Sparkles size={12} aria-hidden="true" /> {aiPointer.label} <ArrowUp size={12} aria-hidden="true" />
          </button>
        </p>
      )}

      {nameSuggestOpen && (
        <div className="epp-name-suggest">
          {nameSuggesting && (
            <div className="epp-invitation-generating">
              <Loader2 size={14} className="epp-spin-icon" /> Thinking of names…
            </div>
          )}
          {nameSuggestError && (
            <div className="epp-invitation-error">
              <AlertCircle size={13} /> <span>{nameSuggestError}</span>
              <button type="button" className="epp-invitation-retry" onClick={fetchNameSuggestions} disabled={nameSuggesting}>Retry</button>
            </div>
          )}
          {!nameSuggesting && nameSuggestions.length > 0 && (
            <div className="epp-name-suggest-options">
              {nameSuggestions.map((n, i) => (
                <button
                  key={`${n}-${i}`} type="button" className="epp-name-suggest-option"
                  onClick={() => saveEventName(n)} disabled={nameSaving}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <div className="epp-name-suggest-actions">
            <button type="button" className="epp-btn epp-btn-small" onClick={fetchNameSuggestions} disabled={nameSuggesting || nameSaving}>
              <RefreshCw size={13} /> Regenerate
            </button>
            <input
              type="text" className="epp-name-suggest-input" aria-label="Your own name" placeholder="Or type your own"
              value={customName} onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEventName(customName); }}
              maxLength={40}
            />
            <button
              type="button" className="epp-btn epp-btn-small epp-btn-primary"
              onClick={() => saveEventName(customName)} disabled={nameSaving || !customName.trim()}
            >
              {nameSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="epp-icon-btn" title="Close" onClick={() => setNameSuggestOpen(false)} disabled={nameSaving}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      </div>

      {/* The invitation beside the event's fields (the redesign): what
          guests receive, next to what they see. */}
      <div id="epp-sec-invitation" className="epp-split-side epp-invite-col">
        <h3 className="epp-col-title">Invitation</h3>
        {/* The invitation names the organizer (Task #1790): with none set
            it would read "A Special Host", so it waits for one. */}
        {!organizer.hasOrganizer && !invitationAsset ? (
          <div className="epp-empty" data-testid="invitation-needs-organizer">
            {/* Why it can't be made yet, and the step that unblocks it (2026-10-25). */}
            <BlockedReason
              reason={blockedReasons({ hasOrganizer: false, hasInvitation: false }).invitation}
              onAction={openOrganizerPicker && !used ? () => openOrganizerPicker() : null} testId="blocked-invitation"
            />
          </div>
        ) : (
          <InvitationButton key={`invitation-${reloadTick}`}
            mode="inline"
            event={{ ...event, invitation_url: invitationAsset?.s3_url_processed || null }}
            showId={showId}
            approvalInfo={invitationApprovalInfo}
            regenerateSignal={invitationRegenSignal}
            onGenerated={(_url, _assetId, approvalDetail) => {
              if (approvalDetail) setInvitationApprovalInfo(approvalDetail);
              load();
            }}
          />
        )}
      </div>
      </div>
              </div>
    </section>
  );
}
