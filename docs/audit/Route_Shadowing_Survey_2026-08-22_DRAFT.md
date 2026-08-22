| **PRIME STUDIOS** **SURVEY — ROUTE SHADOWING** *Enumerates a class. Mints nothing. Adjudicates no member.* |
| --- |

# Survey — shadowed route declarations

**Date:** 2026-08-22
**Basis:** `origin/main` at `2fea0572`, derived live.
**Status:** **DRAFT.** Mints nothing — FD tail remains **FD-69**; XK tail
**XK-3**; PE tail **PE #67**. Ships no code. Changes no gate. **Adjudicates no
member.**
**Environment contact — stated in full:** per-router composed-stack loading;
`src/app` was **not** required. **No database connection was initialized. No
deployed host contacted. No AWS call. No Cognito contact. Prod FROZEN.**
**Supersedes:** the single-instance framing of PR #1084, not its finding (§1).

---

## §1 What this supersedes, and what it does not

**PR #1084 established that `GET /api/v1/compositions/search` is dead.** That
finding stands unchanged and is reproduced here by an independent instrument.

**What #1084 framed as one route is a class with six members in four files.**
Five were unknown before this survey. **#1084's single-instance framing is
superseded; its finding is not.**

## §2 The class has two mechanisms, and the founding instance belongs to the second

| | mechanism | instances |
|---|---|---|
| **M1** | the same `(method, path)` declared twice in one router | **2** |
| **M2** | a **literal** path declared after a **parameterized** path that matches it | **4** |

**`/search` is an M2 instance, not M1.** It is not a duplicate declaration —
`/:id` matches the literal string `search`.

**The first sweep written for this class enumerated M1 only.** It would have
returned two instances and **missed the very finding the class was generalized
from.**

## §3 The transferable control

**When an instrument is built to generalize from known instances, run it
against those instances first.**

A sweep that cannot reproduce its own founding case is not a sweep of the
class, however clean its output looks. Here the failure was visible only
because a known member existed to test against — the M1 pass returned a
plausible, well-formed result of two instances, and nothing in that result
indicated `/search` was missing from it.

**This control would also have caught the identity-matching blind spot
corrected at v2.65's second banner**, had a member with a factory-derived
closure been on the known list. **The same control catches both, and neither
was caught by redundancy.**

## §4 The six members

Detected by walking each router's composed stack and, for M2, by calling each
Layer's own `match()` — **real Express matching, not inference.**

**M1 — exact duplicate declaration**

| method | path | file | live | shadowed |
|---|---|---|---|---|
| PUT | `/:id` | `src/routes/compositions.js` | `:480` | **`:817`** |
| GET | `/episode/:episodeId` | `src/routes/thumbnails.js` | `:65` | **`:136`** |

**M2 — literal shadowed by an earlier parameterized path**

| method | dead path | file | shadowed by |
|---|---|---|---|
| GET | `/search` `:1188` | `src/routes/compositions.js` | `/:id` `:458` |
| GET | `/artifact-categories` `:1099` | `src/routes/sceneSetRoutes.js` | `/:id` `:229` |
| POST | `/bulk/upscale` `:248` | `src/routes/wardrobe.js` | `/:id/upscale` `:226` |
| POST | `/bulk/analyze` `:251` | `src/routes/wardrobe.js` | `/:id/analyze` `:238` |

**`thumbnails.js:136` is a multiline declaration** — `router.get(` and its path
argument on separate lines. **It is invisible to a line-anchored grep and was
found only by the composed-stack walk**, which is the failure mode v2.61 §4.3
names in terms.

## §5 Reachability — all six are dead, and an earlier test of mine was wrong

**A shadowed declaration is reachable only if an earlier matching route hands
off to the next *route*. In Express that requires `next('route')`. Plain
`next()` advances within the same route's own stack and never reaches a later
declaration.**

**`next('route')` occurs zero times in all of `src/`.** Therefore **no
route-level fall-through exists anywhere in this codebase, and all six shadowed
declarations are unreachable.**

**Correction to an intermediate result.** An earlier pass reported two of the
six as *unresolved*, on the grounds that the live declaration's middleware
referenced `next()`. **That test was miscalibrated.** The `next()` occurrences
belonged to `validateUUIDParam` and `aiRateLimiter` — ordinary middleware
chaining, not fall-through. **The correct predicate is `next('route')`, and
under it nothing is unresolved.** Recorded because the earlier result was
well-formed and would have been carried as caution rather than as error.

## §6 The question that would have made this urgent — answered negative

**No shadowed declaration carries authentication or ownership that its live
twin lacks.** Checked in both mechanisms:

- every pair carries **identical** authentication middleware;
- **no member of any pair references `req.user`**.

**`compositions.js:817` is a dead duplicate, not a dead fix.** The concerning
shape — a corrected, guarded handler silently replaced by an earlier unguarded
declaration — **does not occur in this codebase at this basis.**

## §7 The sharpest instance, and what is not established

**`POST /api/v1/wardrobe/bulk/upscale` resolves to `/:id/upscale` with
`id = "bulk"`.** A bulk operation silently becomes a single-item operation
against a nonexistent record. `/bulk/analyze` has the same shape against
`/:id/analyze`.

**What the caller sees is not established.** Whether the request 404s, 500s on
a type cast, or succeeds vacuously depends on what the controller does with
`id = "bulk"`, and **that was not traced.** It is the same family as #1084's
recorded uuid-cast flag: **the failure surfaces as something other than what it
is.** Flagged, not asserted.

## §8 Boundary — this enumerates, it does not adjudicate

**Which declaration in each pair is the correct one is a judgment**, and it is
the same kind of judgment limb 1 owns. A shadowed declaration may be redundant,
may be a superseded draft, or may be the intended implementation. **This survey
decides none of that for any member.**

It also does not establish that the live declaration in each pair is correct —
only that it is the one that runs.

## §9 What this survey does not do

- **Mints nothing.** Does not advance any tail.
- **Adjudicates no member** and proposes no remedy.
- Does not amend PR #1084's finding, or v2.45, beyond superseding the
  single-instance framing (§1).
- Does not trace controller behaviour for any dead route (§7).
- Does not touch FD-67, FD-69, limb 1, or any gate. Does not advance Dimension
  3 or alter the freeze.

---

*Type: survey. Enumerates a class of six across two mechanisms. Mints nothing,
adjudicates nothing. No host, AWS, database, or Cognito contact. Prod FROZEN.*
