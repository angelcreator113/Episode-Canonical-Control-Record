#!/bin/bash
SET_ID='1fda0e44-9620-4674-8d49-62de53e3d5e7'
BASE='http://localhost:3002/api/v1/scene-sets'

echo "Seeding 5 angles for set $SET_ID..."

curl -s -X POST "$BASE/$SET_ID/angles" \
  -H 'Content-Type: application/json' \
  -d '{"angle_label":"WIDE","angle_name":"Wide Morning","angle_description":"Full room, morning light flooding from the windows, bed centered.","beat_affinity":[1,2,3,13,14],"camera_direction":"Camera at door height looking into room. Window wall at right."}' | python3 -m json.tool

curl -s -X POST "$BASE/$SET_ID/angles" \
  -H 'Content-Type: application/json' \
  -d '{"angle_label":"WINDOW","angle_name":"Window Light","angle_description":"Camera facing the window, soft golden backlight. Lala silhouetted or three-quarter.","beat_affinity":[2,14],"camera_direction":"Camera opposite window, medium height, warm flare."}' | python3 -m json.tool

curl -s -X POST "$BASE/$SET_ID/angles" \
  -H 'Content-Type: application/json' \
  -d '{"angle_label":"VANITY","angle_name":"Vanity Ritual","angle_description":"Vanity mirror reflection. Skincare bottles, jewelry tray, soft ambient light.","beat_affinity":[3,6],"camera_direction":"Camera at mirror level, shallow depth of field."}' | python3 -m json.tool

curl -s -X POST "$BASE/$SET_ID/angles" \
  -H 'Content-Type: application/json' \
  -d '{"angle_label":"CLOSE","angle_name":"Notification Moment","angle_description":"Nightstand close-up — phone screen glow, a glass of water, small personal objects.","beat_affinity":[4,5,7],"camera_direction":"Overhead or 45 degree down. Tight crop on nightstand surface."}' | python3 -m json.tool

curl -s -X POST "$BASE/$SET_ID/angles" \
  -H 'Content-Type: application/json' \
  -d '{"angle_label":"DOORWAY","angle_name":"Doorway Arrival","angle_description":"Standing at the bedroom door looking in. Threshold moment — arrival or departure.","beat_affinity":[1],"camera_direction":"Camera at doorframe, slightly wide, hallway light spilling in."}' | python3 -m json.tool

echo "--- Done seeding 5 angles ---"
