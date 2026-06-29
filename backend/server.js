const fs = require('fs');
const path = require('path');

const backendRoot = __dirname;
const defaultDataDir = process.env.LEONBOS_DATA_DIR
    || (process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Public', 'AppData', 'Roaming'), 'LeonBos')
        : path.join(process.env.HOME || '/tmp', '.local', 'share', 'leonbos'));

if (!process.env.LEONBOS_DB_PATH) {
    process.env.LEONBOS_DB_PATH = path.join(defaultDataDir, 'database', 'leonbos.db');
}

if (!fs.existsSync(path.dirname(process.env.LEONBOS_DB_PATH))) {
    fs.mkdirSync(path.dirname(process.env.LEONBOS_DB_PATH), { recursive: true });
}

module.exports = require(path.join(backendRoot, '..', 'src', 'ui', 'server'));
