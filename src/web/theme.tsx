import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'ergocheck-theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Light/dark switch. Follows the OS until the user picks; the choice is remembered per browser. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => {
    // Track OS changes only while the user hasn't chosen explicitly.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!stored()) setTheme(systemTheme());
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only.
    }
    setTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
