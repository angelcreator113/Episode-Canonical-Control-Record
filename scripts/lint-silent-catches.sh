#!/bin/bash
# lint-silent-catches.sh — Detect silent error handling patterns in app code
#
# Scans src/routes/ and src/services/ (*.js) for catches that swallow an error
# without logging it. Line-based (grep), so it sees one line at a time.
#
# Patterns (each hit is tagged in the output):
#   EMPTY-PROMISE   .catch(() => {})        also (e) => {}, _ => {}, async () => {}
#   EMPTY-CATCH     } catch {}              skips JSON.parse, fs., unlinkSync,
#                                           res.write, client.end lines
#   EMPTY-NAMED     } catch (err) {}        any binding name; skips res.write lines
#   COMMENT-ONLY    } catch { /* ... */ }   with or without a binding; body is only
#                                           one or more /* */ comments on one line
#   VALUE-FALLBACK  .catch(() => null)      also [], [[]], {} in parens, '', "", 0,
#                                           false, undefined; any arrow parameter form
#
# Reported but NOT failed on: multi-line catch bodies that are empty or hold only
# comments (a line grep cannot tie the body to the catch reliably), as a count.
#
# Not detected (needs a syntax tree, see docs/SILENT_FAILURES_READ.md §6):
#   catch { return null; } and other non-empty bodies that do not log, a catch that
#   logs a different error than the one it caught, error responses with no log.
#
# Allow-list: a hit whose line carries a `// silent-ok: <reason>` or
# `/* silent-ok: <reason> */` comment is not flagged. The reason is required.
#
# Ratchet baseline: scripts/silent-catches.baseline freezes the hits that existed
# when it was generated. Each entry is `count<TAB>path<TAB>normalised line text`
# (leading/trailing whitespace trimmed, internal runs collapsed to one space; no
# line numbers, so edits elsewhere in a file do not churn it). The lint fails only
# when a (path, text) pair occurs more times than the baseline allows. Entries that
# no longer occur (or occur fewer times) are printed as notes so they can be removed.
# The baseline should only shrink.
#
# Excludes:
#   - migrations/ (idempotent DDL operations are expected to fail silently)
#   - workers/ (temp file cleanup)
#   - VideoProcessingService.js (temp file cleanup with fs.unlink)
#
# Usage:
#   bash scripts/lint-silent-catches.sh                    # check
#   bash scripts/lint-silent-catches.sh --update-baseline  # rewrite the baseline from
#                                                          # the working tree
# Exit code: 0 = no hits beyond the baseline, 1 = new silent catches found

set -u
cd "$(dirname "$0")/.." || exit 2

BASELINE="scripts/silent-catches.baseline"
MODE="check"
if [ "${1:-}" = "--update-baseline" ]; then
  MODE="update"
elif [ "${1:-}" = "--list-multiline" ]; then
  MODE="list-multiline"
elif [ -n "${1:-}" ]; then
  echo "Unknown argument: $1 (use --update-baseline, --list-multiline, or nothing)" >&2
  exit 2
fi

SEARCH_PATHS="src/routes/ src/services/"
GREP_OPTS=(-rn '--include=*.js' --exclude=VideoProcessingService.js)
SILENT_OK='(//|/\*)\s*silent-ok:\s*\S'

HITS=$(mktemp)
trap 'rm -f "$HITS"' EXIT

# to_hits TAG: read grep -n output (path:line:text) on stdin, write
# TAG<TAB>path<TAB>line<TAB>normalised text
to_hits() {
  awk -v tag="$1" '{
    i = index($0, ":"); f = substr($0, 1, i - 1); r = substr($0, i + 1)
    j = index(r, ":"); n = substr(r, 1, j - 1); t = substr(r, j + 1)
    gsub(/[[:space:]]+/, " ", t); sub(/^ /, "", t); sub(/ $/, "", t)
    print tag "\t" f "\t" n "\t" t
  }'
}

scan() {
  # Pattern 1: .catch(() => {}) and other arrow forms with an empty block body
  grep "${GREP_OPTS[@]}" -P '\.catch\(\s*(async\s+)?(\(\s*[\w$]*\s*\)|[\w$]+)\s*=>\s*\{\s*\}\s*\)' $SEARCH_PATHS 2>/dev/null \
    | grep -vP "$SILENT_OK" | to_hits EMPTY-PROMISE

  # Pattern 2: } catch {} (empty catch block — skip JSON.parse fallbacks, fs ops, keep-alive, client.end)
  grep "${GREP_OPTS[@]}" 'catch\s*{}' $SEARCH_PATHS 2>/dev/null \
    | grep -v 'JSON.parse' \
    | grep -v 'fs\.' \
    | grep -v 'unlinkSync' \
    | grep -v 'res\.write' \
    | grep -v 'client\.end' \
    | grep -vP "$SILENT_OK" | to_hits EMPTY-CATCH

  # Pattern 3: } catch (err) {} — any binding name (skip keep-alive)
  grep "${GREP_OPTS[@]}" -P 'catch\s*\(\s*[\w$]+\s*\)\s*\{\s*\}' $SEARCH_PATHS 2>/dev/null \
    | grep -v 'res\.write' \
    | grep -vP "$SILENT_OK" | to_hits EMPTY-NAMED

  # Pattern 4: } catch { /* ... */ } or } catch (e) { /* ... */ } — body is only comments
  grep "${GREP_OPTS[@]}" -P 'catch\s*(\(\s*[\w$]*\s*\))?\s*\{\s*(/\*.*?\*/\s*)+\}' $SEARCH_PATHS 2>/dev/null \
    | grep -vP "$SILENT_OK" | to_hits COMMENT-ONLY

  # Pattern 5: .catch(() => null | [] | [[]] | ({}) | '' | "" | 0 | false | undefined)
  grep "${GREP_OPTS[@]}" -P '\.catch\(\s*(async\s+)?(\(\s*[\w$]*\s*\)|[\w$]+)\s*=>\s*(null|undefined|false|0|'"''"'|""|\[\]|\[\[\]\]|\(\{\}\))\s*\)' $SEARCH_PATHS 2>/dev/null \
    | grep -vP "$SILENT_OK" | to_hits VALUE-FALLBACK
}

# One hit per source line, first matching pattern wins
scan | awk -F'\t' '!seen[$2 FS $3]++' | LC_ALL=C sort -t "$(printf '\t')" -k2,2 -k3,3n > "$HITS"

# Multi-line empty or comment-only catch bodies: counted, never failed on
MULTILINE_LIST=$(find $SEARCH_PATHS -name '*.js' ! -name 'VideoProcessingService.js' -print0 \
  | LC_ALL=C sort -z | xargs -0 awk '
    FNR == 1 { inb = 0 }
    {
      if (inb) {
        t = $0; gsub(/^[[:space:]]+|[[:space:]]+$/, "", t)
        if (t ~ /^}/) { if (!ok) print "  " FILENAME ":" start; inb = 0; next }
        if (t == "" || t ~ /^(\/\/|\/\*|\*)/ || t ~ /\*\/$/) { if (t ~ /silent-ok:/) ok = 1; next }
        inb = 0; next
      }
      if ($0 ~ /catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{[[:space:]]*(\/\/.*|\/\*.*)?$/) {
        # Skip one-line bodies ({ /* x */ }): those are the grep patterns above
        rest = $0
        sub(/.*catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{/, "", rest)
        if (rest !~ /^[[:space:]]*\/\//) gsub(/\/\*.*\*\//, "", rest)
        if (rest ~ /^[[:space:]]*\/\// || rest !~ /\}/) {
          inb = 1; ok = ($0 ~ /silent-ok:/); start = FNR
        }
      }
    }')
MULTILINE=$(printf '%s' "$MULTILINE_LIST" | grep -c . )
if [ "$MODE" = "list-multiline" ]; then
  echo "Multi-line empty/comment-only catch bodies ($MULTILINE), path:line of the catch:"
  [ -n "$MULTILINE_LIST" ] && echo "$MULTILINE_LIST"
  exit 0
fi

count_tag() { awk -F'\t' -v t="$1" '$1 == t' "$HITS" | wc -l | tr -d ' '; }

echo "Scanning for silent error handlers in src/routes/ and src/services/..."
echo ""
echo "Hits by pattern (including baselined):"
for tag in EMPTY-PROMISE EMPTY-CATCH EMPTY-NAMED COMMENT-ONLY VALUE-FALLBACK; do
  printf '  %-15s %s\n' "$tag" "$(count_tag "$tag")"
done
echo "  Multi-line empty/comment-only catch bodies (reported, not failed): $MULTILINE"
echo ""

if [ "$MODE" = "update" ]; then
  {
    echo "# Silent-catch ratchet baseline for scripts/lint-silent-catches.sh."
    echo "# Format: count<TAB>path<TAB>normalised line text. No line numbers."
    echo "# Regenerate: bash scripts/lint-silent-catches.sh --update-baseline"
    echo "# This file should only shrink. Do not add entries to silence a new catch;"
    echo "# log the error, or mark an intentional swallow with // silent-ok: <reason>."
    awk -F'\t' '{ print $2 "\t" $4 }' "$HITS" | LC_ALL=C sort | uniq -c \
      | awk '{ n = $1; sub(/^ *[0-9]+ /, ""); print n "\t" $0 }'
  } > "$BASELINE"
  echo "Wrote $BASELINE: $(grep -vc '^#' "$BASELINE") entries, $(wc -l < "$HITS" | tr -d ' ') hits."
  exit 0
fi

if [ ! -f "$BASELINE" ]; then
  echo "Baseline $BASELINE not found; every hit counts as new."
  BASEFILE=/dev/null
else
  BASEFILE="$BASELINE"
fi

# Compare current hits against the baseline, key = path<TAB>normalised text
awk -F'\t' '
  FILENAME == ARGV[1] {
    if ($0 ~ /^#/ || $0 == "") next
    k = $2 "\t" $3; base[k] = $1; basen += $1; border[++nbase] = k; next
  }
  {
    k = $2 "\t" $4
    if (!(k in cur)) order[++nk] = k
    cur[k]++
    hit[k] = hit[k] sprintf("  %s: %s:%s: %s\n", $1, $2, $3, $4)
  }
  END {
    viol = 0
    for (i = 1; i <= nk; i++) {
      k = order[i]
      b = (k in base) ? base[k] : 0
      if (cur[k] > b) {
        extra = cur[k] - b; viol += extra
        if (b > 0) printf("NEW (%d occurrence(s) of this line, baseline allows %d):\n", cur[k], b)
        else printf("NEW:\n")
        printf("%s", hit[k])
      }
    }
    stale = 0
    for (i = 1; i <= nbase; i++) {
      k = border[i]
      c = (k in cur) ? cur[k] : 0
      if (c < base[k]) {
        if (!stale) print "\nBaseline entries no longer (fully) present; remove them from the baseline:"
        stale++
        split(k, p, "\t")
        printf("  note: %s: expected %d, found %d: %s\n", p[1], base[k], c, p[2])
      }
    }
    if (viol > 0 || stale > 0) print ""
    printf("Baseline: %d entries (%d hits). Stale entries: %d.\n", nbase, basen, stale)
    if (viol > 0) {
      printf("Found %d new silent error handler(s).\n", viol)
      print "Every catch must log the error: console.warn(\"[module] context:\", err?.message)"
      print "If the swallow is intentional, say why on the same line: // silent-ok: <reason>"
      exit 1
    }
    print "No new silent error handlers found."
    exit 0
  }
' "$BASEFILE" "$HITS"
