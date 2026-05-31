import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Usuario, Rol, Token, Configuracion, Permiso } from '../models/index.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { UserDTO } from '../dtos/index.js';
import { auditInfo, auditWarning, auditDanger } from '../utils/auditLogger.js';
import { logSessionStart, logSessionEnd } from '../utils/sessionLogger.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mathsolver';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_secret_refresh_key_mathsolver';
const avatarUploadDir = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(avatarUploadDir, { recursive: true });

const allowedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, avatarUploadDir),
        filename: (req, file, cb) => {
            const extByMime = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp'
            };
            const ext = extByMime[file.mimetype] || path.extname(file.originalname).toLowerCase();
            cb(null, `user-${req.user.sub}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedAvatarTypes.has(file.mimetype)) {
            return cb(new Error('Solo se permiten imagenes JPG, PNG o WEBP.'));
        }
        cb(null, true);
    }
});

const includeUserProfile = [
    { model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] },
    { model: Configuracion, as: 'configuracion' }
];

const generateAccessToken = (user) => jwt.sign(
    { sub: user.id_usuario, role: user.rol ? user.rol.nombre : 'Usuario', email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
);

const generateRefreshToken = (user) => jwt.sign(
    { sub: user.id_usuario },
    REFRESH_SECRET,
    { expiresIn: '7d' }
);

const removeLocalAvatar = (avatarUrl) => {
    if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
    const avatarPath = path.join(process.cwd(), avatarUrl.replace(/^\//, ''));
    if (avatarPath.startsWith(avatarUploadDir) && fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
    }
};

router.post('/register', async (req, res) => {
    const { email, password, rol_nombre } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contrasena son obligatorios.' });
    }

    try {
        const existingUser = await Usuario.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El correo electronico ya esta registrado.' });
        }

        const targetRole = rol_nombre || 'Estudiante';
        let rol = await Rol.findOne({ where: { nombre: targetRole } });

        if (!rol) {
            rol = await Rol.create({ nombre: targetRole, descripcion: 'Rol por defecto' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await Usuario.create({
            email,
            password: hashedPassword,
            id_rol: rol.id_rol,
            activo: true,
            bloqueado: false
        });

        await Configuracion.create({
            id_usuario: newUser.id_usuario,
            tema: 'dark',
            idioma: 'es'
        });

        const createdUser = await Usuario.findByPk(newUser.id_usuario, {
            include: includeUserProfile
        });

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: UserDTO(createdUser)
        });
    } catch (error) {
        console.error('Error en Registro:', error);
        res.status(500).json({ error: 'Error interno al registrar el usuario.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Usuario.findOne({
            where: { email },
            include: includeUserProfile
        });

        if (!user || !user.activo || user.bloqueado) {
            await auditWarning(req, {
                accion: 'LOGIN_FAILED',
                seccion: 'SEGURIDAD',
                descripcion: `Intento de login fallido para ${email}`,
                metadata: { email, motivo: 'usuario_inexistente_inactivo_o_bloqueado' },
                id_usuario: user?.id_usuario || null
            });
            return res.status(401).json({ error: 'Credenciales invalidas o cuenta inactiva.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await auditWarning(req, {
                accion: 'LOGIN_FAILED',
                seccion: 'SEGURIDAD',
                descripcion: `Password invalido para ${email}`,
                metadata: { email, motivo: 'password_invalido' },
                id_usuario: user.id_usuario
            });
            return res.status(401).json({ error: 'Credenciales invalidas.' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        const tokenRecord = await Token.create({
            id_usuario: user.id_usuario,
            token: refreshToken,
            esta_activo: true,
            fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            user_agent: req.headers['user-agent'] || 'Unknown'
        });
        await logSessionStart(req, { user, tokenRecord, refreshToken });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        await auditInfo(req, {
            accion: 'LOGIN_SUCCESS',
            seccion: 'SEGURIDAD',
            descripcion: `Inicio de sesion de ${user.email}`,
            metadata: { role: user.rol?.nombre },
            id_usuario: user.id_usuario
        });

        res.json({
            accessToken,
            user: UserDTO(user)
        });
    } catch (error) {
        console.error('Error en Login:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const dbToken = await Token.findOne({
            where: { token: refreshToken, id_usuario: decoded.sub }
        });

        if (!dbToken) {
            await auditWarning(req, {
                accion: 'REFRESH_DENIED',
                seccion: 'SEGURIDAD',
                descripcion: 'Refresh token no existe en base de datos',
                metadata: { id_usuario: decoded.sub },
                id_usuario: decoded.sub
            });
            return res.status(401).json({ error: 'Refresh Token no valido o no existe.' });
        }

        if (!dbToken.esta_activo) {
            await Token.update(
                { esta_activo: false, motivo_revocacion: 'Compromised' },
                { where: { id_usuario: decoded.sub } }
            );
            await auditDanger(req, {
                accion: 'TOKEN_REUSE_DETECTED',
                seccion: 'SEGURIDAD',
                descripcion: 'Posible reutilizacion de refresh token detectada',
                metadata: { id_usuario: decoded.sub },
                id_usuario: decoded.sub
            });
            res.clearCookie('refreshToken');
            return res.status(403).json({ error: 'Brecha de seguridad detectada. Inicie sesion nuevamente.' });
        }

        dbToken.esta_activo = false;
        dbToken.motivo_revocacion = 'Rotated';
        await dbToken.save();

        const user = await Usuario.findByPk(decoded.sub, {
            include: includeUserProfile
        });

        if (!user || !user.activo || user.bloqueado) {
            res.clearCookie('refreshToken');
            return res.status(401).json({ error: 'Usuario no disponible.' });
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await Token.create({
            id_usuario: user.id_usuario,
            token: newRefreshToken,
            esta_activo: true,
            fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            user_agent: req.headers['user-agent'] || 'Unknown'
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            accessToken: newAccessToken,
            user: UserDTO(user)
        });
    } catch (error) {
        console.error('Error en Refresh:', error);
        res.clearCookie('refreshToken');
        return res.status(401).json({ error: 'Refresh Token invalido o expirado.' });
    }
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await Usuario.findByPk(req.user.sub, {
            include: includeUserProfile
        });

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ user: UserDTO(user) });
    } catch (error) {
        console.error('Error obteniendo usuario actual:', error);
        res.status(500).json({ error: 'Error al obtener usuario actual.' });
    }
});

router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        try {
            await Token.update(
                { esta_activo: false, motivo_revocacion: 'Logout' },
                { where: { token: refreshToken } }
            );
            await logSessionEnd(req, { refreshToken, estado: 'CERRADA' });
            await auditInfo(req, {
                accion: 'LOGOUT',
                seccion: 'SEGURIDAD',
                descripcion: 'Cierre de sesion',
                metadata: { token_revocado: true }
            });
        } catch (error) {
            console.error('Error al revocar token:', error);
        }
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Sesion cerrada con exito.' });
});

router.get('/configuracion', requireAuth, async (req, res) => {
    try {
        const [config] = await Configuracion.findOrCreate({
            where: { id_usuario: req.user.sub },
            defaults: { tema: 'dark', idioma: 'es' }
        });
        res.json({ configuracion: config });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener configuracion' });
    }
});

router.put('/configuracion', requireAuth, async (req, res) => {
    try {
        const { tema, idioma } = req.body;
        const allowedThemes = ['dark', 'light'];
        const allowedLanguages = ['es', 'en'];

        if (!tema && !idioma) {
            return res.status(400).json({ error: 'Debes enviar al menos una preferencia.' });
        }

        if (tema && !allowedThemes.includes(tema)) {
            return res.status(400).json({ error: 'Tema invalido.' });
        }

        if (idioma && !allowedLanguages.includes(idioma)) {
            return res.status(400).json({ error: 'Idioma invalido.' });
        }

        const [config] = await Configuracion.findOrCreate({
            where: { id_usuario: req.user.sub },
            defaults: {
                tema: tema || 'dark',
                idioma: idioma || 'es'
            }
        });

        if (tema) config.tema = tema;
        if (idioma) config.idioma = idioma;
        await config.save();

        await auditInfo(req, {
            accion: 'UPDATE_CONFIG',
            seccion: 'USUARIOS',
            descripcion: 'Preferencias de usuario actualizadas',
            metadata: { tema: config.tema, idioma: config.idioma },
            id_usuario: req.user.sub
        });

        const user = await Usuario.findByPk(req.user.sub, {
            include: includeUserProfile
        });

        res.json({
            message: 'Configuracion guardada exitosamente',
            configuracion: config,
            user: UserDTO(user)
        });
    } catch (e) {
        console.error('Error al guardar configuracion:', e);
        res.status(500).json({ error: 'Error al guardar configuracion' });
    }
});

router.post('/avatar', requireAuth, (req, res) => {
    avatarUpload.single('avatar')(req, res, async (uploadError) => {
        if (uploadError) {
            const status = uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            const message = uploadError.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen no puede superar 2 MB.'
                : uploadError.message;
            return res.status(status).json({ error: message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Debes enviar una imagen de perfil.' });
        }

        try {
            const usuario = await Usuario.findByPk(req.user.sub);
            if (!usuario) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            removeLocalAvatar(usuario.avatar_url);
            usuario.avatar_url = `/uploads/avatars/${req.file.filename}`;
            await usuario.save();

            await auditInfo(req, {
                accion: 'UPDATE_AVATAR',
                seccion: 'USUARIOS',
                descripcion: 'Usuario actualizo su foto de perfil',
                metadata: { avatar_url: usuario.avatar_url },
                id_usuario: req.user.sub
            });

            const user = await Usuario.findByPk(req.user.sub, {
                include: includeUserProfile
            });

            res.json({
                message: 'Foto de perfil actualizada',
                avatarUrl: usuario.avatar_url,
                user: UserDTO(user)
            });
        } catch (error) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            console.error('Error al actualizar avatar:', error);
            res.status(500).json({ error: 'Error al actualizar foto de perfil' });
        }
    });
});

router.put('/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Debes proporcionar la contrasena actual y la nueva' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres' });
        }

        const usuario = await Usuario.findByPk(req.user.sub);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(currentPassword, usuario.password);
        if (!isMatch) {
            await auditWarning(req, {
                accion: 'PASSWORD_CHANGE_FAILED',
                seccion: 'SEGURIDAD',
                descripcion: 'Intento fallido de cambio de contrasena',
                metadata: { motivo: 'password_actual_incorrecto' },
                id_usuario: req.user.sub
            });
            return res.status(400).json({ error: 'La contrasena actual es incorrecta' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        usuario.password = hashedPassword;
        await usuario.save();

        await Token.update(
            { esta_activo: false, motivo_revocacion: 'Password changed' },
            { where: { id_usuario: req.user.sub } }
        );

        await auditInfo(req, {
            accion: 'PASSWORD_CHANGE',
            seccion: 'SEGURIDAD',
            descripcion: 'Contrasena de usuario actualizada',
            metadata: { tokens_revocados: true },
            id_usuario: req.user.sub
        });

        res.clearCookie('refreshToken');
        res.json({ message: 'Contrasena actualizada exitosamente' });
    } catch (e) {
        console.error('Error al cambiar contrasena:', e);
        res.status(500).json({ error: 'Error interno al cambiar la contrasena' });
    }
});

export default router;
