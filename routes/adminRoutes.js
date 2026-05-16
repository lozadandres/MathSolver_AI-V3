import express from 'express';
import bcrypt from 'bcrypt';
import { Usuario, Rol, RelacionRecurso, Grupo, Permiso, RolPermiso, Configuracion, TipoRol } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { UserDTO, GroupDTO, RoleDTO, PermissionDTO } from '../dtos/index.js';

const router = express.Router();

// Obtener todos los usuarios
router.get('/usuarios', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            include: [{ model: Rol, as: 'rol' }],
            attributes: { exclude: ['password'] }
        });
        const usuariosDTO = usuarios.map(u => UserDTO(u));
        res.json(usuariosDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Crear usuario (Admin)
router.post('/usuarios', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { email, password, id_rol } = req.body;
    try {
        const existe = await Usuario.findOne({ where: { email } });
        if (existe) return res.status(400).json({ error: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await Usuario.create({
            email,
            password: hashedPassword,
            id_rol,
            activo: true,
            bloqueado: false
        });

        // Crear configuración por defecto
        await Configuracion.create({ id_usuario: newUser.id_usuario });

        res.status(201).json(UserDTO(newUser));
    } catch (error) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Actualizar usuario (Admin)
router.put('/usuarios/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { email, password, id_rol, activo } = req.body;
    try {
        const updateData = {};
        if (email) updateData.email = email;
        if (id_rol) updateData.id_rol = id_rol;
        if (activo !== undefined) updateData.activo = activo;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await Usuario.update(updateData, { where: { id_usuario: id } });
        const updatedUser = await Usuario.findByPk(id, { include: [{ model: Rol, as: 'rol' }] });
        res.json(UserDTO(updatedUser));
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Asignar estudiante a profesor
router.post('/asignar', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id_profesor, id_estudiante } = req.body;
    try {
        // Verificar existencia
        const profesor = await Usuario.findByPk(id_profesor, { include: ['rol'] });
        const estudiante = await Usuario.findByPk(id_estudiante, { include: ['rol'] });
        
        if (!profesor || profesor.rol.nombre !== 'Profesor') return res.status(400).json({ error: 'Profesor no válido' });
        if (!estudiante || estudiante.rol.nombre !== 'Estudiante') return res.status(400).json({ error: 'Estudiante no válido' });

        // Crear relación ReBAC
        await RelacionRecurso.create({
            id_entidad: id_profesor,
            id_recurso: id_estudiante,
            relacion: 'tutor_de',
            activo: true
        });

        res.json({ message: 'Alumno asignado correctamente al profesor.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar alumno' });
    }
});

// Bloquear/Desbloquear usuario
router.put('/usuarios/:id/bloquear', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { bloqueado } = req.body;
    try {
        await Usuario.update({ bloqueado }, { where: { id_usuario: id } });
        res.json({ message: bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Cambiar rol de usuario
router.put('/usuarios/:id/rol', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { id_rol } = req.body;
    
    try {
        if (!id_rol) return res.status(400).json({ error: 'ID de rol no proporcionado' });

        // Verificar que el rol existe
        const rolExiste = await Rol.findByPk(id_rol);
        if (!rolExiste) return res.status(400).json({ error: 'El rol especificado no existe' });

        await Usuario.update({ id_rol: parseInt(id_rol) }, { where: { id_usuario: id } });
        res.json({ message: 'Rol actualizado correctamente' });
    } catch (error) {
        console.error("Error detallado al actualizar rol:", error);
        res.status(500).json({ error: 'Error interno al actualizar rol' });
    }
});

// Eliminar usuario
router.delete('/usuarios/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await Usuario.destroy({ where: { id_usuario: id } });
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// ---- GESTIÓN DE GRUPOS ----

// Listar grupos
router.get('/grupos', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const grupos = await Grupo.findAll({
            include: [{ model: Usuario, as: 'tutor', attributes: ['email'] }]
        });
        const gruposDTO = grupos.map(g => GroupDTO(g));
        res.json(gruposDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
});

// Crear grupo
router.post('/grupos', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const nuevoGrupo = await Grupo.create(req.body);
        res.json(nuevoGrupo);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear grupo' });
    }
});

// ---- GESTIÓN DE ROLES Y PERMISOS ----

// Listar todos los permisos
router.get('/permisos', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const permisos = await Permiso.findAll();
        const permisosDTO = permisos.map(p => PermissionDTO(p));
        res.json(permisosDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

// Listar tipos de roles
router.get('/tipo-roles', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const tipos = await TipoRol.findAll();
        res.json(tipos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tipos de roles' });
    }
});

// Listar roles con sus permisos
router.get('/roles', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
        const roles = await Rol.findAll({
            include: [
                { model: Permiso, as: 'permisos' },
                { model: TipoRol, as: 'tipo' }
            ]
        });
        const rolesDTO = roles.map(r => RoleDTO(r));
        res.json(rolesDTO);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
    }
});

// Crear Rol
router.post('/roles', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { nombre, descripcion, permisosIds } = req.body;
    try {
        const existe = await Rol.findOne({ where: { nombre } });
        if (existe) return res.status(400).json({ error: 'El rol ya existe' });

        // Los roles creados por el admin siempre son tipo 'Personalizado'
        const tipoPersonalizado = await TipoRol.findOne({ where: { nombre: 'Personalizado' } });

        const nuevoRol = await Rol.create({ 
            nombre, 
            descripcion, 
            id_tipo_rol: tipoPersonalizado?.id_tipo_rol || null, 
            activo: true 
        });

        if (permisosIds && permisosIds.length > 0) {
            const mappings = permisosIds.map(pid => ({
                id_rol: nuevoRol.id_rol,
                id_permiso: pid
            }));
            await RolPermiso.bulkCreate(mappings);
        }

        const roleConPermisos = await Rol.findByPk(nuevoRol.id_rol, {
            include: [
                { model: Permiso, as: 'permisos' },
                { model: TipoRol, as: 'tipo' }
            ]
        });

        res.status(201).json(RoleDTO(roleConPermisos));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

// Actualizar Rol
router.put('/roles/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, id_tipo_rol } = req.body;
    try {
        const updateData = {};
        if (nombre) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (id_tipo_rol) updateData.id_tipo_rol = id_tipo_rol;

        await Rol.update(updateData, { where: { id_rol: id } });
        const updatedRol = await Rol.findByPk(id, {
            include: [{ model: Permiso, as: 'permisos' }, { model: TipoRol, as: 'tipo' }]
        });
        res.json(RoleDTO(updatedRol));
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// Asignar permiso a rol
router.post('/roles/:id_rol/permisos', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id_rol } = req.params;
    const { id_permiso } = req.body;
    try {
        await RolPermiso.findOrCreate({ where: { id_rol, id_permiso } });
        res.json({ message: 'Permiso asignado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar permiso' });
    }
});

// Quitar permiso a rol
router.delete('/roles/:id_rol/permisos/:id_permiso', requireAuth, requireRole(['Admin']), async (req, res) => {
    const { id_rol, id_permiso } = req.params;
    try {
        await RolPermiso.destroy({ where: { id_rol, id_permiso } });
        res.json({ message: 'Permiso revocado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al revocar permiso' });
    }
});

export default router;
