# Visual parity notes and reviewer checklist

Purpose

This document records known visual differences between the legacy `client/` preview and `client-v2/` preview, and provides a short reviewer checklist for approving snapshot diffs.

## How to use

- When a PR changes preview rendering, attach Playwright snapshot artifacts or locally generated screenshots.
- Add a one-line acceptance note in the PR body under "Visual parity note:" stating either `ACCEPT` or `REGRESS` plus brief rationale and the commit/PR hash.

## Reviewer checklist

- Does the content (title, author, text) render in the same order and hierarchy? (Yes/No)
- Are line breaks and stanza grouping preserved for the sample payloads? (Yes/No)
- Are background images/themes applied and not obscuring text? (Yes/No)
- Are special characters and emoji rendered correctly? (Yes/No)
- If snapshot diffs exist, is the change an intentional enhancement or a regression? Document short rationale.

### Example PR note

Visual parity note: ACCEPT — Minor spacing difference on the author line intentional (improved readability). Verified in PR #123 / commit abcdef0.

Storage of baseline fixtures

- Canonical fixtures live in `client-v2/test-fixtures/poems/` (short, mid, long).
- Official golden screenshots may be stored as release artifacts or in `docs/focus/visual-golden/` if desired.

Maintainer: frontend team
