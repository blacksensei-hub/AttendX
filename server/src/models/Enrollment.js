const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  student_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  class_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  enrolled_at: {
    type:         DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName:   'enrollments',
  underscored: true,
  timestamps:  false,
  indexes: [
    { unique: true, fields: ['student_id', 'class_id'] }
  ],
});

module.exports = Enrollment;