| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 — CP11 CONFIRMATION PASS** *One CP of twelve. 3 recorded dispositions read against code at CP11's own basis commit. 3/3 agree — the smallest CP, and the one Measurement v2 recorded as body-closure agreement.* |
| --- |

# F-AUTH-1 Limb 1 — CP11 Confirmation

**Document type: evidence.** Performs limb 1 (Ruling 3) for one CP — CP11 —
of the twelve-CP historical population Ruling 2 fixes. Eleventh CP
confirmed; CP1–CP10 were done separately. Per Ruling 4, this is a durable
partial result. **With this pass, only CP12 remains for limb 1 to
discharge.**

**Basis:** `origin/main` at `f92a4edade600d8412fb22dd0ac6726c5ac32418`,
2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Confirmation pass, not a re-derivation. Mints nothing. Limb 1 **OPEN**;
limb 3 open; G4 not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

---

# §1. Method, quoted before any read (`F-AUTH-1_Fix_Plan_v2.68.md` §2–§6)

**Ruling 1 (§2) — the unit is one recorded CP disposition, not one
handler.**

**Ruling 2 (§3) — the population is the historical CP1–CP12 swept set.**

**Ruling 3 (§4) — one judgment is a confirmation, not a re-derivation.**

**Ruling 4 (§5) — decomposable per CP, partial results hold:**

> "The CPs closed separately." "Limb 1 discharges when all twelve are
> done, and not before."

**Ruling 5 (§6) — the `~700` work estimate is WITHDRAWN.** Not relied on
here.

---

# §2. Population — CP11's recorded dispositions, established

## §2.1 Locating CP11

```
$ git log --all --oneline --grep="CP11" -i | grep -i "Step 3 CP11"
acc172f78 F-AUTH-1 Step 3 CP11: Cleanup CP

$ git log -1 --format='%H %ad %s' --date=short acc172f78
acc172f78f913eeee28fa7c26ca8ebb590e547a3 2026-05-09 F-AUTH-1 Step 3 CP11: Cleanup CP

$ git merge-base --is-ancestor acc172f78 origin/main && echo "IS ANCESTOR" || echo "NOT ANCESTOR"
IS ANCESTOR

$ git log -1 --format=%P acc172f78
b0a404e77765efbbb75b4fb4ebebf44fe0b83d5f
```

**CP11's commit: `acc172f78f913eeee28fa7c26ca8ebb590e547a3`, 2026-05-09,
confirmed an ancestor of `origin/main`.** Its parent is CP10's commit
directly (`b0a404e77`, confirmed at
`F-AUTH-1_Limb1_CP10_Confirmation_2026-09-02.md`).

## §2.2 Source 1 — the code commit's message body

```
$ git log -1 --format=%b acc172f78
```

Full body read (79 lines). The disposition-bearing content is the opening
summary, quoted in full:

> "3 source files / 17 handlers (sub-form b AUTH-DISABLED ADD) —
> beats.js 5 + markers.js 7 + audio-clips.js 5 = 17 Tier 1 ADD — 3
> AUTH-TEMPORARILY-DISABLED banners removed."

**This is CP11's entire disposition-bearing content — a genuinely small
"cleanup CP"** per the record's own "Files modified (6): src/routes/beats.js
— banner removed; requireAuth import + 5 handlers / src/routes/markers.js
— banner removed; requireAuth import + 7 handlers / src/routes/audio-clips.js
— banner removed; requireAuth import + 5 handlers" (the other three
modified files are new test files, not dispositions).

## §2.3 Identifying and confirming the file set

```
$ git diff --stat b0a404e77..acc172f78 -- src/routes
 src/routes/audio-clips.js | 40 +++++++++-------------------------------
 src/routes/beats.js       | 40 +++++++++-------------------------------
 src/routes/markers.js     | 43 ++++++++++---------------------------------
 3 files changed, 28 insertions(+), 95 deletions(-)
```

**Three files, matching the commit body's own count.**

## §2.4 The population: 3 recorded dispositions

| # | scope | class | recorded count |
|---|---|---|---|
| 1 | `beats.js` | Tier 1 ADD (from AUTH-DISABLED, zero-middleware) | 5 |
| 2 | `markers.js` | Tier 1 ADD (from AUTH-DISABLED, zero-middleware) | 7 |
| 3 | `audio-clips.js` | Tier 1 ADD (from AUTH-DISABLED, zero-middleware) | 5 |

**This reaches 3, independently, from the commit body alone.** It matches
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md` §2's CP11 row (`beats 5,
markers 7, audio-clips 5` → **3** — that document's own note: **"the sole
CP where both sources agree in granularity"**), filed 2026-08-23.

---

# §3. CP11's basis commit, on the face

**`acc172f78f913eeee28fa7c26ca8ebb590e547a3`** — found per §2.1, confirmed
an ancestor of `origin/main`. All reads in §4 are `git show
acc172f78:<path>` across the three files at §2.3, and one diff against its
parent `b0a404e77` (CP10's commit) to confirm the banner removal, per
Ruling 3.

---

# §4. Confirmation table — 3/3

| # | Disposition (scope · class) | path:line | Recorded | Observed | Verdict |
|---|---|---|---|---|---|
| 1 | `beats.js` · Tier 1 ADD | `src/routes/beats.js:17,18,21,22,23` | 5 handlers, `requireAuth`, banner removed | 5 routes, all `requireAuth`; zero `AUTH.?DISABLED` matches in the file; diff vs `b0a404e77` shows the `✅ AUTH TEMPORARILY DISABLED FOR TESTING` comment removed and all 5 handlers gain `requireAuth` where they previously carried no auth middleware at all | **agree** |
| 2 | `markers.js` · Tier 1 ADD | `src/routes/markers.js:15,16,17,24,25,26,27` | 7 handlers, `requireAuth`, banner removed | 7 routes, all `requireAuth`; zero `AUTH.?DISABLED` matches | **agree** |
| 3 | `audio-clips.js` · Tier 1 ADD | `src/routes/audio-clips.js:18,19,22,23,24` | 5 handlers, `requireAuth`, banner removed | 5 routes, all `requireAuth`; zero `AUTH.?DISABLED` matches | **agree** |

**3/3 agree. 0 disagree. 0 cannot-tell. Cannot-tell rate: 0/3.**

---

# §5. Zero `cannot-tell`, and why this CP is the clean case

`v2.68` §4.1's discriminator concerns unexplained zeros. CP11's is the
easiest of the ten confirmed so far to explain: it is the smallest CP in
the population (17 handlers, 3 files), the commit body itself states
`F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s exact three-item shape with
no aggregation or bundling to untangle, and its own architectural-findings
section calls it *"the first true cleanup CP at single-session pace"* —
consistent with a small, fully-legible record. Every claim here was
checked against a direct line-level read of three small files (200 lines
combined) plus one targeted diff for the banner-removal claim, not a
count-based inference.

**This is the one CP this programme's confirmation passes and the prior
Measurement v2 document agree was already unambiguous** — Measurement
v2's own §3 states CP11 is *"the sole CP where both sources agree in
granularity"* among the thirteen it surveyed. This pass's independent
derivation reaching the same three items by the same reasoning corroborates
that observation rather than testing it further.

---

# §6. Tails, re-derived at this basis, not carried

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
56

$ grep -r 'XK-4' docs/audit/ | wc -l
34

$ grep -r 'PE #69' docs/audit/ | wc -l
34
```

**Unchanged from `F-AUTH-1_Limb1_CP9_Confirmation_2026-09-02.md`'s own read
(56 / 34 / 34).** This document does not add an `FD-70`, `XK-4`, or
`PE #69` citation, so it does not move any of the three counts, and the
read confirms that.

---

# §7. What this document does not do

- **Performs limb 1 for CP11 only.** CP12 is the sole remaining CP. Limb 1
  stays **OPEN** — Ruling 4 requires all twelve.
- **Does not touch CP11's own architectural findings** — the §5.8
  closure-marker retraction, the CP12-addition decision, the G1/G2/G6
  program-wide grep results the commit body reports. This pass confirms
  only the three Tier dispositions CP11 itself recorded; it does not
  re-verify CP11's out-of-scope inventory or its recommendations for CP12.
- **Does not re-derive or challenge any of CP11's Tier dispositions.**
  Every row above asks whether CP11's own code matches CP11's own recorded
  claim.
- **Does not re-run or extend `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`'s
  129-count**, and does not treat its CP11 row as authority for this
  pass's population — §2.4 built the population independently and notes
  where the two agree.
- **Does not touch `src/` or `frontend/`.** No code changed. No host, AWS,
  database, or Cognito contact. No endpoint exercised.
- **Does not size limb 1** or estimate remaining work.
- **Mints nothing.** No FD, XK, or PE number is assigned.
- **Does not amend any merged document**, including CP11's own closure
  document, `v2.68`, `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, or the
  CP1/CP2/CP3/CP4/CP5/CP6/CP7/CP8/CP9/CP10 confirmation passes.

---

*Type: evidence (confirmation pass). Rules nothing. Mints nothing. All reads
local git at `f92a4edad`, against CP11's basis commit `acc172f78`. No host,
AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
