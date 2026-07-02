# F-Deploy-1 — Carry-Note: Copilot Memory Hygiene + IP Discrepancy (2026-06-29)

**Type:** Warm-session carry-note. Doc-only, additive. Mints no FD, supersedes nothing,
primes nothing, advances no gate. Box stays FROZEN; FD-31 and FD-42 remain OPEN.
Confers no cold-entry standing. Records open questions and where to resolve them — NOT answers.

## Why this exists

A warm prep session (not a [3] priming session) investigated memory contamination and, in the
course of it, surfaced one P0-grade ambiguity and one deferred fix. Logged so the next session
starts from them rather than rediscovering them. No box mutation, no credential action, no [3]
state derived.

## 1. IP discrepancy — P0, LIVE-DERIVE ONLY, do not resolve from docs or memory

There is an unresolved one-digit ambiguity on the single most safety-critical fact in this
operation: which box is prod.

- A repo-scoped Copilot memory file (`infrastructure.md`) asserts `54.163.229.144` is the
  CORRECT **dev** server, and lists exactly two boxes: `.144` and `52.91.217.230`.
- Session memory has carried `54.163.229.164` as **prod**. `.164` appears in NO inspected file.
- Therefore one of: (a) prod is a third box not in that file; (b) `.164` is a one-digit
  transcription error for `.144` or `.230` somewhere in the memory chain; (c) the file is wrong.

**This is not resolvable from inside a chat, from that file, or from any other doc.** It is the
canonical stale-but-coherent trap: two authoritative-looking sources disagreeing by one digit.

Resolution — and ONLY this — at the cold window's own start, from a workstation SSH, inheriting
nothing: live-confirm box identity via `nginx -T` + `ss -ltnp` on the box, and DB identity via
`inet_server_addr()` / `current_database()`. Confirm which IP actually serves apex vs dev before
ANY box-touching action. Do not let memory or this note tell you which box is prod.

## 2. infrastructure.md — split, do NOT delete (deferred to its own session)

`…\workspaceStorage\…\memory-tool\memories\repo\infrastructure.md` (workspace-scoped, auto-loads
into new Copilot windows) does two jobs at once:
- INJECTS [3]-adjacent identity state (specific IPs, box disposition) a cold session must
  re-derive live — this is the contamination half.
- SERVES load-bearing deploy-safety corrections (PM2 naming-inversion hazard w/ 2026-06-14
  validation; "deploy script targets .230 = WRONG server"; dirty-repo `git stash` step; terminal
  limit) — removing these from auto-load would strip guardrails from prod-adjacent deploy actions.

`Remove-Item` does not distinguish the two. Quarantine-by-deletion is therefore WRONG for this
file (same lesson as `ecosystem-corrections.md`: don't destructively remove a correction-of-record
to fix a delivery problem). Correct fix is an ADDITIVE split — lift identity state out of
auto-load, keep deploy-safety corrections available — done as deliberate content-surgery in its
own session, not as a tail. DEFERRED.

A verified byte-identical backup exists at
`C:\Users\12483\Documents\PrimeStudios-Backups\_quarantine\infrastructure_2026-06-29.md`
(SHA256 confirmed). Source left intact in auto-load scope; guardrails still active.

## 3. Claude.ai-web memory leak — parallel system, support ticket is the lever

Separate from the Copilot file above. The 06-25 contamination finding concerns Claude.ai web
memory plumbing (project/Incognito/account layers) — a different system. Copilot's `/memories/`
is not that vector; the two are parallel leaks sharing subject matter. Claude.ai side is not
fixable from inside a chat or by touching any file: it needs a support question — does a
generated-summary or account-level layer inject derived context that the memory-edit tool does not
expose, and how does one open a window that does not receive it. Draft held; file separately.

---
*Warm carry-note, 2026-06-29. Doc-only, additive, mints no FD, primes nothing, advances no gate.
Freeze stands; FD-31 and FD-42 remain OPEN.*
