import {
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  afterNextRender,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import {
  type AttachableBinding,
  type ComponentBindingValue,
  type DerivationInstance,
  type FragmentBinding,
  type InjectionToken,
  type OptionalFragmentBinding,
  type Ref,
  type RequiredFragmentBinding,
  type TemplateMarkup,
  attachable,
  component,
  derivation,
  directive,
  fragment,
  inject,
  injectionToken,
  provide,
  ref,
  refMany,
} from './types';

declare const tmpl: TemplateMarkup;

interface User { id: string; name: string; }
interface Item { id: string; desc: string; }

// ────────────────────────────────────────────────────────────────
// TEST HELPERS
// ────────────────────────────────────────────────────────────────

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type MergeProps<Left, Right> = Omit<Left, keyof Right> & Right;

// ────────────────────────────────────────────────────────────────
// BRANDED TYPE NOMINALITY
//
// FragmentBinding and AttachableBinding must be distinct nominal
// types — not structurally assignable to each other.
//
// NOTE on Directive Attachments semantics:
// The element-type parameter T in AttachableBinding<T> is the
// Sink constraint checked by the compiler at build time.
// ────────────────────────────────────────────────────────────────

type FragIsDir = FragmentBinding<void> extends AttachableBinding<any> ? 'LEAK' : 'OK';
const _fragIsDir: FragIsDir = 'OK';

type DirIsFrag = AttachableBinding<HTMLElement> extends FragmentBinding<any> ? 'LEAK' : 'OK';
const _dirIsFrag: DirIsFrag = 'OK';

type SameInner = FragmentBinding<HTMLElement> extends AttachableBinding<HTMLElement> ? 'LEAK' : 'OK';
const _sameInner: SameInner = 'OK';

// Required vs optional fragment are distinct types
type ReqIsOpt = RequiredFragmentBinding<void> extends OptionalFragmentBinding<void> ? 'LEAK' : 'OK';
const _reqIsOpt: ReqIsOpt = 'OK';

type OptIsReq = OptionalFragmentBinding<void> extends RequiredFragmentBinding<void> ? 'LEAK' : 'OK';
const _optIsReq: OptIsReq = 'OK';

// ────────────────────────────────────────────────────────────────
// DIRECTIVE ATTACHMENTS — element-type compatibility
//
// AttachableBinding<T> is CONTRAVARIANT in T:
// - an attachments binding typed for a broader element type (HTMLElement)
//   is assignable to a narrower sink (HTMLButtonElement),
// - a narrower binding (HTMLButtonElement) is NOT assignable to a broader
//   sink (HTMLElement).
// The check reflects compile-time validation: the element type T
// declared in attachable<T>() constrains which directives are legal at
// the call site. Instantiation itself is deferred to runtime,
// but the type-mismatch is caught at build time.
// ────────────────────────────────────────────────────────────────

// Contravariance on subtype/supertype:
type ButtonSinkAcceptsAnyElement =
  AttachableBinding<HTMLElement> extends AttachableBinding<HTMLButtonElement>
    ? 'OK'
    : 'LEAK';
const _buttonSinkAcceptsAnyElement: ButtonSinkAcceptsAnyElement = 'OK';

type AnyElementSinkAcceptsButtonOnly =
  AttachableBinding<HTMLButtonElement> extends AttachableBinding<HTMLElement>
    ? 'LEAK'
    : 'OK';
const _anyElementSinkAcceptsButtonOnly: AnyElementSinkAcceptsButtonOnly = 'OK';

// Unrelated element types remain incompatible in both directions
type ButtonSinkAcceptsDiv =
  AttachableBinding<HTMLDivElement> extends AttachableBinding<HTMLButtonElement>
    ? 'LEAK'
    : 'OK';
const _buttonSinkAcceptsDiv: ButtonSinkAcceptsDiv = 'OK';

type DivSinkAcceptsButton =
  AttachableBinding<HTMLButtonElement> extends AttachableBinding<HTMLDivElement>
    ? 'LEAK'
    : 'OK';
const _divSinkAcceptsButton: DivSinkAcceptsButton = 'OK';

// A component declaring attachments: attachable<HTMLButtonElement>()
// carries the constraint in its bindings — verified here structurally.
const ButtonSink = component({
  bindings: {
    attachments: attachable<HTMLButtonElement>(),
  },
  setup: ({ attachments }) => {
    // attachments is AttachableBinding<HTMLButtonElement> — not HTMLDivElement
    const _sink: AttachableBinding<HTMLButtonElement> = attachments;
    return tmpl;
  },
});

// Attempting to assign a Div-sink where a Button-sink is expected
// must be a type error.
const _NegDivSinkToButtonSink = component({
  bindings: {
    attachments: attachable<HTMLButtonElement>(),
  },
  setup: ({ attachments }) => {
    // @ts-expect-error AttachableBinding<HTMLDivElement> is not assignable to AttachableBinding<HTMLButtonElement>
    const _sink: AttachableBinding<HTMLDivElement> = attachments;
    return tmpl;
  },
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — basics
// ────────────────────────────────────────────────────────────────

// —— Shorthand return: raw template ——

const Minimal = component({
  setup: () => tmpl,
});

const StyledComp = component({
  setup: () => tmpl,
  style: `.danger { color: red; }`,
});

const StyledUrlComp = component({
  setup: () => tmpl,
  styleUrl: './my-comp.css',
});

const MinimalProviders = component({
  setup: () => tmpl,
  providers: () => [],
});

// —— Full form return: { template } ——

const MinimalFull = component({
  setup: () => ({ template: tmpl }),
});

const MinimalFullProviders = component({
  setup: () => ({ template: tmpl }),
  providers: () => [],
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — bindings (input, model, output, fragment, attachable)
//
// Setup receives raw Angular types: InputSignal, ModelSignal,
// OutputEmitterRef, FragmentBinding, AttachableBinding.
// ────────────────────────────────────────────────────────────────

const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
    attachments: attachable<HTMLElement>(),
  },
  setup: ({ user, email, makeAdmin, children, attachments }) => {
    const _u: User = user();
    const _e: string = email();
    const _children: OptionalFragmentBinding<void> | undefined = children;
    const _rendered = children?.();
    email.set('new');
    makeAdmin.emit();
    return tmpl;
  },
});

// fragment.required: children must be present in setup
const RequiredChildren = component({
  bindings: {
    children: fragment.required<void>(),
  },
  setup: ({ children }) => {
    const _c: RequiredFragmentBinding<void> = children;
    const _rendered = children();
    // @ts-expect-error required fragment is not assignable to optional fragment shape
    const _mustBeOptional: OptionalFragmentBinding<void> | undefined = children;
    return tmpl;
  },
});

// Reserved names enforcement on component bindings:
// - children must be fragment(...)
// - attachments must be attachable(...)
// @ts-expect-error reserved name "children" must use fragment(...)
const _NegChildrenMustBeFragment = component({
  bindings: {
    children: input<string>(),
  },
  setup: () => tmpl,
});

// @ts-expect-error reserved name "attachments" must use attachable(...)
const _NegAttachmentsMustBeAttachable = component({
  bindings: {
    attachments: input<string>(),
  },
  setup: () => tmpl,
});

// Parameterized fragment: callable with declared arguments
const RenderItem = component({
  bindings: {
    itemTpl: fragment.required<[Item]>(),
  },
  setup: ({ itemTpl }) => {
    const _ok = itemTpl({ id: '1', desc: 'A' });
    // @ts-expect-error missing required argument
    itemTpl();
    return tmpl;
  },
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — providers receive only inputs (not models/outputs)
// ────────────────────────────────────────────────────────────────

class Store {}

// All five binding kinds: providers excludes everything except InputSignal
const AllBindingKinds = component({
  bindings: {
    a: input.required<string>(),
    b: model<string>(),
    c: output<void>(),
    d: fragment<void>(),
    e: attachable<HTMLElement>(),
  },
  setup: (b) => tmpl,
  providers: (inputs) => {
    const _a: InputSignal<string> = inputs.a;
    // @ts-expect-error b is model, excluded from providers
    inputs.b;
    // @ts-expect-error c is output, excluded from providers
    inputs.c;
    // @ts-expect-error d is fragment, excluded from providers
    inputs.d;
    // @ts-expect-error e is attachable, excluded from providers
    inputs.e;
    return [];
  },
});

// Output-only + model-only: providers has zero keys
const OutputModelOnly = component({
  bindings: {
    change: output<string>(),
    val: model<number>(),
  },
  setup: ({ change, val }) => tmpl,
  providers: (inputs) => {
    type Keys = keyof typeof inputs;
    const _check: Keys = undefined as never;
    return [];
  },
});

const Counter = component({
  bindings: {
    c: input.required<number>(),
  },
  setup: () => tmpl,
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
  setup: ({ name, age, email, save }) => tmpl,
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
// COMPONENT — expose
//
// expose defines the public interface accessible via ref and
// inject. Components without expose resolve to void / undefined.
// ────────────────────────────────────────────────────────────────

const Child = component({
  setup: () => {
    const text = signal('');
    const _internal = signal(0);

    return {
      template: tmpl,
      expose: { text: text.asReadonly() },
    };
  },
});

// Shorthand: no expose → raw template
const NoExpose = component({
  setup: () => tmpl,
});

// ────────────────────────────────────────────────────────────────
// COMPONENT — wrapper with selected bindings + rest forwarding token
//
// Target passed as first arg; C is inferred from the value
// (consistent with ref(Child), inject(Child), etc.).
// setup receives selected bindings in arg1 and { rest } in arg2.
// rest is a compile-time forwarding token used in <Target {...rest} />.
// No runtime object spread is modeled here.
// ────────────────────────────────────────────────────────────────

const UserDetailWrapper = component.wrap(UserDetail, {
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user }, { rest }) => {
    const _u: User = user();
    const other = computed(() => user());
    return tmpl;
  },
});

// setup first arg includes only selected keys
const _NegSelectedOnly = component.wrap(UserDetail, {
  bindings: { user: input.required<User>() },
  setup: ({
    user,
    // @ts-expect-error email is not selected in wrapper bindings
    email,
  }) => tmpl,
});

// rest is opaque and not inspectable
const _NegRestInspect = component.wrap(UserDetail, {
  bindings: { user: input.required<User>() },
  setup: ({ user }, { rest }) => {
    // @ts-expect-error rest is forwarding-only token; key inspection is invalid
    rest.email;
    return tmpl;
  },
});

// bindings should NOT accept keys outside the target type
const _NegExtra = component.wrap(UserDetail, {
  bindings: {
    user: input.required<User>(),
    // @ts-expect-error nonsense is not in target bindings
    nonsense: input<string>(),
  },
  setup: ({ user }, { rest }) => tmpl,
});

// bindings should NOT accept wrong inner types
const _NegWrongType = component.wrap(UserDetail, {
  bindings: {
    // @ts-expect-error user input type should be User
    user: input.required<string>(),
  },
  setup: ({ user }, { rest }) => tmpl,
});

// bindings should preserve target binding kind
const _NegWrongKind = component.wrap(UserDetail, {
  bindings: {
    // @ts-expect-error makeAdmin is an output on target, not an input
    makeAdmin: input<void>(),
  },
  setup: ({ makeAdmin }, { rest }) => tmpl,
});

// Wrap with empty selected bindings: all target bindings forwarded via rest token
interface Simple { id: string; }

const Base = component({
  bindings: {
    item: input.required<Simple>(),
    selected: model<boolean>(),
    click: output<void>(),
  },
  setup: ({ item, selected, click }) => tmpl,
});

const PassThrough = component.wrap(Base, {
  bindings: {},
  setup: ({}, { rest }) => {
    // @ts-expect-error rest is forwarding-only token; no property reads
    rest.item;
    return tmpl;
  },
});

// Wrapper providers should receive selected inputs only (Option A)
const WrapperProviders = component.wrap(UserDetail, {
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user }, { rest }) => tmpl,
  providers: (inputs) => {
    const _user: InputSignal<User> = inputs.user;
    // @ts-expect-error email is not selected, excluded from wrapper providers
    inputs.email;
    // @ts-expect-error makeAdmin is not selected, excluded from wrapper providers
    inputs.makeAdmin;
    // @ts-expect-error children is not selected, excluded from wrapper providers
    inputs.children;
    // @ts-expect-error attachments is not selected, excluded from wrapper providers
    inputs.attachments;
    return [];
  },
});

// Wrapper providers expose only selected INPUT bindings, even if selected
// bindings include models/outputs.
const WrapperProvidersSelectedKinds = component.wrap(Base, {
  bindings: {
    item: input.required<Simple>(),
    selected: model<boolean>(),
    click: output<void>(),
  },
  setup: ({ item, selected, click }, { rest }) => tmpl,
  providers: (inputs) => {
    const _item: InputSignal<Simple> = inputs.item;
    // @ts-expect-error selected is a model, excluded from providers
    inputs.selected;
    // @ts-expect-error click is an output, excluded from providers
    inputs.click;
    return [];
  },
});

// ────────────────────────────────────────────────────────────────
// TEMPLATE SPREAD COLLISION PRECEDENCE (compiler contract)
//
// Rule: React-style "last wins".
// Example:
//   <Target {...rest} user={explicit} />  -> explicit wins for `user`
//   <Target user={explicit} {...rest} />  -> rest wins for `user`
//
// This is a compile-time lowering contract for the template compiler.
// The tests below model that merge order with plain TS object spreads.
// ────────────────────────────────────────────────────────────────

type FromSpread = {
  user: 'spread';
  email: 'spread-email';
  click: 'spread-click';
};

type FromExplicit = {
  user: 'explicit';
};

// <Target {...rest} user={explicit} />
type SpreadThenExplicit = MergeProps<FromSpread, FromExplicit>;
type _SpreadThenExplicitUser = Assert<IsEqual<SpreadThenExplicit['user'], 'explicit'>>;
type _SpreadThenExplicitKeepsOthers = Assert<IsEqual<SpreadThenExplicit['email'], 'spread-email'>>;

// <Target user={explicit} {...rest} />
type ExplicitThenSpread = MergeProps<FromExplicit, FromSpread>;
type _ExplicitThenSpreadUser = Assert<IsEqual<ExplicitThenSpread['user'], 'spread'>>;
type _ExplicitThenSpreadKeepsOthers = Assert<IsEqual<ExplicitThenSpread['click'], 'spread-click'>>;

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
  setup: ({}, { host }) => {
    const _hostEl: Ref<HTMLElement | undefined> = host;
  },
});

// Directive with void expose: ref resolves to Ref<undefined>
const voidDir = directive({
  host: ref<HTMLElement>(),
  setup: ({}, { host }) => {},
});
const voidDirRef = ref(voidDir);
const _voidDirCheck: Ref<undefined> = voidDirRef;

// Directive expose flows through ref with correct type
const typedDir = directive({
  host: ref<HTMLButtonElement>(),
  bindings: { label: input<string>() },
  setup: ({ label }, { host }) => ({ getLabel: () => label() }),
});
const typedDirRef = ref(typedDir);
const _typedDirRefCheck: Ref<{ getLabel: () => string | undefined } | undefined> = typedDirRef;

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

// Directive accepts fragment bindings (TemplateRef-style use cases)
const directiveWithFragment = directive({
  host: ref<HTMLElement>(),
  bindings: {
    content: fragment.required<void>(),
  },
  setup: ({ content }, { host }) => {
    const _content: RequiredFragmentBinding<void> = content;
    const _rendered = content();
    const _host: Ref<HTMLElement | undefined> = host;
  },
});

// Directive must reject attachable bindings
// @ts-expect-error directives cannot declare attachable bindings
const _NegDirectiveAttachable = directive({
  host: ref<HTMLElement>(),
  bindings: {
    attachments: attachable<HTMLElement>(),
  },
  setup: (_bindings, _context) => {},
});

// Directive must reject attachable bindings regardless of binding key name
// (defensive check against component-reserved name confusion).
// @ts-expect-error directives cannot declare attachable bindings
const _NegDirectiveChildrenAttachable = directive({
  host: ref<HTMLElement>(),
  bindings: {
    children: attachable<HTMLElement>(),
  },
  setup: (_bindings, _context) => {},
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

const _simType: DerivationInstance<{ qty: InputSignal<number>; item: InputSignal<Item> }, string> = simulation;

// Derivation without bindings: setup receives no args
const simple = derivation({
  setup: () => computed(() => 42),
});

const _simpleType: DerivationInstance<{}, number> = simple;

// Derivation must reject non-input bindings
// @ts-expect-error derivations cannot declare model bindings
const _NegDerivationNonInput = derivation({
  bindings: {
    changed: model<number>(),
  },
  setup: () => computed(() => 1),
});

// @ts-expect-error derivations cannot declare output bindings
const _NegDerivationOutput = derivation({
  bindings: {
    changed: output<number>(),
  },
  setup: () => computed(() => 1),
});

// @ts-expect-error derivations cannot declare fragment bindings
const _NegDerivationFragment = derivation({
  bindings: {
    content: fragment<void>(),
  },
  setup: () => computed(() => 1),
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

// Expose with inputs: inputs surfaced through expose
const ExposedInput = component({
  bindings: {
    name: input.required<string>(),
    age: input<number>(),
  },
  setup: ({ name, age }) => ({
    template: tmpl,
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
      template: tmpl,
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

// Void expose through ref: resolves to Ref<undefined>, not Ref<void | undefined>
const voidExposeRef = ref(NoExpose);
const _voidExposeCheck: Ref<undefined> = voidExposeRef;

// Passing a ref as an input
const Sibling = component({
  bindings: {
    childRef: input<{ text: Signal<string> } | undefined>(),
  },
  setup: ({ childRef }) => {
    const _val = childRef();
    return tmpl;
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

    return tmpl;
  },
});

// ────────────────────────────────────────────────────────────────
// DI — injection tokens, inject, provide
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

// Invalid token configuration combinations
// @ts-expect-error token cannot be both root-level and multi
const _NegTokenRootAndMulti = injectionToken('desc', {
  level: 'root',
  multi: true,
  factory: () => 1,
});

// inject(Component) → expose type
const _injectedChild: { text: Signal<string> } = inject(Child);

// inject(Component without expose) → void
const _injectedNoExpose: void = inject(NoExpose);

// inject(Directive) → expose type
const _injectedTooltip: { toggle: () => void } = inject(tooltip);

// inject(InjectionToken) → token type
const _injectedComp: { value: Signal<number>; increase: () => void } = inject(compToken);
const _injectedMulti: number[] = inject(multiToken);

// inject(Class) → class instance
const _injectedStore: Store = inject(Store);

// provide — shorthand and object form
const _providers = [
  provide(compToken),
  provide(multiToken),
  provide({ token: multiToken, useFactory: () => 10 }),
  provide({ token: Store, useFactory: () => new Store() }),
];

// Multi provide factory returns a single item, not an array.
// @ts-expect-error useFactory for multi token must return number, not number[]
provide({ token: multiToken, useFactory: () => [1, 2, 3] });

// ────────────────────────────────────────────────────────────────
// INTERFACE CONFORMANCE — satisfies on bindings and expose
//
// Opt-in structural check, same as class implements:
// the developer chooses to add satisfies, TS validates the shape.
//
// satisfies applies excess-property checking on object literals,
// so the interface must cover all keys in the object — or use
// an intersection with Record<string, ComponentBindingValue>
// to allow extra keys in the component binding surface.
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
  setup: ({ sortKey, sortDirection }) => tmpl,
});

// Extra bindings: interface + Record allows additional keys
const SortableTableExtra = component({
  bindings: {
    sortKey: input.required<string>(),
    sortDirection: input.required<'asc' | 'desc'>(),
    pageSize: input<number>(),
  } satisfies Sortable & Record<string, ComponentBindingValue>,
  setup: ({ sortKey, sortDirection, pageSize }) => tmpl,
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
  setup: ({ sortKey, sortDirection, page, pageSize }) => tmpl,
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
      template: tmpl,
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
  setup: ({}, { host }) => {
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
  setup: ({ sortKey }) => tmpl,
});

// -- Negative: wrong type in bindings -------------

const _NegWrongBindingType = component({
  bindings: {
    sortKey: input.required<string>(),
    // @ts-expect-error sortDirection should be InputSignal<'asc' | 'desc'>, not InputSignal<number>
    sortDirection: input<number>(),
  } satisfies Sortable,
  setup: ({ sortKey, sortDirection }) => tmpl,
});

// -- Negative: missing key in expose --------------

const _NegMissingExpose = component({
  setup: () => ({
    template: tmpl,
    expose: {
      toggle: () => {},
      // @ts-expect-error isOpen is missing from Toggleable
    } satisfies Toggleable,
  }),
});
