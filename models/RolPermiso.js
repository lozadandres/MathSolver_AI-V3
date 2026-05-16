import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RolPermiso = sequelize.define('RolPermiso', {
  id_rol: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  id_permiso: {
    type: DataTypes.INTEGER,
    primaryKey: true
  }
}, {
  tableName: 'Roles_Permisos',
  timestamps: false
});

export default RolPermiso;
