import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TipoRol = sequelize.define('TipoRol', {
  id_tipo_rol: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'TipoRoles',
  timestamps: false
});

export default TipoRol;
