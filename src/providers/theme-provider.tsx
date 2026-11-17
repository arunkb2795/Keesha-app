import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useEffect, useRef, useState } from 'react';

import { Colors, type AppearancePreference, type ColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STORAGE_KEY = 'keesha.appearance';

type ThemeContextValue = {
  colors: (typeof Colors)[ColorScheme];
  colorScheme: ColorScheme;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, updatePreference] = useState<AppearancePreference>('system');
  const userHasSelected = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && !userHasSelected.current &&
            (stored === 'system' || stored === 'light' || stored === 'dark')) {
          updatePreference(stored);
        }
      })
      .catch(() => {
        // Storage is optional: the device theme remains a usable default.
      });
    return () => { active = false; };
  }, []);

  function setPreference(next: AppearancePreference) {
    userHasSelected.current = true;
    updatePreference(next);
    // Preserve the order of rapid selections without delaying the UI.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, next))
      .catch(() => {});
  }

  const colorScheme = preference === 'system' ? systemScheme ?? 'light' : preference;

  return (
    <ThemeContext.Provider value={{ colors: Colors[colorScheme], colorScheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
