/**
 * Posts default to The Pulse (the quick wins, 2026-10-18): a post by a
 * LalaVerse profile, or by no profile, is on The Pulse ('lalaverse'); a
 * real-world (JustAWoman) profile's post carries its own app.
 */
const fs = require('fs');
const path = require('path');
const { postPlatformFor } = require('../../../src/utils/pulsePlatform');

describe('postPlatformFor', () => {
  test('The Pulse for Lala\'s world and for no profile; a real-world profile\'s own app', () => {
    expect(postPlatformFor({ feed_layer: 'lalaverse', platform: 'pulse' })).toBe('lalaverse');
    expect(postPlatformFor(null)).toBe('lalaverse');
    expect(postPlatformFor({ feed_layer: 'real_world', platform: 'tiktok' })).toBe('tiktok');
    expect(postPlatformFor({ feed_layer: 'real_world' }, 'twitter')).toBe('twitter');
  });

  test('the FeedPost default is The Pulse, and every writer sets a platform', () => {
    const src = (p) => fs.readFileSync(path.join(__dirname, '../../../src', p), 'utf8');
    expect(src('models/FeedPost.js')).toMatch(/poster_platform: \{[^}]*defaultValue: 'lalaverse'/);
    expect(src('services/financialFeedService.js')).toMatch(/poster_platform,[\s\S]*'lalaverse', :postType/);
    expect(src('services/feedEngagementService.js')).toContain("postPlatformFor(reactor, 'twitter')");
    expect(src('routes/feedPostRoutes.js')).toContain("postPlatformFor(profile, 'instagram')");
  });
});
