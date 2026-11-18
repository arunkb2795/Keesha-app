import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { accountToday, expenseMonthBounds, shiftExpenseDay, type Expense } from '../../src/domain/expenses.js';
import { ExpenseError, type expenseStore } from './db/expenses.js';
import {
  calendarDateSchema, createBatchSchema, cursorPayloadSchema, expenseSchema, historyQuerySchema, newCategorySchema, editCategorySchema, profileSchema, uuid,
  type ExpenseCursor, type HistoryQuery,
} from './validation.js';

type Dependencies = {
  store: ReturnType<typeof expenseStore>;
  authenticate: (authorization: string | undefined) => Promise<string>;
  loadProfile: (id: string) => Promise<unknown>;
  cursorSecret: string;
  webOrigins?: string[];
};

function cursorSignature(secret: string, owner: string, query: HistoryQuery, payload: string) {
  return createHmac('sha256', secret)
    .update(JSON.stringify([owner, query.start, query.end, query.categoryId, payload])).digest('base64url');
}

function decodeCursor(secret: string, owner: string, query: HistoryQuery): ExpenseCursor | undefined {
  if (!query.cursor) return;
  const [payload, signature, extra] = query.cursor.split('.');
  if (payload && signature && !extra && query.cursor === payload + '.' + signature) {
    const expected = Buffer.from(cursorSignature(secret, owner, query, payload));
    const received = Buffer.from(signature);
    if (received.length === expected.length && timingSafeEqual(received, expected)) {
      const parsed = cursorPayloadSchema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
      if (parsed.success) return parsed.data;
    }
  }
  throw new ExpenseError(400, 'INVALID_CURSOR', 'Refresh your expense history and try again.');
}

function publicError(error: ExpenseError) {
  return { code: error.code, message: error.message };
}

function sumPaise(totals: readonly { amountPaise: string }[]) {
  return totals.reduce((sum, category) => sum + BigInt(category.amountPaise), 0n).toString();
}

export function createApi({ store, authenticate, loadProfile, cursorSecret, webOrigins = [] }: Dependencies) {
  const app = new Hono<{ Variables: { clerkUserId: string; requestId: string } }>();
  app.use('*', async (c, next) => {
    const requestId = randomUUID();
    c.set('requestId', requestId);
    c.header('Cache-Control', 'no-store');
    c.header('X-Request-Id', requestId);
    await next();
  });
  app.use('/v1/*', cors({
    origin: webOrigins,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }));
  app.use('/v1/*', async (c, next) => {
    c.set('clerkUserId', await authenticate(c.req.header('Authorization')));
    await next();
  });

  async function ensureOwner(clerkUserId: string) {
    const existing = await store.accountFor(clerkUserId);
    if (existing) return existing;
    const profile = profileSchema.safeParse(await loadProfile(clerkUserId));
    if (!profile.success || profile.data.clerkUserId !== clerkUserId) {
      throw new ExpenseError(403, 'PROFILE_UNAVAILABLE', 'A verified email address is required.');
    }
    return store.provision(profile.data);
  }

  app.get('/v1/categories', async c => {
    const owner = await store.accountFor(c.get('clerkUserId'));
    return c.json({ categories: await store.listCategories(owner) });
  });

  app.post('/v1/categories', bodyLimit({ maxSize: 2048,
    onError: c => c.json({ code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large.' }, 413),
  }), async c => {
    const input = newCategorySchema.safeParse(await c.req.json().catch(() => undefined));
    if (!input.success) throw new ExpenseError(400, 'INVALID_CATEGORY', 'Enter a category name of 1–12 characters and choose an icon.');
    const owner = await ensureOwner(c.get('clerkUserId'));
    return c.json({ category: await store.createCategory(owner, input.data) }, 201);
  });

  app.post('/v1/categories/:id', bodyLimit({ maxSize: 2048,
    onError: c => c.json({ code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large.' }, 413),
  }), async c => {
    const input = editCategorySchema.safeParse(await c.req.json().catch(() => undefined));
    if (!input.success || input.data.id !== c.req.param('id').toLowerCase()) {
      throw new ExpenseError(400, 'INVALID_CATEGORY', 'Check the category name and icon, then try again.');
    }
    const owner = await ensureOwner(c.get('clerkUserId'));
    return c.json({ category: await store.updateCategory(owner, input.data) });
  });

  app.post('/v1/sync/mutations', bodyLimit({
    maxSize: 96 * 1024,
    onError: c => c.json({
      code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large.', requestId: c.get('requestId'),
    }, 413),
  }), async c => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) throw new ExpenseError(400, 'INVALID_EXPENSE', 'Check the expense details and try again.');

    const ownerId = await ensureOwner(c.get('clerkUserId'));

    const results: ({ mutationId: string; expense: Expense } |
      { mutationId: string; error: ReturnType<typeof publicError> })[] = [];
    for (const operation of parsed.data.operations) {
      const { mutationId } = operation;
      try {
        results.push({ mutationId, expense: operation.operation === 'update'
          ? await store.update(ownerId, operation) : await store.create(ownerId, operation) });
      } catch (error) {
        if (!(error instanceof ExpenseError)) throw error;
        results.push({ mutationId, error: publicError(error) });
      }
    }
    return c.json({ results });
  });

  app.get('/v1/expenses', async c => {
    const params = new URL(c.req.url).searchParams;
    const parsed = historyQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].length !== new Set(params.keys()).size) {
      throw new ExpenseError(400, 'INVALID_FILTERS', 'Check your expense filters and try again.');
    }
    const query = parsed.data;
    const owner = await store.accountFor(c.get('clerkUserId'));
    const cursor = decodeCursor(cursorSecret, owner ?? '', query);
    if (!owner) return c.json({ expenses: [], nextCursor: null, dateTotals: [] });

    const rows = await store.list(owner, query, cursor);
    const items = rows.slice(0, query.limit).map(({ categoryName, categoryIcon, createdAt, ...item }) => ({
      ...expenseSchema.parse(item), categoryName, categoryIcon, createdAt,
    }));
    const last = items.at(-1);
    let nextCursor: string | null = null;
    if (last && rows.length > query.limit) {
      const payload = Buffer.from(JSON.stringify({ date: last.expenseDate, createdAt: last.createdAt, id: last.id })).toString('base64url');
      nextCursor = payload + '.' + cursorSignature(cursorSecret, owner, query, payload);
    }
    const dateTotals = await store.totalsForDates(owner, [...new Set(items.map(item => item.expenseDate))], query.categoryId);
    return c.json({ expenses: items, nextCursor, dateTotals });
  });

  app.get('/v1/expenses/monthly-summary', async c => {
    const today = accountToday();
    const month = calendarDateSchema.safeParse(c.req.query('month') ?? expenseMonthBounds(today).start);
    if (!month.success || !month.data.endsWith('-01') || month.data > today) {
      throw new ExpenseError(400, 'INVALID_MONTH', 'Choose this month or an earlier month.');
    }
    const { start, end, previousStart } = expenseMonthBounds(month.data);
    const owner = await store.accountFor(c.get('clerkUserId'));
    const [categoryTotals, previousTotals] = owner ? await Promise.all([
      store.categoryTotalsForRange(owner, start, end),
      previousStart >= '0001-01-01' ? store.categoryTotalsForRange(owner, previousStart, start) : [],
    ]) : [[], []];
    return c.json({
      monthStart: start, totalPaise: sumPaise(categoryTotals),
      previousMonthTotalPaise: sumPaise(previousTotals), categoryTotals,
    });
  });

  app.get('/v1/expenses/daily-summary', async c => {
    const date = calendarDateSchema.safeParse(c.req.query('date'));
    if (!date.success || date.data > accountToday()) {
      throw new ExpenseError(400, 'INVALID_DATE', 'Choose today or an earlier date.');
    }
    const owner = await store.accountFor(c.get('clerkUserId'));
    const categoryTotals = owner ? await store.categoryTotalsForRange(owner, date.data, shiftExpenseDay(date.data, 1)) : [];
    return c.json({ date: date.data, totalPaise: sumPaise(categoryTotals), categoryTotals });
  });

  app.get('/v1/expenses/:id', async c => {
    const id = uuid.safeParse(c.req.param('id'));
    if (!id.success) throw new ExpenseError(400, 'INVALID_EXPENSE_ID', 'Check the expense ID.');
    const owner = await store.accountFor(c.get('clerkUserId'));
    const record = owner ? await store.get(owner, id.data) : undefined;
    if (!record) throw new ExpenseError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    return c.json(expenseSchema.parse(record));
  });

  app.notFound(c => c.json({ code: 'NOT_FOUND', message: 'Page not found.', requestId: c.get('requestId') }, 404));
  app.onError((error, c) => {
    const requestId = c.get('requestId');
    if (error instanceof ExpenseError) return c.json({ ...publicError(error), requestId }, error.status);
    console.error(JSON.stringify({ requestId, method: c.req.method, status: 500, code: 'INTERNAL_ERROR' }));
    return c.json({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.', requestId }, 500);
  });

  return app;
}
