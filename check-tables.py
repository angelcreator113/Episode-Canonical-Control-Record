#!/usr/bin/env python3
import pg8000.dbapi

conn = pg8000.dbapi.connect(
    host='episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    user='postgres',
    password='EpisodeControl2024!Dev',
    database='episode_metadata',
    port=5432
)

cursor = conn.cursor()
cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
tables = cursor.fetchall()

print("\nTables in episode_metadata database:")
if tables:
    for table in tables:
        print(f"  - {table[0]}")
else:
    print("  No tables found")

cursor.close()
conn.close()
