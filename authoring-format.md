## Co-located templates in Angular via `.ng` files

`tsx` does not support Angular control flow/directives today, so co-located templates likely require an Angular DSL in `*.ng` files plus dedicated tooling/parser support.

This is not only syntax preference: if co-location becomes default, losing `templateUrl` would be a regression for some teams. The intent is co-location without weakening Angular's structural model.

Key goals:
- template and setup live in the same lexical scope,
- tooling and agents get stable structural markers (`component`, `directive`, `derivation`, `fragment`),
- bindings remain explicit and statically typed,
- provider declarations remain separate from setup/template logic,
- providers can depend on inputs, but not on setup-local variables.

This keeps the explicit contract model:
- `bindings` remain the canonical public API surface,
- Angular performs synchronization/wiring,
- strict checks happen at build time,
- `setup` runs once at component creation.

Interface conformance for `bindings` and `expose` stays opt-in via `satisfies`.

## Short Mode for Small Components (`defineBindings`) — Proposal Only

Exploratory only. Baseline remains explicit mode (`bindings` + `setup`).

Intent: reduce boilerplate in simple components by allowing `defineBindings(...)` inside `setup`, then hoisting to the same canonical binding metadata.

Benefits:
- less repetition in small components,
- bindings and template logic stay closer.

Costs:
- introduces a second authoring style,
- requires strict compiler extraction rules and diagnostics.

Scope (if adopted): only non-wrapper components without `providers`.

Allowed:
- `component({ setup })` + one top-level `defineBindings(...)` call.

Not allowed:
- `component.wrap<typeof Target>(...)`,
- `providers` in the same component.

### Compiler model (if adopted)
`defineBindings(...)` is extraction syntax, not runtime behavior:
- compiler extracts its object literal,
- extracted bindings become the same canonical metadata as `bindings: { ... }`,
- template/type checking/wiring behave exactly like explicit mode.

### Mandatory compiler errors (if adopted)
The compiler should error when:
- `bindings` and `defineBindings(...)` are both used,
- `defineBindings(...)` is called more than once,
- `defineBindings(...)` is not top-level in `setup` (inside conditionals/loops/nested functions),
- used in a wrapper component,
- used in a component with `providers`,
- destructured binding vars are reassigned,
- duplicate binding keys exist,
- framework-reserved binding names are explicitly declared (`children`, `attachments`),
- `defineBindings` is aliased/imported from user code instead of recognized as compiler intrinsic.

Optional stricter rule:
- disallow `async setup` with `defineBindings(...)` (or require extraction before first `await`) to keep extraction deterministic.

### Trade-off summary
This is a constrained convenience layer: explicit mode remains the default; short mode is opt-in for simple components. The gain is lower boilerplate, the cost is added format complexity.
