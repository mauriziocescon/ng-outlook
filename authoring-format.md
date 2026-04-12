## Co-located templates in Angular via `.ng` files

`tsx` grammar does not support Angular control flow/directives today, so a realistic path for co-located templates is an Angular-specific DSL in `*.ng` files, backed by custom parsing/tooling (for example, Volar-style language support).

This is not just a syntax preference. If Angular moves toward co-located templates, losing the option of separate templates (`templateUrl`) would be a real regression for some teams. The point of `.ng` files is to enable co-location without collapsing Angular's structural clarity into a loose runtime pattern.

The design goal is to keep what works in Angular while improving authoring ergonomics:
- template and setup live in the same lexical scope,
- tooling and agents get stable structural markers (`component`, `directive`, `derivation`, `fragment`),
- bindings remain explicit and statically typed,
- provider declarations remain separate from setup/template logic,
- providers can depend on inputs, but not on setup-local variables.

This preserves Angular's explicit contract model:
- `bindings` remain the canonical public API surface,
- Angular performs synchronization/wiring,
- strict checks happen at build time,
- `setup` runs once at component creation.

Interface conformance for `bindings` and `expose` stays opt-in via `satisfies`, mirroring structural checks similar to `implements` but without forcing inheritance-style patterns.

## Short Mode for Small Components (`defineBindings`)

For small components, `bindings + setup` can feel repetitive. A short mode can reduce boilerplate while preserving the same compile-time guarantees.

### Intent
Allow binding declaration inside `setup` via a compiler intrinsic (e.g. `defineBindings(...)`), then hoist it to the canonical component binding contract.

### Scope
Short mode is only for components that are not wrappers and do not use providers.

Allowed:
- `component({ setup })` + one top-level `defineBindings(...)` call.

Not allowed:
- `component.wrap<typeof Target>(...)`,
- `providers` in the same component.

### Compiler model
`defineBindings(...)` is extraction syntax, not runtime behavior:
- compiler extracts its object literal,
- extracted bindings become the same canonical metadata as `bindings: { ... }`,
- template/type checking/wiring behave exactly like explicit mode.

### Mandatory compiler errors
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
This design intentionally splits use cases:
- explicit mode remains the default for wrappers, providers, and advanced composition,
- short mode is limited to simple components where boilerplate reduction matters most.

The constraint set is deliberate:
- contracts remain explicit after compiler extraction,
- wrapper/provider invariants are not relaxed,
- tooling and type-checking still operate on one canonical binding model.

Net effect:
- less authoring overhead in small components,
- no semantic divergence in generated metadata or template checks.
