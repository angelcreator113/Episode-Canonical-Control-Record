-- ========================================================================
-- Episode Metadata Database Migration Script
-- Run this in AWS RDS Query Editor
-- ========================================================================

-- Create episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create metadata_storage table
CREATE TABLE IF NOT EXISTS metadata_storage (
    id SERIAL PRIMARY KEY,
    episode_id INTEGER REFERENCES episodes(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create thumbnails table
CREATE TABLE IF NOT EXISTS thumbnails (
    id SERIAL PRIMARY KEY,
    episode_id INTEGER REFERENCES episodes(id),
    url VARCHAR(255),
    size_bytes INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create processing_queue table
CREATE TABLE IF NOT EXISTS processing_queue (
    id SERIAL PRIMARY KEY,
    episode_id INTEGER REFERENCES episodes(id),
    task VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id INTEGER,
    changes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
