import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { databaseUrl } from '../env.js';

export function connectDatabase() {
  const pool = new Pool({ connectionString: databaseUrl() });
  pool.on('error', () => console.error('An idle database connection closed unexpectedly.'));
  return { db: drizzle({ client: pool }), close: () => pool.end() };
}
