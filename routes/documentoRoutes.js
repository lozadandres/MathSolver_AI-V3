import express from 'express';
import { Documento, Grupo } from '../models/index.js';
import { requireAuth, requirePermission, userHasGroupAccess } from '../middleware/authMiddleware.js';
import { logActionDanger, logActionInfo } from '../utils/actionLogger.js';

const router = express.Router();

const canReadDocument = async (req, documento) => {
    if (req.user.role === 'Admin') return true;
    if (!documento.activo || !documento.grupo?.activo) return false;

    const hasGroupAccess = await userHasGroupAccess(req.user, documento.id_grupo);
    if (!hasGroupAccess) return false;

    if (req.user.role === 'Estudiante') {
        return documento.visible_estudiantes === true;
    }

    return true;
};

router.get('/:id', requireAuth, requirePermission('read:documento'), async (req, res) => {
    try {
        const documento = await Documento.findByPk(req.params.id, {
            include: [{ model: Grupo, as: 'grupo', attributes: ['id_grupo', 'nombre', 'descripcion', 'id_profesor', 'activo'] }]
        });

        if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (!await canReadDocument(req, documento)) {
            await logActionDanger(req, {
                accion: 'DOCUMENT_ACCESS_DENIED',
                seccion: 'DOCUMENTOS',
                resultado: 'DENIED',
                descripcion: 'Acceso denegado a documento de clase.',
                metadata: { id_documento: req.params.id, id_grupo: documento.id_grupo }
            });
            return res.status(403).json({ error: 'No tienes acceso a este documento.' });
        }

        await logActionInfo(req, {
            accion: 'DOCUMENT_READ',
            seccion: 'DOCUMENTOS',
            descripcion: 'Usuario consulto documento de clase.',
            metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo }
        });

        res.json({
            id: documento.id_documento,
            titulo: documento.titulo,
            descripcion: documento.descripcion,
            tipo: documento.tipo,
            archivo_url: documento.archivo_url,
            mime_type: documento.mime_type,
            visible_estudiantes: documento.visible_estudiantes,
            activo: documento.activo,
            grupo: documento.grupo ? {
                id: documento.grupo.id_grupo,
                nombre: documento.grupo.nombre,
                descripcion: documento.grupo.descripcion
            } : null,
            fecha_creacion: documento.fecha_creacion
        });
    } catch (error) {
        console.error('Error consultando documento:', error);
        res.status(500).json({ error: 'Error interno consultando documento.' });
    }
});

export default router;
