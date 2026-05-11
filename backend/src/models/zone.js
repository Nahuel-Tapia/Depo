const { Model, DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

class Zone extends Model {}
Zone.init({
  name: { type: DataTypes.STRING, allowNull: false },
  nivel_educativo: { type: DataTypes.STRING, allowNull: false }, // nivel asignado a la zona
  director_area_id: { type: DataTypes.INTEGER, allowNull: false }, // usuario que creó la zona
}, { sequelize, modelName: 'Zone' });

module.exports = { Zone };
