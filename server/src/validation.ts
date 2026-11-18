import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';
import { categoryIconIds, categoryIds, maxCategoryNameLength, maxExpensePaise, maxExpenseTextLength } from '../../src/domain/expenses.js';
import { appUsers, categories, expenses } from './db/schema.js';

const displayText = z.string().trim().min(1).max(maxExpenseTextLength).refine(value => !value.includes('\0'));
const amountPaise = z.number().int().min(1).max(maxExpensePaise);
export const uuid = z.uuid().transform(value => value.toLowerCase());
const categoryId = z.union([z.enum(categoryIds), uuid]);
export const newCategorySchema = z.strictObject({
  id: uuid,
  name: z.string().trim().min(1).max(maxCategoryNameLength).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  icon: z.enum(categoryIconIds),
});
const expenseFields = {
  id: uuid,
  amountPaise,
  categoryId,
  expenseDate: z.iso.date(),
  title: displayText,
  note: displayText,
};

export const profileSchema = createInsertSchema(appUsers, {
  clerkUserId: z.string().min(1),
  name: displayText.nullable(),
  email: z.email(),
}).pick({ clerkUserId: true, name: true, email: true }).strict();

export const categorySchema = createSelectSchema(categories, { id: categoryId, name: displayText, icon: z.enum(categoryIconIds) });

export const expenseSchema = createSelectSchema(expenses, {
  ...expenseFields,
  title: displayText.nullable(),
  note: displayText.nullable(),
  version: z.number().int().positive(),
}).pick({ id: true, amountPaise: true, categoryId: true, expenseDate: true, title: true, note: true, version: true }).strict();

const insert = createInsertSchema(expenses, expenseFields)
  .pick({ id: true, amountPaise: true, categoryId: true, expenseDate: true, title: true, note: true });
const create = insert.extend({
  categoryId: categoryId.default('other'),
  title: displayText,
  note: z.string().trim().max(maxExpenseTextLength).refine(value => !value.includes('\0')).optional(),
  expenseDate: z.iso.date().optional(),
}).strict();

export const createBatchSchema = z.strictObject({
  operations: z.array(z.strictObject({
    mutationId: uuid,
    operation: z.literal('create'),
    expense: create,
  })).min(1).max(50),
});

export const historyQuerySchema = z.strictObject({
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  categoryId: categoryId.optional(),
  cursor: z.string().min(1).max(512).optional(),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(30),
}).refine(({ start, end }) => !start || !end || start < end);

export const cursorPayloadSchema = z.strictObject({ date: z.iso.date(), createdAt: z.iso.datetime({ precision: 6 }), id: uuid });
export const calendarDateSchema = z.iso.date().refine(value => value >= '0001-01-01');
export type CreateOperation = z.output<typeof createBatchSchema>['operations'][number];
export type HistoryQuery = z.output<typeof historyQuerySchema>;
export type ExpenseCursor = z.output<typeof cursorPayloadSchema>;
export type Profile = z.output<typeof profileSchema>;
export type NewCategory = z.output<typeof newCategorySchema>;
