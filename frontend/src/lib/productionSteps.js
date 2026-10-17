/**
 * Production's step bar (Evoni's Production mock, 2026-10-17): the seven
 * steps an episode goes through, each done or not from what the page
 * already reads, and where each one is worked on. Pure; the header
 * (EpisodeProductionHeader) reads it.
 *
 *   1 Event & Brief   the checklist's brief and event sections      → Overview
 *   2 Script          a script written, or the status past Draft     → Script
 *   3 Scenes          the checklist's scene section                  → Production › Scenes
 *   4 Files           at least one raw clip uploaded                 → Production › Files
 *   5 Edit & Assemble every scene has a clip linked to it            → the timeline editor
 *   6 Thumbnail       the episode has a primary thumbnail            → Templates › YouTube thumbnails
 *   7 Review & Publish status In review, Scheduled or Published      → Results › Distribution
 */

export const SCENE_COUNT = 14;

const PAST_DRAFT = ['scripted', 'in_build', 'in_review', 'scheduled', 'published'];
const READY = ['in_review', 'scheduled', 'published'];

/** True when every required item of a checklist section is checked (every item, if none is required). */
export function sectionDone(sections, checks, id) {
  const section = (sections || []).find((s) => s.id === id);
  if (!section || !checks) return false;
  const items = section.items || [];
  const required = items.filter((i) => i.required);
  return (required.length ? required : items).every((i) => checks[i.id]);
}

/** The scenes (beat numbers) with at least one clip linked. */
export function linkedScenes(clips) {
  return new Set((clips || []).map((c) => Number(c.beat_number)).filter((n) => n >= 1 && n <= SCENE_COUNT));
}

/**
 * The seven steps: { key, label, done, detail, open } where open is
 * { tab } or { href }. The current step is the first one not done.
 */
export function productionSteps({ episode = {}, checks = null, sections = null, clips = [], hasThumbnail = false } = {}) {
  const status = String(episode.status || 'draft').toLowerCase();
  const linked = linkedScenes(clips).size;
  const id = episode.id;
  const steps = [
    { key: 'brief', label: 'Event & Brief', done: sectionDone(sections, checks, 'brief') && sectionDone(sections, checks, 'world'), open: { tab: 'overview' } },
    { key: 'script', label: 'Script', done: Boolean(String(episode.script_content || '').trim()) || PAST_DRAFT.includes(status), open: { tab: 'scripts' } },
    { key: 'scenes', label: 'Scenes', done: sectionDone(sections, checks, 'scene'), open: { tab: 'scenes' } },
    { key: 'files', label: 'Files', done: (clips || []).length > 0, detail: (clips || []).length ? `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}` : null, open: { tab: 'files' } },
    { key: 'edit', label: 'Edit & Assemble', done: linked >= SCENE_COUNT, detail: linked ? `${linked} of ${SCENE_COUNT} scenes have a clip` : null, open: { href: `/episodes/${id}/timeline` } },
    { key: 'thumbnail', label: 'Thumbnail', done: Boolean(hasThumbnail), open: { href: `/template-studio/youtube?episode=${id}` } },
    { key: 'publish', label: 'Review & Publish', done: READY.includes(status), open: { tab: 'distribution' } },
  ];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, number: i + 1, current: i === current }));
}

/** The checklist's sections as { id, label, done, count, total } for the summary card. */
export function sectionSummary(sections, checks) {
  return (sections || []).map((s) => {
    const items = s.items || [];
    const count = checks ? items.filter((i) => checks[i.id]).length : 0;
    return { id: s.id, label: s.label, done: sectionDone(sections, checks, s.id), count, total: items.length };
  });
}

/** Whether Mark Ready applies: the episode is not yet In review or later. */
export const canMarkReady = (episode) => !READY.includes(String(episode?.status || 'draft').toLowerCase());
