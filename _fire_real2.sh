#!/bin/bash
# Reset + fire for real
PGPASSWORD=Ayanna123!! psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -t -c "UPDATE scene_sets SET generation_status = 'pending', base_runway_seed = NULL, base_runway_prompt = NULL, generation_cost = 0 WHERE id = '5f3e952e-933e-41f0-9ced-9b69d9f27a64';"

echo "=== Firing generate-base (S3 bucket fixed) ==="
echo "Start: $(date)"
curl -s -X POST \
  "http://localhost:3002/api/v1/scene-sets/5f3e952e-933e-41f0-9ced-9b69d9f27a64/generate-base" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "End: $(date)"
echo "=== DONE ==="
