/**
 * Production → Overlays as Evoni's Episode mock draws it (2026-10-06): a
 * preview with "Add an overlay", then "Overlays by beat", each row a beat,
 * its kind, what it shows, and Edit or Add; rows still needed are dashed.
 *
 * The pieces are GET /episodes/:id/overlays (episodeOverlaysService): the
 * title overlay, the framed card, the invitation and the task-list overlay
 * (the wardrobe shopping list), each approved, outdated or not made, placed
 * on a beat or with the beat it goes on. The show-wide overlays are the
 * Phone Hub's, read-only here.
 */

const KIND = {
  title_overlay: 'Title',
  framed_card: 'Title card',
  invitation: 'Document',
  task_list: 'Document',
};

// What each piece shows, in the mock's words.
const TEXT = {
  title_overlay: 'The episode title',
  framed_card: 'Full-screen framed title card',
  invitation: 'Invitation, full screen',
  task_list: 'Shopping list',
};

/** The beat a piece is on, or goes on: { number, name, placed }, or null. */
export function pieceBeat(piece) {
  if (piece?.beat?.number) return { number: piece.beat.number, name: piece.beat.name || null, placed: true };
  if (piece?.expected_beat?.number) return { number: piece.expected_beat.number, name: piece.expected_beat.name || null, placed: false };
  return null;
}

/** A piece is still needed until it is approved (not made, or outdated). */
export function pieceNeeded(piece) {
  return piece?.status !== 'approved';
}

/**
 * The rows of "Overlays by beat": the episode's pieces, then the show-wide
 * overlays that are placed on a beat, by beat (unplaced last, in the
 * pieces' order).
 */
export function overlayRows(pieces = [], showWide = []) {
  const rows = (pieces || []).filter(Boolean).map((p, i) => {
    const beat = pieceBeat(p);
    const needed = pieceNeeded(p);
    const note = p.status === 'outdated' ? ' (outdated)' : p.status === 'not_made' ? ' (not made yet)' : '';
    return {
      key: p.key,
      order: i,
      beat,
      kind: KIND[p.key] || 'Overlay',
      text: `${TEXT[p.key] || p.label}${note}`,
      needed,
      action: p.status === 'approved' ? 'Edit' : p.status === 'outdated' ? 'Update' : 'Add',
      showWide: false,
    };
  });
  (showWide || []).forEach((o, i) => {
    const n = typeof o?.beat === 'object' ? o?.beat?.number : o?.beat;
    if (!n) return;
    rows.push({
      key: `show-${o.asset_id || o.id}`,
      order: 100 + i,
      beat: { number: Number(n), name: null, placed: true },
      kind: 'Phone Hub',
      text: o.name || o.id,
      needed: false,
      action: 'Edit',
      showWide: true,
    });
  });
  return rows.sort((a, b) => {
    const an = a.beat?.number ?? Infinity;
    const bn = b.beat?.number ?? Infinity;
    return an - bn || a.order - b.order;
  });
}

/** "Beat 5", "Beat 5 · not placed yet", or "Not on a beat". */
export function beatLabel(beat) {
  if (!beat) return 'Not on a beat';
  return beat.placed ? `Beat ${beat.number}` : `Beat ${beat.number} · not placed yet`;
}

/** The piece the preview shows: the chosen one, else the first with an image. */
export function previewPiece(pieces = [], chosenKey = null) {
  const list = (pieces || []).filter(Boolean);
  return list.find((p) => p.key === chosenKey && p.image_url)
    || list.find((p) => p.image_url)
    || null;
}
