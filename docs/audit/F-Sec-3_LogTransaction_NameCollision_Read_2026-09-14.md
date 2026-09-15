# F-Sec-3 — `logTransaction` Name-Collision Read — 2026-09-14

**Basis:** `origin/main` at `91e708489a7067b3c4ba45ab2ae5435666ac9eb1`, 2026-09-14
(`git rev-parse origin/main`, run this session).

**Standing: MEASURED for every read performed here.** This note re-derives
its own reads from source at the basis above. It does not carry PR #1433's
(issue #1433) session output on trust — every command below was re-run in
this session and its raw output is pasted as returned.

**Mints nothing, rules nothing, recommends nothing.** See Closing section.

---

## 1. Both definitions, rendered from source

Two functions named `logTransaction` exist in `src/services/`. Both
rendered below via `cat -n <file> | sed -n '<range>p'`, run this session —
not hand-typed.

### 1.1 `src/services/financialTransactionService.js`

Command:
```
$ cat -n src/services/financialTransactionService.js | sed -n '239,282p'
```

Output:
```
   239	async function logTransaction(sequelize, showId, tx) {
   240	  const id = uuidv4();
   241	  // When a Sequelize transaction is passed in, we both run the INSERT inside
   242	  // it AND rethrow on failure so the caller's transaction can roll back.
   243	  // Without this, the outer transaction would commit a half-baked state
   244	  // (e.g. character_state.coins decremented but no ledger row).
   245	  const t = tx.transaction || null;
   246	  try {
   247	    await sequelize.query(
   248	      `INSERT INTO financial_transactions
   249	       (id, show_id, episode_id, event_id, type, category, amount, description,
   250	        source_type, source_id, source_name, balance_before, balance_after,
   251	        metadata, status, created_at, updated_at)
   252	       VALUES (:id, :showId, :episodeId, :eventId, :type, :category, :amount, :description,
   253	        :sourceType, :sourceId, :sourceName, :balanceBefore, :balanceAfter,
   254	        :metadata, :status, NOW(), NOW())`,
   255	      {
   256	        replacements: {
   257	          id,
   258	          showId,
   259	          episodeId: tx.episode_id || null,
   260	          eventId: tx.event_id || null,
   261	          type: tx.type,
   262	          category: tx.category,
   263	          amount: tx.amount,
   264	          description: tx.description || null,
   265	          sourceType: tx.source_type || null,
   266	          sourceId: tx.source_id || null,
   267	          sourceName: tx.source_name || null,
   268	          balanceBefore: tx.balance_before ?? null,
   269	          balanceAfter: tx.balance_after ?? null,
   270	          metadata: JSON.stringify(tx.metadata || {}),
   271	          status: tx.status || 'executed',
   272	        },
   273	        ...(t ? { transaction: t } : {}),
   274	      }
   275	    );
   276	    return { id, ...tx };
   277	  } catch (err) {
   278	    console.warn('[FinancialTx] Log failed:', err.message);
   279	    if (t) throw err;  // propagate so the outer transaction rolls back
   280	    return null;
   281	  }
   282	}
```

Export line (`git grep -n "logTransaction," src/services/financialTransactionService.js`):
```
   629:  logTransaction,
```

### 1.2 `src/services/financialPressureService.js`

Command:
```
$ cat -n src/services/financialPressureService.js | sed -n '190,215p'
```

Output:
```
   190	async function logTransaction(models, showId, { type, amount, source: _source, source_id: _source_id, description: _description }) {
   191	  // Update character state coins
   192	  try {
   193	    const delta = type === 'income' ? amount : -amount;
   194	
   195	    // Get current state
   196	    const [state] = await models.sequelize.query(
   197	      `SELECT id, state_json FROM character_state_history
   198	       WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
   199	      { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
   200	    );
   201	
   202	    if (state) {
   203	      const stateJson = typeof state.state_json === 'string' ? JSON.parse(state.state_json) : (state.state_json || {});
   204	      const currentCoins = stateJson.coins || 0;
   205	      stateJson.coins = Math.max(0, currentCoins + delta);
   206	
   207	      await models.sequelize.query(
   208	        'UPDATE character_state_history SET state_json = :state, updated_at = NOW() WHERE id = :id',
   209	        { replacements: { state: JSON.stringify(stateJson), id: state.id } }
   210	      );
   211	    }
   212	  } catch (err) {
   213	    console.warn('[FinancialPressure] Transaction log failed:', err.message);
   214	  }
   215	}
```

Export line (`cat -n src/services/financialPressureService.js | sed -n '217,222p'`):
```
   217	module.exports = {
   218	  checkAffordability,
   219	  recordDeclinedInvite,
   220	  buildFinancialPressureContext,
   221	  logTransaction,
   222	};
```

---

## 2. Point-by-point comparison

Differences are stated as differences. Neither copy is characterized as
correct or canonical.

| Axis | `financialTransactionService.js:239` | `financialPressureService.js:190` |
|---|---|---|
| Signature / parameter shape | `(sequelize, showId, tx)` — third arg is a flat object read positionally by field name (`tx.type`, `tx.amount`, `tx.transaction`, …) inside the body | `(models, showId, { type, amount, source: _source, source_id: _source_id, description: _description })` — third arg destructured at the parameter list; `source`, `source_id`, `description` are bound and immediately discarded (renamed to `_`-prefixed, unused) |
| First-parameter type | `sequelize` — a Sequelize instance/connection object, called as `sequelize.query(...)` | `models` — a models bag, called as `models.sequelize.query(...)` |
| Table written | `financial_transactions` (explicit `INSERT INTO financial_transactions`, 17 columns) | `character_state_history` (`SELECT` then conditional `UPDATE` of `state_json`; no `financial_transactions` row is written) |
| Return shape | `{ id, ...tx }` on success; `null` on a caught, non-rethrown failure | Implicit `undefined` in every path — no `return` statement anywhere in the function body |
| Error handling | `try/catch`; on error, `console.warn` then conditionally `throw err` if a Sequelize transaction (`tx.transaction`) was passed, else returns `null` | `try/catch`; on error, `console.warn` only — every error is swallowed, no rethrow, no signal reaches the caller |
| `amount` semantics | Passed through as `tx.amount`; stored verbatim in `financial_transactions.amount`, no sign inversion applied by this function | Converted to a signed `delta` (`type === 'income' ? amount : -amount`) and added to a running `coins` counter in `state_json`, floored at 0 by `Math.max(0, ...)` |

---

## 3. Full `logTransaction` grep sweep, classified

Command, raw:
```
$ grep -rn "logTransaction" --include='*.js' src/ tests/
src/services/financialTransactionService.js:121:    const tx = await logTransaction(sequelize, showId, {
src/services/financialTransactionService.js:197: * Returns `{ triggered: [{ goal, payout_tx }] }` so callers (logTransaction,
src/services/financialTransactionService.js:220:    const tx = await logTransaction(sequelize, showId, {
src/services/financialTransactionService.js:239:async function logTransaction(sequelize, showId, tx) {
src/services/financialTransactionService.js:403:    const logged = await logTransaction(sequelize, showId, tx);
src/services/financialTransactionService.js:629:  logTransaction,
src/services/financialPressureService.js:190:async function logTransaction(models, showId, { type, amount, source: _source, source_id: _source_id, description: _description }) {
src/services/financialPressureService.js:221:  logTransaction,
src/routes/evaluation.js:606:      seedStartingBalance, getCurrentBalance, logTransaction,
src/routes/evaluation.js:652:        await logTransaction(models.sequelize, show_id, {
src/routes/wardrobe.js:1245:        // money loss). logTransaction rethrows when given a transaction
src/routes/wardrobe.js:1247:        const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
src/routes/wardrobe.js:1254:          await logTransaction(models.sequelize, show_id, {
src/routes/wardrobe.js:1367:    const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
src/routes/wardrobe.js:1375:      await logTransaction(models.sequelize, show_id, {
```

Classification (14 hits; no test-tree hit exists — `tests/` contributes
nothing to this grep at this basis):

| Line | Classification | Resolves to |
|---|---|---|
| `financialTransactionService.js:121` | call, same module | `financialTransactionService.js:239` (in-file call, no require needed) |
| `financialTransactionService.js:197` | comment (doc comment naming the function, not a call) | n/a — text only |
| `financialTransactionService.js:220` | call, same module | `financialTransactionService.js:239` |
| `financialTransactionService.js:239` | definition | itself |
| `financialTransactionService.js:403` | call, same module | `financialTransactionService.js:239` |
| `financialTransactionService.js:629` | export | `financialTransactionService.js:239` |
| `financialPressureService.js:190` | definition | itself |
| `financialPressureService.js:221` | export | `financialPressureService.js:190` |
| `evaluation.js:606` | destructure of a module-level `require` (not itself a function-body require; see below for the require line this destructure comes from) | `financialTransactionService.js:239` |
| `evaluation.js:652` | call | `financialTransactionService.js:239` |
| `wardrobe.js:1245` | comment | n/a — text only |
| `wardrobe.js:1247` | require (function-body) | `financialTransactionService.js:239` |
| `wardrobe.js:1254` | call | `financialTransactionService.js:239` |
| `wardrobe.js:1367` | require (function-body) | `financialTransactionService.js:239` |
| `wardrobe.js:1375` | call | `financialTransactionService.js:239` |

**The three function-body requires, quoted verbatim** — resolution is
decided by the path in each of these lines, not by any top-level import in
the file:

`evaluation.js` — the require this route module loads `logTransaction`
from is a top-level (module-scope) require, not a function-body one; found
at:
```
$ sed -n '605,607p' src/routes/evaluation.js
    const {
      seedStartingBalance, getCurrentBalance, logTransaction,
    } = require('../services/financialTransactionService');
```

`wardrobe.js:1247`:
```
        const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
```

`wardrobe.js:1367`:
```
    const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
```

All three require lines — the two function-body ones in `wardrobe.js` and
the module-scope one in `evaluation.js` — name the same path,
`'../services/financialTransactionService'`. None of the three resolves to
`financialPressureService`.

---

## 4. Every live caller reaches `financialTransactionService.js:239`

Call sites, with line numbers, and the argument shape each passes:

- `wardrobe.js:1254` — `logTransaction(models.sequelize, show_id, { type, category, amount, description, source_type, source_id, source_name, balance_before, balance_after, metadata, transaction: t })`
- `wardrobe.js:1375` — `logTransaction(models.sequelize, show_id, { type, category, amount, description, source_type, source_id, source_name, balance_before, balance_after, metadata })`
- `evaluation.js:652` — `logTransaction(models.sequelize, show_id, { type, category, amount, description, balance_before, balance_after, metadata, transaction: t })`
- `financialTransactionService.js:121` (same-module) — `logTransaction(sequelize, showId, { type, category, amount, description, source_type, source_name, balance_before, balance_after, status })`
- `financialTransactionService.js:220` (same-module) — `logTransaction(sequelize, showId, { type, category, amount, description, source_type, source_id, source_name, metadata, status })`
- `financialTransactionService.js:403` (same-module) — `logTransaction(sequelize, showId, tx)` where `tx` is built up as a flat object with `type`, `amount`, `balance_after`, `episode_id`, `event_id` fields earlier in the same function

Every one of the six call sites above passes `(sequelizeInstance, showId, flatObject)` — first-arg-is-a-Sequelize-instance, third-arg-is-a-flat-object read positionally by field name. This is the parameter shape `financialTransactionService.js:239` declares (`(sequelize, showId, tx)`), not the shape `financialPressureService.js:190` declares (`(models, showId, { type, amount, ... })`, first arg a models bag). All six reach `financialTransactionService.js:239`.

---

## 5. `financialPressureService.js:190`'s `logTransaction` has zero callers in `src/` or `tests/`

`financialPressureService.js:190` is exported at line 221 (Sec 1.2 above).
No line in the Sec 3 grep sweep calls it — the only two hits against this
file are the definition itself (190) and its own export (221).

Trace of the module's actual callers, `worldEvents.js` — the only file in
`src/` observed requiring `financialPressureService` at all:

```
$ grep -n "financialPressureService" src/routes/worldEvents.js
2242:    const { checkAffordability } = require('../services/financialPressureService');
2268:    const { recordDeclinedInvite } = require('../services/financialPressureService');
2330:    const { buildFinancialPressureContext } = require('../services/financialPressureService');
3729:    const { checkAffordability } = require('../services/financialPressureService');
```

All four requires destructure only `checkAffordability`,
`recordDeclinedInvite`, or `buildFinancialPressureContext` — none of the
four names `logTransaction`. No other file in `src/` or `tests/` requires
`financialPressureService` (absent from the Sec 3 sweep, which covers every
`logTransaction` occurrence under both trees). Zero-caller status is shown
by this trace, not asserted independently of it.

---

## 6. Error-handling asymmetry — observation

The two functions handle errors differently, as an observed fact about the
code at this basis:

- `financialPressureService.js:190`'s copy (Sec 1.2) swallows every error:
  its `catch` block only calls `console.warn` and falls through to the
  function's end, which returns `undefined` in every path.
- `financialTransactionService.js:239`'s copy (Sec 1.1) rethrows
  conditionally: its `catch` block calls `console.warn`, then `throw err`
  when a Sequelize transaction was passed (`tx.transaction`, bound to `t`),
  else returns `null`. This rethrow is what gives the `wardrobe.js` and
  `evaluation.js` call sites (Sec 4) their rollback behavior — each of
  those three calls passes a `transaction` field, and each is wrapped in a
  `models.sequelize.transaction(async (t) => { ... })` block in its caller,
  so a rethrown error there aborts the whole transaction rather than
  leaving a partial write.

**Shape of the hazard, stated and not acted on:** if a future call site
were to `require('../services/financialPressureService')` instead of
`'../services/financialTransactionService'` — by typo, copy-paste from the
wrong file, or an editor auto-import picking the wrong module — the code
would still run without a `require`-time error (both modules export a
function under the same name, `logTransaction`), but it would silently
skip the `financial_transactions` ledger write (no `INSERT` into that
table happens in the `financialPressureService` copy) and, if that call
site is inside a Sequelize transaction expecting a rethrow on failure,
would swallow the error into `undefined` instead of triggering a rollback.

**This note recommends no change and asserts no defect exists today.**
Every live call site, per Sec 4, reaches the correct module already; the
hazard above describes a future-miscall shape, not a present-tense bug.

---

## 7. Closing

This note **mints nothing** — no FD-70, no XK-4, no PE #69 — and **rules
nothing**. It **recommends neither rename, deletion, nor consolidation** of
either `logTransaction` copy, and states no preference for which function
should keep the name. It **does not touch F-Sec-3's open cold items**
(the `character_state` key-canonicalization work tracked by
`F-Sec-3_Canonical_CharacterKey_Decision_2026-07-02.md` and
`F-Sec-3_CharacterState_Surface_Inventory_2026-07-03.md` is untouched by
anything above). It records a read: two functions share a name, every live
caller resolves to one of them, the other is presently uncalled, and the
two differ in ways this note only describes.
