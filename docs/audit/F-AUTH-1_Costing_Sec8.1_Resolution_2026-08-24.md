# Resolution — costing section 8.1, the `--update-env` valence — 2026-08-24

| | |
|---|---|
| **Purpose** | Resolves `F-AUTH-1_BranchA_Costing_2026-08-24.md` section 8.1, filed as **UNRESOLVED**. |
| **Basis** | `main` at `3b04d821606e175ee61a75da876cdfc95df5eec2`, confirmed by `git ls-remote --heads origin main`. |
| **Standing** | Closes one filed UNRESOLVED item. **Mints nothing.** No FD, no XK, no PE. Changes no gate, severity, owner or disposition. |
| **Method** | Direct read of the cited file. **Not resolved by reasoning about intent**, per the constraint section 8.1 set for itself. |
| **Authority note** | No AWS call. No deployed host contacted. No workflow dispatched. The workflow was read, not run. Prod **FROZEN**. |

---

## §1 The item as filed

> **§8.1 The dev workflow's `--update-env` valence.** Its header states *"no `--update-env` clobber"* (`deploy-dev.yml:19`); its body invokes `--update-env` (`deploy-dev.yml:269`, inside the `restore_pm2` trap armed at `:334`). Same flag, opposite valence, same file. **Not resolved by reasoning about intent.**

The constraint is honoured: what follows is a read of the file's structure, corroborated by — not derived from — its comments.

---

## §2 Read basis

`.github/workflows/deploy-dev.yml` is blob `84586e041d4880e6224bd51fc1e7924ba0c31116` at `f6a6933f` (the costing's basis), `c30b5d9c`, and `3b04d821` (this basis). **The file has not changed since the item was filed.** Both cited lines resolve to the same bytes now as then. Verified by `git rev-parse <ref>:<path>`.

---

## §3 There is no contradiction

### §3.1 Line 19's subject is the clobber, not the flag

Line 19 does not stand alone. It is the fourth clause of a **Secrets** bullet running `:17-22`:

> `• Secrets: this workflow carries ZERO application secrets. No DEV_DB_*`
> `  injection, no write_env_key, no .env writes, no --update-env clobber.`
> `  The app and migrations read episode-metadata/dev/database via the`
> `  instance role (FD-55 decision (b), scope per FD-58). The CauseClosed`
> `  Sec 4 secret-clobber mechanism (v1.30 §2 R3) is structurally absent.`

The noun is **clobber**. The bullet asserts the absence of a secret-clobbering *condition*, and names the mechanism it is denying. It does not assert the absence of the flag.

### §3.2 The next bullet states the mechanism

`:23-26`, four lines below the cited line, in the same header block:

> `• Restart discipline: explicit scoped restart before the health check;`
> `  EXIT trap (armed only after DB env resolves, disarmed after the`
> `  explicit restart) as failure insurance for the window between eval`
> `  and restart.`

The header therefore states both halves itself: the flag is used, and the ordering prevents it from clobbering.

### §3.3 The ordering is verifiable independently of every comment

| Line | Structure |
|---|---|
| `:267` | `restore_pm2()` **defined** — definition only; nothing executes |
| `:327` | DB environment resolution completes (five-export contract) |
| `:334` | `trap restore_pm2 EXIT` — **armed**, after the environment exists |
| `:352` | `restore_pm2` — explicit restart before the health check |
| `:358` | `trap - EXIT` — **disarmed**, after the verified restart |

A trap armed before the resolution could fire `--update-env` against an empty environment and clobber a healthy process. Armed after it, that path does not exist. **This is readable from the control flow alone.** The comments at `:262-264` state the same rationale and corroborate it; the finding does not rest on them.

### §3.4 Disposition

**Section 8.1 is RESOLVED. No contradiction exists.** The header claims no *clobber*; the body uses the *flag* under an ordering that makes clobbering unreachable. Same flag, one valence, same file.

---

## §4 The shape, and its count

The disambiguating text was **adjacent to both cited lines**, in both directions: `:23-26` sits four lines **below** the header citation at `:19`, and `:262-264` sits immediately **above** the body citation at `:269`. Either citation had its own resolution within a few lines, at the same blob, from the moment the item was filed.

*(Correcting one detail of the framing that prompted this: the resolving text is not only above. It is on both sides. That strengthens the point rather than weakening it — the item could have been closed from either anchor.)*

Evoni records this as the **sixth** occurrence of the session's signature shape: *the authority that would have settled the question was available at the stated basis and was not read.* The count is Evoni's; this document carries it rather than re-deriving it.

The shape is not `check-cannot-fail` — no check ran and reported falsely. It is nearer the `documented-principle-unapplied` family: the record was complete and the read stopped short of it.

---

## §5 Filing form

This resolution is filed as a **separate document with a pointer banner** on the costing. It is **not** written in place under costing section 8. A substantive resolution of a filed UNRESOLVED item cannot ride in-place: section 8's body records what was unresolved **at that document's basis**, and that record stays true. The banner points; it does not carry.

**No costing body text is edited by this filing.**

---

## §6 What this document does not do

- Does not reopen or re-resolve section 8.2 (placeholder-policy coverage) or 8.3 (shared process name). **Both remain open.** 8.2 is adjacent to the P6 verification limb and is not resolved here.
- Does not alter the costing's correction banner or any body section.
- Does not run the workflow.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/F-AUTH-1_Costing_Sec8.1_Resolution_2026-08-24.md` |
| Date | 2026-08-24 |
| Basis | `main` at `3b04d821606e175ee61a75da876cdfc95df5eec2` |
| Reads | `.github/workflows/deploy-dev.yml` at blob `84586e04`, lines 10-30, 255-272, 327-358 |
| Blob-identity check | Identical at `f6a6933f`, `c30b5d9c`, `3b04d821` |
| Resolves | Costing section 8.1 |
| Leaves open | Costing sections 8.2, 8.3 |
| Mints | Nothing |
| Operations performed | None |
