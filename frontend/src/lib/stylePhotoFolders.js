/**
 * Files › Style photos (Evoni, 2026-10-22: "i dont want the uploads in the
 * style page move them to the files tab"): one folder per Style Page spot,
 * To sort first. A folder is the Lookbook category of the photos in it
 * (src/services/episodeLookbookService.js CATEGORIES), so filing a photo in
 * Hero puts it on the sheet's Hero spot.
 */
export const STYLE_FOLDERS = [
  { key: 'unsorted', label: 'To sort', hint: 'New photos land here until you file them.' },
  { key: 'hero', label: 'Hero', single: true },
  { key: 'detail', label: 'Detail', single: true },
  { key: 'front', label: 'Front', single: true },
  { key: 'side', label: 'Side', single: true },
  { key: 'back', label: 'Back', single: true },
  { key: 'hair', label: 'Hair', single: true },
  { key: 'nails', label: 'Nails', single: true },
  { key: 'eyes', label: 'Eyes', single: true },
  { key: 'lips', label: 'Lips', single: true },
  { key: 'skin', label: 'Skin', single: true },
  { key: 'venue', label: 'Venue' },
  { key: 'inspo', label: 'Inspiration', max: 2 },
];

export const folderLabel = (key) => STYLE_FOLDERS.find((f) => f.key === key)?.label || key;

/** Her own photos in one folder (scene-set venue images are not files). */
export const filesIn = (lookbook, key) => (lookbook?.images?.[key] || []).filter((i) => i.source === 'upload');

/** Every photo in Style photos, folder by folder. */
export const allStyleFiles = (lookbook) => STYLE_FOLDERS.flatMap((f) => filesIn(lookbook, f.key).map((i) => ({ ...i, folder: f.key })));
