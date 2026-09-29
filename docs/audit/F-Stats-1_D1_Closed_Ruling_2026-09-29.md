| **PRIME STUDIOS** **F-STATS-1 REGISTER NOTE** *Evoni's app check after Deploy CA, and her ruling that D1 is closed. A note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register note. It is not a Fix Plan revision, and it amends no
filed document. Banners that point here are added to
`F-Deploy-1_Deploy_2026-09-29_CA.md` and
`F-Stats-1_D1_Closing_Note_2026-09-29.md`, as additive banners; neither body
is edited.

Basis: `origin/main` at `d667f89c4bf1c77e01633e8f91e67a9681e23df3` (#2283),
read 2026-09-29.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

NOTE. The standings used here:
- **ATTESTED**: what Evoni saw in production, as she reported it.
- **RULED**: her ruling, quoted.
- **MEASURED**: this repository, cited.

The filing session made no host, AWS, database or Cognito contact.

---

## §1. The CA app check — ATTESTED

Evoni, 2026-09-29, verbatim:

> CA app check (Evoni): 1) Dashboard, Insights, Producer Mode Overview and
> the episode Wardrobe all show 1,900; Insights Financial Summary reads
> income 1,900, expenses 0, net +1,900, Ep1 +0; 2) Tasks & Details opens and
> closes. Checks 3 (purchase) and 4 (Reset Lala's Stats) not run in
> production, to protect the restored bankroll; covered by the integration
> tests.

**Where checks 3 and 4 are covered — MEASURED.**
- Check 3, a purchase: `tests/integration/wardrobeLedgerSpends.integration.test.js`
  (each spend leaves coins equal to the ledger; `coins_after` is the ledger)
  and `tests/integration/balanceDisplays.integration.test.js` (every display
  endpoint reports the same balance).
- Check 4, Reset Lala's Stats: `frontend/src/pages/ShowSettings.resetStats.test.jsx`
  (the reset sends no coins) and
  `tests/integration/manualEditSeeding.integration.test.js` (the admin reset
  leaves coins alone).

## §2. The ruling — RULED

Evoni, 2026-09-29, verbatim:

> D1 is closed: built, deployed, reconciled, and verified in production.

**What the ruling closes, as the register holds it.**
- D1 is §8(x) D1 in `docs/EVENT_EPISODE_FLOW.md`.
- What was built and deployed, with each PR and the deploy that put it live:
  `F-Stats-1_D1_Closing_Note_2026-09-29.md` §1.
- The reconciliation: `F-Stats-1_D1_ReconciliationRead_2026-09-29.md` and
  `F-Stats-1_D1_ReconciliationApplied_2026-09-29.md`.
- The verification in production: §1 above.

**The issues.** Issues #2246, #2247, #2248, #2249, #2267 and #2282 are closed
as completed under this ruling (GitHub, 2026-09-29).

**What the ruling does not close.** The closing note's §3 lists what is still
owed. The CA app-check banner is discharged by this note and the CA banner.
The others stay owed:
- Q4's duplicate-row investigation;
- Q5's optional Reset Career Economy action;
- #2266, the orphan cleanup;
- #2278, the Episode Ledger's figures.

The episode-delete sync is carried by #2284 (branch
`claude/episode-delete-sync-coins`, unmerged at this basis).

## §3. Tails — re-derived, not carried

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

- It rules nothing itself. §2 quotes Evoni's ruling.
- It edits no filed document's body. The two banners it adds point here and
  carry nothing.
- It mints and reopens nothing.
- The filing session made no host, AWS, database or Cognito contact.

*Type: register note. Rules: nothing (records Evoni's ruling, §2). Mints:
nothing. Discharges: the CA app-check item (§2). Host/AWS/DB/Cognito contact
by the filing session: none. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).*
