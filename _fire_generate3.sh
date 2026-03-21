#!/bin/bash
# Reset status + fire + read fresh logs
PGPASSWORD=Ayanna123!! psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -t -c "UPDATE scene_sets SET generation_status = 'pending' WHERE id = '5f3e952e-933e-41f0-9ced-9b69d9f27a64';"

echo "=== Firing generate-base ==="
RESULT=$(curl -s -X POST "http://localhost:3002/api/v1/scene-sets/5f3e952e-933e-41f0-9ced-9b69d9f27a64/generate-base" -H "Content-Type: application/json")
echo "Response: $RESULT"

echo ""
echo "=== Error log (last 30 lines) ==="
sleep 1
tail -30 /home/ubuntu/episode-metadata/logs/dev-error-2.log

echo ""
echo "=== Out log (last 10 lines) ==="
tail -10 /home/ubuntu/episode-metadata/logs/dev-out-2.log
