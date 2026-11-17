import { createContext, useContext } from 'react';
import { type CategoryId } from '@/domain/expenses';

export const ExpenseActionsContext = createContext<{
  openExpense: (category?: CategoryId, amountPaise?: string) => void;
  expenseRevision: number;
} | null>(null);

export function useExpenseActions() {
  const actions = useContext(ExpenseActionsContext);
  if (!actions) throw new Error('Expense actions require the dashboard layout.');
  return actions;
}
