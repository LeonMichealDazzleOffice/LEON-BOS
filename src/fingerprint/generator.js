/**
 * Fingerprint Generator
 * Generates realistic browser fingerprints for anti-detection
 */

const crypto = require('crypto');

class FingerprintGenerator {
    constructor() {
        this.commonResolutions = [
            { width: 1920, height: 1080 },
            { width: 2560, height: 1440 },
            { width: 3840, height: 2160 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 },
            { width: 1680, height: 1050 },
            { width: 1280, height: 720 }
        ];

        this.timezones = [
            'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
            'America/Toronto', 'America/Vancouver', 'America/Mexico_City',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
            'Europe/Amsterdam', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Stockholm',
            'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
            'Asia/Seoul', 'Asia/Taipei', 'Asia/Bangkok', 'Asia/Dubai',
            'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
        ];

        this.languages = [
            { code: 'en-US', langs: ['en-US', 'en'] },
            { code: 'en-GB', langs: ['en-GB', 'en'] },
            { code: 'zh-CN', langs: ['zh-CN', 'zh', 'en'] },
            { code: 'zh-TW', langs: ['zh-TW', 'zh', 'en'] },
            { code: 'ja-JP', langs: ['ja-JP', 'ja', 'en'] },
            { code: 'ko-KR', langs: ['ko-KR', 'ko', 'en'] },
            { code: 'de-DE', langs: ['de-DE', 'de', 'en'] },
            { code: 'fr-FR', langs: ['fr-FR', 'fr', 'en'] },
            { code: 'es-ES', langs: ['es-ES', 'es', 'en'] },
            { code: 'it-IT', langs: ['it-IT', 'it', 'en'] },
            { code: 'ru-RU', langs: ['ru-RU', 'ru', 'en'] },
            { code: 'pt-BR', langs: ['pt-BR', 'pt', 'en'] }
        ];

        this.webglVendors = {
            windows: [
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (Microsoft Corporation)', renderer: 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)' }
            ],
            macos: [
                { vendor: 'Apple Inc.', renderer: 'Apple M1' },
                { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
                { vendor: 'Apple Inc.', renderer: 'Apple M1 Max' },
                { vendor: 'Apple Inc.', renderer: 'Apple M2' },
                { vendor: 'Apple Inc.', renderer: 'Apple M2 Pro' },
                { vendor: 'Apple Inc.', renderer: 'Apple M3' },
                { vendor: 'Apple Inc.', renderer: 'Apple M3 Pro' },
                { vendor: 'Apple Inc.', renderer: 'Apple M3 Max' },
                { vendor: 'Intel Inc.', renderer: 'Intel Iris Pro Graphics' }
            ],
            linux: [
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 OpenGL 4.5)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 OpenGL 4.5)' },
                { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 OpenGL 4.5)' }
            ]
        };
    }

    /**
     * Generate a complete fingerprint based on template or random
     */
    generate(options = {}) {
        const os = options.os || this._randomChoice(['windows', 'macos', 'linux']);
        const browser = options.browser || 'chrome';
        const resolution = options.resolution || this._randomChoice(this.commonResolutions);
        const lang = this._resolveLanguage(options.language);
        const timezone = options.timezone || this._randomChoice(this.timezones);
        const webgl = this._getWebGL(os);

        const chromeVersion = options.chromeVersion || this._getRandomChromeVersion();
        const userAgent = this._generateUserAgent(os, browser, chromeVersion);

        return {
            id: this._generateId(),
            name: options.name || `Profile ${Date.now()}`,
            
            // Identity
            user_agent: userAgent,
            platform: this._getPlatform(os),
            vendor: this._getVendor(browser),
            language: lang.code,
            languages: JSON.stringify(lang.langs),
            
            // Screen
            screen_width: resolution.width,
            screen_height: resolution.height,
            viewport_width: resolution.width,
            viewport_height: resolution.height - 111, // Account for browser chrome
            color_depth: os === 'macos' ? 30 : 24,
            pixel_ratio: resolution.width >= 2560 ? 2 : 1,
            
            // Hardware
            hardware_concurrency: this._randomInt(4, 16),
            device_memory: this._randomChoice([4, 8, 16, 32]),
            
            // Location
            timezone: timezone,
            geolocation_lat: this._randomLat(),
            geolocation_lon: this._randomLon(),
            
            // WebGL
            webgl_vendor: webgl.vendor,
            webgl_renderer: webgl.renderer,
            webgl_unmasked_vendor: webgl.vendor,
            webgl_unmasked_renderer: webgl.renderer,
            
            // Privacy
            canvas_noise_enabled: true,
            audio_noise_enabled: true,
            webgl_noise_enabled: true,
            webrtc_disabled: true,
            geolocation_override: true
        };
    }

    _resolveLanguage(input) {
        if (!input) return this._randomChoice(this.languages);
        if (typeof input === 'object' && input.code && Array.isArray(input.langs)) return input;
        if (typeof input === 'string') {
            const exact = this.languages.find(item => item.code === input);
            if (exact) return exact;
            const base = input.split('-')[0];
            const similar = this.languages.find(item => item.code.split('-')[0] === base);
            if (similar) return { code: input, langs: [input, base, 'en'] };
            return { code: input, langs: [input, 'en'] };
        }
        return this._randomChoice(this.languages);
    }

    /**
     * Generate from a template
     */
    fromTemplate(templateData) {
        const data = typeof templateData === 'string' ? JSON.parse(templateData) : templateData;
        
        return {
            id: this._generateId(),
            user_agent: data.userAgent,
            platform: data.platform,
            vendor: data.vendor,
            language: data.language,
            languages: JSON.stringify(data.languages),
            screen_width: data.screenWidth,
            screen_height: data.screenHeight,
            viewport_width: data.viewportWidth || data.screenWidth,
            viewport_height: data.viewportHeight || data.screenHeight - 111,
            color_depth: data.colorDepth,
            pixel_ratio: data.pixelRatio,
            hardware_concurrency: data.hardwareConcurrency,
            device_memory: data.deviceMemory,
            timezone: data.timezone,
            webgl_vendor: data.webglVendor,
            webgl_renderer: data.webglRenderer,
            webgl_unmasked_vendor: data.webglUnmaskedVendor || data.webglVendor,
            webgl_unmasked_renderer: data.webglUnmaskedRenderer || data.webglRenderer,
            canvas_noise_enabled: true,
            audio_noise_enabled: true,
            webgl_noise_enabled: true
        };
    }

    _generateUserAgent(os, browser, version) {
        const osStrings = {
            windows: `Windows NT 10.0; Win64; x64`,
            macos: `Macintosh; Intel Mac OS X 10_15_7`,
            linux: `X11; Linux x86_64`
        };

        const base = `Mozilla/5.0 (${osStrings[os]}) AppleWebKit/537.36 (KHTML, like Gecko)`;
        
        if (browser === 'chrome') {
            return `${base} Chrome/${version}.0.0.0 Safari/537.36`;
        } else if (browser === 'edge') {
            return `${base} Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;
        }
        
        return `${base} Chrome/${version}.0.0.0 Safari/537.36`;
    }

    _getPlatform(os) {
        const platforms = {
            windows: 'Win32',
            macos: 'MacIntel',
            linux: 'Linux x86_64'
        };
        return platforms[os] || 'Win32';
    }

    _getVendor(browser) {
        const vendors = {
            chrome: 'Google Inc.',
            edge: 'Microsoft Corporation',
            firefox: '',
            safari: 'Apple Computer, Inc.'
        };
        return vendors[browser] || 'Google Inc.';
    }

    _getWebGL(os) {
        const vendors = this.webglVendors[os] || this.webglVendors.windows;
        return this._randomChoice(vendors);
    }

    _getRandomChromeVersion() {
        // Chrome versions from last 6 months
        const versions = [118, 119, 120, 121, 122, 123, 124, 125];
        return this._randomChoice(versions);
    }

    _randomLat() {
        // Major cities latitude range
        return (Math.random() * 140 - 70).toFixed(6);
    }

    _randomLon() {
        return (Math.random() * 360 - 180).toFixed(6);
    }

    _randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _generateId() {
        return crypto.randomUUID();
    }
}

module.exports = FingerprintGenerator;
