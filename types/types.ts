import {
  type InputSignal,
  type ModelSignal,
  type OutputEmitterRef,
  type Provider,
  type Signal,
} from '@angular/core';

// ────────────────────────────────────────────────────────────────
// 1. TEMPLATE MARKUP
//
// Branded type so the compiler can distinguish a raw template
// return (shorthand) from an object return (full form).
// In practice the compiler produces TemplateMarkup from the DSL;
// here we use `any` as a stand-in.
// ────────────────────────────────────────────────────────────────

declare const TEMPLATE: unique symbol;

export type TemplateMarkup = { readonly [TEMPLATE]: true };

// ────────────────────────────────────────────────────────────────
// 2. BRANDED BINDING TYPES
//
// These do not exist in Angular today. They use unique symbols
// so TypeScript treats each as a distinct nominal type rather
// than a plain object.
// ────────────────────────────────────────────────────────────────

declare const FRAGMENT: unique symbol;
declare const ATTACHABLE: unique symbol;
declare const FRAGMENT_OPTIONAL: unique symbol;
declare const FRAGMENT_REQUIRED: unique symbol;

type FragmentArgs<T> =
  [T] extends [void] ? []
    : T extends any[] ? T
    : [T];

export type OptionalFragmentBinding<T> = {
  (...args: FragmentArgs<T>): TemplateMarkup;
  readonly [FRAGMENT]: T;
  readonly [FRAGMENT_OPTIONAL]: true;
};
export type RequiredFragmentBinding<T> = {
  (...args: FragmentArgs<T>): TemplateMarkup;
  readonly [FRAGMENT]: T;
  readonly [FRAGMENT_REQUIRED]: true;
};
export type FragmentBinding<T> = OptionalFragmentBinding<T> | RequiredFragmentBinding<T>;
export type AttachableBinding<T extends HTMLElement> = {
  readonly [ATTACHABLE]: (host: T) => void;
};

export declare function fragment<T>(): OptionalFragmentBinding<T>;
export declare namespace fragment {
  export function required<T>(): RequiredFragmentBinding<T>;
}
export declare function attachable<T extends HTMLElement>(): AttachableBinding<T>;

// ────────────────────────────────────────────────────────────────
// 3. REF
//
// Read-only signal populated by the framework. Extends Signal<T>
// with a branded symbol so the template compiler can distinguish
// ref targets from regular signals.
//
// Also used as the directive host declaration: host: ref<H>().
// ────────────────────────────────────────────────────────────────

declare const REF: unique symbol;

export interface Ref<T> extends Signal<T> {
  readonly [REF]: true;
}

// ────────────────────────────────────────────────────────────────
// 4. BINDING SURFACES
//
// Layered binding model:
// - Derivation: inputs only
// - Directive: derivation + model/output/fragment
// - Component: directive + attachable
// ────────────────────────────────────────────────────────────────

type BaseBindingValue =
  | InputSignal<any>
  | ModelSignal<any>
  | OutputEmitterRef<any>
  | OptionalFragmentBinding<any>
  | RequiredFragmentBinding<any>;

export type DerivationBindingValue = InputSignal<any>;
export type DirectiveBindingValue = BaseBindingValue;
export type ComponentBindingValue = BaseBindingValue | AttachableBinding<never>;

// ────────────────────────────────────────────────────────────────
// 5. INSTANCE TYPES & SHARED HELPERS
//
// ComponentInstance has bindings + expose.
// DirectiveInstance adds a host element type (H) — a directive
// must be attached to a DOM element.
//
// ExposeOf<T> works for both thanks to structural match on EXPOSE.
//
// InputsOnly<B> filters a bindings record to InputSignal keys
// only (excluding ModelSignal, which extends InputSignal in
// Angular's type hierarchy). Used by `providers`.
// ────────────────────────────────────────────────────────────────

declare const BINDINGS: unique symbol;
declare const EXPOSE: unique symbol;
declare const HOST: unique symbol;
declare const FORWARDED: unique symbol;

export type ComponentInstance<B, E = void> = {
  readonly [BINDINGS]: B;
  readonly [EXPOSE]: E;
};

export type DirectiveInstance<H extends HTMLElement, B, E = void> = {
  readonly [HOST]: H;
  readonly [BINDINGS]: B;
  readonly [EXPOSE]: E;
};

type ExposeOf<T> =
  T extends { readonly [EXPOSE]: infer E } ? E : never;

type TargetBindings<C extends ComponentInstance<unknown, unknown>> =
  C extends { readonly [BINDINGS]: infer B } ? B : never;

type InputKeys<B> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never
    : B[K] extends InputSignal<any> ? K
    : never;
}[keyof B];

type InputsOnly<B> = Pick<B, InputKeys<B>>;

type IsExact<A, B> =
  [A] extends [B]
    ? [B] extends [A]
      ? true
      : false
    : false;

type ExactSubset<Sel extends Record<string, unknown>, All extends Record<string, unknown>> = {
  [K in keyof Sel]-?: K extends keyof All
    ? IsExact<Sel[K], All[K]> extends true
      ? Sel[K]
      : never
    : never;
};

type ForwardedToken<B> = {
  // Compile-time forwarding marker for wrap setup context.
  readonly [FORWARDED]: B;
};

type SetupBindingValue<V> =
  V extends OptionalFragmentBinding<infer T> ? OptionalFragmentBinding<T> | undefined
    : V;

type SetupBindings<B> = {
  [K in keyof B]: SetupBindingValue<B[K]>;
};

type ReservedBindingsConstraint<B extends Record<string, ComponentBindingValue>> =
  ('children' extends keyof B
    ? B['children'] extends FragmentBinding<unknown> ? unknown : never
    : unknown) &
  ('attachments' extends keyof B
    ? B['attachments'] extends AttachableBinding<never> ? unknown : never
    : unknown);

type SetupReturn<E> =
  | { template: TemplateMarkup; expose: E } // full form with expose
  | { template: TemplateMarkup } // full form, no expose
  | TemplateMarkup; // shorthand: raw template

// ────────────────────────────────────────────────────────────────
// 6. COMPONENT
//
// setup return type — two forms:
//   Shorthand: return raw TemplateMarkup (no expose).
//   Full form: return { template, expose? }.
//
// component(...) — standard mode:
//   B inferred from bindings, setup receives Angular signal types
//   (InputSignal, ModelSignal, OutputEmitterRef, …).
//
// component.wrap(Target, ...) — wrapper mode:
//   Target is passed as a value; C is inferred from it (consistent
//   with ref(Child), inject(Child), etc.).
//   bindings are a strict subset of target bindings while preserving
//   key, binding kind, and inner type per selected key.
//   setup receives selected bindings as first arg and { forwarded } as
//   second arg.
//   forwarded is a compile-time forwarding token (not a runtime object):
//   the compiler unrolls <Target forward:forwarded /> into individual
//   forwarded bindings.
//
//   forward:forwarded should be enforced by template lowering:
//   if Omit<TargetBindings<C>, keyof Sel> is non-empty, the wrapper template
//   must include at least one forward:forwarded usage.
//   If this condition is not met, the compiler should emit a diagnostic
//   listing the dropped remainder keys.
//
//   Collision precedence: explicit bindings declared on the wrapped target
//   element always override forwarded bindings for the same key, regardless
//   of source order. Lowering model: apply forwarded first, explicit last.
//   This applies uniformly to all binding kinds (input/model/output/fragment/attachable).
//
//   For AttachableBinding keys in <Target forward:forwarded />, the compiler passes them
//   through intact to the target component; the chain is maintained
//   from parent → wrapper → target element at run time.
//   forward:forwarded can be used only on component elements.
// ────────────────────────────────────────────────────────────────

// With bindings
export function component<B extends Record<string, ComponentBindingValue>, E = void>(config: {
  bindings: B;
  setup: (bindings: SetupBindings<B>) => SetupReturn<E>;
  providers?: (inputs: InputsOnly<B>) => Provider[];
  style?: string;
  styleUrl?: string;
} & (ReservedBindingsConstraint<B> extends never ? never : {})): ComponentInstance<B, E>;

// No bindings
export function component<E = void>(config: {
  setup: () => SetupReturn<E>;
  providers?: () => Provider[];
  style?: string;
  styleUrl?: string;
}): ComponentInstance<{}, E>;

export function component(config: any): any {
  return config;
}

// Wrapper namespace helper (target as first arg, C inferred from value)
export namespace component {
  export declare function wrap<
    C extends ComponentInstance<unknown, unknown>,
    Sel extends Record<string, ComponentBindingValue>,
    E = void
  >(
    target: C,
    config: TargetBindings<C> extends Record<string, ComponentBindingValue> ? {
      bindings: ExactSubset<Sel, TargetBindings<C>>;
      setup: (
        bindings: SetupBindings<Sel>,
        context: {
          forwarded: keyof Omit<TargetBindings<C>, keyof Sel> extends never
            ? never
            : ForwardedToken<Omit<TargetBindings<C>, keyof Sel>>;
        }
      ) => SetupReturn<E>;
      providers?: (inputs: InputsOnly<Sel>) => Provider[];
      style?: string;
      styleUrl?: string;
    } : never
  ): ComponentInstance<TargetBindings<C>, E>;
}

(component as any).wrap = (_target: any, config: any) => config;

// ────────────────────────────────────────────────────────────────
// 7. DIRECTIVE
//
// Single-call, all generics inferred:
//   H from host, B from bindings, E from setup return.
//
// host is a separate config property — not a binding — because
// it is framework-provided context, not something the consumer
// can bind to. setup receives bindings as the first argument and
// { host } as the second.
// ────────────────────────────────────────────────────────────────

// With bindings
export function directive<
  H extends HTMLElement,
  B extends Record<string, DirectiveBindingValue>,
  E = void,
>(config: {
  host: Ref<H | undefined>;
  bindings: B;
  setup: (bindings: SetupBindings<B>, context: { host: Ref<H | undefined> }) => E;
}): DirectiveInstance<H, B, E>;

// No bindings
export function directive<H extends HTMLElement, E = void>(config: {
  host: Ref<H | undefined>;
  setup: (bindings: {}, context: { host: Ref<H | undefined> }) => E;
}): DirectiveInstance<H, {}, E>;

export function directive(config: any): any {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 8. DERIVATION
//
// Template-scoped reactive computation. Only InputSignal bindings
// are allowed (no host, no outputs, no models — a derivation has
// no DOM surface). setup must return Signal<T>.
// ────────────────────────────────────────────────────────────────

declare const RESULT: unique symbol;

export type DerivationInstance<B, T> = {
  readonly [BINDINGS]: B;
  readonly [RESULT]: T;
};

type NoModelBindings<B extends Record<string, DerivationBindingValue>> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never : B[K];
};

// With bindings (explicit derivation binding surface)
export function derivation<B extends Record<string, DerivationBindingValue>, T>(config: {
  bindings: B & NoModelBindings<B>;
  setup: (bindings: B) => Signal<T>;
}): DerivationInstance<B, T>;

// No bindings
export function derivation<T>(config: {
  setup: () => Signal<T>;
}): DerivationInstance<{}, T>;

export function derivation(config: any): any {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 9. REF UTILITIES
//
// ref()  — single instance, resolves after afterNextRender.
// refMany() — multiple instances (e.g. inside @for).
//
// Each has overloads for native elements, components, and
// directives. The expose type is inferred from the target.
// ────────────────────────────────────────────────────────────────

// Native element
export function ref<H extends HTMLElement>(): Ref<H | undefined>;
// Component or Directive (expose inferred)
export function ref<T extends ComponentInstance<unknown, unknown> | DirectiveInstance<HTMLElement, unknown, unknown>>(
  type: T
): Ref<ExposeOf<T> extends void ? undefined : ExposeOf<T> | undefined>;

export function ref(_type?: any): any {
  return {} as any;
}

// Component or Directive (expose inferred)
export function refMany<T extends ComponentInstance<unknown, unknown> | DirectiveInstance<HTMLElement, unknown, unknown>>(
  type: T
): Ref<ExposeOf<T> extends void ? undefined[] : ExposeOf<T>[]>;

export function refMany(_type?: any): any {
  return {} as any;
}

// ────────────────────────────────────────────────────────────────
// 10. INJECTION TOKEN
//
// Three flavours:
//   Component-level — must be provided explicitly via provide().
//   Root-level      — factory invoked once at root scope.
//   Multi           — collects multiple values into T[].
// ────────────────────────────────────────────────────────────────

declare const TOKEN_TYPE: unique symbol;
declare const TOKEN_MULTI: unique symbol;

export interface InjectionToken<T> {
  readonly [TOKEN_TYPE]: T;
  readonly [TOKEN_MULTI]?: boolean;
}

// Component-level
export function injectionToken<T>(desc: string, config: {
  factory: () => T;
}): InjectionToken<T>;

// Root-level
export function injectionToken<T>(desc: string, config: {
  level: 'root';
  factory: () => T;
}): InjectionToken<T>;

// Multi
export function injectionToken<T>(desc: string, config: {
  multi: true;
  factory: () => T;
}): InjectionToken<T[]>;

export function injectionToken(_desc: string, _config: any): any {
  return {} as any;
}

// ────────────────────────────────────────────────────────────────
// 11. INJECT
//
// inject(Component)  → ExposeOf<Component>
// inject(Directive)  → ExposeOf<Directive>
// inject(Token)      → T
// inject(Class)      → instance
// ────────────────────────────────────────────────────────────────

export function inject<B, E>(token: ComponentInstance<B, E>): ExposeOf<ComponentInstance<B, E>>;
export function inject<H extends HTMLElement, B, E>(token: DirectiveInstance<H, B, E>): ExposeOf<DirectiveInstance<H, B, E>>;
export function inject<T>(token: InjectionToken<T>): T;
export function inject<T>(token: new (...args: any[]) => T): T;

export function inject(_token: any): any {
  return {} as any;
}

// ────────────────────────────────────────────────────────────────
// 12. PROVIDE
//
// Shorthand — provide(token): uses the token's default factory.
// Object    — provide({ token, useFactory }): overrides factory.
//
// For multi tokens, useFactory returns a single item (T[number]),
// not the full array — each provide() call adds one entry.
// ────────────────────────────────────────────────────────────────

export function provide<T>(token: InjectionToken<T>): Provider;
export function provide<T>(config: {
  token: InjectionToken<T> | (new (...args: any[]) => T);
  useFactory: () => (T extends (infer U)[] ? U : T);
}): Provider;

export function provide(_config: any): any {
  return {} as any;
}
