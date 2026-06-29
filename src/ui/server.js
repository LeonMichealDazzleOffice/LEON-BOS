/**
 * LeonBos Web UI Server
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('../core/database');
const FingerprintGenerator = require('../fingerprint/generator');
const BrowserLauncher = require('../core/launcher');

class WebUIServer {
    constructor(port = 0) {
        this.app = express();
        const parsedPort = Number(port);
        this.port = Number.isFinite(parsedPort) ? parsedPort : 0;
        this.appName = 'LeonBos';
        this.appVersion = require('../../package.json').version;
        this.frontendPublicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
        this.legacyPublicDir = path.join(__dirname, 'public');
        this.db = new Database();
        this.generator = new FingerprintGenerator();
        this.launcher = null;
        this.httpServer = null;
        this.profileUpdateFields = new Set([
            'name', 'user_agent', 'platform', 'vendor', 'language', 'languages',
            'accept_language', 'system_locale', 'browser_ui_language', 'fallback_language',
            'date_format', 'number_format', 'currency_format', 'keyboard_language', 'search_region', 'localization_notes',
            'screen_width', 'screen_height', 'viewport_width', 'viewport_height', 'color_depth', 'pixel_ratio',
            'timezone', 'geolocation_lat', 'geolocation_lon',
            'hardware_concurrency', 'device_memory',
            'webgl_vendor', 'webgl_renderer', 'webgl_unmasked_vendor', 'webgl_unmasked_renderer',
            'canvas_noise_enabled', 'audio_noise_enabled', 'webgl_noise_enabled',
            'proxy_type', 'proxy_host', 'proxy_port', 'proxy_username', 'proxy_password',
            'extensions', 'cookie_file', 'local_storage_path',
            'webrtc_disabled', 'notifications_disabled', 'geolocation_override',
            'last_used', 'use_count', 'notes', 'group_name', 'region_id', 'region_name', 'region_country', 'region_city', 'region_status', 'network_label', 'tags', 'remark', 'default_url',
            'status_label', 'is_favorite', 'is_pinned', 'browser_profile_id', 'network_profile_id'
        ]);
        this.profileCreateFields = new Set([
            'id', 'name', 'user_agent', 'platform', 'vendor', 'language', 'languages',
            'accept_language', 'system_locale', 'browser_ui_language', 'fallback_language',
            'date_format', 'number_format', 'currency_format', 'keyboard_language', 'search_region', 'localization_notes',
            'screen_width', 'screen_height', 'viewport_width', 'viewport_height', 'color_depth', 'pixel_ratio',
            'timezone', 'geolocation_lat', 'geolocation_lon',
            'hardware_concurrency', 'device_memory',
            'webgl_vendor', 'webgl_renderer', 'webgl_unmasked_vendor', 'webgl_unmasked_renderer',
            'canvas_noise_enabled', 'audio_noise_enabled', 'webgl_noise_enabled',
            'proxy_type', 'proxy_host', 'proxy_port', 'proxy_username', 'proxy_password',
            'extensions', 'cookie_file', 'local_storage_path',
            'webrtc_disabled', 'notifications_disabled', 'geolocation_override',
            'last_used', 'use_count', 'notes', 'group_name', 'region_id', 'region_name', 'region_country', 'region_city', 'region_status', 'network_label', 'tags', 'remark', 'default_url', 'browser_profile_id', 'network_profile_id',
            'status_label', 'is_favorite', 'is_pinned'
        ]);
        this.mcpServerFields = new Set(['name', 'transport', 'command', 'args', 'url', 'env', 'description', 'status', 'is_enabled', 'last_checked', 'notes']);
        this.pluginFields = new Set(['name', 'category', 'entry', 'version', 'author', 'description', 'config', 'permissions', 'status', 'is_enabled', 'last_checked', 'notes']);
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(this.resolvePublicDir()));
    }

    resolvePublicDir() {
        return require('fs').existsSync(this.frontendPublicDir) ? this.frontendPublicDir : this.legacyPublicDir;
    }

    getAppManifest() {
        return {
            name: this.appName,
            short_name: this.appName,
            version: this.appVersion,
            description: 'LeonBos 企业级反指纹浏览器管理控制台',
            icon: '/logo/leonbos-logo.png',
            docs: '/about'
        };
    }

    sanitizeProfileUpdates(payload) {
        const safe = {};
        for (const [key, value] of Object.entries(payload || {})) {
            if (this.profileUpdateFields.has(key)) {
                safe[key] = value;
            }
        }
        return safe;
    }

    sanitizeProfileCreate(payload) {
        const safe = {};
        for (const [key, value] of Object.entries(payload || {})) {
            if (this.profileCreateFields.has(key)) {
                safe[key] = value;
            }
        }
        return safe;
    }

    sanitizePayload(payload, allowedFields) {
        const safe = {};
        for (const [key, value] of Object.entries(payload || {})) {
            if (allowedFields.has(key)) safe[key] = value;
        }
        return safe;
    }

    normalizeJsonText(value, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        if (typeof value === 'string') {
            JSON.parse(value);
            return value;
        }
        return JSON.stringify(value);
    }

    normalizeMcpPayload(payload) {
        const safe = this.sanitizePayload(payload, this.mcpServerFields);
        if (Object.prototype.hasOwnProperty.call(safe, 'args')) safe.args = this.normalizeJsonText(safe.args, '[]');
        if (Object.prototype.hasOwnProperty.call(safe, 'env')) safe.env = this.normalizeJsonText(safe.env, '{}');
        return safe;
    }

    normalizePluginPayload(payload) {
        const safe = this.sanitizePayload(payload, this.pluginFields);
        if (Object.prototype.hasOwnProperty.call(safe, 'config')) safe.config = this.normalizeJsonText(safe.config, '{}');
        if (Object.prototype.hasOwnProperty.call(safe, 'permissions')) safe.permissions = this.normalizeJsonText(safe.permissions, '[]');
        return safe;
    }

    setupRoutes() {
        // Get all profiles
        this.app.get('/api/profiles', async (req, res) => {
            try {
                const profiles = await this.db.getAllProfiles();
                res.json({ success: true, data: profiles });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get single profile
        this.app.get('/api/profiles/:id', async (req, res) => {
            try {
                const profile = await this.db.getProfile(req.params.id);
                if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
                res.json({ success: true, data: profile });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Create profile
        this.app.post('/api/profiles', async (req, res) => {
            try {
                const options = req.body;
                const profileCount = await this.db.getProfileCount();
                const activated = await this.db.isActivated();
                if (profileCount >= 3 && !activated) {
                    return res.status(400).json({ success: false, code: 'LIMIT_EXCEEDED', message: '免费额度已达 3 个上限，请输入授权密钥激活无限环境' });
                }
                let fingerprint;
                const metaFields = ['group_name', 'region_id', 'region_name', 'region_country', 'region_city', 'region_status', 'network_label', 'tags', 'remark', 'notes', 'default_url', 'status_label', 'is_favorite', 'is_pinned', 'accept_language', 'system_locale', 'browser_ui_language', 'fallback_language', 'date_format', 'number_format', 'currency_format', 'keyboard_language', 'search_region', 'localization_notes'];

                if (options.template) {
                    const template = await this.db.getFingerprintTemplate(options.template);
                    if (!template) return res.status(400).json({ success: false, error: 'Template not found' });
                    fingerprint = this.generator.fromTemplate(template.template_data);
                    if (!fingerprint.name || !String(fingerprint.name).trim()) {
                        const templateLabel = template.name || options.template || 'Template';
                        fingerprint.name = `${templateLabel} ${Date.now()}`;
                    }
                } else {
                    fingerprint = this.generator.generate(options);
                }

                fingerprint = { ...fingerprint, ...this.sanitizeProfileCreate(options) };
                if (options.name) fingerprint.name = options.name;
                if (options.proxy) {
                    fingerprint.proxy_type = options.proxy.type;
                    fingerprint.proxy_host = options.proxy.host;
                    fingerprint.proxy_port = options.proxy.port;
                    fingerprint.proxy_username = options.proxy.username;
                    fingerprint.proxy_password = options.proxy.password;
                }

                for (const field of metaFields) {
                    if (Object.prototype.hasOwnProperty.call(options, field)) {
                        fingerprint[field] = options[field];
                    }
                }

                await this.db.createProfile(fingerprint);
                res.json({ success: true, data: fingerprint });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/auth/activate', async (req, res) => {
            try {
                const key = req.body && req.body.key;
                const normalized = this.db.normalizeLicenseKey(key);
                if (!this.db.validateLicenseKey(normalized)) {
                    return res.status(400).json({ success: false, message: '密钥格式无效' });
                }

                await this.db.setActivation(normalized);
                res.json({ success: true, message: '激活成功！已解除环境创建限制' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Batch create profiles
        this.app.post('/api/profiles/batch', async (req, res) => {
            try {
                const { count = 5, os = '', browser = 'chrome', prefix = 'Profile', template = '', group_name = '', region_id = '', region_name = '', region_country = '', region_city = '', region_status = 'Active', network_label = '', tags = '', remark = '', default_url = '', status_label = 'normal', language = '', timezone = '', accept_language = '', system_locale = '', browser_ui_language = '', fallback_language = '', date_format = '', number_format = '', currency_format = '', keyboard_language = '', search_region = '', localization_notes = '', screen_width = '', screen_height = '', viewport_width = '', viewport_height = '' } = req.body;
                const profileCount = await this.db.getProfileCount();
                const activated = await this.db.isActivated();
                if (!activated && profileCount + Number(count || 0) > 3) {
                    return res.status(400).json({ success: false, code: 'LIMIT_EXCEEDED', message: '免费额度已达 3 个上限，请输入授权密钥激活无限环境' });
                }
                const results = [];

                for (let i = 1; i <= count; i++) {
                    let fingerprint;
                    if (template) {
                        const tpl = await this.db.getFingerprintTemplate(template);
                        if (!tpl) return res.status(400).json({ success: false, error: 'Template not found' });
                        fingerprint = this.generator.fromTemplate(tpl.template_data);
                    } else {
                        fingerprint = this.generator.generate({ os: os || undefined, browser });
                    }
                    
                    fingerprint.name = `${prefix} ${i.toString().padStart(2, '0')}`;
                    fingerprint.group_name = group_name;
                    fingerprint.region_id = region_id;
                    fingerprint.region_name = region_name;
                    fingerprint.region_country = region_country;
                    fingerprint.region_city = region_city;
                    fingerprint.region_status = region_status;
                    fingerprint.network_label = network_label;
                    if (language) fingerprint.language = language;
                    if (timezone) fingerprint.timezone = timezone;
                    if (screen_width) fingerprint.screen_width = Number(screen_width);
                    if (screen_height) fingerprint.screen_height = Number(screen_height);
                    if (viewport_width) fingerprint.viewport_width = Number(viewport_width);
                    if (viewport_height) fingerprint.viewport_height = Number(viewport_height);
                    fingerprint.accept_language = accept_language;
                    fingerprint.system_locale = system_locale;
                    fingerprint.browser_ui_language = browser_ui_language;
                    fingerprint.fallback_language = fallback_language;
                    fingerprint.date_format = date_format;
                    fingerprint.number_format = number_format;
                    fingerprint.currency_format = currency_format;
                    fingerprint.keyboard_language = keyboard_language;
                    fingerprint.search_region = search_region;
                    fingerprint.localization_notes = localization_notes;
                    fingerprint.tags = tags;
                    fingerprint.remark = remark;
                    fingerprint.default_url = default_url;
                    fingerprint.status_label = status_label;
                    await this.db.createProfile(fingerprint);
                    results.push(fingerprint);
                }

                res.json({ success: true, data: results, count: results.length });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Update profile
        this.app.patch('/api/profiles/:id', async (req, res) => {
            try {
                const updates = this.sanitizeProfileUpdates(req.body);
                if (Object.keys(updates).length === 0) {
                    return res.status(400).json({ success: false, error: 'No valid fields to update' });
                }
                await this.db.updateProfile(req.params.id, updates);
                const profile = await this.db.getProfile(req.params.id);
                res.json({ success: true, data: profile });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Clone profile
        this.app.post('/api/profiles/:id/clone', async (req, res) => {
            try {
                const source = await this.db.getProfile(req.params.id);
                if (!source) return res.status(404).json({ success: false, error: 'Profile not found' });

                const clone = { ...source };
                clone.id = this.generator._generateId ? this.generator._generateId() : require('crypto').randomUUID();
                clone.name = (req.body && req.body.name) || ((source.name || 'Profile') + ' 副本');
                delete clone.created_at;
                delete clone.updated_at;
                clone.last_used = null;
                clone.use_count = 0;

                await this.db.createProfile(clone);
                res.json({ success: true, data: clone });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/profiles/batch-bind', async (req, res) => {
            try {
                const { ids = [], browser_profile_id = '', network_profile_id = '' } = req.body || {};
                if (!Array.isArray(ids) || ids.length === 0) {
                    return res.status(400).json({ success: false, error: 'No profiles selected' });
                }
                if (!browser_profile_id && !network_profile_id) {
                    return res.status(400).json({ success: false, error: 'No binding fields provided' });
                }
                const updates = {};
                if (browser_profile_id !== undefined) updates.browser_profile_id = browser_profile_id;
                if (network_profile_id !== undefined) updates.network_profile_id = network_profile_id;
                await this.db.batchUpdateProfiles(ids, updates);
                res.json({ success: true, count: ids.length });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Delete profile
        this.app.delete('/api/profiles/:id', async (req, res) => {
            try {
                if (this.launcher && this.launcher.getActiveBrowser(req.params.id)) {
                    await this.launcher.close(req.params.id);
                }
                await this.db.deleteProfile(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Launch browser
        this.app.post('/api/profiles/:id/launch', async (req, res) => {
            try {
                const profile = await this.db.getProfile(req.params.id);
                const settingsDefaultUrl = await this.db.getSetting('default_launch_url');
                const settingsUserDataDir = await this.db.getSetting('user_data_dir');
                const body = req.body || {};
                const targetUrl = body.url || (profile && profile.default_url) || settingsDefaultUrl || '';
                const browserInfo = await this.launcher.launchProfileInstance({
                    profileId: req.params.id,
                    profile,
                    targetUrl,
                    headless: Boolean(body.headless),
                    localDataPath: body.localDataPath || settingsUserDataDir,
                    chromiumPath: body.chromiumPath || body.chromePath,
                    userAgent: body.userAgent || body.user_agent || (profile && profile.user_agent),
                    acceptLanguage: body.acceptLanguage || body.accept_language || (profile && profile.language),
                    language: body.language || (profile && profile.language),
                    timezone: body.timezone || (profile && profile.timezone),
                    platform: body.platform || (profile && profile.platform),
                    viewportWidth: body.viewportWidth,
                    viewportHeight: body.viewportHeight,
                    windowX: body.windowX,
                    windowY: body.windowY,
                    proxyType: body.proxyType || body.proxy_type || (profile && profile.proxy_type),
                    proxyHost: body.proxyHost || body.proxy_host || (profile && profile.proxy_host),
                    proxyPort: body.proxyPort || body.proxy_port || (profile && profile.proxy_port)
                });
                res.json({ success: true, data: { logId: browserInfo.logId } });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Batch launch
        this.app.post('/api/profiles/batch-launch', async (req, res) => {
            try {
                const { ids = [], url = '' } = req.body;
                const settingsDefaultUrl = await this.db.getSetting('default_launch_url');
                const results = [];

                for (const profileId of ids) {
                    try {
                        const profile = await this.db.getProfile(profileId);
                        const browserInfo = await this.launcher.launch(profileId, {
                            targetUrl: url || (profile && profile.default_url) || settingsDefaultUrl || '',
                            headless: false
                        });
                        results.push({ profileId, success: true, logId: browserInfo.logId });
                    } catch (err) {
                        results.push({ profileId, success: false, error: err.message });
                    }
                }

                res.json({ success: true, data: results });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Close browser
        this.app.post('/api/profiles/:id/close', async (req, res) => {
            try {
                const closed = await this.launcher.close(req.params.id);
                res.json({ success: true, data: { closed } });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Batch close
        this.app.post('/api/profiles/batch-close', async (req, res) => {
            try {
                const { ids = [] } = req.body;
                const results = [];
                for (const profileId of ids) {
                    try {
                        await this.launcher.close(profileId);
                        results.push({ profileId, success: true });
                    } catch (err) {
                        results.push({ profileId, success: false, error: err.message });
                    }
                }
                res.json({ success: true, data: results });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Browser region management
        this.app.get('/api/regions', async (req, res) => {
            try {
                const regions = await this.db.getRegions();
                res.json({ success: true, data: regions });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/regions/audit', async (req, res) => {
            try {
                const logs = await this.db.getRegionAuditLogs(req.query.region_id || null);
                res.json({ success: true, data: logs });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/regions', async (req, res) => {
            try {
                const crypto = require('crypto');
                const payload = { ...req.body, id: req.body.id || crypto.randomUUID(), is_preset: 0 };
                if (!payload.name) return res.status(400).json({ success: false, error: '请输入地区名称' });
                await this.db.createRegion(payload);
                res.json({ success: true, data: await this.db.getRegion(payload.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.patch('/api/regions/:id', async (req, res) => {
            try {
                await this.db.updateRegion(req.params.id, req.body);
                res.json({ success: true, data: await this.db.getRegion(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/regions/:id/duplicate', async (req, res) => {
            try {
                const result = await this.db.duplicateRegion(req.params.id, req.body && req.body.name);
                res.json({ success: true, data: await this.db.getRegion(result.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.delete('/api/regions/:id', async (req, res) => {
            try {
                const region = await this.db.getRegion(req.params.id);
                if (!region) return res.status(404).json({ success: false, error: '地区不存在' });
                if (Number(region.is_preset)) return res.status(400).json({ success: false, error: '预设地区不能删除' });
                const usage = await this.db.getRegionUsage(req.params.id);
                if (usage > 0 && req.query.force !== '1') return res.status(409).json({ success: false, error: `该地区正在被 ${usage} 个资产使用`, usage });
                await this.db.deleteRegion(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Browser profiles CRUD
        this.app.get('/api/browser-profiles', async (req, res) => {
            try {
                const data = await this.db.getBrowserProfiles();
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/browser-profiles/:id', async (req, res) => {
            try {
                const data = await this.db.getBrowserProfile(req.params.id);
                if (!data) return res.status(404).json({ success: false, error: 'Browser profile not found' });
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/browser-profiles', async (req, res) => {
            try {
                const crypto = require('crypto');
                const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
                if (!payload.name) return res.status(400).json({ success: false, error: 'Name is required' });
                await this.db.createBrowserProfile(payload);
                res.json({ success: true, data: await this.db.getBrowserProfile(payload.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.patch('/api/browser-profiles/:id', async (req, res) => {
            try {
                await this.db.updateBrowserProfile(req.params.id, req.body || {});
                res.json({ success: true, data: await this.db.getBrowserProfile(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.delete('/api/browser-profiles/:id', async (req, res) => {
            try {
                await this.db.deleteBrowserProfile(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Network profiles CRUD
        this.app.get('/api/network-profiles', async (req, res) => {
            try {
                const data = await this.db.getNetworkProfiles();
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/network-profiles/:id', async (req, res) => {
            try {
                const data = await this.db.getNetworkProfile(req.params.id);
                if (!data) return res.status(404).json({ success: false, error: 'Network profile not found' });
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/network-profiles', async (req, res) => {
            try {
                const crypto = require('crypto');
                const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
                if (!payload.name) return res.status(400).json({ success: false, error: 'Name is required' });
                await this.db.createNetworkProfile(payload);
                res.json({ success: true, data: await this.db.getNetworkProfile(payload.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.patch('/api/network-profiles/:id', async (req, res) => {
            try {
                await this.db.updateNetworkProfile(req.params.id, req.body || {});
                res.json({ success: true, data: await this.db.getNetworkProfile(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.delete('/api/network-profiles/:id', async (req, res) => {
            try {
                await this.db.deleteNetworkProfile(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // MCP server registry. This MVP stores trusted integration configuration only.
        this.app.get('/api/mcp-servers', async (req, res) => {
            try {
                res.json({ success: true, data: await this.db.getMcpServers() });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/mcp-servers', async (req, res) => {
            try {
                const crypto = require('crypto');
                const payload = { ...this.normalizeMcpPayload(req.body), id: req.body.id || crypto.randomUUID(), status: req.body.status || 'idle' };
                if (!payload.name) return res.status(400).json({ success: false, error: 'Name is required' });
                await this.db.createMcpServer(payload);
                res.json({ success: true, data: await this.db.getMcpServer(payload.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.patch('/api/mcp-servers/:id', async (req, res) => {
            try {
                await this.db.updateMcpServer(req.params.id, this.normalizeMcpPayload(req.body));
                res.json({ success: true, data: await this.db.getMcpServer(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/mcp-servers/:id/check', async (req, res) => {
            try {
                const server = await this.db.getMcpServer(req.params.id);
                if (!server) return res.status(404).json({ success: false, error: 'MCP server not found' });
                const status = Number(server.is_enabled) ? 'ready' : 'disabled';
                await this.db.updateMcpServer(req.params.id, { status, last_checked: new Date().toISOString() });
                res.json({ success: true, data: await this.db.getMcpServer(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.delete('/api/mcp-servers/:id', async (req, res) => {
            try {
                await this.db.deleteMcpServer(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Plugin registry. Execution runtime is intentionally not enabled in this design pass.
        this.app.get('/api/plugins', async (req, res) => {
            try {
                res.json({ success: true, data: await this.db.getPlugins() });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/plugins', async (req, res) => {
            try {
                const crypto = require('crypto');
                const payload = { ...this.normalizePluginPayload(req.body), id: req.body.id || crypto.randomUUID(), status: req.body.status || 'installed' };
                if (!payload.name) return res.status(400).json({ success: false, error: 'Name is required' });
                await this.db.createPlugin(payload);
                res.json({ success: true, data: await this.db.getPlugin(payload.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.patch('/api/plugins/:id', async (req, res) => {
            try {
                await this.db.updatePlugin(req.params.id, this.normalizePluginPayload(req.body));
                res.json({ success: true, data: await this.db.getPlugin(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/plugins/:id/check', async (req, res) => {
            try {
                const plugin = await this.db.getPlugin(req.params.id);
                if (!plugin) return res.status(404).json({ success: false, error: 'Plugin not found' });
                const status = Number(plugin.is_enabled) ? 'ready' : 'disabled';
                await this.db.updatePlugin(req.params.id, { status, last_checked: new Date().toISOString() });
                res.json({ success: true, data: await this.db.getPlugin(req.params.id) });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.delete('/api/plugins/:id', async (req, res) => {
            try {
                await this.db.deletePlugin(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Assets aliases and details
        this.app.get('/api/assets', async (req, res) => {
            try {
                const data = await this.db.getAllProfiles();
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/assets/:id', async (req, res) => {
            try {
                const asset = await this.db.getProfile(req.params.id);
                if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
                const browserProfile = asset.browser_profile_id ? await this.db.getBrowserProfile(asset.browser_profile_id) : null;
                const networkProfile = asset.network_profile_id ? await this.db.getNetworkProfile(asset.network_profile_id) : null;
                const sessions = await this.db._all('SELECT * FROM session_logs WHERE profile_id = ? ORDER BY started_at DESC LIMIT 20', [req.params.id]);
                res.json({ success: true, data: { asset, browserProfile, networkProfile, sessions } });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Activity logs
        this.app.get('/api/activity-logs', async (req, res) => {
            try {
                const data = await this.db.getActivityLogs(Number(req.query.limit || 200));
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Dashboard real stats
        this.app.get('/api/dashboard/stats', async (req, res) => {
            try {
                const activeProfiles = this.launcher ? this.launcher.listActiveBrowsers().map(item => item.profileId) : [];
                await this.db.reconcileActiveSessions(activeProfiles);
                const data = await this.db.getDashboardStats(activeProfiles);
                res.json({ success: true, data });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get templates
        this.app.get('/api/templates', async (req, res) => {
            try {
                const { category, os } = req.query;
                const templates = await this.db.getFingerprintTemplates(category, os);
                res.json({ success: true, data: templates });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get active browsers
        this.app.get('/api/active', async (req, res) => {
            try {
                const active = this.launcher.listActiveBrowsers();
                res.json({ success: true, data: active });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/proxy/check', async (req, res) => {
            try {
                const net = require('net');
                const { type = 'http', host = '', port = 0, timeoutMs = 1500 } = req.body || {};
                const safePort = Number(port);
                const safeTimeout = Math.max(300, Number(timeoutMs) || 1500);

                if (!host || !safePort) {
                    return res.status(400).json({ success: false, error: 'Proxy host and port are required' });
                }

                const startedAt = Date.now();
                const result = await new Promise((resolve) => {
                    const socket = net.createConnection({ host, port: safePort });
                    let settled = false;

                    const finish = (payload) => {
                        if (settled) return;
                        settled = true;
                        try { socket.destroy(); } catch (e) {}
                        resolve(payload);
                    };

                    socket.setTimeout(safeTimeout, () => finish({ ok: false, error: 'timeout' }));
                    socket.once('connect', () => finish({ ok: true, latencyMs: Date.now() - startedAt, type }));
                    socket.once('error', (error) => finish({ ok: false, error: error.message || 'connect_error' }));
                });

                res.json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Export profiles
        this.app.get('/api/export', async (req, res) => {
            try {
                const profiles = await this.db.getAllProfiles();
                const settings = {
                    defaultLaunchUrl: await this.db.getSetting('default_launch_url'),
                    uiViewMode: await this.db.getSetting('ui_view_mode'),
                    uiAutoRefreshSeconds: await this.db.getSetting('ui_auto_refresh_seconds'),
                    uiTheme: await this.db.getSetting('ui_theme'),
                    uiPageSize: await this.db.getSetting('ui_page_size')
                };
                res.json({
                    success: true,
                    exportedAt: new Date().toISOString(),
                    version: 1,
                    settings,
                    profiles
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Import profiles
        this.app.post('/api/import', async (req, res) => {
            try {
                const payload = req.body || {};
                const profiles = Array.isArray(payload) ? payload : (payload.profiles || []);
                const imported = [];
                const skipped = [];
                const crypto = require('crypto');

                for (const source of profiles) {
                    if (!source || typeof source !== 'object') {
                        skipped.push({ reason: 'invalid_payload' });
                        continue;
                    }
                    if (!source.name || !String(source.name).trim()) {
                        skipped.push({ id: source.id || null, reason: 'missing_name' });
                        continue;
                    }
                    const profile = this.sanitizeProfileUpdates(source);
                    profile.id = source.id;
                    profile.name = String(source.name).trim();
                    const exists = profile.id ? await this.db.getProfile(profile.id) : null;
                    if (!profile.id || exists) profile.id = crypto.randomUUID();
                    if (exists) profile.name = `${profile.name} 导入`;
                    delete profile.created_at;
                    delete profile.updated_at;
                    await this.db.createProfile(profile);
                    imported.push(profile);
                }

                const activated = await this.db.isActivated();
                if (!activated) {
                    const total = await this.db.getProfileCount();
                    if (total > 3) {
                        return res.status(400).json({ success: false, code: 'LIMIT_EXCEEDED', message: '免费额度已达 3 个上限，请输入授权密钥激活无限环境' });
                    }
                }

                res.json({ success: true, count: imported.length, skipped: skipped.length, data: imported, skippedItems: skipped });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get settings
        this.app.get('/api/settings', async (req, res) => {
            try {
                const settings = {
                    chromePath: await this.db.getSetting('chrome_path'),
                    userDataDir: await this.db.getSetting('user_data_dir'),
                    defaultLaunchUrl: await this.db.getSetting('default_launch_url'),
                    uiViewMode: await this.db.getSetting('ui_view_mode'),
                    uiAutoRefreshSeconds: await this.db.getSetting('ui_auto_refresh_seconds'),
                    uiTheme: await this.db.getSetting('ui_theme'),
                    uiPageSize: await this.db.getSetting('ui_page_size')
                };
                res.json({ success: true, data: settings });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Update settings
        this.app.patch('/api/settings', async (req, res) => {
            try {
                for (const [key, value] of Object.entries(req.body)) {
                    await this.db.setSetting(key, value);
                }
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/app-info', (req, res) => {
            res.json({
                success: true,
                data: {
                    name: this.appName,
                    version: this.appVersion,
                    tagline: 'Enterprise anti-detect browser control platform',
                    icon: '/logo/leonbos-logo.png'
                }
            });
        });

        this.app.get('/about', (req, res) => {
            res.sendFile(path.join(this.resolvePublicDir(), 'about.html'));
        });

        // Serve main UI
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.resolvePublicDir(), 'index.html'));
        });
    }

    async start() {
        await this.db.init();
        this.launcher = new BrowserLauncher(this.db);
        return this.listenOnAvailablePort(this.port);
    }

    listenOnAvailablePort(port) {
        return new Promise((resolve, reject) => {
            this.httpServer = this.app.listen(port, '127.0.0.1', () => {
                const address = this.httpServer.address();
                this.port = address && address.port ? address.port : this.port;
                console.log(`[WebUI] Server running at http://127.0.0.1:${this.port}`);
                resolve(this);
            });
            this.httpServer.once('error', (error) => {
                this.httpServer = null;
                if (error.code === 'EADDRINUSE') {
                    const nextPort = Number(port) + 1;
                    console.warn(`[WebUI] Port ${port} is in use, trying ${nextPort}...`);
                    this.listenOnAvailablePort(nextPort).then(resolve).catch(reject);
                    return;
                }
                reject(error);
            });
        });
    }

    async stop() {
        if (this.launcher) {
            await this.launcher.closeAll();
        }
        if (this.db) {
            this.db.close();
        }
        if (!this.httpServer) {
            return;
        }
        await new Promise((resolve, reject) => {
            this.httpServer.close((error) => error ? reject(error) : resolve());
        });
        this.httpServer = null;
    }
}

if (require.main === module) {
    const server = new WebUIServer(process.env.PORT !== undefined ? process.env.PORT : 0);
    server.start().catch(console.error);
}

module.exports = WebUIServer;
