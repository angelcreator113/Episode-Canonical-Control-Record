/**
 * Producer Mode → Wardrobe → Add piece (Evoni, 2026-10-07: "fix and redesign
 * wardrobe add piece"). The pure parts of AddPieceDialog: the empty form,
 * what is still missing, the auto-fill from a photo
 * (POST /wardrobe-library/analyze-image), the upload's FormData
 * (POST /wardrobe, wardrobeController.createWardrobeItem) and errors in
 * plain words. The fields and their wire names are the old modal's.
 */
import { parseAiPrice, fillPrice, suggestCoinCost } from '../utils/wardrobeAutoFill';

export const EMPTY_PIECE = Object.freeze({
  name: '', character: 'Lala', clothingCategory: '', brand: '', price: '', color: '', size: '', website: '',
  description: '', season: '', occasion: '', tags: '', tier: '', isFavorite: false,
  coinCost: '', acquisitionType: 'purchased', lockType: 'none', eraAlignment: '', reputationRequired: '',
  aestheticTags: '', eventTypes: '', outfitMatchWeight: '', influenceRequired: '', seasonUnlockEpisode: '',
  isOwned: true, isVisible: true, lalaReactionOwn: '', lalaReactionLocked: '', lalaReactionReject: '',
});

export const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all-season'];
export const TIERS = [
  { value: '', label: 'Auto' },
  { value: 'basic', label: 'Basic, fast fashion' },
  { value: 'mid', label: 'Mid, contemporary' },
  { value: 'luxury', label: 'Luxury, designer' },
  { value: 'elite', label: 'Elite, haute couture' },
];
export const ACQUISITIONS = ['purchased', 'gifted', 'borrowed', 'rented', 'custom', 'vintage'];
export const LOCKS = [
  { value: 'none', label: 'None, always available' },
  { value: 'coin', label: 'Coins, pay to unlock' },
  { value: 'reputation', label: 'Reputation gate' },
  { value: 'brand_exclusive', label: 'Brand exclusive' },
  { value: 'season_drop', label: 'Season drop' },
];
export const ERAS = [
  { value: '', label: 'Any era' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'glow_up', label: 'Glow Up' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'prime', label: 'Prime' },
  { value: 'legacy', label: 'Legacy' },
];

/** What the piece still needs before it can be added: [] when ready. */
export function missingForAdd(form, file) {
  const missing = [];
  if (!file) missing.push('a photo');
  if (!String(form?.name || '').trim()) missing.push('a name');
  if (!form?.clothingCategory) missing.push('a category');
  return missing;
}

/** "Add a photo, a name and a category", or '' when nothing is missing. */
export function missingText(missing) {
  if (!missing.length) return '';
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return `Add ${list}`;
}

// The AI's item type as the closet's category.
const CATEGORY_OF = {
  dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes', accessory: 'accessory', jewelry: 'jewelry', bag: 'bag',
  outerwear: 'outerwear', perfume: 'perfume', skirt: 'bottom', pants: 'bottom', shirt: 'top', blouse: 'top', fragrance: 'perfume',
};

/**
 * The form after an auto-fill answer ({ success, data, gameplay }). What she
 * typed is kept: a price, a coin cost and the gameplay fields are filled only
 * when empty (Task #2347).
 */
export function applyAutoFill(prev, answer) {
  const ai = answer?.data || {};
  const aiPrice = parseAiPrice(ai.price_estimate);
  const next = {
    ...prev,
    name: ai.name || prev.name,
    clothingCategory: CATEGORY_OF[String(ai.item_type || '').toLowerCase()] || prev.clothingCategory,
    color: ai.color || prev.color,
    brand: ai.brand_guess || prev.brand,
    price: fillPrice(prev.price, aiPrice),
    description: ai.description || prev.description || '',
    season: ai.season || prev.season || '',
    occasion: ai.occasion || prev.occasion || '',
    tags: (ai.aesthetic_tags || []).join(', ') || prev.tags || '',
    tier: ai.tier || prev.tier || '',
    character: 'Lala',
  };
  if (!answer?.gameplay) return next;
  const aiLocks = prev.lockType === 'none' && ai.lock_type && ai.lock_type !== 'none';
  return {
    ...next,
    coinCost: prev.coinCost || suggestCoinCost(prev.price, ai.coin_cost, aiPrice),
    acquisitionType: prev.acquisitionType === 'purchased' && ai.acquisition_type ? ai.acquisition_type : (prev.acquisitionType || 'purchased'),
    lockType: prev.lockType === 'none' && ai.lock_type ? ai.lock_type : (prev.lockType || 'none'),
    // A lock the AI suggests is a piece Lala does not own yet.
    ...(aiLocks ? { isOwned: false } : {}),
    eraAlignment: prev.eraAlignment || ai.era_alignment || '',
    aestheticTags: prev.aestheticTags || (ai.aesthetic_tags || []).join(', '),
    eventTypes: prev.eventTypes || (ai.event_types || []).join(', '),
    outfitMatchWeight: prev.outfitMatchWeight || (ai.outfit_match_weight != null ? String(ai.outfit_match_weight) : ''),
    lalaReactionOwn: prev.lalaReactionOwn || ai.lala_reaction_own || '',
    lalaReactionLocked: prev.lalaReactionLocked || ai.lala_reaction_locked || '',
    lalaReactionReject: prev.lalaReactionReject || ai.lala_reaction_reject || '',
  };
}

/**
 * The upload's FormData. Only what is set is sent, so the server keeps its
 * defaults (acquisition 'purchased', lock 'none', visible) for the rest.
 */
export function pieceFormData(form, file, showId) {
  const fd = new FormData();
  if (file) fd.append('image', file);
  fd.append('name', form.name.trim());
  fd.append('character', form.character || 'Lala');
  fd.append('clothingCategory', form.clothingCategory);
  const optional = {
    brand: form.brand, price: form.price, color: form.color, size: form.size, description: form.description,
    season: form.season, occasion: form.occasion, tags: form.tags, tier: form.tier, purchaseLink: form.website,
    coinCost: form.coinCost, eraAlignment: form.eraAlignment, reputationRequired: form.reputationRequired,
    aestheticTags: form.aestheticTags, eventTypes: form.eventTypes, outfitMatchWeight: form.outfitMatchWeight,
    influenceRequired: form.influenceRequired, seasonUnlockEpisode: form.seasonUnlockEpisode,
    lalaReactionOwn: form.lalaReactionOwn, lalaReactionLocked: form.lalaReactionLocked, lalaReactionReject: form.lalaReactionReject,
  };
  Object.entries(optional).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== '') fd.append(key, String(value).trim());
  });
  if (form.isFavorite) fd.append('isFavorite', 'true');
  if (form.acquisitionType && form.acquisitionType !== 'purchased') fd.append('acquisitionType', form.acquisitionType);
  if (form.lockType && form.lockType !== 'none') fd.append('lockType', form.lockType);
  fd.append('isOwned', form.isOwned ? 'true' : 'false');
  if (form.isVisible === false) fd.append('isVisible', 'false');
  if (showId) fd.append('showId', showId);
  return fd;
}

/**
 * An auto-fill failure in plain words (the old banner told her to edit the
 * server's .env and restart PM2).
 */
export function autoFillErrorText(err) {
  const status = err?.response?.status;
  const raw = err?.response?.data?.error || err?.message || String(err || '');
  if (err?.name === 'AbortError' || err?.code === 'ECONNABORTED' || /timeout/i.test(raw)) {
    return 'Filling in from the photo took too long. Try again, or fill the fields yourself.';
  }
  if (status === 413 || /payload too large|^413/i.test(raw)) return 'The photo is too large. Try one under 5 MB.';
  if (status === 429) return 'Fill-in from photo is paused for now (the AI budget or rate limit). Fill the fields yourself.';
  if (status === 503 || /ANTHROPIC_API_KEY|not configured|unavailable/i.test(raw)) {
    return "Fill-in from photo isn't available right now. Fill the fields yourself.";
  }
  if (/Failed to fetch|NetworkError|Network Error|ERR_/i.test(raw)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return raw ? `Couldn't fill in from the photo: ${raw}` : "Couldn't fill in from the photo.";
}

/** An upload failure in plain words. */
export function uploadErrorText(err) {
  const status = err?.response?.status;
  const raw = err?.response?.data?.error || err?.response?.data?.message || err?.message || '';
  if (status === 413 || /payload too large/i.test(raw)) return 'The photo is too large. Try one under 5 MB.';
  if (/Failed to fetch|NetworkError|Network Error/i.test(raw)) return "Couldn't reach the server. Your piece is still here; try again.";
  return raw ? `The piece wasn't added: ${raw}` : "The piece wasn't added. Try again.";
}

/** True when a photo was chosen but the saved piece has no image (the server keeps the piece when its upload fails). */
export const photoDropped = (file, saved) => Boolean(file) && !(saved?.s3_url || saved?.s3_url_processed || saved?.thumbnail_url);
