# QuickDrop

QuickDrop is a personal cloud-storage and secure file-sharing app for Android and iOS. It combines a private file vault, folder organization, expiring/password-protected share links, a recycle bin, storage analytics, offline copies, and a persistent upload queue.

The repository contains two separated applications and a documentation set:

- `frontend/` — Expo SDK 58, React Native, TypeScript, Expo Router, TanStack Query, Zustand
- `backend/` — Node.js, Express 5, TypeScript, Mongoose, MongoDB, Cloudinary
- `docs/` — setup, architecture, database, API, security, testing, platform, runbook, roadmap, and implementation status

There is intentionally no root `package.json` or workspace wrapper. Each app owns its dependencies and commands.

## Status

The feature implementation is complete for the current scope, but **this is not yet a production-verified release**:

- Backend automated suite: **28 passed, 1 skipped** (the skipped test is the opt-in real-Cloudinary lifecycle test).
- Frontend automated suite: **16 passed**.
- Backend typecheck, lint, build, and frontend typecheck/lint pass locally.
- `npx expo-doctor` passes **20/20** checks and the Android Hermes bundle export succeeds.
- A local API audit passed health, auth, folder lifecycle, storage, activity, share-error, and session-revocation checks; the Cloudinary signing path correctly returned `503 CLOUDINARY_NOT_CONFIGURED`.
- Real Cloudinary upload, preview, download, and share-download flows are **not verified** because `backend/.env` currently has blank Cloudinary credentials.
- No physical Android or iOS device has been used for verification. No signed build has been produced.
- See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for the feature-by-feature status and [`docs/PLATFORM_TEST_MATRIX.md`](docs/PLATFORM_TEST_MATRIX.md) for device coverage.

Do not describe the app as Android/iOS-verified until the manual checks in those documents have actually been run on physical devices.

## Features

- Account registration, login, rotating refresh sessions, logout-all, password change, forgot/reset password
- Signed direct-to-Cloudinary uploads with server-side verification and quota reservation
- Five-tab navigation (Home, Files, Shares, More, Settings)
- Files and nested folders: list, search, filter, sort, rename, move, favorite, trash, restore, permanent delete
- Private preview/download URLs; native preview and share for supported formats
- Share links with optional password, expiry, and download limit; public web share page
- Recycle bin with retention and empty-trash operation
- Storage dashboard, per-media breakdown, quota enforcement, reconciliation
- Activity history for account and file operations
- Offline file copies and a persistent, per-account upload queue
- Local upload-completion notifications and optional biometric app lock
- Light/dark/system theme, safe areas, accessible controls, platform-adaptive layout
- Maintenance worker for abandoned uploads, expired trash, session pruning, and storage repair

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router |
| Client state/data | Zustand, TanStack Query, Axios, React Hook Form, Zod |
| Local storage | Expo SecureStore, Expo SQLite, Expo FileSystem |
| Backend | Node.js, Express 5, TypeScript, Mongoose 9 |
| Database | MongoDB (Atlas or local MongoDB) |
| File storage | Cloudinary authenticated assets and signed URLs |
| Auth | Short-lived JWT access tokens, opaque rotating refresh tokens, bcrypt |
| Tests | Jest, Supertest, mongodb-memory-server, jest-expo |

## Quick start

Requirements: Node.js 24.3+ (26 LTS recommended), npm, MongoDB (Atlas or local), and a Cloudinary account for file flows.

```bash
cd backend
npm install
cp .env.example .env
# Fill MongoDB and Cloudinary values in .env
npm run dev
```

```bash
cd frontend
npm install
cp .env.example .env.local
# Point EXPO_PUBLIC_API_URL at the backend
npx expo start
```

The backend listens on `http://localhost:4000` by default. The API is under `/api`, the health endpoints are `/health` and `/health/ready`, and public share pages are at `/s/:token`.

For physical devices, `localhost` refers to the phone, not the development computer. Use the computer's LAN IP (for example `http://192.168.1.20:4000/api`) or an HTTPS tunnel. See [`docs/SETUP.md`](docs/SETUP.md).

## Verification commands

```bash
# backend
cd backend
npm run typecheck
npm run lint
npm run build
npm test

# frontend
cd frontend
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

The opt-in real Cloudinary test requires valid credentials:

```bash
cd backend
npm run test:cloudinary
```

## Documentation

- [Setup](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Platform UX guide](docs/UX_PLATFORM_GUIDE.md)
- [Platform test matrix](docs/PLATFORM_TEST_MATRIX.md)
- [Runbook](docs/RUNBOOK.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](docs/CHANGELOG.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Contributing](CONTRIBUTING.md)
- [Master plan](PLAN.md)

## Known limitations

- Cloudinary credentials must be supplied before real file operations work.
- Mobile uploads are single-request and reject files over 100 MB. Chunked/resumable mobile upload is not implemented.
- Uploads are foreground-only; Android/iOS may suspend background work.
- Office documents use native preview/share; there is no in-app Office renderer.
- No remote push notifications; upload completion uses local notifications.
- Offline files and the local queue are stored in app-private storage but are not encrypted at the application layer.
- Password reset uses the `quickdrop://` scheme, not universal links / Android App Links.
- Rate limiting is in-process; multi-instance deployments need a shared store.
- Frontend `npm audit --omit=dev` reports 21 moderate/low findings in transitive Jest/Expo/build tooling; backend production audit is clean. See [`docs/TESTING.md`](docs/TESTING.md).

## License

**No license is granted. All rights reserved.**

This repository is public for viewing and evaluation only. No permission is granted to copy, modify, redistribute, sublicense, or use the QuickDrop application code, documentation, or brand assets in another project without explicit written permission from the repository owner.

Third-party dependencies remain subject to their own licenses. The repository does not grant an open-source license for the QuickDrop project. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for third-party attribution.
