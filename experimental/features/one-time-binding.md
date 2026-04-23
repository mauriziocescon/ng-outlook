# One-Time Binding

Two mechanisms for values that are read once and never updated.

## 1. Consumer side: `once:` prefix

The consumer freezes a binding at its initial value, regardless of how the target declared the input. This is template-level: the target still declares a normal `input()`, while codegen treats the specific binding as one-time.

```ts
import { component, signal } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  setup: () => {
    const user = signal<User>({ name: 'Alice', role: 'admin' });
    const email = signal('alice@example.com');

    function makeAdmin() {/** ... **/}

    /**
     * once:user — evaluated once at creation, never updated.
     * email and makeAdmin remain reactive.
     *
     * Cannot combine once: with model: on the same binding.
     * ‼️ <UserDetail once:model:email={email} /> ‼️
     *
     * Cannot duplicate: once: and reactive on the same name.
     * ‼️ <UserDetail once:user={...} user={...} /> ‼️
     */
    return (
      <UserDetail
        once:user={user()}
        model:email={email}
        on:makeAdmin={makeAdmin} />
    );
  },
});
```

### Shorthand

The name-matching shorthand works with `once:` — same rules as other prefixes:

```ts
<UserDetail once:{user} model:{email} on:{makeAdmin} />
```

### Compiler behavior

When the consumer writes `once:user={user()}`, the compiler:
1. emits the value in the `ɵɵcomponentAnchor` seed (creation pass),
2. **skips** emitting `ɵɵproperty('user', ...)` in the update pass.

The target `InputSignal<User>` is written once through the normal input-write path and never written again. No runtime flag or special signal variant is needed.

### Interaction with directives and derivations

`once:` can also be used on directive bindings inside `use:`:

```ts
<input
  type="text"
  use:tooltip(once:message={initialMsg()}) />
```

The directive's `input.required<string>()` for `message` is seeded once and never updated.

Derivations are also supported: when a value passed into an `@derive` usage is marked with `once:`, that derivation input is frozen at creation time and not updated afterward.

---

## 2. Declaration side: `input.once<T>()`

The author declares that an input is creation-time only. In `setup`, the binding is exposed as plain `T` (not `InputSignal<T>`).

```ts
import { component, input, signal } from '@angular/core';

export const Panel = component({
  bindings: {
    /**
     * input.once<T>()       — optional, T | undefined
     * input.once<T>(default) — optional with default
     * input.once.required<T>() — required
     *
     * Produces a plain T in setup (not a signal).
     */
    title: input.once.required<string>(),
    collapsible: input.once<boolean>(true),
    mode: input<'light' | 'dark'>('light'),
  },
  setup: ({ title, collapsible, mode }) => {
    // title: string            — plain value, read once
    // collapsible: boolean     — plain value, read once (default: true)
    // mode: InputSignal<...>   — reactive as usual

    const open = signal(collapsible);

    return (
      <div class={mode()}>
        <h2>{title}</h2>
        @if (collapsible) {
          <button on:click={() => open.update(v => !v)}>Toggle</button>
        }
      </div>
    );
  },
});
```

### Runtime / compiler behavior

For `input.once`, codegen follows the same pattern: seed in `ɵɵcomponentAnchor`, skip update-pass `ɵɵproperty` writes.

```
// creation pass only — no update-pass instruction emitted
ɵɵcomponentAnchor(0, Panel, ['title', ctx.title(), 'collapsible', true]);
// ɵɵproperty('title', ...) is NOT emitted
// ɵɵproperty('mode', ...) IS emitted (regular input)
```

Semantics: write once at creation, then treat as constant. `setup` sees plain `T`; `providers` can still use an input-like read API (`title()` in examples).

### Use in providers

`OnceInput` keys appear in `providers` like regular inputs:

```ts
import { component, input, provide, inject } from '@angular/core';

class PanelService {
  constructor(readonly title: string) {}
}

export const Panel = component({
  bindings: {
    title: input.once.required<string>(),
  },
  setup: () => {
    const svc = inject(PanelService);
    return (<div>{svc.title}</div>);
  },
  providers: ({ title }) => [
    // title is OnceInput<string> here — read once via title()
    provide({ token: PanelService, useFactory: () => new PanelService(title()) }),
  ],
});
```

### Use in directives and derivations

`input.once` is also valid at directive level. A directive can declare creation-time-only configuration inputs the same way a component does; they are seeded once and not updated afterward.

Derivations are also supported: they do declare input `bindings`, so they can use `input.once(...)` for creation-time-only derivation inputs.

### Type-level integration

A branded `OnceInput<T>` extends `BindingValue`. In `setup`, `OnceInput<T>` is unwrapped to `T`.

```ts
declare const ONCE_INPUT: unique symbol;

// Branded type distinct from InputSignal
export type OnceInput<T> = { readonly [ONCE_INPUT]: T };

// Extended BindingValue union
export type BindingValue =
  | InputSignal<any>
  | OnceInput<any>        // ← new
  | ModelSignal<any>
  | OutputEmitterRef<any>
  | FragmentBinding<any>
  | AttachableBinding<any>;
```

`InputsOnly<B>` (used by `providers`) includes `OnceInput` keys:

```ts
type InputKeys<B> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never
    : B[K] extends InputSignal<any> ? K
    : B[K] extends OnceInput<any> ? K    // ← new
    : never;
}[keyof B];
```

The `setup` signature unwraps `OnceInput<T>` to `T`:

```ts
// Compiler-resolved type mapping for setup parameter
type ResolveBinding<V> =
  V extends OnceInput<infer T> ? T :    // unwrap to plain value
  V;                                     // InputSignal, ModelSignal, etc. pass through
```

---

## Interaction between `once:` and `input.once`

| Declaration | Consumer | Result |
| :--- | :--- | :--- |
| `input<T>()` | `prop={expr}` | Reactive (normal) |
| `input<T>()` | `once:prop={expr}` | One-time (consumer freezes it) |
| `input.once<T>()` | `prop={expr}` | One-time (declaration enforces it) |
| `input.once<T>()` | `once:prop={expr}` | One-time (redundant but valid — no error) |
| `model<T>()` | `once:model:prop={sig}` | ‼️ Compile error — models are inherently two-way |

---

## Constraints and diagnostics

| Rule | Diagnostic |
| :--- | :--- |
| `once:` + `model:` on the same binding | Compile error: models are two-way, one-time is contradictory |
| `once:` + `on:` on the same binding | Compile error: outputs are event emitters, not inputs |
| `once:prop` and `prop` on the same element | Compile error: duplicate binding name |
| `input.once` receives later parent changes | No error — ignored by contract (value is creation-time only) |
| `once:prop` / `input.once.required` without an initial value | Required-input diagnostic at creation (same behavior as existing required inputs) |
| `input.once` in directive bindings | Valid — once-inputs act as fixed configuration values |
| `input.once` in `@derive` bindings | Valid — derivations support input bindings, including once-inputs |
| `once:` on a `fragment` binding | Compile error: fragments are structural, not value bindings |
| `once:` on an `attachable` binding | Compile error: attachable is framework-managed |

---

## Ivy bridge considerations

One-time binding needs no new runtime instructions; it is a **compiler-only** change:

- **Creation pass**: reuse existing eager seed path (`ɵɵcomponentAnchor`).
- **Update pass**: omit `ɵɵproperty` for once-bound inputs (codegen decision, no runtime branch).
- **Declaration-side lowering**: `input.once` may be lowered to plain values for `setup`, while keeping compatible reads where needed (for example in `providers`).

**Change Class:** Compiler-only.
