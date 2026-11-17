import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { connectDatabase } from '../db/client.js';
import { expenseStore } from '../db/expenses.js';
import { appUsers, expenses, mutationReceipts, syncChanges } from '../db/schema.js';
import type { CreateOperation } from '../validation.js';

async function main() {
  const { db, close } = connectDatabase();
  const store = expenseStore(db);
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

    // Verify storage of version updates and soft deletes on the synthetic row.
    const ownedExpense = and(eq(expenses.ownerId, ownerId), eq(expenses.id, id));
    await db.update(expenses).set({ title: 'Updated synthetic lunch', version: 2, updatedAt: new Date() }).where(ownedExpense);
    assert.equal((await store.get(ownerId, id))?.version, 2);
    await db.update(expenses).set({ deletedAt: new Date(), version: 3, updatedAt: new Date() }).where(ownedExpense);
    assert.equal(await store.get(ownerId, id), undefined);
  } finally {
    try {
      await db.delete(appUsers).where(eq(appUsers.clerkUserId, ownerClerkId));
      await db.delete(appUsers).where(eq(appUsers.clerkUserId, otherClerkId));
    } finally {
      await close();
    }
  }
  console.log('Neon smoke passed: create, read, update, delete, owner isolation, concurrent replay, rollback, and fixture cleanup.');
}

main().catch(() => {
  console.error('Neon expense smoke failed. Check the database configuration, migrations, and connectivity.');
  process.exitCode = 1;
});
