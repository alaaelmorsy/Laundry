# Data Model: Automatic Update System

## Overview

No new database tables are required. All update state is persisted as JSON files in the `data/` directory (which is already excluded from updates and preserved across installations).

---

## File: `data/update-status.json`

Persists the cached update check result to avoid hitting the GitHub API on every app open.

```json
{
  "lastChecked": "2026-06-12T10:30:00.000Z",
  "currentVersion": "1.0.12",
  "latestVersion": "1.0.13",
  "hasUpdate": true,
  "releaseNotes": "...",
  "downloadUrl": "https://github.com/.../releases/download/v1.0.13/laundry-v1.0.13.zip",
  "checksumUrl": "https://github.com/.../releases/download/v1.0.13/sha256sums.txt",
  "publishedAt": "2026-06-11T08:00:00.000Z",
  "lastUpdateResult": {
    "status": "success",
    "fromVersion": "1.0.11",
    "toVersion": "1.0.12",
    "timestamp": "2026-06-05T14:22:11.000Z"
  }
}
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `lastChecked` | ISO timestamp | When the GitHub API was last queried |
| `currentVersion` | string | Version from `package.json` at check time |
| `latestVersion` | string | Latest GitHub Release tag (stripped of `v` prefix) |
| `hasUpdate` | boolean | `latestVersion > currentVersion` using semver comparison |
| `releaseNotes` | string | `body` field from GitHub release (markdown) |
| `downloadUrl` | string | Direct download URL for the ZIP asset |
| `checksumUrl` | string | Direct download URL for `sha256sums.txt` |
| `publishedAt` | ISO timestamp | GitHub release publication date |
| `lastUpdateResult` | object \| null | Result of the most recent update attempt |
| `lastUpdateResult.status` | `"success"` \| `"failed"` \| `"rollback"` | Outcome |
| `lastUpdateResult.fromVersion` | string | Version before the attempt |
| `lastUpdateResult.toVersion` | string | Target version of the attempt |
| `lastUpdateResult.timestamp` | ISO timestamp | When the attempt completed |

---

## File: `data/update-log.txt`

Append-only plain-text log of all update events for diagnostics.

**Format** (one line per event):
```
[2026-06-12T10:30:00.000Z] [INFO] Update check: current=1.0.12 latest=1.0.13 hasUpdate=true
[2026-06-12T10:35:00.000Z] [INFO] Update started: target=1.0.13
[2026-06-12T10:35:02.000Z] [INFO] Backup created: backup/pre-1.0.13/
[2026-06-12T10:35:15.000Z] [INFO] Download complete: laundry-v1.0.13.zip (4.2 MB)
[2026-06-12T10:35:15.000Z] [INFO] Checksum verified: OK
[2026-06-12T10:35:16.000Z] [INFO] DB backup created: backup/pre-1.0.13/db-backup.sql
[2026-06-12T10:35:16.000Z] [INFO] Spawning updater, server exiting
[2026-06-12T10:35:20.000Z] [INFO] Files replaced successfully
[2026-06-12T10:35:22.000Z] [INFO] DB migration complete
[2026-06-12T10:35:22.000Z] [INFO] Update complete: 1.0.12 → 1.0.13
```

---

## Backup Directory Structure

Created under `backup/pre-{targetVersion}/` before each update attempt:

```
backup/
└── pre-1.0.13/
    ├── db-backup.sql        ← full MySQL dump
    ├── source/              ← copy of all source files (not data/ or .env)
    │   ├── package.json
    │   ├── server/
    │   ├── screens/
    │   ├── assets/
    │   ├── database/
    │   └── ...
    └── meta.json            ← { "fromVersion", "toVersion", "timestamp" }
```

`meta.json` format:
```json
{
  "fromVersion": "1.0.12",
  "toVersion": "1.0.13",
  "timestamp": "2026-06-12T10:35:02.000Z"
}
```

After a **successful** update, the `backup/pre-{version}/` directory is deleted to reclaim disk space.
After a **failed** update with rollback, the directory is kept for post-mortem inspection.

---

## `package.json` Addition

A `"github"` key is added to `package.json` to configure the update source:

```json
"github": {
  "owner": "alaaelmorsy",
  "repo": "Laundry"
}
```

---

## Key Entities (Conceptual)

| Entity | Representation | Key Attributes |
|--------|---------------|----------------|
| **Release** | GitHub API response + `data/update-status.json` | version, releaseNotes, downloadUrl, checksumUrl, publishedAt |
| **UpdateSession** | Runtime object (in-memory during update) | status, steps completed, errors, startTime |
| **Backup** | `backup/pre-{version}/` directory | source snapshot, DB dump, metadata |
| **UpdateLog** | `data/update-log.txt` | append-only event stream |
