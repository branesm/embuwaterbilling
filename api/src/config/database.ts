import { Pool, PoolClient, QueryResult } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ewasco_billing',
  user: process.env.DB_USER || 'ewasco_admin',
  password: process.env.DB_PASSWORD || 'ewasco_secure_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export const query = async <T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<T[]> => {
  const start = Date.now();
  try {
    const result: QueryResult<T> = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    }
    return result.rows;
  } catch (error) {
    console.error('Database query error:', { text, params, error });
    throw error;
  }
};

export const queryOne = async <T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<T | null> => {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
};

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getClient = (): Promise<PoolClient> => pool.connect();

export default pool;
