import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const LogAccion = sequelize.define('LogAccion', {
  id_log_accion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_cliente: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  accion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  seccion: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'SISTEMA'
  },
  nivel: {
    type: DataTypes.ENUM('info', 'warning', 'danger'),
    allowNull: true,
    defaultValue: 'info'
  },
  exito: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'ip'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    field: 'fecha'
  }
}, {
  tableName: 'Logs_Acciones',
  timestamps: false,
  indexes: [
    { fields: ['id_usuario'] },
    { fields: ['id_cliente'] },
    { fields: ['accion'] },
    { fields: ['seccion'] },
    { fields: ['fecha'] }
  ]
});

export default LogAccion;
