# BE2genie — Pre-Actionables (UI placeholders)

Last updated: 2025-10-28

Purpose

- Provide a short, implementable set of UI options for showing `Edit` and `Export` affordances when backend export/edit functionality is not yet implemented.
- Record the product preference (Option 1) to close the item and move on to subsequent work.

Context

Currently generated content returns from the backend but UI does not surface `Edit` or `Export` actions. We need a minimal, low-risk UI treatment that documents options and records the chosen approach so implementation can proceed quickly.

Options

Option 1 — Disabled buttons with tooltip (preferred by product)

- Render `Edit` and `Export` buttons in the same pattern as the disabled `Generate` state (grayed-out / visually disabled).
- On hover show a tooltip: “Export — coming soon” / “Edit — coming soon”.
- Buttons are non-functional (no navigation); optionally emit a telemetry event on hover or click.
- Pros: fastest to implement, low user risk, visually communicates feature intent.
- Cons: may disappoint some users if they try to click; keep copy clear.

Option 2 — Disabled look but clickable → modal (recommended balance)

- Buttons look disabled but are keyboard-focusable and clickable.
- Click opens a small modal: explains "coming soon", offers "Notify me" or "Request beta" and records telemetry.
- Pros: captures demand signals, reduces frustration, quick UX for PM prioritization.
- Cons: slightly more dev/QA work than Option 1.

Option 3 — Shallow client-side stub flow (local preview/edit)

- Buttons enable a client-only flow: Export produces a client-side preview (no server export), Edit opens a local editor that is not persisted.
- Pros: allows usability testing and demos of interaction flows.
- Cons: risk of user confusion about persistence; larger dev effort.

Option 4 — Feature-flagged rollout (safe exposure)

- Any of the above options shown only under a feature flag (or to a small user cohort).
- Pros: safest for production; enables staged testing.
- Cons: requires flagging/rollout control; small extra effort.

Product preference

- The product owner prefers Option 1 (Disabled buttons with tooltip) to close this item quickly and move on to the next.

Minimal implementation guidance (Option 1)

- UI

  - Show both `Edit` and `Export` buttons next to generated content, using the same disabled/greyed styling used for the initial `Generate` button.
  - Provide an accessible tooltip on hover: "Export — coming soon" / "Edit — coming soon".
  - Use `aria-disabled="true"` and visible focus styles to meet accessibility guidelines.

- Telemetry (optional but recommended)

  - Emit lightweight events for interest measurement: `ui.export_hover_stub`, `ui.edit_hover_stub`, and optionally `ui.export_click_stub` if capturing clicks.
  - Include context: `component: 'genie_result'`, `promptId` or `resultId` if present (no PII).

- Copy examples

  - Tooltip: "Export — coming soon"
  - If clicks are enabled accidentally, fallback modal or toast: "Export is coming soon — we'll notify you when it's available." (Option 1 keeps clicks inert.)

- QA/Accessibility checklist
  - Buttons must be announced as disabled by screen readers (use `aria-disabled`), or be operable and announce the modal content if clicks open a modal.
  - Keyboard navigation: focus order must include the buttons and tooltip/modal must be dismissible with `Esc`.

Effort estimate

- Implement disabled buttons + tooltip: ~1 hour.
- Optional telemetry on hover/click: +0.5–1 hour.
- QA/accessibility checks and copy review: +0.5–1 hour.

Next steps

1. Implement the UI-only change for `Edit` and `Export` as disabled buttons in the client app (quick PR).
2. Add telemetry if desired and wire to analytics pipeline.
3. When backend export/edit are implemented, replace the disabled state with real handlers and tests.

Files to update (suggested)

- Frontend component that renders generation results (e.g., `client/src/components/GenieResult.svelte` or similar) — add buttons and tooltip.
- Optional small modal component and a telemetry helper.

Notes

- This pre-actionables doc records the short-term UI choice so the work item can be closed and subsequent backend work (persistence, dedupe, export enforcement) can proceed independently.
