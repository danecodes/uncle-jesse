---
"@danecodes/uncle-jesse-core": patch
---

Fix `LiveElement.isStale()` so checking staleness no longer refreshes the cached element identity before comparing it.
