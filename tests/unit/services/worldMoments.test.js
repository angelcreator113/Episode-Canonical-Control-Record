/**
 * Scheduled world moments (services/worldMoments): the calendar turns into
 * the moments due in a window, the same every time, with what was drafted
 * marked; the automatic run and its scheduler do nothing unless the server
 * flag is on.
 */
const moments = require('../../../src/services/worldMoments');

const stages = { fashion: ['Underground', 'Rising', 'Mainstream', 'Saturation', 'Replacement'], beauty: ['Salon Discovery', 'Creator Demonstration', 'Product Launch', 'Viral Adoption'] };
const awards = [{ name: 'Starlight Awards', month: 'November', desc: 'The main event.' }];
// Monday 2026-10-19 to Sunday 2026-10-25
const from = new Date('2026-10-19T09:00:00Z');

describe('worldMoments.planFromCalendar', () => {
  test('a week of the default calendar: each city event on its day, the press on theirs, a trend per city', () => {
    const plan = moments.planFromCalendar({}, { from, days: 7, awardShows: awards, trendStages: stages });
    expect(plan.from).toBe('2026-10-19');
    expect(plan.to).toBe('2026-10-25');
    const runway = plan.moments.filter((m) => m.key.startsWith('city_event:dazzle_district:runway_thursday'));
    expect(runway.map((m) => m.date)).toEqual(['2026-10-22']);
    expect(runway[0].label).toBe('Runway Thursday · Dazzle District');
    const press = plan.moments.filter((m) => m.kind === 'press');
    expect(press.map((m) => `${m.press}@${m.date}`).sort()).toEqual([
      'asha_brennan@2026-10-25', 'reyna_voss@2026-10-19', 'solene_beaumont@2026-10-23', 'taye_okafor@2026-10-21',
    ]);
    expect(press.find((m) => m.press === 'solene_beaumont').beats).toEqual(['fashion', 'beauty']);
    const trends = plan.moments.filter((m) => m.kind === 'trend');
    expect(trends).toHaveLength(5);
    expect(trends.every((m) => m.date === '2026-10-20')).toBe(true);
    expect(trends.find((m) => m.city === 'radiance_row').lane).toBe('beauty');
    // Monthly: Lab Launch Night is the first Wednesday; 2026-10-21 is the third.
    expect(plan.moments.some((m) => m.key.includes('lab_launch_night'))).toBe(false);
    expect(plan.moments.some((m) => m.kind === 'award_show')).toBe(false);
  });

  test('the same calendar always gives the same plan, in date order', () => {
    const a = moments.planFromCalendar({}, { from, days: 14, awardShows: awards, trendStages: stages });
    const b = moments.planFromCalendar({}, { from: new Date('2026-10-19T23:59:00Z'), days: 14, awardShows: awards, trendStages: stages });
    expect(a.moments.map((m) => m.key)).toEqual(b.moments.map((m) => m.key));
    const dates = a.moments.map((m) => m.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(a.moments.map((m) => m.key)).size).toBe(a.moments.length);
  });

  test('a trend moves one stage a week and keeps its cycle', () => {
    const plan = moments.planFromCalendar({}, { from, days: 21, trendStages: stages });
    const dazzle = plan.moments.filter((m) => m.kind === 'trend' && m.city === 'dazzle_district');
    expect(dazzle).toHaveLength(3);
    const nos = dazzle.map((m) => m.stage_no);
    for (let i = 1; i < nos.length; i += 1) expect(nos[i]).toBe(nos[i - 1] === 5 ? 1 : nos[i - 1] + 1);
    expect(dazzle[0].stage).toBe(stages.fashion[nos[0] - 1]);
  });

  test('a monthly event falls on its week of the month; an award show on the first Saturday of its month', () => {
    const plan = moments.planFromCalendar({}, { from: new Date('2026-11-01T00:00:00Z'), days: 30, awardShows: awards, trendStages: stages });
    expect(plan.moments.filter((m) => m.key.includes('lab_launch_night')).map((m) => m.date)).toEqual(['2026-11-04']);
    expect(plan.moments.filter((m) => m.kind === 'award_show').map((m) => [m.label, m.date])).toEqual([['Starlight Awards', '2026-11-07']]);
  });

  test('a drafted moment stays in the plan, marked; switched-off kinds are left out', () => {
    const key = 'city_event:dazzle_district:runway_thursday:2026-10-22';
    const plan = moments.planFromCalendar(
      { trends: { on: false }, press: { reyna_voss: { on: false } }, cities: { echo_park: [] } },
      { from, days: 7, trendStages: stages, drafted: [{ key, status: 'drafted' }] },
    );
    expect(plan.moments.find((m) => m.key === key).drafted).toEqual({ key, status: 'drafted' });
    expect(plan.moments.some((m) => m.kind === 'trend')).toBe(false);
    expect(plan.moments.some((m) => m.press === 'reyna_voss')).toBe(false);
    expect(plan.moments.some((m) => m.city === 'echo_park')).toBe(false);
  });

  test('a window is at least a day and at most a month', () => {
    expect(moments.planFromCalendar({}, { from, days: 0 }).to).toBe('2026-10-19');
    expect(moments.planFromCalendar({}, { from, days: 400 }).to).toBe('2026-11-18');
  });

  test('event categories map to the press beats', () => {
    expect(moments.beatOf('luxury_prestige')).toBe('fashion');
    expect(moments.beatOf('beauty_wellness')).toBe('beauty');
    expect(moments.beatOf('arts_entertainment')).toBe('lifestyle');
    expect(moments.beatsOf('asha_brennan')).toEqual(['lifestyle']);
  });
});

describe('worldMoments: the automatic run is off unless the server says so', () => {
  const saved = process.env.WORLD_MOMENTS_ENABLED;
  afterEach(() => {
    moments.stopScheduler();
    if (saved === undefined) delete process.env.WORLD_MOMENTS_ENABLED; else process.env.WORLD_MOMENTS_ENABLED = saved;
  });

  test('startScheduler starts nothing without WORLD_MOMENTS_ENABLED=true', () => {
    delete process.env.WORLD_MOMENTS_ENABLED;
    expect(moments.startScheduler({})).toBe(false);
    process.env.WORLD_MOMENTS_ENABLED = 'false';
    expect(moments.startScheduler({})).toBe(false);
  });

  test('tick and runScheduled do nothing without it, and read nothing', async () => {
    delete process.env.WORLD_MOMENTS_ENABLED;
    const db = { sequelize: { query: jest.fn() } };
    expect(await moments.tick(db)).toEqual([]);
    expect(await moments.runScheduled(db, 'show')).toEqual({ ran: false, why: 'WORLD_MOMENTS_ENABLED is off.' });
    expect(db.sequelize.query).not.toHaveBeenCalled();
  });
});
