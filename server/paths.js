const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';
const EXEC_DIR = path.dirname(process.execPath);

// APP_ROOT: for static/bundled files (screens, assets, package.json) — inside exe or project root
const APP_ROOT = path.join(__dirname, '..');

// DATA_ROOT: for writable files (data/, ssl/, .env) — always next to exe in pkg mode
const DATA_ROOT = isPkg ? EXEC_DIR : path.join(__dirname, '..');

module.exports = { APP_ROOT, DATA_ROOT, isPkg, EXEC_DIR };
