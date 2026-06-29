/**
 * LeonBos Desktop Entry
 * Starts Web UI server and opens browser window
 */

const WebUIServer = require('../backend/server');
const { spawn } = require('child_process');
const path = require('path');

async function main() {
    console.log('[LeonBos] Starting...');
    
    // Start Web UI server
    const server = new WebUIServer();
    await server.start();
    
    // Open browser window
    const url = `http://127.0.0.1:${server.port}`;
    console.log(`[LeonBos] Opening browser: ${url}`);
    
    // Try to open with system default browser
    let command;
    const platform = process.platform;
    
    if (platform === 'win32') {
        command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }
    
    const opener = spawn(command, { shell: true, detached: true, stdio: 'ignore' });
    opener.unref();
    
    console.log('[LeonBos] Ready! Press Ctrl+C to stop.');
    
    // Keep process alive
    process.stdin.resume();
}

main().catch(err => {
    console.error('[LeonBos] Error:', err);
    process.exit(1);
});
