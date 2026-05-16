import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Configuracion = sequelize.define('Configuracion', {
  id_configuracion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tema: {
    type: DataTypes.STRING,
    defaultValue: 'dark', // 'dark' o 'light'
    allowNull: false
  },
  idioma: {
    type: DataTypes.STRING,
    defaultValue: 'es',
    allowNull: false
  }
}, {
  tableName: 'Configuraciones',
  timestamps: false
});

export default Configuracion;
