import assert from 'node:assert/strict';
import test from 'node:test';

test('expense dates load and format without Intl.PluralRules', async () => {
  const pluralRules = Intl.PluralRules;
  Intl.PluralRules = undefined;
  try {
    const { formatExpenseDate } = await import('../src/domain/expenses.ts');
    for (const day of [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31]) {
      const expected = new pluralRules('en-US', { type: 'ordinal' }).select(day);
      const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th' }[expected];
      assert.equal(formatExpenseDate(new Date(2026, 9, day)), `October ${day}${suffix}, 2026`);
    }
  } finally {
    Intl.PluralRules = pluralRules;
  }
});

test('rupee amounts render exactly when Intl rejects BigInt', async () => {
  const prototype = Intl.NumberFormat.prototype;
  const format = Object.getOwnPropertyDescriptor(prototype, 'format');
  Object.defineProperty(prototype, 'format', {
    get() {
      const original = format.get.call(this);
      return value => {
        if (typeof value === 'bigint') throw new TypeError('BigInt formatting is unavailable');
        return original(value);
      };
    },
  });
  try {
    const { formatPaise, compareMonthlySpend } = await import('../src/domain/expenses.ts');
    assert.equal(formatPaise('0'), '₹0.00');
    assert.equal(formatPaise(1234), '₹12.34');
    assert.equal(formatPaise('900719925474099301'), '₹9,00,71,99,25,47,40,993.01');
    assert.deepEqual(compareMonthlySpend('375', '500'), { label: '25% below last month', above: false });
  } finally {
    Object.defineProperty(prototype, 'format', format);
  }
});
