| **PRIME STUDIOS** **F-AUTH-1 — TIER 5 DEV-TOKEN CARRIER, SHAPE A CLAUSE 3 — ADDITIVE AMENDMENT** *Clause 3's conclusion stands; its second sentence is outdated, not disturbing. Mints nothing. Does not authorize Shape C.* |
| --- |

**Document version**

v1.0 — **RULES ON CLAUSE 3'S STANDING, NOT ON A NEW MATTER.** Additive
amendment to `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md`, filed
as a new document because the original is merged and immutable. Does not
edit, retract, or restate the original ruling — cites it and records
what has changed around it.

**Basis:** `origin/main` at `e01d6faf6cb17a8e660e8d0866cc6bb12ebcc793`,
2026-09-15 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-15T23:29:10-04:00`).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni**, given directly in session, transcribed verbatim
below — see §2.

**Status**

**Amendment. Rules one matter, on Evoni's word.** Shape A's clause 3
conclusion — the dev-token carrier does not touch FD-65 — stands.
Clause 3's second sentence, describing `/login`'s pre-2026-09-15 state,
is superseded by `PR #1457` and does not disturb the conclusion, because
the conclusion rests on clause 2's mechanism, not on `/login`'s state.
Shape C remains unruled, exactly as the original ruling left it. Mints
nothing. Prod **FROZEN**.

---

# §1. Why this needed checking

`F-AUTH-1_v272RulingAuthorityBanner_ContextSplit_2026-09-16.md` §5 cited
`F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` §6.3's
disposition table, which found clause 3's second sentence **Contradicted**
by `PR #1457`: `/login` no longer returns `401 AUTH_LOGIN_DISABLED`
unconditionally. Neither of those documents rules whether that
contradiction disturbs Shape A's own conclusion — both are reads, not
rulings, and both leave the question to Evoni. This amendment closes it.

**Quoted from `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md` §3,
clauses 2 and 3, verbatim, no word altered:**

> 2. It is a CARRIER, not a SOURCE. It mints nothing, calls no backend
>    endpoint, and creates no new way to obtain a token. The token is
>    minted out of band on the laptop via tokenService and carried in.
>
> 3. Therefore it does not touch FD-65. POST /api/v1/auth/login continues
>    to return 401 AUTH_LOGIN_DISABLED unconditionally, on every
>    environment, unchanged. This ruling does not reopen FD-65 and does
>    not authorize a backend dev-only token endpoint (Shape C), which
>    remains unruled.

Clause 3 opens with **"Therefore"** — its conclusion is explicitly
derived from clause 2 in the original ruling's own words, not something
this amendment is inferring on its own. Clause 2's mechanism (mints
nothing, calls no backend endpoint, creates no new way to obtain a
token; the token is minted elsewhere and carried in) makes no reference
to `/login` or its response code anywhere in its text.

---

# §2. The ruling

**Composed by Evoni directly, in her own words, in this session's
conversation — not proposed by the drafting session for her approval.
The session's role was to verify the ruling's factual premises against
the original ruling document's own text — read whole, from line 1 —
before filing, not to draft its wording. Transcribed verbatim below; no
word altered.**

> **Ruling (Evoni, 2026-09-16).** Clause 3's conclusion stands: the
> dev-token carrier does not touch FD-65. The reason is clause 2's
> mechanism — the carrier mints nothing, calls no backend endpoint, and
> creates no new way to obtain a token; it moves a token minted
> elsewhere. That reasoning does not depend on `POST
> /api/v1/auth/login`'s state. Clause 3's second sentence — that
> `/login` returns 401 `AUTH_LOGIN_DISABLED` unconditionally — was
> descriptive of the environment at the ruling's own basis and was
> superseded by PR #1457 on 2026-09-15. Its being outdated does not
> disturb the ruling. Shape A stands as ruled; a backend dev-only token
> issuance endpoint (Shape C) remains unruled and is not authorized by
> this.

---

# §3. What this amendment does not do

- **Does not edit, retract, or restate**
  `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md`. That document
  stands exactly as merged; this is an additive record beside it, per
  the register's newest-first-banner convention for post-merge
  corrections.
- **Does not authorize Shape C** (a backend dev-only token issuance
  endpoint). The original ruling left it unruled; this amendment leaves
  it exactly as unruled as it found it — the closing sentence of §2's
  ruling is a carry-forward of the original ruling's own §4 and clause
  3, not a new statement about Shape C.
- **Does not touch FD-65's issuance half.** That standing is ruled
  separately, in `F-AUTH-1_Fix_Plan_v2.73.md`. This amendment's own
  ruling is explicit that clause 3's conclusion does not depend on
  `/login`'s state either way.
- **Does not mint** an FD, XK, or PE number.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: additive amendment to a merged, immutable ruling document. Mints
nothing. No host, AWS, database, or Cognito contact. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-16. Basis: `origin/main` at
`e01d6faf6cb17a8e660e8d0866cc6bb12ebcc793`.*
*Authority: `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md` (cited,
not edited), Evoni's ruling at §2 (ATTESTED — composed and typed by her
directly in this session's conversation).*
