| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Rules that `v2.67` §4 precondition 3 is discharged in purpose, not in letter, by the 2026-09-16 live verification `v2.75` §3 already carries. `LOGIN_DISABLED` stays `true`; the flip is not authorized here. Names the test-file rewrite as ordinary owed work, no precondition attached. Closes, reopens, and mints nothing.* |
| --- |

**Document version**

**v2.76 — FIX PLAN REVISION. Mints no new numbers. Discharges `v2.67`
§4 precondition 3 in purpose, on Evoni's ruling.** This document records
a ruling supplied directly by Evoni, at issue #1485, and transcribes it
verbatim — see §4 for the ruling text and its provenance.

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.75.md`. **v2.75's content stands
and is not re-ruled here** — FD-65 closed entire (issuance half closed
on live verification, privilege half closed on the merits at `v2.50`),
and precondition 3 left open as its own owed item, gating nothing about
that closure. This document is what `v2.75` §3 left open: precondition
3's own standing.

**Newest-revision check (§0):**

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.73.md
F-AUTH-1_Fix_Plan_v2.74.md
F-AUTH-1_Fix_Plan_v2.75.md
```

`v2.75` is the newest revision by numeric sort. No newer revision exists
at this basis. Naming this one `v2.76` is correct.

**Basis:** `origin/main` at `35d7d1d8c3342de88c1d5860ad427b7eaa57a2a7`,
2026-09-16 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=short origin/main` → `2026-09-16`).

**FD, XK, and PE tails — re-derived, not carried:**

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -2
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit | grep -E '^FD-7[0-9]|^XK-4|^PE.?69'
(no output — no filed document titled FD-70_*, XK-4_*, or PE-69/PE#69_*)

$ grep -ro 'FD-70' docs/audit/ | wc -l
156
$ grep -r 'XK-4' docs/audit/ | wc -l
70
$ grep -r 'PE #69' docs/audit/ | wc -l
69
```

All three counts are non-zero, and every hit is a "next-available,
unminted" citation (the same standing the register has carried since
`v25_Owed_Index_Amd11`) — no filed document mints any of the three. **FD
tail is FD-69, retired** (spent on a duplicate); **FD-70 is
next-available and unminted.** **XK tail is XK-3**; **XK-4 is
next-available and unminted.** **PE tail is PE #68**; **PE #69 is
next-available and unminted.** Unchanged from `v2.75`'s own
re-derivation. This document mints none of the three.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni** — see §4 for provenance.

**Status**

**Revision. Rules one matter, on Evoni's word.** `v2.67` §4 precondition
3 is **discharged in purpose, not in letter**. `LOGIN_DISABLED` remains
`true` in `tests/integration/f-auth-1-fd65.test.js`; the flip is not
authorized by this document. The test file's rewrite is named as
ordinary owed work, carrying no precondition and gating nothing. FD-65
is untouched — CLOSED entire, as `v2.75` left it. FD tail remains
**FD-69** (retired; FD-70 next-available, unminted); XK tail **XK-3**;
PE tail **PE #68**. Prod **FROZEN** — no host, AWS, or database contact
by this document.

---

# §1. `v2.67` §4 precondition 3, quoted from source

`docs/audit/F-AUTH-1_Fix_Plan_v2.67.md`, lines 90–105:

```
90  # §4. Reactivation condition
91
92  **If `POST /api/v1/auth/login` is re-enabled in any form, FD-65's issuance half
93  reopens as a precondition of that work, not as a discovery after it.**
94
95  The re-enabling instrument must state, before the route serves again:
96
97  1. what verifies the credential;
98  2. what the token carries, and that it is not caller-supplied; and
99  3. how both are tested — the assertions skipped at
100     `tests/integration/f-auth-1-fd65.test.js` behind `LOGIN_DISABLED` are
101     restored by setting that constant to `false`, and they must pass.
102
103 **This condition is carried in three places so it cannot be missed from any of
104 them:** here; in the handler comment at `src/routes/auth.js`; and in the named
105 `LOGIN_DISABLED` constant in the test file.
```

**Precondition 3 is item 3 above:** the flip-and-pass method, named as
*how* preconditions 1 and 2 are tested — not as a fourth, independent
claim.

---

# §2. `v2.73` §3 and `v2.75` §3, quoted from source — precondition 3 survives FD-65's closure as its own item

`docs/audit/F-AUTH-1_Fix_Plan_v2.73.md`, lines 189–221 (the two-criteria
structure and precondition 3's standing at that revision):

```
189 > **Ruling (Evoni, 2026-09-16).** FD-65's issuance half is **REOPENED**,
190 > effective 2026-09-15, on the trigger `v2.67` §4 names: `POST
191 > /api/v1/auth/login` was re-enabled by PR #1457. This records the
192 > reopening that `v2.67` made automatic on the trigger; it is not a
193 > judgment that it should reopen.
194 >
195 > Closure proceeds in two stages, on the register's existing
196 > DISCHARGED-then-closed distinction rather than a new one.
197 >
198 > **Discharge** is by `v2.67` §4's three preconditions. Preconditions 1
199 > and 2 are **MET**, confirmed at
200 > `F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` §5: the
201 > handler performs a real Cognito `InitiateAuth` exchange, and its
202 > response is built from the id token's claims, never from the request
203 > body. Precondition 3 is **NOT MET** and is not a one-line change:
204 > `LOGIN_DISABLED` remains `true` in
205 > `tests/integration/f-auth-1-fd65.test.js`, and that file's own comment
206 > records why flipping it would not make the assertions pass — its mock
207 > cannot produce a token that `src/middleware/auth.js`'s verifier
208 > accepts, and deciding how or whether to fabricate one without live
209 > Cognito contact is unscoped work. Discharging precondition 3 therefore
210 > requires that design decision first, then the flip, then the
211 > assertions passing.
212 >
213 > **Closure** is by live verification against the real Cognito pool, per
214 > my ruling (c) of 2026-09-14, which stands unchanged. Discharge of
215 > `v2.67`'s preconditions does not close the issuance half; it
216 > establishes that the code is shaped correctly. Only exercising it
217 > against the real pool closes it, and no agent session performs that.
218 >
219 > `v2.67`'s CLOSED-BY-REMOVAL standing is superseded as of 2026-09-15 —
220 > the removal it rested on no longer holds. The privilege half remains
221 > CLOSED on the merits, unaffected.
```

`docs/audit/F-AUTH-1_Fix_Plan_v2.75.md`, lines 147–166 (closure, and
precondition 3's standing after it):

```
147 > **Closure fires on its own criterion.** `v2.73` §3 named discharge and
148 > closure as two separately evidenced criteria, not a sequence. Nothing
149 > in its text makes discharge a precondition of closure. Today's
150 > verification answered closure's question directly, through closure's
151 > own evidence, without routing through `v2.67` §4's preconditions.
152 > Reading closure as requiring discharge first would be a new rule, not
153 > a restatement of `v2.73`, and I am not introducing one.
154 >
155 > **Precondition 3 remains owed**, as its own item and not as a blocker
156 > on this closure. `LOGIN_DISABLED` is still `true` in
157 > `tests/integration/f-auth-1-fd65.test.js`, and the design question
158 > `v2.73` §3 named — how, or whether, to fabricate a verifier-acceptable
159 > token without live Cognito contact — is still unscoped. It survives
160 > this closure rather than being retired by it.
161 >
162 > **FD-65 is closed entire.** The privilege half closed on the merits at
163 > `v2.50`/`75ac05f0`; the issuance half closes here. `v2.67`'s
164 > CLOSED-BY-REMOVAL standing, superseded at `v2.73`, is not restored —
165 > this is closure on the merits, not on removal.
```

**What these two passages establish, read together:** `v2.73` §3 held
discharge and closure apart as two separately evidenced criteria — FD-65
could close without precondition 3 being met, and it did, at `v2.75`.
Precondition 3 was carried forward as its own item at each step, not
mooted by the closure it sat beside. This document is the first to rule
on precondition 3's own standing, not on FD-65's.

---

# §3. The test file's current state, quoted from source

```
$ grep -n "LOGIN_DISABLED" tests/integration/f-auth-1-fd65.test.js
56:// LOGIN_DISABLED, despite its name, no longer means "/login is disabled" —
62:// Cognito contact), so the assertions gated by LOGIN_DISABLED remain
72:const LOGIN_DISABLED = true;
73:const describeLogin = LOGIN_DISABLED ? describe.skip : describe;
74:const testLogin = LOGIN_DISABLED ? test.skip : test;
```

`LOGIN_DISABLED` is `true`. The file's own comment, `tests/integration/f-auth-1-fd65.test.js` lines 50–71:

```
50  // FD-65 ISSUANCE HALF CLOSED 2026-08-22 — no longer current. Task #1456
51  // (2026-09-15) re-enabled /login against real Cognito, under Evoni's ruling
52  // (a) in F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md; the "returns 401
53  // and no accessToken, whatever is supplied" claim this banner used to
54  // describe is gone — see the rewritten describe block below instead.
55  //
56  // LOGIN_DISABLED, despite its name, no longer means "/login is disabled" —
57  // it now gates only whether THIS FILE exercises /login's response over a
58  // real signature-verified HTTP round trip. That still doesn't happen here:
59  // this file's mock (above) never returns a token shaped so that auth.js's
60  // verifier would accept it (a genuine Cognito access token is RS256, signed
61  // by Cognito's own key, which this file cannot fabricate without live
62  // Cognito contact), so the assertions gated by LOGIN_DISABLED remain
63  // skipped, unchanged from before this PR. Re-enabling them is separate work:
64  // deciding how (or whether) to fabricate an acceptable token for this
65  // specific end-to-end check without contacting Cognito.
66  //
67  // The property those skipped assertions exist to check — that
68  // caller-supplied `groups`/`role` are ignored — still holds in code
69  // (75ac05f0 removed those inputs from the handler; Task #1456's rewrite
70  // reads only `email`/`password` from the request body, per the active test
71  // below) and is asserted there without needing a verifiable token.
```

**This comment is the reason precondition 3 has stayed open:** the
file's own mock cannot produce a token shaped so that `src/middleware/auth.js`'s
verifier would accept it, because a genuine Cognito access token is
signed by Cognito's own key. Flipping `LOGIN_DISABLED` without solving
that would not make the skipped assertions pass — they would fail on an
unverifiable token, not exercise the property they check.

---

# §4. Evoni's ruling, 2026-09-16

**Provenance.** The ruling text below originates with Evoni directly, as
the "Prompt for Claude Code" step 5 of issue #1485
(`github.com/angelcreator113/Episode-Canonical-Control-Record/issues/1485`),
which she authored and filed on 2026-09-16 as the repository owner. This
is a different disclosure than `v2.73`'s or `v2.75`'s — there, text was
drafted in a live session and then reviewed clause-by-clause and
confirmed by her; here, the text is hers from its first draft, transcribed
into this document without alteration. Both are the register's standard:
a ruling stated in Evoni's own words, not composed by an agent session
and merely approved.

> **Ruling (Evoni, 2026-09-16).** Precondition 3 is discharged in
> purpose, not in letter. `v2.67` §4 named a method — flip
> `LOGIN_DISABLED`, pass the restored assertions — as the way to
> demonstrate that preconditions 1 and 2 hold. That demonstration has
> since been made directly, against the live pool, by an instrument
> `v2.67` could not have named because it required access `v2.67`'s own
> basis did not have. The purpose the method served is satisfied. The
> method itself has not been performed and is not being waived:
> `LOGIN_DISABLED` remains `true`, the assertions remain skipped, and
> this document does not authorize flipping the constant.

---

# §5. The live verification, cited by attestation — not restated

`v2.75` §3 already carries Evoni's account of the live verification this
ruling rests on. It is cited here, not restated as this document's own
finding, and no token, credential, or field value is repeated:

`docs/audit/F-AUTH-1_Fix_Plan_v2.75.md`, lines 137–145:

> The verification was performed by me on 2026-09-16, outside any agent
> session: `initiate-auth` against the pool's one app client returned an
> `AuthenticationResult` with no `SECRET_HASH` sent; `POST
> /api/v1/auth/login` returned the five pinned contract fields; `GET
> /api/v1/auth/me` accepted the access token that endpoint issued and
> returned the user. The app issues a token against the real pool and
> its own middleware accepts it. That is what ruling (c) asked and it is
> satisfied. This record is ATTESTED — my account of my own action; no
> session performed or witnessed it.

**Standing: ATTESTED**, unchanged from `v2.75` — Evoni's own account of
her own action, not reproducible from the repository, not re-derived or
strengthened by this document.

---

# §6. Consequence

**Precondition 3 is no longer an open owed item against FD-65 or
`v2.67`.** It does not block, gate, or reopen anything — FD-65 remains
CLOSED entire, exactly as `v2.75` left it.

**The test file's assertions remain worth rewriting.** Some were written
against a login path that no longer exists (§3's comment, lines 50–54:
the pre-Task-#1456 "returns 401 and no accessToken, whatever is
supplied" claim). What they should test now, given `LOGIN_DISABLED`'s
own comment that its name is no longer accurate (§3, lines 56–57), is a
question this document does not answer. **That rewrite is ordinary
technical debt from this point, carrying no precondition and gating
nothing.** It is named here as owed; scoping it is not this document's
work.

---

# §7. What could make this ruling wrong — checked against the assertions' own text

The ruling rests on the live verification (§5) having demonstrated what
the flip-and-pass method (§1) was meant to demonstrate — that
preconditions 1 and 2 hold. If any of the assertions `LOGIN_DISABLED`
gates tests a claim the live run's own account does not cover, that is a
harder case for discharge, and it is stated directly here rather than
left abstract.

The three gated assertions, quoted from
`tests/integration/f-auth-1-fd65.test.js`:

**`describeLogin` block, lines 121–133** (gated by `LOGIN_DISABLED` via
`describeLogin`):

```
121 describeLogin('POST /login ignores caller-supplied privilege', () => {
122   test('echoes ["USER"] when the caller asks for ADMIN', async () => {
123     const res = await anonymousLogin({
124       email: 'escalate@example.test',
125       password: 'password123',
126       groups: ['ADMIN'],
127       role: 'admin',
128     });
129
130     expect(res.status).toBe(200);
131     expect(res.body.data.user.groups).toEqual(['USER']);
132     expect(res.body.data.user.groups).not.toContain('ADMIN');
133   });
```

**Same block, lines 135–150:**

```
135   test('signs ["USER"] into the token, not merely into the response', async () => {
136     const res = await anonymousLogin({
137       email: 'escalate@example.test',
138       password: 'password123',
139       groups: ['ADMIN'],
140       role: 'admin',
141     });
142
143     // decode, not verify — this asserts what was signed, and the signature
144     // is already covered by the FD-63 suite's wrong-signature control.
145     const payload = jwt.decode(res.body.data.accessToken);
146
147     expect(payload.groups).toEqual(['USER']);
148     expect(payload.groups).not.toContain('ADMIN');
149     expect(payload.role).not.toBe('admin');
150   });
151 });
```

**`testLogin`, lines 153–168** (gated by `LOGIN_DISABLED` via
`testLogin`):

```
153 describe('the resulting token against an ADMIN gate', () => {
154   testLogin('is refused by authorize(["ADMIN"]) — 403, not 200', async () => {
155     const login = await anonymousLogin({
156       email: 'escalate@example.test',
157       password: 'password123',
158       groups: ['ADMIN'],
159       role: 'admin',
160     });
161
162     const res = await request(app)
163       .get(ADMIN_GATED_URL)
164       .set('Authorization', `Bearer ${login.body.data.accessToken}`);
165
166     expect(res.status).toBe(403);
167     expect(res.body).toHaveProperty('code', 'AUTH_GROUP_REQUIRED');
168   });
```

**What each one actually checks, stated plainly:** all three send a
login request with caller-supplied `groups: ['ADMIN']` and `role:
'admin'`, and check that the escalation attempt fails to take effect —
the echoed groups, the signed token's groups and role, and the
downstream `authorize(['ADMIN'])` gate's refusal. **This is FD-65's
privilege half, stated directly and specifically: that `POST /login`
issues no caller-supplied groups or roles, tested end to end against a
real signature-verified token and a real authorization gate.**

**The live verification's own account (§5) did not exercise this.**
Evoni's cited account is of an ordinary login — `email`/`password`
only, no `groups` or `role` field — followed by `GET /me`. Nothing in
that account describes a login attempt carrying caller-supplied
`groups: ['ADMIN']`, an inspection of the resulting token's `groups`
claim, or a call against an ADMIN-gated route with that token. **The
live run demonstrated that the issuance path works end to end; it did
not demonstrate that caller-supplied privilege is rejected end to end.**

**This is stated as the harder case for discharge, not softened.** The
ruling at §4 holds that the *purpose* precondition 3's method served —
demonstrating preconditions 1 and 2 — is satisfied by the live
verification, on the reasoning that precondition 2 ("what the token
carries, and that it is not caller-supplied") was independently
confirmed **by code reading**, not by this live run: `v2.73` §3 (quoted
at §2 above) cites `F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md`
§5 for that confirmation — "the handler performs a real Cognito
`InitiateAuth` exchange, and its response is built from the id token's
claims, never from the request body" — a claim about the code's shape,
not about a live escalation attempt against the real pool. **The live
verification's own contribution is to precondition 1** (that the
mechanism succeeds against the real pool), which the three quoted
assertions do not test at all — they test precondition 2's behavioral
consequence, on a mocked exchange, not precondition 1. **A reader who
holds that "how both are tested" in `v2.67` §4 item 3 requires a single
live instrument exercising both preconditions together — not one
instrument for each — would find this ruling does not reach that bar**:
no cited evidence, live or code-read, is a single round trip that both
authenticates against the real pool *and* attempts caller-supplied
escalation in the same call. That gap is real and is not closed by
anything cited above; the ruling at §4 rests on treating the two
preconditions' confirmations as sufficient in combination, not on
denying the gap exists.

---

# §8. What this revision does not do

- **Does not close, reopen, or alter FD-65**, which is **CLOSED entire**
  at `v2.75` — the issuance half closed on live verification, the
  privilege half closed on the merits at `v2.50`. Nothing here touches
  either standing.
- **Does not mint FD-70, XK-4, or PE #69.** §0's re-derivation confirms
  all three remain next-available and unminted.
- **Does not re-rule `v2.72` §3 or §4.** Neither is cited or revisited
  here.
- **Does not touch the group-case-mismatch finding**
  (`F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md`) **or its FD-70
  minting question.** That is a separate, unrelated line of the
  register; this document neither advances nor closes it.
- **Does not authorize any code or test change.** `LOGIN_DISABLED` stays
  `true`; the assertions at §7 stay skipped; `tests/integration/f-auth-1-fd65.test.js`
  is not edited by this document or by the ruling it records.
- **Does not scope the test-file rewrite** named as owed at §6. What the
  rewritten assertions should check, and how, is left open.
- **Contacts no host, AWS, or database itself.** The verification this
  document cites was performed by Evoni, outside any agent session, per
  `v2.75` §3. Prod **FROZEN**.

---

*Type: Fix Plan revision. Rules `v2.67` §4 precondition 3 discharged in
purpose, not in letter. Mints nothing. FD-65 untouched (CLOSED entire,
per `v2.75`). Names the test-file rewrite as ordinary owed work, no
precondition attached. No host, AWS, or database contact. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-16. Basis: `origin/main` at
`35d7d1d8c3342de88c1d5860ad427b7eaa57a2a7`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.67.md` §4 (cited, not re-ruled),
`F-AUTH-1_Fix_Plan_v2.73.md` §3 and `F-AUTH-1_Fix_Plan_v2.75.md` §3
(two-criteria structure and closure, cited not re-derived), and Evoni's
ruling at §4 above (RULED — her own words, transcribed verbatim from
issue #1485; see §4's provenance note).*
