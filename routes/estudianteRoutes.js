import express from 'express';
import { RelacionRecurso, Usuario, Grupo, UsuarioGrupo } from '../models/index.js';
import CodigoInvitacion from '../models/CodigoInvitacion.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import { checkPolicy } from '../middleware/policyMiddleware.js';
import { GroupDTO } from '../dtos/index.js';
import { logActionInfo, logActionWarning } from '../utils/actionLogger.js';

const router = express.Router();
const contextualGroupRoles = ['director_grupo', 'profesor_materia', 'tutor_asistente', 'alumno'];
const roleRelationPayload = (relation) => ({
    id: relation.id_relacion,
    id_usuario: relation.id_entidad,
    id_grupo: relation.id_recurso,
    email: relation.entidad_usuario?.email,
    relacion: relation.relacion,
    activo: relation.activo,
    fecha_creacion: relation.fecha_creacion
});

// Unirse a la clase de un profesor usando código
router.post('/unirse', requireAuth, requirePermission('CLASES_UNIRSE'), checkPolicy('solo_estudiante_puede_unirse'), checkPolicy('codigo_con_usos_disponibles'), checkPolicy('codigo_no_expirado'), checkPolicy('limite_alumnos_clase'), checkPolicy('clase_debe_estar_activa'), async (req, res) => {
    const { codigo } = req.body;
    try {
        const invitacion = await CodigoInvitacion.findOne({ where: { codigo, activo: true } });
        
        if (!invitacion) {
            await logActionWarning(req, {
                accion: 'STUDENT_JOIN_FAILED',
                seccion: 'ESTUDIANTE',
                resultado: 'FAILED',
                descripcion: 'Estudiante intento unirse con codigo invalido o inactivo',
                metadata: { codigo }
            });
            return res.status(404).json({ error: 'Código inválido o inactivo' });
        }

        if (invitacion.usos_maximos && invitacion.usos_actuales >= invitacion.usos_maximos) {
            await logActionWarning(req, {
                accion: 'STUDENT_JOIN_FAILED',
                seccion: 'ESTUDIANTE',
                resultado: 'FAILED',
                descripcion: 'Estudiante intento usar un codigo sin usos disponibles',
                metadata: { codigo, id_codigo: invitacion.id_codigo, id_grupo: invitacion.id_grupo }
            });
            return res.status(400).json({ error: 'Este código ha alcanzado su límite de usos' });
        }

        let yaRelacionado = false;
        let yaEnGrupo = false;

        // 1. Manejar Relación con Profesor (Tutor)
        const existenteRelacion = await RelacionRecurso.findOne({
            where: { id_entidad: invitacion.id_profesor, id_recurso: req.user.sub, relacion: 'tutor_de' }
        });

        if (!existenteRelacion) {
            await RelacionRecurso.create({
                id_entidad: invitacion.id_profesor,
                id_recurso: req.user.sub,
                relacion: 'tutor_de',
                activo: true
            });
        } else {
            yaRelacionado = true;
        }

        // 2. Manejar Relación con Grupo (si el código tiene grupo asignado)
        if (invitacion.id_grupo) {
            const existenteGrupo = await UsuarioGrupo.findOne({
                where: { id_usuario: req.user.sub, id_grupo: invitacion.id_grupo }
            });

            if (!existenteGrupo) {
                await UsuarioGrupo.create({
                    id_usuario: req.user.sub,
                    id_grupo: invitacion.id_grupo
                });

                const [alumnoRelation, createdAlumnoRelation] = await RelacionRecurso.findOrCreate({
                    where: {
                        id_entidad: req.user.sub,
                        id_recurso: invitacion.id_grupo,
                        relacion: 'alumno'
                    },
                    defaults: { activo: true }
                });
                if (!createdAlumnoRelation && !alumnoRelation.activo) {
                    await alumnoRelation.update({ activo: true });
                }
            } else {
                yaEnGrupo = true;
            }
        }

        // Si ya estaba en ambos casos, simplemente devolver éxito con mensaje informativo
        if (yaRelacionado && (invitacion.id_grupo ? yaEnGrupo : true)) {
            await logActionInfo(req, {
                accion: 'STUDENT_JOIN_ALREADY_MEMBER',
                seccion: 'ESTUDIANTE',
                descripcion: 'Estudiante intento unirse a una clase donde ya estaba inscrito',
                metadata: { codigo, id_codigo: invitacion.id_codigo, id_grupo: invitacion.id_grupo }
            });
            return res.json({ message: 'Ya eres parte de este grupo/clase', alreadyJoined: true });
        }

        // Actualizar usos del código
        invitacion.usos_actuales += 1;
        await invitacion.save();

        await logActionInfo(req, {
            accion: 'STUDENT_JOIN_CLASS',
            seccion: 'ESTUDIANTE',
            descripcion: 'Estudiante se unio mediante codigo de invitacion',
            metadata: { codigo, id_codigo: invitacion.id_codigo, id_grupo: invitacion.id_grupo, id_profesor: invitacion.id_profesor }
        });

        res.json({ message: 'Te has unido exitosamente' });
    } catch (error) {
        console.error("Error al unirse:", error);
        res.status(500).json({ error: 'Error interno al procesar la unión a la clase' });
    }
});

// Listar grupos del estudiante
router.get('/grupos', requireAuth, requirePermission('CLASES_VER'), async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.user.sub, {
            include: [{
                model: Grupo,
                as: 'mis_grupos',
                through: { attributes: [] },
                include: [{ model: Usuario, as: 'tutor', attributes: ['email'] }]
            }]
        });
        const grupos = usuario.mis_grupos || [];
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
        console.error(error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

export default router;
