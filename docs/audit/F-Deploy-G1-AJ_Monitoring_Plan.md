# F-Deploy-G1-AJ -- Production Uptime Monitoring (DRAFT v0.1)

> **PREP DOCUMENT.** Reading/drafting this changes nothing. The implementation
> (Sec 5) is a small, additive AWS write (a CloudWatch alarm + SNS topic) -- it does
> NOT touch the running app or any database -- but it is gated (Rule 7) as a real
> shared-state change to AWS config.

| | |
|---|---|
| **Finding** | F-Deploy-G1-AJ (P1) -- no production uptime alerting |
| **Origin** | 2026-06-01 prod-502 incident: prod was hard-down for a multi-day window and NO alert fired; caught only by a manual check (`F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md` Sec 4) |
| **Related** | Track B (target-group port mismatch, Sec 3 finding here); F-Deploy-G1-AF (open RDS SGs); the existing billing-alarm pattern |
| **Status** | DRAFT v0.1 -- prep only. Recommends ELB 5xx alarm -> dedicated SNS topic. Implementation gated. |

---

## Sec 1 -- The gap (confirmed read-only 2026-06-01)

CloudWatch in us-east-1 has **three alarms, all billing** (`EstimatedCharges` at
$100/$300/$500), each wired to SNS `episode-metadata-billing-alerts`. **Zero alarms
watch application availability.** Cost was monitored; uptime was not. That is exactly
why a multi-day prod 502 went unnoticed.

The SNS infrastructure works: `episode-metadata-billing-alerts` is an existing topic
the billing alarms route to (presumably subscribed to a real inbox). So adding an
availability alarm -> SNS is a known, working pattern here -- the gap is that no such
alarm was ever created, not that the plumbing is missing.

## Sec 2 -- What "monitor prod" should mean here

The goal: if primepisodes.com starts returning errors to users (502/503/5xx) or goes
unreachable, someone is alerted within minutes -- not days, not by luck.

Three candidate signals, in increasing robustness:

1. **Target health** (`HealthyHostCount` / `UnHealthyHostCount` on the target group)
   -- "is the backend target passing its health check." Simple. BUT see Sec 3: the
   target group health-checks the WRONG PORT right now, so this signal is unreliable
   until Track B fixes it. **Not the primary alarm yet.**
2. **ELB 5xx rate** (`HTTPCode_ELB_5XX_Count` and/or `HTTPCode_Target_5XX_Count` on
   the load balancer) -- "is prod returning server errors to users." Symptom-level,
   independent of which port/target, **would have fired during the 2026-06-01
   incident.** RECOMMENDED PRIMARY.
3. **External synthetic check** (a canary hitting `https://primepisodes.com/health`
   on an interval) -- catches everything including DNS/cert/ELB-level failure,
   fully independent of AWS-internal metrics. Most robust; slightly more setup.
   RECOMMENDED FOLLOW-ON.

## Sec 3 -- Finding handed to Track B: target-group port mismatch

The ELB target group `primepisodes-backend` health-checks **port 3002** path
`/health`. But prod nginx proxies primepisodes.com -> **localhost:3000**. So the
target group's health signal is tied to 3002 (currently the dev-named app), NOT to
where prod actually serves (3000). Consequences:
- A target-health alarm (Sec 2 option 1) would watch the wrong port -- it would NOT
  have caught the actual prod outage (3000 down, 3002 fine).
- The TG -> target port wiring is part of the same topology mess Track B addresses.

**Action: this TG-port correction is handed to Track B** (alongside the PM2 topology
fix). It is NOT AJ's to fix. AJ's primary alarm (ELB 5xx, option 2) is deliberately
chosen to be independent of this mismatch, so monitoring works NOW without waiting
for Track B. Once Track B corrects the TG port, the target-health alarm (option 1)
can be added as a second layer.

## Sec 4 -- Recommendation

**Primary (do now):** a CloudWatch alarm on the load balancer's 5xx count, routed to
a dedicated SNS topic.
- Metric: `HTTPCode_ELB_5XX_Count` (ELB-generated 5xx, e.g. 502 when no healthy
  target) -- and consider a second on `HTTPCode_Target_5XX_Count` (app-generated
  5xx, e.g. the 503 the hotfix threw before creds were fixed). The ELB_5XX one is the
  must-have; it catches the "nothing healthy behind the LB" case directly.
- Threshold: > 0 (or a small N) over a short period (e.g. >= 5 in 5 minutes, to avoid
  flapping on a single blip) -- tune after observing baseline.
- Action: publish to a NEW dedicated SNS topic `episode-metadata-availability-alerts`
  (rationale below), subscribed to the same inbox/phone as billing (or a more urgent
  channel).

**SNS routing decision: dedicated topic** (`episode-metadata-availability-alerts`),
not reuse of `episode-metadata-billing-alerts`. Availability ("prod is DOWN") is
operationally distinct from cost and should stand out, not get filtered with billing
noise. A dedicated topic is a tiny addition and lets availability route more urgently
later (SMS, PagerDuty, etc.) without touching billing.

**Follow-on (after Track B):**
- Add the target-health alarm (option 1) once the TG points at the correct prod port.
- Consider an external synthetic canary (option 3) for DNS/cert/ELB-level coverage
  the AWS-internal metrics can't see.

## Sec 5 -- Implementation (GATED -- additive AWS write)

Does NOT touch the app, the box, or any DB. Creates an SNS topic + subscription +
one (or two) CloudWatch alarm(s). Reversible (delete the alarm/topic). Each AWS write
is a Rule 7 step; drafted here, run on confirm.

1. **Create the dedicated SNS topic.**
   `aws sns create-topic --region us-east-1 --name episode-metadata-availability-alerts`
2. **Subscribe an endpoint** (email to start; confirm via the subscription email).
   `aws sns subscribe --region us-east-1 --topic-arn <new-arn> --protocol email --notification-endpoint <you@domain>`
3. **Identify the load balancer dimension** (read-only):
   `aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[].{name:LoadBalancerName,arn:LoadBalancerArn}"`
   -- need the `LoadBalancer` dimension value (the `app/<name>/<id>` suffix) for the alarm.
4. **Create the ELB 5xx alarm**, action = the new SNS topic. (Exact `put-metric-alarm`
   drafted at implementation time once the LB dimension is known.)
5. **Test** by confirming the alarm transitions on a real or simulated 5xx (or trust
   the metric math + verify the SNS subscription delivers a test publish).

## Sec 6 -- What this does NOT do

- Does NOT fix the target-group port mismatch (Track B, Sec 3).
- Does NOT touch the app, the PM2 processes, the box, or any database.
- Does NOT modify the existing billing alarms or their SNS topic.
- Does NOT add the synthetic canary or target-health alarm yet (follow-ons, Sec 4).

---
*F-Deploy-G1-AJ monitoring plan. Confirmed read-only that only billing alarms exist
and nothing watches availability -- the gap that hid the 2026-06-01 prod outage.
Recommends an ELB 5xx alarm -> dedicated SNS availability topic (independent of the
target-group port mismatch, which is handed to Track B). Implementation is a small
gated additive AWS write; touches no app or data.*
