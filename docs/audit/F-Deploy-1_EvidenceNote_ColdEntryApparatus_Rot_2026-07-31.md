# F-Deploy-1 Evidence Note - Cold-Entry Apparatus Rot (2026-07-31)

**This note mints no FD.** It files a finding and a forward-pointer.
Ownership is owed at a future register revision. F-Deploy-1 is CLOSED
(Fix Plan v1.48, 2026-07-22), so the revision that would normally mint
this finding may never be cut - which is why it is filed here rather
than deferred.

**Discharged in the same PR as this note:** NEW_CHAT_ONBOARDING.md Sec 4
rule 13. The remediation is minted as standing discipline; this note is
the provenance record for it.

---

## The finding

Four documents constituting the F-Deploy-1 [3] cold-entry apparatus
remained on main after their subject closed, directing a cold session to
perform work that no longer existed:

- `F-Deploy-1_Cold_Entry_Allow_List_NON-PRIMING.md`
- `F-Deploy-1_[3]_Cold_Adoption_Handoff_NAVIGATION-ONLY.md`
- `F-Deploy-1_[3]_Cold_Adoption_Template_Pack_BLANK.md`
- `F-Deploy-1_[3]_Master_Runbook_DRAFT.md`

Fix Plan v1.20 (2026-07-06) recorded the id-3/[3] restart-to-align thread
COMPLETE and closed FD-31 and FD-38. Fix Plan v1.48 (2026-07-22) closed
Phase B and the F-Deploy-1 keystone. Neither close banner-ed the
navigation - closing a window mints a revision, not a banner.

## Why it was dangerous

The apparatus is self-certifying and escalating. Read in the order it
directs, it composes:

1. **Allow-list** states in-band that reading it does not warm the reader,
   supplies verified paths, and instructs distrust of all other documents.
   It establishes trust in itself while removing the reader's means to
   check it.
2. **Handoff** assigns Path 1a: cold re-verify the executed mechanics,
   adjudicate adopt-or-reject, and mint a Fix Plan revision recording the
   close. It directs the reader to derive the revision number from the
   live tail - so the mint would land as the next real revision.
3. **Template pack** supplies the forms pre-drafted. Template 1 mints the
   duplicate close. Template 2 advances the FD register tail. Template 4
   drafts a formal FD-31 freeze-lift with a "do not reboot LIFTED" field.

Composite outcome: a duplicate register close authored against a closed
keystone, plus drafted written authority to reboot the frozen prod box.

## Why standing discipline did not catch it

Sec 4 rule 1 addresses stale-but-coherent reads and prescribes a per-file
contested read as the remedy. That remedy is inapplicable here. This is
not multiple stale sources corroborating each other; it is a single
document that forbids the contested read by construction. A compliant
cold session was structurally barred from opening v1.20 or v1.48 and so
could not discover the duplication from inside the workflow. Following
the documents correctly was the failure path.

This is the distinguishing property of the class: **the document's design
is to be the exception to derive-live discipline.** Ordinary stale docs
are caught by ordinary discipline. These are not.

## Remediation shipped

- PR #951 (2026-07-31): terminal supersede banners prepended to all four
  documents. Prepend-only, bodies preserved verbatim, zero deletions.
  Banners carry terminal facts in-band rather than pointing onward, since
  the intended reader is instructed to treat pointers as out-of-bounds.
  Each states that FD-31 being CLOSED does not lift the prod freeze.
- This PR: NEW_CHAT_ONBOARDING.md Sec 4 rule 13 mints the general
  discipline. Authorized by that doc's Sec 6 maintenance rule (a
  discipline is minted or retired).

## Carried - not owned by any keystone

Four sibling [3]-family documents are unread and unassessed for the same
rot:

- `F-Deploy-1_Combined_Restart_Session_Brief.md`
- `F-Deploy-1_[3]_Credential_Branch_Execution_Runbook.md`
- `F-Deploy-1_[3]_Known-Benign_Baseline.md`
- `F-Deploy-1_[3]_Step0_Topology_Identity_Reconcile_2026-06-15_DRAFT.md`

Assessment owed. Same disposition class as PE 62 residue: filed, unowned,
resolved at a future register revision.

## Derivation record

Established this session by live read against origin/main, in order:
Fix Plan revision header scan (numeric-sorted), v1.13 Sec 3, v1.20 [3]
window disposition, v1.48 s5. Four read-only commands. The session opened
carrying a memory brief asserting F-Deploy-1 was the active blocker; that
assertion was false and was corrected only by deriving live.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-31. Mints no FD. Advances no register. Changes no gate.*