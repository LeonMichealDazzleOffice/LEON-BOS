const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class Database {
    constructor(dbPath = null) {
        this.dbPath = dbPath || process.env.LEONBOS_DB_PATH || path.join(__dirname, '..', '..', 'database', 'leonbos.db');
        this.db = null;
        this.profileColumns = new Set([
            'id', 'name', 'created_at', 'updated_at',
            'user_agent', 'platform', 'vendor', 'language', 'languages',
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
        this.profileInsertColumns = new Set([...this.profileColumns].filter(col => col !== 'created_at' && col !== 'updated_at'));
        this.profileUpdateColumns = new Set([...this.profileColumns].filter(col => col !== 'id' && col !== 'created_at' && col !== 'updated_at'));
        this.proxyColumns = new Set([
            'id', 'name', 'type', 'host', 'port', 'username', 'password',
            'country_code', 'city', 'is_active', 'last_checked', 'response_time_ms', 'fail_count'
        ]);
        this.regionColumns = new Set([
            'id', 'name', 'country', 'city', 'timezone', 'locale', 'language',
            'default_resolution', 'default_browser_profile', 'network_label', 'notes', 'status', 'is_preset'
        ]);
        this.regionInsertColumns = new Set([...this.regionColumns]);
        this.regionUpdateColumns = new Set([...this.regionColumns].filter(col => col !== 'id' && col !== 'is_preset'));
        this.browserProfileColumns = new Set([
            'id', 'name', 'description', 'user_agent', 'platform', 'language', 'timezone', 'screen_width', 'screen_height', 'is_default', 'is_active'
        ]);
        this.networkProfileColumns = new Set([
            'id', 'name', 'type', 'host', 'port', 'username', 'password', 'region_id', 'notes', 'is_active'
        ]);
        this.mcpServerColumns = new Set([
            'id', 'name', 'transport', 'command', 'args', 'url', 'env', 'description', 'status', 'is_enabled', 'last_checked', 'notes'
        ]);
        this.pluginColumns = new Set([
            'id', 'name', 'category', 'entry', 'version', 'author', 'description', 'config', 'permissions', 'status', 'is_enabled', 'last_checked', 'notes'
        ]);
        this.settingKeyMap = {
            chromePath: 'chrome_path',
            userDataDir: 'user_data_dir',
            defaultLaunchUrl: 'default_launch_url',
            uiViewMode: 'ui_view_mode',
            uiAutoRefreshSeconds: 'ui_auto_refresh_seconds',
            uiTheme: 'ui_theme',
            uiPageSize: 'ui_page_size',
            licenseKey: 'license_key',
            licenseActivatedAt: 'license_activated_at',
            licenseStatus: 'license_status'
        };
    }

    async init() {
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const SQL = await initSqlJs();

        if (fs.existsSync(this.dbPath)) {
            const buf = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buf);
        } else {
            this.db = new SQL.Database();
        }

        console.log('[DB] Connected to', this.dbPath);
        await this.runSchema();
        await this.runMigrations();
        this._save();
        return this;
    }

    async runSchema() {
        const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
            try {
                this.db.run(stmt);
            } catch (e) {
                // Ignore duplicate/errors on re-init
            }
        }
        console.log('[DB] Schema initialized');
    }

    async runMigrations() {
        const profileColumns = {
            group_name: "TEXT DEFAULT ''",
            region_id: "TEXT DEFAULT ''",
            region_name: "TEXT DEFAULT ''",
            region_country: "TEXT DEFAULT ''",
            region_city: "TEXT DEFAULT ''",
            region_status: "TEXT DEFAULT 'Active'",
            network_label: "TEXT DEFAULT ''",
            tags: "TEXT DEFAULT ''",
            remark: "TEXT DEFAULT ''",
            default_url: "TEXT DEFAULT ''",
            status_label: "TEXT DEFAULT 'normal'",
            is_favorite: "BOOLEAN DEFAULT 0",
            is_pinned: "BOOLEAN DEFAULT 0",
            accept_language: "TEXT DEFAULT ''",
            system_locale: "TEXT DEFAULT ''",
            browser_ui_language: "TEXT DEFAULT ''",
            fallback_language: "TEXT DEFAULT ''",
            date_format: "TEXT DEFAULT ''",
            number_format: "TEXT DEFAULT ''",
            currency_format: "TEXT DEFAULT ''",
            keyboard_language: "TEXT DEFAULT ''",
            search_region: "TEXT DEFAULT ''",
            localization_notes: "TEXT DEFAULT ''",
            browser_profile_id: "TEXT DEFAULT ''",
            network_profile_id: "TEXT DEFAULT ''"
        };

        const settingDefaults = {
            default_launch_url: '',
            ui_view_mode: 'card',
            ui_auto_refresh_seconds: '5',
            ui_theme: 'dark',
            ui_page_size: '100'
        };

        const existing = this._all('PRAGMA table_info(profiles)').map(col => col.name);
        for (const [name, definition] of Object.entries(profileColumns)) {
            if (!existing.includes(name)) {
                this.db.run(`ALTER TABLE profiles ADD COLUMN ${name} ${definition}`);
            }
        }

        for (const [key, value] of Object.entries(settingDefaults)) {
            this.db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
        }

        this.db.run(`CREATE TABLE IF NOT EXISTS browser_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            user_agent TEXT DEFAULT '',
            platform TEXT DEFAULT '',
            language TEXT DEFAULT '',
            timezone TEXT DEFAULT '',
            screen_width INTEGER DEFAULT 1920,
            screen_height INTEGER DEFAULT 1080,
            is_default BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS network_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'direct',
            host TEXT DEFAULT '',
            port INTEGER DEFAULT 0,
            username TEXT DEFAULT '',
            password TEXT DEFAULT '',
            region_id TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            summary TEXT DEFAULT '',
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            transport TEXT DEFAULT 'stdio',
            command TEXT DEFAULT '',
            args TEXT DEFAULT '[]',
            url TEXT DEFAULT '',
            env TEXT DEFAULT '{}',
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'idle',
            is_enabled BOOLEAN DEFAULT 1,
            last_checked DATETIME,
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS plugins (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            entry TEXT DEFAULT '',
            version TEXT DEFAULT '0.1.0',
            author TEXT DEFAULT '',
            description TEXT DEFAULT '',
            config TEXT DEFAULT '{}',
            permissions TEXT DEFAULT '[]',
            status TEXT DEFAULT 'installed',
            is_enabled BOOLEAN DEFAULT 1,
            last_checked DATETIME,
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.ensureRegionPresets();
        this.ensureBrowserProfilePresets();
        this.ensureNetworkProfilePresets();
        this.ensureIntegrationPresets();

        console.log('[DB] Migrations applied');
    }

    ensureRegionPresets() {
        const presets = [
            ['asia_shanghai', 'Asia / Shanghai', 'China', 'Shanghai', 'Asia/Shanghai', 'zh-CN', 'zh-CN', '1920 × 1080', 'Chrome 123', 'CN Production', 'Default mainland China regional testing environment.', 'Active', 1],
            ['asia_seoul', 'Asia / Seoul', 'South Korea', 'Seoul', 'Asia/Seoul', 'ko-KR', 'ko-KR', '1920 × 1080', 'Chrome 123', 'KR QA', 'Korean localized browser environment.', 'Active', 1],
            ['asia_tokyo', 'Asia / Tokyo', 'Japan', 'Tokyo', 'Asia/Tokyo', 'ja-JP', 'ja-JP', '1920 × 1080', 'Chrome 123', 'JP Operations', 'Japan regional testing environment.', 'Active', 1],
            ['asia_dubai', 'Asia / Dubai', 'United Arab Emirates', 'Dubai', 'Asia/Dubai', 'ar-AE', 'en-US', '1920 × 1080', 'Chrome 123', 'UAE Operations', 'Middle East regional testing environment.', 'Active', 1],
            ['europe_madrid', 'Europe / Madrid', 'Spain', 'Madrid', 'Europe/Madrid', 'es-ES', 'es-ES', '1920 × 1080', 'Chrome 123', 'EU QA', 'Spanish regional testing environment.', 'Active', 1],
            ['north_america_new_york', 'North America / New York', 'United States', 'New York', 'America/New_York', 'en-US', 'en-US', '1920 × 1080', 'Chrome 123', 'US East', 'US East regional testing environment.', 'Active', 1]
        ];
        for (const preset of presets) {
            this.db.run('INSERT OR IGNORE INTO browser_regions (id, name, country, city, timezone, locale, language, default_resolution, default_browser_profile, network_label, notes, status, is_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', preset);
        }
    }

    ensureBrowserProfilePresets() {
        const presets = [
            ['bp_chrome_cn', 'Chrome CN Desktop', 'Default desktop profile for CN operations', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', 'Win32', 'zh-CN', 'Asia/Shanghai', 1920, 1080, 1, 1],
            ['bp_chrome_us', 'Chrome US Desktop', 'Default desktop profile for US operations', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', 'Win32', 'en-US', 'America/New_York', 1920, 1080, 0, 1]
        ];
        for (const preset of presets) {
            this.db.run('INSERT OR IGNORE INTO browser_profiles (id, name, description, user_agent, platform, language, timezone, screen_width, screen_height, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', preset);
        }
    }

    ensureNetworkProfilePresets() {
        const presets = [
            ['np_direct', 'Direct Network', 'direct', '', 0, '', '', '', 'No proxy route', 1]
        ];
        for (const preset of presets) {
            this.db.run('INSERT OR IGNORE INTO network_profiles (id, name, type, host, port, username, password, region_id, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', preset);
        }
    }

    ensureIntegrationPresets() {
        this.db.run('INSERT OR IGNORE INTO plugins (id, name, category, entry, version, author, description, config, permissions, status, is_enabled, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            'plugin_health_check',
            '系统体检',
            'operations',
            'builtin:health-check',
            '0.1.0',
            'LeonBos',
            '检查 Chrome、数据库、端口、会话和基础配置状态。',
            '{}',
            '["read:settings","read:sessions"]',
            'installed',
            1,
            'Built-in plugin placeholder for future execution runtime.'
        ]);
        this.db.run('INSERT OR IGNORE INTO plugins (id, name, category, entry, version, author, description, config, permissions, status, is_enabled, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            'plugin_proxy_audit',
            '代理审计',
            'network',
            'builtin:proxy-audit',
            '0.1.0',
            'LeonBos',
            '用于后续代理池质量检测和延迟审计。',
            '{}',
            '["read:proxies","write:logs"]',
            'installed',
            1,
            'Built-in plugin placeholder for future execution runtime.'
        ]);
    }

    _save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    _all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    _get(sql, params = []) {
        const rows = this._all(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    _run(sql, params = []) {
        this.db.run(sql, params);
        this._save();
    }

    _filterColumns(input, allowedColumns, { requireAny = true } = {}) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new Error('Invalid data payload');
        }

        const output = {};
        for (const [key, value] of Object.entries(input)) {
            if (allowedColumns.has(key)) {
                output[key] = value;
            }
        }

        if (requireAny && Object.keys(output).length === 0) {
            throw new Error('No valid fields to write');
        }

        return output;
    }

    _buildUpdateStatement(tableName, idColumn, idValue, updates, allowedColumns) {
        const safeUpdates = this._filterColumns(updates, allowedColumns, { requireAny: false });
        const keys = Object.keys(safeUpdates);

        if (keys.length === 0) {
            return null;
        }

        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const values = [...keys.map(key => safeUpdates[key]), idValue];
        return {
            sql: `UPDATE ${tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = ?`,
            values
        };
    }

    // Profile CRUD
    async createProfile(profile) {
        const safeProfile = this._filterColumns(profile, this.profileInsertColumns);
        const columns = Object.keys(safeProfile).join(', ');
        const placeholders = Object.keys(safeProfile).map(() => '?').join(', ');
        const values = Object.values(safeProfile);
        this._run(`INSERT INTO profiles (${columns}) VALUES (${placeholders})`, values);
        return { id: safeProfile.id, changes: 1 };
    }

    async getProfile(id) {
        return this._get('SELECT * FROM profiles WHERE id = ?', [id]);
    }

    async getAllProfiles() {
        return this._all('SELECT * FROM profiles ORDER BY is_pinned DESC, updated_at DESC, created_at DESC');
    }

    async getProfileCount() {
        const row = this._get('SELECT COUNT(*) AS count FROM profiles');
        return Number(row?.count || 0);
    }

    async updateProfile(id, updates) {
        const statement = this._buildUpdateStatement('profiles', 'id', id, updates, this.profileUpdateColumns);
        if (!statement) {
            return { changes: 0 };
        }
        this._run(statement.sql, statement.values);
        return { changes: 1 };
    }

    async batchUpdateProfiles(ids, updates) {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('No profile ids provided');
        }
        const safeUpdates = this._filterColumns(updates, this.profileUpdateColumns, { requireAny: false });
        const keys = Object.keys(safeUpdates);
        if (keys.length === 0) {
            return { changes: 0 };
        }
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const placeholders = ids.map(() => '?').join(', ');
        const values = [...keys.map(key => safeUpdates[key]), ...ids];
        this._run(`UPDATE profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, values);
        return { changes: ids.length };
    }

    async deleteProfile(id) {
        this._run('DELETE FROM profiles WHERE id = ?', [id]);
        return { changes: 1 };
    }

    // Browser Regions
    async getRegions() {
        return this._all('SELECT *, (SELECT COUNT(*) FROM profiles WHERE profiles.region_id = browser_regions.id OR profiles.region_name = browser_regions.name) AS asset_count FROM browser_regions ORDER BY status ASC, is_preset DESC, name ASC');
    }

    // Browser Profile Templates CRUD
    async getBrowserProfiles() {
        return this._all('SELECT * FROM browser_profiles ORDER BY is_default DESC, name ASC');
    }

    async getBrowserProfile(id) {
        return this._get('SELECT * FROM browser_profiles WHERE id = ?', [id]);
    }

    async createBrowserProfile(payload) {
        const safe = this._filterColumns(payload, this.browserProfileColumns);
        const columns = Object.keys(safe).join(', ');
        const placeholders = Object.keys(safe).map(() => '?').join(', ');
        this._run(`INSERT INTO browser_profiles (${columns}) VALUES (${placeholders})`, Object.values(safe));
        await this.logActivity('browser_profile', safe.id, 'create', `Created browser profile ${safe.name || safe.id}`);
        return { id: safe.id, changes: 1 };
    }

    async updateBrowserProfile(id, updates) {
        const safe = this._filterColumns(updates, new Set([...this.browserProfileColumns].filter(col => col !== 'id')), { requireAny: false });
        const keys = Object.keys(safe);
        if (keys.length === 0) {
            return { changes: 0 };
        }
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        this._run(`UPDATE browser_profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(key => safe[key]), id]);
        await this.logActivity('browser_profile', id, 'update', `Updated browser profile ${id}`);
        return { changes: 1 };
    }

    async deleteBrowserProfile(id) {
        this._run('DELETE FROM browser_profiles WHERE id = ?', [id]);
        await this.logActivity('browser_profile', id, 'delete', `Deleted browser profile ${id}`);
        return { changes: 1 };
    }

    // Network Profiles CRUD
    async getNetworkProfiles() {
        return this._all('SELECT * FROM network_profiles ORDER BY is_active DESC, name ASC');
    }

    async getNetworkProfile(id) {
        return this._get('SELECT * FROM network_profiles WHERE id = ?', [id]);
    }

    async createNetworkProfile(payload) {
        const safe = this._filterColumns(payload, this.networkProfileColumns);
        const columns = Object.keys(safe).join(', ');
        const placeholders = Object.keys(safe).map(() => '?').join(', ');
        this._run(`INSERT INTO network_profiles (${columns}) VALUES (${placeholders})`, Object.values(safe));
        await this.logActivity('network_profile', safe.id, 'create', `Created network profile ${safe.name || safe.id}`);
        return { id: safe.id, changes: 1 };
    }

    async updateNetworkProfile(id, updates) {
        const safe = this._filterColumns(updates, new Set([...this.networkProfileColumns].filter(col => col !== 'id')), { requireAny: false });
        const keys = Object.keys(safe);
        if (keys.length === 0) {
            return { changes: 0 };
        }
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        this._run(`UPDATE network_profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(key => safe[key]), id]);
        await this.logActivity('network_profile', id, 'update', `Updated network profile ${id}`);
        return { changes: 1 };
    }

    async deleteNetworkProfile(id) {
        this._run('DELETE FROM network_profiles WHERE id = ?', [id]);
        await this.logActivity('network_profile', id, 'delete', `Deleted network profile ${id}`);
        return { changes: 1 };
    }

    // MCP Servers CRUD
    async getMcpServers() {
        return this._all('SELECT * FROM mcp_servers ORDER BY is_enabled DESC, name ASC');
    }

    async getMcpServer(id) {
        return this._get('SELECT * FROM mcp_servers WHERE id = ?', [id]);
    }

    async createMcpServer(payload) {
        const safe = this._filterColumns(payload, this.mcpServerColumns);
        const columns = Object.keys(safe).join(', ');
        const placeholders = Object.keys(safe).map(() => '?').join(', ');
        this._run(`INSERT INTO mcp_servers (${columns}) VALUES (${placeholders})`, Object.values(safe));
        await this.logActivity('mcp_server', safe.id, 'create', `Created MCP server ${safe.name || safe.id}`);
        return { id: safe.id, changes: 1 };
    }

    async updateMcpServer(id, updates) {
        const safe = this._filterColumns(updates, new Set([...this.mcpServerColumns].filter(col => col !== 'id')), { requireAny: false });
        const keys = Object.keys(safe);
        if (keys.length === 0) return { changes: 0 };
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        this._run(`UPDATE mcp_servers SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(key => safe[key]), id]);
        await this.logActivity('mcp_server', id, 'update', `Updated MCP server ${id}`);
        return { changes: 1 };
    }

    async deleteMcpServer(id) {
        this._run('DELETE FROM mcp_servers WHERE id = ?', [id]);
        await this.logActivity('mcp_server', id, 'delete', `Deleted MCP server ${id}`);
        return { changes: 1 };
    }

    // Plugins CRUD
    async getPlugins() {
        return this._all('SELECT * FROM plugins ORDER BY is_enabled DESC, category ASC, name ASC');
    }

    async getPlugin(id) {
        return this._get('SELECT * FROM plugins WHERE id = ?', [id]);
    }

    async createPlugin(payload) {
        const safe = this._filterColumns(payload, this.pluginColumns);
        const columns = Object.keys(safe).join(', ');
        const placeholders = Object.keys(safe).map(() => '?').join(', ');
        this._run(`INSERT INTO plugins (${columns}) VALUES (${placeholders})`, Object.values(safe));
        await this.logActivity('plugin', safe.id, 'create', `Created plugin ${safe.name || safe.id}`);
        return { id: safe.id, changes: 1 };
    }

    async updatePlugin(id, updates) {
        const safe = this._filterColumns(updates, new Set([...this.pluginColumns].filter(col => col !== 'id')), { requireAny: false });
        const keys = Object.keys(safe);
        if (keys.length === 0) return { changes: 0 };
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        this._run(`UPDATE plugins SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(key => safe[key]), id]);
        await this.logActivity('plugin', id, 'update', `Updated plugin ${id}`);
        return { changes: 1 };
    }

    async deletePlugin(id) {
        this._run('DELETE FROM plugins WHERE id = ?', [id]);
        await this.logActivity('plugin', id, 'delete', `Deleted plugin ${id}`);
        return { changes: 1 };
    }

    async getActivityLogs(limit = 200) {
        return this._all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?', [Number(limit) || 200]);
    }

    async logActivity(entityType, entityId, action, summary, metadata = null) {
        this._run('INSERT INTO activity_logs (entity_type, entity_id, action, summary, metadata) VALUES (?, ?, ?, ?, ?)', [
            entityType,
            entityId,
            action,
            summary || '',
            metadata ? JSON.stringify(metadata) : null
        ]);
        return { changes: 1 };
    }

    async reconcileActiveSessions(activeProfileIds = []) {
        const ids = Array.isArray(activeProfileIds) ? activeProfileIds.filter(Boolean) : [];
        let staleSessions = [];
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(', ');
            staleSessions = this._all(`SELECT id, profile_id FROM session_logs WHERE ended_at IS NULL AND profile_id NOT IN (${placeholders})`, ids);
            this._run(`UPDATE session_logs SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL AND profile_id NOT IN (${placeholders})`, ids);
        } else {
            staleSessions = this._all('SELECT id, profile_id FROM session_logs WHERE ended_at IS NULL');
            this._run('UPDATE session_logs SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL');
        }

        for (const session of staleSessions) {
            await this.logActivity('session', session.profile_id || '', 'stop', `Session reconciled as stopped for asset ${session.profile_id || 'unknown'}`, { logId: session.id, reason: 'reconcile_stale' });
        }

        return { closed: staleSessions.length };
    }

    async getDashboardStats(activeProfileIds = null) {
        const totalAssets = this._get('SELECT COUNT(*) AS count FROM profiles');
        let activeAssets;
        if (Array.isArray(activeProfileIds)) {
            activeAssets = { count: activeProfileIds.length };
        } else {
            activeAssets = this._get('SELECT COUNT(*) AS count FROM session_logs WHERE ended_at IS NULL');
        }
        const totalRegions = this._get('SELECT COUNT(*) AS count FROM browser_regions');
        const totalBrowserProfiles = this._get('SELECT COUNT(*) AS count FROM browser_profiles');
        const totalNetworkProfiles = this._get('SELECT COUNT(*) AS count FROM network_profiles');
        const alerts = this._get("SELECT COUNT(*) AS count FROM profiles WHERE status_label IN ('blocked', 'warmup', 'checking')");
        return {
            totalAssets: Number(totalAssets?.count || 0),
            activeAssets: Number(activeAssets?.count || 0),
            totalRegions: Number(totalRegions?.count || 0),
            totalBrowserProfiles: Number(totalBrowserProfiles?.count || 0),
            totalNetworkProfiles: Number(totalNetworkProfiles?.count || 0),
            alerts: Number(alerts?.count || 0)
        };
    }

    async getRegion(id) {
        return this._get('SELECT * FROM browser_regions WHERE id = ?', [id]);
    }

    async createRegion(region) {
        const safeRegion = this._filterColumns(region, this.regionInsertColumns);
        const columns = Object.keys(safeRegion).join(', ');
        const placeholders = Object.keys(safeRegion).map(() => '?').join(', ');
        this._run(`INSERT INTO browser_regions (${columns}) VALUES (${placeholders})`, Object.values(safeRegion));
        await this.logRegionAudit(safeRegion.id, 'Create Region', `Created regional environment ${safeRegion.name || safeRegion.id}`);
        return { id: safeRegion.id, changes: 1 };
    }

    async updateRegion(id, updates) {
        const safeUpdates = this._filterColumns(updates, this.regionUpdateColumns, { requireAny: false });
        const keys = Object.keys(safeUpdates);
        if (keys.length === 0) {
            return { changes: 0 };
        }
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        this._run(`UPDATE browser_regions SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(key => safeUpdates[key]), id]);
        await this.logRegionAudit(id, 'Edit Region', `Updated regional environment ${id}`);
        return { changes: 1 };
    }

    async deleteRegion(id) {
        this._run('DELETE FROM browser_regions WHERE id = ?', [id]);
        await this.logRegionAudit(id, 'Delete Region', `Deleted regional environment ${id}`);
        return { changes: 1 };
    }

    async duplicateRegion(id, name) {
        const source = await this.getRegion(id);
        if (!source) throw new Error('Region not found');
        const crypto = require('crypto');
        const copy = { ...source, id: crypto.randomUUID(), name: name || `${source.name} Copy`, is_preset: 0 };
        delete copy.created_at;
        delete copy.updated_at;
        delete copy.asset_count;
        return this.createRegion(copy);
    }

    async getRegionUsage(id) {
        const row = this._get('SELECT COUNT(*) AS count FROM profiles WHERE region_id = ? OR region_name = (SELECT name FROM browser_regions WHERE id = ?)', [id, id]);
        return row ? Number(row.count) || 0 : 0;
    }

    async logRegionAudit(regionId, action, summary) {
        this._run('INSERT INTO region_audit_logs (region_id, action, summary) VALUES (?, ?, ?)', [regionId, action, summary]);
        return { changes: 1 };
    }

    async getRegionAuditLogs(regionId = null) {
        if (regionId) return this._all('SELECT * FROM region_audit_logs WHERE region_id = ? ORDER BY created_at DESC LIMIT 100', [regionId]);
        return this._all('SELECT * FROM region_audit_logs ORDER BY created_at DESC LIMIT 100');
    }

    // Fingerprint Templates
    async getFingerprintTemplates(category = null, osType = null) {
        let sql = 'SELECT * FROM fingerprint_templates WHERE 1=1';
        const params = [];
        if (category) { sql += ' AND category = ?'; params.push(category); }
        if (osType) { sql += ' AND os_type = ?'; params.push(osType); }
        return this._all(sql, params);
    }

    async getFingerprintTemplate(id) {
        return this._get('SELECT * FROM fingerprint_templates WHERE id = ?', [id]);
    }

    // Proxies
    async createProxy(proxy) {
        const safeProxy = this._filterColumns(proxy, this.proxyColumns);
        const columns = Object.keys(safeProxy).join(', ');
        const placeholders = Object.keys(safeProxy).map(() => '?').join(', ');
        const values = Object.values(safeProxy);
        this._run(`INSERT INTO proxies (${columns}) VALUES (${placeholders})`, values);
        return { id: safeProxy.id, changes: 1 };
    }

    async getActiveProxies() {
        return this._all('SELECT * FROM proxies WHERE is_active = 1 ORDER BY fail_count ASC');
    }

    // Import / Export
    async replaceProfiles(profiles = []) {
        const imported = [];
        for (const profile of profiles) {
            if (!profile || !profile.id || !profile.name) continue;
            const cleanProfile = { ...profile };
            delete cleanProfile.created_at;
            delete cleanProfile.updated_at;
            await this.createProfile(cleanProfile);
            imported.push(cleanProfile);
        }
        return imported;
    }

    // Settings
    async getSetting(key) {
        const normalizedKey = this.settingKeyMap[key] || key;
        const row = this._get('SELECT value FROM settings WHERE key = ?', [normalizedKey]);
        return row ? row.value : null;
    }

    async setSetting(key, value) {
        const normalizedKey = this.settingKeyMap[key] || key;
        this._run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [normalizedKey, value]
        );
        return { changes: 1 };
    }

    async isActivated() {
        const key = await this.getSetting('license_key');
        const status = await this.getSetting('license_status');
        return Boolean(key && status === 'active');
    }

    normalizeLicenseKey(key) {
        return String(key || '').trim().toUpperCase();
    }

    validateLicenseKey(key) {
        const normalized = this.normalizeLicenseKey(key);
        return /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(normalized);
    }

    async setActivation(key) {
        const normalized = this.normalizeLicenseKey(key);
        await this.setSetting('license_key', normalized);
        await this.setSetting('license_status', 'active');
        await this.setSetting('license_activated_at', new Date().toISOString());
        return normalized;
    }

    // Session Logs
    async logSessionStart(profileId, targetUrl, proxyUsed) {
        this._run(
            'INSERT INTO session_logs (profile_id, target_url, proxy_used) VALUES (?, ?, ?)',
            [profileId, targetUrl, proxyUsed]
        );
        const rows = this._all('SELECT last_insert_rowid() as id');
        await this.logActivity('session', profileId, 'start', `Session started for asset ${profileId}`, { targetUrl, proxyUsed, logId: rows[0].id });
        return { id: rows[0].id };
    }

    async logSessionEnd(logId, fingerprintDetected, profileId = null) {
        this._run(
            'UPDATE session_logs SET ended_at = CURRENT_TIMESTAMP, fingerprint_detected = ? WHERE id = ?',
            [JSON.stringify(fingerprintDetected), logId]
        );
        const session = this._get('SELECT profile_id FROM session_logs WHERE id = ?', [logId]);
        const entityId = profileId || (session && session.profile_id) || '';
        if (entityId) {
            await this.logActivity('session', entityId, 'stop', `Session stopped for asset ${entityId}`, { logId, fingerprintDetected });
        }
        return { changes: 1 };
    }

    close() {
        if (this.db) {
            this._save();
            this.db.close();
            console.log('[DB] Connection closed');
        }
    }
}

module.exports = Database;
