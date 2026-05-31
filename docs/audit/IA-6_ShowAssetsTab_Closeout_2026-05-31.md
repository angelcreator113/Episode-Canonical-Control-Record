# IA-6 Sub-Item — `ShowAssetsTab` Body Read: RESOLVED (closeout note)

> Frontend IA audit closeout. Read-only source review; nothing executed, no gate
> moved, frozen box untouched. Companion to `Frontend_IA_Audit_Findings_v1.md`.

| | |
|---|---|
| **Parent** | IA-6 (label/key/component mismatch: tab "Production" → key `assets` → `ShowAssetsTab`) |
| **Sub-item** | "What is `ShowAssetsTab` truly?" — flagged in findings, deferred to a body read |
| **Status** | **RESOLVED 2026-05-31** from full read of `frontend/src/components/Show/ShowAssetsTab.jsx` |

---

## Verdict

**`ShowAssetsTab` = a real production-asset roll-up dashboard.** Naming is
**overloaded-but-honest, NOT an IA-4-style misroute.** Single definition, single
mount (`ShowDetail.jsx:414`). IA-6 sub-item closed.

### Evidence

1. **Real, not decorative.** On mount (effect keyed `[show.id]`) it fires four
   parallel reads via `Promise.allSettled` (one failure doesn't blank the rest):
   - `/api/v1/scene-sets?show_id=…&limit=100`
   - `/api/v1/ui-overlays/{show.id}`
   - `/api/v1/wardrobe?show_id=…&limit=200`
   - `/api/v1/assets?show_id=…&asset_scope=SHOW&limit=200`

   It counts, pulls thumbnails, renders live counts + images, and every action
   button routes into the real library for that category
   (`navigate('/shows/{show.id}/{link}')`). Working fetch-and-render path with
   functioning navigation — **not** a `/social-systems`-class dead surface.

2. **Naming overloaded, not a lie.** The component's own `<h2>` renders
   **"Production Assets"** with subtitle "{n} assets across 5 categories." So the
   chain tab-"Production" → key-`assets` → `ShowAssetsTab` → "Production Assets" is
   internally consistent. "Production" and "assets" are two facets of one concept.
   **This is not the IA-4 pathology** (`/universe/production` silently rendering one
   of ten shows). IA-6 is one feature wearing two words; IA-4 is a genuine
   misdirection. Distinct findings.

3. **Clean scoping — no IA-4 smell.** Every fetch is filtered by `show.id`; the
   effect re-runs on `[show.id]`; it renders exactly the `show` prop handed in, with
   **no "pick one of ten" fallback** anywhere. The IA-4 disease is isolated to
   `/universe/production` and does not extend here.

---

## Two pattern-drift surfaces this read surfaced (NOT IA-6 blockers — record only)

Both are instances of patterns the audit already catalogs; fold into the existing
findings rather than treating as new.

1. **Counter truncation (same family as the confirmed P1 Wardrobe/Locations
   limit=200/50 bug).** This dashboard hard-caps its reads: `wardrobe limit=200`,
   `assets limit=200`, `scene-sets limit=100`. A show exceeding those undercounts
   in the roll-up and drops items from the thumbnail strip. **New surface of the
   existing P1 truncation finding** — append to that finding's surface list.

2. **Brittle client-side role bucketing (same family as the `WorldAdmin.jsx:1475`
   substring-match finding).** The `uploads` count is derived as "assets whose
   `asset_role` includes neither `INVITATION` nor `OVERLAY`" — a substring/negation
   filter. Any new `asset_role` value silently lands in `uploads`. Recurring
   "string-match where an enum/FK belongs" pattern. Minor; record against the
   existing brittle-matching finding.

---

## IA audit status after this closeout

- Findings IA-1..IA-6 — complete.
- IA-6 sub-item (`ShowAssetsTab` identity) — **RESOLVED** (this note).
- **IA audit is now complete through findings.** Only the cleanup/redesign phase
  remains — its own pass, not started. Highest-severity target there: IA-4
  (`/universe/production` silently renders one of ten shows).

*Read-only review. No code changed, no gate moved, frozen box untouched.*
