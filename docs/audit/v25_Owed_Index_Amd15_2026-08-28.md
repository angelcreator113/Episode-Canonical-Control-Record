| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 15** *The repository-settings read performed; §M4.2 resolves negative.* |
| --- |

> **POINTER BANNER — AMENDMENT 16, 2026-08-28. This banner points and carries
> nothing.**
>
> **Amendment 16 records that `v25` Sec 6 item 12 is CLOSED** — Evoni selected
> Branch B for the Cognito pool topology on 2026-08-28. **It is the first of
> Sec 6's four Evoni-gated items to close; items 8, 9 and 11 remain gated and
> NOT PERFORMED.**
>
> **Amendment 16 points and carries nothing.** All substance — the branch
> ruling, the Branch A re-costing, the §9.10 re-specification and the pointer
> decision — is at **`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`**.
>
> **Nothing in this document is amended.** Per the carriage ruling, no banner is
> placed on `Prime_Studios_Audit_Handoff_v25.md`, `Session_PE_Roster.md`, or
> `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`; their blobs do not move.
>
> **This banner moves this document's blob under an unchanged filename** —
> `v25` Sec 4.1 defeater 3, disclosed banner-forwarding in Sec 5.5's sense. Its
> pre-banner value was `af8acdab9bdec4dd56be43a24a8bb38085a41573`; the
> post-banner value is recorded in Amendment 16's footer, **measured after
> placement, not predicted.**

# v25 Owed Index — Amendment 15

**Document version**

**AMENDMENT 15 to `v25_Owed_Index_2026-08-22.md`.** Records the authenticated
repository-settings read that closes Amd13 §M4.2. It does not amend the prior
text in place.

**Minted rather than carried in place**, under the amendment-chain convention.

**Rules nothing about any finding. Mints no finding.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; **ASSESSMENT NOT COMPLETED**. Prod **FROZEN**. The unresolved items
remain unresolved: **8, 9, 11, and 12**.

**Basis:** `origin/main` at `830fe810dd004b0e66dc48530d387558b1e0e985`,
2026-08-28. Amd12 is `9ba6c13cf2c2404982a00614117316622c4d1f2f`; Amd13 is
`2624becb4306e13f0cc4dd033601cd2cb827b70b` (the post-banner blob); Amd14 is
`1798e14cf22dcae65a19b9fc55c726a6175579ba` before this filing's pointer banner.

**Author**

JAWIHP / Evoni — Prime Studios.

This is the first commit in this amendment series genuinely authored from the
repository administrator's own machine. The repository's normal identity is
therefore used; no `Agent-Session` trailer applies. The authenticated read
recorded below was performed by GitHub Copilot through that identity's channel.

**Status**

One conditional discharged by an authenticated repository-settings read. No
repository setting was changed by this amendment.

---

## §O0. Why this amendment exists

Amd13 §M4.2 recorded the following as a possibility, not a finding:

> If that setting is on, the repository holds an automatic pull-request-opening
> surface that is returned by no `list_workflows` call, found by no sweep of
> `.github/workflows/`, and named by neither report's enumeration.

The setting was not read by either agent session when Amd13 was written. This
amendment records the read that was subsequently performed.

**Authority check:** the cited Amd13 is the live post-banner blob
`2624becb4306e13f0cc4dd033601cd2cb827b70b` at `origin/main`, not the pre-banner
draft `92057ca688b826d4fd90f279b39d9451ebfcddd4`. Amd14's live pre-filing blob
was `1798e14cf22dcae65a19b9fc55c726a6175579ba`; this filing places its required
forward-pointer banner, moving that unchanged filename to
`738a4f796c54364740b25a0cfd843865579599f1` as measured after placement.

## §O1. The authenticated repository-settings read

**Performed** on 2026-08-28 by GitHub Copilot through the GitHub CLI, using the
authenticated channel for the repository administrator account
`angelcreator113` (GitHub user id `212567798`). The repository is
`angelcreator113/Episode-Canonical-Control-Record`.

**Method:**

```text
gh api repos/angelcreator113/Episode-Canonical-Control-Record --jq "{visibility: .visibility, security_and_analysis: .security_and_analysis}"
```

**Observed response:**

```json
{
  "security_and_analysis": {
    "dependabot_security_updates": {
      "status": "disabled"
    }
  },
  "visibility": "public"
}
```

The complete response also reported secret scanning enabled. The read did not
alter any repository setting.

**Standing:** authenticated read by the repository administrator against her
own repository settings. This is the highest-authority read available for the
setting. Neither agent session can independently verify the result because its
repository-settings capability was not available; that limitation is part of
this record and does not lower the standing of the read itself.

## §O2. §M4.2 resolves negative

The repository's `dependabot_security_updates.status` is **`disabled`**.
Therefore the condition in Amd13 §M4.2 is false:

> If that setting is on ...

It is not on. The repository does not currently hold the Dependabot
security-update pull-request-opening surface described by that conditional.

The result agrees with the two independent repository artifacts already
recorded in Amd13 §M4: commit `5cfe56b0` says *"disable Dependabot PRs"*, and
`.github/dependabot.yml` sets `open-pull-requests-limit: 0` for both npm
ecosystems. Those artifacts alone did not establish the security-update
setting; this authenticated read does.

**The file and the setting agree by different routes.** The configuration is
the documented security-only recipe, the commit message says *"disable
Dependabot PRs"*, and the repository setting is disabled. The discrepancy that
made Amd13 §M4.2 worth writing does not exist in fact.

**§M4.2 is closed in the negative.** The prior conditional is not rewritten and
no hidden PR-opening surface is inferred from it.

## §O3. Scope and non-effects

This amendment records one platform-state fact only. It does not rule on PE
#68, revise the workflow inventory, change any gate or disposition, or infer
status for unresolved items 8, 9, 11, or 12. Production remains **FROZEN**.

---

*Type: amendment and record only. Edits no file outside this amendment and the
required forward-pointer banner in Amd14.*
