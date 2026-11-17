import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const poolConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
};

if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);

// Temporary deployment diagnostic: reports connection context without credentials.
pool.query(`
    SELECT current_database() AS database_name,
           current_schema() AS current_schema,
           current_setting('search_path') AS search_path,
           to_regclass('public.found_notifications') IS NOT NULL AS public_table_exists,
           to_regclass('found_notifications') IS NOT NULL AS unqualified_table_resolves
`).then(({ rows }) => {
    console.info('[db-diagnostic]', JSON.stringify(rows[0]));
}).catch(error => {
    console.error('[db-diagnostic] query failed', { code: error.code || 'unknown' });
});

export default pool;
