import { categoryNames, maxExpensePaise, type CategoryId, type CreateExpense, type Expense, type ExpensePeriod } from '@/domain/expenses';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

type GetToken = () => Promise<string | null>;
export type HistoryEntry = Expense & { categoryName: string };
type CategoryTotal = { categoryId: CategoryId; amountPaise: string };
export class ExpenseApiError extends Error {}

async function request(getToken: GetToken, path: string, options?: RequestInit): Promise<unknown> {
  if (!apiUrl) throw new ExpenseApiError('The expense API is not configured.');
  const token = await getToken();
  if (!token) throw new ExpenseApiError('Sign in to access your expenses.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options?.signal?.aborted) abort();
  else options?.signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 15_000);
  try {
    const response = await fetch(apiUrl + path, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: 'Bearer ' + token, ...options?.headers },
    });
    if (response.status === 401) throw new ExpenseApiError('Sign in to access your expenses.');
    if (!response.ok) throw new ExpenseApiError('Couldn’t connect to your expenses. Try again.');
    return await response.json();
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', abort);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isExpense(value: unknown): value is Expense {
  return isObject(value)
    && typeof value.id === 'string'
    && (typeof value.title === 'string' || value.title === null)
    && (typeof value.note === 'string' || value.note === null)
    && typeof value.amountPaise === 'number' && Number.isInteger(value.amountPaise)
    && value.amountPaise >= 1 && value.amountPaise <= maxExpensePaise
    && typeof value.categoryId === 'string' && Object.hasOwn(categoryNames, value.categoryId)
    && typeof value.expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.expenseDate)
    && typeof value.version === 'number' && Number.isInteger(value.version) && value.version > 0;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return isObject(value) && typeof value.categoryName === 'string' && isExpense(value);
}

export async function saveExpense(getToken: GetToken, mutationId: string, expense: CreateExpense) {
  const result = await request(getToken, '/v1/sync/mutations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations: [{ operation: 'create', mutationId, expense }] }),
  });
  const receipt: unknown = isObject(result) && Array.isArray(result.results) ? result.results[0] : undefined;
  if (isObject(receipt) && receipt.mutationId === mutationId) {
    if (isExpense(receipt.expense) && receipt.expense.id === expense.id) return receipt.expense;
    if (isObject(receipt.error) && receipt.error.code === 'FUTURE_DATE') throw new ExpenseApiError('Choose today or an earlier date.');
  }
  throw new ExpenseApiError('Couldn’t save your expense. Try again.');
}

export async function listExpenses(getToken: GetToken, cursor?: string, signal?: AbortSignal, limit = 30,
  range?: { start: string; end: string }) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  if (range) {
    query.set('start', range.start);
    query.set('end', range.end);
  }
  const result = await request(getToken, '/v1/expenses?' + query, { signal });
  if (isObject(result) && Array.isArray(result.expenses) && result.expenses.every(isHistoryEntry)
      && (result.nextCursor === null || typeof result.nextCursor === 'string')) {
    return { expenses: result.expenses, nextCursor: result.nextCursor };
  }
  throw new Error('Couldn’t load your expenses. Try again.');
}

function isPaise(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function isCategoryTotal(value: unknown): value is CategoryTotal {
  return isObject(value) && typeof value.categoryId === 'string' && Object.hasOwn(categoryNames, value.categoryId)
    && isPaise(value.amountPaise);
}

export async function getExpenseSummary(getToken: GetToken, period: ExpensePeriod, signal?: AbortSignal) {
  const monthly = period.kind === 'month';
  const path = monthly ? '/v1/expenses/monthly-summary?month=' : '/v1/expenses/daily-summary?date=';
  const result = await request(getToken, path + encodeURIComponent(period.date), { signal });
  if (isObject(result) && result[monthly ? 'monthStart' : 'date'] === period.date && isPaise(result.totalPaise)
    && Array.isArray(result.categoryTotals) && result.categoryTotals.every(isCategoryTotal)) {
    const previousMonthTotalPaise = monthly ? result.previousMonthTotalPaise : undefined;
    if (!monthly || isPaise(previousMonthTotalPaise)) {
      return { totalPaise: result.totalPaise,
        previousMonthTotalPaise: isPaise(previousMonthTotalPaise) ? previousMonthTotalPaise : undefined,
        categoryTotals: result.categoryTotals };
    }
  }
  throw new Error('Couldn’t load your spending summary. Try again.');
}
