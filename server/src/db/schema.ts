import { sql } from 'drizzle-orm';
import {
  bigint, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { maxExpensePaise, maxExpenseTextLength, type CategoryId, type Expense } from '../../../src/domain/expenses.js';

const timestampUtc = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const accountStatus = pgEnum('account_status', ['active', 'deletion_pending', 'deleted']);

export const appUsers = pgTable('app_users', {
  id: uuid().primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  name: text(),
  email: text().notNull(),
  status: accountStatus().notNull().default('active'),
  syncRevision: bigint('sync_revision', { mode: 'bigint' }).notNull().default(0n),
  createdAt: timestampUtc('created_at'),
  updatedAt: timestampUtc('updated_at'),
});

export const categories = pgTable('categories', {
  id: text().$type<CategoryId>().primaryKey(),
  name: text().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').$type<CategoryId>().notNull().default('other').references(() => categories.id),
  title: text(),
  amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
  expenseDate: date('expense_date', { mode: 'string' }).notNull(),
  note: text(),
  version: integer().notNull().default(1),
  createdAt: timestampUtc('created_at'),
  updatedAt: timestampUtc('updated_at'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, table => [
  check('expenses_amount_range', sql`${table.amountPaise} between 1 and ${sql.raw(String(maxExpensePaise))}`),
  check('expenses_note_length', sql`char_length(${table.note}) between 1 and ${sql.raw(String(maxExpenseTextLength))}`),
  check('expenses_title_length', sql`char_length(btrim(${table.title})) between 1 and ${sql.raw(String(maxExpenseTextLength))}`),
  check('expenses_positive_version', sql`${table.version} >= 1`),
  index('expenses_owner_idx').on(table.ownerId),
  index('expenses_active_history_idx').on(table.ownerId, table.expenseDate.desc(), table.id.desc())
    .where(sql`${table.deletedAt} is null`),
  index('expenses_active_category_history_idx').on(table.ownerId, table.categoryId, table.expenseDate.desc(), table.id.desc())
    .where(sql`${table.deletedAt} is null`),
]);

export const mutationReceipts = pgTable('mutation_receipts', {
  ownerId: uuid('owner_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  mutationId: uuid('mutation_id').notNull(),
  requestHash: text('request_hash').notNull(),
  result: jsonb().$type<Expense>().notNull(),
  createdAt: timestampUtc('created_at'),
}, table => [primaryKey({ columns: [table.ownerId, table.mutationId] })]);

export const syncChanges = pgTable('sync_changes', {
  ownerId: uuid('owner_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  revision: bigint({ mode: 'bigint' }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  version: integer().notNull(),
  deleted: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestampUtc('created_at'),
}, table => [primaryKey({ columns: [table.ownerId, table.revision] })]);
