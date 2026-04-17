# Bridging .ng Components to the Ivy Runtime

> **DISCLAIMER — Highly Speculative & Likely Not Fully Accurate**
> This document is a design exercise and thought experiment. The `.ng` component model described here does not exist in Angular today. The Ivy runtime details (instruction names, internal structures, compilation contracts) are approximations used for illustrative purposes and should not be treated as authoritative or production-accurate descriptions of Angular internals.

This document explores how the functional, signal-native `.ng` proposal could map onto the existing Angular Ivy engine — potentially maintaining strict component boundaries, enabling hostless rendering, and preserving interoperability with legacy class-based components.

## Proposal Framing
Use the following reading mode for each section:
* **Change Class:** what layer must change (`Compiler-only`, `Runtime-only`, `Compiler + Runtime`).
* **Delta from Ivy Today:** what is intentionally different from current behavior.
* **Compatibility Impact:** where migration risk is concentrated.

---

### 1. The "Fake Class" Interop Layer
The existing Angular infrastructure (Router, DI, Module imports) expects class constructors. The `component()` utility bridges this gap by returning a constructor-impersonator.
* **Change Class:** Compiler + Runtime
* **Shape:** The utility returns a plain JavaScript function that satisfies both the TypeScript compiler and the Angular runtime as if it were a class constructor.
* **Ivy Metadata:** The compiler attaches the standard static properties (`ɵcmp` for the component definition, `ɵfac` for the factory) directly to this function.
* **Factory Hijack:** When the Router or a template "instantiates" the component, the `ɵfac` factory function (a static property on the constructor, distinct from the `ɵɵ`-prefixed runtime instructions) is invoked, running the `setup()` closure and returning the `expose` object instead of a class instance.
* **Reference Resolution:** The value returned by `ɵfac` (the `expose` object) is stored in the LView directive slot. A parent template reference variable (e.g. `<MyHostless #api />`) resolves via `ɵɵreference` to this `expose` object and nothing else — analogous to a directive's `exportAs` ref (e.g. `<div #api="myDirective" />`), where the ref resolves to the directive instance rather than the element. There is no implicit DOM element access via the ref; if DOM access is needed, the child must explicitly expose a signal wrapping `ref<HTMLElement>()`.
* **Hostless Create Pass Contract:** During `firstCreatePass`, `ngtsc` must mark `.ng` hostless components as `Hostless`, then emit container-aware metadata that links the child `TView` and `LView` to the parent view graph. At runtime, this allows the instruction pointer to enter the child template while preserving the parent's insertion context, so the component behaves like a permanent structural block rather than an element-backed node.
* **Delta from Ivy Today:** current Ivy treats factory output as component/directive instance identity.
* **Compatibility Impact:** High — touches DI/ref semantics, lifecycle dispatch, and test/runtime contracts that assume instance identity.

### 2. Component Boundaries & Encapsulation
With the interop layer in place, the core shift is from **instance-based** to **closure-based** boundaries.
* **Change Class:** Compiler + Runtime
* **The Contract:** A component's boundary is defined by its `bindings` block (inputs/outputs) and its `expose` object (public API).
* **Privacy by Default:** Unlike classes, where every `public` property is reachable from the template, the `.ng` model is a strict black box. During view creation, `ɵfac`'s return value is stored both at `lView[HEADER_OFFSET + directiveIndex]` — the directive slot where the NodeInjector reads for `inject()` — and at `lView[CONTEXT]` (slot 8), the template context for the component's own view. Because only `expose` is stored at both locations, both `inject(Component)` and `ref()` naturally surface `expose` and nothing else — no additional registration mechanism is required.
* **Interop:** Legacy components interact with `.ng` components through these explicit gates — the parent treats the child as a logic fragment rather than a DOM-bound instance.
* **Lifecycle Shift (DI-Native):** Class lifecycle interfaces (`ngOnInit`, `ngOnDestroy`) are deprecated for `.ng` components. Initialization and post-render DOM logic run through DI-native APIs such as `afterNextRender()`, and cleanup is registered through `DestroyRef.onDestroy()`. Because `ɵfac` returns the `expose` object instead of a class instance, there is no prototype to inspect; Ivy's existing prototype-based hook discovery (`directiveDef.type.prototype.ngOnInit`, etc.) cannot fire. Lifecycle is instead driven entirely by effects and callbacks registered imperatively during `setup()` — no instance method dispatch, no `TView` hook arrays for this component type.
* **Delta from Ivy Today:** prototype-based lifecycle discovery is replaced by explicit signal/effect APIs.
* **Compatibility Impact:** High — impacts hooks, query timing assumptions, and integration APIs that surface component instances.

### 3. The "Logical Anchor"
Hostless components need a place in Ivy's internal tree without requiring a physical DOM element. The framework solves this with a Logical Anchor that acts as a **Virtual View Container**.
* **Change Class:** Runtime-only (plus compiler metadata to select mode)
* **Identity:** A hostless component is anchored by a `TContainerNode` + `LContainer` (comment node in the DOM) — the same structure used by structural directives (`@if`, `*ngFor`). This is distinct from `<ng-container>`, which produces a `TElementContainerNode` and carries no `LContainer`. Unlike the transient embedded views that structural directives create and destroy, the hostless component's `LView` is created once and lives for the lifetime of the parent view — it is never removed from the container.
* **Cursor Persistence:** Because there is no host element, child nodes are spliced directly into the parent `TNode` flow; the runtime must preserve parent cursor state across child execution.
* **Runtime Guard:** `ɵɵcomponentContainerStart` and `ɵɵcomponentContainerEnd` save/restore parent `ɵɵadvance` state so parent change detection remains stable regardless of child template size.
* **Purpose:** This container provides a stable slot in the Logical View (`LView`) to store the component's metadata, its `NodeInjector`, and the `setup()` closure results. It also holds the **Attachment Bag** — the opaque collection of directive definitions supplied by the parent via the `attachments` binding — so the engine can retrieve and instantiate them at the `use:attachments()` site.
* **DOM Impact:** The component's template fragments render directly into the parent's DOM without a wrapper element, preventing DOM bloat.
* **Delta from Ivy Today:** components are currently element-hosted, while `LContainer` is used for embedded/container views.
* **Compatibility Impact:** High — affects rendering, hydration anchors, host bindings, and instruction cursor model.

### 4. Logical View Transition & Cursor Stability
Hostless composition must not disturb parent template cursor math.
* **Change Class:** Runtime-only
* **Strategy:** `ɵɵcomponentContainerStart` saves the parent logical cursor (`index` and current `TNode`) before entering the child instruction stream.
* **Restore Point:** `ɵɵcomponentContainerEnd` restores the parent cursor to the location immediately after the Logical Anchor.
* **Result:** Parent `ɵɵadvance` counts stay stable regardless of the child template's internal node count, bindings, or control flow depth.
* **Delta from Ivy Today:** these instructions are proposed and do not exist in current public or private Ivy instruction sets.
* **Compatibility Impact:** Medium/High — requires coherent integration with debug/profiler/tracing and incremental compilation assumptions.

### 5. Hostless Scoped CSS
Without a `:host` element, CSS encapsulation relies on **compiler-driven scoping** (similar to Svelte/Vue).
* **Change Class:** Compiler + Runtime (renderer behavior)
* **Mechanic:** The `.ng` compiler generates a unique attribute (e.g., `_ngcontent-c123`) and applies it to every DOM element in the component's template.
* **ShadowDom Constraint:** Hostless components are incompatible with `ViewEncapsulation.ShadowDom` because there is no concrete host element to own a shadow root.
* **External Styling:** A parent cannot decorate a hostless component automatically. Styling intent (`class`, `style`) must be explicitly declared as `input` signals in the `bindings` block.
* **Diagnostic Safety:** If a parent applies a `class` to a hostless component that hasn't opted in via `bindings`, the compiler emits a diagnostic error.
* **Delta from Ivy Today:** current emulated encapsulation uses both host/content attributes; hostless mode needs a hostless scoping contract.
* **Compatibility Impact:** Medium/High — influences style encapsulation, SSR serialization, and hydration style reconciliation.

### 6. Directive Attachments & Content Projection
Ambient metadata — directives and projected content — flows through explicit bindings rather than implicit host attachment or `<ng-content>` slots.
* **Change Class:** Compiler + Runtime
* **`attachments` (Directive Attachments):** Directives applied to a component's selector are validated at compile time against the element type declared in `attachable<T>()`. `use:attachments()` is not a regular directive application; the compiler emits a `ɵɵapplyAttachments(slot, attachments)` instruction instead. At runtime, this instruction reads the directive definitions from the Attachment Bag and instantiates them on the target DOM element. This preserves **isolated AOT compilation** — the child template is compiled without knowledge of which directives the parent will supply; only the element-type constraint is known at build time.
* **Binding Resolution Rule (Attachment Precedence):** Parent-provided `attachments` data has strict precedence over local child defaults for attributes, classes, and styles on the sink element. This encodes author intent: `use:attachments()` is an explicit forwarding point where parent requirements override internal bindings when conflicts occur.
* **`children` (Content Projection):** The parent's inner markup is captured as template fragments and passed into `setup` via the `children` object, to be rendered as functions wherever the component author chooses.
* **Delta from Ivy Today:** projection currently uses slot redistribution (`ɵɵprojectionDef` / `ɵɵprojection`) and no native attachments primitive exists.
* **Compatibility Impact:** High — adds new instruction semantics and changes directive/projection flow contracts.

### 7. Derivations & Fragments
Derivations and fragments leverage existing Ivy mechanics but shift complexity to the compiler for lexical scoping within the `.ng` file.
* **Change Class:** Mostly Compiler-only
* **Derivations (Functional Pipes):** A `derivation` is a DI-capable factory. At runtime it behaves like a Pipe: it executes within an injection context to retrieve dependencies and returns a computed signal.
* **Fragments (Typed, Lexically-Scoped `ng-template`):** At Ivy runtime, a `fragment` is not a new primitive; it is an embedded view — a `TView` (static blueprint, built once during `firstCreatePass`) paired with an `LView` instance created each time the fragment is rendered — that the compiler hoists into a standalone instruction array. The delta is compile-time only: typed parameters and lexical capture of the surrounding `setup()` scope.
* **Execution:** Invoking a fragment function (for example `children()`) runs standard `ɵɵtemplate`-based embedded view execution at the caller insertion point.
* **Compiler Responsibility:** The heavy lifting is in `ngtsc`, which manages lexical grouping so these functions can access the `setup` scope while mapping correctly to Ivy's embedded view TView/LView model.
* **Delta from Ivy Today:** minimal new runtime primitives; most novelty is type/lowering strategy in ngtsc.
* **Compatibility Impact:** Medium — mostly compiler and linker/typecheck work, lower core runtime risk than sections 1/3/6.

---

### Comparison: Legacy vs. Functional Model

| Concept | Legacy Class Model | Functional `.ng` Model |
| :--- | :--- | :--- |
| **Host Element** | Implicitly required (physical tag). | Absent by default (comment node anchor). |
| **CSS Scoping** | Tied to the physical host attribute. | Applied to all template elements via compiler-generated attributes. |
| **External Styling** | Always possible via host `class`/`style`. | Opt-in via explicit `input()` bindings. |
| **Directives** | Automatically attach to the host element. | Collected in the Attachment Bag and instantiated at the `use:attachments()` site via `ɵɵapplyAttachments`, with `attachments` precedence `Parent > Child` on sink conflicts. |
| **Projection** | Implicitly handled by `<ng-content>`. | Passed as fragments in `children` and called as functions. |
| **Pipes/Helpers** | Global or module-scoped classes. | Lexically scoped `derivation` or `fragment`. |
