# Bridging .ng Components to the Ivy Runtime

> **DISCLAIMER — Highly Speculative & Design Exercise**
> This document explores how the functional, signal-native `.ng` proposal maps onto the existing Angular Ivy engine. The runtime details and instruction names are approximations used for illustrative purposes and should not be treated as authoritative descriptions of Angular internals.

This document explores how the functional, signal-native `.ng` proposal could map onto the existing Angular Ivy engine — potentially maintaining strict component boundaries, enabling hostless rendering, and preserving interoperability with legacy class-based components.

## Proposal Framing
* **Change Class:** what layer must change (`Compiler-only`, `Runtime-only`, `Compiler + Runtime`).
* **Delta from Ivy Today:** what is intentionally different from current behavior.
* **Compatibility Impact:** where migration risk is concentrated.

---

### 1. The "Fake Class" & Eager Binding Resolution
The `component()` utility returns a constructor-impersonator to satisfy the DI and Router systems.

* **Change Class:** Compiler + Runtime.
* **The Binding Pre-pass:** To ensure inputs are available in `setup()` and `providers()`, the runtime implements **Eager Binding Resolution**.
* **Mechanism:** Before calling the child’s factory (`ɵfac`), the runtime evaluates the parent’s expressions for that component and hydrates the `input` signals.
* **Provider Lifecycle:** The `providers` function executes exactly once during the creation pass.
  * **Static Injection:** `useFactory: () => new Service(c())` — The service receives the value of `c` at the moment of creation. It will **not** update if `c` changes.
  * **Reactive Injection:** `useFactory: () => new Service(c)` — By passing the signal itself, the service can create `computed` values or `effect`s that react to changes in the component’s input.
* **Delta from Ivy Today:** Ivy typically pushes inputs *after* instantiation. This bridge moves input synchronization to the "Pre-Construction" phase.

---

### 2. The "Logical Anchor" (Hostless Components)
Standard components require a physical DOM host. Hostless `.ng` components map to a **Logical Anchor**.

* **Change Class:** Runtime-only.
* **Mechanism:**
  1. **Anchor Instruction:** The parent template calls `ɵɵcomponentAnchor(index, ComponentDef)`. This creates a comment node (``) in the DOM.
  2. **LView Boundary:** The "anchor" occupies exactly one slot in the parent `LView`.
  3. **Automatic Context Switching:** Ivy’s native `enterView()` and `leaveView()` handle the instruction cursor. The parent simply "steps over" the anchor via `ɵɵadvance(1)`. The child manages its own internal `ɵɵadvance` indexing. The child’s internal DOM size never leaks into the parent’s cursor math.
* **Delta from Ivy Today:** Components are currently element-hosted; hostless mode uses a structural anchor that behaves like a permanent view container.

---

### 3. Component Boundaries & Encapsulation
* **Change Class:** Compiler + Runtime.
* **The `expose` Hijack:** During view creation, the `expose` object returned by `setup()` is stored at `lView[CONTEXT]`.
* **Reference Resolution:** Parent template refs (e.g., `<Comp #ref />`) resolve to this `expose` object. Component internals remain private.
* **Lifecycle:** Prototype-based hooks (`ngOnInit`) are replaced by DI-native APIs like `afterNextRender` and `DestroyRef`.

---

### 4. Fragments and Lexical Scoping
Fragments capture the `setup()` scope via JS closures.

* **Change Class:** Compiler-only.
* **Lexical Capture:** `ngtsc` ensures fragment functions are generated *inside* the `setup()` closure rather than being hoisted.
* **Memory Impact:** Increases memory allocation per instance (functions are no longer singletons) but allows templates to directly access signals and variables from `setup()`.
* **Execution:** Calling a fragment (for example `children()`) runs standard `ɵɵtemplate`-based embedded view execution.

---

### 5. Directive Attachments (Instruction-Based Late Binding)
Allows directives to "tunnel" through hostless components without requiring global compiler knowledge.

* **Change Class:** Compiler + Runtime.
* **Compiler Responsibility:** The parent compiler generates a "Recipe" of directive instructions. It does NOT require the child component's source to do this.
* **The "Sink" Contract:** The child defines an `attachable<T>` sink. The compiler only validates that the "Recipe" target type matches `T`.
* **Runtime Execution:** 1. The parent pushes the "Recipe" into the component's Logical Anchor.
  2. When the child hits `use:attachments()`, it triggers `ɵɵapplyAttachments`.
  3. The runtime "plays" the recipe on the local element, instantiating directives and wiring up their signals dynamically.
* **Optimization (Independent Compilation):** This enables 100% independent compilation. Components no longer need to know about the global directive registry; they only care about the instructions they receive at runtime.
* **Delta from Ivy Today:** Shifts directive matching and instantiation from a static build-time task to a dynamic runtime task, prioritizing build speed (HMR) and modularity over absolute creation-pass micro-optimizations.


---

### 6. Hostless Scoped CSS
Without a `:host` element, CSS encapsulation relies on **compiler-driven scoping** (similar to Svelte/Vue).

* **Change Class:** Compiler + Runtime (renderer behavior).
* **Mechanic:** The `.ng` compiler generates a unique attribute (e.g., `_ngcontent-c123`) and applies it to **every** DOM element in the component’s template.
* **ShadowDom Constraint:** Hostless components are incompatible with `ViewEncapsulation.ShadowDom` because there is no concrete host element to own a shadow root.
* **External Styling:** A parent cannot decorate a hostless component automatically. Styling intent (`class`, `style`) must be explicitly declared as `input` signals in the `bindings` block.
* **Diagnostic Safety:** If a parent applies a `class` to a hostless component that hasn’t opted in via `bindings`, the compiler emits a diagnostic error.
* **Delta from Ivy Today:** Current emulated encapsulation uses both host/content attributes; hostless mode needs a hostless scoping contract.
* **Compatibility Impact:** Medium/High — influences style encapsulation, SSR serialization, and hydration style reconciliation.

---

### Comparison: Legacy vs. Functional Model

| Concept | Legacy Class Model | Functional `.ng` Model |
| :--- | :--- | :--- |
| **Input Timing** | Available after constructor (`ngOnInit`). | Available in `setup` and `providers` via **Eager Binding Resolution**. |
| **Host Element** | Implicitly required (physical tag). | Absent by default (comment node anchor). |
| **Instruction Cursor** | Sequential `ɵɵadvance` on host. | Parent `ɵɵadvance` treats component as 1 slot; Child has a fresh cursor. |
| **Public API** | Entire class instance exposed via template ref. | Only the `expose` object is accessible; internals remain private. |
| **Projection** | Implicitly handled by `<ng-content>`. | Passed as fragments in `children` and called as functions. |
| **Directives** | Automatically attach to the host element. | Collected in the Attachment Bag and forwarded via `use:attachments()`. |
| **CSS Scoping** | Tied to the physical host attribute. | Applied to all template elements via compiler-generated attributes. |
