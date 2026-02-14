/**
 * Audit Log Model
 * Tracks all user actions for compliance and audit purposes
 */

module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');

  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who performed the action',
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Username for audit trail',
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Action performed (CREATE, READ, UPDATE, DELETE, APPROVE, REJECT, etc)',
      },
      resource: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Resource type (Episode, Asset, Template, User, etc)',
      },
      resourceId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID of the affected resource',
      },
      resourceName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Human-readable name of the resource',
      },
      changes: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Before/after changes',
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP address of the request',
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent string',
      },
      status: {
        type: DataTypes.ENUM('SUCCESS', 'FAILURE', 'WARNING'),
        defaultValue: 'SUCCESS',
      },
      description: {
        type: DataTypes.TEXT,
        defaultValue: '',
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Additional contextual data',
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'audit_logs',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          fields: ['userId'],
        },
        {
          fields: ['action'],
        },
        {
          fields: ['resource'],
        },
        {
          fields: ['resourceId'],
        },
        {
          fields: ['createdAt'],
        },
      ],
    }
  );

  return AuditLog;
};
