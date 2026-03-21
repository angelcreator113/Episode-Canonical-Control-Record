#!/bin/bash
# Debug: see full validation error from RunwayML text_to_image

source /home/ubuntu/episode-metadata/.env 2>/dev/null

API_KEY="${RUNWAY_ML_API_KEY}"
BASE="https://api.dev.runwayml.com/v1"

echo "=== Testing text_to_image with gen3a_turbo ==="
curl -s -X POST "${BASE}/text_to_image" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen3a_turbo","promptText":"A warm bedroom with cream walls and golden morning light.","ratio":"1280:720"}' \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "=== Testing text_to_image with gen4_image ==="
curl -s -X POST "${BASE}/text_to_image" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen4_image","promptText":"A warm bedroom with cream walls and golden morning light.","ratio":"1280:720"}' \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "=== Testing text_to_image with gen4_image_turbo ==="
curl -s -X POST "${BASE}/text_to_image" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen4_image_turbo","promptText":"A warm bedroom with cream walls and golden morning light.","ratio":"1280:720"}' \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "=== DONE ==="
