import {
  type Signal,
  type InputSignal,
  type ModelSignal,
  OutputEmitterRef,
  type Provider,
} from '@angular/core';

// ────────────────────────────────────────────────────────────────
// 1. BRANDED BINDING TYPES
//
// These do not exist in Angular today. They use unique symbols
// so TypeScript treats each as a distinct nominal type rather
// than a plain object.
// ────────────────────────────────────────────────────────────────

declare const FRAGMENT: unique symbol;
declare const ATTACH: unique symbol;

export type FragmentBinding<T> = { readonly [FRAGMENT]: T };

/**
 * Directive Attachments — an opaque collection of directive definitions
 * intended for a specific element type T.
 *
 * PASS-THROUGH FLOW:
 * 1. Parent applies directives to component: <Button use:ripple() use:tooltip() />
 * 2. Component declares sink: attachments: attach<HTMLButtonElement>()
 * 3. Framework stores directive definitions in component's Logical Anchor
 * 4. Component spreads sink: <button {...attachments()} />
 * 5. Compiler emits ɵɵapplyAttachments instruction (not object spread)
 * 6. Runtime instantiates directives on the target <button> element
 *
 * The compiler validates at build time that any directive applied
 * by a parent is compatible with the element type T declared here.
 * The child template never inspects the bag contents; it only
 * declares the required element type as the Sink constraint.
 */
export type AttachBinding<T> = { readonly [ATTACH]: T };

export declare function fragment<T>(): FragmentBinding<T>;
export declare function attach<T extends HTMLElement>(): AttachBinding<T>;

// ────────────────────────────────────────────────────────────────
// 2. REF
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
// 3. BINDING VALUE
//
// BindingValue — union of everything that can appear in `bindings`.
// ────────────────────────────────────────────────────────────────

export type BindingValue =
  | InputSignal<any>
  | ModelSignal<any>
  | OutputEmitterRef<any>
  | FragmentBinding<any>
  | AttachBinding<any>;

// ────────────────────────────────────────────────────────────────
// 4. INSTANCE TYPES & SHARED HELPERS
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

type TargetBindings<C extends ComponentInstance<any, any>> =
  C extends { readonly [BINDINGS]: infer B } ? B : never;

type InputKeys<B> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never
    : B[K] extends InputSignal<any> ? K
    : never;
}[keyof B];

type InputsOnly<B> = Pick<B, InputKeys<B>>;

// ────────────────────────────────────────────────────────────────
// 4b. TEMPLATE MARKUP
//
// Branded type so the compiler can distinguish a raw template
// return (shorthand) from an object return (full form).
// In practice the compiler produces TemplateMarkup from the DSL;
// here we use `any` as a stand-in.
// ────────────────────────────────────────────────────────────────

declare const TEMPLATE: unique symbol;

export type TemplateMarkup = { readonly [TEMPLATE]: true };

type SetupReturn<E> =
  | { template: TemplateMarkup; expose: E }   // full form with expose
  | { template: TemplateMarkup }               // full form, no expose
  | TemplateMarkup;                            // shorthand: raw template

// ────────────────────────────────────────────────────────────────
// 5. COMPONENT
//
// setup return type — two forms:
//   Shorthand: return raw TemplateMarkup (no expose).
//   Full form: return { template, expose? }.
//
// component(...) — standard mode:
//   B inferred from bindings, setup receives Angular signal types
//   (InputSignal, ModelSignal, OutputEmitterRef, …).
//
// component.wrap<typeof Target>(...) — wrapper mode:
//   bindings are partial and type-checked against Target while
//   preserving binding kind per key.
//   setup receives binding wrappers (signals/outputs/etc.), matching
//   the standard component mental model. {...rest} spread is a
//   compile-time operation: the compiler unrolls it into individual
//   bindings on the target, re-wiring each wrapper to the
//   corresponding target binding. No runtime object spread.
//   For AttachBinding keys, {...attachments()} creates a
//   PASS-THROUGH: the compiler emits a ɵɵapplyAttachments instruction
//   rather than spreading a plain object — the Sink is forwarded intact
//   from parent → wrapper → target, maintaining the directive chain.
//
// ────────────────────────────────────────────────────────────────

// With bindings
export function component<B extends Record<string, BindingValue>, E = void>(config: {
  bindings: B;
  setup: (props: B) => SetupReturn<E>;
  providers?: (inputs: InputsOnly<B>) => Provider[];
  style?: string;
  styleUrl?: string;
}): ComponentInstance<B, E>;

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

// Wrapper namespace helper (explicit opt-in via generic target)
export namespace component {
  export declare function wrap<C extends ComponentInstance<any, any>, E = void>(config:
    TargetBindings<C> extends Record<string, BindingValue> ? {
      bindings?: Partial<TargetBindings<C>>;
      setup: (props: TargetBindings<C>) => SetupReturn<E>;
      providers?: (inputs: InputsOnly<TargetBindings<C>>) => Provider[];
      style?: string;
      styleUrl?: string;
    } : never
  ): ComponentInstance<TargetBindings<C>, E>;
}

(component as any).wrap = (config: any) => config;

// ────────────────────────────────────────────────────────────────
// 6. DIRECTIVE
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
  B extends Record<string, BindingValue>,
  E = void,
>(config: {
  host: Ref<H | undefined>;
  bindings: B;
  setup: (props: B, context: { host: Ref<H | undefined> }) => E;
}): DirectiveInstance<H, B, E>;

// No bindings
export function directive<H extends HTMLElement, E = void>(config: {
  host: Ref<H | undefined>;
  setup: (context: { host: Ref<H | undefined> }) => E;
}): DirectiveInstance<H, {}, E>;

export function directive(config: any): any {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 7. DERIVATION
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

// With bindings
export function derivation<B extends Record<string, InputSignal<any>>, T>(config: {
  bindings: B;
  setup: (props: B) => Signal<T>;
}): DerivationInstance<B, T>;

// No bindings
export function derivation<T>(config: {
  setup: () => Signal<T>;
}): DerivationInstance<{}, T>;

export function derivation(config: any): any {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 8. REF UTILITIES
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
export function ref<T extends ComponentInstance<any, any> | DirectiveInstance<any, any, any>>(
  type: T
): Ref<ExposeOf<T> extends void ? undefined : ExposeOf<T> | undefined>;

export function ref(_type?: any): any {
  return {} as any;
}

// Component or Directive (expose inferred)
export function refMany<T extends ComponentInstance<any, any> | DirectiveInstance<any, any, any>>(
  type: T
): Ref<ExposeOf<T> extends void ? undefined[] : ExposeOf<T>[]>;

export function refMany(_type?: any): any {
  return {} as any;
}

// ────────────────────────────────────────────────────────────────
// 9. INJECTION TOKEN
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
// 10. INJECT
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
// 11. PROVIDE
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
