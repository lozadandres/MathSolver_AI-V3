import { LogAccion } from '../models/index.js';
import { getIpAddress, resolveClient } from './clientLogger.js';

export const logAction = async (req, {
    accion,
    seccion = 'SISTEMA',
    nivel = 'info',
    resultado = 'SUCCESS',
    descripcion,
    metadata = null,
    id_usuario = null,
    id_cliente = null
}) => {
    try {
        const userId = id_usuario ?? req?.user?.sub ?? null;
        let clientId = id_cliente;
        if (!clientId) {
            const cliente = await resolveClient(req, userId);
            clientId = cliente?.id_cliente || null;
        }

        await LogAccion.create({
            id_usuario: userId,
            id_cliente: clientId,
            accion,
            seccion,
            nivel,
            exito: resultado === 'SUCCESS',
            descripcion,
            metadata,
            ip_address: getIpAddress(req),
            user_agent: req?.headers?.['user-agent'] || null,
            fecha_creacion: new Date()
        });
    } catch (error) {
        console.error('Error registrando accion:', error);
    }
};

export const logActionInfo = (req, payload) => logAction(req, { ...payload, nivel: 'info' });
export const logActionWarning = (req, payload) => logAction(req, { ...payload, nivel: 'warning' });
export const logActionDanger = (req, payload) => logAction(req, { ...payload, nivel: 'danger' });
