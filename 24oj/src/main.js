import './i18n.js';

let Data = null;
let loading = false;
let currentEntry = null;
let currentPage = 1;
let pageSize = 25;

// 排行榜相关状态
let rankData = [];
let rankPage = 1;
let rankPageSize = 50;

// ==================== 数据加载 ====================
async function loadData() {
    if (Data) return Data;
    if (loading) return;

    loading = true;
    const status = document.getElementById('status') || document.getElementById('rank-status');
    if (status) status.textContent = window.t('loading');

    try {
        const module = await import('../database/data_24.js');
        Data = module.Data;
        
        // 预计算排行榜数据（按 cnt 降序）
        rankData = Object.keys(Data).map(key => {
            const item = Data[key];
            return {
                key: key,
                cnt: item.cnt || item.content?.length || 0
            };
        }).sort((a, b) => b.cnt - a.cnt);
        
        if (status) status.textContent = window.t('loaded', { count: Object.keys(Data).length });
    } catch (err) {
        if (status) status.textContent = window.t('loadFail', { error: err.message });
        console.error(err);
    } finally {
        loading = false;
    }
}

// ==================== URL 路由与参数处理 ====================

// 辅助函数：将数字补零为2位
const pad2 = (n) => String(n).padStart(2, '0');

function parseURLAndFillInputs() {
    const params = new URLSearchParams(window.location.search);
    const cParam = params.get('c');
    
    // 支持 8 位格式 (01020304) 或 兼容旧格式 (1234)
    if (cParam) {
        let nums = [];
        if (cParam.length === 8) {
            // 标准 8 位格式
            nums = [0, 2, 4, 6].map(i => parseInt(cParam.substring(i, i + 2), 10));
        } else if (cParam.length === 4) {
            // 兼容 4 位格式 (每位只能是 1-9)
            nums = cParam.split('').map(n => parseInt(n, 10));
        }

        if (nums.length === 4 && nums.every(n => !isNaN(n))) {
            ['a', 'b', 'c', 'd'].forEach((id, index) => {
                const el = document.getElementById(id);
                if (el) el.value = nums[index];
            });
            return true;
        }
    }
    return false;
}

function syncURLFromState() {
    const params = new URLSearchParams();
    
    // 获取输入值，并确保补零为 2 位，防止出现 12841 这种歧义参数
    const cStr = ['a', 'b', 'c', 'd'].map(id => {
        const val = parseInt(document.getElementById(id).value);
        return isNaN(val) ? '00' : pad2(val);
    }).join('');
    
    params.set('c', cStr);
    params.set('p', currentPage);
    
    // 更新 URL 但不刷新页面
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

// 动态更新页面标题
function updateTitle() {
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    
    const nums = ['a', 'b', 'c', 'd'].map(id => document.getElementById(id).value).filter(v => v);
    
    if (nums.length === 4) {
        // 查询后：Solutions of {a, b, c, d} | OETD
        titleEl.textContent = `Solutions of {${nums.join(', ')}} | OETD`;
    } else {
        // 首页：The Online Encyclopedia of Twenty-four Dots (OETD)
        titleEl.textContent = `The Online Encyclopedia of Twenty-four Dots (OETD)`;
    }
}

function clampPage(page, total, size) {
    const totalPages = Math.ceil(total / size);
    if (page > totalPages) return totalPages;
    if (page < 1) return 1;
    return page;
}

// ==================== 首页逻辑 ====================
async function query(isManual = false) {
    await loadData();
    if (!Data) return;

    // 1. 获取用户原始输入的数字数组
    const nums = ['a', 'b', 'c', 'd'].map(id => parseInt(document.getElementById(id).value));
    if (nums.some(n => isNaN(n) || n < 1 || n > 13)) {
        document.getElementById('result').innerHTML = `<span style="color:red">${window.t('invalidInput')}</span>`;
        const paginationDiv = document.getElementById('pagination');
        if (paginationDiv) paginationDiv.innerHTML = ''; 
        if (isManual) updateTitle();
        return;
    }

    // 2. 【核心修改】生成用于前端显示的原始 Key（保持用户输入顺序，仅用逗号拼接）
    const displayKey = nums.join(',');

    // 3. 生成用于查询数据库的 Key（降序排序）
    const sorted = [...nums].sort((x, y) => y - x); 
    const queryKey = sorted.join(',');

    // 4. 使用 queryKey 查库，但使用 displayKey 渲染
    if (!Data[queryKey] || !Data[queryKey].cnt || Data[queryKey].cnt === 0 || !Data[queryKey].content || Data[queryKey].content.length === 0) {
        // 无解时，显示用户输入的原始顺序
        document.getElementById('result').innerHTML = `
            <h3>${displayKey} → <span style="color:yellow;">No solution</span></h3>
        `;
        
        const paginationDiv = document.getElementById('pagination');
        if (paginationDiv) {
            paginationDiv.innerHTML = ''; 
        }
        
        if (isManual) updateTitle();
        return; 
    }

    currentEntry = Data[queryKey];
    currentEntry.key = displayKey; // 【关键】把原始顺序的 Key 挂载到 currentEntry 上，供 renderSolutions 使用
    window.dispatchEvent(new CustomEvent('entryUpdated', { detail: currentEntry }));

    // --- 分页逻辑 ---
    const params = new URLSearchParams(window.location.search);
    const pParam = parseInt(params.get('p'));
    let requestedPage = !isNaN(pParam) ? pParam : 1;
    
    const maxPage = Math.ceil(currentEntry.cnt / pageSize) || 1;
    currentPage = Math.max(1, Math.min(requestedPage, maxPage));

    syncURLFromState();
    renderSolutions();
    renderPagination(); 
    
    if (isManual) updateTitle();
}

function renderSolutions() {
    const resultDiv = document.getElementById('result');
    if (!resultDiv || !currentEntry) return;
    
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, currentEntry.cnt);
    const shown = currentEntry.content.slice(start, end);

    resultDiv.innerHTML = `
        <h3>${currentEntry.key} → <span style="color:green">${window.t('solutions', { count: currentEntry.cnt })}</span></h3>
        <ul class="solution-list">
            ${shown.map((s, i) => `<li><span class="idx">${start + i + 1}.</span> ${s}</li>`).join('')}
        </ul>
    `;
}

function renderPagination() {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv || !currentEntry) return;

    const total = currentEntry.cnt;
    const totalPages = Math.ceil(total / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);

    let pageButtons = '';
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
            pageButtons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    } else {
        pageButtons += `<button class="page-btn ${1 === currentPage ? 'active' : ''}" data-page="1">1</button>`;
        if (currentPage > 4) pageButtons += `<span class="ellipsis">...</span>`;
        
        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);
        
        if (currentPage <= 4) {
            startPage = 2;
            endPage = Math.min(totalPages - 1, maxVisible - 2);
        } else if (currentPage >= totalPages - 3) {
            startPage = Math.max(2, totalPages - maxVisible + 3);
            endPage = totalPages - 1;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (currentPage < totalPages - 3) pageButtons += `<span class="ellipsis">...</span>`;
        pageButtons += `<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationDiv.innerHTML = `
        <div class="pagination-info">${window.t('showing', { start: start + 1, end: end, total: total })}</div>
        <div class="pagination-controls">
            <button class="page-btn nav" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>${window.t('prev')}</button>
            ${pageButtons}
            <button class="page-btn nav" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>${window.t('next')}</button>
            <select id="page-size-select">
                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 ${window.t('perPage')}</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 ${window.t('perPage')}</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 ${window.t('perPage')}</option>
            </select>
        </div>
    `;

    paginationDiv.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page === 'prev') currentPage--;
            else if (page === 'next') currentPage++;
            else currentPage = parseInt(page);
            
            currentPage = clampPage(currentPage, total, pageSize);
            syncURLFromState();
            renderSolutions();
            renderPagination();
        });
    });

    document.getElementById('page-size-select').addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        renderSolutions();
        renderPagination();
    });
}

// ==================== 排行榜逻辑 ====================
async function initRank() {
    await loadData();
    if (!rankData.length) return;
    
    // 设置排行榜页面标题
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = `Ranking: Ranking | OETD`;

    const params = new URLSearchParams(window.location.search);
    const pParam = parseInt(params.get('p'));
    rankPage = !isNaN(pParam) ? pParam : 1;
    rankPage = clampPage(rankPage, rankData.length, rankPageSize);
    
    renderRankList();
    renderRankPagination();
}

function renderRankList() {
    const listDiv = document.getElementById('rank-list');
    if (!listDiv) return;

    const start = (rankPage - 1) * rankPageSize;
    const end = Math.min(start + rankPageSize, rankData.length);
    const shown = rankData.slice(start, end);

    listDiv.innerHTML = `
        <table class="rank-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th data-i18n="rankCards">Cards</th>
                    <th data-i18n="rankSolutions">Solutions</th>
                    <th data-i18n="rankAction">Action</th>
                </tr>
            </thead>
            <tbody>
                ${shown.map((item, i) => {
                    const cardKey = item.key || '';
                    // 生成 URL 参数时，同样使用 pad2 确保格式统一
                    const urlParam = cardKey.split(',').map(n => pad2(n)).join('');
                    
                    return `
                    <tr>
                        <td>${start + i + 1}</td>
                        <td class="cards">${cardKey}</td>
                        <td>${window.t('rankSolutions', { count: item.cnt })}</td>
                        <td><a href="./index.html?c=${urlParam}&p=1" class="btn-view">${window.t('rankView')}</a></td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;
    if (window.applyLanguage) window.applyLanguage();
}

function renderRankPagination() {
    const paginationDiv = document.getElementById('rank-pagination');
    if (!paginationDiv) return;

    const total = rankData.length;
    const totalPages = Math.ceil(total / rankPageSize);

    let pageButtons = '';
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
            pageButtons += `<button class="page-btn ${i === rankPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    } else {
        pageButtons += `<button class="page-btn ${1 === rankPage ? 'active' : ''}" data-page="1">1</button>`;
        if (rankPage > 4) pageButtons += `<span class="ellipsis">...</span>`;
        
        let startPage = Math.max(2, rankPage - 2);
        let endPage = Math.min(totalPages - 1, rankPage + 2);
        
        if (rankPage <= 4) {
            startPage = 2;
            endPage = Math.min(totalPages - 1, maxVisible - 2);
        } else if (rankPage >= totalPages - 3) {
            startPage = Math.max(2, totalPages - maxVisible + 3);
            endPage = totalPages - 1;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `<button class="page-btn ${i === rankPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (rankPage < totalPages - 3) pageButtons += `<span class="ellipsis">...</span>`;
        pageButtons += `<button class="page-btn ${totalPages === rankPage ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationDiv.innerHTML = `
        <div class="pagination-info">${window.t('showing', { start: (rankPage-1)*rankPageSize + 1, end: Math.min(rankPage*rankPageSize, total), total: total })}</div>
        <div class="pagination-controls">
            <button class="page-btn nav" data-page="prev" ${rankPage === 1 ? 'disabled' : ''}>${window.t('prev')}</button>
            ${pageButtons}
            <button class="page-btn nav" data-page="next" ${rankPage === totalPages ? 'disabled' : ''}>${window.t('next')}</button>
        </div>
    `;

    paginationDiv.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page === 'prev') rankPage--;
            else if (page === 'next') rankPage++;
            else rankPage = parseInt(page);
            
            rankPage = clampPage(rankPage, total, rankPageSize);
            
            const params = new URLSearchParams();
            params.set('p', rankPage);
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            
            renderRankList();
            renderRankPagination();
        });
    });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
        langBtn.addEventListener('click', window.toggleLanguage);
    }

    if (document.getElementById('rank-list')) {
        initRank();
    } else {
        const hasURLParams = parseURLAndFillInputs();
        
        const queryBtn = document.getElementById('query-btn');
        if (queryBtn) {
            queryBtn.addEventListener('click', query);
        }

        if (hasURLParams) {
            query();
        } else {
            updateTitle(); // 初始化标题
        }
    }
});