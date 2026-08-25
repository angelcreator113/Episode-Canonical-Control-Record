# F-AUTH-1 - PE #64 identity ownership resolution - 2026-08-25

| | |
|---|---|
| **Purpose** | Resolve PE #64 Amendment 1's `NOT ESTABLISHED` externality ruling for the three accounts counted in the shared Cognito pool. |
| **Basis** | `main` at `59eaf5320342b161d7529374919373a58f5c694c`, confirmed by `git ls-remote origin refs/heads/main`. |
| **Disposition** | **RESOLVED: all three accounts are controlled by Evoni; no external identity exists within the three-account set.** |
| **Method** | One authorized `ListUsers` call narrowed the records by email-address relation. Evoni's direct attestation supplied ownership. Neither evidence source is treated as sufficient alone. |
| **Discipline** | Aggregate results only. No username, raw email, user ID, pool ID, client ID, password, or token appears. |
| **Standing** | Does not re-cost Branch A, close PE #64 as a whole, establish password currency, or AWS-verify the app client's auth-flow configuration. Mints nothing. |

---

## 1. Why the question reopened

PE #64 Amendment 2 closed user enumeration unless PE #65 later produced a
newly scoped need. PE #65 did so: Branch A's execution-authorization and
rollback decisions were being evaluated against three accounts of unknown
ownership in the pool proposed for permanent production designation.

The new question was narrower than Amendment 1's rejected identity-count proxy:
compare the three accounts' email attributes with the known operator address,
then obtain direct ownership attestation from Evoni. The comparison could
narrow the question. It could not establish ownership or externality by itself.

---

## 2. Authorization and precommitted interpretation

Evoni authorized one read-only `ListUsers` enumeration against the existing
shared pool, solely to compare each account's email attribute with the known
operator address. The authorization prohibited displaying or recording
usernames, user IDs, raw email addresses, passwords, tokens, pool IDs, or
client IDs, and prohibited authentication, token issuance, create, update,
delete, or any other AWS operation.

The following interpretation was fixed **before** the call:

| Result | Permitted interpretation |
|---|---|
| Count other than three | Report count drift and stop. |
| Three exact matches | All three records share the known operator address; same-person ownership and externality remain unestablished. |
| Operator plus-address variant present | Address relation is established; same-person ownership and externality remain unestablished. A shared mailbox or alias is not person identity. |
| Different address present | That record does not use the known operator address; ownership and externality remain unestablished. |
| Missing or unverified email | Address comparison is inconclusive for that record. |

**No result could establish an external person without Evoni's direct
attestation.** Conversely, an address that resembled the operator address could
not establish one-person ownership. The rule was designed to prevent the AWS
result from being promoted beyond what an address comparison can prove.

---

## 3. Authorized read - aggregate result

Exactly one non-paginated `ListUsers` call was issued. The response contained
three users and no pagination token, so the authorized enumeration was complete
in that call.

| Classification | Count |
|---|---:|
| Exact known-operator address | 0 |
| Operator plus-address variant | 0 |
| Different address | 3 |
| Missing or unverified address | 0 |

**Read-only conclusion:** all three accounts use addresses different from the
known operator address. Ownership and externality remained **NOT ESTABLISHED**
at the end of the AWS read.

The comparison ruled out one known address. It did not answer ownership. Evoni
could recognize and control Cognito accounts under addresses unrelated to Git
identity; the discharging fact therefore had to come from her knowledge, not
from `ListUsers`.

---

## 4. Operator attestation

After the aggregate result and its bounds were stated, Evoni attested:

> `I control all three accounts`

The quote is preserved exactly. Context supplied by sections 1-3 identifies
which three accounts it concerns; no words are added to the attestation itself.

**Retrieval bound:** the short attestation reached the collaborating
conversation but was absent from the local Copilot session-store search. It is
quoted forward here from Evoni's in-channel confirmation. The gap is disclosed
as provenance, not treated as evidence against the attestation.

---

## 5. Disposition

The authorized read established the complete three-record set and ruled out the
known operator address. The attestation established control of that set.
Together, and only together, they discharge the externality question:

**All three accounts are controlled by Evoni. No external identity exists
within the three-account set.**

This supersedes PE #64 Amendment 1's `NOT ESTABLISHED` externality ruling and
`F-AUTH-1_Dim3_TokenAcquisition_2026-08-24.md` section 4.1's
composition-unknown term. It does not erase either document's historical
measurement or method finding.

PE #64's overall status and severity are not re-ruled here. This document
resolves the externality subquestion only.

---

## 6. Surviving bounds

### 6.1 Password currency remains unestablished

Control of three accounts does not establish that any recorded password is
current or that any account can presently complete password authentication.
No authentication or token issuance was attempted.

### 6.2 `USER_PASSWORD_AUTH` remains document-sourced

The auth-flow setting remains sourced from
`docs/COGNITO_USER_POOL_SETTINGS.md`, as recorded by
`F-AUTH-1_Dim3_TokenAcquisition_2026-08-24.md`. `ListUserPoolClients` does not
return `ExplicitAuthFlows`.

`DescribeUserPoolClient` was deliberately not called because its response may
include `ClientSecret`, which was outside the authorized no-secret-retrieval
boundary. Today's reads therefore neither AWS-verify nor falsify the documented
`USER_PASSWORD_AUTH` setting.

---

## 7. Effect on Branch A

The ownership/externality uncertainty no longer blocks PE #65's execution-
authorization or rollback decisions. Those decisions are not made here.

The costing's exposure framing is now overstated where it depends on unknown
ownership. **This document does not re-cost Branch A and does not amend the
costing.** Re-costing is substantive and requires its own ruling and pointer
decision.

---

## 8. What this document does not do

- Does not close PE #64 as a whole or change its severity.
- Does not close PE #65 or choose an execution or rollback decision.
- Does not establish password currency or successful authentication.
- Does not AWS-verify `ExplicitAuthFlows`.
- Does not re-cost Branch A.
- Does not disclose Cognito identifiers or account attributes.
- Does not mint an FD, XK, or PE number.
- Does not contact a host, dispatch a workflow, issue a token, or perform an
  AWS write.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-25 | Records the separately authorized `ListUsers` scope and precommitted interpretation; aggregate result 0 exact / 0 variants / 3 different / 0 missing; exact Evoni attestation; retrieval-gap provenance; externality resolution; password-currency and document-sourced auth-flow bounds; pointer targets; no re-costing. |

---

*Recorded 2026-08-25. Basis `main` at `59eaf532`. One authorized read-only `ListUsers` call had already completed before drafting. No additional AWS call issued while drafting. No host contacted. No workflow dispatched. No AWS write. Prod FROZEN.*