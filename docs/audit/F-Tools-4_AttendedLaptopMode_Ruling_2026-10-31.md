| **PRIME STUDIOS** **F-TOOLS-4 — ATTENDED LAPTOP MODE (RULE 7 RULING)** *Adds a second session mode. In a session Evoni runs and watches on her own computer, the agent may run the `gh` and `aws` commands she asks for, each one approved by her at the prompt, using her own local login. A never-list holds in every mode. Cloud sessions are unchanged. Amends F-Tools-1, F-Tools-2 and F-Tools-3 additively; edits no filed document. Mints nothing.* |
| --- |

**Document version**

v1.0. New register document. It edits no filed document and adds no banner. The `CLAUDE.md`, settings and guard changes it calls for are a separate PR (§8).

**Basis:** `origin/main` at `e4bae5ab1f35a75a422cb8ca83dfc7a5af24ac68`, 2026-10-31.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** **RULED in principle; text for Evoni's review.** Merging this file is her approval of the text, including the defaults in §6. It takes effect only when every condition in §9 holds. Her words, in the session of 2026-10-31:

> "Draft a Rule 7 ruling for my review adding an 'attended laptop mode': in sessions I run on my own machine, the agent may run gh and aws commands I request, with my per-command approval, using my local credentials; it never handles passwords or keys in files or chat, and destructive actions stay banned in every mode. Cloud sessions keep current limits."

**Standings used:** RULED (Evoni's words above, and the text once merged); MEASURED (this repository at the basis; commands and outputs in Task #3661's PRs); INFERRED (marked where used).

**Task:** #3661. Related, broader and still open: #3650 (owner-operated production maintenance through protected workflows).

---

# §1. Why

Evoni is a solo operator. Today every `gh` or `aws` command a session needs is handed back to her to run by hand, often from her phone, because every session is treated as an unattended cloud session.

- `CLAUDE.md` and F-Tools-1 limit `aws` to a by-name read list.
- F-Tools-3 makes production default-deny.
- The guard hook (`.claude/hooks/guard-dangerous-commands.js`) and the `deny` list in `.claude/settings.json` block the AWS CLI and most `gh` write commands outright, in every session, wherever it runs.

When she is at her own computer, watching the session and approving each command, most of that friction protects nothing. The command runs as her, with her login, on her machine, after she has read it.

# §2. The two modes, and how a session knows which it is in

| Mode | When | Rules |
|---|---|---|
| **Cloud** (strict) | any session where the guard cannot establish attended mode, including every cloud session | everything in force today, unchanged |
| **Attended laptop** | **all** of: (a) `CLAUDE_CODE_REMOTE` is not `true`; (b) the opt-in marker `PRIME_ATTENDED_LAPTOP=1` is set in Evoni's **user-level** Claude Code settings on her own computer (`~/.claude/settings.json`, `env`), never in this repository; (c) Evoni is at the keyboard approving prompts | §3 and §4 |

**Detection is fail-closed.** Anything that is not clearly attended is strict. That covers a local session without the marker, a session on another person's clone, and a Claude Code run on a GitHub Actions runner.

Claude Code sets `CLAUDE_CODE_REMOTE=true` in cloud sessions (MEASURED in this session; documented at code.claude.com/docs/en/env-vars). **Why a marker as well (default; see §6 Q1):**
- If Claude Code ever renamed or stopped setting `CLAUDE_CODE_REMOTE`, a cloud session would otherwise drop silently into attended mode.
- A Claude Code run on a CI runner may not set it (INFERRED, not verified) while holding the runner's credentials.

The marker makes attended mode something Evoni turns on, on one machine, rather than something a session infers. A test in the implementation PR fails if any settings file in this repository sets the marker.

**Condition (c) is enforced by the prompt.** In attended mode the guard does not approve `gh` or `aws` commands. It returns `ask`, so Claude Code stops and shows Evoni each command. An unattended local session therefore cannot run one: it waits.

That holds only in a permission mode where an `ask` reaches a person. Claude Code passes the session's `permission_mode` to the hook. When it is anything other than `default`, `plan` or `acceptEdits` (for example `auto`, `dontAsk` or `bypassPermissions`), the guard treats the session as strict, even with the marker set. A prompt that is answered automatically is not Evoni's approval.

# §3. What attended mode permits

1. **`gh` and `aws` commands Evoni asks for in the conversation**, reads and non-destructive writes, outside the never-list in §4.
2. **One command, one approval.** Each command is shown to her at Claude Code's permission prompt before it runs.
   - The guard returns `ask` for every `gh` and `aws` command.
   - No `allow` rule in this repository may pre-approve `gh` or `aws`, so the prompt cannot be skipped by a rule. INFERRED, not verified: whether a hook `ask` still prompts when a user-level `allow` rule matches. The implementation PR checks this before §9.3.
   - Approving one command never approves the next, a variant of it, or a retry with different flags.
3. **Her own local login.** These are credentials Evoni obtained herself on that computer: `gh auth login`, `aws sso login` or her existing AWS profile. The CLI process she approves uses them; the agent never sees them.
   - Evoni runs any login herself.
   - Under F-Tools-1's cached-credential clause, credentials from her own interactive login on her own machine are not "found" credentials. **This is the clarification attended mode needs; in cloud mode the clause is unchanged.**
4. **Her request is the task authorization.** For F-Tools-3 §2, Evoni's request in the conversation, plus her approval at the prompt, counts as the task authorization for that one command, and attended CLI use is an approved method: **M4, the attended CLI** (amending F-Tools-3 §3). Everything else in F-Tools-3 §1.4 still holds (§4 below).
5. **Rule 7 is unchanged.** Push, PR create, merge, force-push and branch delete each still need her explicit yes in the conversation, naming that action. The prompt approval is in addition to that yes, not a substitute for it.

# §4. The never-list: denied in **every** mode, by the guard

Attended or not, the guard returns `deny` for these, with the reason. Approval at a prompt cannot override a `deny`.

1. **Destructive actions.**
   - `aws`:
     - any `delete-*`, `remove-*`, `terminate-*`, `deregister-*`, `purge-*` or `cancel-*` operation;
     - `s3 rm`, `s3 rb`, `s3 mv`, and `s3 sync --delete`;
     - `rds stop-*`, `rds reboot-*`, `rds restore-*` and `rds modify-*`;
     - `ec2 stop-instances`, `ec2 reboot-instances`, `ec2 modify-*` and `ec2 revoke-*`;
     - `kms schedule-key-deletion` and `kms disable-key`;
     - `cloudformation delete-stack`;
     - `cognito-idp admin-delete-*` and `admin-disable-user`.
   - `gh`:
     - `repo delete` and `repo archive`;
     - `release delete`, `run delete`, `cache delete`, `secret delete` and `variable delete`;
     - `api` with `-X DELETE` / `--method DELETE`.
   - The existing Git rules: force-push, and push to `main` or `dev`.
2. **Anything that returns or handles a credential.**
   - `aws`:
     - `configure` (any subcommand) and `configure export-credentials`;
     - `sts get-session-token`, `sts assume-role*` and `sts get-federation-token`;
     - `iam create-access-key` and `iam create-login-profile`;
     - `ssm get-parameter*` and `secretsmanager get-secret-value`;
     - `ecr get-login-password`;
     - `cognito-idp describe-user-pool-client` without a `--query` that excludes `ClientSecret` (F-Tools-1's condition, unchanged);
     - `cognito-idp initiate-auth` and `admin-initiate-auth`, which return tokens.
   - `gh`:
     - `auth token` and `auth status --show-token`;
     - `secret set`, which takes a secret value.
   - Reading credential files: `~/.aws/*`, `~/.config/gh/*`, `.env*`.
   - Printing the environment, or naming `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` in a command.
3. **Security-boundary and settings changes** (F-Tools-3 §1.4 and the Issue #3650 rulings, carried into this mode unchanged):
   - **AWS:** IAM; bucket policies, ACLs and public-access blocks; security groups; KMS key policies; Cognito pool, client and user changes.
   - **Production configuration:** feature flags and any server `.env`.
   - **GitHub:** repository settings, environments, rulesets, branch protection, Actions secrets and variables, and Actions permissions.
4. **Production changes outside the approved paths.** No session, in any mode:
   - runs a deploy, migration or restart outside the Deploy workflow;
   - dispatches, approves, re-runs or cancels any workflow run, or turns on auto-merge;
   - runs `ssh`, `scp`, `pm2`, or `psql` against production;
   - writes, overwrites or deletes production files or database records (F-Tools-3 §1.4).
5. **No secrets in chat or files.** The agent never asks Evoni to paste a password, key or token. It never writes one into a file, a command line, a commit or a PR. If one appears in a command's output, the agent stops, tells her which command printed it, and asks her to rotate it. It does not repeat the value.

**What "destructive" means where the list is silent.** An action is destructive if undoing it needs a backup, a support ticket, or more than re-running one command. A command the guard cannot classify is not therefore permitted. In attended mode it still goes to Evoni's prompt with its full text, and the agent says plainly in the conversation what it changes and how to undo it before she approves.

# §5. What does not change

- **Cloud sessions:** every limit in `CLAUDE.md`, F-Tools-1, F-Tools-2 and F-Tools-3 as they stand, and every current guard rule. The implementation PR's tests prove each current block still holds when `CLAUDE_CODE_REMOTE=true`.
- **Rule 7:** a per-action explicit yes for push, PR create, merge, force-push and branch delete.
- **The Deploy workflow ruling of 2026-10-10:** deploys and migrations only through it, after Evoni approves the run, with database credentials staying on the server.
- **The register:** filed documents stay immutable.
- **Tooling access is not action authority** (F-Tools-1 §3). Attended mode makes a command possible; Evoni's request and approval make it authorized.

# §6. Choices in this text, with the defaults it adopts

Merging accepts the defaults. To change one, comment on the PR and the text is revised before merge.

| | Question | Default adopted |
|---|---|---|
| Q1 | Is detection by `CLAUDE_CODE_REMOTE` alone, or also by the opt-in marker? | **Both** (§2). Fail-closed if Claude Code changes the variable, and closed on CI runners. |
| Q2 | Does attended mode allow non-destructive **writes** (e.g. `gh issue create`, `gh pr create`, `aws s3api put-bucket-versioning`), or reads only? | **Writes allowed**, per command, outside §4. Rule 7 actions still need the explicit yes. |
| Q3 | Does attended mode cover `ssh`, `scp`, `pm2` or `psql` to production? | **No.** The ruling names only `gh` and `aws`; the rest stays barred (§4.4). Adding them needs a new ruling. |
| Q4 | May the agent run `aws sso login` or `gh auth login` for her? | **No.** She runs logins herself, so the agent never drives a credential flow. |
| Q5 | Does attended mode let the agent dispatch the Diagnostics workflow from the shell? | **No.** F-Tools-2 §4 (through the GitHub tool, once Level 1 is in effect) is unchanged. |

# §7. Amendments to earlier rulings (additive; the filed texts are not edited)

- **F-Tools-1 (2026-09-16):**
  - Its by-name `aws` read allowlist, and its custody clauses, govern **cloud mode**.
  - In attended mode, §3 and §4 of this document govern instead.
  - Its cached-credential clause is clarified by §3.3: Evoni's own interactive login on her own machine is not a found credential.
  - "No long-lived keys … in a session's environment" still holds in every mode. Her local login lives in her CLI's own store, never in the session's environment variables or the repository.
- **F-Tools-2 (2026-10-29):** unchanged. Its "never runs `aws` … against production itself" applies to cloud mode. In attended mode, §3–§4 apply.
- **F-Tools-3 (2026-10-29):**
  - Adds method **M4, the attended CLI**, available only in attended mode.
  - Evoni's request in the conversation, plus her prompt approval, is the §2 task authorization for that one command.
  - §1.4's never-list holds in every mode (this document's §4.3–§4.4).
  - §5's guard rules stay in force in cloud mode. In attended mode the guard turns the AWS-CLI block into an `ask` and keeps every other §5 block.

# §8. Implementation (the next PR; Task #3661, PR C)

1. **`CLAUDE.md`.** Insert the text below as a new **Non-negotiables** bullet after **Rule 7**. The PR that does this is drafted by a session and merged by Evoni; her merge is her commit of it (F-Tools-2 §5's rule that a session may not edit the file setting its own limits is met by her review and merge).

   ```markdown
   - **Attended laptop mode** (`docs/audit/F-Tools-4_AttendedLaptopMode_Ruling_2026-10-31.md`, Evoni, 2026-10-31). A session is in attended mode only when `CLAUDE_CODE_REMOTE` is not `true`, `PRIME_ATTENDED_LAPTOP=1` is set in Evoni's user-level Claude Code settings on her own computer, and she is approving prompts herself (permission mode `default`, `plan` or `acceptEdits`, never `auto` or `bypassPermissions`); otherwise every rule above applies unchanged (cloud mode). In attended mode the session may run `gh` and `aws` commands Evoni asks for, each approved by her at the prompt, using her own local login; that request and approval are the task authorization for that one command (F-Tools-3 M4). Never, in any mode: destructive actions; commands that return or handle credentials, or reading credential files; IAM, bucket-policy, ACL, security-group, KMS, Cognito, feature-flag, server `.env` or GitHub settings/secrets/environments changes; deploys, migrations or restarts outside the Deploy workflow; dispatching, approving or re-running workflows; `ssh`/`scp`/`pm2`/`psql` to production; secrets pasted into chat or written into files. Rule 7's explicit yes still applies.
   ```

2. **`.claude/settings.json`.** Remove `Bash(aws *)` and `PowerShell(aws *)` from `deny`, because a static rule cannot tell the modes apart and the guard enforces both. The other `gh` denies stay: they are all on the never-list.
3. **`.claude/hooks/guard-dangerous-commands.js`:**
   - mode detection per §2, including the `permission_mode` condition;
   - in cloud mode, every current rule, unchanged;
   - in attended mode, `ask` (PreToolUse JSON) for `gh` and `aws` commands, and `deny` for §4.
4. **Tests:**
   - every current block still holds with `CLAUDE_CODE_REMOTE=true`, with neither variable set, and with the marker set but `permission_mode` = `auto` or `bypassPermissions`;
   - in attended mode, an `aws` read and a `gh issue create` get `ask`;
   - every §4 example gets `deny`;
   - no repository settings file sets `PRIME_ATTENDED_LAPTOP`.
5. **Docs:** a `DEVELOPMENT_WORKFLOW.md` section on turning attended mode on and off.

# §9. Takes effect when

1. This document has merged.
2. The implementation PR (§8) has merged, with its tests green in CI.
3. Evoni has set `PRIME_ATTENDED_LAPTOP=1` in `~/.claude/settings.json` on her computer, and has seen one `aws sts get-caller-identity` run in attended mode, prompted and then approved, with the account shown only on her screen.

To turn attended mode off: remove the marker. Every session on that machine is then strict again, with no repository change.

---

*Type: ruling (Rule 7, tooling access). Rules: §2–§8, on Evoni's word of 2026-10-31, with the §6 defaults. Mints: nothing (no FD, XK or PE). Host, AWS, database or Cognito contact by the filing session: none. Production standing: production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`), and production access is default-deny (`F-Tools-3_TaskScopedProductionReads_Ruling_2026-10-29.md`). This document changes neither until §9 holds, and then only in attended mode.*
