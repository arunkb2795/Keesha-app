import { isCategoryIcon, isCategoryId, maxExpensePaise, type CategoryIcon, type CategoryId,
  type CreateExpense, type Expense, type ExpenseCategory, type ExpensePeriod, type NewCategory, type EditCategory } from '@/domain/expenses';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

type GetToken = () => Promise<string | null>;
export type HistoryEntry = Expense & { categoryName: string; categoryIcon?: CategoryIcon };
export type DateTotal = { date: string; totalPaise: string };
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
    if (!response.ok) {
      const problem: unknown = await response.json().catch(() => undefined);
      if (isObject(problem) && problem.code === 'CATEGORY_EXISTS') {
        throw new ExpenseApiError('A category with this name already exists. Choose another name.');
      }
      if (isObject(problem) && problem.code === 'INVALID_CATEGORY') {
        throw new ExpenseApiError('Check the category name and icon, then try again.');
      }
      if (isObject(problem) && problem.code === 'CATEGORY_CHANGED') {
        throw new ExpenseApiError('This category changed elsewhere. Cancel and reopen it to load the latest details.');
      }
      if (isObject(problem) && problem.code === 'CATEGORY_NOT_FOUND') {
        throw new ExpenseApiError('This category is no longer available.');
      }
      throw new ExpenseApiError('Couldn’t connect to your expenses. Try again.');
    }
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
    && isCategoryId(value.categoryId)
    && typeof value.expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.expenseDate)
    && typeof value.version === 'number' && Number.isInteger(value.version) && value.version > 0;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return isObject(value) && typeof value.categoryName === 'string'
    && (value.categoryIcon === undefined || isCategoryIcon(value.categoryIcon)) && isExpense(value);
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

export async function getExpense(getToken: GetToken, id: string, signal?: AbortSignal) {
  const result = await request(getToken, '/v1/expenses/' + encodeURIComponent(id), { signal });
  if (isExpense(result) && result.id === id) return result;
  throw new ExpenseApiError('Couldn’t load this transaction. Try again.');
}

export async function updateExpense(getToken: GetToken, mutationId: string,
  expense: Pick<Expense, 'id' | 'version' | 'amountPaise' | 'categoryId' | 'expenseDate'> & { title: string }) {
  const result = await request(getToken, '/v1/sync/mutations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations: [{ operation: 'update', mutationId, expense }] }),
  });
  const receipt: unknown = isObject(result) && Array.isArray(result.results) ? result.results[0] : undefined;
  if (isObject(receipt) && receipt.mutationId === mutationId) {
    if (isExpense(receipt.expense) && receipt.expense.id === expense.id) return receipt.expense;
    if (isObject(receipt.error)) {
      const messages: Record<string, string> = {
        FUTURE_DATE: 'Choose today or an earlier date.',
        VERSION_CONFLICT: 'This transaction changed elsewhere. Cancel and reopen it to load the latest details.',
        EXPENSE_NOT_FOUND: 'This transaction is no longer available.',
        INVALID_CATEGORY: 'Choose one of your available categories.',
      };
      const message = typeof receipt.error.code === 'string' ? messages[receipt.error.code] : undefined;
      if (message) throw new ExpenseApiError(message);
    }
  }
  throw new ExpenseApiError('Couldn’t save your changes. Try again.');
}

export async function listExpenses(getToken: GetToken, cursor?: string, signal?: AbortSignal, limit = 30,
  range?: { start: string; end: string }, categoryId?: CategoryId) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  if (categoryId) query.set('categoryId', categoryId);
  if (range) {
    query.set('start', range.start);
    query.set('end', range.end);
  }
  const result = await request(getToken, '/v1/expenses?' + query, { signal });
  if (isObject(result) && Array.isArray(result.expenses) && result.expenses.every(isHistoryEntry)
      && Array.isArray(result.dateTotals) && result.dateTotals.every(isDateTotal)
      && (result.nextCursor === null || typeof result.nextCursor === 'string')) {
    return { expenses: result.expenses, nextCursor: result.nextCursor, dateTotals: result.dateTotals };
  }
  throw new Error('Couldn’t load your expenses. Try again.');
}

function isPaise(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function isDateTotal(value: unknown): value is DateTotal {
  return isObject(value) && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && isPaise(value.totalPaise);
}

function isCategoryTotal(value: unknown): value is CategoryTotal {
  return isObject(value) && isCategoryId(value.categoryId)
    && isPaise(value.amountPaise);
}

function isCategory(value: unknown): value is ExpenseCategory {
  return isObject(value) && isCategoryId(value.id) && typeof value.name === 'string'
    && value.name.trim().length > 0 && value.name.length <= 200 && isCategoryIcon(value.icon)
    && typeof value.isDefault === 'boolean';
}

export async function listCategories(getToken: GetToken, signal?: AbortSignal) {
  const result = await request(getToken, '/v1/categories', { signal });
  if (isObject(result) && Array.isArray(result.categories) && result.categories.every(isCategory)) return result.categories;
  throw new ExpenseApiError('Couldn’t load your categories. Try again.');
}

export async function createCategory(getToken: GetToken, category: NewCategory) {
  const result = await request(getToken, '/v1/categories', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(category) });
  if (isObject(result) && isCategory(result.category)) return result.category;
  throw new ExpenseApiError('Couldn’t create your category. Try again.');
}

export async function updateCategory(getToken: GetToken, input: EditCategory) {
  const result = await request(getToken, '/v1/categories/' + encodeURIComponent(input.id), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (isObject(result) && isCategory(result.category) && result.category.id === input.id) return result.category;
  throw new ExpenseApiError('Couldn’t save your category. Try again.');
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
