import {
  type Signal,
  type InputSignal,
  type ModelSignal,
  type OutputEmitterRef,
  signal,
  computed,
  input,
  model,
  output,
  afterNextRender,
} from '@angular/core';

import {
  type BindingValue,
  type Ref,
  type InjectionToken,
  component,
  directive,
  derivation,
  defineBindings,
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
// COMPONENT — expose with inputs
//
// Inputs can be surfaced directly through expose, making them
// accessible via ref. Since InputSignal<T> extends Signal<T>,
// they are naturally read-only.
// ────────────────────────────────────────────────────────────────

const ExposedInput = component({
  bindings: {
    name: input.required<string>(),
    age: input<number>(),
  },
  setup: ({ name, age }) => ({
    template: '...',
    expose: { name, age },
  }),
});

const exposedInputRef = ref(ExposedInput);
const _exposedName: InputSignal<string> | undefined = exposedInputRef()?.name;
const _exposedAge: InputSignal<number | undefined> | undefined = exposedInputRef()?.age;

// Mixed: inputs + local signals in expose
const MixedExpose = component({
  bindings: {
    label: input.required<string>(),
    count: model<number>(),
  },
  setup: ({ label, count }) => {
    const doubled = computed(() => (count() ?? 0) * 2);

    return {
      template: '...',
      expose: { label, doubled },
    };
  },
});

const mixedRef = ref(MixedExpose);
const _mixedLabel: InputSignal<string> | undefined = mixedRef()?.label;
const _mixedDoubled: Signal<number> | undefined = mixedRef()?.doubled;

// Directive exposing its input
const highlight = directive({
  host: ref<HTMLElement>(),
  bindings: {
    color: input.required<string>(),
  },
  setup: ({ color }, { host }) => ({ color }),
});

const highlightRef = ref(highlight);
const _highlightColor: InputSignal<string> | undefined = highlightRef()?.color;

// ────────────────────────────────────────────────────────────────
// COMPONENT — wrapper with generic target and spread
//
// Explicit opt-in via component.wrap<typeof Target>().
// Setup receives unwrapped plain values (not signals) so that
// ...rest can be spread directly onto the target in the template.
// This is intentionally different from the standard overload:
// wrapper components forward bindings, they don't own them.
// ────────────────────────────────────────────────────────────────

const UserDetailWrapper = component.wrap<typeof UserDetail>({
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user, ...rest }) => {
    const _u: User = user;
    const _r: { email: string; makeAdmin: void; children: void; attachments: HTMLElement } = rest;
    const other = computed(() => user);
    return { template: '...' };
  },
});

// rest should NOT contain explicitly destructured keys
const _NegRest = component.wrap<typeof UserDetail>({
  bindings: { user: input.required<User>() },
  setup: ({ user, ...rest }) => {
    // @ts-expect-error user was destructured, not in rest
    rest.user;
    return { template: '...' };
  },
});

// bindings should NOT accept keys outside the target type
const _NegExtra = component.wrap<typeof UserDetail>({
  bindings: {
    user: input.required<User>(),
    // @ts-expect-error nonsense is not in target bindings
    nonsense: input<string>(),
  },
  setup: ({ user, ...rest }) => ({ template: '...' }),
});

// bindings should NOT accept wrong inner types
const _NegWrongType = component.wrap<typeof UserDetail>({
  bindings: {
    // @ts-expect-error user input type should be User
    user: input.required<string>(),
  },
  setup: ({ user, ...rest }) => ({ template: '...' }),
});

// bindings should preserve target binding kind
const _NegWrongKind = component.wrap<typeof UserDetail>({
  bindings: {
    // @ts-expect-error makeAdmin is an output on target, not an input
    makeAdmin: input<void>(),
  },
  setup: ({ makeAdmin }) => ({ template: '...' }),
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

// Wrapper providers should receive inputs only (target-kind aware)
const WrapperProviders = component.wrap<typeof UserDetail>({
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user, email, makeAdmin, children, attachments }) => ({ template: '...' }),
  providers: (inputs) => {
    const _user: User = inputs.user;
    // @ts-expect-error email is model on target, excluded from wrapper providers
    inputs.email;
    // @ts-expect-error makeAdmin is output on target, excluded from wrapper providers
    inputs.makeAdmin;
    // @ts-expect-error children is fragment on target, excluded from wrapper providers
    inputs.children;
    // @ts-expect-error attachments is directives on target, excluded from wrapper providers
    inputs.attachments;
    return [];
  },
});

// ────────────────────────────────────────────────────────────────
// DIRECTIVE — host as separate config, expose
//
// host is a top-level config property (not a binding) because it
// is framework-provided context, not consumer-bindable.
// setup receives bindings as first arg, { host } as second.
// ────────────────────────────────────────────────────────────────

// Directive with expose
const tooltip = directive({
  host: ref<HTMLElement>(),
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ message, dismiss }, { host }) => {
    const _hostEl: Ref<HTMLElement | undefined> = host;
    const _msg: string = message();
    dismiss.emit();

    return { toggle: () => {} };
  },
});

// Directive without bindings
const ripple = directive({
  host: ref<HTMLElement>(),
  setup: (_props, { host }) => {
    const _hostEl: Ref<HTMLElement | undefined> = host;
  },
});

// Host type constraint: narrows to specific element type
const buttonOnly = directive({
  host: ref<HTMLButtonElement>(),
  bindings: {
    label: input<string>(),
  },
  setup: ({ label }, { host }) => {
    const _hostEl: Ref<HTMLButtonElement | undefined> = host;
    const _l: string | undefined = label();
  },
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

// refMany without expose
const manyNoExpose = refMany(NoExpose);
const _manyNoExposeType: Ref<undefined[]> = manyNoExpose;

const manyRipple = refMany(ripple);
const _manyRippleType: Ref<undefined[]> = manyRipple;

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

// ────────────────────────────────────────────────────────────────
// SHORT MODE IDEA — defineBindings (see authoring-format.md)
//
// Prototype only: validates authoring-time type inference parity.
// Compiler constraints listed in authoring-format.md are intentionally
// not enforced by TypeScript alone.
// ────────────────────────────────────────────────────────────────

const ShortModeParity = component({
  setup: () => {
    const { user, email, makeAdmin, children, attachments } = defineBindings({
      user: input.required<User>(),
      email: model.required<string>(),
      makeAdmin: output<void>(),
      children: fragment<void>(),
      attachments: directives<HTMLElement>(),
    });

    const _u: User = user();
    const _e: string = email();
    email.set('next');
    makeAdmin.emit();
    const _c: void = children.__fragment;
    const _a: HTMLElement = attachments.__directives;

    return { template: '...' };
  },
});

// Optional input parity
const ShortModeOptional = component({
  setup: () => {
    const { count } = defineBindings({
      count: input<number>(),
    });

    const _count: number | undefined = count();
    return { template: '...' };
  },
});

// Compiler-only diagnostics (documented in authoring-format.md):
// - mixing `bindings` and defineBindings in one component
// - multiple defineBindings calls
// - defineBindings not top-level in setup
// - using defineBindings in component.wrap
// - using defineBindings in a component with providers
// - duplicate binding keys
// - declaring reserved framework names explicitly
// - aliasing/importing defineBindings as userland symbol

// ────────────────────────────────────────────────────────────────
// INTERFACE CONFORMANCE — satisfies on bindings and expose
//
// Opt-in structural check, same as class implements:
// the developer chooses to add satisfies, TS validates the shape.
//
// satisfies applies excess-property checking on object literals,
// so the interface must cover all keys in the object — or use
// an intersection with Record<string, BindingValue> to allow
// extra keys.
// ────────────────────────────────────────────────────────────────

// -- Bindings conformance: component --------------

interface Sortable {
  sortKey: InputSignal<string>;
  sortDirection: InputSignal<'asc' | 'desc'>;
}

// Exact match: all bindings are in the interface
const SortableTable = component({
  bindings: {
    sortKey: input.required<string>(),
    sortDirection: input.required<'asc' | 'desc'>(),
  } satisfies Sortable,
  setup: ({ sortKey, sortDirection }) => ({ template: '...' }),
});

// Extra bindings: interface + Record allows additional keys
const SortableTableExtra = component({
  bindings: {
    sortKey: input.required<string>(),
    sortDirection: input.required<'asc' | 'desc'>(),
    pageSize: input<number>(),
  } satisfies Sortable & Record<string, BindingValue>,
  setup: ({ sortKey, sortDirection, pageSize }) => ({ template: '...' }),
});

// -- Bindings conformance: multiple interfaces ----

interface Paginated {
  page: InputSignal<number>;
  pageSize: InputSignal<number>;
}

const SortablePaginatedTable = component({
  bindings: {
    sortKey: input.required<string>(),
    sortDirection: input.required<'asc' | 'desc'>(),
    page: input.required<number>(),
    pageSize: input.required<number>(),
  } satisfies Sortable & Paginated,
  setup: ({ sortKey, sortDirection, page, pageSize }) => ({ template: '...' }),
});

// -- Bindings conformance: directive --------------

interface Dismissable {
  message: InputSignal<string>;
  dismiss: OutputEmitterRef<void>;
}

const dismissableTooltip = directive({
  host: ref<HTMLElement>(),
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  } satisfies Dismissable,
  setup: ({ message, dismiss }, { host }) => {},
});

// -- Bindings conformance: derivation -------------

interface QuantityBound {
  qty: InputSignal<number>;
  item: InputSignal<Item>;
}

const quantityDerivation = derivation({
  bindings: {
    qty: input.required<number>(),
    item: input.required<Item>(),
  } satisfies QuantityBound,
  setup: ({ qty, item }) => computed(() => qty() * 2),
});

// -- Expose conformance: component ----------------

interface Toggleable {
  toggle: () => void;
  isOpen: Signal<boolean>;
}

const Accordion = component({
  setup: () => {
    const open = signal(false);

    return {
      template: '...',
      expose: {
        toggle: () => open.update(v => !v),
        isOpen: open.asReadonly(),
      } satisfies Toggleable,
    };
  },
});

// ref infers expose correctly through satisfies
const accordionRef = ref(Accordion);
const _accordionRefType: Ref<Toggleable | undefined> = accordionRef;

// -- Expose conformance: directive ----------------

const toggleDirective = directive({
  host: ref<HTMLElement>(),
  setup: (_props, { host }) => {
    const open = signal(false);

    return {
      toggle: () => open.update(v => !v),
      isOpen: open.asReadonly(),
    } satisfies Toggleable;
  },
});

const toggleDirRef = ref(toggleDirective);
const _toggleDirRefType: Ref<Toggleable | undefined> = toggleDirRef;

// -- Negative: missing key in bindings ------------

const _NegMissingKey = component({
  bindings: {
    sortKey: input.required<string>(),
    // @ts-expect-error sortDirection is missing from Sortable
  } satisfies Sortable,
  setup: ({ sortKey }) => ({ template: '...' }),
});

// -- Negative: wrong type in bindings -------------

const _NegWrongBindingType = component({
  bindings: {
    sortKey: input.required<string>(),
    // @ts-expect-error sortDirection should be InputSignal<'asc' | 'desc'>, not InputSignal<number>
    sortDirection: input<number>(),
  } satisfies Sortable,
  setup: ({ sortKey, sortDirection }) => ({ template: '...' }),
});

// -- Negative: missing key in expose --------------

const _NegMissingExpose = component({
  setup: () => ({
    template: '...',
    expose: {
      toggle: () => {},
      // @ts-expect-error isOpen is missing from Toggleable
    } satisfies Toggleable,
  }),
});
