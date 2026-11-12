# Product knowledge base

**As of:** 2026-11-09, against `main` at `152893c5`. **Owner:** Evoni (`angelcreator113`).
**Scope:** documentation only. Nothing here authorizes production changes, authentication changes, schema migrations, subscription or payment integration, new paid AI dependencies, deploys or merges.

This folder records who the product is for and what each audience can do: what is implemented today, and what is a future requirement. It links to the existing authorities instead of repeating them. Where a statement here conflicts with one of those authorities, the authority wins, and the conflict should be raised as an OPEN item.

| File | What it holds |
|---|---|
| [`README.md`](README.md) | This index: status legend, rulings, sources, journeys, shared services, security prerequisites, the implementation sequence and where decisions live |
| [`roles.md`](roles.md) | The audience identities (Fan, Bestie, Creator, Guest/Collaborator, Admin/Prime): purpose, current state, future requirements, naming collisions, the Creator Campus requirements and the member-identity comparison |
| [`feature-registry.md`](feature-registry.md) | One row per feature: status, audience, route, API, owner document and duplicates |

## Status legend

| Label | Meaning |
|---|---|
| **DECIDED** | Evoni has ruled on the direction. A DECIDED item may still be unbuilt. |
| **PROPOSED** | A desired capability or recommended design. It needs a ruling and a check against the code before anyone builds it. |
| **IMPLEMENTED** | The code exists on `main` at the SHA above (cited by file and function name). This says nothing about whether it is deployed or enabled. |
| **VERIFIED** | Shown working in production, with linked evidence (a command and its raw output, or a register entry). No row has this label in this first version. |
| **OPEN** | Needs a ruling, a source document or a proof of concept. Do not build it until it is resolved. |
| **RETIRED** | Replaced or withdrawn. Kept for the record, with a pointer to the replacement. |

The Master Blueprint uses VERIFY for "status not established". This knowledge base treats that as "not VERIFIED"; it is not a separate label here.

## Rulings this knowledge base records

These were given by Evoni in the 2026-11-09 product session. They are recorded here so that the docs agree with each other. They do not amend anything under `docs/audit/`.

1. **Prime Studios stays admin-only (DECIDED).** This reaffirms the 2026-10-29 ruling in [`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`](../audit/F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md) §1: Prime Studios is an admin-only production environment, and Evoni is its only operator. The production-access ruling [`F-Tools-5`](../audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md) is unchanged. Fan, Bestie and Creator are customer-facing experiences. They are **not** extra permissions to operate Prime Studios.
2. **The identities are separate (DECIDED):** Fan, Bestie, Creator, Guest/Collaborator and Admin/Prime. They are kept distinct from story characters, relationships and internal feature tiers that share the same names (see [`roles.md` § Naming](roles.md#naming-collisions)).
3. **Membership pricing (DECIDED in part, OPEN in part).** Fan is free. Bestie and Creator are intended to be paid memberships. Exact pricing, subscription management, the billing provider and entitlements are **OPEN**. No payment implementation is authorized.
4. **Member identity (OPEN).** The Cognito topology decision stays open. A separate user pool and a separate app client in the existing pool are compared in [`roles.md` § Member identity](roles.md#member-identity-open). Neither is to be implemented yet.
5. **Creator Campus evaluation (DECIDED direction, not built).** At launch, evaluation is automated, using a rubric specific to each lesson; routine manual grading is not planned. Students must show essential mastery before they progress. They may revise and resubmit. Optional advanced challenges never block progression. Human review is only for exceptional disputes and uncertain evaluations. The evaluator must be built on the existing AI gateway, cost controls and privacy requirements. **No new paid AI dependency is authorized yet.** None of the Campus features may be implemented yet.
6. **Security prerequisite (DECIDED).** The studio must be hardened before any external member can sign in. That hardening means backend authorization and token audience validation, not only frontend route guards. Existing admin access must keep working. See [§ Security prerequisites](#security-prerequisites-for-external-members).
7. **Source documents (DECIDED).** The October 29 Master Blueprint exists outside GitHub and was supplied on 2026-11-09. The Public Website Redesign Blueprint is **pending** until it is located. Missing source material must not be reconstructed and presented as fact.

## Sources

| Source | Status | Where it lives | How it is used here |
|---|---|---|---|
| *Styling Adventures with Lala — Master Project Blueprint & Decision Record*, v1.0, as of 2026-10-29 | Supplied 2026-11-09 | Outside GitHub (Evoni's copy). It is not committed in this PR. | Quoted by section number (§1, §5, §8–10, §14–17). The blueprint describes itself as "a product/creative blueprint, **not a claim that every feature is built or deployed**". Its DECIDED items describe creative and product direction. They are not implementation status. |
| *Prime Studios Public Website Redesign Blueprint* | **Pending until located** | Unknown. It is cited by [`docs/design/2026-10-landing-and-stylesheet.md`](../design/2026-10-landing-and-stylesheet.md), but no copy is in the repository. | Not used. Nothing in this folder paraphrases or reconstructs it. |

### Where the blueprint and the 2026-11-09 rulings need reconciling (OPEN)

The blueprint was written before the 2026-11-09 rulings. These three points need Evoni's reconciliation before any build work. Until she rules, the 2026-11-09 rulings govern.

| # | Master Blueprint (§10) | 2026-11-09 ruling | Open question |
|---|---|---|---|
| R1 | "Creator/Pro": a professional **Creator HQ** with an AI Content Studio, Scheduler, Director Suite, Scene Packs, funnels, revenue, deals, growth analytics, the Creator Circle, education and resources | Creator is an **external student/member of Prime Creator Campus**, not a production administrator | Is Creator HQ a later stage of the Creator membership, built on top of Campus, or a separate tier? Which HQ tools, if any, are part of Creator at launch? |
| R2 | "Collaborator" is listed among the public roles | Guest/Collaborator is a separate concept, and no new access is authorized | Does Collaborator get a member identity at all? If so, what can it do? The blueprint's own rule still stands: Voice Studio access "must not expand to collaborators or recorders without a new ruling" (§10). |
| R3 | "Admin": moderation, user management, closet review/approval, episode management and settings | Prime Studios is admin-only, with Evoni as its only operator | Member-platform moderation (closet approvals, community moderation, member management) is a future member-platform function. Does it live inside Prime Studios under the existing admin login, or in a separate moderation surface? It must not create a second studio operator. |

## Audience journeys

The status of each step is in [`feature-registry.md`](feature-registry.md).

- **Visitor/Fan (IMPLEMENTED in part).** Today a visitor who is not signed in gets the public site: `/`, `/pulse-recap`, `/shop-the-look`, and an anonymous poll vote. There is no Fan account. The blueprint's homepage direction (§1, §14) is "Watch the latest episode" and "Play" calls to action, sign-in/sign-up and clear membership tiers. That direction is DECIDED in the blueprint; sign-in and sign-up for members are not built.
- **Bestie (PROPOSED).** Everything a Fan has, plus enhanced interactive entertainment and personalized Dream Cities experiences. It is intended to be paid. Nothing is built.
- **Creator (PROPOSED).** Enrol in Prime Creator Campus, then follow a sequential first-time curriculum. Each lesson unlocks only after the student shows essential mastery on the previous lesson's assignment. After completing the curriculum, the student can move freely among completed lessons. It is intended to be paid. Nothing is built. The full requirements are in [`roles.md` § Creator Campus](roles.md#prime-creator-campus-requirements).
- **Admin/Prime (IMPLEMENTED).** Evoni signs in through Cognito, is in the `admin` group and operates Prime Studios. This journey must not change.

## Shared services a member platform would reuse

All of these are **IMPLEMENTED for the studio only**. Reusing them for members is PROPOSED, and each needs its own design and ruling.

| Service | Today | Member-platform use (PROPOSED) | Owner document |
|---|---|---|---|
| AI gateway: the M0 deny-by-default egress path and the G2 permit/cap ledger (`aigw_permits`, caps, Stop) | M0 and G2 are designed. Wiring into callers is the G3/G4 work and has not started. | The Campus evaluator would make every scoring call through the gateway, under its own cap and Stop. | [`docs/design/2026-11-ai-egress-gateway-m0.md`](../design/2026-11-ai-egress-gateway-m0.md), [`docs/design/2026-11-ai-egress-gateway-g2.md`](../design/2026-11-ai-egress-gateway-g2.md) |
| AI cost tracking and budget gate (`src/services/aiCostTracker.js`) | Logs and budget-gates every studio AI call | Per-feature and per-member spend attribution for evaluation | `CLAUDE.md` § Stack; `PROJECT_CONTEXT.md` |
| Rubric-style AI scoring (`src/routes/storyEvaluationRoutes.js`) | Claude scores the author's own story drafts | A pattern for lesson rubric scoring. This is not the code to reuse as it stands: it is studio-only and was not built for third-party student work. | — |
| Lesson and newsletter drafts (`src/models/MultiProductContent.js`: the `howto_lesson` and `bestie_newsletter` formats) | Studio-side AI drafts | Possible authoring source for lesson content. These drafts are not lessons that students can take. | — |
| Media storage (S3 upload paths) | Studio uploads | Student video and creative-project submissions would need private, member-scoped storage. | — |
| Public site APIs (`src/routes/publicSite.js`, `publicPolls.js`, `publicRecaps.js`, `publicLooks.js`) | Anonymous, rate-limited reads, plus a poll vote | The base layer for the Fan experience | [`docs/design/2026-10-landing-and-stylesheet.md`](../design/2026-10-landing-and-stylesheet.md) |

## Security prerequisites for external members

**DECIDED: the studio is hardened before any external member can authenticate.** These are requirements, not designs. Each will need its own design document and ruling.

What the code does today (IMPLEMENTED, at `152893c5`):

- `src/middleware/auth.js` checks Cognito tokens with `CognitoJwtVerifier`, which is bound to `COGNITO_USER_POOL_ID` and to **one** `COGNITO_CLIENT_ID` (`getIdTokenVerifier`, `getAccessTokenVerifier`). Tokens from another app client of the same pool are therefore already rejected by the Cognito path.
- The same middleware also accepts locally minted HS256 tokens (`verifyViaHs256`, issued by `src/services/tokenService.js` through `src/routes/auth.js`). These are checked against `TOKEN_AUDIENCE` outside test.
- `authorize(['ADMIN'])` appears in 68 route files. Most studio APIs check only `requireAuth`. That means any valid token that passes the checks above reaches them, whatever its groups.
- `src/middleware/rbac.js` (admin/editor/viewer) is attached in `src/app.js` before authentication, so it has no effect. Its role model also conflicts with the admin-only ruling (contradiction C2 below).
- On the frontend, `ProtectedRoute` (in `frontend/src/App.jsx`) is defined but never used. `AdminOnly` wraps seven routes. Frontend guards are not a security boundary.

Requirements before any member login exists:

1. **Backend authorization on every studio API.** Studio routes require the studio identity (the `admin` group, the studio token audience and the studio issuer), checked on the server. A member token must fail on every studio route, not only on the routes wrapped in `authorize(['ADMIN'])`.
2. **Token audience and issuer validation on every path that accepts tokens.** This covers the Cognito path, the HS256 path and `optionalAuth`. Each path accepts only the audience it serves. Member tokens and studio tokens must never be interchangeable.
3. **Frontend guards stay a convenience only.** Hiding a page is not access control.
4. **Existing admin access is preserved.** Evoni's current sign-in and every current admin capability keep working through the change. The rollout is staged so it can be reversed.
5. **Settle the inert `rbac.js` role model** against the admin-only ruling before any member roles are added, so that member roles are never confused with studio roles.
6. **Tests prove it.** A member-shaped token is refused on a representative sample of studio routes, and on all of them by a route sweep. Admin tokens still pass.

## Implementation sequence (PROPOSED; each step needs its own approval)

1. **This knowledge base (this PR).** Docs only.
2. **Stale-banner docs PR.** Approved in principle; the exact banner text is reviewed first. It covers contradictions C1–C8 below.
3. **Member identity decision.** Evoni decides the Cognito topology (see [`roles.md`](roles.md#member-identity-open)). Docs and register only.
4. **Studio hardening.** The security prerequisites above, behind tests, with admin access preserved. It ships before any member authentication.
5. **Fan accounts.** Free. Sign-up and sign-in on the public site, on the identity chosen in step 3.
6. **Membership and entitlements design.** Pricing, billing provider, subscription management and entitlements are OPEN and need a ruling. No payment code is written before that ruling.
7. **Prime Creator Campus.** The curriculum engine and private submissions. The **automated lesson-rubric evaluator** is built on the AI gateway (wired through G3/G4) under its own cap, with cost tracking and the privacy requirements in [`roles.md`](roles.md#evaluation-launch-design-requirements). Human review is limited to disputes and uncertain evaluations. Any paid AI use needs its own authorization first.
8. **Bestie experiences.** Personalized Dream Cities and the enhanced interactive features.
9. **Reconcile the blueprint items R1–R3** before any Creator HQ, Collaborator or member-moderation work.

This order follows blueprint §16, where platform expansion is Priority E and comes after canon, the editor slice, voice and full-episode operations. It also follows blueprint §15, which keeps documentation approval, PR merge, deployment, flag enablement, worker startup and provider billing as separate decisions, each made by Evoni.

## Where decisions live

| Topic | Authority |
|---|---|
| Current code and register state | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) §1–4 and §9 (the stale-file list) |
| Agent production access | [`docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`](../audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md) |
| Admin-only studio | [`docs/audit/F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`](../audit/F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md) |
| Cognito pool topology: the dev/prod split (unresolved); member identity (OPEN, [`roles.md`](roles.md#member-identity-open)) | [`docs/audit/F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`](../audit/F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md), read with its later amendments in the register |
| Roadmap and platform | [`docs/reads/2026-11-04-consolidated-implementation-roadmap.md`](../reads/2026-11-04-consolidated-implementation-roadmap.md), [`docs/reads/2026-11-04-platform-architecture-audit.md`](../reads/2026-11-04-platform-architecture-audit.md), [`docs/reads/2026-11-04-navigation-ownership-blueprint.md`](../reads/2026-11-04-navigation-ownership-blueprint.md) (a proposal) |
| Canon and story | [`docs/CANON.md`](../CANON.md), [`docs/EVENT_EPISODE_FLOW.md`](../EVENT_EPISODE_FLOW.md), [`docs/GAMEPLAY_DIRECTOR_SPEC.md`](../GAMEPLAY_DIRECTOR_SPEC.md) |
| Visual system | [`docs/VISUAL_SYSTEM.md`](../VISUAL_SYSTEM.md), [`docs/DESIGN_DOCTRINE.md`](../DESIGN_DOCTRINE.md) |
| Public site | [`docs/design/2026-10-landing-and-stylesheet.md`](../design/2026-10-landing-and-stylesheet.md), [`docs/design/2026-10-the-pulse.md`](../design/2026-10-the-pulse.md) |
| AI gateway | [`docs/design/2026-11-ai-egress-gateway-m0.md`](../design/2026-11-ai-egress-gateway-m0.md), [`docs/design/2026-11-ai-egress-gateway-g2.md`](../design/2026-11-ai-egress-gateway-g2.md) |
| Process | [`DEVELOPMENT_WORKFLOW.md`](../../DEVELOPMENT_WORKFLOW.md), [`CLAUDE.md`](../../CLAUDE.md) |

## Known contradictions in existing docs (for the separate banner PR)

These are listed here so that readers know about them. This PR changes none of these files. The banner text will be proposed for review in a separate docs-only PR.

| # | Contradiction |
|---|---|
| C1 | Four different navigation models across the docs |
| C2 | The admin/editor/viewer roles (`src/middleware/rbac.js` and the docs that describe them) against the admin-only ruling |
| C3 | `DESIGN_TOKENS_GUIDE` blue against `docs/VISUAL_SYSTEM.md` teal |
| C4 | `.claude/desktop/PROMPT_LIBRARY.md` against F-Tools-5 |
| C5 | `WEBSITE_GO_LIVE` against F-Tools-5 |
| C6 | The `STAGE_PIP_VOICE_PLAN` keyframes against Voice Studio spec Rev 5 |
| C7 | The stale-file list in `CLAUDE.md` against `PROJECT_CONTEXT.md` §9 |
| C8 | `PROJECT_CONTEXT.md` §3 "three Book 1 casts" against `docs/CANON.md` Cast B |

## Maintaining this folder

- When a status changes, cite the evidence: the PR, the SHA, or the register entry. VERIFIED needs production evidence.
- Give rulings as dated items with the source conversation or register file. Do not silently rewrite an earlier ruling; mark it RETIRED and point to the ruling that replaces it.
- Cite code by stable name (file, component, function). Line numbers are optional.
