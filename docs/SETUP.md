# QuickDrop setup

This guide takes a clean checkout to a running backend and a development build of the mobile app. It also covers the Cloudinary configuration required for real uploads.

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 24.3+ | Node 26 LTS is recommended. Node 25 is not supported by Expo SDK 58. |
| npm | The repository has separate lockfiles in `backend/` and `frontend/`. |
| MongoDB | A local MongoDB server or a MongoDB Atlas cluster. |
| Cloudinary account | Required for uploads, previews, downloads, and share downloads. |
| Expo account / EAS CLI | Required for cloud builds. Local native builds also need Android Studio or macOS + Xcode. |
| Physical devices | Required before claiming Android/iOS verification. Emulators are useful but not a substitute for the device matrix. |

There is no root `package.json`. Run commands inside the relevant application directory.

## 2. Backend environment

```bash
cd backend
npm install
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Generate independent secrets instead of using the development defaults:

```bash
node -e "const c=require('node:crypto'); for (let i=0;i<4;i++) console.log(c.randomBytes(48).toString('base64url'))"
```

Use one value for each of `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `SHARE_TOKEN_PEPPER`, and `JWT_SHARE_SECRET`. Keep them out of source control.

### Required backend values

```dotenv
NODE_ENV=development
PORT=4000
API_PREFIX=/api
PUBLIC_WEB_BASE_URL=http://localhost:4000
APP_DEEP_LINK_SCHEME=quickdrop

MONGODB_URI=mongodb://127.0.0.1:27017/quickdrop
# MONGODB_DB_NAME=quickdrop

JWT_ACCESS_SECRET=<48+ random bytes>
REFRESH_TOKEN_PEPPER=<48+ random bytes>
SHARE_TOKEN_PEPPER=<48+ random bytes>
JWT_SHARE_SECRET=<48+ random bytes>

CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<api key>
CLOUDINARY_API_SECRET=<api secret>
CLOUDINARY_DELIVERY_TYPE=authenticated
CLOUDINARY_FOLDER_PREFIX=quickdrop
```

The complete reference is in [`backend/.env.example`](../backend/.env.example) and the consolidated root [`/.env.example`](../.env.example). Never put a secret in a frontend `EXPO_PUBLIC_*` variable.

### MongoDB

Local MongoDB:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/quickdrop
```

MongoDB Atlas:

1. Create a cluster and a database user with read/write access to the QuickDrop database.
2. Add the development machine's public IP (or a narrowly scoped network range) to Atlas network access.
3. Use the driver connection string, for example:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/quickdrop?retryWrites=true&w=majority
```

Mongoose declares the indexes at startup. The first startup can take a few seconds while indexes are created. Do not point tests or development at a production database.

### Cloudinary

QuickDrop does **not** proxy file bytes through the API. The backend creates a short-lived signed upload request, the mobile client uploads directly to Cloudinary, and the backend verifies the asset before creating the file record.

1. In the Cloudinary console, copy the cloud name, API key, and API secret into `backend/.env`.
2. Keep `CLOUDINARY_DELIVERY_TYPE=authenticated` for private files. The generated preview/download URLs are signed and short-lived.
3. If your account blocks delivery of PDF/ZIP assets, enable the appropriate delivery setting in the Cloudinary console. The app cannot preview or download an asset that Cloudinary refuses to deliver.
4. The API secret must remain server-side. It is never included in the Expo app or in signed URLs.

Cloudinary credentials are optional in development so that auth and non-file APIs can be exercised without an account. In `NODE_ENV=production`, startup fails unless all three credentials are present and `PUBLIC_WEB_BASE_URL` uses HTTPS. File endpoints return `503 CLOUDINARY_NOT_CONFIGURED` when credentials are absent.

### Email and password reset

Development defaults:

```dotenv
EMAIL_PROVIDER=console
DEV_EXPOSE_RESET_TOKEN=false
RESET_TOKEN_TTL_MINUTES=60
```

With the console provider, `npm run dev` logs the reset URL to the terminal. `DEV_EXPOSE_RESET_TOKEN=true` also returns a `resetToken` in the forgot-password response for local testing; do not enable it in production.

For production, configure Resend:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=<resend api key>
EMAIL_FROM=QuickDrop <no-reply@your-domain.example>
```

The reset link uses `quickdrop://reset-password?token=...`. It only works when the app is installed. Universal links/App Links and a browser fallback are not implemented yet.

## 3. Run the backend

```bash
cd backend
npm run dev
```

Expected startup output includes MongoDB connection, Cloudinary status, the listening URL, and the maintenance worker interval. Important logs are visible in the terminal. Use:

- `GET http://localhost:4000/health` for liveness.
- `GET http://localhost:4000/health/ready` for MongoDB/Cloudinary readiness.
- `GET http://localhost:4000/api` for the API descriptor.

Health and public share pages are mounted outside the API prefix:

- API: `http://localhost:4000/api/...`
- Public share page: `http://localhost:4000/s/:token`
- Health: `http://localhost:4000/health`

### Production-style run

```bash
cd backend
npm run build
NODE_ENV=production npm start
```

In production, set `TRUST_PROXY=true` only when the API is actually behind a trusted reverse proxy/load balancer. Set `CLIENT_ORIGINS` to the exact browser origins that should call the API; native mobile requests are not subject to browser CORS. See [`RUNBOOK.md`](RUNBOOK.md) for deployment and operations.

## 4. Frontend environment

```bash
cd frontend
npm install
cp .env.example .env.local
```

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_SHARE_BASE_URL=http://localhost:4000
EXPO_PUBLIC_APP_SCHEME=quickdrop
EXPO_PUBLIC_APP_NAME=QuickDrop
```

`EXPO_PUBLIC_*` values are public and are embedded in the client bundle. Do not put API secrets there.

### Choosing the API URL

| Target | Value |
|---|---|
| iOS simulator | `http://localhost:4000/api` |
| Android emulator | `http://10.0.2.2:4000/api` (the emulator's alias for the host) |
| Physical Android/iOS device on the same LAN | `http://<computer-LAN-IP>:4000/api` |
| Remote/cloud build or HTTPS tunnel | An HTTPS URL reachable by the device |

For a physical device:

1. Find the computer's LAN IP (`ipconfig` on Windows, `ifconfig`/`ip addr` on macOS/Linux).
2. Allow inbound TCP 4000 through the host firewall for the development network.
3. Put the LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost`.
4. Restart Metro after changing `.env.local`.

Plain HTTP is suitable only for local development. Production builds should use HTTPS. `EXPO_PUBLIC_SHARE_BASE_URL` must point to the backend origin that serves `/s/:token`; it is not the app scheme.

## 5. Run the mobile app

Some QuickDrop modules use native code (SQLite, SecureStore, notifications, local authentication, video, file system). Expo Go may not include the matching native modules. Use a development build:

```bash
cd frontend
npx expo run:android
# or, on macOS:
npx expo run:ios
```

If you already have a development build installed:

```bash
npx expo start --dev-client
```

Then open the development build and connect it to Metro. For a cloud development build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # adds the EAS project ID to app.json
npx eas-cli@latest build --profile development --platform android
```

`frontend/eas.json` contains `development`, `preview`, and `production` profiles. The EAS project ID, signing credentials, and production API URL are not committed. Configure public `EXPO_PUBLIC_*` values through EAS environment variables or the appropriate EAS profile; do not commit secrets.

### Build commands

```bash
# Installable preview build
npx eas-cli@latest build --profile preview --platform android

# Store build
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest build --profile production --platform ios

# Submit (after store credentials are configured)
npx eas-cli@latest submit --platform android
npx eas-cli@latest submit --platform ios
```

Before a production build:

- Set the final `ios.bundleIdentifier` and `android.package` in `frontend/app.json`.
- Add the EAS project ID.
- Configure Android and iOS signing credentials.
- Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SHARE_BASE_URL` to HTTPS endpoints.
- Configure Apple Face ID usage text and Android notification permission text as needed (the current config already includes the main permission strings).
- Complete the checks in [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md).

## 6. First-use verification

1. Start the backend and confirm both health endpoints respond.
2. Start the app and create an account with a unique email.
3. Sign in, open **Files**, create a folder, and upload a small image or text file.
4. Confirm the file appears, previews/downloads, and increments the storage dashboard.
5. Create a share link, open the public `/s/:token` URL in a browser, and download it.
6. Move the file to trash, restore it, then permanently delete it and confirm storage is released.
7. Save a file offline, turn off the backend/network, and open it from **Offline**.
8. Queue an upload while offline, restore the network, and confirm the queue resumes.
9. Enable biometric lock in Settings, background the app, and unlock it.
10. Switch light/dark/system themes and increase the system font size.

If Cloudinary credentials are blank, steps 3–6 will fail with `503 CLOUDINARY_NOT_CONFIGURED`. That is expected; configure Cloudinary before treating file flows as verified.

## 7. Tests and checks

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

The opt-in Cloudinary lifecycle test is separate because it writes to a real account:

```bash
cd backend
npm run test:cloudinary
```

See [`TESTING.md`](TESTING.md) for what each suite covers and what remains manual.

## 8. Troubleshooting

### `Invalid environment configuration`

The backend validates its environment at startup. Read the reported field names; secret values are never printed. Production requires non-default secrets, Cloudinary credentials, and an HTTPS `PUBLIC_WEB_BASE_URL`.

### MongoDB connection refused / server selection timeout

- Confirm MongoDB is running locally or the Atlas cluster is reachable.
- Check the Atlas database user, password, and network access list.
- URL-encode special characters in the password.
- Do not use `localhost` from a cloud-hosted backend.

### `CLOUDINARY_NOT_CONFIGURED`

Fill `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`, then restart the backend. `/health/ready` reports the dependency state.

### Cloudinary upload or preview failures

- Confirm the Cloudinary account is active and the key/secret belong to the same cloud.
- Confirm the asset's resource type and delivery type are supported by your account.
- Check the backend log for the sanitized Cloudinary error; the API returns `502 CLOUDINARY_ERROR` for upstream failures.
- A failed confirmation can leave an orphaned Cloudinary asset if cleanup also fails. The public ID is logged for operational follow-up.

### `429 RATE_LIMITED`

Auth endpoints allow 10 attempts per 15 minutes by default in development. Wait for the window to reset or adjust the `RATE_LIMIT_*` values in a local `.env`. Do not raise production limits merely to make a failing test pass.

### Device cannot reach the API

- Use the host LAN IP or an HTTPS tunnel, not `localhost`.
- Allow the port through the firewall.
- Confirm the phone and computer are on the same network.
- Restart Metro after changing `.env.local`.
- Android cleartext HTTP is a development-only convenience; production requires HTTPS.

### Metro or native module errors after installing packages

```bash
npx expo start -c
npx expo install --fix
npx expo-doctor
```

If a new native module was added, rebuild the development client; restarting Metro is not enough.

### Password reset link does not open

The development email uses the `quickdrop://` scheme. Install the development/production app on the device, then open the link. Universal links and a web reset fallback are on the roadmap.

## 9. Related documents

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [API](API.md)
- [Security](SECURITY.md)
- [Testing](TESTING.md)
- [Platform UX guide](UX_PLATFORM_GUIDE.md)
- [Runbook](RUNBOOK.md)
