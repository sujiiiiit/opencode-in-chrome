// shadcn themes with a `.dark` class on <html>, so mirror the system setting.
export function syncDarkClass() {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', query.matches);
  query.addEventListener('change', apply);
  apply();
}
