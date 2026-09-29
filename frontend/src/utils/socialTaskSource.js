/**
 * Where a social or career task comes from, and whether it is required
 * (T1, docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292). Mirrors
 * src/utils/socialTaskSource.js.
 *
 * Only an accepted deliverable (an event_deliverables row, carried on the
 * task as deliverable_id) makes a task required. Generated tasks are Lala's
 * goals or optional ideas. A task stored before T1 has no task_source and
 * may say required: true with no deliverable behind it: it reads as a goal,
 * never as required.
 */

export const SOURCE_LABEL = {
  deliverable: 'Deliverable',
  goal: 'Goal',
  optional: 'Optional idea',
};

export function socialTaskSource(task) {
  if (task?.deliverable_id) return 'deliverable';
  if (task?.task_source === 'goal' || task?.task_source === 'optional') return task.task_source;
  return task?.required ? 'goal' : 'optional';
}

export function isSocialTaskRequired(task) {
  return Boolean(task?.deliverable_id) && task.required !== false;
}
