# Dependency audit, 2026-09-29: the 15 critical/high findings

Task #2321. This is a list only: no package is upgraded, and no lockfile is
touched.

## What the 15 is

After Deploy CE, the CFO's `dependency_audit` reported "15 critical/high
security vulnerabilities" (14 at CD). See
`docs/audit/F-Deploy-1_Deploy_2026-09-29_CE.md` §9.

The number comes from `dependencyAudit` in `src/services/cfoAgent.js`:
- it runs `npm audit --json` in the repository root, so the backend only,
  not `frontend/`;
- it adds `critical` and `high` from `metadata.vulnerabilities`.

The same root audit restricted to production dependencies gives exactly 15.
It was run on the lockfile at `8e210132`, with npm 10.9.7 and node
v22.22.2, on 2026-09-29 around 22:00Z:

```
$ npm audit --omit=dev --json
"metadata": {"vulnerabilities": {"info":0,"low":1,"moderate":8,"high":15,"critical":0,"total":24}}
```

**INFERRED:** production's count is this production-only audit. Production
runs with `NODE_ENV=production`, and npm then omits dev dependencies. The
production command was not observed.

**The count rose with no package change.** No package file changed between
CD (`f90af0b6`) and CE (`8e210132`). The root `package-lock.json` last
changed at #1873 (2026-09-25). npm audit reads the live advisory database,
so the rise is a newly published advisory against a package already
installed. **Which of the 15 is new cannot be told from here:** the audit
keeps no history.

Every finding is **high**; none is critical. npm counts one finding per
vulnerable package, whatever the number of advisories against it.

## The 15

"Fix path" is what `npm audit` proposes:
- **`npm audit fix`** means a fix inside the ranges already declared (a
  lockfile-only change);
- **semver-major** means the fix needs a major-version bump of a direct
  dependency, which is a code-review job.

Installed versions are from `package-lock.json`.

### Direct dependencies (6)

| # | Package | Installed (declared) | Advisories | What they are, in short | Fix path |
|---|---|---|---|---|---|
| 1 | `axios` | 1.13.6 (`^1.13.5`) | 28 | SSRF via `NO_PROXY` bypasses; prototype-pollution gadgets (header injection, credential leaks, response tampering); `maxBodyLength`/`maxContentLength` bypasses; proxy-credential leaks on redirect; recursion DoS. Fixed through 1.18.0. | `npm audit fix` |
| 2 | `form-data` | 4.0.5 (`^4.0.5`) | 1 | CRLF injection via unescaped multipart field names and filenames (GHSA-hmw2-7cc7-3qxx). | `npm audit fix` (4.0.6) |
| 3 | `joi` | 18.0.2 (`^18.0.2`) | 4 | Prototype pollution via a `__proto__` message key; `rename()` can set the prototype; `isoDate()` ReDoS; uncaught RangeError on deep `link()` input. | `npm audit fix` |
| 4 | `multer` | 2.1.1 (`^2.1.1`) | 5 | Upload DoS (nested or crafted field names, oversized array index, aborted-upload cleanup); file-size limit bypass via an async `fileFilter` race. Fixed in 2.3.0. | `npm audit fix` |
| 5 | `nodemailer` | 8.0.2 (`^8.0.1`) | 12 | SMTP command and header injection (CRLF); `disableFileAccess`/`disableUrlAccess` bypasses (file read, SSRF); OAuth2 TLS validation; recipient-domain allow-list bypasses; DNS-cache TLS servername reuse; parser DoS. | **semver-major:** `nodemailer@10.0.12` |
| 6 | `sharp` | 0.34.5 (`^0.34.5`) | 2 | Inherited libvips CVEs (CVE-2026-33327, -33328, -35590, -35591) and libheif advisories. | **semver-major** (0.x minor): `sharp@0.35.5` |

### Transitive dependencies (9)

| # | Package | Installed | Pulled in by | Advisories | What they are, in short | Fix path |
|---|---|---|---|---|---|---|
| 7 | `@xmldom/xmldom` | 0.8.11 | `mammoth` | 15 | XML injection through serialization (CDATA, DocumentType, PI, comments, element and attribute names); quadratic-time and memory parsing DoS. | `npm audit fix` |
| 8 | `brace-expansion` | 2.0.2, 5.0.4 | `minimatch`, under `@bull-board/express` → `ejs` → `jake`, `archiver`, and `node-pg-migrate` → `glob` | 5 | DoS: zero-step sequences, large ranges, exponential `{}` groups, unbounded expansion. | `npm audit fix` |
| 9 | `engine.io` | 6.6.6 | `socket.io` | 2 | Polling-transport connection exhaustion; WebTransport SID DoS (fixed in 6.6.7); also flagged via `ws`. | `npm audit fix` |
| 10 | `ip-address` | 10.1.0 | `express-rate-limit` | 3 | XSS in `Address6` HTML methods; leading-zero octet and `isLinkLocal` mis-parsing that can bypass SSRF or trust boundaries. | `npm audit fix` |
| 11 | `path-to-regexp` | 8.3.0 | `express` → `router` | 2 | ReDoS via sequential optional groups and multiple wildcards (fixed in 8.4.0). | `npm audit fix` |
| 12 | `lodash` | 4.17.23 | `bull`, `@bull-board/api` → `redis-info`, `archiver-utils` | 2 | Code injection via `_.template` import key names; prototype pollution via array paths in `_.unset`/`_.omit`. | `npm audit fix` |
| 13 | `nanoid` | 5.1.6 | `docx` | 2 | Non-secure generator loops on a negative size; integer overflow. | `npm audit fix` |
| 14 | `socket.io-parser` | 4.2.5 | `socket.io` | 2 | Unbounded binary attachments; zero-attachment memory exhaustion (fixed in 4.2.7). | `npm audit fix` |
| 15 | `ws` | 8.18.3 | `socket.io` → `engine.io`, `socket.io-adapter` | 2 | Uninitialised memory disclosure; memory-exhaustion DoS from tiny fragments (fixed in 8.21.0). | `npm audit fix` |

**Count check:** 6 direct (axios, form-data, joi, multer, nodemailer,
sharp) plus 9 transitive (@xmldom/xmldom, brace-expansion, engine.io,
ip-address, path-to-regexp, lodash, nanoid, socket.io-parser, ws) is **15**,
matching `high: 15`.

## Fix paths, summarised

- **13 of 15 resolve with `npm audit fix`** inside declared ranges: a
  lockfile-only change, still to be tested before it ships.
- **2 need a major bump** and a code review:
  - `nodemailer` 8 → 10;
  - `sharp` 0.34 → 0.35 (0.x, so a breaking bump).
- **Not in this count:**
  - `frontend/` (the CFO does not audit it);
  - backend dev dependencies (20 critical/high without `--omit=dev`).

## What this document does not do

- It upgrades nothing.
- It edits no lockfile.
- It rules on nothing: which fixes to take, and when, is Evoni's call.
- It makes no host, AWS, database or Cognito contact.
