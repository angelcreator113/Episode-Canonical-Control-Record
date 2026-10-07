/**
 * Upload your own angles (Evoni, 2026-10-07: "i also need to be able to
 * upload my own angles too"): several images at once, each its own angle,
 * named from its file. Pure: SceneSetsTab creates the angle, then uploads
 * the image to it.
 */

/** "front-door_v2.JPG" → "Front door v2". */
export function angleNameFromFile(fileName, index = 0) {
  const base = String(fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return `Uploaded angle ${index + 1}`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** The angle's label: its name in capitals with underscores, at most 50, not one the set already has. */
export function uniqueAngleLabel(name, taken = []) {
  const have = new Set((taken || []).map((l) => String(l || '').toUpperCase()));
  const stem = (String(name || 'UPLOAD').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'UPLOAD').slice(0, 44);
  if (!have.has(stem)) return stem;
  for (let n = 2; n < 1000; n += 1) {
    const label = `${stem}_${n}`;
    if (!have.has(label)) return label;
  }
  return `${stem}_${Date.now() % 100000}`;
}

/** The create-angle payloads for these files, in order, each label unique against the set and each other. */
export function uploadedAnglePayloads(files, existingLabels = []) {
  const taken = [...(existingLabels || [])];
  return Array.from(files || []).map((file, i) => {
    const angle_name = angleNameFromFile(file?.name, i);
    const angle_label = uniqueAngleLabel(angle_name, taken);
    taken.push(angle_label);
    return { angle_name, angle_label, angle_description: 'Uploaded image' };
  });
}
