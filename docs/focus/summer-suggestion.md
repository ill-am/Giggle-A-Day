# Summer suggestion — Focus doc

Mission

- Provide an immediate, low-effort creative prompt (suggestion) that seeds the user's input field and encourages a Generate action.

Ordered interaction steps (UI → client → store → optional network)

1. User clicks the `Summer suggestion` button.
2. UI: button shows pressed state immediately (visual feedback). If async lookup is expected, show a small spinner near the button.
3. Client: synchronous handler emits microlog `suggestion:button-pressed`.
4. Client: choose suggestion from local fixture or (if enabled) request `GET /suggest`.
5. App: populate prompt input with suggestion text, focus the input, update `promptStore`/`promptDraft` state.
6. UI: Enable `Generate` if the prompt passes validation; show transient toast "Suggestion applied".

Microlog events (emitted synchronously)

- `suggestion:button-pressed` — step: `button-pressed`
- `suggestion:applied` — step: `input-populated`, meta: { suggestionId }
- `suggestion:fallback-used` — step: `local-fallback` (if network fails)

Actionables to validate (manual, unit, integration, E2E)

- Manual quick check: click button → within 150ms: input value changed, input is focused, `Generate` enabled, and console shows `suggestion:button-pressed` followed by `suggestion:applied`.
- Unit/component: assert handler calls `applySuggestion()` and that `promptStore` value updates.
- Integration: if networked, assert request (when enabled) is `GET /suggest` and client uses fallback fixture on 4xx/5xx.
- E2E behavioral: assert microlog sequence and DOM mutation of the input; fail if only `suggestion:button-pressed` appears.

Edge cases & acceptance criteria

- Repeated clicks are debounced (e.g., 300ms). Acceptance: prompt is set and focused, no stuck spinner.
- Offline: local fixture used and `suggestion:fallback-used` logged.

Telemetry

- Emit `suggestion:applied` with suggestionId and short prompt length; do not log full prompt content.

---
