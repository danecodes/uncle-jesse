# @danecodes/uncle-jesse-roku

## 3.3.0

### Minor Changes

- 4f0385d: Add `focusByKeys(targetId, options)` to `TVDevice`. A non-geometric focus primitive that drives caller-specified D-pad keys until the focused element's id matches the target. Bypasses the bounds-based walker for cases where geometry is unreliable — escaping a horizontal `FocusLayoutGroup` into a sibling vertical group, oscillating candidate directions, etc. Supports a single key or a multi-key sequence with optional `intermediateIds` waypoints, `maxPressesPerKey` budget per axis (default 6), and `targetId: string | string[]` for "any of these is fine". Failure throws with the full press trail and which budgets were exhausted. Purely additive — the existing `LiveElement.focus()` geometric walker is unchanged.

### Patch Changes

- Updated dependencies [4f0385d]
  - @danecodes/uncle-jesse-core@3.3.0
