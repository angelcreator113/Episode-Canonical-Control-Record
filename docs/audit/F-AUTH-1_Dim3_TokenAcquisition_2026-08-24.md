> **ADDITIVE POINTER - SECTION 4.1 EXTERNALITY TERM RESOLVED (added
> 2026-08-25).**
> `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` supersedes
> section 4.1's composition-unknown/externality term for the three counted
> accounts. The client-flow finding and password-currency bound remain.
> Read the resolution document for the scoped read, operator attestation, and
> exact surviving bounds. This banner points; it does not carry.

# F-AUTH-1 — dimension 3 token acquisition: disposition and a finding on identity nature — 2026-08-24

| | |
|---|---|
| **Purpose** | Resolves the dimension 3 token-acquisition question flagged unverified at `F-AUTH-1_BranchA_ClientSecret_Addendum_2026-08-24.md`, and records what the repository establishes about the nature of the shared-pool identities. |
| **Basis** | `main` at `af67f110`. All reads local git at that commit. |
| **Disposition** | **Freeze-gated under `F-AUTH-1_Fix_Plan_v2.58.md` §2.5 — NOT PERFORMED absent authorization.** Not an availability failure under §2.3. |
| **Standing** | **Does not re-cost Branch A.** The §4 finding is stated and anchored; acting on it is substantive and belongs to whatever revision takes it up. **Mints nothing.** |
| **Discipline** | By role. No identifier, username, password, pool ID or client ID appears. The settings document was read screened, targeted at two sections, with the filter applied on output regardless of content. |
| **Authority note** | No FD, no XK, no PE. Closes no finding. Changes no gate, severity, owner or disposition. No AWS call issued. No deployed host contacted. No workflow dispatched. Prod **FROZEN**. |

---

## §1 The question

Dimension 3 is **G4 procedure executability** (`F-AUTH-1_Fix_Plan_v2.58.md` §2.3). The open question was whether G4's procedure requires acquiring a token, and if so whether one can be acquired.

**It requires it.** `F-AUTH-1_Fix_Plan_v1.5.md:409` defines G4 as including:

> Full **§7 verification checklist run end-to-end on dev. Every checkbox confirmed.**

And `F-AUTH-1_Fix_Plan_v1.5.md:451` — §7, *Post-Deploy Verification Checklist* — contains **at least twelve checkboxes** of the form *"authenticated request 200, unauth 401"*, across `storyteller.js`, `characterRegistry.js`, `evaluation.js`, `careerGoals.js`, `uiOverlayRoutes.js`, `calendarRoutes.js`, `franchiseBrainRoutes.js`, `wardrobe.js`, `outfitSets.js`, `episodes.js`, and `episodeOrchestrationRoute.js`.

One is stricter than the rest: *"`characterRegistry.js` author-only fields: **authenticated request as author** succeeds"* — a token bearing a specific identity, not merely a valid token.

---

## §2 ESTABLISHED — the application has no token-acquisition path

| Fact | Anchor |
|---|---|
| The backend login route returns 401 unconditionally, before any logic | `src/routes/auth.js:41` (route), disabled return at `:52-56`, code `AUTH_LOGIN_DISABLED` |
| It is disabled by decision, not defect — pending a ruling on whether password login should exist at all | same, in-line comment: *"Fails closed until that is ruled"* |
| The frontend's only login call targets that route | `frontend/src/services/authService.js:16` |
| The inline refresh helper cannot bootstrap — it throws without a pre-existing token | `frontend/src/services/api.js:56-57` |
| The service refresh method cannot bootstrap either | `frontend/src/services/authService.js:121-127` |
| No other writer of the stored token exists outside tests | exhaustive match over `frontend/src/` — three writers, all above |
| No OAuth redirect flow exists anywhere | exhaustive match over `src/` and `frontend/src/` — zero `redirect_uri`, callback, logout URL, or hosted-UI reference |

**`authService`'s full export surface** is login, getToken, getRefreshToken, getUser, getProfile, isAuthenticated, logout, refreshToken. **No Cognito call. No `InitiateAuth`. No redirect.**

---

## §3 The disposition — freeze-gated, not unavailable

**An out-of-band path exists.** `docs/COGNITO_USER_POOL_SETTINGS.md`'s App Clients section records the client's configured auth flows as **`USER_PASSWORD_AUTH`** and **`ALLOW_REFRESH_TOKEN_AUTH`**, and its test-user sections record two service-shaped named users and three group-mapped standard users.

`USER_PASSWORD_AUTH` is exactly the flow an `initiate-auth` call requires. **§7's authenticated-request checkboxes are therefore executable without any application login.**

**Which decides the disposition against the availability reading:**

| Reading | Verdict |
|---|---|
| Availability failure — no mechanism exists, §2.3 territory | **FALSIFIED.** The mechanism exists. |
| Available but freeze-gated — §2.5 territory | **HOLDS.** |

`F-AUTH-1_Fix_Plan_v2.58.md` §2.5 governs: an identity operation against the shared pool **is not made dev-only by the caller's environment label**, and *"freeze-gated and authorization is not given → NOT PERFORMED, not INCONCLUSIVE."*

**Dimension 3's token-acquisition question resolves to NOT PERFORMED absent authorization.** G4 does not open either way; what would unblock it is authorization, not construction.

---

## §4 FINDING — the shared-pool identities are credentials, not records

**Stated, anchored, and deliberately not acted on.**

Branch A's irreversible consequence has been described throughout as promoting **records** to permanent prod status. The App Clients configuration establishes something narrower and heavier: the pool's client permits **`USER_PASSWORD_AUTH`**.

**An identity in that pool is therefore an account capable of minting a valid token**, not an inert row. Branch A designates that pool canonical prod, and the costing's own reversibility line holds that undoing the promotion is *"Branch B, run backwards."*

**`ALLOW_REFRESH_TOKEN_AUTH` extends the same mechanism**, not a new one — a refresh token outlives whatever the password does.

### §4.1 It compounds with the externality gap

`Session_PE_Roster.md` `PE #64` Amendment 1 rules externality **NOT ESTABLISHED** — the liveness check established a count of three and nothing about composition.

Taken together, the register's position is: **three identities capable of password authentication, composition unknown, proposed for permanent prod designation.** Those two unknowns have been tracked separately. They are one exposure.

### §4.2 Bound — this must travel with the finding

**Established:** the client permits `USER_PASSWORD_AUTH`.

**NOT established:** that the three pool identities are the documented test users; that any recorded password is current; that any of them is external. **No AWS call was issued and no user record was read.** The finding is about what the configuration permits, not about who holds what.

### §4.3 Explicitly not re-costed

This document **does not re-cost Branch A** and does not amend the costing. Whether the costing's irreversible half should be restated in these terms is substantive and belongs to a revision that takes it up. Whether the costing receives a pointer to this document is a separate decision.

---

## §5 Effect on the app-client set item

`F-AUTH-1_BranchA_Prerequisite_Addendum_2026-08-24.md` §4 sequences P1 as *"names callbacks, logout URLs, domain disposition, and the no-secret client before any resource is created."*

**Two halves, resolved differently:**

- **OAuth surface — RESOLVED AS NONE REQUIRED.** No redirect flow, no hosted UI, no callback or logout URL exists anywhere in the application (§2). Specifying them for the new dev client would manufacture configuration surface for a mechanism nothing uses.
- **Auth-flow configuration — NOT RESOLVED.** The existing client's shape is `USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH`. Whether to carry `USER_PASSWORD_AUTH` forward to the new dev client is **the FD-65 question** — `src/routes/auth.js:41` records that whether password login should exist at all is unruled. **It is not a default to inherit.**

---

## §6 Recorded because it is written down nowhere

`frontend/src/services/api.js:68` opens `wipeSessionAndRedirect` with `if (import.meta.env.DEV) return;` — the session-wipe and login redirect are **skipped entirely under a dev build**.

§7 carries a checkbox reading *"Frontend interceptor sees `AUTH_REQUIRED` → redirects to login."* §7 is run on dev during G4.

**This likely does not bite**, because G4 specifies *"Frontend deployed to dev"* and a deployed build sets that flag false. **It would bite anyone running the checklist against a dev server**, and the distinction appears in no document. Recorded, not resolved.

---

## §7 What this document does not do

- Does not mint. No FD, no XK, no PE.
- **Does not re-cost Branch A**, amend the costing, or amend any addendum. §4.3.
- Does not rule the FD-65 password-login question. §5.
- Does not establish who the three pool identities are, or that any password is current. §4.2.
- Does not issue an AWS call, contact a host, dispatch a workflow, or perform any Cognito operation.
- Does not open G4 or discharge any dimension. It records a disposition.
- Discloses no identifier, username, password, pool ID, or client ID.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 G4 requires §7 end-to-end at `v1.5:409`; §7 at `v1.5:451` carries twelve-plus authenticated-request checkboxes, one requiring a specific identity. §2 seven anchored facts establishing the application has no token-acquisition path. §3 an out-of-band path exists via `USER_PASSWORD_AUTH`; the availability reading is falsified and §2.5 governs; disposition NOT PERFORMED absent authorization. §4 the shared-pool identities are password-capable accounts rather than inert records. §4.1 compounds with `PE #64`'s unestablished externality. §4.2 bound — the configuration permits the flow; nothing is established about who holds what. §4.3 explicitly not re-costed. §5 P1's OAuth surface resolved as none required; the auth-flow half left to the FD-65 ruling rather than inherited. §6 the dev-build redirect skip, recorded because it appears nowhere. §7 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-08-24. Basis `main` at `af67f110`. Records a disposition and a finding. Mints nothing. Re-costs nothing. No AWS call issued. No deployed host contacted. Prod FROZEN.*
