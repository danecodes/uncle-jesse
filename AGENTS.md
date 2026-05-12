# Uncle Jesse - Development Instructions

## What Uncle Jesse is

E2E testing framework for smart TVs. Orchestrates device interactions, manages test lifecycle, provides assertions and page objects. It does NOT implement protocol-level communication.

## Dependency boundaries

Uncle Jesse depends on several @danecodes packages. Each has a clear responsibility. Do not duplicate their functionality in Uncle Jesse. If something is missing from a dependency, ask Dane to add it there.

### @danecodes/roku-ecp (ECP protocol client)

**Owns:** All HTTP communication with port 8060. Keypresses, queries, launches, screenshots, sideloading, SSDP discovery. Polling helpers (waitForElement, waitForFocus, waitForStable, waitFor, waitForApp, waitForText). UI XML parsing (parseUiXml, findElement, findElements, findFocused). Typed errors (EcpHttpError, EcpTimeoutError, EcpAuthError).

**Uncle Jesse uses:** EcpClient for all device communication. Polling helpers from roku-ecp instead of custom polling loops. parseUiXml/findElement for UI tree queries.

**If missing from roku-ecp:** Ask Dane. Do not implement ECP protocol calls in Uncle Jesse.

### @danecodes/roku-odc (ODC protocol client)

**Owns:** All HTTP communication with port 8061. Registry read/write/clear, file push/pull/list, extended app UI queries. ODC component injection (inject, injectDir).

**Uncle Jesse uses:** OdcClient for registry operations via RegistryState.applyViaOdc(). Optional dependency.

**If missing from roku-odc:** Ask Dane. Do not implement ODC protocol calls in Uncle Jesse.

### @danecodes/roku-log (log parsing and streaming)

**Owns:** TCP connection to port 8085. Log parsing (BrightScript errors, crashes, backtraces, beacons). LogStream for real-time streaming. LogSession for collection and querying. LogParser for line-by-line parsing.

**Uncle Jesse uses:** LogStream and LogSession for structured log capture during tests. Re-exported from the roku adapter package.

**If missing from roku-log:** Ask Dane. Do not implement log parsing or console streaming in Uncle Jesse.

### @danecodes/roku-screenshot (screenshot diffing)

**Owns:** Screenshot capture, image diffing, visual regression comparison.

**Uncle Jesse uses:** Optional integration for visual regression assertions. Not yet integrated.

### @danecodes/roku-diff (UI tree diffing)

**Owns:** Structural comparison of two UiNode trees. Reports added/removed/changed/moved nodes.

**Uncle Jesse uses:** Optional integration for tree snapshot assertions and replay viewer diffs. Not yet integrated.

### @danecodes/roku-mock (mock API server)

**Owns:** HTTP mock server for intercepting Roku app API calls. Scenarios, recording, latency simulation.

**Uncle Jesse uses:** Optional integration for deterministic test data. Not yet integrated.

### @danecodes/roku-registry (registry presets)

**Owns:** Named registry configurations. CLI for managing presets.

**Uncle Jesse uses:** Optional integration for RegistryState presets. Not yet integrated.

### @danecodes/roku-deeplink (deep link validation)

**Owns:** Deep link test case definitions and validation runner.

**Uncle Jesse uses:** Optional integration for structured deep link testing. Not yet integrated.

## What Uncle Jesse owns

- TVDevice interface (platform-agnostic)
- LiveElement, ElementCollection, TypedElementCollection (element proxies with assertions)
- BasePage, BaseComponent (page object model)
- SelectorEngine (platform-agnostic CSS-like selectors, needed for future non-Roku platforms)
- focusPath (chainable D-pad navigation builder)
- Visual replay debugger (screenshot + tree timeline viewer)
- RokuAdapter (orchestrates roku-ecp/roku-odc/roku-log, implements TVDevice)
- Custom focus chain walking (findFocusLeaf - needed because roku-ecp's findFocused returns first match, not leaf)
- Test-framework-level error types (TimeoutError with selector/tree context)
- RegistryState (builds launch params OR delegates to roku-odc)
- DevicePool (multi-device test distribution)
- CLI (test, discover, sideload commands)
- Reporters (console, JUnit, CTRF)
- Vitest plugin and fixtures

## Rules

- Never implement protocol-level communication. Use roku-ecp, roku-odc, or roku-log.
- Never duplicate polling/wait logic that exists in roku-ecp. Use their waitFor* helpers.
- If a roku-ecp function doesn't do what Uncle Jesse needs, ask Dane to add it upstream.
- Keep the SelectorEngine and error types in Uncle Jesse. They serve the framework, not the protocol.
- The RokuAdapter is the bridge. It translates TVDevice calls into roku-ecp/odc/log calls.
