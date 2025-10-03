# client-v2 (skeleton)

Quick start:

```bash
cd client-v2
npm install
npm run dev
```

Server runs on port 5174 by default (see `vite.config.js`).

## Snapshot testing

Run the unit+snapshot tests locally:

```bash
cd client-v2
npm ci
npm test
```

A DOM snapshot baseline is written to `client-v2/__tests__/__snapshots__/` when tests run.

In CI the `client-v2` workflow uploads snapshot artifacts under the artifact name `client-v2-snapshots`. Reviewers can download the artifact from the Actions run to inspect snapshot files when reviewing a PR.

## Image snapshots (Playwright)

Image-based snapshots are gated and run manually via the workflow_dispatch trigger or by adding a PR label `run-playwright` (if configured). These runs require Playwright to be installed and configured in `client-v2`.
