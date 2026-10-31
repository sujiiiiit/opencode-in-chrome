// Which theme the extension UI uses:
//   'light'  - always light (current default)
//   'dark'   - always dark
//   'system' - follow the OS setting
// The shadcn dark tokens in assets/styles/global.css stay in place for 'dark' / 'system'.
const THEME: 'light' | 'dark' | 'system' = 'light';

// shadcn themes with a `.dark` class on <html>.
export function syncDarkClass() {
  const root = document.documentElement;

  if (THEME === 'light') {
    root.classList.remove('dark');
    return;
  }
  if (THEME === 'dark') {
    root.classList.add('dark');
    return;
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => root.classList.toggle('dark', query.matches);
  query.addEventListener('change', apply);
  apply();
}
