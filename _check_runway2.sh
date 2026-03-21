#!/bin/bash
cd /home/ubuntu/episode-metadata
RUNWAY_KEY=$(grep RUNWAY_ML_API_KEY .env | cut -d= -f2 | tr -d '"' | tr -d "'")
echo "=== CREDIT CHECK (api.dev.runwayml.com) ==="
curl -s -H "Authorization: Bearer $RUNWAY_KEY" \
     -H "X-Runway-Version: 2024-11-06" \
     https://api.dev.runwayml.com/v1/organization
echo ""
echo "=== DONE ==="
