| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Records a code defect in the exchange `v2.73` cited for precondition 1, and its fix. Precondition 1's MET status is unchanged; what changes is that the exchange is now capable of succeeding against this pool's actual client, which it previously was not. Mints no new numbers. Does not close FD-65's issuance half — that remains Evoni-gated.* |
| --- |

**Document version**

**v2.74 — FIX PLAN REVISION. Mints no new numbers. Records a defect in
the `InitiateAuth` exchange `v2.73` §3 cited as satisfying precondition
1, and the fix that closes it.** Does not re-rule `v2.73`'s precondition
1 MET status — that status was about the handler performing a real
Cognito exchange, which it always did. This revision adds a fact `v2.73`
did not have: the exchange, as shipped at `v2.73`'s basis, could not
have succeeded against this pool's actual app client. That is now fixed.
Whether the exchange succeeds against the live pool remains **unproven**
by this document — that is a separate, Evoni-gated question, deliberately
not answered here.

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.73.md`. **v2.73's ruling stands
and is not re-ruled here** — FD-65's issuance half remains REOPENED,
discharge/closure proceeds in the two stages `v2.73` §3 established,
precondition 3 remains NOT MET as `v2.73` recorded it, and closure still
requires live pool verification, Evoni's, unchanged. This document
narrows precondition 1's evidentiary basis; it does not alter its
disposition.

**Basis:** `origin/main` at `1c578b71ae4a98ce83970b7f180a0b25fe6d79d3`,
2026-09-16 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-16T09:36:45-04:00`).

```
$ git log --oneline v2.73-basis..origin/main -- src/services/cognitoPasswordAuthService.js
1c578b71 fix(auth): make Cognito SECRET_HASH conditional on client having a secret (#1472)
```

FD tail, XK tail, and PE tail are unchanged from `v2.73`'s own
re-derivation: FD tail **FD-69** (retired; **FD-70** next-available,
unminted), XK tail **XK-3**, PE tail **PE #68**. No FD, XK, or PE has
been minted or retired between `v2.73`'s basis and this one.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Revision. Records a defect-and-fix pair, drafted this session, owed
Evoni's review before it stands as ruling.** FD-65's issuance half
remains **REOPENED** exactly as `v2.73` left it. Precondition 1 remains
**MET** — unchanged label — but this document adds the fact that the
mechanism satisfying it was, until `1c578b71`, incapable of succeeding
against the pool's one actual app client. Precondition 3 remains **NOT
MET**, unchanged from `v2.73`. Closure remains gated on live pool
verification, unowned by any agent session. Prod **FROZEN**.

---

# §1. What `v2.73` recorded, and what this revision adds to it

`v2.73` §3 recorded precondition 1 as MET on this basis:

> *"Preconditions 1 and 2 are MET, confirmed at
> `F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` §5: the
> handler performs a real Cognito `InitiateAuth` exchange, and its
> response is built from the id token's claims, never from the request
> body."*

That confirmation was, and remains, accurate on its own terms: the
handler does perform a real `InitiateAuth` call, and its response shape
is built from claims, not caller input. Precondition 1, as `v2.67` §4
defined it ("what verifies the credential"), asks whether the mechanism
is a real credential-verifying exchange — not whether that exchange
currently succeeds against any particular pool's configuration. On that
narrow reading, `v2.73`'s MET label was correct and remains correct.

**What `v2.73` did not have, and could not have had:** a live measurement
of the pool's actual app client. That measurement happened in this
session, under the `aws` allowlist `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md`
and its amendment established (both merged same-day, ahead of this
finding):

```
$ aws cognito-idp list-user-pool-clients --user-pool-id us-east-1_mFVU52978 --region us-east-1 --query "UserPoolClients[].{ClientId:ClientId,ClientName:ClientName}"
[
    {
        "ClientId": "lgtf3odnar8c456iehqfck1au",
        "ClientName": "episode-metadata-api-client-dev"
    }
]
```

One client in the pool, matching local `.env`'s configured
`COGNITO_CLIENT_ID`. A `describe-user-pool-client` read on that same
client id (same session, same basis) returned `ClientSecret != null` as
`false` — this client has no secret.

`cognitoPasswordAuthService.js`, as it stood at `v2.73`'s basis, computed
and sent `SECRET_HASH` unconditionally on every `InitiateAuth` call —
an assumption `#1456`'s task premise stated as given ("the client has a
secret") rather than one the code read from configuration. Cognito
rejects a `SECRET_HASH` parameter sent to a client that has none, with
an error that does not read as "wrong credential" or "needs a password
reset" — it reads as something unrelated to the actual cause. Against
this pool's one actual client, the exchange `v2.73` cited as satisfying
precondition 1 **could not have succeeded**, for any credential, correct
or not.

---

# §2. The fix, and what it changes about precondition 1's standing

`PR #1472`, merged `1c578b71ae4a98ce83970b7f180a0b25fe6d79d3` same-day:
`SECRET_HASH` is now computed and sent only when `COGNITO_CLIENT_SECRET`
is configured; omitted entirely otherwise, with one log line on the
secret-less path (`no secret configured, SECRET_HASH omitted`). A new
test asserts no `SECRET_HASH` key is sent when the secret is absent —
the test whose absence let the original defect through unnoticed. 13/13
tests passing at this basis.

**This closes the code defect.** It does not, and structurally cannot,
close the behavioral question. The fix establishes that the exchange is
now *shaped* to succeed against this pool's actual client — it does not
establish that it *does* succeed for a real credential. Only a live
`InitiateAuth` call against the real pool shows that, and per `v2.73`
§3's own ruling, unchanged here, no agent session performs it.

**Named tradeoff, carried into the record rather than left silent:**
env-var presence cannot distinguish "this client has no secret" from "a
future client has a secret and nobody set the var." A client configured
with a secret whose env var is left unset now fails quietly in the
mirror direction. The log line added in `1c578b71` is the mitigant —
turning that case into a fast diagnosis rather than a repeat of this
one — not a structural guarantee against it.

---

# §3. Precondition 1's status, stated precisely

Two distinct claims, not one:

1. **The mechanism performs real credential verification, correctly
   shaped.** TRUE, verifiable now, by reading `cognitoPasswordAuthService.js`
   and its passing tests. This is what precondition 1 asks, and it
   remains MET, as `v2.73` recorded.
2. **The mechanism succeeds when exercised against the live pool with a
   real credential.** UNKNOWN. Not proven by this document, not
   provable by any agent session, and not the same claim as (1). This is
   `v2.73` §3's closure condition — live pool verification, Evoni's
   ruling (c), unchanged — and it remains open.

Recording (1) as if it settled (2) would be the error this document is
written to avoid. Precondition 1's MET label stands on claim (1) alone,
exactly as `v2.73` intended it; this revision adds the fact that claim
(1) was, until this fix, undermined by a defect that would have made
claim (2) fail deterministically, for every credential, on this pool's
actual client — and that the defect is now closed.

---

# §4. What this revision does not do

- **Does not perform the live-pool verification** claim (2) above names.
  Evoni-gated, unchanged from `v2.73` §4.
- **Does not re-rule precondition 1's MET label**, `v2.73`'s two-stage
  discharge/closure structure, or precondition 3's NOT MET status. All
  stand exactly as `v2.73` left them.
- **Does not close FD-65's issuance half.** Closure remains gated on
  live pool verification per `v2.73` §3, unaffected by a code fix.
- **Does not mint** an FD, XK, or PE number.
- **Does not stand as ruling until Evoni reviews it.** Drafted this
  session; per this family's own provenance discipline (`v2.73` §3,
  `v2.69` Ruling 1), a document naming itself as Evoni's ruling without
  that review would repeat the disclosure defect those revisions exist
  to correct. This document is offered for that review, not asserted as
  already having received it.
- **Contacts no host, AWS, database, or Cognito beyond the reads already
  cited, both already merged ahead of this document.** Prod **FROZEN**.

---

*Type: defect-and-fix record, narrowing precondition 1's evidentiary
basis without altering its disposition. Mints nothing. No new host,
AWS, database, or Cognito contact by this revision itself. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-16. Basis: `origin/main` at
`1c578b71ae4a98ce83970b7f180a0b25fe6d79d3`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.73.md` §3 (cited, not re-ruled), the
live AWS reads at §1 above (both under `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md`
and its amendment, merged ahead of this document), and `PR #1472`
(merged `1c578b71`).*
