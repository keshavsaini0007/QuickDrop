# QuickDrop platform UX guide

QuickDrop is not intended to be an iOS app pasted onto Android. It uses one brand system and semantic tokens, with platform-specific behavior where the platforms differ. This document records what is implemented in code and what still requires physical-device verification.

## Status legend

| Status | Meaning |
|---|---|
| **Code complete** | Implemented and typechecked; device behavior still needs checking unless explicitly marked verified. |
| **Partial** | Some implementation exists, but a requirement is incomplete or not consistently applied. |
| **Not implemented** | Not present in the current code. |
| **Device pending** | Cannot be proven by automated tests; must be checked on real hardware. |

No item below is marked device-verified. The project has not run a physical Android or iOS test pass. See [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md).

## 1. The 28-point Android UX checklist

This is the project's 28-point checklist, derived from the platform requirements in [`PLAN.md`](../PLAN.md) §8 and the app's implemented surface. A "Code complete" status means the implementation exists, not that Android behaves correctly on a device.

| # | Checklist item | Implementation | Status |
|---|---|---|---|
| 1 | Safe areas for status bar, navigation bar, notches, and gesture insets | Screens use `SafeAreaView`/`useSafeAreaInsets`; the root uses `SafeAreaProvider`; scroll content adds bottom inset where needed. | Code complete; device pending |
| 2 | Status bar style follows light/dark theme | `expo-status-bar` sets `light`/`dark` from the active theme. | Code complete; device pending |
| 3 | Edge-to-edge and three-button navigation do not cover content | Safe-area-aware layout and tab bar; no custom native edge-to-edge overrides. | Partial; three-button mode untested |
| 4 | Hardware/system back follows navigation hierarchy | Expo Router stack handles system back; no custom back interception that conflicts with it. | Code complete; device pending |
| 5 | Predictive back gesture | `android.predictiveBackGestureEnabled: true` in `app.json`; native stack transitions. | Code complete; device pending |
| 6 | Keyboard uses resize mode and does not cover fields | `android.softwareKeyboardLayoutMode: "resize"`; forms use `KeyboardAvoidingView` with platform behavior and scroll views. | Code complete; device pending |
| 7 | Forms dismiss/scroll correctly with keyboard | `keyboardShouldPersistTaps="handled"`; iOS interactive dismissal, Android on-drag; forms are scrollable. | Code complete; device pending |
| 8 | Touch targets are at least 48dp | Shared `layout.minTouchTarget = 48`; icon buttons and header actions are 48×48; primary buttons are 52 high; rows, filter chips, and action buttons are at least 48 high. | Code complete; device pending |
| 9 | Material press feedback/ripple | `android_ripple` added to primary buttons, icon buttons, file rows, folder rows, settings rows, and upload summary; pressed opacity remains as fallback. | Code complete; device pending |
| 10 | System typography and font scaling | System font by default; semantic type scale; React Native text scaling is left enabled. | Code complete; 200% untested |
| 11 | Material-style iconography where appropriate | Uses Ionicons consistently; not a full Material Community icon mapping. | Partial |
| 12 | Tab bar has visible labels, correct height, and safe-area padding | Five primary tabs (Home, Files, Shares, More, Settings) with labels and accessibility labels; the More tab links to activity, storage, recycle bin, uploads, and offline files; navigator handles bottom inset. | Code complete; device pending |
| 13 | Top app bar/header is consistent and not duplicated | Custom `AppHeader`; native headers are hidden to avoid double headers. | Code complete; device pending |
| 14 | Dialogs/sheets feel native and remain accessible | Custom modal sheets with `accessibilityViewIsModal`, slide/fade animation, and platform-adaptive styling. | Code complete; device pending |
| 15 | Destructive actions use native confirmation | Destructive operations use `Alert.alert` with explicit destructive labels. | Code complete; device pending |
| 16 | Runtime permissions are requested in context with recovery | System prompts explain photo/camera/notification access. Denied photo/camera uploads, notification permission, and unavailable biometrics offer an "Open settings" action. Not every OS permission path has a custom pre-prompt rationale screen. | Partial |
| 17 | Android notification channel and Android 13+ permission | `uploads` notification channel created; `POST_NOTIFICATIONS` declared; permission requested from Settings. | Code complete; device pending |
| 18 | No false promise of background upload | Queue is explicitly foreground-only; UI says "foreground queue"; in-flight work pauses when auth ends. | Code complete |
| 19 | Offline/network states are clear and recoverable | NetInfo-aware queries, offline copy screen, queued uploads, retry/remove actions, empty/error states. | Code complete; device pending |
| 20 | TalkBack labels, roles, and states | Buttons, rows, radios, switches, headers, progress bars, and alerts have accessibility roles/labels; selected/disabled states are set. | Code complete; TalkBack pending |
| 21 | Upload status is announced without overwhelming the user | Upload summary has `accessibilityLiveRegion="polite"` and a descriptive label; queue rows expose actions. | Code complete; TalkBack pending |
| 22 | Light/dark/system theme is consistent and readable | Semantic tokens, system preference, user override in Settings, dark splash/icon colors. | Code complete; contrast audit pending |
| 23 | Empty, loading, and error states always offer a next action | Shared `EmptyState`, `ErrorState`, `LoadingState`, and retry actions; lists expose pull-to-refresh. | Code complete; device pending |
| 24 | Loading uses native indicators, not fake progress | `ActivityIndicator` and real upload progress from the transfer; no timer-based fake progress. | Code complete |
| 25 | Native preview/share for documents | Images/video/audio via native media; PDF via browser/native preview; Office via native preview/share sheet. No fake Office renderer. | Code complete; device pending |
| 26 | File picker handles Android MIME/extension quirks | Document picker accepts a broad MIME set; Android `application/octet-stream` filename fallback; safe local filenames. | Code complete; device pending |
| 27 | Large lists remain responsive | FlashList for file/folder lists; `expo-image` thumbnails; server pagination; no video autoplay in lists. | Code complete; low-end profiling pending |
| 28 | Accessibility font scaling and navigation modes are tested on real devices | 200% font scale, TalkBack, gesture navigation, three-button navigation, rotation, and small/large screens are manual checks. | Device pending |

### Android verification prerequisites

The checklist cannot be marked passed until it is run on at least:

- a current Pixel or stock-Android device;
- a Samsung device with One UI navigation/keyboard behavior;
- a Xiaomi/other OEM device if available;
- gesture navigation and three-button navigation;
- Android 13+ for notification permission and predictive back;
- a low-end device or emulator for list/performance checks.

Record device, OS version, build type, and result in [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md).

## 2. iOS UX checklist

| Item | Implementation | Status |
|---|---|---|
| Native swipe-back and stack hierarchy | Expo Router native stack; no custom edge-gesture blocker. | Code complete; device pending |
| Safe areas for notch/Dynamic Island/home indicator | SafeAreaProvider/SafeAreaView and bottom inset handling. | Code complete; device pending |
| Face ID/Touch ID usage description and passcode fallback | `expo-local-authentication` plugin + `faceIDPermission`; biometric helper labels Face ID/Touch ID; device-passcode fallback is provided by the OS prompt. | Code complete; device pending |
| Quick Look/native document preview | PDFs use browser/native preview; Office files use the native preview/share sheet. | Code complete; device pending |
| Native share sheet | `expo-sharing` for supported local files; share-link copy uses clipboard. | Code complete; device pending |
| VoiceOver labels/roles, 44pt targets, Dynamic Type | Accessibility labels/roles and ≥48dp shared targets (above the 44pt minimum); system font scaling. | Code complete; VoiceOver/Dynamic Type pending |
| Limited photo-library access | Picker uses the system photo library flow; no custom limited-library explainer. | Partial |
| Universal links for share/reset links | Custom scheme only; no associated domains/App Links. | Not implemented |
| Tablet/large-screen layout | `supportsTablet: true`; max content width 760 and flexible layouts. | Code complete; tablet pending |
| Keyboard and form behavior | Platform-specific `KeyboardAvoidingView`; interactive keyboard dismissal; autofill hints on auth forms. | Code complete; device pending |

## 3. Design system

- **Colors:** semantic light/dark tokens in `src/theme/tokens.ts`; primary teal, amber accent, danger/success/warning soft variants.
- **Spacing/radii:** shared scale; content max width 760.
- **Typography:** system font, heading/body/caption/button variants; no forced iOS font on Android.
- **Elevation:** iOS shadow tokens and Android elevation tokens, not fake glassmorphism.
- **Touch targets:** 48dp minimum across shared controls.
- **Motion:** native stack/sheet animations; no looping decorative animation.
- **Icons:** Ionicons throughout; a platform-specific Material icon mapping is a future refinement, not a current claim.

## 4. Platform-specific behavior that is implemented

- Android keyboard resize mode and predictive back.
- Android notification channel and notification permission declaration.
- Android ripple on shared interactive rows/buttons.
- iOS keyboard avoidance and interactive dismissal.
- iOS Face ID permission text.
- Native image/video/audio rendering and native share/preview.
- Safe-area and tab-bar inset handling.
- System theme following plus user override.
- Per-account offline/upload storage and auth transition cleanup.
- Real upload progress and honest single-request size limit.

## 5. Known platform gaps

1. No physical-device verification has occurred.
2. Icons are Ionicons on both platforms; no Material Community icon mapping.
3. Permission recovery exists for the main photo/camera/notification/biometric paths, but there is no custom rationale screen before every OS prompt.
4. No universal links/App Links or browser reset fallback.
5. No reduced-motion preference handling beyond native defaults.
6. No screenshot/recents-screen privacy protection.
7. No remote push notifications.
8. No background upload guarantee.
10. No formal contrast or 200% font-scale audit has been recorded.
11. No Android widget, share-target, or file-provider integration.
12. No tablet-specific split view.

## 6. How to run the platform pass

1. Build a development client (`npx expo run:android`/`run:ios` or EAS `development` profile).
2. Connect it to a backend with real Cloudinary credentials.
3. Follow the manual checklist in [`TESTING.md`](TESTING.md).
4. For every row in [`PLATFORM_TEST_MATRIX.md`](PLATFORM_TEST_MATRIX.md), record pass/fail and evidence.
5. Update this guide and `IMPLEMENTATION_STATUS.md` only after the evidence exists.
6. Do not convert "code complete" to "verified" based on an emulator-only run unless the matrix explicitly allows it.
