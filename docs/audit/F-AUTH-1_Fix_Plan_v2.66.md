| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *FD-67 successor procedure, specified. Class B's disposition ruled.* |
| --- |

**Document version**

v2.66 — **SPECIFIES THE SUCCESSOR PROCEDURE v2.65 SCOPED, AND RULES CLASS B'S
AUTH DISPOSITION.** Names all eight members by file and mounted path, assigns
each to a class, and states what adjudicating a member of each
class requires. **Rules the five `roles.js` writes incorrect as unauthenticated
writes (§6).** Class A is specified and **not** adjudicated; **Class C is
empty (§2).**

**Does not close FD-67.** v2.65 requires the procedure to be specified *and
executed*. This specifies it and executes one of the two non-empty classes. FD-67 remains
**OPEN/P2**.

**Rules no remedy** for the five, and **does not adjudicate XK-3** (§6.1, §6.2).

FD tail remains **FD-68**; XK tail **XK-3**; PE tail **PE #67**. Dimension 3
remains **NOT PERFORMED**; limb 3 open; G4 not enterable; ASSESSMENT NOT
COMPLETED. Prod FROZEN.

**Basis:** `origin/main` at `4e403a81`, 2026-08-22.

**Author**

JAWIHP / Evoni — Prime Studios

---

# §1. What this procedure is for

v2.65 retained the global `optionalAuth` mount at `src/app.js:236`, retired
v1.5 §7.7's removal requirement as unexecutable, and **scoped the successor
verification procedure to the write declarations relying on the mount alone**.

§7.7's third checkbox — *"No bare `optionalAuth` on a write route without a
`// PUBLIC:` justifying comment"* — was **not** retired and is what this
procedure discharges.

# §2. The population, named in full

**Eight write declarations. Every member is identified by file and by mounted
path**, because a procedure that cannot name its members is not executable.

| # | method | mounted path | file | class |
|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/login` | `src/routes/auth.js` | A |
| 2 | POST | `/api/v1/auth/refresh` | `src/routes/auth.js` | A |
| 3 | POST | `/api/v1/auth/validate` | `src/routes/auth.js` | A |
| 4 | POST | `/api/v1/roles` | `src/routes/roles.js` | B |
| 5 | PUT | `/api/v1/roles/:roleKey` | `src/routes/roles.js` | B |
| 6 | DELETE | `/api/v1/roles/:roleKey` | `src/routes/roles.js` | B |
| 7 | POST | `/api/v1/roles/bulk-assign` | `src/routes/roles.js` | B |
| 8 | POST | `/api/v1/roles/validate-required` | `src/routes/roles.js` | B |


**Two corrections to v2.65 §6, both carried here.**

**First, the partition.** v2.65 described the non-auth members as *"four
roles-shaped writes, `/validate-required`, and
`/world/generate-ecosystem-preview`."* **`/validate-required` is declared in
`roles.js` and belongs to the roles cluster.**

**Second, the population itself: it is eight, not nine.**
`POST /api/v1/world/generate-ecosystem-preview`
(`src/routes/worldStudio.js:2483`) **is not mount-dependent and is removed from
the population.** It carries its own `optionalAuth({ degradeOnInfraFailure:
true })` — the **§5.45 polymorphic factory** — and a factory-derived closure is
not identity-equal to the exported symbol, so every identity-matching walk
resolved it to `anon`. **It also already carries a `// PUBLIC:` comment with a
recorded rationale and per its own docstring does not persist**, so §7.7's
third checkbox was already discharged for it.

**The split is therefore 3 / 5, over eight members. Class C is empty.** The
full correction, including why three agreeing discovery methods failed to catch
this, is carried once at v2.65's correction banner and is not restated here.

# §3. Why three classes and not one procedure

**Adjudicating these eight is not one kind of judgment.** A uniform step would
either over-specify Class A or under-specify Class B.

- **Class A** is unauthenticated by definition of what the endpoint does.
- **Class B** is unauthenticated *and* derives its tenancy root from
  caller-supplied input, which is a second, separately-owned finding.
- **Class C is empty.** Its sole prospective member proved not to be
  mount-dependent and was removed from the population (§2).

**Stating per-class requirements is also the honest answer to the question
limb 1 cannot yet answer for its own population** — what one judgment consists
of. Here the population is small enough to answer it by enumeration rather than
by rule.

# §4. What adjudicating a member requires, by class

## §4.1 Class A — the three auth endpoints

**Requirement: a recorded rationale and a `// PUBLIC:` comment. Nothing more.**

An authentication endpoint cannot require authentication to reach it;
unauthenticated access is constitutive, not a defect. Adjudication records why,
in the form §7.7's third checkbox requires, and stops.

**What must NOT be inferred:** that these three need no other control.
Rate-limiting, credential-stuffing resistance and lockout are real concerns and
are **outside this procedure**, which asks only whether the *auth disposition*
is correct.

## §4.2 Class B — the five `roles.js` writes

**Requirement: none outstanding. The auth disposition for all five is RULED at
§6.** What remains per member is a *remedy* decision, which §6.1 holds
separate.

All five derive tenancy identically:

```js
const showId = req.query.show_id || req.user?.show_id;   // or req.body.show_id
```

**Caller-supplied input takes precedence; the mount's optional identity is only
a fallback.** So the question is not merely *"is unauthenticated write correct
here"* but *"is an unauthenticated write whose tenancy root is caller-asserted
correct here"* — and the second half is **XK-3**, recorded in the
Cross-Keystone Register as *"no user↔show relation exists, so `show_id` is
caller-asserted and unverifiable."*

XK-3 is **OWNED (F-Stats-1 v1.57)** and **UNEVALUATED**. **XK-3 Gate 3 is OPEN
and requires a live database read under a production freeze.** v2.45 §3 already
reported `roles.js` as an XK-3 instance reached from the F-AUTH-1 side. This
procedure inherits that; it does not discover it and does not extend it.

**§6 rules that these five do not require XK-3's answer in order to be
dispositioned.**

## §4.3 Class C — empty

**No members. No requirement.**

The class was defined for `/world/generate-ecosystem-preview`, which §2 removes
from the population as not mount-dependent. **The class is retained as a
heading rather than deleted**, so that a reader of v2.65's three-way framing can
see where its third member went.

# §5. What the procedure establishes, and what it does not

**On execution, this procedure establishes exactly one thing: for each of the
eight, whether being mount-only is intentional or incorrect, on a recorded
rationale.** It is not a procedure for confirming that all eight are fine —
**§6 rules five of the eight incorrect**, which is a permitted outcome and not a
failure of the procedure.

**It does NOT establish that the global mount is safe.** The mount is inherited
by every declaration in the application. This procedure examines eight. **A
reader must not treat a discharged §7.7 third checkbox as a finding about
`src/app.js:236`,** which v2.65 retained without ruling on its safety and
which FD-63 continues to own.

**It does not establish anything about read declarations.** v2.65 §6 removed
the read set from scope when the mount was retained, and it stays out.

**Nothing is deleted by this branch,** so unlike the removal branch there is no
regression surface and no effective-middleware diff is required. **The boundary
the procedure must state is therefore about scope, not about change.**

# §6. Class B's disposition — RULED

**Ruling: the five `roles.js` writes are incorrect as unauthenticated writes.**

`req.query.show_id || req.user?.show_id` on an unauthenticated write means **the
tenancy root is whatever the caller says it is.** The mount's optional identity
is not a control here — it is a default that a query parameter overrides. **An
anonymous caller can therefore write to any tenant by naming it.**

**XK-3's evaluation could not make this acceptable.** XK-3 asks whether tenancy
isolation holds across the system. It cannot establish that caller-asserted
tenancy on an unauthenticated write is correct, **because it is not,
independently of whatever else XK-3 would find.** Waiting on a frozen gate to
confirm what is already visible would put five of nine members behind
production authorization for no gain.

**The two deferring options are rejected on the same ground.** Option 1
(adjudicate independently of XK-3, recording the tenancy question as owned
elsewhere) defers the question; option 2 (block Class B, discharge A and C
only) defers the members. **Both leave the same fact known and unruled.**

## §6.1 What this ruling does not decide — the remedy

**It rules the five incorrect. It does not rule what the fix is.** Adding
authentication, removing the query-parameter precedence so that tenancy derives
only from verified identity, or both, are **different remedies with different
blast radii** — the last would change behaviour for authenticated callers who
currently pass `show_id` explicitly.

**That is a separate decision, and the contract precedes the code.** This is the
same split that made FD-68 rulable: the disposition is settled here, the remedy
is not, and no revision should read this ruling as authorizing a code change.

## §6.2 What this ruling does not decide — XK-3

**This is not an adjudication of XK-3.** XK-3 remains **OWNED (F-Stats-1
v1.57)** and **UNEVALUATED**. **Gate 3 remains OPEN and prod-gated.** Nothing
here evaluates it, narrows it, or advances it.

**What this ruling establishes is strictly narrower: these five do not need
XK-3's answer in order to be dispositioned.** That is a statement about the five
declarations, not about XK-3's status. **A later revision must not read it as
progress on XK-3**, and must not cite it as evidence bearing on Gate 3.

# §7. Re-derivation requirement

**The population is basis-stamped at `4e403a81` and must be re-derived
immediately before execution.**

v2.65 §8 condition 2 was discharged by confirming the nine, and it recorded its
own revival condition: **a bound confirmed at one basis is not confirmed at
another.** The route surface changes with development. Re-derivation must use
the reconciled method — per-router and app-composition discoveries compared by
route-object identity, deduplicated — and must report **zero mount-only writes
in both difference regions**, which is the check that guards against omission
rather than against disagreement.

**If re-derivation returns a population other than these eight, execution stops
and the scope is re-ruled.** Re-derivation must not rely on function-identity
matching alone: §2's removed member shows that a configured-closure middleware
resolves to `anon` under that criterion. **Declaration-level inspection must
accompany it.**

# §8. What v2.66 does not do

- **Does not close FD-67.** Classes A and C are specified and not adjudicated;
  Class B's remedy is not ruled.
- **Does not rule any remedy** for Class B's five (§6.1), and **does not
  authorize any code change.**
- **Does not adjudicate, narrow, or advance XK-3** (§6.2). Gate 3 stays open.
- Does not rule on the safety of the mount at `src/app.js:236`, or touch FD-63.
- Does not re-open the read set, or amend v2.65's ruling.
- Does not perform limb 1 or size it.
- **Mints nothing.** Changes no gate. Does not advance Dimension 3, discharge
  limb 3, enter G4, or alter the freeze.

---

*Type: procedure specification plus one class disposition. Rules Class B's five
incorrect as unauthenticated writes; rules no remedy and no other member. No
host, AWS, database, or Cognito contact. Prod FROZEN.*
