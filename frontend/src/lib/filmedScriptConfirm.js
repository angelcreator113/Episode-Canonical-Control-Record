// A filmed episode's script (Evoni, 2026-11-12). The server refuses a
// person's edit of one with 409 FILMED_SCRIPT_CONFIRMATION_REQUIRED until the
// request carries confirm_filmed_edit: that episode's id. The page asks once,
// remembers the answer only in the `confirmed` set the caller holds (a ref:
// gone when the page closes, reloads or the tab unmounts), and sends the
// episode's own id, so one episode's answer never covers another. Nothing is
// stored, here or on the server.

export const FILMED_CONFIRM_CODE = 'FILMED_SCRIPT_CONFIRMATION_REQUIRED';
export const FILMED_PROTECTED_CODE = 'FILMED_SCRIPT_PROTECTED';

export const FILMED_CONFIRM_QUESTION = 'This episode has been filmed. Changing its script will not change the footage you recorded.\n\nSave this edit to the script?';
export const FILMED_DECLINED_NOTE = 'Not saved. The filmed script is unchanged, and your text is still on the page.';

/** What a save sends for this episode: its confirmation, once given in this sitting. */
export const filmedConfirmBody = (confirmed, episodeId) => (
  confirmed && confirmed.has(String(episodeId)) ? { confirm_filmed_edit: String(episodeId) } : {}
);

const asksFor = (err, episodeId) => {
  const d = err?.response?.data;
  return err?.response?.status === 409 && d?.code === FILMED_CONFIRM_CODE && String(d.episode_id) === String(episodeId);
};

/**
 * Runs send(extraBody). When the server asks for this episode's confirmation,
 * asks the person (once per `confirmed` set), then sends again, once. A "no"
 * rejects with the server's error marked filmedDeclined; nothing was saved.
 */
export async function withFilmedConfirm(confirmed, episodeId, send, ask = (q) => window.confirm(q)) {
  try {
    return await send(filmedConfirmBody(confirmed, episodeId));
  } catch (err) {
    if (!asksFor(err, episodeId) || confirmed.has(String(episodeId))) throw err;
    if (!ask(FILMED_CONFIRM_QUESTION)) { err.filmedDeclined = true; throw err; }
    confirmed.add(String(episodeId));
    return send(filmedConfirmBody(confirmed, episodeId));
  }
}
