(function () {
    const state = {
        mcpServers: [],
        plugins: []
    };

    function text(value) { return value === undefined || value === null ? '' : String(value); }
    function esc(value) { const div = document.createElement('div'); div.textContent = text(value); return div.innerHTML; }
    function js(value) { return text(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, ''); }
    function toast(message, type = 'success') { if (window.showToast) window.showToast(message, type); }

    async function api(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || '请求失败');
        return result;
    }

    function parseJsonInput(id, fallback) {
        const raw = document.getElementById(id)?.value.trim();
        if (!raw) return fallback;
        JSON.parse(raw);
        return raw;
    }

    async function loadIntegrations() {
        const [mcp, plugins] = await Promise.all([
            api('/api/mcp-servers'),
            api('/api/plugins')
        ]);
        state.mcpServers = mcp.data || [];
        state.plugins = plugins.data || [];
        renderIntegrations();
    }

    function badge(label, className = 'info') {
        return `<span class="status-chip ${className}">${esc(label)}</span>`;
    }

    function statusClass(status) {
        if (status === 'ready' || status === 'installed') return 'ok';
        if (status === 'disabled') return 'muted';
        if (status === 'error') return 'danger';
        return 'info';
    }

    function renderMcpServers() {
        const list = document.getElementById('mcp-server-list');
        if (!list) return;
        list.innerHTML = state.mcpServers.map(server => {
            const enabled = Number(server.is_enabled) ? '启用' : '停用';
            const endpoint = server.transport === 'http' ? server.url : [server.command, server.args].filter(Boolean).join(' ');
            return `<article class="integration-card">
                <div class="integration-main">
                    <div class="integration-title"><strong>${esc(server.name)}</strong>${badge(server.transport || 'stdio')}${badge(server.status || 'idle', statusClass(server.status))}</div>
                    <p>${esc(server.description || server.notes || '暂无说明')}</p>
                    <small>${esc(endpoint || '未配置启动命令或 URL')}</small>
                </div>
                <div class="integration-actions">
                    ${badge(enabled, Number(server.is_enabled) ? 'ok' : 'muted')}
                    <button class="btn btn-secondary" onclick="checkMcpServer('${js(server.id)}')">检测</button>
                    <button class="btn btn-secondary" onclick="toggleMcpServer('${js(server.id)}', ${Number(server.is_enabled) ? 0 : 1})">${Number(server.is_enabled) ? '停用' : '启用'}</button>
                    <button class="btn btn-danger" onclick="deleteMcpServer('${js(server.id)}')">删除</button>
                </div>
            </article>`;
        }).join('') || '<p class="muted-copy">暂无 MCP Server。添加一个 stdio 或 HTTP MCP 连接配置。</p>';
    }

    function renderPlugins() {
        const list = document.getElementById('plugin-list');
        if (!list) return;
        list.innerHTML = state.plugins.map(plugin => {
            const enabled = Number(plugin.is_enabled) ? '启用' : '停用';
            return `<article class="integration-card">
                <div class="integration-main">
                    <div class="integration-title"><strong>${esc(plugin.name)}</strong>${badge(plugin.category || 'general')}${badge(plugin.status || 'installed', statusClass(plugin.status))}</div>
                    <p>${esc(plugin.description || plugin.notes || '暂无说明')}</p>
                    <small>${esc(plugin.entry || '未配置入口')} · v${esc(plugin.version || '0.1.0')}</small>
                </div>
                <div class="integration-actions">
                    ${badge(enabled, Number(plugin.is_enabled) ? 'ok' : 'muted')}
                    <button class="btn btn-secondary" onclick="checkPlugin('${js(plugin.id)}')">检测</button>
                    <button class="btn btn-secondary" onclick="togglePlugin('${js(plugin.id)}', ${Number(plugin.is_enabled) ? 0 : 1})">${Number(plugin.is_enabled) ? '停用' : '启用'}</button>
                    <button class="btn btn-danger" onclick="deletePlugin('${js(plugin.id)}')">删除</button>
                </div>
            </article>`;
        }).join('') || '<p class="muted-copy">暂无插件。添加一个内置插件或本地插件入口。</p>';
    }

    function renderStats() {
        const total = state.mcpServers.length + state.plugins.length;
        const enabled = state.mcpServers.filter(item => Number(item.is_enabled)).length + state.plugins.filter(item => Number(item.is_enabled)).length;
        const ready = state.mcpServers.filter(item => item.status === 'ready').length + state.plugins.filter(item => ['ready', 'installed'].includes(item.status)).length;
        const stats = document.getElementById('integration-stats');
        if (stats) stats.innerHTML = `<span>${total} 个集成</span><span>${enabled} 个启用</span><span>${ready} 个可用/已安装</span>`;
    }

    function renderIntegrations() {
        renderStats();
        renderMcpServers();
        renderPlugins();
    }

    function installIntegrationModal() {
        if (document.getElementById('integrations-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `<div id="integrations-modal" class="modal-overlay">
            <div class="modal integrations-modal large">
                <div class="modal-header"><h2>集成中心</h2><button onclick="hideModal('integrations-modal')">&times;</button></div>
                <div class="modal-body integrations-body">
                    <div class="integration-hero"><div><strong>MCPs & Plugins</strong><p>先注册和治理 MCP Server、插件入口、权限和配置；执行能力后续接入运行时。</p></div><div id="integration-stats" class="integration-stats"></div></div>
                    <div class="integration-tabs"><button class="btn btn-secondary active" onclick="showIntegrationTab('mcp')">MCP Servers</button><button class="btn btn-secondary" onclick="showIntegrationTab('plugins')">Plugins</button></div>
                    <section id="tab-mcp" class="integration-tab active">
                        <div id="mcp-server-list" class="integration-list"></div>
                        <h3>添加 MCP Server</h3>
                        <div class="form-row"><div class="form-group"><label>名称</label><input id="mcp-name" placeholder="例如：Browser Tools MCP"></div><div class="form-group"><label>传输方式</label><select id="mcp-transport"><option value="stdio">stdio</option><option value="http">http</option></select></div></div>
                        <div class="form-row"><div class="form-group"><label>命令</label><input id="mcp-command" placeholder="node / npx / mcp-server"></div><div class="form-group"><label>HTTP URL</label><input id="mcp-url" placeholder="http://127.0.0.1:8787/mcp"></div></div>
                        <div class="form-row"><div class="form-group"><label>参数 JSON</label><textarea id="mcp-args" placeholder='["-y", "@modelcontextprotocol/server-filesystem"]'></textarea></div><div class="form-group"><label>环境变量 JSON</label><textarea id="mcp-env" placeholder='{"TOKEN":"***"}'></textarea></div></div>
                        <div class="form-group"><label>说明</label><textarea id="mcp-description" placeholder="用途、权限边界、负责人"></textarea></div>
                        <button class="btn btn-primary" onclick="saveMcpServer()">保存 MCP Server</button>
                    </section>
                    <section id="tab-plugins" class="integration-tab">
                        <div id="plugin-list" class="integration-list"></div>
                        <h3>添加插件</h3>
                        <div class="form-row"><div class="form-group"><label>名称</label><input id="plugin-name" placeholder="例如：代理质量检测"></div><div class="form-group"><label>分类</label><input id="plugin-category" placeholder="operations / network / automation"></div></div>
                        <div class="form-row"><div class="form-group"><label>入口</label><input id="plugin-entry" placeholder="builtin:health-check 或 plugins/health.js"></div><div class="form-group"><label>版本</label><input id="plugin-version" value="0.1.0"></div></div>
                        <div class="form-row"><div class="form-group"><label>配置 JSON</label><textarea id="plugin-config" placeholder='{"interval":"daily"}'></textarea></div><div class="form-group"><label>权限 JSON</label><textarea id="plugin-permissions" placeholder='["read:profiles"]'></textarea></div></div>
                        <div class="form-group"><label>说明</label><textarea id="plugin-description" placeholder="插件用途、数据权限、操作说明"></textarea></div>
                        <button class="btn btn-primary" onclick="savePlugin()">保存插件</button>
                    </section>
                </div>
                <div class="modal-footer"><button class="btn btn-secondary" onclick="hideModal('integrations-modal')">关闭</button><button class="btn btn-secondary" onclick="loadIntegrations()">刷新</button></div>
            </div>
        </div>`);
    }

    function installToolbarButton() {
        const toolbarActions = document.querySelector('.toolbar-actions-secondary');
        if (!toolbarActions || document.getElementById('integrations-button')) return;
        toolbarActions.insertAdjacentHTML('beforeend', '<button id="integrations-button" class="btn btn-secondary" onclick="showIntegrationsModal()">集成中心</button>');
    }

    window.showIntegrationTab = function (tab) {
        document.querySelectorAll('.integration-tabs .btn').forEach(button => button.classList.remove('active'));
        document.querySelectorAll('.integration-tab').forEach(panel => panel.classList.remove('active'));
        document.querySelector(`.integration-tabs .btn[onclick="showIntegrationTab('${tab}')"]`)?.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
    };

    window.showIntegrationsModal = async function () {
        installIntegrationModal();
        await loadIntegrations();
        document.getElementById('integrations-modal')?.classList.add('show');
    };

    window._showIntegrationsModal = window.showIntegrationsModal;

    window.loadIntegrations = loadIntegrations;

    window.saveMcpServer = async function () {
        try {
            const payload = {
                name: document.getElementById('mcp-name')?.value || '',
                transport: document.getElementById('mcp-transport')?.value || 'stdio',
                command: document.getElementById('mcp-command')?.value || '',
                url: document.getElementById('mcp-url')?.value || '',
                args: parseJsonInput('mcp-args', '[]'),
                env: parseJsonInput('mcp-env', '{}'),
                description: document.getElementById('mcp-description')?.value || '',
                is_enabled: 1
            };
            if (!payload.name) return toast('请输入 MCP Server 名称', 'error');
            await api('/api/mcp-servers', { method: 'POST', body: JSON.stringify(payload) });
            ['mcp-name', 'mcp-command', 'mcp-url', 'mcp-args', 'mcp-env', 'mcp-description'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            await loadIntegrations();
            toast('MCP Server 已保存', 'success');
        } catch (error) { toast(error.message || '保存 MCP Server 失败', 'error'); }
    };

    window.toggleMcpServer = async function (id, enabled) { try { await api(`/api/mcp-servers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_enabled: enabled, status: enabled ? 'idle' : 'disabled' }) }); await loadIntegrations(); toast(enabled ? 'MCP Server 已启用' : 'MCP Server 已停用', 'success'); } catch (error) { toast(error.message, 'error'); } };
    window.checkMcpServer = async function (id) { try { await api(`/api/mcp-servers/${encodeURIComponent(id)}/check`, { method: 'POST', body: '{}' }); await loadIntegrations(); toast('MCP Server 状态已更新', 'success'); } catch (error) { toast(error.message, 'error'); } };
    window.deleteMcpServer = async function (id) { if (!confirm('确定删除该 MCP Server 吗？')) return; try { await api(`/api/mcp-servers/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadIntegrations(); toast('MCP Server 已删除', 'success'); } catch (error) { toast(error.message, 'error'); } };

    window.savePlugin = async function () {
        try {
            const payload = {
                name: document.getElementById('plugin-name')?.value || '',
                category: document.getElementById('plugin-category')?.value || 'general',
                entry: document.getElementById('plugin-entry')?.value || '',
                version: document.getElementById('plugin-version')?.value || '0.1.0',
                config: parseJsonInput('plugin-config', '{}'),
                permissions: parseJsonInput('plugin-permissions', '[]'),
                description: document.getElementById('plugin-description')?.value || '',
                is_enabled: 1
            };
            if (!payload.name) return toast('请输入插件名称', 'error');
            await api('/api/plugins', { method: 'POST', body: JSON.stringify(payload) });
            ['plugin-name', 'plugin-category', 'plugin-entry', 'plugin-config', 'plugin-permissions', 'plugin-description'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const version = document.getElementById('plugin-version'); if (version) version.value = '0.1.0';
            await loadIntegrations();
            toast('插件已保存', 'success');
        } catch (error) { toast(error.message || '保存插件失败', 'error'); }
    };

    window.togglePlugin = async function (id, enabled) { try { await api(`/api/plugins/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_enabled: enabled, status: enabled ? 'installed' : 'disabled' }) }); await loadIntegrations(); toast(enabled ? '插件已启用' : '插件已停用', 'success'); } catch (error) { toast(error.message, 'error'); } };
    window.checkPlugin = async function (id) { try { await api(`/api/plugins/${encodeURIComponent(id)}/check`, { method: 'POST', body: '{}' }); await loadIntegrations(); toast('插件状态已更新', 'success'); } catch (error) { toast(error.message, 'error'); } };
    window.deletePlugin = async function (id) { if (!confirm('确定删除该插件吗？')) return; try { await api(`/api/plugins/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadIntegrations(); toast('插件已删除', 'success'); } catch (error) { toast(error.message, 'error'); } };

    document.addEventListener('DOMContentLoaded', () => {
        installIntegrationModal();
        setTimeout(installToolbarButton, 0);
        setTimeout(loadIntegrations, 250);
    });
})();
