import {
  type Signal,
  type WritableSignal,
  signal,
  computed,
  input,
  model,
  output,
  afterNextRender,
} from '@angular/core';

import {
  type Bindings,
  component,
  directive,
  fragment,
  directives,
  ref,
  refMany,
} from './types.js';

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
const _childRefType: WritableSignal<{ text: Signal<string> } | undefined> = childRef;

/**
 * TEST 2: Component without expose
 */
const NoExpose = component({
  setup: () => ({ template: '...' }),
});

const noExposeRef = ref(NoExpose);
const _noExposeType: WritableSignal<undefined> = noExposeRef;

/**
 * TEST 3: Native element ref
 */
const divRef = ref<HTMLDivElement>();
const _divRefType: WritableSignal<HTMLDivElement | undefined> = divRef;

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
const _tooltipRefType: WritableSignal<{ toggle: () => void } | undefined> = tooltipRef;

/**
 * TEST 5: Directive without expose
 */
const ripple = directive<HTMLElement>()({
  setup: (_props, { host }) => {
    const _hostEl: Signal<HTMLElement> = host;
  },
});

const rippleRef = ref(ripple);
const _rippleRefType: WritableSignal<undefined> = rippleRef;

/**
 * TEST 6: refMany
 */
const manyChildren = refMany(Child);
const _manyType: WritableSignal<{ text: Signal<string> }[]> = manyChildren;

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
