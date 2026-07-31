> ===== TERMINAL SUPERSEDE / SAFETY STOP (prepended 2026-07-31) =====
> THIS DOCUMENT IS VOID FOR EXECUTION. STOP READING FOR ACTION.
>
> The [3] window is not open. Fix Plan v1.20 (2026-07-06) recorded the
> id-3/[3] restart-to-align thread COMPLETE and closed FD-31 and FD-38.
> Fix Plan v1.48 (2026-07-22) closed Phase B and the F-Deploy-1 KEYSTONE.
>
> DO NOT prime a session from this document.
> DO NOT run any [3] step, gate, probe, capture, or verification below.
> DO NOT mint a Fix Plan revision or advance the FD register from this track.
>
> FREEZE NOTICE: FD-31 being CLOSED does NOT lift the prod freeze. v1.20
> states freeze posture for prod actions outside ratified gates is
> UNCHANGED; v1.48 confirms standing gates survived the keystone close.
> This document confers NO authority to reboot, restart, or alter the prod
> box, and no authority to write, rotate, or re-anchor any credential.
>
> Any reference below to retired [3] runbooks is non-authoritative.
>
> STALE-VALUE NOTICE: every count, fingerprint, PM2 id, process name, port
> binding, credential candidate, and endpoint below is a snapshot from its
> authoring date. Do not compare live state against any of them. A mismatch
> against values in this retired document is expected and is NOT, by itself,
> an abort signal.
>
> If you need current state, derive it live: numeric-sort the
> docs/audit/F-Deploy-1_Fix_Plan_v1.*.md revisions and read the tail.
> Do not treat any version number in this banner as current.
>
> See NEW_CHAT_ONBOARDING.md Sec 4 rule 13.
>
> Known-benign classifications below are historical only and must not
> suppress present-time abort signals. The read-gate framing is void: there
> is no [3] entry to be baseline-aware for. Signal 2 in particular must not
> be used to wave through a failed credential probe. The standing
> non-closures below, including "FD-31 Sec 7 NOT green," are superseded.
> Surviving as reference: the signal-versus-method-defect distinction.
> Original at-filing text preserved verbatim below.
> ==================================================================
# F-Deploy-1 — [3] entry known-benign baseline

Status: Warm-session reference. Built from recorded evidence (#838, SESSION2,
HashID 2026-06-22). READ-GATED: a cold [3]-entry session reads this ONLY when
baseline-aware entry is explicitly authorized by prior adjudication for that
run. Default cold-entry posture is baseline-BLIND.

Purpose: so an authorized baseline-aware session does not re-abort on signals
already known benign. Each entry marks a signal benign-WHEN-SEEN and names the
owed question it does NOT close.

## Signal 1 — TCP resolution to 100.50.2.212
Benign-when-seen: this is canon's confirmed public endpoint (06-21 #838
§4/§7/§8), distinct from the fork's 34.237.165.225. Seeing it is not a new
finding.
Does NOT close: the formal 100.50.2.212 ↔ 10.0.20.224 (DB-layer identity)
closure, which remains OWED. Public-endpoint confirmation is not DB-layer
identity confirmation.

## Signal 2 — SSM credential auth failure
Benign-when-seen: the value at `/episode-metadata/canon/db_password` is the
documented-stale credential (97aac3b0…, len 38), per SESSION2 §2 and 06-21 §4.
An auth failure from it is expected, not new.
Does NOT close: Candidate-B canon-auth status, which remains UNRESOLVED. A
known-stale credential failing tells us nothing about whether Candidate-B
authenticates.

## Signal 3 — connection-string parse misfire
Benign-when-seen: matches the SESSION2 §3 pitfall-#2 method defect. It is a
tooling/method defect, not a canon-state signal.
Does NOT close: any canon-identity question. The probe still owes a clean
execution that returns inet_server_addr / current_database.

## Standing non-closures (carried from adjudication 2026-06-22)
Candidate-B canon-auth UNRESOLVED · live canon DB-layer identity UNCONFIRMED ·
100.50.2.212 ↔ 10.0.20.224 OWED · split-brain DB_HOST re-confirm OWED ·
FD-31 Sec 7 NOT green. This document closes none of them.
