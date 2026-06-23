# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Firestore security rules

Security rules live in `firestore.rules` (referenced by the `firestore` block in
`firebase.json`). They are version-controlled and must be deployed via the CLI —
the Firebase console is no longer the source of truth.

Deploy rules only:

```bash
firebase use default          # selects project movigo-adee1
firebase deploy --only firestore:rules
```

Test locally against the emulator before deploying:

```bash
firebase emulators:start --only firestore
```

Admin/dispatcher read access is gated by `isAdmin()`, which requires either a
custom claim (`admin: true`) or an allowlist document at `admins/{uid}`. Provision
the dispatcher account's identity before deploying, or the dashboard's active-trips
query will be denied. See `specs/P0-3-firestore-security-rules.md`.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
