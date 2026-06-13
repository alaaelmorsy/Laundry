'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const { APP_ROOT: ROOT, DATA_ROOT } = require('../paths');
const DATA_DIR = path.join(DATA_ROOT, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'update-status.json');
const LOG_FILE = path.join(DATA_DIR, 'update-log.txt');
const BACKUP_DIR = path.join(DATA_ROOT, 'backup');

// ── in-memory progress state ──────────────────────────────────────────────────
let updateProgress = {
  inProgress: false,
  currentStep: null,
  stepLabel: '',
  percent: 0,
  steps: []
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

function setProgress(stepId, percent) {
  const step = STEPS.find(s => s.id === stepId);
  updateProgress = {
    inProgress: true,
    currentStep: stepId,
    stepLabel: step ? step.label.ar : stepId,
    percent,
    steps: buildSteps(stepId),
  };
}

function clearProgress() {
  updateProgress = { inProgress: false, currentStep: null, stepLabel: '', percent: 0, steps: [] };
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
function githubGet(urlStr, etag) {
  return new Promise((resolve, reject) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const version = pkg.version || '0.0.0';
    const parsed = new URL(urlStr);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      headers: {
        'User-Agent': `laundry-app/${version}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    };
    if (etag) opts.headers['If-None-Match'] = etag;

    https.get(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject).on('timeout', () => reject(new Error('GitHub API timeout')));
  });
}

// ── T005: checkForUpdate ──────────────────────────────────────────────────────
async function checkForUpdate(force = false) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;
  const { owner, repo } = pkg.github || {};
  if (!owner || !repo) throw Object.assign(new Error('GitHub repo not configured in package.json'), { code: 'UPDATE_CHECK_FAILED' });

  const cached = readStatus();
  const CACHE_TTL_MS = 60 * 60 * 1000;
  if (!force && cached && cached.lastChecked) {
    const age = Date.now() - new Date(cached.lastChecked).getTime();
    if (age < CACHE_TTL_MS) {
      logEvent('INFO', `Update check: using cache (age ${Math.round(age / 60000)}min)`);
      return {
        hasUpdate: cached.hasUpdate || false,
        currentVersion,
        latestVersion: cached.latestVersion || currentVersion,
        releaseNotes: cached.releaseNotes,
        publishedAt: cached.publishedAt,
        downloadUrl: cached.downloadUrl,
        checksumUrl: cached.checksumUrl,
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
    logEvent('INFO', 'Update check: 304 Not Modified, using cache');
    cached.lastChecked = new Date().toISOString();
    writeStatus(cached);
    return { hasUpdate: cached.hasUpdate, currentVersion, latestVersion: cached.latestVersion, releaseNotes: cached.releaseNotes, publishedAt: cached.publishedAt, downloadUrl: cached.downloadUrl, checksumUrl: cached.checksumUrl, lastChecked: cached.lastChecked };
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
    throw Object.assign(new Error(`GitHub API error: ${res.status}`), { code: 'UPDATE_CHECK_FAILED' });
  }

  let release;
  try { release = JSON.parse(res.body); } catch (_) { throw Object.assign(new Error('Invalid GitHub API response'), { code: 'UPDATE_CHECK_FAILED' }); }

  const latestVersion = (release.tag_name || '').replace(/^v/, '');
  const hasUpdate = isNewer(currentVersion, latestVersion);

  const zipAsset = (release.assets || []).find(a => a.name.endsWith('.zip'));
  const csumAsset = (release.assets || []).find(a => a.name === 'sha256sums.txt');

  const status = {
    lastChecked: new Date().toISOString(),
    currentVersion,
    latestVersion,
    hasUpdate,
    releaseNotes: release.body || '',
    downloadUrl: zipAsset ? zipAsset.browser_download_url : null,
    checksumUrl: csumAsset ? csumAsset.browser_download_url : null,
    publishedAt: release.published_at || null,
    lastUpdateResult: cached && cached.lastUpdateResult ? cached.lastUpdateResult : null,
    _etag: res.headers.etag || null,
  };

  writeStatus(status);
  logEvent('INFO', `Update check: current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate}`);

  return { hasUpdate, currentVersion, latestVersion, releaseNotes: status.releaseNotes, publishedAt: status.publishedAt, downloadUrl: status.downloadUrl, checksumUrl: status.checksumUrl, lastChecked: status.lastChecked };
}

// ── T006: getUpdateStatus ─────────────────────────────────────────────────────
function getUpdateStatus() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const cached = readStatus();
  return {
    currentVersion: pkg.version,
    hasUpdate: cached ? (cached.hasUpdate || false) : false,
    latestVersion: cached ? (cached.latestVersion || pkg.version) : pkg.version,
    lastChecked: cached ? cached.lastChecked : null,
    lastUpdateResult: cached ? (cached.lastUpdateResult || null) : null,
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
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const parsed = new URL(url);
    const proto = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      headers: { 'User-Agent': `laundry-app/${pkg.version}` },
      timeout: 120000,
    };
    const req = proto.get(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadWithProgress(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { reject(new Error(`Download failed: HTTP ${res.statusCode}`)); return; }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const out = fs.createWriteStream(destPath);
      res.on('data', chunk => {
        received += chunk.length;
        if (total > 0 && onProgress) onProgress(Math.round(received * 100 / total));
      });
      res.pipe(out);
      out.on('finish', () => { logEvent('INFO', `Download complete: ${destPath} (${received} bytes)`); resolve(); });
      out.on('error', err => { try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    });
    req.on('error', err => { try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out')); });
  });
}

// ── T014: verifySha256 ────────────────────────────────────────────────────────
async function verifySha256(zipPath, checksumUrl) {
  const csumRes = await githubGet(checksumUrl, null);
  if (csumRes.status !== 200) throw Object.assign(new Error('Failed to download checksum file'), { code: 'CHECKSUM_MISMATCH' });
  const lines = csumRes.body.split('\n').filter(Boolean);
  const zipName = path.basename(zipPath);
  const line = lines.find(l => l.toLowerCase().includes(zipName.toLowerCase()));
  if (!line) throw Object.assign(new Error(`Checksum entry not found for ${zipName}`), { code: 'CHECKSUM_MISMATCH' });
  const expectedHash = line.split(/\s+/)[0].toLowerCase();
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  if (actualHash !== expectedHash) throw Object.assign(new Error('فشل التحقق من سلامة ملف التحديث'), { code: 'CHECKSUM_MISMATCH' });
  logEvent('INFO', 'Checksum verified: OK');
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
    const zipName = `laundry-v${targetVersion}.zip`;
    const zipPath = path.join(DATA_DIR, zipName);
    await downloadWithProgress(cached.downloadUrl, zipPath, pct => {
      setProgress('downloading', 15 + Math.round(pct * 0.5));
    });
    setProgress('verify', 68);

    // verify
    if (cached.checksumUrl) {
      await verifySha256(zipPath, cached.checksumUrl);
    } else {
      logEvent('WARN', 'No checksumUrl in cached status — skipping verification');
    }
    setProgress('replace', 72);

    logEvent('INFO', 'Spawning updater, server exiting');
    setProgress('replace', 75);

    // spawn detached PowerShell updater
    const updaterScript = path.join(ROOT, 'scripts', 'updater.ps1');
    const psArgs = [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterScript,
      '-ServerPid', String(process.pid),
      '-TargetVersion', targetVersion,
      '-ZipPath', zipPath,
      '-BackupPath', backupPath,
      '-AppRoot', ROOT,
    ];
    const child = spawn('powershell.exe', psArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    // schedule graceful exit
    setTimeout(() => process.exit(0), 1500);

    return { success: true, message: 'جارٍ التحديث... سيتم إغلاق البرنامج وإعادة تشغيله تلقائياً.', targetVersion };
  } catch (err) {
    updateInProgress = false;
    clearProgress();
    logEvent('ERROR', `performUpdate failed: ${err.message}`);
    // clean up temp zip if it exists
    try {
      const zipPath = path.join(DATA_DIR, `laundry-v${targetVersion}.zip`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (_) {}
    throw err;
  }
}

// ── T017: getUpdateProgress ───────────────────────────────────────────────────
function getUpdateProgress() {
  return getProgress();
}

module.exports = {
  checkForUpdate,
  getUpdateStatus,
  getUpdateProgress,
  performUpdate,
  logEvent,
};
