| **PRIME STUDIOS** **F-AUTH-1 — `roles.js` XK-3 HOLD LIFTED (AMENDMENT)** *Records that the HOLD placed on `src/routes/roles.js` at F-AUTH-1 v2.45 §3 and v2.46 §4 is lifted by Evoni's admin-only ruling of 2026-10-29, and that SEC-2 (PR #3634) puts all nine handlers behind `requireAuth` + `authorize(['ADMIN'])`. Mints nothing. Does not amend XK-3 or the Cross-Keystone Register.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited.

**Basis:** `origin/main` at `b13053bb` (2026-10-29), plus branch `claude/sec-2-roles-config-check-admin` (PR #3634).

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-10-29.

---

# §1. What is amended

## The hold as it stood

- **F-AUTH-1 v2.45 §3** reported `roles.js` as an **instance of XK-3** (F-Stats-1 v1.57).
  - Its eight handlers (nine routes counting `/validate-required`) take tenancy only from `req.query.show_id` / `req.body.show_id`.
  - The `|| req.user?.show_id` fallback cannot fire, because no middleware sets `show_id`.
- **F-AUTH-1 v2.46 §4** then **HELD** the file out of the Tier 1 sweep. Its reasoning: promoting it "authenticates the caller and changes nothing about which show's data they reach".
- `tests/integration/f-auth-1-fd63.test.js` asserted the hold. Its check was that an anonymous `GET /api/v1/roles` is **not** refused by auth.

## What changes

- **The hold is lifted.**
- **The ruling.** On 2026-10-29 Evoni ruled that Prime Studios is an admin-only production environment, with her as its only operator.
- **The exposure that motivated the change.** The hold had left every `roles.js` route `optionalAuth`. Anyone, signed in or not, could:
  - create, change and delete asset roles for any show;
  - bulk-assign a role to any asset id.
- **What SEC-2 does** (PR #3634, commit `31026a50`):
  - It puts all nine routes behind `requireAuth` + `authorize(['ADMIN'])`.
  - It rewrites the integration test to assert the **401 / `AUTH_REQUIRED`** for an anonymous request.
  - `tests/unit/routes/sec2-roles-config-check-admin.test.js` covers 401 / 403 / admin for each route.

# §2. What is not amended

- **XK-3 itself stands unchanged:** its body, gates, ownership and UNEVALUATED remedy status.
- **The tenancy finding stands.** The handlers still take `show_id` from the caller with no entitlement check.
  - SEC-2 narrows *who* can call them (admins only). It does not make tenancy server-derived.
  - Under the admin-only ruling there is one operator, so the cross-tenant consequence XK-3 describes has no second party to reach today.
  - That is a statement about the current operator population. It does not resolve XK-3.
  - The finding returns in full when non-admin roles are introduced, which the ruling defers to future phases.
- **XK-3 Gate 3 stays OPEN.** It asks whether any caller exercised the routes before the fix, and answering it needs production reads.
  - The exposure assessment in the 2026-10-29 security plan (§3, checks 1 and 4) is the instrument: access logs for `/api/v1/roles` writes, and `asset_roles` / `assets.role_key` change history.
  - Neither has been run at the time of writing.
- **v2.45 §3.4's containment claim is not re-derived here.** That claim is that the `req.user?.show_id` idiom appears only in `roles.js`.

# §3. Merge condition

This amendment rides in the same PR as SEC-2 (#3634), so the register records the lift no later than the code that performs it.

*Mints nothing.*
