# Evidence note: dev.primepisodes.com stale A record (post-F-Deploy-1)

**Filed:** 2026-07-22, same session as Fix Plan v1.48 (keystone close,
942d3b95, #947). **Mints no FD** per numbering discipline (FD numbers
mint only in Fix Plan revisions). **Disposition OWED at the next
register revision touching this surface.**

## Finding

Live DNS resolution (Resolve-DnsName, 2026-07-22, ~12:35Z, TTL 300):

    dev.primepisodes.com  A  54.163.229.144

That is the shared prod box (i-02ae7608c531db485, `episode-backend`).
The s4.5.2 retirement (v1.48 s1) removed the dev api from that box at
11:58:57Z. The record now points at a host with no listener on the dev
port.

## Timeline implication (burn-in scope clarification)

s4.3 (2026-07-14) retargeted DEPLOYS to `episode-dev-backend` by
instance tag. The DNS name was never repointed. The shared box's dev
api remained running until 2026-07-22. Therefore, for the full burn-in
window, any access to dev via `dev.primepisodes.com` was served by the
SHARED box, not the new instance. The burn-in's "no targeting drift"
criterion (s7.3) covered deploy targeting and was truthfully satisfied;
it made no claim about DNS. Burn-in evidence (SSM localhost:3002 checks
on the new box) is unaffected and stands. No prior register claim is
falsified; the DNS surface was simply outside every gate.

## Containment

- Prod domains (primepisodes.com, www, api, staging) ride the ALB per
  the Route 53 zone; unaffected. Prod health verified 200 post-write
  (v1.48 s1/s2).
- The keystone close STANDS. FD-28 owned PM2 app definitions on the
  shared box, not DNS. This is a new adjacent finding, not a reopen.
- Minor positive: the shared box's SG exposes 3002 internet-wide
  (F-Deploy-G1-AE); with the dev api retired, nothing listens there.

## Disposition options (for the gated decision, not taken here)

1. Repoint the A record to the dev box (EIP 54.87.253.45), restoring
   dev-by-DNS against the new instance. Requires confirming the new
   box's serving path (direct :3002 vs proxy) and AE-style exposure
   posture before opening a DNS-fronted door.
2. Retire the record (delete), making dev access deliberately
   non-DNS (SSM/tag-targeted only), consistent with the workflow's
   no-host-secret, tag-targeted posture.
3. Defer with the record left dark (current de facto state) -- carries
   a confusion hazard (name resolves, nothing answers) but no exposure.

Any of these is a Route 53 write: Rule 7, its own gated window.

## Evidence

- Stale local export `route53-primepisodes.json` (archived to the
  session archive; corrupted by markdown round-trip, zero authority --
  it prompted the live check, nothing more).
- Live Resolve-DnsName output, this session.
- v1.48 s1 execution record (retirement timestamps).

---

*Filed by Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Forward pointer: disposition at next register revision. [skip-automerge]*
