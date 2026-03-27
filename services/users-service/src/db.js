const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'users_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool;

const connectWithRetry = async (retries = 10, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      pool = mysql.createPool(dbConfig);
      const conn = await pool.getConnection();
      conn.release();
      console.log('✅ Connecté à MySQL (users_db)');
      return pool;
    } catch (err) {
      console.log(`⏳ MySQL non disponible, tentative ${i + 1}/${retries}...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('❌ Impossible de se connecter à MySQL après plusieurs tentatives.');
};

const getPool = () => pool;

module.exports = { connectWithRetry, getPool };
