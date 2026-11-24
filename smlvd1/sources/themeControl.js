const themeToggle = document.querySelector('.theme-toggle');
const themeLabel = document.createElement('span');
themeLabel.className = 'theme-label';
themeToggle.replaceChildren(themeLabel);
const savedTheme = localStorage.getItem('sm-lvd-theme');
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themes = ['system', 'light', 'dark'];
let selectedTheme = themes.includes(savedTheme) ? savedTheme : 'system';

function setTheme(theme) {
    selectedTheme = theme;
    const resolvedTheme = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
    const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];

    document.documentElement.dataset.theme = resolvedTheme;
    themeToggle.setAttribute('aria-pressed', String(resolvedTheme === 'dark'));
    themeToggle.setAttribute(
        'aria-label',
        `Theme: ${theme}. Activate to use ${nextTheme} theme.`
    );
    themeToggle.dataset.themeIcon = theme === 'system' ? '🖥️' : (theme === 'dark' ? '🌙' : '☀️');
    themeLabel.textContent = {
        system: '🖥️ System theme',
        light: '☀️ Light theme',
        dark: '🌙 Dark theme'
    }[theme];
}

setTheme(selectedTheme);

themeToggle.addEventListener('click', () => {
    const nextTheme = themes[(themes.indexOf(selectedTheme) + 1) % themes.length];
    localStorage.setItem('sm-lvd-theme', nextTheme);
    setTheme(nextTheme);
});

mediaQuery.addEventListener('change', () => {
    if (selectedTheme === 'system') {
        setTheme('system');
    }
});
