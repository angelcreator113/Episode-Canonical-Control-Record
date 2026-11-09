# Feature registry

**As of:** 2026-11-09, against `main` at `152893c5`. The status labels are defined in the [README](README.md#status-legend). The identities are defined in [`roles.md`](roles.md).

Each row is one audience-facing capability.

- **IMPLEMENTED** means the code exists on `main`. It does not mean the feature is deployed or enabled.
- **VERIFIED** needs linked production evidence. No row has it yet.
- **PROPOSED** rows come from the Master Blueprint (an external source, supplied 2026-11-09) or from the 2026-11-09 rulings. They need a ruling and a check against the code before they are built.
- "Duplicates / overlaps" lists existing code or docs a builder must reconcile with, rather than building alongside.

Studio-internal features (Producer Mode, WriteMode, the Story Engine, Voice Studio, the Phone Hub and so on) are not listed. They belong to Admin/Prime and are covered by `PROJECT_CONTEXT.md` and their own design docs.

## Public site (Fan, anonymous)

| ID | Feature | Status | Audience | Route | API | Owner document | Duplicates / overlaps |
|---|---|---|---|---|---|---|---|
| F-01 | Public landing page | IMPLEMENTED | Visitor/Fan | `/` (`PublicLanding`, signed-out branch of `App.jsx`) | `GET /api/v1/public` (`publicSite.js`) | [`docs/design/2026-10-landing-and-stylesheet.md`](../design/2026-10-landing-and-stylesheet.md); the Public Website Redesign Blueprint is **pending** | Signed-in users get the studio `Home` at `/` instead |
| F-02 | Pulse recaps | IMPLEMENTED | Visitor/Fan | `/pulse-recap`, `/pulse-recap/:id` (`PublicRecap`) | `/api/v1/public/recaps` (`publicRecaps.js`) | [`docs/design/2026-10-the-pulse.md`](../design/2026-10-the-pulse.md) | The same page is also mounted in the signed-in branch |
| F-03 | Shop the Look | IMPLEMENTED | Visitor/Fan | `/shop-the-look`, `/shop-the-look/:key` (`PublicShopLook`) | `/api/v1/public/looks` (`publicLooks.js`) | Landing design doc | Blueprint §9 "Shop Lala's Look" (revenue): commerce is OPEN |
| F-04 | Anonymous poll vote | IMPLEMENTED | Visitor/Fan | Within the public pages | `GET /api/v1/public/polls`, `POST /api/v1/public/polls/:id/vote` (`publicPolls.js`; rate-limited, `optionalAuth`) | Landing and Pulse design docs | Blueprint §17 item 7: poll voting limits are OPEN |
| F-05 | "Collaborate" contact | IMPLEMENTED (`mailto:` only) | Visitor | Landing section (`CollaborationSection.jsx`, `FinalCallToAction.jsx`) | None | Landing design doc | Not the Guest/Collaborator identity; no access is implied |
| F-06 | Homepage "Watch" and "Play" calls to action, membership tiers shown | PROPOSED (direction DECIDED in blueprint §1, §14) | Visitor/Fan | `/` | — | Master Blueprint §1, §14; the redesign blueprint is pending | F-01 |

## Member accounts and membership

| ID | Feature | Status | Audience | Route | API | Owner document | Duplicates / overlaps |
|---|---|---|---|---|---|---|---|
| M-01 | Studio hardening (backend authorization, token audience validation) | PROPOSED; **a prerequisite** (DECIDED) | Admin/Prime (protects the studio) | — | All studio APIs; `src/middleware/auth.js` | [README § Security prerequisites](README.md#security-prerequisites-for-external-members) | `src/middleware/rbac.js` (inert; C2) |
| M-02 | Member identity (Cognito topology) | OPEN | Fan, Bestie, Creator | — | — | [`roles.md` § Member identity](roles.md#member-identity-open); the F-AUTH-1 topology decision | The studio pool and `COGNITO_CLIENT_ID` |
| M-03 | Fan sign-up and sign-in | PROPOSED | Fan | — | — | Blueprint §1, §10 | Today's `/login` is the studio login |
| M-04 | Membership tiers and entitlements | OPEN (Fan free, Bestie and Creator paid: DECIDED) | Fan, Bestie, Creator | — | — | Blueprint §10, §17 item 10 | `src/routes/tierFeatures.js` uses "tier" for feature batches, not memberships |
| M-05 | Subscription, billing provider and payments | OPEN; **not authorized** | Bestie, Creator | — | — | Blueprint §9 ("Confirm legal, payment, tax and platform constraints before activation"), §17 item 10 | — |
| M-06 | Member profile | PROPOSED | Fan, Bestie, Creator | `/fan` (blueprint) | — | Blueprint §10 | Story character profiles (Character Registry): different records |

## Fan experience (from blueprint §10)

| ID | Feature | Status | Audience | Owner document | Duplicates / overlaps |
|---|---|---|---|---|---|
| FN-01 | `/fan` dashboard | PROPOSED | Fan | Blueprint §10 | — |
| FN-02 | Episodes to watch | PROPOSED | Fan | Blueprint §1, §10 | The studio episode pipeline (`EVENT_EPISODE_FLOW.md`) is the production side |
| FN-03 | Lala's Closet feed | PROPOSED | Fan | Blueprint §10 | The studio wardrobe routes (`wardrobe`) are the production side |
| FN-04 | Style games | PROPOSED | Fan | Blueprint §8, §10 | `GAMEPLAY_DIRECTOR_SPEC.md` (the in-episode styling game) |
| FN-05 | Prime Bank and coins | PROPOSED | Fan | Blueprint §9 | The story economy (Prime Coins) in canon; real-money value is OPEN (M-05) |
| FN-06 | Community and Discover | PROPOSED | Fan | Blueprint §10, §11 | The Pulse (story-character social simulation) is fiction, not member community |

## Bestie experience

| ID | Feature | Status | Audience | Owner document | Duplicates / overlaps |
|---|---|---|---|---|---|
| B-01 | Personalized Dream Cities | PROPOSED (purpose DECIDED) | Bestie | 2026-11-09 ruling; blueprint §2 (city map) | DREAM cities in canon and the Show Bible |
| B-02 | Personal closet upload with approval | PROPOSED | Bestie | Blueprint §10 | Needs member-platform moderation (R3) |
| B-03 | Style Lala with a Bestie's own closet pieces | PROPOSED | Bestie | Blueprint §8, §10 | FN-04, `GAMEPLAY_DIRECTOR_SPEC.md` |
| B-04 | Event outfit planner | PROPOSED | Bestie | Blueprint §10 | Studio event and wardrobe tools |
| B-05 | Bestie Stories, Pinterest cross-posting, Pins Studio, analytics | PROPOSED | Bestie | Blueprint §10 | `bestie_newsletter` in `MultiProductContent` is studio content, not member stories |
| B-06 | Inbox and DM | PROPOSED | Bestie | Blueprint §10 | `PulseDmThread` is between story characters only |
| B-07 | Affiliate closet sales | PROPOSED; commerce OPEN | Bestie | Blueprint §9, §10 | M-05 |
| B-08 | Selected livestream features | PROPOSED | Bestie | Blueprint §10 | — |

## Creator: Prime Creator Campus

Requirements CC1–CC11 are in [`roles.md` § Creator Campus](roles.md#prime-creator-campus-requirements). **None are to be implemented yet.**

| ID | Feature | Status | Audience | Owner document | Duplicates / overlaps |
|---|---|---|---|---|---|
| C-01 | Sequential, self-paced curriculum, with assignment-gated unlocking | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC1, CC2 | `howto_lesson` drafts in `MultiProductContent` (an authoring source, not a curriculum) |
| C-02 | Writing, video and creative-project submissions (private by default) | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC3, CC6 | Studio S3 upload paths; member-scoped storage is needed |
| C-03 | Automated lesson-rubric evaluation, with essential and advanced criteria | PROPOSED (launch direction DECIDED) | Creator | `roles.md` CC4, CC5, § Evaluation | `storyEvaluationRoutes.js` (a pattern only); must run through the AI gateway (M0/G2, wired by G3/G4) and `aiCostTracker`; **no new paid AI dependency authorized** |
| C-04 | Revision, resubmission and understandable feedback | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC7, CC8 | — |
| C-05 | Appeals and human review for disputed or uncertain evaluations | PROPOSED (requirement DECIDED) | Creator; reviewed by Admin/Prime | `roles.md` CC9 | Who reviews, and in which surface, is OPEN (R3) |
| C-06 | Free navigation after completion | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC10 | — |
| C-07 | Selected real-world publishing | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC6 | — |
| C-08 | Student discussion and creator-controlled posts | PROPOSED (requirement DECIDED) | Creator | `roles.md` CC11 | Needs a moderation design (R3) |
| C-09 | Creator HQ professional tools (AI Content Studio, Scheduler, Director Suite, funnels, growth analytics) | OPEN (R1) | Creator? | Blueprint §10 | Studio tools of the same names are admin-only and are not to be exposed |
| C-10 | Creator Circle, education and resources | OPEN (R1) | Creator | Blueprint §10 | C-01, C-08 |

## Guest/Collaborator and Admin/Prime

| ID | Feature | Status | Audience | Owner document | Notes |
|---|---|---|---|---|---|
| G-01 | Collaborator access of any kind | OPEN; **no new access authorized** | Guest/Collaborator | `roles.md` § Guest/Collaborator (R2) | Voice Studio stays closed to collaborators (blueprint §10) |
| A-01 | Prime Studios operation | IMPLEMENTED | Admin/Prime | F-AUTH-1 amendment 2026-10-29; F-Tools-5 | Must keep working through M-01 |
| A-02 | Member-platform moderation (closets, community, member management) | OPEN (R3) | Admin/Prime | Blueprint §10 | Must not create a second studio operator |

## Changing this registry

- Add a row before building a member-facing feature. Give it an owner document.
- When a row's status changes, cite the PR or SHA (IMPLEMENTED) or the production evidence (VERIFIED).
- Retire a row by marking it RETIRED with a pointer to its replacement. Do not delete it.
