'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type AdminTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'nexuva-admin-theme';
const DEFAULT_THEME: AdminTheme = 'light';

interface ThemeContextValue {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
});

export function useAdminTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme preference for the panel itself, kept per browser in localStorage.
 *
 * Deliberately not stored server-side: it is a personal display setting, not
 * site content, and keeping it local means switching is instant and needs no
 * round trip. The public site's own light/dark setting is separate and lives in
 * the CMS under Marka & Tema.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AdminTheme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * Applies the saved theme before first paint. Without this the page renders
 * with the default and then snaps to the stored preference — a visible flash on
 * every navigation for anyone using dark mode.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
