import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Politica = sequelize.define('Politica', {
  id_politica: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clave: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'accion'
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'activo'
  },
  parametros: {
    type: DataTypes.JSON,
    defaultValue: {},
    field: 'condiciones'
  },
  mensaje_denegacion: {
    type: DataTypes.TEXT,
    field: 'mensaje_error'
  }
}, {
  tableName: 'Politicas',
  timestamps: true
});

export default Politica;
