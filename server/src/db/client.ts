import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { databaseUrl } from '../env.js';

export function connectDatabase(connectionString = databaseUrl()) {
  const pool = new Pool({ connectionString });
  pool.on('error', () => console.error('An idle database connection closed unexpectedly.'));
  return { db: drizzle({ client: pool }), close: () => pool.end() };
}
