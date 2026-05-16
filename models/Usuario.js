import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  bloqueado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  id_rol: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Usuarios',
  timestamps: false
});

export default Usuario;
