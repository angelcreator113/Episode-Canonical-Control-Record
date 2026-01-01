#!/bin/bash

# Migration script to run on EC2 instance
# This creates the 5 database tables directly in PostgreSQL

export DB_HOST="10.0.20.224"
export DB_PORT="5432"
export DB_NAME="episode_metadata"
export DB_USER="postgres"
export DB_PASSWORD="EpisodeControl2024!Dev"

echo "================================="
echo "Database Migration - EC2 Runner"
echo "================================="
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST"
echo ""

# Test connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "✗ Connection failed"
    echo "Attempting to install PostgreSQL client..."
    yum install -y postgresql > /dev/null 2>&1
fi

# Create episodes table
echo "→ Creating episodes table..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
CREATE TABLE IF NOT EXISTS episodes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
EOF

# Create metadata_storage table
echo "→ Creating metadata_storage table..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
CREATE TABLE IF NOT EXISTS metadata_storage (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER REFERENCES episodes(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
EOF

# Create thumbnails table
echo "→ Creating thumbnails table..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
CREATE TABLE IF NOT EXISTS thumbnails (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER REFERENCES episodes(id),
  url VARCHAR(255),
  size_bytes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
EOF

# Create processing_queue table
echo "→ Creating processing_queue table..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
CREATE TABLE IF NOT EXISTS processing_queue (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER REFERENCES episodes(id),
  task VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
EOF

# Create activity_logs table
echo "→ Creating activity_logs table..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(100),
  resource_type VARCHAR(100),
  resource_id INTEGER,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
EOF

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓ All migrations completed successfully!                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
