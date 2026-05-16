import bcrypt from 'bcrypt';
import { Usuario } from './models/index.js';

async function resetPasswords() {
  const salt = 10;
  
  const users = [
    { email: 'admin@admin.com', pass: 'adminpassword123' },
    { email: 'JulietPerez1028@gmail.com', pass: 'estudiante123' },
    { email: 'lozadaandres95@gmail.com', pass: 'profesor123' }
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.pass, salt);
    await Usuario.update({ password: hashed }, { where: { email: u.email } });
    console.log(`✅ Password reset para ${u.email}: ${u.pass}`);
  }
  process.exit(0);
}

resetPasswords();
