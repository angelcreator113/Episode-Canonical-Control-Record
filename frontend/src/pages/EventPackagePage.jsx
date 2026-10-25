/**
 * EventPackagePage.jsx — Event Package, piece 1 (Task #1642)
 *
 * Route: /shows/:showId/events/:eventId
 *
 * Today the page is, top to bottom: the hero (title and five tiles), the
 * readiness strip (a tile per section, what each needs, the next step with
 * Continue / Start Episode), "On this page", then the numbered sections
 * (1 The Event with its invitation, 2 People, 3 Place, 4 Lala's Look,
 * 5 Deal & Money with the Terms, 6 Story Stakes, 7 In-world documents,
 * 8 Behind the Scenes) and the action bar. The notes below are the history
 * of how each part came to be.
 *
 * Audit (Evoni, 2026-10-23: "fix all of them"): a save no longer swaps the
 * page for the spinner (the sections that read their own data remount on
 * reloadTick instead); one page per event, so nothing carries over between
 * events; Start Episode waits for the money check; Enter never clears a
 * Basics field; dialogs close on Escape, keep focus inside and return it;
 * the toast is announced and floats at the foot of the screen; phone
 * targets are 40-44px and dialogs are bottom sheets.
 *
 * Enhancements (Evoni, 2026-10-23: "I want them all and show me first"):
 * one sticky readiness bar (eventPackage/ReadinessBar) replaces the strip's
 * tiles, the next-step bar and the footer action bar, with Lala's balance
 * beside Start; finished sections fold to one line (useSectionFolds);
 * Basics are edited in their rows (InlineBasicsField); Suggest with AI asks
 * POST …/suggest-basics and opens a review list (SuggestReview) saved in one
 * PUT; the page's one-tap guest and organizer changes offer Undo on the
 * toast; desktop shortcuts (usePackageShortcuts); the Terms' deliverable and
 * cost prices feed the readiness gate; on a phone the hero is one line.
 *
 * Summary sections (Basics, People, Place, Invitation, Style, Terms,
 * Stakes & Money, Review) plus a readiness count, and three actions:
 * Change Organizer (Change Host until Task #1761), Edit details (opens
 * the event library's editor on the Season page's Events tab, via
 * seasonPageHref(showId, 'events', { event }) — the old ?tab=events&event=<id>
 * deep link of Task #1628/#1630 now redirects there),
 * and Start Episode (the existing generate-episode action, gated on
 * readiness). Editing itself still happens in the existing editor —
 * later pieces replace these sections one at a time.
 *
 * Basics (Task #1755): date, time, description and dress code are edited
 * here, one focused dialog per field, through the same event PUT. Each
 * field shows one of three states — set, suggested, missing
 * (resolveEventBasics, utils/eventBasics.js). A suggestion is shown only,
 * never saved, until Evoni accepts it.
 *
 * Category and format (Task #1780) are Basics fields too, chosen from
 * the model's allowed values (utils/eventTaxonomy.js). Since Task #1888
 * each is suggested too, when the event's facts name one
 * (suggestEventCategory / suggestEventFormat), and saved only when Evoni
 * accepts. Accepting a format is what lets the time and dress-code
 * suggestions above appear: the save reloads the event, and those two
 * read its saved format.
 *
 * Organizer (Task #1761): Change Organizer picks a creator (a Social
 * Profile) or a brand (a lalaverse_brands row, written to host_brand by
 * name). Choosing one kind clears the other kind in both of its homes;
 * the exact writes are built in utils/eventOrganizer.js.
 *
 * Started from the Feed (Task #1790): an event created from a Feed creator
 * has no organizer; the creator is only automation.started_from_profile_id
 * (describeStartedFrom). The page suggests them as the organizer, in People
 * and on the readiness Organizer item, and as a featured attendee — each one
 * click to accept, nothing saved until then. The invitation follows the
 * organizer: it cannot be generated until one is set.
 *
 * Stakes and money (Task #1771): what the event is worth and what it
 * costs, in plain words first; the numbers (prestige, strictness, career
 * tier, deadline type, cost) sit behind a "View details" disclosure.
 * Difficulty is the projected one (F-Stats-1 decision), incomplete when an
 * input is missing. Prestige, strictness, deadline type and career tier
 * are editable here through the same event PUT; cost is read-only
 * (resolveEventStakes / buildStakesUpdate, utils/eventStakes.js).
 *
 * Terms (Task #1814): access requirements, deliverables, restrictions and
 * compensation, each edited in its own home (EventTermsSection,
 * components/EventPackage/). The requirements that used to sit under
 * "Style & Requirements" are the access requirements there. Editing stops
 * at Start Episode, like every other section.
 *
 * Review (Task #1775): readiness by Package section
 * (computeEventPackageReadiness, utils/eventReadinessSections.js) — each
 * section's state and what is missing in it. Each item is a gate (blocks
 * Start Episode) or a warning, per READINESS_ITEMS there (Evoni's ruling,
 * 2026-09-24). A suggestion never satisfies an item; only a saved value
 * does. Start Episode with warnings open asks first, listing each warning
 * and its consequence, with Start Anyway / Go back.
 */
/*
 * The split (Task #54): this file composes the page. Its data and saves are
 * useEventPackage (one combined GET, each part failing on its own); each
 * concern's state is a hook in ./eventPackage/ (Basics, names, Suggest with
 * AI, stakes, organizer, guests, the place pickers, Start Episode, where the
 * page is, the open dialog); each section and dialog is a component in
 * components/EventPackage/. The markup, class names and this stylesheet are
 * as they were.
 */
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronUp, Pencil, Undo2 } from 'lucide-react';
import { seasonPageHref } from '../lib/seasonPage';
import { resolveEventVenueAndDate } from '../utils/eventReadiness';
import { computeEventPackageReadiness, nextPackageStep } from '../utils/eventReadinessSections';
import { resolveEventBasics, draftStateOf } from '../utils/eventBasics';
import EventConceptSection, { hasConcept } from '../components/EventConceptSection';
import { describeEventOrganizer, describeStartedFrom } from '../utils/eventOrganizer';
import { packageBadge, pageNav } from '../lib/eventPackageHero';
import { resolveEventStakes } from '../utils/eventStakes';
import { taxonomyLabel } from '../utils/eventTaxonomy';
import { sceneSetThumb, sceneSetPath } from '../utils/sceneSets';
import { BASICS_FIELDS, CONTINUE_BASICS, FOLDABLE, fmtBasicsValue } from '../lib/eventPackageFields';
import EventDocuments from '../components/EventPackage/EventDocuments';
import EventOutfitPicker from '../components/EventOutfitPicker';
import EpisodeLocationsStep from '../components/EpisodeLocationsStep';
import PackageHero from '../components/EventPackage/PackageHero';
import ReadinessDetails from '../components/EventPackage/ReadinessDetails';
import ShortcutsHelp from '../components/EventPackage/ShortcutsHelp';
import PackageToc from '../components/EventPackage/PackageToc';
import EventIdentitySection from '../components/EventPackage/EventIdentitySection';
import EventPeopleSection from '../components/EventPackage/EventPeopleSection';
import EventPlaceSection from '../components/EventPackage/EventPlaceSection';
import EventLookSection from '../components/EventPackage/EventLookSection';
import EventDealSection from '../components/EventPackage/EventDealSection';
import EventStakesSection from '../components/EventPackage/EventStakesSection';
import StartConfirmDialog from '../components/EventPackage/StartConfirmDialog';
import StakesDialog from '../components/EventPackage/StakesDialog';
import OrganizerPicker from '../components/EventPackage/OrganizerPicker';
import GuestFeedPicker from '../components/EventPackage/GuestFeedPicker';
import VenuePicker from '../components/EventPackage/VenuePicker';
import ScenePicker from '../components/EventPackage/ScenePicker';
import ReadinessBar from './eventPackage/ReadinessBar';
import useSectionFolds from './eventPackage/useSectionFolds';
import usePackageShortcuts from './eventPackage/usePackageShortcuts';
import useEventPackage from './eventPackage/useEventPackage';
import useBasicsEditor from './eventPackage/useBasicsEditor';
import useNameSuggest from './eventPackage/useNameSuggest';
import useAiSuggest from './eventPackage/useAiSuggest';
import useStakesEditor from './eventPackage/useStakesEditor';
import useOrganizerPicker from './eventPackage/useOrganizerPicker';
import useGuests from './eventPackage/useGuests';
import usePlacePickers from './eventPackage/usePlacePickers';
import useStartEpisode from './eventPackage/useStartEpisode';
import usePackageNavigation from './eventPackage/usePackageNavigation';
import useDialogFocus from './eventPackage/useDialogFocus';
import './EventPackagePage.css';

// The scene-set helpers moved to lib/eventPackageFields and utils/sceneSets;
// re-exported here for the page's callers.
export { orderSceneSetsForEvent, searchSceneSets } from '../lib/eventPackageFields';
export { sceneSetThumb, sceneSetPath };

/**
 * The page, one instance per event (audit, 2026-10-23): moving from one
 * event to another mounts a fresh page, so nothing of the last event (its
 * name suggestions, brands, invitation approval, terms offer, a load still
 * in flight) carries over to the next.
 */
export default function EventPackagePage() {
  const { eventId } = useParams();
  return <EventPackageView key={eventId} />;
}

// The first load's spinner and failure; the page itself once the event is in.
function EventPackageView() {
  const { showId, eventId } = useParams();
  const navigate = useNavigate();
  const pkg = useEventPackage({ showId, eventId });

  if (pkg.loading) {
    return (
      <div className="epp-page epp-center">
        <div className="epp-spinner" role="status" aria-label="Loading event" />
      </div>
    );
  }

  if (pkg.loadError || !pkg.data?.event) {
    return (
      <div className="epp-page epp-center">
        <AlertCircle size={28} color="var(--lala-danger)" />
        <p className="epp-error" role="alert">{pkg.loadError || 'Event not found'}</p>
        {pkg.loadError && <button type="button" className="epp-btn epp-btn-primary" onClick={pkg.load}>Try again</button>}
        <button className="epp-btn epp-btn-secondary" onClick={() => navigate(seasonPageHref(showId, 'events'))}>
          <ArrowLeft size={16} /> Back to Events
        </button>
      </div>
    );
  }

  return <EventPackageBody pkg={pkg} />;
}

function EventPackageBody({ pkg }) {
  const { showId, eventId } = useParams();
  const navigate = useNavigate();
  const {
    data, refreshError, reloadTick, seeds, seasonContext, moneyPreview, moneyStatus,
    load, putEvent, undoChange, loadedEventRef, toastState, setToast,
  } = pkg;
  const toast = toastState?.text || null;
  // The sticky readiness bar's list (the count is its disclosure).
  const [barOpen, setBarOpen] = useState(false);
  // The shortcut help (desktop: "?").
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // The deal's deliverable and cost rows, reported by EventTermsSection so a
  // missing price there holds the readiness gate too.
  const [priceInputs, setPriceInputs] = useState(null);
  const folds = useSectionFolds(eventId);
  const setFoldOpen = folds.setOpen;
  const pageRef = useRef(null);
  const shortcutsRef = useRef({});
  // Owned here, not inside InvitationButton (Task #1668), which remounts on
  // reloadTick: what it was told on generating survives the reload.
  const [invitationApprovalInfo, setInvitationApprovalInfo] = useState(null);
  // Style (Task #2376): the closet picker, open while choosing Lala's look.
  const [outfitPickerOpen, setOutfitPickerOpen] = useState(false);
  // Reopen terms (Task #2378): the regeneration offer after Save and
  // relock, and a count InvitationButton regenerates on. Owned here for the
  // same reason as invitationApprovalInfo: the reload after a relock
  // remounts the panel.
  const [termsOffer, setTermsOffer] = useState(null);
  const [invitationRegenSignal, setInvitationRegenSignal] = useState(0);

  const { event, sourceProfile, startedFromProfile, sceneSet, venueLocation, invitationAsset, usedInEpisode, termsLockedBy, termsReopen, placeLocked } = data;
  // Read-only once Start Episode has locked the terms (Task #2356): the
  // server's own lock (termsLockedBy: the brief that names this event, §8(w)
  // P2, else the used_in_episode_id stamp), so the page never offers an edit
  // the server would refuse.
  const used = !!event.used_in_episode_id || !!termsLockedBy;
  const moneyWarnings = moneyStatus === 'failed'
    ? [{ code: 'money_check_unavailable', message: 'Lala’s money couldn’t be checked for this episode; her balance may go below zero.' }]
    : (moneyPreview?.warnings || []);
  const moneyPending = !used && moneyStatus === 'loading';
  const lockEpisode = termsLockedBy || usedInEpisode || null;
  // Featured attendees (Evoni, 2026-10-09: "im not able to choose a
  // featured guest" after Start Episode, while the episode asked for them):
  // they only steer the script, so like the scene set (L13) they stay
  // editable until the episode is accepted. Who is invited stays locked.
  const castLocked = used && !!placeLocked;
  // The deal's deliverable and cost rows (EventTermsSection's
  // onPriceInputsChange) hold the price gate too, once they have loaded.
  const readiness = computeEventPackageReadiness(event, { suggest: !used, venueLocation, ...(priceInputs ? { prices: priceInputs } : {}) });
  const confirmCount = readiness.warningItems.length + moneyWarnings.length;
  const { gatesMet } = readiness;
  const nextStep = nextPackageStep(readiness);
  const badge = packageBadge({ event, readiness, locked: used });
  // Category and format (Tasks #1780, #1888) come from resolveEventBasics
  // too, set / suggested / missing like the others. The organizer is the
  // linked creator profile, when there is one.
  const basics = resolveEventBasics(event, venueLocation, { suggest: !used, organizer: sourceProfile });
  // Task #2135: the name's draft state against its saved copy, or null.
  const nameDraft = event.name ? draftStateOf(event, 'name', event.name) : null;
  const venueDate = resolveEventVenueAndDate(event);
  const organizer = describeEventOrganizer(event, sourceProfile);
  const startedFrom = used ? null : describeStartedFrom(event, startedFromProfile);
  const stakes = resolveEventStakes(event);
  const projection = stakes.difficulty;

  const guestList = event.canon_consequences?.automation?.guest_profiles || [];
  const featuredGuests = guestList
    .map((guest, index) => ({ guest, index }))
    .filter(({ guest }) => guest.featured);
  const eventOutfit = Array.isArray(event.outfit_pieces) ? event.outfit_pieces : [];
  // Once the event has started an episode, Lala's look is chosen in the
  // episode's styling game (data.episodeLook: locked, chosen but not locked
  // yet, else the event's own); before, it is the event's outfit_pieces.
  const episodeLook = used && data.episodeLook ? data.episodeLook : null;
  const outfitPieces = episodeLook ? (episodeLook.pieces || []) : eventOutfit;
  const lookEpisodeId = episodeLook?.episode_id || lockEpisode?.id || null;
  const lookSummary = !outfitPieces.length ? 'Not chosen'
    : episodeLook?.state === 'chosen' ? `${outfitPieces.length} chosen, not locked yet`
    : `${outfitPieces.length} piece${outfitPieces.length === 1 ? '' : 's'} ${episodeLook?.state === 'locked' ? 'locked' : 'chosen'}`;
  // Lala's Look (the redesign): the dress code with the styling brief's formality, direction and footwear.
  const stylingBrief = event.canon_consequences?.automation?.styling_brief || {};
  const lookBrief = [
    ['Dress code', event.dress_code],
    ['Formality', stylingBrief.formality],
    ['Style direction', stylingBrief.style_direction],
    ['Footwear', stylingBrief.footwear_requirements],
  ].filter(([label, value]) => label === 'Dress code' || (typeof value === 'string' && value.trim()));
  // What going without featured attendees means, from the readiness rules.
  const featuredConsequence = readiness.sections.find((sec) => sec.key === 'people')?.missing?.find((m) => m.key === 'featured')?.consequence || null;

  const openEditor = () => navigate(seasonPageHref(showId, 'events', { event: eventId }));

  // Folded sections (Evoni, 2026-10-23): a section whose readiness items are
  // all complete starts as one line with Edit; the person's own open/closed
  // choice is remembered per event (useSectionFolds).
  const nav = pageNav(readiness, { has: { concept: hasConcept(event) } });
  const navState = Object.fromEntries(nav.map((s) => [s.anchor, s.state]));
  const sectionOpen = (anchor) => !FOLDABLE.has(anchor) || folds.isOpen(anchor, navState[anchor] === 'complete');
  const openSection = (anchor) => { if (FOLDABLE.has(anchor) && !sectionOpen(anchor)) folds.setOpen(anchor, true); };
  const scrollToSection = (anchor) => {
    // After the section has opened (next frame), so it lands at its full height.
    setTimeout(() => {
      const el = document.getElementById(`epp-sec-${anchor}`);
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };
  // A section jumped to from the bar's list, the menu or a shortcut opens.
  const jumpToSection = (anchor) => {
    const target = anchor === 'invitation' ? 'identity' : anchor;
    openSection(target);
    setBarOpen(false);
    scrollToSection(anchor);
  };

  const editor = useBasicsEditor({ basics, used, putEvent, load, setToast, openSection });
  const names = useNameSuggest({ showId, eventId, putEvent, load, setToast });
  const ai = useAiSuggest({ showId, eventId, event, basics, used, startedFrom, organizer, putEvent, load, setToast });
  const stakesEditor = useStakesEditor({ event, used, putEvent, load, setToast });
  const picker = useOrganizerPicker({ event, used, organizer, sourceProfile, putEvent, load, setToast, undoChange, loadedEventRef });
  const guests = useGuests({ event, guestList, putEvent, load, setToast, undoChange, loadedEventRef });
  const place = usePlacePickers({ showId, event, putEvent, load, setToast });
  const start = useStartEpisode({ showId, eventId, gatesMet, used, moneyPending, readiness, moneyWarnings, setToast, navigate });
  const { activeAnchor, tocListRef } = usePackageNavigation({ pageRef, setFoldOpen, setBarOpen, setFullGuestListOpen: guests.setFullGuestListOpen });

  // Started-from suggestions (Task #1790): one click each.
  const acceptStartedFromOrganizer = () => {
    if (startedFrom?.suggestOrganizer) picker.chooseCreatorOrganizer(startedFrom.profile);
  };
  const acceptStartedFromAttendee = () => {
    if (!startedFrom?.suggestAttendee) return;
    if (startedFrom.guestIndex >= 0) guests.toggleFeatured(startedFrom.guestIndex);
    else guests.addGuestFromFeed(startedFrom.profile);
  };

  // Continue → (Evoni, 2026-10-03): scrolls to the next item's section and
  // opens what sets it, where the page has one. An item with no editor here
  // (the invitation, the featured attendees, a default cost) only scrolls.
  const continueTo = (it) => {
    if (!it || used) return;
    setBarOpen(false);
    const basicsKey = CONTINUE_BASICS[`${it.section}.${it.key}`];
    if (basicsKey) {
      // The field opens in its row in The Event (the dress code too), so
      // that row is where the page lands.
      editor.openBasicsEditor(basicsKey);
      setTimeout(() => {
        const row = document.querySelector(`[data-testid="basics-editor-${basicsKey}"]`);
        if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      return;
    }
    const anchor = it.section === 'organizer' ? 'people' : it.section;
    openSection(anchor === 'invitation' ? 'identity' : anchor);
    scrollToSection(anchor);
    switch (`${it.section}.${it.key}`) {
      case 'organizer.organizer': picker.openOrganizerPicker(); break;
      case 'identity.name': names.openNameSuggest(); break;
      case 'place.venue': place.setVenuePickerOpen(true); break;
      case 'place.scene_set':
        place.openScenePicker(venueDate.venueLocationId ? { id: venueDate.venueLocationId, name: venueDate.venueName } : null);
        break;
      case 'look.outfit': setOutfitPickerOpen(true); break;
      case 'stakes.story_stakes': stakesEditor.openStakesEditor(); break;
      default: break;
    }
  };

  // The open dialog: Escape, Tab and focus (useDialogFocus).
  const closeTopDialogRef = useRef(null);
  const { stakesDraft, stakesSaving } = stakesEditor;
  const anyDialogOpen = start.startConfirmOpen || !!stakesDraft || picker.organizerPickerOpen
    || guests.guestFeedPickerOpen || place.venuePickerOpen || place.scenePickerOpen || outfitPickerOpen;
  useDialogFocus(anyDialogOpen, closeTopDialogRef);

  // Desktop shortcuts (g then 1–9, s, ?); the handlers are set each render below.
  usePackageShortcuts({ enabled: true, dialogOpen: anyDialogOpen, handlersRef: shortcutsRef });

  // The topmost open dialog's close, for Escape (see anyDialogOpen above).
  closeTopDialogRef.current = place.scenePickerOpen ? place.closeScenePicker
    : place.venuePickerOpen ? place.closeVenuePicker
      : guests.guestFeedPickerOpen ? () => guests.setGuestFeedPickerOpen(false)
        : picker.organizerPickerOpen ? () => { if (!picker.organizerSaving) picker.closeOrganizerPicker(); }
          : stakesDraft ? () => { if (!stakesSaving) stakesEditor.setStakesDraft(null); }
            : start.startConfirmOpen ? () => { if (!start.starting) start.setStartConfirmOpen(false); }
              : outfitPickerOpen ? () => setOutfitPickerOpen(false)
                : null;

  // Desktop shortcuts (usePackageShortcuts): g then N jumps to the Nth
  // section in the menu's order, s saves the open Basics field, ? the help.
  shortcutsRef.current = {
    onJump: (n) => { const target = nav[n - 1]; if (target) jumpToSection(target.anchor); },
    onSave: () => {
      const { basicsEditing, basicsDraft, basicsSaving } = editor;
      if (!basicsEditing || used || basicsSaving) return false;
      const spec = BASICS_FIELDS[basicsEditing];
      if (!basicsDraft.trim() || (spec.input === 'select' && !spec.options.includes(basicsDraft))) return false;
      editor.saveBasicsField(basicsEditing, basicsDraft);
      return true;
    },
    onHelp: () => setShortcutsOpen((o) => !o),
    onEscape: () => { if (!shortcutsOpen) return false; setShortcutsOpen(false); return true; },
  };

  // The one-line summary a folded section shows (Evoni, 2026-10-23).
  const foldSummary = {
    identity: [event.name, fmtBasicsValue('date', basics.date.value), fmtBasicsValue('time', basics.time.value), basics.category.value && taxonomyLabel(basics.category.value)].filter(Boolean).join(' · '),
    people: [organizer.hasOrganizer ? `Organized by ${organizer.name || 'Unnamed'}` : 'No organizer', `${featuredGuests.length} featured`, `${guestList.length} invited`].join(' · '),
    place: [venueDate.venueName || 'No venue', sceneSet?.name ? `set: ${sceneSet.name}` : null].filter(Boolean).join(' · '),
    look: [lookSummary, event.dress_code ? `dress code: ${event.dress_code}` : null].filter(Boolean).join(' · '),
    stakes: [stakes.relationship.summary, projection.complete ? `${projection.label.text} challenge` : null].filter(Boolean).join(' · '),
  };
  // A section's header pieces when it folds: its Edit (expand) / Collapse
  // button and the summary line; the sections read them through `fold`.
  const fold = {
    isOpen: sectionOpen,
    button: (anchor, title) => {
      if (!FOLDABLE.has(anchor)) return null;
      const open = sectionOpen(anchor);
      return (
        <button
          type="button" className="epp-btn epp-btn-small epp-fold-btn" data-testid={`fold-${anchor}`}
          aria-expanded={open} aria-controls={`epp-body-${anchor}`} aria-label={open ? `Collapse ${title}` : `Edit ${title}`}
          onClick={() => folds.setOpen(anchor, !open)}
        >
          {open ? <><ChevronUp size={13} aria-hidden="true" /> Collapse</> : <><Pencil size={13} aria-hidden="true" /> Edit</>}
        </button>
      );
    },
    line: (anchor) => (FOLDABLE.has(anchor) && !sectionOpen(anchor)
      ? <p className="epp-fold-summary" data-testid={`fold-summary-${anchor}`}><CheckCircle2 size={13} aria-hidden="true" /> {foldSummary[anchor] || 'Complete'}</p>
      : null),
    cls: (anchor, extra = '') => `epp-section${extra ? ` ${extra}` : ''}${FOLDABLE.has(anchor) && !sectionOpen(anchor) ? ' is-folded' : ''}`,
  };

  return (
    <div className="epp-page" ref={pageRef}>
      <div className="epp-toast-live" role="status" aria-live="polite">
        {toast && (
          <div className={`epp-toast${toastState.undo ? ' has-undo' : ''}`} key={toastState.n} data-testid="page-toast">
            <span>{toast}</span>
            {toastState.undo && (
              <button type="button" className="epp-toast-undo" data-testid="toast-undo" onClick={toastState.undo}>
                <Undo2 size={13} aria-hidden="true" /> Undo
              </button>
            )}
          </div>
        )}
      </div>
      {refreshError && (
        <div className="epp-refresh-error" role="alert" data-testid="refresh-error">
          <AlertCircle size={16} aria-hidden /> Couldn&apos;t refresh the event: {refreshError}. What you see may be out of date.
          <button type="button" className="epp-btn epp-btn-secondary epp-btn-small" onClick={load}>Retry</button>
        </div>
      )}

      <PackageHero
        showId={showId} eventId={eventId} event={event} seasonContext={seasonContext} badge={badge} venueDate={venueDate}
        organizer={organizer} projection={projection} used={used} lockEpisode={lockEpisode} termsReopen={termsReopen}
      />

      {/* One sticky readiness bar (Evoni, 2026-10-23): it replaces the
          strip's tiles, the next-step bar and the footer action bar. The
          count opens the list of sections; "What each section needs" (the
          old Review, under its old anchor) folds inside it. */}
      <ReadinessBar
        readiness={readiness} nextStep={nextStep} used={used} gatesMet={gatesMet}
        moneyWarningCount={moneyWarnings.length} moneyStatus={moneyStatus} moneyPreview={moneyPreview}
        starting={start.starting} moneyPending={moneyPending}
        open={barOpen} onOpenChange={setBarOpen}
        onContinue={continueTo} onStart={start.requestStartEpisode} onJump={jumpToSection} onEditDetails={openEditor}
        onShowShortcuts={() => { setBarOpen(false); setShortcutsOpen(true); }}
      >
        <ReadinessDetails
          readiness={readiness} gatesMet={gatesMet} confirmCount={confirmCount} used={used} moneyWarnings={moneyWarnings}
          startedFrom={startedFrom} organizerSaving={picker.organizerSaving} acceptStartedFromOrganizer={acceptStartedFromOrganizer}
        />
      </ReadinessBar>

      {shortcutsOpen && <ShortcutsHelp nav={nav} onClose={() => setShortcutsOpen(false)} />}

      <div className="epp-body">
        <PackageToc nav={nav} activeAnchor={activeAnchor} tocListRef={tocListRef} openSection={openSection} />

        <div className="epp-sections">
          <EventIdentitySection
            showId={showId} event={event} basics={basics} used={used} organizer={organizer} invitationAsset={invitationAsset}
            nameDraft={nameDraft} reloadTick={reloadTick} fold={fold} editor={editor} names={names} ai={ai}
            invitationApprovalInfo={invitationApprovalInfo} setInvitationApprovalInfo={setInvitationApprovalInfo}
            invitationRegenSignal={invitationRegenSignal} load={load}
          />
          <EventPeopleSection
            event={event} used={used} castLocked={castLocked} organizer={organizer} sourceProfile={sourceProfile}
            startedFrom={startedFrom} guestList={guestList} featuredGuests={featuredGuests} featuredConsequence={featuredConsequence}
            lockEpisode={lockEpisode} reloadTick={reloadTick} fold={fold} guests={guests}
            openOrganizerPicker={picker.openOrganizerPicker} organizerSaving={picker.organizerSaving}
            acceptStartedFromOrganizer={acceptStartedFromOrganizer} acceptStartedFromAttendee={acceptStartedFromAttendee}
          />
          <EventPlaceSection
            showId={showId} eventId={eventId} used={used} placeLocked={placeLocked} venueDate={venueDate} sceneSet={sceneSet}
            reloadTick={reloadTick} fold={fold} setVenuePickerOpen={place.setVenuePickerOpen} openScenePicker={place.openScenePicker}
            setToast={setToast} load={load}
          />

          {/* Style (Task #1814): the requirements that sat here moved to the
              Terms area below as access requirements, one of the four kinds
              of term (docs/EVENT_EPISODE_FLOW.md §8(t) item 1) — shown and
              edited in one place. Choosing Lala's look (Task #2376): before
              Start Episode the outfit is chosen here, with the same closet
              picker (and PUT /outfit, saved on world_events.outfit_pieces) as
              the Events card's ⋯ menu. Once used it stays read-only, as the
              rest of the package does. */}
          <EventLookSection
            showId={showId} eventId={eventId} event={event} used={used} outfitPieces={outfitPieces} episodeLook={episodeLook}
            lookSummary={lookSummary} lookBrief={lookBrief} lookEpisodeId={lookEpisodeId} reloadTick={reloadTick} fold={fold}
            setOutfitPickerOpen={setOutfitPickerOpen} setToast={setToast} load={load}
          />

          {outfitPickerOpen && !used && (
            <EventOutfitPicker
              showId={showId}
              event={event}
              onClose={() => setOutfitPickerOpen(false)}
              onSaved={() => { setOutfitPickerOpen(false); load(); }}
              onToast={setToast}
            />
          )}

          <EventDealSection
            showId={showId} eventId={eventId} event={event} used={used} termsReopen={termsReopen} lockEpisode={lockEpisode}
            stakes={stakes} moneyPreview={moneyPreview} seeds={seeds} reloadTick={reloadTick}
            termsOffer={termsOffer} setTermsOffer={setTermsOffer} setInvitationRegenSignal={setInvitationRegenSignal}
            setPriceInputs={setPriceInputs} putEvent={putEvent} setToast={setToast} load={load}
          />
          <EventStakesSection used={used} stakes={stakes} projection={projection} fold={fold} openStakesEditor={stakesEditor.openStakesEditor} />

          {/* 7. In-world documents (Evoni, 2026-10-06): the shopping list and
              the career plan beside the invitation, each Draft, Edit, Redraft
              and Approve like it. */}
          <section id="epp-sec-documents" className="epp-section" data-testid="documents-section">
            <div className="epp-section-header">
              <div className="epp-section-heading"><h2 className="epp-section-title"><span className="epp-section-num">7.</span> In-world documents</h2><p className="epp-section-sub">The papers the event gives her, drafted from it.</p></div>
            </div>
            <EventDocuments key={`documents-${reloadTick}`}
              showId={showId}
              eventId={eventId}
              event={event}
              outfitPieces={outfitPieces}
              initialDocs={seeds?.documents}
            />
          </section>

          {/* 8. Behind the Scenes: the creation draft's planning notes, folded. */}
          <EventConceptSection event={event} dressCodeEdited={basics.dressCode.state === 'edited'} number={8} />
        </div>
      </div>

      {start.startConfirmOpen && gatesMet && !used && (
        <StartConfirmDialog readiness={readiness} moneyWarnings={moneyWarnings} confirmCount={confirmCount} start={start} />
      )}

      {start.locationsStep && gatesMet && !used && (
        <EpisodeLocationsStep
          showId={showId}
          title="Episode locations"
          confirmLabel="Start Episode"
          initial={start.locationsStep.locations}
          missing={start.locationsStep.missing}
          removed={start.locationsStep.removed || []}
          eventLook={start.locationsStep.event_look}
          angleGaps={start.locationsStep.angle_gaps}
          busy={start.starting}
          onConfirm={start.confirmStartEpisode}
          onCancel={() => start.setLocationsStep(null)}
        />
      )}

      {stakesDraft && !used && <StakesDialog stakesEditor={stakesEditor} />}
      {picker.organizerPickerOpen && !used && <OrganizerPicker event={event} organizer={organizer} picker={picker} />}
      {guests.guestFeedPickerOpen && <GuestFeedPicker guestList={guestList} guests={guests} />}
      {place.venuePickerOpen && <VenuePicker venueDate={venueDate} place={place} />}
      {place.scenePickerOpen && <ScenePicker event={event} place={place} />}
    </div>
  );
}
