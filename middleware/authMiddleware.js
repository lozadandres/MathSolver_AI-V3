import jwt from 'jsonwebtoken';
import { Grupo, RelacionRecurso, Usuario, Rol, Permiso, UsuarioGrupo } from '../models/index.js';
import { logActionDanger } from '../utils/actionLogger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mathsolver';

// Middleware para verificar el Access Token (Autenticación)
export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({ error: 'Autenticación requerida. Token no encontrado.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const usuario = await Usuario.findByPk(decoded.sub, {
            include: [{ model: Rol, as: 'rol', attributes: ['id_rol', 'nombre', 'activo'] }]
        });

        if (!usuario || !usuario.activo || usuario.bloqueado || !usuario.rol?.activo) {
            return res.status(401).json({ error: 'Usuario no autorizado o cuenta inactiva.' });
        }

        req.user = {
            ...decoded,
            sub: usuario.id_usuario,
            role: usuario.rol?.nombre || decoded.role,
            id_rol: usuario.id_rol,
            email: usuario.email
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Middleware para verificar roles específicos
export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acceso denegado: No tienes el rol requerido.' });
        }
        next();
    };
};

export const permissionMatches = (ownedPermission, requiredPermission) => {
    if (ownedPermission === '*' || ownedPermission === requiredPermission) return true;

    const ownedParts = ownedPermission.split(':');
    const requiredParts = requiredPermission.split(':');

    return ownedParts.every((part, index) => part === '*' || part === requiredParts[index]);
};

export const userHasPermission = async (user, requiredPermission) => {
    if (!user?.id_rol || !requiredPermission) return false;
    if (user.role === 'Admin') return true;

    const role = await Rol.findByPk(user.id_rol, {
        include: [{
            model: Permiso,
            as: 'permisos',
            through: { attributes: [] }
        }]
    });

    if (!role?.activo) return false;

    return (role.permisos || []).some((permission) => (
        permissionMatches(permission.nombre, requiredPermission)
    ));
};

export const requirePermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Autenticación requerida.' });
            }

            if (!await userHasPermission(req.user, requiredPermission)) {
                await logActionDanger(req, {
                    accion: 'RBAC_DENIED',
                    seccion: 'SEGURIDAD',
                    resultado: 'DENIED',
                    descripcion: 'Permiso RBAC denegado.',
                    metadata: { permiso_requerido: requiredPermission }
                });
                return res.status(403).json({
                    error: 'RBAC dinámico: permiso denegado.',
                    permiso_requerido: requiredPermission
                });
            }

            next();
        } catch (error) {
            console.error('Error en requirePermission:', error);
            res.status(500).json({ error: 'Error interno validando permisos.' });
        }
    };
};

export const userHasGroupRole = async (user, groupId, roles = []) => {
    if (!user || !groupId) return false;
    if (user.role === 'Admin') return true;

    const normalizedGroupId = parseInt(groupId, 10);
    if (!Number.isInteger(normalizedGroupId)) return false;

    if (roles.includes('director_grupo')) {
        const grupo = await Grupo.findByPk(normalizedGroupId);
        if (grupo?.activo && grupo.id_profesor === parseInt(user.sub, 10)) return true;
    }

    const relation = await RelacionRecurso.findOne({
        where: {
            id_entidad: user.sub,
            id_recurso: normalizedGroupId,
            relacion: roles,
            activo: true
        }
    });

    return !!relation;
};

export const userHasGroupAccess = async (user, groupId) => {
    if (!user || !groupId) return false;
    if (user.role === 'Admin') return true;

    const normalizedGroupId = parseInt(groupId, 10);
    if (!Number.isInteger(normalizedGroupId)) return false;

    const grupo = await Grupo.findByPk(normalizedGroupId);
    if (!grupo?.activo) return false;

    if (parseInt(grupo.id_profesor, 10) === parseInt(user.sub, 10)) return true;

    const teacherRelation = await RelacionRecurso.findOne({
        where: {
            id_entidad: user.sub,
            id_recurso: normalizedGroupId,
            relacion: ['director_grupo', 'profesor_materia', 'tutor_asistente'],
            activo: true
        }
    });
    if (teacherRelation) return true;

    const studentGroup = await UsuarioGrupo.findOne({
        where: {
            id_usuario: user.sub,
            id_grupo: normalizedGroupId
        }
    });
    if (studentGroup) return true;

    const studentRelation = await RelacionRecurso.findOne({
        where: {
            id_entidad: user.sub,
            id_recurso: normalizedGroupId,
            relacion: 'alumno',
            activo: true
        }
    });

    return !!studentRelation;
};

export const requireGroupAccess = (getGroupId = (req) => req.params.groupId || req.params.id_grupo || req.body.groupId || req.body.id_grupo) => {
    return async (req, res, next) => {
        try {
            const groupId = getGroupId(req);
            if (!groupId) return next();

            if (!await userHasGroupAccess(req.user, groupId)) {
                await logActionDanger(req, {
                    accion: 'REBAC_DENIED',
                    seccion: 'SEGURIDAD',
                    resultado: 'DENIED',
                    descripcion: 'Acceso ReBAC denegado: el usuario no pertenece al grupo solicitado.',
                    metadata: { id_grupo: groupId }
                });
                return res.status(403).json({ error: 'Acceso denegado: No perteneces a este grupo.' });
            }

            next();
        } catch (error) {
            console.error('Error en requireGroupAccess:', error);
            res.status(500).json({ error: 'Error interno validando acceso al grupo.' });
        }
    };
};

export const requireGroupRole = (roles = []) => {
    return async (req, res, next) => {
        try {
            const groupId = req.params.id || req.params.id_grupo || req.body.id_grupo;

            if (!await userHasGroupRole(req.user, groupId, roles)) {
                await logActionDanger(req, {
                    accion: 'REBAC_ROLE_DENIED',
                    seccion: 'SEGURIDAD',
                    resultado: 'DENIED',
                    descripcion: 'Acceso ReBAC denegado: falta cargo contextual requerido.',
                    metadata: { id_grupo: groupId, roles_requeridos: roles }
                });
                return res.status(403).json({ error: 'Acceso denegado: No tienes el rol requerido en este grupo.' });
            }

            next();
        } catch (error) {
            console.error('Error en requireGroupRole:', error);
            res.status(500).json({ error: 'Error interno validando rol en grupo.' });
        }
    };
};

// Middleware Híbrido: RBAC + ReBAC + ABAC
export const authorize = (requiredAction, resourceType) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const resourceId = req.params.id;

            const requiredPermission = `${requiredAction}:${resourceType}`;
            const requiredOwnPermission = `${requiredAction}:${resourceType}_own`;
            const hasDirectPermission = await userHasPermission(user, requiredPermission);
            const hasOwnPermission = await userHasPermission(user, requiredOwnPermission);

            if (!hasDirectPermission && !hasOwnPermission) {
                await logActionDanger(req, {
                    accion: 'RBAC_DENIED',
                    seccion: 'SEGURIDAD',
                    resultado: 'DENIED',
                    descripcion: 'Permiso RBAC denegado en authorize.',
                    metadata: { permiso_requerido: requiredPermission, permiso_propio_requerido: requiredOwnPermission }
                });
                return res.status(403).json({
                    error: 'RBAC dinamico: permiso denegado.',
                    permiso_requerido: requiredPermission
                });
            }

            // 2. Capa ReBAC (Evaluación con Sequelize)
            if (!hasDirectPermission && hasOwnPermission) {
                if (!resourceId) {
                    return res.status(400).json({ error: 'ReBAC: Falta el ID del recurso para evaluar propiedad.' });
                }

                // Usamos el ORM Sequelize para consultar la relación polimórfica
                const isOwner = await RelacionRecurso.findOne({
                    where: {
                        id_recurso: resourceId,
                        id_entidad: user.sub, // sub contiene el id_usuario
                        relacion: 'creador',
                        activo: true
                    }
                });

                if (!isOwner) {
                    await logActionDanger(req, {
                        accion: 'REBAC_DENIED',
                        seccion: 'SEGURIDAD',
                        resultado: 'DENIED',
                        descripcion: 'Acceso ReBAC denegado: no existe relacion de propiedad.',
                        metadata: { id_recurso: resourceId, relacion_requerida: 'creador' }
                    });
                    return res.status(403).json({ error: 'ReBAC: No tienes una relación de propiedad con este recurso.' });
                }
            }

            // 3. Capa ABAC (Atributos y entorno)
            const currentHour = new Date().getHours();
            
            if (user.role === 'Estudiante') {
                if (currentHour < 8 || currentHour >= 18) {
                    await logActionDanger(req, {
                        accion: 'ABAC_DENIED',
                        seccion: 'SEGURIDAD',
                        resultado: 'DENIED',
                        descripcion: 'Acceso ABAC denegado por horario escolar.',
                        metadata: { hora_actual: currentHour, hora_inicio: 8, hora_fin: 18 }
                    });
                    return res.status(403).json({ error: 'ABAC: Acceso solo permitido en horario escolar (8-18hrs).' });
                }
            }

            next(); // Acceso Concedido
        } catch (error) {
            console.error('Error en middleware authorize:', error);
            res.status(500).json({ error: 'Error interno en la validación de permisos.' });
        }
    };
};
