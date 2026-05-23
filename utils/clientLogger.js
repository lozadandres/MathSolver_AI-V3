import crypto from 'crypto';
import { ClienteAcceso } from '../models/index.js';

export const getIpAddress = (req) => {
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
    return req?.ip || req?.socket?.remoteAddress || null;
};

export const parseUserAgent = (userAgent = '') => {
    const ua = String(userAgent);
    const navegador = /Edg\//.test(ua) ? 'Edge'
        : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'Safari'
        : /OPR\//.test(ua) || /Opera/.test(ua) ? 'Opera'
        : 'Desconocido';

    const sistema_operativo = /Windows NT/.test(ua) ? 'Windows'
        : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Mac OS X/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux'
        : 'Desconocido';

    const dispositivo = /iPad|Tablet/.test(ua) ? 'Tablet'
        : /Mobile|Android|iPhone|iPod/.test(ua) ? 'Movil'
        : 'Escritorio';

    return { dispositivo, navegador, sistema_operativo };
};

export const resolveClient = async (req, id_usuario = null) => {
    if (!id_usuario) return null;

    const userAgent = req?.headers?.['user-agent'] || 'Unknown';
    const ipAddress = getIpAddress(req);
    const parsed = parseUserAgent(userAgent);
    const fingerprint = crypto
        .createHash('sha256')
        .update(`${id_usuario || 'anon'}|${userAgent}|${ipAddress || ''}`)
        .digest('hex');

    const [cliente] = await ClienteAcceso.findOrCreate({
        where: { fingerprint },
        defaults: {
            id_usuario,
            fingerprint,
            ...parsed,
            user_agent: userAgent,
            ip_address: ipAddress,
            ultimo_acceso: new Date()
        }
    });

    await cliente.update({
        id_usuario: id_usuario || cliente.id_usuario,
        ...parsed,
        user_agent: userAgent,
        ip_address: ipAddress,
        ultimo_acceso: new Date()
    });

    return cliente;
};
