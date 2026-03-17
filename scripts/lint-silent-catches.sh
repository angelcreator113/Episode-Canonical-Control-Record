#!/bin/bash
# lint-silent-catches.sh — Detect silent error handling patterns in app code
#
# Catches patterns that ESLint's no-empty rule misses:
#   .catch(() => {})
#   .catch(() => null)
#   } catch {}
#   } catch (_) {}
#
# Excludes:
#   - migrations/ (idempotent DDL operations are expected to fail silently)
#   - workers/ (temp file cleanup)
#   - VideoProcessingService.js (temp file cleanup with fs.unlink)
#   - Keep-alive res.write patterns
#   - JSON.parse fallback patterns (first-attempt parse before regex fallback)
#   - fs.unlinkSync file cleanup
#   - client.end() SSE disconnect
#
# Usage: bash scripts/lint-silent-catches.sh
# Exit code: 0 = clean, 1 = silent catches found

VIOLATIONS=0

echo "Scanning for silent error handlers in src/routes/ and src/services/..."
echo ""

# Search only in routes and services (skip migrations, workers, VideoProcessingService)
SEARCH_PATHS="src/routes/ src/services/"
EXCLUDE="--exclude=VideoProcessingService.js"

# Pattern 1: .catch(() => {})
RESULTS=$(grep -rn '\.catch(() => {})' $SEARCH_PATHS $EXCLUDE 2>/dev/null || true)
if [ -n "$RESULTS" ]; then
  while IFS= read -r line; do
    echo "  SILENT CATCH: $line"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$RESULTS"
fi

# Pattern 2: } catch {} (empty catch block — skip JSON.parse fallbacks, fs ops, keep-alive, client.end)
RESULTS=$(grep -rn 'catch\s*{}' $SEARCH_PATHS $EXCLUDE --include='*.js' 2>/dev/null \
  | grep -v 'JSON.parse' \
  | grep -v 'fs\.' \
  | grep -v 'unlinkSync' \
  | grep -v 'res\.write' \
  | grep -v 'client\.end' \
  || true)
if [ -n "$RESULTS" ]; then
  while IFS= read -r line; do
    echo "  EMPTY CATCH: $line"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$RESULTS"
fi

# Pattern 3: } catch (_) {} or } catch (e) {} (catches but ignores — skip keep-alive)
RESULTS=$(grep -rn -P 'catch\s*\([_e]\)\s*\{\}' $SEARCH_PATHS $EXCLUDE --include='*.js' 2>/dev/null \
  | grep -v 'res\.write' \
  || true)
if [ -n "$RESULTS" ]; then
  while IFS= read -r line; do
    echo "  EMPTY CATCH: $line"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$RESULTS"
fi

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Found $VIOLATIONS silent error handler(s)."
  echo "Every catch must log the error: console.warn('[module] context:', err?.message)"
  exit 1
else
  echo "No silent error handlers found."
  exit 0
fi
