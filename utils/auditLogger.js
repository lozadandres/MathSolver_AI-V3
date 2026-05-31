import { Op } from 'sequelize';
import { LogAccion, LogAuditoria } from '../models/index.js';
import { resolveClient } from './clientLogger.js';

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 90;

const getIpAddress = (req) => {
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
    return req?.ip || req?.socket?.remoteAddress || null;
};

const inferResultado = (accion, nivel) => {
    if (String(accion).includes('FAILED')) return 'FAILED';
    if (String(accion).includes('DENIED') || nivel === 'danger') return 'DENIED';
    return 'SUCCESS';
};

export const auditLog = async (req, {
    accion,
    seccion = 'SISTEMA',
    nivel = 'info',
    descripcion,
    metadata = null,
    id_usuario = null
}) => {
    try {
        const now = Date.now();
        if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
            lastCleanupAt = now;
            const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
            LogAuditoria.destroy({
                where: { fecha_creacion: { [Op.lt]: cutoff } }
            }).catch((error) => console.error('Error limpiando auditoria antigua:', error));
        }

        const userId = id_usuario ?? req?.user?.sub ?? null;
        const ipAddress = getIpAddress(req);
        const userAgent = req?.headers?.['user-agent'] || null;

        await LogAuditoria.create({
            id_usuario: userId,
            accion,
            seccion,
            nivel,
            descripcion,
            metadata,
            ip_address: ipAddress,
            user_agent: userAgent
        });

        const cliente = await resolveClient(req, userId);
        await LogAccion.create({
            id_usuario: userId,
            id_cliente: cliente?.id_cliente || null,
            accion,
            seccion,
            nivel,
            exito: inferResultado(accion, nivel) === 'SUCCESS',
            descripcion,
            metadata,
            ip_address: ipAddress,
            user_agent: userAgent,
            fecha_creacion: new Date()
        });
    } catch (error) {
        console.error('Error registrando auditoria:', error);
    }
};

export const auditInfo = (req, payload) => auditLog(req, { ...payload, nivel: 'info' });
export const auditWarning = (req, payload) => auditLog(req, { ...payload, nivel: 'warning' });
export const auditDanger = (req, payload) => auditLog(req, { ...payload, nivel: 'danger' });
