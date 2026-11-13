| **PRIME STUDIOS** **F-TOOLS-5 AMENDMENT 1 — CLOUD SESSIONS MAY MAKE A NAMED SET OF REVERSIBLE INFRASTRUCTURE CHANGES (RULE 7 RULING)** *A cloud session may run a short list of reversible load balancer, security group and snapshot commands after asking Evoni in the conversation. The guard lets exactly those through in the cloud. What stops anything else is the IAM policy on the cloud identity, and nothing in the session. Everything outside the list stays hers. An amendment note to `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`. Mints nothing.* |
| --- |

**Document version**

v1.0. New register document. It amends F-Tools-5 §4's "Enforcement" paragraph and §2's cloud row, and edits nothing in that file: an additive banner at the top of F-Tools-5 points here (§8).

**Basis:** `origin/main` at `15aabfe091d5f29b1ccd07bfaf45584a37991a27`, 2026-11-13. Read for this draft, 2026-11-13: `.claude/hooks/guard-dangerous-commands.js`, `.claude/settings.json`, F-Tools-5 as filed, `claude-code-ops`'s policy and its CloudTrail history, and IAM's policy simulator on the companion policy (§6).

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** **RULED.** Evoni saw this text as a draft in the session of 2026-11-13 and said "Yes, file both" (this document and the guard change). Merging this file is her approval of the text. It takes effect when §9 holds. Her words, in that session:

> "Drop the approval-code mechanism. Redesign the amendment so the IAM policy is the only wall: cloud sessions may run the reversible ELB, security-group and agent-* snapshot actions in your policy draft after asking me in chat, and the guard allows exactly those in cloud; everything else stays mine."

**Standings used:** RULED (her words above, and this text once merged); MEASURED (the repository, the IAM and CloudTrail reads, the simulator output, the hook test in §2); INFERRED (marked where used).

**Task:** #3824 (this document). The guard change is #3825.

---

# §1. Why this is needed

F-Tools-5 §4 gates every command that deletes or irreversibly changes data or infrastructure. Where Claude Code's permission prompt may not reach Evoni (`auto`, `dontAsk`, `bypassPermissions`), the guard refuses the command outright (MEASURED: `gate()` in `guard-dangerous-commands.js`). Cloud sessions run that way, so on 2026-11-10 and 2026-11-11 Evoni ran every load balancer and security group change by hand from CloudShell. Two of those steps had to be run twice.

Cloud sessions also could not have made those changes: their AWS identity, `claude-code-ops`, can only send shell commands to a box (§6).

# §2. What was tried first, and why it was dropped

The first drafts of this amendment, shown to Evoni in the same session and never filed, had the guard issue a one-time code and a `UserPromptSubmit` hook record Evoni's `approve <code>`. That design needed the hook to fire only for a message she typed.

It does not (MEASURED 2026-11-13, a logging hook in a scratch project): the hook fired for a prompt given on the command line and for a message piped in as JSON. Its input has seven fields (`cwd`, `hook_event_name`, `permission_mode`, `prompt`, `prompt_id`, `session_id`, `transcript_path`) and none says where the prompt came from. Claude Code's documentation, as read that day, says the hook also fires for scheduled prompts, messages from other sessions and background reports, and that a session can create scheduled prompts itself.

So nothing inside a session can prove that Evoni approved something. **This amendment does not try to.** It puts the limit where the session cannot reach it.

# §3. The decision

1. **A cloud session may run the commands in §4**, on the resources the companion policy names, after asking Evoni in the conversation.
2. **Asking is F-Tools-5 §4, unchanged.** The session names the exact command, the target, what changes and how to undo it, and waits for her explicit yes in that session for that one action. After running it, the session reads the result back and shows it.
3. **The guard allows exactly the §4 commands in a cloud session**, and keeps refusing every other gated command there.
4. **The wall is the IAM policy on `claude-code-ops`** (§6). The guard and the asking are how a well-behaved session works. Neither is a control: a session that skipped the asking, or was manipulated into it, would still be stopped only by what that policy allows. The policy is written so that everything it allows can be undone.
5. **Everything else stays Evoni's.** Every gated action not in §4 is hers to run, in every session: all of IAM and Cognito, every deletion of data, instances, secrets, GitHub settings and variables, force-push and remote branch deletion.
6. **Laptop sessions are unchanged.** They run on her own admin credentials, which no policy narrows, so the guard relaxes nothing there. For a gated command she uses the default permission mode, where Claude Code's prompt reaches her (her ruling, 2026-11-13).

# §4. The list

Each entry is matched on the parsed command, the way the guard matches today.

| Area | Commands | Undo |
|---|---|---|
| Load balancer listener | `aws elbv2 modify-listener` | the same command with the old values, which the session records first |
| Load balancer rules | `aws elbv2 create-rule`, `modify-rule`, `delete-rule`, `set-rule-priorities` | delete, modify back, or recreate from the rule as read beforehand |
| Load balancer security groups | `aws elbv2 set-security-groups` | the same command with the old list |
| Target group | `aws elbv2 modify-target-group`, `modify-target-group-attributes`, `register-targets`, `deregister-targets` | modify back; register or deregister again |
| Security group rules | `aws ec2 authorize-security-group-ingress`, `authorize-security-group-egress`, `revoke-security-group-ingress`, `revoke-security-group-egress`, `modify-security-group-rules` | revoke what was authorized, authorize what was revoked |
| Database snapshot | `aws rds create-db-snapshot` (named `agent-*`), `aws rds add-tags-to-resource` on such a snapshot | none needed: it adds a copy. Removing one is hers |

"Reversible" means the configuration can be put back. It does not mean harmless: a wrong listener, rule or security group change takes effect at once and can take the site down until it is put back.

**Before each change the session records the current state** (the listener, rule, target group or security group as AWS describes it), so the undo is exact.

# §5. The guard

In `guard-dangerous-commands.js`, a §4 command is allowed without a prompt only when all of these hold. Otherwise the guard behaves as it does today.

1. **The session is a cloud session:** `CLAUDE_CODE_REMOTE` is `true` in the hook's own environment (the marker `session-start.js` already uses; MEASURED for cloud sessions in `F-Tools-4_AttendedLaptopMode_Ruling_2026-10-31.md` §2). A command cannot set it for the hook, which starts before the command does.
2. **The AWS identity in use is `claude-code-ops`.** The guard asks AWS (`sts get-caller-identity`) and compares the answer. Any other identity, or no answer, means refuse.
3. **The command does not choose another identity or endpoint:** no `--profile`, no `--endpoint-url`, no `AWS_` variable set in the command.

**Refused even then**, as a convenience and not as a wall (IAM cannot limit a rule's port or address):

- an inbound rule that opens port 3002 or 5432 to anyone;
- an inbound rule that opens port 22 to `0.0.0.0/0` or `::/0`.

Tests (`tests/unit/guards/`): each §4 command allowed under 1 to 3; the same command refused when any one of them fails; the two port rules refused; every other gated command still refused in the cloud; laptop behaviour unchanged in every mode.

# §6. The wall: `claude-code-ops`

**As read 2026-11-13** (`aws iam get-user-policy`, and CloudTrail's history for the user): one inline policy, `prod-ssm-run-shell`; no managed policy, group or boundary. It allows shell commands (`AWS-RunShellScript`) on the production box and the dev box, and reading their results. History: Evoni set it to both boxes on 2026-11-05 (12:53 UTC); at 22:20:56 UTC that day a call made with the `evoni-admin` key replaced it with a production-only text; she restored both boxes on 2026-11-13, and the session read it back.

**The widening** is a second inline policy, `gated-infra-changes`, filed with this document as `infra/agent-access/claude-code-ops-gated-infra-changes.json`. It allows the §4 actions on `primepisodes-alb`, `primepisodes-backend`, four named security groups, and `agent-*` snapshots of the production database, plus the reads needed to describe them. It denies outright: all of IAM, Organizations, Cognito and KMS; every RDS delete, restore, modify, stop and reboot; EC2 terminate, stop, reboot and delete, and creating or deleting security groups; deleting a load balancer, listener or target group; S3 writes and deletes; reading or writing secrets and parameters.

**Simulator (MEASURED 2026-11-13, `aws iam simulate-custom-policy`, the draft together with the both-boxes policy): 98 checks, 97 as intended.**

- every §4 action on its named resource: allowed (42);
- the same actions on another load balancer, target group, security group, database or a `deploy-*` snapshot: not allowed (16);
- IAM, Cognito, KMS, every delete, stop, reboot and restore listed above, S3 writes and secret reads: explicitly denied (39);
- the one difference: `CreateRule` tested against a rule's own name came back not allowed, while `CreateRule` against the listener was allowed. A rule is created on a listener, so this is how the check was posed and not a gap; the first real `create-rule` confirms it.

The simulator checks the policy text. It does not make a call. The first use of each command in a cloud session is the real test, and is reported as such.

**Applying the policy is an IAM change, so it is Evoni's own action**, from CloudShell signed in as an administrator:

```bash
aws iam put-user-policy --user-name claude-code-ops --policy-name gated-infra-changes --policy-document file://infra/agent-access/claude-code-ops-gated-infra-changes.json
```

Undo, which leaves `prod-ssm-run-shell` untouched:

```bash
aws iam delete-user-policy --user-name claude-code-ops --policy-name gated-infra-changes
```

# §7. Risks, in plain terms

1. **Nothing enforces the asking.** With the code dropped, her yes in the conversation is a rule the session follows, not something a machine checks. A session that misread its instructions, or was steered by text it read, could run a §4 command without asking. The policy bounds what that could do: reroute or break `primepisodes-alb`'s traffic, change four security groups, add snapshots. It could not delete data, touch IAM or Cognito, or read a secret.
2. **Every cloud session holds the key,** including scheduled tasks and sessions she is not watching. F-Tools-5 §1.2 says they act only on her own request; the guard cannot tell them from a session she is in. The same bound applies.
3. **A security group rule can expose a port.** IAM names the groups, not the ports. The guard's refusal of 3002, 5432 and open 22 (§5) is pattern-matching, with the gaps F-Tools-5 §9.3 describes. Both boxes bind the app and the database to loopback or to the load balancer's group, which is the second line here.
4. **An outage is reversible but real.** A wrong listener or rule change is live at once. The session records the state first and reads it back after (§3, §4).
5. **`agent-*` snapshots accumulate.** The identity can create them and cannot delete them, and RDS keeps at most 100 manual snapshots. Clearing them is hers.
6. **The key matters more now.** Rotating it every 90 days (F-Tools-5 §8 Q4) is worth doing on schedule.

# §8. What this amends

| Text | Change |
|---|---|
| F-Tools-5 §4, "Enforcement": "the guard **denies** gated commands in `auto`, `dontAsk` and `bypassPermissions` modes" | In a cloud session using `claude-code-ops`, the §4 commands here are allowed. For everything else, and on the laptop, the sentence stands |
| F-Tools-5 §2, cloud row, and §8 Q4 | The dedicated user exists (`claude-code-ops`); its permissions are the two inline policies in §6 |
| `CLAUDE.md`, "Explicit yes before irreversible actions" | One sentence added: a cloud session may run the listed reversible load balancer, security group and snapshot commands after her yes in the conversation; everything else gated is hers to run |

F-Tools-5 itself is not edited. It receives an additive banner, newest first, pointing here.

# §9. Takes effect when

1. This document has merged.
2. The guard change has merged with §5's tests green in CI.
3. Evoni has applied `gated-infra-changes` to `claude-code-ops`.

Until all three hold, F-Tools-5 §4 applies as filed.

---

*Type: ruling (Rule 7, production access), amendment to F-Tools-5. Rules: §3 to §5, on Evoni's word of 2026-11-13. Mints: nothing. AWS contact by the drafting session: read-only IAM, CloudTrail, ELB and RDS describes, and the policy simulator. Written to the merged corpus's house style without `/audit-file`, which agent sessions cannot invoke.*
