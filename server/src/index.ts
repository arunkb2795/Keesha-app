import { createClerkClient, verifyToken } from '@clerk/backend';
import { serve } from '@hono/node-server';
import { createApi } from './api.js';
import { connectDatabase } from './db/client.js';
import { ExpenseError, expenseStore } from './db/expenses.js';
import { serverConfig } from './env.js';

const config = serverConfig();
const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });
const { db } = connectDatabase();
const app = createApi({
  store: expenseStore(db),
  cursorSecret: config.CURSOR_SECRET,
  webOrigins: config.authorizedParties,
  async authenticate(authorization) {
    const match = /^Bearer ([\w.-]+)$/i.exec(authorization ?? '');
    const unauthorized = new ExpenseError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    if (!match) throw unauthorized;
    const claims = await verifyToken(match[1], {
      secretKey: config.CLERK_SECRET_KEY,
      audience: config.CLERK_AUDIENCE,
    }).catch(() => { throw unauthorized; });
    // Clerk rejects a missing azp when passed an allowlist. Native session tokens can omit it.
    if (claims.iss !== config.CLERK_ISSUER || !claims.sub || !claims.sid || claims.sts === 'pending' ||
        (claims.azp !== undefined && !config.authorizedParties.includes(claims.azp))) throw unauthorized;
    return claims.sub;
  },
  async loadProfile(id) {
    const user = await clerk.users.getUser(id);
    if (user.banned || user.locked) throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
    const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
    return {
      clerkUserId: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim().slice(0, 200) || null,
      email: primary?.verification?.status === 'verified' ? primary.emailAddress : undefined,
    };
  },
});

serve({ fetch: app.fetch, hostname: config.HOST, port: config.PORT }, ({ port }) => {
  console.log(`Keesha expense API is listening on ${config.HOST}:${port}.`);
});
