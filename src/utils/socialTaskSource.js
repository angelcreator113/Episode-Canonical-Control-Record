'use strict';

/**
 * Where a social (or career) task comes from, and whether it is required
 * (T1, docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292).
 *
 * Only an accepted host or brand deliverable (an event_deliverables row) can
 * make a task required. Everything the generator writes is Lala's goal or an
 * optional idea, never required.
 *
 *   deliverable — built from an event_deliverables row; carries deliverable_id
 *   goal        — a generated task Lala means to do
 *   optional    — a generated idea she may skip
 *
 * Tasks stored before T1 carry no task_source and may carry required: true
 * with no deliverable behind them. They are read as a goal (required) or an
 * optional idea (not required), and never as required.
 */

const TASK_SOURCES = ['deliverable', 'goal', 'optional'];

// The template slots that used to invent brand obligations with no
// deliverable behind them ("Sponsored Post 1/2 (required)"). Dropped from
// newly generated lists; a stored episode keeps its copy, unrequired.
const RETIRED_SLOTS = new Set(['brand_post_1', 'brand_post_2']);

const DESCRIPTION_MAX = 160;

function socialTaskSource(task) {
  if (task?.deliverable_id) return 'deliverable';
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
    task_source: 'deliverable',
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

module.exports = {
  TASK_SOURCES,
  RETIRED_SLOTS,
  socialTaskSource,
  isSocialTaskRequired,
  deliverableTask,
  withDeliverableTasks,
};
