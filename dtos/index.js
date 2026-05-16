/**
 * DTO para Usuario
 * Filtra campos sensibles como password y mapea la estructura para el cliente.
 */
export const UserDTO = (user) => {
    if (!user) return null;
    return {
        id: user.id_usuario,
        email: user.email,
        role: user.rol ? user.rol.nombre : (user.role || 'Usuario'),
        roleId: user.id_rol,
        activo: user.activo,
        bloqueado: user.bloqueado,
        configuracion: user.configuracion || null
    };
};

/**
 * DTO para Grupo/Clase
 */
export const GroupDTO = (group) => {
    if (!group) return null;
    return {
        id: group.id_grupo,
        nombre: group.nombre,
        descripcion: group.descripcion,
        activo: group.activo,
        profesor: group.tutor ? {
            email: group.tutor.email
        } : null,
        integrantes: group.integrantes ? group.integrantes.map(i => ({
            id: i.id_usuario,
            email: i.email
        })) : []
    };
};

/**
 * DTO para Recursos/Relaciones
 */
export const RelacionDTO = (rel) => {
    if (!rel) return null;
    return {
        id: rel.id_relacion,
        relacion: rel.relacion,
        recursoId: rel.id_recurso,
        activo: rel.activo
    };
};

/**
 * DTO para Rol
 */
export const RoleDTO = (role) => {
    if (!role) return null;
    return {
        id: role.id_rol,
        nombre: role.nombre,
        descripcion: role.descripcion,
        tipo: role.tipo ? role.tipo.nombre : 'Personalizado',
        permisos: role.permisos ? role.permisos.map(p => PermissionDTO(p)) : []
    };
};

/**
 * DTO para Permiso
 */
export const PermissionDTO = (perm) => {
    if (!perm) return null;
    return {
        id: perm.id_permiso,
        nombre: perm.nombre,
        descripcion: perm.descripcion,
        recurso: perm.recurso
    };
};
