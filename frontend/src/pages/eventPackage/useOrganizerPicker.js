/**
 * Change Organizer (Task #1761; was Change Host): one picker, two kinds.
 * Moved out of EventPackagePage.jsx (Task #54). brands: null = not fetched
 * yet; brandsError = the list could not be loaded, so the Brand tab falls
 * back to typing a name.
 */
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { buildCreatorOrganizerUpdate, buildBrandOrganizerUpdate, filterBrands, profileName } from '../../utils/eventOrganizer';

export default function useOrganizerPicker({ event, used, organizer, sourceProfile, putEvent, load, setToast, undoChange, loadedEventRef }) {
  const [organizerPickerOpen, setOrganizerPickerOpen] = useState(false);
  const [organizerTab, setOrganizerTab] = useState('creator');
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [hostSearching, setHostSearching] = useState(false);
  const [brands, setBrands] = useState(null);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandFreeText, setBrandFreeText] = useState('');
  const [pendingOrganizer, setPendingOrganizer] = useState(null);
  const [organizerSaving, setOrganizerSaving] = useState(false);

  // Debounced creator search for the Change Organizer picker's Creator
  // tab. "For this show": social profiles carry no show_id (the list route
  // reads none), so this uses the scope New Episode's Choose Host uses for
  // the show, feed_layer=lalaverse (NewEpisodeChooseHost in App.jsx); the
  // route also returns the real-world profiles Lala follows for that layer.
  useEffect(() => {
    if (!organizerPickerOpen || organizerTab !== 'creator') return undefined;
    setHostSearching(true);
    // A newer search (or closing the picker) makes this one's answer stale.
    let stale = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      qs.set('feed_layer', 'lalaverse');
      if (hostSearch.trim()) qs.set('search', hostSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => { if (!stale) setHostResults(res.data?.profiles || []); })
        .catch((err) => {
          console.error('[EventPackage] organizer search failed:', err);
          if (!stale) setHostResults([]);
        })
        .finally(() => { if (!stale) setHostSearching(false); });
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [organizerPickerOpen, organizerTab, hostSearch]);

  // Brand list for the Brand tab, fetched once on first use: GET
  // /api/v1/wardrobe-brands/brands (wardrobeBrands.js) returns every
  // lalaverse_brands row, not show-scoped; filtered here by name.
  useEffect(() => {
    if (!organizerPickerOpen || organizerTab !== 'brand' || brands !== null) return;
    setBrandsLoading(true);
    setBrandsError(null);
    api.get('/api/v1/wardrobe-brands/brands')
      .then((res) => setBrands(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('[EventPackage] brand list failed:', err);
        setBrandsError(err.response?.data?.error || err.message || 'Could not load brands');
        setBrands([]);
      })
      .finally(() => setBrandsLoading(false));
  }, [organizerPickerOpen, organizerTab, brands]);

  const closeOrganizerPicker = () => {
    setOrganizerPickerOpen(false);
    setHostSearch(''); setHostResults([]);
    setBrandSearch(''); setBrandFreeText('');
    setPendingOrganizer(null);
  };

  const openOrganizerPicker = () => {
    if (used) return;
    setOrganizerTab(organizer.kind === 'brand' ? 'brand' : 'creator');
    setPendingOrganizer(null);
    setOrganizerPickerOpen(true);
  };

  // Saves an organizer through the existing PUT. pending.update.body comes
  // from buildCreatorOrganizerUpdate / buildBrandOrganizerUpdate; its keys
  // (source_profile_id, host, host_brand, canon_consequences) are all in
  // the route's allowedFields.
  const saveOrganizer = async (pending) => {
    if (used || organizerSaving || !pending) return;
    if (pending.update.unchanged) {
      closeOrganizerPicker();
      setToast(`${pending.label} is already the organizer`);
      return;
    }
    setOrganizerSaving(true);
    // What the choice replaces, for the toast's Undo: each column it writes
    // and each automation key it patches, as they were (the PUT merges
    // canon_consequences, so only those keys go back).
    const before = loadedEventRef.current || event;
    const undoBody = {};
    for (const col of Object.keys(pending.update.body)) {
      if (col === 'canon_consequences') {
        const auto = before.canon_consequences?.automation || {};
        const patch = pending.update.body.canon_consequences?.automation || {};
        undoBody.canon_consequences = { automation: Object.fromEntries(Object.keys(patch).map((k) => [k, auto[k] ?? null])) };
      } else {
        undoBody[col] = before[col] ?? null;
      }
    }
    try {
      await putEvent(pending.update.body);
      closeOrganizerPicker();
      setToast(`Organizer set to ${pending.label} (${pending.kind})`, {
        undo: () => undoChange(undoBody, 'Organizer change undone'),
      });
      await load();
    } catch (err) {
      console.error('[EventPackage] saveOrganizer failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to change organizer');
    } finally {
      setOrganizerSaving(false);
    }
  };

  // A choice that clears the other kind is confirmed first, naming what
  // goes; a choice that clears nothing saves straight away.
  const chooseOrganizer = (pending) => {
    if (pending.update.clears.length) setPendingOrganizer(pending);
    else saveOrganizer(pending);
  };

  const chooseCreatorOrganizer = (profile) => {
    chooseOrganizer({
      kind: 'creator',
      label: profileName(profile) || 'Creator',
      update: buildCreatorOrganizerUpdate(event, profile),
    });
  };

  const chooseBrandOrganizer = (brandName) => {
    const update = buildBrandOrganizerUpdate(event, brandName, sourceProfile);
    if (!update) return;
    chooseOrganizer({ kind: 'brand', label: brandName.trim(), update });
  };

  const brandsListed = filterBrands(brands, brandSearch);
  const brandFallback = brands !== null && !brandsLoading && (brandsError || brands.length === 0);

  return {
    organizerPickerOpen, organizerTab, setOrganizerTab, hostSearch, setHostSearch, hostResults, hostSearching,
    brands, setBrands, brandsLoading, brandsError, brandSearch, setBrandSearch, brandFreeText, setBrandFreeText,
    pendingOrganizer, setPendingOrganizer, organizerSaving, brandsListed, brandFallback,
    openOrganizerPicker, closeOrganizerPicker, saveOrganizer, chooseCreatorOrganizer, chooseBrandOrganizer,
  };
}
