# Technical Architecture: Angular Functional Component Evolution

This document outlines the architectural bridge between the functional, signal-native `.ng` proposal and the existing Angular Ivy engine. It focuses on maintaining strict boundaries, ensuring high-performance rendering, and preserving interoperability with legacy class-based components.

---

### 1. Component Boundaries & Encapsulation
The core shift moves Angular from **Instance-based** to **Closure-based** boundaries.
* **The Contract:** The component boundary is explicitly defined by the `bindings` block (Inputs/Outputs) and the `expose` object (Public API).
* **Privacy by Default:** Unlike classes where every `public` property is leaked to the template and injectors, the `.ng` model is a strict black box. Only the `expose` return value is stored in the Ivy `LView` slot, making it the only object reachable via `inject()` or `ref()`.
* **Interop:** Legacy components interact with `.ng` components through these explicit gates. The parent treats the child as a "logic fragment" rather than a DOM-bound instance.

### 2. The "Logical Anchor" (`ng-container`)
To maintain compatibility with Ivy’s `NodeInjector` and change detection without requiring a physical DOM tag, the framework utilizes a "Logical Host."
* **Mechanic:** Behind the scenes, the Ivy renderer uses an `LContainer` (effectively a comment node or `ng-container`).
* **Purpose:** This anchor provides a stable location in the **Logical View (LView)** to store the component’s metadata, its `NodeInjector`, and the results of the `setup()` closure.
* **DOM Impact:** It allows for "Hostless" behavior where the component’s internal fragments are rendered directly into the parent’s DOM without a wrapper element, preventing DOM bloat.

### 3. Hostless Scoped CSS (Svelte/Vue Model)
Since hostless components lack a `:host` element to target, CSS encapsulation is managed via **Compiler-Driven Scoping**.
* **The Mechanic:** The `.ng` compiler generates a unique attribute (e.g., `_ngcontent-c123`) and applies it to every DOM element defined within the component’s template.
* **Styling the Component:** Because there is no host, a parent cannot "decorate" the component automatically. Styling intent (like `class` or `style`) must be explicitly declared as `input` signals in the `bindings` block.
* **Diagnostic Safety:** If a parent attempts to apply a `class` to a hostless component that hasn't opted into receiving it via `bindings`, the compiler throws a diagnostic error.

### 4. The "Fake Class" Interop Layer
To ensure the new functional model works with existing Angular infrastructure (Router, DI, and Module imports), the `component()` utility returns a constructor-impersonator.
* **The Trick:** The utility returns a standard JavaScript function that "looks" like a class constructor to the TypeScript compiler and Angular runtime.
* **Ivy Metadata:** The compiler attaches Ivy-specific static properties (`ɵcmp` for component definition and `ɵfac` for the factory) directly to this function.
* **The Factory Hijack:** When the Router or a template tries to "instantiate" the component, the `ɵfac` instruction runs the `setup()` closure and returns the `expose` object instead of a class instance.

### 5. Manual Metadata Spreading (`attachments` & `children`)
The interoperability of "ambient" metadata—things like directives or projected content—is handled via explicit "Sinks."
* **`attachments`:** Directives applied by a parent to the component's selector are resolved at compile time. The compiler statically unrolls the `{...attachments()}` spread into individual bindings on the target element, with full type checking. The `.ng` author must explicitly spread these onto an internal element.
* **`children`:** Projected content is no longer handled by an implicit `<ng-content>` slot. Instead, the parent's inner HTML is captured as template fragments and passed into `setup` via the `children` object, to be executed as functions wherever the component author chooses.

---

### Precise Comparison: Legacy vs. Functional Interop 

| Concept | Legacy Class Model | Functional `.ng` Model |
| :--- | :--- | :--- |
| **Host Element** | Implicitly required (physical tag). | Absent by default (comment node anchor). |
| **CSS Scoping** | Tied to the physical host attribute. | Applied to all template elements via compiler tags. |
| **External Styling** | Always possible via host `class`/`style`. | Opt-in via explicit `input()` bindings. |
| **Directives** | Automatically attach to the host element. | Collected in `attachments` and manually "spread." |
| **Projection** | Implicitly handled by `<ng-content>`. | Passed as fragments in `children` and called as functions. |
