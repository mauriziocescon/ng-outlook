import {
  type Signal,
  type InputSignal,
  signal,
  computed,
  input,
  model,
  output,
  afterNextRender,
} from '@angular/core';

import {
  type Bindings,
  type Ref,
  type InjectionToken,
  component,
  directive,
  derivation,
  fragment,
  directives,
  ref,
  refMany,
  injectionToken,
  provide,
} from './types';

interface User { id: string; name: string; }
interface Item { id: string; desc: string; }

// ────────────────────────────────────────────────────────────────
// COMPONENT — basics
// ────────────────────────────────────────────────────────────────

// No bindings: setup returns template
const Minimal = component({
  setup: () => ({ template: '...' }),
});

// Style and styleUrl
const StyledComp = component({
  setup: () => ({ template: '...' }),
  style: `.danger { color: red; }`,
});

const StyledUrlComp = component({
  setup: () => ({ template: '...' }),
  styleUrl: './my-comp.css',
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — bindings (input, model, output, fragment, directives)
//
// Setup receives raw Angular types: InputSignal, ModelSignal,
// OutputEmitterRef, FragmentBinding, DirectivesBinding.
// ────────────────────────────────────────────────────────────────

const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
    attachments: directives<HTMLElement>(),
  },
  setup: ({ user, email, makeAdmin, children, attachments }) => {
    const _u: User = user();
    const _e: string = email();
    email.set('new');
    makeAdmin.emit();
    return { template: '...' };
  },
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — expose
//
// expose defines the public interface accessible via ref.
// Components without expose resolve to undefined.
// ────────────────────────────────────────────────────────────────

const Child = component({
  setup: () => {
    const text = signal('');
    const _internal = signal(0);

    return {
      template: '...',
      expose: { text: text.asReadonly() },
    };
  },
});

const NoExpose = component({
  setup: () => ({ template: '...' }),
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — wrapper with Bindings<> and spread
//
// Bindings<> unwraps raw types to plain values:
//   InputSignal<User> → User, ModelSignal<string> → string, etc.
// The wrapper declares a subset of bindings and forwards the rest.
// ────────────────────────────────────────────────────────────────

const UserDetailWrapper = component<Bindings<typeof UserDetail>>({
  bindings: {
    user: input<User>(),
  },
  setup: ({ user, ...rest }) => {
    const _u: User = user;
    const _r: { email: string; makeAdmin: void; children: void; attachments: HTMLElement } = rest;
    const other = computed(() => user);
    return { template: '...' };
  },
});

// rest should NOT contain explicitly destructured keys
const _NegRest = component<Bindings<typeof UserDetail>>({
  bindings: { user: input<User>() },
  setup: ({ user, ...rest }) => {
    // @ts-expect-error user was destructured, not in rest
    rest.user;
    return { template: '...' };
  },
});

// bindings should NOT accept keys outside the target type
const _NegExtra = component<Bindings<typeof UserDetail>>({
  bindings: {
    user: input<User>(),
    // @ts-expect-error nonsense is not in Bindings<typeof UserDetail>
    nonsense: input<string>(),
  },
  setup: ({ user, ...rest }) => ({ template: '...' }),
});

// bindings should NOT accept wrong inner types
const _NegWrongType = component<Bindings<typeof UserDetail>>({
  bindings: {
    // @ts-expect-error user should be BindingOf<User>, not InputSignal<string>
    user: input<string>(),
  },
  setup: ({ user, ...rest }) => ({ template: '...' }),
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — providers receive only inputs (not models/outputs)
// ────────────────────────────────────────────────────────────────

class Store {}

const Counter = component({
  bindings: {
    c: input.required<number>(),
  },
  setup: () => ({ template: '...' }),
  providers: ({ c }) => {
    const _cInput: InputSignal<number> = c;
    return [provide({ token: Store, useFactory: () => new Store() })];
  },
});

const WithMixed = component({
  bindings: {
    name: input.required<string>(),
    age: input<number>(),
    email: model<string>(),
    save: output<void>(),
  },
  setup: ({ name, age, email, save }) => ({ template: '...' }),
  providers: (inputs) => {
    const _name: InputSignal<string> = inputs.name;
    const _age: InputSignal<number | undefined> = inputs.age;
    // @ts-expect-error email is a model, not an input
    inputs.email;
    // @ts-expect-error save is an output, not an input
    inputs.save;
    return [];
  },
});

// ────────────────────────────────────────────────────────────────
// DIRECTIVE — host as ref, expose
//
// host: ref<H>() is required in bindings.
// setup receives raw binding types and returns the expose object.
// ────────────────────────────────────────────────────────────────

// Directive with expose
const tooltip = directive({
  bindings: {
    host: ref<HTMLElement>(),
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ host, message, dismiss }) => {
    const _hostEl: Ref<HTMLElement | undefined> = host;
    const _msg: string = message();
    dismiss.emit();

    return { toggle: () => {} };
  },
});

// Directive without expose
const ripple = directive({
  bindings: {
    host: ref<HTMLElement>(),
  },
  setup: ({ host }) => {
    const _hostEl: Ref<HTMLElement | undefined> = host;
  },
});

// Host type constraint: narrows to specific element type
const buttonOnly = directive({
  bindings: {
    host: ref<HTMLButtonElement>(),
    label: input<string>(),
  },
  setup: ({ host, label }) => {
    const _hostEl: Ref<HTMLButtonElement | undefined> = host;
    const _l: string | undefined = label();
  },
});

// Directive must have host binding
const _NegNoHost = directive({
  // @ts-expect-error missing host in bindings
  bindings: {
    message: input.required<string>(),
  },
  setup: ({ message }) => {},
});

// Directive must have host binding — empty bindings
const _NegEmptyBindings = directive({
  // @ts-expect-error missing host in bindings
  bindings: {},
  setup: () => {},
});

// ────────────────────────────────────────────────────────────────
// REF UTILITIES — ref, refMany, read-only enforcement
//
// ref()  → single instance (Ref<T | undefined>)
// refMany() → multiple instances (Ref<T[]>)
// Both resolve after afterNextRender.
// ────────────────────────────────────────────────────────────────

// Native element
const divRef = ref<HTMLDivElement>();
const _divRefType: Ref<HTMLDivElement | undefined> = divRef;

// Component with expose
const childRef = ref(Child);
const _childRefType: Ref<{ text: Signal<string> } | undefined> = childRef;
const _childRefAsSignal: Signal<{ text: Signal<string> } | undefined> = childRef;

// Component without expose
const noExposeRef = ref(NoExpose);
const _noExposeType: Ref<undefined> = noExposeRef;

// Directive with expose
const tooltipRef = ref(tooltip);
const _tooltipRefType: Ref<{ toggle: () => void } | undefined> = tooltipRef;

// Directive without expose
const rippleRef = ref(ripple);
const _rippleRefType: Ref<undefined> = rippleRef;

// refMany
const manyChildren = refMany(Child);
const _manyType: Ref<{ text: Signal<string> }[]> = manyChildren;
const _manyAsSignal: Signal<{ text: Signal<string> }[]> = manyChildren;

// Refs are read-only — .set() must not exist
// @ts-expect-error
divRef.set(document.createElement('div'));
// @ts-expect-error
childRef.set({ text: signal('') });
// @ts-expect-error
tooltipRef.set({ toggle: () => {} });
// @ts-expect-error
manyChildren.set([]);

// Passing a ref as an input
const Sibling = component({
  bindings: {
    childRef: input<{ text: Signal<string> } | undefined>(),
  },
  setup: ({ childRef }) => {
    const _val = childRef();
    return { template: '...' };
  },
});

// Full parent scenario: refs across components and directives
const Parent = component({
  setup: () => {
    const el = ref<HTMLDivElement>();
    const child = ref(Child);
    const tlp = ref(tooltip);
    const many = refMany(Child);

    afterNextRender(() => {
      const _el: HTMLDivElement | undefined = el();
      const _child: { text: Signal<string> } | undefined = child();
      const _tlp: { toggle: () => void } | undefined = tlp();
      const _many: { text: Signal<string> }[] = many();
    });

    return { template: '...' };
  },
});

// ────────────────────────────────────────────────────────────────
// DERIVATION — only inputs, setup returns Signal<T>
// ────────────────────────────────────────────────────────────────

const simulation = derivation({
  bindings: {
    qty: input.required<number>(),
    item: input.required<Item>(),
  },
  setup: ({ qty, item }) => computed(() => item().desc + ' x ' + qty()),
});

const _simType: { readonly _result: string } = simulation;

// Derivation without bindings
const simple = derivation({
  setup: () => computed(() => 42),
});

const _simpleType: { readonly _result: number } = simple;

// ────────────────────────────────────────────────────────────────
// INJECTION TOKEN — component-level, root-level, multi
// ────────────────────────────────────────────────────────────────

// Component-level: must be provided explicitly
const compToken = injectionToken('desc', {
  factory: () => {
    const counter = signal(0);
    return {
      value: counter.asReadonly(),
      increase: () => counter.update(v => v + 1),
    };
  },
});

const _compTokenType: InjectionToken<{
  value: Signal<number>;
  increase: () => void;
}> = compToken;

// Root-level: factory invoked once at root scope
const rootToken = injectionToken('desc', {
  level: 'root',
  factory: () => {
    const counter = signal(0);
    return {
      value: counter.asReadonly(),
      decrease: () => counter.update(v => v - 1),
    };
  },
});

const _rootTokenType: InjectionToken<{
  value: Signal<number>;
  decrease: () => void;
}> = rootToken;

// Multi: type becomes T[]
const multiToken = injectionToken('desc', {
  multi: true,
  factory: () => Math.random(),
});

const _multiTokenType: InjectionToken<number[]> = multiToken;

// ────────────────────────────────────────────────────────────────
// PROVIDE — shorthand and object form
// ────────────────────────────────────────────────────────────────

const _providers = [
  provide(compToken),
  provide(multiToken),
  provide({ token: multiToken, useFactory: () => 10 }),
  provide({ token: Store, useFactory: () => new Store() }),
];
