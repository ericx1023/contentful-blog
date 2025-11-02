import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Resolve theme based on current setting
  const resolveTheme = (currentTheme: Theme): ResolvedTheme => {
    if (currentTheme === 'system') {
      return getSystemTheme();
    }
    return currentTheme;
  };

  // Apply theme to document
  const applyTheme = (resolvedTheme: ResolvedTheme) => {
    if (typeof window !== 'undefined' && mounted) {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    }
  };

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  };

  // Toggle between light and dark (skip system)
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Initialize theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Get stored theme or default to dark
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      const initialTheme = storedTheme || 'dark';

      setThemeState(initialTheme);
      const resolved = resolveTheme(initialTheme);
      setResolvedTheme(resolved);
      setMounted(true);

      // Apply theme after mounted to prevent hydration issues
      requestAnimationFrame(() => {
        applyTheme(resolved);
      });
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = () => {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Prevent hydration mismatch - render children but with default values
  if (!mounted) {
    const defaultValue: ThemeContextType = {
      theme: 'dark',
      resolvedTheme: 'dark',
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      setTheme: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      toggleTheme: () => {},
    };
    return <ThemeContext.Provider value={defaultValue}>{children}</ThemeContext.Provider>;
  }

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Provide default values during SSR or if provider is missing
    return {
      theme: 'dark',
      resolvedTheme: 'dark',
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      setTheme: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      toggleTheme: () => {},
    };
  }
  return context;
}
