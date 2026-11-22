## Summary

<!-- What changed and why? -->

## Accessibility (WCAG 2.2 AA)

- [ ] Complete the flow using only Tab, Shift+Tab, Enter, Space, and arrow keys where appropriate; verify logical focus order and no keyboard traps.
- [ ] Verify every focused control has a clearly visible focus indicator and the skip link reaches the main content.
- [ ] Check text contrast at 4.5:1 (3:1 for large text and non-text UI boundaries where applicable).
- [ ] Check interactive targets are at least 24 × 24 CSS px or meet the spacing exception.
- [ ] Confirm form controls have programmatic labels, errors/status updates are announced, and heading levels are in order.
- [ ] Confirm animations respect `prefers-reduced-motion`.
- [ ] Run Axe on the changed screens; resolve all serious and critical findings.
- [ ] Manually verify the primary flow with NVDA or VoiceOver and record browser/OS and any limitation.

## Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:e2e`

<!-- Attach Axe output or manual screen-reader notes for accessibility changes. -->
