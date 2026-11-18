import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { connectDatabase } from '../db/client.js';
import { migrationDatabaseUrl } from '../env.js';
import { expenseStore } from '../db/expenses.js';
import { appUsers, expenses, mutationReceipts, syncChanges } from '../db/schema.js';
import type { CreateOperation } from '../validation.js';

async function main() {
  // Use the runtime role for application writes; the owner connection only provisions/cleans fixtures.
  const runtime = connectDatabase();
  const { db, close } = connectDatabase(migrationDatabaseUrl());
  const store = expenseStore(db);
  const runtimeStore = expenseStore(runtime.db);
  const suffix = randomUUID();
  const ownerClerkId = 'smoke_' + suffix;
  const otherClerkId = 'smoke_other_' + suffix;
  try {
    const ownerId = await store.provision({
      clerkUserId: ownerClerkId, name: 'Expense smoke test', email: suffix + '@example.test',
    });
    const otherOwnerId = await store.provision({
      clerkUserId: otherClerkId, name: null, email: 'other-' + suffix + '@example.test',
    });
    const operation: CreateOperation = {
      operation: 'create',
      mutationId: randomUUID(),
      expense: { id: randomUUID(), categoryId: 'food', amountPaise: 1234, title: 'Synthetic lunch' },
    };
    const id = operation.expense.id;

    // A revision collision forces the sync event insert to fail after the expense write.
    await db.insert(syncChanges).values({ ownerId, revision: 1n, entityType: 'expense', entityId: id, version: 1 });
    await assert.rejects(store.create(ownerId, operation));
    assert.equal(await store.get(ownerId, id), undefined);
    assert.deepEqual(await db.select().from(mutationReceipts).where(eq(mutationReceipts.ownerId, ownerId)), []);
    const [owner] = await db.select({ revision: appUsers.syncRevision }).from(appUsers).where(eq(appUsers.id, ownerId));
    assert.equal(owner.revision, 0n);
    await db.delete(syncChanges).where(eq(syncChanges.ownerId, ownerId));

    const [saved, replay] = await Promise.all([store.create(ownerId, operation), store.create(ownerId, operation)]);
    assert.deepEqual(saved, replay);
    assert.equal(saved.id, id);
    assert.equal(saved.amountPaise, 1234);
    assert.deepEqual(await store.get(ownerId, id), saved);
    assert.equal(await store.get(otherOwnerId, id), undefined);
    const [event] = await db.select().from(syncChanges).where(eq(syncChanges.ownerId, ownerId));
    assert.equal(event.revision, 1n);
    assert.equal(event.entityId, id);

    // Exercise the same update path as the editor against the real driver.
    const update = { operation: 'update' as const, mutationId: randomUUID(), expense: {
      id, version: saved.version, title: 'Updated synthetic lunch', amountPaise: 2345,
      categoryId: 'medical', expenseDate: saved.expenseDate,
    } };
    const edited = await runtimeStore.update(ownerId, update);
    assert.equal(edited.version, 2);
    assert.equal(edited.amountPaise, 2345);
    assert.deepEqual(await runtimeStore.update(ownerId, update), edited);
    assert.deepEqual(await store.get(ownerId, id), edited);
    const beforeCategory = (await runtimeStore.listCategories(ownerId)).find(category => category.id === 'food')!;
    const categoryEdit = { id: 'food', name: 'Smoke dining', icon: 'coffee' as const,
      previousName: beforeCategory.name, previousIcon: beforeCategory.icon };
    const personalized = await runtimeStore.updateCategory(ownerId, categoryEdit);
    assert.equal(personalized.name, 'Smoke dining');
    assert.deepEqual(await runtimeStore.updateCategory(ownerId, categoryEdit), personalized);
    assert.equal((await runtimeStore.listCategories(otherOwnerId)).find(category => category.id === 'food')?.name, beforeCategory.name);
    const custom = await runtimeStore.createCategory(ownerId, { id: randomUUID(), name: 'Smoke custom', icon: 'work' });
    assert.equal((await runtimeStore.updateCategory(ownerId, { id: custom.id, name: 'Smoke edited', icon: 'gift',
      previousName: custom.name, previousIcon: custom.icon })).name, 'Smoke edited');
    // Verify soft deletes on the synthetic row.
    const ownedExpense = and(eq(expenses.ownerId, ownerId), eq(expenses.id, id));
    await db.update(expenses).set({ deletedAt: new Date(), version: 3, updatedAt: new Date() }).where(ownedExpense);
    assert.equal(await store.get(ownerId, id), undefined);
  } finally {
    try {
      await db.delete(appUsers).where(eq(appUsers.clerkUserId, ownerClerkId));
      await db.delete(appUsers).where(eq(appUsers.clerkUserId, otherClerkId));
    } finally {
      await Promise.all([close(), runtime.close()]);
    }
  }
  console.log('Neon smoke passed: expense and category edits, personalized defaults, owner isolation, replay, rollback, and fixture cleanup.');
}

main().catch(error => {
  // Log diagnostic identifiers without SQL parameters or connection strings.
  for (let cause = error; cause; cause = cause.cause) {
    console.error(JSON.stringify({ name: cause.name, code: cause.code, column: cause.column, constraint: cause.constraint,
      message: cause.code === '42501' ? cause.message : undefined }));
  }
  console.error('Neon expense smoke failed. Check the database configuration, migrations, and connectivity.');
  process.exitCode = 1;
});
