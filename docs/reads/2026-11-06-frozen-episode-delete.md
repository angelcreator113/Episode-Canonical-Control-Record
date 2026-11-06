# A filmed episode is not deleted, and its event does not start again (A1.2c)

**Status:** a living note on how the rule works in code. The ruling is Evoni's Q-7 of 2026-11-06; the design is A1.2-SPEC-v5 §8.

## Filmed

An episode is **filmed** (frozen) once `episode_raw_clips` holds any row for it, including removed clips. This is the same definition as the Start snapshot freeze (A1.2a, `src/utils/snapshotFreeze.js`).

A1.2c keeps its own small module, `src/utils/frozenEpisode.js`, so it can be merged or reverted without A1.2a.

## Layer 1: delete

`DELETE /episodes/:id` checks and deletes in one transaction, under the episode lock (`lockEpisodes`, FOR UPDATE).

- **A filmed episode is refused** with 409 `EPISODE_SNAPSHOT_FROZEN`: for every role (admins included) and for `?hard=true`.
- **A clip and a delete take turns.** A clip attaches under FOR SHARE on its episode, so either the delete is refused, or the clip finds the episode already deleted.

## Layer 2: restart

Sometimes a filmed episode is deleted outside the app, by SQL. Its event then never starts or joins another episode again.

- **Which episodes count:** the deleted, filmed episode the event names through `world_events.used_in_episode_id`, or through a brief's `event_id`.
- **The refusal:** 409 `EVENT_EPISODE_FROZEN`. It applies to:
  - Start;
  - `generate-episode-from-many`;
  - inject.
- **When it is asked:**
  - before any model call, through `findStartBlockers`, which the readiness check (`start-readiness`) also lists as `episode_frozen`;
  - again under the event lock, inside Start's transaction and inject's transaction.

**Regenerate** replaces a live episode and is not asked this. A1.2a refuses regenerating a filmed episode.

## Relink guards (merge-readiness audit, 2026-11-06)

Two edits could still attach such an event to another episode. Both now refuse it with 409 `EVENT_EPISODE_FROZEN`, and a refused request writes nothing:

- **The event edit:** `PUT /world/:showId/events/:eventId` with `used_in_episode_id`. The terms lock protects the link only while the event's episode is live.
- **The brief edit:** `PUT /episode-brief/:episodeId` naming `event_id` on a brief that has none.

**How the check runs** (`assertEventRelinkAllowed` in `src/utils/frozenEpisode.js`), in the save's own transaction:
1. It locks every episode the event is linked to, plus the target episode, FOR UPDATE in id order (episode-first).
2. Then it locks the event row.
3. If a link appeared in between, it stops with a retryable 409 (`EVENT_LINK_CHANGED_RETRY`).

A clip attaching (FOR SHARE) or a delete in progress on one of those episodes therefore takes turns with the check. This matters because an upload that began before an unfilmed episode was deleted can still attach its clip afterwards.

**Not refused:**
- re-sending the stored link;
- clearing the link;
- an unfilmed history;
- any unrelated edit.

**Not changed:** the schema, the unique index on `world_events.used_in_episode_id`, and the event–episode relationship.

## The pages

The Episodes board and the episode page show the server's reason when a delete is refused. They do not pre-disable Delete, because the list does not carry the filmed state. The server is the authority in either case.
