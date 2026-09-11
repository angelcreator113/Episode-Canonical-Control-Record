| **PRIME STUDIOS** **F-AUTH-1 BRIEFING DOCUMENT** *v2.72 ruling preparation note.* |
| --- |

**Document version**

v1.0 — **FILE BRIEFING NOTE FOR F-AUTH-1 v2.72 RULINGS. SHIPS NO CODE.** Assembles verbatim passages and source citations for Evoni's upcoming `v2.72` rulings: the FD-68 vs FD-65 severity interaction and F-AUTH-1 limb 3 Dimension 5's criterion status. Mints no FD, XK, or PE. Rules nothing.

**Basis:** `origin/main` at `1687d1b971aaa1bd8c188003998160c2f9a0b5ed` (2026-09-11).

**Author:** Claude (Task #1382).

**Status:** REPO-ONLY BRIEFING DOCUMENT.

---

# §1. Search results for FD-65 and FD-68 minting revisions

Per the instruction to locate minting texts in `docs/audit/` before extracting, a broad search for `FD-65` and `FD-68` across `docs/audit/*.md` was run first:

```text
COMMAND
Select-String -Path docs/audit/*.md -Pattern 'FD-65','FD-68' | Select-Object -First 30 | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line)" }
```

The broad search identified `F-AUTH-1_Fix_Plan_v2.49.md` (for FD-65) and `F-AUTH-1_Fix_Plan_v2.61.md` (for FD-68) as the originating revisions that mint the respective FDs. To extract the exact header minting statements from those revisions, the following targeted pattern scan was executed:

```text
COMMAND
Select-String -Path docs/audit/F-AUTH-1_Fix_Plan_v*.md -Pattern 'MINTS FD-65','MINTS FD-68','Mints FD-67 and FD-68' | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line)" }

RAW OUTPUT
F-AUTH-1_Fix_Plan_v2.49.md:6: v2.49 — **MINTS FD-65 (F-AUTH-1). P0. SHIPS NO CODE.** FD tail advances **FD-64 → FD-65**. **The authentication surface issues signed tokens to unauthenticated callers at two endpoints, and permits those callers to specify their own privileges.** `POST /api/v1/auth/login` performs no credential verification of any kind and reads `groups` and `role` from the request body; `POST /api/v1/auth/test-token` does the same with no rate limiter and no validation middleware. Tokens so obtained satisfy `requireAuth` on **all 95 handlers promoted at `8ba2b95c`** and clear **all 36 `authorize([...])` gates across 11 route files**, including the three on `auditLogs.js`. **Fixing the privilege half without the issuance half looks like a fix and is not.** Derived from git against `origin/main` at `ffe91c3d`. No live database contact, and no request issued to any deployed host.
F-AUTH-1_Fix_Plan_v2.49.md:231: *Type: P0 mint. Ships no code. Mints FD-65 (F-AUTH-1) — the authentication surface issues signed tokens to unauthenticated callers at two endpoints and permits caller-specified privileges. Records the CP-meaning correction, the instrument discipline, the credential-custody finding as XK-shaped and not admitted, and supersedes v2.48 §5.1. Mints no XK, no PE. Tail: FD-65. XK tail: XK-3. Changes no gate. No live database contact. [skip-automerge]*
F-AUTH-1_Fix_Plan_v2.50.md:145: Basis is `2359cbe6`. PR **#1041** (v2.48, mints FD-64) merged at `436a8772`; PR **#1042** (v2.49, mints FD-65) merged at `2359cbe6`.
F-AUTH-1_Fix_Plan_v2.61.md:1: | **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *G4 procedure dispositions. Mints FD-67 and FD-68.* |
```

**Search findings and provenance (MEASURED):**
- The minting determination rests on the broad `docs/audit/*.md` scan across all audit files, which confirmed `v2.49` as the originating revision for FD-65 and `v2.61` as the originating revision for FD-68. The secondary pattern search above served solely to locate exact line numbers for the minting header text within those already-identified originating files.
- **FD-65 minting revision:** `docs/audit/F-AUTH-1_Fix_Plan_v2.49.md`
- **FD-68 minting revision:** `docs/audit/F-AUTH-1_Fix_Plan_v2.61.md`

---

# §2. Verbatim passages for Ruling Subject 1: FD-68 vs FD-65 Severity Interaction

### §2.1 Gap statement from `docs/audit/F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md` §7.5

Line reference: `docs/audit/F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md:349–356`

```text
- **Does not close FD-67.** `v25` Sec 6 item 11 needs the remedy
  authorized, implemented, and tested, **and FD-68's severity interaction
  with FD-65 adjudicated separately.** This document is "implemented" and,
  per §7, "tested." **The FD-68/FD-65 adjudication is not performed here**
  and is what still keeps FD-67 open on this document's own account.
```

### §2.2 FD-65 minting passage from `docs/audit/F-AUTH-1_Fix_Plan_v2.49.md` §1

Line reference: `docs/audit/F-AUTH-1_Fix_Plan_v2.49.md:20–41`

```text
**FD-65 (F-AUTH-1) — P0. The authentication surface issues signed tokens to unauthenticated callers, and lets those callers specify their own privileges.**

**Statement.** `src/routes/auth.js` exposes two endpoints that mint signed HS256 tokens without verifying any credential. Both read `groups` and `role` from the request body and place them in the token. A token so obtained is indistinguishable, to every downstream consumer, from one issued after authentication.

**The finding has two halves and they require separate remedies.**

- **Issuance.** Neither endpoint verifies a credential. There is no database lookup, no password comparison, no Cognito call. `POST /login`'s own comment at `:54` states the design: *"For development: accept any password (in production, verify against Cognito)."* The integration is absent.
- **Privilege.** Both endpoints read `groups` and `role` from the caller and sign them into the token unmodified.

**Removing `groups` and `role` from the destructuring remedies only the second half.** An anonymous caller would still receive a valid `['USER','EDITOR']` token, which still satisfies `requireAuth` on all 95 promoted handlers. **The admin tier would be restored and the authenticated tier would remain open. That is the failure mode this finding is written to prevent**, and any remediation proposing only the privilege fix must be rejected against this paragraph.
```

### §2.3 FD-68 minting passage from `docs/audit/F-AUTH-1_Fix_Plan_v2.61.md` §3.1

Line reference: `docs/audit/F-AUTH-1_Fix_Plan_v2.61.md:120–133`

```text
## §3.1 Statement

**FD-68 (F-AUTH-1): `getCognitoConfig()` produces the structured
`AUTH_CONFIG_MISSING` cause CP1 authorized, but neither `optionalAuth` nor
`requireAuth` classifies that cause as configuration/infrastructure failure.
Both fall through to token-rejection handling. A missing Cognito configuration
therefore returns `401 AUTH_INVALID_TOKEN` at a protected route. Explicit
placeholder-shaped values are accepted by the only config guard because it
checks truthiness only.**

**Severity: P1.** The defect is dormant while real values are present, but a
misconfigured deployment can boot healthy, pass module loading, and turn every
RS256-protected request into an authentication denial attributed to the caller.
That is the failure F-Auth-2 exists to make diagnostically loud. It creates an
availability and diagnosis failure across the authentication surface, not a
single route.
```

---

# §3. Verbatim passage for Ruling Subject 2: F-AUTH-1 Limb 3 Dimension 5 Criterion Status

### §3.1 Source citation and Outcome section from `docs/audit/F-AUTH-1_Limb3_D3D5_ReadPlan_2026-09-11.md` §2.2

Line reference: `docs/audit/F-AUTH-1_Limb3_D3D5_ReadPlan_2026-09-11.md:173–182`

```text
**Result:** `CANNOT-TELL` as to the definition, target class, read command,
expected output shape, and outcome-to-disposition mapping for Dimension 5.
This is a measured source-boundary result, not a readiness disposition.

**D5 read plan:** none can be derived without inventing the missing
definition. The only well-formed evidence at this stage is the two exit-zero
absence checks above and the raw status phrase. A later authorized revision
must supply the definition before a dimension-specific live read can be
specified. This document does not advance Dimension 5.
```

---

# §4. What is owed for `v2.72`

The two items assembled in this briefing document require rulings in `F-AUTH-1_Fix_Plan_v2.72.md`:

1. **FD-68 vs FD-65 Severity Interaction:** Adjudication of the severity interaction between FD-68 and FD-65 (as named in `F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md` §7.5), unblocking the closure of FD-67.
2. **F-AUTH-1 Limb 3 Dimension 5 Criterion Status:** Adjudication of Dimension 5's criterion status following the measured source-boundary finding in `F-AUTH-1_Limb3_D3D5_ReadPlan_2026-09-11.md` §2.2.

This briefing document takes no position, chooses no option, pre-frames no effects, and mints or closes no FD, XK, or PE.

---

# Author declaration

*Type: Repo-only briefing document for F-AUTH-1 v2.72 rulings. Assembles verbatim passages for FD-68/FD-65 severity interaction and D5 criterion status. Mints no FD, XK, or PE. Rules nothing. No host, AWS, database, or Cognito contact. Prod FROZEN.*
