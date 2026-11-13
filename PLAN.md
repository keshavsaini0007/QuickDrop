# QuickDrop — Master Project Plan

> Personal cloud storage and secure file sharing for Android and iOS.
>
> **Stack:** React Native + Expo + TypeScript + Expo Router + TanStack Query + Zustand + Axios + React Hook Form + Zod · Node.js + Express + TypeScript + Mongoose + MongoDB Atlas + JWT + bcrypt · Cloudinary.
>
> **Status policy:** “Implemented”, “automated tests pass”, and “verified on a physical Android/iOS device” are separate states. No device verification will be claimed unless it was actually performed.

---

## 1. Project Understanding

QuickDrop must be a real, production-oriented personal cloud-storage app, not a UI demo. The finished product must let a user:

1. Register, log in, persist a session, refresh tokens, log out, reset a forgotten password, and manage a profile.
2. Upload images, videos, PDFs, Office documents, and permitted text files directly to Cloudinary with short-lived server signatures.
3. Browse, search, filter, sort, paginate, preview, rename, move, favorite, download, soft-delete, restore, and permanently delete files.
4. Create nested folders, move files between them, and delete folder trees safely.
5. Create secure share links with optional password protection, expiry, download restrictions, revocation, and download counts.
6. Use native camera, gallery, document picker, native share sheet, local storage, notifications, and deep links on both platforms.
7. Mark files for offline use and manage a persistent foreground upload queue with progress, cancellation, retry, and restart recovery.
8. See real storage usage, real activity history, and a recycle bin with automatic expiry.
9. Optionally lock the app with device biometrics or the device passcode.
10. Feel native on Android and iOS: correct back behavior, insets, keyboard handling, permissions, dialogs, tab bars, touch targets, icons, dark mode, font scaling, and accessibility.

### Non-negotiable rules

- No fake functionality, fake upload progress, fake statistics, or hardcoded production records.
- No Socket.IO or real-time WebSockets. Use REST + TanStack Query.
- The root contains only the separated project areas `backend/`, `frontend/`, and `docs/`, plus root documentation/config files. No `apps/` or `packages/` wrapper.
- Required backend files must exist with these exact names:
  - `backend/src/utils/apiError.ts`
  - `backend/src/utils/apiResponse.ts`
  - `backend/src/utils/asyncHandler.ts`
  - `backend/src/config/cloudinary.ts`
- Important backend events must be visible in the terminal: startup, DB connection, Cloudinary checks, requests, auth events, upload signing/confirmation, cleanup jobs, purge jobs, and errors.
- Every feature is developed incrementally and checked with type-checking, linting, tests, and documentation before moving on.

---

## 2. Environment Findings and Blockers

| Item | Current state | Decision |
|---|---|---|
| Project root | Workspace root was empty and not a Git repository | Initialize Git during implementation |
| Installed Node | `v25.1.0` | **Unsupported by Expo SDK 58** |
| npm | `11.6.2` | Use the npm bundled with Node 26 LTS |
| Expo SDK | `58.0.25` | Target Expo SDK 58 |
| Expo Router | `58.0.31` | Use Expo Router 58 |
| React Native | `0.88.1` | Use the Expo-pinned version |
| React | `19.3.0` | Use the Expo-pinned version |
| TypeScript | `6.0.3` in the Expo template | Pin `~6.0.3` for frontend and backend |
| Current Node LTS | `26.13.1` (`OpenJS.NodeJS.LTS`) | Install Node 26 LTS before installing dependencies |
| Winget | Available | Can install Node 26 LTS; a portable Node distribution is the fallback if elevation is unavailable |

**Blocker:** Expo SDK 58 requires Node `^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`. The installed Node 25 must not be used for the project. The first implementation action is to install/select Node 26 LTS and verify `node -v`.

**Expo dependency policy:** use `npx expo install` for all Expo/React Native native packages so versions match the SDK 58 bundled-native-module manifest. Do not hand-pick native package versions.

---

## 3. High-Level Architecture

```
┌─────────────────────────────┐
│ Android / iOS app            │
│ Expo SDK 58 + Expo Router    │
│ TanStack Query + Zustand     │
│ SQLite offline cache/queue   │
│ SecureStore tokens           │
└──────────────┬──────────────┘
               │ HTTPS REST + short-lived JWTs
               ▼
┌─────────────────────────────┐
│ Express 5 + TypeScript API   │
│ Zod validation               │
│ JWT access + rotating refresh│
│ Owner-scoped authorization   │
│ Cloudinary signatures        │
│ Upload verification          │
│ Quota accounting             │
└───────┬──────────────┬───────┘
        │              │
        ▼              ▼
┌──────────────┐  ┌────────────────────┐
│ MongoDB Atlas│  │ Cloudinary         │
│ users/files  │  │ authenticated      │
│ folders/shares│ │ uploads + eager    │
│ activity     │  │ thumbnails         │
└──────────────┘  └────────────────────┘
```

### Key architectural decisions

1. **Cloudinary direct uploads.** The mobile app uploads bytes directly to Cloudinary using server-generated signatures. File bytes never pass through Express in normal operation.
2. **Authenticated Cloudinary assets.** Files are uploaded to the authenticated delivery type. Downloads use short-lived private download URLs; thumbnails use signed delivery URLs. This avoids public raw URLs.
3. **Server is authoritative.** The backend verifies every uploaded asset with the Cloudinary Admin API before creating a MongoDB record. Client-reported size, type, URL, and public ID are never trusted.
4. **Owner-scoped data access.** Every file, folder, share, activity, and trash query includes the authenticated owner ID. Share access is the only token-based exception.
5. **Atomic quota reservation plus compensation.** Upload confirmation reserves storage atomically, creates the file record, and rolls back on failure. A reconciliation job detects drift.
6. **Refresh tokens are opaque and rotating.** Access tokens are short-lived JWTs. Refresh tokens are random, stored only as HMAC hashes, rotated on use, and protected by reuse detection.
7. **Share tokens are hashed.** The raw share URL is returned once at creation. The database stores only an HMAC hash and a non-sensitive hint. Regeneration creates a new link.
8. **Local-first device state.** SQLite stores offline metadata, preferences, and the upload queue. SecureStore stores tokens. TanStack Query owns server state.
9. **Foreground upload queue.** Uploads are not promised to continue when the OS suspends the app. Queue state is persisted and recovered when the app returns.
10. **Local notifications only for MVP.** Device-side upload/download/storage events use local notifications. Remote push is documented as a future enhancement, not silently faked.

---

## 4. Root Layout

```
QuickDrop/
├─ backend/                  # Express + TypeScript API
├─ frontend/                 # Expo + React Native app
├─ docs/                     # All project documentation
├─ .github/                  # Optional CI workflow
├─ README.md
├─ CONTRIBUTING.md
├─ PLAN.md                   # Created when implementation mode starts
├─ .env.example              # Consolidated environment reference
├─ .gitignore
├─ .editorconfig
├─ .prettierrc.json
└─ .prettierignore
```

`backend/` and `frontend/` are independent Node projects with their own `package.json`; there is no monorepo workspace wrapper.

---

## 5. Product Scope

### 5.1 Authentication and account

- Register with name, email, password.
- Login, logout, logout from all sessions.
- Short-lived access token + rotating refresh token.
- Session restore on app launch.
- Forgot-password and reset-password flow.
- Profile view and edit (name, email with password confirmation).
- Change password with current-password verification; invalidate other sessions.
- Profile picture upload through signed Cloudinary upload.
- Optional biometric/device-credential app lock.

### 5.2 Files and folders

- Upload multiple files from gallery, camera, and document picker.
- Upload images, videos, PDFs, Office documents, and an explicit safe allowlist of text/document types.
- Single-request upload for normal files; chunked direct upload for large videos.
- Progress, pause/cancel where supported, retry, and persistent queue.
- File list/grid, search, type filter, favorites filter, sort, and pagination.
- Nested folders with breadcrumbs, create, rename, move, and safe recursive delete.
- File details, rename, move, favorite, download, preview, share, offline, trash.
- Recycle bin with restore, permanent delete, empty trash, and automatic purge.

### 5.3 Sharing

- Create share links for files.
- Optional password, expiry, and download permission.
- Revoke and regenerate links.
- List active, expired, and revoked links.
- Download count and last-access metadata.
- Public backend-hosted share page for users without the app.
- Deep links into the app for installed users.

### 5.4 Offline, activity, storage, notifications

- Mark files offline; download into app-managed storage.
- Detect missing or server-deleted local files.
- Open offline images/PDFs through local/native preview.
- Real storage dashboard with category breakdown and trash usage.
- Activity history for uploads, downloads, edits, shares, restores, and deletions.
- Local notifications for upload complete/fail, download complete, and storage warnings.
- Notification preferences.

### 5.5 Platform behavior

- Android: predictive back where supported, edge-to-edge insets, Material-style touch feedback and iconography, Android notification channels, runtime permissions, TalkBack, 48dp minimum touch targets.
- iOS: swipe-back, safe areas, SF/system typography, native share sheet, Face ID/Touch ID, Quick Look, VoiceOver, 44pt minimum targets.
- Both: system font scaling, light/dark/system themes, responsive layouts, portrait and landscape, keyboard-safe forms, accessible dialogs, lifecycle-safe state.

---

## 6. Backend Architecture

### 6.1 Folder structure

```
backend/
├─ src/
│  ├─ config/
│  │  ├─ cloudinary.ts              # REQUIRED: SDK config + safe config export
│  │  ├─ database.ts                # Mongoose connection, events, retries
│  │  ├─ environment.ts             # Zod-validated env; fails fast
│  │  └─ logger.ts                  # pino + pino-http configuration
│  ├─ middleware/
│  │  ├─ authenticate.ts            # Bearer JWT verification, tokenVersion check
│  │  ├─ authorize.ts               # Role guard (future-safe)
│  │  ├─ errorHandler.ts            # Central error mapping
│  │  ├─ notFound.ts
│  │  ├─ rateLimiter.ts             # Global/auth/upload/share/download limiters
│  │  ├─ requestContext.ts          # Request ID, pino child logger
│  │  ├─ sanitizeInput.ts           # Reject $ / dotted NoSQL-injection keys
│  │  └─ validateRequest.ts         # Zod body/query/params validation
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ auth.validation.ts
│  │  │  ├─ refreshToken.model.ts
│  │  │  └─ token.service.ts
│  │  ├─ users/
│  │  │  ├─ user.model.ts
│  │  │  ├─ user.controller.ts
│  │  │  ├─ user.service.ts
│  │  │  ├─ user.routes.ts
│  │  │  ├─ user.validation.ts
│  │  │  └─ avatar.service.ts
│  │  ├─ files/
│  │  │  ├─ file.model.ts
│  │  │  ├─ uploadSession.model.ts
│  │  │  ├─ file.constants.ts        # Allowlist, size limits, categories
│  │  │  ├─ file.controller.ts
│  │  │  ├─ file.service.ts
│  │  │  ├─ file.validation.ts
│  │  │  ├─ file.routes.ts
│  │  │  ├─ upload.service.ts        # Signatures, confirm, idempotency, quota
│  │  │  ├─ download.service.ts
│  │  │  └─ preview.service.ts
│  │  ├─ folders/
│  │  │  ├─ folder.model.ts
│  │  │  ├─ folder.controller.ts
│  │  │  ├─ folder.service.ts
│  │  │  ├─ folder.validation.ts
│  │  │  └─ folder.routes.ts
│  │  ├─ sharing/
│  │  │  ├─ share.model.ts
│  │  │  ├─ share.controller.ts
│  │  │  ├─ share.service.ts
│  │  │  ├─ share.access.service.ts
│  │  │  ├─ share.validation.ts
│  │  │  ├─ share.routes.ts
│  │  │  └─ publicShare.routes.ts    # /s/:token web fallback
│  │  ├─ activities/
│  │  │  ├─ activity.model.ts
│  │  │  ├─ activity.controller.ts
│  │  │  ├─ activity.service.ts
│  │  │  └─ activity.routes.ts
│  │  ├─ storage/
│  │  │  ├─ storage.controller.ts
│  │  │  ├─ storage.service.ts
│  │  │  └─ storage.routes.ts
│  │  ├─ trash/
│  │  │  ├─ trash.controller.ts
│  │  │  ├─ trash.service.ts
│  │  │  ├─ trash.routes.ts
│  │  │  └─ purge.service.ts
│  │  └─ public/
│  │     ├─ wellKnown.routes.ts      # AASA + assetlinks
│  │     └─ sharePage.ts             # Escaped server-rendered HTML
│  ├─ jobs/
│  │  ├─ scheduler.ts
│  │  ├─ uploadCleanup.job.ts
│  │  ├─ trashPurge.job.ts
│  │  └─ storageReconcile.job.ts
│  ├─ utils/
│  │  ├─ apiError.ts                 # REQUIRED
│  │  ├─ apiResponse.ts              # REQUIRED
│  │  ├─ asyncHandler.ts             # REQUIRED
│  │  ├─ cloudinaryAssets.ts         # Sign/verify/destroy/delivery helpers
│  │  ├─ crypto.ts                   # HMAC, random tokens, hashing
│  │  ├─ email.ts                    # Console dev transport + optional Resend
│  │  ├─ pagination.ts
│  │  ├─ token.ts                    # Access/share-access JWT helpers
│  │  └─ validators.ts               # Reusable Zod refinements
│  ├─ types/
│  │  ├─ express.d.ts                # req.user, req.validated, req.id
│  │  └─ domain.ts
│  ├─ app.ts                         # Express app, middleware, routes
│  └─ server.ts                      # Listen, jobs, graceful shutdown
├─ tests/
│  ├─ helpers/
│  ├─ fixtures/
│  ├─ unit/
│  ├─ integration/
│  └─ cloudinary.integration.test.ts # Opt-in real Cloudinary test
├─ .env.example
├─ Dockerfile
├─ eslint.config.mjs
├─ jest.config.js
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
└─ README.md
```

### 6.2 Required utility behavior

**`apiError.ts`**
- `ApiError extends Error` with `statusCode`, `code`, `errors`, `isOperational`.
- Static helpers such as `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooLarge`, `rateLimited`, `badGateway`, `internal`.
- Never expose stack traces or secrets to clients in production.

**`apiResponse.ts`**
- Consistent success envelope:
  ```json
  { "success": true, "message": "...", "data": {}, "meta": {} }
  ```
- Helpers for `ok`, `created`, `noContent`, and paginated responses.
- All controllers use this helper rather than ad-hoc `res.json`.

**`asyncHandler.ts`**
- Wraps async route handlers and forwards rejected promises to Express error middleware.
- Used by every async controller, even though Express 5 also handles rejected promises.

**`config/cloudinary.ts`**
- Configures Cloudinary from validated env.
- Exports the configured SDK, a safe config summary, and `assertCloudinaryConfigured`.
- Never logs the API secret.
- Asset signing/verification/destruction lives in `utils/cloudinaryAssets.ts` to keep configuration separate from behavior.

### 6.3 Error model

Error response:
```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "STORAGE_LIMIT_EXCEEDED",
  "errors": [{ "field": "size", "message": "..." }],
  "requestId": "..."
}
```

Planned codes include:
`VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `EMAIL_ALREADY_EXISTS`, `STORAGE_LIMIT_EXCEEDED`, `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INVALID_UPLOAD`, `SHARE_EXPIRED`, `SHARE_REVOKED`, `SHARE_PASSWORD_REQUIRED`, `RATE_LIMITED`, `CLOUDINARY_ERROR`, `INTERNAL_ERROR`.

The error handler maps:
- Zod errors → `VALIDATION_ERROR` (normally handled by validation middleware).
- Mongoose `CastError` → `NOT_FOUND`/`VALIDATION_ERROR`.
- Mongoose duplicate key → `CONFLICT`.
- JWT errors → `TOKEN_EXPIRED`/`UNAUTHORIZED`.
- Cloudinary/network errors → `CLOUDINARY_ERROR`/`BAD_GATEWAY`.
- Unknown errors → `INTERNAL_ERROR`.

### 6.4 Middleware order

1. Request ID + pino HTTP logger.
2. Security headers (`helmet`), CORS allowlist, compression.
3. Body parsers with a 1 MB JSON limit.
4. NoSQL-injection sanitization.
5. Global rate limiter.
6. Health routes.
7. Public share web routes and well-known files.
8. `/api` routes; auth-protected routers attach `authenticate`.
9. 404 handler.
10. Central error handler.

### 6.5 Logging and terminal visibility

Use **pino + pino-http**:
- Development: pretty, colorized terminal output with timestamps.
- Production: structured JSON.
- Request logs: request ID, method, redacted path, status, duration, user ID when authenticated.
- Redact: `authorization`, cookies, passwords, tokens, refresh tokens, reset tokens, share tokens, Cloudinary signatures/secrets, signed URLs.
- Share-token URL segments and query parameters are replaced with `:token` before logging.
- Important logs:
  - Startup configuration summary (safe values only).
  - Mongo connected/disconnected/reconnected/error.
  - Cloudinary configuration loaded and dependency check result.
  - Auth register/login/logout/refresh/reuse-detection events.
  - Upload session created/reissued/confirmed/rejected/orphaned.
  - Cloudinary asset verification and destruction.
  - Trash purge and upload-cleanup job counts/durations/failures.
  - Quota drift warnings.
  - Errors with request ID and stack only in development.
- Tests use silent logging.

### 6.6 Health and graceful shutdown

- `GET /health`: liveness, uptime, version, environment.
- `GET /health/ready`: MongoDB readiness plus a cached Cloudinary dependency check.
- Graceful shutdown on `SIGINT`/`SIGTERM`: stop accepting requests, close server, disconnect Mongo, stop jobs, force-exit after a timeout.
- Configure `trust proxy` for deployment so rate limiting sees the real client IP.

---

## 7. Frontend Architecture

### 7.1 Folder structure

```
frontend/
├─ app/                              # Expo Router routes only
│  ├─ _layout.tsx                    # Providers, auth gate, app lock, theme
│  ├─ index.tsx                      # Initial route decision
│  ├─ +not-found.tsx
│  ├─ (auth)/
│  │  ├─ _layout.tsx
│  │  ├─ login.tsx
│  │  ├─ register.tsx
│  │  ├─ forgot-password.tsx
│  │  └─ reset-password.tsx
│  ├─ (tabs)/
│  │  ├─ _layout.tsx                 # Five tabs, platform-adaptive tab bar
│  │  ├─ index.tsx                   # Home
│  │  ├─ files.tsx                   # Files root
│  │  ├─ upload.tsx                  # Upload options + active queue
│  │  ├─ shared.tsx                  # Share links
│  │  └─ profile.tsx
│  ├─ folder/
│  │  ├─ [id].tsx                    # Folder contents + breadcrumbs
│  │  └─ create.tsx                  # Create folder modal
│  ├─ file/
│  │  └─ [id].tsx                    # File details/actions
│  ├─ preview/
│  │  ├─ image.tsx
│  │  ├─ video.tsx
│  │  └─ document.tsx
│  ├─ camera.tsx                     # Camera capture modal
│  ├─ share/
│  │  └─ [id].tsx                    # Share management
│  ├─ s/
│  │  └─ [token].tsx                 # Public share deep link
│  ├─ activity/index.tsx
│  ├─ storage/index.tsx
│  ├─ favorites/index.tsx
│  ├─ trash/index.tsx
│  ├─ offline/index.tsx
│  ├─ upload/queue.tsx
│  ├─ profile/edit.tsx
│  └─ settings/
│     ├─ index.tsx
│     ├─ biometric.tsx
│     └─ notifications.tsx
├─ src/
│  ├─ components/
│  │  ├─ ui/                         # Button, TextField, Screen, Card, Dialog,
│  │  │                              # BottomSheet, EmptyState, ErrorState,
│  │  │                              # Skeleton, ProgressBar, Avatar, Badge,
│  │  │                              # SearchField, SegmentedControl, PlatformIcon
│  │  ├─ common/                     # FileCard, FolderCard, StorageBar,
│  │  │                              # ActivityItem, ShareCard, UploadQueueItem,
│  │  │                              # Breadcrumbs, PermissionGate, OfflineBadge
│  │  └─ layout/                     # ScreenContainer, AppHeader, FAB,
│  │                                 # KeyboardAwareScreen
│  ├─ features/
│  │  ├─ auth/                       # api, hooks, schemas, components
│  │  ├─ files/
│  │  ├─ folders/
│  │  ├─ uploads/                    # queue, processor, signing, chunking, pickers
│  │  ├─ downloads/
│  │  ├─ sharing/
│  │  ├─ activity/
│  │  ├─ storage/
│  │  ├─ trash/
│  │  ├─ offline/
│  │  ├─ profile/
│  │  └─ settings/
│  ├─ services/
│  │  ├─ api.ts                      # Axios instance + refresh interceptor
│  │  ├─ authTokens.ts               # SecureStore
│  │  ├─ upload.ts                   # Direct Cloudinary upload tasks
│  │  ├─ download.ts                 # Download tasks + local paths
│  │  ├─ notifications.ts
│  │  ├─ permissions.ts
│  │  ├─ deepLinks.ts
│  │  └─ logger.ts
│  ├─ store/
│  │  ├─ authStore.ts
│  │  ├─ uiStore.ts
│  │  └─ uploadStore.ts              # Live progress; SQLite remains source of truth
│  ├─ database/
│  │  ├─ db.ts
│  │  ├─ migrations.ts
│  │  ├─ offlineFiles.repo.ts
│  │  ├─ uploadQueue.repo.ts
│  │  └─ preferences.repo.ts
│  ├─ hooks/
│  │  ├─ useAppTheme.ts
│  │  ├─ useNetworkStatus.ts
│  │  ├─ useAppLock.ts
│  │  ├─ useDebounce.ts
│  │  └─ useRefreshOnFocus.ts
│  ├─ constants/
│  │  ├─ theme.ts
│  │  ├─ config.ts
│  │  ├─ fileTypes.ts
│  │  └─ queryKeys.ts
│  ├─ utils/
│  │  ├─ format.ts
│  │  ├─ errors.ts
│  │  ├─ platform.ts
│  │  └─ validation.ts
│  └─ types/
│     ├─ api.ts
│     ├─ domain.ts
│     └─ navigation.ts
├─ assets/                           # icon, adaptive icon, splash, favicon
├─ __tests__/
├─ app.config.ts
├─ eas.json
├─ eslint.config.js
├─ jest.config.js
├─ package.json
├─ tsconfig.json
└─ .env.example
```

### 7.2 State ownership

- **TanStack Query:** all server state (user, files, folders, shares, activities, storage, trash).
- **Zustand:** auth session in memory, UI preferences needed synchronously, and live upload/download progress.
- **SQLite:** offline file metadata, upload queue persistence, local preferences.
- **SecureStore:** access token, refresh token, and any small security-sensitive flags.
- **React Hook Form + Zod:** form state and client validation.

No duplicate server-state copies in Zustand. No production screens use hardcoded data.

### 7.3 API client and session behavior

- One Axios instance with the resolved API base URL.
- Access token attached as `Authorization: Bearer ...`.
- On `401 TOKEN_EXPIRED`, use a single-flight refresh promise; queue concurrent requests and retry them once.
- Refresh uses a separate bare Axios call to avoid interceptor recursion.
- On refresh failure, clear SecureStore, clear the query cache, clear user-local SQLite data, and return to login.
- Do not automatically retry a refresh request after a network failure; surface a retry/login state. This avoids refresh-token reuse ambiguity.
- Resolve the dev API URL from `EXPO_PUBLIC_API_URL`; otherwise derive the Metro host and port for local development. Production builds fail fast if no HTTPS API URL is configured.
- Use NetInfo to drive TanStack Query’s online manager and show an offline banner.

### 7.4 Query keys and invalidation

Centralize keys, for example:
`['me']`, `['files', filters]`, `['file', id]`, `['folders', parentId]`, `['folder', id]`, `['folderTree']`, `['shares', filters]`, `['share', id]`, `['activities', filters]`, `['storage']`, `['trash', filters]`, `['offlineFiles']`.

Invalidate the affected lists and summaries after upload confirmation, rename, move, favorite, delete, restore, permanent delete, share create/revoke, and profile changes. Use optimistic updates only for low-risk actions such as favorite toggling, with rollback on error.

---

## 8. Platform Adaptation Strategy

The app must not be “an iOS app running on Android.” It preserves the QuickDrop brand while adapting platform behavior.

### 8.1 Shared design tokens

- System font by default; no forced iOS font on Android.
- Semantic light/dark color tokens with WCAG AA contrast.
- Spacing scale, radius scale, typography scale, elevation/shadow tokens.
- Minimum touch targets: 48dp Android, 44pt iOS; components use at least 48dp.
- Respect system font scaling and reduced-motion settings.
- Light, dark, and system theme; user override stored in SQLite.
- No fake glassmorphism or iOS-only visual language imposed on Android.

### 8.2 Platform-specific components

- `PlatformIcon`: Material Community icons on Android, Ionicons on iOS for navigation and key actions; text labels for ambiguous actions.
- `PressableScale`: Android ripple + elevation, iOS opacity/press feedback.
- `Dialog`/`BottomSheet`: native `Alert` for destructive confirmations; custom platform-adaptive sheets for sort/filter/actions.
- Tab bar: five destinations, visible labels, platform-appropriate height/padding/insets and active treatment.
- Headers: Android top app bar feel; iOS large-title where appropriate; no double headers.
- Loading: native `ActivityIndicator` plus skeleton layouts; no iOS-only spinner assumptions.
- Empty/error states: clear explanation and one primary recovery action.

### 8.3 Android checklist

- Hardware/system back and predictive back; no conflicting custom edge gestures.
- Edge-to-edge safe areas for status and navigation bars; test gesture and three-button modes.
- `android.softwareKeyboardLayoutMode: "resize"` plus keyboard-avoiding forms.
- Runtime permissions requested in context, with rationale and “Open settings” recovery.
- Android notification channels and Android 13+ notification permission.
- Material-style ripple, icons, dialogs/sheets, and touch targets.
- TalkBack labels/roles, live regions for upload status, 48dp targets, font scaling.
- Test on Pixel, Samsung, and Xiaomi devices across supported Android versions.
- No guaranteed background uploads; foreground queue only.

### 8.4 iOS checklist

- Native swipe-back and navigation hierarchy.
- Safe areas for notch/Dynamic Island and home indicator.
- Face ID/Touch ID usage description and device-passcode fallback.
- Quick Look/native document preview and native share sheet.
- VoiceOver labels, 44pt targets, Dynamic Type.
- Limited photo-library access handling.
- Universal links for share/reset links in production.
- Test on a Face ID device and a Touch ID/small-screen device if available.

### 8.5 Forms, keyboard, and lifecycle

- `KeyboardAvoidingView` with platform-specific behavior, scrollable forms, `keyboardShouldPersistTaps="handled"`.
- Correct keyboard types, autofill/text-content types, and return-key progression.
- Preserve form state across app backgrounding; confirm before discarding unsaved changes.
- Persist upload queue and restore on launch; pause processing when backgrounded.
- Use AppState and NetInfo event listeners; no polling loops.

### 8.6 Accessibility and performance

- Accessibility labels/hints/roles/states on interactive elements.
- Announce upload/download completion and errors.
- Test TalkBack and VoiceOver, 200% font scaling, and contrast.
- FlashList for large lists; expo-image for cached thumbnails; server pagination.
- Avoid video autoplay in lists; load previews on demand.
- Profile on low-end Android hardware; avoid unnecessary animations and background work.

### 8.7 Deep links and sharing

- Scheme `quickdrop://` for development.
- Universal links (`ios.associatedDomains`) and Android App Links (`intentFilters`, `autoVerify`) for production share/reset URLs.
- Backend serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from environment configuration.
- Native share sheet for links and files; app-managed storage plus native export where public Downloads access differs by platform.
- Test cold-start and warm-start deep links; test web fallback when the app is not installed.

---

## 9. Database Design

MongoDB Atlas with Mongoose 9. No binary file content is stored in MongoDB.

### 9.1 `User`

| Field | Type | Notes |
|---|---|---|
| `name` | string | 2–80 chars, trimmed |
| `email` | string | lowercase, unique index |
| `passwordHash` | string | bcrypt, cost 12; never selected by default |
| `role` | enum | `user` / `admin`; no admin UI in MVP |
| `avatarPublicId` | string? | authenticated Cloudinary asset |
| `tokenVersion` | number | increment to invalidate all access tokens |
| `storageUsedBytes` | number | active + trashed files |
| `storageLimitBytes` | number | default from env |
| `passwordResetTokenHash` | string? | HMAC hash |
| `passwordResetExpiresAt` | Date? | short expiry |
| `lastLoginAt` | Date? | optional metadata |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `{ email: 1 }` unique.

### 9.2 `RefreshToken`

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId | ref User |
| `tokenHash` | string | HMAC-SHA256, unique |
| `familyId` | string | rotation family UUID |
| `expiresAt` | Date | TTL index |
| `revokedAt` | Date? | rotation/reuse/logout |
| `replacedByTokenHash` | string? | rotation audit |
| `createdByIp` | string? | truncated/hashed if logged |
| `userAgent` | string? | optional, sanitized |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `tokenHash` unique; `{ user: 1, familyId: 1 }`; TTL on `expiresAt`. Revoked tokens remain until expiry so reuse can be detected.

### 9.3 `Folder`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | ref User |
| `name` | string | 1–120 chars |
| `normalizedName` | string | lowercase, trimmed |
| `parent` | ObjectId? | null = root |
| `parentKey` | string | `"root"` or parent ID; simplifies uniqueness |
| `ancestors` | ObjectId[] | ordered root → parent |
| `depth` | number | max 10 |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes:
- `{ owner: 1, parentKey: 1, normalizedName: 1 }` unique.
- `{ owner: 1, parent: 1 }`.
- `{ owner: 1, ancestors: 1 }`.

Rules:
- Moving a folder into itself or a descendant is rejected using `ancestors`.
- Duplicate names within the same parent are rejected.
- Recursive delete moves contained files to trash, then removes folder records; files restore to root if the original folder is gone.
- Empty-folder delete is the default; non-empty delete requires explicit `mode=trash`.

### 9.4 `File`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | ref User |
| `folder` | ObjectId? | null = root |
| `name` | string | display name, sanitized |
| `originalName` | string | original client name, sanitized for storage |
| `normalizedName` | string | search helper |
| `mimeType` | string | verified against allowlist |
| `extension` | string | lowercase |
| `category` | enum | `image`, `video`, `document`, `other` |
| `size` | number | Cloudinary-verified bytes |
| `resourceType` | enum | `image`, `video`, `raw` |
| `deliveryType` | string | `authenticated` |
| `publicId` | string | server-generated; unique per owner |
| `format` | string | Cloudinary format |
| `cloudinaryVersion` | number? | asset version |
| `etag` | string? | Cloudinary etag |
| `width`, `height` | number? | images/videos |
| `duration` | number? | videos |
| `favorite` | boolean | default false |
| `downloadCount` | number | owner downloads |
| `lastDownloadedAt` | Date? | |
| `deletedAt` | Date? | soft delete |
| `purgeAt` | Date? | auto-purge deadline |
| `previousFolderId` | ObjectId? | restore hint |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes:
- `{ owner: 1, publicId: 1 }` unique.
- `{ owner: 1, deletedAt: 1, createdAt: -1 }`.
- `{ owner: 1, folder: 1, deletedAt: 1, name: 1 }`.
- `{ owner: 1, deletedAt: 1, category: 1, createdAt: -1 }`.
- `{ owner: 1, deletedAt: 1, favorite: 1, createdAt: -1 }`.
- `{ owner: 1, deletedAt: 1, purgeAt: 1 }`.

Rules:
- Display-name changes do not rename the Cloudinary public ID.
- Soft delete sets `deletedAt`, `purgeAt`, and `previousFolderId`; storage remains counted.
- Trashing revokes active shares.
- Permanent delete is allowed only for already-trashed files and only after successful Cloudinary destruction.
- Search uses escaped, case-insensitive matching within the owner scope; leading-wildcard searches are documented as less index-efficient.

### 9.5 `UploadSession`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | ref User |
| `idempotencyKey` | string | client UUID; unique per owner |
| `purpose` | enum | `file` / `avatar` |
| `publicId` | string | server-generated |
| `resourceType` | enum | image/video/raw |
| `deliveryType` | string | authenticated |
| `folderId` | ObjectId? | for files |
| `originalName`, `mimeType`, `expectedBytes`, `expectedFormat` | | server-validated |
| `status` | enum | `pending`, `confirming`, `confirmed`, `expired`, `failed`, `orphaned` |
| `expiresAt` | Date | signature/session lifetime |
| `confirmedFileId` | ObjectId? | file or null for avatar |
| `attempts` | number | retry audit |
| `lastError` | string? | sanitized |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `{ owner: 1, idempotencyKey: 1 }` unique; `{ status: 1, expiresAt: 1 }`; `{ owner: 1, publicId: 1 }`.

### 9.6 `Share`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | ref User |
| `file` | ObjectId | ref File |
| `tokenHash` | string | HMAC-SHA256, unique |
| `tokenHint` | string | first 8 chars for display only |
| `passwordHash` | string? | bcrypt, optional |
| `allowDownload` | boolean | default true |
| `expiresAt` | Date? | optional, max 365 days |
| `revokedAt` | Date? | revoke without deleting |
| `downloadCount` | number | successful public downloads |
| `accessCount` | number | metadata/password access count |
| `lastAccessedAt` | Date? | |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `tokenHash` unique; `{ owner: 1, createdAt: -1 }`; `{ file: 1, revokedAt: 1 }`.

Rules:
- Raw token is never stored and is returned only once.
- Regeneration revokes the old share and creates a new token with the same settings.
- Expired/revoked shares remain visible in the owner’s list for history.
- Public access checks the file is not trashed and the owner still exists.

### 9.7 `Activity`

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId | ref User |
| `type` | enum | upload/download/rename/move/favorite/delete/restore/permanent-delete/share/revoke/folder/profile/password |
| `file` | ObjectId? | optional |
| `folder` | ObjectId? | optional |
| `share` | ObjectId? | optional |
| `metadata` | object | safe display data only: name, size, category, counts |
| `createdAt` | Date | timestamps |

Indexes: `{ owner: 1, createdAt: -1 }`; `{ owner: 1, type: 1, createdAt: -1 }`; optional `{ owner: 1, file: 1, createdAt: -1 }`.

Activity records must never contain passwords, tokens, signed URLs, or raw IP addresses.

### 9.8 Storage accounting

- `storageUsedBytes` counts active **and** trashed files.
- Upload confirmation atomically reserves space with a conditional update.
- If file creation fails, the reservation is rolled back.
- Permanent deletion decrements storage only after Cloudinary destruction succeeds.
- A reconciliation job sums all non-permanently-deleted file sizes and logs/fixes drift.
- Storage summary uses the user counter for enforcement and an aggregation for category breakdown, counts, and trash usage.
- Default quota: 5 GiB, configurable by environment; per-user override possible in the database.

### 9.9 Deletion and retention policy

| Object | Policy |
|---|---|
| File delete | Soft delete; move to trash; revoke shares; keep storage counted |
| Trash restore | Clear delete fields; restore to original folder if it still exists, otherwise root |
| Permanent delete | Cloudinary destroy first; then Mongo delete; decrement storage |
| Trash auto-purge | Hourly/daily job deletes files past `purgeAt` |
| Folder delete | Empty by default; recursive mode moves contained files to trash then deletes folder tree |
| Upload session | Expired sessions cleaned up; orphaned Cloudinary assets destroyed |
| Refresh token | TTL after expiry; revoked tokens retained until expiry for reuse detection |
| Share | Expired/revoked retained for owner history |
| Activity | Paginated history; retention configurable/documented |

---

## 10. REST API Specification

Base path: `/api`. All timestamps are ISO 8601. IDs are strings. Success and error envelopes are consistent.

### 10.1 Authentication

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account; returns user + token pair |
| POST | `/auth/login` | Public | Email/password login; generic failure message |
| POST | `/auth/refresh` | Public | Rotate refresh token; returns new pair |
| POST | `/auth/logout` | Public | Revoke supplied refresh token; idempotent |
| POST | `/auth/logout-all` | Bearer | Revoke all sessions; increment tokenVersion |
| POST | `/auth/forgot-password` | Public | Always-generic response; sends/logs reset token |
| POST | `/auth/reset-password` | Public | Consume reset token; revoke all sessions |

Token response:
```json
{
  "success": true,
  "data": {
    "user": { "...": "..." },
    "accessToken": "...",
    "refreshToken": "...",
    "accessTokenExpiresAt": "2026-11-13T12:15:00.000Z"
  }
}
```

### 10.2 Users and avatar

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/users/me` | Bearer | Current profile + storage counters |
| PATCH | `/users/me` | Bearer | Update name/email; email requires current password |
| PATCH | `/users/me/password` | Bearer | Change password; revoke other sessions; return new pair |
| POST | `/users/me/avatar-signature` | Bearer | Signed avatar upload parameters |
| POST | `/users/me/avatar-confirm` | Bearer | Verify asset and set avatar |
| DELETE | `/users/me/avatar` | Bearer | Remove avatar and destroy old asset |

### 10.3 Files and uploads

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/files` | Bearer | List/search/filter/sort/paginate active files |
| POST | `/files/upload-signature` | Bearer | Validate metadata, reserve session, return signed params |
| POST | `/files/confirm-upload` | Bearer | Verify Cloudinary asset, enforce quota, create record |
| GET | `/files/:id` | Bearer | File details, breadcrumbs, share summary, preview metadata |
| PATCH | `/files/:id` | Bearer | Rename, move, or update allowed metadata |
| DELETE | `/files/:id` | Bearer | Soft delete/trash |
| POST | `/files/:id/favorite` | Bearer | Set favorite true/false |
| GET | `/files/:id/download` | Bearer | Short-lived private download URL + metadata |
| GET | `/files/:id/preview` | Bearer | Signed preview/thumbnail URLs or preview capability |

List query parameters:
`page`, `limit`, `search`, `folderId`, `scope=folder|all`, `category=image|video|document|other|all`, `favorite=true|false`, `sortBy=name|createdAt|updatedAt|size`, `sortDir=asc|desc`.

Upload signature request includes:
`fileName`, `mimeType`, `size`, `folderId?`, `idempotencyKey`, optional `checksum`.
Response includes:
`sessionId`, `uploadUrl`, `params`, `expiresAt`, `chunked`, `chunkSize`, `maxFileSize`.
The client never receives the Cloudinary API secret or chooses the public ID/folder.

Confirm request includes:
`sessionId`, `publicId`, `resourceType`, `bytes`, `format`, optional `version`.
The server re-fetches the asset from Cloudinary and compares it to the session.

### 10.4 Folders

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/folders` | Bearer | List child folders of root or `parentId` |
| GET | `/folders/tree` | Bearer | Flat folder tree for move picker |
| GET | `/folders/:id` | Bearer | Folder details + breadcrumbs + counts |
| POST | `/folders` | Bearer | Create folder |
| PATCH | `/folders/:id` | Bearer | Rename or move folder |
| DELETE | `/folders/:id?mode=reject|trash` | Bearer | Delete empty folder or trash its contents |

Folder deletion with `mode=trash` requires explicit user confirmation in the UI and returns `{ foldersDeleted, filesTrashed }`.

### 10.5 Sharing

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/shares` | Bearer | Create link; returns raw URL once |
| GET | `/shares` | Bearer | List links with `status=active|expired|revoked|all` |
| GET | `/shares/:id` | Bearer | Share details; no raw token |
| PATCH | `/shares/:id` | Bearer | Update expiry, password, download permission |
| POST | `/shares/:id/regenerate` | Bearer | Revoke old link and return a new URL once |
| DELETE | `/shares/:id` | Bearer | Revoke link |
| GET | `/shares/public/:token` | Public | Public metadata; reports password requirement |
| POST | `/shares/public/:token/access` | Public | Verify password; returns short-lived share access token |
| GET | `/shares/public/:token/download` | Public | Validate share/access; return short-lived download URL |

Public share page (not under `/api`): `GET /s/:token` and `POST /s/:token/unlock`. The page is server-rendered, escaped, rate-limited, and CSP-protected. It links to a short-lived download URL after validation.

Share creation body:
`fileId`, optional `expiresInDays`/`expiresAt`, optional `password`, `allowDownload`.

### 10.6 Activity, storage, trash

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/activities` | Bearer | Paginated history; optional type/file/date filters |
| GET | `/storage/summary` | Bearer | Used/limit/available, counts, category breakdown, trash usage |
| GET | `/trash` | Bearer | Paginated trashed files |
| POST | `/trash/:id/restore` | Bearer | Restore file |
| DELETE | `/trash/:id` | Bearer | Permanently delete after Cloudinary destruction |
| DELETE | `/trash` | Bearer | Empty trash in safe batches |

### 10.7 Health and platform files

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| GET | `/health/ready` | Public | Mongo/Cloudinary readiness |
| GET | `/.well-known/apple-app-site-association` | Public | iOS universal links |
| GET | `/.well-known/assetlinks.json` | Public | Android App Links |

### 10.8 Pagination contract

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 30,
    "total": 125,
    "totalPages": 5,
    "hasNextPage": true
  }
}
```

Limits are clamped server-side; default 30, maximum 100.

---

## 11. Cloudinary Upload and Delivery Workflow

### 11.1 Asset classification

| Category | MIME/extension examples | Cloudinary `resource_type` | Upload delivery type |
|---|---|---|---|
| Image | jpg, jpeg, png, webp, gif, heic, heif | `image` | `authenticated` |
| Video | mp4, mov, m4v, webm | `video` | `authenticated` |
| Document | pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, rtf | `raw` | `authenticated` |
| Other | Explicitly permitted only | — | — |

Executable files, scripts, HTML, SVG, and arbitrary archives are excluded from the allowlist. MIME type and extension must agree; Cloudinary’s verified format must match the allowed format.

### 11.2 Upload sequence

1. **Client prepares the file.**
   - Picker returns a local URI, name, MIME type, and size.
   - The client stages a durable copy in app-managed storage and inserts a queue row with a UUID idempotency key.
2. **Client requests a signature.**
   - `POST /api/files/upload-signature`.
   - Backend validates owner, folder ownership, MIME/extension allowlist, size limits, and a preliminary quota check.
   - Backend creates or reuses an `UploadSession` for the idempotency key.
   - Backend generates a random public ID under the owner’s prefix, for example:
     `quickdrop/u/{userId}/{uuid}` (raw assets include the safe extension).
3. **Backend signs upload parameters.**
   - Authenticated endpoint:
     `https://api.cloudinary.com/v1_1/{cloud}/{resourceType}/authenticated`.
   - Signed parameters include `timestamp`, `public_id`, `overwrite=false`, `use_filename=false`, `unique_filename=false`, fixed `tags`, and the fixed eager thumbnail transformation for image/video.
   - The client receives only `api_key`, `timestamp`, `signature`, public parameters, session ID, expiry, and chunk settings.
4. **Client uploads directly to Cloudinary.**
   - Normal files use Expo FileSystem `File.createUploadTask` with multipart form data, progress, and cancellation.
   - Large videos use chunked upload with `X-Unique-Upload-Id` and `Content-Range` headers; chunk size is at least 5 MB (planned 10 MB) except the final chunk.
   - Chunks are read through Expo FileSystem and written to temporary chunk files, then uploaded with the same signature parameters. This provides progress and cancellation without loading the entire file into memory.
   - If the app restarts, the queue row preserves session ID, public ID, upload ID, and chunk progress. The uploader resumes or re-signs within the session window; expired sessions are restarted safely.
5. **Client confirms the upload.**
   - `POST /api/files/confirm-upload` with session ID, public ID, resource type, bytes, and format.
   - The backend calls the Cloudinary Admin API and verifies:
     - public ID exactly matches the session;
     - resource type and delivery type are correct;
     - bytes match the expected size;
     - format is allowed and matches the extension/category;
     - the asset exists and belongs under the owner’s prefix.
   - The backend atomically reserves quota, creates the MongoDB file record, and marks the session confirmed.
   - If the file record already exists for this owner/public ID, the operation is idempotent and returns it.
6. **Rollback and cleanup.**
   - If verification or DB creation fails, the backend attempts to destroy the uploaded asset.
   - If destruction fails, the session is marked `orphaned` and a cleanup job retries.
   - Pending sessions older than their TTL are checked; orphaned assets are destroyed and sessions expire.
   - A periodic reconciliation job checks quota drift.

### 11.3 Thumbnails and previews

- Images and videos use a fixed eager thumbnail transformation generated during authenticated upload:
  `c_fill,w_400,h_400,q_auto,f_jpg`.
- The backend returns a signed thumbnail URL for lists; if the derived asset is unavailable, the UI shows a category icon rather than a broken image.
- Image detail previews use a signed URL to the authenticated original.
- Video previews use expo-video with a signed original URL; lists never autoplay.
- PDFs are stored as authenticated raw files. The app downloads the PDF and opens it with the native preview/Quick Look/installed viewer. An optional Cloudinary PDF-page thumbnail can be enabled if the Cloudinary account supports PDF delivery; it is not a dependency.
- Office documents are not rendered in-app; the app downloads and offers native preview/share. No fake document rendering.

### 11.4 Download delivery

- The backend returns short-lived `private_download_url` links for authenticated assets.
- Links are time-limited (planned 5 minutes) and include the original filename as an attachment where supported.
- Mobile downloads use `File.createDownloadTask` with progress and cancellation, checking available disk space first.
- The app never stores raw Cloudinary URLs in MongoDB.
- If a download URL expires, the client requests a fresh one once.

### 11.5 Cloudinary limits and risks

- Cloudinary requires chunked uploads above 100 MB; the app must support chunking for large videos.
- Authenticated assets cannot use arbitrary on-the-fly transformations; derived assets must be generated eagerly. This plan uses one fixed eager thumbnail.
- Raw authenticated delivery and private download URLs must be verified with a real Cloudinary integration test before claiming the workflow works end-to-end.
- Cloudinary plan quotas and transformation limits apply; configuration documents the account prerequisites.
- No malware/virus scanning is provided by this project. The allowlist reduces risk but does not guarantee file safety. This limitation will be documented, not hidden.

---

## 12. Authentication and Security Architecture

### 12.1 Tokens

**Access token**
- JWT, 15-minute lifetime (configurable).
- Claims: `sub`, `role`, `tokenVersion`, `type=access`, `aud`, `iss`, `jti`.
- Verified signature, issuer, audience, expiry, token type, and current user tokenVersion.

**Refresh token**
- 48 random bytes, base64url.
- Stored only as `HMAC-SHA256(REFRESH_TOKEN_PEPPER, token)`.
- 30-day lifetime, rotated on every refresh.
- Family ID for reuse detection.
- If a revoked/reused token is presented, revoke the entire family, log a security event, and return 401.
- Mobile stores refresh tokens in SecureStore; they are never logged or placed in query strings.

**Password reset token**
- 32 random bytes; stored as an HMAC hash with a short expiry (60 minutes).
- Response is always generic to avoid account enumeration.
- Development can log the reset link/token when explicitly enabled; production requires an email provider (optional Resend integration).
- Reset revokes all refresh tokens and increments tokenVersion.

**Share access token**
- Short-lived JWT (15 minutes) scoped to one share and file.
- Required only when the share has a password.
- Sent in a header, not a URL, for API downloads.
- Web share page uses a short-lived server-generated download link after password verification.

### 12.2 Password and credential handling

- bcrypt via `bcryptjs`, cost 12, max password length 72 bytes.
- Minimum 8 characters with letter/number requirements; never trim passwords.
- Generic login failure message; compare against a dummy hash when the user does not exist to reduce timing differences.
- Password change requires the current password and revokes other sessions.
- Email change requires the current password.
- No email verification or 2FA in MVP; documented as a roadmap item.

### 12.3 Authorization

- Every owner-scoped query includes `owner: req.user.id`.
- Folder ownership is validated when uploading/moving.
- Share access validates token hash, expiry, revocation, file active state, password/access token, and download permission.
- No endpoint accepts a client-supplied owner ID.
- Admin role exists in the model but has no admin surface in MVP.

### 12.4 Upload and file security

- Server-generated public IDs; no client-chosen Cloudinary paths.
- Signed direct uploads; no API secret on the device.
- Server-side Cloudinary verification before DB creation.
- Allowlisted MIME/extension/format, per-category size limits, global max size.
- Quota pre-check plus atomic reservation at confirmation.
- Idempotency key + unique owner/public ID + idempotent confirm.
- Orphan cleanup and reconciliation jobs.
- Sanitized display names; no path traversal; no executable/HTML/SVG uploads.
- Trashed files cannot be downloaded or shared.
- Permanent deletion destroys the Cloudinary asset before deleting the DB record.

### 12.5 API hardening

- Helmet security headers; CSP for server-rendered share pages.
- CORS allowlist; mobile requests without Origin are allowed.
- Global and route-specific rate limits.
- 1 MB JSON body limit.
- Zod `.strict()` request schemas.
- Recursive rejection of `$`/dotted keys in body input to prevent NoSQL operator injection.
- Request IDs in logs and error responses.
- No tokens, passwords, signed URLs, or Cloudinary secrets in logs.
- HSTS in production; HTTPS required for production API and share links.
- Memory rate-limit store is single-instance; Redis is documented for horizontal scaling.

### 12.6 Mobile security

- Access/refresh tokens in SecureStore with device-only accessibility.
- No sensitive data in AsyncStorage or logs.
- App lock uses expo-local-authentication with device-passcode fallback; biometric data never leaves the OS.
- Local files live in the app sandbox; logout clears tokens, query cache, offline metadata/files, and queue data.
- Permission rationale and recovery states; no permission requests without context.
- Custom-scheme reset links are a dev convenience; production should use HTTPS universal/app links and manual token entry fallback.
- Screenshot blocking is not implemented in MVP; documented as a possible enhancement.

### 12.7 Known security limitations

- No malware scanning.
- No email verification, 2FA, or account-deletion flow in MVP.
- Cloudinary signed URLs grant access to anyone who possesses them until expiry/rotation; downloads are short-lived, thumbnails use signed delivery URLs.
- No guaranteed background execution means an upload may pause when the OS suspends the app.
- Physical-device security and accessibility testing must still be performed.

---

## 13. Offline, Upload Queue, Downloads, Notifications, and App Lock

### 13.1 SQLite schema

`quickdrop.db` with `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, and versioned migrations.

**`offline_files`**
- `file_id` primary key
- `name`, `mime_type`, `size`, `category`, `folder_id`
- `local_uri`, `downloaded_at`, `checksum?`
- `status`: `available`, `missing`, `cloud_missing`

**`upload_queue`**
- `id` primary key (UUID)
- `local_uri`, `file_name`, `mime_type`, `size`, `folder_id`
- `idempotency_key` unique
- `session_id`, `public_id`, `upload_id?`, `next_chunk?`
- `status`: `pending`, `uploading`, `confirming`, `failed`, `completed`, `canceled`
- `progress`, `bytes_uploaded`, `attempts`, `last_error`
- `created_at`, `updated_at`

**`preferences`**
- key/value pairs: theme, file view mode, app lock enabled/timeout, notification toggles, last storage warning level.

Repositories encapsulate SQL. Screens never run raw SQL.

### 13.2 Upload queue behavior

- One active upload at a time to keep memory and network usage predictable.
- Queue starts only when authenticated, online, and the app is foregrounded.
- AppState background pauses scheduling; native tasks may continue briefly on iOS but are never promised.
- On app start, rows stuck in `uploading`/`confirming` are recovered: confirm if the asset exists, otherwise re-sign/resume/restart safely.
- Exponential backoff for transient network/5xx errors; no blind retry of 4xx; manual retry always available.
- Cancellation cancels the active native task and marks the queue row canceled; temporary chunk files are removed.
- Completion deletes the staged upload copy after confirmation; failed/canceled items keep their copy until the user removes them.
- Upload completion/failure notifications respect user preferences.

### 13.3 Offline files

- User marks a file offline from file details or the file list.
- App checks available disk space, downloads with progress, and inserts metadata only after success.
- Offline screen lists local files, total size, and status; supports open/share/remove.
- On launch, local existence is checked; missing files are marked and can be re-downloaded or removed.
- When online, a deleted server file is detected via API and marked `cloud_missing` with an explanation.
- No background sync or conflict resolution in MVP; server remains source of truth.
- Logout deletes offline files and queue rows.

### 13.4 Downloads and previews

- `File.createDownloadTask` with progress, cancel, and retry.
- Destination: app-managed documents directory with sanitized filenames.
- Insufficient-space errors are shown before/while downloading.
- Images use expo-image; videos use expo-video; PDFs download then use native `File.preview()`.
- Office/unknown documents offer native preview/share; if no viewer exists, the share sheet is the fallback.
- Export to public storage uses native share/SAF on Android and the share sheet/Files on iOS; platform differences are documented.

### 13.5 Notifications

- Local notifications only in MVP.
- Android channels: uploads, downloads, storage.
- Permission requested contextually (settings or first meaningful use), with denied/permanent-denied recovery states.
- Foreground handler and notification-response listener navigate to the relevant file/queue screen.
- Notification preferences are local and respected before scheduling.
- Remote push is a documented roadmap item, not claimed.

### 13.6 Biometric app lock

- Uses expo-local-authentication; checks hardware and enrollment.
- Enabling requires a successful authentication; disabling requires authentication.
- On launch and after a configurable background timeout, a full-screen lock gate renders before app content.
- Device passcode fallback is allowed; biometric data never leaves the device.
- If authentication is unavailable and no device credential exists, the user can log out; there is no silent bypass.
- Face ID usage description and Android biometric permissions configured.
- Must be tested on real devices; Expo Go limitations are documented.

---

## 14. Testing Strategy

### 14.1 Backend tests

**Unit**
- Token creation/verification, refresh-token hashing/rotation, reuse detection.
- HMAC share-token hashing and token hints.
- File allowlist, MIME/extension matching, size limits, category mapping.
- Pagination parsing/clamping.
- Storage calculation and warning levels.
- Sanitization of `$`/dotted keys.
- Error response mapping.

**Integration (Jest + Supertest + mongodb-memory-server)**
- Register, login, duplicate email, generic login failure.
- Refresh rotation, old-token reuse revokes family, logout, logout-all.
- Forgot/reset password and tokenVersion invalidation.
- Profile update, password change, email uniqueness.
- Upload signature validation, folder ownership, quota rejection.
- Confirm-upload success, duplicate/idempotent confirm, Cloudinary verification failure, rollback.
- Cross-user file/folder/share access is denied.
- File list/search/filter/sort/pagination.
- Folder nesting, duplicate sibling names, circular move rejection, recursive delete.
- Share creation returns raw token once; hash is stored; expiry/password/revoke/download count.
- Trash restore, permanent delete, purge eligibility.
- Storage summary and activity creation.
- Health/readiness.
- Rate-limit behavior where deterministic.

**Cloudinary integration (opt-in)**
- Upload a small fixture to authenticated delivery.
- Verify via Admin API.
- Generate and fetch a private download URL.
- Generate a thumbnail signed URL.
- Destroy the asset.
- Skipped unless real Cloudinary credentials are supplied.

Use a global MongoMemoryServer setup or a per-suite instance, clear collections between tests, disable rate limits or use high test limits, and silence pino.

### 14.2 Frontend tests

Use `jest-expo`, `@testing-library/react-native`, and explicit mocks for native modules.

- Zod form schemas and server-error mapping.
- Auth store hydration/logout and single-flight refresh behavior.
- Query key/invalidation helpers.
- Upload queue state transitions, recovery, retry, cancellation.
- Chunk calculation and progress math.
- File size/date formatting and category mapping.
- Offline repository logic with a mocked SQLite layer.
- Component tests for Button, TextField, EmptyState, FileCard, UploadQueueItem, login form, share form.
- No test should depend on a real network, camera, biometric sensor, or Cloudinary account.

### 14.3 Manual device verification matrix

Automated tests do not prove platform behavior. The following must be run on real devices before claiming verification:

- Android: Pixel (stock Android), Samsung, Xiaomi; supported API levels; gesture and three-button navigation.
- iOS: Face ID device and Touch ID/small-screen device if available.
- Cold start, warm start, background/foreground, process death, low-memory conditions.
- Back navigation, predictive back, deep links, share sheet, keyboard, permissions.
- TalkBack and VoiceOver, font scaling, dark mode, landscape/tablet.
- Camera, gallery, document picker, PDF preview, video playback.
- Upload progress/cancel/retry, large chunked upload, network interruption, queue recovery.
- Download interruption, disk-space handling, offline open, missing-file detection.
- Share link creation/copy/password/expiry/revoke/download count/web fallback.
- Biometric lock and device-passcode fallback.
- Local notifications foreground/background/tap behavior.
- Low-end Android performance and battery behavior.

`docs/IMPLEMENTATION_STATUS.md` and `docs/PLATFORM_TEST_MATRIX.md` will record honest statuses. Device verification remains “pending” until actually performed.

---

## 15. Documentation Deliverables

Root:
- `README.md` — overview, features, stack, quick start, status.
- `CONTRIBUTING.md` — standards, workflow, commit/PR checklist.
- `PLAN.md` — this plan, copied into the repo when implementation starts.
- `.env.example` — consolidated reference.
- `.gitignore`, `.editorconfig`, Prettier config.

`docs/`:
- `PROJECT_OVERVIEW.md`
- `ARCHITECTURE.md`
- `DATABASE.md` / `DATABASE_SCHEMA.md`
- `API.md` and `openapi.yaml`
- `SECURITY.md`
- `TESTING.md`
- `TESTING_STRATEGY.md`
- `PLATFORM_TEST_MATRIX.md`
- `UX_PLATFORM_GUIDE.md` — includes the Android/iOS adaptation checklist and the 28 UX challenges.
- `SETUP.md`
- `RUNBOOK.md` / `DEPLOYMENT.md`
- `CHANGELOG.md`
- `ROADMAP.md` / `DEVELOPMENT_ROADMAP.md`
- `IMPLEMENTATION_STATUS.md`
- `TROUBLESHOOTING.md`
- `QuickDrop.postman_collection.json`

Documentation must describe real behavior and clearly list limitations, prerequisites, and unverified items.

---

## 16. Dependency Baseline

### 16.1 Runtime

- Node.js **26.13.x LTS** (current LTS). Minimum supported for the project: Node 24.3+ or 26.x.
- npm bundled with Node 26.

### 16.2 Backend (planned)

| Package | Version | Purpose |
|---|---|---|
| express | ^5.3.0 | HTTP API |
| mongoose | ^9.12.1 | MongoDB ODM |
| zod | ^4.6.7 | Env + request validation |
| jsonwebtoken | ^9.0.3 | Access/share-access JWTs |
| bcryptjs | ^3.0.3 | Password/share-password hashing |
| cloudinary | ^2.11.0 | Upload/signature/Admin API |
| pino / pino-http | ^10.4.0 / ^11.0.0 | Logging |
| helmet | ^8.3.0 | Security headers |
| cors | ^2.8.6 | CORS allowlist |
| express-rate-limit | ^8.7.4 | Rate limiting |
| compression | ^1.8.2 | Response compression |
| dotenv | ^18.0.10 | Environment loading |

Dev: `typescript ~6.0.3`, `tsx ^4.23.15`, `jest ^30.5.2`, `ts-jest ^29.4.15`, `supertest ^7.3.2`, `mongodb-memory-server ^11.3.0`, `pino-pretty ^13.2.0`, `eslint ^9.39.5`, `typescript-eslint ^8.72.2`, `prettier ^3.10.1`, matching `@types/*`.

### 16.3 Frontend (planned)

Core:
`expo ~58.0.25`, `expo-router ~58.0.31`, `react 19.3.0`, `react-native 0.88.1`, `typescript ~6.0.3`.

Data/forms/state:
`@tanstack/react-query ^5.107.1`, `zustand ^5.1.0`, `axios ^1.21.1`, `react-hook-form ^7.92.0`, `@hookform/resolvers ^7.0.6`, `zod ^4.6.7`.

Expo/native packages (use `npx expo install` to confirm SDK 58 versions):
`expo-file-system`, `expo-sqlite`, `expo-secure-store`, `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-notifications`, `expo-local-authentication`, `expo-sharing`, `expo-linking`, `expo-device`, `expo-constants`, `expo-clipboard`, `expo-haptics`, `expo-image`, `expo-image-manipulator`, `expo-video`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-dev-client`, `@react-native-community/netinfo 12.0.1`, `@shopify/flash-list 2.3.2`.

Expo Router peer-compatible packages from the SDK template:
`@expo/vector-icons`, `@expo/ui`, `expo-symbols`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`.

Dev: `jest-expo`, `jest`, `@testing-library/react-native`, `react-test-renderer`, `eslint`, `eslint-config-expo`, `prettier`, `@types/react`.

Do not add Socket.IO, a second navigation system, or a competing form/query library.

---

## 17. Implementation Phases and Acceptance Criteria

### Phase 0 — Architecture and plan
- Confirm scope, stack, data model, API, security, platform strategy.
- Record environment blocker (Node 25).
- Deliverable: approved plan.
- Acceptance: user approves architecture and dependency direction.

### Phase 1 — Foundation
- Install Node 26 LTS and verify versions.
- Initialize Git and root structure.
- Scaffold backend and Expo frontend.
- Add env validation, logger, DB connection, health routes, graceful shutdown.
- Add design tokens, theme provider, base UI components, API client, navigation shell, splash/error boundaries.
- Add lint/format/typecheck scripts and root documentation skeleton.
- Acceptance: backend starts and logs visibly; health check passes; frontend bundles; lint/typecheck pass; no fake screens.

### Phase 2 — Authentication
- User/refresh-token models, token service, auth endpoints, validation, rate limits.
- Password reset with dev email transport and optional Resend.
- Mobile auth screens, SecureStore, session hydration, refresh interceptor, auth gate, logout, profile fetch.
- Tests for rotation/reuse and auth flows.
- Acceptance: register/login/refresh/logout/reset work end-to-end in development; tokens never logged; automated tests pass.

### Phase 3 — Files and Cloudinary uploads
- Upload session model/service, signatures, server verification, quota reservation, idempotency, cleanup job.
- File model, listing/search/filter/sort/pagination, details, rename, move, favorite, soft delete, download/preview URLs.
- Mobile file list/grid, search/filter/sort, details, picker flow, single upload progress/cancel/retry, download.
- Tests with mocked Cloudinary and opt-in real integration test.
- Acceptance: real/mocked upload path verified; duplicate confirms are safe; quota enforced; cross-user access denied.

### Phase 4 — Native platform integration
- Camera capture, gallery multi-select, document picker, native share sheet, local file handling, permission rationale/settings recovery.
- Image/video/PDF preview behavior.
- Platform-specific UI polish for back navigation, insets, keyboard, dialogs, tab bar, icons.
- Acceptance: automated checks pass; device checklist prepared; do not claim device verification until run.

### Phase 5 — Folders, sharing, trash, activity, storage
- Folder CRUD/tree/move/recursive delete.
- Share creation/password/expiry/revoke/regenerate/public page/download counts.
- Recycle bin restore/permanent delete/purge job.
- Activity history and storage dashboard.
- Mobile screens for all of the above.
- Acceptance: share security tests pass; trash policy works; storage totals match aggregation; activity records real events.

### Phase 6 — Offline, queue, notifications, biometrics
- SQLite migrations/repositories, offline download/open/remove/missing detection.
- Persistent upload queue, recovery, retry, chunked uploads, network/app-state handling.
- Local notifications and preferences.
- App lock with biometrics/device credentials and timeout.
- Settings screens.
- Acceptance: queue survives restart; offline files open; notification and lock flows work in dev builds; device verification pending.

### Phase 7 — Hardening and verification
- Complete backend/mobile tests, lint/typecheck, expo-doctor, bundle/export checks.
- Security review, error-state review, accessibility pass, performance pass.
- Android/iOS platform checklist and fixes.
- Postman collection and API docs.
- Acceptance: all automated checks pass; known limitations documented; no false verification claims.

### Phase 8 — Release packaging and documentation
- EAS build profiles, app icons/splash, Android package/iOS bundle ID, deep-link config.
- Dockerfile, deployment/runbook, env examples.
- README/CHANGELOG/ROADMAP/IMPLEMENTATION_STATUS.
- APK/IPA build instructions.
- Acceptance: release configuration complete; build commands documented; actual signed builds require user accounts/credentials.

### Working method
For each feature: inspect → implement → typecheck → lint → tests → update docs/status → commit. Do not proceed past a phase with unresolved critical errors.

---

## 18. Risks and Limitations to Document Honestly

1. **Node 25 is unsupported** by Expo SDK 58; Node 26 LTS must be installed first.
2. **Physical-device verification cannot be claimed from this environment.** Automated tests and bundle checks do not prove Android/iOS behavior.
3. **iOS signed builds require Apple credentials/macOS or EAS cloud build.** Android release builds require an Expo account and signing setup.
4. **Cloudinary account prerequisites:** authenticated delivery, eager transformations, raw asset handling, chunked uploads, plan limits. Real integration must be tested.
5. **Large-file chunking** depends on Cloudinary’s chunked REST behavior and Expo FileSystem task/header support; test with real 100 MB+ files.
6. **Foreground uploads only:** Android may suspend the app; iOS background sessions are not restored after process death. Do not promise guaranteed background uploads.
7. **No remote push** in MVP; local notifications only.
8. **Share links are shown once** because only hashes are stored; regeneration is required to get a new URL.
9. **No malware scanning, email verification, 2FA, or account deletion** in MVP; document as limitations/roadmap.
10. **PDF/Office preview** uses native viewers; behavior depends on installed apps. No embedded Office renderer.
11. **Cloudinary signed URLs** grant access to holders until expiry; use short-lived downloads and avoid logging URLs.
12. **MongoDB transactions are not assumed.** Use atomic operations, compensation, idempotency, and reconciliation.
13. **Memory rate limiting** is single-instance; Redis is required for horizontal scaling and is not implemented.
14. **Universal/App Links** require a real HTTPS domain, DNS, Apple Team ID, and Android signing fingerprint.
15. **No admin UI**; roles exist for future use.
16. **Local development HTTP** may be blocked by Android cleartext/iOS ATS; use a dev build configuration or HTTPS tunnel. Production must use HTTPS.
17. **Expo SDK 58 is current but fast-moving;** use `npx expo install` and `expo-doctor` rather than guessing versions.
18. **Background downloads/notifications** vary by OS and manufacturer; test Samsung/Xiaomi/Pixel specifically.

---

## 19. Definition of Done

A feature is complete only when:
- It uses real backend data and real native APIs.
- It handles loading, empty, error, offline, and permission-denied states.
- It has validation on both client and server where applicable.
- It is owner-scoped and security-reviewed.
- It passes typecheck, lint, and relevant automated tests.
- Documentation and `IMPLEMENTATION_STATUS.md` are updated.
- It does not claim device verification unless actually tested on a physical device.

Final status will distinguish:
- **Not started**
- **In progress**
- **Implemented**
- **Automated tests pass**
- **Verified on Android device**
- **Verified on iOS device**

---

## 20. Immediate Next Steps After Plan Approval

1. Switch out of Plan mode to implementation mode.
2. Install/select **Node 26 LTS** and verify `node -v` / `npm -v`.
3. Initialize Git and create `backend/`, `frontend/`, `docs/`, root documentation, and `.env.example`.
4. Scaffold the Expo SDK 58 app with Expo Router and install SDK-aligned dependencies.
5. Build the backend foundation first: env validation, logger, DB, `apiError`, `apiResponse`, `asyncHandler`, `cloudinary`, health routes, graceful shutdown.
6. Implement authentication end-to-end, then files/Cloudinary uploads, then folders/shares/trash/activity/storage, then offline/queue/notifications/biometrics.
7. Run automated checks and update the honest implementation-status matrix after every phase.




