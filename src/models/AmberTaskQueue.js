'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AmberTaskQueue extends Model {}

  AmberTaskQueue.init({
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title:             { type: DataTypes.STRING, allowNull: false },
    description:       { type: DataTypes.TEXT },
    type:              { type: DataTypes.STRING, defaultValue: 'feature' },
    priority:          { type: DataTypes.STRING, defaultValue: 'medium' },
    status:            { type: DataTypes.STRING, defaultValue: 'backlog' },
    source:            { type: DataTypes.STRING },
    linked_finding_id: { type: DataTypes.UUID },
    spec:              { type: DataTypes.TEXT },
    spec_approved:     { type: DataTypes.BOOLEAN, defaultValue: false },
    amber_notes:       { type: DataTypes.TEXT },
  }, {
    sequelize,
    modelName:   'AmberTaskQueue',
    tableName:   'amber_task_queue',
    underscored: true,
    paranoid:    false,
  });

  return AmberTaskQueue;
};
