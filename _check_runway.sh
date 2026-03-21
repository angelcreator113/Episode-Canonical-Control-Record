#!/bin/bash
cd /home/ubuntu/episode-metadata
RUNWAY_KEY=$(grep RUNWAY_ML_API_KEY .env | cut -d= -f2 | tr -d '"' | tr -d "'")
echo "=== RUNWAY API MODELS ==="
curl -s -H "Authorization: Bearer $RUNWAY_KEY" https://api.runwayml.com/v1/models
echo ""
echo "=== SERVICE ENDPOINT CALLS ==="
grep -n "api.runwayml.com\|runwayml\|endpoint\|image_to_video\|text_to_image\|text-to-image\|image-to-video\|generations" src/services/sceneGenerationService.js
echo ""
echo "=== DONE ==="
