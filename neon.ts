import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  functions: {
    expenses: {
      name: 'Keesha expense API',
      source: 'server/src/app.ts',
      env: {
        KEESHA_DATABASE_URL: { value: process.env.KEESHA_DATABASE_URL, required: true },
        CLERK_SECRET_KEY: { value: process.env.CLERK_SECRET_KEY, required: true },
        CLERK_ISSUER: { value: process.env.CLERK_ISSUER, required: true },
        CLERK_AUDIENCE: { value: process.env.CLERK_AUDIENCE, required: false },
        CLERK_AUTHORIZED_PARTIES: { value: process.env.CLERK_AUTHORIZED_PARTIES, required: false },
        CURSOR_SECRET: { value: process.env.CURSOR_SECRET, required: true },
      },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
