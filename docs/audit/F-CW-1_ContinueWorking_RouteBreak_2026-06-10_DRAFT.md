# F-CW-1 — "Continue Working" Route Break (DRAFT, discovery-complete)

> **DISCOVERY FINDING. AUTHORIZES NO CODE CHANGE. REMEDIATION DEFERRED.**
> Records a confirmed P0 navigation break in the "Continue Working" workflow
> router. Shape-A remediation ruled out by evidence; shape-B (repoint emitters)
> required but destination selection is a deferred product call. Not canon.

| Field | Value |
|---|---|
| **Finding** | F-CW-1 |
| **Severity** | P0 (user-facing dead navigation, mid-workflow) |
| **Status** | SUPERSEDED — remediated by PR #773 (`16ddf341`). Discovery record retained below as at-filing evidence. |
| **Discovered** | 2026-06-10 |
| **Verified against** | live working tree at HEAD `0f0bf76b` (`frontend/src/App.jsx`, `frontend/src/utils/workflowRouter.js`) |
| **Authorizes** | nothing — discovery record only. Remediation authority: PR #773. |

> **SUPERSEDE NOTE (post-remediation):** Shape-B repoint landed via PR #773
> (squash `16ddf341` on main). The two deferred destinations were selected and
> validated against the live route table: `scripted → /episodes/${id}/plan`
> (`ScenePlannerPage`) and `in_review → /episodes/${id}/review` (`EpisodeReview`).
> The "destination deferred" / "out of scope" language in the body below reflects
> the discovery-time state and is retained unaltered as the at-filing record.

> **POST-REMEDIATION COPY REVIEW (2026-06-13):** Following the PR #773 repoint,
> the `STATUS_CONFIG` display copy (`nextSteps`) and the requirement-gate labels
> (`{id, label, required}` map) were reviewed for drift against the new route
> targets. Both were found already consistent with the repointed stages and
> require no change. Specifically, the `in_review` gate item
> `{ id: 'animatic', label: 'Animatic preview ready', required: true }` describes
> a gate *condition* (the review artifact exists), not the button destination;
> it remains accurate after the route moved to `/episodes/${id}/review`. No copy
> edit was made. This note retires the deferred copy-pass item as resolved-no-change.

## Summary

The "Continue Working" button computes its navigation target from
`getWorkUrl(episode)` in `frontend/src/utils/workflowRouter.js`, which returns
`STATUS_CONFIG[status].route(episode.id)`. Two of the six status emitters
produce route paths that have **no matching `<Route>`** declared in
`frontend/src/App.jsx`. Clicking "Continue Working" on an episode in either of
those two statuses navigates to a dead route.

## Repro condition

The break is **status-scoped**, not total. It fires only for episodes whose
`status` is `scripted` or `in_review`. The other four statuses resolve to
declared routes and work correctly.

## Confirmed breaks

| Status | Emitted path (`workflowRouter.js`) | Declared in `App.jsx`? |
|---|---|---|
| `scripted` | `/episodes/${id}/scene-composer` | **NO — break** |
| `in_review` | `/episodes/${id}/animatic-preview` | **NO — break** |

## Confirmed-good emitters (for completeness; no action)

| Status | Emitted path | Declared route |
|---|---|---|
| `draft` | `/episodes/${id}/edit` | yes |
| `in_build` | `/episodes/${id}/timeline` | yes |
| `scheduled` | `/episodes/${id}/review` | yes (`/episodes/:episodeId/review` → `EpisodeReview`) |
| `published` | `/episodes/${id}` | yes |

`scheduled` was explicitly checked during this discovery because its emitted
path is the same shape class as the broken ones; it is **confirmed present**, so
there is no third break.

## Shape-A remediation (restore missing screens) — RULED OUT

Adding the two routes would require components to render. Evidence shows neither
exists:

- No file named `SceneComposer`, `AnimaticPreview`, or `Animatic` anywhere under
  `frontend/src` (excluding `node_modules`).
- No live import or render of symbol `SceneComposer` or `AnimaticPreview`.
- The only surviving reference is a comment in `frontend/src/pages/ExportPage.jsx`
  stating the inline preview replaces the **deprecated** SceneComposer — i.e.
  SceneComposer was removed by intent. AnimaticPreview was never present as a
  component.

Restoring these would mean building new product surface, which is out of scope
for a route-break hygiene fix and would constitute scope creep.

## Shape-B remediation (repoint emitters) — REQUIRED, destination deferred

The fix is to change the two `route:` emitters in `STATUS_CONFIG` to point at
routes that already exist and serve the workflow stage. The mechanical edit is
trivial; the **destination choice is a product decision** and is deliberately
deferred out of this discovery record.

Candidate destinations observed in the live route table (not selected here):

- **`scripted`** — candidate: `/episodes/${id}/plan` (`ScenePlannerPage`).
  Episode-scoped and matches the "design scenes" stage. Non-episode-scoped
  routes (`/scene-studio`, `/scene-library`) are likely wrong for a per-episode
  continue.
- **`in_review`** — candidates: `/episodes/${id}/timeline` (`TimelineEditor`,
  where the animatic lives) or `/episodes/${id}/review` (`EpisodeReview`).
  `/episodes/${id}/composer` (`TemplateStudio`) covers the thumbnail step but is
  a partial fit.

## Open question for remediation session

Select the two destinations. Before committing, confirm each chosen route
actually renders a sane surface for that workflow stage (do not repoint at
another dead or mismatched route). Remediation is a separate session per Path A
discovery/remediation separation.

**Out of scope (binding):** destination selection is out of scope for this
finding. Remediation must choose and validate targets against the active route
table in `frontend/src/App.jsx` before commit.
