import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { connectDatabase } from '../db/client.js';
import { appUsers } from '../db/schema.js';
import { serverConfig } from '../env.js';

async function expectStatus(response: Response, expected: number, stage: string) {
  if (response.status === expected) return;
  const body = await response.json().catch(() => undefined);
  const code = /^[A-Z_]+$/.test(body?.code ?? '') ? ' (' + body.code + ')' : '';
  throw new Error(`${stage} returned HTTP ${response.status}${code}; expected ${expected}.`);
}

async function main() {
  const config = serverConfig();
  if (!config.CLERK_SECRET_KEY.startsWith('sk_test_')) throw new Error('A Clerk development instance is required.');
  const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });
  const suffix = randomUUID();
  const apiUrl = 'http://127.0.0.1:' + config.PORT;
  const createdUsers: string[] = [];
  const { db, close } = connectDatabase();

  async function createUser(label: string) {
    const user = await clerk.users.createUser({
      firstName: 'Keesha smoke test',
      emailAddress: ['keesha-' + label + '-' + suffix + '@example.com'],
      skipPasswordRequirement: true,
    });
    createdUsers.push(user.id);
    const session = await clerk.sessions.createSession({ userId: user.id });
    const token = await clerk.sessions.getToken(session.id);
    return { Authorization: 'Bearer ' + token.jwt };
  }

  try {
    await expectStatus(await fetch(apiUrl + '/v1/expenses'), 401, 'Unauthenticated history');
    console.log('HTTP smoke: unauthenticated access rejected (401).');
    const a = await createUser('a');
    const b = await createUser('b');
    console.log('HTTP smoke: issued two Clerk development session tokens.');

    const expenseId = randomUUID();
    const mutationId = randomUUID();
    const body = JSON.stringify({ operations: [{ mutationId, operation: 'create', expense: {
      id: expenseId, title: 'Synthetic expense', amountPaise: 1234, categoryId: 'food', expenseDate: '2024-02-29',
    } }] });
    const save = () => fetch(apiUrl + '/v1/sync/mutations', {
      method: 'POST', headers: { ...a, 'Content-Type': 'application/json' }, body,
    });

    const response = await save();
    await expectStatus(response, 200, 'Expense creation');
    const result = await response.json();
    if (/^[A-Z_]+$/.test(result.results?.[0]?.error?.code ?? '')) {
      throw new Error('Expense creation returned ' + result.results[0].error.code + '.');
    }
    assert.equal(result.results[0].expense?.id, expenseId);
    assert.deepEqual(await (await save()).json(), result);
    console.log('HTTP smoke: authenticated create and same-ID retry succeeded (200).');

    const owned = await fetch(apiUrl + '/v1/expenses?categoryId=food', { headers: a });
    await expectStatus(owned, 200, 'Owner history');
    assert.deepEqual((await owned.json()).expenses.map((row: { id: string }) => row.id), [expenseId]);

    const other = await fetch(apiUrl + '/v1/expenses', { headers: b });
    await expectStatus(other, 200, 'Second account history');
    assert.deepEqual((await other.json()).expenses, []);
    await expectStatus(await fetch(apiUrl + '/v1/expenses/' + expenseId, { headers: b }), 404, 'Second account lookup');
    console.log('HTTP smoke: owner history returned the expense; second account saw an empty list and 404.');
  } finally {
    try {
      const results = await Promise.allSettled(createdUsers.flatMap(id => [
        db.delete(appUsers).where(eq(appUsers.clerkUserId, id)).execute(),
        clerk.users.deleteUser(id),
      ]));
      assert.ok(results.every(result => result.status === 'fulfilled'), 'Synthetic user cleanup failed.');
    } finally {
      await close();
    }
  }
  console.log('HTTP expense smoke passed; synthetic Clerk and database records cleaned up.');
}

main().catch(error => {
  const status = typeof error?.status === 'number' ? ' Provider status ' + error.status + '.' : '';
  const codes = Array.isArray(error?.errors) ? error.errors.map((item: { code?: string }) => item.code).filter(Boolean) : [];
  const detail = codes.length ? ' Codes: ' + codes.join(', ') + '.' : '';
  const safeMessage = /^(?:Unauthenticated history|Expense creation|Owner history|Second account|Synthetic user cleanup)/;
  const message = safeMessage.test(error?.message ?? '') ? ' ' + error.message : '';
  console.error('HTTP expense smoke failed.' + message + status + detail);
  process.exitCode = 1;
});
