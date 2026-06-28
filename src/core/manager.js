/**
 * LeonBos Profile Manager
 * CLI interface for managing browser profiles
 */

const Database = require('./database');
const FingerprintGenerator = require('../fingerprint/generator');
const BrowserLauncher = require('./launcher');

class ProfileManager {
    constructor() {
        this.db = new Database();
        this.generator = new FingerprintGenerator();
        this.launcher = null;
    }

    async init() {
        await this.db.init();
        this.launcher = new BrowserLauncher(this.db);
        console.log('[Manager] Initialized');
    }

    /**
     * Create a new profile
     */
    async createProfile(options = {}) {
        let fingerprint;

        if (options.template) {
            // Use template
            const template = await this.db.getFingerprintTemplate(options.template);
            if (!template) {
                throw new Error(`Template not found: ${options.template}`);
            }
            fingerprint = this.generator.fromTemplate(template.template_data);
            if (!fingerprint.name || !String(fingerprint.name).trim()) {
                const templateLabel = template.name || options.template || 'Template';
                fingerprint.name = `${templateLabel} ${Date.now()}`;
            }
        } else {
            // Generate random
            fingerprint = this.generator.generate({
                os: options.os,
                browser: options.browser,
                name: options.name
            });
        }

        // Override with provided options
        if (options.name) fingerprint.name = options.name;
        if (options.proxy) {
            const [type, host, port, user, pass] = options.proxy.split(':');
            fingerprint.proxy_type = type;
            fingerprint.proxy_host = host;
            fingerprint.proxy_port = parseInt(port);
            if (user) fingerprint.proxy_username = user;
            if (pass) fingerprint.proxy_password = pass;
        }

        await this.db.createProfile(fingerprint);
        console.log(`[Manager] Created profile: ${fingerprint.name} (${fingerprint.id})`);
        return fingerprint;
    }

    /**
     * List all profiles
     */
    async listProfiles() {
        const profiles = await this.db.getAllProfiles();
        
        if (profiles.length === 0) {
            console.log('[Manager] No profiles found');
            return [];
        }

        console.log('\n[Profiles]');
        console.log('-'.repeat(100));
        console.log(`${'ID'.padEnd(36)} ${'Name'.padEnd(20)} ${'OS'.padEnd(12)} ${'Browser'.padEnd(10)} ${'Proxy'.padEnd(8)} ${'Last Used'.padEnd(20)}`);
        console.log('-'.repeat(100));

        for (const p of profiles) {
            const os = this._detectOS(p.user_agent);
            const browser = this._detectBrowser(p.user_agent);
            const proxy = p.proxy_type !== 'none' && p.proxy_host ? 'Yes' : 'No';
            const lastUsed = p.last_used ? new Date(p.last_used).toLocaleString() : 'Never';
            
            console.log(`${p.id.padEnd(36)} ${p.name.padEnd(20)} ${os.padEnd(12)} ${browser.padEnd(10)} ${proxy.padEnd(8)} ${lastUsed.padEnd(20)}`);
        }

        console.log('-'.repeat(100));
        console.log(`Total: ${profiles.length} profiles\n`);
        
        return profiles;
    }

    /**
     * Get profile details
     */
    async getProfile(profileId) {
        const profile = await this.db.getProfile(profileId);
        if (!profile) {
            console.log(`[Manager] Profile not found: ${profileId}`);
            return null;
        }

        console.log('\n[Profile Details]');
        console.log('='.repeat(50));
        console.log(`ID:           ${profile.id}`);
        console.log(`Name:         ${profile.name}`);
        console.log(`Created:      ${new Date(profile.created_at).toLocaleString()}`);
        console.log(`Last Used:    ${profile.last_used ? new Date(profile.last_used).toLocaleString() : 'Never'}`);
        console.log(`Use Count:    ${profile.use_count}`);
        console.log('');
        console.log('[Identity]');
        console.log(`User-Agent:   ${profile.user_agent}`);
        console.log(`Platform:     ${profile.platform}`);
        console.log(`Language:     ${profile.language}`);
        console.log(`Timezone:     ${profile.timezone}`);
        console.log('');
        console.log('[Screen]');
        console.log(`Resolution:   ${profile.screen_width}x${profile.screen_height}`);
        console.log(`Viewport:     ${profile.viewport_width}x${profile.viewport_height}`);
        console.log(`Color Depth:  ${profile.color_depth}`);
        console.log(`Pixel Ratio:  ${profile.pixel_ratio}`);
        console.log('');
        console.log('[Hardware]');
        console.log(`CPU Cores:    ${profile.hardware_concurrency}`);
        console.log(`Memory:       ${profile.device_memory} GB`);
        console.log('');
        console.log('[WebGL]');
        console.log(`Vendor:       ${profile.webgl_vendor}`);
        console.log(`Renderer:     ${profile.webgl_renderer}`);
        console.log('');
        console.log('[Proxy]');
        console.log(`Type:         ${profile.proxy_type || 'none'}`);
        if (profile.proxy_host) {
            console.log(`Address:      ${profile.proxy_host}:${profile.proxy_port}`);
        }
        console.log('');
        console.log('[Protection]');
        console.log(`Canvas Noise: ${profile.canvas_noise_enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`Audio Noise:  ${profile.audio_noise_enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`WebGL Noise:  ${profile.webgl_noise_enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`WebRTC Block: ${profile.webrtc_disabled ? 'Enabled' : 'Disabled'}`);
        console.log('='.repeat(50));

        return profile;
    }

    /**
     * Delete a profile
     */
    async deleteProfile(profileId) {
        // Close if running
        if (this.launcher && this.launcher.getActiveBrowser(profileId)) {
            await this.launcher.close(profileId);
        }

        await this.db.deleteProfile(profileId);
        console.log(`[Manager] Deleted profile: ${profileId}`);
    }

    /**
     * Launch browser with profile
     */
    async launchProfile(profileId, options = {}) {
        return await this.launcher.launch(profileId, options);
    }

    /**
     * Close browser for profile
     */
    async closeProfile(profileId) {
        return await this.launcher.close(profileId);
    }

    /**
     * List available fingerprint templates
     */
    async listTemplates() {
        const templates = await this.db.getFingerprintTemplates();
        
        console.log('\n[Fingerprint Templates]');
        console.log('-'.repeat(80));
        console.log(`${'ID'.padEnd(25)} ${'Name'.padEnd(30)} ${'OS'.padEnd(10)} ${'Browser'.padEnd(10)}`);
        console.log('-'.repeat(80));

        for (const t of templates) {
            console.log(`${t.id.padEnd(25)} ${t.name.padEnd(30)} ${t.os_type.padEnd(10)} ${t.browser_type.padEnd(10)}`);
        }

        console.log('-'.repeat(80));
        console.log(`Total: ${templates.length} templates\n`);
        
        return templates;
    }

    /**
     * List active browsers
     */
    listActiveBrowsers() {
        const active = this.launcher.listActiveBrowsers();
        
        if (active.length === 0) {
            console.log('[Manager] No active browsers');
            return [];
        }

        console.log('\n[Active Browsers]');
        console.log('-'.repeat(80));
        console.log(`${'Profile ID'.padEnd(36)} ${'Log ID'.padEnd(10)} ${'Duration'.padEnd(15)}`);
        console.log('-'.repeat(80));

        for (const b of active) {
            const duration = this._formatDuration(b.duration);
            console.log(`${b.profileId.padEnd(36)} ${String(b.logId).padEnd(10)} ${duration.padEnd(15)}`);
        }

        console.log('-'.repeat(80));
        console.log(`Total: ${active.length} active\n`);
        
        return active;
    }

    _detectOS(userAgent) {
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac')) return 'macOS';
        if (userAgent.includes('Linux')) return 'Linux';
        return 'Unknown';
    }

    _detectBrowser(userAgent) {
        if (userAgent.includes('Edg')) return 'Edge';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        return 'Unknown';
    }

    _formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    async close() {
        await this.launcher.closeAll();
        this.db.close();
    }
}

module.exports = ProfileManager;
