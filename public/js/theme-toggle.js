/* part of the ronin-cowork client — see js/README.md */
/** The compact, device-local light/dark choice shared by root and Setup headers. */
export function createThemeToggle() {
  const toggle = document.createElement('button');
  toggle.className = 'bar-toggle setup-theme-toggle';
  toggle.type = 'button';

  const paint = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    toggle.textContent = dark ? '☀' : '◐';
    toggle.title = dark ? 'Use light appearance' : 'Use dark appearance';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(dark));
  };
  toggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    // Ronin Home is also imported by the server-side shell contract. Keep the
    // browser-only theme module behind the owner's click instead of requiring a
    // window merely to describe the Home route.
    void import('./theme.js').then(({ setTheme }) => {
      setTheme(dark ? 'light' : 'dark');
      paint();
    });
  });
  paint();
  return toggle;
}
