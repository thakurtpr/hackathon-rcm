'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by waiting until mounted
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-2.5 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 opacity-50" />
    );
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="relative p-2.5 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center overflow-hidden"
      aria-label="Toggle theme"
    >
      <Sun className={`h-5 w-5 transition-all duration-500 transform ${resolvedTheme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`} />
      <Moon className={`absolute h-5 w-5 transition-all duration-500 transform ${resolvedTheme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'}`} />
    </button>
  );
}
