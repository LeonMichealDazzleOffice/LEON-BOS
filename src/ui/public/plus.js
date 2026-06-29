(function () {
    const state = {
        profiles: [],
        active: new Set(),
        selected: new Set(),
        rowMap: new Map(),
        proxyHealth: new Map(),
        settings: {},
        templates: [],
        regions: [],
        browserProfiles: [],
        networkProfiles: [],
        query: '',
        status: 'all',
        modalMode: 'create',
        modalOpen: false,
        currentView: 'assets'
    };

    let pendingCreateAction = null;

    const els = {};

    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const byId = (id) => document.getElementById(id);
    const text = (value) => value === undefined || value === null ? '' : String(value);
    const esc = (value) => text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function bootstrap() {
        cacheElements();
        bindEvents();
        installMotionLayer();
        syncWindowHooks();
        Promise.all([loadSettings(), loadTemplates(), loadProfiles(), loadRegions(), loadBrowserProfiles(), loadNetworkProfiles(), loadActivityLogs()]).then(() => {
            applyThemeFromSettings();
            renderAll();
            scheduleEnter();
        });
        setInterval(refreshActiveState, 3000);
        setInterval(loadProfiles, Number(state.settings.uiAutoRefreshSeconds || 5) * 1000 || 5000);
    }

    function cacheElements() {
        els.tbody = byId('profiles-tbody');
        els.table = byId('table-container');
        els.bulk = byId('bulk-bar');
        els.bulkCount = byId('bulk-count');
        els.selectAll = byId('select-all');
        els.modalLayer = byId('modal-layer');
        els.licenseLayer = byId('license-modal');
        els.licenseInput = byId('license-key-input');
        els.licenseButton = byId('license-activate-btn');
        els.modalTitle = byId('modal-title');
        els.modalBody = byId('modal-body');
        els.modalFooter = byId('modal-footer');
        els.search = byId('search-input');
        els.status = byId('status-filter');
        if (els.modalLayer) els.modalLayer.inert = true;
        if (els.licenseLayer) els.licenseLayer.inert = true;
    }

    function bindEvents() {
        qsa('[data-action]').forEach(button => button.addEventListener('click', handleAction));
        qsa('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
        els.search?.addEventListener('input', () => { state.query = els.search.value.trim().toLowerCase(); scheduleRender(); });
        els.status?.addEventListener('change', () => { state.status = els.status.value; scheduleRender(); });
        els.selectAll?.addEventListener('change', () => toggleAll(els.selectAll.checked));
        els.modalLayer?.addEventListener('click', (event) => { if (event.target.matches('[data-dismiss-modal]')) closeModal(); });
        els.licenseLayer?.addEventListener('click', (event) => { if (event.target.matches('[data-license-dismiss]')) closeLicenseModal(); });
        document.addEventListener('click', (event) => {
            const actionTarget = event.target.closest('[data-action]');
            if (!actionTarget) return;
            const action = actionTarget.dataset.action;
            if (action === 'close-modal') closeModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeModal();
        });

        els.licenseButton?.addEventListener('click', activateLicense);
    }

    function handleAction(event) {
        const action = event.currentTarget.dataset.action;
        if (action === 'show-create') return openCreateModal();
        if (action === 'show-batch-create') return openBatchModal();
        if (action === 'show-settings') return openSettingsModal();
        if (action === 'refresh') return refreshAll();
        if (action === 'bulk-launch') return bulkLaunch();
        if (action === 'bulk-close') return bulkClose();
        if (action === 'batch-bind') return openBatchBindModal();
        if (action === 'bulk-tag') return openBulkTagModal();
        if (action === 'bulk-delete') return bulkDelete();
        if (action === 'clear-selection') return clearSelection();
    }

    function syncWindowHooks() {
        window.showToast = toast;
        window.loadProfiles = loadProfiles;
        window.loadTemplates = loadTemplates;
        window.refreshActiveStatus = refreshActiveState;
        window.launchBrowser = launchProfile;
        window.launchProfile = launchProfile;
        window.closeProfile = closeProfile;
        window.deleteProfile = deleteProfile;
        window.batchLaunch = bulkLaunch;
        window.batchDelete = bulkDelete;
        window.showCreateModal = openCreateModal;
        window.showBatchModal = openBatchModal;
        window.hideModal = closeModal;
        window.showSettings = openSettingsModal;
        window.showTemplates = () => toast('模板中心可在后续扩展', 'success');
        window.showBrowserProfilesModal = openBrowserProfilesModal;
        window.showNetworkProfilesModal = openNetworkProfilesModal;
        window.showRegionsModal = openRegionsModal;
        window.showProfileDetails = openDetailDrawer;
        window.closeDetailDrawer = closeDetailDrawer;
        window.clearWorkbenchFilters = clearFilters;
        window.setStatusFilter = (value) => { state.status = value; if (els.status) els.status.value = value; scheduleRender(); };
        window.batchBindSelected = batchBindSelected;
        window.batchDeleteSelected = bulkDelete;
        window.selectAllVisible = () => toggleAll(true);
        window.clearTableSelection = clearSelection;
        window.toggleRowSelection = toggleSelection;
        window.toggleAllVisible = toggleAll;
        window.toggleRowMenu = toggleRowMenu;
        window.toggleFavorite = toggleFavorite;
        window.togglePinned = togglePinned;
        window.saveSettings = saveSettings;
        window.saveCustomRegion = saveCustomRegion;
        window.saveBrowserProfile = saveBrowserProfile;
        window.saveNetworkProfile = saveNetworkProfile;
        window.deleteRegion = deleteRegion;
        window.deleteBrowserProfile = deleteBrowserProfile;
        window.deleteNetworkProfile = deleteNetworkProfile;
        window.importProfilesFile = importProfilesFile;
        window.showIntegrationsModal = () => {
            if (typeof window._showIntegrationsModal === 'function') return window._showIntegrationsModal();
            toast('集成中心尚未加载完成', 'error');
        };
        window.showLicenseModal = openLicenseModal;
    }

    function toggleRowMenu(id) {
        const row = state.rowMap.get(id);
        if (!row) return false;
        row.classList.toggle('menu-open');
        return false;
    }

    function closeAllRowMenus() {
        qsa('tr.menu-open', els.tbody).forEach(row => row.classList.remove('menu-open'));
    }

    function installMotionLayer() {
        const layer = byId('motion-orb-layer');
        if (!layer || layer.childElementCount) return;
        layer.innerHTML = '<span class="motion-orb orb-a"></span><span class="motion-orb orb-b"></span><span class="motion-orb orb-c"></span>';
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.btn, .icon-btn, .nav-item');
            if (!button) return;
            const rect = button.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'motion-ripple';
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
            button.style.position = button.style.position || 'relative';
            button.appendChild(ripple);
            setTimeout(() => ripple.remove(), 520);
        }, { passive: true });
    }

    function applyThemeFromSettings() {
        document.body.classList.toggle('theme-dark', true);
    }

    function apiBase() {
        return window.LEONBOS_API_BASE || '';
    }

    function isOkResponse(payload) {
        return Boolean(payload && (payload.success === true || payload.status === 'success'));
    }

    function isBadResponse(payload) {
        return Boolean(payload && (payload.success === false || payload.status === 'bad'));
    }

    function setView(view) {
        state.currentView = view;
        qsa('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
        if (view === 'assets') return els.table?.scrollTo({ top: 0, behavior: 'smooth' });
        if (view === 'regions') return openRegionsModal();
        if (view === 'browser') return openBrowserProfilesModal();
        if (view === 'network') return openNetworkProfilesModal();
        if (view === 'integrations') return window.showIntegrationsModal?.();
        if (view === 'logs') return openLogsModal();
    }

    function scheduleRender() {
        if (scheduleRender.pending) return;
        scheduleRender.pending = true;
        requestAnimationFrame(() => {
            scheduleRender.pending = false;
            renderTable();
            updateSummary();
            updateBulkBar();
            scheduleEnter();
        });
    }

    function scheduleEnter() {
        qsa('.motion-enter:not(.motion-enter-ready)').forEach((el, index) => {
            el.style.setProperty('--motion-delay', `${Math.min(index * 16, 220)}ms`);
            requestAnimationFrame(() => el.classList.add('motion-enter-ready'));
        });
    }

    async function api(path, options = {}) {
        const response = await fetch(`${apiBase()}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
        const json = await response.json();
        if (!response.ok || isBadResponse(json)) throw new Error(json.error || json.message || `HTTP ${response.status}`);
        return json.data ?? json;
    }

    async function loadProfiles() {
        try {
            const data = await api('/api/profiles');
            state.profiles = Array.isArray(data) ? data : [];
        } catch (error) {
            state.profiles = [];
            toast(error.message || '加载失败', 'error');
        }
        scheduleRender();
    }

    async function refreshActiveState() {
        try {
            const data = await api('/api/active');
            state.active = new Set((Array.isArray(data) ? data : []).map(item => item.profileId));
            state.profiles.forEach(profile => updateRow(profile.id));
            updateSummary();
        } catch (error) {}
    }

    async function loadSettings() {
        try { state.settings = await api('/api/settings'); } catch (error) { state.settings = {}; }
    }

    async function loadTemplates() {
        try { state.templates = await api('/api/templates'); } catch (error) { state.templates = []; }
    }

    async function loadRegions() {
        try { state.regions = await api('/api/regions'); } catch (error) { state.regions = []; }
    }

    async function loadBrowserProfiles() {
        try { state.browserProfiles = await api('/api/browser-profiles'); } catch (error) { state.browserProfiles = []; }
    }

    async function loadNetworkProfiles() {
        try { state.networkProfiles = await api('/api/network-profiles'); } catch (error) { state.networkProfiles = []; }
    }

    async function loadActivityLogs() {
        try { state.activityLogs = await api('/api/activity-logs?limit=20'); } catch (error) { state.activityLogs = []; }
    }

    function matches(profile) {
        if (state.status !== 'all' && (profile.status_label || 'normal') !== state.status) return false;
        if (!state.query) return true;
        const haystack = [
            profile.name,
            profile.id,
            profile.user_agent,
            profile.platform,
            profile.language,
            profile.timezone,
            profile.group_name,
            profile.region_name,
            profile.proxy_host,
            profile.proxy_type,
            profile.default_url,
            profile.remark,
            profile.notes
        ].join(' ').toLowerCase();
        return haystack.includes(state.query);
    }

    function sortedProfiles() {
        return [...state.profiles].filter(matches).sort((a, b) => {
            const pinned = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
            if (pinned) return pinned;
            const active = Number(state.active.has(b.id)) - Number(state.active.has(a.id));
            if (active) return active;
            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
        });
    }

    function fingerprint(profile) {
        const ua = profile.user_agent || '';
        const os = ua.includes('Windows') ? 'Win' : ua.includes('Macintosh') ? 'Mac' : ua.includes('Linux') ? 'Lin' : 'N/A';
        const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : 'N/A';
        const version = (ua.match(/(Chrome|Edg)\/(\d+)/) || [])[2] || '';
        const tz = String(profile.timezone || '').split('/').pop() || 'UTC';
        const lang = String(profile.language || '');
        return {
            summary: `${os} · ${browser}${version ? ` ${version}` : ''}`,
            tz: tz,
            lang: lang,
            screen: `${profile.viewport_width || profile.screen_width || 0}×${profile.viewport_height || profile.screen_height || 0}`
        };
    }

    function proxyLabel(profile) {
        if (!profile.proxy_host || !profile.proxy_port || profile.proxy_type === 'none') return '直连';
        const health = state.proxyHealth.get(profile.id);
        if (health && health.ok) return `${health.latencyMs}ms`;
        if (health && !health.ok) return 'Error';
        return `${profile.proxy_type || 'http'}://${profile.proxy_host}:${profile.proxy_port}`;
    }

    function renderTable() {
        const rows = sortedProfiles().map(renderRow).join('');
        els.tbody.innerHTML = rows || '<tr class="loading-row"><td colspan="6">没有可显示的环境</td></tr>';
        syncRowMap();
        if (els.selectAll) els.selectAll.checked = state.selected.size > 0 && state.selected.size === sortedProfiles().length;
    }

    function renderRow(profile) {
        const active = state.active.has(profile.id);
        const fp = fingerprint(profile);
        const selected = state.selected.has(profile.id);
        const proxy = proxyLabel(profile);
        const health = state.proxyHealth.get(profile.id);
        const proxyClass = health ? (health.ok ? 'proxy-fast' : 'proxy-error') : '';
        return `<tr class="${selected ? 'selected' : ''} ${active ? 'running' : ''}" data-id="${esc(profile.id)}" ondblclick="launchBrowser('${esc(profile.id)}')">
            <td class="check-col"><input type="checkbox" ${selected ? 'checked' : ''} onclick="event.stopPropagation(); toggleRowSelection('${esc(profile.id)}', this.checked)"></td>
            <td>
                <div class="profile-name"><span class="status-dot"></span>${esc(profile.name || '未命名环境')}</div>
                <div class="profile-meta"><span class="badge">ID ${esc(profile.id)}</span><span>${esc(profile.group_name || profile.region_name || '未分组')}</span></div>
            </td>
            <td>
                <div class="profile-meta"><span class="badge">${esc(fp.summary)}</span><span>${esc(fp.tz)}</span><span>${esc(fp.lang || 'N/A')}</span><span>${esc(fp.screen)}</span></div>
            </td>
            <td>
                <div class="proxy-cell">
                    <span class="proxy-text ${proxyClass}">${esc(proxy)}</span>
                    <button class="icon-btn" title="测速" onclick="event.stopPropagation(); checkProxy('${esc(profile.id)}')">⚡</button>
                </div>
            </td>
            <td>
                <span class="status-chip ${active ? 'running' : 'offline'}">${active ? '运行中' : (profile.status_label || '离线')}</span>
                <span class="muted">${esc(profile.use_count || 0)} 次</span>
            </td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); launchBrowser('${esc(profile.id)}')">${active ? '前台' : '启动'}</button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); showProfileDetails('${esc(profile.id)}')">详情</button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); toggleFavorite('${esc(profile.id)}')">收藏</button>
                    <button class="btn btn-danger" onclick="event.stopPropagation(); deleteProfile('${esc(profile.id)}')">删除</button>
                </div>
            </td>
        </tr>`;
    }

    function syncRowMap() {
        state.rowMap.clear();
        qsa('tr[data-id]', els.tbody).forEach(row => state.rowMap.set(row.dataset.id, row));
    }

    function updateRow(id) {
        const row = state.rowMap.get(id);
        const profile = state.profiles.find(item => item.id === id);
        if (!row || !profile) return;
        const next = document.createElement('tbody');
        next.innerHTML = renderRow(profile);
        const replacement = next.firstElementChild;
        if (replacement) row.replaceWith(replacement);
        state.rowMap.set(id, replacement);
    }

    function updateSummary() {
        const total = state.profiles.length;
        const active = state.active.size;
        const alertCount = state.profiles.filter(profile => ['blocked', 'warmup', 'checking'].includes(profile.status_label)).length;
        const latest = [...state.profiles].sort((a, b) => new Date(b.last_used || b.updated_at || b.created_at || 0) - new Date(a.last_used || a.updated_at || a.created_at || 0))[0];
        byId('stat-total-assets').textContent = String(total);
        byId('stat-active-assets').textContent = String(active);
        byId('stat-alert-assets').textContent = String(alertCount);
        byId('stat-last-activity').textContent = latest ? (latest.name || latest.id) : '-';
    }

    function updateBulkBar() {
        const count = state.selected.size;
        if (els.bulkCount) els.bulkCount.textContent = String(count);
        if (els.bulk) els.bulk.classList.toggle('show', count > 0);
        if (els.bulk) els.bulk.setAttribute('aria-hidden', count > 0 ? 'false' : 'true');
    }

    function toggleSelection(id, checked) {
        if (checked) state.selected.add(id); else state.selected.delete(id);
        updateBulkBar();
        const row = state.rowMap.get(id);
        row?.classList.toggle('selected', checked);
        if (els.selectAll) els.selectAll.checked = state.selected.size > 0 && state.selected.size === sortedProfiles().length;
    }

    function toggleAll(checked) {
        sortedProfiles().forEach(profile => checked ? state.selected.add(profile.id) : state.selected.delete(profile.id));
        renderTable();
        updateBulkBar();
    }

    function clearSelection() {
        state.selected.clear();
        renderTable();
        updateBulkBar();
    }

    function clearFilters() {
        state.query = '';
        state.status = 'all';
        if (els.search) els.search.value = '';
        if (els.status) els.status.value = 'all';
        scheduleRender();
    }

    async function launchProfile(id) {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) return;
        try {
            await api(`/api/profiles/${encodeURIComponent(id)}/launch`, {
                method: 'POST',
                body: JSON.stringify({
                    headless: false,
                    url: profile.default_url || state.settings.defaultLaunchUrl || '',
                    localDataPath: state.settings.userDataDir || '',
                    chromiumPath: state.settings.chromePath || '',
                    userAgent: profile.user_agent || '',
                    acceptLanguage: profile.accept_language || profile.language || '',
                    language: profile.language || '',
                    timezone: profile.timezone || '',
                    platform: profile.platform || '',
                    viewportWidth: profile.viewport_width || profile.screen_width,
                    viewportHeight: profile.viewport_height || profile.screen_height,
                    proxyType: profile.proxy_type || '',
                    proxyHost: profile.proxy_host || '',
                    proxyPort: profile.proxy_port || 0
                })
            });
            await refreshActiveState();
            toast('浏览器已启动', 'success');
        } catch (error) {
            toast(error.message || '启动失败', 'error');
        }
    }

    async function closeProfile(id) {
        try {
            await api(`/api/profiles/${encodeURIComponent(id)}/close`, { method: 'POST' });
            await refreshActiveState();
            toast('浏览器已停止', 'success');
        } catch (error) {
            toast(error.message || '停止失败', 'error');
        }
    }

    async function deleteProfile(id) {
        if (!confirm('确定删除此环境吗？')) return;
        try {
            await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
            state.selected.delete(id);
            await loadProfiles();
            toast('环境已删除', 'success');
        } catch (error) {
            toast(error.message || '删除失败', 'error');
        }
    }

    async function toggleFavorite(id) {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) return;
        try {
            await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_favorite: Number(!profile.is_favorite) }) });
            await loadProfiles();
            toast('收藏状态已更新', 'success');
        } catch (error) {
            toast(error.message || '更新失败', 'error');
        }
    }

    async function togglePinned(id) {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) return;
        try {
            await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_pinned: Number(!profile.is_pinned) }) });
            await loadProfiles();
            toast('置顶状态已更新', 'success');
        } catch (error) {
            toast(error.message || '更新失败', 'error');
        }
    }

    async function checkProxy(id) {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile || !profile.proxy_host || !profile.proxy_port) return toast('当前环境未配置代理', 'error');
        try {
            const result = await api('/api/proxy/check', {
                method: 'POST',
                body: JSON.stringify({ type: profile.proxy_type || 'http', host: profile.proxy_host, port: profile.proxy_port })
            });
            state.proxyHealth.set(id, result);
            updateRow(id);
            toast(result.ok ? `代理通畅 ${result.latencyMs}ms` : `代理异常 ${result.error || 'Error'}`, result.ok ? 'success' : 'error');
        } catch (error) {
            state.proxyHealth.set(id, { ok: false, error: error.message });
            updateRow(id);
            toast(error.message || '测速失败', 'error');
        }
    }

    async function bulkLaunch() {
        const ids = [...state.selected];
        if (!ids.length) return toast('未选择环境', 'error');
        try {
            const results = await api('/api/profiles/batch-launch', { method: 'POST', body: JSON.stringify({ ids }) });
            toast(`已启动 ${Array.isArray(results) ? results.filter(item => item.success).length : ids.length} 个环境`, 'success');
            state.selected.clear();
            await refreshActiveState();
            updateBulkBar();
        } catch (error) {
            toast(error.message || '批量启动失败', 'error');
        }
    }

    async function bulkClose() {
        const ids = [...state.selected];
        if (!ids.length) return toast('未选择环境', 'error');
        try {
            await api('/api/profiles/batch-close', { method: 'POST', body: JSON.stringify({ ids }) });
            state.selected.clear();
            await refreshActiveState();
            updateBulkBar();
            toast('已关闭所选环境', 'success');
        } catch (error) {
            toast(error.message || '批量关闭失败', 'error');
        }
    }

    async function bulkTag() {
        const ids = [...state.selected];
        if (!ids.length) return toast('未选择环境', 'error');
        const tag = byId('bulk-tag-input')?.value.trim() || '';
        if (!tag) return;
        try {
            for (const id of ids) {
                const profile = state.profiles.find(item => item.id === id);
                const tags = String(profile?.tags || '').split(',').map(item => item.trim()).filter(Boolean);
                if (!tags.includes(tag)) tags.push(tag);
                await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ tags: tags.join(',') }) });
            }
            await loadProfiles();
            closeModal();
            toast('批量标签已更新', 'success');
        } catch (error) {
            toast(error.message || '批量打标签失败', 'error');
        }
    }

    function openLogsModal() {
        const items = Array.isArray(state.activityLogs) ? state.activityLogs : [];
        openModal('活动审计', `<div class="list-grid">${items.map(item => `<article class="list-card"><div><strong>${esc(item.entity_type || 'event')} · ${esc(item.action || '')}</strong><p>${esc(item.summary || '')}</p><small>${esc(item.created_at || '')}</small></div></article>`).join('') || '<p class="muted">暂无活动记录</p>'}</div>`, '<button class="btn btn-secondary" data-action="close-modal">关闭</button>');
    }

    async function bulkDelete() {
        const ids = [...state.selected];
        if (!ids.length) return toast('未选择环境', 'error');
        if (!confirm(`确定删除选中的 ${ids.length} 个环境吗？`)) return;
        try {
            for (const id of ids) await api(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
            state.selected.clear();
            await loadProfiles();
            updateBulkBar();
            toast('选中环境已删除', 'success');
        } catch (error) {
            toast(error.message || '批量删除失败', 'error');
        }
    }

    function openModal(title, body, footer) {
        closeAllRowMenus();
        els.modalTitle.textContent = title;
        els.modalBody.innerHTML = body;
        els.modalFooter.innerHTML = footer;
        els.modalLayer.inert = false;
        els.modalLayer.classList.add('show');
        els.modalLayer.setAttribute('aria-hidden', 'false');
        state.modalOpen = true;
        requestAnimationFrame(() => {
            const focusTarget = qs('.modal-panel button, .modal-panel input, .modal-panel select, .modal-panel textarea');
            focusTarget?.focus();
        });
    }

    function closeModal() {
        if (!els.modalLayer) return;
        const active = document.activeElement;
        if (active && els.modalLayer.contains(active)) active.blur();
        document.body.focus?.();
        els.modalLayer.classList.remove('show');
        els.modalLayer.setAttribute('aria-hidden', 'true');
        els.modalLayer.inert = true;
        state.modalOpen = false;
    }

    function openLicenseModal(message) {
        if (!els.licenseLayer) return;
        if (message) {
            const hint = byId('license-modal-hint');
            if (hint) hint.textContent = message;
        }
        els.licenseLayer.inert = false;
        els.licenseLayer.classList.add('show');
        els.licenseLayer.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => els.licenseInput?.focus());
    }

    function closeLicenseModal() {
        if (!els.licenseLayer) return;
        const active = document.activeElement;
        if (active && els.licenseLayer.contains(active)) active.blur();
        els.licenseLayer.classList.remove('show');
        els.licenseLayer.setAttribute('aria-hidden', 'true');
        els.licenseLayer.inert = true;
    }

    function setPendingCreateAction(action) {
        pendingCreateAction = action;
    }

    async function runPendingCreateAction() {
        if (typeof pendingCreateAction === 'function') {
            const action = pendingCreateAction;
            pendingCreateAction = null;
            await action();
        }
    }

    async function activateLicense() {
        const key = els.licenseInput?.value || '';
        if (!key.trim()) {
            const hint = byId('license-modal-hint');
            if (hint) hint.textContent = '请输入授权密钥';
            return;
        }
        try {
            const result = await api('/api/auth/activate', { method: 'POST', body: JSON.stringify({ key }) });
            closeLicenseModal();
            toast(result.message || '激活成功', 'success');
            await loadProfiles();
            await runPendingCreateAction();
        } catch (error) {
            const hint = byId('license-modal-hint');
            if (hint) hint.textContent = error.message || '激活失败';
            toast(error.message || '激活失败', 'error');
        }
    }

    function openCreateModal() {
        openModal('单个创建', profileFormMarkup('profile'), '<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" id="save-profile">创建</button>');
        bindProfileForm('profile', saveSingleProfile);
        byId('save-profile')?.addEventListener('click', saveSingleProfile);
    }

    function openBatchModal() {
        openModal('批量创建', batchFormMarkup('batch'), '<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" id="save-batch">开始批量创建</button>');
        bindProfileForm('batch', saveBatchProfile);
        byId('save-batch')?.addEventListener('click', saveBatchProfile);
    }

    function openSettingsModal() {
        openModal('控制台设置', settingsMarkup(), '<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" id="save-settings">保存</button>');
        setTimeout(populateSettingsForm, 0);
        byId('save-settings')?.addEventListener('click', saveSettings);
    }

    function openBrowserProfilesModal() {
        openModal('浏览器配置', profilesListMarkup(state.browserProfiles, 'browser') + browserProfileFormMarkup(), '<button class="btn btn-secondary" data-action="close-modal">关闭</button><button class="btn btn-primary" id="quick-save-browser">保存浏览器配置</button>');
        byId('quick-save-browser')?.addEventListener('click', saveBrowserProfile);
    }

    function openNetworkProfilesModal() {
        openModal('网络配置', profilesListMarkup(state.networkProfiles, 'network') + networkProfileFormMarkup(), '<button class="btn btn-secondary" data-action="close-modal">关闭</button><button class="btn btn-primary" id="quick-save-network">保存网络配置</button>');
        byId('quick-save-network')?.addEventListener('click', saveNetworkProfile);
    }

    function openRegionsModal() {
        openModal('地区配置', regionsMarkup() + regionProfileFormMarkup(), '<button class="btn btn-secondary" data-action="close-modal">关闭</button><button class="btn btn-primary" id="quick-save-region">保存地区</button>');
        byId('quick-save-region')?.addEventListener('click', saveCustomRegion);
    }

    function openBatchBindModal() {
        openModal('批量绑定', `
            <div class="form-row">
                <div class="form-group"><label>浏览器配置</label><select id="batch-bind-browser"><option value="">不绑定</option>${state.browserProfiles.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>网络配置</label><select id="batch-bind-network"><option value="">不绑定</option>${state.networkProfiles.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></div>
            </div>
        `, '<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" id="batch-bind-save">保存绑定</button>');
        byId('batch-bind-save')?.addEventListener('click', batchBindSelected);
    }

    function openBulkTagModal() {
        openModal('批量打标签', `
            <div class="form-group"><label>标签名</label><input id="bulk-tag-input" placeholder="例如：高优先级"></div>
        `, '<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" id="bulk-tag-save">保存</button>');
        byId('bulk-tag-save')?.addEventListener('click', bulkTag);
    }

    function profileFormMarkup(prefix) {
        return `
            <div class="form-row"><div class="form-group"><label>环境名称</label><input id="${prefix}-name" placeholder="例如：北美客户 A"></div><div class="form-group"><label>操作系统</label><select id="${prefix}-os"><option value="">随机</option><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></div></div>
            <div class="form-row"><div class="form-group"><label>浏览器</label><select id="${prefix}-browser"><option value="chrome">Chrome</option><option value="edge">Edge</option></select></div><div class="form-group"><label>指纹模板</label><select id="${prefix}-template"><option value="">随机生成</option>${state.templates.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></div></div>
            <div class="form-row"><div class="form-group"><label>代理</label><input id="${prefix}-proxy" placeholder="http://host:port 或 socks5://host:port"></div><div class="form-group"><label>地区 / 分组</label><input id="${prefix}-group" placeholder="例如：亚太 / 销售"></div></div>
            <div class="form-row"><div class="form-group"><label>语言</label><input id="${prefix}-language" placeholder="zh-CN"></div><div class="form-group"><label>时区</label><input id="${prefix}-timezone" placeholder="Asia/Shanghai"></div></div>
            <div class="form-row"><div class="form-group"><label>默认启动网址</label><input id="${prefix}-default-url" placeholder="https://example.com"></div><div class="form-group"><label>标签</label><input id="${prefix}-tags" placeholder="标签1,标签2"></div></div>
            <div class="form-group"><label>备注</label><textarea id="${prefix}-remark"></textarea></div>
        `;
    }

    function browserProfileFormMarkup() {
        return `
            <div class="form-row"><div class="form-group"><label>名称</label><input id="browser-form-name" placeholder="例如：Chrome CN Desktop"></div><div class="form-group"><label>平台</label><input id="browser-form-platform" value="Win32"></div></div>
            <div class="form-row"><div class="form-group"><label>语言</label><input id="browser-form-language" value="zh-CN"></div><div class="form-group"><label>时区</label><input id="browser-form-timezone" value="Asia/Shanghai"></div></div>
            <div class="form-row"><div class="form-group"><label>宽度</label><input id="browser-form-width" type="number" value="1920"></div><div class="form-group"><label>高度</label><input id="browser-form-height" type="number" value="1080"></div></div>
            <div class="form-group"><label>User-Agent</label><textarea id="browser-form-ua" placeholder="可留空，由系统生成"></textarea></div>
        `;
    }

    function networkProfileFormMarkup() {
        return `
            <div class="form-row"><div class="form-group"><label>名称</label><input id="network-form-name" placeholder="例如：US Direct"></div><div class="form-group"><label>类型</label><select id="network-form-type"><option value="direct">direct</option><option value="http">http</option><option value="socks5">socks5</option></select></div></div>
            <div class="form-row"><div class="form-group"><label>主机</label><input id="network-form-host" placeholder="127.0.0.1"></div><div class="form-group"><label>端口</label><input id="network-form-port" type="number" value="0"></div></div>
            <div class="form-group"><label>备注</label><textarea id="network-form-notes"></textarea></div>
        `;
    }

    function regionProfileFormMarkup() {
        return `
            <div class="form-row"><div class="form-group"><label>地区名称</label><input id="region-form-name" placeholder="例如：中国 / 上海"></div><div class="form-group"><label>国家 / 地区</label><input id="region-form-country" placeholder="China"></div></div>
            <div class="form-row"><div class="form-group"><label>城市</label><input id="region-form-city" placeholder="Shanghai"></div><div class="form-group"><label>时区</label><input id="region-form-timezone" placeholder="Asia/Shanghai"></div></div>
            <div class="form-row"><div class="form-group"><label>区域语言</label><input id="region-form-locale" placeholder="zh-CN"></div><div class="form-group"><label>浏览器语言</label><input id="region-form-language" placeholder="zh-CN"></div></div>
            <div class="form-row"><div class="form-group"><label>网络标签</label><input id="region-form-network" placeholder="CN 生产"></div><div class="form-group"><label>分辨率</label><input id="region-form-resolution" value="1920 × 1080"></div></div>
            <div class="form-group"><label>备注</label><textarea id="region-form-notes"></textarea></div>
        `;
    }

    function batchFormMarkup(prefix) {
        return `
            <div class="form-row"><div class="form-group"><label>数量</label><input id="${prefix}-count" type="number" value="10" min="1" max="100"></div><div class="form-group"><label>名前前缀</label><input id="${prefix}-prefix" value="Profile"></div></div>
            ${profileFormMarkup(prefix)}
        `;
    }

    function settingsMarkup() {
        return `
            <div class="form-row"><div class="form-group"><label>Chrome 路径</label><input id="setting-chrome-path"></div><div class="form-group"><label>用户数据目录</label><input id="setting-user-data-dir"></div></div>
            <div class="form-row"><div class="form-group"><label>默认启动网址</label><input id="setting-default-url"></div><div class="form-group"><label>自动刷新秒数</label><input id="setting-refresh" type="number" min="3"></div></div>
        `;
    }

    function regionsMarkup() {
        return `<div class="list-grid">${state.regions.map(region => `<article class="list-card"><div><strong>${esc(region.name || region.id)}</strong><p>${esc([region.country, region.city, region.timezone, region.locale || region.language].filter(Boolean).join(' · '))}</p></div></article>`).join('') || '<p class="muted">暂无地区配置</p>'}</div>`;
    }

    function profilesListMarkup(list, type) {
        return `<div class="list-grid">${(Array.isArray(list) ? list : []).map(item => `<article class="list-card"><div><strong>${esc(item.name || item.id)}</strong><p>${esc(type === 'browser' ? [item.platform, item.language, item.timezone].filter(Boolean).join(' · ') : [item.type, item.host, item.port].filter(Boolean).join(' · '))}</p></div></article>`).join('') || '<p class="muted">暂无数据</p>'}</div>`;
    }

    function bindProfileForm(prefix, handler) {
        qsa('[data-dismiss-modal]').forEach(node => node.addEventListener('click', closeModal));
        qsa(`[id^="${prefix}-"]`).forEach(() => {});
        if (handler) setTimeout(() => { qsa('#modal-footer .btn-primary').forEach(btn => btn.onclick = handler); }, 0);
    }

    function getPrefixPayload(prefix) {
        return {
            name: text(byId(`${prefix}-name`)?.value).trim(),
            os: byId(`${prefix}-os`)?.value || '',
            browser: byId(`${prefix}-browser`)?.value || '',
            template: byId(`${prefix}-template`)?.value || '',
            proxyInput: byId(`${prefix}-proxy`)?.value || '',
            group_name: byId(`${prefix}-group`)?.value || '',
            language: byId(`${prefix}-language`)?.value || '',
            timezone: byId(`${prefix}-timezone`)?.value || '',
            default_url: byId(`${prefix}-default-url`)?.value || '',
            tags: byId(`${prefix}-tags`)?.value || '',
            remark: byId(`${prefix}-remark`)?.value || ''
        };
    }

    function parseProxy(proxyInput) {
        if (!proxyInput) return null;
        const match = proxyInput.match(/^(https?|socks5):\/\/([^:]+):(\d+)$/);
        if (!match) return null;
        return { type: match[1] === 'https' ? 'http' : match[1], host: match[2], port: Number(match[3]) };
    }

    async function saveSingleProfile() {
        const payload = getPrefixPayload('profile');
        if (!payload.name) return toast('请输入环境名称', 'error');
        const body = {
            name: payload.name,
            os: payload.os,
            browser: payload.browser,
            template: payload.template || undefined,
            group_name: payload.group_name,
            language: payload.language,
            timezone: payload.timezone,
            default_url: payload.default_url,
            tags: payload.tags,
            remark: payload.remark,
            notes: payload.remark,
            status_label: 'normal'
        };
        const proxy = parseProxy(payload.proxyInput);
        if (payload.proxyInput && !proxy) return toast('代理格式应为 http://host:port 或 socks5://host:port', 'error');
        if (proxy) body.proxy = proxy;
        try {
            const created = await createProfileWithActivation(body, async () => await saveSingleProfile());
            if (!created) return;
            const browserProfileId = byId('profile-browser-profile')?.value || '';
            const networkProfileId = byId('profile-network-profile')?.value || '';
            if (created && created.id && (browserProfileId || networkProfileId)) {
                await api(`/api/profiles/${encodeURIComponent(created.id)}`, { method: 'PATCH', body: JSON.stringify({ browser_profile_id: browserProfileId, network_profile_id: networkProfileId }) });
            }
            closeModal();
            await loadProfiles();
            toast('环境已创建', 'success');
        } catch (error) {
            toast(error.message || '创建失败', 'error');
        }
    }

    async function saveBatchProfile() {
        const payload = getPrefixPayload('batch');
        const count = Math.max(1, Math.min(100, Number(byId('batch-count')?.value || 10)));
        const prefix = byId('batch-prefix')?.value || 'Profile';
        const body = {
            count,
            prefix,
            os: payload.os,
            browser: payload.browser,
            template: payload.template,
            group_name: payload.group_name,
            language: payload.language,
            timezone: payload.timezone,
            default_url: payload.default_url,
            tags: payload.tags,
            remark: payload.remark,
            status_label: 'normal'
        };
        const proxy = parseProxy(payload.proxyInput);
        if (payload.proxyInput && !proxy) return toast('代理格式应为 http://host:port 或 socks5://host:port', 'error');
        if (proxy) body.proxy = proxy;
        try {
            const result = await createProfileBatchWithActivation(body, async () => await saveBatchProfile());
            if (!result) return;
            const browserProfileId = byId('batch-browser-profile')?.value || '';
            const networkProfileId = byId('batch-network-profile')?.value || '';
            if (Array.isArray(result) && (browserProfileId || networkProfileId)) {
                for (const item of result) {
                    if (!item?.id) continue;
                    await api(`/api/profiles/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ browser_profile_id: browserProfileId, network_profile_id: networkProfileId }) });
                }
            }
            closeModal();
            await loadProfiles();
            toast('批量环境已创建', 'success');
        } catch (error) {
            toast(error.message || '批量创建失败', 'error');
        }
    }

    async function createProfileWithActivation(body, retryAction) {
        const response = await fetch(`${apiBase()}/api/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        if (result && result.code === 'LIMIT_EXCEEDED') {
            setPendingCreateAction(retryAction);
            openLicenseModal(result.message);
            return null;
        }
        if (!isOkResponse(result)) throw new Error(result.error || result.message || '创建失败');
        return result.data;
    }

    async function createProfileBatchWithActivation(body, retryAction) {
        const response = await fetch(`${apiBase()}/api/profiles/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        if (result && result.code === 'LIMIT_EXCEEDED') {
            setPendingCreateAction(retryAction);
            openLicenseModal(result.message);
            return null;
        }
        if (!isOkResponse(result)) throw new Error(result.error || result.message || '创建失败');
        return result.data;
    }

    async function saveSettings() {
        try {
            await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ chrome_path: byId('setting-chrome-path')?.value || '', user_data_dir: byId('setting-user-data-dir')?.value || '', default_launch_url: byId('setting-default-url')?.value || '', ui_auto_refresh_seconds: byId('setting-refresh')?.value || '5' }) });
            closeModal();
            await loadSettings();
            toast('设置已保存', 'success');
        } catch (error) {
            toast(error.message || '保存失败', 'error');
        }
    }

    async function batchBindSelected() {
        const ids = [...state.selected];
        if (!ids.length) return toast('未选择环境', 'error');
        const browser_profile_id = byId('batch-bind-browser')?.value || '';
        const network_profile_id = byId('batch-bind-network')?.value || '';
        if (!browser_profile_id && !network_profile_id) return toast('未输入绑定项', 'error');
        try {
            await api('/api/profiles/batch-bind', { method: 'POST', body: JSON.stringify({ ids, browser_profile_id, network_profile_id }) });
            await loadProfiles();
            closeModal();
            toast('批量绑定完成', 'success');
        } catch (error) {
            toast(error.message || '批量绑定失败', 'error');
        }
    }

    async function saveBrowserProfile() {
        const payload = { name: byId('browser-form-name')?.value || '', platform: byId('browser-form-platform')?.value || 'Win32', language: byId('browser-form-language')?.value || 'zh-CN', timezone: byId('browser-form-timezone')?.value || 'Asia/Shanghai', screen_width: Number(byId('browser-form-width')?.value || 1920), screen_height: Number(byId('browser-form-height')?.value || 1080), user_agent: byId('browser-form-ua')?.value || '' };
        if (!payload.name) return toast('请输入名称', 'error');
        try { await api('/api/browser-profiles', { method: 'POST', body: JSON.stringify(payload) }); await loadBrowserProfiles(); closeModal(); toast('浏览器配置已保存', 'success'); } catch (error) { toast(error.message || '保存失败', 'error'); }
    }

    async function saveNetworkProfile() {
        const payload = { name: byId('network-form-name')?.value || '', type: byId('network-form-type')?.value || 'direct', host: byId('network-form-host')?.value || '', port: Number(byId('network-form-port')?.value || 0), notes: byId('network-form-notes')?.value || '' };
        if (!payload.name) return toast('请输入名称', 'error');
        try { await api('/api/network-profiles', { method: 'POST', body: JSON.stringify(payload) }); await loadNetworkProfiles(); closeModal(); toast('网络配置已保存', 'success'); } catch (error) { toast(error.message || '保存失败', 'error'); }
    }

    async function saveCustomRegion() {
        const payload = { name: byId('region-form-name')?.value || '', country: byId('region-form-country')?.value || '', city: byId('region-form-city')?.value || '', timezone: byId('region-form-timezone')?.value || 'Asia/Shanghai', locale: byId('region-form-locale')?.value || 'zh-CN', language: byId('region-form-language')?.value || 'zh-CN', default_resolution: byId('region-form-resolution')?.value || '1920 × 1080', network_label: byId('region-form-network')?.value || '', notes: byId('region-form-notes')?.value || '', status: '启用' };
        if (!payload.name) return toast('请输入地区名称', 'error');
        try { await api('/api/regions', { method: 'POST', body: JSON.stringify(payload) }); await loadRegions(); closeModal(); toast('地区已保存', 'success'); } catch (error) { toast(error.message || '保存失败', 'error'); }
    }

    async function deleteRegion(id) { try { await api(`/api/regions/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadRegions(); toast('地区已删除', 'success'); } catch (error) { toast(error.message || '删除失败', 'error'); } }
    async function deleteBrowserProfile(id) { try { await api(`/api/browser-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadBrowserProfiles(); toast('浏览器配置已删除', 'success'); } catch (error) { toast(error.message || '删除失败', 'error'); } }
    async function deleteNetworkProfile(id) { try { await api(`/api/network-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadNetworkProfiles(); toast('网络配置已删除', 'success'); } catch (error) { toast(error.message || '删除失败', 'error'); } }
    async function importProfilesFile(event) { const file = event.target.files?.[0]; if (!file) return; try { const payload = JSON.parse(await file.text()); await api('/api/import', { method: 'POST', body: JSON.stringify(payload) }); await loadProfiles(); toast('导入完成', 'success'); } catch (error) { toast(error.message || '导入失败', 'error'); } finally { event.target.value = ''; } }

    function openDetailDrawer(id) {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) return;
        const fp = fingerprint(profile);
        const proxy = proxyLabel(profile);
        openModal(profile.name || '环境详情', `
            <div class="detail-grid">
                <div class="list-card"><strong>基本信息</strong><p>${esc(profile.id)}<br>${esc(profile.group_name || '未分组')}<br>${esc(profile.status_label || 'normal')}</p></div>
                <div class="list-card"><strong>指纹</strong><p>${esc(fp.summary)}<br>${esc(fp.tz)} / ${esc(fp.lang || 'N/A')}<br>${esc(fp.screen)}</p></div>
                <div class="list-card"><strong>代理</strong><p>${esc(proxy)}</p></div>
            </div>
        `, `<button class="btn btn-secondary" data-action="close-modal">关闭</button><button class="btn btn-success" id="detail-launch">启动</button>`);
        byId('detail-launch')?.addEventListener('click', () => launchProfile(id));
    }

    function closeDetailDrawer() { closeModal(); }

    async function refreshAll() {
        await Promise.all([loadSettings(), loadTemplates(), loadProfiles(), loadRegions(), loadBrowserProfiles(), loadNetworkProfiles(), loadActivityLogs(), refreshActiveState()]);
        renderAll();
        toast('已刷新', 'success');
    }

    function renderAll() {
        renderTable();
        updateSummary();
        updateBulkBar();
    }

    function toast(message, type = 'success') {
        let node = byId('toast');
        if (!node) {
            node = document.createElement('div');
            node.id = 'toast';
            node.className = 'toast';
            document.body.appendChild(node);
        }
        node.textContent = message;
        node.className = `toast ${type} show`;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
    }

    window.addEventListener('DOMContentLoaded', bootstrap, { once: true });
})();
