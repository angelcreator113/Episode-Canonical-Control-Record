/**
 * Lala's career in the script (Evoni, 2026-10-09: "in the script i dont
 * see career opportunities being mentioned"): the script writer reads the
 * event's deal, what she owes for it and her goals there, and pins each to
 * its beats. The event is the brief's even before Start Episode stamps it.
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

(shouldSkip ? describe.skip : describe)("the script writer reads Lala's career", () => {
  const ids = { show: uuid(), ep: uuid(), bare: uuid(), event: uuid(), plain: uuid(), brief: uuid(), bareBrief: uuid(), reel: uuid(), story: uuid(), gone: uuid() };
  const tag = ids.show.slice(0, 8);

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Career ${tag}`, slug: `career-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                 (:ep, :show, 'Career episode', 1, 'draft', NOW(), NOW()),
                 (:bare, :show, 'Plain episode', 2, 'draft', NOW(), NOW())`, ids);
    const automation = { relationship_goals: [{ slot: 1, label: 'Get Maison Rue to book her again', description: 'Sable decides the next campaign' }] };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, deal_components, appearance_fee, gifted_value, bonus_terms, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'brand_deal', 'Sable', 'Maison Rue', '["paid_to_appear","paid_for_content","gifted_items"]'::jsonb,
                       400, 150, '{"slay":200}'::jsonb, :cc::jsonb, NOW(), NOW())`,
      { ...ids, cc: JSON.stringify({ automation }) });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, created_at, updated_at) VALUES (:plain, :show, 'Open mic', 'social', NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_briefs (id, episode_id, event_id, created_at, updated_at) VALUES
                 (:brief, :ep, :event, NOW(), NOW()), (:bareBrief, :bare, :plain, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, platform, quantity, due_date, owed_to, fee, created_at, updated_at) VALUES
                 (:reel, :event, 'A get-ready-with-me reel in the Maison Rue dress', 'reel', 'instagram', 1, 'Day 3', 'brand', 300, NOW(), NOW()),
                 (:story, :event, 'Tag the brand in a story set', 'story', 'instagram', 3, NULL, 'brand', NULL, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, created_at, updated_at, deleted_at) VALUES (:gone, :event, 'A removed deliverable', NOW(), NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM event_deliverables WHERE event_id = :event', ids);
    await run('DELETE FROM episode_briefs WHERE id IN (:brief, :bareBrief)', ids);
    await run('DELETE FROM world_events WHERE id IN (:event, :plain)', ids);
    await run('DELETE FROM episodes WHERE id IN (:ep, :bare)', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it("reads the brief's event, its deal, deliverables and goals, and pins them to beats in the prompt", async () => {
    const context = await loadScriptContext(ids.ep, ids.show, models);
    expect(context.event?.id).toBe(ids.event);
    expect(context.career.deal).toEqual({
      kind: 'deal', payer: 'Maison Rue',
      terms: ['Paid to appear (400 coins)', 'Paid for content', 'Gifted items (worth 150 coins)'],
      bonus: ['SLAY 200 coins'],
    });
    expect(context.career.deliverables.map((d) => d.description).sort()).toEqual([
      'A get-ready-with-me reel in the Maison Rue dress', 'Tag the brand in a story set',
    ]);
    expect(context.career.goals).toEqual([{ label: 'Get Maison Rue to book her again', description: 'Sable decides the next campaign' }]);

    const prompt = buildFullPrompt(context);
    expect(prompt).toContain("═══ LALA'S CAREER IN THIS EPISODE ═══");
    expect(prompt).toContain('THE DEAL: Maison Rue is offering Lala Paid to appear (400 coins), Paid for content, Gifted items (worth 150 coins).');
    expect(prompt).toContain('- instagram reel: A get-ready-with-me reel in the Maison Rue dress (owed to the brand, 300 coins, due Day 3)');
    expect(prompt).toContain('- 3x instagram story: Tag the brand in a story set (owed to the brand)');
    expect(prompt).toContain('- Get Maison Rue to book her again: Sable decides the next campaign');
    expect(prompt).toContain('- Beat 12: she makes what she owes');
    expect(prompt).toContain('- Beat 13: whether she earned the bonus');
    expect(prompt).toContain("11. Lala's career is on the page");
    expect(prompt).not.toContain('A removed deliverable');
  });

  it('an event with no deal, deliverables or goals adds no career block', async () => {
    const context = await loadScriptContext(ids.bare, ids.show, models);
    expect(context.event?.id).toBe(ids.plain);
    expect(context.career).toEqual({ deal: null, deliverables: [], goals: [] });
    const prompt = buildFullPrompt(context);
    expect(prompt).not.toContain("LALA'S CAREER");
    expect(prompt).not.toContain("11. Lala's career");
  });
});
