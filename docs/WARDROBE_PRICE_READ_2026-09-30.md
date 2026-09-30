# Wardrobe price, price_estimate and coin_cost: where they come from

A read-only trace, 2026-09-30, at `origin/main` `405d6832`. No fixes. Every
claim is **MEASURED** (the code, cited by function or route name with its
line at `405d6832`) or **CANNOT-TELL**.

## Short answer

- **No code sets 385 or 285.** Neither number is a constant, default or tier
  price anywhere in `src/` or `frontend/src/`. They are values of individual
  wardrobe rows.
- **How a new item gets its price** (MEASURED):
  1. The AI image analysis *suggests* a `price_estimate`, with the prompt
     saying "minimum $150".
  2. The upload form puts that suggestion into `price`, and raises anything
     under 150 to 150.00.
  3. The server then sets `coin_cost` = `price` × 1, unless a coin cost was
     sent.
- **Where 385 and 285 appear** (MEASURED from the register):
  - production rows such as the "Sage Corset Lace-Up Halter Midi" at 385
    coins (`F-Deploy-1_Deploy_2026-09-25_AG.md`);
  - the voided test purchases 285 + 385 + 385 + 385
    (`src/config/d1ReconciliationApprovals.js`).
- **Why so many items land on 385: CANNOT-TELL from the repository.** The
  code passes the model's number through. Whether the model keeps answering
  385 would need the production rows or the model's responses, which this
  read does not query.
- **What each spend charges:**
  - select, purchase and lock-outfit charge the item's `coin_cost`;
  - episode finalize charges the event snapshot's `coin_cost`, falling back
    to its `price`.
  - The snapshot written by the event's outfit route carries `price` and no
    `coin_cost`.
- **Is a manual edit overwritten later?**
  - A manual `coin_cost` survives a normal WorldAdmin edit, AI Enhance and
    the bulk sync.
  - It is recomputed from `price` only when an edit sends `price` with the
    coin cost field empty.
  - A manual `price` is never overwritten; AI Enhance fills it only when it
    is empty.

## 1. Where the values are set

### 1.1 The AI suggestion (analysis only, saves nothing)

`POST /api/v1/wardrobe-library/analyze-image` (`src/routes/wardrobeLibrary.js:140`):
- It sends the image to `claude-sonnet-4-6` and returns the model's JSON
  with a fictional brand added. It writes no row.
- **Basic prompt**, `price_estimate` (`:272`): "estimated retail price as a
  single number, minimum $150. This is a luxury fashion world — price as if
  sold at a high-end boutique. Examples: 250, 450, 1200".
- **Gameplay prompt**, `price_estimate` (`:291`): "minimum $150.
  Luxury-boutique pricing."
- **Gameplay prompt**, `coin_cost` (`:296`): "default to the same value as
  price_estimate unless the tier justifies a premium. integer only."
- **Gameplay mode** runs only when a `showId` is sent (`wantsGameplay =
  !!showId`, `:182`). The WorldAdmin upload sends one whenever a show is
  selected.

`price_estimate` is not a database column. It exists only in this
response.

### 1.2 Upload: WorldAdmin "Auto-fill from image", then Save

In the upload auto-fill handler (`frontend/src/pages/WorldAdmin.jsx`):

**Price (`:6451`):**
- It parses `price_estimate`.
- Anything below 150, or unparseable, becomes `'150.00'`.
- It overwrites the form's price (`price: aiPrice || prev.price`, `:6464`).

**Coin cost (`:6455`):**
- It uses the AI's `coin_cost` if the model returned one, else the parsed
  price.
- It is applied only in gameplay mode, and only if the form's coin cost is
  empty (`coinCost: prev.coinCost || aiCoinCost`, `:6475`).

**Save** appends `price` (`:6691`), and `coinCost` only when it is non-empty
(`:6704`).

On the server, `wardrobeController` create writes:
- `price: price ? parseFloat(price) : null` (`src/controllers/wardrobeController.js:207`);
- `coin_cost` (`:225`):
  - the sent `coinCost` if there is one (`:226`);
  - else `Math.round(price × USD_TO_COINS)`, with `USD_TO_COINS = 1`
    (`src/utils/financialRates.js:14`);
  - else undefined, which gives the model default 0
    (`src/models/Wardrobe.js`, `coin_cost` defaultValue 0).

**Result:**
- An auto-filled item with no premium gets `coin_cost == price`, and
  `price` is at least 150.
- A basic-mode upload (no show) gets `coin_cost = price` from the server
  default.

### 1.3 Edit: WorldAdmin wardrobe edit form, "AI Enhance", then Save

**Hydrate:** the form loads `coin_cost: item.coin_cost ?? ''` (`:5301`) and
the price.

**AI Enhance (`:6070`):**
- It fills `price` only if the form's price is empty.
- It does not touch `coin_cost`.
- It does not apply the 150 floor.

**Save** sends the whole form with `price` parsed (`:5455`), so `coin_cost`
is sent back as loaded.

The server's `wardrobeController` update:
- `price: floatOrUndef(updates.price)` (`:700`);
- `coin_cost` (`:741`):
  - an explicit `coin_cost` wins (`:742`);
  - otherwise, if `price` is sent and above 0, `coin_cost` =
    `round(price × 1)`.
- `intOrUndef('')` is undefined, so an **empty coin cost field counts as
  "not sent"** and is recomputed from the price.

### 1.4 Other writers

**Bulk sync:** `POST /api/v1/wardrobe/bulk/sync-coin-costs`
(`src/routes/wardrobe.js:396`):
- It sets `coin_cost = round(price × 1)` only where `coin_cost` is null or
  0 and `price > 0`.
- It is triggered from WorldAdmin's "Sync coin costs from prices" action.

**Seed:** `POST /api/v1/wardrobe/seed` (`:985`) creates the starter items.
- Each has a fixed `coin_cost` from the list above it: 16 at 0, and others
  at 80–2000.
- None has a `price`, and none is 285 or 385.

**Library to episode:** `wardrobeLibraryController`'s two
`Wardrobe.create` calls (`src/controllers/wardrobeLibraryController.js:603`,
`:1523`) set neither `price` nor `coin_cost`. The new rows get `price` null
and `coin_cost` 0.

**No tier table exists.** No code maps `tier` (basic, mid, luxury, elite)
to a price or a coin cost.

## 2. What is charged

| Spend | Route or function | Amount |
|---|---|---|
| Select a coin-locked piece | `POST /api/v1/wardrobe/select` (`src/routes/wardrobe.js:1397`) | `item.coin_cost \|\| 0` (`:1422`) |
| Buy | `POST /api/v1/wardrobe/purchase` (`:1700`) | `item.coin_cost \|\| 0` (`:1726`) |
| Lock an outfit | `POST /api/v1/wardrobe/lock-outfit-atomic` (`:1545`) | the sum of `itemReach(...).coin_cost` (`:1590`), i.e. `Number(item.coin_cost) \|\| 0` (`src/services/wardrobeReach.js:45`) |
| Episode finalize | `financialTransactionService` finalize, step 7 | `parseFloat(piece.coin_cost) \|\| parseFloat(piece.price) \|\| 0` (`src/services/financialTransactionService.js:486`), per piece in the event's `outfit_pieces` snapshot |

**Finalize's pieces come from the event's `outfit_pieces` snapshot, not the
live row:**
- `PUT /world/:showId/events/:eventId/outfit` (`src/routes/worldEvents.js:3315`)
  writes that snapshot with `price` (`:3345`) and **no `coin_cost`**.
- For pieces saved there, finalize charges **`price`**.

**Finalize skips:**
- pieces that are owned, gifted or borrowed;
- rented pieces, which are charged `rental_price` instead;
- pieces already paid through a counted `wardrobe_purchase` row.

**CANNOT-TELL** whether any other writer (the event PUT's `outfit_pieces`
field, which accepts any shape) stores a snapshot with `coin_cost`.

## 3. Is a manual edit overwritten later?

| Value | Overwritten by | When |
|---|---|---|
| `coin_cost`, set by hand | WorldAdmin edit, Save | **Never** while the field holds a number: an explicit value wins (§1.3). |
| `coin_cost`, set by hand | WorldAdmin edit, Save with the coin cost field **empty** | **Yes:** it is recomputed as `price × 1`. |
| `coin_cost` | Bulk sync | Only when it is null or 0 (§1.4). |
| `coin_cost` | AI Enhance on edit | Never; AI Enhance doesn't touch it. |
| `coin_cost` | Upload auto-fill | Only if the form's coin cost is empty (§1.2). |
| `price`, set by hand | AI Enhance on edit | Never; it fills price only when empty. |
| `price`, set by hand | Upload auto-fill | **Yes, before the first save:** a second auto-fill replaces the form's price with the AI's (`price: aiPrice \|\| prev.price`). Nothing is saved yet. |
| Either | Re-analysis | Re-analysis writes nothing (§1.1); only the form handlers above apply it. |

**Also noticed:** a price edit on its own does not re-derive a `coin_cost`
that is already set. Price and coin cost can therefore drift apart after a
manual `coin_cost`, by design (the update handler's comment: "lets creators
decouple story price from real-world price").

## 4. CANNOT-TELL

- Why production items cluster at 385 (and 285). The code passes the
  model's `price_estimate` through, so the likeliest source is the model's
  answers to the §1.1 prompt. That is **INFERRED**, not measured: it would
  take the production rows or logged model responses to confirm.
- Whether any production row's `coin_cost` was set by hand, by auto-fill or
  by the bulk sync. The row records no source.

*Type: read-only trace. Rules: nothing. Mints: nothing. Changes no code.
Host/AWS/DB/Cognito contact: none.*
