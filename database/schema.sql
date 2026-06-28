-- Database: LeonBos Profiles & Configuration
-- Created: 2024

-- Profiles table: stores each browser profile's configuration
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Browser Identity
    user_agent TEXT,
    platform TEXT,
    vendor TEXT,
    language TEXT,
    languages TEXT, -- JSON array
    accept_language TEXT,
    system_locale TEXT,
    browser_ui_language TEXT,
    fallback_language TEXT,
    date_format TEXT,
    number_format TEXT,
    currency_format TEXT,
    keyboard_language TEXT,
    search_region TEXT,
    localization_notes TEXT,
    
    -- Screen & Viewport
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    color_depth INTEGER,
    pixel_ratio REAL,
    
    -- Time & Location
    timezone TEXT,
    geolocation_lat REAL,
    geolocation_lon REAL,
    
    -- Hardware
    hardware_concurrency INTEGER,
    device_memory INTEGER,
    
    -- WebGL
    webgl_vendor TEXT,
    webgl_renderer TEXT,
    webgl_unmasked_vendor TEXT,
    webgl_unmasked_renderer TEXT,
    
    -- Canvas & Audio
    canvas_noise_enabled BOOLEAN DEFAULT 1,
    audio_noise_enabled BOOLEAN DEFAULT 1,
    webgl_noise_enabled BOOLEAN DEFAULT 1,
    
    -- Network
    proxy_type TEXT, -- 'http', 'socks5', 'socks4', 'none'
    proxy_host TEXT,
    proxy_port INTEGER,
    proxy_username TEXT,
    proxy_password TEXT,
    
    -- Extensions
    extensions TEXT, -- JSON array of extension paths
    
    -- Cookies & Storage
    cookie_file TEXT,
    local_storage_path TEXT,
    
    -- Flags
    webrtc_disabled BOOLEAN DEFAULT 1,
    notifications_disabled BOOLEAN DEFAULT 0,
    geolocation_override BOOLEAN DEFAULT 1,
    
    -- Status & Productivity
    last_used DATETIME,
    use_count INTEGER DEFAULT 0,
    notes TEXT,
    group_name TEXT DEFAULT '',
    region_id TEXT DEFAULT '',
    region_name TEXT DEFAULT '',
    region_country TEXT DEFAULT '',
    region_city TEXT DEFAULT '',
    region_status TEXT DEFAULT 'Active',
    network_label TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    default_url TEXT DEFAULT '',
    browser_profile_id TEXT DEFAULT '',
    network_profile_id TEXT DEFAULT '',
    status_label TEXT DEFAULT 'normal',
    is_favorite BOOLEAN DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0
);

-- Reusable regional environments
CREATE TABLE IF NOT EXISTS browser_regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT DEFAULT '',
    city TEXT DEFAULT '',
    timezone TEXT DEFAULT '',
    locale TEXT DEFAULT '',
    language TEXT DEFAULT '',
    default_resolution TEXT DEFAULT '1920 × 1080',
    default_browser_profile TEXT DEFAULT 'Chrome 123',
    network_label TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'Active',
    is_preset BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Region audit log for enterprise operations
CREATE TABLE IF NOT EXISTS region_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id TEXT,
    action TEXT NOT NULL,
    summary TEXT DEFAULT '',
    actor TEXT DEFAULT 'Operations Administrator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Browser profile presets for assets
CREATE TABLE IF NOT EXISTS browser_profiles (
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
);

-- Network profiles for assets
CREATE TABLE IF NOT EXISTS network_profiles (
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
);

-- Unified activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT DEFAULT '',
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Proxy pools for rotation
CREATE TABLE IF NOT EXISTS proxies (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT NOT NULL, -- 'http', 'socks5', 'socks4'
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT,
    country_code TEXT,
    city TEXT,
    is_active BOOLEAN DEFAULT 1,
    last_checked DATETIME,
    response_time_ms INTEGER,
    fail_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fingerprint templates
CREATE TABLE IF NOT EXISTS fingerprint_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT, -- 'desktop', 'mobile', 'tablet'
    os_type TEXT, -- 'windows', 'macos', 'linux', 'android', 'ios'
    browser_type TEXT, -- 'chrome', 'firefox', 'safari', 'edge'
    
    -- Template data (JSON)
    template_data TEXT NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_builtin BOOLEAN DEFAULT 0
);

-- Session logs
CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    target_url TEXT,
    proxy_used TEXT,
    fingerprint_detected TEXT, -- JSON of detected fingerprint
    notes TEXT,
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('chrome_path', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'),
('user_data_dir', 'C:\\Users\\LeonM\\LeonBos\\profiles'),
('default_proxy_check_url', 'https://ipinfo.io/json'),
('fingerprint_check_url', 'https://bot.sannysoft.com'),
('auto_update_templates', '1'),
('debug_mode', '0'),
('default_launch_url', ''),
('ui_view_mode', 'card'),
('ui_auto_refresh_seconds', '5'),
('ui_theme', 'dark'),
('ui_page_size', '100');

-- Insert built-in regional environment presets
INSERT OR IGNORE INTO browser_regions (id, name, country, city, timezone, locale, language, default_resolution, default_browser_profile, network_label, notes, status, is_preset) VALUES
('asia_shanghai', 'Asia / Shanghai', 'China', 'Shanghai', 'Asia/Shanghai', 'zh-CN', 'zh-CN', '1920 × 1080', 'Chrome 123', 'CN Production', 'Default mainland China regional testing environment.', 'Active', 1),
('asia_seoul', 'Asia / Seoul', 'South Korea', 'Seoul', 'Asia/Seoul', 'ko-KR', 'ko-KR', '1920 × 1080', 'Chrome 123', 'KR QA', 'Korean localized browser environment.', 'Active', 1),
('asia_tokyo', 'Asia / Tokyo', 'Japan', 'Tokyo', 'Asia/Tokyo', 'ja-JP', 'ja-JP', '1920 × 1080', 'Chrome 123', 'JP Operations', 'Japan regional testing environment.', 'Active', 1),
('asia_dubai', 'Asia / Dubai', 'United Arab Emirates', 'Dubai', 'Asia/Dubai', 'ar-AE', 'en-US', '1920 × 1080', 'Chrome 123', 'UAE Operations', 'Middle East regional testing environment.', 'Active', 1),
('europe_madrid', 'Europe / Madrid', 'Spain', 'Madrid', 'Europe/Madrid', 'es-ES', 'es-ES', '1920 × 1080', 'Chrome 123', 'EU QA', 'Spanish regional testing environment.', 'Active', 1),
('north_america_new_york', 'North America / New York', 'United States', 'New York', 'America/New_York', 'en-US', 'en-US', '1920 × 1080', 'Chrome 123', 'US East', 'US East regional testing environment.', 'Active', 1);

-- Insert built-in fingerprint templates
INSERT OR IGNORE INTO fingerprint_templates (id, name, category, os_type, browser_type, template_data, is_builtin) VALUES
('win11_chrome_120', 'Windows 11 + Chrome 120', 'desktop', 'windows', 'chrome', 
 '{"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","platform":"Win32","vendor":"Google Inc.","language":"en-US","languages":["en-US","en"],"screenWidth":1920,"screenHeight":1080,"viewportWidth":1920,"viewportHeight":969,"colorDepth":24,"pixelRatio":1,"hardwareConcurrency":8,"deviceMemory":8,"timezone":"America/New_York","webglVendor":"Google Inc. (NVIDIA)","webglRenderer":"ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)"}', 1),

('win11_edge_120', 'Windows 11 + Edge 120', 'desktop', 'windows', 'edge',
 '{"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0","platform":"Win32","vendor":"Microsoft Corporation","language":"en-US","languages":["en-US","en"],"screenWidth":1920,"screenHeight":1080,"viewportWidth":1920,"viewportHeight":969,"colorDepth":24,"pixelRatio":1,"hardwareConcurrency":8,"deviceMemory":8,"timezone":"America/New_York","webglVendor":"Google Inc. (Microsoft Corporation)","webglRenderer":"ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)"}', 1),

('macos_chrome_120', 'macOS Sonoma + Chrome 120', 'desktop', 'macos', 'chrome',
 '{"userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36","platform":"MacIntel","vendor":"Google Inc.","language":"en-US","languages":["en-US","en"],"screenWidth":2560,"screenHeight":1440,"viewportWidth":2560,"viewportHeight":1334,"colorDepth":30,"pixelRatio":2,"hardwareConcurrency":10,"deviceMemory":8,"timezone":"America/Los_Angeles","webglVendor":"Apple Inc.","webglRenderer":"Apple M1"}', 1);
