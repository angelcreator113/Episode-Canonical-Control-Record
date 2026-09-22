// POST /world/:showId/events/from-profile passed the calendar-event shape
// into eventAutomationService.findVenue but silently dropped the host
// (SocialProfile) argument, so venue selection there was always
// host-agnostic — the chosen host never reached findVenue at all. Distinct
// hosts calling this endpoint could land on the same venue purely by
// category collision (e.g. "The Underground", the only seeded bar venue).
//
// worldEvents.js is a large Express router with many transitive
// dependencies (models, AI clients, S3, etc.); mounting the full app to
// exercise this one handler pulls in far more than this regression needs.
// Following the convention in worldEvents-attributes-scoped.test.js, this
// asserts the call-site shape directly against source.
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

const WORLD_EVENTS_SRC = read('src', 'routes', 'worldEvents.js');

describe('worldEvents.js — POST /world/:showId/events/from-profile passes the chosen host into findVenue', () => {
  const routeBlock = WORLD_EVENTS_SRC.match(
    /router\.post\('\/world\/:showId\/events\/from-profile'[\s\S]*?\n\}\);/
  );

  test('the route handler exists', () => {
    expect(routeBlock).not.toBeNull();
  });

  test('the profile lookup selects city and frequent_venues', () => {
    const block = routeBlock[0].match(/SocialProfile\.findByPk\(profile_id, \{[\s\S]*?\}\);/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/attributes:\s*\[[^\]]*'city'/);
    expect(block[0]).toMatch(/attributes:\s*\[[^\]]*'frequent_venues'/);
  });

  test('findVenue is called with the profile as its third argument', () => {
    expect(routeBlock[0]).toMatch(
      /eventAutomation\.findVenue\(fakeCalEvent,\s*models,\s*profile\)/
    );
  });
});
