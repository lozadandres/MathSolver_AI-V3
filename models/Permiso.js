import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Permiso = sequelize.define('Permiso', {
  id_permiso: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Ej: 'PROBLEMAS_CREAR', 'USUARIOS_BLOQUEAR'
  },
  descripcion: {
    type: DataTypes.TEXT
  },
  recurso: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'General'
  }
}, {
  tableName: 'Permisos',
  timestamps: false
});

export default Permiso;
