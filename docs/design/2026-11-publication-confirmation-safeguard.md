# Publication-confirmation safeguard — proposal

**Status.** A proposal, requested by Evoni on 2026-11-17. **Not approved, not implemented.** It is separate from the Studio Home and Episode Command Center sequence (`docs/design/2026-11-studio-home-episode-command-center.md`), which changes nothing about publication.

**Basis.** `origin/main` at `8ca49577f544b3e593ae47ff88b7df64068239ab`. Read from source; nothing was run.

**Citation style.** Code is cited by stable name (living-doc convention, `CLAUDE.md`).

---

## 1. Why

`episodes.status = 'published'` is audience-facing:

- `storyClock.presentOrder` reads it to set The Pulse's "present" — which posts, reveals, fits and recap content exist now. About 30 callers depend on it.
- `styleSheetDistributionService.releasedOn` reads it to decide whether a look appears on the public Shop the Look pages.

Nothing sets `published` automatically. It is set only by hand, the server checks nothing, and none of the controls asks first. Un-publishing the latest published episode moves the present backwards.

## 2. Every manual action that can set or clear `published`

All go through `PUT /api/v1/episodes/:id` (`episodeController.updateEpisode`), which writes whatever `status` it is sent.

| Control | Where | Can write | Asks first? |
|---|---|---|---|
| Status dropdown in the episode header | `EpisodeDetail` (`changeStatus`) | any status: Draft, Scripted, In build, In review, Scheduled, Published, Archived | No |
| Episodes board, drag a card to "Released" | `ShowEpisodesBoard` (`drop`); `STAGES` in `lib/episodePipeline.js` maps Released → `published` | `published` | No. A failure is only logged; no message |
| Episodes board, ⋯ "Move to Released" (the phone path) | `ShowEpisodesBoard` | `published` | No |
| The same three, moving **out** of Released | as above | un-publishes | No |

**Not writers of `status`:**

- **The Release Board** (`ReleaseBoard`, `releaseSchedule`). It changes release dates and the release schedule only.
- **The Distribution tab** (`EpisodeDistributionTab`). Its per-platform "published" is stored in `distribution_metadata` only.
- **"Mark Ready"** writes `in_review`.
- **Completing an episode** writes `evaluation_status`, not `status`.

**Also un-publishing, without a screen:** the ADMIN route `POST /admin/reset-character-stats` (`routes/evaluation.js`) sets every episode of a show to `draft`. No frontend caller was found.

**A wrinkle:** `stageOf` also shows `scheduled` and completed episodes in the "Released" column. A card can sit in Released without being `published`, and cannot then be dragged there to publish it.

## 3. Proposal

### P1 — the screens ask

The header dropdown, the board drag and the board menu ask before any change **to or from** Published.

The message states facts computable from data already loaded, with no new endpoint:

- whether The Pulse's present moves, and from which episode to which (`presentOrder` in `lib/storyClock.js` over the loaded episode list). Publishing an episode below the current latest does not move it; un-publishing the latest moves it back;
- whether a Shop the Look page for this episode becomes public or is withdrawn (`GET /episodes/:id/style-sheet/distribution` already returns published and released);
- that drafts tied to the episode do not become live by this action.

A failed board move shows a message. No count of "posts that would newly appear" is offered, because no existing read returns it.

**Dialog.** There is no shared confirm component; most of the app uses the browser's own confirm. `ReasonDialog` (promise-based, focus-trapped) is the better base.

### P2 — the server, report-only first

`updateEpisode` already reads the old values inside a row-locked transaction and already has a confirm pattern for filmed scripts (`confirm_filmed_edit`, enforced in `scriptSave`).

1. **Report-only:** when `status` crosses Published without a confirmation value, log it. Refuse nothing.
2. **Later, on Evoni's ruling:** refuse with 409 unless the request carries the confirmation.

### Not changed

- What `published` means, and every reader of it.
- The board's columns and `stageOf`.
- The reset route — flagged for a separate decision.

## 4. Tests

- A screen-only confirm leaves existing assertions intact (`ShowEpisodesBoard.test.jsx`, `EpisodeDetail.header.test.jsx` move cards to non-published stages). Published-path tests are additions.
- The server refusal (P2 step 2) affects `tests/integration/feedPostRelease.integration.test.js`, the one test that publishes by a direct PUT, and the `updateEpisode` unit tests need a check.

## 5. Out of scope, noted

Other audience-facing switches also ask nothing today: Pulse recap publish and unpublish, website-slot publish, feed post draft → live. The Shop the Look site publish already has a review step. A consistent pass over these is a separate piece of work.

## 6. To decide

1. P1 alone, or P1 with P2's report-only logging.
2. Whether the reset route should refuse, or ask, when it would un-publish.
3. Whether "Scheduled" should carry the same prompt.
