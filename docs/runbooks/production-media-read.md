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

The design is in F-Tools-3 §3.1. **The session never contacts AWS.** A workflow in a **private** repository reads the approved assets and hands the session an encrypted, trimmed copy as a workflow artifact that lasts at most a day. Nothing is ever committed to Git.

§2.1 and §2.2 can be done any time. §2.3 to §2.5 come after M2's implementation PR is merged.

### 2.1 First: the Diagnostics setup (M2's database lookup depends on it)

Follow `docs/runbooks/diagnostics-workflow.md`:
- the private repository;
- `PrimeStudios-ReadOnly-GHA`;
- the `prod-readonly` environment;
- the `PrimeStudios-Diagnostics` SSM document;
- the `prime_readonly` database role and `~/.episode-readonly.env`.

As of 2026-10-29 none of this is in place: the Diagnostics workflow has never run, and no `prime-diagnostics` repository is visible. After M2's PR, register the new document version, which adds the `media-keys` check and its UUID-only parameter.

### 2.2 Checks before the build (no production data involved)

1. **Your GitHub plan.**
   - Do environments with **required reviewers** work in a **private** repository? If not, M2 uses the fallback: you start each run yourself from the GitHub app.
   - What is the **Actions artifact storage** quota?
2. **A harmless test.** The session downloads a test artifact from a private repository (no media), to confirm its GitHub tool and network reach artifact storage.
3. **Bucket encryption.** Does the media bucket use a KMS key? The Diagnostics `s3-config` check answers this once Diagnostics runs. Also confirm which bucket and prefix hold scene-set stills.

### 2.3 The read role (AWS console → IAM → Roles → Create role → Web identity)

- **Identity provider:** `token.actions.githubusercontent.com`. It already exists for the Deploy workflow.
- **Audience:** `sts.amazonaws.com`.
- **Trust condition:** `token.actions.githubusercontent.com:sub` equals `repo:angelcreator113/<private-repo>:environment:prod-media-read`. With the dispatch-yourself fallback, use `repo:angelcreator113/<private-repo>:ref:refs/heads/main` instead.
- **Name:** `PrimeStudios-MediaRead-GHA`. **Maximum session:** 1 hour. The workflow asks for 15 minutes.
- **Inline policy.** Replace `<bucket>`; add the scene-set stills prefix once confirmed.

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
                 "s3:*Bucket*", "iam:*", "sts:AssumeRole", "ssm:*", "rds:*", "cognito-idp:*",
                 "secretsmanager:*", "kms:Encrypt*", "kms:Create*", "kms:Put*", "kms:Schedule*"],
      "Resource": "*" }
  ]
}
```

- **Only if the bucket uses KMS:** add `kms:Decrypt` on that key, with the condition `kms:ViaService = s3.<region>.amazonaws.com`.

There is no `ListBucket`. Each run's credentials are narrowed further by a session policy naming only the objects the database lookup returned.

### 2.4 The GitHub environment (in the private repository)

- **Name:** `prod-media-read`.
- **Required reviewers:** **you**. Every run waits for your approval.
- **Deployment branches:** `main` only.
- **Branch protection on `main`:** changes only by a pull request you merge.
- **Environment secret:** `AWS_MEDIA_READ_ROLE_ARN`.

### 2.5 Each time a task needs it

1. **You** write the authorization in the conversation (F-Tools-3 §2): the task, the exact assets, and M2.
2. The session posts the request's **hash** and a plain list of the assets, then starts the run. Under the fallback, **you** start it with the request id and hash.
3. **You approve the run in GitHub only if its hash matches** the one in the conversation.
4. The run:
   1. validates the request;
   2. looks up each asset in the database (the episode, the performer, not deleted, and the version);
   3. reads only those objects, with credentials narrowed to them;
   4. trims clips to the approved segment;
   5. encrypts every file to the session's one-time key;
   6. uploads one artifact with a 1-day retention.
5. The session downloads the artifact, decrypts it, checks the hashes, **deletes the artifact**, and destroys its key. A cleanup job removes any media-read artifact older than 6 hours.
6. **After your review,** the session deletes its local copies and shows that the folder is empty.

## 3. What never happens, under either method

- no writes, overwrites or deletes in S3;
- no database writes;
- no change to IAM, bucket policies, ACLs or flags;
- no deploy, migration or restart;
- no use of credentials found in the session;
- no AWS contact from the session at all (the runner reads; the session talks only to GitHub);
- no media or encrypted media committed to Git;
- no private link or credential in a log, report, commit or PR.

The guard hook blocks the commands. Its tests are `.claude/hooks/guard-dangerous-commands.test.js` and `tests/unit/guards/guardHook.productionReads.test.js`.
