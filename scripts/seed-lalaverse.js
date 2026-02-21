/**
 * seed-lalaverse.js
 * Run once: node seed-lalaverse.js
 *
 * Creates the LalaVerse universe record.
 * Safe to re-run — uses findOrCreate on slug.
 *
 * Place in: scripts/seed-lalaverse.js
 * Run from repo root: node scripts/seed-lalaverse.js
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/models');

async function seed() {
  try {
    await db.sequelize.authenticate();
    console.log('DB connected.');

    // ── Universe ─────────────────────────────────────────────────────────
    const [universe, created] = await db.Universe.findOrCreate({
      where: { slug: 'lalaverse' },
      defaults: {
        name: 'LalaVerse',
        slug: 'lalaverse',

        description: `LalaVerse is a narrative-driven creative universe exploring ambition, identity, beauty, consequence, and the invisible architecture of becoming.

At its heart is one central truth: Creation changes the creator.

What begins as imagination becomes identity. What begins as style becomes strategy. What begins as content becomes consequence.

In LalaVerse, characters rise through aesthetic mastery, social influence, reputation systems, and economic progression. Success is earned through alignment, consistency, and emotional resilience — not luck.

Through interactive shows, serialized novels, and evolving creative systems, LalaVerse follows the transformation of creators into architects of their own worlds.

"Grow with Lala — help her rise, and rise with her."

This universe blends fiction and real-world ambition, merging storytelling, fashion, economics, and personal evolution into one living ecosystem.`,

        core_themes: [
          'ambition',
          'identity',
          'beauty',
          'consequence',
          'becoming',
          'creation as transformation',
          'aesthetic as strategy',
          'reputation as currency',
        ],

        pnos_beliefs: `PNOS governs how story works in LalaVerse. These are not themes. These are laws.

1. IDENTITY IS BUILT THROUGH REPETITION
You do not become who you say you are. You become who you consistently show up as. Consistency compounds.

2. AESTHETIC IS STRATEGY
Beauty is not shallow. Presentation shapes perception. Perception shapes opportunity.

3. EVERY DECISION ECHOES
There are no neutral choices. Every action shifts: Reputation, Trust, Influence, Stress, Access. Nothing is wasted.

4. GROWTH REQUIRES EXPOSURE
To rise, you must be seen. Visibility invites opportunity. Visibility invites criticism. Both are necessary.

5. MONEY IS MOMENTUM
Coins are not greed. They are fuel. Access costs something. Ambition requires investment.

6. CREATION IS A MIRROR
The worlds you build reveal the parts of yourself you cannot yet articulate. Lala is not separate from JustAWoman. She is projection. Amplification. Possibility.

7. BECOMING IS NONLINEAR
Failure is not regression. Failure is refinement. There are no wasted attempts. Only iterations.`,

        world_rules: `These govern how the universe behaves across books, shows, and app. These are mechanical and narrative rules.

RULE 1: REPUTATION GATES OPPORTUNITY
High-prestige events require a reputation threshold, brand trust threshold, and previous proof of consistency. Access is earned.

RULE 2: STYLE MUST ALIGN WITH CONTEXT
Outfit choices are evaluated based on event tone, era aesthetic, and reputation tier. Wrong alignment creates narrative friction.

RULE 3: EMOTIONAL STATE AFFECTS OUTCOME
Stress, doubt, and confidence influence performance, brand perception, and dialogue tone. Internal state matters externally.

RULE 4: MONEY FLOWS THROUGH PARTICIPATION
Income comes from events, brand deals, deliverables, and influence milestones. Not from passive existence.

RULE 5: SYSTEMS REMEMBER
The world tracks past successes, past failures, past collaborations, and past public moments. History compounds.

RULE 6: ERAS SHIFT THE WORLD TONE
Each Era changes visual palette, wardrobe availability, event intensity, and emotional stakes. Eras are atmospheric shifts.

RULE 7: CREATION CHANGES REALITY
When JustAWoman builds Lala, the world begins bending. When Lala evolves, JustAWoman evolves. Their relationship is recursive. This is foundational canon.

THE FIRST LALA APPEARANCE (Book 1 Canon Moment)
Her first appearance should feel like a tonal rupture, a clarity moment, a creative ignition. Structure: JustAWoman struggling. Internal doubt. Then — a voice that is not doubt. A presence that is confident. The prose shifts. Readers know: this changes everything.`,

        narrative_economy: `Prime Coins are the universe's currency unit. They are fuel, not reward.
Dream Fund: accumulated savings toward a creative goal. Depletes on investment, grows on success.
Reputation Score: tracks consistency, public moments, brand alignment. Gates access to high-prestige opportunities.
Trust: relational currency with brands, collaborators, and audience. Built slowly, lost quickly.
Influence Milestones: threshold events that unlock new show arcs, brand tiers, and narrative chapters.
Stress: internal resource. High stress degrades performance and dialogue options. Managed through rest, wins, and alignment.`,
      },
    });

    if (created) {
      console.log(`✓ Universe created: ${universe.name} (${universe.id})`);
    } else {
      console.log(`→ Universe already exists: ${universe.name} (${universe.id})`);
    }

    // ── Book Series: Becoming Prime ───────────────────────────────────────
    const [series, seriesCreated] = await db.BookSeries.findOrCreate({
      where: { universe_id: universe.id, name: 'Becoming Prime' },
      defaults: {
        universe_id: universe.id,
        name: 'Becoming Prime',
        description: `The primary canon series of LalaVerse. Follows the transformation of JustAWoman into the architect of Lala and the world she builds around her. Told in emotional phases — each book defines an era before shows adapt it and the app gamifies it.`,
        order_index: 1,
      },
    });

    if (seriesCreated) {
      console.log(`✓ Series created: ${series.name} (${series.id})`);
    } else {
      console.log(`→ Series already exists: ${series.name} (${series.id})`);
    }

    console.log('\n--- IDs to copy into your app ---');
    console.log(`Universe ID:  ${universe.id}`);
    console.log(`Series ID:    ${series.id}`);
    console.log('\nNext: update your existing Book 1 record to set series_id =', series.id);
    console.log('      update your existing Show record to set universe_id =', universe.id);

    await db.sequelize.close();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
