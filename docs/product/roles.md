# Audience identities

**As of:** 2026-11-09, against `main` at `152893c5`. The status labels are defined in the [README](README.md#status-legend).

These are the people the product serves, and the permissions each would have. **Prime Studios stays admin-only (DECIDED).** No identity here, other than Admin/Prime, gets any access to Prime Studios. Each identity below separates what is IMPLEMENTED from what is a future requirement.

| Identity | Who | Price | Status | Prime Studios access |
|---|---|---|---|---|
| Fan | Public audience: entertainment and discovery | Free (DECIDED) | Public site IMPLEMENTED in part; accounts PROPOSED | None |
| Bestie | Enhanced interactive entertainment and personalized Dream Cities | Paid, intended (DECIDED); details OPEN | PROPOSED | None |
| Creator | External student/member of Prime Creator Campus | Paid, intended (DECIDED); details OPEN | PROPOSED | None |
| Guest/Collaborator | A separate concept | — | OPEN; no new access is authorized | None |
| Admin/Prime | Evoni, the studio's only operator | — | IMPLEMENTED | Full (unchanged) |

## Naming collisions

The product identities share names with story and internal concepts. Docs, code and UI must keep them apart.

| Word | Product identity | Other meanings already in the code and canon (not identities) |
|---|---|---|
| Bestie / Besties | The paid Bestie membership | The in-story name for Lala's audience; the `bestie` relationship kind; the `bestie_newsletter` content format in `MultiProductContent` |
| Prime | Admin/Prime, the studio operator | The host persona JustAWoman (`justawoman`); Prime Coins and Prime Bank in the story economy; Prime Studios, the product itself |
| Guest | Guest/Collaborator | Event guests in the story; `CHAR.GUEST` slots in scenes |
| Creator | A Campus student/member | The fallback label in `Sidebar.jsx` (`buildNav`); "Creator Credits" in the blueprint economy (§9); creator characters in the Pulse |
| Tier | A membership level (Fan, Bestie, Creator) | Product areas (`PROJECT_CONTEXT.md` §3); feature batches in `src/routes/tierFeatures.js` |

Proposed convention (PROPOSED): in code, prefix membership concepts with `member` (for example `memberTier`, `member_accounts`). This keeps them from colliding with story fields such as `bestie` or `guest`.

## Fan

**Purpose (DECIDED):** public entertainment and discovery, with account features added later where they are needed. Free.

**IMPLEMENTED today** (anonymous; there is no account):
- the public landing at `/` (`PublicLanding`), Pulse recaps at `/pulse-recap(/:id)` and Shop the Look at `/shop-the-look(/:key)`, from `frontend/src/App.jsx`'s signed-out route branch;
- public APIs under `/api/v1/public`: `publicSite.js` (site content), `publicPolls.js` (read polls, plus an anonymous rate-limited vote through `optionalAuth`), `publicRecaps.js` and `publicLooks.js`;
- the "Collaborate" calls to action (`CollaborationSection.jsx`, `FinalCallToAction.jsx`) are `mailto:` links only. There is no form or account.

**Future requirements (PROPOSED, from blueprint §10; each needs a ruling):** a `/fan` dashboard, a profile, episodes, Lala's Closet feed, shop, community, style games, Prime Bank, rules and a Discover experience. Only the parts that genuinely need an account should create one.

## Bestie

**Purpose (DECIDED):** enhanced interactive entertainment and personalized Dream Cities experiences. Intended to be paid; pricing and entitlements are OPEN.

**IMPLEMENTED today:** nothing. The "Besties" in the code are the story audience, not members.

**Future requirements (PROPOSED, from blueprint §8 and §10):**
- everything a Fan has;
- personal closet upload with approval, and an event outfit planner;
- styling Lala with pieces from a Bestie's own closet (blueprint §8: "Besties may eventually style Lala with items from their own closets");
- Bestie Stories, Pinterest cross-posting, Pins Studio and analytics;
- inbox/DM, affiliate closet sales and selected livestream features.

**Constraints:**
- Closet approval implies a member-platform moderation function. That is reconciliation item [R3](README.md#where-the-blueprint-and-the-2026-11-09-rulings-need-reconciling-open).
- Member DMs would be new. Today's Pulse DMs (`PulseDmThread`) are between story characters only.

## Creator

**Purpose (DECIDED):** an external student/member of **Prime Creator Campus**. A Creator is not a production administrator. Intended to be paid; pricing and entitlements are OPEN.

**IMPLEMENTED today:** nothing. There is no Education Hub, Creator Circle, campus, curriculum, student rubric, mastery, submissions, community or forum code. The writing-rhythm logs track the author's own progress, not students'.

**Reconciliation (OPEN, [R1](README.md#where-the-blueprint-and-the-2026-11-09-rulings-need-reconciling-open)):** blueprint §10 describes a professional Creator HQ (AI Content Studio, Scheduler, Director Suite, funnels, growth analytics and more). Until Evoni reconciles it with the Campus ruling, none of the HQ tools is in scope for Creator.

### Prime Creator Campus requirements

**DECIDED as requirements on 2026-11-09. Not to be implemented yet.**

| # | Requirement | Acceptance criteria (for a future build) |
|---|---|---|
| CC1 | A sequential, self-paced first-time curriculum | A first-time student sees lessons in a fixed order and can pause and resume at any point |
| CC2 | Completing the required assignment unlocks the next lesson | The next lesson stays locked until the current lesson's required assignment shows essential mastery. The lock is enforced on the server, not only in the UI. |
| CC3 | Writing, video and creative-project submissions | Each type can be submitted, stored privately and evaluated against its lesson's rubric |
| CC4 | Automated, lesson-specific rubric evaluation | Each lesson has its own versioned rubric. Every evaluation records the rubric version, the scores per criterion and the outcome. |
| CC5 | Essential mastery is required; advanced challenges are optional | Each rubric marks its criteria as essential or advanced. Only the essential ones decide progression. Advanced challenges never block it. |
| CC6 | Private assignments, with selected real-world publishing | Submissions are private by default. A student publishes only by choosing to, one item at a time, and can withdraw it. |
| CC7 | Revision and resubmission | A student can revise and resubmit. Each attempt is kept with its own evaluation. |
| CC8 | Understandable feedback | Feedback names the rubric criteria that were met and not met, in plain language, with what to change next |
| CC9 | Evaluation appeals | A student can appeal an evaluation. Appeals and uncertain evaluations go to human review (see below). |
| CC10 | Free navigation after completion | After finishing the curriculum, a student can open any completed lesson in any order |
| CC11 | Student discussion and creator-controlled posts | Students can discuss with each other. A student controls their own posts (who sees them, editing, deleting). This needs a moderation design (R3). |

### Evaluation: launch design requirements

**DECIDED direction.** At launch, evaluation is automated against a rubric specific to each lesson. Routine manual grading is not planned. **Human review is only for exceptional disputes (appeals) and uncertain evaluations.**

Design requirements (PROPOSED; a design document is needed before any build):

- **Through the AI gateway.** Every evaluation call goes through the AI egress gateway: the M0 deny-by-default path and the G2 permit ledger, wired through G3/G4. The evaluator gets its own cap and Stop control. It never calls a provider directly.
- **Cost controls.** Each evaluation is logged and budget-gated the way `aiCostTracker` gates studio calls, and attributed to the feature. The design must set a ceiling on attempts per assignment, so that unlimited resubmissions cannot become unlimited spend.
- **No new paid AI dependency.** No new provider, model contract or paid service is authorized. The design must say which existing provider path it uses. Any spend beyond the current authorized budget needs a separate ruling.
- **Uncertainty routing.** The evaluator reports its confidence. An evaluation below the threshold, or one that contradicts itself, goes to human review instead of deciding progression automatically.
- **Privacy.** Student work is private by default. Only what scoring needs is sent to the provider: the submission and the rubric, with no other personal data. Retention and deletion rules are defined and member-scoped. Video submissions need a stated approach (for example a transcript or chosen frames) before any of their content is sent anywhere. Student work is never used to train a model or to feed studio content without the student's explicit consent.
- **Auditability.** The rubric version, model, inputs digest, scores, confidence and outcome are stored for each evaluation, so an appeal can be reviewed against exactly what was scored.

Reuse note: `src/routes/storyEvaluationRoutes.js` shows a working Claude scoring pattern for the author's own drafts. It is studio-only, and it is a pattern to learn from, not a component to expose.

## Guest/Collaborator

**Status: OPEN.** A separate concept from the other identities. **No new access is authorized.**

Today, collaboration is only a `mailto:` link on the public site. Blueprint §10 lists "Collaborator" among the public roles, and says Voice Studio access "must not expand to collaborators or recorders without a new ruling". That is reconciliation item [R2](README.md#where-the-blueprint-and-the-2026-11-09-rulings-need-reconciling-open). Until it is resolved, no code may give a collaborator a login, an upload path or any access to studio data.

## Admin/Prime

**Status: IMPLEMENTED; it must not change.**

- **Who:** Evoni, the only operator of Prime Studios (F-AUTH-1 amendment, 2026-10-29). Agent sessions act for her under [F-Tools-5](../audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md).
- **How:** a Cognito sign-in in the `admin` group. On the backend: `requireAuth`, and `authorize(['ADMIN'])` where it is applied. On the frontend: `authGroups.js` and `AdminOnly`.
- **Production authority (blueprint §5, §10):** production; final pause/archive approval; voice character creation and approvals. Voice Studio stays admin-only.
- Studio hardening must keep all of this working ([README § Security prerequisites](README.md#security-prerequisites-for-external-members)).

A future member-platform "admin" role (moderation, member management, closet approvals) is not the same thing as operating the studio. Whether it is a separate surface, or the same admin login doing a new kind of work, is OPEN (R3).

## Member identity (OPEN)

**The Cognito topology decision stays OPEN.** The existing register decision, [`F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`](../audit/F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md) (read with its later amendments), is about splitting the pool by environment (dev and prod, Branches A–C). It does not address members. The member-identity choice is a separate question that has to be decided alongside it. This section compares the two member approaches against the security requirements. It does not decide between them, and neither is to be implemented yet.

### Security requirements either approach must meet

1. A member token is refused by every studio API, checked on the backend (audience, issuer and group).
2. A studio token is not a member session either, unless Evoni rules otherwise. The two domains do not mix.
3. Studio sign-in policy (MFA, no self sign-up, admin-created users) cannot be weakened by member sign-up settings.
4. Member self sign-up, password reset and account deletion cannot create, change or reach studio users.
5. Membership state (tier and entitlements) is held in the member platform's own records, not in Cognito studio groups.
6. Evoni's current admin access keeps working throughout.
7. Every token-accepting path is covered, including the local HS256 path (`verifyViaHs256` and `tokenService`) and `optionalAuth`.

### Comparison

| Concern | A: separate user pool for members | B: separate app client in the existing pool |
|---|---|---|
| Isolation of the studio | Strong. Different issuer and keys. Studio users and members cannot collide. | Weaker. One user directory. Isolation depends on the audience (`client_id`/`aud`) check and on group checks. |
| What the studio verifier already does | Rejects the other pool's tokens through the issuer and pool check | Already bound to one `COGNITO_CLIENT_ID`, so other clients' tokens are refused on the Cognito path. The protection stops working if anyone reuses the studio client or widens the client list. |
| Sign-up and recovery policy | Configured on its own. Member self sign-up does not touch studio settings. | Pool-level settings (self sign-up, password policy, some MFA and recovery settings) are shared. Member needs could pressure studio security. |
| Groups and attributes | Separate group namespace | Shared groups. A mistaken group assignment could put a member in `admin`. |
| A person who is both | Two accounts (Evoni would have a separate member test account) | One account could carry both, which is convenient but mixes the domains |
| Operations | Two pools to configure, monitor and pay for. Two sets of triggers. | One pool. Fewer moving parts. |
| Blast radius of a misconfiguration | Contained to one pool | Pool-wide |
| Reversibility | Members can later be migrated, with effort | Splitting users out later is harder |
| Interaction with the existing F-AUTH-1 decision | Adds member pools alongside whatever dev/prod pool split is chosen (possibly one member pool per environment) | Adds app clients to whichever pool(s) the dev/prod split leaves; inherits that pool's settings |

Both approaches need the studio hardening in the README to land first. Under either approach, the HS256 path must not issue or accept member tokens on studio routes.

## Permissions summary

| Capability | Fan | Bestie | Creator | Guest/Collab. | Admin/Prime |
|---|---|---|---|---|---|
| Public site and recaps | Yes (IMPLEMENTED, anonymous) | Yes (PROPOSED) | Yes (PROPOSED) | Yes (public) | Yes |
| Member account | PROPOSED | PROPOSED | PROPOSED | OPEN | — (studio login) |
| Dream Cities personalization | — | PROPOSED | — | — | — |
| Creator Campus | — | — | PROPOSED | — | — |
| Any Prime Studios page or API | **No** | **No** | **No** | **No** | Yes (IMPLEMENTED) |
| Voice Studio | No | No | No | No (blueprint §10) | Yes |
| Payments | — | OPEN | OPEN | — | — |
