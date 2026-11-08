# Credential inventory (read-only)

`scripts/ops/credential-inventory.js` reports where credential-like variables live on a host:
- which OS users can read each file;
- whether copies hold the same value as the live source.

It never prints a value. It is the before/after evidence step for credential remediation and for proving a provider key has left the app server (AI gateway G3, slice S-1).

**Status:** local use only. Running it on production needs Evoni's separate approval. When approved, it runs only through read-only SSM (the `AWS-RunShellScript` pattern used for other read-only checks), as root, so readers can be checked.

## Run it

```bash
ulimit -c 0   # no core dumps
node scripts/ops/credential-inventory.js \
  --app-dir /home/ubuntu/episode-metadata \
  --home /home/ubuntu \
  [--users ubuntu,ssm-user,www-data,nobody] [--json] [--no-readers]
```

| Exit | Meaning |
|---|---|
| 0 | complete |
| 2 | complete, but some sources were unreadable or too large (each says why) |
| 3 | the output guard found part of a value in the report; nothing was printed |
| 1 | usage or unexpected error (`ERROR <name>` only) |

## What it reads

| Source | Reported |
|---|---|
| `<app-dir>/.env` and every `<app-dir>/.env*` | credential-like names, each with a label |
| `<home>/.episode-*.env` | same |
| `<home>/.pm2/dump.pm2`, `dump.pm2.bak` | one block per pm2 app: names and labels |
| `<home>/.aws/credentials` | profile names; labels for the access key and secret per profile |
| `/etc/passwd`, `/etc/group` | only to show owner and group names (never `/etc/shadow`) |
| `<home>/.ssh/*`, `.git-credentials`, `.npmrc`, `.docker/config.json`, `.netrc` | **never opened**: existence, mode and owner only |

**Credential-like names** match `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `PASS` (at the end), `CREDENTIAL`, `PRIVATE`, `DATABASE_URL` or `_DSN` (at the end). Other variables, such as bucket names and ports, are ignored and not printed.

**Limits:**
- files over 1 MiB are not read;
- symlinks are reported with their target, then read;
- non-regular files are skipped.

## Reading the labels

| Label | Meaning |
|---|---|
| `L` | same value as the live source: `<app-dir>/.env`, or for AWS keys `~/.aws/credentials [default]` |
| `H1`, `H2`, … | a different, real-looking value. Numbered per variable in source order: live first, then by name. |
| `P` | placeholder or empty: shorter than 8 characters, contains `${`, `your`, `here`, `example`, `changeme`, `placeholder` or `xxx`, or one repeated character |

Values are compared as HMAC-SHA256 digests under a random key made for each run and kept in memory only. Labels are not comparable between runs, though they are numbered the same way each time.

**Readers** (who can read each file) are checked with `sudo -n -u <user> test -r <path>` when the tool runs as root. Otherwise only the running user is checked, and the report says the others were not checked.

## What it never does

- **Print values:** no value, digest, prefix or suffix is printed or returned.
- **Print parser messages:** errors appear as their code or name (`EACCES`, `SyntaxError`). Node's `JSON.parse` messages quote part of their input, so they are never shown.
- **Write anything:** no files, temporary files, logs, network calls or environment reads.
- **Run other commands:** child processes are limited to `sudo -n -u <user> test -r <path>`, `id -nG <user>` and `sudo -n -l -U <user>`, and only when run as root.

Every report passes a final guard. If any 6-character piece of any non-placeholder value read appears in the report, after removing known non-secret strings (paths, file and variable names, dates, the report's fixed wording), nothing is printed and the exit code is 3.

## Tests

`tests/unit/ops/credentialInventory.test.js` (15 cases) builds a synthetic host in a temporary directory from random values, runs the tool, and removes the directory. It checks:
- labels;
- the leak guard;
- parser and error redaction;
- no writes, network or extra commands;
- unreadable, oversized and symlinked files;
- the exported API;
- that no fixture or credential-like value is committed.
