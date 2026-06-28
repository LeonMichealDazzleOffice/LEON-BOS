/**
 * Browser Launcher - CDP Version
 * Launches Chrome directly and controls via Chrome DevTools Protocol
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const CDP = require('chrome-remote-interface');
const WebSocket = require('ws');
const http = require('http');
const { generateInjectionScript } = require('../fingerprint/injector');

class BrowserLauncher {
    constructor(db, settings) {
        this.db = db;
        this.settings = settings;
        this.activeBrowsers = new Map(); // profileId -> { process, ws, profile, logId }
        this.cdpPort = 9222;
    }

    async launchProfileInstance(profileConfig = {}) {
        const profileId = profileConfig.profileId || profileConfig.id;
        if (!profileId) {
            throw new Error('profileId is required');
        }

        const profile = profileConfig.profile || await this.db.getProfile(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        const headless = Boolean(profileConfig.headless);

        if (this.activeBrowsers.has(profileId)) {
            console.log(`[Browser] Profile ${profile.name} already running`);
            return this.activeBrowsers.get(profileId);
        }

        const chromiumPath = profileConfig.chromiumPath || profileConfig.chromePath || await this.db.getSetting('chrome_path') || this._findChrome();
        if (!fs.existsSync(chromiumPath)) {
            throw new Error(`Chromium not found at: ${chromiumPath}`);
        }

        const localDataRoot = profileConfig.localDataPath || await this.db.getSetting('user_data_dir') || path.join(__dirname, '..', '..', 'profiles');
        const userDataDir = path.join(localDataRoot, profileId);
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const cdpPort = profileConfig.cdpPort || await this._findFreePort();
        const proxyValue = profileConfig.proxy || profile.proxy_host || null;

        const args = [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${userDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-renderer-backgrounding',
            '--force-color-profile=srgb',
            '--metrics-recording-only',
            '--safebrowsing-disable-auto-update',
            '--password-store=basic',
            '--use-mock-keychain',
            headless ? '--headless=new' : '',
            headless ? '--disable-gpu' : '',
            `--window-size=${profileConfig.viewportWidth || profile.viewport_width || 1920},${profileConfig.viewportHeight || profile.viewport_height || 1080}`,
            `--window-position=${profileConfig.windowX || 0},${profileConfig.windowY || 0}`,
            `--timezone=${profileConfig.timezone || profile.timezone || 'America/New_York'}`,
            `--lang=${profileConfig.language || profile.language || 'en-US'}`
        ].filter(Boolean);

        if (profileConfig.proxyType || profileConfig.proxyHost || profileConfig.proxyPort || profile.proxy_type) {
            const proxyType = profileConfig.proxyType || profile.proxy_type;
            const proxyHost = profileConfig.proxyHost || profile.proxy_host;
            const proxyPort = profileConfig.proxyPort || profile.proxy_port;
            if (proxyType && proxyHost) {
                args.push(`--proxy-server=${proxyType}://${proxyHost}${proxyPort ? `:${proxyPort}` : ''}`);
            } else if (proxyValue) {
                args.push(`--proxy-server=${proxyValue}`);
            }
        }

        console.log(`[Browser] Launching profile: ${profile.name}`);
        console.log(`[Browser] Chromium path: ${chromiumPath}`);
        console.log(`[Browser] User data dir: ${userDataDir}`);
        console.log(`[Browser] CDP port: ${cdpPort}`);

        const chromeProcess = spawn(chromiumPath, args, {
            detached: false,
            windowsHide: headless ? true : false,
            stdio: 'ignore'
        });

        await this._waitForCDP(cdpPort);

        const client = await CDP({ port: cdpPort });
        const { Page, Runtime, Network } = client;

        await Page.enable();
        await Runtime.enable();

        const injectionScript = generateInjectionScript(profile);
        await Page.addScriptToEvaluateOnNewDocument({ source: injectionScript });

        try {
            const uaPlatform = this._resolveUAPlatform(profile);
            await Network.enable();
            await Network.setUserAgentOverride({
                userAgent: profileConfig.userAgent || profile.user_agent,
                acceptLanguage: profileConfig.acceptLanguage || profile.language,
                platform: profileConfig.platform || uaPlatform
            });
        } catch (e) {
            console.log('[Browser] Network domain not available, skipping UA override');
        }

        const logResult = await this.db.logSessionStart(
            profileId,
            profileConfig.targetUrl || profile.default_url || null,
            args.find(arg => arg.startsWith('--proxy-server=')) || null
        );

        const browserInfo = {
            process: chromeProcess,
            client,
            cdpPort,
            profile,
            logId: logResult.id,
            profileId,
            startTime: Date.now(),
            userDataDir,
            chromiumPath
        };

        this.activeBrowsers.set(profileId, browserInfo);

        if (profileConfig.targetUrl || profile.default_url) {
            await Page.navigate({ url: profileConfig.targetUrl || profile.default_url });
            await Page.loadEventFired();
        }

        await this.db.updateProfile(profileId, {
            last_used: new Date().toISOString(),
            use_count: (profile.use_count || 0) + 1
        });

        chromeProcess.on('exit', (code) => {
            console.log(`[Browser] Chrome exited with code ${code}`);
            this._handleDisconnect(profileId, 'process_exit');
        });

        return browserInfo;
    }

    /**
     * Find available CDP port
     */
    async _findFreePort(startPort = 9222) {
        const net = require('net');
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.on('error', () => {
                resolve(this._findFreePort(startPort + 1));
            });
        });
    }

    /**
     * Launch browser with profile
     */
    async launch(profileId, options = {}) {
        return this.launchProfileInstance({
            profileId,
            profile: await this.db.getProfile(profileId),
            targetUrl: options.targetUrl,
            headless: options.headless,
            windowX: options.windowX,
            windowY: options.windowY,
            localDataPath: options.localDataPath,
            chromiumPath: options.chromiumPath,
            proxyType: options.proxyType,
            proxyHost: options.proxyHost,
            proxyPort: options.proxyPort,
            proxy: options.proxy
        });
    }

    /**
     * Find Chrome executable
     */
    _findChrome() {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
        ];

        for (const chromePath of possiblePaths) {
            if (chromePath && fs.existsSync(chromePath)) {
                return chromePath;
            }
        }

        // Try to find via registry
        try {
            const { execSync } = require('child_process');
            const result = execSync(
                'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
                { encoding: 'utf-8' }
            );
            const match = result.match(/REG_SZ\s+(.+\.exe)/i);
            if (match && fs.existsSync(match[1])) {
                return match[1];
            }
        } catch (e) {
            // Ignore registry errors
        }

        throw new Error('Chrome not found. Please install Chrome or set chrome_path in settings.');
    }

    /**
     * Wait for CDP to be available
     */
    async _waitForCDP(port, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const version = await this._fetchJson(`http://127.0.0.1:${port}/json/version`);
                if (version && version.webSocketDebuggerUrl) {
                    return version;
                }
            } catch (e) {
                // Chrome is still starting. Retry below.
            }
            await new Promise(r => setTimeout(r, 500));
        }
        throw new Error(`CDP not available on port ${port} after ${maxAttempts} attempts`);
    }

    _fetchJson(url) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(body));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            req.setTimeout(1000, () => {
                req.destroy(new Error('CDP readiness check timed out'));
            });
            req.on('error', reject);
        });
    }

    /**
     * Build proxy connection string
     */
    _buildProxyString(profile) {
        const { proxy_type, proxy_host, proxy_port } = profile;
        return `${proxy_type}://${proxy_host}:${proxy_port}`;
    }

    _resolveUAPlatform(profile) {
        if (profile && profile.platform) {
            const normalized = String(profile.platform).trim();
            if (normalized) return normalized;
        }

        const userAgent = (profile && profile.user_agent) ? String(profile.user_agent) : '';
        if (userAgent.includes('Windows')) return 'Win32';
        if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) return 'MacIntel';
        return 'Linux x86_64';
    }

    /**
     * Handle browser disconnect
     */
    async _handleDisconnect(profileId, reason = 'disconnected') {
        const info = this.activeBrowsers.get(profileId);
        if (info) {
            console.log(`[Browser] Profile ${profileId} ${reason}`);
            this.activeBrowsers.delete(profileId);
            
            // Log session end once for both manual close and process exit.
            if (!info.sessionEnded) {
                info.sessionEnded = true;
                try {
                    await this.db.logSessionEnd(info.logId, {
                        duration: Date.now() - info.startTime,
                        reason
                    }, profileId);
                } catch (e) {
                    console.error('[Browser] Failed to log session end:', e.message);
                }
            }

            // Close CDP client.
            try {
                await info.client.close();
            } catch (e) {
                // Ignore errors from already-closed CDP clients.
            }
        }
    }

    /**
     * Close browser for profile
     */
    async close(profileId) {
        const info = this.activeBrowsers.get(profileId);
        if (!info) {
            return false;
        }

        try {
            if (info.client) {
                try {
                    const { Browser } = info.client;
                    if (Browser && Browser.close) {
                        await Browser.close();
                    }
                } catch (e) {
                    // Fall back to process kill below.
                }
            }

            if (info.process && !info.process.killed) {
                info.process.kill();
            }

            await this._handleDisconnect(profileId, 'manual_close');
            console.log(`[Browser] Profile ${profileId} closed`);
            return true;
        } catch (e) {
            console.error('[Browser] Error closing:', e.message);
            return false;
        }
    }

    /**
     * Get active browser info
     */
    getActiveBrowser(profileId) {
        const info = this.activeBrowsers.get(profileId);
        if (!info) return null;
        
        return {
            profileId,
            logId: info.logId,
            startTime: info.startTime,
            duration: Date.now() - info.startTime,
            cdpPort: info.cdpPort
        };
    }

    /**
     * List all active browsers
     */
    listActiveBrowsers() {
        const result = [];
        for (const [profileId, info] of this.activeBrowsers) {
            result.push({
                profileId,
                logId: info.logId,
                startTime: info.startTime,
                duration: Date.now() - info.startTime,
                cdpPort: info.cdpPort
            });
        }
        return result;
    }

    /**
     * Close all browsers
     */
    async closeAll() {
        const promises = [];
        for (const [profileId] of this.activeBrowsers) {
            promises.push(this.close(profileId));
        }
        await Promise.all(promises);
    }
}

module.exports = BrowserLauncher;
