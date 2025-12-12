const { Pool } = require('pg');

// Configuración del pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Probar conexión
pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en PostgreSQL:', err);
  process.exit(-1);
});

/**
 * Ejecutar una query SQL
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query ejecutada:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error en query:', error);
    throw error;
  }
};

/**
 * Obtener un cliente del pool para transacciones
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Obtener el esquema de la base de datos
 */
const getDatabaseSchema = async () => {
  try {
    // Obtener todas las tablas
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await query(tablesQuery);
    const tables = [];

    // Para cada tabla, obtener sus columnas
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await query(columnsQuery, [tableName]);
      
      // Obtener claves primarias
      const pkQuery = `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
        AND i.indisprimary;
      `;
      
      const pkResult = await query(pkQuery, [tableName]);
      const primaryKeys = pkResult.rows.map(row => row.column_name);
      
      // Obtener claves foráneas
      const fkQuery = `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1;
      `;
      
      const fkResult = await query(fkQuery, [tableName]);
      
      tables.push({
        name: tableName,
        columns: columnsResult.rows,
        primaryKeys: primaryKeys,
        foreignKeys: fkResult.rows
      });
    }

    return {
      database: process.env.DB_NAME,
      tables: tables,
      totalTables: tables.length
    };
    
  } catch (error) {
    console.error('Error obteniendo esquema:', error);
    throw error;
  }
};

/**
 * Probar conexión a la base de datos
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión a PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  query,
  getClient,
  getDatabaseSchema,
  testConnection,
  pool
};