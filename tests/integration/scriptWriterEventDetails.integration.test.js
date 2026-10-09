/**
 * What the script writer was missing (Evoni, 2026-10-09: "is the script
 * missing any other important information"): the event's own details
 * (what it is, where and when, its look and feel, how strict, what she
 * needs to get in, what she may not do), the invitation's words for Beat
 * 5, and each guest's tie to Lala. The old Opportunity pipeline is gone.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the script writer reads the event in full', () => {
  const ids = { show: uuid(), ep: uuid(), event: uuid(), brief: uuid() };
  const tag = ids.show.slice(0, 8);
  let rivalId;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Event details ${tag}`, slug: `event-details-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Event details episode', 1, 'draft', NOW(), NOW())`, ids);
    const [[rival]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, lala_relationship, created_at, updated_at)
               VALUES (:handle, 'instagram', 'Always one step ahead', 'Jade Okafor', 'competitive', NOW(), NOW()) RETURNING id`,
      { handle: `jade-${tag}` });
    rivalId = rival.id;
    const cc = {
      invitation_text: { opening: 'You are invited to', eventName: 'The Atelier Night', body: 'An evening of first looks', closing: 'Come as the future.' },
      automation: { guest_profiles: [{ profile_id: rivalId }] },
    };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, description, venue_name, venue_address, event_date, event_time,
                 theme, mood, color_palette, strictness, deadline_type, deadline_minutes, requirements, restrictions, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'The Atelier Night', 'fashion_event', 'A private showing of the spring line', 'Atelier Rue', '12 Radiance Row',
                 'Friday', '9:00 PM', 'Garden noir', 'hushed', '["ivory","black"]'::jsonb, 8, 'tonight', 45,
                 '{"reputation_min":5}'::jsonb, :restrictions::jsonb, :cc::jsonb, NOW(), NOW())`,
      { ...ids, cc: JSON.stringify(cc), restrictions: JSON.stringify([{ type: 'exclusivity', description: 'No other fashion house content for 30 days' }]) });
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES (:brief, :ep, :event, NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM episode_briefs WHERE id = :brief', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM social_profiles WHERE id = :id', { id: rivalId });
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it("names the event's details, the invitation's words and the guest's tie to Lala; no old career pipeline", async () => {
    const context = await loadScriptContext(ids.ep, ids.show, models);
    expect(context.opportunities).toBeUndefined();
    const prompt = buildFullPrompt(context);
    expect(prompt).toContain('  What it is: A private showing of the spring line');
    expect(prompt).toContain('  Where: Atelier Rue, 12 Radiance Row');
    expect(prompt).toContain('  When: Friday, 9:00 PM');
    expect(prompt).toContain('  Look and feel: theme Garden noir | mood hushed | palette ivory, black');
    expect(prompt).toContain('  Strictness: 8/10 (they will notice a wrong look)');
    expect(prompt).toContain('  Time pressure: tonight (45-minute deadline)');
    expect(prompt).toContain('  To get in she needs: reputation 5+');
    expect(prompt).toContain('  Restrictions she agreed to: No other fashion house content for 30 days');
    expect(prompt).toContain('THE INVITATION (the words on screen at Beat 5; Lala reads from it, never contradicts it): "You are invited to / The Atelier Night / An evening of first looks / Come as the future."');
    expect(prompt).toContain("  With Lala: Lala's rival; every exchange is a contest");
    expect(prompt).not.toContain('ACTIVE CAREER PIPELINE');
  });
});
