| **PRIME STUDIOS** **F-STATS-1 REGISTER NOTE** *D1's one-time coins reconciliation: what production held on 2026-09-29, as Evoni's read-only queries showed it, and her per-show decisions. A note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register note. It is not a Fix Plan revision, and it amends no
filed document. It edits no file under `docs/audit/`.

Basis: `origin/main` at `acbd386188c26665a19bc957c03a76cf90193f84` (#2264),
read 2026-09-29.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

NOTE. The standings used here:
- **ATTESTED**: production output as Evoni pasted it.
- **RULED**: Evoni's decisions, quoted.
- **MEASURED**: this repository, cited.
- **INFERRED**: marked where used.

The filing session ran no query against production and made no host, AWS,
database or Cognito contact. Evoni ran every production query herself. The
shell prompt and the environment-reading lines of her paste named the host
and read its configuration, so they are not reproduced here. No credential
appears in this note.

Task: #2250.

---

## §1. What was run

**MEASURED.** Evoni ran
`scripts/sql/d1-reconciliation-readonly.sql` (branch
`claude/d1-reconciliation-sql`, commit `357ddc81`). It is Q-A to Q-F,
wrapped in `BEGIN TRANSACTION READ ONLY; … ROLLBACK;`:
- Q-A to Q-E are `docs/COINS_LEDGER_CACHE_DESIGN.md` §8.1.
- Q-F is from the #2250 thread.

She then ran a second read of the live show's ledger rows, to get the ids
to void.

**The queries sum ledger rows without §8(aa) M6's filter.** M6 was ruled
with these decisions (§3). Q-A's `ledger_balance` is therefore the plain
sum of executed, live rows.

## §2. The output — ATTESTED

Evoni's paste, 2026-09-29: "production, run by Evoni 2026-09-29,
read-only, ended in ROLLBACK".

**Q-A** (one row per `lala` `character_state` row):

| show_id | show_deleted | state_id | cache_coins | tx_count | seed_rows | starting_balance | ledger_balance | gap | updated |
|---|---|---|---|---|---|---|---|---|---|
| `ae018fad-ca1a-4ae2-bcbf-6085de1241a6` | (no show row) | `83a759fd-5ed2-4e1e-ab00-bcb9a69a695d` | −100 | 0 | 0 | (null) | (null) | (null) | 2026-02-18 |
| `bd52ee95-4f6c-4c07-9b67-82b233098640` | t | `59822b67-6bf6-467b-9f79-af05d8cccb3e` | 500 | 0 | 0 | 1900 | 1900 | −1400 | 2026-09-27 |
| `b1cff675-aec0-4d9b-9d55-2c743404b29e` | t | `d4aea53d-de61-47a8-b5af-aea2d60ad2a4` | 501 | 0 | 0 | 1900 | 1900 | −1399 | 2026-02-18 |
| `9bd0655f-0426-4da4-95b8-44cdfd608b2b` | f | `5fd6a9df-4c2c-4a6e-957e-665ae2092b2f` | 560 | 5 | 1 | 1900 | 460.00 | 100.00 | 2026-09-26 |

On all four rows, `uncounted_rows` was 0 and `season_id` was empty.

**Q-B** (the ledger by category):

| show_id | category | type | n | total |
|---|---|---|---|---|
| `9bd0655f-…` | seed | income | 1 | 1900.00 |
| `9bd0655f-…` | wardrobe_purchase | expense | 4 | 1440.00 |

**Q-C to Q-F: 0 rows each.**
- Q-C: no episode with ledger money that was never completed.
- Q-D: no show with two `lala` rows, and no other key holding coins.
- Q-E: no fractional amounts.
- Q-F: no goal marked reached without a payout.

**The live show's ledger rows** (the second read):

| id | category | type | amount | status | episode_id | created_at |
|---|---|---|---|---|---|---|
| `305eed68-5689-4961-8ce6-ca6d1dd613a8` | seed | income | 1900.00 | executed | | 2026-05-15 23:03:30 UTC |
| `1e9da9a3-e7fc-48a7-850e-295c1ae7945d` | wardrobe_purchase | expense | 285.00 | executed | | 2026-09-26 00:39:28 UTC |
| `d7b34f33-b51d-4d3f-8659-3f2dd2516575` | wardrobe_purchase | expense | 385.00 | executed | | 2026-09-26 00:39:29 UTC |
| `b008d849-f3f1-4306-a32f-31ae18d844ac` | wardrobe_purchase | expense | 385.00 | executed | | 2026-09-26 00:39:29 UTC |
| `3408a459-f230-48e5-8c80-11fd1c173588` | wardrobe_purchase | expense | 385.00 | executed | `be95953c-8965-4953-b20b-951ee12ea807` | 2026-09-26 02:19:47 UTC |

**Checked against each other:** the four purchases sum to 285 + 385 + 385 +
385 = 1,440, which agrees with Q-B. The seed less 1,440 is 460, which
agrees with Q-A's `ledger_balance`.

## §3. Evoni's decisions — RULED

Evoni, 2026-09-29, quoted:

> Per-show decisions (Q9), Evoni 2026-09-29:
> - Live show 9bd0655f: approve 1900. The four wardrobe_purchase rows (1,440 total) were test data: void them (status or flag marking them voided, reason recorded; never hard-delete), so the ledger is the 1900 seed alone.
> - Deleted shows bd52ee95 and b1cff675: no change.
> - Orphan row ae018fad (no show exists, −100 coins): no change in D1; file a separate cleanup issue.

> New ruling, record as §8(aa) M6 (verbatim): "Once an episode or show is deleted, it no longer affects Lala's money. Ledger rows tied to a deleted episode or show stay as history but are excluded from the balance; the balance is recomputed as if that episode never happened."

## §4. Where each decision is carried — MEASURED

At filing, the branches below are unmerged.

| Decision | Carried by |
|---|---|
| Live show at 1900, four rows voided | `src/config/d1ReconciliationApprovals.js`, branch `claude/d1-pr5-reconcile-apply`, commit `f8850c6e`: one approval, `approved_balance: 1900`, the four purchase ids above, and the reason "Test data, not story purchases (Evoni, 2026-09-29)". The apply action (`src/services/coinReconciliation.js`, `POST /api/v1/admin/coins/reconcile`, ADMIN) sets `status = 'voided'` and records the reason, actor and time in `metadata`. It deletes nothing, and it refuses unless the ledger sums to exactly 1900. |
| Deleted shows: no change | No entry in the approval list |
| Orphan row: no change in D1 | No entry; cleanup is #2266 |
| M6 | `docs/EVENT_EPISODE_FLOW.md` §8(aa) M6 and `src/utils/ledgerBalanceFilter.js`, branch `claude/d1-m6-deleted-episodes`, commit `2048e8e2` (#2267). `getCurrentBalance` and `syncCoinsFromLedger` count only rows whose episode is live. |

## §5. Readings of the output

The first two bullets are INFERRED; the third is CANNOT-TELL.

- **The live show's cache disagrees with its ledger.** The cache is 560 and
  the ledger sum is 460. None of the five ledger rows accounts for the +100.
  After the apply, both are 1900. The code history behind the +100 is not
  established here.
- **The deleted shows have no ledger rows.** Their Q-A `ledger_balance` of
  1900 is the starting-balance fallback, not a sum. Under M6, a deleted
  show no longer affects Lala's money, and the decision leaves them as they
  are.
- **CANNOT-TELL:** whether episode `be95953c-…` (on purchase `3408a459-…`)
  is live. It does not change the outcome: that row is one of the four
  voided.

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

- It rules nothing. §3 quotes Evoni.
- It applies nothing. The apply is Evoni's, after the apply action is
  merged and deployed.
- It edits no filed document.
- It re-rules, closes, discharges and reopens no register item.
- It mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

*Type: register note. Rules: nothing (records Evoni's per-show decisions and
M6, §3). Mints: nothing. Discharges: nothing. Host/AWS/DB/Cognito contact by
the filing session: none. Task: #2250. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).*
