# PR #876 — Warm Session Note (2026-06-28)

**Status of this note:** evidence + scoping note for PR #876 (`docs/f-deploy-1-ag-gate-annotation-2026-06-27`). NON-AUTHORITATIVE. Mints nothing, gates nothing, supersedes nothing. Records what a warm doc-work session established about #876's two ratification-blocking defects so the next operator does not re-walk it. Per additive-supersede convention; nothing below rewrites the banner body on main.

---

## Session classification — READ FIRST

**This session is Sec-5 contaminated, beyond ordinary warm.**

It opened warm (ingested derived conclusions via session footer) and then, in resolving defect 1, pulled `F-Deploy-1_2026-06-26_Sec5_ReVerify_Evidence.md` into context. That document carries a cold-session contamination warning. Consequence: this session is **disqualified from priming OR closing the [3] window** — not merely warm-by-footer. Any [3]-priming must originate in a fresh cold session that has not read Sec-5 re-verify, this note, or the reconciliation chain.

Doc / prep / reconciliation work (including this note) remains in bounds. No prod-box action was taken. No [3] progress.

---

## Defect 1 — identity values "unconfirmed against live main" (banner clause 3a)

**Resolution: values are SOUND. Defect downgrades from "unconfirmed/possibly-wrong" to "live-confirm-at-session-time direction." Do NOT soften the banner further than that.**

The banner asserts in clause (c): canon identity is `current_database()` = `episode_metadata`, `inet_server_addr()` = `10.0.20.224`.

These are confirmed correct by TWO independent on-main sources:
- `F-Deploy-1_2026-06-26_Sec5_ReVerify_Evidence.md` — live read 2026-06-26 against the `episode-control-dev` RDS instance (canon), confirmed by DATA (`current_database()` + `inet_server_addr()` + VPC-internal IP), not by name string. Doc notes "no ambiguity about which instance was targeted."
- `Prime_Studios_Audit_Handoff_v15.md` Sec 4 — independently records the same asserts (`current_database()` = `episode_metadata`, `inet_server_addr()` = `10.0.20.224`) as the [3] identity gate.

**Name/identity clarification (a category error worth recording so it is not re-raised):** `episode-control-dev` is the RDS *instance identifier* (AWS resource name). `episode_metadata` is the *database name* inside that instance — which is what `current_database()` returns. They are orthogonal. "Canon = `episode-control-dev`" does NOT contradict `current_database()` = `episode_metadata`. The value `episode_metadata` is NOT the greenfield-prompt artifact it superficially resembles; it is the real canon DB name, twice-confirmed.

**Banner-language guidance (left to author by the banner; resolved here as a recommendation, not an edit):**
Keep clause 3(a) as a **live-confirm-at-session-time direction**. Drop the standing factual claim "unconfirmed" if it now reads as a claim about the world (the values ARE confirmed). Do NOT replace it with "values consistent with 2026-06-26 re-verify" or any remembered-value-to-match-against. Rationale: identity-first at the [3] gate exists precisely so the cold operator re-derives identity LIVE that session, not by trusting a date-stamped prior read. Handing them a prior value to match against reintroduces the stale-coherent trap. Correct text shape: *"Confirm live via `current_database()` / `inet_server_addr()` on the canon instance before this gates; values are expected to resolve to canon."* — forces the live read regardless of this evidence.

Defect 1 is therefore not a blocker on value-correctness. It is satisfied by an evidence pointer + a direction-preserving banner tweak.

---

## Defect 2 — "typographic corruption in the hard-abort rules" (banner clause 3b)

**RE-SCOPED. The defect as the banner describes it is WRONG about its own subject. Do NOT fix it as written.**

### What the banner claims
Clause 3(b) says the corruption is in the **operative hard-abort rules** below it, quoting three examples: `"any deltaon shows"`, `"is alegitimate application write"`, `"does not changethe gate"`.

### What is actually on disk
The operative clauses are **CLEAN on disk**:
- "it does not change the gate mechanism" — space present
- "the deviation is a legitimate application write" — clean
- "any delta on `shows`" — clean

The three garbles the banner quotes as living in the operative text were **diff-render artifacts**, not disk bytes. A `git grep` for the literal tokens `deltaon` / `alegitimate` / `changethe` matched **only line 395** — i.e. only the banner's own description-of-the-garbles, never the operative clauses. The operative text the banner claims to be protecting is not corrupted.

### Where corruption actually is
The real whitespace-deletion corruption is in the **banner's own lines**, tangled with `ΓÇö` em-dash sequences. Confirmed-real (byte-matched via `git grep`, which matches bytes not display): `fromfiling` (L385, "verbatim from filing"), and on L395 the cluster `hard-abortrules` / `deltaon` / `alegitimate` / `changethe` / `mustbe` / `protectingan`. Additional mashes seen in some renders: `Untilthen` (L389), `tablesare` (L405). The corruption is space-deletion between word pairs.

### Why this is NOT warm-landable in this session — the render trap
**Three console renders of line 395 — same committed blob — mutually disagree about which words are mashed:**
- `git grep`: `hard-abortrules`, `deltaon shows`, `alegitimate`, `changethe`, `mustbe`
- `Select-Object` (table render): all of the above CLEAN; "must be" spaced
- `Select-String`: `deltaon`/`alegitimate`/`changethe` mashed, "must be" clean, **`protectingan`** mashed (appeared in no other render)

This is the documented read-side corruption class: each console path decodes the no-BOM UTF-8 stream (and the embedded `ΓÇö`) its own way. **No console render can be trusted as a `str_replace` target.** Editing this file off any single render risks silent multibyte mangling of text that protects an irreversible production cutover. The warm session correctly STOPPED before writing.

### Correct repair path (for a fresh session — NOT this one)
1. Read with `[System.IO.File]::ReadAllText($p)` — the one read that decodes no-BOM UTF-8 correctly into a real string (never `Get-Content -Raw`; never a console render).
2. Inspect/repair by codepoint, not by eye: locate the actual space-deletions and `ΓÇö` sequences programmatically.
3. **Scope: whitespace restoration ONLY.** Put eaten spaces back. Do NOT reword, re-flow, or touch the `ΓÇö` em-dash bytes (those may be correct UTF-8 on disk — display artifact per project rule). 
4. Write back no-BOM: `[System.IO.File]::WriteAllText($p,$content,(New-Object System.Text.UTF8Encoding $false))`.
5. **`git diff` gate:** a clean whitespace-restore shows ONLY the touched lines changed. If prior sections reappear as changed, the body re-decoded — revert and retry.
6. Additive-supersede caveat: the banner is a non-authority correction banner already pushed (`001481e0`). Repairing whitespace in mashed words is a typo-restoration of that banner's own text, not a body rewrite of the underlying note — keep the distinction clean and note it in the commit.

**Open sub-question for the repair session:** clause 3(b) is now self-falsifying — it claims corruption in operative text that is clean, while being corrupted itself. The repair session must decide whether to (i) restore 3(b)'s whitespace AND correct its claim to point at the banner's own lines, or (ii) restore whitespace only and let the mis-description stand as additively-corrected. (i) is more honest; (ii) is more conservative re: not editing a pushed banner's substance. Recommend (i) but flag for ratification.

---

## Net effect on #876

- Two defects → effectively **one remaining**, correctly scoped.
- Defect 1: resolved to an evidence pointer + direction-preserving banner tweak. Not a value-correctness blocker.
- Defect 2: re-scoped (corruption is in the banner, not the operative text), repair path specified, render-trap logged so it is not re-walked. Requires a fresh `ReadAllText`-based session — ideally NOT [3]-contaminating, and explicitly NOT this Sec-5-warm session.
- AG still un-minted. If/when both defects clear and the finding ratifies → mints as FD-44 via Fix Plan v1.17 (next after FD-43), runbook annotation re-points at the minted FD.

**No file on main was modified this session.**
