#!/usr/bin/env python3
"""
Database Migration Runner using pg8000 (Pure Python PostgreSQL driver)
No system dependencies required!
"""

import os
import sys
import pg8000.dbapi

# Database configuration
config = {
    'host': os.getenv('DB_HOST', 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'episode_metadata'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'EpisodeControl2024!Dev'),
}

print("\n╔════════════════════════════════════════════════════════════════╗")
print("║  Database Migration Runner (pg8000)                          ║")
print("╚════════════════════════════════════════════════════════════════╝\n")

print(f"Database: {config['database']}")
print(f"User: {config['user']}")
print(f"Host: {config['host']}\n")

try:
    # First, connect to default 'postgres' database to create episode_metadata if needed
    admin_conn = pg8000.dbapi.connect(
        host=config['host'],
        user=config['user'],
        password=config['password'],
        database='postgres',  # Connect to default database first
        port=config['port']
    )
    admin_conn.autocommit = True
    admin_cursor = admin_conn.cursor()
    
    # Check if database exists, create if not
    admin_cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{config['database']}'")
    db_exists = admin_cursor.fetchone()
    
    if not db_exists:
        print(f"→ Creating database '{config['database']}'...")
        admin_cursor.execute(f"CREATE DATABASE {config['database']}")
        print(f"✓ Database '{config['database']}' created\n")
    else:
        print(f"✓ Database '{config['database']}' already exists\n")
    
    admin_cursor.close()
    admin_conn.close()
    
    # Now connect to the actual database
    conn = pg8000.dbapi.connect(
        host=config['host'],
        user=config['user'],
        password=config['password'],
        database=config['database'],
        port=config['port']
    )
    cursor = conn.cursor()
    print("✓ Connected to episode_metadata database\n")
    
    # SQL commands to create tables
    tables = {
        'episodes': """
            CREATE TABLE IF NOT EXISTS episodes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                duration INTEGER,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """,
        'metadata_storage': """
            CREATE TABLE IF NOT EXISTS metadata_storage (
                id SERIAL PRIMARY KEY,
                episode_id INTEGER REFERENCES episodes(id),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """,
        'thumbnails': """
            CREATE TABLE IF NOT EXISTS thumbnails (
                id SERIAL PRIMARY KEY,
                episode_id INTEGER REFERENCES episodes(id),
                url VARCHAR(255),
                size_bytes INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """,
        'processing_queue': """
            CREATE TABLE IF NOT EXISTS processing_queue (
                id SERIAL PRIMARY KEY,
                episode_id INTEGER REFERENCES episodes(id),
                task VARCHAR(100),
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """,
        'activity_logs': """
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255),
                action VARCHAR(100),
                resource_type VARCHAR(100),
                resource_id INTEGER,
                changes JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """
    }
    
    # Execute each CREATE TABLE command
    for table_name, sql in tables.items():
        print(f"→ Creating {table_name} table...")
        cursor.execute(sql)
        print(f"✓ {table_name} table created\n")
    
    # Commit all changes
    conn.commit()
    print("✓ All changes committed to database\n")
    
    # Verify tables were created
    print("Verifying tables...")
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    tables_created = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    
    print("\n╔════════════════════════════════════════════════════════════════╗")
    print("║  ✓ All migrations completed successfully!                      ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    print(f"Tables created: {', '.join(tables_created)}\n")
    
    sys.exit(0)
    
except Exception as e:
    print(f"\n✗ Migration failed: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
