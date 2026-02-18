#!/bin/bash
export PGPASSWORD='Ayanna123!!'
export PGSSLMODE=require
H=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com

echo '=== TABLES ==='
psql -h $H -U postgres -d episode_metadata -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"

echo '=== TIMELINE_DATA COLS ==='
psql -h $H -U postgres -d episode_metadata -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name='timeline_data' ORDER BY ordinal_position"

echo '=== SEQUELIZE META ==='
psql -h $H -U postgres -d episode_metadata -t -A -c "SELECT name FROM \"SequelizeMeta\" ORDER BY name"

echo '=== SCENES MISSING COLS CHECK ==='
for col in duration_auto layout background_url ui_elements dialogue_clips raw_footage_s3_key ai_scene_detected ai_confidence_score; do
  exists=$(psql -h $H -U postgres -d episode_metadata -t -A -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='scenes' AND column_name='$col'")
  echo "$col: $exists"
done
