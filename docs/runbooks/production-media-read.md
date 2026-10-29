# Runbook: reading production media for an authorized task

Ruling: `docs/audit/F-Tools-3_TaskScopedProductionReads_Ruling_2026-10-29.md`. Production is **default-deny**; this runbook covers only reads Evoni authorizes for a named task.

## 1. Today: method M1 (no setup)

1. Open Prime Studios **on a computer**. Go to the episode → **Files** → **Footage**.
2. Open the clip in the **Lala** lane → choose **Original** → save it:
   - Chrome or Edge: the player's ⋮ menu → **Download**;
   - any browser: right-click the video → **Save video as…**
3. Do the same for:
   - the **JustAWoman** clip;
   - the existing cut-out, if wanted (**Background removed**);
   - the scene-set angle image (Scene Sets → the set → the angle → open the full image → save);
   - the converted voice take.
4. Give the copies to the session:
   - **attach them in the conversation**; or
   - if they are too large to attach, put them in one folder on that computer and connect it to the session: Claude desktop app → Settings → Claude Code → Remote Control.
5. Tell the session which episode, clip labels and dialogue in/out times they are.

Nothing is uploaded again to Prime Studios, and nothing in AWS changes.

## 2. Later: method M2, the Media Read workflow (one-time setup by Evoni)

**Prerequisites:**
- M2's implementation PR is merged. It adds the `media-read` job and the session fetcher.
- The Diagnostics private repository exists (`docs/runbooks/diagnostics-workflow.md` §2).

### 2.1 The role (AWS console → IAM → Roles → Create role → Web identity)

- **Identity provider:** `token.actions.githubusercontent.com`. It already exists for the Deploy workflow.
- **Audience:** `sts.amazonaws.com`.
- **Trust condition:** `token.actions.githubusercontent.com:sub` equals `repo:angelcreator113/Episode-Canonical-Control-Record:environment:prod-media-read`.
- **Name:** `PrimeStudios-MediaRead-GHA`. **Maximum session:** 1 hour.
- **Permissions:** an inline policy. Replace `<bucket>` with the media bucket's name.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ReadMediaOnly", "Effect": "Allow", "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::<bucket>/episodes/*/raw-clips/*",
        "arn:aws:s3:::<bucket>/episodes/*/voice/sources/*",
        "arn:aws:s3:::<bucket>/scene-sets/*"
      ] },
    { "Sid": "NeverWrite", "Effect": "Deny",
      "Action": ["s3:Put*", "s3:Delete*", "s3:Restore*", "s3:Replicate*", "s3:*Acl*", "s3:*Policy*",
                 "s3:*Bucket*", "iam:*", "sts:AssumeRole", "ssm:*", "rds:*", "cognito-idp:*", "secretsmanager:*"],
      "Resource": "*" }
  ]
}
```

- **Copy the role's ARN.**

There is no `s3:ListBucket`. The job requests exact object keys, which the app already stores on each record. **Each run's credentials are narrowed further** by a session policy naming only that run's keys.

### 2.2 The GitHub environment (repository → Settings → Environments → New environment)

- **Name:** `prod-media-read`.
- **Required reviewers:** **you**. Every run waits for your approval.
- **Deployment branches:** `main` only.
- **Environment secret:** `AWS_MEDIA_READ_ROLE_ARN` = the ARN from §2.1.

### 2.3 The session's network

Claude Code → the session's environment → **Edit** → Network access → Allowed domains: add the media bucket's host (`<bucket>.s3.<region>.amazonaws.com`). Only downloads use it.

### 2.4 Each time a task needs it

1. **You** write the authorization in the conversation (F-Tools-3 §2): the task, the exact assets and M2.
2. The session starts the job with only those assets' record ids.
3. **GitHub asks you to approve the run.** Read the listed assets, then approve.
4. The job:
   - reads the object keys for those records;
   - assumes the role with a session policy limited to them;
   - writes 15-minute download links to the private repository, never to a log.
5. The session downloads the files into its scratchpad, records their sizes and sha256, and reports by name and key suffix only.
6. **After your review,** the session deletes the copies and shows that the folder is empty.

## 3. What never happens, under either method

- no writes, overwrites or deletes in S3;
- no database writes;
- no change to IAM, bucket policies, ACLs or flags;
- no deploy, migration or restart;
- no use of credentials found in the session;
- no private link or credential in a log, report, commit or PR.

The guard hook blocks the commands. Its tests are `.claude/hooks/guard-dangerous-commands.test.js` and `tests/unit/guards/guardHook.productionReads.test.js`.
