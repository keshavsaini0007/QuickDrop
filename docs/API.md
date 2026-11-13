# QuickDrop API

The API is a JSON REST service. There is no Socket.IO or WebSocket endpoint. File bytes go directly from the client to Cloudinary; the API issues short-lived signatures and verifies the result.

## 1. Base URLs

| Surface | URL |
|---|---|
| API | `http://localhost:4000/api` (configurable with `API_PREFIX`) |
| Health | `http://localhost:4000/health`, `/health/ready` |
| Public HTML share page | `http://localhost:4000/s/:token` |
| Public share API | `http://localhost:4000/api/public/shares/:token` |

Production must use HTTPS. Native mobile requests do not use browser CORS; browser clients must be listed in `CLIENT_ORIGINS`.

## 2. Conventions

- Request bodies are JSON unless noted. The JSON body limit is 1 MB.
- ObjectIds are 24-character hexadecimal strings.
- Dates are ISO 8601 strings in responses.
- IDs in responses are strings.
- Authenticated endpoints require:

```http
Authorization: Bearer <accessToken>
```

- Do not log or share access tokens, refresh tokens, share tokens, passwords, Cloudinary signatures, or signed download URLs.

## 3. Success envelope

```json
{
  "success": true,
  "message": "Files loaded.",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 30,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false
  }
}
```

`meta` is present on paginated responses. A successful operation with no result uses `data: null`. For brevity, most endpoint examples below show the `data` payload unless the envelope itself is the subject.

## 4. Error envelope

```json
{
  "success": false,
  "message": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "email", "message": "Enter a valid email address." }
  ],
  "requestId": "b1f0c0f2-..."
}
```

`requestId` is also returned in the `X-Request-Id` response header and is useful for log correlation. In production, unexpected 500-level messages are sanitized.

Common codes:

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body/query/params |
| 400 | `INVALID_JSON` | Malformed JSON |
| 400 | `INVALID_RESET_TOKEN` | Reset token invalid/expired |
| 401 | `UNAUTHORIZED` | Missing/invalid access token |
| 401 | `TOKEN_EXPIRED` | Access token expired; refresh it |
| 401 | `SHARE_PASSWORD_REQUIRED` | Public share needs a password |
| 401 | `SHARE_PASSWORD_INVALID` | Wrong share password |
| 401 | `SHARE_ACCESS_REQUIRED` | Missing share access token |
| 401 | `SHARE_ACCESS_EXPIRED` | Share access token expired |
| 401 | `SHARE_ACCESS_INVALID` | Share access token invalid for this share/file |
| 403 | `CORS_NOT_ALLOWED` | Browser origin not allowlisted |
| 404 | `NOT_FOUND` | Resource not found or not owned |
| 409 | `CONFLICT` | Duplicate resource/name/token |
| 409 | `EMAIL_ALREADY_EXISTS` | Registration/email update conflict |
| 409 | `UPLOAD_CONFIRM_IN_PROGRESS` | Another confirmation is claiming the session |
| 409 | `UPLOAD_ALREADY_COMPLETED` | Session completed without a linked file |
| 410 | `UPLOAD_SESSION_EXPIRED` | Upload session expired |
| 410 | `SHARE_REVOKED`, `SHARE_EXPIRED`, `SHARE_DOWNLOAD_LIMIT_REACHED` | Public share unavailable |
| 413 | `FILE_TOO_LARGE` | Per-type size limit exceeded |
| 413 | `STORAGE_QUOTA_EXCEEDED` | Account quota exceeded |
| 413 | `PAYLOAD_TOO_LARGE` | JSON request body too large |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | MIME type not allowed |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 502 | `CLOUDINARY_ERROR` | Cloudinary upstream failure |
| 503 | `CLOUDINARY_NOT_CONFIGURED` | Server has no Cloudinary credentials |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

## 5. Authentication

### POST `/api/auth/register`

Public. Creates an account and returns a token pair.

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "CorrectHorse9"
}
```

Rules: name 2–80 characters; valid email; password 8–72 characters with at least one letter and one number. Response `201`:

```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "user": {
      "id": "66f...",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "role": "user",
      "avatarUrl": null,
      "hasAvatar": false,
      "storageUsedBytes": 0,
      "storageLimitBytes": 5368709120,
      "createdAt": "2026-11-13T10:00:00.000Z"
    },
    "accessToken": "<jwt>",
    "refreshToken": "<opaque>",
    "accessTokenExpiresAt": "2026-11-13T10:15:00.000Z",
    "refreshTokenExpiresAt": "2026-12-13T10:00:00.000Z"
  }
}
```

### POST `/api/auth/login`

Public. Body: `email`, `password`. Response `200` with the same `AuthResult` shape as register. Failed credentials return `401 UNAUTHORIZED` with a generic message.

### POST `/api/auth/refresh`

Public. Body:

```json
{ "refreshToken": "<opaque refresh token>" }
```

Response `200` with a new `AuthResult`. The old refresh token is rotated and cannot be reused. Reuse revokes the token family. Access/refresh expiry fields are ISO strings.

### POST `/api/auth/logout`

Public (the refresh token itself is the credential). Body:

```json
{ "refreshToken": "<opaque refresh token>" }
```

Response `200` with `data: null`. The operation is idempotent for a valid token; an unknown token does not reveal account information.

### POST `/api/auth/logout-all`

Authenticated. Revokes all refresh tokens and increments `tokenVersion`. Response `200`, `data: null`. Existing access tokens stop working immediately.

### POST `/api/auth/forgot-password`

Public. Body:

```json
{ "email": "ada@example.com" }
```

Always responds `200` with a generic message. If the account exists, a reset email is sent (console provider in development, Resend in production). When `DEV_EXPOSE_RESET_TOKEN=true` in a non-production environment, the response also contains:

```json
{ "resetToken": "<raw reset token>" }
```

The raw token is never stored; only its HMAC hash is.

### POST `/api/auth/reset-password`

Public. Body:

```json
{
  "token": "<raw reset token>",
  "password": "NewCorrectHorse9"
}
```

Response `200`, `data: null`. The reset token is single-use, expires after `RESET_TOKEN_TTL_MINUTES` (60 default), revokes all refresh tokens, and increments `tokenVersion`.

## 6. Profile

### GET `/api/users/me`

Authenticated. Returns a `UserDto`.

### PATCH `/api/users/me`

Authenticated. Body may contain `name` and/or `email`; changing email requires `currentPassword`. Response `200` with the updated `UserDto`.

```json
{
  "name": "Ada L.",
  "email": "new@example.com",
  "currentPassword": "CorrectHorse9"
}
```

Wrong current password: `400 VALIDATION_ERROR`. Duplicate email: `409 EMAIL_ALREADY_EXISTS`.

### PATCH `/api/users/me/password`

Authenticated.

```json
{
  "currentPassword": "CorrectHorse9",
  "newPassword": "NewCorrectHorse9"
}
```

Response `200` with a new `AuthResult`. All other sessions are revoked; the returned token pair belongs to the current session. Wrong current password: `400`.

There is no avatar upload endpoint yet. `avatarUrl` is `null`; `hasAvatar` reports whether a legacy `avatarPublicId` exists.

## 7. Upload protocol

### POST `/api/files/upload/sign`

Authenticated and upload-rate-limited.

```json
{
  "fileName": "holiday.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1843200,
  "folderId": "66f..." 
}
```

`folderId` is optional; omit it for the root. Response `201`:

```json
{
  "success": true,
  "message": "Upload authorized. Send the file directly to Cloudinary.",
  "data": {
    "sessionId": "66f...",
    "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/<image|video|raw>/upload",
    "params": {
      "api_key": "...",
      "timestamp": 1763028000,
      "public_id": "quickdrop/<userId>/<uuid>",
      "type": "authenticated",
      "eager": "c_fill,w_400,h_400,q_auto,f_jpg",
      "signature": "<signature>"
    },
    "expiresAt": "2026-11-13T11:00:00.000Z",
    "uploadMode": "single",
    "chunkSizeBytes": 10485760,
    "uniqueUploadId": "quickdrop/<userId>/<uuid>",
    "maxSizeBytes": 26214400
  }
}
```

`uploadMode` is currently always `single`. `chunkSizeBytes` is reserved configuration and is not used by the current mobile uploader. `maxSizeBytes` is the per-media limit, not the mobile 100 MB single-request cap.

Client upload:

1. Send a multipart/form-data request to `uploadUrl` with every returned `params` value plus the file under the `file` field. `eager` is present only for image/video assets.
2. Use the exact `public_id`, resource type, and `type=authenticated` returned by the API.
3. On success, call confirm with the returned `sessionId`.

Cloudinary direct upload details are governed by the returned parameters. Do not invent a different public ID; confirmation checks the expected asset.

### POST `/api/files/upload/:sessionId/confirm`

Authenticated. Empty JSON body `{}`. Response `201` with a `FileDto`.

Possible outcomes:

- `409 UPLOAD_CONFIRM_IN_PROGRESS`: another request already claimed this session. Retry after a short delay.
- `410 UPLOAD_SESSION_EXPIRED`: the signing TTL elapsed. The reservation will be released by maintenance.
- `413 FILE_TOO_LARGE`: Cloudinary reports a size over the per-type limit.
- `415 UNSUPPORTED_MEDIA_TYPE`: asset type is not allowed.
- `502 CLOUDINARY_ERROR`: verification failed upstream; the session returns to `pending` for a retry.

The confirm endpoint is safe to retry after transient failures. A completed session returns its existing file if available.

## 8. Files

All endpoints require authentication. Unless noted, files are active (not trashed).

### GET `/api/files`

Query parameters:

| Name | Type | Default | Notes |
|---|---|---|---|
| `folderId` | ObjectId | root | List one folder |
| `search` | string | — | Case-insensitive escaped substring on name |
| `mediaType` | enum | — | `image`, `video`, `audio`, `document`, `archive`, `other` |
| `favorite` | `true`/`false` | — | Filter favorites |
| `sort` | enum | `createdAt` | `name`, `createdAt`, `updatedAt`, `sizeBytes` |
| `order` | enum | `desc` | `asc` or `desc` |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `30` | 1–100 |

Response `200`: paginated array of `FileDto`.

### GET `/api/files/:id`

Response `200` with a `FileDto`. Trashed files are not returned by this endpoint.

### GET `/api/files/:id/download`

Increments `downloadCount` atomically, records activity, and returns:

```json
{
  "success": true,
  "message": "Download link issued.",
  "data": {
    "url": "https://res.cloudinary.com/.../signed-url",
    "expiresAt": "2026-11-13T10:05:00.000Z",
    "file": { "id": "66f...", "name": "holiday.jpg", "...": "..." }
  }
}
```

The URL is short-lived (5 minutes) and intended for immediate use. Do not persist it.

### GET `/api/files/:id/preview`

Same shape as download but does not increment the download counter and requests inline delivery where supported.

### PATCH `/api/files/:id`

Rename:

```json
{ "name": "renamed.jpg" }
```

Response `200` with the updated `FileDto`. Name conflicts return `409`.

### PATCH `/api/files/:id/move`

```json
{ "folderId": "66f..." }
```

Use `{ "folderId": null }` for the root. Response `200` with the updated `FileDto`.

### PATCH `/api/files/:id/favorite`

```json
{ "isFavorite": true }
```

Response `200` with the updated `FileDto`.

### DELETE `/api/files/:id`

Moves the file to trash. Response `200` with the trashed `FileDto` (including `deletedAt`). Trash counts against quota.

### POST `/api/files/:id/restore`

Restores a trashed file. If its original folder is gone/trashed, it is restored to the root with an available name. Response `200` with the restored `FileDto`.

### DELETE `/api/files/:id/permanent`

Permanently deletes a **trashed** file, removes its Cloudinary asset and shares, and releases its bytes. Returns `400` if the file is not in trash. Response `200`, `data: null`.

### GET `/api/files/trash`

Pagination: `page`, `limit` (1–100). Response `200`: paginated `FileDto[]` sorted by `deletedAt` descending.

### DELETE `/api/files/trash`

Permanently deletes all trashed files. Response:

```json
{
  "success": true,
  "message": "Recycle bin emptied.",
  "data": { "deletedCount": 3, "releasedBytes": 1843200 }
}
```

Failures for individual assets are logged and do not abort the whole operation; the response counts only successful deletions.

## 9. Folders

### POST `/api/folders`

```json
{ "name": "Documents", "parentId": "66f..." }
```

`parentId` is optional (root). Response `201` with a `FolderDto`. Name conflicts in the same parent return `409`.

### GET `/api/folders`

Query: `parentId?`, `search?`, `sort` (`name` default, `createdAt`, `updatedAt`), `order` (`asc` default), `page`, `limit` (1–100). Response `200`: paginated `FolderDto[]`.

### GET `/api/folders/:id`

Response `200`:

```json
{
  "folder": { "id": "66f...", "name": "Documents", "parentId": null, "...": "..." },
  "breadcrumbs": [
    { "id": "66f...", "name": "Documents" }
  ]
}
```

Breadcrumbs are ancestor folders from root to the requested folder.

### PATCH `/api/folders/:id`

Rename and/or move:

```json
{ "name": "Archive", "parentId": null }
```

At least one field is required. Moving into itself or a descendant returns `400`. Response `200` with the updated `FolderDto`.

### DELETE `/api/folders/:id`

Moves the folder and its subtree to trash. Response `200` with the trashed `FolderDto`. All descendants count against quota.

### POST `/api/folders/:id/restore`

Restores a trashed folder tree where possible. If the original parent is unavailable, the folder is restored to the root with an available name. Response `200` with the restored `FolderDto`.

### DELETE `/api/folders/:id/permanent`

Permanently deletes a trashed folder subtree, including files, Cloudinary assets, and shares. Returns `400` if not trashed. Response `200`, `data: null`.

### GET `/api/folders/trash`

Pagination: `page`, `limit` (1–100). Response `200`: paginated `FolderDto[]` sorted by `deletedAt` descending.

### DELETE `/api/folders/trash`

Permanently deletes all trashed folder trees. Response:

```json
{ "deletedCount": 2 }
```

## 10. Unified recycle bin

### GET `/api/trash`

Query: `page`, `limit` (1–100). Response `200`:

```json
{
  "files": [],
  "folders": [],
  "totals": { "files": 0, "folders": 0, "items": 0 }
}
```

### DELETE `/api/trash`

Empties both file and folder trash. Response:

```json
{
  "files": { "deletedCount": 3, "releasedBytes": 1843200 },
  "folders": { "deletedCount": 1 }
}
```

## 11. Shares

### POST `/api/shares`

Authenticated. Creates a share for an active file.

```json
{
  "fileId": "66f...",
  "password": "optional-password",
  "expiresInDays": 7,
  "maxDownloads": 10
}
```

All options except `fileId` are optional. Password length is at least `SHARE_PASSWORD_MIN_LENGTH` (6 default) and at most 72. `expiresInDays` is 1–`SHARE_MAX_EXPIRY_DAYS` (365 default). `maxDownloads` is 1–100000. Response `201`:

The `data` payload is:

```json
{
  "share": {
    "id": "66f...",
    "fileId": "66f...",
    "fileName": "holiday.jpg",
    "hasPassword": true,
    "expiresAt": "2026-11-20T10:00:00.000Z",
    "maxDownloads": 10,
    "downloadCount": 0,
    "lastAccessedAt": null,
    "revokedAt": null,
    "isExpired": false,
    "isRevoked": false,
    "createdAt": "2026-11-13T10:00:00.000Z"
  },
  "token": "<raw share token>",
  "url": "https://quickdrop.example/s/<raw share token>"
}
```

The raw token and URL are shown only once. If lost, regenerate the link.

### GET `/api/shares`

Query: `fileId?`, `page`, `limit` (1–100). Response `200`: paginated `ShareDto[]` sorted newest first. `fileName` is included when the file record is available.

### DELETE `/api/shares/:id`

Revokes the share. Idempotent. Response `200` with the `ShareDto` including `revokedAt`.

### POST `/api/shares/:id/regenerate`

Regenerates the token for a non-revoked share and resets download count/access metadata. Response `200` with the same shape as create, including a new raw token/URL shown once. Revoked shares return `400`.

## 12. Public share API

These endpoints are public and rate-limited. They do not require the account access token. Share access tokens are scoped to one share/file/owner and expire after `SHARE_ACCESS_EXPIRES_MINUTES` (15 default).

### GET `/api/public/shares/:token`

Returns share metadata and a public file DTO:

```json
{
  "ownerName": "Ada Lovelace",
  "share": { "id": "66f...", "hasPassword": true, "...": "..." },
  "file": {
    "name": "holiday.jpg",
    "extension": "jpg",
    "mimeType": "image/jpeg",
    "mediaType": "image",
    "sizeBytes": 1843200,
    "thumbnailUrl": "...",
    "previewKind": "image"
  }
}
```

Invalid/revoked/expired links return `404` or `410`. A password-protected share returns metadata but download requires an access token.

### POST `/api/public/shares/:token/access`

```json
{ "password": "optional-password" }
```

If the share has no password, an empty object is accepted. Response `200`:

```json
{
  "accessToken": "<scoped JWT>",
  "expiresAt": "2026-11-13T10:15:00.000Z",
  "share": { "...": "..." },
  "file": { "...": "..." }
}
```

Wrong password: `401 SHARE_PASSWORD_INVALID`. Missing password on a protected share: `401 SHARE_PASSWORD_REQUIRED`.

### GET `/api/public/shares/:token/download`

Requires the scoped access token in either header:

```http
X-Share-Access-Token: <accessToken>
```

or query string `?accessToken=...`. Response `200`:

```json
{
  "url": "https://res.cloudinary.com/.../signed-download-url",
  "expiresAt": "2026-11-13T10:05:00.000Z",
  "fileName": "holiday.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1843200,
  "share": { "...": "..." }
}
```

The download counter is incremented atomically. When `maxDownloads` is reached, the request returns `410 SHARE_DOWNLOAD_LIMIT_REACHED`. The returned URL is short-lived and must not be persisted.

### Public HTML page

`GET /s/:token` renders the browser share page. For a protected share, `POST /s/:token/unlock` validates the password and sets an HttpOnly, SameSite=Lax cookie named `qd_share_access` (Secure in production). `GET /s/:token/download` uses that cookie to issue the signed download and redirects to Cloudinary. The page includes a strict CSP, `noindex`, escaped user content, and a responsive light/dark layout.

## 13. Storage

### GET `/api/storage`

Response `200`:

```json
{
  "summary": {
    "usedBytes": 1843200,
    "limitBytes": 5368709120,
    "availableBytes": 5366865920,
    "percentUsed": 0.03,
    "byMedia": {
      "image": { "bytes": 1843200, "count": 1 },
      "video": { "bytes": 0, "count": 0 },
      "audio": { "bytes": 0, "count": 0 },
      "document": { "bytes": 0, "count": 0 },
      "archive": { "bytes": 0, "count": 0 },
      "other": { "bytes": 0, "count": 0 }
    },
    "trash": { "bytes": 0, "count": 0 },
    "favorites": 0,
    "totalFiles": 1,
    "totalFolders": 0
  },
  "recentFiles": []
}
```

`usedBytes` includes trashed files and unreleased reservations. `byMedia` covers active files only. `trash` covers trashed files. `recentFiles` contains up to 8 active files.

## 14. Activity

### GET `/api/activities`

Query: `page`, `limit` (1–100), `type?` (one of the activity enum values). Response `200`: paginated `ActivityDto[]` newest first.

```json
{
  "id": "66f...",
  "type": "file_uploaded",
  "fileId": "66f...",
  "folderId": null,
  "shareId": null,
  "metadata": { "name": "holiday.jpg", "sizeBytes": 1843200 },
  "createdAt": "2026-11-13T10:00:00.000Z"
}
```

Activity types: `file_uploaded`, `file_downloaded`, `file_renamed`, `file_moved`, `file_favorited`, `file_unfavorited`, `file_deleted`, `file_restored`, `file_permanently_deleted`, `folder_created`, `folder_renamed`, `folder_moved`, `folder_deleted`, `folder_restored`, `share_created`, `share_revoked`, `share_regenerated`, `profile_updated`, `password_changed`, `avatar_updated`.

## 15. Health

### GET `/health`

Liveness. Does not require MongoDB/Cloudinary:

```json
{
  "success": true,
  "message": "QuickDrop API is healthy.",
  "data": {
    "status": "ok",
    "uptime": 42,
    "version": "0.1.0",
    "environment": "development"
  }
}
```

### GET `/health/ready`

Readiness. Returns `200` when MongoDB is connected and, if Cloudinary is configured, reachable. Returns `503` when a configured dependency is not ready.

```json
{
  "status": "ready",
  "dependencies": {
    "mongodb": { "ready": true },
    "cloudinary": { "configured": true, "ready": true, "latencyMs": 18 }
  }
}
```

If Cloudinary is not configured in development, readiness can still be `200` with `cloudinary.configured: false`; file endpoints will return `503`. Production startup rejects missing Cloudinary credentials.

## 16. Rate limits

Defaults (per process, in-memory):

| Scope | Window | Limit |
|---|---|---|
| Global API | 15 min | 300 |
| Auth endpoints | 15 min | 10 per IP |
| Upload sign/confirm | 60 min | 60 per user/IP |
| Public share endpoints/page | 1 min | 60 per IP |
| File downloads | 60 min | 120 per user/IP |

`express-rate-limit` standard draft-8 headers are emitted. In production with multiple API instances, the default memory store is per-instance; use a shared store for consistent limits.

## 17. cURL smoke flow

```bash
BASE=http://localhost:4000/api

# Register (use a unique email)
curl -sS -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke User","email":"smoke-'"$(date +%s)"'@example.com","password":"SmokePass9"}'

# Save the accessToken from the response, then:
TOKEN=<access token>
curl -sS "$BASE/users/me" -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE/storage" -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE/files" -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE/activities" -H "Authorization: Bearer $TOKEN"
```

Real uploads require valid Cloudinary credentials and a client that performs the direct multipart upload. Use the mobile app or the opt-in Cloudinary integration test for the full lifecycle.

## 18. OpenAPI status

A machine-readable OpenAPI document is not committed yet. This file is the authoritative endpoint reference for the current implementation. If an OpenAPI file is added later, it must be generated/validated against the routes and kept in sync with this document.
