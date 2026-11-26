// ==================== i18n 配置 ====================
const i18n = {
    en: {
        navHome: "Home",
        navRank: "Ranking",
        title: "24 Point Solver",
        subtitle: "Enter four numbers (1–13) to find all ways to make 24.",
        solveBtn: "Solve",
        footer: "Data: 1820 combinations, 114573 solutions",
        loading: "Loading 1820 combinations...",
        loaded: "Loaded {count} entries.",
        loadFail: "Failed to load data: {error}",
        invalidInput: "Please enter numbers between 1 and 13",
        noData: "No data for key: {key}",
        solutions: "{count} solutions",
        showing: "Showing {start}–{end} of {total}",
        prev: "‹ Prev",
        next: "Next ›",
        perPage: "/ page",
        // Rank page
        rankTitle: "Difficulty Ranking",
        rankSubtitle: "Sorted by number of solutions (descending).",
        rankLoading: "Calculating ranking...",
        rankSolutions: "{count} solutions",
        rankView: "View",

        noSolution: "No solution"
    },
    zh: {
        navHome: "首页",
        navRank: "排行榜",
        title: "24点求解器",
        subtitle: "输入四个数字（1–13），找出所有算出24的方法。",
        solveBtn: "求解",
        footer: "数据：1820 种组合，114573 个解",
        loading: "正在加载 1820 种组合...",
        loaded: "已加载 {count} 条数据。",
        loadFail: "数据加载失败：{error}",
        invalidInput: "请输入 1–13 之间的数字",
        noData: "未找到键为 {key} 的数据",
        solutions: "{count} 个解",
        showing: "显示第 {start}–{end} 条，共 {total} 条",
        prev: "‹ 上一页",
        next: "下一页 ›",
        perPage: "条/页",
        // Rank page
        rankTitle: "难度排行榜",
        rankSubtitle: "按解法数量从高到低排序。",
        rankLoading: "正在计算排行榜...",
        rankSolutions: "{count} 个解",
        rankView: "查看",

        noSolution: "无解"
    }
};

let currentLang = localStorage.getItem('oetd-lang') || 'en';
let _currentEntry = null;

window.addEventListener('entryUpdated', (e) => {
    _currentEntry = e.detail;
});

function t(key, params = {}) {
    let text = i18n[currentLang][key] || i18n['en'][key] || key;
    Object.keys(params).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return text;
}

function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    if (_currentEntry && typeof window.renderSolutions === 'function') {
        window.renderSolutions();
        window.renderPagination();
    }
    // 如果在排行榜页面，重新渲染排行榜
    if (document.getElementById('rank-list') && typeof window.renderRankList === 'function') {
        window.renderRankList();
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    localStorage.setItem('oetd-lang', currentLang);
    applyLanguage();
}

// 暴露给全局
window.t = t;
window.applyLanguage = applyLanguage;
window.toggleLanguage = toggleLanguage;
window.currentLang = () => currentLang;