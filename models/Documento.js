import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Documento = sequelize.define('Documento', {
  id_documento: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_grupo: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_usuario_creador: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'archivo'
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  archivo_url: {
    type: DataTypes.TEXT
  },
  mime_type: {
    type: DataTypes.STRING
  },
  visible_estudiantes: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Documentos',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion'
});

export default Documento;
