# Feed posts: one post, one place

*Living doc. The Feed project (Evoni, 2026-10-04). Cites code by stable name.*

## The rules

1. **A post lives in one place.** `feed_posts` is the record of what a character said,
   with its likes and comments. Every screen draws the record; nothing copies it. The
   phone's Feed Posts zone (`ScreenContentRenderer`, zone `feed_posts`) reads the
   episode's posts or the show timeline live; the Social Media page (`SocialMediaPage`,
   Posts tab) reads the show's live posts; the per-show timeline page
   (`FeedTimelinePage`) reads an episode's posts with their status.
2. **Draft, then live.** `feed_posts.status` (`services/feedPostStatus.js`, migration
   `20261004150000`) is `draft` or `live`. A post created inside an episode starts as a
   draft: the episode's Feed generation (`feedPostGeneratorService`), a ripple reply to
   a draft (`feedEngagementService`), a financial post tied to an episode
   (`financialFeedService`). When the episode's status becomes `published`
   (`episodeController.updateEpisode`), `publishEpisodePosts` dates the undated drafts
   at that moment and sets them live. A scrapped episode's drafts never go live.
3. **It is 2009: no edit button.** `PUT /feed-posts/:id` refuses a live post with 409
   (`LOCKED_MESSAGE`). A live post can only be deleted (soft delete, `deleted_at`). A
   draft is edited freely, and can be set live by hand (`status: 'live'`), never back.
4. **The audience sees live posts.** `GET /feed-posts` and
   `GET /feed-posts/:showId/timeline` answer live posts unless `?status=draft|all`.
   `GET /feed-posts/episode/:id` is the episode's own view and answers both, each marked.

5. **A beat points at the post; the phone draws it.** `feed_moments.feed_post_id`
   (migration `20261004160000`, `services/feedMomentLink.js`) names the post a phone
   moment shows; `GET /feed-enhanced/:showId/moments/:episodeId` carries each moment's
   `post`, and `PUT /feed-enhanced/:showId/moments/:momentId/post` links or unlinks
   (the post must be the show's; a draft only to a beat of its own episode). The phone's
   **One Post** zone (`ScreenContentRenderer`, zone `feed_post`, picker in
   `ContentZoneEditor`) draws one stored post live by id through
   `GET /feed-posts/post/:postId`, a draft marked. Fix the post on the feed and every
   screen that points at it shows the fix.

6. **Comments are records with a voice.** `feed_comments` (migration `20261004170000`,
   model `FeedComment`) holds a post's comments: who said it (a social profile when one
   matches, always a handle), the text, `draft` or `live` with the same rules as posts
   (a draft is edited or approved; a live comment is only deleted). `comments_count` on
   the post is its live comments (`recountComments`). **Reactions are drafted, never
   posted.** `POST /feed-posts/:id/comments/draft` (`services/feedCommentDrafter.js`,
   `aiRateLimiter`, one Claude message under the cost gate) asks for one comment from
   each character who would react, in that character's own voice: the poster's
   connections in `social_profile_relationships` first (by drama), then the profiles most
   relevant to Lala, up to four; `GET /feed-posts/:id/comments/reactors` shows them and
   the Social Media page lets Evoni untick who reacts. Every draft waits for approval
   (`PATCH /feed-posts/comments/:id { status: 'live' }`) or deletion. The One Post phone
   zone and `GET /feed-posts/post/:id` carry the live comment records; the old
   `sample_comments` strings remain as a fallback where no records exist.

## Still to come

- Notification and relationship-change phone zones that read a post or a profile
  change, and a way to pick a beat's post from the Social Media page.
- The phone's Comments zone still reads `sample_comments`; moving it to the records.
- Comments as records with a profile and a voice, and reaction drafting (step 4).
- A story clock on posts and episodes, so "a post must exist by this point in story
  time" can be checked rather than trusted.
