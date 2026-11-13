# Contributing to QuickDrop

## Repository layout

- `backend/` — Express 5 + TypeScript API
- `frontend/` — Expo SDK 58 + React Native app
- `docs/` — setup, architecture, API, security, testing, platform, runbook, roadmap, status
- `PLAN.md` — detailed master plan

There is no root `package.json` or workspace wrapper. Run commands inside the application you are changing.

## License and contributions

This repository is public for viewing; no open-source license is granted, and all rights are reserved. Do not assume that code, documentation, or assets may be reused. Contributions are accepted only with explicit permission from the repository owner.

## Workflow

1. Read the relevant docs and `PLAN.md`.
2. Implement one vertical slice at a time.
3. Run the checks for the affected project:

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

4. Add or update tests for behavior changes. Do not replace real behavior with mocks in production code.
5. Update the relevant documentation and `docs/IMPLEMENTATION_STATUS.md`.
6. Update `docs/CHANGELOG.md` for user-visible or operational changes.
7. Commit with a clear message.

Do not claim Android or iOS verification unless the feature was tested on a physical device and the result was recorded in `docs/PLATFORM_TEST_MATRIX.md`. Emulator-only checks must be labeled as such.

## Documentation

Use the existing documents rather than creating one-off notes:

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
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)

Keep documentation honest about the distinction between **implemented**, **tested**, **verified**, and **device-verified**.

## Code standards

- TypeScript strict mode.
- Validate all external input with Zod on the backend.
- Scope every user-owned database query by the authenticated owner.
- Never log passwords, tokens, Cloudinary secrets, or signed URLs.
- Never put the Cloudinary API secret in the mobile app.
- Use the shared `ApiError`, `apiResponse`, and `asyncHandler` helpers.
- Keep controllers thin; put business rules in services.
- Use atomic database operations, idempotent claims, compensation, or reconciliation instead of assuming multi-document transactions.
- Keep platform-specific behavior explicit and accessible.
- Prefer real data and real native APIs over simulated behavior.
- Do not add fake progress, fake records, or hardcoded production data.
- Preserve safe-area, keyboard, dark-mode, font-scaling, and 48dp touch-target behavior.
- If a dependency adds native code, rebuild the development client; do not assume Metro reload is enough.

## Backend conventions

- Request flow: route → middleware/validation → controller → service → model.
- Add Zod schemas for body, query, and params as applicable.
- Return the standard success/error envelopes.
- Add indexes deliberately; document data model changes in `docs/DATABASE.md`.
- Never trust client-supplied Cloudinary asset fields; verify the asset before creating a file record.
- Use `recordActivity` for meaningful user-visible events, but do not fail the primary operation if activity recording fails.
- Add tests for ownership boundaries and concurrency-sensitive behavior.

## Frontend conventions

- Routes live only in `frontend/src/app/`; shared code lives outside the route tree.
- Use TanStack Query for server state and Zustand for client/session/preference state.
- Clear or scope local state on account transitions.
- Use the shared theme tokens and UI primitives; do not hardcode platform-specific colors or sizes in screens.
- Use real upload/download progress and real offline/error states.
- Add accessibility labels, roles, states, and hints for interactive controls.
- Test the account-switch, offline, permission-denied, and expired-session paths.

## Secrets and test data

- Do not commit `.env`, `.env.local`, credentials, signed URLs, tokens, or production data.
- Use synthetic accounts/files for tests.
- The normal backend suite uses an in-memory MongoDB; the opt-in Cloudinary test writes to a real account and cleans up after itself.
- Never run destructive cleanup against Atlas/production without explicit approval.
- If a test creates local runtime data, remove it before finishing.

## Commits

Use concise, imperative messages:

- `feat: add rotating refresh tokens`
- `fix: keep Android upload summary above the navigation bar`
- `docs: document Cloudinary authenticated uploads`
- `test: cover upload confirmation races`

## Pull request checklist

- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build passes for the backend when backend code changed
- [ ] Relevant tests pass
- [ ] New behavior has tests where practical
- [ ] No secrets or signed URLs in logs or source
- [ ] Error, loading, empty, offline, and permission-denied states handled
- [ ] Accessibility labels and touch targets reviewed
- [ ] Android and iOS implications documented
- [ ] Documentation and implementation status updated honestly
- [ ] No device/Cloudinary verification claimed without evidence

## CI

`.github/workflows/ci.yml` runs backend install/typecheck/lint/build/tests and frontend install/typecheck/lint/tests. It does not run real Cloudinary tests, device tests, EAS builds, or production deployment checks.

## Reporting issues

Use synthetic data and redact tokens, cookies, signed URLs, personal data, and Cloudinary secrets. Include the request ID from `X-Request-Id` when reporting an API failure. Security issues should be reported privately as described in `docs/SECURITY.md`.
