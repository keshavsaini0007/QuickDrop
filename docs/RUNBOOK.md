# QuickDrop runbook

Operational guide for the QuickDrop API, MongoDB, Cloudinary, and the Expo app. It is written for the current implementation, which is **not yet production-verified**. No production deployment, signed build, or physical-device test has been performed.

## 1. Service inventory

| Component | Responsibility | Current runtime |
|---|---|---|
| `backend/` | REST API, auth, metadata, quotas, public share page, maintenance | Express 5 process |
| MongoDB | Users, files, folders, shares, upload sessions, refresh tokens, activity | Local MongoDB or Atlas |
| Cloudinary | Private file bytes, signed uploads, short-lived delivery URLs | External managed service |
| `frontend/` | Android/iOS client | Expo development build or EAS build |
| Reverse proxy / TLS | HTTPS termination, request IDs, optional proxy trust | Not configured in this repository |

There is no queue service, WebSocket server, Redis instance, or worker process in the current implementation. Maintenance runs inside the API process. The mobile upload queue is local SQLite on the device.

## 2. Deployment prerequisites

Before deploying:

- MongoDB Atlas cluster with TLS, backups, a least-privilege database user, and an IP access list.
- Cloudinary cloud with valid cloud name/API key/API secret.
- HTTPS API origin and HTTPS public web origin.
- Secret manager or deployment-platform environment variables for all secrets.
- Node.js 24.3+ (Node 26 LTS recommended) in the runtime image.
- Reverse proxy/load balancer that forwards `X-Forwarded-*` correctly if used.
- Log aggregation that redacts secrets; do not send raw request bodies.
- Uptime checks against `/health` and `/health/ready`.
- A backup/restore drill owner.

### Required production environment

The backend refuses to start in production when:

- any of `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `SHARE_TOKEN_PEPPER`, or `JWT_SHARE_SECRET` still uses a `dev-only-*` default;
- Cloudinary credentials are missing;
- `PUBLIC_WEB_BASE_URL` is not HTTPS.

Also set:

```dotenv
NODE_ENV=production
PORT=4000
API_PREFIX=/api
TRUST_PROXY=true                 # only behind a trusted proxy
CLIENT_ORIGINS=https://app.example.com
PUBLIC_WEB_BASE_URL=https://api.example.com
APP_DEEP_LINK_SCHEME=quickdrop
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<unique secret>
REFRESH_TOKEN_PEPPER=<unique secret>
SHARE_TOKEN_PEPPER=<unique secret>
JWT_SHARE_SECRET=<unique secret>
EMAIL_PROVIDER=resend
RESEND_API_KEY=<secret>
EMAIL_FROM=QuickDrop <no-reply@example.com>
CLOUDINARY_CLOUD_NAME=<cloud>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
LOG_LEVEL=info
LOG_PRETTY=false
```

`CLIENT_ORIGINS` is a browser CORS allowlist, not the mobile app allowlist. Native apps do not use CORS. Use exact HTTPS origins, comma-separated, with no trailing wildcard.

## 3. Build and start

```bash
cd backend
npm ci
npm run typecheck
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

`npm start` runs `dist/server.js`. The build must succeed before start; the production image should not contain TypeScript sources as the runtime entrypoint.

The process logs:

- environment and port;
- MongoDB connection state;
- Cloudinary configuration status (not secrets);
- maintenance worker start/interval;
- request IDs, status codes, and sanitized errors;
- maintenance run results.

### Startup sequence

1. Environment validation. Invalid values exit immediately.
2. Logger initialization.
3. MongoDB connection and index creation.
4. Cloudinary configuration check.
5. HTTP server starts.
6. Maintenance worker runs once immediately, then every `MAINTENANCE_INTERVAL_MINUTES`.

Readiness can be false briefly while MongoDB/Cloudinary are still reachable. Do not route traffic until `/health/ready` returns `200`.

## 4. Health checks and smoke tests

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/ready
```

Expected liveness:

```json
{
  "success": true,
  "data": { "status": "ok", "environment": "production" }
}
```

Readiness must report MongoDB ready and Cloudinary configured/ready. In production, missing Cloudinary credentials prevent startup, so a `503` here usually means MongoDB or Cloudinary connectivity is degraded.

Minimal smoke flow after deployment:

1. Register a synthetic account with a unique email.
2. Call `GET /api/users/me` with the returned access token.
3. Sign a small upload, upload it directly to Cloudinary, and confirm it.
4. Preview and download the file.
5. Create a share, open `/s/:token`, and download through the public page.
6. Move the file to trash, restore it, permanently delete it, and verify storage drops.
7. Sign out all sessions and verify the old access token is rejected.
8. Delete the synthetic account's files/shares or clean the test database according to policy.

Do not use real customer data for smoke tests.

## 5. Monitoring

### Minimum signals

| Signal | Why | Suggested alert |
|---|---|---|
| `/health/ready` | Dependency availability | 2–3 consecutive failures |
| 5xx rate | API correctness | > 2% for 5 minutes |
| 4xx spike | Abuse, auth failures, client bug | Investigate, don't page blindly |
| Request latency p95/p99 | Capacity/degradation | > 2s p95 for 10 minutes |
| MongoDB connection pool | Saturation | Pool wait/connection errors |
| Cloudinary error rate | Upload/download failure | > 2% for 10 minutes |
| Maintenance result | Quota drift/orphans | `errors` non-empty, repeated cleanup failures |
| Storage reconciliation adjustments | Silent drift | Any unexpected adjustment, repeated for same user |
| Disk/memory/CPU | Process health | Platform thresholds |
| Auth 429 rate | Rate-limit pressure | Sustained spike after deploy |

### Log queries

Use the request ID returned in `X-Request-Id` to correlate a user report. Search for:

- `Request failed` with `statusCode`, `code`, `requestId`;
- `Maintenance run finished` with `uploads`, `trash`, `sessions`, `storage`, `durationMs`, `errors`;
- `Corrected a drifted storage counter`;
- `Could not delete an abandoned Cloudinary upload`;
- `Repaired upload session that had a file but was never marked complete`;
- `Password changed; other sessions revoked`.

Never paste raw tokens, cookies, signed URLs, or Cloudinary secrets into an incident ticket.

## 6. Maintenance operations

The worker runs automatically. A manual run is available:

```bash
cd backend
npm run maintenance
```

It connects to the configured database, runs all four steps, prints a JSON result, and disconnects. Use it for:

- a deliberate one-off repair after an incident;
- verifying a restore;
- confirming a release's maintenance behavior.

Do not run it concurrently across many instances without a coordination plan. The operations are designed to be safe/idempotent, but multiple workers can duplicate Cloudinary deletion attempts and log noise.

### What each step does

1. **Upload expiry:** finds `pending`/`confirming` sessions older than the TTL plus a 5-minute grace period, repairs sessions whose file already exists, otherwise deletes the Cloudinary asset, marks the session `expired`, and releases the reservation. Cloudinary cleanup failure is logged but quota is still released; investigate the orphan asset.
2. **Trash purge:** permanently deletes folder roots and standalone files whose `deletedAt` is older than `TRASH_RETENTION_DAYS`. Descendants are handled once by the permanent-delete services.
3. **Session pruning:** deletes `completed`, `failed`, and `expired` sessions older than `UPLOAD_SESSION_RETENTION_DAYS`.
4. **Storage reconciliation:** recomputes each user's counter from all file records plus all `pending`/`confirming` reservations. A compare-and-set skips users whose counter changed during the calculation; the next run repairs them.

### Expected result

```json
{
  "uploads": { "expired": 0, "recovered": 0, "releasedBytes": 0, "cleanupFailures": 0 },
  "trash": { "foldersDeleted": 0, "filesDeleted": 0, "failures": 0 },
  "sessions": { "deleted": 0 },
  "storage": { "usersChecked": 12, "usersAdjusted": 0, "usersSkipped": 0 },
  "durationMs": 84,
  "errors": []
}
```

Non-empty `errors` means a step threw; the worker continues with the remaining steps. Repeated `cleanupFailures`, `trash.failures`, or storage adjustments for the same user need investigation.

## 7. Backup and restore

### MongoDB

- Prefer Atlas continuous backups or scheduled `mongodump` snapshots.
- Include all QuickDrop collections in one snapshot so references remain consistent.
- Store snapshots encrypted, with restricted access and a tested retention policy.
- Test restore into an isolated environment at least quarterly.

Restore procedure outline:

1. Stop API writers.
2. Restore MongoDB into the target cluster.
3. Verify indexes exist and no duplicate-key failures occur at startup.
4. Verify Cloudinary assets referenced by files still exist.
5. Rotate application secrets or revoke sessions/shares if the restore crosses a security boundary.
6. Start one API instance, run `npm run maintenance`, inspect the result.
7. Run the smoke flow before restoring normal traffic.

A MongoDB restore does **not** restore Cloudinary bytes. Configure Cloudinary retention/backup separately.

### Cloudinary

- Confirm the account plan's retention/backup behavior.
- Export or back up high-value assets independently if the plan does not guarantee recovery.
- Deleting an asset is immediate from the API's perspective; there is no soft-delete in QuickDrop.

### Mobile local data

Offline files, the upload queue, and secure tokens are device-local. Reinstalling the app or clearing app data removes them. There is no server-side restore of the mobile queue or offline copies.

## 8. Incident response

### Suspected secret exposure

1. Rotate `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `SHARE_TOKEN_PEPPER`, and `JWT_SHARE_SECRET` together if the database or environment was exposed.
2. Rotate the Cloudinary API secret and update the backend.
3. Revoke/regenerate share links if share-token hashes or raw URLs may be exposed.
4. Invalidate all refresh sessions by changing `REFRESH_TOKEN_PEPPER` or running a reviewed session-revocation operation.
5. Review logs for access to `/api/auth/*`, `/api/shares`, `/api/public/shares/*`, and upload confirmations.
6. Notify affected users if required by policy/law.

Rotating `JWT_ACCESS_SECRET` signs everyone out of access tokens; rotating `REFRESH_TOKEN_PEPPER` ends refresh sessions. Rotating `SHARE_TOKEN_PEPPER` breaks existing share/reset tokens.

### Cloudinary outage

- `/health/ready` reports Cloudinary not ready.
- Upload signing/confirmation and download/preview URL issuance return `502`/`503`.
- Do not bypass verification or accept client-claimed assets.
- Queue uploads on mobile (local queue) and communicate that files are not lost.
- After recovery, retry confirmations; maintenance will expire abandoned sessions and release quota.

### MongoDB outage

- Liveness may stay `200` while readiness is `503`.
- Auth and all metadata operations fail.
- Do not restart-loop the API; restore database connectivity first.
- After recovery, run maintenance and check for orphaned uploads.

### Storage counter drift

Symptoms: dashboard does not match files, quota rejects unexpectedly, or `usersAdjusted` is repeatedly non-zero.

1. Run `npm run maintenance` in a controlled window.
2. Inspect `storage` and `errors` in the result.
3. If a single user repeatedly drifts, inspect their files and `pending`/`confirming` sessions read-only.
4. Do not manually edit `storageUsedBytes` without a reviewed script and a backup.

### Orphaned Cloudinary asset

Look for `Could not delete an abandoned Cloudinary upload` and the public ID in logs. Verify the asset in Cloudinary, then delete it manually if it is confirmed unreferenced. Do not delete assets based on a public ID alone without checking the `files` and `uploadsessions` collections.

### Public share abuse

1. Revoke the share (`DELETE /api/shares/:id`) or regenerate it.
2. Check download counts/activity and rate-limit logs.
3. If a password is compromised, revoke and create a new share.
4. There is no recipient identity or watermark; containment is revocation.

## 9. Scaling and availability

The current design is single-process friendly:

- Maintenance runs in each API process. For multiple instances, run it in one designated worker or disable it elsewhere with a deployment-specific flag (not currently implemented).
- Rate limiting is in-memory. Use a shared store or edge rate limiting for consistent limits.
- Refresh-token reuse detection is database-backed and safe across instances.
- Upload confirmation uses an atomic database claim and is safe across instances.
- MongoDB is the source of truth; API instances are stateless apart from rate-limit counters and maintenance timers.
- Cloudinary direct uploads avoid large API payloads.

Before horizontal scaling, add a shared rate-limit store and a single scheduler/worker strategy.

## 10. Release checklist

- [ ] Backend typecheck, lint, build, tests pass.
- [ ] Frontend typecheck, lint, tests, Expo Doctor pass.
- [ ] `npm run test:cloudinary` passes with real credentials.
- [ ] Smoke flow passes against the deployed HTTPS API.
- [ ] Physical Android/iOS matrix completed and evidence recorded.
- [ ] EAS signed build installed and tested.
- [ ] Secrets are unique and stored outside source control.
- [ ] `TRUST_PROXY`, `CLIENT_ORIGINS`, and `PUBLIC_WEB_BASE_URL` are correct.
- [ ] MongoDB backups and Cloudinary retention verified.
- [ ] Monitoring/alerts configured.
- [ ] Maintenance run inspected.
- [ ] Password reset email tested.
- [ ] Frontend dependency audit reviewed.
- [ ] `IMPLEMENTATION_STATUS.md` updated honestly.

## 11. Rollback

1. Stop routing new traffic to the bad instance.
2. Deploy the previous known-good backend artifact with the previous environment configuration.
3. Do not roll back the database blindly. If a schema/data change is not backward-compatible, follow the migration's documented reverse plan.
4. Rotate secrets only if the rollback was caused by exposure, not by a normal code regression.
5. Re-run health checks, maintenance, and the smoke flow.
6. Record the incident and update this runbook.

## 12. Current operational blockers

- Cloudinary credentials are blank in the local environment; real file flows are unverified.
- No production deployment or signed build exists.
- No physical-device test has been performed.
- No shared rate limiter or single-worker maintenance scheduler exists.
- No production monitoring/alerting is configured in this repository.
- No backup/restore drill has been run.

See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) and [`TESTING.md`](TESTING.md) for the verification record.
