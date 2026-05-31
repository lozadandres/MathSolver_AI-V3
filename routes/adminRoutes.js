import express from 'express';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { sequelize, Usuario, Rol, RelacionRecurso, Grupo, Permiso, RolPermiso, Configuracion, TipoRol, LogAuditoria, UsuarioGrupo, LogAccion, LogSesion, ClienteAcceso, Token, Documento } from '../models/index.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { UserDTO, GroupDTO, RoleDTO, PermissionDTO } from '../dtos/index.js';
import { auditInfo, auditWarning, auditDanger } from '../utils/auditLogger.js';

const router = express.Router();
const contextualGroupRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente', 'alumno'];
const assignableContextualRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente', 'alumno'];

const logPayload = (log) => ({
    id: log.id_log,
    id_usuario: log.id_usuario,
    accion: log.accion,
    seccion: log.seccion,
    nivel: log.nivel,
    descripcion: log.descripcion,
    metadata: log.metadata,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    fecha_creacion: log.fecha_creacion,
    usuario: log.usuario ? {
        id: log.usuario.id_usuario,
        email: log.usuario.email
    } : null
});

const actionLogPayload = (log) => ({
    id: log.id_log_accion,
    id_usuario: log.id_usuario,
    id_cliente: log.id_cliente,
    accion: log.accion,
    seccion: log.seccion,
    nivel: log.nivel,
    resultado: log.exito === false ? (log.accion?.includes('DENIED') ? 'DENIED' : 'FAILED') : 'SUCCESS',
    descripcion: log.descripcion,
    metadata: log.metadata,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    fecha_creacion: log.fecha_creacion,
    usuario: log.usuario ? { id: log.usuario.id_usuario, email: log.usuario.email } : null,
    cliente: log.cliente ? {
        id: log.cliente.id_cliente,
        dispositivo: log.cliente.dispositivo,
        navegador: log.cliente.navegador,
        sistema_operativo: log.cliente.sistema_operativo
    } : null
});

const legacyAsActionPayload = (log) => ({
    id: `legacy-${log.id_log}`,
    id_usuario: log.id_usuario,
    id_cliente: null,
    accion: log.accion,
    seccion: log.seccion,
    nivel: log.nivel,
    resultado: log.nivel === 'danger' || String(log.accion).includes('DENIED') ? 'DENIED'
        : String(log.accion).includes('FAILED') ? 'FAILED'
        : 'SUCCESS',
    descripcion: log.descripcion,
    metadata: log.metadata,
    ip_address: log.ip_address,
    user_agent: log.user_agent,
    fecha_creacion: log.fecha_creacion,
    usuario: log.usuario ? { id: log.usuario.id_usuario, email: log.usuario.email } : null,
    cliente: null,
    origen: 'legacy'
});

const sessionLogPayload = (session) => ({
    id: session.id_log_sesion,
    id_usuario: session.id_usuario,
    id_cliente: session.id_cliente,
    id_token: session.id_token,
    estado: session.estado,
    ip_address: session.ip_address,
    user_agent: session.user_agent,
    fecha_inicio: session.fecha_inicio,
    fecha_fin: session.fecha_fin,
    usuario: session.usuario ? { id: session.usuario.id_usuario, email: session.usuario.email } : null,
    cliente: session.cliente ? {
        id: session.cliente.id_cliente,
        dispositivo: session.cliente.dispositivo,
        navegador: session.cliente.navegador,
        sistema_operativo: session.cliente.sistema_operativo
    } : null
});

const applyDateFilter = (where, field, fecha = 'semana', includeUndated = false) => {
    if (fecha === 'todo') return;
    const from = new Date();
    if (fecha === 'hoy') from.setHours(0, 0, 0, 0);
    else if (fecha === 'mes') from.setDate(from.getDate() - 30);
    else from.setDate(from.getDate() - 7);

    if (includeUndated) {
        where[Op.or] = [
            { [field]: { [Op.gte]: from } },
            { [field]: null }
        ];
        return;
    }

    where[field] = { [Op.gte]: from };
};

const applyActionCategoryFilter = (where, categoria) => {
    if (!categoria) return;
    const normalized = String(categoria).toUpperCase();
    if (normalized === 'LOGIN') {
        where.accion = { [Op.in]: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REFRESH_DENIED', 'TOKEN_REUSE_DETECTED'] };
    } else if (normalized === 'ADMIN') {
        where.seccion = { [Op.in]: ['USUARIOS', 'ROLES', 'CLASES'] };
    } else if (normalized === 'PROFESOR') {
        where.seccion = 'PROFESOR';
    } else if (normalized === 'ESTUDIANTE') {
        where.seccion = 'ESTUDIANTE';
    } else if (normalized === 'IA') {
        where.seccion = 'IA';
    } else if (normalized === 'PBAC') {
        where.accion = 'PBAC_DENIED';
    }
};

// Auditoria y logs
const getLogLimit = (limit) => Math.min(parseInt(limit, 10) || 500, 2000);

router.get('/logs/auditoria', requireAuth, requirePermission('admin:logs:read'), async (req, res) => {
    try {
        const { seccion, nivel, id_usuario, fecha = 'semana', limit = 100 } = req.query;
        const where = {};

        if (seccion) where.seccion = seccion;
        if (nivel) where.nivel = nivel;
        if (id_usuario) where.id_usuario = id_usuario;

        if (fecha !== 'todo') {
            const from = new Date();
            if (fecha === 'hoy') from.setHours(0, 0, 0, 0);
            else if (fecha === 'mes') from.setDate(from.getDate() - 30);
            else from.setDate(from.getDate() - 7);
            where.fecha_creacion = { [Op.gte]: from };
        }

        const logs = await LogAuditoria.findAll({
            where,
            include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'email'] }],
            order: [['fecha_creacion', 'DESC']],
            limit: getLogLimit(limit)
        });

        res.json(logs.map(logPayload));
    } catch (error) {
        console.error('Error obteniendo auditoria:', error);
        res.status(500).json({ error: 'Error al obtener logs de auditoria' });
    }
});

router.get('/logs/acciones', requireAuth, requirePermission('admin:logs:read'), async (req, res) => {
    try {
        const { seccion, nivel, resultado, id_usuario, fecha = 'semana', limit = 100, accion, exito, categoria } = req.query;
        const where = {};
        if (seccion) where.seccion = seccion;
        if (nivel) where.nivel = nivel;
        if (resultado) where.exito = resultado === 'SUCCESS';
        if (id_usuario) where.id_usuario = id_usuario;
        if (accion) where.accion = { [Op.iLike]: `%${accion}%` };
        if (exito === 'true') where.exito = true;
        if (exito === 'false') where.exito = false;
        applyActionCategoryFilter(where, categoria);
        if (accion && categoria?.toUpperCase() === 'LOGIN') {
            delete where.accion;
            where[Op.and] = [
                { accion: { [Op.in]: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REFRESH_DENIED', 'TOKEN_REUSE_DETECTED'] } },
                { accion: { [Op.iLike]: `%${accion}%` } }
            ];
        }
        applyDateFilter(where, 'fecha_creacion', fecha, true);

        const logs = await LogAccion.findAll({
            where,
            include: [
                { model: Usuario, as: 'usuario', attributes: ['id_usuario', 'email'] },
                { model: ClienteAcceso, as: 'cliente', attributes: ['id_cliente', 'dispositivo', 'navegador', 'sistema_operativo'] }
            ],
            order: [['fecha_creacion', 'DESC']],
            limit: getLogLimit(limit)
        });

        if (logs.length === 0) {
            const legacyWhere = {};
            if (seccion) legacyWhere.seccion = seccion;
            if (nivel) legacyWhere.nivel = nivel;
            if (id_usuario) legacyWhere.id_usuario = id_usuario;
            if (accion) legacyWhere.accion = { [Op.iLike]: `%${accion}%` };
            applyActionCategoryFilter(legacyWhere, categoria);
            applyDateFilter(legacyWhere, 'fecha_creacion', fecha);

            const legacyLogs = await LogAuditoria.findAll({
                where: legacyWhere,
                include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'email'] }],
                order: [['fecha_creacion', 'DESC']],
                limit: getLogLimit(limit)
            });

            let legacyPayloads = legacyLogs.map(legacyAsActionPayload);
            if (exito === 'true') legacyPayloads = legacyPayloads.filter(log => log.resultado === 'SUCCESS');
            if (exito === 'false') legacyPayloads = legacyPayloads.filter(log => log.resultado !== 'SUCCESS');
            if (resultado) legacyPayloads = legacyPayloads.filter(log => log.resultado === resultado);

            return res.json(legacyPayloads);
        }

        res.json(logs.map(actionLogPayload));
    } catch (error) {
        console.error('Error obteniendo logs de acciones:', error);
        res.status(500).json({ error: 'Error al obtener logs de acciones' });
    }
});

router.get('/logs/sesiones', requireAuth, requirePermission('admin:logs:read'), async (req, res) => {
    try {
        const { estado, id_usuario, fecha = 'semana', limit = 100, activas } = req.query;
        const where = {};
        if (activas === 'true') where.estado = 'ACTIVA';
        else if (estado) where.estado = estado;
        if (id_usuario) where.id_usuario = id_usuario;
        applyDateFilter(where, 'fecha_inicio', fecha);

        const sessions = await LogSesion.findAll({
            where,
            include: [
                { model: Usuario, as: 'usuario', attributes: ['id_usuario', 'email'] },
                { model: ClienteAcceso, as: 'cliente', attributes: ['id_cliente', 'dispositivo', 'navegador', 'sistema_operativo'] }
            ],
            order: [['fecha_inicio', 'DESC']],
            limit: getLogLimit(limit)
        });
        res.json(sessions.map(sessionLogPayload));
    } catch (error) {
        console.error('Error obteniendo logs de sesiones:', error);
        res.status(500).json({ error: 'Error al obtener logs de sesiones' });
    }
});

router.get('/logs/stats', requireAuth, requirePermission('admin:logs:read'), async (req, res) => {
    try {
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [totalAcciones, accionesFallidas, sesionesActivas, consultasIA] = await Promise.all([
            LogAccion.count({ where: { fecha_creacion: { [Op.gte]: from } } }),
            LogAccion.count({ where: { fecha_creacion: { [Op.gte]: from }, exito: false } }),
            LogSesion.count({ where: { estado: 'ACTIVA' } }),
            LogAccion.count({ where: { fecha_creacion: { [Op.gte]: from }, accion: 'AI_QUERY' } })
        ]);

        res.json({ totalAcciones, accionesFallidas, sesionesActivas, consultasIA });
    } catch (error) {
        console.error('Error obteniendo estadisticas de logs:', error);
        res.status(500).json({ error: 'Error al obtener estadisticas de logs' });
    }
});

const roleRelationPayload = (relation) => ({
    id: relation.id_relacion,
    id_usuario: relation.id_entidad,
    id_grupo: relation.id_recurso,
    email: relation.entidad_usuario?.email,
    relacion: relation.relacion,
    activo: relation.activo,
    fecha_creacion: relation.fecha_creacion
});

// Obtener todos los usuarios
router.get('/usuarios', requireAuth, requirePermission('admin:usuarios:read'), async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            include: [{ model: Rol, as: 'rol' }],
            attributes: { exclude: ['password'] }
        });
        const usuariosDTO = usuarios.map(u => UserDTO(u));
        res.json(usuariosDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

router.get('/usuarios/:id/roles-contextuales', requireAuth, requirePermission('admin:usuarios:read'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const relaciones = await RelacionRecurso.findAll({
            where: {
                id_entidad: userId,
                relacion: contextualGroupRoles,
                activo: true
            },
            include: [{ model: Usuario, as: 'entidad_usuario', attributes: ['id_usuario', 'email'] }],
            order: [['fecha_creacion', 'DESC']]
        });

        const tutorGroups = await Grupo.findAll({
            where: { id_profesor: userId },
            attributes: ['id_grupo', 'nombre']
        });

        const studentLinks = await UsuarioGrupo.findAll({
            where: { id_usuario: userId },
            attributes: ['id_grupo', 'fecha_ingreso']
        });

        const groupIds = [
            ...relaciones.map(r => r.id_recurso),
            ...tutorGroups.map(g => g.id_grupo),
            ...studentLinks.map(link => link.id_grupo)
        ];
        const grupos = groupIds.length
            ? await Grupo.findAll({ where: { id_grupo: groupIds }, attributes: ['id_grupo', 'nombre'] })
            : [];
        const groupById = Object.fromEntries(grupos.map(g => [g.id_grupo, g.nombre]));

        const payload = relaciones.map(r => ({
            ...roleRelationPayload(r),
            grupo_nombre: groupById[r.id_recurso] || `Grupo #${r.id_recurso}`
        }));

        const existingKeys = new Set(payload.map(role => `${role.id_grupo}:${role.relacion}`));

        tutorGroups.forEach(group => {
            const key = `${group.id_grupo}:director_grupo`;
            if (!existingKeys.has(key)) {
                payload.push({
                    id: `director-${group.id_grupo}`,
                    id_usuario: userId,
                    id_grupo: group.id_grupo,
                    email: null,
                    relacion: 'director_grupo',
                    activo: true,
                    fecha_creacion: null,
                    grupo_nombre: group.nombre || groupById[group.id_grupo] || `Grupo #${group.id_grupo}`
                });
                existingKeys.add(key);
            }
        });

        studentLinks.forEach(link => {
            const key = `${link.id_grupo}:alumno`;
            if (!existingKeys.has(key)) {
                payload.push({
                    id: `alumno-${link.id_grupo}`,
                    id_usuario: userId,
                    id_grupo: link.id_grupo,
                    email: null,
                    relacion: 'alumno',
                    activo: true,
                    fecha_creacion: link.fecha_ingreso || null,
                    grupo_nombre: groupById[link.id_grupo] || `Grupo #${link.id_grupo}`
                });
                existingKeys.add(key);
            }
        });

        res.json(payload);
    } catch (error) {
        console.error('Error obteniendo roles contextuales del usuario:', error);
        res.status(500).json({ error: 'Error al obtener roles contextuales del usuario' });
    }
});

// Crear usuario (Admin)
router.post('/usuarios', requireAuth, requirePermission('admin:usuarios:write'), async (req, res) => {
    const { email, password, id_rol } = req.body;
    try {
        const existe = await Usuario.findOne({ where: { email } });
        if (existe) return res.status(400).json({ error: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await Usuario.create({
            email,
            password: hashedPassword,
            id_rol,
            activo: true,
            bloqueado: false
        });

        // Crear configuración por defecto
        await Configuracion.create({ id_usuario: newUser.id_usuario });

        await auditInfo(req, {
            accion: 'CREATE',
            seccion: 'USUARIOS',
            descripcion: `Admin creo usuario ${email}`,
            metadata: { id_usuario_creado: newUser.id_usuario, id_rol }
        });

        res.status(201).json(UserDTO(newUser));
    } catch (error) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Actualizar usuario (Admin)
router.put('/usuarios/:id', requireAuth, requirePermission('admin:usuarios:write'), async (req, res) => {
    const { id } = req.params;
    const { email, password, id_rol, activo } = req.body;
    try {
        const before = await Usuario.findByPk(id, { attributes: { exclude: ['password'] } });
        if (!before) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updateData = {};
        if (email) updateData.email = email;
        if (id_rol) updateData.id_rol = id_rol;
        if (activo !== undefined) updateData.activo = activo;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await Usuario.update(updateData, { where: { id_usuario: id } });
        const updatedUser = await Usuario.findByPk(id, {
            include: [{
                model: Rol,
                as: 'rol',
                include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }]
            }]
        });

        await auditInfo(req, {
            accion: 'UPDATE',
            seccion: 'USUARIOS',
            descripcion: `Admin actualizo usuario ${id}`,
            metadata: {
                before: before.get({ plain: true }),
                changes: { ...updateData, password: password ? '[UPDATED]' : undefined }
            }
        });

        res.json(UserDTO(updatedUser));
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Asignar estudiante a profesor
router.post('/asignar', requireAuth, requirePermission('admin:usuarios:write'), async (req, res) => {
    const { id_profesor, id_estudiante } = req.body;
    try {
        // Verificar existencia
        const profesor = await Usuario.findByPk(id_profesor, { include: ['rol'] });
        const estudiante = await Usuario.findByPk(id_estudiante, { include: ['rol'] });
        
        if (!profesor || profesor.rol.nombre !== 'Profesor') return res.status(400).json({ error: 'Profesor no válido' });
        if (!estudiante || estudiante.rol.nombre !== 'Estudiante') return res.status(400).json({ error: 'Estudiante no válido' });

        // Crear relación ReBAC
        await RelacionRecurso.create({
            id_entidad: id_profesor,
            id_recurso: id_estudiante,
            relacion: 'tutor_de',
            activo: true
        });

        await auditInfo(req, {
            accion: 'ASSIGN',
            seccion: 'USUARIOS',
            descripcion: `Admin asigno estudiante ${id_estudiante} al profesor ${id_profesor}`,
            metadata: { id_profesor, id_estudiante, relacion: 'tutor_de' }
        });

        res.json({ message: 'Alumno asignado correctamente al profesor.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar alumno' });
    }
});

// Bloquear/Desbloquear usuario
router.put('/usuarios/:id/bloquear', requireAuth, requirePermission('admin:usuarios:write'), async (req, res) => {
    const { id } = req.params;
    const { bloqueado } = req.body;
    try {
        await Usuario.update({ bloqueado }, { where: { id_usuario: id } });
        await auditWarning(req, {
            accion: bloqueado ? 'BLOCK' : 'UNBLOCK',
            seccion: 'USUARIOS',
            descripcion: `Admin ${bloqueado ? 'bloqueo' : 'desbloqueo'} usuario ${id}`,
            metadata: { id_usuario: id, bloqueado }
        });
        res.json({ message: bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Cambiar rol de usuario
router.put('/usuarios/:id/rol', requireAuth, requirePermission('admin:usuarios:write'), async (req, res) => {
    const { id } = req.params;
    const { id_rol } = req.body;
    
    try {
        if (!id_rol) return res.status(400).json({ error: 'ID de rol no proporcionado' });

        // Verificar que el rol existe
        const rolExiste = await Rol.findByPk(id_rol);
        if (!rolExiste) return res.status(400).json({ error: 'El rol especificado no existe' });

        const before = await Usuario.findByPk(id, { attributes: ['id_usuario', 'id_rol', 'email'] });
        await Usuario.update({ id_rol: parseInt(id_rol) }, { where: { id_usuario: id } });
        await auditWarning(req, {
            accion: 'ROLE_CHANGE',
            seccion: 'ROLES',
            descripcion: `Admin cambio rol del usuario ${id}`,
            metadata: { id_usuario: id, rol_anterior: before?.id_rol, rol_nuevo: parseInt(id_rol, 10) }
        });
        res.json({ message: 'Rol actualizado correctamente' });
    } catch (error) {
        console.error("Error detallado al actualizar rol:", error);
        res.status(500).json({ error: 'Error interno al actualizar rol' });
    }
});

// Eliminar usuario
router.delete('/usuarios/:id', requireAuth, requirePermission('admin:usuarios:delete'), async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    try {
        if (parseInt(req.user.sub, 10) === userId) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde esta accion.' });
        }

        const deletedUser = await Usuario.findByPk(userId, { attributes: ['id_usuario', 'email', 'id_rol'] });
        if (!deletedUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const deletedUserPayload = deletedUser.get({ plain: true });

        await sequelize.transaction(async (transaction) => {
            await LogSesion.destroy({ where: { id_usuario: userId }, transaction });
            await LogAccion.update(
                { id_usuario: null, id_cliente: null },
                { where: { id_usuario: userId }, transaction }
            );
            await LogAuditoria.update(
                { id_usuario: null },
                { where: { id_usuario: userId }, transaction }
            );
            await ClienteAcceso.destroy({ where: { id_usuario: userId }, transaction });
            await Token.destroy({ where: { id_usuario: userId }, transaction });
            await Configuracion.destroy({ where: { id_usuario: userId }, transaction });
            await UsuarioGrupo.destroy({ where: { id_usuario: userId }, transaction });
            await RelacionRecurso.destroy({
                where: {
                    [Op.or]: [
                        { id_entidad: userId },
                        { id_recurso: userId, relacion: 'tutor_de' }
                    ]
                },
                transaction
            });
            await Documento.update(
                { id_usuario_creador: null },
                { where: { id_usuario_creador: userId }, transaction }
            );
            await Usuario.destroy({ where: { id_usuario: userId }, transaction });
        });

        await auditDanger(req, {
            accion: 'DELETE',
            seccion: 'USUARIOS',
            descripcion: `Admin elimino usuario ${id}`,
            metadata: { deletedUser: deletedUserPayload }
        });
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// ---- GESTIÓN DE GRUPOS ----

// Listar grupos
router.get('/grupos', requireAuth, requirePermission('admin:grupos:read'), async (req, res) => {
    try {
        const grupos = await Grupo.findAll({
            include: [{ model: Usuario, as: 'tutor', attributes: ['email'] }]
        });
        const groupIds = grupos.map(g => g.id_grupo);
        const relaciones = groupIds.length
            ? await RelacionRecurso.findAll({
                where: {
                    id_recurso: groupIds,
                    relacion: contextualGroupRoles,
                    activo: true
                },
                include: [{ model: Usuario, as: 'entidad_usuario', attributes: ['id_usuario', 'email'] }]
            })
            : [];

        const rolesByGroup = {};
        relaciones.forEach((rel) => {
            if (!rolesByGroup[rel.id_recurso]) rolesByGroup[rel.id_recurso] = [];
            rolesByGroup[rel.id_recurso].push(roleRelationPayload(rel));
        });

        const gruposDTO = grupos.map(g => {
            g.roles_contextuales = rolesByGroup[g.id_grupo] || [];
            return GroupDTO(g);
        });
        res.json(gruposDTO);
    } catch (error) {
        console.error('Error al obtener grupos:', error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

router.get('/grupos/:id/roles-contextuales', requireAuth, requirePermission('admin:grupos:read'), async (req, res) => {
    try {
        const relaciones = await RelacionRecurso.findAll({
            where: {
                id_recurso: req.params.id,
                relacion: contextualGroupRoles,
                activo: true
            },
            include: [{ model: Usuario, as: 'entidad_usuario', attributes: ['id_usuario', 'email'] }],
            order: [['fecha_creacion', 'ASC']]
        });

        const grupo = await Grupo.findByPk(req.params.id, {
            include: [{
                model: Usuario,
                as: 'integrantes',
                attributes: ['id_usuario', 'email'],
                through: { attributes: [] }
            }, {
                model: Usuario,
                as: 'tutor',
                attributes: ['id_usuario', 'email']
            }]
        });
        const relationPayloads = relaciones.map(roleRelationPayload);
        const existingDirectorIds = new Set(
            relationPayloads
                .filter(role => role.relacion === 'director_grupo')
                .map(role => String(role.id_usuario))
        );
        const existingStudentIds = new Set(
            relationPayloads
                .filter(role => role.relacion === 'alumno')
                .map(role => String(role.id_usuario))
        );
        const tutorPayload = grupo?.id_profesor && !existingDirectorIds.has(String(grupo.id_profesor))
            ? [{
                id: `director-${grupo.id_profesor}`,
                id_usuario: grupo.id_profesor,
                id_grupo: parseInt(req.params.id, 10),
                email: grupo.tutor?.email,
                relacion: 'director_grupo',
                activo: true,
                fecha_creacion: null
            }]
            : [];
        const studentPayloads = (grupo?.integrantes || [])
            .filter(alumno => !existingStudentIds.has(String(alumno.id_usuario)))
            .map(alumno => ({
                id: `alumno-${alumno.id_usuario}`,
                id_usuario: alumno.id_usuario,
                id_grupo: parseInt(req.params.id, 10),
                email: alumno.email,
                relacion: 'alumno',
                activo: true,
                fecha_creacion: null
            }));

        res.json([...tutorPayload, ...relationPayloads, ...studentPayloads]);
    } catch (error) {
        console.error('Error obteniendo roles contextuales:', error);
        res.status(500).json({ error: 'Error al obtener roles contextuales del grupo' });
    }
});

router.post('/grupos/:id/roles-contextuales', requireAuth, requirePermission('admin:grupos:write'), async (req, res) => {
    const { id_usuario, relacion } = req.body;

    try {
        if (!id_usuario || !assignableContextualRoles.includes(relacion)) {
            return res.status(400).json({ error: 'Usuario y rol contextual valido son obligatorios.' });
        }

        const usuario = await Usuario.findByPk(id_usuario);
        if (!usuario) {
            return res.status(400).json({ error: 'Usuario no encontrado.' });
        }

        const [relation, created] = await RelacionRecurso.findOrCreate({
            where: {
                id_entidad: id_usuario,
                id_recurso: req.params.id,
                relacion
            },
            defaults: { activo: true }
        });

        if (!created && !relation.activo) {
            await relation.update({ activo: true });
        }

        if (relacion === 'alumno') {
            await UsuarioGrupo.findOrCreate({
                where: {
                    id_usuario,
                    id_grupo: req.params.id
                },
                defaults: {
                    fecha_ingreso: new Date()
                }
            });
        }

        await auditWarning(req, {
            accion: 'REBAC_ASSIGN',
            seccion: 'CLASES',
            descripcion: `Admin asigno ${relacion} al usuario ${id_usuario} en grupo ${req.params.id}`,
            metadata: { id_usuario, id_grupo: req.params.id, relacion }
        });

        const withUser = await RelacionRecurso.findByPk(relation.id_relacion, {
            include: [{ model: Usuario, as: 'entidad_usuario', attributes: ['id_usuario', 'email'] }]
        });

        res.status(201).json(roleRelationPayload(withUser));
    } catch (error) {
        console.error('Error asignando rol contextual:', error);
        res.status(500).json({ error: 'Error al asignar rol contextual' });
    }
});

router.post('/grupos/:id/roles-contextuales/bulk', requireAuth, requirePermission('admin:grupos:write'), async (req, res) => {
    const { id_usuario, relaciones = [], sync = true } = req.body;
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(id_usuario, 10);

    try {
        if (!userId || !Array.isArray(relaciones)) {
            return res.status(400).json({ error: 'Usuario y lista de roles son obligatorios.' });
        }

        const invalidRoles = relaciones.filter(relacion => !assignableContextualRoles.includes(relacion));
        if (invalidRoles.length > 0) {
            return res.status(400).json({ error: `Roles no validos: ${invalidRoles.join(', ')}` });
        }

        const usuario = await Usuario.findByPk(userId);
        if (!usuario) {
            return res.status(400).json({ error: 'Usuario no encontrado.' });
        }

        const previousRelations = await RelacionRecurso.findAll({
            where: {
                id_entidad: userId,
                id_recurso: groupId,
                relacion: assignableContextualRoles,
                activo: true
            }
        });
        const previousRoleNames = previousRelations.map(rel => rel.relacion);

        for (const relacion of relaciones) {
            const [relation, created] = await RelacionRecurso.findOrCreate({
                where: { id_entidad: userId, id_recurso: groupId, relacion },
                defaults: { activo: true }
            });

            if (!created && !relation.activo) {
                await relation.update({ activo: true });
            }
        }

        if (relaciones.includes('alumno')) {
            await UsuarioGrupo.findOrCreate({
                where: {
                    id_usuario: userId,
                    id_grupo: groupId
                },
                defaults: {
                    fecha_ingreso: new Date()
                }
            });
        } else if (sync) {
            await UsuarioGrupo.destroy({
                where: {
                    id_usuario: userId,
                    id_grupo: groupId
                }
            });
        }

        if (sync) {
            await RelacionRecurso.update(
                { activo: false },
                {
                    where: {
                        id_entidad: userId,
                        id_recurso: groupId,
                        relacion: {
                            [Op.in]: assignableContextualRoles,
                            [Op.notIn]: relaciones.length ? relaciones : ['__none__']
                        }
                    }
                }
            );
        }

        await auditWarning(req, {
            accion: 'REBAC_BULK_UPDATE',
            seccion: 'CLASES',
            descripcion: `Admin actualizo multiples roles contextuales del usuario ${userId} en grupo ${groupId}`,
            metadata: {
                id_usuario: userId,
                id_grupo: groupId,
                relaciones_anteriores: previousRoleNames,
                relaciones_nuevas: relaciones,
                sync
            }
        });

        const updatedRelations = await RelacionRecurso.findAll({
            where: {
                id_entidad: userId,
                id_recurso: groupId,
                relacion: assignableContextualRoles,
                activo: true
            },
            include: [{ model: Usuario, as: 'entidad_usuario', attributes: ['id_usuario', 'email'] }],
            order: [['fecha_creacion', 'ASC']]
        });

        res.json(updatedRelations.map(roleRelationPayload));
    } catch (error) {
        console.error('Error actualizando roles contextuales en bulk:', error);
        res.status(500).json({ error: 'Error al actualizar roles contextuales' });
    }
});

router.delete('/grupos/:id/roles-contextuales/:relationId', requireAuth, requirePermission('admin:grupos:delete'), async (req, res) => {
    try {
        const relation = await RelacionRecurso.findOne({
            where: {
                id_relacion: req.params.relationId,
                id_recurso: req.params.id,
                relacion: contextualGroupRoles
            }
        });

        if (!relation) return res.status(404).json({ error: 'Rol contextual no encontrado.' });
        await relation.update({ activo: false });

        if (relation.relacion === 'alumno') {
            await UsuarioGrupo.destroy({
                where: {
                    id_usuario: relation.id_entidad,
                    id_grupo: relation.id_recurso
                }
            });
        }

        await auditWarning(req, {
            accion: 'REBAC_REVOKE',
            seccion: 'CLASES',
            descripcion: `Admin revoco rol contextual ${relation.relacion} en grupo ${req.params.id}`,
            metadata: { id_relacion: relation.id_relacion, id_usuario: relation.id_entidad, id_grupo: relation.id_recurso, relacion: relation.relacion }
        });

        res.json({ message: 'Rol contextual revocado correctamente.' });
    } catch (error) {
        console.error('Error revocando rol contextual:', error);
        res.status(500).json({ error: 'Error al revocar rol contextual' });
    }
});

// Crear grupo
router.post('/grupos', requireAuth, requirePermission('admin:grupos:write'), async (req, res) => {
    try {
        if (!req.body.nombre || !req.body.nombre.trim()) {
            return res.status(400).json({ error: 'El nombre de la clase/materia es obligatorio. Ej: Matematicas - 10A.' });
        }

        const nuevoGrupo = await Grupo.create({
            ...req.body,
            nombre: req.body.nombre.trim()
        });
        if (nuevoGrupo.id_profesor) {
            const [relation, created] = await RelacionRecurso.findOrCreate({
                where: {
                    id_entidad: nuevoGrupo.id_profesor,
                    id_recurso: nuevoGrupo.id_grupo,
                    relacion: 'director_grupo'
                },
                defaults: { activo: true }
            });
            if (!created && !relation.activo) {
                await relation.update({ activo: true });
            }
        }
        await auditInfo(req, {
            accion: 'CREATE',
            seccion: 'CLASES',
            descripcion: `Admin creo grupo ${nuevoGrupo.nombre}`,
            metadata: { id_grupo: nuevoGrupo.id_grupo, id_profesor: nuevoGrupo.id_profesor }
        });
        res.json(nuevoGrupo);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear grupo' });
    }
});

// ---- GESTIÓN DE ROLES Y PERMISOS ----

// Listar todos los permisos
router.get('/permisos', requireAuth, requirePermission('admin:roles:read'), async (req, res) => {
    try {
        const permisos = await Permiso.findAll();
        const permisosDTO = permisos.map(p => PermissionDTO(p));
        res.json(permisosDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

// Listar tipos de roles
router.get('/tipo-roles', requireAuth, requirePermission('admin:roles:read'), async (req, res) => {
    try {
        const tipos = await TipoRol.findAll();
        res.json(tipos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tipos de roles' });
    }
});

// Listar roles con sus permisos
router.get('/roles', requireAuth, requirePermission('admin:roles:read'), async (req, res) => {
    try {
        const roles = await Rol.findAll({
            include: [
                { model: Permiso, as: 'permisos' },
                { model: TipoRol, as: 'tipo' }
            ]
        });
        const rolesDTO = roles.map(r => RoleDTO(r));
        res.json(rolesDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

// Crear Rol
router.post('/roles', requireAuth, requirePermission('admin:roles:write'), async (req, res) => {
    const { nombre, descripcion, permisosIds } = req.body;
    try {
        const existe = await Rol.findOne({ where: { nombre } });
        if (existe) return res.status(400).json({ error: 'El rol ya existe' });

        // Los roles creados por el admin siempre son tipo 'Personalizado'
        const tipoPersonalizado = await TipoRol.findOne({ where: { nombre: 'Personalizado' } });

        const nuevoRol = await Rol.create({ 
            nombre, 
            descripcion, 
            id_tipo_rol: tipoPersonalizado?.id_tipo_rol || null, 
            activo: true 
        });

        await auditWarning(req, {
            accion: 'CREATE',
            seccion: 'ROLES',
            descripcion: `Admin creo rol ${nombre}`,
            metadata: { id_rol: nuevoRol.id_rol, permisosIds }
        });

        if (permisosIds && permisosIds.length > 0) {
            const mappings = permisosIds.map(pid => ({
                id_rol: nuevoRol.id_rol,
                id_permiso: pid
            }));
            await RolPermiso.bulkCreate(mappings);
        }

        const roleConPermisos = await Rol.findByPk(nuevoRol.id_rol, {
            include: [
                { model: Permiso, as: 'permisos' },
                { model: TipoRol, as: 'tipo' }
            ]
        });

        res.status(201).json(RoleDTO(roleConPermisos));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

// Actualizar Rol
router.put('/roles/:id', requireAuth, requirePermission('admin:roles:write'), async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, id_tipo_rol } = req.body;
    try {
        const updateData = {};
        if (nombre) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (id_tipo_rol) updateData.id_tipo_rol = id_tipo_rol;

        const before = await Rol.findByPk(id);
        if (!before) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }

        await Rol.update(updateData, { where: { id_rol: id } });
        const updatedRol = await Rol.findByPk(id, {
            include: [{ model: Permiso, as: 'permisos' }, { model: TipoRol, as: 'tipo' }]
        });
        await auditWarning(req, {
            accion: 'UPDATE',
            seccion: 'ROLES',
            descripcion: `Admin actualizo rol ${id}`,
            metadata: { before: before.get({ plain: true }), changes: updateData }
        });
        res.json(RoleDTO(updatedRol));
    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// Asignar permiso a rol
router.post('/roles/:id_rol/permisos', requireAuth, requirePermission('admin:roles:write'), async (req, res) => {
    const { id_rol } = req.params;
    const { id_permiso } = req.body;
    try {
        await RolPermiso.findOrCreate({ where: { id_rol, id_permiso } });
        await auditWarning(req, {
            accion: 'PERMISSION_GRANT',
            seccion: 'ROLES',
            descripcion: `Admin asigno permiso ${id_permiso} al rol ${id_rol}`,
            metadata: { id_rol, id_permiso }
        });
        res.json({ message: 'Permiso asignado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar permiso' });
    }
});

// Quitar permiso a rol
router.delete('/roles/:id_rol/permisos/:id_permiso', requireAuth, requirePermission('admin:roles:delete'), async (req, res) => {
    const { id_rol, id_permiso } = req.params;
    try {
        const [role, permission] = await Promise.all([
            Rol.findByPk(id_rol),
            Permiso.findByPk(id_permiso)
        ]);

        if (role?.nombre === 'Admin' && permission?.nombre === 'admin:*') {
            return res.status(400).json({ error: 'No se puede revocar el permiso maestro admin:* del rol Admin.' });
        }

        await RolPermiso.destroy({ where: { id_rol, id_permiso } });
        await auditWarning(req, {
            accion: 'PERMISSION_REVOKE',
            seccion: 'ROLES',
            descripcion: `Admin revoco permiso ${id_permiso} del rol ${id_rol}`,
            metadata: { id_rol, id_permiso }
        });
        res.json({ message: 'Permiso revocado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al revocar permiso' });
    }
});

export default router;
