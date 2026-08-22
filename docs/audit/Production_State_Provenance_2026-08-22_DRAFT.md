| **PRIME STUDIOS** **PROVENANCE INSTRUMENT** *What production runs, versus what the deployment record attests. Ships no code. Mints nothing.* |
| --- |

# Provenance of production state

**Date:** 2026-08-22
**Basis:** `origin/main` at `a5dfe467`, derived live.
**Status:** **DRAFT.** Ships no code. Changes no gate. **Mints nothing** — FD
tail **FD-69**, XK tail **XK-3**, PE tail **PE #67**. §9 states why minting is
proposed rather than taken.
**Environment contact — stated in full:** GitHub Actions API, AWS EC2/SSM/ELB
API, `git` against local objects, and two authorized read-only host probes
(SSM to development, SSH to production) performed 2026-08-22. **No endpoint was
exercised. Nothing was written to any host by this work.** Prod FROZEN.
**Inherits:** the deployment evidence preserved by FD-69's retirement (PR
#1102), which made that transfer a condition of the retirement standing.

---

# §1 The claim

**Production was modified by a process that failed. The modification was
invisible to every system that records deployments. It persisted eight weeks.**

The register's inability to describe production correctly is a *consequence* of
that, not the finding itself. **Every register statement about what production
runs has been a statement about the deployment record**, and on 2026-06-27 the
deployment record and the box stopped corresponding.

# §2 The mechanism, established

**A failed `deploy-dev.yml` run wrote frontend, nginx configuration and backend
code onto the host that is today's production instance.**

Run **`28289269164`**, conclusion **failure**, title *"Auto-merge
`claude/f-deploy-1-ag-gate-quiescence-finding-2026-06-27`"*.

| time (UTC) | event |
|---|---|
| 12:31:17 | run created |
| 12:33:15–12:34:23 | build job; **`Create artifact` 12:34:05–12:34:16** |
| — | **production `src/routes/auth.js` mtime is `12:34:06`** |
| 14:12:56 | deploy job connects by SSH; `pm2 stop` **all four** processes |
| 14:13:02 | *"Deploying frontend"*, *"Deploying nginx config"*, nginx reloaded |
| 14:13:05 | *"Deploying backend"* → *"Disk after backend deploy"* — **the write** |
| 14:13:05 | **fails** at *"Bootstrapping migration metadata"*, exit 1 |
| — | *Deployment summary* **skipped**; run recorded as **failure** |

**The file's mtime is its artifact-creation time, not its extraction time.**
`tar` preserves mtimes, so a file written to the box at 14:13 carries the
12:34:06 stamp from when the artifact was built. **That is the whole of the
apparent six-week discrepancy**, and it is why the date looked inexplicable.

**It failed after copying files, not before.** The step ordering in the log is
the discriminator and it is unambiguous.

**The processes it stopped were `episode-api`, `episode-api-parallel`,
`episode-api-prod-hotfix` and `episode-worker`** — including the production
process running today.

## §2.1 Why a development deploy reached the production host

**The development instance did not exist yet.** `i-016395bb5f7a51a0b`
(`episode-dev-backend`) was launched **2026-07-14**. `i-02ae7608c531db485`
(`episode-backend`, today's production) was launched **2026-03-22**.

On 2026-06-27 there was **one box**, and `deploy-dev.yml` deployed to it **over
SSH** — its steps are named *"Preflight — SSH reachability"* and *"Deploy to
EC2"*, with environment URL `https://dev.primepisodes.com`.

**This dates F-Deploy-1's shared-box history**, which records the development
API being retired from the shared box but not when: **dev and prod were still
colocated on 2026-06-27.**

**A second failed run the same day (`28289470503`, 12:40) has the identical
step pattern** — preflight success, *"Deploy to EC2"* failure — and very likely
wrote as well. Not separately confirmed.

# §3 What the mechanism explains

Four anomalies, one cause:

1. **The 2026-06-27 file date** — artifact build time, preserved by tar.
2. **The absent deployment record** — the run failed, so no success was
   recorded anywhere.
3. **Production running pre-`75ac05f0` code** — the artifact predates the
   2026-08-17 privilege fix.
4. **Production diverging from `main`** — it was never a deployment. **It was
   debris from a failed one.**

# §4 The deployment dimension, inherited

**FD-69's retirement transferred this here, and made the transfer a condition
of the retirement standing.**

Established 2026-08-22 by authorized read-only probes:

| | development | production |
|---|---|---|
| serving the unauthenticated-issuance defect | **yes** | **yes** |
| evidence | file present; process started 41.6 s after it | file present; process started 14.4 days after it |
| variant | as `main` | **worse than `main`** |

**Production ran a variant `main` does not have.** It took `groups` from the
request body, so an unauthenticated caller could mint an **ADMIN** token, and
**`requireGroup('ADMIN')` did not hold there.** FD-65's privilege half was
closed on `main` at `75ac05f0`; production never received it, for the reason at
§2.

**This is the concrete cost of the provenance gap.** A finding derived from
`main` understated production by an entire privilege tier, and nothing in the
register could have revealed that, because nothing in the register reads the
box.

# §5 What remains unexplained

**What restarted `episode-api-prod-hotfix` on 2026-07-11 21:20:04 is NOT
ESTABLISHED.**

The failed run stopped all four processes on 2026-06-27 and died before
restarting them. Something started that process two weeks later, and it loaded
the June code. **No deployment record covers it.**

**This is recorded as unexplained deliberately.** §2's account covers four
anomalies and is well evidenced, which is exactly the condition under which a
fifth gets quietly folded in. **It does not cover this one.**

# §6 What this reaches in the register

**Every statement of the form "production runs X" is a statement about the
deployment record.** That includes, and is not limited to:

- **v2.60's Dimension 2 PASS**, which reasoned from workflow state and the
  latest verified run;
- **F-Deploy-1's closure** and its deployed-state assertions;
- **FD-69 §4 as originally filed**, corrected on that document;
- any revision citing "the deployed SHA" or "the deployed artifact."

**None of these is withdrawn here, and none is asserted to be wrong.** Their
reasoning about the *record* stands. What is withdrawn is the inference from
the record to the box. **A revision that said "prod is at `8425c13e`" was
accurate about the last successful deployment and silent about what the box
contained.**

# §7 The forward requirement

**RULE: no register instrument may state what production runs on the basis of
the deployment record alone.**

A claim about the running state of a host requires **a read of that host**,
recorded with its method and basis. Acceptable evidence is a file or process
read of the kind performed at §4. **Workflow run history, `DEPLOY_SHA`, target-
group health, and last-successful-deploy metadata are evidence about the
record, and are not substitutes.**

Where a host read is unavailable or unauthorized, the instrument must say
**"not established"** and name what would establish it. **It must not fall back
to the record and report that as the state.**

# §8 The remedy already exists, and nobody recorded that it does

**F-Deploy-1's rewrite eliminated this hazard class.** Development now deploys
by **SSM RunCommand, targeted by instance tag, zero-inbound, with no host
secret on the path**, to **its own instance**. A failed development deploy can
no longer write to production, because it no longer addresses that host and no
longer uses a transport that could reach it by accident.

**But the rewrite was scoped and documented as a transport-security
improvement** — retiring `DEV_EC2_HOST`, removing an inbound path, satisfying
FD-57. **Nothing records that it also closed cross-environment write.**

**So the control is load-bearing for two reasons and documented for one.** A
future change to that path — reintroducing SSH for expedience, retargeting by
host, consolidating instances to save cost — would be evaluated against the
transport rationale alone, and would silently reopen this.

**That is the single most actionable line in this document**, and it costs an
amendment to F-Deploy-1 rather than any engineering.

**Production has not received the equivalent change.** `deploy-production.yml`
still reaches its host by SSH with `secrets.EC2_HOST`.

# §9 Minting — proposed, not taken

**This is a production-environment item and PE is its natural home**, which
would advance the PE tail **#67 → #68**.

**It is proposed rather than taken, for a specific reason: a tail was advanced
today for a duplicate.** FD-69 was minted 2026-08-22 for a defect FD-65 already
held, and retired at PR #1102 with the tail left spent. **Having made that
error once today, the author of this document is not the right party to take a
second minting decision unreviewed.**

The ruling party should decide whether this mints **PE #68**, amends
**F-Deploy-1** (which owns the deploy path and §8's undocumented coverage), or
both.

# §10 What this instrument does not do

- **Mints nothing** and advances no tail.
- Does not withdraw v2.60's Dimension 2 PASS, F-Deploy-1's closure, or any
  other revision (§6).
- Does not establish what restarted the production process on 2026-07-11 (§5).
- Does not confirm the second failed run of 2026-06-27 wrote (§2.1).
- Does not close FD-65's issuance half. The code is remediated on `main` and on
  the box; **recording the closure is a separate disposition**, and it should
  address whether disabling an endpoint closes an issuance finding or closes it
  **by removal, pending a real login**.
- Does not amend `deploy-production.yml` or propose a transport change.
- Does not contact any host, exercise any endpoint, or alter the freeze.

---

*Type: provenance instrument. Records a mechanism, states a forward rule,
proposes a disposition. Mints nothing. No endpoint exercised, nothing written
to any host. Prod FROZEN.*
