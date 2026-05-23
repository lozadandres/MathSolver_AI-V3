import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const LogAuditoria = sequelize.define('LogAuditoria', {
  id_log: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  accion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  seccion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nivel: {
    type: DataTypes.ENUM('info', 'warning', 'danger'),
    allowNull: false,
    defaultValue: 'info'
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'Logs_Auditoria',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: false,
  indexes: [
    { fields: ['id_usuario'] },
    { fields: ['accion'] },
    { fields: ['seccion'] },
    { fields: ['nivel'] },
    { fields: ['fecha_creacion'] }
  ]
});

export default LogAuditoria;
