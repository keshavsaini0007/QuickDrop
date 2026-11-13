# QuickDrop platform test matrix

This file is the only place where physical-device verification may be recorded. A row must not be marked **Pass** without a real device run and evidence (screenshot, recording, log excerpt, or tester note).

## Build under test

| Field | Value |
|---|---|
| App version | 1.0.0 (not released) |
| Backend commit | Repository HEAD at test time (see `git log`) |
| Build type | No signed/development build produced in this environment |
| Cloudinary | **Not configured** in local `.env` |
| Test date | — |
| Tester | — |

## Android devices

Add one column per device actually used. Do not invent device names.

| Device | OS | Build | Navigation mode | Keyboard | Result |
|---|---|---|---|---|---|
| Pixel-class device | — | — | — | — | **Not run** |
| Samsung device | — | — | — | — | **Not run** |
| Xiaomi/other OEM | — | — | — | — | **Not run** |

## iOS devices

| Device | OS | Build | Biometrics | Result |
|---|---|---|---|---|
| Face ID device | — | — | — | **Not run** |
| Touch ID/small-screen device | — | — | — | **Not run** |

## Functional/platform checks

Status values: **Not run**, **Pass**, **Fail**, **Blocked**, **N/A**.

| Area | Check | Android | iOS | Evidence / notes |
|---|---|---|---|---|
| Auth | Register, sign in, sign out | Not run | Not run | |
| Auth | Silent access-token refresh after expiry | Not run | Not run | |
| Auth | Refresh reuse/session revocation | Not run | Not run | |
| Auth | Forgot/reset password deep link | Not run | Not run | |
| Auth | Biometric app lock and passcode fallback | Not run | Not run | |
| Files | Upload image/video/audio/PDF/text/Office/archive | Not run | Not run | Cloudinary blocked |
| Files | Per-type size rejection | Not run | Not run | |
| Files | Quota rejection | Not run | Not run | |
| Files | Rename/move/favorite/search/sort/paginate | Not run | Not run | |
| Files | Image/video/audio preview | Not run | Not run | |
| Files | PDF browser preview | Not run | Not run | |
| Files | Office native preview/share | Not run | Not run | |
| Files | Download counter and activity | Not run | Not run | |
| Folders | Create/rename/move nested folders | Not run | Not run | |
| Folders | Descendant-move protection | Not run | Not run | |
| Trash | File trash/restore/permanent delete | Not run | Not run | |
| Trash | Folder-tree trash/restore/permanent delete | Not run | Not run | |
| Trash | Empty recycle bin and quota release | Not run | Not run | |
| Shares | Create/unlock/download public link | Not run | Not run | |
| Shares | Expiry, max downloads, revoke, regenerate | Not run | Not run | |
| Shares | Public page light/dark and mobile viewport | Not run | Not run | |
| Uploads | Real progress, retry, cancel, remove | Not run | Not run | |
| Uploads | Kill/relaunch recovery | Not run | Not run | |
| Uploads | 100 MB mobile cap message | Not run | Not run | |
| Uploads | Per-account queue isolation | Not run | Not run | |
| Offline | Save/open/remove offline file | Not run | Not run | |
| Offline | Per-account offline isolation | Not run | Not run | |
| Android UX | Safe areas, status/nav bars | Not run | N/A | |
| Android UX | Gesture navigation | Not run | N/A | |
| Android UX | Three-button navigation | Not run | N/A | |
| Android UX | Predictive back | Not run | N/A | |
| Android UX | Keyboard resize/forms | Not run | N/A | |
| Android UX | Ripple/press feedback | Not run | N/A | |
| Android UX | Notification channel and Android 13+ permission | Not run | N/A | |
| Android UX | Runtime photo/camera permission denial | Not run | N/A | |
| iOS UX | Swipe-back and stack hierarchy | N/A | Not run | |
| iOS UX | Safe areas/Dynamic Island/home indicator | N/A | Not run | |
| iOS UX | Face ID/Touch ID and passcode fallback | N/A | Not run | |
| iOS UX | Native share/Quick Look behavior | N/A | Not run | |
| Accessibility | TalkBack labels/roles/actions | Not run | N/A | |
| Accessibility | VoiceOver labels/roles/actions | N/A | Not run | |
| Accessibility | 200% font scaling | Not run | Not run | |
| Accessibility | Dark/light contrast | Not run | Not run | |
| Accessibility | Reduced motion (if applicable) | Not run | Not run | |
| Lifecycle | Background/foreground during upload | Not run | Not run | |
| Lifecycle | Offline/online transitions | Not run | Not run | |
| Lifecycle | Rotation/tablet layout | Not run | Not run | |
| Lifecycle | App-switcher/recents privacy | Not run | Not run | |
| Performance | Large list scrolling on low-end device | Not run | Not run | |
| Performance | Memory during video preview | Not run | Not run | |

## Evidence log

Add dated entries only after a real run:

```text
YYYY-MM-DD | Device | OS/build | Tester | Checks | Result | Evidence
```

## Sign-off

- [ ] At least one physical Android device passed the Android checklist.
- [ ] At least one physical iOS device passed the iOS checklist.
- [ ] Cloudinary-backed upload/preview/download/share flows passed.
- [ ] Accessibility checks passed with TalkBack and VoiceOver.
- [ ] Results and evidence are recorded above.
- [ ] `IMPLEMENTATION_STATUS.md` and `UX_PLATFORM_GUIDE.md` are updated honestly.

Until these boxes are checked, QuickDrop is **code-complete but not device-verified**.
