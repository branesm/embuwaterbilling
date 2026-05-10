const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'ewasco_user',
  password: process.env.DB_PASSWORD || 'ewasco_pass_2024',
  database: process.env.DB_NAME || 'ewasco_billing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

const pool = mysql.createPool(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

// Execute query with error handling
const executeQuery = async (sql, params = []) => {
  try {
    // Use pool.query instead of pool.execute to avoid prepared statement
    // caching issues with dynamically-built SQL that has varying param counts
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('Query execution error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
};

// Get connection for transactions
const getConnection = async () => {
  return await pool.getConnection();
};

// Transaction helper
const withTransaction = async (callback) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  testConnection,
  executeQuery,
  getConnection,
  withTransaction
};
