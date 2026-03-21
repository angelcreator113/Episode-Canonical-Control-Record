#!/bin/bash
source /home/ubuntu/episode-metadata/.env 2>/dev/null

echo "=== Reset scene set status ==="
PGPASSWORD=Ayanna123!! psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -c "UPDATE scene_sets SET generation_status = 'pending' WHERE id = '5f3e952e-933e-41f0-9ced-9b69d9f27a64';"

echo ""
echo "=== Firing generate-base ==="
curl -s -X POST \
  "http://localhost:3002/api/v1/scene-sets/5f3e952e-933e-41f0-9ced-9b69d9f27a64/generate-base" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "=== DONE ==="
