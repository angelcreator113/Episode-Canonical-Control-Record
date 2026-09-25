/**
 * The events an episode was made from (Task #1906) — listEpisodeEvents,
 * behind GET /api/v1/episodes/:id/events.
 *
 * The anchor comes from EpisodeBrief.event_id; additional events come from
 * world_events.used_in_episode_id. Mocked models, no database.
 */

const { listEpisodeEvents } = require('../../../src/services/episodeEventsService');

function makeModels({ events = [], briefEventId = null, failIncludes = false } = {}) {
  const WorldEvent = {
    CURRENT_ATTRIBUTES: ['id', 'name', 'used_in_episode_id'],
    findAll: jest.fn(async ({ where, include }) => {
      if (failIncludes && include) throw new Error('association missing');
      const rows = events.filter((ev) => Object.entries(where).every(([k, v]) => ev[k] === v));
      return rows.map((row) => ({ toJSON: () => ({ ...row }) }));
    }),
  };
  const EpisodeBrief = {
    findOne: jest.fn(async ({ where }) => (briefEventId !== undefined && where.episode_id === 'ep-1' && briefEventId
      ? { id: 'brief-1', event_id: briefEventId }
      : null)),
  };
  return { WorldEvent, EpisodeBrief, Asset: {}, SceneSet: {} };
}

describe('listEpisodeEvents (Task #1906)', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('an episode whose event lacks the stamp still resolves its anchor from the brief', async () => {
    const models = makeModels({
      briefEventId: 'ev-anchor',
      events: [{ id: 'ev-anchor', name: 'Gala', used_in_episode_id: null }],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.anchor_event_id).toBe('ev-anchor');
    expect(out.anchor_source).toBe('brief');
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      id: 'ev-anchor',
      name: 'Gala',
      link: { anchor: true, anchor_source: 'brief', stamped: false, stamped_elsewhere: false },
    });
  });

  test('a multi-event episode lists every event, anchor first', async () => {
    const models = makeModels({
      briefEventId: 'ev-anchor',
      events: [
        { id: 'ev-extra-1', name: 'Brunch', used_in_episode_id: 'ep-1' },
        { id: 'ev-anchor', name: 'Gala', used_in_episode_id: 'ep-1' },
        { id: 'ev-extra-2', name: 'After-party', used_in_episode_id: 'ep-1' },
        { id: 'ev-other', name: 'Elsewhere', used_in_episode_id: 'ep-2' },
      ],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.events.map((ev) => ev.id)).toEqual(['ev-anchor', 'ev-extra-1', 'ev-extra-2']);
    expect(out.events[0].link).toEqual({ anchor: true, anchor_source: 'brief', stamped: true, stamped_elsewhere: false });
    expect(out.events[1].link).toEqual({ anchor: false, stamped: true, stamped_elsewhere: false });
  });

  test('brief and stamp disagree: the brief anchor is flagged, and the stamped event is listed too', async () => {
    const models = makeModels({
      briefEventId: 'ev-anchor',
      events: [
        { id: 'ev-anchor', name: 'Gala', used_in_episode_id: 'ep-2' },
        { id: 'ev-moved-in', name: 'Brunch', used_in_episode_id: 'ep-1' },
      ],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.events.map((ev) => ev.id)).toEqual(['ev-anchor', 'ev-moved-in']);
    expect(out.events[0].link).toMatchObject({ anchor: true, stamped: false, stamped_elsewhere: true });
  });

  test('no brief anchor (hand-made episode linked by inject): the first stamped event is the anchor', async () => {
    const models = makeModels({
      briefEventId: null,
      events: [{ id: 'ev-injected', name: 'Soiree', used_in_episode_id: 'ep-1' }],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.anchor_event_id).toBe('ev-injected');
    expect(out.anchor_source).toBe('stamp');
    expect(out.brief_event_id).toBeNull();
  });

  test('a brief naming an event that no longer resolves reports it and falls back to the stamp', async () => {
    const models = makeModels({
      briefEventId: 'ev-deleted',
      events: [{ id: 'ev-injected', name: 'Soiree', used_in_episode_id: 'ep-1' }],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.brief_event_id).toBe('ev-deleted');
    expect(out.anchor_event_id).toBe('ev-injected');
    expect(out.anchor_source).toBe('stamp');
  });

  test('no events at all: an empty list and no anchor', async () => {
    const out = await listEpisodeEvents(makeModels(), 'ep-1');
    expect(out).toEqual({ anchor_event_id: null, anchor_source: null, brief_event_id: null, events: [] });
  });

  test('a failing include is logged and the read retries without includes', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const models = makeModels({
      failIncludes: true,
      briefEventId: 'ev-anchor',
      events: [{ id: 'ev-anchor', name: 'Gala', used_in_episode_id: 'ep-1' }],
    });
    const out = await listEpisodeEvents(models, 'ep-1');
    expect(out.anchor_event_id).toBe('ev-anchor');
    expect(warn).toHaveBeenCalledWith('[EpisodeEvents] Event read with includes failed, retrying without:', 'association missing');
  });
});
