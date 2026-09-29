| **PRIME STUDIOS** **F-STATS-1 REGISTER NOTE** *D1's one-time coins reconciliation, applied: Evoni's dry run and apply against production on 2026-09-29, show `9bd0655f` 560 → 1900, four test purchases voided, nothing refused. A note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register note. It is not a Fix Plan revision, and it amends no
filed document. It follows `F-Stats-1_D1_ReconciliationRead_2026-09-29.md`
(what production held, and Evoni's per-show decisions), which it does not
edit.

Basis: `origin/main` at `8257ed538d0690433e2167c63c6aeef7cd5423ca` (#2255),
read 2026-09-29.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

NOTE. The standings used here:
- **ATTESTED**: production responses as Evoni pasted them, and her account.
- **MEASURED**: this repository, cited.
- **INFERRED**: marked where used.

The filing session made no host, AWS, database or Cognito contact, and
called no production endpoint. Evoni ran both calls herself, from the
browser console, signed in as ADMIN. Her paste printed no token, and none
appears here.

Task: #2250.

---

## §1. What was run

**ATTESTED.** Evoni called `POST /api/v1/admin/coins/reconcile` twice on
2026-09-29, after Deploy BZ. The paste gives no time of day.
1. The dry run: body `{}`.
2. The apply: body `{ dry_run: false, confirm: 'apply-d1-approvals' }`.

**MEASURED.** The route (`src/routes/coinReconciliationRoutes.js`,
`requireAuth` + `authorize(['ADMIN'])`) applies only the checked-in
approvals, `src/config/d1ReconciliationApprovals.js` at the basis:

```
$ git show origin/main:src/config/d1ReconciliationApprovals.js | grep -nE "show_id|approved_balance|[0-9a-f]{8}-[0-9a-f]{4}|void_reason"
10: *   show_id                 the full show id
11: *   approved_balance        the balance Evoni approved, in whole coins; the
15: *   void_reason             recorded on each voided row
28:    show_id: '9bd0655f-0426-4da4-95b8-44cdfd608b2b',
29:    approved_balance: 1900,
31:      '1e9da9a3-e7fc-48a7-850e-295c1ae7945d', // wardrobe_purchase 285, 2026-09-26 00:39:28
32:      'd7b34f33-b51d-4d3f-8659-3f2dd2516575', // wardrobe_purchase 385, 2026-09-26 00:39:29
33:      'b008d849-f3f1-4306-a32f-31ae18d844ac', // wardrobe_purchase 385, 2026-09-26 00:39:29
34:      '3408a459-f230-48e5-8c80-11fd1c173588', // wardrobe_purchase 385, 2026-09-26 02:19:47
36:    void_reason: 'Test data, not story purchases (Evoni, 2026-09-29)',
```

Lines 10–15 are the file's header comment.

## §2. The responses — ATTESTED

Evoni's paste, 2026-09-29. The console printed each body as an escaped JSON
string; it is shown here decoded, with nothing else changed.

**The dry run:** HTTP 200.

```json
{
  "success": true,
  "approvals": 1,
  "dry_run": true,
  "results": [
    {
      "show_id": "9bd0655f-0426-4da4-95b8-44cdfd608b2b",
      "approved_balance": 1900,
      "coins_before": 560,
      "coins_after": 1900,
      "lala_rows_updated": 1,
      "voided": [
        { "id": "1e9da9a3-e7fc-48a7-850e-295c1ae7945d", "category": "wardrobe_purchase", "amount": 285 },
        { "id": "d7b34f33-b51d-4d3f-8659-3f2dd2516575", "category": "wardrobe_purchase", "amount": 385 },
        { "id": "b008d849-f3f1-4306-a32f-31ae18d844ac", "category": "wardrobe_purchase", "amount": 385 },
        { "id": "3408a459-f230-48e5-8c80-11fd1c173588", "category": "wardrobe_purchase", "amount": 385 }
      ],
      "applied": false
    }
  ],
  "refused": []
}
```

**The apply:** HTTP 200. The body is identical to the dry run's except
`"dry_run": false` and `"applied": true`:

```json
{
  "success": true,
  "approvals": 1,
  "dry_run": false,
  "results": [
    {
      "show_id": "9bd0655f-0426-4da4-95b8-44cdfd608b2b",
      "approved_balance": 1900,
      "coins_before": 560,
      "coins_after": 1900,
      "lala_rows_updated": 1,
      "voided": [
        { "id": "1e9da9a3-e7fc-48a7-850e-295c1ae7945d", "category": "wardrobe_purchase", "amount": 285 },
        { "id": "d7b34f33-b51d-4d3f-8659-3f2dd2516575", "category": "wardrobe_purchase", "amount": 385 },
        { "id": "b008d849-f3f1-4306-a32f-31ae18d844ac", "category": "wardrobe_purchase", "amount": 385 },
        { "id": "3408a459-f230-48e5-8c80-11fd1c173588", "category": "wardrobe_purchase", "amount": 385 }
      ],
      "applied": true
    }
  ],
  "refused": []
}
```

## §3. The outcome

- **Show `9bd0655f-…`:** Lala's coins went from 560 to 1900, on its one
  `lala` row (`lala_rows_updated: 1`).
- **Voided:** the four `wardrobe_purchase` rows, 285 + 385 + 385 + 385 =
  1,440. They are the four ids of the approval (§1) and of Evoni's ledger
  read (reconciliation read note §2), one for one.
- **Refused:** none.
- **Kept, not deleted (MEASURED, from the code at the basis):** the apply
  sets `status = 'voided'` and records the reason, actor and time in each
  row's `metadata` (`applyReconciliation`, `src/services/coinReconciliation.js`).
  It deletes no row.
- **The approval is spent.** INFERRED from the integration test at the basis
  (`tests/integration/coinReconciliation.integration.test.js`, "the
  checked-in approval … lands on 1900"): a second run is refused, because
  the four rows are no longer executed rows, and writes nothing.

## §4. The order, and what happened in between

- **RULED earlier, and not kept:** Evoni's ruling "(a)" held #2255 (D1 PR 2)
  until PR 5's apply had run. #2255 went live at Deploy BZ, before the apply
  (`F-Deploy-1_Deploy_2026-09-29_BZ.md` §5).
- **ATTESTED** (Evoni, 2026-09-29): no ledger rows were added between BZ and
  the apply.
- **Consistent with it, from §2:**
  - `coins_before` is 560 in both responses, the cache value the read note's
    Q-A showed. Complete and Finalize both sync the cache from BZ on, so
    neither had run on this show in between.
  - Neither run was refused. `applyReconciliation` refuses unless the ledger
    sums to exactly 1900 after the voids, so any counted row added in
    between netted to 0.
  - The responses alone do not exclude a row that nets to 0 or one that does
    not count; that nothing was added rests on Evoni's attestation.

## §5. Where #2250 stands

The per-show decisions of the reconciliation read note (§3 there) are now
carried out:

| Decision | Status |
|---|---|
| Live show at 1900, four rows voided | Applied (§3) |
| Deleted shows `bd52ee95`, `b1cff675`: no change | Not in the approval; untouched |
| Orphan row `ae018fad`: no change in D1 | Not in the approval; cleanup is #2266 |

#2250 (D1 PR 5, the apply) is closed with this note. D1 PRs 3–4 (#2248,
#2249) remain.

## §6. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

---

## What this note does not do

- It rules nothing. The decisions it records are Evoni's (the read note §3).
- It edits no filed document.
- It re-rules nothing about the #2255 hold.
- It closes, discharges and reopens no register item, and it mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

*Type: register note. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2250.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
