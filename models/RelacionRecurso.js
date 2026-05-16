import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RelacionRecurso = sequelize.define('RelacionRecurso', {
  id_relacion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_tipo_entidad: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_tipo_recurso: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_entidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  id_recurso: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  relacion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Relaciones_Recursos',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: false
});

export default RelacionRecurso;
