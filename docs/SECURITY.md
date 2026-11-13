# QuickDrop security

## 1. Scope and security goals

QuickDrop protects a personal file vault and bearer-style share links. The main goals are:

- Only the authenticated owner can list, read, modify, share, or delete their files.
- Passwords, refresh tokens, share tokens, and Cloudinary secrets are never exposed through normal API responses or logs.
- File bytes are private by default and delivered through short-lived Cloudinary URLs.
- Quota and upload confirmation cannot be trivially bypassed by concurrent requests.
- Public share links are unguessable, optional-password protected, expiring/limited, and revocable.
- Account transitions do not leak one user's cached/offline/upload data to another.

This document also lists residual risks. A control being described here does not mean it has been verified on a physical device or against a production deployment.

## 2. Authentication

### Passwords

- bcrypt via `bcryptjs`, cost 12 by default (`BCRYPT_SALT_ROUNDS`, allowed 10–14).
- Minimum 8 characters, maximum 72, at least one letter and one number. This is a baseline policy, not a strength meter.
- Password hashes are `select: false` and removed from JSON serialization.
- Password change/reset increments `tokenVersion` and revokes refresh tokens.
- Login returns a generic invalid-credentials response; registration reveals that an email already exists, which is a normal account-enumeration tradeoff.

### Access tokens

- JWT signed with `JWT_ACCESS_SECRET` (minimum 32 bytes), issuer/audience checked, random `jti`.
- 15-minute default lifetime.
- Payload includes `sub`, `role`, `tokenVersion`, and `type: access`.
- `authenticate` reloads the user and compares `tokenVersion`, so a password reset or logout-all invalidates existing access tokens immediately.
- Bearer tokens are held in Expo SecureStore on mobile. They are never written to SQLite or AsyncStorage.

### Refresh tokens

- 48 random bytes, base64url encoded; opaque to the client.
- Stored server-side as HMAC-SHA256 using `REFRESH_TOKEN_PEPPER`; unique hash index.
- Rotated on every refresh. The old token is marked revoked and linked to its replacement.
- Reuse of a rotated token is treated as compromise: the token family and active sessions are revoked.
- 30-day default lifetime; TTL index plus explicit expiry checks.
- Logout revokes the presented token; logout-all revokes all tokens and bumps `tokenVersion`.

### Password reset

- 32 random bytes; only an HMAC hash using `SHARE_TOKEN_PEPPER` is stored.
- Expires after `RESET_TOKEN_TTL_MINUTES` (60 default), single use.
- Forgot-password always returns a generic response to reduce account enumeration.
- Reset revokes all refresh tokens and increments `tokenVersion`.
- Development can use a console email provider; production requires Resend and an API key. `EMAIL_PROVIDER=console` is rejected for production email sending.
- The reset URL uses `quickdrop://reset-password?token=...`. A malicious app could register the same custom scheme. Use universal links/App Links and a web fallback before treating this as production-grade. The token is short-lived and single-use, which limits but does not eliminate the risk.

## 3. Authorization and object ownership

- Every file/folder/share/activity query is scoped by `owner`.
- Upload sessions are looked up by both session id and owner.
- Share access tokens are checked against the share id, file id, and owner subject.
- Moving a folder into itself or a descendant is rejected.
- Trashed files are excluded from normal reads/downloads/preview and public share lookup.
- ObjectIds are validated by Zod before use; a malformed id does not reach Mongo.
- Not-found responses are used for resources the caller does not own, avoiding ownership disclosure.

## 4. Upload security

- Cloudinary API secret stays on the server.
- The client receives a short-lived signed upload request, not a permanent credential.
- The backend reserves quota before signing and verifies the resulting Cloudinary asset on confirmation.
- Confirmation verifies the expected public ID/resource type, size, and media type. A client cannot simply claim an arbitrary asset.
- Session confirmation uses an atomic `pending → confirming` claim, preventing duplicate file creation and double quota release.
- If verification fails transiently, the session returns to `pending`; if it fails permanently, the asset is deleted, quota is released, and the session is marked failed.
- MIME types are allowlisted and mapped to media types; per-media size limits are enforced server-side.
- Direct uploads mean the API does not inspect file contents. There is no antivirus/content-disarm scanner.

### Upload limits

| Media | Default limit |
|---|---|
| Image | 25 MB |
| Video | 500 MB |
| Document | 100 MB |
| Text | 10 MB |
| Mobile single-request uploader | 100 MB hard cap in the current app |

The mobile cap is a client implementation limit, not a security boundary. The server enforces its own per-type limits.

## 5. Share security

- Share tokens are 32 random bytes; only HMAC hashes are stored.
- Optional bcrypt password hashes (`select: false`).
- Optional expiry and atomic download limit.
- Revocation and regeneration are immediate; regeneration resets access metadata.
- Public API responses expose only public file metadata, not Cloudinary public IDs or owner contact details beyond the display name.
- The public HTML page escapes all dynamic content, sets `noindex`, uses a strict CSP, and sets an HttpOnly/SameSite=Lax cookie for password access (Secure in production).
- The API accepts the share access token in `X-Share-Access-Token` or the `accessToken` query parameter. Prefer the header; query strings can appear in logs/browser history.
- Share access tokens are scoped JWTs with a 15-minute default lifetime.

### Residual share risks

- A share URL is a bearer capability. Anyone who obtains it can use it until it is revoked, expires, reaches its limit, or requires a password that they do not know.
- There is no per-recipient identity, audit identity, or watermarking.
- The public page reveals the owner's display name and the file name/size/type. That is intentional for usability but is metadata disclosure.
- Thumbnail URLs are signed but do not currently carry an expiry; treat a thumbnail URL as a capability for that image. Download URLs are expiry-bound.
- Password-protected shares still expose file metadata before unlock. Do not put sensitive information in a filename if that matters.

## 6. Cloudinary and signed URLs

- `CLOUDINARY_DELIVERY_TYPE=authenticated` is the default.
- Download/preview URLs are generated server-side with `private_download_url` and a 5-minute expiry.
- Signed upload parameters include timestamp, public ID, delivery type, optional eager transformation, API key, and signature.
- Public IDs include the user id and a UUID, but are not treated as authorization.
- Cloudinary errors are sanitized to `502 CLOUDINARY_ERROR`; detailed upstream errors are logged with redaction.
- Deleting a file removes the Cloudinary asset and shares, then releases quota. If Cloudinary deletion fails, the API operation fails and the file remains; maintenance logs orphan cleanup failures.
- The backend checks Cloudinary health at startup and exposes readiness. File endpoints return `503 CLOUDINARY_NOT_CONFIGURED` if credentials are absent.

## 7. Transport, headers, and input handling

- Helmet is enabled. API CSP is disabled because the API returns JSON; the public share HTML page sets its own strict CSP.
- HSTS is part of Helmet's defaults and is effective only over HTTPS. Terminate TLS at a trusted proxy/load balancer and set `TRUST_PROXY=true` only when appropriate.
- CORS uses an explicit origin allowlist, no credentials, and a limited method/header list. Native requests are not browser CORS.
- JSON bodies are limited to 1 MB; URL-encoded bodies are limited to 1 MB.
- Request input is recursively checked for `$` keys, dotted keys, `__proto__`, `constructor`, and `prototype` to reduce NoSQL/prototype-pollution risk.
- Zod schemas are strict and validate body/query/params.
- Zod, Mongoose validation, duplicate-key, JWT, JSON parse, and body-size errors are normalized by the centralized error handler.
- Request IDs are generated/validated and returned in `X-Request-Id`.
- Server timeout: 30 seconds; headers timeout: 35 seconds; keep-alive: 65 seconds.
- `x-powered-by` is disabled.

## 8. Rate limiting

Defaults are in-process `express-rate-limit` memory stores:

| Scope | Default |
|---|---|
| Global | 300 / 15 min |
| Auth | 10 / 15 min per IP |
| Upload sign/confirm | 60 / hour per user/IP |
| Public share | 60 / min per IP |
| Download link issuance | 120 / hour per user/IP |

The auth limit is intentionally strict in development; repeated login attempts can produce `429 RATE_LIMITED`. For multi-instance production, use a shared store (for example Redis) so limits are consistent across instances. In-memory limits reset on process restart.

## 9. Logging and secret handling

- Pino redacts authorization/cookie headers, passwords, refresh/reset/access tokens, signatures, and API keys.
- Share tokens in URLs are redacted by the logger.
- Signed URLs should not be logged; the API logs that a link was issued, not the URL itself.
- Activity metadata stores names/sizes and `viaShare`, not passwords or tokens.
- Health responses do not include secrets.
- The environment validator reports field names and validation messages, never values.

## 10. Local device security

- Access/refresh tokens and the cached user profile are stored in Expo SecureStore.
- SQLite and offline files live in app-private storage.
- The optional biometric gate uses `expo-local-authentication` with device-passcode fallback where available. It is an app-level convenience lock, not encryption of the local database/files.
- The upload queue and offline files are scoped by `owner_id`. Unscoped legacy rows are deleted during migration to avoid cross-account exposure.
- The query cache is cleared on login/register/logout/logout-all/session expiry, and active uploads are paused when auth ends.
- Offline file content is not encrypted at the application layer. A rooted/jailbroken device, malware with app-container access, or a device backup could expose it. Add SQLCipher/encrypted file storage if the threat model requires it.
- Android backup behavior is controlled by Expo SecureStore's backup configuration; iOS/Android backups may still include app-private files depending on platform settings. Review backup policy before storing highly sensitive material offline.

## 11. Infrastructure and operational security

- Use MongoDB Atlas with TLS, a least-privilege database user, IP access lists/VPC peering, and encryption at rest.
- Use Cloudinary API credentials scoped to the required account; rotate them if exposed.
- Store secrets in the deployment platform's secret manager, not `.env` files in source control.
- Keep `TRUST_PROXY` false unless a trusted proxy is actually in front of the API.
- Set `CLIENT_ORIGINS` to exact HTTPS origins in production.
- Set `PUBLIC_WEB_BASE_URL` to an HTTPS origin.
- Use HTTPS for the API and the public share page.
- Restrict MongoDB and Cloudinary management access to operators.
- Enable provider audit logs/backups where available.
- Run dependency audits and update deliberately; see the known frontend audit findings in [`TESTING.md`](TESTING.md).

### Secret rotation

| Secret | Effect of rotation |
|---|---|
| `JWT_ACCESS_SECRET` | All access tokens become invalid; users refresh or sign in again |
| `REFRESH_TOKEN_PEPPER` | All stored refresh-token hashes stop matching; all sessions effectively end |
| `SHARE_TOKEN_PEPPER` | Existing share links and reset tokens stop validating |
| `JWT_SHARE_SECRET` | Existing share access tokens stop validating; links can be unlocked again |
| Cloudinary API secret | New signatures/URLs fail until the backend is updated; existing short-lived URLs expire |

Rotate all four application secrets together after a suspected database compromise, and revoke/regenerate shares as appropriate. Plan for user-visible sign-out and share-link breakage.

## 12. Residual risks and known gaps

The following are **not** fully solved:

1. **No physical-device security verification.** Biometric prompts, SecureStore behavior, screenshots, backups, and app-switcher snapshots have not been tested on real Android/iOS hardware.
2. **No MFA.** A stolen password plus email access is sufficient to take over an account.
3. **Custom-scheme reset links.** Another app could claim `quickdrop://`; universal links/App Links and a web fallback are pending.
4. **No antivirus/content scanning.** A user can upload and share malicious files. Recipients must treat downloads as untrusted.
5. **Bearer share links.** Possession is authorization; there is no recipient identity or watermarking.
6. **No thumbnail URL expiry.** Signed thumbnail URLs are long-lived capabilities.
7. **No distributed rate limiting.** Multi-instance deployments can exceed per-instance limits.
8. **No multi-document transactions.** Upload confirmation, deletion, and quota release rely on atomic claims, compensation, and reconciliation. A crash can leave temporary orphan assets/sessions until maintenance.
9. **No admin UI or account recovery console.** The `admin` role is schema-only.
10. **Frontend dependency audit findings.** `npm audit --omit=dev` reports transitive Jest/Expo/build findings that cannot be fixed without breaking changes; they are not all runtime-reachable, but they must be reviewed before release.
11. **Email deliverability and reset link behavior.** Resend has not been exercised with production credentials in this environment.
12. **No security headers on arbitrary client-side responses beyond the API defaults.** The public page has a CSP; the API is JSON-only.
13. **No certificate pinning.** A compromised device trust store can intercept traffic; HTTPS is still mandatory.
14. **No screenshot/recents-screen protection.** Sensitive previews may appear in the app switcher.
15. **No encryption at rest for offline files/SQLite.** See section 10.
16. **Cloudinary account configuration is unverified.** Blank local credentials mean real upload/download/share flows have not been exercised.

## 13. Reporting a security issue

Do not open a public issue with secrets, live share links, passwords, or personal data. Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Include the details below.

If private vulnerability reporting is unavailable, contact the repository owner through GitHub. Include:

- a concise description and impact;
- affected endpoint/component;
- reproduction steps using synthetic data;
- relevant request IDs/log lines with secrets redacted;
- suggested remediation, if known.

See [`RUNBOOK.md`](RUNBOOK.md) for incident handling and secret rotation.
