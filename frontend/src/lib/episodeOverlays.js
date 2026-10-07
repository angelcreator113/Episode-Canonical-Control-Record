/**
 * Production → Overlays as Evoni's Episode mock draws it (2026-10-06): a
 * preview with "Add an overlay", then the episode's overlays, each row its
 * kind, what it shows, and Edit or Add; rows still needed are dashed. Kept
 * off beats for now (Evoni, 2026-10-07), so the rows carry no beat.
 *
 * The pieces are GET /episodes/:id/overlays (episodeOverlaysService): the
 * title overlay, the framed card, the invitation and the event's shopping
 * list and career plan (drawn when approved, Evoni
 * 2026-10-07), each approved, outdated or not made.
 */

const KIND = {
  title_overlay: 'Title',
  framed_card: 'Title card',
  invitation: 'Document',
  shopping_list_doc: 'Document',
  career_plan_doc: 'Document',
};

// What each piece shows, in the mock's words.
const TEXT = {
  title_overlay: 'The episode title',
  framed_card: 'Full-screen framed title card',
  invitation: 'Invitation, full screen',
  shopping_list_doc: 'Shopping list',
  career_plan_doc: 'Career plan',
};

/** The pieces drawn from the event's documents (made in In-world documents). */
export const DOCUMENT_KEYS = Object.freeze(['invitation', 'shopping_list_doc', 'career_plan_doc']);

/** A piece is still needed until it is approved (not made, or outdated). */
export function pieceNeeded(piece) {
  return piece?.status !== 'approved';
}

/**
 * The rows of "The episode's overlays": one per piece, in the pieces'
 * order, with its kind, what it shows and its action. No beats (Evoni,
 * 2026-10-07: "none of the overlays should be beats for now").
 */
export function overlayRows(pieces = []) {
  return (pieces || []).filter(Boolean).map((p) => {
    const note = p.status === 'outdated' ? ' (outdated)' : p.status === 'not_made' ? ' (not made yet)' : '';
    return {
      key: p.key,
      kind: KIND[p.key] || 'Overlay',
      text: `${TEXT[p.key] || p.label}${note}`,
      needed: pieceNeeded(p),
      action: p.status === 'approved' ? 'Edit' : p.status === 'outdated' ? 'Update' : 'Add',
    };
  });
}

/** The piece the preview shows: the chosen one, else the first with an image. */
export function previewPiece(pieces = [], chosenKey = null) {
  const list = (pieces || []).filter(Boolean);
  return list.find((p) => p.key === chosenKey && p.image_url)
    || list.find((p) => p.image_url)
    || null;
}
