const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const QRToken = sequelize.define('QRToken', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  session_id: { type: DataTypes.UUID, allowNull: false },
  token:      { type: DataTypes.STRING(100), unique: true, allowNull: false },
  issued_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used:       { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName:  'qr_tokens',
  underscored: true,
  timestamps: false,
});

module.exports = QRToken;