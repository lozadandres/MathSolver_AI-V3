import sequelize from '../config/db.js';
import Usuario from './Usuario.js';
import Rol from './Rol.js';
import Token from './Token.js';
import RelacionRecurso from './RelacionRecurso.js';
import Configuracion from './Configuracion.js';
import CodigoInvitacion from './CodigoInvitacion.js';
import Grupo from './Grupo.js';
import Permiso from './Permiso.js';
import RolPermiso from './RolPermiso.js';
import UsuarioGrupo from './UsuarioGrupo.js';
import TipoRol from './TipoRol.js';
import LogAuditoria from './LogAuditoria.js';
import Politica from './Politica.js';
import ClienteAcceso from './ClienteAcceso.js';
import LogAccion from './LogAccion.js';
import LogSesion from './LogSesion.js';
import Documento from './Documento.js';

// ---- Asociaciones (Relaciones) ----

// Usuario -> Rol (1 a Muchos inverso)
Usuario.belongsTo(Rol, { foreignKey: 'id_rol', as: 'rol' });
Rol.hasMany(Usuario, { foreignKey: 'id_rol', as: 'usuarios' });

// Rol -> TipoRol (Muchos a 1)
Rol.belongsTo(TipoRol, { foreignKey: 'id_tipo_rol', as: 'tipo' });
TipoRol.hasMany(Rol, { foreignKey: 'id_tipo_rol', as: 'roles' });

// Usuario -> Token (1 a Muchos)
Usuario.hasMany(Token, { foreignKey: 'id_usuario', as: 'tokens' });
Token.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

// Relaciones Polimórficas ReBAC (Entidades vs Recursos)
Usuario.hasMany(RelacionRecurso, { foreignKey: 'id_entidad', as: 'relaciones_recursos' });
RelacionRecurso.belongsTo(Usuario, { foreignKey: 'id_entidad', as: 'entidad_usuario' });

// Usuario <-> Configuracion (1 a 1)
Usuario.hasOne(Configuracion, { foreignKey: 'id_usuario', as: 'configuracion' });
Configuracion.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario_configuracion' });

// Usuario (Profesor) -> CodigosInvitacion
Usuario.hasMany(CodigoInvitacion, { foreignKey: 'id_profesor', as: 'codigos' });
CodigoInvitacion.belongsTo(Usuario, { foreignKey: 'id_profesor', as: 'profesor' });
CodigoInvitacion.belongsTo(Grupo, { foreignKey: 'id_grupo', as: 'grupo' });
Grupo.hasMany(CodigoInvitacion, { foreignKey: 'id_grupo', as: 'codigos_invitacion' });

// ---- NUEVAS RELACIONES ----

// Rol <-> Permiso (Muchos a Muchos)
Rol.belongsToMany(Permiso, { through: RolPermiso, foreignKey: 'id_rol', as: 'permisos' });
Permiso.belongsToMany(Rol, { through: RolPermiso, foreignKey: 'id_permiso', as: 'roles' });

// Usuario (Profesor) -> Grupo (Tutoría)
Usuario.hasMany(Grupo, { foreignKey: 'id_profesor', as: 'grupos_tutorados' });
Grupo.belongsTo(Usuario, { foreignKey: 'id_profesor', as: 'tutor' });

// Usuario <-> Grupo (Muchos a Muchos - Alumnos en grupos)
Usuario.belongsToMany(Grupo, { through: UsuarioGrupo, foreignKey: 'id_usuario', as: 'mis_grupos' });
Grupo.belongsToMany(Usuario, { through: UsuarioGrupo, foreignKey: 'id_grupo', as: 'integrantes' });

// Usuario -> Logs de Auditoria
Usuario.hasMany(LogAuditoria, { foreignKey: 'id_usuario', as: 'logs_auditoria' });
LogAuditoria.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

// Usuario -> Clientes, acciones y sesiones
Usuario.hasMany(ClienteAcceso, { foreignKey: 'id_usuario', as: 'clientes_acceso' });
ClienteAcceso.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
Usuario.hasMany(LogAccion, { foreignKey: 'id_usuario', as: 'logs_acciones' });
LogAccion.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
ClienteAcceso.hasMany(LogAccion, { foreignKey: 'id_cliente', as: 'acciones' });
LogAccion.belongsTo(ClienteAcceso, { foreignKey: 'id_cliente', as: 'cliente' });
Usuario.hasMany(LogSesion, { foreignKey: 'id_usuario', as: 'logs_sesiones' });
LogSesion.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
ClienteAcceso.hasMany(LogSesion, { foreignKey: 'id_cliente', as: 'sesiones' });
LogSesion.belongsTo(ClienteAcceso, { foreignKey: 'id_cliente', as: 'cliente' });
Token.hasMany(LogSesion, { foreignKey: 'id_token', as: 'logs_sesiones' });
LogSesion.belongsTo(Token, { foreignKey: 'id_token', as: 'token' });

// Documentos de clase
Grupo.hasMany(Documento, { foreignKey: 'id_grupo', as: 'documentos' });
Documento.belongsTo(Grupo, { foreignKey: 'id_grupo', as: 'grupo' });
Usuario.hasMany(Documento, { foreignKey: 'id_usuario_creador', as: 'documentos_creados' });
Documento.belongsTo(Usuario, { foreignKey: 'id_usuario_creador', as: 'creador' });

export {
  sequelize,
  Usuario,
  Rol,
  Token,
  RelacionRecurso,
  Configuracion,
  CodigoInvitacion,
  Grupo,
  Permiso,
  RolPermiso,
  UsuarioGrupo,
  TipoRol,
  LogAuditoria,
  Politica,
  ClienteAcceso,
  LogAccion,
  LogSesion,
  Documento
};
