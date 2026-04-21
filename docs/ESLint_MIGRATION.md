**ESLint Migration — Decision Log**

- **Branch:** `eslint/migrate-lint-fixes`
- **Decision (applied):** Pin `eslint` to latest v9.x (`^9.39.4`) and keep the dependency set minimal by using only the plugins wired into `eslint.config.cjs` (`@typescript-eslint/*`). Removed the temporary `.npmrc` workaround, the postinstall node_modules shim, and unused React ESLint plugins. Inlined ignore patterns into `eslint.config.cjs`.

- **Why:** The repo needs a deterministic install that works in CI and production. Keeping only the plugins that are actually configured avoids peer-dependency drift and reduces maintenance overhead.

- **What changed:**
  - `package.json`: `eslint` pinned to `^9.39.4`, unused React ESLint plugins removed, and `postinstall` hook removed.
  - `eslint.config.cjs`: ignore list inlined so lint behavior doesn't depend on a removed `.eslintignore`.
  - `scripts/create-express-tsconfig.js`: replaced shim creation with a fail-fast guidance message.
  - `src/services/localStorage.ts` and `src/utils/userHelpers.ts`: normalize `avatar_url` into `avatar` on the client so server responses can stay canonical.
  - Removed temporary `.npmrc` workaround.
  - Fixed multiple catch-block logging bugs and minor server cleanups to satisfy lint rules.

- **Next steps / migration plan to ESLint v10 (recommended):**
    1. Track upstream releases for any future ESLint plugins you add, and verify their peer ranges before introducing them.
    2. If you later need React-specific lint rules, add only the ruleset you actually enforce and wire it into `eslint.config.cjs` in the same PR.
    3. When `eslint-plugin-react` (or any new plugin) explicitly supports ESLint v10 and is actually needed, upgrade the toolchain in one PR and run `npm install` without `legacy-peer-deps`.
    4. Remove the `eslint` v9 pin and update `eslint.config.cjs` to prefer flat-config v10 idioms only after all configured plugins support v10.

- **Commands to validate locally:**
  - Install deps: `npm ci` (or `npm install`)
  - Run typecheck: `npx tsc --noEmit`
  - Run lint: `npm run lint`

- **Notes for reviewers:** This PR intentionally keeps ESLint on v9 and trims unused lint dependencies so installs are reproducible and maintenance stays simple. When plugin compatibility is available and a v10 migration is still desired, re-run the migration in a dedicated PR.

If you want, I can open follow-up PR(s) to upgrade individual plugins and test ESLint v10 in CI once compatible versions are available.
