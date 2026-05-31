import express from 'express';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { Usuario, RelacionRecurso, Grupo, Rol, UsuarioGrupo } from '../models/index.js';
import CodigoInvitacion from '../models/CodigoInvitacion.js';
import { requireAuth, requirePermission, requireGroupRole, userHasGroupRole } from '../middleware/authMiddleware.js';
import { checkPolicy } from '../middleware/policyMiddleware.js';
import { GroupDTO, UserDTO } from '../dtos/index.js';
import { logActionInfo, logActionWarning } from '../utils/actionLogger.js';

const router = express.Router();
const teacherGroupRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente'];
const assignableGroupRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente'];

const ensureGroupRelation = async ({ id_entidad, id_recurso, relacion }) => {
    const [relation, created] = await RelacionRecurso.findOrCreate({
        where: { id_entidad, id_recurso, relacion },
        defaults: { activo: true }
    });

    if (!created && !relation.activo) {
        await relation.update({ activo: true });
    }

    return relation;
};

const getGroupRolesForUser = async (userId, groupIds) => {
    const rolesByGroup = {};
    if (!groupIds.length) return rolesByGroup;

    const relaciones = await RelacionRecurso.findAll({
        where: {
            id_entidad: userId,
            id_recurso: groupIds,
            relacion: teacherGroupRoles,
            activo: true
        }
    });

    relaciones.forEach((rel) => {
        if (!rolesByGroup[rel.id_recurso]) rolesByGroup[rel.id_recurso] = [];
        rolesByGroup[rel.id_recurso].push(rel.relacion);
    });

    return rolesByGroup;
};

// Listar alumnos asignados
// Listar alumnos asignados
router.get('/alumnos', requireAuth, requirePermission('ALUMNOS_GESTIONAR'), async (req, res) => {
    try {
        const profesorId = parseInt(req.user.sub);
        const relaciones = await RelacionRecurso.findAll({
            where: { id_entidad: profesorId, relacion: 'tutor_de', activo: true }
        });

        const teacherRelations = await RelacionRecurso.findAll({
            where: {
                id_entidad: profesorId,
                relacion: teacherGroupRoles,
                activo: true
            }
        });

        const ownedGroups = await Grupo.findAll({
            where: { id_profesor: profesorId, activo: true },
            attributes: ['id_grupo', 'nombre']
        });

        const teacherGroupIds = [
            ...ownedGroups.map(group => group.id_grupo),
            ...teacherRelations.map(relation => relation.id_recurso)
        ];
        const uniqueTeacherGroupIds = [...new Set(teacherGroupIds)];

        const studentIds = [...new Set(relaciones.map(r => r.id_recurso))];
        
        if (studentIds.length === 0) return res.json([]);

        const alumnos = await Usuario.findAll({
            where: { id_usuario: studentIds },
            attributes: ['id_usuario', 'email', 'activo']
        });

        const studentGroupLinks = uniqueTeacherGroupIds.length
            ? await UsuarioGrupo.findAll({
                where: {
                    id_usuario: studentIds,
                    id_grupo: uniqueTeacherGroupIds
                }
            })
            : [];

        const linkedGroupIds = [...new Set(studentGroupLinks.map(link => link.id_grupo))];
        const linkedGroups = linkedGroupIds.length
            ? await Grupo.findAll({
                where: { id_grupo: linkedGroupIds },
                attributes: ['id_grupo', 'nombre']
            })
            : [];
        const groupById = Object.fromEntries(linkedGroups.map(group => [group.id_grupo, group]));
        const groupsByStudent = {};

        studentGroupLinks.forEach((link) => {
            if (!groupsByStudent[link.id_usuario]) groupsByStudent[link.id_usuario] = [];
            const group = groupById[link.id_grupo];
            if (group && !groupsByStudent[link.id_usuario].some(item => item.id === group.id_grupo)) {
                groupsByStudent[link.id_usuario].push({
                    id: group.id_grupo,
                    nombre: group.nombre
                });
            }
        });

        const alumnosDTO = alumnos.map(a => ({
            ...UserDTO(a),
            clases: groupsByStudent[a.id_usuario] || []
        }));
        res.json(alumnosDTO);
    } catch (error) {
        console.error("ERROR FINAL EN /profesor/alumnos:", error);
        res.status(500).json({ error: 'Error interno', details: error.message });
    }
});

// Generar código de invitación
router.post('/codigo', requireAuth, requirePermission('CODIGOS_GESTIONAR'), checkPolicy('clase_debe_estar_activa'), async (req, res) => {
    try {
        if (req.body.id_grupo && !await userHasGroupRole(req.user, req.body.id_grupo, teacherGroupRoles)) {
            await logActionWarning(req, {
                accion: 'PROFESOR_CREATE_CODE_DENIED',
                seccion: 'PROFESOR',
                resultado: 'DENIED',
                descripcion: 'Profesor intento generar codigo en una clase sin cargo contextual',
                metadata: { id_grupo: req.body.id_grupo }
            });
            return res.status(403).json({ error: 'No tienes rol contextual para generar codigos en este grupo.' });
        }

        const codigo = crypto.randomBytes(4).toString('hex').toUpperCase(); // Ej: A1B2C3D4
        const nuevoCodigo = await CodigoInvitacion.create({
            codigo,
            id_profesor: req.user.sub,
            id_grupo: req.body.id_grupo || null,
            usos_maximos: req.body.usos_maximos || null,
            fecha_expiracion: req.body.fecha_expiracion || null
        });
        await logActionInfo(req, {
            accion: 'PROFESOR_CREATE_CODE',
            seccion: 'PROFESOR',
            descripcion: `Profesor genero codigo de invitacion ${codigo}`,
            metadata: { id_codigo: nuevoCodigo.id_codigo, codigo, id_grupo: nuevoCodigo.id_grupo, usos_maximos: nuevoCodigo.usos_maximos, fecha_expiracion: nuevoCodigo.fecha_expiracion }
        });
        res.json(nuevoCodigo);
    } catch (error) {
        res.status(500).json({ error: 'Error al generar código' });
    }
});

// Listar códigos del profesor
router.get('/codigos', requireAuth, requirePermission('CODIGOS_GESTIONAR'), async (req, res) => {
    try {
        const codigos = await CodigoInvitacion.findAll({
            where: { id_profesor: req.user.sub },
            include: [{ model: Grupo, as: 'grupo', attributes: ['id_grupo', 'nombre'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(codigos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener códigos' });
    }
});

// Editar codigo de invitacion sin cambiar el texto del codigo ya compartido
router.put('/codigo/:id', requireAuth, requirePermission('CODIGOS_GESTIONAR'), async (req, res) => {
    try {
        const { id_grupo, usos_maximos, activo, fecha_expiracion } = req.body;
        const codigo = await CodigoInvitacion.findOne({
            where: { id_codigo: req.params.id, id_profesor: req.user.sub }
        });

        if (!codigo) return res.status(404).json({ error: 'Codigo no encontrado.' });

        const nextGroupId = id_grupo ? parseInt(id_grupo, 10) : null;
        if (nextGroupId && !await userHasGroupRole(req.user, nextGroupId, teacherGroupRoles)) {
            await logActionWarning(req, {
                accion: 'PROFESOR_UPDATE_CODE_DENIED',
                seccion: 'PROFESOR',
                resultado: 'DENIED',
                descripcion: 'Profesor intento asociar codigo a una clase sin cargo contextual',
                metadata: { id_codigo: codigo.id_codigo, id_grupo: nextGroupId }
            });
            return res.status(403).json({ error: 'No tienes rol contextual para asociar codigos a este grupo.' });
        }

        const nextMaxUses = usos_maximos === '' || usos_maximos === null || usos_maximos === undefined
            ? null
            : parseInt(usos_maximos, 10);

        if (nextMaxUses !== null && (!Number.isInteger(nextMaxUses) || nextMaxUses < 1)) {
            return res.status(400).json({ error: 'El limite de usos debe ser un numero mayor a cero.' });
        }

        if (nextMaxUses !== null && nextMaxUses < codigo.usos_actuales) {
            return res.status(400).json({ error: `El limite no puede ser menor que los usos actuales (${codigo.usos_actuales}).` });
        }

        const before = codigo.get({ plain: true });
        const updateData = {
            id_grupo: nextGroupId,
            usos_maximos: nextMaxUses
        };

        if (activo !== undefined) {
            updateData.activo = activo === true || activo === 'true';
        }

        if (fecha_expiracion !== undefined) {
            updateData.fecha_expiracion = fecha_expiracion || null;
        }

        await codigo.update(updateData);
        await logActionWarning(req, {
            accion: 'PROFESOR_UPDATE_CODE',
            seccion: 'PROFESOR',
            descripcion: `Profesor edito codigo ${codigo.codigo}`,
            metadata: {
                id_codigo: codigo.id_codigo,
                codigo: codigo.codigo,
                before: {
                    id_grupo: before.id_grupo,
                    usos_maximos: before.usos_maximos,
                    activo: before.activo,
                    fecha_expiracion: before.fecha_expiracion
                },
                changes: updateData
            }
        });

        const updated = await CodigoInvitacion.findByPk(codigo.id_codigo, {
            include: [{ model: Grupo, as: 'grupo', attributes: ['id_grupo', 'nombre'] }]
        });
        res.json(updated);
    } catch (error) {
        console.error('Error al editar codigo:', error);
        res.status(500).json({ error: 'Error al editar codigo' });
    }
});

// Eliminar (desactivar) código de invitación
router.delete('/codigo/:id', requireAuth, requirePermission('CODIGOS_GESTIONAR'), async (req, res) => {
    try {
        const codigo = await CodigoInvitacion.findOne({ where: { id_codigo: req.params.id, id_profesor: req.user.sub } });
        await CodigoInvitacion.update({ activo: false }, { 
            where: { id_codigo: req.params.id, id_profesor: req.user.sub } 
        });
        await logActionWarning(req, {
            accion: 'PROFESOR_DISABLE_CODE',
            seccion: 'PROFESOR',
            descripcion: `Profesor desactivo codigo ${req.params.id}`,
            metadata: { id_codigo: req.params.id, codigo: codigo?.codigo, id_grupo: codigo?.id_grupo }
        });
        res.json({ message: 'Código desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar código' });
    }
});

// Desvincular alumno
router.delete('/alumnos/:id', requireAuth, requirePermission('ALUMNOS_GESTIONAR'), async (req, res) => {
    try {
        await RelacionRecurso.update({ activo: false }, {
            where: { 
                id_entidad: req.user.sub, 
                id_recurso: req.params.id, 
                relacion: 'tutor_de' 
            }
        });
        await logActionWarning(req, {
            accion: 'PROFESOR_UNLINK_STUDENT',
            seccion: 'PROFESOR',
            descripcion: `Profesor desvinculo alumno ${req.params.id}`,
            metadata: { id_estudiante: req.params.id }
        });
        res.json({ message: 'Alumno desvinculado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al desvincular alumno' });
    }
});

router.patch('/codigo/:id/activar', requireAuth, requirePermission('CODIGOS_GESTIONAR'), async (req, res) => {
    try {
        const codigo = await CodigoInvitacion.findOne({
            where: { id_codigo: req.params.id, id_profesor: req.user.sub }
        });

        if (!codigo) return res.status(404).json({ error: 'Codigo no encontrado.' });

        await codigo.update({ activo: true });
        await logActionInfo(req, {
            accion: 'PROFESOR_ENABLE_CODE',
            seccion: 'PROFESOR',
            descripcion: `Profesor activo codigo ${req.params.id}`,
            metadata: { id_codigo: req.params.id, codigo: codigo.codigo, id_grupo: codigo.id_grupo }
        });

        res.json({ message: 'Codigo activado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al activar codigo' });
    }
});

router.delete('/codigo/:id/permanente', requireAuth, requirePermission('CODIGOS_GESTIONAR'), async (req, res) => {
    try {
        const codigo = await CodigoInvitacion.findOne({
            where: { id_codigo: req.params.id, id_profesor: req.user.sub }
        });

        if (!codigo) return res.status(404).json({ error: 'Codigo no encontrado.' });

        await codigo.destroy();
        await logActionWarning(req, {
            accion: 'PROFESOR_DELETE_CODE_PERMANENT',
            seccion: 'PROFESOR',
            descripcion: `Profesor elimino definitivamente codigo ${req.params.id}`,
            metadata: { id_codigo: req.params.id, codigo: codigo.codigo, id_grupo: codigo.id_grupo }
        });

        res.json({ message: 'Codigo eliminado definitivamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar definitivamente el codigo' });
    }
});

// Listar grupos del profesor
router.get('/grupos', requireAuth, requirePermission('GRUPOS_GESTIONAR'), async (req, res) => {
    try {
        const userId = parseInt(req.user.sub, 10);
        const relaciones = await RelacionRecurso.findAll({
            where: {
                id_entidad: userId,
                relacion: teacherGroupRoles,
                activo: true
            }
        });
        const relatedGroupIds = relaciones.map(r => r.id_recurso);

        const grupos = await Grupo.findAll({
            where: {
                activo: true,
                [Op.or]: [
                    { id_profesor: userId },
                    { id_grupo: relatedGroupIds.length ? relatedGroupIds : null }
                ]
            },
            include: [{ 
                model: Usuario, 
                as: 'integrantes', 
                attributes: ['id_usuario', 'email'],
                through: { attributes: [] } 
            }]
        });
        const rolesByGroup = await getGroupRolesForUser(userId, grupos.map(g => g.id_grupo));

        const gruposDTO = grupos.map(g => {
            const roles = rolesByGroup[g.id_grupo] || [];
            if (g.id_profesor === userId && !roles.includes('director_grupo')) {
                roles.push('director_grupo');
            }
            g.roles_en_grupo = roles;
            return GroupDTO(g);
        });

        res.json(gruposDTO);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

// Crear una clase/materia y registrar al profesor como director contextual del grupo
router.post('/grupos', requireAuth, requirePermission('GRUPOS_GESTIONAR'), async (req, res) => {
    const { nombre, descripcion } = req.body;

    try {
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre de la clase/materia es obligatorio. Ej: Matematicas - 10A.' });
        }

        const grupo = await Grupo.create({
            nombre: nombre.trim(),
            descripcion,
            id_profesor: req.user.sub,
            activo: true
        });

        await ensureGroupRelation({
            id_entidad: req.user.sub,
            id_recurso: grupo.id_grupo,
            relacion: 'director_grupo'
        });

        grupo.roles_en_grupo = ['director_grupo'];
        await logActionInfo(req, {
            accion: 'PROFESOR_CREATE_CLASS',
            seccion: 'PROFESOR',
            descripcion: `Profesor creo clase ${grupo.nombre}`,
            metadata: { id_grupo: grupo.id_grupo, nombre: grupo.nombre, descripcion }
        });
        res.status(201).json(GroupDTO(grupo));
    } catch (error) {
        console.error('Error al crear grupo:', error);
        res.status(500).json({ error: 'Error al crear grupo' });
    }
});

// El director del grupo puede desactivar/eliminar su clase
router.delete('/grupos/:id', requireAuth, requirePermission('GRUPOS_GESTIONAR'), requireGroupRole(['director_grupo']), checkPolicy('propiedad_estricta_eliminar_clase'), async (req, res) => {
    try {
        await Grupo.update({ activo: false }, { where: { id_grupo: req.params.id } });
        await RelacionRecurso.update(
            { activo: false },
            { where: { id_recurso: req.params.id, relacion: teacherGroupRoles } }
        );
        await logActionWarning(req, {
            accion: 'PROFESOR_DELETE_CLASS',
            seccion: 'PROFESOR',
            descripcion: `Profesor elimino clase ${req.params.id}`,
            metadata: { id_grupo: req.params.id }
        });

        res.json({ message: 'Clase eliminada/desactivada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar grupo:', error);
        res.status(500).json({ error: 'Error al eliminar grupo' });
    }
});

// Listar profesores disponibles para asignar roles contextuales
router.get('/colegas', requireAuth, requirePermission('GRUPOS_GESTIONAR'), async (req, res) => {
    try {
        const profesores = await Usuario.findAll({
            where: { id_usuario: { [Op.ne]: req.user.sub }, activo: true },
            include: [{ model: Rol, as: 'rol', where: { nombre: 'Profesor' } }],
            attributes: ['id_usuario', 'email', 'activo']
        });

        res.json(profesores.map(UserDTO));
    } catch (error) {
        console.error('Error al obtener colegas:', error);
        res.status(500).json({ error: 'Error al obtener colegas' });
    }
});

// Ver roles contextuales asignados en un grupo
router.get('/grupos/:id/roles', requireAuth, requirePermission('GRUPOS_GESTIONAR'), requireGroupRole(['director_grupo', 'profesor_materia', 'tutor_asistente']), async (req, res) => {
    try {
        const roles = await RelacionRecurso.findAll({
            where: {
                id_recurso: req.params.id,
                relacion: teacherGroupRoles,
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

        const teacherRoles = roles.map(r => ({
            id: r.id_relacion,
            id_usuario: r.id_entidad,
            email: r.entidad_usuario?.email,
            relacion: r.relacion,
            fecha_creacion: r.fecha_creacion
        }));
        const existingDirectorIds = new Set(
            teacherRoles
                .filter(role => role.relacion === 'director_grupo')
                .map(role => String(role.id_usuario))
        );
        const tutorRole = grupo?.id_profesor && !existingDirectorIds.has(String(grupo.id_profesor))
            ? [{
                id: `director-${grupo.id_profesor}`,
                id_usuario: grupo.id_profesor,
                email: grupo.tutor?.email,
                relacion: 'director_grupo',
                fecha_creacion: null
            }]
            : [];

        const studentRoles = (grupo?.integrantes || []).map(alumno => ({
            id: `alumno-${alumno.id_usuario}`,
            id_usuario: alumno.id_usuario,
            email: alumno.email,
            relacion: 'alumno',
            fecha_creacion: null
        }));

        res.json([...tutorRole, ...teacherRoles, ...studentRoles]);
    } catch (error) {
        console.error('Error al obtener roles de grupo:', error);
        res.status(500).json({ error: 'Error al obtener roles del grupo' });
    }
});

// Solo el director puede asignar roles contextuales dentro de su grupo
router.post('/grupos/:id/roles', requireAuth, requirePermission('GRUPOS_GESTIONAR'), requireGroupRole(['director_grupo']), async (req, res) => {
    const { id_usuario, relacion } = req.body;

    try {
        if (!id_usuario || !assignableGroupRoles.includes(relacion)) {
            return res.status(400).json({ error: 'Usuario y rol contextual valido son obligatorios.' });
        }

        const usuario = await Usuario.findByPk(id_usuario, { include: [{ model: Rol, as: 'rol' }] });
        if (!usuario || usuario.rol?.nombre !== 'Profesor') {
            return res.status(400).json({ error: 'Solo puedes asignar roles contextuales a profesores.' });
        }

        const relation = await ensureGroupRelation({
            id_entidad: parseInt(id_usuario, 10),
            id_recurso: parseInt(req.params.id, 10),
            relacion
        });
        await logActionInfo(req, {
            accion: 'PROFESOR_ASSIGN_CONTEXT_ROLE',
            seccion: 'PROFESOR',
            descripcion: `Profesor asigno ${relacion} en clase ${req.params.id}`,
            metadata: { id_usuario, id_grupo: req.params.id, relacion }
        });

        res.status(201).json({
            id: relation.id_relacion,
            id_usuario: relation.id_entidad,
            relacion: relation.relacion,
            activo: relation.activo
        });
    } catch (error) {
        console.error('Error al asignar rol de grupo:', error);
        res.status(500).json({ error: 'Error al asignar rol de grupo' });
    }
});

router.delete('/grupos/:id/roles/:relationId', requireAuth, requirePermission('GRUPOS_GESTIONAR'), requireGroupRole(['director_grupo']), async (req, res) => {
    try {
        const [updated] = await RelacionRecurso.update(
            { activo: false },
            {
                where: {
                    id_relacion: req.params.relationId,
                    id_recurso: req.params.id,
                    relacion: teacherGroupRoles
                }
            }
        );

        if (!updated) return res.status(404).json({ error: 'Rol contextual no encontrado.' });
        await logActionWarning(req, {
            accion: 'PROFESOR_REVOKE_CONTEXT_ROLE',
            seccion: 'PROFESOR',
            descripcion: `Profesor revoco rol contextual ${req.params.relationId}`,
            metadata: { id_relacion: req.params.relationId, id_grupo: req.params.id }
        });
        res.json({ message: 'Rol contextual revocado correctamente.' });
    } catch (error) {
        console.error('Error al revocar rol de grupo:', error);
        res.status(500).json({ error: 'Error al revocar rol de grupo' });
    }
});

export default router;
