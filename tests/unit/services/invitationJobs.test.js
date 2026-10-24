/**
 * invitationJobs (2026-10-24): the invitation's slow work runs off the
 * request; a job reports progress, then done or failed, to its listeners,
 * and is only visible within its own show.
 */
const { startJob, getJob, subscribe, publicJob, _resetJobs } = require('../../../src/services/invitationJobs');

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => _resetJobs());

describe('invitationJobs', () => {
  it('runs the work, streams progress, and ends done with the result', async () => {
    const events = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const job = startJob({ showId: 's1', eventId: 'e1', kind: 'generate' }, async (progress) => {
      await gate;
      progress('writing', 'Writing the invitation');
      return { versions: [{ assetId: 'a1' }] };
    });
    expect(job.status).toBe('running');
    subscribe(getJob('s1', job.id), (event, data) => events.push([event, data.step || data.status]));
    release();
    await flush();
    expect(events).toEqual([['progress', 'writing'], ['done', 'done']]);
    const done = publicJob(getJob('s1', job.id));
    expect(done.result).toEqual({ versions: [{ assetId: 'a1' }] });
    expect(done).not.toHaveProperty('listeners');
  });

  it('ends failed with the error\'s message and status (a budget refusal keeps its 429)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const job = startJob({ showId: 's1', kind: 'batch' }, async () => {
      throw Object.assign(new Error('Daily budget reached'), { status: 429 });
    });
    await flush();
    err.mockRestore();
    expect(getJob('s1', job.id)).toMatchObject({ status: 'failed', error: 'Daily budget reached', errorStatus: 429 });
  });

  it('a job id from another show reads as missing', () => {
    const job = startJob({ showId: 's1', kind: 'generate' }, async () => null);
    expect(getJob('s2', job.id)).toBeNull();
    expect(getJob('s1', job.id)).toBeTruthy();
  });
});
