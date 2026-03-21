#!/bin/bash
# Direct inline key test
KEY=$(grep RUNWAY_ML_API_KEY /home/ubuntu/episode-metadata/.env | head -1 | cut -d= -f2)
echo "Key prefix: ${KEY:0:20}..."
echo "Key length: ${#KEY}"

echo ""
echo "=== Org endpoint ==="
curl -sv "https://api.dev.runwayml.com/v1/organizations" \
  -H "Authorization: Bearer ${KEY}" \
  -H "X-Runway-Version: 2024-11-06" 2>&1 | grep -E "< HTTP|creditBalance|error"

echo ""
echo "=== Text to image ==="
curl -s -w "\nHTTP: %{http_code}\n" -X POST "https://api.dev.runwayml.com/v1/text_to_image" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen4_image","promptText":"A simple warm bedroom.","ratio":"1280:720"}'
