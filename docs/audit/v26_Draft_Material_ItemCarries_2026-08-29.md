| **PRIME STUDIOS** **V26 DRAFT MATERIAL — THREE CARRIES** *Draft material. Not authority. Mints nothing.* |
| --- |

# v26 draft material — three carries ruled 2026-08-29

**DRAFT MATERIAL.** This file is a carrier for three items ruled by Evoni on
2026-08-29 that have no other durable home until `v26` exists. **It is not
authority, closes nothing, and mints no FD, XK, or PE number.** A `v26` author
should absorb each and may discard this file.

**Basis:** `origin/main` at `7a788f3c...` (tip after PR #1150), 2026-08-29.
Verify the full SHA live; this file states the short form deliberately so a
reader cannot use it as a pinned reference.

**Provenance.** All three carries arise from the session that filed
`v25_Sec6_Item8_Route_Finding_2026-08-29.md` and `v25_Owed_Index_Amd17_2026-08-29.md`.
Ruled by Evoni; drafted by Claude; committed by Evoni from her own workstation.
**Carry 3 was ruled after Carries 1 and 2 and is derived from a full-depth clone**
— see its own provenance note.

---

# Carry 1 — for `v26` Sec 6 (executable checklist)

**Proposed item: re-check `§R4` bullet 1 against `§R4`'s own correction.**
Class: **one-time.**

`v25_Sec6_Item8_Route_Finding_2026-08-29.md` `§R4` opens *"the three gated items
are not three independent blockers"* and its first bullet says item 9 *"is
blocked by the same boundary, more directly than item 8."* **Three paragraphs
below, the same section corrects the shared-blocker claim** — the blocker is that
the established route requires the operator to run the query, which applies to
item 8 and **not** to items 9 or 11.

**The discriminating facts, all in the same filed document:**

```
§R2    item 8's read is "a database read, not a host action ... catalog queries only"
§R1.1  the workstation route is tcp/5432 ingress to canon RDS — a database route
§R4    item 9 is "an environment read on the deployed host"
```

**A database route to RDS does not reach a host environment variable.** Item 8 is
reachable by an established, attributed route; items 9 and 11 are not.

**Why it was not amended in place.** Ruled 2026-08-29: parked here rather than
minted as `Amd18`. The correction paragraph governs where the two conflict and is
unambiguous, so the residue is paragraph ordering rather than a false claim, and
an amendment on a seventeen-deep chain is disproportionate to it.

**The risk this carry exists to cover.** Collapsing the three items invites
authorizing a host session — the heavy decision — in order to reach item 8, which
needs no new authorization surface at all. **A reader who stops at bullet 1 gets
the pre-correction framing.**

**Instrument note.** The residue survived because `§H7` item 12 asked for the
shared-blocker *observation* to be revised, and it was; the bullet above it was
not re-checked against the revision. That is `§H5`'s widened rule — after any
correction, every claim the correction bears on is re-checked, not assumed to
have followed.

---

# Carry 2 — for `v26` Sec 4 (method findings to carry)

**Proposed finding: a coverage check whose items can be satisfied by the same
evidence is not a coverage check.**

**No FD.** Ruled 2026-08-29. `v25` Sec 4 carries five method findings (4.1–4.5)
and **none is FD-numbered** — FDs are findings about the system; Sec 4 carries
findings about audit method. This is the second kind.

**The mechanism, observed twice in one session.**

A twelve-item transcription was checked by matching a distinctive phrase per
item, globally across the document. **Item 10's anchor regex matched a string
present for item 8's sake** — `"VOID FOR EXECUTION"`, which item 8 requires as a
bound on the address-identity OWED item. **Item 8's evidence satisfied item 10's
check.** The result was reported as twelve of twelve and repeated in a commit
message. Item 10 was in fact absent from both documents.

**Why phrase-matching cannot be repaired into covering it.** `§H7` item 10 is a
**bare pointer** — *"§H6's contamination correction"* — with no quotable phrase.
A phrase-matcher can only pass such an item by aliasing onto something else,
which is what happened. **The check's shape hid the one item that had no shape.**

**The remedy that worked:** bind each item to a **named section**, and search
within that section only. Evidence in section X then cannot satisfy item Y. For a
bare-pointer item, the section's existence by name is the test.

**The asymmetry that makes this tractable.** Aliasing produces a **false PASS**;
it cannot produce a false MISS. Line-wrap, markdown emphasis, and blockquote
markers produce **false MISSes**; they cannot produce a false PASS. **Both classes
fired in the same session.** A reported MISS is therefore trustworthy in the
direction that matters and a reported PASS is not — which is the opposite of how
such results are usually read.

**Relationship to `v25` Sec 4.3.** Sec 4.3 is *"An instrument that answers a
question adjacent to the one asked."* **This is arguably a second instance of
that finding rather than a new one.** Whether it lands as a fresh Sec 4 entry or
as a sharpening of 4.3 is the `v26` author's judgment and is not ruled here.

**The generalisable half, which is not about coverage checks.** Every defect in
the session that produced this was an instrument returning **the right shape for
the wrong reason**, believed because it agreed with expectation: an HTTP 403 body
of length two read as two open pull requests; a `[skip-automerge]` token applied
on convention without reading what it gated; a tail delta attributed to one file
when three had landed; `git log A..B` enumerating commits whose content had
already landed by squash-merge; a conclusion line written before the output it
summarised. **None was caught by more care. Each was caught by a second
measurement capable of disagreeing.**

**And the strongest form of that, recorded because it is not "have a second
reader."** In one case a written instruction and a pinned instrument disagreed,
and following the instruction would have shipped two silent MISSes. **The
instrument had been pinned before the content existed, so it could not be argued
with afterward.** No one had to adjudicate which party was right —
**pre-registration converted a disagreement into a check.**

---

# Carry 3 — for `v26` Sec 6 item 13 (prod-freeze, Actions half)

**Proposed note: `deploy-dev.yml`'s push trigger is disabled IN THE TREE, not by
an operator setting. The two are not the same kind of gate.**

Ruled 2026-08-29, after Carries 1 and 2. **No FD.**

**The finding.** `deploy-dev.yml` was **not** always dispatch-only. Derived from a
full-depth clone at `origin/main` `7a788f3c` — 121 commits touch the file and all
are reachable:

```
2026-06-28  fd402b8d   push trigger PRESENT      push: branches: [dev]
2026-07-01  c61c5b14   push trigger REMOVED      PR #881, "ci(F-Deploy-1): disable
                                                 deploy-dev push trigger during freeze"
2026-07-10  9557df38   absent  (the SSM RunCommand rewrite, nine days later)
2026-07-14  c25a9db6   absent
2026-07-21  1844e56b   absent
```

**Two things a successor is likely to get wrong, both corrected here.**

**(a) The trigger was `push: branches: [dev]`, not `claude/**`.** The pre-07-01
cascade entry point was a push to `dev`. The workflow that matches `claude/**` is
`auto-merge-to-dev.yml`, a different file. **A reader checking `deploy-dev.yml`
to establish whether an agent-branch push can reach a deploy is checking the
wrong file** — this occurred in the session that produced this carry, and the
conclusion held only by luck.

**(b) The two gates are of different kinds and must not be collapsed.**

```
deploy-dev.yml push trigger    disabled IN THE TREE by c61c5b14 — re-enabling requires a PR
auto-merge-to-dev.yml          disabled_manually — an operator toggle, revocable in the UI
```

**A committed change and a runtime setting are not interchangeable evidence.**
The `[skip-automerge]` opt-out token is likewise behavioural: it works only if
the workflow runs and reads `head_commit.message`. A `docs/`-prefixed branch, by
contrast, sits outside `auto-merge-to-dev`'s `claude/**` trigger entirely and is
structural in the sense the token is not. **This distinction was stated wrongly
in both directions during the session that produced this carry, once claiming a
structural closure that was a toggle, and once treating a committed removal as
though it were revocable.**

**Bound — this carry records provenance, not standing state.** It establishes
*how* the trigger came to be absent and *what kind* of gate that is. **It does
not establish current state**, which must still be verified live per the standing
discipline. The binary check remains:

```
git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"
```

Expected EMPTY. `c61c5b14` left that check written into the file as a comment.

**Adjacent, deliberately not folded in.** A separate correction from the same
session: in one container a `GH_TOKEN` presence check was read as establishing
API authorization, when the working API path was an MCP grant and direct `curl`
to `api.github.com` returned `403 — "GitHub access is not enabled for this
session"`. **Git write grants and API read grants are separate and were described
as one.** That is a session-conduct disclosure, not a finding about this
repository, and is named here only so it is not lost — it is **not** part of
Carry 3's claim.

---

# What this file does not do

- **Does not amend** `v25_Sec6_Item8_Route_Finding_2026-08-29.md`,
  `v25_Owed_Index_Amd17_2026-08-29.md`, `Prime_Studios_Audit_Handoff_v25.md`,
  `Item8_Correction_Handoff_2026-08-28.md`, or any Fix Plan revision. **No blob
  moves.**
- **Does not mint.** No FD, XK, or PE number.
- **Does not close** `v25` Sec 6 item 8, item 13, or any other item. **Item 13's
  SSM/SSH/console residue remains non-derivable from any repository read.**
- **Does not establish current workflow state.** Carry 3 is provenance; live
  verification is unchanged and still required.
- **Is not authority.** A `v26` author absorbs or discards it; a self-applied
  banner on a standalone file is not register authority.
- **Does not rule the item-8 route question**, held per `§H8`.

---

*Draft material, 2026-08-29. Three carries ruled by Evoni; drafted by Claude and
committed by Evoni. Carry 3 derived from a full-depth clone in the drafting
session, not carried from another container. No AWS call, no deployed host
contacted, no database connection, no infrastructure endpoint probed, no
infrastructure credential read or sought. Prod FROZEN.*
