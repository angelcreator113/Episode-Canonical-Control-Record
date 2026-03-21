#!/bin/bash
# Direct test: call RunwayML text_to_image with gen4_image and the actual prompt
source /home/ubuntu/episode-metadata/.env 2>/dev/null
API_KEY="${RUNWAY_ML_API_KEY}"

echo "=== Direct gen4_image test ==="
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://api.dev.runwayml.com/v1/text_to_image" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen4_image","promptText":"A warm bedroom with cream walls and golden morning light, soft linen bedding, personal vanity with mirror. Cinematic quality. No text overlays. No watermarks.","ratio":"1280:720"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP: ${HTTP_CODE}"
echo "Body: ${BODY}"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "=== SUCCESS - Generation started! ==="
  echo "$BODY" | python3 -m json.tool 2>/dev/null
else
  echo "=== FAILED ==="
  echo "$BODY" | python3 -m json.tool 2>/dev/null
fi
