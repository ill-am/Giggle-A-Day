# GitHub Workflows

This document provides a summary and assessment of the GitHub Actions workflows in this repository.

## Workflow Summary

- **`ci-quick-smoke.yml`**: Runs on pull requests to perform a non-blocking "quick smoke" test. It checks if the server starts and the `/health` endpoint is responsive. This is a good, fast, informational check.

- **`server-tests-pr.yml`**: Runs on pull requests to `main` and feature branches. It executes the server-side tests. This is a critical workflow for ensuring PRs are not breaking existing functionality.

- **`ci-smoke-puppeteer.yml`**: Runs on pushes to `main`, on a schedule, and can be manually dispatched. It performs a full end-to-end test of the PDF export functionality with Puppeteer. This is a vital but slower-running check for the core feature of the application.

- **`verify-export.yml`**: Runs on pushes and pull requests to `main`. It performs an in-process export test and runs client-side tests. This provides a good balance of speed and coverage for the export functionality without a full browser dependency.

## Overview and Assessment

- **Redundancy**: The workflows for running server tests have been consolidated into a single, comprehensive workflow (`server-tests-pr.yml`) to avoid confusion and ensure consistency.

- **Clarity**: The naming of the workflows is clear and concise.

- **Efficiency**: The `ci-quick-smoke.yml` workflow provides an efficient, non-blocking smoke test for pull requests.

- **Gating**: The `ci-smoke-puppeteer.yml` workflow is a strict, gated check for the critical PDF export functionality, running on pushes to `main` and on a nightly schedule to prevent regressions.

- **Overall**: The workflows provide good test coverage for the application, with a clear separation between quick checks, pull request tests, and critical path validation.

## To-Do

- [x] Consolidate `ci-server-tests-pr.yml`, `ci-server-tests.yml`, and `server-tests.yml` into a single `server-tests-pr.yml`.
- [x] Rename `ci-server-tests-pr.yml` to `server-tests-pr.yml` for clarity.
- [x] Delete the redundant `ci-server-tests.yml` and `server-tests.yml` files.
- [x] Update this document to reflect the changes.

## CI Notes

- **Chrome/Chromium Dependency**: Several tests, particularly those involving Puppeteer for PDF generation (`export.integration.test.js`, `puppeteer.smoke.test.js`), require a system-level installation of Google Chrome or Chromium.

- **`CHROME_PATH`**: The CI environment must set the `CHROME_PATH` environment variable to point to the location of the Chrome/Chromium executable.

- **Workflow Example**: The `server-tests-pr.yml` workflow provides a working example of how to install `google-chrome-stable` on an Ubuntu runner and configure the necessary environment variables.

- **Puppeteer Installation**: When installing npm dependencies in a CI environment where a system browser is provided, it's important to set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` to prevent Puppeteer from downloading its own version of Chromium, which can be redundant and slow down the build process.

### Pre-flight Check Script

To improve the reliability and robustness of the CI pipeline, a pre-flight check script will be implemented. This script will verify that all necessary dependencies and configurations are in place before the main test suite is executed.

#### Assessment

**Pros:**

- **Increased Reliability**: This approach directly tackles the problem of environment-related test failures. By verifying dependencies and configuration before tests run, you can prevent a whole class of CI errors.
- **Idempotency and Efficiency**: A well-written script will only install dependencies if they are missing. This makes CI runs faster and more consistent, as you're not re-installing software on every run if it's already present in a cached runner.
- **Centralized Logic**: Instead of scattering `apt-get install` and `export` commands across multiple workflow files, you centralize the logic in one place. This makes it easier to manage and update your CI requirements. If you need to add a new dependency, you only have to change one script.
- **Improved Debugging**: If a CI job fails, the logs from this script will provide a clear, immediate indication of whether the failure was due to a missing requirement. This saves time trying to diagnose issues in the test logs themselves.
- **Developer Parity**: Developers can run the same script locally to ensure their development environment is configured correctly, reducing the "it works on my machine" problem.

**Cons:**

- **Initial Setup**: There is a small upfront effort to write and integrate the script.
- **Platform Specificity**: The script would need to be written for the specific OS of your CI runners (in this case, `ubuntu-latest`). If you ever need to support other operating systems, the script would need to be made more complex or you'd need separate scripts.

#### Suggestions for Implementation

1.  **Create a Central Script**: A shell script named `scripts/verify-ci-env.sh` will be created to house the logic.
2.  **Script Steps**: The script will perform the following actions:
    - Check for the existence of `google-chrome-stable`.
    - Install it if it's missing.
    - Ensure `CHROME_PATH` is set and exported to `$GITHUB_ENV`.
    - Ensure `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` is set to `true` and exported to `$GITHUB_ENV`.
3.  **Integration into Workflows**: The workflow YAML files will be updated to call this script in a single step.

#### To-Do

- [x] Create the `scripts/verify-ci-env.sh` script with the logic described above.
- [x] Make the script executable.
- [x] Update `server-tests-pr.yml` to use the new script.
- [x] Update `ci-smoke-puppeteer.yml` to use the new script.
- [x] Update `verify-export.yml` to use the new script.
- [x] Update this document to reflect the completed changes.
