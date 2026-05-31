import './config/env.js';

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { sequelize } from "./models/index.js";

// Rutas
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profesorRoutes from "./routes/profesorRoutes.js";
import estudianteRoutes from "./routes/estudianteRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import documentoRoutes from "./routes/documentoRoutes.js";
import { seedDefaultRbac } from "./utils/rbacSeeder.js";

// Inicializa el servidor Express
const app = express();

// Configura middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Importante para el frontend
    credentials: true // Necesario para que el navegador envíe la cookie HttpOnly
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rutas de Autenticación y Roles
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profesor', profesorRoutes);
app.use('/api/estudiante', estudianteRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', documentoRoutes);

// Ejemplo de ruta protegida con modelo Híbrido (RBAC + ReBAC + ABAC)
// requireAuth -> Verifica JWT Access Token
// authorize -> Verifica Rol y Propiedad
// La ruta real de documentos vive en routes/documentoRoutes.js.

// Configura multer para almacenar archivos temporalmente en memoria

// El resto de la lógica de beautify se puede mover a chatRoutes si se desea, 
// por ahora la eliminamos de aquí para limpiar app.js

// Inicia el servidor y sincroniza Base de Datos
const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true }).then(async () => {
    await seedDefaultRbac();
    console.log('✅ Base de datos sincronizada y tablas creadas (Sequelize).');
    app.listen(PORT, () => {
        console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error sincronizando base de datos:', err);
});
