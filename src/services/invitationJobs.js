'use strict';

/**
 * invitationJobs — the invitation's slow work (Claude prose, one or more
 * image calls, compositing, S3) run off the request, with its progress
 * streamed to the page.
 *
 * Generate used to hold one HTTP request open for the whole pipeline, and a
 * batch of three ran three in a row inside it, long enough for nginx to cut
 * the connection while the work (and its cost) carried on unseen. Now the
 * route answers 202 with a job id at once; the page follows the job on
 * GET …/invitation-jobs/:jobId/stream (SSE, X-Accel-Buffering: no) or polls
 * GET …/invitation-jobs/:jobId.
 *
 * Jobs live in this process's memory only. A restart loses the job record,
 * not the work already saved: every finished version is its own asset row,
 * so the page re-reads the history when a stream ends without a result.
 * Finished jobs are kept JOB_TTL_MS for a late reader, then dropped.
 */

const { v4: uuidv4 } = require('uuid');

const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map(); // jobId -> job

function publicJob(job) {
  if (!job) return null;
  const { listeners, ...rest } = job; // eslint-disable-line no-unused-vars
  return rest;
}

function emit(job, event, data) {
  for (const fn of job.listeners) {
    try { fn(event, data); } catch (err) {
      console.error(`[InvitationJobs] listener for ${job.id} threw:`, err.message);
    }
  }
}

function sweep(now = Date.now()) {
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - Date.parse(job.finishedAt) > JOB_TTL_MS) jobs.delete(id);
  }
}

/**
 * Start `work(progress)` as a job and return it at once. `progress(step,
 * message, extra?)` records a step and tells the listeners; the job ends
 * 'done' with work's return value, or 'failed' with its error message and
 * status (a budget refusal keeps its 429).
 */
function startJob({ showId, eventId = null, kind }, work) {
  sweep();
  const job = {
    id: uuidv4(),
    showId: String(showId),
    eventId: eventId ? String(eventId) : null,
    kind,
    status: 'running',
    steps: [],
    result: null,
    error: null,
    errorStatus: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    listeners: new Set(),
  };
  jobs.set(job.id, job);

  const progress = (step, message, extra = {}) => {
    const entry = { step, message, at: new Date().toISOString(), ...extra };
    job.steps.push(entry);
    emit(job, 'progress', entry);
  };

  Promise.resolve()
    .then(() => work(progress))
    .then((result) => {
      job.status = 'done';
      job.result = result ?? null;
      job.finishedAt = new Date().toISOString();
      emit(job, 'done', publicJob(job));
    })
    .catch((err) => {
      console.error(`[InvitationJobs] ${kind} job ${job.id} failed:`, err.message);
      job.status = 'failed';
      job.error = err.message || 'Failed';
      job.errorStatus = err.status || err.statusCode || 500;
      job.finishedAt = new Date().toISOString();
      emit(job, 'failed', publicJob(job));
    });

  return publicJob(job);
}

/** The job in this show, or null (a job id from another show reads as missing). */
function getJob(showId, jobId) {
  const job = jobs.get(String(jobId));
  if (!job || job.showId !== String(showId)) return null;
  return job;
}

/**
 * Follow a job: `listener(event, data)` gets 'progress', then 'done' or
 * 'failed'. Returns the unsubscribe function.
 */
function subscribe(job, listener) {
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}

function _resetJobs() {
  jobs.clear();
}

module.exports = { startJob, getJob, subscribe, publicJob, JOB_TTL_MS, _resetJobs };
