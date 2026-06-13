# Research: Automatic Update System

## Decision 1: Update Distribution Format

**Decision**: ZIP archive published as a GitHub Release asset, containing all app source files except preserved data directories.

**Rationale**: ZIP is natively supported on Windows (PowerShell `Expand-Archive`), no extra dependencies required. GitHub Releases provides free hosting, versioned artifacts, release notes, and a well-documented REST API.

**Alternatives considered**:
- NSIS/Inno Setup installer: requires building an installer per release — too heavy for a Node.js project with no build pipeline.
- Git pull: requires Git installed on client machine and exposes repository credentials — rejected.
- Custom download server: added infrastructure cost — rejected.

---

## Decision 2: Update Orchestration (How to Replace Running Files)

**Decision**: The Node.js server spawns a detached PowerShell updater script (`updater.ps1`) passing its own PID, then exits gracefully. The PowerShell script waits for the PID to terminate, extracts the new ZIP, runs DB migrations, and restarts the server.

**Rationale**: A Node.js process cannot replace its own running files on Windows (locked by OS). Spawning a detached child process that outlives the parent is the standard pattern for self-updating CLI/server apps on Windows. PowerShell is always available on Windows 10+ with no extra dependencies.

**Alternatives considered**:
- Electron auto-updater: app is not an Electron app — not applicable.
- A second always-running "launcher" process: adds permanent resident overhead; updater-as-needed is simpler.
- Batch file instead of PowerShell: PowerShell has better error handling, JSON parsing, and checksum support.

---

## Decision 3: File Integrity Verification

**Decision**: Each GitHub Release includes a `sha256sums.txt` asset listing `SHA256  filename` pairs. The server downloads and verifies the checksum before extracting the ZIP.

**Rationale**: SHA256 is the industry standard; Node.js `crypto` module computes it without extra packages. Storing the checksum as a separate release asset (not embedded in release notes) is machine-readable and consistent.

**Alternatives considered**:
- GPG signature: requires GPG toolchain on client — too heavy.
- MD5: cryptographically weak, rejected.
- Embed hash in release notes: fragile to parse — rejected.

---

## Decision 4: Database Backup Strategy

**Decision**: Use the existing MySQL connection pool to export a full SQL dump via `mysqldump` (spawned as a child process) before any update. Fall back to a Node.js-native row-by-row export for tables if `mysqldump` is not on PATH.

**Rationale**: `mysqldump` is bundled with MySQL/MariaDB installations (which are prerequisites for this app). The backup is a plain `.sql` file, human-readable and importable with standard tools.

**Alternatives considered**:
- Copy raw InnoDB data files: requires stopping MySQL service — too invasive.
- Custom JSON dump: slower restore, non-standard — rejected.

---

## Decision 5: Files to Preserve During Update (Excluded from ZIP replacement)

The following paths are NEVER overwritten by the updater — they represent client-specific data:

```
.env
data/
ssl/
```

The ZIP contains everything else (source code, `assets/`, `screens/`, `server/`, `database/`, `scripts/`, `package.json`, `package-lock.json`).

**Rationale**: These paths contain the client's database credentials, WhatsApp session, SSL certificates, and uploaded files. Overwriting them would break the installation.

---

## Decision 6: DB Migration at Update Time

**Decision**: After file replacement, the updater runs `node server/index.js` in a special `--migrate-only` mode (or the existing `db.initialize()` is called directly via a small `migrate.js` script) to apply any new schema migrations before the server starts serving traffic.

**Rationale**: The existing project uses `db.initialize()` with idempotent `try { ALTER } catch (_) {}` blocks. Running it once before startup is safe. A dedicated `migrate.js` script (`node migrate.js`) avoids starting the full HTTP server just for migrations.

---

## Decision 7: Update Check API Source

**Decision**: `GET https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest` — compared against `package.json` version using semver ordering.

**Rate limits**: GitHub unauthenticated API allows 60 req/hour per IP. With a `User-Agent` header the limit is per-IP. Caching the last-check result for 60 minutes prevents exceeding limits. No auth token required for public repos.

---

## Decision 8: GitHub Repository Configuration

**Decision**: Owner and repo name stored in `package.json` under a `"github"` key:

```json
"github": {
  "owner": "alaaelmorsy",
  "repo": "Laundry"
}
```

This avoids hardcoding in source files and makes the plan portable.

---

## Decision 9: Update Status Persistence

**Decision**: A `data/update-status.json` file records the last check timestamp, last known latest version, and last update result (success/failure/rollback). This is read at login screen to show the notification without a live API call on every login.

**Rationale**: Avoids hitting GitHub API on every app open. The background check on login screen reads the cached status and optionally triggers a fresh check if the cache is > 60 minutes old.

---

## Decision 10: Rollback Mechanism

**Decision**: The PowerShell updater script creates a `backup/` folder inside the app root before extraction, copying the current source files there. On failure at any step, it restores from `backup/` and restarts the old version. The DB backup `.sql` file is imported via `mysql` CLI if the migration step failed.

**Rationale**: Simple file-copy backup is reliable and fast for a project of this size (source files are a few MB). The backup is deleted after a successful update to reclaim disk space.
