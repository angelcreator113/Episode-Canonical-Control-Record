#!/usr/bin/env python3
"""
Database Migration Runner using psycopg2
Connects directly to RDS PostgreSQL and creates tables
"""

import os
import sys
import subprocess

# Try to import psycopg2, install if needed
try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"], 
                          capture_output=True)
    if result.returncode == 0:
        import psycopg2
    else:
        print("Failed to install psycopg2. Trying alternative...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pg8000", "-q"], 
                      capture_output=True)
        import pg8000.native
        HAS_PG8000 = True

# Database configuration from environment
db_config = {
    'host': os.getenv('DB_HOST', 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'episode_metadata'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'EpisodeControl2024!Dev'),
}

print("\n╔════════════════════════════════════════════════════════════════╗")
print("║  Database Migration Runner                                    ║")
print("╚════════════════════════════════════════════════════════════════╝\n")

print(f"Database: {db_config['database']}")
print(f"User: {db_config['user']}")
print(f"Host: {db_config['host']}\n")

try:
    # Connect to database
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    print("✓ Database connection successful\n")
    
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
        conn.commit()
        print(f"✓ {table_name} table created\n")
    
    # Verify tables were created
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    tables_created = [row[0] for row in cursor.fetchall()]
    
    cursor.close()
    conn.close()
    
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  ✓ All migrations completed successfully!                      ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    print(f"Tables created: {', '.join(tables_created)}\n")
    
    sys.exit(0)
    
except Exception as e:
    print(f"\n✗ Migration failed: {str(e)}")
    print("\nAlternative: Try using pg8000...")
    sys.exit(1)

print("\n╔════════════════════════════════════════════════════════════════╗")
print("║  Database Migration Runner (Python)                          ║")
print("╚════════════════════════════════════════════════════════════════╝\n")

print(f"Database: {db_config['database']}")
print(f"User: {db_config['user']}")
print(f"Host: {db_config['host']}\n")

try:
    # Connect to database
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    print("✓ Database connection successful\n")
    
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
        conn.commit()
        print(f"✓ {table_name} table created\n")
    
    # Verify tables were created
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    tables_created = [row[0] for row in cursor.fetchall()]
    
    cursor.close()
    conn.close()
    
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  ✓ All migrations completed successfully!                      ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    print(f"Tables created: {', '.join(tables_created)}\n")
    
    sys.exit(0)
    
except Exception as e:
    print(f"\n✗ Migration failed: {str(e)}")
    sys.exit(1)
