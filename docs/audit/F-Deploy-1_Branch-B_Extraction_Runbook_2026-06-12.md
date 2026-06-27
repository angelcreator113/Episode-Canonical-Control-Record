# Branch B Extraction Runbook
## Credential Durability Fix — Box `.env` Read
**Date Prepared:** June 12, 2026  
**Session:** Canon Credential Durability Investigation  
**Status:** Ready for execution in dedicated fresh session  

---

## Pre-Execution Checks (Before Any Extraction)

Run these in sequence to confirm topology and identity. If any check returns unexpected values, **ABORT** and escalate.

### 1. Confirm Canonical Endpoint (Public)
```powershell
$ep_public = (aws rds describe-db-instances --region us-east-1 --db-instance-identifier episode-control-dev --query 'DBInstances[0].Endpoint.Address' --output text)
Write-Host "Public endpoint: $ep_public"
# Expected: episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
# If different, ABORT.
```

### 2. Confirm Canonical Private Resolution From Box
```powershell
$resolved_ip = ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144 "getent hosts episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com | awk '{print `$1}' | head -n1"
Write-Host "Resolved private IP from box: $resolved_ip"
Write-Host "Canonical IP capture only; do not assert the value in this runbook."
```

### 3. Confirm Box SSH Key Identity
```powershell
$key_path = "C:\Users\12483\episode-prod-key.pem"
if (-not (Test-Path $key_path)) { throw "SSH key not found at $key_path" }
Write-Host "SSH key confirmed: $key_path"
```

### 4. Confirm Box `.env` File Exists & Is Readable
```powershell
$ssh_test = ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144 "test -f /home/ubuntu/episode-metadata/.env && echo FOUND || echo NOTFOUND"
Write-Host "Box .env status: $ssh_test"
# Expected: FOUND at /home/ubuntu/episode-metadata/.env
# If NOTFOUND, ABORT.
```

---

## Uninterrupted Extraction Sequence

**CRITICAL:** Execute this block in one continuous PowerShell invocation. Do not pause between steps. No staged plaintext should exist between extract and put.

### Extract → Put → Hash Verify → Canon Probe

```powershell
# ===== STEP 1: Extract from box (no echo) =====
Write-Host "[EXTRACT] Reading DB_PASSWORD from box .env (no echo)..."
$extracted = ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144 "grep '^DB_PASSWORD=' /home/ubuntu/episode-metadata/.env | cut -d'=' -f2-"
$extracted = $extracted.TrimEnd("`r", "`n")

# Confirm extraction non-empty
if ([string]::IsNullOrWhiteSpace($extracted)) {
    throw "EXTRACTION FAILED: DB_PASSWORD is empty or not found in box .env"
}
Write-Host "[EXTRACT] OK — value retrieved, length $(($extracted -replace '.','.').Length) chars"

# ===== STEP 2: Put to Systems Manager Parameter Store (no echo) =====
Write-Host "[PUT] Transferring to /episode/db-password-extracted-box..."
aws ssm put-parameter `
  --name "/episode/db-password-extracted-box" `
  --value "$extracted" `
  --type "SecureString" `
  --overwrite `
  --region us-east-1 `
  --output text | Out-Null

Write-Host "[PUT] OK — Parameter Store updated"

# ===== STEP 3: Hash Presence Check (verify put transferred the extracted value, not a stale/corrupted version) =====
Write-Host "[HASH-CHECK] Computing hash of extracted value..."
$bytes = [System.Text.Encoding]::UTF8.GetBytes($extracted)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hash_extracted = [System.BitConverter]::ToString($sha256.ComputeHash($bytes)) -replace '-', ''
Write-Host "[HASH-CHECK] Extracted value hash: $hash_extracted"

Write-Host "[HASH-CHECK] Retrieving put value from Parameter Store..."
$put_value = (aws ssm get-parameter --name "/episode/db-password-extracted-box" --with-decryption --region us-east-1 --query 'Parameter.Value' --output text)
$put_value = $put_value.TrimEnd("`r", "`n")
$bytes_put = [System.Text.Encoding]::UTF8.GetBytes($put_value)
$hash_put = [System.BitConverter]::ToString($sha256.ComputeHash($bytes_put)) -replace '-', ''
Write-Host "[HASH-CHECK] Parameter Store value hash: $hash_put"

if ($hash_extracted -ne $hash_put) {
    throw "HASH MISMATCH: Extracted and Put values do not match. Transfer corrupted or wrong value retrieved."
}
Write-Host "[HASH-CHECK] OK — hashes match, transfer integrity confirmed"

# ===== STEP 4: Canon Probe (sole correctness gate — confirms *this* value works against the canonical endpoint) =====
Write-Host "[CANON-PROBE] Connecting to canonical endpoint with extracted credential..."
$probe_result = $put_value | ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144 "read -rs PW; PGPASSWORD=`$PW PGOPTIONS='-c default_transaction_read_only=on' psql 'host=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com dbname=episode_metadata user=postgres sslmode=require' -tAc 'select current_database(), inet_server_addr();' 2>&1; unset PW PGPASSWORD"

if ($probe_result -like "*episode_metadata*") {
    Write-Host "[CANON-PROBE] OK — Connection successful. Canonical endpoint confirmed."
    Write-Host "[CANON-PROBE] Response: $probe_result"
    Write-Host "[CANON-PROBE] inet_server_addr() is diagnostic data only; do not assert a fixed IP in this runbook."
    Write-Host "`n===== EXTRACTION SUCCESSFUL ====="
    Write-Host "Extracted credential is VALID and CONFIRMED against canonical endpoint."
    Write-Host "Parameter Store tag: /episode/db-password-extracted-box"
} else {
    throw "CANON-PROBE FAILED: Extracted credential does not work against canonical endpoint. Response: $probe_result"
}

# ===== CLEANUP: Clear local plaintext =====
$extracted = $null
$put_value = $null
[System.GC]::Collect()
Write-Host "[CLEANUP] Local plaintext cleared"
```

---

## Abort & Rollback Conditions

Stop immediately if any of these occur:

| Condition | Action |
|-----------|--------|
| Pre-check fails (endpoint, key, box connectivity) | ABORT before extraction. Escalate mismatch to infrastructure team. |
| Extraction returns empty or null | ABORT. Box `.env` may be corrupt or missing. Check box manually. |
| Put-parameter fails (AWS auth, quota, network) | ABORT. Do not retry. Investigate AWS credentials and permissions. |
| Hash mismatch (extracted vs. put) | ABORT. Transfer corruption. Verify network, retry once. If repeated, escalate. |
| Canon probe fails (auth rejected or endpoint unreachable) | ABORT. Credential is not valid against canonical endpoint. Do NOT use for writes. Investigate why box `.env` contains wrong value. |

---

## Outcome: Success

If all steps complete without abort:
- **Credential verified** as valid against canonical endpoint (episode_metadata database; inet_server_addr() captured for diagnostics)
- **Stored in Parameter Store** under `/episode/db-password-extracted-box` (SecureString)
- **Ready for next phase**: Update production `.env` or migration plan per post-rotation durability architecture

Document the hash and canon-probe timestamp for audit trail.

---

## Outcome: Abort / Failure

If any step triggers abort:
- **Do not** retry the extraction in the same session
- **Do not** use an extracted value that failed canon probe
- Open a new issue with:
  - Which pre-check or step failed
  - Full AWS/SSH output
  - Box status (is `.env` still present? Can SSH run shell commands?)
  - Canonical endpoint and VPC topology (capture the actual `inet_server_addr()` / private-resolution values; do not assert a fixed IP)

---

## Notes

- **No plaintext logs**: This runbook outputs progress markers but never echoes the credential value itself
- **Sole correctness gate**: The canon probe is the *only* verification that the extracted credential is both complete and valid. Hash check verifies transfer integrity; canon probe verifies correctness.
- **SSH no-echo principle**: Both `ssh ... grep` and `$value | ssh ... "read -rs PW; ..."` use stdin piping to prevent embedding plaintext in the SSH command string. Never place a credential directly inside quoted SSH command text.
- **Parameter Store tagging**: The extracted value is tagged separately (`-extracted-box`) to distinguish it from any other durability artifacts in this investigation. Do not overwrite other parameters.
