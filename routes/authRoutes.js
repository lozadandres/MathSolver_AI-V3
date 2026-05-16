import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Usuario, Rol, Token, Configuracion } from '../models/index.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { UserDTO } from '../dtos/index.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mathsolver';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_secret_refresh_key_mathsolver';

// Helper: Generar Access Token
const generateAccessToken = (user) => {
    return jwt.sign(
        { sub: user.id_usuario, role: user.rol ? user.rol.nombre : 'Usuario', email: user.email },
        JWT_SECRET,
        { expiresIn: '15m' } 
    );
};

// Helper: Generar Refresh Token
const generateRefreshToken = (user) => {
    return jwt.sign(
        { sub: user.id_usuario },
        REFRESH_SECRET,
        { expiresIn: '7d' } 
    );
};

// Ruta: /api/auth/register
router.post('/register', async (req, res) => {
    const { email, password, rol_nombre } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
    }

    try {
        // 1. Verificar si el usuario ya existe
        const existingUser = await Usuario.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        // 2. Buscar o crear el rol (por defecto 'Estudiante')
        const targetRole = rol_nombre || 'Estudiante';
        let rol = await Rol.findOne({ where: { nombre: targetRole } });
        
        if (!rol) {
            rol = await Rol.create({ nombre: targetRole, descripcion: 'Rol por defecto' });
        }

        // 3. Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Crear usuario
        const newUser = await Usuario.create({
            email,
            password: hashedPassword,
            id_rol: rol.id_rol,
            activo: true,
            bloqueado: false
        });

        // 5. Crear configuración por defecto
        const userConfig = await Configuracion.create({
            id_usuario: newUser.id_usuario,
            tema: 'dark',
            idioma: 'es'
        });

        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            user: UserDTO(newUser)
        });

    } catch (error) {
        console.error('Error en Registro:', error);
        res.status(500).json({ error: 'Error interno al registrar el usuario.' });
    }
});

// Ruta: /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Validar usuario y obtener rol y configuracion con Sequelize
        const user = await Usuario.findOne({
            where: { email },
            include: [
                { model: Rol, as: 'rol' },
                { model: Configuracion, as: 'configuracion' }
            ]
        });

        if (!user || !user.activo || user.bloqueado) {
            return res.status(401).json({ error: 'Credenciales inválidas o cuenta inactiva.' });
        }

        // 2. Verificar Password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // 3. Generar Tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // 4. Guardar Refresh Token en Base de Datos (Sequelize)
        await Token.create({
            id_usuario: user.id_usuario,
            token: refreshToken,
            esta_activo: true,
            fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // + 7 días
            user_agent: req.headers['user-agent'] || 'Unknown'
        });

        // 5. Establecer Refresh Token en Cookie (HttpOnly)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
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

// Ruta: /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        
        // 2. Verificar BD con Sequelize
        const dbToken = await Token.findOne({
            where: { token: refreshToken, id_usuario: decoded.sub }
        });

        if (!dbToken) {
            return res.status(401).json({ error: 'Refresh Token no válido o no existe.' });
        }

        if (!dbToken.esta_activo) {
            // Detección de reutilización (Token Compromise)
            await Token.update(
                { esta_activo: false, motivo_revocacion: 'Compromised' }, 
                { where: { id_usuario: decoded.sub } }
            );
            res.clearCookie('refreshToken');
            return res.status(403).json({ error: 'Brecha de seguridad detectada. Inicie sesión nuevamente.' });
        }

        // Rotar: Inactivar el viejo
        dbToken.esta_activo = false;
        dbToken.motivo_revocacion = 'Rotated';
        await dbToken.save();

        // 3. Generar nuevos tokens
        const user = await Usuario.findByPk(decoded.sub, {
            include: [
                { model: Rol, as: 'rol' },
                { model: Configuracion, as: 'configuracion' }
            ]
        });
        
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // 4. Guardar nuevo Refresh Token en BD
        await Token.create({
            id_usuario: user.id_usuario,
            token: newRefreshToken,
            esta_activo: true,
            fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // 5. Actualizar Cookie
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
        return res.status(401).json({ error: 'Refresh Token inválido o expirado.' });
    }
});

// Ruta: /api/auth/logout
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        try {
            await Token.update(
                { esta_activo: false, motivo_revocacion: 'Logout' },
                { where: { token: refreshToken } }
            );
        } catch (error) {
            console.error('Error al revocar token:', error);
        }
    }
    
    res.clearCookie('refreshToken');
    res.json({ message: 'Sesión cerrada con éxito.' });
});

// Ruta: /api/auth/configuracion (Obtener Preferencias)
router.get('/configuracion', requireAuth, async (req, res) => {
    try {
        const config = await Configuracion.findOne({
            where: { id_usuario: req.user.sub }
        });
        res.json(config || { tema: 'dark', idioma: 'es' });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// Ruta: /api/auth/configuracion (Guardar Preferencias)
router.put('/configuracion', requireAuth, async (req, res) => {
    try {
        const { tema } = req.body;

        if (tema) {
            const [config, created] = await Configuracion.findOrCreate({
                where: { id_usuario: req.user.sub },
                defaults: { tema, idioma: 'es' }
            });
            
            if (!config && !created) return res.status(404).json({ error: 'No se pudo encontrar ni crear configuración' });

            if (!created) {
                config.tema = tema;
                await config.save();
            }
        }
        res.json({ message: 'Configuración guardada' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

export default router;
