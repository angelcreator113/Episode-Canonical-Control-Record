// ─── WardrobeOrderLine.js ────────────────────────────────────────────────────
// One real-world order line imported from Amazon's order history CSV
// (migration 20261013100000; Task #3102): order id + ASIN (unique), the date,
// product name, prices, quantity; its wardrobe piece once matched. No address,
// payment or email is stored. Nothing in-world reads it (services/wardrobeOrderImport.js).
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WardrobeOrderLine extends Model {
    static associate(_models) {}
  }
  WardrobeOrderLine.init({
    id:          { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    show_id:     { type: DataTypes.UUID, allowNull: true, references: { model: 'shows', key: 'id' } },
    order_id:    { type: DataTypes.STRING(40), allowNull: false },
    asin:        { type: DataTypes.STRING(20), allowNull: false },
    title:       { type: DataTypes.TEXT, allowNull: false },
    order_date:  { type: DataTypes.DATEONLY, allowNull: true },
    price_paid:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    list_price:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    quantity:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    currency:    { type: DataTypes.STRING(8), allowNull: true },
    website:     { type: DataTypes.STRING(40), allowNull: true },
    wardrobe_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'wardrobe', key: 'id' } },
    status:      { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'unmatched' },
    matched_at:  { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize, modelName: 'WardrobeOrderLine',
    tableName: 'wardrobe_order_lines', underscored: true,
    paranoid: true,
  });
  return WardrobeOrderLine;
};
