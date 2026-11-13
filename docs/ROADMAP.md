# QuickDrop roadmap

This roadmap describes what exists, what must be proven before release, and what is intentionally deferred. It is not a promise of dates. Priorities may change after Cloudinary and physical-device verification.

## 1. Current baseline

| Area | State |
|---|---|
| Core backend APIs | Implemented, automated tests passing with mocked Cloudinary |
| Core mobile flows | Implemented; limited unit tests; no physical-device pass |
| Real Cloudinary lifecycle | **Blocked** — local credentials blank |
| Signed EAS builds | Not produced |
| Production deployment | Not performed |
| Documentation | Complete for current scope |
| Release readiness | **Not release-ready** |

The implementation covers the MVP scope: auth, files/folders, uploads, shares, trash, storage, activity, offline copies, persistent upload queue, notifications, biometric lock, profile/settings, and platform-aware UI.

## 2. Phase status

The phases below follow [`PLAN.md`](../PLAN.md) §17.

| Phase | Status | Notes |
|---|---|---|
| 0 — Architecture and plan | Complete | Detailed `PLAN.md`; environment decisions recorded |
| 1 — Foundation | Complete | Backend/frontend scaffolds, env validation, logging, DB, health, design tokens, CI |
| 2 — Authentication | Implemented and tested | Refresh rotation/reuse, reset, profile, mobile auth |
| 3 — Files and Cloudinary uploads | Implemented; real Cloudinary pending | Mocked automated coverage; signed direct upload; quota/confirmation hardening |
| 4 — Native platform integration | Code complete/partial | Camera/gallery/document picking, preview/share, safe areas, keyboard; device pass pending |
| 5 — Folders, sharing, trash, activity, storage | Implemented and tested | Backend tests cover ownership, share limits, trash, storage |
| 6 — Offline, queue, notifications, biometrics | Implemented; device verification pending | Queue is persistent and per-account; chunked/background upload not implemented |
| 7 — Hardening and verification | In progress | Security/error/accessibility reviews; physical-device and Cloudinary verification outstanding |
| 8 — Release packaging and documentation | Partially complete | Docs and `eas.json`; no signed build, Dockerfile, or production deployment |

## 3. P0 — Release blockers

These must be completed before describing the app as production-ready.

1. **Configure Cloudinary and verify the real lifecycle**
   - Supply cloud name/API key/API secret.
   - Run `npm run test:cloudinary`.
   - Verify sign → direct upload → confirm → preview → download → share download → trash/restore → permanent delete.
   - Verify Cloudinary failure/cleanup behavior with an invalid asset.
   - Verify authenticated delivery for images, video, raw/PDF, and Office files.

2. **Physical Android verification**
   - Pixel/stock Android, Samsung, and Xiaomi/other OEM where available.
   - Gesture and three-button navigation; predictive back.
   - Keyboard resize, runtime permissions, notification channel, Android 13+ permission.
   - TalkBack, 200% font scaling, contrast, rotation, low-end performance.
   - Record evidence in `docs/PLATFORM_TEST_MATRIX.md`.

3. **Physical iOS verification**
   - Face ID and Touch ID/small-screen devices.
   - Swipe-back, safe areas, Dynamic Type, VoiceOver, native preview/share.
   - Limited photo-library behavior and biometric fallback.
   - Record evidence in the platform matrix.

4. **Signed builds**
   - Configure the EAS project ID and credentials.
   - Build/install development, preview, and production artifacts.
   - Test the exact signed artifacts, not only Metro.
   - Verify production HTTPS API/share URLs and deep-link behavior.

5. **Production deployment**
   - HTTPS reverse proxy, secret manager, MongoDB Atlas, Cloudinary, Resend.
   - Monitoring/alerts, backups, and a restore drill.
   - Shared rate limiter and single-worker maintenance strategy if scaling horizontally.
   - Run the runbook smoke flow and record results.

6. **Dependency/security review**
   - Review the frontend audit findings and update tooling when compatible fixes exist.
   - Decide whether the remaining transitive findings are acceptable for release.
   - Re-run backend/frontend audits and the full test suite.

## 4. P1 — Production hardening

### Account and auth

- Email verification before uploads/sharing.
- Account deletion with a clear data-retention policy.
- Universal links/App Links for password reset and share URLs, plus a browser fallback.
- Optional MFA/TOTP and recovery codes.
- Session/device management UI with individual revocation.
- Login/security notifications for new devices.

### Platform and accessibility

- Complete permission-denied recovery coverage for the remaining OS permission paths (photo/camera/notification/biometric recovery is already present).
- Material Community icon mapping on Android where it improves clarity.
- Reduced-motion preference handling.
- Formal contrast audit and 200% font-scale pass.
- Screenshot/recents-screen privacy protection for sensitive previews.
- Tablet/large-screen layout review and split-view exploration.
- Android share-target and file-provider integration where it fits the product.

### Operations

- Dockerfile and image build pipeline, if the deployment target uses containers.
- Shared rate-limit store (for example Redis) for multi-instance deployments.
- Single designated maintenance scheduler/worker.
- Structured metrics/OpenTelemetry and dashboards.
- Automated backup verification and restore drills.
- Error tracking with PII/secret scrubbing.
- Load/performance testing and capacity planning.
- Blue/green or rolling deployment and rollback rehearsal.

### Security

- Virus/malware scanning pipeline for uploaded files (with quarantine behavior).
- App-layer encryption for offline files and the local queue (for example SQLCipher).
- Expiring signed thumbnail URLs.
- Secret rotation automation and documented breakage windows.
- Dependency update policy and SBOM.

## 5. P2 — Product enhancements

- **Chunked/resumable mobile upload** for large files, with real Cloudinary chunking and resume-after-process-death.
- **Background upload** where the OS supports it; never promise it universally.
- **Remote push notifications** for share downloads, security events, and async jobs.
- **Avatar upload** using the existing authenticated Cloudinary pattern.
- **In-app Office/PDF rendering** if native preview is insufficient; avoid fake rendering.
- **Share recipient identity**, per-recipient limits, watermarking, and access receipts.
- **Public share page customization** (branding, expiration messaging) within a safe CSP.
- **Folder sharing** and bulk operations with clear quota/limit behavior.
- **Trash retention configuration** per account and a visible “days remaining” indicator.
- **Offline sync controls**: per-file pinning, storage budget, and bulk remove.
- **Search improvements**: metadata filters, recent searches, saved filters.
- **Storage insights**: largest files, duplicate detection, cleanup suggestions.

## 6. P3 — Scale and team features

- Organizations/workspaces, roles, and per-workspace quotas.
- Admin console for account/support operations.
- Audit export and retention policies.
- Team sharing and delegated ownership.
- Usage billing/plan enforcement.
- Multi-region storage/delivery strategy.
- Advanced abuse detection and public-link throttling.

## 7. Explicit non-goals for the current release

- Real-time collaboration or WebSocket presence.
- A full office suite or in-app document editor.
- Guaranteed background upload on every Android OEM/iOS state.
- End-to-end encrypted sharing with recipient keys.
- A public API for third-party integrations.
- Cross-account team vaults.
- Admin UI, billing, or subscription management.

## 8. Suggested sequence

1. Cloudinary credentials + real lifecycle test.
2. Android physical pass and fixes.
3. iOS physical pass and fixes.
4. Signed EAS builds.
5. Production staging deployment, monitoring, backups, and runbook drill.
6. Security/audit review and release decision.
7. Post-release: universal links/Resend verification, then chunked upload and background work.
8. Later: MFA, offline encryption, malware scanning, team features.

## 9. Decision gates

Before moving from one phase to the next:

- **Gate A — Real file lifecycle:** Cloudinary test and manual upload/download/share/offline flows pass.
- **Gate B — Device quality:** Android and iOS platform matrices have evidence, including accessibility.
- **Gate C — Release artifact:** signed builds install and pass the smoke flow.
- **Gate D — Operations:** monitoring, backups, restore drill, and incident runbook are exercised.
- **Gate E — Security:** known findings reviewed; no unresolved critical/high issue without an accepted risk decision.

Until Gates A–E are met, the honest status remains **code-complete but not production-verified**.
