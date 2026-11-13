# QuickDrop database design

QuickDrop stores metadata in MongoDB and file bytes in Cloudinary. MongoDB never stores file content.

## 1. Collections

| Collection | Purpose |
|---|---|
| `users` | Account identity, password hash, token version, quota counters, reset token |
| `refreshtokens` | Rotating refresh-token sessions and reuse-detection metadata |
| `files` | File metadata and Cloudinary asset references |
| `folders` | Nested folder tree and trash state |
| `shares` | Share-link hashes, optional password hash, expiry, download limits |
| `uploadsessions` | Signed upload reservations and confirmation state |
| `activities` | Append-only user activity history |

Mongoose creates these collections on first write and creates declared indexes at startup (subject to the deployment's `autoIndex` behavior). There is no separate migration framework for MongoDB; schema changes must be additive or accompanied by a deliberate data migration runbook.

## 2. `users`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `name` | string | 2–80 characters, trimmed |
| `email` | string | Lowercased, trimmed, unique |
| `passwordHash` | string | bcrypt cost 12 by default; `select: false` |
| `role` | enum | `user` or `admin`; no admin UI in the current app |
| `avatarPublicId` | string? | Reserved for an avatar flow; no upload UI is implemented |
| `tokenVersion` | number | Incremented to invalidate all access tokens |
| `storageUsedBytes` | number | Active + trashed files + unreleased reservations |
| `storageLimitBytes` | number | Default from `STORAGE_LIMIT_BYTES` |
| `passwordResetTokenHash` | string? | HMAC hash; `select: false` |
| `passwordResetExpiresAt` | Date? | Short-lived; `select: false` |
| `lastLoginAt` | Date? | Updated on login |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes:

- `{ email: 1 }` unique
- `_id` default

`toJSON` removes password/reset fields. Services explicitly select `+passwordHash` only when comparing a password.

## 3. `refreshtokens`

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId | Ref `users`, indexed |
| `tokenHash` | string | HMAC-SHA256 of the opaque token; unique |
| `familyId` | string | Rotation family UUID, indexed |
| `expiresAt` | Date | TTL index |
| `revokedAt` | Date? | Set on rotation/reuse/logout/password change |
| `replacedByTokenHash` | string? | Links the rotated token for reuse detection |
| `createdByIp` | string? | Best-effort request metadata |
| `userAgent` | string? | Best-effort request metadata |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes:

- `{ tokenHash: 1 }` unique
- `{ user: 1 }`
- `{ familyId: 1 }`
- `{ user: 1, familyId: 1 }`
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0`

The TTL index removes expired sessions eventually; authorization checks still reject an expired session even if MongoDB has not removed it yet.

Refresh tokens are opaque secrets. The raw value exists only in the client and in transit; the database stores only the HMAC hash.

## 4. `files`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | Ref `users`, indexed |
| `folder` | ObjectId? | Ref `folders`; `null` means root |
| `parentKey` | string | Folder id string or `root`; used for uniqueness queries |
| `name` | string | Display name, 1–255 characters |
| `nameKey` | string | NFKC-lowercased name used for conflict checks |
| `extension` | string | Normalized extension |
| `mimeType` | string | Validated against the allowed MIME set |
| `mediaType` | enum | `image`, `video`, `audio`, `document`, `archive`, `other` |
| `sizeBytes` | number | Verified size |
| `cloudinaryPublicId` | string | Unique Cloudinary identifier |
| `cloudinaryResourceType` | enum | `image`, `video`, `raw` |
| `deliveryType` | enum | `authenticated` or `upload` |
| `format`, `version`, `etag` | mixed | Cloudinary delivery metadata |
| `width`, `height`, `duration` | number? | Optional media metadata |
| `isFavorite` | boolean | Default `false` |
| `downloadCount` | number | Incremented atomically |
| `lastAccessedAt` | Date? | Last download/preview metadata update |
| `deletedAt` | Date? | Present means in trash |
| `trashBatchId` | string? | Groups a folder-tree trash operation |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes:

- `{ owner: 1 }`
- `{ mediaType: 1 }`
- `{ isFavorite: 1 }`
- `{ cloudinaryPublicId: 1 }` unique
- `{ owner: 1, parentKey: 1, nameKey: 1 }` unique, partial on `{ deletedAt: null }`
- `{ owner: 1, parentKey: 1, deletedAt: 1, createdAt: -1 }`
- `{ owner: 1, deletedAt: 1, createdAt: -1 }`
- `{ owner: 1, mediaType: 1, deletedAt: 1 }`
- `{ owner: 1, isFavorite: 1, deletedAt: 1 }`
- `{ name: 'text' }` (declared but current search uses escaped regex matching)

The partial unique index prevents two active files with the same normalized name in the same folder. A trashed file does not block a new file with the same name; a restore resolves conflicts by choosing an available name.

## 5. `folders`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | Ref `users`, indexed |
| `name` | string | 1–120 characters |
| `nameKey` | string | NFKC-lowercased name |
| `parent` | ObjectId? | Ref `folders`; `null` means root |
| `parentKey` | string | Parent id or `root` |
| `deletedAt` | Date? | Present means in trash |
| `trashBatchId` | string? | Groups a folder-tree trash operation |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes:

- `{ owner: 1 }`
- `{ trashBatchId: 1 }`
- `{ owner: 1, parentKey: 1, nameKey: 1 }` unique, partial on `{ deletedAt: null }`
- `{ owner: 1, parentKey: 1, deletedAt: 1 }`
- `{ owner: 1, deletedAt: 1, createdAt: -1 }`

Folder moves reject moving a folder into itself or a descendant. Trashing a folder marks the root and descendants with the same batch id. Restoring a folder tree recreates only the folders whose parent is available; permanent deletion removes descendant files/folders and their Cloudinary assets.

## 6. `shares`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | Ref `users`, indexed |
| `file` | ObjectId | Ref `files`, indexed |
| `tokenHash` | string | HMAC hash of the raw share token; unique |
| `passwordHash` | string? | bcrypt hash; `select: false` |
| `expiresAt` | Date? | Optional expiry |
| `maxDownloads` | number? | Optional cap |
| `downloadCount` | number | Atomically incremented |
| `lastAccessedAt` | Date? | Updated on download |
| `revokedAt` | Date? | Present means revoked |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes:

- `{ owner: 1 }`
- `{ file: 1 }`
- `{ tokenHash: 1 }` unique
- `{ owner: 1, createdAt: -1 }`
- `{ file: 1, revokedAt: 1 }`

The raw share token is never stored. A share remains usable until it expires, is revoked, reaches its download limit, or its file is permanently deleted. Moving a file to trash does not revoke its share; the share becomes unusable while the file is trashed because public lookup only accepts active files. Restoring the file makes the share usable again if it is otherwise valid.

## 7. `uploadsessions`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | Ref `users`, indexed |
| `folder` | ObjectId? | Destination folder |
| `parentKey` | string | Destination parent key |
| `fileName`, `nameKey` | string | Intended name and conflict key |
| `extension`, `mimeType`, `mediaType` | mixed | Intended metadata |
| `sizeBytes` | number | Client-declared size |
| `reservedBytes` | number | Quota reserved at signing time |
| `cloudinaryPublicId` | string | Unique intended asset id |
| `cloudinaryResourceType` | enum | `image`, `video`, `raw` |
| `deliveryType` | enum | `authenticated` or `upload` |
| `status` | enum | `pending`, `confirming`, `completed`, `failed`, `expired` |
| `file` | ObjectId? | Linked file after completion |
| `expiresAt` | Date | Signing TTL |
| `completedAt` | Date? | Completion time |
| `failureReason` | string? | Sanitized operational reason |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes:

- `{ owner: 1 }`
- `{ status: 1 }`
- `{ expiresAt: 1 }`
- `{ owner: 1, status: 1, expiresAt: 1 }`
- `{ cloudinaryPublicId: 1 }` unique

Status transitions are controlled by the service:

```text
pending ──claim──► confirming ──success──► completed
   │                    │
   │                    ├── transient verify failure ──► pending
   │                    └── invalid upload/cleanup ────► failed
   └── maintenance/expiry ─────────────────────────────► expired
```

A completed session is retained for `UPLOAD_SESSION_RETENTION_DAYS` and then pruned. Expired/failed sessions are also pruned after retention.

## 8. `activities`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | Ref `users`, indexed |
| `type` | enum | File/folder/share/account event |
| `file`, `folder`, `share` | ObjectId? | Optional references |
| `metadata` | mixed | Event-specific values (names, counts, bytes, `viaShare`) |
| `createdAt` | Date | No `updatedAt` |

Indexes:

- `{ owner: 1, createdAt: -1 }`
- `{ owner: 1, type: 1, createdAt: -1 }`
- `{ owner: 1, file: 1, createdAt: -1 }`

Activity recording is best-effort: a failure to record an event is logged but does not fail the user-facing operation. Activity is not cascaded when a file/folder/share is permanently deleted; references may remain as historical identifiers.

## 9. Storage accounting invariant

For each user:

```text
storageUsedBytes =
  sum(sizeBytes of all files, including trashed files)
  + sum(reservedBytes of all pending/confirming upload sessions)
```

This is maintained through:

- atomic quota reservation at signing;
- adjustment on confirmation if Cloudinary reports a different size;
- release on failed/expired sessions, permanent deletion, and empty trash;
- periodic reconciliation by the maintenance job.

Trash counts against quota. A user must permanently delete trashed content to reclaim space. Reconcile uses a compare-and-set on the previous `storageUsedBytes` value; if an upload changes the counter during the calculation, the update is skipped and the next run repairs it.

There is no multi-document transaction around "create file + complete session". The confirmation claim and compensation paths are designed so a crash leaves a repairable state rather than a double charge.

## 10. Retention and cleanup

| Data | Default retention | Mechanism |
|---|---|---|
| Refresh token | `REFRESH_TOKEN_EXPIRES_DAYS` (30) | TTL + revocation checks |
| Pending/confirming upload session | `UPLOAD_SESSION_TTL_MINUTES` (60) | Maintenance expiry, quota release |
| Terminal upload session | `UPLOAD_SESSION_RETENTION_DAYS` (7) | Maintenance prune |
| Trashed file/folder | `TRASH_RETENTION_DAYS` (30) | Maintenance purge |
| Activity | Indefinite | No automatic pruning |
| Share | Optional expiry / until revoked | Service checks |
| Cloudinary asset | Until file permanent deletion or failed-upload cleanup | Service + maintenance |

Maintenance runs at startup and every `MAINTENANCE_INTERVAL_MINUTES` (60 by default). The manual command is:

```bash
cd backend
npm run maintenance
```

## 11. Mobile SQLite

The mobile app uses `quickdrop.db` with WAL mode.

### `offline_files`

| Column | Notes |
|---|---|
| `id` | Local row id |
| `owner_id` | Account id; required for scoping |
| `file_id` | Server file id |
| `name`, `mime_type`, `size_bytes` | Display metadata |
| `local_uri` | App-private file URI |
| `saved_at` | ISO timestamp |

Unique index: `(owner_id, file_id)`. One offline copy per server file per account. Unscoped rows from earlier builds are deleted during migration. Removing an offline file deletes the local file and the scoped row.

### `upload_queue`

| Column | Notes |
|---|---|
| `id` | Local upload id |
| `owner_id` | Account id; required for scoping |
| `local_uri` | Source file URI |
| `file_name`, `mime_type`, `size_bytes` | Upload metadata |
| `folder_id` | Destination folder or `null` |
| `status` | Queue status |
| `progress` | Persisted progress |
| `error` | Last error text |
| `created_at` | Ordering timestamp |
| `attempts` | Retry count |
| `server_file_id`, `session_id` | Server correlation |

Index: `(owner_id, status)`. Unscoped rows are deleted during migration. Interrupted non-terminal rows are restored as `queued`. The queue is paused and in-flight work cancelled when auth ends.

Local SQLite is not encrypted at the application layer. It lives in the OS app sandbox; see the security document for residual risks.

## 12. Backups and restore

- MongoDB Atlas continuous backups or scheduled `mongodump` snapshots are recommended. Back up `users`, `files`, `folders`, `shares`, `uploadsessions`, `refreshtokens`, and `activities` together so references stay consistent.
- Cloudinary assets are separate from MongoDB. A database restore does not restore deleted Cloudinary bytes. Configure Cloudinary backup/retention appropriate to the account plan, or maintain an independent export of important assets.
- Restoring an older database can resurrect refresh tokens, share links, and upload sessions. After a restore, rotate the JWT/share secrets or revoke all refresh tokens and shares if the restore crosses a security boundary.
- Restoring a database while the API is running is not supported; stop writers, restore, verify indexes, then restart.
- Never copy production data into development or test environments without a documented sanitization step.

## 13. Data integrity checks

Useful operational queries (read-only) during an incident:

```javascript
// Users whose counters disagree with file totals (maintenance does this automatically)
db.files.aggregate([{ $group: { _id: '$owner', bytes: { $sum: '$sizeBytes' } } }])

// Unreleased reservations
db.uploadsessions.aggregate([
  { $match: { status: { $in: ['pending', 'confirming'] } } },
  { $group: { _id: '$owner', bytes: { $sum: '$reservedBytes' } } }
])

// Expired shares that are still marked active
db.shares.find({ expiresAt: { $lt: new Date() }, revokedAt: { $exists: false } })
```

Do not run ad-hoc deletes against production collections. Use the maintenance command or a reviewed migration.
