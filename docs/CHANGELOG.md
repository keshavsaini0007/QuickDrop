# Changelog

All notable changes to QuickDrop are recorded here. The project has not been released, tagged, or deployed. Version `0.1.0` is the current unreleased development baseline.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates use ISO 8601.

## [Unreleased] — 0.1.0

### Added

#### Backend

- Express 5 + TypeScript API with MongoDB/Mongoose, structured Pino logging, request IDs, health and readiness endpoints.
- Account registration, login, access JWT, rotating opaque refresh tokens, refresh reuse detection, logout, logout-all, password change, forgot/reset password.
- bcrypt password hashing, token-version invalidation, HMAC-hashed refresh/reset/share tokens, and rate limiting.
- Signed direct-to-Cloudinary upload flow with quota reservation, upload-session state machine, server-side asset verification, and compensation.
- File APIs: list, search, filter, sort, paginate, rename, move, favorite, download, preview, trash, restore, permanent delete, empty trash.
- Nested folder APIs: create, list, detail/breadcrumbs, rename, move, trash, restore, permanent delete, empty folder trash.
- Share-link APIs: create, list, revoke, regenerate; optional password, expiry, and download limit; atomic download counting.
- Public share HTML page with CSP, escaping, no-index headers, password unlock cookie, and Cloudinary redirect.
- Storage dashboard, per-media breakdown, quota enforcement, trash accounting, and maintenance reconciliation.
- Activity history with best-effort recording and pagination.
- Maintenance worker: abandoned upload expiry, crash recovery, trash purge, terminal-session pruning, storage reconciliation.
- Manual maintenance command: `npm run maintenance`.
- Centralized `ApiError`, `apiResponse`, `asyncHandler`, Cloudinary configuration/URL helpers, input sanitization, and error normalization.
- Backend tests for auth, files/folders/shares/storage/activity, maintenance, and an opt-in real Cloudinary lifecycle test.
- GitHub Actions workflow for backend install, typecheck, lint, build, and tests.

#### Frontend

- Expo SDK 58 / React Native / TypeScript app with Expo Router routes under `src/app`.
- Auth screens: sign in, register, forgot password, reset password, session bootstrap, single-flight token refresh.
- Home dashboard, Files tab, folder browser, file actions, preview, uploads, offline files, shares, activity, trash, storage, More hub, settings, and not-found screens.
- TanStack Query server state, Zustand auth/preferences state, Axios API client, React Hook Form + Zod forms.
- SecureStore-backed session storage and query-cache clearing on account transitions.
- Signed upload flow with real progress, retry/cancel/remove, persistent per-account SQLite upload queue, and foreground-only processing.
- Offline file copies in app-private storage with per-account SQLite metadata.
- Share creation/revocation/regeneration, public share route, copy/share link actions.
- Recycle bin for files and folder trees; storage dashboard; activity list.
- Optional biometric app lock with device support detection and passcode fallback.
- Local upload-completion notifications with an Android notification channel.
- Light/dark/system theme, semantic design tokens, safe areas, accessible labels/roles/states, 48dp touch targets, Android ripple feedback, and live-region upload status.
- Android keyboard resize configuration and predictive-back opt-in.
- Platform-aware preview/share: native media, PDF browser preview, Office native share; no fake in-app Office renderer.
- EAS build profiles (`development`, `preview`, `production`) without committed credentials or project ID.

#### Documentation and project setup

- Root `README.md`, `CONTRIBUTING.md`, `PLAN.md`, `.env.example`, and documentation set.
- `docs/SETUP.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `TESTING.md`, `UX_PLATFORM_GUIDE.md`, `PLATFORM_TEST_MATRIX.md`, `RUNBOOK.md`, `ROADMAP.md`, `CHANGELOG.md`, and `IMPLEMENTATION_STATUS.md`.
- Frontend README updated from the Expo template to the real project workflow.
- `.github/workflows/ci.yml` for automated checks.
- `.editorconfig`, Prettier, ESLint, and ignore files for both applications.

### Fixed

- Upload confirmation race: an atomic `pending → confirming` claim prevents duplicate file creation and double quota release.
- Concurrent confirmation now returns `409 UPLOAD_CONFIRM_IN_PROGRESS` instead of racing.
- Transient Cloudinary verification failure restores the session to `pending` for retry.
- Maintenance expires stuck `confirming` sessions and reconciles all `pending`/`confirming` reservations.
- Crash between file creation and session completion is repaired by maintenance instead of double-releasing quota.
- Folder-tree permanent deletion and empty-trash behavior handle descendant files/folders once.
- Download counters use atomic increments; concurrent downloads cannot exceed a share's limit.
- Wrong current-password responses now return `400` rather than an incorrect auth status.
- Public-share invalid access redirects back to the unlock form.
- Offline SQLite rows are scoped by `owner_id`; unscoped legacy rows are deleted instead of exposed to the next account.
- Upload queue rows are scoped by `owner_id`; in-flight uploads check ownership; the queue pauses when auth ends.
- Query cache is cleared on login, register, logout, logout-all, and session expiry.
- Android `application/octet-stream` filename fallback added for document picking.
- Frontend API errors read backend `errors` and skip token refresh for public-share requests.

### Changed

- Cloudinary delivery uses authenticated assets with short-lived private download URLs.
- Storage quota counts active files, trashed files, and unreleased reservations.
- Mobile uploads explicitly use a single-request uploader and reject files over 100 MB; the API honestly returns `uploadMode: "single"`.
- Public share raw URLs are shown once; only HMAC token hashes are stored.
- Android keyboard layout mode set to `resize`; predictive back enabled.
- Frontend branding/theme tokens are shared across screens; platform-specific behavior is explicit.
- Replaced the Expo template icon, splash, Android adaptive icon, and favicon with QuickDrop-branded assets using the app's teal palette.
- Removed the Expo template reset script, template icon set, unused template images, template `AGENTS.md`, and agent-specific `.claude` configuration; replaced the template license file with a scoped third-party notice.
- Hardened ignore rules for signing credentials, Google service files, generated bundles, local caches, and generated `example/` output.
- Clarified that the repository grants no license; the source is public for viewing only.
- Documentation now distinguishes implemented, tested, verified, and device-verified work.

### Security

- Refresh tokens stored as HMAC hashes; reuse revokes the token family.
- Share/reset tokens stored as hashes; public share page uses an HttpOnly/SameSite cookie for password access.
- Pino redaction covers auth headers, cookies, passwords, tokens, signatures, and API keys.
- Helmet, CORS allowlist, input sanitization, strict Zod validation, JSON body limits, and rate limiting enabled.
- Production environment validation rejects default secrets, missing Cloudinary credentials, and non-HTTPS public URLs.
- Mobile tokens stored in SecureStore; offline files and SQLite are app-private but **not** app-layer encrypted.

### Verification

- Backend: **28 passed, 1 skipped across 4 suites** (skipped real-Cloudinary test).
- Frontend: **16 passed across 4 suites**.
- Backend typecheck, lint, and build pass locally.
- Frontend typecheck and lint pass locally.
- Backend `npm audit --omit=dev`: **0 vulnerabilities**.
- Frontend `npm audit --omit=dev`: **21 findings (1 low, 20 moderate)** in transitive Jest/Expo/build dependencies; not force-fixed.
- Expo Doctor: **20/20** checks passed.
- Android JS bundle export: **pass** (one Hermes bundle, 2,173 modules).
- Live local API audit: health, readiness, auth, folder lifecycle, storage, activity, share-error, and session revocation passed; Cloudinary signing returned the expected `503` with blank credentials. Test data was removed afterward.

### Known limitations

- Real Cloudinary upload/preview/download/share/offline flows are unverified because local Cloudinary credentials are blank.
- No physical Android/iOS verification or signed build has occurred.
- Mobile uploads are foreground-only and single-request; no chunked/resumable upload.
- No remote push notifications; local notifications only.
- No Office in-app renderer; native share/preview only.
- No avatar upload flow, MFA, virus scanning, recipient identity, or watermarking.
- Offline files and SQLite are not app-layer encrypted.
- Password reset uses a custom scheme; universal links/App Links and a web fallback are not implemented.
- Thumbnail signed URLs do not expire.
- Rate limiting and maintenance are in-process; horizontal scaling needs a shared limiter and single-worker maintenance strategy.
- No OpenAPI file; `docs/API.md` is the authoritative API reference.
- No automated E2E/navigation tests.
- Frontend install reports an ignored install-script warning for `@parcel/watcher`; tests and Metro work without it here.

No release, tag, store submission, or production deployment has been made. The repository contains the unreleased development baseline.
