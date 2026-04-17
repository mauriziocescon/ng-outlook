# Bridging .ng Components to the Ivy Runtime

> **DISCLAIMER — Highly Speculative & Design Exercise**
> This document explores how the functional, signal-native `.ng` proposal maps onto the existing Angular Ivy engine. The runtime details and instruction names are approximations used for illustrative purposes and should not be treated as authoritative descriptions of Angular internals.

## Proposal Framing
* **Change Class:** what layer must change (`Compiler-only`, `Runtime-only`, `Compiler + Runtime`).
* **Delta from Ivy Today:** what is intentionally different from current behavior.

---

### 1. The "Fake Class" & Reactive Input Wiring
The `component()` utility returns a constructor-impersonator to satisfy the DI and Router systems.

* **Change Class:** Compiler + Runtime.
* **Shape:** The utility returns a plain JavaScript function that satisfies both the TypeScript compiler and the Angular runtime as if it were a class constructor.
* **Ivy Metadata:** The compiler attaches the standard static properties (`ɵcmp` for the component definition, `ɵfac` for the factory) directly to this function.
* **Factory Hijack:** When the Router or a template "instantiates" the component, the `ɵfac` factory function (a static property on the constructor, distinct from the `ɵɵ`-prefixed runtime instructions) is invoked, running the `setup()` closure and returning the `expose` object instead of a class instance.
* **Reactive Input Wiring:** During construction, the inputs defined in `bindings` are created as empty signal nodes (or initialized with their default values) — exactly like `input()` properties in a class constructor today. The `providers` and `setup` functions run immediately after, receiving signal *references* rather than resolved values. During the standard CD cycle’s creation-pass update phase, the parent template evaluates its expressions and pushes the actual values into these nodes.
* **Provider Lifecycle:**
  * **Synchronous read:** `useFactory: () => new Service(c())` — reads the initial/undefined state of `c`, just as an `input()` read inside a class constructor would before the first CD run.
  * **Signal reference:** `useFactory: () => new Service(c)` — by passing the signal itself, the service can safely react once CD pushes the actual value into the node.
* **Delta from Ivy Today:** The core data flow — Instantiation → CD push — is preserved from standard Ivy class components. Inputs are wired into the `setup` closure’s argument object rather than assigned to class instance properties. However, the entire class lifecycle protocol is removed: `ngOnChanges`, `ngOnInit`, ... no longer exist on the component instance. Post-binding notification (previously `ngOnChanges`) is replaced by signal reactivity; teardown is handled by `DestroyRef.onDestroy`; post-render work by `afterRenderEffect`. The `lView[CONTEXT]` slot, which today stores the class instance, instead stores the `expose` object returned by `setup()` — making the factory’s return value a plain object, not a class instance.

---

### 2. The "Logical Anchor" (Hostless Components)
Standard components require a physical DOM host. Hostless `.ng` components map to a **Logical Anchor**.

* **Change Class:** Runtime-only.
* **Mechanism:**
  1. **Anchor Instruction:** The parent template calls `ɵɵcomponentAnchor(index, ComponentDef)`. This creates a comment node (`<!-- -->`) in the DOM. The instruction is new, but the pattern is not: `ɵɵelementContainer` (`<ng-container>`) already produces a comment-backed `TNodeType.ElementContainer`; `ɵɵcomponentAnchor` would be a third member of that family, extended to carry a component view.
  2. **LView Boundary:** The "anchor" occupies exactly one slot in the parent `LView`.
  3. **Context Switching:** `enterView()` / `leaveView()` and the per-`LFrame` `selectedIndex` cursor are unchanged. The parent advances past the anchor with `ɵɵadvance(1)`; the child runs its own template function with its own cursor. This is not a new behavior — all components already get an independent cursor. The only change is that the anchor is a comment node instead of a real element.
* **Delta from Ivy Today:** Components are currently element-hosted (`TNodeType.Element`). Hostless mode introduces a comment-backed anchor (`TNodeType.ElementContainer`-like) that carries a component view. The cursor independence is not a delta — it is how Ivy already works for every component.

---

### 3. Component Boundaries & Encapsulation
* **Change Class:** Compiler + Runtime.
* **The `expose` Hijack:** During view creation, the `expose` object returned by `setup()` is stored at `lView[CONTEXT]`.
* **Reference Resolution:** Parent template refs (e.g., `<Comp #ref />`) resolve to this `expose` object. Component internals remain private.
* **Lifecycle:** Prototype-based hooks are replaced by DI-native APIs: `DestroyRef.onDestroy` for teardown, `afterRenderEffect` for post-render work (note: `afterNextRender` is browser-only and does not run in SSR).
* **Query Bridging (`ref` and `refMany`):** The legacy query instructions (`ɵɵqueryRefresh`, `ɵɵviewQuery`) are completely bypassed. When a template uses `ref={myRef}`, the compiler generates a lightweight instruction that pulls the child's `expose` object from `lView[CONTEXT]` and pushes it directly into the `myRef` signal. `refMany` simply appends to an array signal rather than walking a static query tree.
* **Delta from Ivy Today:** Ivy's query resolution engine resolves `@ViewChild`/`@ViewChildren` tokens by walking the view tree at creation time. `ɵɵqueryRefresh` is called on every CD pass and performs a tree-walk whenever the `QueryList` is marked dirty. The signal-push model is event-driven: a single compiler-generated instruction fires once at child-creation time, writing the `expose` object into the ref signal. No periodic refresh is needed.

---

### 4. Fragments and Lexical Scoping
Fragments are ng-templates with typed parameters.

* **Change Class:** Compiler + Runtime.
* **Mechanism:** A `@fragment` declaration compiles to a standard `ɵɵtemplate` instruction, producing an `LContainer` backed by a comment node — identical to `<ng-template>`. Each `@render(frag(args))` call site is also statically known at compile time, so the compiler pre-allocates the `LContainer` at the render site, exactly as it does for existing ng-template outlets. No dynamic container establishment is required.
* **Lexical Capture:** Fragments access `setup()` variables through the existing `declarationLView` mechanism: Ivy already renders every embedded view in the context of the LView where it was declared, giving the template function access to the surrounding scope. Fragments rely on this unchanged.
* **Typed Parameters:** The sole compiler addition over `<ng-template>` is static typing for context arguments — `@fragment menuItem(item: Item) { ... }` gives `item` a concrete TypeScript type. Today’s `ng-template` context is untyped by default (requiring `ngTemplateContextGuard` workarounds). This is a compiler-only change; the runtime instruction set is identical.
* **Memory Impact:** Increases memory allocation per instance (template functions are no longer singletons) because each `setup()` closure captures its own variables. This is the expected trade-off for lexical scoping.
* **Delta from Ivy Today:** The runtime is unchanged — `ɵɵtemplate`, `LContainer`, and `declarationLView` scoping all carry over as-is. The only delta is the typed-parameter contract enforced by the compiler, and the `@render(frag(args))` call syntax replacing `*ngTemplateOutlet` + untyped context object.

---

### 5. Derivations (`@derive`)
Template-scoped reactive computations with native DI support.

* **Change Class:** Runtime-only.
* **Mechanism:**
  1. **Slot Allocation:** When the compiler encounters `@derive price = simulation(...)` inside a template, it allocates a dedicated slot in the enclosing `LView` for the derivation.
  2. **Creation Pass:** During the embedded view’s creation pass, the runtime pushes an injection context (scoped to the current view’s injector) and calls the derivation’s `setup()` function. The `Signal<T>` returned by `setup()` is stored in the allocated `LView` slot.
  3. **Update Pass:** During change detection, the runtime reads the `Signal<T>` from the slot. The signal’s own reactive graph drives all further propagation — no additional polling or dirty-checking is required.
  4. **Lifecycle:** The derivation’s lifetime matches the enclosing embedded view. When the view is destroyed (e.g., the `@for` iteration is removed), the derivation is torn down with it.
* **Delta from Ivy Today:** The closest legacy analogue is a `Pipe` instance — pipes are also allocated per view slot and applied during the update pass. Pipes do support constructor DI and `inject()` fully (they run inside a `NodeInjector` context during the creation pass). However, pipes are not first-class participants in the signal reactive graph: they are not reactive consumers and cannot produce or track `Signal<T>` values as part of the graph. Derivations are signal-native memoization slots — the `Signal<T>` they return is a live reactive node, so downstream template expressions automatically re-evaluate when the derivation’s dependencies change, without any CD dirty-marking.

---

### 6. Directive Attachments (Instruction-Based Late Binding)
Allows directives to "tunnel" through hostless components without requiring global compiler knowledge.

* **Change Class:** Compiler + Runtime.
* **Compiler Responsibility:** The parent compiler generates a "Recipe" of directive instructions. It does NOT require the child component’s source to do this.
* **The "Sink" Contract:** The child defines an `attachable<T>` sink. The compiler only validates that the "Recipe" target type matches `T`.
* **Runtime Execution:**
  1. The parent pushes the "Recipe" into the component’s Logical Anchor.
  2. When the child hits `use:attachments()`, it triggers `ɵɵapplyAttachments`.
  3. The runtime "plays" the recipe on the local element, instantiating directives and wiring up their signals dynamically.
* **Optimization (Independent Compilation):** This enables 100% independent compilation. Components no longer need to know about the global directive registry; they only care about the instructions they receive at runtime.
* **Delta from Ivy Today:** Shifts directive matching and instantiation from a static build-time task to a dynamic runtime task, prioritizing build speed (HMR) and modularity over absolute creation-pass micro-optimizations.

---

### 7. Wrapper Components (`component.wrap`)
A compile-time macro for structurally wrapping an existing component.

* **Change Class:** Compiler-only.
* **Mechanism:** `component.wrap(Target, { bindings, setup })` is processed entirely at compile time. When the compiler encounters a wrapper, it:
  1. Resolves which bindings are explicitly declared in the wrapper’s own `bindings` block.
  2. Unrolls `{...rest}` spread syntax at compile time: each key in `rest` is mapped directly to the corresponding `InputSignal`, `ModelSignal`, `OutputEmitterRef`, `FragmentBinding`, or `AttachableBinding` reference on the `Target` component’s bindings. No intermediate JavaScript object is created and no runtime object spread is performed.
  3. For `AttachableBinding` keys included in `{...rest}`, the compiler passes them through intact to the target component, preserving the full directive attachment chain from parent → wrapper → target element. `ɵɵapplyAttachments` is emitted only at the target’s `use:attachments()` call site.
  4. The resulting generated instructions are identical to those the compiler would emit if every forwarded binding were listed explicitly — the wrapper introduces zero additional Ivy instructions at runtime.
* **Delta from Ivy Today:** Standard Angular has no spread syntax for forwarding component inputs. Developers must enumerate every forwarded binding manually, making wrapper components fragile when the wrapped component’s API changes. `component.wrap` formalizes a strict compile-time macro for structural wrapping: the Ivy runtime never observes a "wrapper object" and incurs no object-spread overhead.

---

### 8. Hostless Scoped CSS
Without a `:host` element, CSS encapsulation relies on **compiler-driven scoping** (similar to Svelte/Vue).

* **Change Class:** Compiler + Runtime (renderer behavior).
* **Mechanism:** The `.ng` compiler generates a unique attribute (e.g., `_ngcontent-c123`) and applies it to **every** DOM element in the component’s template.
* **ShadowDom Constraint:** Hostless components are incompatible with `ViewEncapsulation.ShadowDom` because there is no concrete host element to own a shadow root.
* **External Styling:** A parent cannot decorate a hostless component automatically. Styling intent (`class`, `style`) must be explicitly declared as `input` signals in the `bindings` block.
* **Diagnostic Safety:** If a parent applies a `class` to a hostless component that hasn’t opted in via `bindings`, the compiler emits a diagnostic error.
* **Delta from Ivy Today:** Current emulated encapsulation uses both host/content attributes; hostless mode needs a hostless scoping contract.
* **Compatibility Impact:** Medium/High — influences style encapsulation, SSR serialization, and hydration style reconciliation.

---

## Comparison: Legacy vs. Functional Model

| Concept | Legacy Class Model | Functional `.ng` Model |
| :--- | :--- | :--- |
| **Input Timing** | Inputs uninitialized in the constructor; values pushed by CD after instantiation. | Inputs wired as signal nodes at instantiation; references available in `setup` and `providers`; values pushed by CD on the update pass — same flow as class components. |
| **Lifecycle Hooks** | `ngOnChanges`, `ngOnInit`, `ngDoCheck`, `ngAfterContent*`, `ngAfterView*`, `ngOnDestroy` on the class instance. | Entirely removed. Signal reactivity replaces `ngOnChanges`; `DestroyRef.onDestroy` replaces `ngOnDestroy`; `afterRenderEffect` replaces `ngAfterViewInit`. `lView[CONTEXT]` stores the `expose` object, not a class instance. |
| **Host Element** | Implicitly required (physical tag). | Absent by default (comment node anchor). |
| **Instruction Cursor** | Sequential `ɵɵadvance` on host. | Parent `ɵɵadvance` treats component as 1 slot; Child has a fresh cursor. |
| **Public API** | Entire class instance exposed via template ref. | Only the `expose` object is accessible; internals remain private. |
| **Projection** | Implicitly handled by `<ng-content>`. | Passed as fragments in `children` and called as functions. |
| **Directives** | Automatically attach to the host element. | Collected in the Attachment Bag and forwarded via `use:attachments()`. |
| **CSS Scoping** | Tied to the physical host attribute. | Applied to all template elements via compiler-generated attributes. |
| **Template Queries** | `@ViewChild`/`@ViewChildren` resolved by a tree-walk; refreshed via `ɵɵqueryRefresh` every CD cycle. | Signal-push via `ref`/`refMany`; `expose` written once at child creation — no periodic refresh. |
| **Transform / Memoization** | `Pipe` instances per view slot; limited DI access and no signal reactivity. | `derivation` slots with full native DI; driven directly by the signal reactive graph. |
| **Component Wrapping** | Manual enumeration of every forwarded binding; no spread syntax. | Compile-time macro (`component.wrap`); `{...rest}` unrolled by the compiler with zero runtime overhead. |
