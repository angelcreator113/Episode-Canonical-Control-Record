| **PRIME STUDIOS** **F-TOOLS-2 — PRODUCTION ACCESS LEVELS AND READ-ONLY DIAGNOSTICS RULING** *Records Evoni's rulings of 2026-10-29: three production access levels; Level 1 (standing read-only) delivered only through the Diagnostics workflow, with short-lived credentials, a fixed list of checks and private output; Level 3 (production changes) needs her explicit approval per action. Mints nothing.* |
| --- |

**Document version**

v1.0. **This ruling sets the scope; it does not itself authorize any act.** Level 1 takes effect only when §6 holds.

**Basis:** `origin/main` at `b13053bb`, 2026-10-29, plus branch `claude/diagnostics-workflow`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** ruling, on Evoni's word in the session of 2026-10-29: "AWS Access and Mobile Development Policy", the AWS Access Enablement Report, and her eight conditions approving the Diagnostics design.

---

# §1. Why

Every production question had to be handed to Evoni as a command to run, often from her phone. The audit of 2026-10-29 found AWS blocked by five independent layers:
1. the instructions in `CLAUDE.md`;
2. the command guard;
3. the deny list;
4. no AWS CLI in the session;
5. no usable credential (the two AWS variables in the session environment are 14-character placeholders).

The database is reachable only from the box, by design. Production logs are files on the box, not CloudWatch.

# §2. The three levels

| Level | What | Approval |
|---|---|---|
| **1. Standing read-only** | inspect production through the Diagnostics workflow's fixed checks: health, deploy state, logs, database connectivity, schema and counts, AWS infrastructure, S3 settings and listings, Cognito settings | **none per run**, once §6 holds (Evoni, condition 1) |
| **2. Development** | branches, tests, migrations and infrastructure changes prepared as PRs; deploy plans and rollback steps | merging per Rule 7 |
| **3. Production changes** | deploys and restarts; production migrations or data changes; IAM, bucket policy, network or secret changes; production feature flags; deleting AWS resources or media; anything else that changes production | **Evoni's explicit approval for that one action**; it does not carry to the next |

# §3. How Level 1 is delivered (conditions 2, 4, 6, 7)

- **No credential in the session.** The workflow obtains a 15-minute role, `PrimeStudios-ReadOnly-GHA`, by OIDC. Only jobs in the `prod-readonly` environment (`main` only) can assume it.
- **The session still never runs** `aws`, `ssh`, `scp`, `pm2` or `psql` against production. The guard and deny list are unchanged for those. The guard now also blocks running the workflow's runner-side scripts from a session.
- **A fixed list of reviewed operations.** Thirteen checks, the same list in the workflow, `runner.sh`, `on-box.sh` and the SSM document's `allowedValues` (a test enforces this).
  - Server checks run only through `PrimeStudios-Diagnostics`, from scripts in a commit on `origin/main`, as `ubuntu`.
  - Database reads run as `prime_readonly`, using fixed statements only.
  - There is **no** arbitrary shell, **no** arbitrary SQL, **no** object read, **no** secret read and **no** data modification. Each is refused by an explicit IAM Deny or by the database grants, not only by convention.
- **Private output.** This repository is public, so no report, log line, database row or sensitive metadata goes to its Actions log or artifacts.
  - Reports go only to the private repository `prime-diagnostics`.
  - `publish.sh` refuses unless a signed-out request to that repository gets 404.
- **Works with the API down.** It needs the box and its SSM agent, not the app. If the box is down, AWS-side checks still report why.

The full architecture, boundaries, setup, costs and rollback are in `docs/runbooks/diagnostics-workflow.md`.

# §4. Starting the workflow

A session may start **the Diagnostics workflow, and only that workflow**, through the GitHub tool, to investigate production without asking first. It then reads the private report and replies in the five-part mobile format (runbook §4).

Every other workflow remains never-dispatch for sessions. Approving, re-running or enabling any workflow remains Evoni's.

# §5. Exact `CLAUDE.md` amendment (Evoni commits it; a session may not edit the file that sets its own limits)

In **Non-negotiables**, add this bullet after **Deploys and migrations**:

```markdown
- **Production access levels** (`docs/audit/F-Tools-2_ReadOnlyProdVisibility_Ruling_2026-10-29.md`, Evoni, 2026-10-29). **Level 1, standing read-only:** a session may start the **Diagnostics** workflow (`.github/workflows/diagnostics.yml`, and no other) through the GitHub tool, without asking first, and read its report from the private repository `prime-diagnostics`; it still holds no AWS key or database password and never runs `aws`, `ssh`, `scp`, `pm2` or `psql` against production itself, and never puts secrets, tokens, passwords, private footage, database rows or unnecessary personal data in a report, log, chat or commit. **Level 2:** development, tests, migrations and infrastructure prepared as PRs; merges per Rule 7. **Level 3:** any production change (deploy, restart, migration, data change, IAM/bucket/network/secret change, production flag, deleting resources or media) needs Evoni's explicit approval for that one action. For a production question, investigate with Level 1 first and reply: what is happening; what was verified; cause or what is uncertain; recommendation; whether a Level 3 action needs approval. Level 1 is in effect only after the Diagnostics self-test passed (runbook §5); until then no session contacts AWS, a host or the database.
```

And in the **Production freeze lifted** bullet:
- **Replace:** `or enable/dispatch workflows`
- **With:** `or enable/dispatch workflows (except starting Diagnostics, per Production access levels)`

The `aws` bullet's allowlist is unchanged. It still governs any `aws` command a session might otherwise run, and the guard still blocks them all.

# §6. Takes effect when

1. The Diagnostics PR has merged.
2. Evoni has completed runbook §3 steps 1–9.
3. A `self-test` run has passed V1–V8 (runbook §5), and Claude has reported that result to Evoni.
4. Evoni has committed the §5 amendment.

Until all four hold, the earlier rules apply in full.

# §7. What this ruling does not change

- No session holds long-lived AWS keys or database passwords. Unrestricted production access was offered earlier on 2026-10-29 and declined; this ruling's Level 3 is per-action approval, not standing access.
- No `ssh`, `scp`, `pm2`, direct RDS connection, server `.env` edit or Cognito change from a session.
- Deploys and migrations run only through the Deploy workflow, after Evoni approves each run.
- Rule 7 is unchanged.
- Tooling access is not action authority. Each read is still made for a stated purpose in the conversation.

*Mints nothing.*
