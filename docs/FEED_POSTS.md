# Feed posts: one post, one place

*Living doc. The Feed project (Evoni, 2026-10-04). Cites code by stable name.*

## The rules

1. **A post lives in one place.** `feed_posts` is the record of what a character said,
   with its likes and comments. Every screen draws the record; nothing copies it. The
   phone's Feed Posts zone (`ScreenContentRenderer`, zone `feed_posts`) reads the
   episode's posts or the show timeline live; the Social Media page (`SocialMediaPage`:
   since 2026-10-04 a 2009 profile-and-wall to Evoni's mock, "lalaverse" on a purple
   banner) reads the show's live posts with their comments (`GET /feed-posts?with=comments`)
   as Lala's wall, with her profile, friends, requests (draft posts and reactions to
   approve, `GET /feed-posts/comments/pending`), upcoming events and people she may know;
   "What's on your mind?" posts as Lala, live (`POST /feed-posts`). The per-show timeline
   page (`FeedTimelinePage`) reads an episode's posts with their status.
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
   A deleted post is listed by `GET /feed-posts/deleted?show_id=` and comes back as it
   was, draft or live, with `POST /feed-posts/:id/restore` (2026-10-05). A draft can
   be redrafted in its poster's voice, `POST /feed-posts/:id/redraft { note? }`
   (`services/feedPostRedrafter.js`: their social profile's voice, found by
   `social_profile_id` or handle, one Claude message, rate-limited); the new text
   replaces the draft's and the old text comes back for an undo. A live post is not
   redrafted (409).
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

7. **Notifications are derived, never copied.** The phone's Feed Notifications zone
   (`ScreenContentRenderer`, zone `feed_notifications`, `notificationsFrom`) reads the
   same records as the wall: a comment under one of Lala's posts is "X commented on your
   status: '…'", a post by someone else "X posted: '…'" or "X wrote on your wall" when it
   names her; newest first; the episode's posts in an episode, the show's live posts
   otherwise; `owner_handle` says whose phone it is (default `lala`). The older
   Notifications zone still reads the episode's phone moments.

8. **A relationship change is a post.** Profiles keep only a current
   `relationship_status`, and `social_profile_relationships` rows are written in bulk when
   profiles are generated, so neither is a story event. A relationship change is a feed
   post with `post_type` `relationship` (`frontend/src/lib/feedRelationship.js`:
   `relationshipText` writes 'changed her relationship status to "It's complicated."' or
   "and Marcus are now friends.", `parseRelationship` reads it back), so it has a story
   time, draft or live, likes and comments, and the 2009 no-edit rule. The wall's composer
   shares one (Status / Relationship / Friends); the wall's Relationship Status line is the
   owner's newest live status post (`latestStatus`), the profile field only as the fallback;
   the phone's **Relationship Changes** zone (`relationship_changes`) draws them, the
   episode's posts in an episode, the show's live posts otherwise, through
   `GET /feed-posts?post_type=relationship`. The profile row is not rewritten.

   **A beat's post, picked from the wall (rule 5, 2026-10-04).** Each wall post has "Use in a beat": pick an
   episode and one of the 14 beats (the Lala's Phone beats first; `lib/canonicalBeats.js`,
   pinned to `src/constants/canonicalBeats.js` by
   `tests/unit/constants/frontend-canonical-beats.test.js`), and
   `POST /feed-enhanced/:showId/moments/:episodeId/beat` (`createMomentForPost`) creates
   that beat's phone moment pointing at the post (never twice for the same beat; a draft
   only in its own episode). `GET /feed-posts/post/:id` answers `beats`, where the post is
   shown, and the picker lists them.

9. **The story clock.** Lala's world has no calendar the feed can share (episodes carry
   a number and a real air date; an event's date is free text), so story time is the
   episode order (`services/storyClock.js`, mirrored for screens by
   `frontend/src/lib/storyClock.js`): order = episode number × 10 + phase (before 1,
   during 5, after 7, next day 8, week later 9). A post's story time is its episode's
   number and its `timeline_position`; a post written on the wall with no episode is
   stamped `feed_posts.story_order` (migration `20261004180000`) after the show's latest
   published episode, or as backstory before episode 1. A beat happens during its
   episode, so linking or putting a post at a beat is refused (409) when the post is later
   in story time, an episode's own "after the episode" post included; an older wall post
   with no stamp passes as unknown. The wall shows each post's story time ("After Ep 2").

## Still to come

- Nothing on the Feed project's list. (Done since this list began: comments as records
  and reaction drafting, rule 6; the Comments zone on the records; the wall's beat
  picker, rule 5; the story clock, rule 9.)
