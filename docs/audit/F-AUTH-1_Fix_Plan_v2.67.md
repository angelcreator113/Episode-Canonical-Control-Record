| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Closes FD-65. Issuance half CLOSED-BY-REMOVAL.* |
| --- |

**Document version**

v2.67 — **CLOSES FD-65.** Its privilege half was closed at v2.50 (`75ac05f0`).
Its issuance half is closed here as **CLOSED-BY-REMOVAL**, not as CLOSED, with
a reactivation condition attached. `POST /api/v1/auth/login` returns `401
AUTH_LOGIN_DISABLED` unconditionally on `main` (`e5215a66`) and on the
production host.

**Closes no other finding.** FD-63, FD-67 and FD-68's successor work are
untouched. **Mints nothing** — FD tail remains **FD-69** (spent on a duplicate,
retired at PR #1102); XK tail **XK-3**; PE tail **PE #67**.

Dimension 3 remains **NOT PERFORMED**; limb 3 open; G4 not enterable;
ASSESSMENT NOT COMPLETED. Prod FROZEN.

**Basis:** `origin/main` at `d2169d87`, 2026-08-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Ruling. Closes one finding by a qualified disposition. Ships no code — the code
it records was authorized and landed separately.

---

# §1. What was open

v2.49 minted **FD-65** at **P0** and partitioned it:

> *"The authentication surface issues signed tokens to unauthenticated callers
> at two endpoints, and permits those callers to specify their own privileges…
> **Fixing the privilege half without the issuance half looks like a fix and is
> not.**"*

**The privilege half closed at v2.50** — `75ac05f0` removed caller-supplied
`groups`/`role` from `/login` and deleted `/test-token`.

**The issuance half remained open, at P0, and v2.50 said so.** So did
`tests/integration/f-auth-1-fd65.test.js`'s header, in terms: *"An anonymous
caller supplying any well-formed email and any six-character password still
receives a valid signed token… FD-65 remains OPEN and P0."*

It stayed open from v2.49 until this revision.

# §2. What changed

`POST /api/v1/auth/login` now returns **`401 AUTH_LOGIN_DISABLED`** as the
first statement of its handler body — an insert-only change, nothing removed,
no branching.

- **On `main`:** landed at **`e5215a66`** (PR #1100), with test coverage
  restructured rather than deleted.
- **On the production host:** applied directly 2026-08-22 under explicit
  authorization, and **verified closed** — 401 to the normal path, to a
  case-variant path, to an `groups:["ADMIN"]` attempt, and externally through
  the ALB on both hostnames.

# §3. The ruling — CLOSED-BY-REMOVAL, and why not CLOSED

**Ruling: FD-65's issuance half is CLOSED-BY-REMOVAL. FD-65 is closed.**

**The finding's claim is now false.** It held that unauthenticated callers
obtain signed tokens from `/login`. They do not; the route issues nothing.
Issuance through that path is stopped, **and stopped in the strongest available
way** — not by repairing verification, which could be got wrong, but by
removing the function.

**"CLOSED" is nevertheless the wrong word.** It ordinarily means the system now
does correctly what it was doing incorrectly. **Here it does nothing.** A plain
CLOSED would assert a verification contract that does not exist.

**And it would hide the finding from the person who most needs it.** Someone
re-enabling password login would be doing feature work, reading feature
history — not scanning closed P0s. **A qualified disposition puts the finding
in the path of the person who would otherwise reopen the defect without
knowing it.** That is the same reasoning that placed the deploy warning in
`deploy-production.yml` rather than in `auth.js`: put the record where whoever
would undo it will be looking.

**What is being closed, described honestly:** password login was a development
affordance. It shipped to production and stayed there for seven months.
Cognito is the actual authentication path, and always was.

# §4. Reactivation condition

**If `POST /api/v1/auth/login` is re-enabled in any form, FD-65's issuance half
reopens as a precondition of that work, not as a discovery after it.**

The re-enabling instrument must state, before the route serves again:

1. what verifies the credential;
2. what the token carries, and that it is not caller-supplied; and
3. how both are tested — the assertions skipped at
   `tests/integration/f-auth-1-fd65.test.js` behind `LOGIN_DISABLED` are
   restored by setting that constant to `false`, and they must pass.

**This condition is carried in three places so it cannot be missed from any of
them:** here; in the handler comment at `src/routes/auth.js`; and in the named
`LOGIN_DISABLED` constant in the test file.

## §4.1 A sharper condition for the production host specifically

**Production is not running `main`.** Per the provenance instrument, its code
arrived as debris from a failed deployment on 2026-06-27 and **predates
`75ac05f0`**.

**So the production box still contains the privilege-half defect**, dormant
only because the endpoint is disabled. **Re-enabling login on production's
current code would restore not just issuance but the ADMIN escalation** —
`groups` taken from the request body, `requireGroup('ADMIN')` not holding.

**Re-enabling on production is therefore gated on production first receiving
`75ac05f0`**, which means a recorded deployment, which means the transport
question at the provenance instrument §8.

# §5. What this does not do

- **Does not close FD-63, FD-67, or FD-68's successor procedure work.**
- **Does not implement credential verification** and does not rule whether
  password login should exist. §4 makes that a precondition of re-enabling,
  not a decision taken here.
- Does not bring production up to date, and does not authorize a deployment.
- Does not withdraw v2.50's privilege-half closure, which stands on `main`.
- **Mints nothing, advances no tail, and changes no gate.** Dimension 3, limb
  3 and G4 are untouched.
- Does not act on the provenance instrument's three proposed dispositions.

---

*Type: finding closure by qualified disposition. Closes FD-65; issuance half
CLOSED-BY-REMOVAL with a reactivation condition. Mints nothing. No host
contacted by this revision. Prod FROZEN.*
