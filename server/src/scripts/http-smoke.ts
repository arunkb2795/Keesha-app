import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { accountToday, expenseMonthBounds, shiftExpenseDay } from '../../../src/domain/expenses.js';
import { connectDatabase } from '../db/client.js';
import { appUsers } from '../db/schema.js';
import { migrationDatabaseUrl, serverConfig } from '../env.js';

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
  const apiUrl = process.env.KEESHA_SMOKE_API_URL?.replace(/\/+$/, '') ?? 'http://127.0.0.1:' + config.PORT;
  const createdUsers: string[] = [];
  const { db, close } = connectDatabase(migrationDatabaseUrl());

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
    const expenseDate = accountToday();
    const { start, end } = expenseMonthBounds(expenseDate);
    const body = JSON.stringify({ operations: [{ mutationId, operation: 'create', expense: {
      id: expenseId, title: 'Synthetic expense', amountPaise: 1234, categoryId: 'food', expenseDate,
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

    const owned = await fetch(`${apiUrl}/v1/expenses?limit=5&start=${start}&end=${end}`, { headers: a });
    await expectStatus(owned, 200, 'Owner history');
    assert.deepEqual((await owned.json()).expenses.map((row: { id: string }) => row.id), [expenseId]);
    const summary = await fetch(`${apiUrl}/v1/expenses/monthly-summary?month=${start}`, { headers: a });
    await expectStatus(summary, 200, 'Owner monthly summary');
    assert.equal((await summary.json()).totalPaise, '1234');

    const categoryId = randomUUID();
    const categoryBody = { id: categoryId, name: 'Smoke tasks', icon: 'work' };
    const createCategory = await fetch(apiUrl + '/v1/categories', {
      method: 'POST', headers: { ...a, 'Content-Type': 'application/json' }, body: JSON.stringify(categoryBody),
    });
    await expectStatus(createCategory, 201, 'Category creation');
    const editCategory = { id: categoryId, name: 'Smoke gifts', icon: 'gift', previousName: 'Smoke tasks', previousIcon: 'work' };
    const edit = (input: Record<string, unknown>, headers = a) => fetch(apiUrl + '/v1/categories/' + input.id, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    const editedCategory = await edit(editCategory);
    await expectStatus(editedCategory, 200, 'Category update');
    assert.equal((await editedCategory.json()).category.name, 'Smoke gifts');
    await expectStatus(await edit(editCategory), 200, 'Category retry');
    await expectStatus(await edit(editCategory, b), 404, 'Second account category update');
    const personalized = await edit({ id: 'food', name: 'Smoke meals', icon: 'coffee', previousName: 'Food & Drinks', previousIcon: 'food' });
    await expectStatus(personalized, 200, 'Built-in category update');
    const otherCatalog = await fetch(apiUrl + '/v1/categories', { headers: b });
    assert.equal((await otherCatalog.json()).categories.find((row: { id: string }) => row.id === 'food').name, 'Food & Drinks');
    const personalizedHistory = await fetch(apiUrl + '/v1/expenses', { headers: a });
    const [personalizedRow] = (await personalizedHistory.json()).expenses;
    assert.equal(personalizedRow.categoryName, 'Smoke meals');
    assert.equal(personalizedRow.categoryIcon, 'coffee');

    const updatedDate = shiftExpenseDay(expenseDate, -1);
    const mutation = { mutationId: randomUUID(), operation: 'update', expense: {
      id: expenseId, version: 1, title: 'Updated synthetic expense', amountPaise: 5678, categoryId, expenseDate: updatedDate,
    } };
    const update = (input = mutation) => fetch(apiUrl + '/v1/sync/mutations', {
      method: 'POST', headers: { ...a, 'Content-Type': 'application/json' }, body: JSON.stringify({ operations: [input] }),
    });
    const updated = await update();
    await expectStatus(updated, 200, 'Expense update');
    const updateResult = await updated.json();
    assert.equal(updateResult.results[0].expense.amountPaise, 5678);
    assert.equal(updateResult.results[0].expense.version, 2);
    assert.deepEqual(await (await update()).json(), updateResult);
    const stale = await update({ ...mutation, mutationId: randomUUID() });
    assert.equal((await stale.json()).results[0].error.code, 'VERSION_CONFLICT');
    const filtered = await fetch(`${apiUrl}/v1/expenses?categoryId=${categoryId}&limit=1`, { headers: a });
    await expectStatus(filtered, 200, 'Filtered history');
    const filteredPage = await filtered.json();
    assert.equal(filteredPage.expenses[0].title, 'Updated synthetic expense');
    assert.equal(filteredPage.expenses[0].categoryName, 'Smoke gifts');
    assert.deepEqual(filteredPage.dateTotals, [{ date: updatedDate, totalPaise: '5678' }]);
    const daySummary = await fetch(`${apiUrl}/v1/expenses/daily-summary?date=${updatedDate}`, { headers: a });
    assert.equal((await daySummary.json()).totalPaise, '5678');
    const oldDay = await fetch(`${apiUrl}/v1/expenses/daily-summary?date=${expenseDate}`, { headers: a });
    assert.equal((await oldDay.json()).totalPaise, '0');
    console.log('HTTP smoke: category create/edit, personalized defaults, transaction edit, retry, conflict, filters and daily totals passed.');

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
  const safeMessage = /^(?:Unauthenticated history|Expense creation|Expense update|Owner history|Owner monthly summary|Second account|Category |Built-in category|Filtered history|Synthetic user cleanup)/;
  const message = safeMessage.test(error?.message ?? '') ? ' ' + error.message : '';
  console.error('HTTP expense smoke failed.' + message + status + detail);
  process.exitCode = 1;
});
