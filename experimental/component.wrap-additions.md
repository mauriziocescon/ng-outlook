# Wrapper API Shaping (`addBindings` / `omitBindings`)

This proposal evolves `component.wrap` so wrappers can expose a curated API while preserving current compile-time forwarding guarantees.

> Status: proposal only. This document describes a possible evolution and is not implemented in `experimental/types.ts` yet.

## Conventions

Normative keywords in this document follow RFC-style meaning:

- `MUST` / `MUST NOT`: mandatory behavior.
- `SHOULD` / `SHOULD NOT`: recommended behavior with possible justified exceptions.
- `MAY`: optional behavior.

## Summary

Today, `component.wrap(Target, ...)` mirrors target bindings (with optional overrides), and setup receives an opaque `forwarded` forwarding token in `setup(bindings, { forwarded })`. In templates, `@forward(forwarded)` forwards target-compatible bindings at compile time.

This evolution adds two capabilities:

1. `addBindings`: wrapper-local bindings not present on the target.
2. `omitBindings`: hide selected target bindings from the wrapper public API.

The primary constraint is preserving target soundness. Added bindings are never treated as implicit target bindings.

All practical scenarios described here are achievable today with a pure façade component (`component(...)`) that explicitly maps bindings to the target. This evolution mainly optimizes ergonomics when only one or two bindings need to be adjusted, hidden, or renamed on top of a large target API.

---

## Proposed API

Examples below use proposal syntax and are not type-checked against the current `experimental/types.ts`.

```ts
export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
  },
  setup: ({ user, email, makeAdmin, children }) => (...),
});

export const EnterpriseUser = component.wrap(UserDetail, {
  omitBindings: {
    email: true,
    makeAdmin: true,
  },
  addBindings: {
    contactEmail: model.required<string>(),
    readOnly: input<boolean>(true),
  },
  setup: (bindings, { forwarded }) => (
    <UserDetail
      @forward(forwarded)
      model:email={bindings.contactEmail}
      on:makeAdmin={() => {
        if (!bindings.readOnly()) {
          // internal policy
        }
      }} />
  ),
});
```

### Why object form for `omitBindings`

A typed marker object is used instead of string arrays:

```ts
omitBindings: {
  email: true,
  makeAdmin: true,
}
```

Benefits:

- autocomplete on valid keys,
- rename-safe in editors,
- no `as const` tuple ergonomics,
- easier structural validation in type space.

---

## Type-Level Shape

The types below are **proposed** shapes for this evolution, not current source-of-truth declarations.

```ts
type OmitMap<B> = Partial<Record<Extract<keyof B, string>, true>>;

type KeysMarkedTrue<M> = {
  [K in keyof M]: M[K] extends true ? K : never
}[keyof M];

type EffectiveBindings<
  C extends ComponentInstance<any, any>,
  Added extends Record<string, ComponentBindingValue>,
  OmitM extends OmitMap<TargetBindings<C>>
> = Omit<TargetBindings<C>, KeysMarkedTrue<OmitM>> & Added;

type ForwardableTargetBindings<
  C extends ComponentInstance<any, any>,
  OmitM extends OmitMap<TargetBindings<C>>
> = Omit<TargetBindings<C>, KeysMarkedTrue<OmitM>>;
```

`wrap` config sketch:

This is a **proposed** extension of `component.wrap`, not the current signature in `experimental/types.ts`.

```ts
export declare function wrap<
  C extends ComponentInstance<any, any>,
  Added extends Record<string, ComponentBindingValue> = {},
  OmitM extends OmitMap<TargetBindings<C>> = {},
  E = void
>(
  target: C,
  config: {
    omitBindings?: OmitM;
    addBindings?: Added;
    bindings?: Partial<Omit<TargetBindings<C>, KeysMarkedTrue<OmitM>>>;
    setup: (
      b: SetupBindings<EffectiveBindings<C, Added, OmitM>>,
      context: { forwarded: ForwardedToken<ForwardableTargetBindings<C, OmitM>> }
    ) => SetupReturn<E>;
    providers?: (inputs: InputsOnly<EffectiveBindings<C, Added, OmitM>>) => Provider[];
    style?: string;
    styleUrl?: string;
  }
): ComponentInstance<EffectiveBindings<C, Added, OmitM>, E>;
```

Notes:

- `bindings` still means target binding overrides only.
- `addBindings` is separate to avoid ambiguity.
- `setup` sees target-minus-omitted plus added as the first argument.
- `context.forwarded` is an opaque forwarding token for target-minus-omitted bindings only.

---

## Compiler Lowering

Given:

```ts
component.wrap(Target, {
  omitBindings: { x: true },
  addBindings: { y: input.required<number>() },
  setup: (bindings, { forwarded }) => (
    <Target @forward(forwarded) x={bindings.y()} />
  ),
});
```

Compiler contract:

1. The compiler `MUST` build the target-forwardable key set as `keyof Target` minus omitted keys.
2. The compiler `MUST` lower `@forward(forwarded)` by unrolling only that key set.
3. The compiler `MUST NOT` include `addBindings` keys in target forwarding.
4. The compiler `MUST` keep existing explicit-binding precedence (React-style last wins).
5. The compiler `SHOULD` preserve attachable passthrough chain for forwardable attachable keys.
6. The compiler `MUST` treat `forwarded` as opaque: no property reads, enumeration, or JS destructuring with spread.
7. The compiler `MUST` reject `@forward(forwarded)` on non-component elements.

No runtime forwarding object is required; the same strategy as current `component.wrap` is retained.

---

## Examples

The examples below are in wrapper form because they show the intended ergonomics directly. Each can also be implemented today using a pure façade component with explicit mapping.

### 1. Corporate defaults + hidden unsafe knobs

```ts
export const ThirdPartyGrid = component({
  bindings: {
    rows: input.required<Row[]>(),
    columns: input.required<Column[]>(),
    density: input<'compact' | 'comfortable'>('comfortable'),
    debugMode: input<boolean>(false),
    unsafeHtml: input<boolean>(false),
    theme: input<'default' | 'corporate'>('default'),
    rowClick: output<Row>(),
  },
  setup: ({ rows, columns, density, debugMode, unsafeHtml, theme, rowClick }) => (...),
});

export const CorpGrid = component.wrap(ThirdPartyGrid, {
  omitBindings: {
    debugMode: true,
    unsafeHtml: true,
    theme: true,
  },
  addBindings: {
    corporateDensity: input<'compact' | 'comfortable'>('compact'),
  },
  setup: (bindings, { forwarded }) => (
    <ThirdPartyGrid
      @forward(forwarded)
      debugMode={false}
      unsafeHtml={false}
      theme={'corporate'}
      density={bindings.corporateDensity()} />
  ),
});
```

### 2. API rename façade

```ts
export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
  },
  setup: ({ user, email, makeAdmin }) => (...),
});

export const UserProfile = component.wrap(UserDetail, {
  omitBindings: {
    email: true,
  },
  addBindings: {
    contactEmail: model.required<string>(),
  },
  setup: (bindings, { forwarded }) => (
    <UserDetail @forward(forwarded) model:email={bindings.contactEmail} />
  ),
});
```

### 3. Wrapper-local behavior flag (not forwarded)

```ts
export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
  },
  setup: ({ user, email, makeAdmin }) => (...),
});

export const UserCard = component.wrap(UserDetail, {
  addBindings: {
    highlight: input<boolean>(false),
  },
  setup: (bindings, { forwarded }) => (
    <section class:highlight={bindings.highlight()}>
      <UserDetail @forward(forwarded) />
    </section>
  ),
});
```

---

## Constraints and Diagnostics

| Rule | Diagnostic |
| :--- | :--- |
| `omitBindings` contains an unknown target key | `WRAP001` — invalid omitted key |
| `omitBindings` marks a key with non-`true` value | `WRAP002` — omit marker must be literal `true` |
| `addBindings` reuses an existing target key | `WRAP003` — duplicate binding key |
| `addBindings` key appears in target-forwarded `@forward(forwarded)` | `WRAP004` — wrapper-local binding cannot be forwarded implicitly |
| Omitted key is still consumed from wrapper call-site | `WRAP005` — binding is not part of wrapper public API |
| `bindings` includes an omitted key | `WRAP006` — cannot override omitted target key |
| Omitted required target input is not set internally | `WRAP007` — required target input missing |
| `forwarded` is inspected (`forwarded.foo`, `Object.keys(forwarded)`, etc.) | `WRAP008` — forwarded token is opaque |
| JS destructuring with spread used to derive forwarding (`...forwarded` in setup params) | `WRAP009` — use `context.forwarded` token instead |
| `@forward(forwarded)` used on non-component elements | `WRAP010` — forwarding token can only target component elements |

---

## Migration and Compatibility

This can be introduced as a backward-compatible extension:

- Existing wrappers without `addBindings` / `omitBindings` behave exactly the same.
- Existing compiler lowering of `@forward(forwarded)` is unchanged unless `omitBindings` is present.
- Type-level changes are additive.
- Setup parameter style remains token-based (`setup(bindings, { forwarded })`); parameter destructuring with spread is not part of the model.

---

## Ivy bridge considerations

`addBindings` / `omitBindings` is primarily a **compiler + type-system** evolution.

- **Type system** computes effective wrapper API.
- **Compiler** adjusts key expansion set for `@forward(forwarded)`, enforces non-forwarding of wrapper-local keys, keeps `forwarded` as an opaque token (`ForwardedToken` branded by `FORWARDED`), and rejects `@forward(forwarded)` on non-component elements.
- **Runtime** remains unchanged in principle; generated instructions stay in the same class as those emitted today.

**Change Class:** Compiler + Type-level (no new runtime primitive).
