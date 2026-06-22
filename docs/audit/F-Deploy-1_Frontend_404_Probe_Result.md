# F-Deploy-1 — Frontend `:80` 404 Probe + Topology Inventory Finding

**Authored:** 2026-06-21
**Status:** Read-only probe COMPLETE. No box mutations. No fix attempted. Cause identified to exact config lines.
**Relationship:** Companion to `F-Deploy-1_Box_Repo_Reconciliation_Session2_Result.md` (§3.2 carry-forward — the `primepisodes-frontend` TG all-unhealthy 404). This doc resolves that carry-forward's *cause* and adds a topology-inventory finding. Mints no FD.
**Re-verify note:** Live SHAs/IPs/instance state are point-in-time. Re-derive via wake-up trio / `aws describe` before acting.

---

## §1 — What prompted this

Session-2 §3.2 recorded the ALB `primepisodes-frontend` target group as all-unhealthy: both registered targets returning `Target.ResponseCodeMismatch` 404 on the `:80` health check. Two unknowns blocked classification: (a) the identity of a second instance `i-0005b67a477eb904f` that appeared in the TG but was absent from all prior handoff/topology models, and (b) whether the 404 was a cosmetic health-check-path mismatch or a real frontend-serving gap.

Both are now resolved. The probe was fully read-only (AWS `describe` + box `ss`/`curl`/`nginx -T`/`ls`); nothing was restarted, reloaded, or edited.

---

## §2 — Topology inventory finding (NEW — the audit's infra model was incomplete)

`aws ec2 describe-instances` on `i-0005b67a477eb904f` returns a **dedicated, long-lived frontend instance not present in any prior handoff**:

| Field | Value |
|---|---|
| Name tag | `episode-frontend` |
| Instance | `i-0005b67a477eb904f`, `t3.micro` |
| State | running |
| Public IP | `52.91.217.230` |
| Private IP | `172.31.18.65` |
| Launched | 2026-01-13 |
| Last interactive login | 2026-01-15 (untouched since January) |
| Pending | `*** System restart required ***` |

On-box (`sudo ss -tlnp`): **nginx** on `:80` + `:443` (nginx/1.18.0), plus a **PM2 process on `:3002`** (pid 107514). So this is not a static-only frontend box — it has its own node app process. It also holds a Let's Encrypt cert for `dev.primepisodes.com` and a **deployed SPA** in `/var/www/html` (`index.html` 1235 b + `assets/`, dated 2026-03-10).

**Confirmed live infrastructure is now at least four EC2 instances:**

| Role | Instance | Address |
|---|---|---|
| prod (canon API) | `i-02ae7608c531db485` | `54.163.229.144` |
| dev | `i-016395bb5f7a51a0b` | `98.93.190.74` (per memory; not inspected this session) |
| **frontend (NEW)** | `i-0005b67a477eb904f` | `52.91.217.230` |
| ALB | — | `primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com` |

This instance was outside the audit's attention entirely. Inventory-completeness finding independent of the 404.

---

## §3 — The 404 cause (pinned to exact config lines; NOT missing artifacts)

The SPA is present and correctly configured on `:443`. The 404 is a **`:80` server-block logic issue**, not absent files.

`/var/www/html` contents (read-only `ls -la`): `index.html` (1235 b), `assets/`, plus a leftover `index.nginx-debian.html`. The app *is* deployed.

`/etc/nginx/sites-enabled/primepisodes` has **two server blocks, both `server_name dev.primepisodes.com`** (both Certbot-managed):

- **Block 1 — `:443` SSL.** Real serving: `location / { root /var/www/html; try_files $uri $uri/ /index.html; }` plus `location /api/ { proxy_pass http://127.0.0.1:3002; }`. This serves HTTPS for `dev.primepisodes.com` correctly.
- **Block 2 — `:80 default_server`.** Certbot redirect shim: `if ($host = dev.primepisodes.com) { return 301 https://... }` then **`return 404;`**.

**Mechanism:** the ALB health check hits this box on `:80` **by IP**, so the request `Host` is the instance IP, not `dev.primepisodes.com`. The `if ($host = dev.primepisodes.com)` redirect does not match → the request falls through to the Certbot **`return 404`**. The SPA root in Block 1 is never consulted on `:80`. Reproduced firsthand on-box: `curl -sS -i http://localhost/` → `HTTP/1.1 404 Not Found`, `Server: nginx/1.18.0`, `Content-Length: 162` (nginx default 404 body).

**This is structural, not transient.** The ALB `primepisodes-frontend` TG health check (path `/`, `:80`, expect `200`) checks a path that a Certbot redirect-shim `:80` block cannot return 200 for. The same mechanism explains why the **prod box `i-02ae...` `:80`** is *also* unhealthy in this TG — its `:80` almost certainly carries the equivalent Certbot redirect/`return 404`.

Contrast (healthy case): the `primepisodes-backend` TG checks `/health` on `:3000`, which `episode-api` serves 200 → healthy. The backend path is wired to a real endpoint; the frontend path is not.

---

## §4 — Topology question raised (NEW thread — do NOT act on without investigation)

Two different boxes are both nginx-configured for `dev.primepisodes.com`:
- `episode-frontend` (`i-0005b...`, this box) — full nginx + cert + SPA + PM2:3002 for `dev.primepisodes.com`.
- prod box (`i-02ae...`) — also serves a `dev.primepisodes.com` vhost (→ `localhost:3002`), per Session-2 §3.

But `nslookup dev.primepisodes.com` → **`54.163.229.144`** (the **prod** box EIP), NOT `52.91.217.230` (this frontend box). So DNS for `dev.primepisodes.com` points only at the prod box. The `episode-frontend` box may be a **superseded / orphaned** dev frontend — still running, still registered in the ALB frontend TG, last meaningfully touched in January, no DNS pointing at it.

Open questions (deliberate investigation, its own session — possible teardown candidate, but verify first):
1. What, if anything, currently routes to `episode-frontend`? (ALB frontend TG is the only known referrer, and that TG is all-404.)
2. Is its PM2:3002 process doing anything live, or idle?
3. Is it safe to deregister/stop/teardown, or does something still depend on it?

Do not stop, deregister, or teardown this box without resolving the above. It is running and was reachable; treat as live until proven orphaned.

---

## §5 — Disposition / remediation (NOT this session)

The 404 fix is a **write on an untracked box and/or the ALB** — deferred, its own deliberate session:
- Option A: add an explicit `:80` `location = /health { return 200; }` (or `/`) to the boxes and point the frontend TG health check at it.
- Option B: change the frontend TG health-check matcher to accept the redirect (e.g. `200,301`) or a real path.
- Option C: if `episode-frontend` is confirmed orphaned (§4), deregister it from the TG entirely and resolve the prod-box `:80` membership separately.

Which option depends on the §4 topology resolution — do not fix the 404 before knowing whether the frontend box should even be in the TG.

**Severity context:** the primary prod path (`primepisodes.com` → ALB :443 → prod box :3000 → `episode-api`) is HEALTHY and unaffected. This 404 is on a secondary `:80`/frontend-TG surface. Not a live outage.

---

## §6 — Carry-forward added by this probe

1. **`episode-frontend` box inventory** (§2) — fold into the canonical infra model; the audit was tracking 2–3 boxes, reality is ≥4.
2. **Frontend `:80` 404 cause** (§3) — Certbot `return 404` shim vs IP-based ALB HC; structural; present on both TG members.
3. **`dev.primepisodes.com` dual-configuration / orphan question** (§4) — needs its own investigation before any teardown.
4. **`episode-frontend` pending OS restart** since January (§2) — hygiene, not ours to action.

---

*— End probe. Read-only throughout. No fix attempted on the `episode-frontend` box. Re-verify live state before any remediation.*
