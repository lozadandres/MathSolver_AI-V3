import bcrypt from 'bcrypt';
import { Usuario, Rol, Configuracion, sequelize } from '../models/index.js';

async function createAdmin() {
    try {
        await sequelize.authenticate();
        console.log('Conexión establecida para creación de Admin.');

        // 1. Asegurar que el rol Admin existe
        let [rol, created] = await Rol.findOrCreate({
            where: { nombre: 'Admin' },
            defaults: { descripcion: 'Administrador total del sistema' }
        });
        
        if (created) console.log('Rol Admin creado.');

        // 2. Datos del Admin
        const email = 'admin@admin.com';
        const rawPassword = 'adminpassword123'; // CONTRASEÑA TEMPORAL
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // 3. Crear el Usuario
        const [user, userCreated] = await Usuario.findOrCreate({
            where: { email },
            defaults: {
                password: hashedPassword,
                id_rol: rol.id_rol,
                activo: true,
                bloqueado: false
            }
        });

        if (userCreated) {
            console.log(`Usuario ${email} creado exitosamente.`);
            
            // 4. Crear configuración inicial
            await Configuracion.findOrCreate({
                where: { id_usuario: user.id_usuario },
                defaults: { tema: 'dark', idioma: 'es' }
            });
            console.log('Configuración de Admin establecida.');
        } else {
            console.log(`El usuario ${email} ya existe.`);
            // Opcional: Actualizar a Admin si ya existía pero con otro rol
            user.id_rol = rol.id_rol;
            await user.save();
            console.log('Rol de usuario existente actualizado a Admin.');
        }

        console.log('-----------------------------------------');
        console.log(`EMAIL: ${email}`);
        console.log(`PASSWORD: ${rawPassword}`);
        console.log('-----------------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creando el Admin:', error);
        process.exit(1);
    }
}

createAdmin();
