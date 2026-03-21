#!/bin/bash
PGPASSWORD=Ayanna123!! psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com -U postgres -d episode_metadata -t -c "SELECT generation_status, base_runway_seed, base_runway_prompt IS NOT NULL as has_prompt FROM scene_sets WHERE id='5f3e952e-933e-41f0-9ced-9b69d9f27a64';"
