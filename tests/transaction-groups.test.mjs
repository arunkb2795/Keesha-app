import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPaise, groupTransactionsByDate } from '../src/domain/expenses.ts';

test('transaction groups use individual dates and exact daily totals', () => {
  const rows = [
    { id: 'a', expenseDate: '2026-11-18', amountPaise: 50000 },
    { id: 'b', expenseDate: '2026-11-18', amountPaise: 25044 },
    { id: 'c', expenseDate: '2026-11-17', amountPaise: 100 },
    { id: 'd', expenseDate: '2026-11-16', amountPaise: 325 },
    { id: 'e', expenseDate: '2026-11-15', amountPaise: 400 },
    { id: 'f', expenseDate: '2025-12-31', amountPaise: 500 },
  ];
  const groups = groupTransactionsByDate(rows, '2026-11-18');
  assert.deepEqual(groups.map(({ key, label, totalPaise }) => ({ key, label, totalPaise })), [
    { key: '2026-11-18', label: 'Today', totalPaise: '75044' },
    { key: '2026-11-17', label: 'Yesterday', totalPaise: '100' },
    { key: '2026-11-16', label: 'Nov 16', totalPaise: '325' },
    { key: '2026-11-15', label: 'Nov 15', totalPaise: '400' },
    { key: '2025-12-31', label: 'Dec 31, 2025', totalPaise: '500' },
  ]);
  assert.deepEqual(groups[0].expenses.map(item => item.id), ['a', 'b']);
  assert.equal(formatPaise(groups[0].totalPaise), '₹750.44');
});

test('empty transactions produce no date headers', () => {
  assert.deepEqual(groupTransactionsByDate([], '2026-11-18'), []);
});

test('date totals add integer paise without floating-point rounding', () => {
  const groups = groupTransactionsByDate([
    { expenseDate: '2026-11-18', amountPaise: 10 },
    { expenseDate: '2026-11-18', amountPaise: 20 },
  ], '2026-11-18');
  assert.equal(formatPaise(groups[0].totalPaise), '₹0.30');
});
