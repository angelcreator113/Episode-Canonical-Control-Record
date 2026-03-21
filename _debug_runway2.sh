#!/bin/bash
source /home/ubuntu/episode-metadata/.env 2>/dev/null
API_KEY="${RUNWAY_ML_API_KEY}"
BASE="https://api.dev.runwayml.com/v1"

echo "=== Testing image_to_video model validation ==="
curl -s -X POST "${BASE}/image_to_video" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen3a_turbo","promptText":"test","promptImage":"https://example.com/test.jpg","ratio":"1280:720","duration":5}' \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "=== Testing with WRONG model to see valid list ==="
curl -s -X POST "${BASE}/image_to_video" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"INVALID","promptText":"test","promptImage":"https://example.com/test.jpg","ratio":"1280:720","duration":5}' \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "=== DONE ==="
