'use strict';

/**
 * Required wardrobe slot coverage for a show (audit finding GATE-02,
 * 2026-10-03). "Wardrobe pieces uploaded" passed when any one piece existed
 * (five rows fetched, one enough), so a single shoe satisfied it and nothing
 * said which slot was missing. This says, per slot, how many pieces the
 * show has and which required slots have none.
 *
 * The required slots are Show.metadata.required_slots (PUT
 * /shows/:id/wardrobe-config), else the slot taxonomy's own defaults
 * (outfit and shoes; utils/wardrobeSlots). Inventory is what GET /wardrobe
 * lists for the show: its live rows plus show-less rows.
 *
 * Reads shows and wardrobe only.
 */

const { Op } = require('sequelize');
const { SLOT_KEYS, SLOT_DEFS, groupItemsBySlot } = require('../utils/wardrobeSlots');

/** The show's required slot keys, in slot order; unknown keys are ignored. */
function requiredSlotsFor(show) {
  const configured = show && show.metadata && Array.isArray(show.metadata.required_slots)
    ? show.metadata.required_slots.filter((k) => SLOT_KEYS.includes(k))
    : [];
  if (configured.length) return SLOT_KEYS.filter((k) => configured.includes(k));
  return SLOT_KEYS.filter((k) => SLOT_DEFS[k].required);
}

/** Pure: items ({ clothing_category }) against the required slot keys. */
function slotCoverage(items, requiredSlots) {
  const rows = Array.isArray(items) ? items : [];
  const bySlot = groupItemsBySlot(rows);
  const slots = SLOT_KEYS.map((key) => ({
    slot: key,
    label: SLOT_DEFS[key].label,
    icon: SLOT_DEFS[key].icon,
    required: requiredSlots.includes(key),
    count: bySlot[key].length,
  }));
  const missing = slots.filter((s) => s.required && s.count === 0).map((s) => s.slot);
  const covered = missing.length === 0;
  const names = (keys) => keys.map((k) => SLOT_DEFS[k].label.toLowerCase()).join(', ');
  let text;
  if (!rows.length) text = 'No wardrobe pieces uploaded';
  else if (covered) text = `Required slots covered: ${names(requiredSlots)}`;
  else text = `Missing required ${missing.length === 1 ? 'slot' : 'slots'}: ${names(missing)}`;
  return {
    required_slots: requiredSlots,
    slots,
    inventory: rows.length,
    unassigned: bySlot.__unassigned.length,
    covered,
    missing,
    text,
  };
}

/** The show's coverage, or null when the show does not exist. */
async function wardrobeSlotCoverage(models, showId) {
  const show = await models.Show.findByPk(showId, { attributes: ['id', 'metadata'] });
  if (!show) return null;
  const items = await models.Wardrobe.findAll({
    attributes: ['id', 'clothing_category'],
    where: { deleted_at: null, show_id: { [Op.or]: [showId, null] } },
    raw: true,
  });
  return { show_id: showId, ...slotCoverage(items, requiredSlotsFor(show)) };
}

module.exports = { requiredSlotsFor, slotCoverage, wardrobeSlotCoverage };
