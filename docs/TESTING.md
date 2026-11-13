# QuickDrop testing

## 1. What is automated

### Backend (`backend/tests`)

| Suite | Coverage |
|---|---|
| `auth.test.ts` | Registration, login, token refresh/rotation, logout, logout-all, password reset, profile updates, auth failures |
| `files.test.ts` | Upload signing/confirmation (with mocked Cloudinary), files, folders, shares, storage, activity, ownership boundaries |
| `maintenance.test.ts` | Upload expiry/reservation repair, trash purge, session pruning, storage reconciliation |
| `cloudinary.integration.test.ts` | Opt-in real Cloudinary upload/verify/delete lifecycle; skipped in the normal suite |

The normal backend suite uses `mongodb-memory-server`, so it does not touch the local or Atlas database. Cloudinary is mocked unless the dedicated lifecycle test is run.

### Frontend (`frontend/tests`)

| Suite | Coverage |
|---|---|
| `api.test.ts` | API error normalization |
| `format.test.ts` | Formatting helpers |
| `uploadQueue.test.ts` | Persisted queue recovery and owner mapping |
| `validation.test.ts` | Form validation schemas |

The frontend tests are focused unit tests. They do not render the complete navigation tree or prove native behavior.

## 2. Last recorded local results

Recorded on 13 November 2026:

```text
Backend:  28 passed, 1 skipped, 29 total across 4 suites
Frontend: 16 passed, 16 total across 4 suites
```

The skipped backend test is `cloudinary.integration.test.ts`, which only runs through `npm run test:cloudinary` with real credentials.

Typecheck, lint, and bundle status:

```text
backend:  npm run typecheck              PASS
backend:  npm run lint                   PASS
backend:  npm run build                  PASS
frontend: npm run typecheck              PASS
frontend: npm run lint                   PASS
frontend: npx expo-doctor                20/20 checks passed
frontend: npx expo export --platform android  PASS
```

The Android export produced one Hermes bundle (about 6.3 MB) and completed with 2,173 modules. Expo Doctor reported no issues.

### Live API audit

A local audit was run against the development server on port 4000 with MongoDB available and Cloudinary intentionally unconfigured:

```text
PASS  GET  /health
PASS  GET  /health/ready
PASS  GET  /api/users/me without a token -> 401
PASS  POST /api/auth/register with an invalid password -> 400
PASS  POST /api/auth/register -> 201
PASS  GET  /api/users/me
PASS  POST /api/folders -> 201
PASS  GET  /api/folders/:id with breadcrumbs
PASS  PATCH /api/folders/:id rename
PASS  GET  /api/folders
PASS  GET  /api/storage
PASS  GET  /api/activities
PASS  POST /api/files/upload/sign -> 503 CLOUDINARY_NOT_CONFIGURED (expected)
PASS  GET  /api/shares
PASS  POST /api/shares with a nonexistent file -> 404
PASS  DELETE /api/folders/:id -> trash
PASS  POST /api/folders/:id/restore
PASS  DELETE /api/folders/:id/permanent
PASS  POST /api/auth/refresh
PASS  POST /api/auth/logout
PASS  POST /api/auth/logout-all
PASS  GET  /api/users/me after logout-all -> 401
```

The synthetic user and its folders, activities, and refresh tokens were deleted after the audit. The local database was verified empty afterward. This audit does **not** exercise real file upload/download/share delivery because Cloudinary credentials are blank.

`npm run maintenance` was also executed against the empty local database. It connected, completed all four steps with zero work, printed the JSON result, and disconnected cleanly.

These results must be re-run after any code/config change. A previous pass is not a permanent guarantee.

## 3. Commands

```bash
# Backend
cd backend
npm run typecheck
npm run lint
npm run build
npm test
npm run test:watch

# Frontend
cd frontend
npm run typecheck
npm run lint
npm test
npm run test:watch
```

### Real Cloudinary lifecycle test

This test is intentionally opt-in because it creates and deletes an asset in a real Cloudinary account:

```bash
cd backend
# Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET
# are present in the shell or backend/.env.
npm run test:cloudinary
```

The normal `npm test` forces Cloudinary credentials blank and skips this suite. The opt-in test should be run before claiming real upload/download/share flows are verified. Current local credentials are blank, so it has not been run here.

## 4. Manual test plan

Automated tests do not prove platform behavior. Run these on a development build connected to a real backend and a real Cloudinary account. Record results in [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md).

### Authentication

- [ ] Register a new account; verify validation for weak passwords, duplicate email, and malformed email.
- [ ] Sign in with correct and incorrect credentials.
- [ ] Kill and relaunch the app; verify session bootstrap and cached profile behavior.
- [ ] Leave the app idle past access-token expiry; verify one silent refresh, not a refresh storm.
- [ ] Sign out; verify protected routes redirect and the query cache is empty.
- [ ] Sign out all sessions; verify another device is signed out.
- [ ] Change password; verify other sessions are revoked and the current session continues.
- [ ] Forgot/reset password with the console provider or Resend.
- [ ] Verify rate limiting produces a readable message, not a crash.

### Files and folders

- [ ] Upload small image, video, audio, PDF, text, Office, and archive files within limits.
- [ ] Reject an unsupported MIME type and a file over its per-type limit.
- [ ] Reject an upload that would exceed quota.
- [ ] Upload to root and to a nested folder.
- [ ] Rename with a conflicting name; verify conflict handling.
- [ ] Move a file across folders and back to root.
- [ ] Create nested folders, rename, move, and verify descendant protection.
- [ ] Search/filter/sort/paginate a list large enough to page.
- [ ] Favorite/unfavorite and verify the favorites view.
- [ ] Download and preview each supported type.
- [ ] Verify the download counter increments and activity appears.
- [ ] Trash/restore a file whose original folder still exists and one whose folder is gone.
- [ ] Permanently delete and verify Cloudinary asset/shares are removed and quota is released.
- [ ] Trash a folder tree, restore it, then permanently delete it.
- [ ] Empty the recycle bin with both files and folders present.

### Upload queue

- [ ] Queue several files and confirm only one uploads at a time.
- [ ] Background/foreground the app during upload; verify recovery rather than a fake completion.
- [ ] Disable network mid-upload; verify queued/error state and retry.
- [ ] Kill the app mid-upload; relaunch and verify interrupted rows are restored as queued.
- [ ] Cancel/remove an in-flight item.
- [ ] Attempt a file over 100 MB; verify the honest single-request error.
- [ ] Sign out with queued/in-flight items; verify uploads pause and another account cannot see them.
- [ ] Sign back into the original account; verify its queue returns.

### Offline

- [ ] Save image/text/PDF files offline.
- [ ] Disable network; open each offline file.
- [ ] Remove an offline copy; verify local file deletion.
- [ ] Sign out and sign in as another account; verify the first account's offline rows/files are not shown.
- [ ] Verify unscoped legacy rows are deleted on upgrade (test on a device with an old local DB if possible).

### Sharing

- [ ] Create a share without options; open `/s/:token` in a browser and download.
- [ ] Create a password-protected share; verify metadata is visible but download requires unlock.
- [ ] Wrong password shows an error; correct password downloads.
- [ ] Expiry, max downloads, revoke, and regenerate.
- [ ] Verify a regenerated URL invalidates the old URL.
- [ ] Verify a trashed file's share becomes unusable, and restoring it does not bypass an expired/revoked state.
- [ ] Verify public page light/dark layout and mobile viewport.
- [ ] Verify no raw token appears in server logs.

### Storage and activity

- [ ] Storage dashboard reflects active/trash/reserved bytes and media breakdown.
- [ ] Activity records uploads, downloads, moves, favorites, trash/restore, shares, and profile/password changes.
- [ ] Empty/error/loading states are visible and actionable.
- [ ] Maintenance run repairs a deliberately inconsistent counter in a local test database (never production without approval).

### Platform and accessibility

- [ ] Android system back, predictive back, three-button navigation, and gesture navigation.
- [ ] Android keyboard resize behavior and form scrolling.
- [ ] Android notification channel and Android 13+ permission.
- [ ] Android runtime photo/camera permission and denial recovery.
- [ ] iOS swipe-back, safe areas, Face ID/Touch ID fallback, native share/preview.
- [ ] TalkBack and VoiceOver labels/roles for file rows, buttons, upload status, and dialogs.
- [ ] 200% system font scaling; no clipped primary controls.
- [ ] Light/dark/system themes and contrast.
- [ ] Rotation/tablet layout (the app allows default orientation and tablet support).
- [ ] Low-end Android performance with a large file list.

## 5. Test data and cleanup

- Automated backend tests use an in-memory MongoDB and should not affect `quickdrop`.
- The live API smoke flow uses the configured database. Use unique test emails and delete the test account's files/shares before finishing, or clear the development database.
- Never run destructive cleanup against Atlas/production without explicit approval.
- Cloudinary integration tests create a real asset and delete it in cleanup. Verify cleanup in the Cloudinary console if a run is interrupted.

## 6. Dependency and install findings

### Backend audit

`npm audit --omit=dev` reports **0 vulnerabilities**.

### Frontend audit

`npm audit --omit=dev` currently reports **21 vulnerabilities (1 low, 20 moderate, 0 high, 0 critical)**. They are transitive findings in Jest/build/Expo tooling, including `deepmerge`, `glob`, `minimatch`, `babel-plugin-istanbul`, and `@expo/fingerprint`. `npm audit fix` does not resolve them without a breaking downgrade (for example, `npm audit fix --force` would install Jest 29 or Expo 52). They were not force-fixed because that would break the SDK 58/test setup.

This is not a claim that the findings are harmless. Review them before release, update when upstream packages publish compatible fixes, and consider a dedicated tooling dependency upgrade. The backend production dependency audit is clean.

### Install-script warning

The frontend install reports a warning that npm did not run the install script for `@parcel/watcher` (a transitive Jest/Metro watcher dependency). Tests and Metro run without it in this environment. If file watching is unreliable on a particular machine, rebuild/reinstall the dependency deliberately rather than globally enabling untrusted scripts.

## 7. Continuous integration

A GitHub Actions workflow is provided at `.github/workflows/ci.yml`:

- backend: install, typecheck, lint, build, test (MongoDB memory server binary cached)
- frontend: install, typecheck, lint, test

The workflow does not run the real Cloudinary test, device tests, EAS builds, or production deployment checks. Those require credentials/devices and explicit approval.

## 8. Not verified here

- Real Cloudinary upload, preview, download, share-download, and offline download (blank local credentials)
- Any physical Android or iOS device behavior
- Biometric hardware prompts and SecureStore behavior on a real device
- Local notification delivery on a real Android/iOS device
- EAS signed builds, store submission, universal links, and production email delivery
- Multi-instance rate limiting and maintenance scheduling
- Load/performance testing

See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) and [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md) for the current honest status.
