import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const injectedMigrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

config({
  path: ['../.env', '../../.env.local', '../../.env'].map(path => fileURLToPath(new URL(path, import.meta.url))),
  quiet: true,
});

const databaseUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ }).refine(value => {
  const url = new URL(value);
  return Boolean(url.hostname && url.pathname.length > 1);
});

export function databaseUrl() {
  const result = databaseUrlSchema.safeParse(process.env.KEESHA_DATABASE_URL ?? process.env.DATABASE_URL);
  if (!result.success) throw new Error('Invalid or missing server DATABASE_URL.');
  return result.data;
}

export function migrationDatabaseUrl() {
  const result = databaseUrlSchema.safeParse(injectedMigrationUrl ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
  if (!result.success) throw new Error('Invalid or missing server database URL for migrations.');
  return result.data;
}

export function serverConfig() {
  const result = z.object({
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_ISSUER: z.url({ protocol: /^https$/ }),
    CLERK_AUDIENCE: z.string().min(1).optional(),
    CLERK_AUTHORIZED_PARTIES: z.string().min(1).optional(),
    CURSOR_SECRET: z.string().min(32),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  }).safeParse(process.env);
  if (!result.success) throw new Error('Invalid server configuration. See server/.env.example.');

  return {
    ...result.data,
    authorizedParties: result.data.CLERK_AUTHORIZED_PARTIES?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [],
  };
}
