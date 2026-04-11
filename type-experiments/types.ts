import {
  type Signal,
  type InputSignal,
  type ModelSignal,
  OutputEmitterRef,
  type Provider,
} from '@angular/core';

/**
 * 1. PROPOSAL-ONLY BINDING TYPES (not in Angular today)
 */
export type FragmentBinding<T> = { readonly __fragment: T };
export type DirectivesBinding<T> = { readonly __directives: T };

export declare function fragment<T>(): FragmentBinding<T>;
export declare function directives<T extends HTMLElement>(): DirectivesBinding<T>;

/**
 * 2. TYPE TRANSFORMERS
 *
 * BindingValue: anything that can appear in a `bindings` object.
 * Unwrap: extracts the inner type T for the external contract (Bindings<>).
 */
export type BindingValue =
  | InputSignal<any>
  | ModelSignal<any>
  | OutputEmitterRef<any>
  | FragmentBinding<any>
  | DirectivesBinding<any>;

type Unwrap<T> =
  T extends OutputEmitterRef<infer U> ? U :
  T extends FragmentBinding<infer U> ? U :
  T extends DirectivesBinding<infer U> ? U :
  T extends Signal<infer U> ? U :
  T;

type UnwrapBindings<T> = { [K in keyof T]: Unwrap<T[K]> };

/**
 * BindingOf<V>: any BindingValue whose inner type is V or V | undefined.
 * Needed because input<User>() returns InputSignal<User | undefined>,
 * while the wrapper's T has User (from input.required).
 */
type BindingOf<V> =
  | InputSignal<V> | InputSignal<V | undefined>
  | ModelSignal<V> | ModelSignal<V | undefined>
  | OutputEmitterRef<V>
  | FragmentBinding<V>
  | DirectivesBinding<V & HTMLElement>;

/**
 * 3. COMPONENT DEFINITION
 *
 * setup receives the RAW binding types (InputSignal, ModelSignal, OutputEmitterRef, etc.)
 * Bindings<> returns the UNWRAPPED types (the external contract for wrappers)
 */
export type ComponentInstance<B, E = void> = {
  bindings: B;
  readonly _expose: E;
};

export type Bindings<C> = C extends ComponentInstance<infer B, any> ? UnwrapBindings<B> : never;
type ExposeOf<C> = C extends ComponentInstance<any, infer E> ? E : never;



// Extract only InputSignal keys (excluding ModelSignal which extends InputSignal)
type InputKeys<B> = {
  [K in keyof B]: B[K] extends ModelSignal<any> ? never : B[K] extends InputSignal<any> ? K : never;
}[keyof B];

type InputsOnly<B> = Pick<B, InputKeys<B>>;

// Standard: B inferred from bindings, setup receives raw types
export function component<B extends Record<string, BindingValue>, E = void>(config: {
  bindings?: B;
  setup: (props: B) => { template: any; expose?: E } | { template: any };
  providers?: (inputs: InputsOnly<B>) => Provider[];
  style?: string;
  styleUrl?: string;
}): ComponentInstance<B, E>;

// Wrapper: T explicit (unwrapped), bindings partial with type checking, setup receives full T
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

/**
 * 4. DIRECTIVE DEFINITION
 *
 * setup receives raw binding types + host context, returns expose
 */
export type DirectiveInstance<B, H extends HTMLElement, E = void> = {
  bindings: B;
  readonly _host: H;
  readonly _expose: E;
};

type ExposeOfDirective<D> = D extends DirectiveInstance<any, any, infer E> ? E : never;

export function directive<H extends HTMLElement>() {
  return <B extends Record<string, BindingValue>, E = void>(config: {
    bindings?: B;
    setup: (props: B, context: { host: Signal<H> }) => E;
  }): DirectiveInstance<B, H, E> => {
    return config as any;
  };
}

/**
 * 5. REF UTILITIES
 *
 * Ref<T> extends Signal<T> (read-only to the consumer).
 * The framework populates it internally; the user only reads.
 * A branded symbol distinguishes Ref from plain Signal so the
 * template compiler can validate ref={...} targets.
 */
declare const REF_SLOT: unique symbol;

export interface Ref<T> extends Signal<T> {
  readonly [REF_SLOT]: true;
}

// Native element
export function ref<H extends HTMLElement>(): Ref<H | undefined>;
// Component
export function ref<C extends ComponentInstance<any, any>>(
  type: C
): Ref<ExposeOf<C> extends void ? undefined : ExposeOf<C> | undefined>;
// Directive
export function ref<D extends DirectiveInstance<any, any, any>>(
  type: D
): Ref<ExposeOfDirective<D> extends void ? undefined : ExposeOfDirective<D> | undefined>;

export function ref(_type?: any): any {
  return {} as any;
}

// Component
export function refMany<C extends ComponentInstance<any, any>>(
  type: C
): Ref<ExposeOf<C> extends void ? never[] : ExposeOf<C>[]>;
// Directive
export function refMany<D extends DirectiveInstance<any, any, any>>(
  type: D
): Ref<ExposeOfDirective<D> extends void ? never[] : ExposeOfDirective<D>[]>;

export function refMany(_type?: any): any {
  return {} as any;
}

/**
 * 6. DERIVATION DEFINITION
 *
 * Only inputs allowed in bindings. setup returns Signal<T>.
 */
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

/**
 * 7. INJECTION TOKEN
 *
 * Component-level (default), root-level, and multi tokens.
 */
export interface InjectionToken<T> {
  readonly __tokenType: T;
  readonly __multi?: boolean;
}

// Component-level token (no level, no multi)
export function injectionToken<T>(desc: string, config: {
  factory: () => T;
}): InjectionToken<T>;

// Root-level token
export function injectionToken<T>(desc: string, config: {
  level: 'root';
  factory: () => T;
}): InjectionToken<T>;

// Multi token
export function injectionToken<T>(desc: string, config: {
  multi: true;
  factory: () => T;
}): InjectionToken<T[]>;

export function injectionToken(_desc: string, _config: any): any {
  return {} as any;
}

/**
 * 8. PROVIDE
 *
 * Shorthand: provide(token) uses the token's default factory.
 * Object form: provide({ token, useFactory }) overrides the factory.
 */
export function provide<T>(token: InjectionToken<T>): Provider;
export function provide<T>(config: {
  token: InjectionToken<T> | (new (...args: any[]) => T);
  useFactory: () => (T extends (infer U)[] ? U : T);
}): Provider;
export function provide<T>(config: {
  token: new (...args: any[]) => T;
  useFactory: () => T;
}): Provider;

export function provide(_config: any): any {
  return {} as any;
}
