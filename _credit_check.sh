#!/bin/bash
source /home/ubuntu/episode-metadata/.env 2>/dev/null
API_KEY="${RUNWAY_ML_API_KEY}"

echo "=== Credit check ==="
curl -s "https://api.dev.runwayml.com/v1/organizations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Runway-Version: 2024-11-06" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Credits:', d.get('creditBalance','?'))" 2>/dev/null

echo ""
echo "=== Quick gen4_image test ==="
HTTP=$(curl -s -o /tmp/_runway_resp.json -w "%{http_code}" -X POST "https://api.dev.runwayml.com/v1/text_to_image" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Runway-Version: 2024-11-06" \
  -d '{"model":"gen4_image","promptText":"A simple warm bedroom test.","ratio":"1280:720"}')
echo "HTTP: $HTTP"
cat /tmp/_runway_resp.json | python3 -m json.tool 2>/dev/null
echo ""
echo "=== DONE ==="
