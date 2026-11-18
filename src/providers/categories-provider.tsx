import { useAuth } from '@clerk/expo';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { defaultCategories, type ExpenseCategory, type NewCategory } from '@/domain/expenses';
import { createCategory, ExpenseApiError, listCategories } from '@/lib/expenses-api';

const CategoriesContext = createContext<{
  categories: ExpenseCategory[]; loading: boolean; error?: string;
  reload: () => void; create: (input: NewCategory) => Promise<ExpenseCategory>;
} | null>(null);

export function CategoriesProvider({ children }: PropsWithChildren) {
  const { getToken } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listCategories(getToken, controller.signal).then(catalog => {
      if (controller.signal.aborted) return;
      const defaults = defaultCategories.flatMap(category => catalog.filter(item => item.id === category.id));
      setCategories([...defaults, ...catalog.filter(category => !category.isDefault)]);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof ExpenseApiError ? failure.message : 'Couldn’t load your categories. Try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [getToken, revision]);

  const create = useCallback(async (input: NewCategory) => {
    const category = await createCategory(getToken, input);
    setCategories(previous => [...previous.filter(item => item.id !== category.id), category]);
    return category;
  }, [getToken]);

  return <CategoriesContext.Provider value={{ categories, loading, error,
    reload: () => { setLoading(true); setError(undefined); setRevision(value => value + 1); }, create }}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) throw new Error('Category components require CategoriesProvider.');
  return context;
}
