import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Token = sequelize.define('Token', {
  id_token: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  esta_activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  fecha_expiracion: {
    type: DataTypes.DATE,
    allowNull: false
  },
  user_agent: DataTypes.TEXT,
  motivo_revocacion: DataTypes.TEXT
}, {
  tableName: 'Tokens',
  timestamps: false
});

export default Token;
