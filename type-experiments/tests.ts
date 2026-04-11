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

/**
 * TEST 1: Component with expose
 */
const Child = component({
  setup: () => {
    const text = signal('');
    const _internal = signal(0);

    return {
      template: '...',
      expose: {
        text: text.asReadonly(),
      },
    };
  },
});

const childRef = ref(Child);
const _childRefType: Ref<{ text: Signal<string> } | undefined> = childRef;
// Signal<T> is assignable from Ref<T>
const _childRefAsSignal: Signal<{ text: Signal<string> } | undefined> = childRef;

/**
 * TEST 2: Component without expose
 */
const NoExpose = component({
  setup: () => ({ template: '...' }),
});

const noExposeRef = ref(NoExpose);
const _noExposeType: Ref<undefined> = noExposeRef;

/**
 * TEST 3: Native element ref
 */
const divRef = ref<HTMLDivElement>();
const _divRefType: Ref<HTMLDivElement | undefined> = divRef;

/**
 * TEST 4: Directive with expose — setup receives raw types
 */
const tooltip = directive<HTMLElement>()({
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ message, dismiss }, { host }) => {
    const _hostEl: Signal<HTMLElement> = host;
    const _msg: string = message();
    dismiss.emit();

    return {
      toggle: () => { /** ... **/ },
    };
  },
});

const tooltipRef = ref(tooltip);
const _tooltipRefType: Ref<{ toggle: () => void } | undefined> = tooltipRef;

/**
 * TEST 5: Directive without expose
 */
const ripple = directive<HTMLElement>()({
  setup: (_props, { host }) => {
    const _hostEl: Signal<HTMLElement> = host;
  },
});

const rippleRef = ref(ripple);
const _rippleRefType: Ref<undefined> = rippleRef;

/**
 * TEST 6: refMany
 */
const manyChildren = refMany(Child);
const _manyType: Ref<{ text: Signal<string> }[]> = manyChildren;
const _manyAsSignal: Signal<{ text: Signal<string> }[]> = manyChildren;

/**
 * TEST 7: Component with bindings — setup receives raw types
 */
const Sibling = component({
  bindings: {
    childRef: input<{ text: Signal<string> } | undefined>(),
  },
  setup: ({ childRef }) => {
    const _val = childRef();
    return { template: '...' };
  },
});

/**
 * TEST 8: Full Parent scenario from README
 */
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

/**
 * TEST 8b: Refs are read-only — .set() must not exist
 */
// @ts-expect-error ref is not writable
childRef.set({ text: signal('') });
// @ts-expect-error ref is not writable
divRef.set(document.createElement('div'));
// @ts-expect-error ref is not writable
tooltipRef.set({ toggle: () => {} });
// @ts-expect-error refMany is not writable
manyChildren.set([]);

/**
 * TEST 9: Standard component with real Angular bindings — setup receives raw types
 */
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

/**
 * TEST 10: Wrapper component with spread — Bindings<> gives unwrapped types
 */
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

/**
 * TEST 11: Directive host type constraint
 */
const buttonOnly = directive<HTMLButtonElement>()({
  bindings: {
    label: input<string>(),
  },
  setup: ({ label }, { host }) => {
    const _hostEl: Signal<HTMLButtonElement> = host;
    const _l: string | undefined = label();
  },
});

// ================================================================
// NEGATIVE TESTS
// ================================================================

// rest should NOT contain user
const _Neg1 = component<Bindings<typeof UserDetail>>({
  bindings: {
    user: input<User>(),
  },
  setup: ({ user, ...rest }) => {
    // @ts-expect-error user is not in rest
    rest.user;
    return { template: '...' };
  },
});

// bindings should NOT accept keys outside T
const _Neg2 = component<Bindings<typeof UserDetail>>({
  bindings: {
    user: input<User>(),
    // @ts-expect-error nonsense is not in Bindings<typeof UserDetail>
    nonsense: input<string>(),
  },
  setup: ({ user, ...rest }) => {
    return { template: '...' };
  },
});

// bindings should NOT accept wrong types
const _Neg3 = component<Bindings<typeof UserDetail>>({
  bindings: {
    // @ts-expect-error user should be BindingOf<User>, not InputSignal<string>
    user: input<string>(),
  },
  setup: ({ user, ...rest }) => {
    return { template: '...' };
  },
});

/**
 * TEST 12: Derivation — only inputs, setup returns Signal<T>
 */
interface Item { id: string; desc: string; }

const simulation = derivation({
  bindings: {
    qty: input.required<number>(),
    item: input.required<Item>(),
  },
  setup: ({ qty, item }) => {
    return computed(() => item().desc + ' x ' + qty());
  },
});

// derivation result type is inferred
const _simType: { readonly _result: string } = simulation;

/**
 * TEST 13: Component-level injectionToken
 */
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

/**
 * TEST 14: Root-level injectionToken
 */
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

/**
 * TEST 15: Multi injectionToken — type is T[]
 */
const multiToken = injectionToken('desc', {
  multi: true,
  factory: () => Math.random(),
});

const _multiTokenType: InjectionToken<number[]> = multiToken;

/**
 * TEST 16: provide — shorthand and object form
 */
class Store {}

const _providers = [
  provide(compToken),
  provide(multiToken),
  provide({ token: multiToken, useFactory: () => 10 }),
  provide({ token: Store, useFactory: () => new Store() }),
];

/**
 * TEST 17: Component with providers receiving only inputs
 */
const Counter = component({
  bindings: {
    c: input.required<number>(),
  },
  setup: () => {
    return { template: '...' };
  },
  providers: ({ c }) => {
    const _cInput: InputSignal<number> = c;
    return [
      provide({ token: Store, useFactory: () => new Store() }),
    ];
  },
});

/**
 * TEST 18: Component with style / styleUrl
 */
const StyledComp = component({
  setup: () => ({ template: '...' }),
  style: `.danger { color: red; }`,
});

const StyledUrlComp = component({
  setup: () => ({ template: '...' }),
  styleUrl: './my-comp.css',
});

/**
 * TEST 19: Derivation without bindings
 */
const simple = derivation({
  setup: () => computed(() => 42),
});

const _simpleType: { readonly _result: number } = simple;

/**
 * TEST 20: Component with providers — providers should NOT receive models/outputs
 */
const WithMixed = component({
  bindings: {
    name: input.required<string>(),
    age: input<number>(),
    email: model<string>(),
    save: output<void>(),
  },
  setup: ({ name, age, email, save }) => {
    return { template: '...' };
  },
  providers: (inputs) => {
    const _name: InputSignal<string> = inputs.name;
    const _age: InputSignal<number | undefined> = inputs.age;
    // @ts-expect-error email is a model, not an input — should not be in providers
    inputs.email;
    // @ts-expect-error save is an output, not an input — should not be in providers
    inputs.save;
    return [];
  },
});
