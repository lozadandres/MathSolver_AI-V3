import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Documento, Grupo, Usuario } from '../models/index.js';
import {
    requireAuth,
    requirePermission,
    userHasGroupAccess,
    userHasGroupRole
} from '../middleware/authMiddleware.js';
import { logActionDanger, logActionInfo, logActionWarning } from '../utils/actionLogger.js';

const router = express.Router();
const documentosDir = path.join(process.cwd(), 'uploads', 'documentos');
fs.mkdirSync(documentosDir, { recursive: true });

const allowedMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, documentosDir),
        filename: (req, file, cb) => {
            const safeName = file.originalname
                .toLowerCase()
                .replace(/[^a-z0-9.]+/g, '-')
                .replace(/^-+|-+$/g, '');
            cb(null, `grupo-${req.params.id || 'doc'}-${Date.now()}-${safeName}`);
        }
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return cb(new Error('Solo se permiten archivos PDF o imagenes JPG, PNG y WEBP.'));
        }
        cb(null, true);
    }
});

const documentInclude = [
    { model: Grupo, as: 'grupo', attributes: ['id_grupo', 'nombre', 'descripcion', 'id_profesor', 'activo'] },
    { model: Usuario, as: 'creador', attributes: ['id_usuario', 'email'] }
];

const documentPayload = (documento) => ({
    id: documento.id_documento,
    id_documento: documento.id_documento,
    id_grupo: documento.id_grupo,
    id_usuario_creador: documento.id_usuario_creador,
    titulo: documento.titulo,
    descripcion: documento.descripcion,
    tipo: documento.tipo,
    contenido: documento.contenido,
    archivo_url: documento.archivo_url,
    mime_type: documento.mime_type,
    visible_estudiantes: documento.visible_estudiantes,
    activo: documento.activo,
    fecha_creacion: documento.fecha_creacion,
    fecha_actualizacion: documento.fecha_actualizacion,
    grupo: documento.grupo ? {
        id: documento.grupo.id_grupo,
        nombre: documento.grupo.nombre,
        descripcion: documento.grupo.descripcion
    } : null,
    creador: documento.creador ? {
        id: documento.creador.id_usuario,
        email: documento.creador.email
    } : null
});

const isStudent = (req) => req.user.role === 'Estudiante';

const canReadDocument = async (req, documento) => {
    if (req.user.role === 'Admin') return true;
    if (!documento.activo || !documento.grupo?.activo) return false;

    const hasGroupAccess = await userHasGroupAccess(req.user, documento.id_grupo);
    if (!hasGroupAccess) return false;

    if (isStudent(req)) {
        return documento.visible_estudiantes === true;
    }

    return true;
};

const canPublishInGroup = async (req, groupId) => {
    if (req.user.role === 'Admin') return true;
    if (req.user.role !== 'Profesor') return false;

    const grupo = await Grupo.findByPk(groupId);
    if (!grupo?.activo) return false;
    if (parseInt(grupo.id_profesor, 10) === parseInt(req.user.sub, 10)) return true;

    return userHasGroupRole(req.user, groupId, ['director_grupo', 'profesor_materia', 'tutor_asistente']);
};

const canManageDocument = async (req, documento, { allowOwn = true } = {}) => {
    if (req.user.role === 'Admin') return true;
    if (req.user.role !== 'Profesor') return false;

    const isOwner = parseInt(documento.id_usuario_creador, 10) === parseInt(req.user.sub, 10);
    const isDirector = await userHasGroupRole(req.user, documento.id_grupo, ['director_grupo']);
    if (isDirector) return true;

    const isClassOwner = parseInt(documento.grupo?.id_profesor, 10) === parseInt(req.user.sub, 10);
    if (isClassOwner) return true;

    const isTeacher = await userHasGroupRole(req.user, documento.id_grupo, ['profesor_materia', 'tutor_asistente']);
    return allowOwn && isTeacher && isOwner;
};

const removeUploadedFile = (archivoUrl) => {
    if (!archivoUrl || !archivoUrl.startsWith('/uploads/documentos/')) return;
    const filePath = path.join(process.cwd(), archivoUrl.replace(/^\//, ''));
    if (filePath.startsWith(documentosDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

router.get('/grupos/:id/documentos', requireAuth, requirePermission('read:documento'), async (req, res) => {
    try {
        const groupId = parseInt(req.params.id, 10);
        if (!await userHasGroupAccess(req.user, groupId)) {
            await logActionDanger(req, {
                accion: 'DOCUMENT_DENY',
                seccion: 'DOCUMENTOS',
                resultado: 'DENIED',
                descripcion: 'Acceso denegado al listado de documentos de clase.',
                metadata: { id_grupo: groupId }
            });
            return res.status(403).json({ error: 'No tienes acceso a los documentos de esta clase.' });
        }

        const where = { id_grupo: groupId, activo: true };
        if (isStudent(req)) where.visible_estudiantes = true;

        const documentos = await Documento.findAll({
            where,
            include: documentInclude,
            order: [['fecha_creacion', 'DESC']]
        });

        await logActionInfo(req, {
            accion: 'DOCUMENT_LIST',
            seccion: 'DOCUMENTOS',
            descripcion: 'Usuario consulto materiales de clase.',
            metadata: { id_grupo: groupId, total: documentos.length }
        });

        res.json(documentos.map(documentPayload));
    } catch (error) {
        console.error('Error listando documentos:', error);
        res.status(500).json({ error: 'Error interno listando documentos.' });
    }
});

router.post('/grupos/:id/documentos', requireAuth, requirePermission('edit:documento'), (req, res) => {
    upload.single('archivo')(req, res, async (uploadError) => {
        if (uploadError) {
            const status = uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({ error: uploadError.message });
        }

        try {
            const groupId = parseInt(req.params.id, 10);
            if (!await canPublishInGroup(req, groupId)) {
                if (req.file?.path) removeUploadedFile(`/uploads/documentos/${req.file.filename}`);
                await logActionDanger(req, {
                    accion: 'DOCUMENT_DENY',
                    seccion: 'DOCUMENTOS',
                    resultado: 'DENIED',
                    descripcion: 'Usuario intento publicar material sin cargo suficiente.',
                    metadata: { id_grupo: groupId }
                });
                return res.status(403).json({ error: 'No puedes publicar materiales en esta clase.' });
            }

            const { titulo, descripcion, tipo = 'archivo', contenido, visible_estudiantes = 'true' } = req.body;
            if (!titulo || !tipo) {
                if (req.file?.path) removeUploadedFile(`/uploads/documentos/${req.file.filename}`);
                return res.status(400).json({ error: 'Titulo y tipo son obligatorios.' });
            }

            if (tipo === 'archivo' && !req.file) {
                return res.status(400).json({ error: 'Debes adjuntar un PDF o imagen para este tipo de material.' });
            }

            if ((tipo === 'enlace' || tipo === 'texto' || tipo === 'tarea') && !contenido?.trim()) {
                return res.status(400).json({ error: 'Debes agregar contenido para este tipo de material.' });
            }

            const documento = await Documento.create({
                id_grupo: groupId,
                id_usuario_creador: req.user.sub,
                titulo,
                descripcion,
                tipo,
                contenido: contenido || null,
                archivo_url: req.file ? `/uploads/documentos/${req.file.filename}` : null,
                mime_type: req.file?.mimetype || null,
                visible_estudiantes: visible_estudiantes === true || visible_estudiantes === 'true',
                activo: true
            });

            await logActionInfo(req, {
                accion: 'DOCUMENT_CREATE',
                seccion: 'DOCUMENTOS',
                descripcion: 'Profesor publico material de clase.',
                metadata: { id_documento: documento.id_documento, id_grupo: groupId, tipo }
            });

            const created = await Documento.findByPk(documento.id_documento, { include: documentInclude });
            res.status(201).json(documentPayload(created));
        } catch (error) {
            if (req.file?.path) removeUploadedFile(`/uploads/documentos/${req.file.filename}`);
            console.error('Error creando documento:', error);
            res.status(500).json({ error: 'Error interno creando documento.' });
        }
    });
});

router.get('/documentos/:id', requireAuth, requirePermission('read:documento'), async (req, res) => {
    try {
        const documento = await Documento.findByPk(req.params.id, { include: documentInclude });
        if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (!await canReadDocument(req, documento)) {
            await logActionDanger(req, {
                accion: 'DOCUMENT_DENY',
                seccion: 'DOCUMENTOS',
                resultado: 'DENIED',
                descripcion: 'Acceso denegado a documento de clase.',
                metadata: { id_documento: req.params.id, id_grupo: documento.id_grupo }
            });
            return res.status(403).json({ error: 'No tienes acceso a este documento.' });
        }

        await logActionInfo(req, {
            accion: 'DOCUMENT_VIEW',
            seccion: 'DOCUMENTOS',
            descripcion: 'Usuario consulto documento de clase.',
            metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo }
        });

        res.json(documentPayload(documento));
    } catch (error) {
        console.error('Error consultando documento:', error);
        res.status(500).json({ error: 'Error interno consultando documento.' });
    }
});

router.put('/documentos/:id', requireAuth, requirePermission('edit:documento'), async (req, res) => {
    try {
        const documento = await Documento.findByPk(req.params.id, { include: documentInclude });
        if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (!await canManageDocument(req, documento)) {
            await logActionDanger(req, {
                accion: 'DOCUMENT_DENY',
                seccion: 'DOCUMENTOS',
                resultado: 'DENIED',
                descripcion: 'Usuario intento editar material sin autorizacion.',
                metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo }
            });
            return res.status(403).json({ error: 'No puedes editar este material.' });
        }

        const allowedFields = ['titulo', 'descripcion', 'tipo', 'contenido', 'visible_estudiantes', 'activo'];
        const changes = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) changes[field] = req.body[field];
        }

        await documento.update(changes);
        await logActionWarning(req, {
            accion: 'DOCUMENT_UPDATE',
            seccion: 'DOCUMENTOS',
            descripcion: 'Usuario actualizo material de clase.',
            metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo, cambios: changes }
        });

        const updated = await Documento.findByPk(documento.id_documento, { include: documentInclude });
        res.json(documentPayload(updated));
    } catch (error) {
        console.error('Error actualizando documento:', error);
        res.status(500).json({ error: 'Error interno actualizando documento.' });
    }
});

router.delete('/documentos/:id', requireAuth, requirePermission('delete:documento'), async (req, res) => {
    try {
        const documento = await Documento.findByPk(req.params.id, { include: documentInclude });
        if (!documento) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (!await canManageDocument(req, documento)) {
            await logActionDanger(req, {
                accion: 'DOCUMENT_DENY',
                seccion: 'DOCUMENTOS',
                resultado: 'DENIED',
                descripcion: 'Usuario intento eliminar material sin autorizacion.',
                metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo }
            });
            return res.status(403).json({ error: 'No puedes eliminar este material.' });
        }

        await documento.update({ activo: false });
        await logActionWarning(req, {
            accion: 'DOCUMENT_DELETE',
            seccion: 'DOCUMENTOS',
            descripcion: 'Usuario elimino material de clase.',
            metadata: { id_documento: documento.id_documento, id_grupo: documento.id_grupo }
        });

        res.json({ message: 'Material eliminado correctamente.' });
    } catch (error) {
        console.error('Error eliminando documento:', error);
        res.status(500).json({ error: 'Error interno eliminando documento.' });
    }
});

export default router;
