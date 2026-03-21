#!/bin/bash
# Reset scene set status and fire generate-base
PGPASSWORD=Ayanna123!! psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -t -c "UPDATE scene_sets SET generation_status = 'pending', base_runway_seed = NULL WHERE id = '5f3e952e-933e-41f0-9ced-9b69d9f27a64';"

echo "=== Status reset. Firing generate-base ==="
echo "Time: $(date)"
curl -s -X POST \
  "http://localhost:3002/api/v1/scene-sets/5f3e952e-933e-41f0-9ced-9b69d9f27a64/generate-base" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "Time: $(date)"
echo "=== DONE ==="
