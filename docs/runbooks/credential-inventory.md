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
| 0 | complete (skipped links don't change this) |
| 2 | complete, but some sources were unreadable or too large (each says why) |
| 3 | the output guard found part of a value in the report; nothing was printed |
| 1 | usage or unexpected error (`ERROR <identifier>` only) |

## What it reads

| Source | Reported |
|---|---|
| `<app-dir>/.env` and every `<app-dir>/.env*` | credential-like names, each with a label |
| `<home>/.episode-*.env` | same |
| `<home>/.pm2/dump.pm2`, `dump.pm2.bak` | one block per pm2 app: names and labels |
| `<home>/.aws/credentials` | profile names; labels for the access key and secret per profile |
| `/etc/passwd`, `/etc/group` | only to show owner and group names (never `/etc/shadow`) |
| `<home>/.ssh/*`, `.git-credentials`, `.npmrc`, `.docker/config.json`, `.netrc` | **never opened**: existence, mode and owner only |

**Credential-like names** match `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `PASS` (at the end), `CREDENTIAL`, `PRIVATE`, `DATABASE_URL` or `_DSN` (at the end), **case-insensitively**. Other variables, such as bucket names and ports, are ignored and not printed.

**Limits:**
- files over 1 MiB are not read;
- non-regular files are skipped;
- symlinks are handled as described below.

### Symlinks

A source is read only if its **resolved path is itself an inventory source**: an `.env*` file directly in the app directory, `~/.episode-*.env`, `~/.aws/credentials` or `~/.pm2/dump.pm2(.bak)`. This also applies when a parent directory, such as `~/.aws`, is a link. Nothing outside the inventory is ever opened.

The report shows where a link resolves, never the raw link text:

| Shown | Meaning |
|---|---|
| `symlink -> ./<name>` | inside the app directory |
| `symlink -> ~/<path>` | inside the home directory |
| `symlink -> (outside inventoried directories)` | elsewhere; not read |
| `symlink -> (dangling)` | the target doesn't exist |

A link that resolves inside home, but not to an inventory source (for example `~/.ssh/id_ed25519`), is shown and marked `skipped (resolves outside the inventory)`. It is not read. JSON gives `link: { where: "app-dir" | "home" | "outside" | "dangling", path? }`.

## Reading the labels

| Label | Meaning |
|---|---|
| `L` | same value as the live source: `<app-dir>/.env`, or for AWS keys `~/.aws/credentials [default]` |
| `H1`, `H2`, … | a different, real-looking value. Numbered per variable in source order: live first, then by name. |
| `P` | placeholder or empty (see template files below for the stricter rule used there) |
| `!` after a label | the value is in a template file and is **not** an explicit placeholder: potentially real |

Outside template files, `P` is an informational shape test: shorter than 8 characters, contains `${`, `your`, `here`, `example`, `changeme`, `placeholder` or `xxx`, or one repeated character. It never excludes a value from the guard.

Values are compared as HMAC-SHA256 digests under a random key made for each run and kept in memory only. Labels are not comparable between runs, though they are numbered the same way each time.

**Readers** (who can read each file) are checked with `sudo -n -u <user> test -r <path>` when the tool runs as root. Otherwise only the running user is checked, and the report says the others were not checked.

### Template files

`.env.example`, `.env.sample`, `.env.template`, and any `.env.*` name ending in `.example`, `.sample` or `.template` (for example `.env.production.template` or `.env.local.example`) form their own class. They are marked `[template]` in the report and `template: true` in JSON.
- **Never live:** a template value can be `L!`, meaning the live value is committed in a template, but it never sets `L`.
- **Explicit placeholders:** only these whole-value forms are labelled `P` and left out of the guard:
  - empty;
  - a single `${NAME}`;
  - `<name>` (letters, digits, space, `_` `.` `-`, up to 64 characters);
  - a run of one mask character (`x`, `X`, `*`, `#`) or `...`;
  - one of the words `changeme`, `change_me`, `change-me`, `replaceme`, `replace_me`, `replace-me`, `placeholder`, `redacted`, `todo`, `tbd`, `none`, `null`, `example` (in any case).
- **Every other template value stays guarded,** gets a normal label, and is flagged `!` (JSON: `flagged`). That includes values like `your-key-here`, or a sample URL with a real-looking host. No substring rule is used here.

## Report integrity

Every string the tool takes from the file system is escaped in the text report:
- file names, directory paths, link locations, owner, app and profile names;
- a backslash becomes `\\`;
- any character outside printable ASCII `!`…`~` becomes `\u{HEX}`. That covers space, tab, carriage return, newline, other control characters, every non-ASCII character, and Unicode format controls such as U+202E and U+200B.

So no name can add a line or pose as another field. For example, a file named `.env.x`, newline, `FORGED` prints as `.env.x\u{A}FORGED` on its own source line. JSON output escapes every non-ASCII character as `\uXXXX` (and JSON already escapes control characters), so it is plain ASCII and round-trips the exact names.

## What it never does

- **Print values:** no value, digest, prefix or suffix is printed or returned.
- **Print raw error text:** error identifiers come from a strict allowlist: Node errno codes (`EACCES`, `ENOENT`, `ELOOP`, …) and built-in error names (`Error`, `TypeError`, `SyntaxError`, …). Anything else is shown as `Error`. Exception messages are never shown; Node's `JSON.parse` messages quote part of their input.
- **Write anything:** no files, temporary files, logs, network calls or environment reads.
- **Run other commands:** child processes are limited to `sudo -n -u <user> test -r <path>`, `id -nG <user>` and `sudo -n -l -U <user>`, and only when run as root.

## Output guard (fails closed)

Every report, text or JSON, passes a guard over **the exact text that would be printed**. If the guard finds a hit, nothing goes to stdout, stderr shows only `REDACTION_GUARD_TRIPPED: output withheld`, and the exit code is 3. If formatting or the guard itself fails, stdout is empty, stderr shows `ERROR <identifier>`, and the exit code is 1.

**What is guarded.**
- Every nonempty value of a credential-like variable, including placeholders, except the explicit placeholder forms in template files listed above.
- A `${NAME}` reference is cut out of a value, because it names another variable and holds no secret. The literal pieces around it stay guarded, unless a piece is punctuation only.
- Values of variables whose names can't be printed stay guarded.

**What counts as a hit.** Matching is case-sensitive. Each value is checked in its raw, NFC and NFD forms, and in its text-escaped and JSON-escaped forms.

| Value length | Hit when |
|---|---|
| 6 characters or more | the value, or any 6-character piece of it, appears anywhere |
| 1 to 5 characters | the value appears as a standalone token: no Unicode letter, digit or underscore directly before or after it |

For short values, a punctuation edge on the value, or a combining mark beside the match, counts as standalone, so ambiguous cases fail closed. **Known limitation:** a short value that only appears embedded inside a longer word is not detected. For example, a 3-character value `ers` inside `readers` does not trip the guard.

**Nothing is exempted for matching report text.** A value that equals, or shares a 6-character piece with, a path, file name, variable name, pm2 app name, label or the report's own wording withholds the report.

**Names that could carry a secret are not printed:**
- variable names are printed only if they match `^[A-Z][A-Z0-9_]{0,63}$`; others, including lowercase and mixed-case names, are counted as `(+N unprintable names)`;
- pm2 app names and AWS profile names are printed only if they match `^[a-z0-9][a-z0-9._-]{0,63}$`; others appear as `appN` or `profileN`, and the original name is guarded;
- JSON gives each source its relative label only, never an absolute file path.

There is no diagnostic mode. The tool never says which value caused a hit.

### Troubleshooting exit 3

1. **Treat it as a possible leak:** keep the output withheld. Do not edit the tool to exempt anything, and do not copy credential files elsewhere to investigate.
2. **Check the usual benign causes:** a value shares 6 characters with text the report prints.
   - A sample value in a template file that isn't one of the explicit placeholder forms. For example, a `DATABASE_URL` example whose host contains the application's directory name, such as `episode-metadata`.
   - User names (`ubuntu`, `www-data`), pm2 app names, or a value containing a space or a non-ASCII character that also appears escaped in a printed name.
3. **Narrow it down without reading values,** using the tool's own arguments (read-only):
   - Run with `--home` pointing at an empty directory to check only the app directory's `.env*` files.
   - Run with `--app-dir` pointing at an empty directory to check only the home-directory sources.
   - Use `--no-readers` to drop the readers column and host facts from the report.
4. **If the cause is a template sample value,** the fix belongs in that file, through normal review: use an explicit placeholder form such as `<db-host>`. It never belongs in the guard.
5. **If you can't explain it,** stop and report "the guard withheld the inventory", with the exit code only.

## Tests

`tests/unit/ops/credentialInventory.test.js` (T1–T28) builds synthetic hosts in temporary directories from random values, runs the tool, and removes the directories. It checks:
- labels and template classification;
- the leak guard (exact matches, 6-character overlaps, short standalone values and their Unicode boundaries, templates, malformed input, fail-closed errors);
- report-integrity escaping and forgery attempts;
- symlink resolution and containment;
- case-insensitive names and unprintable names;
- the error allowlist;
- no writes, network or extra commands;
- unreadable and oversized files;
- the exported API;
- that no fixture or credential-like value is committed.
