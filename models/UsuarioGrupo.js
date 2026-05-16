import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const UsuarioGrupo = sequelize.define('UsuarioGrupo', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  id_grupo: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  fecha_ingreso: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Usuarios_Grupos',
  timestamps: false
});

export default UsuarioGrupo;
