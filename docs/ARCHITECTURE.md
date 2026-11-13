# QuickDrop architecture

## 1. Overview

QuickDrop is a two-application system with a deliberately small backend and direct-to-storage media transfer:

```text
┌──────────────────────────────┐        HTTPS/JSON        ┌──────────────────────────────┐
│  Expo / React Native app     │  ──────────────────────► │  Express / TypeScript API    │
│  Android + iOS               │                          │  JWT auth, quotas, metadata  │
│                              │  ◄────────────────────── │  REST + public share page    │
│  Expo Router                 │    signed URLs/metadata  └──────────────┬───────────────┘
│  TanStack Query + Zustand    │                                         │
│  SecureStore + SQLite        │                                         │ Mongoose
│  Expo FileSystem             │                                         ▼
└──────────────┬───────────────┘                          ┌──────────────────────────────┐
               │ direct signed upload / short-lived URL    │  MongoDB                     │
               └──────────────────────────────────────────►│  users, files, folders,      │
                                                           │  shares, sessions, activity  │
                                                           └──────────────────────────────┘
                                                           ┌──────────────────────────────┐
                                                           │  Cloudinary                  │
                                                           │  authenticated assets,       │
                                                           │  signed private delivery     │
                                                           └──────────────────────────────┘
```

There is no Socket.IO, WebSocket, or real-time channel. The app uses REST and TanStack Query cache invalidation/refetching. Upload progress comes from the actual direct upload request, not a simulated timer.

## 2. Repository layout

```text
QuickDrop/
├── backend/
│   ├── src/
│   │   ├── config/          environment, database, logger, Cloudinary
│   │   ├── middleware/      auth, validation, errors, rate limits, sanitization
│   │   ├── modules/         auth, users, files, folders, shares, storage, trash, activities
│   │   ├── jobs/            maintenance worker
│   │   ├── routes/          health and public HTML share page
│   │   ├── scripts/         manual maintenance trigger
│   │   └── utils/           API helpers, Cloudinary URLs, crypto, file types
│   └── tests/
├── frontend/
│   ├── src/app/             Expo Router routes only
│   ├── src/components/      shared UI and file/folder/share components
│   ├── src/hooks/           TanStack Query queries/mutations
│   ├── src/lib/             API client, upload queue, offline store, pickers, auth helpers
│   ├── src/providers/       providers, auth bootstrap, app lock, upload lifecycle
│   ├── src/store/           Zustand auth and preference stores
│   ├── src/theme/           semantic tokens and typography
│   └── tests/
├── docs/
└── PLAN.md
```

Routes live only in `frontend/src/app`. Every file under `(auth)`, `(tabs)`, `(protected)`, and `s/[token]` is a screen; reusable code lives outside the route tree.

## 3. Backend layering

- **Routes** declare URL paths, middleware, and validation schemas.
- **Controllers** extract validated input, call services, log operation-level events, and format responses with `apiResponse`.
- **Services** own business rules: ownership checks, quota changes, Cloudinary verification, share limits, and activity recording.
- **Models** declare Mongoose schemas, indexes, and document shapes.
- **Middleware** handles request IDs, HTTP logging, authentication, Zod validation, input sanitization, rate limits, 404s, and centralized errors.
- **Jobs** perform periodic repair/cleanup in the API process.
- **Utils** include `ApiError`, `apiResponse`, `asyncHandler`, Cloudinary URL helpers, and file type limits.

Every user-owned query is scoped by the authenticated owner. Invalid ObjectIds are rejected by Zod before reaching Mongo.

## 4. Authentication and session architecture

### Tokens

- Access token: JWT, 15 minutes by default, contains user id, role, token version, issuer, audience, and a `typ: access` claim.
- Refresh token: 48 random bytes, opaque to the client, stored server-side as an HMAC-SHA256 hash. It is never stored in plaintext in MongoDB.
- Refresh tokens rotate on every refresh. A reuse of an already-rotated token revokes the entire token family and all active sessions for that user.
- `User.tokenVersion` is included in access tokens. Incrementing it (password change/reset, logout-all) invalidates every access token immediately, even before its expiry.
- Mobile tokens live in Expo SecureStore. The app's Axios interceptor performs single-flight refresh so concurrent 401 responses do not create parallel refresh races.
- Logout clears the local session and revokes the presented refresh token. Logout-all revokes all refresh tokens and increments the token version.

### Session bootstrap

1. The app reads the stored session from SecureStore.
2. It calls `GET /users/me`.
3. A transient network/server failure may keep a cached profile only while the stored session is still valid.
4. A revoked/expired session is cleared; TanStack Query cache is cleared; the user is sent to sign-in.
5. On login, register, logout, logout-all, or session expiry, the query cache is cleared so another account cannot see the previous account's cached data.

### Auth guards

- `(tabs)` and `(protected)` layouts redirect unauthenticated users to sign-in.
- The biometric gate is an app-level lock after a session exists; it is not a replacement for server authentication.
- Public share routes are outside the auth guard and bypass the authenticated API client.

## 5. Upload architecture

QuickDrop uses signed direct uploads to keep file bytes off the API server.

### Sign

`POST /api/files/upload/sign`:

1. Validate the MIME type, filename, folder ownership, and per-media size limit.
2. Atomically reserve quota with a conditional `$inc` on the user document. If the reservation would exceed `storageLimitBytes`, return `413`.
3. Create a `pending` `UploadSession` with a unique Cloudinary public ID and the reserved bytes.
4. Generate Cloudinary signature parameters for a direct upload (timestamp, folder/public ID, allowed format, upload timeout).
5. Return the upload URL, public ID, signature, API key, and session id.

The client sends the actual file to Cloudinary. The API secret never leaves the backend.

### Confirm

`POST /api/files/upload/:sessionId/confirm`:

1. Atomically claim the session with `pending → confirming`. A concurrent duplicate gets `409 UPLOAD_CONFIRM_IN_PROGRESS`.
2. Verify the Cloudinary asset exists, belongs to the expected public ID, has an acceptable byte size/type, and does not exceed the reserved amount.
3. Adjust the reservation if Cloudinary reports a different byte size.
4. Resolve name conflicts in the destination folder.
5. Create the `File` record.
6. Mark the session `completed`, link the file, and release any unused reservation.
7. If Cloudinary verification fails transiently, restore the session to `pending` so the client can retry. If the upload is invalid, clean up the Cloudinary asset, release the reservation, and mark the session failed.

The confirmation claim prevents two concurrent requests from creating duplicate file records or double-charging quota. A process crash between file creation and session completion is repaired by maintenance.

### Mobile queue

- The queue is persisted in SQLite with an `owner_id`.
- Interrupted `signing`, `uploading`, or `confirming` rows are restored as `queued` on app start.
- A single upload runs at a time (`processQueue` is guarded).
- Files over 100 MB are rejected by the mobile single-request uploader. Chunked mobile upload is not implemented.
- The queue pauses when the app signs out or the session expires; in-flight transfers are cancelled and their rows remain scoped to the original account.
- The app does not promise background upload. Processing resumes when the app is active and online.
- Upload completion notifications are local notifications; there is no remote push infrastructure.

### Why direct upload?

- The backend remains stateless and does not need to buffer large files.
- Cloudinary handles storage and delivery.
- The API only issues and verifies short-lived capabilities.
- The tradeoff is that the client must be able to reach Cloudinary directly, and the backend must verify the resulting asset before trusting it.

## 6. Download and preview architecture

`GET /api/files/:id/download` and `/preview`:

1. Verify ownership and that the file is not trashed.
2. Atomically increment the download counter for downloads.
3. Build a Cloudinary private delivery URL with a short expiry (5 minutes).
4. Return the URL, expiry, and file metadata.

Images/videos/audio are rendered with native media components. PDFs use the platform/browser preview; text files can be previewed as text; Office documents use the native preview/share sheet. There is no fake in-app Office renderer.

Public share downloads use a share access token scoped to the share, file, and owner. The public HTML page stores that token in an HttpOnly cookie; the mobile/browser API path can send it in `X-Share-Access-Token`. The download counter is incremented atomically with a conditional update, so concurrent downloads cannot exceed `maxDownloads`.

## 7. Sharing architecture

- A share stores only an HMAC of the random token. The raw URL is returned once at creation or regeneration.
- Optional bcrypt password hash.
- Optional expiry date and maximum download count.
- Revocation is a timestamp; the link immediately becomes unusable.
- Regeneration rotates the token, resets download count/access metadata, and invalidates the old URL.
- The public page is server-rendered at `/s/:token` with a strict CSP, no-index headers, escaped content, and an HttpOnly/SameSite cookie for password access.
- Share creation/revocation/regeneration and shared downloads are recorded in activity history.

A share is a bearer capability. Anyone with the URL (and password, if set) can use it until it expires, is revoked, or reaches its download limit.

## 8. Storage, trash, and quota

- `User.storageUsedBytes` includes active files, trashed files, and unreleased upload reservations.
- Trash counts against quota until a file is permanently deleted or purged by retention.
- Quota reservation is atomic and compensated if signing/confirmation fails.
- Permanent deletion removes Cloudinary assets and share records, then releases quota.
- Folder deletion moves the folder tree to trash. Permanent folder deletion removes descendant folders/files and releases their storage.
- Maintenance reconciles storage from all file records plus all `pending`/`confirming` reservations. A compare-and-set prevents a concurrent upload from being overwritten; the next run repairs any drift.

Cross-document operations are not wrapped in a single MongoDB transaction. The design uses atomic single-document updates, idempotent claims, compensation, and maintenance reconciliation instead. This is intentional and documented as a tradeoff.

## 9. Maintenance worker

`startMaintenanceJobs()` runs immediately at startup and then every `MAINTENANCE_INTERVAL_MINUTES` (default 60):

1. Expire abandoned `pending` and `confirming` upload sessions, delete orphaned Cloudinary assets where possible, release reservations, and repair sessions whose file was already created.
2. Purge trashed files and folder trees older than `TRASH_RETENTION_DAYS` (default 30).
3. Prune terminal upload sessions older than `UPLOAD_SESSION_RETENTION_DAYS` (default 7).
4. Reconcile per-user storage counters against files plus unreleased reservations.

The worker logs a structured result (counts, released bytes, duration, errors) and continues if one step fails. A manual trigger is available with `npm run maintenance` in `backend/`.

Multiple API instances each start their own worker. The operations are designed to be safe/idempotent, but a production deployment that scales horizontally should normally run maintenance in one designated worker or use a shared scheduler. See the runbook.

## 10. Frontend architecture

### Routing

- Root stack: index redirect, auth group, tabs, protected stack, public share, not-found.
- Five primary tabs: Home, Files, Shares, More, Settings. The More tab links to Activity, Storage, Recycle bin, Upload queue, and Offline files; folder browsing and preview remain protected stack screens.
- Protected stack: folder browser, preview, activity, trash, storage, uploads, offline.
- Auth and protected layouts gate on the Zustand auth status.
- Typed routes and React Compiler are enabled in `app.json`.

### Data and state

- **TanStack Query** owns server data, pagination, cache invalidation, and retries.
- **Zustand** owns auth/session state, preferences, and the upload queue.
- **Axios** has a single-flight refresh interceptor and normalizes API errors.
- Query cache is cleared on account transitions.
- Mutations invalidate affected file/folder/share/storage/activity queries rather than relying on stale local copies.

### Offline

- SQLite `offline_files` stores metadata and local file URIs, scoped by `owner_id`.
- File content is downloaded to app-private documents storage (`quickdrop-offline`).
- Unscoped rows from pre-account-scoping builds are deleted during migration rather than exposed to the next account.
- Offline data is not encrypted at the application layer. The OS app sandbox and optional biometric gate are the current protections.
- The upload queue uses a separate SQLite table with the same owner scoping.

### Theme and platform adaptation

- Semantic light/dark color tokens; system theme by default with a user override.
- Safe-area-aware screens and tab bar.
- Minimum 48dp touch targets; system font scaling is allowed.
- Platform-specific keyboard behavior and interactive keyboard dismissal on iOS.
- Android predictive back is enabled in `app.json`; keyboard resize mode is set to `resize`.
- See [`UX_PLATFORM_GUIDE.md`](UX_PLATFORM_GUIDE.md) for the checklist and honest status.

## 11. Trust boundaries

| Boundary | Trusted side | Untrusted/validated side |
|---|---|---|
| Mobile app ↔ API | API authorization and validation | All request bodies, query params, file metadata, ObjectIds |
| API ↔ MongoDB | API service logic | Stored data is still validated by Mongoose schemas |
| API ↔ Cloudinary | Cloudinary asset identity/size after verification | Client-supplied Cloudinary response fields |
| Public share visitor ↔ API | Share token + optional access token | Password attempts, token strings, download requests |
| Device storage | OS app sandbox + optional biometric gate | Device backups, rooted devices, local malware |

## 12. Design limits and non-goals

- No real-time collaboration or push channel.
- No server-side file proxying or transcoding pipeline.
- No chunked/resumable mobile upload yet.
- No in-app Office rendering or virus scanning.
- No admin UI; the `admin` role exists in the schema but is not used by the mobile UI.
- No multi-tenant teams; each account owns its own vault.
- No universal links/App Links yet; reset links use a custom scheme.
- No distributed rate limiter or scheduler; those are deployment concerns documented in the runbook.
