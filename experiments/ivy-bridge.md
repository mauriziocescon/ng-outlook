# Bridging .ng Components to the Ivy Runtime

This document describes how the functional, signal-native `.ng` proposal maps onto the existing Angular Ivy engine — maintaining strict component boundaries, enabling hostless rendering, and preserving interoperability with legacy class-based components.

---

### 1. The "Fake Class" Interop Layer
The existing Angular infrastructure (Router, DI, Module imports) expects class constructors. The `component()` utility bridges this gap by returning a constructor-impersonator.
* **Shape:** The utility returns a plain JavaScript function that satisfies both the TypeScript compiler and the Angular runtime as if it were a class constructor.
* **Ivy Metadata:** The compiler attaches the standard static properties (`ɵcmp` for the component definition, `ɵfac` for the factory) directly to this function.
* **Factory Hijack:** When the Router or a template "instantiates" the component, the `ɵfac` instruction runs the `setup()` closure and returns the `expose` object instead of a class instance.

### 2. Component Boundaries & Encapsulation
With the interop layer in place, the core shift is from **instance-based** to **closure-based** boundaries.
* **The Contract:** A component's boundary is defined by its `bindings` block (inputs/outputs) and its `expose` object (public API).
* **Privacy by Default:** Unlike classes, where every `public` property leaks to the template and injectors, the `.ng` model is a strict black box. Only the `expose` return value is stored in the Ivy `LView` slot, making it the sole object reachable via `inject()` or `ref()`.
* **Interop:** Legacy components interact with `.ng` components through these explicit gates — the parent treats the child as a logic fragment rather than a DOM-bound instance.

### 3. The "Logical Anchor"
Hostless components need a place in Ivy's internal tree without requiring a physical DOM element. The framework solves this with a "Logical Host."
* **Mechanic:** The Ivy renderer uses an `LContainer` (a comment node) as an anchor.
* **Purpose:** This anchor provides a stable slot in the Logical View (`LView`) to store the component's metadata, its `NodeInjector`, and the `setup()` closure results. It also holds the **Attachment Bag** — the opaque collection of directive definitions supplied by the parent via the `attachments` binding — so the engine can retrieve and instantiate them at the `{...attachments()}` spread site.
* **DOM Impact:** The component's template fragments render directly into the parent's DOM without a wrapper element, preventing DOM bloat.

### 4. Hostless Scoped CSS
Without a `:host` element, CSS encapsulation relies on **compiler-driven scoping** (similar to Svelte/Vue).
* **Mechanic:** The `.ng` compiler generates a unique attribute (e.g., `_ngcontent-c123`) and applies it to every DOM element in the component's template.
* **External Styling:** A parent cannot decorate a hostless component automatically. Styling intent (`class`, `style`) must be explicitly declared as `input` signals in the `bindings` block.
* **Diagnostic Safety:** If a parent applies a `class` to a hostless component that hasn't opted in via `bindings`, the compiler emits a diagnostic error.

### 5. Directive Attachments & Content Projection
Ambient metadata — directives and projected content — flows through explicit bindings rather than implicit host attachment or `<ng-content>` slots.
* **`attachments` (Directive Attachments):** Directives applied to a component's selector are validated at compile time against the element type declared in `attach<T>()`. The `{...attachments()}` spread is not a runtime object spread; the compiler emits a `ɵɵapplyAttachments(slot, attachments)` instruction instead. At runtime, this instruction reads the directive definitions from the Attachment Bag and instantiates them on the target DOM element. This preserves **isolated AOT compilation** — the child template is compiled without knowledge of which directives the parent will supply; only the element-type constraint is known at build time.
* **`children` (Content Projection):** The parent's inner markup is captured as template fragments and passed into `setup` via the `children` object, to be rendered as functions wherever the component author chooses.

### 6. Derivations & Fragments
Derivations and fragments leverage existing Ivy mechanics but shift complexity to the compiler for lexical scoping within the `.ng` file.
* **Derivations (Functional Pipes):** A `derivation` is a DI-capable factory. At runtime it behaves like a Pipe: it executes within an injection context to retrieve dependencies and returns a computed signal.
* **Fragments (Typed Templates):** A `fragment` is essentially a typed `ng-template`. The compiler hoists the fragment's markup into a standalone instruction array.
* **Compiler Responsibility:** The heavy lifting is in `ngtsc`, which manages lexical grouping so these functions can access the `setup` scope while mapping correctly to Ivy's internal `LTemplate` logic.

---

### Comparison: Legacy vs. Functional Model

| Concept | Legacy Class Model | Functional `.ng` Model |
| :--- | :--- | :--- |
| **Host Element** | Implicitly required (physical tag). | Absent by default (comment node anchor). |
| **CSS Scoping** | Tied to the physical host attribute. | Applied to all template elements via compiler-generated attributes. |
| **External Styling** | Always possible via host `class`/`style`. | Opt-in via explicit `input()` bindings. |
| **Directives** | Automatically attach to the host element. | Collected in the Attachment Bag and instantiated at the `{...attachments()}` site via `ɵɵapplyAttachments`. |
| **Projection** | Implicitly handled by `<ng-content>`. | Passed as fragments in `children` and called as functions. |
| **Pipes/Helpers** | Global or module-scoped classes. | Lexically scoped `derivation` or `fragment`. |
