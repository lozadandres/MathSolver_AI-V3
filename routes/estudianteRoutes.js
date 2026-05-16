import express from 'express';
import { RelacionRecurso, Usuario, Grupo, UsuarioGrupo } from '../models/index.js';
import CodigoInvitacion from '../models/CodigoInvitacion.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { GroupDTO } from '../dtos/index.js';

const router = express.Router();

// Unirse a la clase de un profesor usando código
router.post('/unirse', requireAuth, requireRole(['Estudiante']), async (req, res) => {
    const { codigo } = req.body;
    try {
        const invitacion = await CodigoInvitacion.findOne({ where: { codigo, activo: true } });
        
        if (!invitacion) {
            return res.status(404).json({ error: 'Código inválido o inactivo' });
        }

        if (invitacion.usos_maximos && invitacion.usos_actuales >= invitacion.usos_maximos) {
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
            } else {
                yaEnGrupo = true;
            }
        }

        // Si ya estaba en ambos casos, simplemente devolver éxito con mensaje informativo
        if (yaRelacionado && (invitacion.id_grupo ? yaEnGrupo : true)) {
            return res.json({ message: 'Ya eres parte de este grupo/clase', alreadyJoined: true });
        }

        // Actualizar usos del código
        invitacion.usos_actuales += 1;
        await invitacion.save();

        res.json({ message: 'Te has unido exitosamente' });
    } catch (error) {
        console.error("Error al unirse:", error);
        res.status(500).json({ error: 'Error interno al procesar la unión a la clase' });
    }
});

// Listar grupos del estudiante
router.get('/grupos', requireAuth, requireRole(['Estudiante']), async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.user.sub, {
            include: [{
                model: Grupo,
                as: 'mis_grupos',
                through: { attributes: [] },
                include: [{ model: Usuario, as: 'tutor', attributes: ['email'] }]
            }]
        });
        const gruposDTO = (usuario.mis_grupos || []).map(g => GroupDTO(g));
        res.json(gruposDTO);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

export default router;
