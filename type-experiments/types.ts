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
// These do not exist in Angular today. They use branded fields
// (__fragment, __directives) so TypeScript treats each as a
// distinct nominal type rather than a plain object.
// ────────────────────────────────────────────────────────────────

export type FragmentBinding<T> = { readonly __fragment: T };
export type DirectivesBinding<T> = { readonly __directives: T };

export declare function fragment<T>(): FragmentBinding<T>;
export declare function directives<T extends HTMLElement>(): DirectivesBinding<T>;

// ────────────────────────────────────────────────────────────────
// 2. REF
//
// Read-only signal populated by the framework. Extends Signal<T>
// with a branded symbol so the template compiler can distinguish
// ref targets from regular signals.
//
// Also used as a directive host binding: host: ref<HTMLElement>().
// ────────────────────────────────────────────────────────────────

declare const REF_SLOT: unique symbol;

export interface Ref<T> extends Signal<T> {
  readonly [REF_SLOT]: true;
}

// ────────────────────────────────────────────────────────────────
// 3. BINDING VALUE & TYPE TRANSFORMERS
//
// BindingValue — union of everything that can appear in `bindings`.
//
// Unwrap<T> — extracts the inner type T from any binding wrapper.
//   InputSignal<User>  → User
//   ModelSignal<string> → string
//   OutputEmitterRef<void> → void
//   FragmentBinding<void> → void
//   DirectivesBinding<HTMLElement> → HTMLElement
//   Ref<HTMLElement | undefined> → HTMLElement | undefined
//
// BindingOf<V> — the inverse: given an unwrapped type V, which
//   binding wrappers could hold it? Used by the wrapper component
//   overload to type-check partial bindings against the full set.
// ────────────────────────────────────────────────────────────────

export type BindingValue =
  | InputSignal<any>
  | ModelSignal<any>
  | OutputEmitterRef<any>
  | FragmentBinding<any>
  | DirectivesBinding<any>
  | Ref<any>;

type Unwrap<T> =
  T extends OutputEmitterRef<infer U> ? U :
  T extends FragmentBinding<infer U> ? U :
  T extends DirectivesBinding<infer U> ? U :
  T extends Signal<infer U> ? U :
  T;

type UnwrapBindings<T> = { [K in keyof T]: Unwrap<T[K]> };

type BindingOf<V> =
  | InputSignal<V> | InputSignal<V | undefined>
  | ModelSignal<V> | ModelSignal<V | undefined>
  | OutputEmitterRef<V>
  | FragmentBinding<V>
  | DirectivesBinding<V & HTMLElement>
  | Ref<V>;

// ────────────────────────────────────────────────────────────────
// 4. INSTANCE TYPES & SHARED HELPERS
//
// ComponentInstance and DirectiveInstance share the same shape
// (bindings + _expose), so a single ExposeOf<T> works for both.
//
// InputsOnly<B> filters a bindings record to InputSignal keys
// only (excluding ModelSignal, which extends InputSignal in
// Angular's type hierarchy). Used by `providers`.
// ────────────────────────────────────────────────────────────────

export type ComponentInstance<B, E = void> = {
  bindings: B;
  readonly _expose: E;
};

export type DirectiveInstance<B, E = void> = {
  bindings: B;
  readonly _expose: E;
};

type ExposeOf<T> =
  T extends { readonly _expose: infer E } ? E : never;

export type Bindings<C> =
  C extends ComponentInstance<infer B, any> ? UnwrapBindings<B> : never;

type InputKeys<B> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never
    : B[K] extends InputSignal<any> ? K
    : never;
}[keyof B];

type InputsOnly<B> = Pick<B, InputKeys<B>>;

// ────────────────────────────────────────────────────────────────
// 5. COMPONENT
//
// Two overloads:
//
// Standard — B inferred from bindings, setup receives raw types
//   (InputSignal, ModelSignal, OutputEmitterRef, …).
//
// Wrapper — T is explicit (unwrapped types from Bindings<>),
//   bindings are partial and type-checked against T,
//   setup receives plain T values for spread forwarding.
// ────────────────────────────────────────────────────────────────

// Standard
export function component<B extends Record<string, BindingValue>, E = void>(config: {
  bindings?: B;
  setup: (props: B) => { template: any; expose?: E } | { template: any };
  providers?: (inputs: InputsOnly<B>) => Provider[];
  style?: string;
  styleUrl?: string;
}): ComponentInstance<B, E>;

// Wrapper
export function component<T extends Record<string, any>, E = void>(config: {
  bindings: { [K in keyof T]?: BindingOf<T[K]> };
  setup: (props: T) => { template: any; expose?: E } | { template: any };
  providers?: (inputs: { [K in keyof T]?: T[K] }) => Provider[];
  style?: string;
  styleUrl?: string;
}): ComponentInstance<{ [K in keyof T]: BindingOf<T[K]> }, E>;

export function component(config: any): any {
  return config;
}

// ────────────────────────────────────────────────────────────────
// 6. DIRECTIVE
//
// Single-call, all generics inferred. The host element is declared
// inside bindings as ref<H>() — no separate generic needed.
// setup receives raw binding types and returns the expose object.
// ────────────────────────────────────────────────────────────────

export function directive<B extends Record<string, BindingValue>, E = void>(config: {
  bindings?: B;
  setup: (props: B) => E;
}): DirectiveInstance<B, E> {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 7. REF UTILITIES
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
export function ref<T extends ComponentInstance<any, any> | DirectiveInstance<any, any>>(
  type: T
): Ref<ExposeOf<T> extends void ? undefined : ExposeOf<T> | undefined>;

export function ref(_type?: any): any {
  return {} as any;
}

// Component or Directive (expose inferred)
export function refMany<T extends ComponentInstance<any, any> | DirectiveInstance<any, any>>(
  type: T
): Ref<ExposeOf<T> extends void ? never[] : ExposeOf<T>[]>;

export function refMany(_type?: any): any {
  return {} as any;
}

// ────────────────────────────────────────────────────────────────
// 8. DERIVATION
//
// Template-scoped reactive computation. Only InputSignal bindings
// are allowed (no host, no outputs, no models — a derivation has
// no DOM surface). setup must return Signal<T>.
// ────────────────────────────────────────────────────────────────

export type DerivationInstance<B, T> = {
  bindings: B;
  readonly _result: T;
};

export function derivation<B extends Record<string, InputSignal<any>>, T>(config: {
  bindings?: B;
  setup: (props: B) => Signal<T>;
}): DerivationInstance<B, T> {
  return config as any;
}

// ────────────────────────────────────────────────────────────────
// 9. INJECTION TOKEN
//
// Three flavours:
//   Component-level — must be provided explicitly via provide().
//   Root-level      — factory invoked once at root scope.
//   Multi           — collects multiple values into T[].
// ────────────────────────────────────────────────────────────────

export interface InjectionToken<T> {
  readonly __tokenType: T;
  readonly __multi?: boolean;
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
// 10. PROVIDE
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
