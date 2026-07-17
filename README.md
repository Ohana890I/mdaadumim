# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Firestore Rules

This repository now includes:

- `firestore.rules`
- `firebase.json`
- `.firebaserc`

### Deploy rules

1. Install Firebase CLI (if not installed):
	- `npm i -g firebase-tools`
2. Login:
	- `firebase login`
3. Deploy Firestore rules:
	- `firebase deploy --only firestore:rules`

### Important

Current rules are production-oriented and assume Firebase Authentication is used.

- Regular users are expected to be authenticated (`request.auth != null`).
- Admin actions are expected to use a Firebase Auth custom claim:
  - `request.auth.token.admin == true`

If your current app flow still uses only localStorage checks for admin and does not sign users in with Firebase Auth, apply the rules only after completing the auth migration.
