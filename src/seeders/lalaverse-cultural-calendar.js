'use strict';

/**
 * Seeder: LalaVerse Cultural Calendar v1.0
 * ─────────────────────────────────────────────────────────────────────────
 * franchise_law · always_inject
 *
 * 35 major world-rhythm events across 12 months
 * + 9 floating micro events (no fixed month)
 * + 4 icon birthday templates
 *
 * Run after story_calendar_events table + cultural-calendar-fields migration.
 * Idempotent: deletes previous system cultural events before re-seeding.
 */

const { v4: uuidv4 } = require('uuid');

function storyDate(month, day, hour = 0) {
  return new Date(
    `8385-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`
  );
}

function ev(title, opts) {
  const now = new Date();
  return {
    id: uuidv4(),
    title,
    event_type: 'lalaverse_cultural',
    start_datetime:     opts.start,
    end_datetime:       opts.end || null,
    is_recurring:       opts.recurring !== false,
    recurrence_pattern: opts.pattern || null,
    location_name:      opts.location || null,
    location_address:   opts.address || null,
    lalaverse_district: opts.district || null,
    visibility:         opts.visibility || 'public',
    what_world_knows:   opts.world || null,
    what_only_we_know:  opts.secret || null,
    logged_by:          'system',
    source_line_id:     null,
    story_position:     null,
    series_id:          null,
    severity_level:     opts.severity || null,
    cultural_category:  opts.category || null,
    activities:         opts.activities ? JSON.stringify(opts.activities) : null,
    phrases:            opts.phrases ? JSON.stringify(opts.phrases) : null,
    is_micro_event:     opts.micro || false,
    created_at: now,
    updated_at: now,
  };
}

module.exports = {
  async up(queryInterface) {
    // Clear previous system cultural events for idempotency
    await queryInterface.bulkDelete('story_calendar_events', {
      logged_by: 'system',
      event_type: 'lalaverse_cultural',
    });

    const events = [

      // ═══════════════════════════════════════════════════════════════════
      // JANUARY
      // ═══════════════════════════════════════════════════════════════════

      ev('Mirror Month', {
        start: storyDate(1, 1), end: storyDate(1, 15),
        pattern: 'annual:01-01', severity: 'major',
        category: 'lifestyle',
        district: 'All Districts',
        world: 'Reinvention, glow-ups, personal resets. The first cultural moment of the year — everyone starts fresh or pretends to.',
        secret: 'Mirror Month content performance predicts who will have a good or terrible year. The algorithm weights early-January engagement heavily.',
        activities: [
          'Fitness transformations and body-reset content',
          'Brand re-launches and identity pivots',
          'Lifestyle resets — routines, habits, environments',
          'Mental health discussions and vulnerability content',
          'Before/after reveals — aesthetic and personal',
        ],
        phrases: [
          'Mirror Month changed my whole routine.',
          'New year, new feed. She ate.',
          "I'm not the same person I was in December.",
        ],
      }),

      ev('Creator Camp', {
        start: storyDate(1, 16), end: storyDate(1, 31),
        pattern: 'annual:01-16',
        category: 'creator_economy',
        district: 'The Workshop Quarter',
        world: 'Learning, collaboration, and industry networking. The first collab window of the year.',
        secret: 'Creator Camp is where next year\'s power alliances are quietly formed. The real workshops happen in private rooms.',
        activities: [
          'Creator workshops and masterclasses',
          'Collaboration meetups and content partnerships',
          'Industry networking — brands scouting new talent',
          'Behind-the-scenes content from sessions',
          'Emerging creators get first major exposure',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // FEBRUARY
      // ═══════════════════════════════════════════════════════════════════

      ev('Heart Bloom Week', {
        start: storyDate(2, 1), end: storyDate(2, 14),
        pattern: 'annual:02-01',
        category: 'lifestyle',
        district: 'The Rose Quarter',
        world: 'Romance, relationships, and emotional storytelling. The Feed turns soft and vulnerable.',
        secret: 'Going public during Heart Bloom Week is a strategic move. Everyone knows the engagement spike is real.',
        activities: [
          'Relationship reveals — going public for the first time',
          'Couples content and partner cameos',
          'Love story storytelling — origin stories, proposals',
          'Singles content — solo glow-ups, independence narratives',
          'Brand partnerships: jewelry, fragrance, fashion',
        ],
        phrases: [
          'Heart Bloom Week got me in my feelings.',
          'She finally introduced him. We knew.',
        ],
      }),

      ev('Sweet Street Festival', {
        start: storyDate(2, 15), end: storyDate(2, 28),
        pattern: 'annual:02-15',
        category: 'lifestyle',
        district: 'Sweet Street District',
        world: 'Desserts, aesthetic food culture, and cafe life. The most visually indulgent two weeks of the year.',
        secret: 'Sweet Street aesthetic bleeds into fashion — patisserie colors influence spring palettes every year.',
        activities: [
          'Bakery popups and patisserie launches',
          'Food creators trending — aesthetic dessert content',
          'Café culture posts — the table, the drink, the outfit',
          'Brand partnerships: food brands, lifestyle brands',
          'Sweet Street aesthetic bleeds into fashion and decor',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // MARCH
      // ═══════════════════════════════════════════════════════════════════

      ev('Bloom Festival', {
        start: storyDate(3, 1), end: storyDate(3, 15),
        pattern: 'annual:03-01',
        category: 'fashion',
        district: 'The Garden District',
        world: 'Creativity, aesthetic rebirth, and seasonal transition. The first outdoor fashion moments of the year.',
        secret: 'Bloom Festival is the soft opening for Atelier Circuit positioning. Who you\'re seen with now sets the table for August.',
        activities: [
          'Fashion transitions — out of winter, into color',
          'Art installations and design showcases in LalaVerse districts',
          'Creative projects dropped after months of build-up',
          'The first major outdoor fashion moments of the year',
          'Brands launching spring collections',
        ],
        phrases: [
          'Bloom Festival is the reset I needed.',
          'Her Bloom Festival look broke the internet.',
        ],
      }),

      ev('Studio Week', {
        start: storyDate(3, 16), end: storyDate(3, 31),
        pattern: 'annual:03-16',
        category: 'creative',
        district: 'The Studio Lofts',
        world: 'Creative production, project launches, campaign shoots. Artists releasing work held since January.',
        secret: 'Studio Week content is often filmed weeks earlier. The "spontaneous" studio footage is the most planned content of the year.',
        activities: [
          'Artists releasing work held since January',
          'Musicians teasing projects and dropping singles',
          'Creators filming large brand campaigns',
          'Behind-the-scenes studio content',
          'Fashion houses releasing campaign imagery',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // APRIL
      // ═══════════════════════════════════════════════════════════════════

      ev('Glow Week', {
        start: storyDate(4, 1), end: storyDate(4, 14),
        pattern: 'annual:04-01', severity: 'major',
        category: 'beauty',
        district: 'The Glow District',
        world: 'Beauty transformations and product launches. The most anticipated beauty event of the year. Careers are made here.',
        secret: 'Glow Week product drops are negotiated in January. By April, the rankings are already decided — the event just reveals them.',
        activities: [
          'Salons launch seasonal trend looks',
          'Beauty brand product drops — the year\'s most anticipated launches',
          'Glow-up challenges trending across the Feed',
          'Before/after beauty transformations',
          'Beauty creators at peak visibility — brand deals closing',
        ],
        phrases: [
          'Glow Week took her out.',
          'That product drop during Glow Week sold out in four minutes.',
        ],
      }),

      ev('Pet Parade', {
        start: storyDate(4, 15), end: storyDate(4, 30),
        pattern: 'annual:04-15',
        category: 'lifestyle',
        district: 'The Park District',
        world: 'Animal creators, pet culture, and companion content. Lower stakes, high warmth.',
        secret: 'Pet Parade gives unexpected visibility to otherwise serious characters. A well-timed pet moment can humanize a villain arc.',
        activities: [
          'Pet outfit contests and styling challenges',
          'Pet influencer meetups and collab content',
          'Viral pet moments dominate the Feed',
          'Brand partnerships: pet brands, lifestyle crossovers',
          'Characters who own pets get visibility boost',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // MAY
      // ═══════════════════════════════════════════════════════════════════

      ev('Dream Market', {
        start: storyDate(5, 1), end: storyDate(5, 20),
        pattern: 'annual:05-01', severity: 'major',
        category: 'entrepreneur',
        district: 'The Market District',
        world: 'Entrepreneurship, creator economy, and brand launches. Every brand is writing checks. Every creator is pitching.',
        secret: 'Dream Market reveals who actually has a business and who has been faking it. The merch that doesn\'t sell is the loudest silence.',
        activities: [
          'Creator shop launches and digital product drops',
          'Brand collaborations announced and activated',
          'Entrepreneur storytelling — origin stories, struggles, pivots',
          'Investor and brand scout activity peaks',
          'Merch drops and limited collections from established creators',
        ],
        phrases: [
          "Dream Market season — she's been planning this since January.",
          'Every brand is writing checks right now.',
        ],
      }),

      ev('The Outfit Games', {
        start: storyDate(5, 21), end: storyDate(5, 31),
        pattern: 'annual:05-21',
        category: 'fashion',
        district: 'The Promenade',
        world: 'Fashion competition culture and street style. Safe dressers get clocked. Risk-takers get elevated.',
        secret: 'New street style icons often emerge here first. The Outfit Games are the proving ground before the Atelier Circuit.',
        activities: [
          'Outfit battles — creators voting on best looks',
          'Street style competitions across LalaVerse districts',
          'Fashion risk-takers get elevated',
          'Safe dressers get clocked',
          'New street style icons often emerge here first',
        ],
        phrases: [
          "The Outfit Games don't forgive boring.",
          'She wore THAT to The Outfit Games. Brave.',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // JUNE
      // ═══════════════════════════════════════════════════════════════════

      ev('Sunspell Festival', {
        start: storyDate(6, 1), end: storyDate(6, 21),
        pattern: 'annual:06-01', severity: 'major',
        category: 'lifestyle',
        district: 'The Sunspell Terrace',
        world: 'Summer lifestyle, travel, outdoor fashion. The aesthetic: warm tones, movement, ease. If you were made for summer, this is your moment.',
        secret: 'Sunspell is where quiet alliances get photographed for the first time. The audience reads the group shots like tea leaves.',
        activities: [
          'Pool parties and summer event content',
          'Travel influencers peaking — destination content everywhere',
          'Outdoor fashion moments — the swimwear, the coverup, the sandal',
          'Sunspell aesthetic: warm tones, movement, ease',
          'Brand partnerships: travel, swimwear, beverage brands',
        ],
        phrases: [
          'Sunspell season hit different this year.',
          'She was made for Sunspell. You could tell.',
        ],
      }),

      ev('Soundwave Nights', {
        start: storyDate(6, 22), end: storyDate(6, 30),
        pattern: 'annual:06-22',
        category: 'music',
        district: 'The Sound District',
        world: 'Music discovery and emerging sound culture. Where fashion and music cross over.',
        secret: 'Soundwave placements are a leading indicator — the creator who gets the soundtrack credit here controls the summer aesthetic.',
        activities: [
          'Emerging musicians trending across the Feed',
          'DJ showcases in LalaVerse nightlife districts',
          'Music creators getting first major placements',
          'Fashion and music crossover moments',
          'Sound-based content — the song, the sound, the vibe',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // JULY
      // ═══════════════════════════════════════════════════════════════════

      ev('Neon Nights', {
        start: storyDate(7, 1), end: storyDate(7, 15),
        pattern: 'annual:07-01',
        category: 'nightlife',
        district: 'The Neon District',
        world: 'Nightlife, party culture, and celebrity sightings. Where reputations are made and ruined.',
        secret: 'Neon Nights sightings are currency. Who was seen with whom becomes the gossip cycle for the rest of summer.',
        activities: [
          'DJs and nightlife creators at peak visibility',
          'Celebrity sightings and table stories',
          'Nightlife fashion — the going out look elevated to art',
          'After-party content and the morning-after recap',
          'Brand partnerships: nightlife brands, fragrance, fashion',
        ],
        phrases: [
          'Neon Nights is where reputations are made and ruined.',
          'She was seen at Neon Nights with HIM.',
        ],
      }),

      ev('Creator Cruise', {
        start: storyDate(7, 16), end: storyDate(7, 31),
        pattern: 'annual:07-16', severity: 'major',
        category: 'creator_economy',
        district: 'International Waters',
        location: 'The Creator Cruise Ship',
        world: 'Influencer travel event and collab content explosion. Major creators vacation together. Drama never stays on the boat.',
        secret: 'Who got left off the Creator Cruise list is its own story. New alliances form, old ones fracture in closed environments.',
        activities: [
          'Major creators vacation together — collab content explodes',
          'Behind-the-scenes of creator friendships',
          'Drama and fallouts in closed environments',
          'New alliances form, old ones fracture',
          'The audience watches the social dynamics in real time',
        ],
        phrases: [
          "Creator Cruise drama never stays on the boat.",
          "Who got left off the Creator Cruise list is its own story.",
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // AUGUST
      // ═══════════════════════════════════════════════════════════════════

      ev('The Atelier Circuit', {
        start: storyDate(8, 1), end: storyDate(8, 22),
        pattern: 'annual:08-01', severity: 'largest_event',
        category: 'fashion',
        district: 'All Fashion Districts',
        location: 'The Atelier Circuit Venues',
        world: 'Global fashion presentations — the LARGEST fashion industry event of the year. Front row placement is a power statement. Street style outside the venues rivals the shows.',
        secret: 'The gap between where a character expected to be seated and where they were actually seated is always a story. The Atelier Circuit is not fashion. It is power.',
        activities: [
          'Designer collections presented across LalaVerse districts',
          'Runway events and front row politics',
          'Stylist showcases — who dressed who becomes its own conversation',
          'Brands competing for cultural dominance',
          'Characters in the fashion tier hierarchy prove their position here',
          'Front row placement is a power statement',
          'Street style outside the venues rivals the shows',
        ],
        phrases: [
          'The Atelier Circuit is not fashion. It is power.',
          "She wasn't front row. That's all I'll say.",
          'That collection at the Atelier Circuit changed the conversation.',
        ],
      }),

      ev('Style Market', {
        start: storyDate(8, 23), end: storyDate(8, 31),
        pattern: 'annual:08-23',
        category: 'fashion',
        district: 'The Street Market District',
        world: 'Independent fashion designers and streetwear culture. The antidote to couture: raw, real, on the street.',
        secret: 'Style Market is where Atelier Circuit rejects prove they didn\'t need the runway. Some of the most important fashion careers start here.',
        activities: [
          'Small brands launching — the undercard to the Atelier Circuit',
          'Streetwear drops and limited independent collections',
          'Street style icons discovered outside the big venues',
          'Brand deals between established creators and indie designers',
          'The antidote to couture: raw, real, and on the street',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // SEPTEMBER
      // ═══════════════════════════════════════════════════════════════════

      ev('Velvet Season', {
        start: storyDate(9, 1), end: storyDate(9, 20),
        pattern: 'annual:09-01', severity: 'major',
        category: 'fashion',
        district: 'The Velvet District',
        world: 'Luxury fashion culture and couture reveals. Tier 1 designers control the narrative. The only season that matters — according to the people in it.',
        secret: 'Velvet Season is where loyalty is tested. Designers remember who wore their competition during the Atelier Circuit.',
        activities: [
          'Couture reveals from top-tier fashion houses',
          'Luxury brands dominating the conversation',
          'Investment pieces and aspirational fashion content',
          'The aesthetic shift from summer into fall',
          'Tier 1 designers control the narrative during Velvet Season',
        ],
        phrases: [
          'Velvet Season is the only season that matters.',
          "She dressed for Velvet Season in August. That's respect.",
        ],
      }),

      ev('Photo Fair', {
        start: storyDate(9, 21), end: storyDate(9, 30),
        pattern: 'annual:09-21',
        category: 'creative',
        district: 'The Arts District',
        world: 'Photography, visual art, and creative documentation. The documentation of the year so far — in images.',
        secret: 'Photo Fair is where new aesthetic languages are named. The terminology coined here shows up in brand decks by November.',
        activities: [
          'Photography exhibitions across LalaVerse arts districts',
          'Creator collaborations with visual artists',
          'The documentation of the year so far — in images',
          'New aesthetic languages emerging and being named',
          'Brands commission original art for campaign material',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // OCTOBER
      // ═══════════════════════════════════════════════════════════════════

      ev('Masquerade Month', {
        start: storyDate(10, 1), end: storyDate(10, 20),
        pattern: 'annual:10-01',
        category: 'creative',
        district: 'All Districts',
        world: 'Mystery aesthetics, costume fashion, theatrical storytelling. Identity-play content peaks. The most creative Feed content of the year.',
        secret: 'Masquerade Month is when characters reveal their alter egos. The masks they choose are more honest than their real faces.',
        activities: [
          'Costume fashion elevated to editorial',
          'Theatrical storytelling — characters and alter egos',
          'Identity-play content peaks',
          'Mystery aesthetics: hidden faces, veiled identities, coded fashion',
          'The most creative Feed content of the year',
        ],
        phrases: [
          'Masquerade Month is when she lets the characters out.',
          "You can be anyone in October. That's the point.",
        ],
      }),

      ev('Design Duel', {
        start: storyDate(10, 21), end: storyDate(10, 31),
        pattern: 'annual:10-21',
        category: 'creative',
        district: 'The Design Arena',
        world: 'Creative competitions and product design challenges. Winning the Design Duel changes a career trajectory.',
        secret: 'The Design Duel is scouted by Tier 1 houses. A win here is a direct pipeline to Velvet Season next year.',
        activities: [
          'Designers competing in live and documented challenges',
          'Product design challenges — fashion, interior, digital',
          'Emerging designers get spotlight alongside established names',
          'Audience votes and brand scouts watching closely',
          'Winning the Design Duel changes a career trajectory',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // NOVEMBER
      // ═══════════════════════════════════════════════════════════════════

      ev('Starlight Awards', {
        start: storyDate(11, 1), end: storyDate(11, 20),
        pattern: 'annual:11-01', severity: 'awards_peak',
        category: 'awards',
        district: 'The Grand Auditorium',
        location: 'Starlight Hall',
        world: 'Creator recognition — the Oscars of LalaVerse. The most significant recognition event of the year. Red carpet fashion rivals the Atelier Circuit. Snubs generate weeks of conversation.',
        secret: 'Nominations are political. The voting body is smaller than anyone admits. One bloc controls three categories. Speeches become cultural reference points because they\'re the only unscripted moment all year.',
        activities: [
          'The most significant creator recognition event of the year',
          'Brands sponsor categories and vie for placement',
          'Red carpet fashion rivals the Atelier Circuit',
          'Speeches and moments become cultural reference points',
          'Snubs and surprises generate weeks of conversation',
          'Winners see immediate career trajectory changes',
        ],
        phrases: [
          'She was robbed at the Starlights. We all know it.',
          'That Starlight Awards speech is still being quoted.',
        ],
      }),

      ev('Trend Summit', {
        start: storyDate(11, 21), end: storyDate(11, 30),
        pattern: 'annual:11-21',
        category: 'fashion',
        district: 'The Summit Hall',
        world: 'Predicting next year\'s culture and industry forecasting. The conversation about next year begins here.',
        secret: 'Trend Summit predictions are self-fulfilling prophecies. Saying something is dead makes it dead. Saying something is next makes it next.',
        activities: [
          'Fashion predictions from Tier 1 and Tier 2 industry figures',
          'Industry panels — who\'s coming up, who\'s fading',
          'Creators positioning themselves for next year',
          'Brands announcing direction and investment areas',
          'The conversation about next year begins here',
        ],
        phrases: [
          'Trend Summit said color is dead. The Feed disagreed by Friday.',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // DECEMBER
      // ═══════════════════════════════════════════════════════════════════

      ev('Cloud Carnival', {
        start: storyDate(12, 1), end: storyDate(12, 20),
        pattern: 'annual:12-01', severity: 'major',
        category: 'lifestyle',
        district: 'The Carnival Grounds',
        world: 'Massive celebration festival — concerts, appearances, parties. The year exhales. If you\'re not at Cloud Carnival, where are you?',
        secret: 'Cloud Carnival is where year-end alliances are publicly confirmed. The group photo at Cloud Carnival is the roster announcement for next year.',
        activities: [
          'Concerts and live performances across LalaVerse',
          'Creator appearances and brand parties',
          'Year-end celebration content — reflections and gratitude',
          'The last major collab opportunity before the year closes',
          'Cloud Carnival fashion: festive, elevated, memorable',
        ],
        phrases: [
          'Cloud Carnival is where the year exhales.',
          "If you're not at Cloud Carnival, where are you?",
        ],
      }),

      ev('The Grand Drop', {
        start: storyDate(12, 21), end: storyDate(12, 31),
        pattern: 'annual:12-21',
        category: 'entrepreneur',
        district: 'All Districts',
        world: 'Year-end product launches and limited collections. The last chance to end the year on top.',
        secret: 'The Grand Drop is a loyalty test. Fans who buy year-end merch are the real ones. Creators track this closely.',
        activities: [
          'Limited collections and year-end fashion drops',
          'Digital product releases and creator merch',
          'Tech launches and platform feature reveals',
          'The final brand deals of the year close',
          'Year-in-review content and legacy moments',
        ],
        phrases: [
          'The Grand Drop is the last chance to end the year on top.',
          'She saved her best drop for December. Smart.',
        ],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // MICRO EVENTS — floating, no fixed month
      // ═══════════════════════════════════════════════════════════════════

      ev('The Outfit Games (Micro)', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'fashion',
        world: 'Fashion competition moments — anyone can enter, anyone can win, anyone can be humiliated. Careers start and end here.',
        secret: 'The micro Outfit Games fire whenever the Feed needs a fashion pressure event. They preview the annual May event.',
        activities: ['Head-to-head outfit battles', 'Audience voting on best looks', 'Careers start and end in a single post'],
      }),

      ev('Beauty Battles', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'beauty',
        world: 'Head-to-head beauty creator challenges. The audience votes. The loser loses followers. The winner gains a story.',
        secret: 'Beauty Battles are often staged by brands as guerrilla marketing. The makeup used in the duel conveniently becomes available the next day.',
        activities: ['Head-to-head beauty challenges', 'Audience voting decides outcomes', 'Follower counts visibly shift'],
      }),

      ev('Pet Parade (Micro)', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'lifestyle',
        world: 'Recurring animal creator moments. Lower stakes, high warmth, unexpected visibility for otherwise serious characters.',
        secret: 'A well-timed pet moment can break a cold streak. The algorithm rewards the unexpected warmth.',
        activities: ['Pet content goes viral', 'Serious characters get humanized', 'Low stakes, high warmth'],
      }),

      ev('Design Duels (Micro)', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'creative',
        world: 'Smaller design competitions that preview the October Design Duel. Testing ground for emerging talent.',
        secret: 'Scouts from major houses attend the micro Design Duels anonymously. Performance here directly affects Atelier Circuit invitations.',
        activities: ['Quick design challenges', 'Emerging talent testing ground', 'Preview of annual Design Duel'],
      }),

      ev('Creator Roast Night', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'creator_economy',
        world: 'Public roasting of creators by other creators. Everything is jokes until someone goes too far.',
        secret: 'Roast Night has ended careers. One joke that lands wrong becomes a feud that reshapes alliances for months.',
        activities: ['Creators publicly roast each other', 'Audience engagement peaks', 'When jokes go too far, feuds begin'],
      }),

      ev('Style Switch Challenge', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'fashion',
        world: 'Creators swap aesthetics for a day. Reveals who is a persona and who is actually themselves.',
        secret: 'The Style Switch is a character-truth test. Those who can\'t perform someone else\'s aesthetic reveal how narrow their own identity is.',
        activities: ['Aesthetic swaps between creators', 'Identity revealed through adaptation', 'Persona vs authenticity exposed'],
      }),

      ev('Makeover Marathon', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'beauty',
        world: 'Extended transformation content — not just beauty, but identity. Before/after over days or weeks.',
        secret: 'Makeover Marathon arcs are the highest-engagement content in LalaVerse when done right. Brands sponsor specific transformation segments.',
        activities: ['Multi-day transformation arcs', 'Identity-level before/after', 'Beauty, style, and life changes documented'],
      }),

      ev('Influencer Speed Dating', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'creator_economy',
        world: 'Creator networking event with a twist — rapid-fire collab pitches. Alliances form fast.',
        secret: 'Speed Dating pairs are not random. Organizers curate matches to maximize drama and content potential.',
        activities: ['Rapid-fire collab pitches', 'New alliances form instantly', 'The audience watches connections form in real time'],
      }),

      ev('Fashion Mystery Box Challenge', {
        start: storyDate(1, 1), end: null,
        recurring: false, micro: true,
        category: 'fashion',
        world: 'Creators style looks from a mystery selection. Constraint reveals true taste.',
        secret: 'The mystery boxes are not random. Curators design them to expose specific weaknesses in specific creators.',
        activities: ['Random garment selections', 'Styling under constraint', 'True taste revealed when choice is limited'],
      }),

      // ═══════════════════════════════════════════════════════════════════
      // ICON BIRTHDAY TEMPLATES — dates assigned when icons are generated
      // ═══════════════════════════════════════════════════════════════════

      ev('The Style Queen\'s Birthday', {
        start: storyDate(1, 1), end: null,
        recurring: true, pattern: 'annual:TBD',
        category: 'fashion',
        world: 'Themed outfit posts across the Feed. Her aesthetic becomes a challenge. Characters who align with her gain visibility.',
        secret: 'The Style Queen\'s birthday is not personal — it is institutional. Fashion houses plan their calendar around it.',
        activities: ['Themed outfit challenges', 'Aesthetic tribute posts', 'Aligned characters gain visibility'],
      }),

      ev('The Glow Guru\'s Birthday', {
        start: storyDate(1, 1), end: null,
        recurring: true, pattern: 'annual:TBD',
        category: 'beauty',
        world: 'Tutorial tributes honoring her techniques. Beauty creators compete to produce the best tribute content.',
        secret: 'The Glow Guru\'s birthday has become an unofficial awards ceremony. The best tribute gets reposted — and that repost changes careers.',
        activities: ['Tutorial tributes', 'Technique recreation competitions', 'Best tribute gets signal-boosted'],
      }),

      ev('The Creator King\'s Birthday', {
        start: storyDate(1, 1), end: null,
        recurring: true, pattern: 'annual:TBD',
        category: 'entrepreneur',
        world: 'Mentorship content. Creators share how he influenced their path. Aspiration and gratitude dominate the Feed.',
        secret: 'The Creator King\'s birthday is the one day the Feed is genuinely grateful. The rest of the year is combat.',
        activities: ['Mentorship storytelling', 'Gratitude posts dominate', 'Origin story tributes'],
      }),

      ev('The Icon Twins\' Birthday', {
        start: storyDate(1, 1), end: null,
        recurring: true, pattern: 'annual:TBD',
        category: 'lifestyle',
        world: 'Two legendary influencers born the same day. Fan edits, nostalgic posts, and the annual debate: which one is greater?',
        secret: 'The Icon Twins debate is the safest form of fandom warfare. It generates engagement without real consequences — usually.',
        activities: ['Fan edits and nostalgic posts', 'The annual "who is greater" debate', 'Fandom alignment content'],
      }),
    ];

    await queryInterface.bulkInsert('story_calendar_events', events);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('story_calendar_events', {
      logged_by: 'system',
      event_type: 'lalaverse_cultural',
    });
  },
};
