'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');

const { APP_ROOT: ROOT, DATA_ROOT } = require('../paths');
const DATA_DIR = path.join(DATA_ROOT, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'update-status.json');
const LOG_FILE = path.join(DATA_DIR, 'update-log.txt');
const BACKUP_DIR = path.join(DATA_ROOT, 'backup');

const _pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const APP_VERSION = _pkg.version || '0.0.0';
const GITHUB_OWNER = (_pkg.github || {}).owner;
const GITHUB_REPO  = (_pkg.github || {}).repo;

// ── in-memory progress state ──────────────────────────────────────────────────
let updateProgress = {
  inProgress: false,
  currentStep: null,
  stepLabel: '',
  percent: 0,
  steps: [],
  downloadedBytes: 0,
  totalBytes: 0,
  downloadDone: false,
  downloadedFilePath: null,
};

const STEPS = [
  { id: 'backup',     label: { ar: 'إنشاء نسخة احتياطية',       en: 'Creating backup' } },
  { id: 'downloading',label: { ar: 'جارٍ تنزيل التحديث',         en: 'Downloading update' } },
  { id: 'verify',     label: { ar: 'التحقق من سلامة الملفات',    en: 'Verifying files' } },
  { id: 'replace',    label: { ar: 'استبدال الملفات',             en: 'Replacing files' } },
  { id: 'migrate',    label: { ar: 'تحديث قاعدة البيانات',       en: 'Updating database' } },
  { id: 'restart',    label: { ar: 'إعادة التشغيل',              en: 'Restarting' } },
];

function buildSteps(activeId) {
  let found = false;
  return STEPS.map(s => {
    let status;
    if (s.id === activeId) { found = true; status = 'active'; }
    else if (!found) status = 'done';
    else status = 'pending';
    return { id: s.id, label: s.label.ar, status };
  });
}

function setProgress(stepId, percent, extra = {}) {
  const step = STEPS.find(s => s.id === stepId);
  updateProgress = {
    inProgress: true,
    currentStep: stepId,
    stepLabel: step ? step.label.ar : stepId,
    percent,
    steps: buildSteps(stepId),
    downloadedBytes: extra.downloadedBytes ?? updateProgress.downloadedBytes,
    totalBytes: extra.totalBytes ?? updateProgress.totalBytes,
    downloadDone: updateProgress.downloadDone,
    downloadedFilePath: updateProgress.downloadedFilePath,
  };
}

function clearProgress() {
  updateProgress = { inProgress: false, currentStep: null, stepLabel: '', percent: 0, steps: [], downloadedBytes: 0, totalBytes: 0, downloadDone: false, downloadedFilePath: null };
}

// ── logging ───────────────────────────────────────────────────────────────────
function logEvent(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (_) {}
  if (level === 'ERROR') console.error('[update]', message);
  else console.log('[update]', message);
}

// ── status file helpers ───────────────────────────────────────────────────────
function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch (_) { return null; }
}

function writeStatus(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { logEvent('ERROR', `writeStatus failed: ${e.message}`); }
}

// ── semver compare (returns true if b > a) ────────────────────────────────────
function isNewer(current, latest) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number);
  const [ca, cb, cc] = parse(current);
  const [la, lb, lc] = parse(latest);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

// ── GitHub API call ───────────────────────────────────────────────────────────
function githubGet(urlStr, etag, _redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const proto = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      headers: {
        'User-Agent': `laundry-app/${APP_VERSION}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    };
    if (etag) opts.headers['If-None-Match'] = etag;

    proto.get(opts, res => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        if (_redirectCount >= 5) { reject(new Error('خطأ في الاتصال: إعادة توجيه متكررة')); return; }
        res.resume();
        githubGet(res.headers.location, null, _redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject).on('timeout', () => reject(new Error('انتهت مهلة الاتصال بـ GitHub')));
  });
}

// ── T005: checkForUpdate ──────────────────────────────────────────────────────
async function checkForUpdate(force = false) {
  const currentVersion = APP_VERSION;
  const owner = GITHUB_OWNER;
  const repo  = GITHUB_REPO;
  if (!owner || !repo) throw Object.assign(new Error('لم يتم تهيئة إعدادات GitHub في البرنامج'), { code: 'UPDATE_CHECK_FAILED' });

  const cached = readStatus();
  const CACHE_TTL_MS = 60 * 60 * 1000;
  if (!force && cached && cached.lastChecked) {
    const age = Date.now() - new Date(cached.lastChecked).getTime();
    if (age < CACHE_TTL_MS) {
      const latestCached = cached.latestVersion || currentVersion;
      const hasUpdateNow = isNewer(currentVersion, latestCached);
      logEvent('INFO', `Update check: using cache (age ${Math.round(age / 60000)}min) hasUpdate=${hasUpdateNow}`);
      return {
        hasUpdate: hasUpdateNow,
        currentVersion,
        latestVersion: latestCached,
        releaseNotes: cached.releaseNotes,
        publishedAt: cached.publishedAt,
        downloadUrl: cached.downloadUrl,
        checksumUrl: cached.checksumUrl,
        assetSize: cached.assetSize || null,
        lastChecked: cached.lastChecked,
      };
    }
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  let res;
  try {
    res = await githubGet(url, cached && cached._etag);
  } catch (e) {
    throw Object.assign(new Error('تعذّر الاتصال بـ GitHub للتحقق من التحديثات'), { code: 'UPDATE_CHECK_FAILED' });
  }

  if (res.status === 403 || res.status === 429) {
    logEvent('WARN', `GitHub API rate limit: ${res.status}`);
    return cached ? { ...cached, currentVersion } : { hasUpdate: false, currentVersion, latestVersion: currentVersion, lastChecked: cached?.lastChecked || null };
  }

  if (res.status === 304 && cached) {
    const hasUpdate = isNewer(currentVersion, cached.latestVersion);
    logEvent('INFO', `Update check: 304 Not Modified, using cache hasUpdate=${hasUpdate}`);
    cached.lastChecked = new Date().toISOString();
    cached.hasUpdate = hasUpdate;
    writeStatus(cached);
    return { hasUpdate, currentVersion, latestVersion: cached.latestVersion, releaseNotes: cached.releaseNotes, publishedAt: cached.publishedAt, downloadUrl: cached.downloadUrl, checksumUrl: cached.checksumUrl, lastChecked: cached.lastChecked };
  }

  if (res.status === 404) {
    // No releases published yet — treat as up to date
    const status = {
      lastChecked: new Date().toISOString(),
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseNotes: '',
      downloadUrl: null,
      checksumUrl: null,
      publishedAt: null,
      lastUpdateResult: cached && cached.lastUpdateResult ? cached.lastUpdateResult : null,
      _etag: null,
    };
    writeStatus(status);
    logEvent('INFO', `Update check: no releases found on GitHub (404)`);
    return { hasUpdate: false, currentVersion, latestVersion: currentVersion, lastChecked: status.lastChecked };
  }

  if (res.status !== 200) {
    throw Object.assign(new Error(`خطأ في الاتصال بـ GitHub (${res.status})`), { code: 'UPDATE_CHECK_FAILED' });
  }

  let release;
  try { release = JSON.parse(res.body); } catch (_) { throw Object.assign(new Error('Invalid GitHub API response'), { code: 'UPDATE_CHECK_FAILED' }); }

  const latestVersion = (release.tag_name || '').replace(/^v/, '');
  const hasUpdate = isNewer(currentVersion, latestVersion);

  // Prefer the full Inno Setup installer (shows a real install wizard + updates
  // the Control Panel version). Fall back to the bare pkg exe for old releases.
  const assets = release.assets || [];
  const setupAsset = assets.find(a => /setup.*\.exe$/i.test(a.name));
  const bareAsset  = assets.find(a => a.name.startsWith('laundry-app-v') && a.name.endsWith('.exe'));
  const exeAsset   = setupAsset || bareAsset;
  const csumAsset  = assets.find(a => a.name === 'sha256sums.txt');

  const status = {
    lastChecked: new Date().toISOString(),
    currentVersion,
    latestVersion,
    hasUpdate,
    releaseNotes: release.body || '',
    downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
    assetName: exeAsset ? exeAsset.name : null,
    isInstaller: !!setupAsset,
    checksumUrl: csumAsset ? csumAsset.browser_download_url : null,
    assetSize: exeAsset ? (exeAsset.size || null) : null,
    publishedAt: release.published_at || null,
    lastUpdateResult: cached && cached.lastUpdateResult ? cached.lastUpdateResult : null,
    _etag: res.headers.etag || null,
  };

  writeStatus(status);
  logEvent('INFO', `Update check: current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate}`);

  return { hasUpdate, currentVersion, latestVersion, releaseNotes: status.releaseNotes, publishedAt: status.publishedAt, downloadUrl: status.downloadUrl, checksumUrl: status.checksumUrl, assetSize: status.assetSize, lastChecked: status.lastChecked };
}

// ── T006: getUpdateStatus ─────────────────────────────────────────────────────
function getUpdateStatus() {
  const cached = readStatus();
  return {
    currentVersion: APP_VERSION,
    hasUpdate: cached ? (cached.hasUpdate || false) : false,
    latestVersion: cached ? (cached.latestVersion || pkg.version) : pkg.version,
    lastChecked: cached ? cached.lastChecked : null,
    lastUpdateResult: cached ? (cached.lastUpdateResult || null) : null,
    assetSize: cached ? (cached.assetSize || null) : null,
  };
}

// ── T015: getProgress ─────────────────────────────────────────────────────────
function getProgress() {
  return { ...updateProgress };
}

// ── T011: disk-space pre-flight ───────────────────────────────────────────────
async function checkDiskSpace(requiredBytes) {
  return new Promise((resolve) => {
    // Use PowerShell to get free space on root drive
    const ps = spawn('powershell.exe', ['-NoProfile', '-Command',
      `(Get-PSDrive -Name (Split-Path -Qualifier '${ROOT.replace(/\\/g, '\\\\')}').TrimEnd(':')  -ErrorAction SilentlyContinue).Free`
    ]);
    let out = '';
    ps.stdout.on('data', d => out += d);
    ps.on('close', () => {
      const free = parseInt(out.trim(), 10);
      if (isNaN(free)) { resolve({ ok: true }); return; } // can't determine, allow
      resolve({ ok: free >= requiredBytes, free, required: requiredBytes });
    });
    ps.on('error', () => resolve({ ok: true }));
  });
}

// ── T012: createBackup ────────────────────────────────────────────────────────
async function createBackup(targetVersion) {
  const backupPath = path.join(BACKUP_DIR, `pre-${targetVersion}`);
  const srcBackupPath = path.join(backupPath, 'source');
  fs.mkdirSync(srcBackupPath, { recursive: true });

  // copy source dirs (exclude data/, .env, ssl/, backup/, node_modules/, specs/)
  const EXCLUDE = new Set(['data', '.env', 'ssl', 'backup', 'node_modules', 'specs', '.git', '.specify']);
  const entries = fs.readdirSync(ROOT);
  for (const entry of entries) {
    if (EXCLUDE.has(entry) || entry.startsWith('.env')) continue;
    const src = path.join(ROOT, entry);
    const dest = path.join(srcBackupPath, entry);
    try { copyRecursive(src, dest); } catch (_) {}
  }

  // DB backup via mysqldump or fallback
  const dbBackupPath = path.join(backupPath, 'db-backup.sql');
  await dumpDatabase(dbBackupPath);

  // meta
  fs.writeFileSync(path.join(backupPath, 'meta.json'), JSON.stringify({ fromVersion: readStatus()?.currentVersion || '?', toVersion: targetVersion, timestamp: new Date().toISOString() }, null, 2));
  logEvent('INFO', `Backup created: ${backupPath}`);
  return backupPath;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function dumpDatabase(destPath) {
  return new Promise(resolve => {
    const env = process.env;
    const args = [
      `--host=${env.DB_HOST || 'localhost'}`,
      `--port=${env.DB_PORT || '3306'}`,
      `--user=${env.DB_USER || 'root'}`,
      `--password=${env.DB_PASS || env.DB_PASSWORD || ''}`,
      '--single-transaction', '--routines', '--triggers',
      env.DB_NAME || 'laundry',
    ];
    execFile('mysqldump', args, { maxBuffer: 100 * 1024 * 1024 }, (err, stdout) => {
      if (!err) {
        fs.writeFileSync(destPath, stdout, 'utf8');
        logEvent('INFO', `DB backup created: ${destPath}`);
        resolve();
      } else {
        logEvent('WARN', `mysqldump failed (${err.message}), using fallback`);
        fs.writeFileSync(destPath, '-- mysqldump unavailable\n', 'utf8');
        resolve();
      }
    });
  });
}

// ── T013: downloadWithProgress ────────────────────────────────────────────────
function downloadWithProgress(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proto = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      headers: { 'User-Agent': `laundry-app/${APP_VERSION}` },
      timeout: 120000,
    };
    const req = proto.get(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadWithProgress(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { reject(new Error(`فشل التنزيل (HTTP ${res.statusCode}) — تحقق من الإنترنت وأعد المحاولة`)); return; }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(destPath);
      res.on('data', chunk => {
        received += chunk.length;
        if (onProgress) onProgress(total > 0 ? Math.round(received * 100 / total) : 0, received, total);
      });
      res.pipe(out);
      out.on('finish', () => { logEvent('INFO', `Download complete: ${destPath} (${received} bytes)`); resolve(); });
      out.on('error', err => { try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    });
    req.on('error', err => { try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('انتهت مهلة التنزيل — تحقق من سرعة الإنترنت وأعد المحاولة')); });
  });
}

// ── T014: verifySha256 ────────────────────────────────────────────────────────
async function verifySha256(filePath, checksumUrl) {
  let csumBody;
  try {
    const res = await githubGet(checksumUrl, null);
    if (res.status !== 200) {
      logEvent('WARN', `Checksum fetch failed (HTTP ${res.status}) — skipping verification`);
      return;
    }
    csumBody = res.body;
  } catch (e) {
    logEvent('WARN', `Checksum download failed (${e.message}) — skipping verification`);
    return;
  }
  const lines = csumBody.split('\n').filter(Boolean);
  const fileName = path.basename(filePath);
  const line = lines.find(l => l.toLowerCase().includes(fileName.toLowerCase()));
  if (!line) {
    logEvent('WARN', `Checksum entry not found for ${fileName} — skipping verification`);
    return;
  }
  const expectedHash = line.split(/\s+/)[0].toLowerCase();
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actualHash !== expectedHash) throw Object.assign(new Error('فشل التحقق من سلامة ملف التحديث'), { code: 'CHECKSUM_MISMATCH' });
  logEvent('INFO', 'Checksum verified: OK');
}

// ── spawnUpdater: register updater.ps1 as a Scheduled Task so it survives
// the Node process exit (detached spawn stays inside the NSSM job object and
// gets killed the moment this process exits — Task Scheduler owns the task).
function spawnUpdater({ targetVersion, fromVersion, newExePath, backupPath }) {
  const srcUpdater = path.join(ROOT, 'scripts', 'updater.ps1');
  const srcLaunch  = path.join(ROOT, 'scripts', 'launch-updater.ps1');
  if (!fs.existsSync(srcUpdater)) throw new Error(`updater.ps1 غير موجود: ${srcUpdater}`);
  if (!fs.existsSync(srcLaunch))  throw new Error(`launch-updater.ps1 غير موجود: ${srcLaunch}`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const updaterScript = path.join(DATA_DIR, '_updater.ps1');
  const launchScript  = path.join(DATA_DIR, '_launch-updater.ps1');
  fs.copyFileSync(srcUpdater, updaterScript);
  fs.copyFileSync(srcLaunch,  launchScript);

  execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launchScript,
    '-UpdaterScript', updaterScript,
    '-ServerPid',     String(process.pid),
    '-TargetVersion', targetVersion,
    '-FromVersion',   fromVersion,
    '-NewExePath',    newExePath,
    '-BackupPath',    backupPath,
    '-AppRoot',       DATA_ROOT,
  ], { stdio: 'ignore', windowsHide: true, timeout: 30000 });
}

// ── T016: performUpdate ───────────────────────────────────────────────────────
let updateInProgress = false;

async function performUpdate() {
  if (updateInProgress) throw Object.assign(new Error('يجري تحديث بالفعل'), { code: 'UPDATE_ALREADY_IN_PROGRESS' });

  const cached = readStatus();
  if (!cached || !cached.hasUpdate) throw Object.assign(new Error('لا يوجد تحديث متاح'), { code: 'NO_UPDATE_AVAILABLE' });
  if (!cached.downloadUrl) throw Object.assign(new Error('رابط التحديث غير متاح'), { code: 'NO_UPDATE_AVAILABLE' });

  const targetVersion = cached.latestVersion;
  updateInProgress = true;

  try {
    // disk space check (estimate 500 MB)
    const diskOk = await checkDiskSpace(500 * 1024 * 1024);
    if (!diskOk.ok) {
      const freeM = Math.round((diskOk.free || 0) / 1024 / 1024);
      const reqM = Math.round((diskOk.required || 0) / 1024 / 1024);
      throw Object.assign(new Error(`مساحة القرص غير كافية. المطلوب: ${reqM} ميغابايت. المتاح: ${freeM} ميغابايت.`), { code: 'INSUFFICIENT_DISK_SPACE' });
    }

    logEvent('INFO', `Update started: target=${targetVersion}`);
    setProgress('backup', 5);

    // backup
    const backupPath = await createBackup(targetVersion);
    setProgress('downloading', 15);

    // download
    const exeName = `laundry-app-v${targetVersion}.exe`;
    const exePath = path.join(DATA_DIR, exeName);
    await downloadWithProgress(cached.downloadUrl, exePath, (pct, received, total) => {
      setProgress('downloading', 15 + Math.round(pct * 0.5), { downloadedBytes: received, totalBytes: total });
    });
    setProgress('verify', 68);

    // verify
    if (cached.checksumUrl) {
      await verifySha256(exePath, cached.checksumUrl);
    } else {
      logEvent('WARN', 'No checksumUrl in cached status — skipping verification');
    }
    setProgress('replace', 72);

    logEvent('INFO', 'Spawning updater, server exiting');
    setProgress('replace', 75);

    spawnUpdater({ targetVersion, fromVersion: APP_VERSION, newExePath: exePath, backupPath });

    // schedule graceful exit
    setTimeout(() => process.exit(0), 1500);

    return { success: true, message: 'جارٍ التحديث... سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً.', targetVersion };
  } catch (err) {
    updateInProgress = false;
    clearProgress();
    logEvent('ERROR', `performUpdate failed: ${err.message}`);
    // clean up temp exe if it exists
    try {
      const exePath = path.join(DATA_DIR, `laundry-app-v${targetVersion}.exe`);
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
    } catch (_) {}
    throw err;
  }
}

// ── downloadUpdate: start download in background, track MB progress ───────────
async function downloadUpdate() {
  if (updateProgress.inProgress) {
    throw Object.assign(new Error('يجري التحميل بالفعل'), { code: 'DOWNLOAD_IN_PROGRESS' });
  }

  const cached = readStatus();
  if (!cached || !cached.hasUpdate) {
    throw Object.assign(new Error('لا يوجد تحديث متاح'), { code: 'NO_UPDATE_AVAILABLE' });
  }
  if (!cached.downloadUrl) {
    throw Object.assign(new Error('رابط التحديث غير متاح'), { code: 'NO_UPDATE_AVAILABLE' });
  }

  const targetVersion = cached.latestVersion;
  const exeName = cached.assetName || `laundry-app-v${targetVersion}.exe`;
  const exePath = path.join(DATA_DIR, exeName);

  updateProgress.downloadDone = false;
  updateProgress.downloadedFilePath = null;
  setProgress('downloading', 0, { downloadedBytes: 0, totalBytes: 0 });

  setImmediate(async () => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      await downloadWithProgress(cached.downloadUrl, exePath, (pct, received, total) => {
        updateProgress.downloadedBytes = received;
        updateProgress.totalBytes = total;
        updateProgress.percent = pct;
        updateProgress.stepLabel = 'جارٍ تنزيل التحديث';
      });
      updateProgress.percent = 100;
      updateProgress.inProgress = false;
      updateProgress.downloadDone = true;
      updateProgress.downloadedFilePath = exePath;
      logEvent('INFO', `downloadUpdate complete: ${exePath}`);
    } catch (err) {
      logEvent('ERROR', `downloadUpdate failed: ${err.message}`);
      clearProgress();
      try { if (fs.existsSync(exePath)) fs.unlinkSync(exePath); } catch (_) {}
    }
  });

  return { started: true };
}

// ── spawnInstaller: launch the Inno Setup wizard via a one-time scheduled task ─
// The app runs as a Session-0 NSSM service. Any process spawned directly by this
// Node server is a member of the service's job object and gets KILLED the instant
// the server exits — which is exactly why the installer never appeared (the
// update log showed zero lines from run-installer.ps1). Instead we register a
// one-time scheduled task that runs in the interactive user's session AFTER the
// server is gone: Task Scheduler owns it, not the service job object, so it
// survives, and the wizard appears on the user's desktop (elevated, no UAC).
//
// launch-installer.ps1 is run SYNCHRONOUSLY here so the task is registered before
// this process exits. Both scripts are read from ROOT/scripts/ (bundled in the
// pkg snapshot) and copied to DATA_DIR so PowerShell — which cannot read paths
// inside the pkg snapshot — can execute them from real disk.
function spawnInstaller(setupPath) {
  const srcRun    = path.join(ROOT, 'scripts', 'run-installer.ps1');
  const srcLaunch = path.join(ROOT, 'scripts', 'launch-installer.ps1');
  if (!fs.existsSync(srcRun))    throw new Error(`سكريبت التثبيت غير موجود: ${srcRun}`);
  if (!fs.existsSync(srcLaunch)) throw new Error(`سكريبت التثبيت غير موجود: ${srcLaunch}`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Always refresh the on-disk copies with the bundled (current) versions.
  const runScript    = path.join(DATA_DIR, '_run-installer.ps1');
  const launchScript = path.join(DATA_DIR, '_launch-installer.ps1');
  fs.copyFileSync(srcRun, runScript);
  fs.copyFileSync(srcLaunch, launchScript);

  // Synchronous: guarantees the scheduled task is registered before we exit.
  execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launchScript,
    '-SetupPath',  setupPath,
    '-RunScript',  runScript,
    '-AppRoot',    DATA_ROOT,
    '-ServerPid',  String(process.pid),
  ], { stdio: 'ignore', windowsHide: true, timeout: 30000 });
}

// ── installUpdate: run the downloaded installer / updater ─────────────────────
function installUpdate() {
  if (!updateProgress.downloadDone || !updateProgress.downloadedFilePath) {
    throw Object.assign(new Error('لم يكتمل التحميل بعد — انتظر اكتمال التحميل قبل التثبيت'), { code: 'DOWNLOAD_NOT_COMPLETE' });
  }

  const cached = readStatus();
  const targetVersion = cached ? cached.latestVersion : 'unknown';
  const exePath = updateProgress.downloadedFilePath;

  // Full-installer path: register a one-time scheduled task that shows the Inno
  // Setup wizard in the user's desktop session after this server exits.
  if (cached && cached.isInstaller) {
    logEvent('INFO', `installUpdate: scheduling installer task for v${targetVersion}`);
    try {
      spawnInstaller(exePath);
    } catch (e) {
      logEvent('ERROR', `installUpdate: failed to spawn installer — ${e.message}`);
      return { success: false, message: e.message };
    }
    setTimeout(() => process.exit(0), 2000);
    return { success: true, message: `سيظهر برنامج تثبيت الإصدار ${targetVersion} على سطح المكتب. اتبع التعليمات لإكمال التثبيت.`, targetVersion };
  }

  // Legacy path: bare exe swap via updater.ps1, then self-exit.
  const backupPath = path.join(DATA_ROOT, 'backup', `pre-${targetVersion}`);
  try { fs.mkdirSync(backupPath, { recursive: true }); } catch (_) {}

  logEvent('INFO', `installUpdate: spawning updater for v${targetVersion}`);
  spawnUpdater({ targetVersion, fromVersion: APP_VERSION, newExePath: exePath, backupPath });

  setTimeout(() => process.exit(0), 1500);

  return { success: true, message: 'جارٍ التثبيت... سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً.', targetVersion };
}

// ── T017: getUpdateProgress ───────────────────────────────────────────────────
function getUpdateProgress() {
  return getProgress();
}

module.exports = {
  checkForUpdate,
  getUpdateStatus,
  getUpdateProgress,
  downloadUpdate,
  installUpdate,
  performUpdate,
  logEvent,
};
