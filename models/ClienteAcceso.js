import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const ClienteAcceso = sequelize.define('ClienteAcceso', {
  id_cliente: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  fingerprint: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dispositivo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  navegador: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sistema_operativo: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'sistema'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ultimo_acceso: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Clientes_Acceso',
  timestamps: false,
  indexes: [
    { fields: ['id_usuario'] },
    { fields: ['fingerprint'] }
  ]
});

export default ClienteAcceso;
