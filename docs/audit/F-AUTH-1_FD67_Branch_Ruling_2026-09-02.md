| **PRIME STUDIOS** **F-AUTH-1 RULING — FD-67 BRANCH** *Rules the branch only. Does not implement, test, or close FD-67.* |
| --- |

# F-AUTH-1 — FD-67 branch ruled: Option 1 — 2026-09-02

**FILED 2026-09-02 on Evoni's authorization**, given through the mechanism
described in full at §1 — read that section before citing this ruling
elsewhere, because its provenance differs from the prior branch ruling this
program has on file and the difference is load-bearing.

**Basis:** `origin/main` at `f15c113a775cdd607485a7e1cd301565f5fc135a`, 2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Rules the branch question `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
§10 put and nothing else.** Does not implement the remedy. Does not close
FD-67 — `v25` Sec 6 item 11 requires the remedy to be *"authorized,
implemented, and tested"*; this document discharges only the branch half of
"authorized." Ships no code. Changes no gate. Mints nothing — FD tail
remains **FD-68**; XK tail **XK-3**; PE tail unaffected. FD-67 remains
**OPEN/P2** until the remedy itself is authorized in detail, implemented,
and tested.

**Environment contact — stated in full.** None. This document records a
choice made in this session and cites `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`'s
own text. No repository read beyond confirming that document's current
content and confirming no later branch ruling already exists. No host,
AWS, database, or Cognito contact.

---

## §1. The ruling, and its provenance stated in full

**RULED BY EVONI, 2026-09-02: Option 1.**

**Provenance discipline, stated because the prior branch ruling on file
(`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §1) sets a standard this
ruling does not meet the same way, and smoothing the difference away would
itself be the defect that register repeatedly flags.** That ruling was two
words of Evoni's own unprompted prose — *"b, then b stands"* — answering a
question put in the scoping document's own language. **This ruling was
made differently.** In this session, the assistant summarized FD-67's
question in plain language, presented two options plus a "not sure, explain
more" escape hatch through a structured choice interface, **labelled one
option "Recommended," and Evoni selected it.** The option text she selected
— *"Option 1 — remove default (Recommended)"* — is the assistant's
paraphrase, not her prose, and the recommendation was the assistant's own
before it was hers.

**What this does and does not affect.** The decision is hers — she was
offered a "not sure" path and did not take it, and nothing here infers
consent she did not give. **What differs from the `PE #65` precedent is
narrower: this document cannot claim the same evidentiary weight for "the
option text is not attributed to Evoni" that the `PE #65` ruling claimed**,
because here the option text originated with the assistant and was adopted
by selection rather than composed by her. **Recorded so a later reader
does not cite this ruling's form as equivalent to a freeform ruling — the
outcome is authoritative; the manner of arriving at it is not the same
manner, and both facts are stated rather than one left to be assumed.**

## §2. What Option 1 is, quoted from its source

`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md` §10, quoted in
full for the option ruled:

> **Option 1** — remove the global mount; place explicit optional identity
> on 9 named writes and 13–27 named reads.

Against the alternative not chosen, also quoted for the record:

> **Option 2** — retain the mount; specify a complete effective-middleware
> verification procedure over the full route surface, tied to Tier.

**Every member of Option 1's two sets is already named** in the scoping
document at its §4 (9 writes: `POST /login`, `POST /refresh`,
`POST /validate`, four roles-shaped writes, `POST /validate-required`,
`POST /world/generate-ecosystem-preview`) and §5 (13 reads confirmed
dependent by `req.user` reference; a further 14 pass `req` onward and are
**uncertain**, not resolved by that document — see §4 below).

## §3. What this ruling does

- **Answers `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md` §10's
  question.** A branch is chosen. The scoping document's own words: *"A
  third answer is available and is not a deferral: rule that the count is
  insufficient…"* — that path was not taken; the costed Option 1 was.
- **Leaves FD-67's severity and open state untouched.** FD-67 remains
  OPEN/P2 per `v25` Sec 6 item 11, which requires the remedy authorized,
  implemented, and tested — three separate gates, of which this document
  clears the branch-selection component of the first.

## §4. What this ruling does not do

- **Does not implement the remedy.** No file under `src/` is touched by
  this document. Removing the global mount and adding explicit optional
  identity to the named declarations is a code change, not performed here,
  and is not authorized by this document to be performed without a
  separate, explicit go-ahead — the same discipline `CLAUDE.md` Rule 7
  applies to push/PR/merge applies in spirit to a change of this shape:
  the ruling and the implementation are different acts.
- **Does not resolve the 14 uncertain reads.** `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
  §5 states these pass `req` onward to something the instrument did not
  follow, and that *"tracing into callees was deliberately not
  performed — it is unbounded and becomes judgment."* **Whether each of the
  14 needs explicit optional identity under Option 1 is Tier adjudication,
  per-item, and is not decided by ruling the branch.** An implementer must
  either adjudicate each of the 14 individually or treat the 13–27 range
  as a floor-to-ceiling band to carry forward as-is; this document takes
  no position on which.
- **Does not adjudicate §5.5 / item 11's coupling with `PE #65`.**
  `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §4 step 7 (Gate G3)
  already names this: `src/middleware/auth.js` is shared ground between
  this remedy and Branch B's config repoint, and whichever change lands
  second must be rebased against the first. **Still not adjudicated here**
  — this document rules FD-67's branch; it does not sequence FD-67 against
  PE #65.
- **Does not close FD-67**, re-rule its severity, or touch FD-68's severity
  interaction with FD-65, which `v25` Sec 6 item 11 separately requires be
  adjudicated and which this document does not perform.
- **Does not mint** an FD, XK, or PE number.
- **Contacts no host, dispatches no workflow, performs no AWS read or
  write. Prod FROZEN.**

---

*Type: ruling. Answers one question — FD-67's branch — and no other. Does
not implement, test, or close FD-67. No host, AWS, database, or Cognito
contact. Prod FROZEN.*
