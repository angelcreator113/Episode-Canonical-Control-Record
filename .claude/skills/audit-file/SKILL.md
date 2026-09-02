---
name: audit-file
description: File a new document into docs/audit following the register's carriage rules (mint, never edit in place; banners additive and newest-first; basis SHA on the face; standing labels). Use when asked to record a finding, amendment, evidence note, or handoff.
disable-model-invocation: true
argument-hint: "[kind] [short-title]"
---

# File a register document

The register under `docs/audit/` is the project's memory. It has rules; a document that breaks them is worse than none.

1. Position first (`/wake-up`). The document's **Basis** line is `origin/main` at the full SHA you just read, with today's date.
2. Never edit a filed document in place. A correction is a new file (an amendment: `v25_Owed_Index_Amd<N+1>_<date>.md` continues the chain) or an additive banner prepended to the top of the corrected file, dated, and read newest-first. A banner may point; it may not carry.
3. Numbers: FD numbers are minted only by a Fix Plan revision; XK by the Cross-Keystone Register via a ratifying revision; PE by `Session_PE_Roster.md`. A standalone note mints nothing and says so in its footer.
4. Standing labels on every claim: MEASURED (repo read, anyone can check, paste the command and output), ATTESTED (session record only), RULED (Evoni's decision, quoted), INFERRED (say so). Do not upgrade a standing.
5. Tails: re-derive, do not carry. Paste `grep -ro 'FD-70' docs/audit/ | wc -l`-style instruments with their output.
6. Footer: type, what it rules (usually nothing), what it mints (usually nothing), host/AWS/DB contact (none), and `Prod FROZEN`.
7. Filename: `<Family>_<Title>_<YYYY-MM-DD>.md`; use `_DRAFT` suffix if not ruled.
8. Commit subject: `docs(audit): <what it files> [skip-automerge]`. Body must not carry a closing keyword next to `#NNN`.

Kind: $0. Title: $1.
