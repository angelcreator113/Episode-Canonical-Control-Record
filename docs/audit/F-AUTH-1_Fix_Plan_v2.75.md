| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Closes FD-65 entire. Issuance half CLOSED on live verification against the real Cognito pool, per Evoni's ruling (c) of 2026-09-14 and `v2.73` §3's two-criteria structure. Privilege half remains closed on the merits at `v2.50`. Mints no new numbers.* |
| --- |

**Document version**

**v2.75 — FIX PLAN REVISION. Mints no new numbers. Closes FD-65's
issuance half on live verification; FD-65 is CLOSED entire.** This
document lands Evoni's ruling — drafted in this session, checked by her
clause by clause against the primary sources and the reasoning behind
each, and confirmed by her as her ruling — transcribed verbatim below;
see §3 for the ruling text and its provenance in full.

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.74.md`. **v2.74's content stands
and is not re-ruled here** — the narrowing of precondition 1's
evidentiary basis (mechanism correctly shaped, MET; mechanism succeeds
live, was UNKNOWN as of that revision) and its explicit statement that
it does not itself perform or substitute for live verification. This
document is what v2.74 named as still owed: the live verification v2.74
left to Evoni.

**Basis:** `origin/main` at `4ef0c66e6573a804930d1735c43ff6be8691c887`,
2026-09-16 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-16T11:32:17-04:00`). Post
`v2.74` (`#1475`, merged `494e95e2`) and the group-case-mismatch
reproduction addendum (`#1476`, merged `4ef0c66e`) — the addendum is
cited at §4 for context; it is an authorization-layer finding,
independent of this issuance-layer closure.

FD tail, XK tail, and PE tail unchanged from `v2.73`'s/`v2.74`'s own
re-derivation: FD tail **FD-69** (retired; **FD-70** next-available,
unminted), XK tail **XK-3**, PE tail **PE #68**. No FD, XK, or PE has
been minted or retired between that basis and this one.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni** — drafted in session, checked by her against `v2.73`'s
text and the reasoning for reading closure and discharge as separately
evidenced criteria, confirmed as her ruling — transcribed verbatim
below; see §3.

**Status**

**Revision. Rules one matter, on Evoni's word.** FD-65's issuance half is
**CLOSED**, on live verification she performed herself, outside any
agent session. FD-65 is **CLOSED entire** — the privilege half remains
closed on the merits at `v2.50` (`75ac05f0`), unaffected. Precondition 3
of `v2.67` §4 remains **NOT MET** and is explicitly **not** discharged or
mooted by this closure — it survives as its own owed item. FD tail
remains **FD-69** (retired; FD-70 next-available, unminted); XK tail
**XK-3**; PE tail **PE #68**. Prod **FROZEN** — no host, AWS, or database
contact by this document itself.

---

# §1. What was verified, and what ruling (c) asked

Evoni's 2026-09-14 ruling (c), carried unchanged through `v2.67`,
`v2.73`, and `v2.74`: *"FD-65's issuance half closes on live verification
against the real Cognito pool, not on implementation."* `v2.74` §3
established that the code, as of `PR #1472` (`1c578b71`), is *capable*
of succeeding against this pool's actual client — and was explicit that
capability is not the same claim as success, and that only a live
`InitiateAuth` call against the real pool could settle the latter.

That call was made. §3 below is the ruling; §2 cites the evidence it
rests on, at the level of shape and outcome only — no token, credential,
or payload value appears anywhere in this document, matching the
standard the verification itself was reported under.

---

# §2. Evidence this revision cites

**Verified present at this basis; cited, not restated as this
document's own findings, except where marked as this session's own
observation of what was reported.**

1. **Layer 1 — `aws cognito-idp initiate-auth`, `USER_PASSWORD_AUTH`, no
   `SECRET_HASH`**, run by Evoni against the pool's one app client
   (`lgtf3odnar8c456iehqfck1au`, `episode-metadata-api-client-dev`).
   Reported outcome: an `AuthenticationResult` was returned. This
   confirms `PR #1472`'s fix (`SECRET_HASH` omitted when the client has
   no secret) works against the real, live client — not a mock, not a
   unit test double.

2. **Layer 2, step 1 — `POST /api/v1/auth/login`**, local server, real
   `COGNITO_USER_POOL_ID`/`COGNITO_CLIENT_ID` values, same credential.
   Reported outcome: `success: true`, `"Login successful"`, the five
   contract fields (`accessToken`, `refreshToken`, `expiresIn`,
   `tokenType`, `user`) present. This is `src/routes/auth.js`'s actual
   handler, calling `cognitoPasswordAuthService.js`'s actual
   `initiatePasswordAuth` — the same code path `v2.74` narrowed the
   evidentiary basis for, now exercised live.

3. **Layer 2, step 2 — `GET /api/v1/auth/me`**, with the access token
   step 1 issued. Reported outcome: `200`, `"User information
   retrieved"`, a `user` object present. This is `src/middleware/auth.js`
   / `jwtAuth.js`'s real RS256 verifier accepting a token the app itself
   issued — the two halves of the chain (issuance, verification) meeting
   on the same real token, not a fabricated one, per the design
   question `v2.73` §2 item 3 named and left unscoped.

Per this session's own established handling of credential-bearing runs:
no access token, refresh token, ID token, password, or request/response
body was pasted into this session at any point during Layer 1 or Layer
2. What is cited above is pass/fail and shape only, reported by Evoni,
matching how she was asked to report it.

---

# §3. The ruling

**Provenance, per this family's own disclosure standard
(`F-AUTH-1_Fix_Plan_v2.73.md` §3, `v2.69` Ruling 1, the Shape A ruling's
note — all cited, not re-derived).** The wording below was drafted in
this session's conversation. It is Evoni's ruling because of what
happened next: she checked it — including the reasoning for why closure
and discharge are separately evidenced criteria under `v2.73` §3's own
text, not a sequence where one gates the other — and confirmed the
result as her ruling. Transcribed verbatim; no word altered from what
she confirmed.

**Two things are attested here, not one.** The ruling text was drafted
in conversation, reviewed against the primary sources by Evoni, and
confirmed by her as her ruling — the same standard this family's
rulings carry. The verification underlying it is a different kind of
claim: performed by Evoni alone, with no agent session performing or
witnessing it, and unreproducible from the repository. A later reader
can check every citation in §1 and §2; §3's first paragraph rests on
her account and nothing else.

> **Ruling (Evoni, 2026-09-16).** FD-65's issuance half is **CLOSED**,
> on live verification against the real Cognito pool, per my ruling (c)
> of 2026-09-14 and the two-criteria structure `v2.73` §3 established.
>
> The verification was performed by me on 2026-09-16, outside any agent
> session: `initiate-auth` against the pool's one app client returned an
> `AuthenticationResult` with no `SECRET_HASH` sent; `POST
> /api/v1/auth/login` returned the five pinned contract fields; `GET
> /api/v1/auth/me` accepted the access token that endpoint issued and
> returned the user. The app issues a token against the real pool and
> its own middleware accepts it. That is what ruling (c) asked and it is
> satisfied. This record is ATTESTED — my account of my own action; no
> session performed or witnessed it.
>
> **Closure fires on its own criterion.** `v2.73` §3 named discharge and
> closure as two separately evidenced criteria, not a sequence. Nothing
> in its text makes discharge a precondition of closure. Today's
> verification answered closure's question directly, through closure's
> own evidence, without routing through `v2.67` §4's preconditions.
> Reading closure as requiring discharge first would be a new rule, not
> a restatement of `v2.73`, and I am not introducing one.
>
> **Precondition 3 remains owed**, as its own item and not as a blocker
> on this closure. `LOGIN_DISABLED` is still `true` in
> `tests/integration/f-auth-1-fd65.test.js`, and the design question
> `v2.73` §3 named — how, or whether, to fabricate a verifier-acceptable
> token without live Cognito contact — is still unscoped. It survives
> this closure rather than being retired by it.
>
> **FD-65 is closed entire.** The privilege half closed on the merits at
> `v2.50`/`75ac05f0`; the issuance half closes here. `v2.67`'s
> CLOSED-BY-REMOVAL standing, superseded at `v2.73`, is not restored —
> this is closure on the merits, not on removal.

---

# §4. What this revision does not do

- **Does not discharge precondition 3.** `LOGIN_DISABLED` stays `true`;
  the design question of how, or whether, to fabricate a
  verifier-acceptable token without live Cognito contact stays unscoped.
  Named in the ruling's own third paragraph as surviving, not settled.
- **Does not reopen or re-rule the privilege half's closure**, which
  stands CLOSED on the merits at `v2.50` (`75ac05f0`), unaffected.
- **Does not re-rule `v2.73`'s or `v2.74`'s content.** `v2.73`'s
  two-stage structure and `v2.74`'s precondition-1 narrowing both stand
  exactly as those revisions left them; this document supplies the
  closure event `v2.73` and `v2.74` each left to a future revision.
- **Does not touch the group-case-mismatch finding** (`F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md`
  and its reproduction addendum, `#1474`/`#1476`). That is an
  authorization-layer defect; this is an issuance-layer closure. The
  same test run happened to exercise both; this document reports only
  the issuance half of what that run showed.
- **Does not mint** an FD, XK, or PE number. FD-70 remains
  next-available, unminted.
- **Does not restate `v2.67`'s CLOSED-BY-REMOVAL standing.** That
  standing was superseded at `v2.73` and is not revived by this
  document; this closure is independently grounded in live verification,
  not in the route's enabled/disabled state.
- **Contacts no host, AWS, or database itself.** The verification this
  document records was performed by Evoni, outside any agent session,
  per the ruling's own second paragraph. Prod **FROZEN**.

---

*Type: closure, by qualified disposition. Closes FD-65's issuance half
on live verification; FD-65 is CLOSED entire. Mints nothing. No host,
AWS, or database contact by this revision itself — the verification it
records was Evoni's own action. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-16. Basis: `origin/main` at
`4ef0c66e6573a804930d1735c43ff6be8691c887`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.73.md` §3 (two-criteria structure,
cited not re-derived), `F-AUTH-1_Fix_Plan_v2.74.md` (precondition-1
narrowing, cited not re-ruled), Evoni's 2026-09-14 ruling (c) (cited,
unchanged), and Evoni's ruling at §3 above (ATTESTED — her own
verification, drafted in session, checked and confirmed by her as her
ruling; see §3's provenance note).*
