/**
 * Fingerprint Injection Script
 * This script is injected into every page to override fingerprint APIs
 */

function generateInjectionScript(fingerprint) {
    const fp = typeof fingerprint === 'string' ? JSON.parse(fingerprint) : fingerprint;
    
    return `
(function() {
    'use strict';
    
    const fp = ${JSON.stringify(fp)};
    const languages = JSON.parse(fp.languages || '["en-US", "en"]');
    const seededRandom = createSeededRandom(fp.id || fp.user_agent || 'leonbos');

    function createSeededRandom(seed) {
        let hash = 2166136261;
        const input = String(seed);
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return function() {
            hash += 0x6D2B79F5;
            let t = hash;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    
    // Utility: Override property
    function overrideProperty(obj, prop, value) {
        try {
            Object.defineProperty(obj, prop, {
                get: () => value,
                configurable: true
            });
        } catch (e) {}
    }
    
    // Utility: Override function
    function overrideFunction(obj, fnName, newFn) {
        try {
            obj[fnName] = newFn;
        } catch (e) {}
    }
    
    // ===== Navigator Overrides =====
    overrideProperty(navigator, 'userAgent', fp.user_agent);
    overrideProperty(navigator, 'platform', fp.platform);
    overrideProperty(navigator, 'vendor', fp.vendor);
    overrideProperty(navigator, 'language', fp.language);
    overrideProperty(navigator, 'languages', languages);
    overrideProperty(navigator, 'hardwareConcurrency', parseInt(fp.hardware_concurrency) || 8);
    overrideProperty(navigator, 'deviceMemory', parseInt(fp.device_memory) || 8);
    overrideProperty(navigator, 'maxTouchPoints', fp.platform === 'MacIntel' ? 0 : 0);
    
    // ===== Screen Overrides =====
    overrideProperty(screen, 'width', parseInt(fp.screen_width));
    overrideProperty(screen, 'height', parseInt(fp.screen_height));
    overrideProperty(screen, 'availWidth', parseInt(fp.screen_width));
    overrideProperty(screen, 'availHeight', parseInt(fp.screen_height) - 40); // Taskbar
    overrideProperty(screen, 'colorDepth', parseInt(fp.color_depth));
    overrideProperty(screen, 'pixelDepth', parseInt(fp.color_depth));
    
    // window.devicePixelRatio
    overrideProperty(window, 'devicePixelRatio', parseFloat(fp.pixel_ratio) || 1);
    
    // ===== Timezone Override =====
    const OriginalDate = window.Date;
    const timezoneOffset = getTimezoneOffset(fp.timezone);
    
    function getTimezoneOffset(tz) {
        try {
            const now = new OriginalDate();
            const tzDate = new OriginalDate(now.toLocaleString('en-US', { timeZone: tz }));
            const utcDate = new OriginalDate(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            return (tzDate - utcDate) / 60000;
        } catch (e) {
            return new OriginalDate().getTimezoneOffset();
        }
    }
    
    // Override Date constructor
    window.Date = function(...args) {
        if (args.length === 0) {
            return new OriginalDate();
        }
        return new OriginalDate(...args);
    };
    
    window.Date.prototype = OriginalDate.prototype;
    window.Date.now = OriginalDate.now;
    window.Date.parse = OriginalDate.parse;
    window.Date.UTC = OriginalDate.UTC;
    
    // Override Intl.DateTimeFormat
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locales, options) {
        const opts = options || {};
        opts.timeZone = fp.timezone;
        return new OriginalDateTimeFormat(locales || fp.language, opts);
    };
    Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
    
    // ===== Canvas Fingerprint Protection =====
    if (fp.canvas_noise_enabled) {
        const canvasNoise = generateNoise();
        
        function generateNoise() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(1, 1);
            // Deterministic noise based on session
            const seed = '${fp.id || Date.now()}';
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
            }
            return (hash % 10) / 100; // Small noise 0-0.1
        }
        
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
            const imageData = originalGetImageData.apply(this, args);
            // Add imperceptible noise
            for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (seededRandom() - 0.5) * 2));
            }
            return imageData;
        };
        
        // Override toDataURL and toBlob
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            // Add subtle noise before export
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (seededRandom() - 0.5) * 2));
                }
                ctx.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args);
        };
    }
    
    // ===== WebGL Fingerprint Protection =====
    if (fp.webgl_noise_enabled) {
        const vendor = fp.webgl_vendor;
        const renderer = fp.webgl_renderer;
        
        function overrideWebGL(gl) {
            if (!gl) return;
            
            const originalGetParameter = gl.getParameter;
            gl.getParameter = function(pname) {
                if (pname === 0x1F00) return vendor; // UNMASKED_VENDOR_WEBGL
                if (pname === 0x1F01) return renderer; // UNMASKED_RENDERER_WEBGL
                if (pname === 0x9245) return vendor; // UNMASKED_VENDOR_WEBGL (alternate)
                if (pname === 0x9246) return renderer; // UNMASKED_RENDERER_WEBGL (alternate)
                return originalGetParameter.call(this, pname);
            };
            
            // Override getSupportedExtensions to be consistent
            const originalGetSupportedExtensions = gl.getSupportedExtensions;
            gl.getSupportedExtensions = function() {
                const exts = originalGetSupportedExtensions.call(this);
                // Filter out some debugging extensions
                return exts.filter(e => !e.includes('debug'));
            };
        }
        
        // Override getContext
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
            const gl = originalGetContext.call(this, contextType, ...args);
            if (contextType === 'webgl' || contextType === 'experimental-webgl' || contextType === 'webgl2') {
                overrideWebGL(gl);
            }
            return gl;
        };
    }
    
    // ===== Audio Fingerprint Protection =====
    if (fp.audio_noise_enabled) {
        const originalCreateOscillator = AudioContext.prototype.createOscillator;
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        
        AudioContext.prototype.createOscillator = function(...args) {
            const osc = originalCreateOscillator.apply(this, args);
            const originalStart = osc.start;
            osc.start = function(...startArgs) {
                // Add subtle frequency variation
                if (osc.frequency) {
                    osc.frequency.value += (seededRandom() - 0.5) * 0.001;
                }
                return originalStart.apply(this, startArgs);
            };
            return osc;
        };
        
        // Override AnalyserNode
        AudioContext.prototype.createAnalyser = function(...args) {
            const analyser = originalCreateAnalyser.apply(this, args);
            const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
            analyser.getFloatFrequencyData = function(array) {
                originalGetFloatFrequencyData.call(this, array);
                // Add imperceptible noise
                for (let i = 0; i < array.length; i++) {
                    array[i] += (seededRandom() - 0.5) * 0.1;
                }
            };
            return analyser;
        };
    }
    
    // ===== WebRTC Leak Protection =====
    if (fp.webrtc_disabled) {
        delete window.RTCPeerConnection;
        delete window.webkitRTCPeerConnection;
        delete window.mozRTCPeerConnection;
        
        Object.defineProperty(window, 'RTCPeerConnection', {
            get: () => undefined,
            configurable: false
        });
    }
    
    // ===== Permissions API Override =====
    if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(permissionDesc) {
            const name = typeof permissionDesc === 'string' ? permissionDesc : permissionDesc.name;
            
            // Deny geolocation if override is enabled
            if (name === 'geolocation' && fp.geolocation_override) {
                return Promise.resolve({
                    state: 'prompt',
                    onchange: null,
                    addEventListener: () => {},
                    removeEventListener: () => {}
                });
            }
            
            return originalQuery.call(this, permissionDesc);
        };
    }
    
    // ===== Geolocation Override =====
    if (fp.geolocation_override && navigator.geolocation) {
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
            const mockPosition = {
                coords: {
                    latitude: parseFloat(fp.geolocation_lat),
                    longitude: parseFloat(fp.geolocation_lon),
                    accuracy: 100,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            };
            
            if (success) {
                setTimeout(() => success(mockPosition), 100);
            }
        };
        
        const originalWatchPosition = navigator.geolocation.watchPosition;
        navigator.geolocation.watchPosition = function(success, error, options) {
            const mockPosition = {
                coords: {
                    latitude: parseFloat(fp.geolocation_lat),
                    longitude: parseFloat(fp.geolocation_lon),
                    accuracy: 100,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            };
            
            if (success) {
                setTimeout(() => success(mockPosition), 100);
            }
            return 1; // watch ID
        };
    }
    
    // ===== Notification Permission =====
    if (window.Notification && fp.notifications_disabled) {
        Object.defineProperty(Notification, 'permission', {
            get: () => 'default',
            configurable: true
        });
        
        const originalRequestPermission = Notification.requestPermission;
        Notification.requestPermission = function() {
            return Promise.resolve('default');
        };
    }
    
    // ===== Plugins & MIME Types =====
    // Chrome should have some plugins
    if (fp.platform === 'Win32') {
        const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        
        Object.setPrototypeOf(plugins, PluginArray.prototype);
        overrideProperty(navigator, 'plugins', plugins);
        
        const mimeTypes = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: plugins[0] },
            { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: plugins[1] },
            { type: 'application/x-nacl', suffixes: '', description: 'Native Client module', enabledPlugin: plugins[2] }
        ];
        
        Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);
        overrideProperty(navigator, 'mimeTypes', mimeTypes);
    }
    
    // ===== Console warning removal =====
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        // Filter out common detection warnings
        const msg = args.join(' ');
        if (msg.includes('automation') || msg.includes('selenium') || msg.includes('webdriver')) {
            return;
        }
        return originalConsoleLog.apply(this, args);
    };
    
    console.log('[LeonBos] Fingerprint protection active');
})();
`;
}

module.exports = { generateInjectionScript };
