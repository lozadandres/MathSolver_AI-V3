import express from 'express';
import crypto from 'crypto';
import { Usuario, RelacionRecurso, Grupo } from '../models/index.js';
import CodigoInvitacion from '../models/CodigoInvitacion.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { GroupDTO, UserDTO } from '../dtos/index.js';

const router = express.Router();

// Listar alumnos asignados
// Listar alumnos asignados
router.get('/alumnos', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        const profesorId = parseInt(req.user.sub);
        const relaciones = await RelacionRecurso.findAll({
            where: { id_entidad: profesorId, relacion: 'tutor_de', activo: true }
        });

        const studentIds = relaciones.map(r => r.id_recurso);
        
        if (studentIds.length === 0) return res.json([]);

        const alumnos = await Usuario.findAll({
            where: { id_usuario: studentIds },
            attributes: ['id_usuario', 'email', 'activo']
        });

        const alumnosDTO = alumnos.map(a => UserDTO(a));
        res.json(alumnosDTO);
    } catch (error) {
        console.error("ERROR FINAL EN /profesor/alumnos:", error);
        res.status(500).json({ error: 'Error interno', details: error.message });
    }
});

// Generar código de invitación
router.post('/codigo', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        const codigo = crypto.randomBytes(4).toString('hex').toUpperCase(); // Ej: A1B2C3D4
        const nuevoCodigo = await CodigoInvitacion.create({
            codigo,
            id_profesor: req.user.sub,
            id_grupo: req.body.id_grupo || null,
            usos_maximos: req.body.usos_maximos || null
        });
        res.json(nuevoCodigo);
    } catch (error) {
        res.status(500).json({ error: 'Error al generar código' });
    }
});

// Listar códigos del profesor
router.get('/codigos', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        const codigos = await CodigoInvitacion.findAll({ where: { id_profesor: req.user.sub } });
        res.json(codigos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener códigos' });
    }
});

// Eliminar (desactivar) código de invitación
router.delete('/codigo/:id', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        await CodigoInvitacion.update({ activo: false }, { 
            where: { id_codigo: req.params.id, id_profesor: req.user.sub } 
        });
        res.json({ message: 'Código desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar código' });
    }
});

// Desvincular alumno
router.delete('/alumnos/:id', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        await RelacionRecurso.update({ activo: false }, {
            where: { 
                id_entidad: req.user.sub, 
                id_recurso: req.params.id, 
                relacion: 'tutor_de' 
            }
        });
        res.json({ message: 'Alumno desvinculado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al desvincular alumno' });
    }
});

// Listar grupos del profesor
router.get('/grupos', requireAuth, requireRole(['Profesor']), async (req, res) => {
    try {
        const grupos = await Grupo.findAll({
            where: { id_profesor: req.user.sub, activo: true },
            include: [{ 
                model: Usuario, 
                as: 'integrantes', 
                attributes: ['id_usuario', 'email'],
                through: { attributes: [] } 
            }]
        });
        const gruposDTO = grupos.map(g => GroupDTO(g));
        res.json(gruposDTO);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

export default router;
