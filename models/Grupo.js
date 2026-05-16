import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Grupo = sequelize.define('Grupo', {
  id_grupo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT
  },
  id_profesor: {
    type: DataTypes.INTEGER,
    allowNull: true // El tutor del grupo
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Grupos',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion'
});

export default Grupo;
