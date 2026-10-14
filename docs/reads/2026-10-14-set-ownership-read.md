# Read: wearing a matching set when one piece is owned and another isn't

Date: 2026-10-14. Basis: `118a19671f3ba989226ebbb465a1653e50e6826f` (origin/main, #3148; includes #3146 and #3147). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code, git history, or run against the pure rule functions) or **INFERRED**. Task #3139 (bug 7).

## What was seen

"An outfit set can't be equipped when one piece is owned and another isn't."

## Summary

1. **The report matches bug 8's cause, which is fixed (MEASURED).** From W1 (#2426, 2026-10-01) until #2650 (2026-10-06), an unowned piece with lock `none` or no lock was never selectable or for sale. "Wear the set" wore only the owned pieces and left the rest out as "locked". That is the unlock read's cause (`docs/reads/2026-10-06-wardrobe-unlock-read.md` §1). #2650 made every unowned priced piece buyable, and #3146 made an unpriced one "Price required". Both are on `main`; #2650 is deployed (the last successful Deploy ran `b7822bff`, which contains `8f816840`).
2. **What still stops a set today is a different rule (MEASURED).** Since #2650 the set is all-or-nothing on price. When Lala's coins don't cover the set's unowned pieces, the button reads "Need 🪙 N", is disabled, and wears **nothing**, not even the pieces she owns. Those can still be equipped one by one.
3. **Every other mix wears what it can and says what it left out (MEASURED).**

## 1. "Wear the set", end to end (at basis)

- **The sets:** `matchingSetsFrom` (`frontend/src/lib/closetGrouping.js:166-175`) groups closet pieces by `outfit_set_id`.
- **Their reach:** the pieces carry `can_select` / `can_purchase` from `withReach` (`frontend/src/utils/wardrobeReach.js:55`), using `itemReach` (`:38`), `isForSale` (`:34`) and `priceRequired` (`:29`). These mirror `src/services/wardrobeReach.js:43-75`.
- **The set card** (`frontend/src/components/EpisodeWardrobeGameplay.jsx:1114-1134`):
  - `price = setCost(set.pieces)`, where `setCost` (`wardrobeReach.js:79`) sums `coin_cost` over the pieces for sale;
  - `short = price.cost > coins`;
  - when `short`, the button is disabled and reads "Need 🪙 N".
- **`wearSet`** (`EpisodeWardrobeGameplay.jsx:573-598`):
  - **refuses the whole set** when `cost > coins` (:576-580);
  - otherwise equips every piece with `can_select` and a game slot (body first), through `equipInto` (`closetGrouping.js:183`);
  - says what it left out: "not for sale", "price required" (since #3146), or "no game slot".
- **For This Event:** a pool card's "Wear the set" calls `wearSetOf` (`:645-651`). It loads the closet, applies `withReach`, finds the set by `outfit_set_id` and calls `wearSet`, so it follows the same rules.
- **Lock** (`POST /wardrobe/lock-outfit-atomic`, `src/routes/wardrobe.js`):
  - buys every worn unowned piece that is for sale (`needs_purchase`, `:1774`) against the ledger;
  - refuses a worn piece out of reach (`:1791`, with its reason since #3146).

  A set worn by `wearSet` holds only pieces Lock will buy or accept.

## 2. Each mix (MEASURED)

These are the results of running `wearSet`'s decision with the real `withReach` and `setCost` from `frontend/src/utils/wardrobeReach.js`, for a set of one owned top and one unowned skirt, with Lala at 500 coins. The probe was a throwaway vitest file, run and then deleted; it is not committed.

```
owned + coin, affordable                     | set cost 300 | worn: Owned Top, Skirt
owned + coin, unaffordable                   | set cost 900 | REFUSED: button "Need 🪙 900"
owned + none priced, affordable              | set cost 300 | worn: Owned Top, Skirt
owned + none priced, unaffordable            | set cost 900 | REFUSED: button "Need 🪙 900"
owned + none unpriced                        | set cost   0 | worn: Owned Top | left out: Skirt (price required)
owned + unknown lock (dream_fund), priced    | set cost 300 | worn: Owned Top, Skirt
owned + brand_exclusive                      | set cost   0 | worn: Owned Top | left out: Skirt (not for sale)
```

**Before #2650 (MEASURED: `EpisodeWardrobeGameplay.jsx` at `f9b5271f` (#2426), `wearSet` at :476-490, with no price check, every piece without `can_select` "left out (locked)"; and the unlock read §1):** "owned + none" (priced or not) wore the owned top only and left the skirt out as locked, with no way to buy it. **That is the reported bug.**

## 3. Is it the unlock read's cause?

**Yes, for what was reported (MEASURED):** an unowned no-lock piece was not for sale. #2650 fixed that, and #3146 (Evoni's ruling (b), 2026-10-14) completed it for unpriced pieces. On `main` and in production, an owned + unowned-priced set is worn whole when Lala can afford it.

**The all-or-nothing refusal when she can't afford it is separate (MEASURED).** It is #2650's own rule ("the set's price must fit her coins", `EpisodeWardrobeGameplay.jsx:574-580`), not the unlock read's. It may be what Evoni sees now: owned top, unowned skirt she can't afford, and the set button disabled (INFERRED; it depends on her coins at the time).

## 4. Proposed, smallest first (plan only)

1. **Nothing more for the reported cause:** it's fixed (#2650, #3146). Evoni can confirm on production once #3146 deploys.
2. **When short, wear what she owns (a ruling).** Instead of refusing the whole set, `wearSet` would wear the owned and affordable pieces and leave the unaffordable ones out with "left out (needs 🪙 N, Lala has M)". The button would read "Wear what she owns · needs 🪙 N for the rest" in place of a disabled "Need 🪙 N".
   - **Files:** `EpisodeWardrobeGameplay.jsx` (`wearSet`, the set card) and its test.
   - **No backend change:** Lock already buys or refuses per piece.
   - **Choosing what to buy:** the order would be the body first, then the cheapest, so the most pieces fit her coins.
3. **Leave it as is:** the set stays all-or-nothing on price, and owned pieces are equipped one by one.

## 5. Decision for Evoni

When Lala can't afford the unowned pieces of a set, should "Wear the set" **refuse the whole set** (today), or **wear what she owns and say what's left to buy** (§4 option 2)?
