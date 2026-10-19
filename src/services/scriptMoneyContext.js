'use strict';

/**
 * Lala's money as the Script tab's writer needs it (Evoni, 2026-10-18: "the
 * script doesn't recognize the beginning balance and how it's deducted every
 * time a wardrobe item is chosen"; beat 9 reads the approved shopping list).
 * Read from the Money page's own lines (episodeMoneyService.getEpisodeMoney),
 * so the script and the Money page agree:
 *
 *   balanceBefore  Lala's balance before this episode: the ledger less this
 *                  episode's posted rows, as the Script tab's "True at Beat"
 *                  card reads it (frontend/src/lib/beatState.js);
 *   look           each piece of the look that costs her, { id, name, amount };
 *   recap          the event's other costs to her (drinks…), { label, amount };
 *   covered        costs the host or brand covers, { label };
 *   income         what she is owed (a content fee…), { label, amount }: not
 *                  paid in this episode;
 *   shopping       the event's approved shopping list, line by line, with the
 *                  piece that filled each line and its cost; null when the
 *                  list is not approved.
 *
 * Each read that fails leaves its part empty, logged; null when nothing at
 * all could be read.
 */

async function loadScriptMoney(sequelize, { showId, episodeId, event = null }) {
  const out = { balanceBefore: null, look: [], recap: [], covered: [], income: [], shopping: null };
  let read = false;
  try {
    const { getEpisodeMoney } = require('./episodeMoneyService');
    const money = showId && episodeId ? await getEpisodeMoney(sequelize, { showId, episodeId }) : null;
    if (money) {
      read = true;
      const balance = Number(money.balance);
      const net = Number(money.net) || 0;
      if (Number.isFinite(balance)) out.balanceBefore = Math.round(balance - net);
      for (const line of money.lines || []) {
        const amount = Math.round(Number(line.amount) || 0);
        if (line.look) {
          if (amount > 0) out.look.push({ id: line.source?.id != null ? String(line.source.id) : null, name: line.label, amount });
        } else if (line.covered || line.state === 'covered') {
          out.covered.push({ label: line.label });
        } else if (line.conditional) {
          continue;
        } else if (line.kind === 'income') {
          if (amount > 0) out.income.push({ label: line.label, amount });
        } else if (amount > 0) {
          out.recap.push({ label: line.label, amount });
        }
      }
    }
  } catch (err) {
    console.error('[ScriptMoney] money read failed (the script reads no coins):', err.message);
  }
  try {
    const { readDocuments } = require('./eventDocumentsService');
    const doc = event ? readDocuments(event).shopping_list : null;
    if (doc && doc.status === 'approved') {
      read = true;
      const { episodeLook } = require('./episodeLookCharges');
      const look = await episodeLook(sequelize, { episodeId, event, showId });
      const { shoppingLines } = require('./eventDocumentOverlayService');
      const { lines, total } = shoppingLines(doc, look?.pieces || []);
      out.shopping = {
        overlay: Boolean(doc.overlay?.url),
        total: Math.round(Number(total) || 0),
        lines: lines.map((l) => ({
          label: l.label,
          pieces: (l.pieces || (l.piece ? [l.piece] : [])).map((p) => p?.name).filter(Boolean),
          cost: Math.round(Number(l.cost) || 0),
          owned: l.owned === true,
          filled: l.filled === true,
          extra: l.extra === true,
        })),
      };
    }
  } catch (err) {
    console.error('[ScriptMoney] shopping list read failed (beat 9 reads the to-do list):', err.message);
  }
  return read ? out : null;
}

module.exports = { loadScriptMoney };
