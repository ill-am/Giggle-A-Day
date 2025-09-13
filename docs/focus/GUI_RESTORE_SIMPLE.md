# GUI Restore: Minimal Action Plan

The key difference in this approach: Verify and document before touching any code.

## Current State Assessment

- [ ] **Prompt Entry**: Works (textarea binding to store)
- [ ] **Generate Button**: Blocked (intercepted for local preview)
- [ ] **Server Communication**: Unknown (needs verification)
- [ ] **Data Flow**: Partially working (stores exist but may be overridden)

## Blocking Issues (Prioritized)

1. [ ] Generate button intercepts actual server calls

   - Location: `client/src/components/PromptInput.svelte`
   - Issue: `handleGenerateClick` does local preview only
   - Action: Restore server communication path

2. [ ] Server endpoint status unknown

   - Location: `server/index.js` handles `/prompt`
   - Action: Verify endpoint responds
   - Check: Authentication requirements

3. [ ] Data flow may have multiple intercepts
   - Check: Store updates in `PromptInput.svelte`
   - Check: Preview interception
   - Action: Ensure clean data path

## Unblock Steps (In Order)

1. [ ] Verify Server First

   ```bash
   # Simple check - do this first
   curl -v -X POST http://localhost:3000/prompt \
     -H "Content-Type: application/json" \
     -d '{"prompt":"test"}'
   ```

   - [ ] Server responds
   - [ ] Auth requirements clear
   - [ ] Response format documented

2. [ ] Clear Generate Path

   - [ ] Identify all references to handleGenerateClick
   - [ ] Map out store update points
   - [ ] List minimal required stores
   - [ ] Document the clean path

3. [ ] Document UI States
   - [ ] List required states (loading, success, error)
   - [ ] Map existing state handling
   - [ ] Note what can be temporarily removed

## Implementation Checklist

When above steps are verified, implement in this order:

1. [ ] Server Access

   - [ ] Confirm endpoint URL
   - [ ] Document auth requirement
   - [ ] Test with curl
   - [ ] Note response format

2. [ ] Clean Generate Path

   - [ ] Remove/comment preview intercepts
   - [ ] Restore server call
   - [ ] Verify store updates
   - [ ] Test basic flow

3. [ ] Basic UI Feedback
   - [ ] Loading state
   - [ ] Success feedback
   - [ ] Error messages
   - [ ] Verify stores update

## Success Criteria

- [ ] Enter prompt → click generate → see response
- [ ] No client-side preview interference
- [ ] Basic error handling works
- [ ] Stores update correctly

## Risk Assessment

1. Server-side

   - [ ] Auth might block requests
   - [ ] CORS may need configuration
   - [ ] Response format might have changed

2. Client-side
   - [ ] Store updates might conflict
   - [ ] Preview might auto-trigger
   - [ ] Multiple handlers might compete

## Quick Reference

Current Files Involved:

- `client/src/components/PromptInput.svelte` - Main UI
- `server/index.js` - API endpoint
- `client/src/stores.js` - Data management

Expected Data Flow:

```
Prompt Input → Generate Click → Server Call → Update Stores → UI Feedback
```

## Notes

- Keep existing code
- Remove only what blocks
- Document each change
- Test each step
- No new features
- Focus on core flow
