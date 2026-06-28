#!/usr/bin/env node

/**
 * LeonBos CLI
 * Command-line interface for LeonBos Anti-Detect Browser
 */

const ProfileManager = require('./core/manager');

const manager = new ProfileManager();

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        await manager.init();

        switch (command) {
            case 'create':
            case 'new': {
                const options = parseCreateOptions(args.slice(1));
                await manager.createProfile(options);
                break;
            }

            case 'list':
            case 'ls': {
                await manager.listProfiles();
                break;
            }

            case 'show':
            case 'info': {
                const profileId = args[1];
                if (!profileId) {
                    console.error('Usage: leonbos show <profile-id>');
                    process.exit(1);
                }
                await manager.getProfile(profileId);
                break;
            }

            case 'delete':
            case 'rm': {
                const profileId = args[1];
                if (!profileId) {
                    console.error('Usage: leonbos delete <profile-id>');
                    process.exit(1);
                }
                await manager.deleteProfile(profileId);
                break;
            }

            case 'launch':
            case 'start': {
                const profileId = args[1];
                const url = args[2];
                if (!profileId) {
                    console.error('Usage: leonbos launch <profile-id> [url]');
                    process.exit(1);
                }
                await manager.launchProfile(profileId, { targetUrl: url });
                console.log('Browser launched. Press Ctrl+C to stop.');
                // Keep running
                process.on('SIGINT', async () => {
                    console.log('\nShutting down...');
                    await manager.closeProfile(profileId);
                    process.exit(0);
                });
                break;
            }

            case 'stop': {
                const profileId = args[1];
                if (!profileId) {
                    console.error('Usage: leonbos stop <profile-id>');
                    process.exit(1);
                }
                await manager.closeProfile(profileId);
                break;
            }

            case 'templates': {
                await manager.listTemplates();
                break;
            }

            case 'active': {
                await manager.listActiveBrowsers();
                break;
            }

            case 'help':
            case '--help':
            case '-h':
            default: {
                showHelp();
                break;
            }
        }
    } catch (error) {
        console.error('[Error]', error.message);
        process.exit(1);
    }
}

function parseCreateOptions(args) {
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--name':
            case '-n':
                options.name = args[++i];
                break;
            case '--os':
                options.os = args[++i];
                break;
            case '--browser':
            case '-b':
                options.browser = args[++i];
                break;
            case '--template':
            case '-t':
                options.template = args[++i];
                break;
            case '--proxy':
            case '-p':
                options.proxy = args[++i];
                break;
        }
    }
    
    return options;
}

function showHelp() {
    console.log(`
LeonBos - Professional Anti-Detect Browser

Usage: leonbos <command> [options]

Commands:
  create, new          Create a new browser profile
    --name, -n         Profile name
    --os               Operating system (windows|macos|linux)
    --browser, -b      Browser type (chrome|edge)
    --template, -t     Use fingerprint template
    --proxy, -p        Proxy (format: type:host:port:user:pass)

  list, ls             List all profiles
  show, info <id>      Show profile details
  delete, rm <id>      Delete a profile
  launch, start <id>   Launch browser with profile
  stop <id>            Stop browser for profile
  templates            List fingerprint templates
  active               List active browsers
  help                 Show this help

Examples:
  leonbos create --name "My Profile" --os windows
  leonbos create -n "Work Profile" -t win11_chrome_120
  leonbos create -n "Proxy Profile" -p http:127.0.0.1:8080
  leonbos list
  leonbos launch <profile-id> https://example.com
`);
}

main();
