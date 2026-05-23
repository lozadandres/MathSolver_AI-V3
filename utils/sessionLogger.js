import crypto from 'crypto';
import { LogSesion, Token } from '../models/index.js';
import { getIpAddress, resolveClient } from './clientLogger.js';

const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

export const logSessionStart = async (req, { user, tokenRecord, refreshToken }) => {
    try {
        const cliente = await resolveClient(req, user.id_usuario);
        return await LogSesion.create({
            id_usuario: user.id_usuario,
            id_cliente: cliente.id_cliente,
            id_token: tokenRecord?.id_token || null,
            token_hash: refreshToken ? hashToken(refreshToken) : null,
            estado: 'ACTIVA',
            ip_address: getIpAddress(req),
            user_agent: req?.headers?.['user-agent'] || null,
            fecha_inicio: new Date()
        });
    } catch (error) {
        console.error('Error registrando inicio de sesion:', error);
        return null;
    }
};

export const logSessionEnd = async (req, { refreshToken, estado = 'CERRADA' } = {}) => {
    try {
        if (!refreshToken) return null;
        const tokenRecord = await Token.findOne({ where: { token: refreshToken } });
        const where = tokenRecord?.id_token
            ? { id_token: tokenRecord.id_token, estado: 'ACTIVA' }
            : { token_hash: hashToken(refreshToken), estado: 'ACTIVA' };

        await LogSesion.update(
            { estado, fecha_fin: new Date() },
            { where }
        );
    } catch (error) {
        console.error('Error registrando cierre de sesion:', error);
    }
};
