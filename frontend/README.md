# QuickDrop mobile app

Expo SDK 58 / React Native client for QuickDrop. Routes live in `src/app/`; shared components, hooks, state, and platform utilities live outside the route tree.

## Run

```bash
npm install
cp .env.example .env.local
npx expo start
```

`EXPO_PUBLIC_API_URL` must point at the backend. `localhost` only works on an emulator/simulator; a physical device needs the development computer's LAN IP or an HTTPS tunnel. See `../docs/SETUP.md`.

Some native modules (SQLite, SecureStore, notifications, local authentication, video) require a development build rather than Expo Go:

```bash
npx expo run:android
# or
npx expo run:ios
# or build with EAS
npx eas-cli@latest build --profile development
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## Product and engineering documentation

- [Setup](../docs/SETUP.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [API](../docs/API.md)
- [Testing](../docs/TESTING.md)
- [Platform UX guide](../docs/UX_PLATFORM_GUIDE.md)
- [Implementation status](../docs/IMPLEMENTATION_STATUS.md)
- [Root README](../README.md)

No Android or iOS verification is claimed until the checks in `../docs/PLATFORM_TEST_MATRIX.md` have been performed on physical devices.

## License

No license is granted for this repository. The source is public for viewing only; all rights reserved. See the [root README](../README.md#license).
