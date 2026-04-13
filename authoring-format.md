## Co-located templates in Angular via `.ng` files

`tsx` does not support Angular control flow/directives today, so co-located templates likely require an Angular DSL in `*.ng` files plus dedicated tooling/parser support.

This is not only syntax preference: if co-location becomes default, losing `templateUrl` would be a regression for some teams. The intent is co-location without weakening Angular's structural model.

Key goals:
- template and setup live in the same lexical scope,
- tooling and agents get stable structural markers (`component`, `directive`, `derivation`, `fragment`),
- bindings remain explicit and statically typed,
- provider declarations remain separate from setup/template logic,
- providers can depend on inputs, but not on setup-local variables,
- component internals stay private — only what `expose` returns is reachable through `ref`.

This keeps the explicit contract model:
- `bindings` remain the canonical public API surface,
- Angular performs synchronization/wiring,
- strict checks happen at build time,
- `setup` runs once at component creation.

Interface conformance for `bindings` and `expose` stays opt-in via `satisfies`.

### Boilerplate tax — a known trade-off

Declaring a binding and then destructuring it in `setup` feels redundant for small components. This is a known tax of the format.

```ts
// Tiny — the tax is visible: ~5 lines of bindings for ~3 lines of logic
export const Badge = component({
  bindings: {
    label: input.required<string>(),
    variant: input<'info' | 'warn'>('info'),
  },
  setup: ({ label, variant }) => ({
    template: (
      <span class={variant()}>{label()}</span>
    ),
  }),
});

// Medium — the same tax is a small fraction of the overall code
export const DataTable = component({
  bindings: {
    rows: input.required<Row[]>(),
    selected: model<Row | null>(),
    sort: output<SortEvent>(),
    rowTemplate: fragment<[Row]>(),
  },
  setup: ({ rows, selected, sort, rowTemplate }) => {
    const sorted = linkedSignal(() => defaultSort(rows()));
    const filter = signal('');
    const filtered = computed(() => applyFilter(sorted(), filter()));
    // ... 30+ lines of logic, handlers, derived state
    return { template: (...) };
  },
});
```

For medium and large components the binding declaration is a small fraction of the code, and the explicit contract pays for itself in readability, refactorability, and tooling support.

Three additional points:
- **Fairer comparison with other frameworks.** In React or Solid with TypeScript you typically write a separate `Props` interface that mirrors the component's accepted inputs — pure type-level boilerplate. Here, `bindings` serves double duty as both the type declaration *and* the runtime wiring. Counting the `Props` interface other frameworks require makes the math considerably more even.
- **Multi-component co-location.** Traditional SFCs (Vue, Svelte, etc.) map one component to one file. Splitting a growing component means creating a new file, moving markup, wiring imports, and updating the module graph — even for small, tightly coupled pieces. `.ng` files let you define helper components, fragments, and directives in the same file and extract them only when they earn their own module boundary.
- **Why not `defineBindings(...)` inside `setup`?** It would reduce repetition, but `providers` needs input access *before* `setup` runs — so it would require compiler hoisting magic or giving up input access in providers. It also introduces a second authoring style (à la Vue Options vs. Composition API) that tooling, docs, and developers all have to support.

One authoring format — explicit bindings — keeps the mental model simple — for humans and AI agents alike.
