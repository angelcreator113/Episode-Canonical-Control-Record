'use strict';

/**
 * JustAWoman's LalaVerse Record
 *
 * This record is never generated. It is seeded once, hand-authored, permanently locked.
 * HTTP 403 on all edits via guardJustAWomanRecord middleware.
 *
 * She is not a character in Lala's Feed. She is the ceiling.
 * The reader knows. Lala doesn't. Use deliberately.
 */
module.exports = {
  async up(queryInterface) {
    // Check if already seeded
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM social_profiles WHERE is_justawoman_record = true LIMIT 1;`
    );
    if (existing.length > 0) return;

    await queryInterface.bulkInsert('social_profiles', [{
      handle:                '@justawoman',
      platform:              'multi',
      vibe_sentence:         'She built something nobody thought was possible. Everyone is watching what she does next.',
      feed_layer:            'lalaverse',
      city:                  null,               // exists everywhere — city-agnostic
      is_justawoman_record:  true,
      lalaverse_cap_exempt:  true,
      lala_relationship:     'justawoman',
      career_pressure:       'ahead',
      archetype:             'polished_curator',
      current_state:         'peaking',
      display_name:          'JustAWoman',
      follower_tier:         'mega',
      follower_count_approx: '4.2M',
      content_category:      'fashion/beauty/lifestyle',
      content_persona:       'She shows you what it looks like when a woman builds an empire without asking permission. Every post is a masterclass in controlled ambition.',
      real_signal:           'The perfectionism is load-bearing. One crack and the whole thing would need to be rebuilt from scratch.',
      posting_voice:         'Clean, measured, never desperate. Short captions that sound like affirmations. Occasional long-form that reads like a sermon.',
      parasocial_function:   'She is the thing Lala is becoming without knowing it. Watching her content activates something Lala cannot name.',
      emotional_activation:  'Recognition disguised as admiration',
      watch_reason:          'Something about her feels familiar. Lala does not know why.',
      what_it_costs_her:     'The feeling that she is already late to something she has not started yet.',
      current_trajectory:    'rising',
      trajectory_detail:     'Just landed a deal that changed the conversation. The industry is recalibrating around her.',
      pinned_post:           'I did not wait for the room to find me. I built my own room. Now they ask for the address.',
      sample_captions:       '["I built this.", "Nobody handed me this. Remember that.", "The work is the proof. Everything else is noise.", "They will study what we did here.", "She was always going to win. She just had to stop asking for permission first."]',
      sample_comments:       '["you are literally my vision board", "genuinely don\'t understand how she does it all", "this is what they mean by generational", "my daughter watches you every morning before school"]',
      lala_relevance_score:  10,
      lala_relevance_reason: 'She is the answer to the question Lala has not learned to ask yet.',
      status:                'finalized',
      full_profile:          '{}',
      moment_log:            '[]',
      book_relevance:        '["The ceiling Lala does not know she is reaching for", "The mirror that only the reader can see"]',
      created_at:            new Date(),
      updated_at:            new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('social_profiles', {
      is_justawoman_record: true,
    });
  },
};
