import { createHash } from 'node:crypto';
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { accountToday, maxCategoryNameLength, type CategoryIcon, type CategoryId } from '../../../src/domain/expenses.js';
import { appUsers, categories, categoryPreferences, expenses, mutationReceipts, syncChanges } from './schema.js';
import { expenseSchema, type CreateOperation, type UpdateOperation, type ExpenseCursor, type HistoryQuery, type NewCategory, type EditCategory, type Profile } from '../validation.js';

export class ExpenseError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const expenseFields = {
  id: expenses.id,
  title: expenses.title,
  amountPaise: expenses.amountPaise,
  categoryId: expenses.categoryId,
  expenseDate: expenses.expenseDate,
  note: expenses.note,
  version: expenses.version,
};

export function expenseStore<T extends PgQueryResultHKT>(db: PgAsyncDatabase<T>) {
  const categoryFields = { id: categories.id, name: categories.name, icon: categories.icon,
    isDefault: sql<boolean>`${categories.ownerId} is null` };
  const displayName = sql<string>`coalesce(${categoryPreferences.name}, ${categories.name})`;
  const displayIcon = sql<CategoryIcon>`coalesce(${categoryPreferences.icon}, ${categories.icon})`;
  function preferenceJoin(ownerId?: string) {
    return and(eq(categoryPreferences.categoryId, categories.id), ownerId ? eq(categoryPreferences.ownerId, ownerId) : sql`false`);
  }
  function listCategories(ownerId?: string, connection: Pick<typeof db, 'select'> = db) {
    return connection.select({ ...categoryFields, name: displayName, icon: displayIcon }).from(categories)
      .leftJoin(categoryPreferences, preferenceJoin(ownerId))
      .where(or(isNull(categories.ownerId), ownerId ? eq(categories.ownerId, ownerId) : undefined))
      .orderBy(sql`${categories.ownerId} is null desc`, categories.createdAt, categories.id);
  }

  async function createCategory(ownerId: string, input: NewCategory) {
    return db.transaction(async tx => {
      const [owner] = await tx.select({ status: appUsers.status }).from(appUsers)
        .where(eq(appUsers.id, ownerId)).for('update');
      if (owner?.status !== 'active') throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      const catalog = await listCategories(ownerId, tx);
      const existing = catalog.find(category => category.id === input.id || category.name.toLowerCase() === input.name.toLowerCase());
      if (existing) {
        if (existing.id === input.id && !existing.isDefault && existing.name === input.name && existing.icon === input.icon) {
          return existing;
        }
        throw new ExpenseError(409, 'CATEGORY_EXISTS', 'A category with this name already exists. Choose another name.');
      }
      const [category] = await tx.insert(categories).values({ ...input, ownerId }).onConflictDoNothing().returning(categoryFields);
      if (!category) throw new ExpenseError(409, 'CATEGORY_EXISTS', 'This category could not be created. Choose another name.');
      return category;
    });
  }
  async function updateCategory(ownerId: string, input: EditCategory) {
    return db.transaction(async tx => {
      const [owner] = await tx.select({ status: appUsers.status }).from(appUsers)
        .where(eq(appUsers.id, ownerId)).for('update');
      if (owner?.status !== 'active') throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      const catalog = await listCategories(ownerId, tx);
      const existing = catalog.find(category => category.id === input.id);
      if (!existing) throw new ExpenseError(404, 'CATEGORY_NOT_FOUND', 'This category is no longer available.');
      // An identical retry succeeds even if the first response was lost.
      if (existing.name === input.name && existing.icon === input.icon) return existing;
      if (existing.name !== input.previousName || existing.icon !== input.previousIcon) {
        throw new ExpenseError(409, 'CATEGORY_CHANGED', 'This category changed elsewhere. Reopen it before editing again.');
      }
      if (input.name.length > maxCategoryNameLength && input.name !== existing.name) {
        throw new ExpenseError(400, 'INVALID_CATEGORY', 'Enter a category name of 1–12 characters.');
      }
      if (catalog.some(category => category.id !== input.id && category.name.toLowerCase() === input.name.toLowerCase())) {
        throw new ExpenseError(409, 'CATEGORY_EXISTS', 'A category with this name already exists. Choose another name.');
      }
      if (existing.isDefault) {
        await tx.insert(categoryPreferences).values({ ownerId, categoryId: input.id, name: input.name, icon: input.icon })
          .onConflictDoUpdate({ target: [categoryPreferences.ownerId, categoryPreferences.categoryId],
            set: { name: input.name, icon: input.icon } });
      } else {
        await tx.update(categories).set({ name: input.name, icon: input.icon })
          .where(and(eq(categories.id, input.id), eq(categories.ownerId, ownerId)));
      }
      return { id: input.id, name: input.name, icon: input.icon, isDefault: existing.isDefault };
    });
  }
  async function accountFor(clerkUserId: string) {
    const [account] = await db.select({ id: appUsers.id, status: appUsers.status }).from(appUsers)
      .where(eq(appUsers.clerkUserId, clerkUserId));
    if (account && account.status !== 'active') {
      throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
    }
    return account?.id;
  }

  async function provision(profile: Profile) {
    // Drizzle's insert builder names defaulted columns too. Keep this write limited to profile fields.
    await db.execute(sql`insert into ${appUsers} (clerk_user_id, name, email)
      values (${profile.clerkUserId}, ${profile.name ?? null}, ${profile.email}) on conflict (clerk_user_id) do nothing`);
    const ownerId = await accountFor(profile.clerkUserId);
    if (!ownerId) throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
    return ownerId;
  }

  async function create(ownerId: string, operation: CreateOperation) {
    const input = operation.expense;
    const normalized = {
      id: input.id,
      title: input.title,
      note: input.note || null,
      amountPaise: input.amountPaise,
      categoryId: input.categoryId,
      expenseDate: input.expenseDate ?? null,
    };
    const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');

    return db.transaction(async tx => {
      // Serialize writes for this owner so receipts and sync revisions follow commit order.
      const [owner] = await tx.select({ status: appUsers.status, revision: appUsers.syncRevision }).from(appUsers)
        .where(eq(appUsers.id, ownerId)).for('update');
      if (owner?.status !== 'active') {
        throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      }

      const [receipt] = await tx.select({ hash: mutationReceipts.requestHash, result: mutationReceipts.result })
        .from(mutationReceipts).where(and(eq(mutationReceipts.ownerId, ownerId),
          eq(mutationReceipts.mutationId, operation.mutationId)));
      if (receipt) {
        if (receipt.hash !== hash) throw new ExpenseError(409, 'MUTATION_CONFLICT', 'This save ID was already used.');
        return expenseSchema.parse(receipt.result);
      }

      const [category] = await tx.select({ id: categories.id }).from(categories).where(and(
        eq(categories.id, normalized.categoryId), or(isNull(categories.ownerId), eq(categories.ownerId, ownerId)),
      ));
      if (!category) throw new ExpenseError(400, 'INVALID_CATEGORY', 'Choose one of your available categories.');

      const today = accountToday();
      const expenseDate = normalized.expenseDate ?? today;
      if (expenseDate > today) throw new ExpenseError(400, 'FUTURE_DATE', 'Choose today or an earlier date.');

      const [record] = await tx.insert(expenses).values({ ...normalized, ownerId, expenseDate })
        .onConflictDoNothing({ target: expenses.id }).returning(expenseFields);
      if (!record) throw new ExpenseError(409, 'EXPENSE_CONFLICT', 'This expense ID was already used.');

      const result = expenseSchema.parse(record);
      const revision = owner.revision + 1n;
      await tx.update(appUsers).set({ syncRevision: revision }).where(eq(appUsers.id, ownerId));
      await tx.insert(syncChanges).values({ ownerId, revision, entityType: 'expense', entityId: result.id, version: result.version });
      await tx.insert(mutationReceipts).values({ ownerId, mutationId: operation.mutationId, requestHash: hash, result });
      return result;
    });
  }

  async function update(ownerId: string, operation: UpdateOperation) {
    const { id, version, ...changes } = operation.expense;
    const hash = createHash('sha256').update(JSON.stringify({ operation: 'update', id, version, ...changes })).digest('hex');
    return db.transaction(async tx => {
      const [owner] = await tx.select({ status: appUsers.status, revision: appUsers.syncRevision }).from(appUsers)
        .where(eq(appUsers.id, ownerId)).for('update');
      if (owner?.status !== 'active') throw new ExpenseError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      const [receipt] = await tx.select({ hash: mutationReceipts.requestHash, result: mutationReceipts.result })
        .from(mutationReceipts).where(and(eq(mutationReceipts.ownerId, ownerId), eq(mutationReceipts.mutationId, operation.mutationId)));
      if (receipt) {
        if (receipt.hash !== hash) throw new ExpenseError(409, 'MUTATION_CONFLICT', 'This save ID was already used.');
        return expenseSchema.parse(receipt.result);
      }
      const condition = and(eq(expenses.ownerId, ownerId), eq(expenses.id, id), isNull(expenses.deletedAt));
      const [existing] = await tx.select({ version: expenses.version }).from(expenses).where(condition).for('update');
      if (!existing) throw new ExpenseError(404, 'EXPENSE_NOT_FOUND', 'Transaction not found.');
      if (existing.version !== version) throw new ExpenseError(409, 'VERSION_CONFLICT', 'This transaction changed. Reopen it before editing again.');
      const [category] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, changes.categoryId),
        or(isNull(categories.ownerId), eq(categories.ownerId, ownerId))));
      if (!category) throw new ExpenseError(400, 'INVALID_CATEGORY', 'Choose one of your available categories.');
      if (changes.expenseDate > accountToday()) throw new ExpenseError(400, 'FUTURE_DATE', 'Choose today or an earlier date.');
      const [record] = await tx.update(expenses).set({ ...changes, version: version + 1, updatedAt: new Date() })
        .where(and(condition, eq(expenses.version, version))).returning(expenseFields);
      if (!record) throw new ExpenseError(409, 'VERSION_CONFLICT', 'This transaction changed. Reopen it before editing again.');
      const result = expenseSchema.parse(record);
      const revision = owner.revision + 1n;
      await tx.update(appUsers).set({ syncRevision: revision }).where(eq(appUsers.id, ownerId));
      await tx.insert(syncChanges).values({ ownerId, revision, entityType: 'expense', entityId: id, version: result.version });
      await tx.insert(mutationReceipts).values({ ownerId, mutationId: operation.mutationId, requestHash: hash, result });
      return result;
    });
  }

  async function list(ownerId: string, query: HistoryQuery, cursor?: ExpenseCursor) {
    return db.select({ ...expenseFields, categoryName: displayName, categoryIcon: displayIcon,
      // Preserve Postgres microseconds so a pagination cursor never rounds past a row.
      createdAt: sql<string>`to_char(${expenses.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    }).from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(categoryPreferences, preferenceJoin(ownerId))
      .where(and(
        eq(expenses.ownerId, ownerId),
        isNull(expenses.deletedAt),
        query.start ? gte(expenses.expenseDate, query.start) : undefined,
        query.end ? lt(expenses.expenseDate, query.end) : undefined,
        query.categoryId ? eq(expenses.categoryId, query.categoryId) : undefined,
        cursor ? sql`(${expenses.expenseDate}, ${expenses.createdAt}, ${expenses.id}) <
          (${cursor.date}::date, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : undefined,
      ))
      .orderBy(sql`${expenses.expenseDate} desc nulls last`, sql`${expenses.createdAt} desc`, sql`${expenses.id} desc nulls last`)
      .limit(query.limit + 1);
  }

  async function get(ownerId: string, id: string) {
    const [record] = await db.select(expenseFields).from(expenses)
      .where(and(eq(expenses.ownerId, ownerId), eq(expenses.id, id), isNull(expenses.deletedAt)));
    return record;
  }

  function categoryTotalsForRange(ownerId: string, start: string, end: string) {
    return db.select({
      categoryId: expenses.categoryId,
      amountPaise: sql<string>`sum(${expenses.amountPaise})::text`,
    }).from(expenses).where(and(eq(expenses.ownerId, ownerId), isNull(expenses.deletedAt),
      gte(expenses.expenseDate, start), lt(expenses.expenseDate, end))).groupBy(expenses.categoryId)
      .orderBy(sql`max(${expenses.createdAt}) desc`, expenses.categoryId);
  }

  async function totalsForDates(ownerId: string, dates: readonly string[], categoryId?: CategoryId) {
    if (!dates.length) return [];
    return db.select({ date: expenses.expenseDate, totalPaise: sql<string>`sum(${expenses.amountPaise})::text` })
      .from(expenses).where(and(eq(expenses.ownerId, ownerId), isNull(expenses.deletedAt),
        inArray(expenses.expenseDate, [...dates]), categoryId ? eq(expenses.categoryId, categoryId) : undefined))
      .groupBy(expenses.expenseDate).orderBy(sql`${expenses.expenseDate} desc`);
  }

  return { accountFor, provision, create, update, list, get, categoryTotalsForRange, totalsForDates, listCategories, createCategory, updateCategory };
}
