/**
 * LeonBos SEA Entry
 * Single Executable Application entry point
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// SEA 打包后的资源读取
const sea = require('node:sea');

// 临时目录，用于解压资源
const TEMP_DIR = path.join(require('os').tmpdir(), 'leonbos-' + Date.now());

async function extractResources() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // 解压嵌入的资源
    const resources = [
        'src/ui/public/index.html',
        'database/schema.sql'
    ];

    for (const resource of resources) {
        const destPath = path.join(TEMP_DIR, resource);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        try {
            const content = sea.getAsset(resource, 'utf-8');
            fs.writeFileSync(destPath, content);
        } catch (e) {
            console.log(`[SEA] Resource not embedded: ${resource}`);
        }
    }

    return TEMP_DIR;
}

async function main() {
    console.log('[LeonBos] Starting...');

    // 检查是否在 SEA 模式
    let baseDir = __dirname;
    try {
        if (sea.isSea()) {
            console.log('[LeonBos] Running as SEA');
            baseDir = await extractResources();
        }
    } catch (e) {
        // 非 SEA 模式，使用当前目录
    }

    // 启动 Web UI 服务器
    process.chdir(baseDir);
    
    const WebUIServer = require('./ui/server');
    const server = new WebUIServer();
    await server.start();

    // 等待服务器就绪
    await new Promise(r => setTimeout(r, 1000));

    // 打开浏览器窗口
    const url = 'http://localhost:3000';
    console.log(`[LeonBos] Opening: ${url}`);

    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
        command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    require('child_process').exec(command);

    console.log('[LeonBos] Ready!');
    console.log('[LeonBos] Press Ctrl+C to stop.');

    // 保持运行
    process.stdin.resume();
}

main().catch(err => {
    console.error('[LeonBos] Error:', err);
    process.exit(1);
});
