import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const LogSesion = sequelize.define('LogSesion', {
  id_log_sesion: {
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
  id_token: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  token_hash: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'token'
  },
  estado: {
    type: DataTypes.ENUM('ACTIVA', 'CERRADA', 'EXPIRADA', 'REVOCADA'),
    allowNull: true,
    defaultValue: 'ACTIVA'
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
  fecha_inicio: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Logs_Sesiones',
  timestamps: false,
  indexes: [
    { fields: ['id_usuario'] },
    { fields: ['id_cliente'] },
    { fields: ['id_token'] },
    { fields: ['estado'] },
    { fields: ['fecha_inicio'] }
  ]
});

export default LogSesion;
