import { defineConfig } from 'drizzle-kit';
import { migrationDatabaseUrl } from './src/env.js';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    get url() { return migrationDatabaseUrl(); },
  },
});
