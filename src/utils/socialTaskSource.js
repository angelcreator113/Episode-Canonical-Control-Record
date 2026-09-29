'use strict';

/**
 * Where a social (or career) task comes from, and whether it is required
 * (T1, docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292).
 *
 * Only an accepted host or brand deliverable (an event_deliverables row) can
 * make a task required. Everything the generator writes is Lala's goal or an
 * optional idea, never required.
 *
 *   host_requirement  — an event_deliverables row owed to the host
 *   brand_deliverable — an event_deliverables row owed to a brand
 *   goal              — a generated task Lala means to do
 *   optional          — a generated idea she may skip
 *
 * T2 (§8(bb); Task #2294) splits T1's single "deliverable" source by the
 * row's owed_to. Every item of the episode's one task list carries one of
 * these four. A deliverable task stamped before T2 (task_source
 * 'deliverable', no owed_to) reads as a host requirement, owed_to's default.
 *
 * Tasks stored before T1 carry no task_source and may carry required: true
 * with no deliverable behind them. They are read as a goal (required) or an
 * optional idea (not required), and never as required.
 */

const TASK_SOURCES = ['host_requirement', 'brand_deliverable', 'goal', 'optional'];

// The template slots that used to invent brand obligations with no
// deliverable behind them ("Sponsored Post 1/2 (required)"). Dropped from
// newly generated lists; a stored episode keeps its copy, unrequired.
const RETIRED_SLOTS = new Set(['brand_post_1', 'brand_post_2']);

const DESCRIPTION_MAX = 160;

function socialTaskSource(task) {
  if (task?.deliverable_id) return task.owed_to === 'brand' ? 'brand_deliverable' : 'host_requirement';
  if (task?.task_source === 'goal' || task?.task_source === 'optional') return task.task_source;
  return task?.required ? 'goal' : 'optional';
}

function isSocialTaskRequired(task) {
  return Boolean(task?.deliverable_id) && task.required !== false;
}

/** One task per accepted deliverable row; required unless the row says not. */
function deliverableTask(d) {
  const description = String(d.description || '').trim();
  const detail = [d.deliverable_type, d.due_date ? `due ${d.due_date}` : null].filter(Boolean).join(' · ');
  return {
    slot: `deliverable_${d.id}`,
    label: description.length > DESCRIPTION_MAX ? `${description.slice(0, DESCRIPTION_MAX - 1)}…` : description,
    description: detail || 'Accepted deliverable',
    platform: d.deliverable_type || 'deliverable',
    timing: 'during',
    required: d.required !== false,
    completed: false,
    task_source: d.owed_to === 'brand' ? 'brand_deliverable' : 'host_requirement',
    owed_to: d.owed_to === 'brand' ? 'brand' : 'host',
    deliverable_id: d.id,
  };
}

/**
 * A generated list, made to follow T1: every generated task is unrequired
 * and labelled goal or optional; the retired Sponsored Post slots and any
 * stale deliverable tasks are dropped; one task per current deliverable row
 * is appended. Completion on a generated task is kept.
 */
function withDeliverableTasks(tasks, deliverables = []) {
  const generated = (Array.isArray(tasks) ? tasks : [])
    .filter((t) => t && !t.deliverable_id && !RETIRED_SLOTS.has(t.slot))
    .map((t) => ({ ...t, task_source: socialTaskSource(t), required: false }));
  const rows = (Array.isArray(deliverables) ? deliverables : [])
    .filter((d) => d && d.id && String(d.description || '').trim());
  return [...generated, ...rows.map(deliverableTask)];
}

/**
 * T2 (§8(bb); Task #2294): the Career Checklist adds its goals and ideas to
 * the episode's one task list instead of keeping a copy of its own. Its
 * items are marked generated_by: 'career'. A regenerate replaces the
 * previous career items and keeps everything else (deliverables, social
 * goals and ideas). A career item never becomes required, and one whose
 * slot carries over keeps its completion.
 */
function withCareerTasks(tasks, careerTasks = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  const previous = new Map(list.filter((t) => t?.generated_by === 'career').map((t) => [t.slot, t]));
  const kept = list.filter((t) => t && t.generated_by !== 'career');
  const taken = new Set(kept.map((t) => t.slot));
  const added = [];
  for (const [i, t] of (Array.isArray(careerTasks) ? careerTasks : []).entries()) {
    if (!t || t.deliverable_id) continue;
    let slot = String(t.slot || `career_${i + 1}`);
    if (!slot.startsWith('career_')) slot = `career_${slot}`;
    while (taken.has(slot)) slot = `${slot}_${i + 1}`;
    taken.add(slot);
    added.push({
      slot,
      label: t.label || 'Career task',
      description: t.description || '',
      timing: t.timing || 'during',
      platform: t.platform || null,
      required: false,
      task_source: socialTaskSource(t),
      generated_by: 'career',
      completed: Boolean(previous.get(slot)?.completed),
    });
  }
  return [...kept, ...added];
}

/**
 * T6 (§8(bb); Task #2306): a list kept as it stands, plus one task for each
 * required deliverable in the accepted terms that it lacks (matched by
 * deliverable_id). Nothing else is added, restored or changed.
 */
function withMissingRequiredDeliverables(tasks, deliverables = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  const onList = new Set(list.map((t) => t?.deliverable_id).filter(Boolean));
  const missing = (Array.isArray(deliverables) ? deliverables : [])
    .filter((d) => d && d.id && d.required !== false && String(d.description || '').trim() && !onList.has(d.id));
  return [...list, ...missing.map(deliverableTask)];
}

module.exports = {
  TASK_SOURCES,
  withMissingRequiredDeliverables,
  withCareerTasks,
  RETIRED_SLOTS,
  socialTaskSource,
  isSocialTaskRequired,
  deliverableTask,
  withDeliverableTasks,
};
