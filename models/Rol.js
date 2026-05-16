import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Rol = sequelize.define('Rol', {
  id_rol: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  descripcion: DataTypes.TEXT,
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  id_tipo_rol: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Roles',
  timestamps: false
});

export default Rol;
