**ESLint Migration — Decision Log**

- **Branch:** `eslint/migrate-lint-fixes`
- **Decision (applied):** Pin `eslint` to latest v9.x (`^9.39.4`) to preserve compatibility with existing ESLint plugins (notably `eslint-plugin-react`). Removed temporary `.npmrc` workaround and the postinstall node_modules shim. Inlined ignore patterns into `eslint.config.cjs`.

- **Why:** Several widely-used ESLint plugins in this repo require ESLint v9.x. For production stability and reproducible CI builds we prefer a deterministic dependency graph rather than using `legacy-peer-deps` or writing shims into `node_modules` during install.

- **What changed:**
  - `package.json`: `eslint` pinned to `^9.39.4` and `postinstall` hook removed.
  - `eslint.config.cjs`: ignore list inlined so lint behavior doesn't depend on a removed `.eslintignore`.
  - `scripts/create-express-tsconfig.js`: replaced shim creation with a fail-fast guidance message.
  - Removed temporary `.npmrc` workaround.
  - Fixed multiple catch-block logging bugs and minor server cleanups to satisfy lint rules.

- **Next steps / migration plan to ESLint v10 (recommended):**
  1. Track upstream releases of the following plugins and bump when they list ESLint v10-compatible peer ranges:
     - `eslint-plugin-react`
     - `eslint-plugin-react-hooks`
     - `eslint-plugin-react-refresh` (if used in CI)
     - any other eslint plugins that currently pin eslint to <10 in peerDependencies
  2. Upgrade plugins in a single PR and run `npm install` (no `legacy-peer-deps`) to verify resolution.
  3. Temporarily run ESLint v10 in a CI job using `npm ci --package-lock-only` + `npm i eslint@next --no-save` to smoke-test config (optional).
  4. Remove the `eslint` v9 pin and update `eslint.config.cjs` to prefer flat-config v10 idioms if desired.

- **Commands to validate locally:**
  - Install deps: `npm ci` (or `npm install`)
  - Run typecheck: `npx tsc --noEmit`
  - Run lint: `npm run lint`

- **Notes for reviewers:** This PR intentionally keeps ESLint on v9 to avoid breaking CI and to make the migration incremental and reviewable. When plugin compatibility is available, we should re-run the migration and adopt ESLint v10.

If you want, I can open follow-up PR(s) to upgrade individual plugins and test ESLint v10 in CI once compatible versions are available.
