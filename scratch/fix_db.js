import '../config/env.js';
import { Usuario } from '../models/index.js';

async function fixNullPasswords() {
  try {
    console.log('🔍 Buscando usuarios con contraseña nula...');
    const users = await Usuario.findAll({ where: { password: null } });
    
    if (users.length === 0) {
      console.log('✅ No se encontraron usuarios con contraseña nula.');
      process.exit(0);
    }

    console.log(`🛠️ Reparando ${users.length} usuarios...`);
    // Ponemos una contraseña placeholder (debe estar encriptada si el sistema lo requiere, 
    // pero para el sync basta con cualquier string no nulo)
    await Usuario.update(
      { password: 'REPLACE_ME_OR_RESET_PASSWORD' }, 
      { where: { password: null } }
    );
    
    console.log('✅ Usuarios reparados correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error reparando la base de datos:', error);
    process.exit(1);
  }
}

fixNullPasswords();
