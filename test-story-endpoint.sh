#!/bin/bash
curl -s -X POST http://localhost:3002/api/v1/memories/generate-story-tasks \
  -H 'Content-Type: application/json' \
  -d '{"characterKey":"justawoman"}' | head -c 2000
echo ""
