import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const CodigoInvitacion = sequelize.define('CodigoInvitacion', {
  id_codigo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  codigo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  id_profesor: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  id_grupo: {
    type: DataTypes.INTEGER,
    allowNull: true // Puede ser un código general para el profesor o específico para un grupo
  },
  usos_maximos: {
    type: DataTypes.INTEGER,
    allowNull: true, // Null significa usos ilimitados
    defaultValue: null
  },
  usos_actuales: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  fecha_expiracion: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Codigos_Invitacion',
  timestamps: true // Para saber cuándo se creó el código
});

export default CodigoInvitacion;
