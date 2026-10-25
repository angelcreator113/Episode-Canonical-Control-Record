/**
 * Where the Event Package page is (moved out of EventPackagePage.jsx,
 * Task #54; the page calls this once the event has loaded): a #epp-sec-*
 * link lands on its section, "On this page" marks the section in view, and
 * the sticky bar's height is kept on the page for the menu and the scroll
 * targets.
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function usePackageNavigation({ pageRef, setFoldOpen, setBarOpen, setFullGuestListOpen }) {
  // A link to a section (#epp-sec-deal from Money's "Open terms in the
  // event") lands on it once the page has loaded; it used to stay at the top
  // (Evoni, 2026-10-07).
  const { hash } = useLocation();
  const hashScrolledRef = useRef(null);
  useEffect(() => {
    if (!hash || !hash.startsWith('#epp-sec-') || hashScrolledRef.current === hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    hashScrolledRef.current = hash;
    // The episode's "Choose featured attendees" lands on People with the
    // guest list open, where each name features or unfeatures that guest.
    if (hash === '#epp-sec-people') setFullGuestListOpen(true);
    // A folded section opens where a link lands on it (the invitation lives
    // in The Event; the old Review anchor is in the readiness bar's list).
    const anchor = hash.slice('#epp-sec-'.length);
    if (anchor === 'review') setBarOpen(true);
    else setFoldOpen(anchor === 'invitation' ? 'identity' : anchor, true);
    el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [hash, setFoldOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // "On this page" marks the section in view (Evoni's review, item 9): on a
  // phone the chip row stays under the header, so this shows where you are
  // and its chip scrolls into the row. No IntersectionObserver (tests): no mark.
  const [activeAnchor, setActiveAnchor] = useState(null);
  const tocListRef = useRef(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sections = [...document.querySelectorAll('.epp-sections > section[id^="epp-sec-"]')];
    if (!sections.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActiveAnchor(hit.target.id.replace('epp-sec-', ''));
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const list = tocListRef.current;
    const chip = activeAnchor && list?.querySelector(`[data-testid="toc-${activeAnchor}"]`);
    if (!chip || list.scrollWidth <= list.clientWidth) return;
    const left = chip.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + chip.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo?.({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  }, [activeAnchor]);

  // The sticky bar's height, so the "On this page" menu and the sections'
  // scroll targets sit under it rather than behind it.
  useEffect(() => {
    // The bar's own row, not its open list, which floats over the page.
    const bar = document.querySelector('#epp-readiness > .epp-next');
    const page = pageRef.current;
    if (!bar || !page) return undefined;
    const apply = () => page.style.setProperty('--epp-bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeAnchor, tocListRef };
}
