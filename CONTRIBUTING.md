CONTRIBUTING
============

Test timeout policy
-------------------

This repository is organised as multiple packages (for example: `server`, `client`, `shared`). Each package runs tests from its own package root and therefore maintains its own Vitest configuration. To keep tests stable and avoid sprinkling per-test timeouts across the codebase, we follow this policy:

- Set a package-level `testTimeout` in the package's `vitest.config.*` (server/client/shared) when tests in that package require longer-running operations (e.g., Puppeteer-driven PDF exports).
- Use a reasonable default per-package (e.g., `20000` ms for `server`, `10000` ms for `client`/`shared`).
- Keep per-test timeouts only for exceptional cases (e.g., end-to-end jobs that intentionally take much longer). When used, annotate the test with a short comment explaining why the longer timeout is required.

Where to look
-------------

- Server package config: `server/vitest.config.js`
- Client package config: `client/vitest.config.js`
- Shared package config: `shared/vitest.config.ts`

If you are adding or changing tests and you encounter timeouts, check the package config before adding per-test timeout overrides. When in doubt, prefer a package-level `testTimeout` and document the reason in the test comment.

Small contribution workflow
---------------------------

1. Create a small branch for the change.
2. Run the package tests locally (e.g., `npm --prefix server run test:run`).
3. Commit configuration or test updates with clear messages.
4. Open a PR and include the test run results (or CI link) in the description.

Thanks for keeping our test suite reliable and concise.
