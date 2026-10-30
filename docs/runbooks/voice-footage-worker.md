# Runbook: the footage-only voice worker

The worker that prepares the voice of Lala's footage for Voice Studio (Voice plan V2, Evoni's approval of 2026-10-30). It takes jobs from the `voice_footage_jobs` table and, for each one, extracts the clip's sound into Voice Studio as an `extracted` source.

**Who does what.** Every step here that touches the box, `.env` or PM2 is Evoni's. Agent sessions never start, stop or restart it, and never edit `.env`.

**Status.** Stopped and switched off. Nothing happens until Evoni:
1. deploys the commit with migration `20261030120000-create-voice-footage-jobs.js` through the Deploy workflow;
2. sets `VOICE_FROM_FOOTAGE=on` in the server `.env`;
3. starts the worker (§2).

All three are separate approvals.

---

## 1. What it is, and what it is not

- **What it runs:** `src/workers/voiceFootageWorker.js`, in **its own PM2 process**, `episode-voice-worker`.
- **Not `episode-worker`.**
  - `episode-worker` (`src/workers/start.js`) runs scene generation and video export. It stays stopped, as Evoni chose; this runbook never starts it.
  - The voice worker loads none of its parts: no scene generation, no video export, no Bull/Redis queues, no Claude or other AI calls, no ElevenLabs.
  - `tests/unit/workers/voiceFootageWorker.isolation.test.js` checks this on every CI run.
- **Not in `ecosystem.config.js`.** `pm2 start ecosystem.config.js` never starts it, and no deploy starts it. It starts only when Evoni starts it by name.
- **One clip at a time.** Claiming is atomic and global, so even two copies of the worker never run two jobs at once.
- **Off means idle.** With `VOICE_FROM_FOOTAGE` or `VOICE_STUDIO` not `on`, it logs one line saying so and does nothing. It doesn't exit, so PM2 doesn't restart it in a loop.
- **It never changes or deletes** a clip, its original, its cut-out or an existing voice source. A clip already prepared keeps its source.

**What queues jobs** (the API, with `VOICE_FROM_FOOTAGE=on`):
- a new upload to the **Lala** lane;
- **Prepare Voice** on a Lala clip's card (admin). This is how existing footage, such as 4481.mp4, is prepared. Clips uploaded before V2 are never prepared by themselves.

**Jobs wait as "queued" while the worker is stopped.** Nothing is lost.

## 2. Starting it

On the box, in the app folder (`/home/ubuntu/episode-metadata`), **after** the migration has run and `VOICE_FROM_FOOTAGE=on` is in `.env`:

```bash
pm2 start src/workers/voiceFootageWorker.js --name episode-voice-worker --max-memory-restart 512M --time
pm2 logs episode-voice-worker --lines 20
```

The log should show `[voiceFootage] started as <host>:<pid>: one clip at a time …`. If it says `VOICE_FROM_FOOTAGE (or VOICE_STUDIO) is not on`, the flag isn't set; the worker is idle.

**Whether it survives a reboot** is Evoni's choice, and follows `DEVELOPMENT_WORKFLOW.md` §7.2:
- `pm2 save` records the processes running at that moment, so a reboot brings it back.
- Without `pm2 save`, it stays off after a reboot.

## 3. Watching it

- **Logs:** `pm2 logs episode-voice-worker`. Each job logs one line when it starts and one when it ends ("voice ready", or the failure in plain words).
- **Status:** `pm2 status` shows `episode-voice-worker` online or stopped.
- **On the Files page:** each Lala clip card shows its voice status to admins: queued, preparing, ready, or failed with the reason and **Prepare Voice**.
- **In the database** (read-only), the last jobs:

  ```sql
  SELECT created_at, raw_clip_id, status, attempt, error_code, error_message
    FROM voice_footage_jobs ORDER BY created_at DESC LIMIT 20;
  ```

## 4. Stopping it, and switching it off safely

**To stop it:**
```bash
pm2 stop episode-voice-worker
```
- It stops claiming at once.
- A clip it was preparing is recorded as **interrupted**. That counts as transient, so it is tried again after the worker is started again.
- Its temporary file is removed by the server's hourly temp clean-up.

**To switch voice-from-footage off:**
1. Stop the worker (above).
2. Set `VOICE_FROM_FOOTAGE` to anything but `on` in `.env`, and restart the API under §7.2.

Uploads then queue nothing. The Files page shows no voice line, and the Prepare Voice route answers 404. Existing jobs and sources stay as they are.

**To remove it from PM2:** `pm2 delete episode-voice-worker`, then `pm2 save` if you keep a saved list.

## 5. Deploys

- **The Deploy workflow restarts the voice worker only if it was running** before the deploy, so it runs the new code (Evoni, Issue #3650, 2026-10-30).
  - **A stopped or missing voice worker is left exactly as it was.** A deploy never starts it, and never starts `episode-worker` either.
  - **The run's summary** shows a "Voice worker" row: before → after.
- **If it isn't online after that restart,** the run stops with a plain message. The API is already restarted and healthy. Look at `pm2 logs episode-voice-worker`.

## 6. Failures and retries

| Kind | Examples | What happens |
|---|---|---|
| Transient | storage or network trouble, a database connection drop, the worker stopped mid-job, the sound not read to the end | Retried by itself as a new attempt: after 1 minute, then after 5 minutes. At most 3 attempts; then it waits for Prepare Voice. |
| Permanent | no sound in the clip, the original missing from storage, not enough disk, ffmpeg can't read the clip, more than an hour | Not retried. The card shows the reason; **Prepare Voice** queues a new attempt once the cause is fixed. |

- Every attempt is its own row; nothing is overwritten.
- A job that stays `running` with no heartbeat for 2 minutes (the box restarted, or the process was killed) is marked interrupted the next time the worker looks, then retried as above.
