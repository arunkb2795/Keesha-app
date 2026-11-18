import { createContext } from 'react';

import type { ExpenseCategory, NewCategory, EditCategory } from '@/domain/expenses';

// Keep the context outside the refreshable provider module so its identity remains stable.
export const CategoriesContext = createContext<{
  categories: ExpenseCategory[]; loading: boolean; error?: string;
  reload: () => void; create: (input: NewCategory) => Promise<ExpenseCategory>;
  update: (input: EditCategory) => Promise<ExpenseCategory>;
} | null>(null);
