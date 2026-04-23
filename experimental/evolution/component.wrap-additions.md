# Wrapper API Shaping (`addBindings` / `omitBindings`)

It is proposed that `component.wrap` be evolved so that wrappers can expose a curated API while preserving current compile-time forwarding guarantees.

## Goal

It is observed that `component.wrap(Target, ...)` currently mirrors target bindings (with optional overrides), and that `{...rest}` forwards target-compatible bindings at compile time.

Two additional capabilities are proposed:

1. `addBindings`: wrapper-local bindings not present on the target.
2. `omitBindings`: hide selected target bindings from the wrapper public API.

The primary constraint is that target soundness should not be weakened. Added bindings should never be treated as implicit target bindings.

It should also be noted that all practical scenarios described in this document are achievable today by implementing a pure façade component (`component(...)`) that explicitly maps bindings to the target. The present evolution is intended mainly for cases in which one or two bindings need to be adjusted, hidden, or renamed on top of a large target API, while preserving current wrapper ergonomics.

---

## Proposed API

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
    contactEmail: input.required<string>(),
    readOnly: input<boolean>(true),
  },
  setup: ({ contactEmail, readOnly, ...rest }) => (
    <UserDetail
      {...rest}
      model:email={contactEmail}
      on:makeAdmin={() => {
        if (!readOnly()) {
          // internal policy
        }
      }} />
  ),
});
```

### Why object form for `omitBindings`

It is proposed that a typed marker object be used instead of string arrays:

```ts
omitBindings: {
  email: true,
  makeAdmin: true,
}
```

The following benefits are expected:

- autocomplete on valid keys,
- rename-safe in editors,
- no `as const` tuple ergonomics,
- easier structural validation in type space.

---

## Type-level shape

```ts
type OmitMap<B> = Partial<Record<Extract<keyof B, string>, true>>;

type KeysMarkedTrue<M> = {
  [K in keyof M]: M[K] extends true ? K : never
}[keyof M];

type EffectiveBindings<
  C extends ComponentInstance<any, any>,
  Added extends Record<string, BindingValue>,
  OmitM extends OmitMap<TargetBindings<C>>
> = Omit<TargetBindings<C>, KeysMarkedTrue<OmitM>> & Added;
```

`wrap` config sketch:

```ts
export declare function wrap<
  C extends ComponentInstance<any, any>,
  Added extends Record<string, BindingValue> = {},
  OmitM extends OmitMap<TargetBindings<C>> = {},
  E = void
>(
  target: C,
  config: {
    omitBindings?: OmitM;
    addBindings?: Added;
    bindings?: Partial<Omit<TargetBindings<C>, KeysMarkedTrue<OmitM>>>;
    setup: (b: SetupBindings<EffectiveBindings<C, Added, OmitM>>) => SetupReturn<E>;
    providers?: (inputs: InputsOnly<EffectiveBindings<C, Added, OmitM>>) => Provider[];
    style?: string;
    styleUrl?: string;
  }
): ComponentInstance<EffectiveBindings<C, Added, OmitM>, E>;
```

It is intended that:

- `bindings` still means "target binding overrides" only.
- `addBindings` is separate to avoid ambiguity.
- `setup` sees target-minus-omitted plus added.

---

## Lowering / compiler behavior

Given:

```ts
component.wrap(Target, {
  omitBindings: { x: true },
  addBindings: { y: input.required<number>() },
  setup: ({ y, ...rest }) => <Target {...rest} />,
});
```

The compiler contract would be:

1. Build target-forwardable key set = `keyof Target` minus omitted keys.
2. Lower `{...rest}` by unrolling only that key set.
3. Never include `addBindings` keys in target forwarding.
4. Keep existing explicit-binding precedence (React-style last wins).
5. Preserve attachable passthrough chain for forwardable attachable keys.

No runtime spread object would be required; the same strategy as current `component.wrap` would be retained.

---

## Examples

The examples below are presented in wrapper form because they demonstrate the ergonomics targeted by this evolution. It is acknowledged that each of these examples can already be implemented today using a pure façade component with explicit mapping.

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
  setup: ({ corporateDensity, ...rest }) => (
    <ThirdPartyGrid
      {...rest}
      debugMode={false}
      unsafeHtml={false}
      theme={'corporate'}
      density={corporateDensity()} />
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
    contactEmail: input.required<string>(),
  },
  setup: ({ contactEmail, ...rest }) => (
    <UserDetail {...rest} model:email={contactEmail} />
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
  setup: ({ highlight, ...rest }) => (
    <section class:highlight={highlight()}>
      <UserDetail {...rest} />
    </section>
  ),
});
```

---

## Constraints and diagnostics

| Rule | Diagnostic |
| :--- | :--- |
| `omitBindings` contains unknown target key | Compile error: invalid omitted key |
| `omitBindings` marks a key with non-`true` value | Compile error: omit marker must be literal `true` |
| `addBindings` reuses existing target key | Compile error: duplicate binding key |
| `addBindings` key appears in target-forwarded `{...rest}` | Compile error: wrapper-local binding cannot be forwarded implicitly |
| Omitted key still consumed from wrapper call-site | Compile error: binding is not part of wrapper public API |
| `bindings` includes omitted key | Compile error: cannot override omitted target key |
| Omitted required target input not set internally | Compile error at wrapper template call to target (required input missing) |

---

## Migration and compatibility

It is expected that this can be introduced as a backward-compatible extension:

- Existing wrappers without `addBindings` / `omitBindings` behave exactly the same.
- Existing compiler lowering of `{...rest}` is unchanged unless `omitBindings` is present.
- Type-level changes are additive.

---

## Ivy bridge considerations

`addBindings` / `omitBindings` is primarily a **compiler + type-system** evolution.

- **Type system** computes effective wrapper API.
- **Compiler** adjusts key expansion set for `{...rest}` and enforces non-forwarding of wrapper-local keys.
- **Runtime** would remain unchanged in principle; generated instructions would remain in the same class as those emitted today.

**Change Class:** Compiler + Type-level (no new runtime primitive).
