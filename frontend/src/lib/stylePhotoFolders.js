/**
 * Files › Photos › Style spots (Evoni, 2026-10-22: "i dont want the uploads
 * in the style page move them to the files tab"): one folder per Style Page
 * spot, To sort first. A folder is the Lookbook category of the photos in it
 * (src/services/episodeLookbookService.js CATEGORIES), so filing a photo in
 * Hero puts it on the sheet's Hero spot.
 *
 * Front, Side and Back are not folders: they are Lala's poses (Evoni,
 * 2026-10-22: "Front back glamor side are the same poses as front side
 * back"). A photo filed under front, side or back before shows in To sort.
 */
export const STYLE_FOLDERS = [
  { key: 'unsorted', label: 'To sort', hint: 'New photos land here until you file them as a pose or a Style spot.' },
  { key: 'hero', label: 'Hero', single: true },
  { key: 'detail', label: 'Detail', single: true },
  { key: 'hair', label: 'Hair', single: true },
  { key: 'nails', label: 'Nails', single: true },
  { key: 'eyes', label: 'Eyes', single: true },
  { key: 'lips', label: 'Lips', single: true },
  { key: 'skin', label: 'Skin', single: true },
  { key: 'venue', label: 'Venue' },
  { key: 'inspo', label: 'Inspiration', max: 2 },
];

// The Lookbook's old Front, Side and Back photos: shown in To sort.
const LEGACY = ['front', 'side', 'back'];

export const folderLabel = (key) => STYLE_FOLDERS.find((f) => f.key === key)?.label || key;

/** Her own photos in one folder (scene-set venue images are not files). */
export const filesIn = (lookbook, key) => {
  const own = (k) => (lookbook?.images?.[k] || []).filter((i) => i.source === 'upload');
  return key === 'unsorted' ? [...own('unsorted'), ...LEGACY.flatMap(own)] : own(key);
};

/** Every photo in Style spots, folder by folder. */
export const allStyleFiles = (lookbook) => STYLE_FOLDERS.flatMap((f) => filesIn(lookbook, f.key).map((i) => ({ ...i, folder: f.key })));
