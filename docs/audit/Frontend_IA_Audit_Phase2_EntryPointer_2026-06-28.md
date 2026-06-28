# Frontend IA Audit — Phase 2 Entry Pointer (2026-06-28)

**Not an FD number.** Orientation note for the session that opens Phase 2.

## Status at close of Phase 1 (as of 2026-06-28, origin/main HEAD 1bbb67fb)

Phase 1 inventory has reached its natural stopping point. Both sub-audits
are at their stopping points:

- `Frontend_IA_Audit_Findings_v1.md` (v1.2) — episode-work findings
  (IA-1…IA-6) complete; sub-items resolved.
- `Frontend_IA_Audit_Phase1_Inventory_DRAFT.md` (v0.6) — nav-reachability
  sweep complete. Headline finding: ~23 feature pages are live routes with
  no Sidebar entry and no in-app link; reachable only by direct URL.

## Three open verification tasks (before any remediation)

These are the inventory's own stated loose ends — mechanical, read-only,
warm-safe, uncoupled from F-AUTH-1 / [3]:

1. **Dynamic-path check on the ~23 orphans** (highest-value, closes the
   primary method caveat): the grep saw only static nav (`to=`/`navigate()`);
   computed/template-literal paths were not checked. Each orphan needs a
   quick dynamic-path grep before any removal or relink decision.

2. **`StoryEngine` dead-subtree re-export certification**: the 4-component
   cluster is high-confidence dead but NOT certified; pending a
   `grep -r` for barrel/re-exports.

3. **Sec 1D orphan-candidate who-imports-me pass**: partially done; some
   candidates resolved as mislocated children, some confirmed definitively
   dead (`ProductionOverlaysTab`). Remaining candidates not yet swept.

## First task for Phase 2

Task 1 above — draft the dynamic-path verification grep set against the
named ~23 orphans, run it, record results. Closes the headline finding's
caveat. Hardens or shrinks the "23 orphaned pages" count before any
cleanup-phase decisions are made.

## Scope discipline

Everything past these verification tasks — whether an orphan gets a Sidebar
entry, a parent link, or retirement — is a cleanup-phase decision requiring
product intent. Phase 2 does not make those calls; it closes the inventory's
stated method caveats.
