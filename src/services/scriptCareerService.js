'use strict';

/**
 * Lala's career in the episode script (Evoni, 2026-10-09: "in the script i
 * dont see career opportunities being mentioned"). The script writer's
 * prompt named the event, its prestige and its stakes, but not the deal
 * the event offers her, what she owes for it, or what she wants out of it.
 * This loads those three from the event (world_events deal columns,
 * event_deliverables, canon_consequences.automation.relationship_goals)
 * and renders them as one prompt block that pins each to the beats it
 * belongs in.
 */

const { componentsOf, DEAL_COMPONENT_LABELS } = require('../utils/dealComponents');
const { listEventDeliverables } = require('./eventTermsService');

const DEAL_COLUMNS = [
  'deal_type', 'deal_components', 'appearance_required', 'appearance_fee', 'partnership_base_fee',
  'performance_fee', 'gifted_value', 'bonus_terms', 'is_paid', 'payment_amount', 'host', 'host_brand', 'canon_consequences',
];

const parse = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) { console.error('[ScriptCareer] JSON column did not parse:', err.message); return fallback; }
};

/**
 * The event's deal, deliverables and goals. Null when there is no event;
 * each piece is empty when the event has none. Reads only.
 */
async function loadScriptCareer(sequelize, eventId) {
  if (!eventId) return null;
  const [rows] = await sequelize.query(
    `SELECT ${DEAL_COLUMNS.join(', ')} FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { eventId } }
  );
  const row = rows?.[0];
  if (!row) return null;
  const event = { ...row, deal_components: parse(row.deal_components, null), bonus_terms: parse(row.bonus_terms, null) };
  const automation = parse(row.canon_consequences, {})?.automation || {};
  const goals = (Array.isArray(automation.relationship_goals) ? automation.relationship_goals : [])
    .filter((g) => g && g.label)
    .map((g) => ({ label: String(g.label), description: g.description ? String(g.description) : null }));
  const deliverables = (await listEventDeliverables(sequelize, eventId)).map((d) => ({
    description: d.description,
    deliverable_type: d.deliverable_type || null,
    platform: d.platform || null,
    quantity: d.quantity || 1,
    due_date: d.due_date || null,
    required: d.required !== false,
    owed_to: d.owed_to || null,
    fee: d.fee || null,
    status: d.status || 'pending',
  }));
  return { deal: dealOf(event), deliverables, goals };
}

/** Who pays and what: the components ticked, each with its fee, and any bonus. */
function dealOf(event) {
  const components = componentsOf(event);
  const payer = event.host_brand || event.host || null;
  if (components === null) {
    // A legacy event: its one payment, if any.
    const amount = event.is_paid && event.payment_amount > 0 ? event.payment_amount : null;
    return amount ? { kind: 'legacy', payer, terms: [`Paid ${amount} coins`], bonus: null } : null;
  }
  if (!components.length) return { kind: 'self_funded', payer, terms: [], bonus: null };
  const fee = {
    paid_to_appear: event.appearance_fee,
    partnership_base: event.partnership_base_fee,
    performance_fee: event.performance_fee,
    gifted_items: event.gifted_value,
  };
  const terms = components.map((k) => {
    const n = fee[k];
    if (!(n > 0)) return DEAL_COMPONENT_LABELS[k];
    return `${DEAL_COMPONENT_LABELS[k]} (${k === 'gifted_items' ? 'worth ' : ''}${n} coins)`;
  });
  const bonus = event.bonus_terms && typeof event.bonus_terms === 'object'
    ? Object.entries(event.bonus_terms).filter(([, n]) => n > 0).map(([tier, n]) => `${tier.toUpperCase()} ${n} coins`)
    : [];
  return { kind: 'deal', payer, terms, bonus: bonus.length ? bonus : null };
}

function deliverableLine(d) {
  const what = [d.quantity > 1 ? `${d.quantity}x` : null, d.platform, d.deliverable_type ? d.deliverable_type.replace(/_/g, ' ') : null]
    .filter(Boolean).join(' ');
  const terms = [
    d.owed_to ? `owed to the ${d.owed_to}` : null,
    d.fee > 0 ? `${d.fee} coins` : null,
    d.due_date ? `due ${d.due_date}` : null,
    d.required ? null : 'optional',
    d.status && d.status !== 'pending' ? d.status : null,
  ].filter(Boolean).join(', ');
  return `- ${what ? `${what}: ` : ''}${d.description}${terms ? ` (${terms})` : ''}`;
}

/**
 * The prompt block: the deal, what she owes, what she wants, and where in
 * the 14 beats each one plays. Empty when the event offers nothing to say.
 */
function careerBlock(career) {
  if (!career) return '';
  const { deal, deliverables = [], goals = [] } = career;
  if (!deal && !deliverables.length && !goals.length) return '';

  const out = ["═══ LALA'S CAREER IN THIS EPISODE ═══"];
  if (deal?.kind === 'self_funded') {
    out.push('THE DEAL: nobody is paying her. Lala pays her own way in; this is an investment in her career, and she knows what it costs.');
  } else if (deal) {
    out.push(`THE DEAL: ${deal.payer || 'The host'} is offering Lala ${deal.terms.join(', ')}.`);
    if (deal.bonus) out.push(`  Bonus if she delivers: ${deal.bonus.join(', ')}.`);
  }
  if (deliverables.length) {
    out.push('WHAT SHE OWES:');
    out.push(...deliverables.map(deliverableLine));
  }
  if (goals.length) {
    out.push('WHAT SHE WANTS FROM THE EVENT:');
    out.push(...goals.map((g) => `- ${g.label}${g.description ? `: ${g.description}` : ''}`));
  }

  out.push('SCRIPT DIRECTIVE (career is the spine of this episode, not background):');
  if (deal && deal.kind !== 'self_funded') {
    out.push(`- Beats 4-6: the offer lands. Name ${deal.payer || 'who is paying'} and what they are paying; in Beat 6 Lala weighs it out loud against her coin balance and what it could open for her.`);
  } else if (deal) {
    out.push('- Beats 4-6: the invite lands. In Beat 6 Lala weighs what it will cost her against what it could open for her.');
  }
  if (goals.length) out.push(`- Beat 11: she works the room toward ${goals.length === 1 ? 'her goal' : 'her goals'} by name; at least one moment with the person each goal is about.`);
  if (deliverables.length) out.push('- Beat 12: she makes what she owes, on camera, naming the piece of content and who it is for. Beat 9 may remind her it is due.');
  if (deal?.bonus) out.push('- Beat 13: whether she earned the bonus, in coins.');
  out.push('- Beat 14: the hook comes from her career: a follow-up offer, a goal still open, or what this deal could lead to.');
  return out.join('\n');
}

module.exports = { loadScriptCareer, careerBlock, dealOf, DEAL_COLUMNS };
