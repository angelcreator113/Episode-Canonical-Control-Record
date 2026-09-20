| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Lands Evoni's adopted rulings on `POST /api/v1/auth/refresh`: public user sessions become Cognito end to end, HS256 refresh retires for user sessions, the refresh response contract is pinned. Records her app-client configuration read as ATTESTED, and the mechanism that follows from it. Discloses that the ruling text was drafted outside this repository's sessions. Mints nothing. Does not reopen FD-65. Implements nothing.* |
| --- |

**Document version**

**v2.77 — FIX PLAN REVISION. Mints no new numbers. Rules the `/refresh`
design; implements none of it.** This document lands the rulings Evoni
adopted on 2026-09-19 in response to the defect measured at
`F-AUTH-1_SessionRefresh_Read_2026-09-19.md`, transcribed verbatim at
§4. **The ruling text was drafted by another AI assistant, outside this
repository's sessions, and adopted by Evoni's approval — it is not her
composition.** §3 discloses that in full, before the text itself.

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.76.md`. **v2.76's content stands
and is not re-ruled here** — `v2.67` §4 precondition 3 remains
discharged on direct evidence, `LOGIN_DISABLED` remains `true`, and the
test-file rewrite remains ordinary owed work carrying no precondition.
Nothing in this document touches any of that. This document is the
revision that the ruling at §4 itself requires before the `/refresh`
work may be implemented.

**Newest-revision check (§0):**

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.74.md
F-AUTH-1_Fix_Plan_v2.75.md
F-AUTH-1_Fix_Plan_v2.76.md
```

`v2.76` is the newest revision by numeric sort. No newer revision exists
at this basis, and no `.docx` counterpart newer than `v2.37` exists in
this family. Naming this one `v2.77` is correct.

**Basis:** `origin/main` at
`2964fce5d661fd8fef013a1ce5cb3a4fc7fe8d9d`, 2026-09-19.

```
$ git log -1 --format='%H %ad' --date=short origin/main
2964fce5d661fd8fef013a1ce5cb3a4fc7fe8d9d 2026-09-19
```

**FD, XK, and PE tails — re-derived at this basis, not carried:**

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -2
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit | grep -E '^FD-7[0-9]|^XK-4|^PE.?69'
(no output — no filed document titled FD-70_*, XK-4_*, or PE-69/PE#69_*)

$ grep -ro 'FD-70' docs/audit/ | wc -l
188
$ grep -r 'XK-4' docs/audit/ | wc -l
88
$ grep -r 'PE #69' docs/audit/ | wc -l
86
```

Every hit is a "next-available, unminted" citation — the same standing
the register has carried since `v25_Owed_Index_Amd11`. **FD tail is
FD-69, retired** (spent on a duplicate); **FD-70 is next-available and
unminted.** **XK tail is XK-3**; **XK-4 is next-available and unminted.**
**PE tail is PE #68**; **PE #69 is next-available and unminted.** This
document mints none of the three.

**Note on the three instruments, carried because it is still live.** The
first is counted with `grep -o` (occurrences); the second and third with
`grep -r | wc -l` (matching lines). **They are not the same unit.** The
three counts above were taken at the basis, before this document
existed. **This document's own contribution, measured after its text was
final: +5 / +5 / +3.** A successor re-deriving
once this lands should read **193 / 93 / 89**.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Rulings adopted by Evoni; drafted by another AI assistant outside this
repository's sessions — see §3 for the provenance disclosure in full,
and §4 for the text.**

**Status**

**Revision. Rules the `/refresh` design, on Evoni's adopted word.**
Public user sessions are ruled **Cognito end to end**; HS256 refresh for
user sessions is ruled **retired**; the `/refresh` success contract is
**pinned** to `accessToken` + `expiresIn` + `tokenType`. **FD-65 is not
reopened** — the ruling says so expressly, and this document does not
restate or re-rule FD-65's standing beyond quoting it. **Nothing is
implemented.** No code, test, or configuration file is touched. FD tail
remains **FD-69** (retired; FD-70 next-available, unminted); XK tail
**XK-3**; PE tail **PE #68**. Prod **FROZEN** — no host, AWS, database,
or Cognito contact by this document or by the session that wrote it. The
app-client configuration read recorded at §6 was Evoni's own console
action, outside any agent session.

---

# §1. The measured defect this ruling answers — cited, not re-derived

`docs/audit/F-AUTH-1_SessionRefresh_Read_2026-09-19.md`, filed by PR
**#1560**, merged as squash commit **`2964fce5`** — which is this
document's own basis.

```
$ git log -1 --format='%H %s' origin/main -- docs/audit/F-AUTH-1_SessionRefresh_Read_2026-09-19.md
2964fce5d661fd8fef013a1ce5cb3a4fc7fe8d9d docs(audit): file F-AUTH-1 session-refresh read [skip-automerge] (#1560)
```

That read's §5 end state, quoted:

> **End state, MEASURED: every session ends within one request of the
> Cognito access token's expiry**, because step 6 can never succeed —
> `/refresh` has no branch that accepts what `/login` (§1) actually hands
> the client.

**The defect is cited at its own standing, not re-derived here.** That
document carries its own MEASURED / INFERRED / NOT PERFORMED labelling
per claim; this revision does not re-measure, re-label, upgrade, or
extend any of it. It also rules nothing itself — its own closing says
so: "Mints nothing… Rules nothing… Recommends nothing… Only Evoni's
written ruling, or a ratifying revision, disposes of this." **This
document is that ratifying revision.**

---

# §2. Priors — cited, not re-derived

| prior | what it establishes | how used here |
|---|---|---|
| `F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md` | Evoni's three rulings of 2026-09-14, including **(b)** — "the local HS256 token family is narrowed to a controlled internal flow, and must not remain the issuance path for user login" | Cited. The ruling at §4 invokes (b) by name; this document does not re-derive, re-argue, or extend it. |
| `F-AUTH-1_Fix_Plan_v2.75.md` | FD-65 **CLOSED entire** — issuance half on live verification against the real pool per ruling (c), privilege half on the merits at `v2.50` | Cited. **Not restated, not reopened, not re-ruled.** The ruling at §4 says FD-65 is not reopened; this document quotes that and stops there. |
| `F-AUTH-1_Fix_Plan_v2.76.md` | `v2.67` §4 precondition 3 **discharged** on direct evidence; `LOGIN_DISABLED` stays `true`; test-file rewrite named as ordinary owed work | Cited as the immediate predecessor, whose content stands. Untouched. |

**None of the three is re-derived.** Where the ruling text at §4 cites
`F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md`,
`F-AUTH-1_Fix_Plan_v2.75.md`, `F-AUTH-1_SessionRefresh_Read_2026-09-19.md`,
or `docs/COGNITO_USER_POOL_SETTINGS.md`, those are **the ruling's own
citations**, reproduced verbatim inside it — not this document's
independent readings of those files.

---

# §3. Provenance of the ruling text — disclosed before the text

**The text at §4 was not composed by Evoni.** It was **drafted by
another AI assistant, in a conversation outside this repository's
sessions**, in response to the defect at §1. Evoni **adopted it by
approval**. Her recorded response, verbatim, was

> approved

given **2026-09-19**. **Standing of the dispositions is RULED** — they
are rulings because she adopted them, not because of who drafted them.
**Standing of the wording is disclosed, not laundered:** it originated
outside her composition, and this section labels it as such.

**Precedent.** This follows `F-AUTH-1_Fix_Plan_v2.69.md`'s correction
banner, which applies exactly this test and is quoted here for the rule
it states:

> This banner applies the same test as that disclosure: wording that
> originated session-side is labeled, regardless of who approved it.

`v2.69`'s banner labelled two clauses whose wording originated with a
drafting session rather than with Evoni, while her approval of the
assembled text stood. **The same test, applied here, labels the whole of
§4**, because the whole of §4 originated outside her composition. **The
approval is not diminished by the disclosure, and the disclosure is not
softened by the approval.**

## §3.1 The text passed through several copies before reaching issue #1561

**Recorded plainly, because it bears on which bytes are authoritative.**
Between its drafting in the outside conversation and its arrival in this
register, the ruling text was **relayed through several intermediate
copies** — pasted out of the drafting conversation, carried onward, and
finally placed in issue **#1561**'s "Ruling text (verbatim,
Evoni-adopted)" slot. **The copies made along that path are not
independently verifiable from this repository, and no claim is made here
that they were byte-identical to one another.** Ordinary relay hazards —
smart-quote substitution, line-ending translation, fence damage,
whitespace trimming — are live over such a path and are not assumed
away.

**The definitive text is the one inside the four-backtick fence in issue
#1561.** That copy, and no other, is what §4 transcribes. It is fixed
here by content digest, so that any other copy can be **checked** against
it rather than trusted:

```
SHA-256   400970cace26862b2c26361f78adb8600826a82fc88359b8949935bf53c81b04
bytes     6214
encoding  UTF-8, LF line endings
trailer   NO trailing newline
```

**The fence is not part of the text.** Issue #1561 wraps the ruling in a
**four-backtick** fence precisely because the ruling contains its own
nested triple-backtick block (the pinned response contract at its point
3). The digest above covers the **fenced content only** — the lines
strictly between the opening and closing four-backtick fence lines,
excluding both, joined with `\n`, with no trailing newline. §4
reproduces that content inside a four-backtick fence of its own, so the
inner triple-backtick block survives intact and the byte sequence is
unchanged.

**Instrument, pasted.** The digest was derived from issue #1561's body as
returned by the GitHub API, not from a re-typed copy:

```
$ gh issue view 1561 --json body -q .body > issue1561_body.md

$ python extract_and_hash.py issue1561_body.md
    # splits the body on '\n'; the four-backtick fence lines are 33 and 126
    # (1-based); joins lines 34..125 with '\n'; hashes the UTF-8 bytes
bytes: 6214
sha256: 400970cace26862b2c26361f78adb8600826a82fc88359b8949935bf53c81b04
endswith newline: False
```

**A reader checking this document's own transcription** extracts the
content of §4's four-backtick fence from this file by the same rule
(lines strictly between the fences, `\n`-joined, no trailing newline) and
expects the same three values. **That check was performed against this
file before filing, and matched** — both against the working file and
against the committed blob.

**One caveat on reproducing that check, stated so it does not fail
spuriously.** The digest is over **LF** line endings, which is how this
file is stored in the repository (`.gitattributes` sets `* text=auto`;
the committed blob contains no `CR` bytes). **A working copy checked out
on Windows under `core.autocrlf=true` will hold CRLF instead, and hashing
that copy will not produce the digest above.** Read the blob directly —
`git show <rev>:docs/audit/F-AUTH-1_Fix_Plan_v2.77.md` — or normalize
line endings before hashing. **The stored content is LF; CRLF in a
working copy is a checkout artifact, not a difference in the text.**

**What this subsection does not claim.** It does **not** claim the issue
#1561 copy is byte-identical to what the drafting assistant originally
emitted — no instrument available to this repository can establish that,
and §3.1 does not pretend otherwise. What it fixes is **which copy this
register treats as definitive**, and it makes that copy checkable.
Evoni's approval of 2026-09-19 is recorded against that copy.

---

# §4. The rulings, transcribed verbatim — standing RULED

**Transcribed without edit, elision, or renumbering** — including its own
reference links `[1]` and `[2]` as given, its own emphasis, and its own
nested triple-backtick block. **The four-backtick outer fence below is
this document's container; it is not part of the ruling.**

**Two reading notes, stated before the text and not inside it.**

1. **Its point 4 is not a ruling.** Point 4 is the drafting assistant
   reporting that **it** could not read the Cognito console from its own
   session, and naming the six app-client fields a live read should
   capture. It is transcribed in full and unchanged because the
   transcription is verbatim — but it states an access limitation and an
   information request, not a disposition. **§6 is what answers it**, by
   Evoni's own console read.
2. **The AWS behavior claims inside the text are the ruling's cited
   basis, not this document's findings.** See §5.

````
I’d rule this as follows.

1. **Yes — `/refresh` should become a Cognito refresh exchange.** For the current design, that means Cognito `REFRESH_TOKEN_AUTH` **provided refresh-token rotation is disabled**. If rotation is enabled on the live client, `REFRESH_TOKEN_AUTH` is not available; Cognito requires `GetTokensFromRefreshToken` instead. ([AWS Documentation][1])

This **does create/modify a user-session token issuance surface**, because `/refresh` causes Cognito to issue another access token. But I would **not reopen FD-65**. FD-65's defect was unauthenticated issuance; a valid Cognito refresh token is already a credential issued after authentication. Ruling (b) also specifically says the **local HS256 family must not remain the issuance path for user login**. The Cognito refresh flow is consistent with that boundary rather than violating it. Sources: `docs/audit/F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md`, `docs/audit/F-AUTH-1_Fix_Plan_v2.75.md`.

I **would require a new F-AUTH-1 Fix Plan revision** before implementing it, though. That revision should explicitly extend the user-session design from:

**Cognito login → Cognito access token**

to:

**Cognito login → Cognito refresh credential → Cognito renewed access token**

And I would require live verification against the real pool before calling the refresh work closed, just as we distinguished implementation from actual Cognito success for login. Under the project's current boundaries, that credential-bearing live verification is a **maintainer-performed verification**, not something I can perform from this session.

2. **Retire HS256 refresh for user sessions. Do not route `/refresh` by `alg`.**

That is my strongest call here.

The public user-session path should become:

> `/login` → Cognito
> `/refresh` → Cognito
> protected requests → Cognito RS256 access token

No local HS256 token should appear anywhere in that browser-session lifecycle.

There is also a technical reason not to make this `if alg === RS256 / HS256`: a **Cognito refresh token isn't the RS256 access token** and shouldn't be treated as a JWT whose `alg` header selects the refresh implementation. The current `/refresh` only works because `TokenService.refreshAccessToken()` expects one of your local HS256 refresh JWTs; that is precisely the mismatch measured in `F-AUTH-1_SessionRefresh_Read_2026-09-19.md`.

If controlled internal HS256 flows genuinely still require refresh later, give them a **separate explicitly internal mechanism**. Don't make the public `/api/v1/auth/refresh` polymorphic.

3. **Yes, pin the refresh response contract — and don't simply return Cognito's raw `AuthenticationResult`.**

For the current non-rotating design, I would pin:

```text
success
message
data:
  accessToken
  expiresIn
  tokenType
```

That intentionally preserves the three fields the current `/refresh` frontend contract already understands.

I would **not expose `idToken`** just because Cognito returns one. `/login` already deliberately avoids returning the raw ID token; it uses ID-token claims server-side to construct `user`. There is no current frontend need for the raw ID token.

And I would **not return `refreshToken`** under the non-rotation design. Cognito doesn't normally issue a replacement refresh token in that configuration; the original stays valid. ([AWS Documentation][1])

If you later deliberately enable rotation, that's a **separate contract change**: the server would receive a new refresh token and the frontend would have to replace the stored `refreshToken` atomically. That should not sneak into this fix.

I would pin the **error contract too**. Right now `/refresh` returns `error.message`, which means implementation/provider text leaks into the API contract. The Cognito version should map known refresh failures to stable app codes instead.

4. **I cannot verify the live refresh-token lifetime from the Cognito console in this session.** There is no AWS/Cognito connector available to me here.

There is historical repository documentation saying **30 days**, but that document now explicitly says it is **retired as current pool authority**, so I would not promote that to a current fact. Source: `docs/COGNITO_USER_POOL_SETTINGS.md`.

AWS's current default is also **30 days if the app client hasn't been configured otherwise**, but that still does not prove your live client is 30 days. ([AWS Documentation][2])

The live read should capture these together:

* `RefreshTokenValidity`
* `TokenValidityUnits.RefreshToken`
* `RefreshTokenRotation`
* `ExplicitAuthFlows`
* `AccessTokenValidity`
* `IdTokenValidity`

That simultaneously settles **which refresh API we should use** and **how long the session can survive**.

And yes: once refresh works, the refresh-token validity is effectively the **maximum password-free continuous session lifetime**, barring earlier logout, revocation, account disablement, etc. With rotation, Cognito says the replacement refresh token remains bounded by the original token's remaining lifetime rather than granting an endlessly extending session. ([AWS Documentation][1])

### So my design ruling is

**Public user sessions become Cognito-only end to end.**

`/login` → Cognito `USER_PASSWORD_AUTH`
`/refresh` → Cognito refresh flow
`/me` / protected API → Cognito RS256 access token

**No HS256 fallback on `/refresh`.**

**Pin `/refresh` to `accessToken + expiresIn + tokenType`.**

**Fix Plan revision required. Live real-pool refresh verification required before the refresh change is considered closed, but this does not reopen FD-65.**

The only thing still **UNKNOWN** is which Cognito refresh mechanism applies to your live client and its exact lifetime; one bounded app-client configuration read settles both.

[1]: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html?linkId=229508137&sc_channel=sm&sc_outcome=AWS+Support&sc_publisher=REDDIT&utm_source=chatgpt.com "Refresh tokens - Amazon Cognito"
[2]: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UserPoolClientType.html?utm_source=chatgpt.com "UserPoolClientType - Amazon Cognito User Pools"
````

---

# §5. Standing of the AWS behavior claims inside §4 — NOT this revision's findings

The transcribed text makes claims about Amazon Cognito's own behavior:
that `REFRESH_TOKEN_AUTH` is unavailable when refresh-token rotation is
enabled and `GetTokensFromRefreshToken` is required instead; that AWS's
default refresh-token validity is 30 days when an app client has not been
configured otherwise; that under non-rotation Cognito does not normally
issue a replacement refresh token; and that under rotation the
replacement refresh token stays bounded by the original's remaining
lifetime.

**These are the ruling's own cited basis, carried inside the
transcription. They are not findings of this revision, and they are NOT
MEASURED.**

- **No AWS API call, console read, or Cognito contact was made by this
  document or by the session that wrote it.** Prod **FROZEN**.
- **The ruling's two reference links (`[1]`, `[2]`) are its citations,
  transcribed as given.** This document did not fetch, open, or verify
  either URL, and does not vouch for their content.
- **They are not labelled MEASURED, INFERRED, or ATTESTED by this
  document**, because this document did not derive them. They stand
  exactly as far as the ruling's own citation carries them.
- **The dispositions at §4 are RULED regardless** — Evoni adopted the
  rulings, and the standing of a ruling does not depend on this register
  independently verifying a third party's documentation.

**One consequence of that limit is stated at §7** and is not glossed
over: §7's conclusion depends on the rotation branch stated in the
ruling's own point 1, which this register has not independently verified
against AWS.

---

# §6. App-client configuration read — ATTESTED

**Performed by Evoni, in the AWS Cognito console, outside any agent
session.** This is her account of her own action. **No session performed
it, witnessed it, or reproduced it**, and it is not derivable from this
repository. It answers the live read that §4's point 4 asked for.

> On 2026-09-19, outside any agent session, I read the app client's
> configuration in the Cognito console and recorded the following
> fields.

| field | value as read |
|---|---|
| `RefreshTokenRotation` | **null / not configured** |
| `RefreshTokenValidity` | **30** — unit **omitted** (Evoni: the default, days) |
| `AccessTokenValidity` | **null / omitted** — unit **omitted** |
| `IdTokenValidity` | **null / omitted** — unit **omitted** |
| `ExplicitAuthFlows` | **`ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_PASSWORD_AUTH`** |

**Standing: ATTESTED.** Not MEASURED — no instrument in this repository
produced it, and no agent session may produce one (the read requires
Cognito console access, which is Evoni's alone; the AWS read-only
narrowing at `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md`
does not change that this particular read was hers, performed personally).

**Recorded precisely, including its gaps:**

- **No pool identifier, client identifier, client secret, token, or any
  other credential is recorded here or anywhere in this document.** The
  five field names and their values above are the whole of what is
  carried.
- **`TokenValidityUnits.RefreshToken` was not returned as a value** — the
  unit is **omitted** in the configuration, which is why the table says
  "unit omitted" rather than naming one. **Evoni states the omitted unit
  defaults to days.** The reading "30 days" therefore rests on that
  default holding, **not** on a recorded `TokenValidityUnits` value.
  Stated this way deliberately: the number 30 is what was read; "days" is
  the default Evoni names, not a field the console returned.
- **`RefreshTokenRotation` reading as null / not configured is recorded
  as read.** This document does not translate that into an assertion
  about AWS's own semantics beyond what §7 draws from the ruling's own
  condition.
- **`AccessTokenValidity` and `IdTokenValidity` read as null / omitted**,
  units omitted. **This document does not substitute AWS's documented
  defaults for those two fields**, and draws no access-token-lifetime
  conclusion from them. The §1 read's own NOT PERFORMED item — "Actual
  token lifetime in the Cognito user pool/app client — Evoni-gated" — is
  answered **only** as to the refresh token, and only to the extent this
  section states.

---

# §7. Consequence — which refresh mechanism applies

**Stated as following from ruling 1's own condition plus the ATTESTED
read at §6, and from nothing else.**

Ruling 1's condition, quoted from §4:

> that means Cognito `REFRESH_TOKEN_AUTH` **provided refresh-token
> rotation is disabled**. If rotation is enabled on the live client,
> `REFRESH_TOKEN_AUTH` is not available; Cognito requires
> `GetTokensFromRefreshToken` instead.

§6's ATTESTED read: **`RefreshTokenRotation` is null / not configured** —
rotation is not enabled on the live client. **`ExplicitAuthFlows`
includes `ALLOW_REFRESH_TOKEN_AUTH`**, so the flow is permitted on that
client.

> **The applicable mechanism is `REFRESH_TOKEN_AUTH`.**

**Two further consequences follow from the same pair, and no third is
drawn:**

- **Ruling 3's non-rotation contract is the applicable one.** Its pinned
  success shape — `accessToken`, `expiresIn`, `tokenType`, under
  `success` / `message` / `data` — is what implementation targets, and
  its "not `refreshToken`, not `idToken`" exclusions apply as written.
  The rotation contract change ruling 3 quarantines as "a **separate
  contract change**" is **not** in scope, because rotation is not
  enabled.
- **The maximum password-free continuous session lifetime is bounded by
  `RefreshTokenValidity` = 30**, barring earlier logout, revocation,
  account disablement, and the other exclusions ruling 4 names. **Whether
  that is 30 days depends on the omitted unit defaulting to days**, per
  §6 — Evoni's statement, not a field value this register holds.

**What this section does not do.** It does not upgrade the ruling's AWS
behavior claims (§5) to a finding of this register; the inference above
is drawn *from the ruling's own stated condition*, which is why §5's
limit is restated here rather than left implicit. It **closes nothing** —
selecting the mechanism is not implementing it, and is not the live
verification §8(b) owes. And it does not touch FD-65, which remains
**CLOSED entire** per `v2.75`; the ruling at §4 expressly declines to
reopen it, and this document does not disturb that.

---

# §8. Owed work — named here, performed nowhere

**(a) Implementation of the Cognito `/refresh` per the rulings at §4 —
OWED, NOT PERFORMED.** No line of `src/`, `frontend/`, or `tests/` is
touched by this document. What is owed, as the rulings define it and
without this document adding to it: `POST /api/v1/auth/refresh` becomes a
Cognito `REFRESH_TOKEN_AUTH` exchange (§7); the HS256 refresh path is
retired for user sessions and `/refresh` is **not** made polymorphic on
`alg`; the success response is pinned to `accessToken` + `expiresIn` +
`tokenType`, exposing neither `idToken` nor `refreshToken`; and the error
contract is pinned, mapping known refresh failures to stable app codes
instead of returning provider text as `error.message`. **Scoping,
sequencing, and authorizing that work is not this document's business and
is not done here.**

**(b) Live real-pool refresh verification by Evoni, before the refresh
work is considered closed — OWED, NOT PERFORMED.** The ruling requires it
in its own words: "live verification against the real pool before calling
the refresh work closed… a **maintainer-performed verification**, not
something I can perform from this session." **No agent session performs
it.** It is the same distinction the register drew for login at `v2.73`
§3 and discharged at `v2.75` §3 — implementation is not success against
the real pool. **Implementing (a) does not close the refresh work; only
(b) does.**

**Neither is a precondition on anything this document rules.** §4's
dispositions and §7's consequence stand now; (a) and (b) are what remains
to be done under them, not gates upon them.

---

# §9. What this revision does not do

- **Mints nothing.** No **FD-70**, no **XK-4**, no **PE #69**, no other
  FD, XK, or PE. §0's re-derivation confirms all three remain
  next-available and unminted, and this document leaves them so.
- **Does not reopen FD-65**, and **does not restate or re-rule its
  standing** beyond quoting the ruling's own sentence declining to reopen
  it. FD-65 is **CLOSED entire** at `v2.75` — issuance half on live
  verification, privilege half on the merits at `v2.50` — and that
  standing is untouched here.
- **Does not implement anything.** No file under `src/`, `frontend/`, or
  `tests/` is added, edited, or deleted by this document. `LOGIN_DISABLED`
  is not flipped and is not discussed beyond §2's citation of `v2.76`.
- **Does not edit any filed document.** The register is immutable; this
  is a new revision, not an amendment to `v2.75`, `v2.76`, the
  `2026-09-15` read, or the `2026-09-19` read.
- **Does not re-derive its priors.** §1 and §2 cite; they do not
  re-measure. The `2026-09-19` read's own per-claim standing is carried
  as that document assigns it, unchanged.
- **Does not mark the ruling's AWS behavior claims MEASURED** — or
  INFERRED, or ATTESTED. §5 states why: this document did not derive
  them, did not fetch the ruling's two reference links, and made no AWS
  or Cognito contact.
- **Does not record any pool identifier, client identifier, client
  secret, token, password, or other credential.** §6 carries five field
  names and their values, and nothing else.
- **Does not claim `RefreshTokenValidity` = 30 means 30 days on the
  strength of a field value.** The unit is omitted in the configuration;
  "days" is the default Evoni names. §6 and §7 both say so rather than
  rounding it off.
- **Does not treat §4's point 4 as a ruling.** It is transcribed verbatim
  because the transcription is verbatim; it states the drafting
  assistant's own access limitation and its list of fields to read. §6
  answers it.
- **Does not claim the issue #1561 copy matches the drafting assistant's
  original emission.** §3.1 fixes which copy is definitive and makes it
  checkable by digest; it does not assert an unverifiable identity across
  the relay path.
- **Does not perform, schedule, or authorize the live verification at
  §8(b)**, and does not scope the implementation at §8(a).
- **Contacts no host, AWS account, database, or Cognito pool.** Every
  derivation on the face of this document is a repository read at the
  basis SHA, or a digest computed over issue #1561's body. The one
  non-repository fact it carries (§6) is Evoni's own console read,
  performed by her, outside any agent session. Prod **FROZEN**.

---

*Type: Fix Plan revision. Lands Evoni's adopted `/refresh` rulings
verbatim (RULED), with their out-of-repository drafting provenance
disclosed at §3 before the text. Records her app-client configuration
read as ATTESTED (§6), and the mechanism that follows —
`REFRESH_TOKEN_AUTH` (§7). Names implementation and live real-pool
verification as owed and unperformed (§8). Mints nothing. FD-65 untouched
(CLOSED entire, per `v2.75`). No host, AWS, database, or Cognito contact
by this document. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-20. Basis: `origin/main` at
`2964fce5d661fd8fef013a1ce5cb3a4fc7fe8d9d`.*
*Authority: the rulings at §4 — drafted by another AI assistant outside
this repository's sessions, adopted by Evoni's approval recorded verbatim
as "approved" on 2026-09-19 (RULED; provenance at §3), definitive copy
fixed by SHA-256 `400970ca…c81b04` over issue #1561's four-backtick
block; Evoni's 2026-09-19 Cognito console read at §6 (ATTESTED — her own
account of her own action); `F-AUTH-1_SessionRefresh_Read_2026-09-19.md`
(the measured defect, cited not re-derived);
`F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md`,
`F-AUTH-1_Fix_Plan_v2.75.md`, and `F-AUTH-1_Fix_Plan_v2.76.md` (priors,
cited not re-derived).*
