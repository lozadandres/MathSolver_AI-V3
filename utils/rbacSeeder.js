import { Rol, Permiso, RolPermiso } from '../models/index.js';

const defaultPermissions = [
    { nombre: 'admin:*', descripcion: 'Acceso total al panel administrativo', recurso: 'Admin' },
    { nombre: 'admin:logs:read', descripcion: 'Ver auditoría, sesiones y estadísticas de seguridad', recurso: 'Admin - Logs' },
    { nombre: 'admin:usuarios:read', descripcion: 'Ver usuarios y sus cargos contextuales', recurso: 'Admin - Usuarios' },
    { nombre: 'admin:usuarios:write', descripcion: 'Crear, editar, bloquear y asignar usuarios', recurso: 'Admin - Usuarios' },
    { nombre: 'admin:usuarios:delete', descripcion: 'Eliminar usuarios', recurso: 'Admin - Usuarios' },
    { nombre: 'admin:grupos:read', descripcion: 'Ver grupos y miembros', recurso: 'Admin - Grupos' },
    { nombre: 'admin:grupos:write', descripcion: 'Crear grupos y gestionar miembros/cargos', recurso: 'Admin - Grupos' },
    { nombre: 'admin:grupos:delete', descripcion: 'Eliminar o revocar relaciones de grupos', recurso: 'Admin - Grupos' },
    { nombre: 'admin:roles:read', descripcion: 'Ver roles, perfiles y permisos', recurso: 'Admin - Roles' },
    { nombre: 'admin:roles:write', descripcion: 'Crear y editar roles o asignar permisos', recurso: 'Admin - Roles' },
    { nombre: 'admin:roles:delete', descripcion: 'Revocar permisos de roles', recurso: 'Admin - Roles' },
    { nombre: 'read:documento', descripcion: 'Leer documentos disponibles', recurso: 'Documentos' },
    { nombre: 'edit:documento', descripcion: 'Editar documentos', recurso: 'Documentos' },
    { nombre: 'delete:documento', descripcion: 'Eliminar documentos', recurso: 'Documentos' },
    { nombre: 'edit:documento_own', descripcion: 'Editar documentos propios', recurso: 'Documentos' },
    { nombre: 'CHAT_IA', descripcion: 'Usar el chat con IA', recurso: 'Chat' },
    { nombre: 'CODIGOS_GESTIONAR', descripcion: 'Crear, listar y desactivar codigos de invitacion', recurso: 'Profesor' },
    { nombre: 'GRUPOS_GESTIONAR', descripcion: 'Crear, listar, gestionar y eliminar clases', recurso: 'Profesor' },
    { nombre: 'ALUMNOS_GESTIONAR', descripcion: 'Ver y desvincular alumnos asignados', recurso: 'Profesor' },
    { nombre: 'CLASES_UNIRSE', descripcion: 'Unirse a clases con codigos de invitacion', recurso: 'Estudiante' },
    { nombre: 'CLASES_VER', descripcion: 'Ver clases propias', recurso: 'Estudiante' },
    { nombre: 'profesor:*', descripcion: 'Acceso a funciones del panel de profesor', recurso: 'Profesor' },
    { nombre: 'estudiante:*', descripcion: 'Acceso a funciones del panel de estudiante', recurso: 'Estudiante' },
    { nombre: 'chat:*', descripcion: 'Acceso a funciones de chat e IA', recurso: 'IA' }
];

const defaultRolePermissions = {
    Admin: ['admin:*', 'profesor:*', 'estudiante:*', 'chat:*', 'CHAT_IA', 'CODIGOS_GESTIONAR', 'GRUPOS_GESTIONAR', 'ALUMNOS_GESTIONAR', 'CLASES_UNIRSE', 'CLASES_VER', 'read:documento', 'edit:documento', 'delete:documento'],
    Profesor: ['CHAT_IA', 'CODIGOS_GESTIONAR', 'GRUPOS_GESTIONAR', 'ALUMNOS_GESTIONAR', 'read:documento', 'edit:documento', 'delete:documento'],
    Estudiante: ['CHAT_IA', 'CLASES_UNIRSE', 'CLASES_VER', 'read:documento', 'edit:documento_own']
};

export const seedDefaultRbac = async () => {
    const permissionByName = {};

    for (const permissionData of defaultPermissions) {
        const [permission] = await Permiso.findOrCreate({
            where: { nombre: permissionData.nombre },
            defaults: permissionData
        });
        permissionByName[permission.nombre] = permission;
    }

    for (const [roleName, permissionNames] of Object.entries(defaultRolePermissions)) {
        const role = await Rol.findOne({ where: { nombre: roleName } });
        if (!role) continue;

        for (const permissionName of permissionNames) {
            const permission = permissionByName[permissionName];
            if (!permission) continue;

            await RolPermiso.findOrCreate({
                where: {
                    id_rol: role.id_rol,
                    id_permiso: permission.id_permiso
                }
            });
        }
    }
};
