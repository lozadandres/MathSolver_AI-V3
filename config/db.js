import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mathsolver',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Cambiar a console.log para debugear SQL
  }
);

// Prueba de conexión opcional
sequelize.authenticate()
  .then(() => console.log('Conectado a PostgreSQL via Sequelize.'))
  .catch(err => console.error('Error conectando a BD:', err));

// Mantenemos una compatibilidad básica con db.query original por si acaso
export const db = {
  sequelize,
  query: (text, params) => sequelize.query(text, { bind: params }),
};

export default sequelize;
