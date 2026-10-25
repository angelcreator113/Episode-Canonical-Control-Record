/**
 * Featured attendees (Task #1689) and "Add from The Pulse": the guest-list
 * saves and the feed picker's search. Moved out of EventPackagePage.jsx
 * (Task #54). guestFeedResults mirrors the Change Organizer picker's
 * debounced search exactly (same endpoint, same shape).
 */
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { MAX_FEATURED_GUESTS, fmtLabel } from '../../lib/eventPackageFields';

export default function useGuests({ event, guestList, putEvent, load, setToast, undoChange, loadedEventRef }) {
  const [fullGuestListOpen, setFullGuestListOpen] = useState(false);
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestFeedPickerOpen, setGuestFeedPickerOpen] = useState(false);
  const [guestFeedSearch, setGuestFeedSearch] = useState('');
  const [guestFeedResults, setGuestFeedResults] = useState([]);
  const [guestFeedSearching, setGuestFeedSearching] = useState(false);

  // Debounced creator search for "Add from Lala's Feed" — same endpoint
  // and shape as the organizer picker's Creator tab, no show/series
  // or feed-layer scoping, matching assembleGuestList itself
  // (eventAutomationService.js), which does not scope by show either.
  useEffect(() => {
    if (!guestFeedPickerOpen) return undefined;
    setGuestFeedSearching(true);
    let stale = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (guestFeedSearch.trim()) qs.set('search', guestFeedSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => { if (!stale) setGuestFeedResults(res.data?.profiles || []); })
        .catch((err) => {
          console.error('[EventPackage] guest search failed:', err);
          if (!stale) setGuestFeedResults([]);
        })
        .finally(() => { if (!stale) setGuestFeedSearching(false); });
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [guestFeedPickerOpen, guestFeedSearch]);

  // Persists a whole new guest_profiles array through the existing event
  // PUT route. canon_consequences is a plain JSONB column overwrite there
  // (worldEvents.js's PUT allowedFields/jsonFields, confirmed in this
  // task's PR body) — not a JSONB merge — so every write here sends the
  // event's full canon_consequences with only automation.guest_profiles
  // replaced, or every other automation field (host, venue, ...) would be
  // wiped.
  // The event as last loaded, not this render's copy: an Undo runs after
  // the reload, and must not write back an older canon_consequences.
  const guestBody = (list) => {
    const base = loadedEventRef.current || event;
    return {
      canon_consequences: {
        ...(base.canon_consequences || {}),
        automation: { ...(base.canon_consequences?.automation || {}), guest_profiles: list },
      },
    };
  };
  // { undoable: true } offers Undo on the toast (Evoni, 2026-10-23), which
  // puts the guest list back as it was before this change, in one save.
  const saveGuestProfiles = async (newGuestProfiles, successMessage, { undoable = false } = {}) => {
    setGuestSaving(true);
    const previous = guestList;
    try {
      await putEvent(guestBody(newGuestProfiles));
      if (undoable) {
        setToast(successMessage || 'Guests updated', { undo: () => undoChange(() => guestBody(previous), 'Undone') });
      } else if (successMessage) setToast(successMessage);
      await load();
    } catch (err) {
      console.error('[EventPackage] saveGuestProfiles failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to update guests');
    } finally {
      setGuestSaving(false);
    }
  };

  // At most MAX_FEATURED_GUESTS featured; says so when full.
  const featuredFull = () => {
    if (guestList.filter((g) => g.featured).length < MAX_FEATURED_GUESTS) return false;
    setToast(`Only ${MAX_FEATURED_GUESTS} guests can be featured at once — remove one first.`);
    return true;
  };

  const toggleFeatured = (index) => {
    const guest = guestList[index];
    const name = guest.display_name || guest.handle || 'Guest';
    if (!guest.featured && featuredFull()) return;
    const updated = guestList.map((g, i) => (i === index ? { ...g, featured: !g.featured } : g));
    saveGuestProfiles(updated, guest.featured ? `Removed ${name} from Featured` : `${name} is now Featured`, { undoable: true });
  };

  const setGuestStoryRole = (index, role) => {
    const guest = guestList[index];
    const name = guest.display_name || guest.handle || 'Guest';
    const updated = guestList.map((g, i) => (i === index ? { ...g, story_role: role || null } : g));
    saveGuestProfiles(updated, role ? `${name}'s role: ${fmtLabel(role)}` : `${name} has no role now`, { undoable: true });
  };

  // Add from Feed is where Featured Attendees are chosen (Task #3138). A
  // name already on the guest list used to be a disabled row, and the
  // handler refused it ("already on the guest list"), so picking an invited
  // guest there never featured them. Now an invited guest is featured in
  // place (the same toggle the Full Guest List uses); a new one is added
  // and featured. Ids compare as strings, as featureRecommended does.
  const addGuestFromFeed = (profile) => {
    const at = guestList.findIndex((g) => String(g.profile_id) === String(profile.id));
    if (at >= 0) {
      if (guestList[at].featured) {
        setToast(`${profile.display_name || profile.handle} is already featured.`);
        return;
      }
      setGuestFeedPickerOpen(false); setGuestFeedSearch(''); setGuestFeedResults([]);
      toggleFeatured(at);
      return;
    }
    if (featuredFull()) return;
    // Same shape assembleGuestList writes (eventAutomationService.js) —
    // profile_id, not id — so relationship-sync and every other
    // profile_id-reading consumer finds this guest too (Task #1686).
    const newGuest = {
      profile_id: profile.id,
      handle: profile.handle,
      display_name: profile.display_name || profile.handle,
      featured: true,
      story_role: null,
    };
    setGuestFeedPickerOpen(false); setGuestFeedSearch(''); setGuestFeedResults([]);
    saveGuestProfiles([...guestList, newGuest], `${newGuest.display_name} added and featured`, { undoable: true });
  };

  // A recommended attendee (episode creation step 5): an invited guest is
  // featured with the role; anyone else joins the guest list featured, in
  // the shape Add from Feed writes.
  const featureRecommended = (rec) => {
    if (featuredFull()) return;
    const at = guestList.findIndex((g) => String(g.profile_id) === String(rec.profile_id));
    const updated = at >= 0
      ? guestList.map((g, i) => (i === at ? { ...g, featured: true, story_role: rec.role } : g))
      : [...guestList, {
        profile_id: rec.profile_id, handle: rec.handle, display_name: rec.display_name,
        featured: true, story_role: rec.role,
      }];
    saveGuestProfiles(updated, `${rec.display_name} featured as ${rec.role}`, { undoable: true });
  };

  return {
    fullGuestListOpen, setFullGuestListOpen, guestSaving,
    guestFeedPickerOpen, setGuestFeedPickerOpen, guestFeedSearch, setGuestFeedSearch, guestFeedResults, guestFeedSearching,
    toggleFeatured, setGuestStoryRole, addGuestFromFeed, featureRecommended,
  };
}
