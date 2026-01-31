/**
 * COMPREHENSIVE ASSET CORRUPTION FIX
 * 
 * Fixes:
 * 1. Copies raw→processed URLs for 45 assets (immediate unblock)
 * 2. Marks placeholder assets (logo/title) as needing replacement
 * 3. Adds missing_file metadata for 7 wardrobe items
 * 4. Soft-deletes duplicate assets (keeps newest)
 * 5. Updates missing metadata fields
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function fixAllCorruption() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 COMPREHENSIVE ASSET CORRUPTION FIX\n');
    console.log('='.repeat(70));
    
    // ═══════════════════════════════════════════════════════════
    // 1. FIX MISSING PROCESSED URLs (IMMEDIATE UNBLOCK)
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 1. FIXING MISSING PROCESSED URLs');
    console.log('-'.repeat(70));
    
    const [copyResult] = await sequelize.query(`
      UPDATE assets 
      SET 
        s3_url_processed = s3_url_raw,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'processing_status', 'copied_from_raw',
            'needs_processing', true,
            'fixed_at', NOW()
          )
      WHERE deleted_at IS NULL
        AND s3_url_raw IS NOT NULL
        AND s3_url_raw != ''
        AND s3_url_raw LIKE '%amazonaws.com%'
        AND (
          s3_url_processed IS NULL 
          OR s3_url_processed = ''
          OR s3_url_processed NOT LIKE '%amazonaws.com%'
        )
      RETURNING id, name;
    `, { transaction });
    
    console.log(`✅ Copied raw→processed URLs for ${copyResult.length} assets`);
    if (copyResult.length > 0) {
      console.log('   First 5 fixed:');
      copyResult.slice(0, 5).forEach(a => console.log(`   - ${a.name}`));
    }

    // ═══════════════════════════════════════════════════════════
    // 2. MARK PLACEHOLDER ASSETS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 2. MARKING PLACEHOLDER ASSETS');
    console.log('-'.repeat(70));
    
    const [placeholderResult] = await sequelize.query(`
      UPDATE assets 
      SET 
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'is_placeholder', true,
            'needs_real_upload', true,
            'placeholder_reason', 'Seeded data - replace with actual file',
            'marked_at', NOW()
          ),
        name = name || ' [PLACEHOLDER - NEEDS UPLOAD]'
      WHERE deleted_at IS NULL
        AND id IN (
          '6191f74f-72a6-4768-930e-dfd08a04b226',  -- Styling Adventures Logo
          '8a42c514-502e-4ad0-8eeb-0a9a531f20a6'   -- Episode Title Card
        )
        AND name NOT LIKE '%PLACEHOLDER%'
      RETURNING id, name, asset_type, asset_role;
    `, { transaction });
    
    console.log(`✅ Marked ${placeholderResult.length} placeholder assets`);
    placeholderResult.forEach(a => {
      console.log(`   - ${a.name}`);
      console.log(`     Type: ${a.asset_type}, Role: ${a.asset_role}`);
    });

    // ═══════════════════════════════════════════════════════════
    // 3. ADD MISSING_FILE STATUS FOR WARDROBE ITEMS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 3. MARKING WARDROBE ITEMS WITH MISSING FILES');
    console.log('-'.repeat(70));
    
    const [wardrobeResult] = await sequelize.query(`
      UPDATE assets 
      SET 
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'file_status', 'missing',
            'exclude_from_gallery', true,
            'needs_file_upload', true,
            'reason', 'Metadata-only record - no actual file uploaded yet',
            'marked_at', NOW()
          )
      WHERE deleted_at IS NULL
        AND (
          (s3_url_raw IS NULL OR s3_url_raw = '')
          AND (s3_url_processed IS NULL OR s3_url_processed = '')
          AND (s3_key_raw IS NULL OR s3_key_raw = '')
        )
        AND asset_type IN ('CLOTHING_LALA', 'CLOTHING_JUSTAWOMAN', 'CLOTHING_GUEST')
      RETURNING id, name, asset_type, asset_role;
    `, { transaction });
    
    console.log(`✅ Marked ${wardrobeResult.length} wardrobe items with missing files`);
    wardrobeResult.forEach(a => {
      console.log(`   - ${a.name} [${a.asset_type}]`);
    });

    // ═══════════════════════════════════════════════════════════
    // 4. SOFT-DELETE DUPLICATE ASSETS (KEEP NEWEST)
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 4. REMOVING DUPLICATE ASSETS (KEEPING NEWEST)');
    console.log('-'.repeat(70));
    
    // Find duplicates and keep only the newest (highest created_at)
    const [duplicateIds] = await sequelize.query(`
      WITH duplicates AS (
        SELECT 
          id,
          name,
          asset_type,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY name, asset_type 
            ORDER BY created_at DESC
          ) as rn
        FROM assets
        WHERE deleted_at IS NULL
      )
      SELECT id, name, asset_type
      FROM duplicates
      WHERE rn > 1
      ORDER BY created_at;
    `, { transaction });
    
    if (duplicateIds.length > 0) {
      const idsToDelete = duplicateIds.map(d => d.id);
      
      await sequelize.query(`
        UPDATE assets 
        SET 
          deleted_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object(
              'deletion_reason', 'duplicate',
              'deleted_by_script', 'fix-all-corrupted-assets.js',
              'deleted_at_timestamp', NOW()
            )
        WHERE id IN (:ids);
      `, { 
        replacements: { ids: idsToDelete },
        type: sequelize.QueryTypes.UPDATE,
        transaction 
      });
      
      console.log(`✅ Soft-deleted ${duplicateIds.length} duplicate assets`);
      console.log('   Deleted duplicates:');
      duplicateIds.slice(0, 10).forEach(d => {
        console.log(`   - ${d.name} [${d.asset_type}]`);
      });
      if (duplicateIds.length > 10) {
        console.log(`   ... and ${duplicateIds.length - 10} more`);
      }
    } else {
      console.log('✅ No duplicates to remove');
    }

    // ═══════════════════════════════════════════════════════════
    // 5. UPDATE MISSING METADATA
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 5. UPDATING MISSING METADATA FIELDS');
    console.log('-'.repeat(70));
    
    // Extract filename from S3 URL for missing file_name
    const [filenameResult] = await sequelize.query(`
      UPDATE assets 
      SET 
        file_name = SUBSTRING(s3_url_raw FROM '[^/]+$')
      WHERE deleted_at IS NULL
        AND (file_name IS NULL OR file_name = '')
        AND s3_url_raw IS NOT NULL
        AND s3_url_raw != ''
      RETURNING id, name, file_name;
    `, { transaction });
    
    console.log(`✅ Updated file_name for ${filenameResult.length} assets`);

    // Infer content_type from file extension
    const [contentTypeResult] = await sequelize.query(`
      UPDATE assets 
      SET 
        content_type = CASE 
          WHEN file_name ILIKE '%.jpg' OR file_name ILIKE '%.jpeg' THEN 'image/jpeg'
          WHEN file_name ILIKE '%.png' THEN 'image/png'
          WHEN file_name ILIKE '%.gif' THEN 'image/gif'
          WHEN file_name ILIKE '%.webp' THEN 'image/webp'
          WHEN file_name ILIKE '%.mp4' THEN 'video/mp4'
          WHEN file_name ILIKE '%.mov' THEN 'video/quicktime'
          WHEN file_name ILIKE '%.webm' THEN 'video/webm'
          ELSE 'application/octet-stream'
        END
      WHERE deleted_at IS NULL
        AND (content_type IS NULL OR content_type = '')
        AND file_name IS NOT NULL
      RETURNING id, name, file_name, content_type;
    `, { transaction });
    
    console.log(`✅ Updated content_type for ${contentTypeResult.length} assets`);

    // ═══════════════════════════════════════════════════════════
    // 6. FINAL VERIFICATION
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 VERIFICATION - AFTER FIXES');
    console.log('='.repeat(70));
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_assets,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_assets,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL 
          AND s3_url_processed IS NULL
        ) as still_missing_processed,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL 
          AND metadata->>'is_placeholder' = 'true'
        ) as placeholder_assets,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL 
          AND metadata->>'file_status' = 'missing'
        ) as missing_file_assets,
        COUNT(*) FILTER (
          WHERE deleted_at IS NULL 
          AND metadata->>'needs_processing' = 'true'
        ) as needs_processing
      FROM assets;
    `, { transaction });

    const s = stats[0];
    console.log(`Active Assets:           ${s.active_assets}`);
    console.log(`Deleted Assets:          ${s.deleted_assets}`);
    console.log(`Still Missing Processed: ${s.still_missing_processed} ${s.still_missing_processed === 0 ? '✅' : '⚠️'}`);
    console.log(`Placeholder Assets:      ${s.placeholder_assets}`);
    console.log(`Missing File Assets:     ${s.missing_file_assets}`);
    console.log(`Needs Processing:        ${s.needs_processing}`);

    // Commit transaction
    await transaction.commit();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL FIXES COMPLETED SUCCESSFULLY!\n');
    
    console.log('📝 NEXT STEPS:');
    console.log('   1. Upload real logo and title card images to replace placeholders');
    console.log('   2. Upload images for the 7 wardrobe items');
    console.log('   3. Set up proper image processing pipeline for thumbnails');
    console.log('   4. Add duplicate detection (checksum/hash) to upload endpoint');
    console.log('   5. Refresh your browser to see fixed assets\n');

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ ERROR DURING FIX:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the fix
fixAllCorruption()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
