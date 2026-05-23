import CodigoInvitacion from '../models/CodigoInvitacion.js';
import { Grupo, Politica, UsuarioGrupo } from '../models/index.js';
import { logActionDanger } from '../utils/actionLogger.js';

const defaultPolicies = {
    limite_alumnos_clase: {
        nombre: 'Limite de alumnos por clase',
        descripcion: 'Bloquea la union de estudiantes cuando una clase alcanza su cupo maximo.',
        parametros: { max_alumnos: 40 },
        mensaje_denegacion: 'Limite de clase alcanzado: Esta clase solo permite un maximo de 40 alumnos.'
    },
    propiedad_estricta_eliminar_clase: {
        nombre: 'Propiedad estricta para eliminar clase',
        descripcion: 'Solo el profesor titular que fundo la clase puede eliminarla.',
        parametros: {},
        mensaje_denegacion: 'Propiedad estricta: Solo el profesor que fundo esta clase puede eliminarla.'
    },
    clase_debe_estar_activa: {
        nombre: 'Clase debe estar activa',
        descripcion: 'Bloquea operaciones sobre clases inactivas.',
        parametros: {},
        mensaje_denegacion: 'La clase no esta activa.'
    },
    codigo_con_usos_disponibles: {
        nombre: 'Codigo con usos disponibles',
        descripcion: 'Bloquea codigos de invitacion sin usos disponibles.',
        parametros: {},
        mensaje_denegacion: 'Este codigo ha alcanzado su limite de usos.'
    },
    codigo_no_expirado: {
        nombre: 'Codigo no expirado',
        descripcion: 'Bloquea codigos de invitacion vencidos.',
        parametros: {},
        mensaje_denegacion: 'Este codigo de invitacion ya expiro.'
    },
    solo_estudiante_puede_unirse: {
        nombre: 'Solo estudiantes pueden unirse',
        descripcion: 'Evita que perfiles administrativos o profesores se inscriban como alumnos.',
        parametros: { roles_permitidos: ['Estudiante'] },
        mensaje_denegacion: 'Solo una cuenta de estudiante puede unirse a una clase como alumno.'
    },
    horario_chat_estudiante: {
        nombre: 'Horario de chat para estudiantes',
        descripcion: 'Permite restringir el uso del chat por horario y rol.',
        parametros: { hora_inicio: 0, hora_fin: 24, roles_aplica: ['Estudiante'], dias: [0, 1, 2, 3, 4, 5, 6] },
        mensaje_denegacion: 'El chat no esta disponible para estudiantes en este horario.'
    }
};

const getPolicy = async (clave) => {
    const defaults = defaultPolicies[clave];
    const [politica] = await Politica.findOrCreate({
        where: { clave },
        defaults: {
            clave,
            nombre: defaults.nombre,
            activa: true,
            parametros: defaults.parametros,
            mensaje_denegacion: defaults.mensaje_denegacion
        }
    });

    return politica;
};

const deny = async (req, res, politica, metadata = {}) => {
    const message = politica.mensaje_denegacion || defaultPolicies[politica.clave]?.mensaje_denegacion || 'Politica de acceso denegada.';
    await logActionDanger(req, {
        accion: 'PBAC_DENIED',
        seccion: 'SEGURIDAD',
        resultado: 'DENIED',
        descripcion: message,
        metadata: { politica: politica.clave, ...metadata }
    });
    return res.status(403).json({ error: message });
};

export const checkPolicy = (clave) => {
    return async (req, res, next) => {
        try {
            const politica = await getPolicy(clave);
            if (!politica.activa) return next();

            if (clave === 'limite_alumnos_clase') {
                const codigo = req.body?.codigo;
                const invitacion = req.policyContext?.invitacion || await CodigoInvitacion.findOne({ where: { codigo, activo: true } });
                if (!invitacion?.id_grupo) return next();

                req.policyContext = { ...(req.policyContext || {}), invitacion };

                const maxAlumnos = parseInt(politica.parametros?.max_alumnos, 10) || 40;
                const totalAlumnos = await UsuarioGrupo.count({ where: { id_grupo: invitacion.id_grupo } });
                const yaInscrito = await UsuarioGrupo.findOne({
                    where: { id_usuario: req.user.sub, id_grupo: invitacion.id_grupo }
                });

                if (!yaInscrito && totalAlumnos >= maxAlumnos) {
                    return deny(req, res, politica, { id_grupo: invitacion.id_grupo, total_alumnos: totalAlumnos, max_alumnos: maxAlumnos });
                }
                return next();
            }

            if (clave === 'solo_estudiante_puede_unirse') {
                const rolesPermitidos = politica.parametros?.roles_permitidos || ['Estudiante'];
                if (!rolesPermitidos.includes(req.user?.role)) {
                    return deny(req, res, politica, { role: req.user?.role, roles_permitidos: rolesPermitidos });
                }
                return next();
            }

            if (clave === 'codigo_con_usos_disponibles' || clave === 'codigo_no_expirado') {
                const codigo = req.body?.codigo;
                const invitacion = req.policyContext?.invitacion || await CodigoInvitacion.findOne({ where: { codigo, activo: true } });
                if (!invitacion) return next();

                req.policyContext = { ...(req.policyContext || {}), invitacion };

                if (clave === 'codigo_con_usos_disponibles' && invitacion.usos_maximos && invitacion.usos_actuales >= invitacion.usos_maximos) {
                    return deny(req, res, politica, { codigo, id_codigo: invitacion.id_codigo, id_grupo: invitacion.id_grupo });
                }

                if (clave === 'codigo_no_expirado' && invitacion.fecha_expiracion && new Date(invitacion.fecha_expiracion) < new Date()) {
                    return deny(req, res, politica, { codigo, id_codigo: invitacion.id_codigo, fecha_expiracion: invitacion.fecha_expiracion });
                }

                return next();
            }

            if (clave === 'clase_debe_estar_activa') {
                const groupId = req.params.groupId || req.params.id || req.params.id_grupo || req.body.groupId || req.body.id_grupo || req.policyContext?.invitacion?.id_grupo;
                if (!groupId) return next();

                const grupo = await Grupo.findByPk(groupId);
                if (!grupo) return res.status(404).json({ error: 'Clase no encontrada.' });
                if (!grupo.activo) {
                    return deny(req, res, politica, { id_grupo: groupId });
                }

                req.policyContext = { ...(req.policyContext || {}), grupo };
                return next();
            }

            if (clave === 'horario_chat_estudiante') {
                const params = politica.parametros || {};
                const rolesAplica = params.roles_aplica || ['Estudiante'];
                if (!rolesAplica.includes(req.user?.role)) return next();

                const now = new Date();
                const currentHour = now.getHours();
                const currentDay = now.getDay();
                const start = Number.isInteger(params.hora_inicio) ? params.hora_inicio : 0;
                const end = Number.isInteger(params.hora_fin) ? params.hora_fin : 24;
                const allowedDays = Array.isArray(params.dias) ? params.dias : [0, 1, 2, 3, 4, 5, 6];

                if (!allowedDays.includes(currentDay) || currentHour < start || currentHour >= end) {
                    return deny(req, res, politica, { hora_actual: currentHour, dia_actual: currentDay, hora_inicio: start, hora_fin: end });
                }

                return next();
            }

            if (clave === 'propiedad_estricta_eliminar_clase') {
                const groupId = req.params.id || req.params.id_grupo;
                const grupo = await Grupo.findByPk(groupId);
                if (!grupo) return res.status(404).json({ error: 'Clase no encontrada.' });

                if (parseInt(grupo.id_profesor, 10) !== parseInt(req.user.sub, 10)) {
                    return deny(req, res, politica, { id_grupo: groupId, id_profesor_dueno: grupo.id_profesor });
                }

                req.policyContext = { ...(req.policyContext || {}), grupo };
                return next();
            }

            return next();
        } catch (error) {
            console.error('Error evaluando politica:', error);
            return res.status(500).json({ error: 'Error interno evaluando politica de acceso.' });
        }
    };
};

export default checkPolicy;
