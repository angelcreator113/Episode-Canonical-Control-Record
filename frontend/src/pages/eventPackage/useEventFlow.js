/**
 * The Event Package's header and navigation (Evoni, 2026-10-25: "I want
 * them all and show me first"): its place in the season, its stage, what
 * is left to set up and why a button can't run yet, the events before and
 * after it in slot order, and the way back to where it was opened from.
 *
 * What the package already answers (the season context, the readiness the
 * page computes) is used as it is. Three reads are added, each once per
 * visit and never blocking the page: the goal coverage for this event (the
 * header's goal chips read it here instead of on their own), and, for an
 * event in a slot, the season's roadmap (its neighbours, its slot's
 * episode) and the release schedule (its release day).
 *
 * The setup list keeps every entry shown this visit: one filled in since
 * stays, ticked, so the list ticks off as she works down it.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useGoalCoverage } from '../../lib/goalCoverage';
import { useReleaseSchedule, slotWhen } from '../../lib/releaseSchedule';
import {
  eventStages, setupSections, blockedReasons, parseFrom, fromParam, returnLink,
  slotNeighbours, neighbourHref, slotOf, goalGains, releaseLine,
} from '../../lib/eventFlow';

// After a jump has scrolled, focus lands on the section, unless what the
// jump opened (a picker, a Basics field) has taken it.
const FOCUS_DELAY_MS = 60;

export function focusSection(anchor, keepIn = null) {
  setTimeout(() => {
    const el = document.getElementById(`epp-sec-${anchor}`);
    if (!el) return;
    const active = document.activeElement;
    const free = !active || active === document.body || (keepIn && keepIn.contains(active));
    if (!free) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }, FOCUS_DELAY_MS);
}

export default function useEventFlow({
  showId, eventId, event, seasonContext, readiness, used, usedInEpisode, hasOrganizer, hasInvitation,
  moneyPending, continueTo, jumpToSection, openOrganizerPicker, reload = null, setToast = null,
}) {
  const { search } = useLocation();
  const fromValue = new URLSearchParams(search).get('from');
  const origin = parseFrom(fromValue);
  const from = fromParam(origin);
  const headerRef = useRef(null);

  const inSlot = Boolean(seasonContext?.in_slot);
  const slotNumber = inSlot ? seasonContext.slot_number ?? null : null;

  const coverage = useGoalCoverage({ api, showId, eventId });
  const release = useReleaseSchedule({ api: inSlot ? api : null, showId });
  const [roadmap, setRoadmap] = useState(null);
  useEffect(() => {
    if (!inSlot || !showId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/season/roadmap`)
      .then((res) => { if (!cancelled) setRoadmap(res.data?.roadmap || null); })
      .catch((err) => { console.error('[EventPackage] season roadmap load failed:', err); });
    return () => { cancelled = true; };
  }, [showId, inSlot]);

  // The setup list: the words each entry had when last shown, by section.
  const [seen, setSeen] = useState({});
  const sections = setupSections(readiness, seen);
  const missingKey = sections.filter((s) => !s.done).map((s) => `${s.key}=${s.label}`).join('|');
  useEffect(() => {
    if (used) return;
    const live = sections.filter((s) => !s.done);
    if (!live.length) return;
    setSeen((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of live) if (next[s.key] !== s.label) { next[s.key] = s.label; changed = true; }
      return changed ? next : prev;
    });
  }, [missingKey, used]); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = eventStages({ event, readiness, used, episode: usedInEpisode });
  const reasons = blockedReasons({ readiness, used, hasOrganizer, hasInvitation, moneyPending });
  const leftToSetUp = sections.filter((s) => !s.done).length;
  // "Done · back to …" once Start Episode has everything it needs.
  const back = returnLink(origin, { showId, done: !used && Boolean(readiness?.gatesMet) });

  const slot = slotOf(roadmap, slotNumber);
  const neighbours = slotNeighbours(roadmap, slotNumber);
  const place = {
    context: seasonContext,
    inSlot,
    coverage,
    gains: goalGains(coverage.data, eventId),
    release: inSlot && slot ? releaseLine(slotWhen(release.view, slot, seasonContext?.season_number ?? null)) : null,
    // A full season's choice (FullSeasonChoice) reloads the page and says what it did.
    reload,
    setToast,
  };

  // A setup entry (or a reason's target item) jumps to where it is set:
  // what Continue opens for it (a picker, a Basics field), else its
  // section, focused once it has scrolled there.
  const jumpTo = (it) => {
    if (!it) return;
    const key = `${it.section}.${it.key}`;
    if (key === 'stakes.prices') { jumpToSection('deal'); focusSection('deal', headerRef.current); return; }
    if (key === 'invitation.invitation') { jumpToSection('invitation'); focusSection('invitation', headerRef.current); return; }
    continueTo(it);
    const anchor = it.section === 'organizer' ? 'people' : it.section;
    focusSection(anchor, headerRef.current);
  };
  // A ticked entry still goes to its section.
  const jump = (entry) => {
    if (entry.first) { jumpTo(entry.first); return; }
    jumpToSection(entry.anchor);
    focusSection(entry.anchor, headerRef.current);
  };
  const runAction = (action) => {
    if (!action) return;
    if (action.target === 'organizer') { openOrganizerPicker(); return; }
    if (action.target === 'deal') { jumpToSection('deal'); focusSection('deal', headerRef.current); return; }
    jumpTo(action.target);
  };

  return {
    origin, from, back, headerRef, place, stage, sections, leftToSetUp, reasons, jump, runAction,
    neighbours: {
      prev: neighbours.prev ? { ...neighbours.prev, href: neighbourHref(showId, neighbours.prev, from) } : null,
      next: neighbours.next ? { ...neighbours.next, href: neighbourHref(showId, neighbours.next, from) } : null,
      current: slotNumber != null ? `E${slotNumber}` : null,
    },
  };
}
