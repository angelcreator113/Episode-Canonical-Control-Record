'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔧 Starting assets table migration...');

      // Add approval_status ENUM
      console.log('  Adding approval_status...');
      await queryInterface.sequelize.query(
        `
        DO $$ BEGIN
          CREATE TYPE enum_assets_approval_status AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `,
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'approval_status',
        {
          type: 'enum_assets_approval_status',
          allowNull: false,
          defaultValue: 'PENDING',
        },
        { transaction }
      );

      // Add raw image fields
      console.log('  Adding raw image fields...');
      await queryInterface.addColumn(
        'assets',
        's3_key_raw',
        {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        's3_url_raw',
        {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'file_size_bytes',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction }
      );

      // Add processed image fields
      console.log('  Adding processed image fields...');
      await queryInterface.addColumn(
        'assets',
        's3_key_processed',
        {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        's3_url_processed',
        {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'processed_file_size_bytes',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction }
      );

      // Add dimensions
      console.log('  Adding dimension fields...');
      await queryInterface.addColumn(
        'assets',
        'width',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'height',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction }
      );

      // Add processing info
      console.log('  Adding processing fields...');
      await queryInterface.addColumn(
        'assets',
        'processing_job_id',
        {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'processing_error',
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'assets',
        'processed_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // Add soft delete
      console.log('  Adding soft delete field...');
      await queryInterface.addColumn(
        'assets',
        'deleted_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // Add indexes
      console.log('  Adding indexes...');
      await queryInterface.addIndex('assets', ['asset_type'], {
        name: 'idx_assets_type',
        transaction,
      });

      await queryInterface.addIndex('assets', ['approval_status'], {
        name: 'idx_assets_status',
        transaction,
      });

      await queryInterface.addIndex('assets', ['asset_type', 'approval_status'], {
        name: 'idx_assets_type_status',
        transaction,
      });

      await queryInterface.addIndex('assets', ['created_at'], {
        name: 'idx_assets_created',
        transaction,
      });

      // Migrate existing data
      console.log('  Migrating existing data...');
      await queryInterface.sequelize.query(
        `
        UPDATE assets 
        SET 
          s3_key_raw = s3_key,
          s3_url_raw = url,
          approval_status = 'APPROVED'
        WHERE s3_key IS NOT NULL OR url IS NOT NULL;
      `,
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Assets table migration complete!');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, _Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back assets table migration...');

      // Remove indexes
      await queryInterface.removeIndex('assets', 'idx_assets_type', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_status', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_type_status', { transaction });
      await queryInterface.removeIndex('assets', 'idx_assets_created', { transaction });

      // Remove columns
      await queryInterface.removeColumn('assets', 'approval_status', { transaction });
      await queryInterface.removeColumn('assets', 's3_key_raw', { transaction });
      await queryInterface.removeColumn('assets', 's3_url_raw', { transaction });
      await queryInterface.removeColumn('assets', 'file_size_bytes', { transaction });
      await queryInterface.removeColumn('assets', 's3_key_processed', { transaction });
      await queryInterface.removeColumn('assets', 's3_url_processed', { transaction });
      await queryInterface.removeColumn('assets', 'processed_file_size_bytes', { transaction });
      await queryInterface.removeColumn('assets', 'width', { transaction });
      await queryInterface.removeColumn('assets', 'height', { transaction });
      await queryInterface.removeColumn('assets', 'processing_job_id', { transaction });
      await queryInterface.removeColumn('assets', 'processing_error', { transaction });
      await queryInterface.removeColumn('assets', 'processed_at', { transaction });
      await queryInterface.removeColumn('assets', 'deleted_at', { transaction });

      // Drop ENUM type
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_assets_approval_status;', {
        transaction,
      });

      await transaction.commit();
      console.log('✅ Rollback complete');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  },
};
