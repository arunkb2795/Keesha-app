import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { accountToday, categoryIconIds, categoryNames, compareMonthlySpend, expenseWeekDates, expenseMonthBounds, formatExpenseDate,
  formatPaise, groupExpenses, parseExpensePaise, shiftExpenseDay } from '../../src/domain/expenses.js';
import { createApi } from '../src/api.js';
import { ExpenseError, expenseStore } from '../src/db/expenses.js';
import { appUsers, categories, expenses, mutationReceipts, syncChanges } from '../src/db/schema.js';

const postgres = new PGlite();
let lastQuery: { query: string; params: unknown[] } | undefined;
const db = drizzle({ client: postgres, logger: { logQuery(query, params) { lastQuery = { query, params }; } } });
const store = expenseStore(db);
const app = createApi({
  store,
  cursorSecret: 'a-test-only-secret-for-signing-cursors',
  async authenticate(header) {
    const clerkUserId = header?.match(/^Bearer (test-user-[a-d])$/)?.[1];
    if (!clerkUserId) throw new ExpenseError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    return clerkUserId;
  },
  async loadProfile(clerkUserId) {
    return { clerkUserId, name: 'Synthetic test user', email: clerkUserId + '@example.test' };
  },
});

before(async () => {
  const options = { migrationsFolder: './drizzle' };
  await migrate(db, options);
  await migrate(db, options);
});
after(() => postgres.close());

const authA = { Authorization: 'Bearer test-user-a' };
const authB = { Authorization: 'Bearer test-user-b' };
const history = (query = '', headers = authA) => app.request('/v1/expenses' + query, { headers });
const operation = (expense: Record<string, unknown> = {}) => ({
  mutationId: randomUUID(),
  operation: 'create',
  expense: { id: randomUUID(), amountPaise: 1010, title: 'Test expense', ...expense },
});
const post = (item: ReturnType<typeof operation>, auth = authA) => app.request('/v1/sync/mutations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ operations: [item] }),
});

test('seeded categories match the domain catalog and amounts parse exactly', async () => {
  const catalog = Object.fromEntries((await db.select().from(categories)).map(row => [row.id, row.name]));
  assert.deepEqual(catalog, categoryNames);
  assert.equal(parseExpensePaise('0.10')! + parseExpensePaise('0.20')!, 30);
  assert.equal(parseExpensePaise('9999999.99'), 999_999_999);
  for (const invalid of ['', '0', '-1', '1e2', '1.001', '10000000']) assert.equal(parseExpensePaise(invalid), null);
  assert.equal(accountToday(new Date('2024-02-29T20:00:00Z')), '2024-03-01');
});

test('creates an expense and its verified user, survives concurrent replay, and records one revision', async () => {
  const item = operation({ title: '  Lunch  ', note: '  ', categoryId: 'food', expenseDate: '2024-02-29' });
  const responses = await Promise.all([post(item), post(item)]);
  for (const response of responses) assert.equal(response.status, 200);
  const [first, second] = await Promise.all(responses.map(response => response.json()));
  assert.deepEqual(first, second);
  assert.deepEqual(first.results[0].expense, {
    id: item.expense.id, title: 'Lunch', amountPaise: 1010, categoryId: 'food',
    expenseDate: '2024-02-29', note: null, version: 1,
  });
  const ownerId = await store.accountFor('test-user-a');
  assert.ok(ownerId);
  const [owner] = await db.select().from(appUsers).where(eq(appUsers.id, ownerId));
  assert.equal(owner.email, 'test-user-a@example.test');
  assert.equal(owner.name, 'Synthetic test user');
  assert.equal(owner.syncRevision, 1n);
  const [event] = await db.select().from(syncChanges).where(eq(syncChanges.ownerId, ownerId));
  assert.equal(event.entityId, item.expense.id);
  assert.equal(event.revision, 1n);
  assert.equal((await db.select().from(mutationReceipts).where(eq(mutationReceipts.ownerId, ownerId))).length, 1);

  const conflict = await post({ ...item, expense: { ...item.expense, amountPaise: 200 } });
  assert.equal((await conflict.json()).results[0].error.code, 'MUTATION_CONFLICT');
  const duplicate = await post({ ...item, mutationId: randomUUID() });
  assert.equal((await duplicate.json()).results[0].error.code, 'EXPENSE_CONFLICT');
  assert.equal((await app.request('/v1/expenses/' + item.expense.id, { headers: authB })).status, 404);
});

test('category catalog contains the seeded defaults and isolates custom categories by account', async () => {
  const auth = { Authorization: 'Bearer test-user-d' };
  const catalog = () => app.request('/v1/categories', { headers: auth });
  const createCategory = (input: Record<string, unknown>, headers = auth) => app.request('/v1/categories', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  assert.equal((await app.request('/v1/categories')).status, 401);
  const defaults = (await (await catalog()).json()).categories;
  assert.equal(defaults.length, 10);
  assert.ok(defaults.every((category: { id: string; icon: string; isDefault: boolean }) => category.isDefault && category.icon === category.id));
  const input = { id: randomUUID(), name: 'Pets', icon: 'pet' };
  const [created, replay] = await Promise.all([createCategory(input), createCategory(input)]);
  assert.equal(created.status, 201);
  assert.equal(replay.status, 201);
  assert.deepEqual(await created.json(), await replay.json());
  const mine = (await (await catalog()).json()).categories;
  assert.equal(mine.length, 11);
  assert.deepEqual(mine.find((category: { id: string }) => category.id === input.id), { ...input, isDefault: false });
  const someoneElse = await app.request('/v1/categories', { headers: authA });
  assert.ok(!(await someoneElse.json()).categories.some((category: { id: string }) => category.id === input.id));
  assert.equal((await createCategory({ ...input, id: randomUUID(), name: '  pEtS ' })).status, 409);
  assert.equal((await createCategory({ ...input, id: randomUUID(), name: 'Groceries' })).status, 409);
  for (const invalid of [{ name: 'ThirteenChars!' }, { name: ' ' }, { name: 'bad\nname' }, { icon: 'not-an-icon' }, { ownerId: randomUUID() }]) {
    assert.equal((await createCategory({ ...input, id: randomUUID(), ...invalid })).status, 400);
  }
  const concurrent = await Promise.all([
    createCategory({ id: randomUUID(), name: 'Fitness', icon: 'fitness' }),
    createCategory({ id: randomUUID(), name: 'fitness', icon: 'fitness' }),
  ]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 409]);

  const ownExpense = operation({ categoryId: input.id, title: 'Pet food', amountPaise: 50, expenseDate: '2018-01-01' });
  assert.equal((await (await post(ownExpense, auth)).json()).results[0].expense.categoryId, input.id);
  const historyResponse = await history('?categoryId=' + input.id, auth);
  const historyPage = await historyResponse.json();
  assert.equal(historyPage.expenses[0].categoryName, 'Pets');
  assert.equal(historyPage.expenses[0].categoryIcon, 'pet');
  const totals = await app.request('/v1/expenses/daily-summary?date=2018-01-01', { headers: auth });
  assert.deepEqual((await totals.json()).categoryTotals, [{ categoryId: input.id, amountPaise: '50' }]);
  const forbidden = await post(operation({ categoryId: input.id }), authB);
  assert.equal((await forbidden.json()).results[0].error.code, 'INVALID_CATEGORY');
  const sameNameForAnotherAccount = await createCategory({ ...input, id: randomUUID() }, authA);
  assert.equal(sameNameForAnotherAccount.status, 201);
});

test('every offered category icon can be saved through the API and database constraint', async () => {
  const headers = { Authorization: 'Bearer test-user-c', 'Content-Type': 'application/json' };
  for (const [index, icon] of categoryIconIds.entries()) {
    const response = await app.request('/v1/categories', { method: 'POST', headers,
      body: JSON.stringify({ id: randomUUID(), name: 'Option ' + index, icon }) });
    assert.equal(response.status, 201, `icon ${icon} must be accepted by both validation and storage`);
    assert.equal((await response.json()).category.icon, icon);
  }
});

test('transaction filters and daily totals include the whole matching day across pagination', async () => {
  const headers = { Authorization: 'Bearer test-user-d' };
  const day = '2017-02-01';
  for (const expense of [
    { categoryId: 'food', amountPaise: 100 },
    { categoryId: 'food', amountPaise: 200 },
    { categoryId: 'shopping', amountPaise: 500 },
  ]) assert.ok((await (await post(operation({ ...expense, expenseDate: day }), headers)).json()).results[0].expense);
  const ownerId = await store.accountFor('test-user-d');
  const otherId = await store.accountFor('test-user-c');
  assert.ok(ownerId && otherId);
  await db.insert(expenses).values([
    { id: randomUUID(), ownerId, categoryId: 'food', amountPaise: 3000, expenseDate: day, deletedAt: new Date() },
    { id: randomUUID(), ownerId: otherId, categoryId: 'food', amountPaise: 9000, expenseDate: day },
    { id: randomUUID(), ownerId, categoryId: 'food', amountPaise: 8000, expenseDate: '2017-02-02' },
  ]);
  const query = '?start=2017-02-01&end=2017-02-02&categoryId=food&limit=1';
  const first = await (await history(query, headers)).json();
  assert.equal(first.expenses.length, 1);
  assert.equal(first.expenses[0].categoryId, 'food');
  assert.deepEqual(first.dateTotals, [{ date: day, totalPaise: '300' }]);
  assert.ok(first.nextCursor);
  const second = await (await history(query + '&cursor=' + encodeURIComponent(first.nextCursor), headers)).json();
  assert.equal(second.expenses.length, 1);
  assert.notEqual(first.expenses[0].id, second.expenses[0].id);
  assert.deepEqual(second.dateTotals, first.dateTotals);
  assert.equal(second.nextCursor, null);
  const all = await (await history('?start=2017-02-01&end=2017-02-02&limit=1', headers)).json();
  assert.deepEqual(all.dateTotals, [{ date: day, totalPaise: '800' }]);
  const empty = await (await history('?start=2017-02-01&end=2017-02-02&categoryId=travel', headers)).json();
  assert.deepEqual(empty.expenses, []);
  assert.deepEqual(empty.dateTotals, []);
});

test('requires a title, validates dates, and defaults the category and date', async () => {
  for (const expense of [
    { amountPaise: 0 }, { amountPaise: 2.5 }, { amountPaise: '12' }, { amountPaise: 1_000_000_000 },
    { categoryId: 'unknown' }, { expenseDate: '2025-02-29' }, { ownerId: randomUUID() },
    { title: undefined }, { title: '' }, { title: '   ' }, { title: 'x'.repeat(201) }, { note: '\0' },
  ]) assert.equal((await post(operation(expense))).status, 400);

  const future = await post(operation({ expenseDate: '9999-01-01' }));
  assert.equal((await future.json()).results[0].error.code, 'FUTURE_DATE');
  const response = await post(operation({ amountPaise: 1 }));
  const { expense } = (await response.json()).results[0];
  assert.equal(expense.categoryId, 'other');
  assert.equal(expense.expenseDate, accountToday());
  assert.equal(expense.title, 'Test expense');
  assert.equal((await app.request('/v1/expenses')).status, 401);
});

test('formats dates with a month name and the correct ordinal suffix', () => {
  for (const [day, suffix] of [[1, 'st'], [2, 'nd'], [3, 'rd'], [11, 'th'], [12, 'th'], [13, 'th'], [19, 'th'], [21, 'st']]) {
    assert.equal(formatExpenseDate(new Date(2026, 10, Number(day), 12)), `November ${day}${suffix}, 2026`);
  }
});

test('groups transactions across month and year boundaries without losing rows', () => {
  const rows = ['2026-01-01', '2025-12-31', '2025-12-30', '2025-12-01', '2025-11-15']
    .map(expenseDate => ({ expenseDate }));
  assert.deepEqual(groupExpenses(rows, '2026-01-01').map(group => [group.label, group.expenses.length]), [
    ['Today', 1], ['Yesterday', 1], ['December 2025', 2], ['November 2025', 1],
  ]);
  assert.deepEqual(expenseMonthBounds('2025-12-31'), { previousStart: '2025-11-01', start: '2025-12-01', end: '2026-01-01' });
  assert.equal(expenseMonthBounds('2026-01-01').previousStart, '2025-12-01');
  assert.equal(formatPaise('9007199254740993'), '₹9,00,71,99,25,47,409.93');
});

test('compares monthly spending with integer percentages and handles a zero baseline', () => {
  assert.deepEqual(compareMonthlySpend('75', '100'), { label: '25% below last month', above: false });
  assert.deepEqual(compareMonthlySpend('125', '100'), { label: '25% above last month', above: true });
  assert.equal(compareMonthlySpend('200', '100').label, '100% above last month');
  assert.deepEqual(compareMonthlySpend('201', '100'), { label: '₹1.01 more than last month', above: true });
  assert.equal(compareMonthlySpend('10', '0').label, 'No spending last month');
  assert.equal(compareMonthlySpend('10', '10').label, 'Same as last month');
  assert.equal(compareMonthlySpend('999', '1000').label, '<1% below last month');
});

test('calendar weeks run from Monday through Sunday across month and year boundaries', () => {
  assert.deepEqual(expenseWeekDates('2024-02-29'), [
    '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03',
  ]);
  const week = expenseWeekDates('2026-01-01');
  assert.equal(week[0], '2025-12-29');
  assert.equal(week[6], '2026-01-04');
  assert.equal(shiftExpenseDay('2024-02-29', 1), '2024-03-01');
});

test('monthly totals include all active expenses in the account month and exclude other users', async () => {
  const owner = await store.provision({ clerkUserId: 'test-user-c', name: null, email: 'c@example.test' });
  const other = await store.provision({ clerkUserId: 'test-user-d', name: null, email: 'd@example.test' });
  const { start, end } = expenseMonthBounds(accountToday());
  const prior = new Date(start);
  prior.setUTCDate(prior.getUTCDate() - 1);
  await db.insert(expenses).values([
    { id: randomUUID(), ownerId: owner, categoryId: 'food', amountPaise: 5000, expenseDate: start },
    { id: randomUUID(), ownerId: owner, categoryId: 'food', amountPaise: 3600, expenseDate: start },
    { id: randomUUID(), ownerId: owner, categoryId: 'other', amountPaise: 7, expenseDate: start },
    { id: randomUUID(), ownerId: owner, categoryId: 'other', amountPaise: 5, expenseDate: shiftExpenseDay(start, 1) },
    { id: randomUUID(), ownerId: owner, amountPaise: 1, expenseDate: start, deletedAt: new Date() },
    { id: randomUUID(), ownerId: owner, amountPaise: 2, expenseDate: prior.toISOString().slice(0, 10) },
    { id: randomUUID(), ownerId: owner, amountPaise: 3, expenseDate: end },
    { id: randomUUID(), ownerId: other, amountPaise: 999, expenseDate: start },
  ]);
  const response = await app.request('/v1/expenses/monthly-summary', { headers: { Authorization: 'Bearer test-user-c' } });
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.monthStart, start);
  assert.equal(summary.totalPaise, '8612');
  assert.equal(summary.previousMonthTotalPaise, '2');
  assert.deepEqual(Object.fromEntries(summary.categoryTotals.map((category: { categoryId: string; amountPaise: string }) =>
    [category.categoryId, category.amountPaise])), { food: '8600', other: '12' });
  const headers = { Authorization: 'Bearer test-user-c' };
  const previousDay = prior.toISOString().slice(0, 10);
  const daily = await app.request('/v1/expenses/daily-summary?date=' + start, { headers });
  assert.equal(daily.status, 200);
  const day = await daily.json();
  assert.equal(day.date, start);
  assert.equal(day.totalPaise, '8607');
  const otherDay = await app.request('/v1/expenses/daily-summary?date=' + previousDay, { headers });
  assert.equal((await otherDay.json()).totalPaise, '2');
  const historical = await app.request('/v1/expenses/monthly-summary?month=' + expenseMonthBounds(previousDay).start, { headers });
  assert.equal((await historical.json()).totalPaise, '2');
  assert.equal((await app.request('/v1/expenses/daily-summary?date=' + end, { headers })).status, 400);
  assert.equal((await app.request('/v1/expenses/daily-summary?date=2025-02-29', { headers })).status, 400);
  assert.equal((await app.request('/v1/expenses/monthly-summary')).status, 401);
});

test('scope and sign history cursors by owner and filter, with stable same-day pagination', async () => {
  const sameDay = { categoryId: 'transport', expenseDate: '2024-01-01' };
  const itemA = operation(sameDay);
  const secondA = operation(sameDay);
  const itemB = operation(sameDay);
  for (const item of [itemA, secondA]) assert.ok((await (await post(item)).json()).results[0].expense);
  await db.execute(sql`update expenses set created_at = '2024-01-01T12:00:00.000001Z' where id = ${itemA.expense.id}::uuid`);
  await db.execute(sql`update expenses set created_at = '2024-01-01T12:00:00.000002Z' where id = ${secondA.expense.id}::uuid`);
  assert.ok((await (await post(itemB, authB)).json()).results[0].expense);
  const filters = '?categoryId=transport&start=2024-01-01&end=2024-01-02&limit=1';
  const first = await (await history(filters)).json();
  assert.equal(first.expenses[0].categoryName, 'Transport');
  assert.ok(first.nextCursor);
  const cursor = '&cursor=' + encodeURIComponent(first.nextCursor);
  const second = await (await history(filters + cursor)).json();
  const expected = [secondA.expense.id, itemA.expense.id];
  assert.deepEqual([first.expenses[0].id, second.expenses[0].id], expected);
  assert.equal(second.nextCursor, null);
  assert.equal((await history(filters + cursor, authB)).status, 400);
  assert.equal((await history('?categoryId=food' + cursor)).status, 400);
  assert.equal((await history(filters + cursor + 'x')).status, 400);
  assert.equal((await history('?limit=101')).status, 400);
  const bHistory = await (await history('', authB)).json();
  assert.deepEqual(bHistory.expenses.map((expense: { id: string }) => expense.id), [itemB.expense.id]);
});

test('history sorts by date then creation time and paginates microsecond and timestamp ties without skipping rows', async () => {
  const ownerId = await store.accountFor('test-user-b');
  assert.ok(ownerId);
  const ids = [
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ];
  for (const [index, id] of ids.entries()) {
    const date = index === 3 ? '2019-01-02' : '2019-01-01';
    const createdAt = index === 0 || index === 3 ? '2019-01-03T10:00:00.000001Z' : '2019-01-03T10:00:00.000002Z';
    await db.execute(sql`insert into expenses (id, owner_id, category_id, title, amount_paise, expense_date, created_at)
      values (${id}::uuid, ${ownerId}::uuid, 'education', 'Ordering fixture', 100, ${date}::date, ${createdAt}::timestamptz)`);
  }
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const query = '?start=2019-01-01&end=2019-01-03&limit=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const response = await history(query, authB);
    assert.equal(response.status, 200);
    const page = await response.json();
    seen.push(...page.expenses.map((item: { id: string }) => item.id));
    assert.match(page.expenses[0].createdAt, /\.\d{6}Z$/);
    cursor = page.nextCursor;
    assert.ok(seen.length <= ids.length, 'pagination must not repeat rows');
  } while (cursor);
  assert.deepEqual(seen, [ids[3], ids[2], ids[1], ids[0]]);
});

test('category totals put recently used categories first across the whole selected period', async () => {
  const ownerId = await store.accountFor('test-user-c');
  const otherOwner = await store.accountFor('test-user-d');
  assert.ok(ownerId && otherOwner);
  const fixtures = [
    { category: 'food', minute: 1, ownerId, date: '2020-02-03', deleted: false },
    { category: 'medical', minute: 2, ownerId, date: '2020-02-03', deleted: false },
    { category: 'food', minute: 3, ownerId, date: '2020-02-03', deleted: false },
    { category: 'shopping', minute: 4, ownerId, date: '2020-02-03', deleted: false },
    { category: 'education', minute: 5, ownerId, date: '2020-02-03', deleted: true },
    { category: 'travel', minute: 6, ownerId: otherOwner, date: '2020-02-03', deleted: false },
    { category: 'bills', minute: 7, ownerId, date: '2020-02-04', deleted: false },
  ];
  for (const fixture of fixtures) {
    const createdAt = `2020-02-05T10:0${fixture.minute}:00.000000Z`;
    await db.execute(sql`insert into expenses
      (id, owner_id, category_id, amount_paise, expense_date, created_at, deleted_at)
      values (${randomUUID()}::uuid, ${fixture.ownerId}::uuid, ${fixture.category}, 100,
        ${fixture.date}::date, ${createdAt}::timestamptz, ${fixture.deleted ? createdAt : null}::timestamptz)`);
  }
  const response = await app.request('/v1/expenses/daily-summary?date=2020-02-03', {
    headers: { Authorization: 'Bearer test-user-c' },
  });
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.deepEqual(summary.categoryTotals, [
    { categoryId: 'shopping', amountPaise: '100' },
    { categoryId: 'food', amountPaise: '200' },
    { categoryId: 'medical', amountPaise: '100' },
  ]);
});

test('rolls back the expense, receipt and revision when the sync event write fails', async () => {
  const item = operation();
  const ownerId = await store.accountFor('test-user-a');
  assert.ok(ownerId);
  const revision = async () => (await db.select().from(appUsers).where(eq(appUsers.id, ownerId)))[0].syncRevision;
  const before = await revision();
  await db.execute(sql`alter table sync_changes add constraint test_forced_failure check (revision < 0) not valid`);
  try {
    const response = await post(item);
    assert.equal(response.status, 500);
    const failure = await response.json();
    assert.deepEqual(failure, {
      code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.', requestId: response.headers.get('X-Request-Id'),
    });
    assert.equal(await store.get(ownerId, item.expense.id), undefined);
    assert.equal((await db.select().from(mutationReceipts).where(eq(mutationReceipts.mutationId, item.mutationId))).length, 0);
    assert.equal(await revision(), before);
  } finally {
    await db.execute(sql`alter table sync_changes drop constraint test_forced_failure`);
  }
  const retry = await post(item);
  assert.equal((await retry.json()).results[0].expense.id, item.expense.id);
  assert.equal(await revision(), before + 1n);
});

test('edits persist atomically, replay safely, refresh totals and reject stale or foreign edits', async () => {
  const item = operation({ title: 'Original', note: 'Keep this note', expenseDate: '2018-01-01', categoryId: 'food' });
  await post(item, authB);
  const edit = { mutationId: randomUUID(), operation: 'update', expense: {
    id: item.expense.id, version: 1, title: '  Paracetamol  ', amountPaise: 50000,
    categoryId: 'medical', expenseDate: '2018-01-02',
  } };
  const send = (input = edit, auth = authB) => app.request('/v1/sync/mutations', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations: [input] }),
  });
  const owner = (await store.accountFor('test-user-b'))!;
  const revision = async () => (await db.select().from(appUsers).where(eq(appUsers.id, owner)))[0].syncRevision;
  const before = await revision();
  const [first, replay] = await Promise.all([send(), send()]);
  const saved = await first.json();
  assert.deepEqual(await replay.json(), saved);
  assert.deepEqual(saved.results[0].expense, { ...edit.expense, title: 'Paracetamol', note: 'Keep this note', version: 2 });
  assert.equal(await revision(), before + 1n);
  const record = await app.request('/v1/expenses/' + item.expense.id, { headers: authB });
  assert.deepEqual(await record.json(), saved.results[0].expense);
  const oldDay = await app.request('/v1/expenses/daily-summary?date=2018-01-01', { headers: authB });
  assert.equal((await oldDay.json()).totalPaise, '0');
  const newDay = await app.request('/v1/expenses/daily-summary?date=2018-01-02', { headers: authB });
  assert.deepEqual((await newDay.json()).categoryTotals, [{ categoryId: 'medical', amountPaise: '50000' }]);
  assert.equal((await (await send({ ...edit, mutationId: randomUUID() })).json()).results[0].error.code, 'VERSION_CONFLICT');
  assert.equal((await (await send(edit, authA)).json()).results[0].error.code, 'EXPENSE_NOT_FOUND');
  assert.equal((await (await send({ ...edit, expense: { ...edit.expense, title: 'Changed retry' } })).json()).results[0].error.code, 'MUTATION_CONFLICT');
  const next = { ...edit, mutationId: randomUUID(), expense: { ...edit.expense, version: 2, expenseDate: '9999-01-01' } };
  assert.equal((await (await send(next)).json()).results[0].error.code, 'FUTURE_DATE');
  for (const changes of [{ title: ' ' }, { amountPaise: 0 }, { expenseDate: '2025-02-30' }, { version: 0 }]) {
    const response = await send({ ...edit, mutationId: randomUUID(), expense: { ...edit.expense, ...changes } });
    assert.equal(response.status, 400);
  }
  const [foreignCategory] = await db.select().from(categories).where(eq(categories.ownerId, (await store.accountFor('test-user-d'))!));
  assert.ok(foreignCategory);
  assert.equal((await (await send({ ...edit, mutationId: randomUUID(), expense: {
    ...edit.expense, version: 2, categoryId: foreignCategory.id,
  } })).json()).results[0].error.code, 'INVALID_CATEGORY');
  await db.execute(sql`alter table sync_changes add constraint test_edit_failure check (revision < 0) not valid`);
  const valid = { ...edit, mutationId: randomUUID(), expense: { ...edit.expense, version: 2, amountPaise: 12345 } };
  try {
    assert.equal((await send(valid)).status, 500);
    assert.equal((await store.get(owner, item.expense.id))?.amountPaise, 50000);
    assert.equal(await revision(), before + 1n);
  } finally {
    await db.execute(sql`alter table sync_changes drop constraint test_edit_failure`);
  }
  assert.equal((await (await send(valid)).json()).results[0].expense.version, 3);
});

test('category edits preserve expenses, personalize defaults and isolate accounts', async () => {
  const auth = { Authorization: 'Bearer test-user-c' };
  const catalog = async (headers = auth) => (await (await app.request('/v1/categories', { headers })).json()).categories;
  const edit = (input: Record<string, unknown>, headers = auth) => app.request('/v1/categories/' + input.id, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const initial = (await catalog()).find((category: { id: string }) => category.id === 'food');
  const input = { id: 'food', name: 'Dining', icon: 'coffee', previousName: initial.name, previousIcon: initial.icon };
  const expense = operation({ categoryId: 'food', title: 'Category edit fixture', expenseDate: '2017-01-01' });
  await post(expense, auth);
  const savedExpense = await (await app.request('/v1/expenses/' + expense.expense.id, { headers: auth })).json();
  assert.equal((await app.request('/v1/categories/food', { method: 'POST' })).status, 401);
  assert.equal((await edit(input)).status, 200);
  assert.equal((await edit(input)).status, 200, 'an identical retry succeeds');
  assert.deepEqual((await catalog()).find((category: { id: string }) => category.id === 'food'), {
    id: 'food', name: 'Dining', icon: 'coffee', isDefault: true,
  });
  assert.equal((await catalog(authB)).find((category: { id: string }) => category.id === 'food').name, initial.name);
  const [globalDefault] = await db.select().from(categories).where(eq(categories.id, 'food'));
  assert.equal(globalDefault.name, initial.name);
  const updatedHistory = await history('?start=2017-01-01&end=2017-01-02', auth);
  const [row] = (await updatedHistory.json()).expenses;
  assert.equal(row.categoryName, 'Dining'); assert.equal(row.categoryIcon, 'coffee');
  assert.deepEqual(await (await app.request('/v1/expenses/' + expense.expense.id, { headers: auth })).json(), savedExpense);
  assert.equal((await edit({ ...input, name: 'Stale' })).status, 409);
  assert.equal((await edit({ ...input, previousName: 'Dining', previousIcon: 'coffee', name: 'groceries' })).status, 409);
  assert.equal((await edit({ ...input, previousName: 'Dining', previousIcon: 'coffee', name: 'WayTooLongName' })).status, 400);
  for (const invalid of [{ name: '' }, { name: 'bad\nname' }, { icon: 'invalid' }, { ownerId: randomUUID() }]) {
    assert.equal((await edit({ ...input, ...invalid })).status, 400);
  }
  const create = (category: Record<string, unknown>) => app.request('/v1/categories', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(category),
  });
  assert.equal((await create({ id: randomUUID(), name: 'DINING', icon: 'food' })).status, 409);
  const custom = { id: randomUUID(), name: 'Classes', icon: 'education' };
  assert.equal((await create(custom)).status, 201);
  const customEdit = { ...custom, name: 'Tuition', icon: 'work', previousName: custom.name, previousIcon: custom.icon };
  assert.equal((await edit(customEdit, authB)).status, 404);
  assert.equal((await edit(customEdit)).status, 200);
  assert.equal((await catalog()).find((category: { id: string }) => category.id === custom.id).name, 'Tuition');
  const entertainment = (await catalog()).find((category: { id: string }) => category.id === 'entertainment');
  assert.equal((await edit({ id: entertainment.id, name: entertainment.name, icon: 'music',
    previousName: entertainment.name, previousIcon: entertainment.icon })).status, 200, 'legacy long names allow icon-only edits');
});

test('database independently enforces category, amount, and owner integrity', async () => {
  const ownerId = await store.accountFor('test-user-a');
  assert.ok(ownerId);
  const row = { id: randomUUID(), ownerId, amountPaise: 10, expenseDate: '2024-01-01' };
  await assert.rejects(db.insert(expenses).values({ ...row, amountPaise: 0 }).execute());
  await assert.rejects(db.insert(expenses).values({ ...row, categoryId: 'unknown' as 'other' }).execute());
  await assert.rejects(db.insert(expenses).values({ ...row, ownerId: randomUUID() }).execute());
  await db.update(appUsers).set({ status: 'deletion_pending' }).where(eq(appUsers.id, ownerId));
  assert.equal((await history()).status, 403);
  assert.equal((await post(operation())).status, 403);
});

test('PostgreSQL uses the history indexes with realistic row counts', async () => {
  const ownerId = await store.accountFor('test-user-b');
  assert.ok(ownerId);
  await db.execute(sql`insert into expenses (id, owner_id, category_id, amount_paise, expense_date)
    select gen_random_uuid(), ${ownerId}::uuid,
      case when n % 7 = 0 then 'food' else 'other' end, 100, date '2024-01-01' + n % 365
    from generate_series(1, 10000) as entries(n)`);
  await db.execute(sql`analyze expenses`);

  for (const [categoryId, indexName] of [
    [undefined, 'expenses_active_history_idx'],
    ['food', 'expenses_active_category_history_idx'],
  ] as const) {
    await store.list(ownerId, { categoryId, limit: 30 }, {
      id: randomUUID(), date: '2024-08-01', createdAt: '2024-08-01T12:00:00.000000Z',
    });
    assert.ok(lastQuery);
    const plan = await postgres.query('EXPLAIN ' + lastQuery.query, lastQuery.params);
    assert.match(JSON.stringify(plan.rows), new RegExp(indexName));
  }
});
