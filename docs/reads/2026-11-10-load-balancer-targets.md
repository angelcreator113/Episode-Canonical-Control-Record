# Load balancer target groups and the unhealthy `primepisodes-frontend` (read, 2026-11-10)

**Status:** read only. Nothing was changed. Task #3785. Measured 2026-11-10, 21:26 to 21:28 UTC, from a laptop session (`aws elbv2`, `aws ec2`, `aws route53`, `curl`) and over SSM on the prod box (`episode-backend`). `origin/main` was `91fbf6533`.

> **Later the same day (2026-11-10).** Evoni applied the whole recommendation, and stopped the `episode-frontend` instance. Verified 21:45 UTC:
>
> - **Port 80 listener:** no rules; the default action is a 301 redirect to HTTPS. Plain HTTP `/`, `/login`, `/api/`, `/api/v1/assets`, `/assets/*`, `/health` and `/diagnostics` each returned 301 to the same path on `https://`, three requests out of three. `www`, `api` and `staging.primepisodes.com` redirect the same way.
> - **HTTPS listener:** unchanged. `/`, `/health`, `/api/v1/assets`, `/login` and `/diagnostics` returned 200.
> - **Target groups:** `primepisodes-frontend` no longer exists. `primepisodes-backend` is the only group, and its one target (the app on port 3000) is healthy.
> - **`episode-frontend`** (`i-0005b67a477eb904f`): stopped, "User initiated (2026-11-10 21:44:40 GMT)". Its port 80 no longer answers.
>
> The steps were applied in two parts: at 21:38 UTC the redirect and the `/assets/*` rule, then the three remaining rules and the target group. Everything below describes the state at 21:26 UTC, before any of it. At 22:02 UTC she also removed the prod box security group's inbound rules for 80 and 443: the box now accepts only 3000 from the load balancer's security group and 22 from her address, and 80, 443 and 3000 do not connect from outside. Section 6's other notes still stand, except those about `episode-frontend` serving on port 80 and about the prod box's ports 80 and 443 being open.

## Answer first

- **Can traffic reach `primepisodes-frontend` today? Yes.** Every plain `http://` request to the load balancer that is not exactly `/health`, `/api/` or `/diagnostics` is forwarded to it. That includes `http://primepisodes.com/`, `http://primepisodes.com/login` and `http://primepisodes.com/api/v1/...`.
- **Both of its targets are unhealthy, and it still gets the traffic.** A target group whose targets are all unhealthy is not skipped: the load balancer sends requests to all of them ("fail open").
- **What a visitor on plain HTTP sees:** a coin toss. One target (the prod box's nginx) answers with a frontend build from 27 September 2026. The other (the `episode-frontend` instance) answers 404. Nothing redirects HTTP to HTTPS.
- **HTTPS is not affected.** Every HTTPS rule and the HTTPS default forward to `primepisodes-backend`, whose one target (the app on port 3000) is healthy.
- **Recommendation:** make the port 80 listener redirect to HTTPS, then remove the port 80 rules and the target group. Commands, undo and checks are in "Recommendation".

## 1. What exists

One load balancer: `primepisodes-alb`, application, internet-facing, active, three zones (us-east-1a, 1b, 1d). `primepisodes.com`, `www`, `api` and `staging.primepisodes.com` are Route 53 aliases to it.

### Listeners and rules

**HTTPS 443** (one ACM certificate, policy `ELBSecurityPolicy-TLS-1-2-2017-01`)

| Priority | Condition (path) | Action |
|---|---|---|
| 1 | `/assets/*` | forward to `primepisodes-backend` |
| 2 | `/api/*` | forward to `primepisodes-backend` |
| 3 | `/health` | forward to `primepisodes-backend` |
| 4 | `/diagnostics` | forward to `primepisodes-backend` |
| default | (everything else) | forward to `primepisodes-backend` |

**HTTP 80**

| Priority | Condition (path) | Action |
|---|---|---|
| 1 | `/health` | forward to `primepisodes-backend` |
| 2 | `/api/` (that exact path, no wildcard) | forward to `primepisodes-backend` |
| 3 | `/diagnostics` | forward to `primepisodes-backend` |
| 4 | `/assets/*` | forward to **`primepisodes-frontend`** |
| default | (everything else) | forward to **`primepisodes-frontend`** |

No rule has a host condition, a redirect or a fixed response.

### Target groups and targets

| Target group | Port | Health check | Target | Health |
|---|---|---|---|---|
| `primepisodes-backend` | HTTP 3002 (the target is registered on 3000) | `GET /health` on the traffic port, every 30 s, 200 expected, 2 to pass, 3 to fail | `i-02ae7608c531db485` (`episode-backend`, the prod box) port 3000 | healthy |
| `primepisodes-frontend` | HTTP 80 | `GET /` on the traffic port, every 30 s, 200 expected, 5 to pass, 2 to fail | `i-02ae7608c531db485` (`episode-backend`) port 80 | unhealthy, `Target.ResponseCodeMismatch`, "Health checks failed with these codes: [404]" |
| | | | `i-0005b67a477eb904f` (`episode-frontend`) port 80 | unhealthy, same reason |

Both groups have `target_group_health.unhealthy_state_routing.minimum_healthy_targets.count = 1`, percentage off, stickiness off, and a 300 s deregistration delay.

## 2. Which rules can send traffic to `primepisodes-frontend`

Two, both on the HTTP 80 listener: rule 4 (`/assets/*`) and the default action. Nothing on the HTTPS listener can.

So on plain HTTP:

| Request | Goes to |
|---|---|
| `/health`, `/diagnostics`, and the exact path `/api/` | `primepisodes-backend` (the app) |
| `/assets/...` | `primepisodes-frontend` |
| everything else, including `/`, `/login` and `/api/v1/...` | `primepisodes-frontend` |

Rule 2 is the reason `/api/v1/...` falls through: its pattern is `/api/`, not `/api/*`.

## 3. Why the targets are unhealthy, and why they still serve

The health check sends `GET /` to each target's port 80 using the target's address as the host name.

- **Prod box.** Its nginx has two sites: `default-404`, the port 80 catch-all that answers 404 to any host name that is not a site on the box, and `episode-prod`, which answers for `primepisodes.com` and `www.primepisodes.com` from `/var/www/html` and proxies `/api` and `/health` to the app on port 3000. The health check's host name matches neither site name, so the catch-all answers 404. The nginx access log shows it: 109 `ELB-HealthChecker` requests in the hour, all `GET / 404`.
- **`episode-frontend` instance.** It answers 404 on port 80 whatever the host name (`curl` from outside: 404 with `Host: primepisodes.com`, 404 without). It is not registered with SSM, so what runs on it was not read.

The catch-all was the second server block of the prod box's old nginx file `episode` until 2026-11-10, when that file's dev site was retired and the catch-all was kept as `default-404` (`docs/runbooks/dev-environment.md`, "The prod box's old dev site"). The 404 to the health check is the same before and after.

**Unhealthy does not mean unused.** With every target in the group unhealthy, the load balancer routes to all of them. Eight plain HTTP requests to `/` through the load balancer, 21:27 UTC:

```
200 1282b Server: nginx/1.18.0 (Ubuntu) | assets/index-DTWwk6K3.js
200 1282b Server: nginx/1.18.0 (Ubuntu) | assets/index-DTWwk6K3.js
404 162b Server: nginx/1.18.0 (Ubuntu) |
200 1282b Server: nginx/1.18.0 (Ubuntu) | assets/index-DTWwk6K3.js
404 162b Server: nginx/1.18.0 (Ubuntu) |
404 162b Server: nginx/1.18.0 (Ubuntu) |
200 1282b Server: nginx/1.18.0 (Ubuntu) | assets/index-DTWwk6K3.js
200 1282b Server: nginx/1.18.0 (Ubuntu) | assets/index-DTWwk6K3.js
```

- The 200s are the prod box: a real request carries `Host: primepisodes.com`, which `episode-prod` answers. `index-DTWwk6K3.js` is the build in `/var/www/html`, whose files are dated 2026-09-27.
- The 404s are the `episode-frontend` instance.
- Over HTTPS the same page names `index-BcrdyrBP.js`, the current build in the app's `frontend/dist`.

Other plain HTTP paths, three requests each:

```
/health: 200 200 200
/api/v1/assets: 404 404 200
/api/: 404 404 404
/assets/nope.js: 404 404 404
/diagnostics: 200 200 200
/login: 404 404 200
```

`/api/v1/assets` returning 200 one time in three is the prod box's nginx proxying to the production app: the API answers over plain HTTP when the request lands on that target.

**Who is exposed.** HTTPS responses carry `Strict-Transport-Security: max-age=31536000; includeSubDomains`, so a browser that has already visited over HTTPS goes straight to HTTPS. A first visit that starts on `http://`, a link written with `http://`, and non-browser clients get the behaviour above. A login made from the stale page would send the password over plain HTTP. No such login was looked for or seen in this read.

## 4. Risks

- **Today:** first-time and plain-HTTP visitors get a build from September or a 404, at random, and the API is reachable without TLS through the prod box's nginx.
- **If one target turns healthy:** the load balancer then sends all `primepisodes-frontend` traffic to that target only.
  - The prod box turns healthy if its nginx answers `GET /` with 200 to a request with no matching host name: for example if `default-404` is removed or `episode-prod` becomes the default server. Plain HTTP visitors would then always get the September build, with a working API behind it.
  - The `episode-frontend` instance turns healthy if anything there starts answering `GET /` with 200. Plain HTTP visitors would then always get whatever that instance serves. Its security group allows 22, 80 and 443 from anywhere.
- **Not at risk from this group:** HTTPS traffic. No HTTPS rule points at it.

## 5. Recommendation

**Recommendation (Evoni decides; nothing here was run):** redirect port 80 to HTTPS, then remove the port 80 rules and the `primepisodes-frontend` target group. Leaving it keeps the stale page and the plain-HTTP API reachable. Only deregistering the targets would turn every plain HTTP request into a 503.

The three steps are separate. Step 1 alone fixes what visitors see; steps 2 and 3 are cleanup.

```bash
LB=$(aws elbv2 describe-load-balancers --names primepisodes-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
L80=$(aws elbv2 describe-listeners --load-balancer-arn "$LB" --query 'Listeners[?Port==`80`].ListenerArn' --output text)
TGF=$(aws elbv2 describe-target-groups --names primepisodes-frontend --query 'TargetGroups[0].TargetGroupArn' --output text)
TGB=$(aws elbv2 describe-target-groups --names primepisodes-backend --query 'TargetGroups[0].TargetGroupArn' --output text)

# Keep the current state for the undo. These files hold ARNs: keep them out of the repository.
aws elbv2 describe-listeners --listener-arns "$L80" > lb-80-listener-before.json
aws elbv2 describe-rules --listener-arn "$L80" > lb-80-rules-before.json
aws elbv2 describe-target-groups --target-group-arns "$TGF" > lb-frontend-tg-before.json
aws elbv2 describe-target-health --target-group-arn "$TGF" > lb-frontend-targets-before.json

# Step 1: every plain HTTP request that matches no rule is redirected to HTTPS.
aws elbv2 modify-listener --listener-arn "$L80" \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'

# Step 2: remove the four port 80 rules, so /health, /api/, /diagnostics and /assets/* redirect too.
for R in $(aws elbv2 describe-rules --listener-arn "$L80" --query 'Rules[?IsDefault==`false`].RuleArn' --output text); do
  aws elbv2 delete-rule --rule-arn "$R"
done

# Step 3: the target group is now referenced by nothing. Deleting it deregisters both targets.
aws elbv2 delete-target-group --target-group-arn "$TGF"
```

**Undo**

```bash
# Step 1
aws elbv2 modify-listener --listener-arn "$L80" --default-actions Type=forward,TargetGroupArn="$TGF"

# Step 2 (the four rules as they were)
aws elbv2 create-rule --listener-arn "$L80" --priority 1 --conditions Field=path-pattern,Values=/health --actions Type=forward,TargetGroupArn="$TGB"
aws elbv2 create-rule --listener-arn "$L80" --priority 2 --conditions Field=path-pattern,Values=/api/ --actions Type=forward,TargetGroupArn="$TGB"
aws elbv2 create-rule --listener-arn "$L80" --priority 3 --conditions Field=path-pattern,Values=/diagnostics --actions Type=forward,TargetGroupArn="$TGB"
aws elbv2 create-rule --listener-arn "$L80" --priority 4 --conditions 'Field=path-pattern,Values=/assets/*' --actions Type=forward,TargetGroupArn="$TGF"

# Step 3 (a deleted target group comes back with a new ARN; undo steps 1 and 2 with it)
VPC=$(aws elbv2 describe-load-balancers --names primepisodes-alb --query 'LoadBalancers[0].VpcId' --output text)
TGF=$(aws elbv2 create-target-group --name primepisodes-frontend --protocol HTTP --port 80 --vpc-id "$VPC" \
  --health-check-path / --health-check-interval-seconds 30 --health-check-timeout-seconds 5 \
  --healthy-threshold-count 5 --unhealthy-threshold-count 2 --matcher HttpCode=200 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 register-targets --target-group-arn "$TGF" --targets Id=i-02ae7608c531db485,Port=80 Id=i-0005b67a477eb904f,Port=80
```

**Verify after each step**

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://primepisodes.com/          # 301 https://primepisodes.com:443/
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://primepisodes.com/api/v1/assets   # 301 after step 1
curl -s -o /dev/null -w '%{http_code}\n' https://primepisodes.com/health                  # 200, unchanged
curl -s -o /dev/null -w '%{http_code}\n' https://primepisodes.com/                        # 200, unchanged
aws elbv2 describe-target-health --target-group-arn "$TGB" --query 'TargetHealthDescriptions[].TargetHealth.State' --output text   # healthy
aws elbv2 describe-target-groups --query 'TargetGroups[].TargetGroupName' --output text   # after step 3: primepisodes-backend only
```

**Before step 2, check one thing:** whether anything outside the browser calls `http://primepisodes.com/health` or `/diagnostics` and cannot follow a redirect (an uptime monitor, for example). The load balancer's own health check does not go through the listener and is not affected. This read found no such caller, and did not search for one outside the repository.

## 6. Other things noticed (not fixed)

- **Port 80 has no redirect to HTTPS.** This is the cause of everything in section 3.
- **The `episode-frontend` instance** (`i-0005b67a477eb904f`, t3.micro, launched 2026-01-13) is running, serves 404 on port 80, is not managed by SSM, and its security group allows SSH (22) from anywhere. Its only role found in this read is as an unhealthy target. Its address is still in `allowedOrigins` in `src/app.js`.
- **The prod box's security group allows 80 and 443 from anywhere**, so its nginx can be reached directly, without the load balancer. After 2026-11-10 nothing on the box listens on 443. Port 3000 is allowed from the load balancer's security group only.
- **`/var/www/html` on the prod box holds a build from 2026-09-27.** `episode-prod` serves it to anyone who reaches the box's port 80 with `Host: primepisodes.com`. Production's real frontend is `frontend/dist`, served by the app.
- **`primepisodes-backend` is defined with port 3002** while its only target is registered on 3000. It works because a target's registered port overrides the group's. The number is misleading, not wrong.
- **The HTTPS rules 1 to 4 are redundant**: they forward to the same group as the default.
- **The load balancer's security group** has inbound rules for 5432 (one from a single address, one from another security group) and an all-traffic rule from another security group. A load balancer has no use for 5432.
- **Load balancer attributes:** access logs are off, so there is no record of who used port 80; deletion protection is off; `drop_invalid_header_fields` is off.
- **TLS policy** `ELBSecurityPolicy-TLS-1-2-2017-01` is an old default.
- **`staging.primepisodes.com` and `api.primepisodes.com`** point at this same load balancer and get the same routing as production; there is no host-based rule.

## Evidence (commands run, all read-only)

```
aws elbv2 describe-load-balancers
aws elbv2 describe-listeners --load-balancer-arn <primepisodes-alb>
aws elbv2 describe-rules --listener-arn <each listener>
aws elbv2 describe-target-groups
aws elbv2 describe-target-health --target-group-arn <each group>
aws elbv2 describe-target-group-attributes --target-group-arn <each group>
aws elbv2 describe-load-balancer-attributes --load-balancer-arn <primepisodes-alb>
aws ec2 describe-instances --instance-ids i-02ae7608c531db485 i-0005b67a477eb904f
aws ec2 describe-security-group-rules   (load balancer, prod box, frontend instance)
aws route53 list-resource-record-sets   (alias records)
curl http://primepisodes.com/...  and  https://primepisodes.com/   (GET only)
curl http://<episode-frontend address>/   (GET only)
on the prod box over SSM: ls /etc/nginx/sites-enabled, cat of both site files, /var/www/html listing, nginx access log counts
```

Target health as returned:

```
primepisodes-backend
i-02ae7608c531db485  3000  healthy
primepisodes-frontend
i-0005b67a477eb904f  80  unhealthy  Target.ResponseCodeMismatch  Health checks failed with these codes: [404]
i-02ae7608c531db485  80  unhealthy  Target.ResponseCodeMismatch  Health checks failed with these codes: [404]
```

The prod box's nginx access log for the hour, by caller and status:

```
109 ELB-HealthChecker 404
 10 other 200
 11 other 404
```

**Not read:** what runs on the `episode-frontend` instance; who has used plain HTTP (no access logs exist); the load balancer's own metrics.
