| **PRIME STUDIOS** **F-STATS-1 REGISTER NOTE** *Evoni's money-path rulings D1–D3 (2026-09-29), recorded against the F-Stats-1 register: what they bear on, what shipped, and what is left open. A note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register note. It is not a Fix Plan revision, and it amends no
filed document. It edits no file under `docs/audit/`.

Basis: `origin/main` at `faf81971c16e93a6b38a7ab187c35a98036a5613` (#2236),
read 2026-09-29.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

NOTE. Standings used:
- **RULED**: Evoni's decision, quoted.
- **MEASURED**: this repository, with the command and output or a file:line.
- **ATTESTED**: a filed record's account, cited.
- **INFERRED**: said so where used.

The rulings in §1 were made in a living doc, `docs/EVENT_EPISODE_FLOW.md`
§8(x). This note records them in the register and cross-references them. It
does not re-rule anything, and it rules nothing of its own.

Task: #2238.

---

## §1. The rulings — RULED

Evoni, 2026-09-29, recorded verbatim at `docs/EVENT_EPISODE_FLOW.md` §8(x)
(merged in #2232). The basis cited there is `docs/EVENT_TERMS_MONEY_READ.md`
(#2224).

> **D1.** Yes. The transaction ledger is the authoritative balance;
> character_state.coins is a cached copy, always recomputed from the ledger.

> **D2.** Yes. Finalize and Complete run in one database transaction and are
> idempotent: a retry never doubles rewards and never leaves a half-finished
> state.

> **D3.** Yes. A wardrobe outfit lock never causes finalize to skip entry
> cost, payment or rewards.

**MEASURED.** The quotation matches the file:

```
$ grep -n '^\*\*D[123]\.\*\*' docs/EVENT_EPISODE_FLOW.md
2393:**D1.** Yes. The transaction ledger is the authoritative balance;
2396:**D2.** Yes. Finalize and Complete run in one database transaction and are
2400:**D3.** Yes. A wardrobe outfit lock never causes finalize to skip entry
```

§8(x) also records D4–D11. They concern the terms lock, the suggester and the
deal build, not the F-Stats-1 money path, and are not recorded here.

---

## §2. The register items D1–D3 bear on

Each item below is cited, not re-ruled.

### §2.1 §66.3-F, the `state_json` read

**The ruling.** RULED at `F-Stats-1_Fix_Plan_v1.63.md` §66.3. The fix's shape
was added by Evoni before merge (`:47`): "the affordability and
financial-pressure handlers take their balance from getCurrentBalance, the
source /balance uses; their swallowing catches go and errors are logged".

**The status.** ATTESTED: done and deployed.
`F-Deploy-1_Deploy_2026-09-27_BC.md` §5.1 records #2079 (`943b7e65`, Task
#2078) moving both handlers to `getCurrentBalance`.

**MEASURED.** No `state_json` read remains in `src/`:

```
$ grep -rn state_json src | grep -v state_after_json | wc -l
0
```

**Does D1 bear on it?** Yes, as a consequence, not a change. §66.3-F pointed
two readers at the ledger sum (`getCurrentBalance`). D1 rules that the ledger
is the authoritative balance. The two agree, and D1 does not reopen §66.3-F.

**Left open.** `PROJECT_CONTEXT.md:493` records one open point at v1.63
§66.3: which of financial-pressure's catches the ruling means. D1–D3 do not
settle it.

### §2.2 Class 4, "Parallel balance readers, none authoritative"

**The ruling.** RULED at `F-Stats-1_Fix_Plan_v1.62.md:112`: Class 4 was homed
to F-Stats-1, recorded as `worldEvents.js`-only with reach not established,
and flagged the priority.

**The probe.** `F-Stats-1_S355_ReachProbe_2026-09-27.md` §3 compared every
reader. It found that the ledger readers and the `character_state.coins`
readers can disagree:
- INFERRED: when the ledger is empty;
- INFERRED: when coins were written before the dual writes existed;
- INFERRED: when a writer changes one store only.

It left open whether `episodeCompletionService` writes the ledger (§3.2).

**Does D1 bear on it?** Yes, directly. Class 4 names the absence of an
authoritative balance. D1 rules which store is authoritative: the ledger. It
rules that `character_state.coins` is a cached copy, always recomputed from
the ledger.

**The probe's open question, answered at this basis.** Completion writes the
ledger.
- MEASURED: `completeEpisode` calls `finalizeEpisodeFinancials`
  (`src/services/episodeCompletionService.js:390`).
- MEASURED: it inserts its reward rows into `financial_transactions` (`:395`).

**Left open.** D1 is ruled but not implemented. No code recomputes
`character_state.coins` from the ledger at this basis. The coin writers still
move `character_state.coins` by deltas: `coinBalanceGuard.changeCoins` and
`spendCoins` (probe §3.2, MEASURED there). Implementing D1 is owed (§4).

### §2.3 Cross-Keystone Register entries

The terms-and-money read (`docs/EVENT_TERMS_MONEY_READ.md` §6) names XK-1 to
XK-4 (`Cross_Keystone_Register.md:50–53`, all OWNED, fixes UNEVALUATED).

- **XK-1** (`paranoid` exposure): lists `character_state` among F-Stats-1's
  reach tables (`Cross_Keystone_Register.md:135`, `:177`). **D1–D3 do not
  bear on it.** They rule on which balance is authoritative and on
  transaction safety, not on soft-delete columns. Nothing is closed.
- **XK-2** (row scope dropped at writes), **XK-3** and **XK-4** (tenancy):
  **D1–D3 do not bear on them.** Nothing is closed.

---

## §3. What shipped — MEASURED, deployed in BV

Both fixes merged on 2026-09-29. `F-Deploy-1_Deploy_2026-09-29_BV.md` §5
records them going live in Deploy BV (tree `fb596c0c` → `faf81971`).

### §3.1 D3: #2235 (`11fa41f3`, Task #2229)

- The already-finalized check ignores the outfit lock's own ledger rows:

  ```
  $ grep -n "LOCK_OUTFIT_FLOW = \|NOT_LOCK_OUTFIT_ROW = " src/services/financialTransactionService.js
  332:const LOCK_OUTFIT_FLOW = 'lock_outfit';
  333:const NOT_LOCK_OUTFIT_ROW = `COALESCE(metadata->>'flow', '') <> '${LOCK_OUTFIT_FLOW}'`;
  ```

- Finalize skips pieces the lock already bought for the episode (`:484`,
  `lockBoughtPieceIds`).

### §3.2 D2: #2236 (`faf81971`, Task #2228)

- `finalizeEpisodeFinancials` runs in a transaction under a lock on the
  episode row:

  ```
  $ grep -n "sequelize.transaction\|FOR UPDATE" src/services/financialTransactionService.js src/services/episodeCompletionService.js
  src/services/episodeCompletionService.js:365:  const outcome = await sequelize.transaction(async (transaction) => {
  src/services/episodeCompletionService.js:370:      `SELECT evaluation_status, evaluation_json FROM episodes WHERE id = :episodeId FOR UPDATE`,
  src/services/financialTransactionService.js:355:    return sequelize.transaction((t) => finalizeEpisodeFinancials(episodeId, showId, sequelize, { transaction: t }));
  src/services/financialTransactionService.js:360:    await sequelize.query(`SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE`, { replacements: { episodeId } });
  ```

- `completeEpisode` runs its money and state steps (10c–15) in one
  transaction, and re-checks `accepted` under the lock.

### §3.3 What D2 left open: a standalone finalize before Complete

The two balances go out of step. This is D1's implementation.

**MEASURED:**
- The standalone route `POST /world/:showId/episodes/:episodeId/finalize-financials`
  (`src/routes/worldEvents.js:4267`) calls `finalizeEpisodeFinancials`.
- `financialTransactionService.js` never writes `character_state.coins`. It
  has no `changeCoins` call.
- When finalize has already run, it returns `already_finalized: true` with no
  `summary` (`:381–385`).
- `completeEpisode` computes its coin delta from `result.summary`
  (`episodeCompletionService.js:351–353`).

**INFERRED from those lines:**
- A Finalize run on its own before Complete books the episode's income and
  costs to the ledger, without moving `character_state.coins`.
- The later Complete then moves `character_state.coins` by the tier reward
  and paid bonus only.
- The ledger and `character_state.coins` end apart by the finalize net.

D2 removed the double-booking and the half-finished states. It did not
reconcile the two stores. Under D1 that reconciliation is recomputation from
the ledger.

---

## §4. Owed

**Implementing D1 is owed:** making `character_state.coins` a copy recomputed
from the ledger.
- This note does not sequence it, scope it, or home it to a Fix Plan item.
- No issue is filed for it by this note.

A post-deploy check of the money path is owed as well: complete an episode,
finalize, finalize again, with the coins moving exactly once. It is Evoni's
to run in production. The session will add the result as a banner on the BV
record.

---

## §5. Tails — re-derived, not carried

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

- It rules nothing. D1–D3 are Evoni's, quoted from §8(x).
- It re-rules no register item, and closes, discharges or reopens none.
- It edits no filed document.
- It sequences, scopes and homes no owed work.
- It mints nothing.
- It makes no host, AWS, database or Cognito contact.

*Type: register note. Rules: nothing (records Evoni's §8(x) D1–D3). Mints:
nothing. Discharges: nothing. Host/AWS/DB/Cognito contact by the filing
session: none. Task: #2238. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).*
