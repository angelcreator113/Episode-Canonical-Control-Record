| **PRIME STUDIOS** **OBSERVABILITY INSTRUMENT** *Attribution of API writes is unavailable in principle. Ships no code. Mints nothing.* |
| --- |

# The attribution gap

**Date:** 2026-08-22
**Basis:** `origin/main` at `29cee698`, derived live.
**Status:** **DRAFT.** Ships no code. Changes no gate. **Mints nothing** — FD
tail **FD-69**, XK tail **XK-3**, PE tail **PE #67**. §7 proposes a disposition
and does not take it.
**Environment contact — stated in full:** source and schema reads; a
per-router composed-stack walk with `src/app` **not** required; AWS ELB and EC2
API metadata reads. **No host contacted. No endpoint exercised. No database
read.** Prod FROZEN.

---

# §1 The claim

**Attribution of any API write is unavailable in principle from what this
system retains.** Not unsearched — **unretained**. Four gaps, each independent,
which together close every route to the question *"who did this?"*

| # | gap | established by |
|---|---|---|
| 1 | **151 of 154 models cannot record who updated a row** | schema read |
| 2 | **Write handlers overwhelmingly do not reference the actor** | composed-stack walk |
| 3 | **ALB access logging is DISABLED**, and no log bucket exists | ELB API |
| 4 | **No VPC flow logs exist in the account**; CloudTrail is management-plane only | EC2 / CloudTrail API |

**FD-65 is the occasion for noticing this. It is not the scope.** The gap
predates it, is unaffected by its closure, and applies to every write path in
the application.

# §2 Gap 1 — the schema cannot hold the answer

Across **154 model files**:

| | count |
|---|---|
| declare `created_by` | **9** |
| declare `updated_by` | **3** |
| declare both | 3 |

The three are `Marker.js`, `Scene.js`, `SceneLibrary.js`.

**So 151 of 154 models have no column in which the identity of an updater could
be stored, however well the application behaved.** Soft-delete records
`deleted_at` — *when*, never *who*.

**This is a schema fact and carries no instrument limitation.**

# §3 Gap 2 — the handlers do not supply it either

Per-router composed-stack walk, `asyncHandler` unwrapped, over **890 write
declarations**:

| | count |
|---|---|
| handler references `req.user` | **48** |
| handler writes an actor column | **9** |
| handler does neither | **553** |
| **not readable by this instrument** | **286** |

**Stated as a limitation, not smoothed:** 286 declarations (32%) resolved to a
wrapper this instrument could not unwrap, and are **excluded rather than
counted as absent**. The figures above describe the 604 that were readable.

**The direction is safe regardless.** Even if all 286 unreadable declarations
recorded the actor perfectly, at most 343 of 890 would — and **553 are
positively established to record nothing.**

# §4 Gaps 3 and 4 — nothing outside the application recorded the request

- **ALB access logging is disabled.** `access_logs.s3.enabled = false`, no
  bucket configured, and **no S3 log bucket exists in the account.**
- **No VPC flow logs exist anywhere in the account.**
- **CloudTrail records management-plane events only** and would never capture
  an application request.

**The only remaining evidence of any API write is nginx or application logs on
the instance itself**, across whatever retention those have — a host read, and
for anything historical, very probably rotated away.

# §5 The standing rule this requires

**RULE: where attribution is unavailable, the register must report that it
cannot tell, and must not report that nothing happened.**

**"We checked and cannot tell" is not "no evidence of compromise."**

The second is the sentence that gets written, because it is shorter and sounds
like a result. **Here it would be false.** There is no evidence in either
direction, **by construction** — the system did not retain what would have
constituted evidence.

An instrument reporting on any question of the form *"did someone do X through
the API?"* must state:

1. that attribution is unavailable for the period in question;
2. which of §1's four gaps applies; and
3. that the absence of adverse findings is **an absence of records, not an
   absence of events.**

**A clean report and an empty one are indistinguishable here, and the register
must say which it is holding.**

# §6 The remedy, costed honestly

**Two changes convert the next question from unanswerable to answerable:**

1. **Enable ALB access logging** to an S3 bucket with a retention policy. One
   attribute change; captures every request reaching the load balancer.
2. **Record the actor on write paths** — and per §2 and §3 this is **a pattern,
   not a column.** Three models can hold an updater today. The remedy is a
   convention applied across write handlers and the schema they touch, not an
   `updated_by` added to one table.

**NEITHER IS RETROACTIVE, AND THIS MUST NOT BE COMPRESSED.**

**Neither change answers anything about the period already elapsed.** A reader
who sees "forward remedy" will hear "addressed." **It is not addressed. It is
prevented from recurring.** The question of who did what through this API
before today remains permanently unanswerable, and no work proposed here
changes that.

**What they are worth:** they change what the system can know about itself.
Every subsequent instance of this question becomes answerable, which is more
than a better description of the problem.

# §7 Disposition — proposed, not taken

**Gap 1 and gap 2 are application defects** and want an owner in the fix-cycle
sequence. **Gaps 3 and 4 are infrastructure observability** and sit closer to
F-Deploy-1's surface.

**Whether this is one item or two is a real question**, and the answer
determines whether it can be closed by one remedy or needs two.

**Not taken here.** A tail was advanced today for a duplicate — FD-69, retired
at PR #1102 — and the same restraint applies: **the author of this document is
not the right party to take a minting decision unreviewed on the same day.**

# §8 What this instrument does not do

- **Mints nothing**, advances no tail, and proposes no code change beyond §6's
  two remedies, neither of which is authorized here.
- **Does not assert that any exploitation occurred.** It asserts that the
  question is not answerable, which is a different claim and the only one the
  evidence supports.
- Does not read any database, contact any host, or exercise any endpoint.
- Does not reopen FD-65, which is closed, or bear on its closure.
- Does not resolve the 286 unreadable write declarations at §3.
- Does not alter the freeze.

---

*Type: observability instrument. States a gap, a reporting rule, and a
non-retroactive remedy. Mints nothing. No host contacted, no endpoint
exercised, no database read. Prod FROZEN.*
