(function () {
    const themes = ['system', 'light', 'dark'];
    const validThemes = new Set(themes);
    const queryTheme = new URLSearchParams(window.location.search).get('theme');
    const storedTheme = localStorage.getItem('theme');
    let preference = validThemes.has(queryTheme)
        ? queryTheme
        : (validThemes.has(storedTheme) ? storedTheme : 'system');
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
        const isDark = preference === 'dark'
            || (preference === 'system' && colorScheme.matches);
        const wasDark = document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        if (wasDark !== isDark) {
            window.dispatchEvent(new Event('pjshow:themechange'));
        }
    }

    function updateControls() {
        const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
        const labels = isChinese
            ? { system: '系统', light: '亮色', dark: '暗色' }
            : { system: 'System', light: 'Light', dark: 'Dark' };
        const icons = { system: 'fa-adjust', light: 'fa-sun-o', dark: 'fa-moon-o' };
        const description = isChinese ? '点击切换主题' : 'Click to change theme';

        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            const label = labels[preference];
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = `fa ${icons[preference]}${icon.classList.contains('mr-2') ? ' mr-2' : ''}`;
            }
            const visibleLabel = button.querySelector('[data-theme-label]');
            if (visibleLabel) visibleLabel.textContent = label;
            button.title = `${isChinese ? '主题' : 'Theme'}: ${label} (${description})`;
            button.setAttribute('aria-label', button.title);
        });
    }

    function setPreference(next) {
        preference = next;
        localStorage.setItem('theme', preference);
        applyTheme();
        updateControls();
    }

    applyTheme();
    if (queryTheme && validThemes.has(queryTheme)) {
        localStorage.setItem('theme', queryTheme);
    }

    colorScheme.addEventListener('change', () => {
        if (preference === 'system') applyTheme();
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.addEventListener('click', () => {
                const nextIndex = (themes.indexOf(preference) + 1) % themes.length;
                setPreference(themes[nextIndex]);
            });
        });
        updateControls();
    });
})();
