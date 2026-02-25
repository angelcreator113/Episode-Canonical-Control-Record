/**
 * seed-lala-book-structure.js
 *
 * Seeds the "Styling Adventures with Lala" book with 3 Acts, 12 chapters,
 * and structured sections for each chapter.
 *
 * Usage:
 *   node scripts/seed-lala-book-structure.js
 *
 * The script finds the first StorytellerBook titled "Styling Adventures with Lala"
 * (or creates one if it doesn't exist) and populates it with chapters + sections.
 */

const { Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/episode_db';

const sequelize = new Sequelize(DATABASE_URL, {
  logging: false,
  dialectOptions: DATABASE_URL.includes('amazonaws.com') ? { ssl: { rejectUnauthorized: false } } : {},
});

function uuid() { return uuidv4(); }

/* ── Act 1: Before Lala (Chapters 1-4) ── */
const ACT_1 = [
  {
    chapter_number: 1,
    title: 'Before Lala',
    badge: 'Act I',
    scene_goal: 'Establish the protagonist\'s life before the Lala persona. Who was she? What did she wear? What did style mean to her?',
    theme: 'Origin / Identity Before Transformation',
    emotional_state_start: 'nostalgic',
    emotional_state_end: 'restless',
    chapter_notes: 'ACT I — Before Lala. Ground the reader in the world before everything changed.',
    pov: 'first_person',
    chapter_template: 'memoir_chapter',
    sections: [
      { type: 'h2', content: 'Before Lala' },
      { type: 'quote', content: 'Before I was Lala, I was just a woman standing in front of a closet full of clothes with nothing to wear.' },
      { type: 'h3', content: 'The Woman in the Mirror' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'What Style Used to Mean' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Gap Between Seen and Known' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'When was the last time you dressed for yourself instead of for a role?' },
    ],
  },
  {
    chapter_number: 2,
    title: 'Attention vs Alignment',
    badge: 'Act I',
    scene_goal: 'Explore the difference between dressing for attention and dressing in alignment with who you are.',
    theme: 'External Validation vs Internal Truth',
    emotional_state_start: 'performative',
    emotional_state_end: 'questioning',
    chapter_notes: 'The tension between what gets noticed and what feels right.',
    pov: 'first_person',
    chapter_template: 'memoir_chapter',
    sections: [
      { type: 'h2', content: 'Attention vs Alignment' },
      { type: 'h3', content: 'Dressing for the Gaze' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Compliment Trap' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'When Alignment Feels Invisible' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'Which outfits in your closet are for other people, and which are for you?' },
    ],
  },
  {
    chapter_number: 3,
    title: 'The Creative Identity Crisis',
    badge: 'Act I',
    scene_goal: 'The moment when the protagonist realizes her style identity is fractured — creative but invisible, bold in private but safe in public.',
    theme: 'Creative Courage',
    emotional_state_start: 'frustrated',
    emotional_state_end: 'determined',
    chapter_notes: 'The crack in the armor. She can\'t keep pretending.',
    pov: 'first_person',
    chapter_template: 'memoir_chapter',
    sections: [
      { type: 'h2', content: 'The Creative Identity Crisis' },
      { type: 'h3', content: 'The Pinterest Board vs The Closet' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Playing Small in Public' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Breaking Point' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'Where in your life do you hide your real taste?' },
    ],
  },
  {
    chapter_number: 4,
    title: 'The Woman in Her Prime',
    badge: 'Act I',
    scene_goal: 'Reclaim the narrative of a woman at her creative and personal peak — not despite her age, but because of it.',
    theme: 'Agency / Reclamation',
    emotional_state_start: 'defiant',
    emotional_state_end: 'empowered',
    chapter_notes: 'End of Act I. The character crosses the threshold, ready for transformation.',
    pov: 'first_person',
    chapter_template: 'memoir_chapter',
    sections: [
      { type: 'h2', content: 'The Woman in Her Prime' },
      { type: 'h3', content: 'What They Say About Women Over Forty' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'What I Say Back' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Prime Is Not a Number' },
      { type: 'body', content: '' },
      { type: 'quote', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What does being in your prime actually feel like to you?' },
    ],
  },
];

/* ── Act 2: The Birth of Lala (Chapters 5-8) ── */
const ACT_2 = [
  {
    chapter_number: 5,
    title: 'The AI Moment',
    badge: 'Act II',
    scene_goal: 'The discovery of AI as a creative tool. The moment the protagonist realizes technology can amplify her vision.',
    theme: 'Technology as Muse',
    emotional_state_start: 'curious',
    emotional_state_end: 'electrified',
    chapter_notes: 'ACT II — The Birth of Lala. The catalyst that changes everything.',
    pov: 'first_person',
    chapter_template: 'adventure_chapter',
    sections: [
      { type: 'h2', content: 'The AI Moment' },
      { type: 'h3', content: 'The First Prompt' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'When the Machine Saw Me' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Possibilities' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What tool or moment made you realize you could create something new?' },
    ],
  },
  {
    chapter_number: 6,
    title: 'The Clueless Closet Vision',
    badge: 'Act II',
    scene_goal: 'Birth of the Lala concept — a virtual closet, a digital styling companion, a character who embodies fearless style.',
    theme: 'Vision / World-Building',
    emotional_state_start: 'inspired',
    emotional_state_end: 'obsessed',
    chapter_notes: 'The creative vision crystallizes. Lala becomes real in the mind.',
    pov: 'first_person',
    chapter_template: 'adventure_chapter',
    sections: [
      { type: 'h2', content: 'The Clueless Closet Vision' },
      { type: 'quote', content: 'I didn\'t want an app. I wanted a world.' },
      { type: 'h3', content: 'The Cher Horowitz Effect' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Building A Closet That Thinks' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'When Lala Got Her Name' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What fictional character or world inspired a real creation in your life?' },
    ],
  },
  {
    chapter_number: 7,
    title: 'Styling as Adventure',
    badge: 'Act II',
    scene_goal: 'Reframe fashion from consumption to creative adventure. Getting dressed as an act of storytelling.',
    theme: 'Play / Freedom',
    emotional_state_start: 'playful',
    emotional_state_end: 'liberated',
    chapter_notes: 'Style becomes a daily creative practice, not a chore.',
    pov: 'first_person',
    chapter_template: 'adventure_chapter',
    sections: [
      { type: 'h2', content: 'Styling as Adventure' },
      { type: 'h3', content: 'The Outfit as Story' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Rules I Broke' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Joy of Getting Dressed' },
      { type: 'body', content: '' },
      { type: 'h4', content: 'Styling Notes' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'When was the last time getting dressed felt like play instead of obligation?' },
    ],
  },
  {
    chapter_number: 8,
    title: 'When a Character Becomes a World',
    badge: 'Act II',
    scene_goal: 'Lala evolves from a character into an entire world — aesthetic, philosophy, community.',
    theme: 'Expansion / Evolution',
    emotional_state_start: 'amazed',
    emotional_state_end: 'purposeful',
    chapter_notes: 'End of Act II. Lala is no longer just a persona — she\'s a universe.',
    pov: 'first_person',
    chapter_template: 'adventure_chapter',
    sections: [
      { type: 'h2', content: 'When a Character Becomes a World' },
      { type: 'h3', content: 'From Character to Concept' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Aesthetic Ecosystem' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'When Others Saw Themselves in Lala' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What started as one thing in your life and became something much bigger?' },
    ],
  },
];

/* ── Act 3: Lalaverse (Chapters 9-12) ── */
const ACT_3 = [
  {
    chapter_number: 9,
    title: 'Building More Than Content',
    badge: 'Act III',
    scene_goal: 'The shift from content creation to building systems, tools, and infrastructure for creative women.',
    theme: 'Architecture / Legacy',
    emotional_state_start: 'strategic',
    emotional_state_end: 'visionary',
    chapter_notes: 'ACT III — Lalaverse. Beyond content into world-building.',
    pov: 'first_person',
    chapter_template: 'creative_essay',
    sections: [
      { type: 'h2', content: 'Building More Than Content' },
      { type: 'h3', content: 'The Content Treadmill' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'From Posts to Systems' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'What Lala Actually Builds' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'Are you creating content, or are you building something?' },
    ],
  },
  {
    chapter_number: 10,
    title: 'Feminine Worldbuilding',
    badge: 'Act III',
    scene_goal: 'Explore how women build worlds differently — through aesthetics, emotion, community, and care.',
    theme: 'Feminine Creative Power',
    emotional_state_start: 'reflective',
    emotional_state_end: 'fierce',
    chapter_notes: 'A manifesto chapter. Bold, unapologetic, philosophical.',
    pov: 'first_person',
    chapter_template: 'creative_essay',
    sections: [
      { type: 'h2', content: 'Feminine Worldbuilding' },
      { type: 'quote', content: 'Men build empires. Women build rooms where people feel alive.' },
      { type: 'h3', content: 'The Aesthetic as Architecture' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Softness as Strategy' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The World Lala Built' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What kind of world are you building with your daily choices?' },
    ],
  },
  {
    chapter_number: 11,
    title: 'Digital Identity & Power',
    badge: 'Act III',
    scene_goal: 'Examine what it means to have a digital identity, own your image, and wield creative power online.',
    theme: 'Sovereignty',
    emotional_state_start: 'analytical',
    emotional_state_end: 'convicted',
    chapter_notes: 'The intersection of technology, identity, and feminine power.',
    pov: 'first_person',
    chapter_template: 'creative_essay',
    sections: [
      { type: 'h2', content: 'Digital Identity & Power' },
      { type: 'h3', content: 'Who Owns Your Image?' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Algorithm and the Woman' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'Designing Your Own Platform' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'Where do you have creative sovereignty, and where have you given it away?' },
    ],
  },
  {
    chapter_number: 12,
    title: 'The Woman Who Builds Rooms Instead of Entering Them',
    badge: 'Act III',
    scene_goal: 'The final statement. She doesn\'t wait for permission or invitations — she creates the spaces she wants to inhabit.',
    theme: 'Mastery / Wholeness',
    emotional_state_start: 'calm',
    emotional_state_end: 'complete',
    chapter_notes: 'The resolution. Full circle — from a woman with nothing to wear to a woman who builds worlds.',
    pov: 'first_person',
    chapter_template: 'creative_essay',
    sections: [
      { type: 'h2', content: 'The Woman Who Builds Rooms Instead of Entering Them' },
      { type: 'quote', content: 'I stopped waiting for invitations. I started designing the room.' },
      { type: 'h3', content: 'No More Waiting' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'The Rooms I\'ve Built' },
      { type: 'body', content: '' },
      { type: 'h3', content: 'An Invitation to Build Yours' },
      { type: 'body', content: '' },
      { type: 'divider', content: '' },
      { type: 'reflection', content: 'What room are you building? And who are you building it for?' },
    ],
  },
];

const ALL_CHAPTERS = [...ACT_1, ...ACT_2, ...ACT_3];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // Find or create the book
    const [books] = await sequelize.query(
      `SELECT id, title FROM storyteller_books WHERE title ILIKE '%Styling Adventures%Lala%' LIMIT 1`
    );

    let bookId;
    if (books.length > 0) {
      bookId = books[0].id;
      console.log(`Found existing book: ${books[0].title} (${bookId})`);
    } else {
      bookId = uuid();
      await sequelize.query(
        `INSERT INTO storyteller_books (id, title, subtitle, description, primary_pov, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        {
          bind: [
            bookId,
            'Styling Adventures with Lala',
            'A Creative Woman\'s Journey from Closet to Universe',
            'The story of how one woman turned her relationship with style into a world-building creative practice, powered by AI and feminine vision.',
            'first_person',
            'draft',
          ],
        }
      );
      console.log(`Created book: Styling Adventures with Lala (${bookId})`);
    }

    // Check for existing chapters
    const [existing] = await sequelize.query(
      `SELECT id, chapter_number FROM storyteller_chapters WHERE book_id = $1`,
      { bind: [bookId] }
    );

    if (existing.length > 0) {
      console.log(`Book already has ${existing.length} chapters. Updating sections...`);
      // Update sections for existing chapters
      for (const ch of ALL_CHAPTERS) {
        const match = existing.find(e => e.chapter_number === ch.chapter_number);
        if (match) {
          const sectionsWithIds = ch.sections.map(s => ({ ...s, id: uuid() }));
          await sequelize.query(
            `UPDATE storyteller_chapters 
             SET sections = $1, chapter_template = $2, scene_goal = $3, theme = $4,
                 emotional_state_start = $5, emotional_state_end = $6, chapter_notes = $7,
                 badge = $8, updated_at = NOW()
             WHERE id = $9`,
            {
              bind: [
                JSON.stringify(sectionsWithIds),
                ch.chapter_template,
                ch.scene_goal,
                ch.theme,
                ch.emotional_state_start,
                ch.emotional_state_end,
                ch.chapter_notes,
                ch.badge,
                match.id,
              ],
            }
          );
          console.log(`  Updated Ch ${ch.chapter_number}: ${ch.title}`);
        }
      }
    } else {
      console.log('Creating 12 chapters...');
      for (const ch of ALL_CHAPTERS) {
        const chId = uuid();
        const sectionsWithIds = ch.sections.map(s => ({ ...s, id: uuid() }));
        await sequelize.query(
          `INSERT INTO storyteller_chapters 
           (id, book_id, chapter_number, title, badge, sort_order, pov, scene_goal,
            emotional_state_start, emotional_state_end, theme, chapter_notes,
            chapter_template, sections, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
          {
            bind: [
              chId, bookId, ch.chapter_number, ch.title, ch.badge, ch.chapter_number,
              ch.pov, ch.scene_goal, ch.emotional_state_start, ch.emotional_state_end,
              ch.theme, ch.chapter_notes, ch.chapter_template, JSON.stringify(sectionsWithIds),
            ],
          }
        );
        console.log(`  Created Ch ${ch.chapter_number}: ${ch.title} [${ch.badge}]`);
      }
    }

    console.log('\nDone! "Styling Adventures with Lala" is ready.');
    console.log('  3 Acts, 12 Chapters, each with structured sections.');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await sequelize.close();
  }
}

seed();
