#!/bin/bash
source /home/ubuntu/episode-metadata/.env 2>/dev/null
API_KEY="${RUNWAY_ML_API_KEY}"

echo "=== Full org response ==="
curl -s "https://api.dev.runwayml.com/v1/organizations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Runway-Version: 2024-11-06" \
  | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "=== Credit balance extraction ==="
curl -s "https://api.dev.runwayml.com/v1/organizations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Runway-Version: 2024-11-06" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('creditBalance:', d.get('creditBalance', 'NOT FOUND'))" 2>&1
