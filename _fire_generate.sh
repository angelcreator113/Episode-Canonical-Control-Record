#!/bin/bash
echo "=== FIRING GENERATE-BASE ==="
echo "Scene Set: 5f3e952e-933e-41f0-9ced-9b69d9f27a64"
echo "Time: $(date)"
echo ""

curl -s -X POST \
  "http://localhost:3002/api/v1/scene-sets/5f3e952e-933e-41f0-9ced-9b69d9f27a64/generate-base" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "=== DONE ==="
