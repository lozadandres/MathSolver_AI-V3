import jwt from 'jsonwebtoken';
import { RelacionRecurso } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mathsolver';

// Middleware para verificar el Access Token (Autenticación)
export const requireAuth = (req, res, next) => {
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
        req.user = decoded; // { sub: id_usuario, role: nombre_rol, email: ... }
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

// Middleware Híbrido: RBAC + ReBAC + ABAC
export const authorize = (requiredAction, resourceType) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const resourceId = req.params.id;

            // 1. Capa RBAC
            // Para simplificar, nos basamos en el nombre del rol incrustado en el JWT
            let rolePermissions = [];
            if (user.role === 'Profesor' || user.role === 'Admin') {
                rolePermissions = [`read:${resourceType}`, `edit:${resourceType}`, `delete:${resourceType}`];
            } else if (user.role === 'Estudiante') {
                rolePermissions = [`read:${resourceType}`, `edit:${resourceType}_own`];
            }

            const requiredPermission = `${requiredAction}:${resourceType}`;
            const requiredOwnPermission = `${requiredAction}:${resourceType}_own`;

            if (!rolePermissions.includes(requiredPermission) && !rolePermissions.includes(requiredOwnPermission)) {
                return res.status(403).json({ error: 'RBAC: Permiso denegado por rol.' });
            }

            // 2. Capa ReBAC (Evaluación con Sequelize)
            if (!rolePermissions.includes(requiredPermission) && rolePermissions.includes(requiredOwnPermission)) {
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
                    return res.status(403).json({ error: 'ReBAC: No tienes una relación de propiedad con este recurso.' });
                }
            }

            // 3. Capa ABAC (Atributos y entorno)
            const currentHour = new Date().getHours();
            
            if (user.role === 'Estudiante') {
                if (currentHour < 8 || currentHour >= 18) {
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
