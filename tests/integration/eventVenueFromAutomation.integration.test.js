/**
 * GET /world/:showId/events/:eventId resolves the venue's World Location
 * from the automation copy when the top-level venue_location_id is empty.
 *
 * Calendar-spawned events keep venue_location_id only in
 * canon_consequences.automation (eventAutomationService). The Event
 * Package's Place reads that copy (frontend resolveEventVenueAndDate), but
 * this lookup read only the top-level column, so the episode's Planning →
 * Location said "No venue" (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md claim d, fix-list item 11).
 *
 * Database: the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Event detail: venue from the automation copy', () => {
  const ids = { show: crypto.randomUUID(), location: crypto.randomUUID(), spawned: crypto.randomUUID(), plain: crypto.randomUUID() };
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-venue-auto', email: 'user@venue-auto.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show: ids.show, name: `Venue auto ${ids.show.slice(0, 8)}`, slug: `venue-auto-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at)
               VALUES (:location, 'Studio by Sable''s Studio', 'A loft studio on the Avenue.', NOW(), NOW())`, ids);
    // A calendar-spawned event: the venue only in the automation copy.
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, canon_consequences, created_at, updated_at)
               VALUES (:spawned, :show, 'Spawned Gala', 'invite', 'draft', :cc::jsonb, NOW(), NOW())`,
      { ...ids, cc: JSON.stringify({ automation: { venue_location_id: ids.location, venue_name: "Studio by Sable's Studio" } }) });
    // An event with no venue anywhere.
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:plain, :show, 'Plain Night', 'invite', 'draft', NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run(`DELETE FROM world_events WHERE id IN (:spawned, :plain)`, ids);
    await run(`DELETE FROM world_locations WHERE id = :location`, ids);
    await run(`DELETE FROM shows WHERE id = :show`, ids);
  });

  const get = (eventId) => request(app).get(`/api/v1/world/${ids.show}/events/${eventId}`).set('Authorization', `Bearer ${token}`);

  it("resolves the World Location from automation.venue_location_id", async () => {
    const res = await get(ids.spawned);
    expect(res.status).toBe(200);
    expect(res.body.event.venue_location_id).toBeNull();
    expect(res.body.venueLocation).toMatchObject({ id: ids.location, name: "Studio by Sable's Studio" });
  });

  it('an event with no venue in either home has no venue location', async () => {
    const res = await get(ids.plain);
    expect(res.status).toBe(200);
    expect(res.body.venueLocation).toBeNull();
  });
});
