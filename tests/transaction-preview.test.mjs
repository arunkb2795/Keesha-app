import assert from 'node:assert/strict';
import test from 'node:test';
import { previewCategoryTotals } from '../src/domain/expenses.ts';

const original = { categoryId: 'food', amountPaise: 35000, expenseDate: '2026-11-18' };
test('editing an amount replaces the original contribution in the category total', () => {
  const totals = new Map([['food', '70000']]);
  const preview = previewCategoryTotals(totals, '2026-11-01', original, { ...original, amountPaise: 66600 });
  assert.equal(preview.get('food'), '101600');
  assert.equal(totals.get('food'), '70000', 'draft edits leave saved totals unchanged');
});
test('changing category moves the draft amount and keeps unrelated totals', () => {
  const totals = new Map([['food', '70000'], ['travel', '0'], ['bills', '12345']]);
  assert.deepEqual(previewCategoryTotals(totals, '2026-11-01', original,
    { ...original, categoryId: 'travel', amountPaise: 66600 }),
  new Map([['food', '35000'], ['travel', '66600'], ['bills', '12345']]));
});
test('moving to another month adds the draft without subtracting an expense outside that month', () => {
  assert.equal(previewCategoryTotals(new Map([['food', '100']]), '2026-10-01', original,
    { ...original, expenseDate: '2026-10-18', amountPaise: 123 }).get('food'), '223');
});
test('invalid amounts leave totals unchanged and decimal amounts remain exact', () => {
  const totals = new Map([['food', '35001']]);
  assert.deepEqual(previewCategoryTotals(totals, '2026-11-01', original, { ...original, amountPaise: null }), totals);
  assert.equal(previewCategoryTotals(totals, '2026-11-01', original, { ...original, amountPaise: 10 }).get('food'), '11');
});
