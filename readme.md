# Anatomy of Signal Components
**⚠️ Note ⚠️: personal thoughts from a developer's perspective on [the future of Angular](https://myconf.dev/videos/2024-keynote-session-the-future-of-angular) at the template level.**

Highlights:
1. building blocks as functions:
    - `*.ng` files with template DSL (see [`authoring format`](https://github.com/mauriziocescon/ng-outlook/blob/main/authoring-format.md)),
    - `component`: a `setup` with scoped logic that returns a `template` or `{ template, expose }`,
    - `directive`: a `setup` that can change the appearance or behavior of DOM elements,
    - `derivation`: a factory for template-scoped computed values that requires DI,
    - `fragment`: a way to capture some markup in the form of a function,
2. TS expressions with `{}`: bindings + text interpolation
3. extra bindings for DOM elements: `bind:`, `on:`, `model:`, `class:`, `style:`, `animate:`, `use:`,
4. hostless components + TS lexical scoping for templates,
5. component inputs: lifted up + immediately available in setup and providers,
6. Composition with Fragments, Directives, and Spread syntax,
7. Expose and Template Refs,
8. Dependency Injection Enhancements,
9. final considerations (`!important`) + [`experimental types`](https://github.com/mauriziocescon/ng-outlook/blob/main/experimental/types.ts).

**Template syntax note**: the template syntax in the examples below resembles TSX syntactically but is Angular DSL — not JSX. It supports Angular control flow, directives, and custom bindings.

<details>
  <summary><strong>Table of contents</strong></summary>

- [Component structure and bindings](#component-structure-and-bindings)
- [Element directives](#element-directives)
- [Template-Scoped Derivations (`@derive`)](#template-scoped-derivations-derive)
- [Binding syntax helpers](#binding-syntax-helpers)
- [One-time bindings (`once:`)](#one-time-bindings-once)
- [Input-driven providers](#input-driven-providers)
- [Composition with Fragments, Directives, and Spread syntax](#composition-with-fragments-directives-and-spread-syntax)
- [Expose and Template Refs](#expose-and-template-refs)
- [Dependency Injection Enhancements](#dependency-injection-enhancements)
- [Final considerations](#final-considerations)

</details>

## Component structure and bindings
`setup` runs once in an injection context. All bindings are wired and available immediately; destructuring is optional:
```ts
import { component, signal, linkedSignal, input, output } from '@angular/core';

export const TextSearch = component({
  bindings: {
    value: input.required<string>(),
    valueChange: output<string>(),
  },
  setup: ({ value, valueChange }) => {
    const text = linkedSignal(() => value());
    const isDanger = signal(false);

    function textChange() {
      valueChange.emit(text());
    }

    /**
     * - 1way: bind:property={var} (bind: can be omitted)
     * - 2way: model:property={var} (input / select / textarea)
     * - events: on:event_name={handler}
     *
     * Cannot duplicate attribute names: only one (static or bound)
     * ‼️ <span class="..." class="..." class={...}> ‼️
     * ‼️ <span on:click={...} on:click={...}> ‼️
     *
     * Can use multiple class: and style:
     * ✅ <span class="..." class:some-class={...} class:some-other-class={...}> ✅
     */
    return (
      <label class:danger={isDanger()}>Text:</label>
      <input type="text" model:value={text} on:input={textChange} />

      <button disabled={text().length === 0} on:click={() => text.set('')}>
        {'Reset ' + text()}
      </button>
    );
  },
  style: `
    .danger {
      color: red;
    }
  `,
});
```

Any component can be used in the template; `bind:`, `model:`, and `on:` behave the same as for native elements:
```ts
import { component, signal } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  setup: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);

    function makeAdmin() {/** ... **/}

    /**
     * ⚠️ Must provide all required inputs / models ⚠️
     *
     * Cannot duplicate binding names: only one
     * ‼️ <UserDetail user={...} user={...} model:user={...} /> ‼️
     * ‼️ <UserDetail on:makeAdmin={...} on:makeAdmin={...} /> ‼️
     *
     * Shouldn't use 'on' prefix with input / model / output
     * ⚠️ <UserDetail onInput={...} model:onModel={...} on:onEvent={...} /> ⚠️
     */
    return (
      <UserDetail
        user={user()}
        model:email={email}
        on:makeAdmin={makeAdmin} />
    );
  },
});

// -- UserDetail -----------------------------------
import { component, input, model, output } from '@angular/core';

export interface User {/** ... **/}

export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model<string>(),
    makeAdmin: output<void>(),
  },
  setup: (bindings) => (
    // bindings.user, bindings.email, bindings.makeAdmin
  ),
});
```

Lexical scoping resolves in this order: template → setup → functions, constants, enums, and interfaces imported in the file → global.
```ts
import { component } from '@angular/core';

enum Type {
  Counter = 'counter',
  Other = 'other',
}

const type = Type.Counter;

const counter = (value: number) => `Let's count till ${value}`;

export const Counter = component({
  setup: () => (
    @if (type === Type.Counter) {
      <p>{counter(5)}</p>
    } @else {
      <span>Empty</span>
    }
  ),
});
```

## Element directives
Change the appearance or behavior of DOM elements:
```ts
import { component, signal } from '@angular/core';
import { tooltip } from '@mylib/tooltip';

export const TextSearch = component({
  setup: () => {
    const text = signal('');
    const message = signal('Message');

    function valueChange() {/** ... **/}
    function doSomething() {/** ... **/}

    /**
     * Encapsulation of directive data: use:directive(...)
     * Any directive can be used directly in the template
     */
    return (
      <input
        type="text"
        model:value={text}
        on:input={valueChange}
        use:tooltip(message={message()} on:dismiss={doSomething}) />

      <p>Value: {text()}</p>
    );
  },
});

// -- tooltip in @mylib/tooltip --------------------
import { directive, ref, input, output, inject, DestroyRef, Renderer2, afterRenderEffect } from '@angular/core';

export const tooltip = directive({
  /**
   * Host element constraint, resolved by the framework.
   * Determines which elements this directive can be applied to.
   */
  host: ref<HTMLElement>(),
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ message, dismiss }, { host }) => {
    const destroyRef = inject(DestroyRef);
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      const hostEl: HTMLElement | undefined = host();
      // something with hostEl
    });

    destroyRef.onDestroy(() => {
      // cleanup logic
    });
  },
});
```

## Template-Scoped Derivations (`@derive`)
`@derive` creates a template-scoped reactive computation, establishing an injection context before calling the derivation's `setup`. It follows the lifecycle of the enclosing view:
```ts
import { component, derivation, computed, inject, input } from '@angular/core';
import { Item, PriceManager } from '@mylib/item';

const simulation = derivation({
  bindings: {
    /**
     * Only inputs are allowed: a derivation has no DOM host,
     * so there is no surface to emit outputs or sync models against
     */
    item: input.required<Item>(),
    qty: input.required<number>(),
  },
  /**
   * setup always returns Signal<T> (e.g. computed)
   */
  setup: ({ item, qty }) => {
    const priceManager = inject(PriceManager);

    return computed(() => priceManager.computePrice(item(), qty()));
  },
});

export const PriceSimulator = component({
  bindings: {
    items: input.required<Item[]>(),
  },
  setup: ({ items }) => {
    /**
     * Any derivation can be used directly in the template via @derive
     *
     * price shares the @for embedded view scope and is created once,
     * following its lifecycle
     */
    return (
      @for (item of items(); track item.id) {
        @derive price = simulation(item={item} qty={1});

        <h5>{item.desc}</h5>
        <div>Price: {price()}</div>
      }
    );
  },
});
```

## Binding syntax helpers
- **Name-matching**: omit the value when the local variable name matches the binding; type inferred from the signal kind — `Signal<T>` for inputs, `WritableSignal<T>` for models, `() => void` for outputs.
- **One-time shorthand**: `once:` also supports name-matching shorthand (`once:{user}`).
- **`:when`**: conditionally applies a `use:` binding; sits outside the directive's inputs and cannot clash with them.

```ts
import { component, signal } from '@angular/core';
import { tooltip } from '@mylib/tooltip';
import { UserDetail, User } from './user-detail.ng';

export const UserCard = component({
  setup: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);
    const showTip = signal(true);
    const tip = signal('View details');

    function userChange() {/** ... **/}

    return (
      // explicit form — always works
      <UserDetail
        user={user()}
        model:email={email}
        on:userChange={userChange}
        use:tooltip(message={tip()}):when={showTip()} />

      // shorthand — when local variable names match binding names
      <UserDetail
        {user}
        model:{email}
        on:{userChange}
        use:tooltip(message={tip()}):when={showTip()} />
    );
  },
});
```

## One-time bindings (`once:`)
`once:` lets the consumer freeze an input at creation time. The value is seeded once and never updated, even if the source signal changes later. Rules:
- `once:` applies only to inputs.
- `once:model:*` and `once:on:*` are compile-time errors.
- `once:prop` and `prop` together on the same element are a duplicate binding error.
- Name-matching shorthand also works: `once:{user}`.

```ts
import { component, signal } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  setup: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);

    function makeAdmin() {/** ... **/}

    return (
      <UserDetail
        once:user={user()}
        model:email={email}
        on:makeAdmin={makeAdmin} />
    );
  },
});
```

## Input-driven providers
Inputs hoisted to the component level for use in provider initialization (`providers` receives only inputs — not models or outputs):
```ts
import { component, linkedSignal, input, WritableSignal, provide, inject } from '@angular/core';

class CounterStore {
  private readonly counter: WritableSignal<number>;
  readonly value = this.counter.asReadonly();

  constructor(c = () => 0) {
    this.counter = linkedSignal(() => c());
  }

  decrease() {/** ... **/}
  increase() {/** ... **/}
}

export const Counter = component({
  bindings: {
    c: input.required<number>(),
  },
  setup: () => {
    const store = inject(CounterStore);

    return (
      <h1>Counter</h1>
      <div>Value: {store.value()}</div>
      <button on:click={() => store.decrease()}>-</button>
      <button on:click={() => store.increase()}>+</button>
    );
  },
  /**
   * Only inputs are provided
   */
  providers: ({ c }) => [
    provide({ token: CounterStore, useFactory: () => new CounterStore(c) }),
  ],
});
```

## Composition with Fragments, Directives, and Spread syntax
Fragments are similar to [Svelte snippets](https://svelte.dev/docs/svelte/snippet): functions that return HTML markup. The returned markup is opaque — it cannot be manipulated like [React Children (legacy)](https://react.dev/reference/react/Children) or [Solid children](https://www.solidjs.com/tutorial/props_children). Directives behave similarly to [Svelte attachments](https://svelte.dev/docs/svelte/@attach). Spread syntax can be used at the component function level, similarly to React. Note: the examples below are simplified.

Implicit children fragment (placement and lifecycle) and binding context:
```ts
import { component, signal } from '@angular/core';
import { Menu, MenuItem } from '@mylib/menu';

export const MenuConsumer = component({
  setup: () => {
    const first = signal('First');
    const second = signal('Second');

    /**
     * Markup inside comp tag => implicitly becomes a fragment called children
     */
    return (
      <Menu>
        <MenuItem>{first()}</MenuItem>
        <MenuItem>{second()}</MenuItem>
      </Menu>
    );
  },
});

// -- Menu in @mylib/menu --------------------------
import { component, fragment } from '@angular/core';

export const Menu = component({
  bindings: {
    /**
     * children = fragment<void>()
     *
     * Nullable function provided by ng (not bindable directly)
     * Name reserved to ng
     */
     children: fragment<void>(),
  },
  setup: ({ children }) => {
    /** ... **/

    /**
     * No ng-container needed; full form: @render(fragment(), { injector })
     */
    return (
      @if (children) {
        @render(children())
      } @else {
        <span>Empty</span>
      }
    );
  },
});

export const MenuItem = component({
  bindings: {
    children: fragment<void>(),
  },
  setup: ({ children }) => (
    @render(children())
  ),
});
```

Customizing components:
```ts
import { component, signal } from '@angular/core';
import { Menu } from '@mylib/menu';
import { MyMenuItem } from './my-menu-item.ng';

export interface Item {
  id: string;
  desc: string;
}

export const MenuConsumer = component({
  setup: () => {
    const items = signal<Item[]>(/** ... **/);

    return (
      /**
       * Explicit form: @fragment declared outside the component tags,
       * then passed as a named binding — equivalent to the inline form below.
       *
       * @fragment menuItem(item: Item) {
       *  <div class="my-menu-item">
       *    <MyMenuItem>{item.desc}</MyMenuItem>
       *  </div>
       * }
       * <Menu items={items()} menuItem={menuItem} />
       * 
       * Inline form: @fragment declared inside the component tags is
       * automatically passed as the matching fragment input — no explicit
       * menuItem={menuItem} needed.
       */
      <Menu items={items()}>
        @fragment menuItem(item: Item) {
          <div class="my-menu-item">
            <MyMenuItem>{item.desc}</MyMenuItem>
          </div>
        }
      </Menu>
    );
  },
  styleUrl: './menu-consumer.css',
});

// -- Menu in @mylib/menu --------------------------
import { component, input, fragment } from '@angular/core';

export const Menu = component({
  bindings: {
    items: input.required<{ id: string, desc: string }[]>(),
    menuItem: fragment<[{ id: string, desc: string }]>(),
  },
  setup: ({ items, menuItem }) => (
    <h1> Total items: {items().length} </h1>

    @for (item of items(); track item.id) {
      @render(menuItem(item))
    }
  ),
});
```

Directives attached to a component and forwarded to an element:
```ts
import { component, signal } from '@angular/core';
import { Button } from '@mylib/button';
import { ripple } from '@mylib/ripple';
import { tooltip } from '@mylib/tooltip';

export const ButtonConsumer = component({
  setup: () => {
    const tooltipMsg = signal('');
    const valid = signal(false);

    function doSomething() {/** ... **/}

    /**
     * The same directive cannot be applied more than once 
     * to the same component / element.
     */
    return (
      <Button
        type="button"
        style="background-color: cyan"
        class={valid() ? 'global-css-valid' : ''}
        use:ripple()
        use:tooltip(message={tooltipMsg()})
        disabled={!valid()}
        on:click={doSomething}>
          Click / Hover me
      </Button>
    );
  },
});

// -- button in @mylib/button --------------------
import { component, input, output, computed, fragment, attachable } from '@angular/core';

export const Button = component({
  bindings: {
    type: input<'button' | 'submit' | 'reset'>('button'),
    class: input<string>(''),
    style: input<string>(''),
    disabled: input<boolean>(false),
    click: output<void>(),
    children: fragment<void>(),
    /**
     * All directives applied to <Button />
     *
     * Readonly signal provided by ng (not bindable directly)
     * Name reserved to ng
     */
    attachments: attachable<HTMLButtonElement>(),
  },
  setup: ({ type, class: className, style, disabled, click, children, attachments }) => {
    const innerStyle = computed(() => `${style()}; color: red;`);

    /**
     * Directive Attachments: directives applied to <Button /> are forwarded
     * and instantiated on the internal <button> element.
     * The element type (HTMLButtonElement) is the only constraint
     * the child needs to declare.
     */
    return (
      <button
        use:attachments
        type={type()}
        class={className()}
        style={innerStyle()}
        disabled={disabled()}
        on:click={() => click.emit()}>
        @render(children())
      </button>
    );
  },
});
```

Wrapping components and forwarding inputs, outputs and directives:
```ts
import { component, signal, input, computed } from '@angular/core';
import { tooltip } from '@mylib/tooltip';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  setup: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);

    function makeAdmin() {/** ... **/}

    return (
      <UserDetailWrapper
        user={user()}
        model:email={email}
        on:makeAdmin={makeAdmin} />
    );
  },
});

/**
 * Wrapper mode: component.wrap(Target, { ... }).
 * Target is passed as a value; the type is inferred from it,
 * consistent with ref(Child), inject(Child), etc.
 * setup receives wrapped bindings (same as standard components).
 *
 * {...rest} is a compile-time operation: the compiler statically
 * unrolls the spread into individual bindings on the target,
 * re-wiring each binding wrapper (InputSignal, ModelSignal, etc.)
 * to the corresponding target binding. No runtime object spread.
 *
 * attachments act as a behavior passthrough — forwarding directives
 * from the caller through to the innermost element where
 * use:attachments is declared.
 */
export const UserDetailWrapper = component.wrap(UserDetail, {
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user, ...rest }) => {
    const other = computed(() => /** something depending on user() or a default value **/);

    return (
      <UserDetail {...rest} use:tooltip(message={'Tooltip message'}) user={other()} />
    );
  },
});

// -- UserDetail -----------------------------------
import { component, input, model, output, fragment, attachable } from '@angular/core';

export interface User {
  name: string;
  role: string;
}

export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
    attachments: attachable<HTMLElement>(),
  },
  setup: ({ user, email, makeAdmin, children, attachments }) => (
    <div use:attachments>
      <h3>{user().name}</h3>
      <p>Role: {user().role}</p>

      <label>Email:</label>
      <input type="email" model:value={email} />

      <button on:click={() => makeAdmin.emit()}>Make Admin</button>

      @if (children) {
        @render(children())
      }
    </div>
  ),
});
```

## Expose and Template Refs
`expose` is the public interface of `setup()` for refs. Components return it along with `template`; directives return it from `setup`.

`ref(Type)` → `Signal<expose | undefined>`, `refMany(Type)` → `Signal<expose[]>`; without `expose`, they resolve to `Signal<undefined>` and `Signal<undefined[]>`. Elements and components are bound with `ref={...}`, or with `use:...:ref={...}` for directives, and can be read after `afterNextRender`.
```ts
import { component, ref, refMany, signal, input, afterNextRender, Signal } from '@angular/core';
import { ripple } from '@mylib/ripple';
import { tooltip } from '@mylib/tooltip';

const Child = component({
  setup: () => {
    const text = signal('');
    const _internal = signal(0); // not exposed

    return {
      template: (...),
      // expose: component's public interface — only these are accessible via ref
      expose: {
        text: text.asReadonly(),
      },
    };
  },
});

const Sibling = component({
  bindings: {
    childRef: input.required<{ text: Signal<string> } | undefined>(),
  },
  setup: ({ childRef }) => (
    <button on:click={() => childRef()?.text()}>Show text</button>
  ),
});

export const Parent = component({
  setup: () => {
    // Native element: type explicit → Signal<HTMLDivElement | undefined>
    const el = ref<HTMLDivElement>();
    // Component: type inferred from expose → Signal<{ text: Signal<string> } | undefined>
    const child = ref(Child);
    // Directive: type inferred from setup() return → Signal<{ toggle: () => void } | undefined>
    const tlp = ref(tooltip);
    // Multiple instances (e.g. inside @for) → Signal<{ text: Signal<string> }[]>
    const many = refMany(Child);

    afterNextRender(() => {
      // refs resolve here
    });

    return (
      <div
        ref={el}
        use:ripple()
        use:tooltip(message={'something'}):ref={tlp}>
          Something
      </div>

      <Child ref={child} />
      <Sibling childRef={child()} />

      <Child ref={many} />
      <Child ref={many} />

      <button on:click={() => tlp()?.toggle()}>Toggle tlp</button>
    );
  },
});
```

## Dependency Injection Enhancements
Improved ergonomics for types and tokens:
```ts
import { component, inject, provide, injectionToken, input, signal } from '@angular/core';

/**
 * Not provided in root by default: throws if not provided
 * in the injector tree.
 *
 * factory = default factory used by the provide(compToken)
 * shorthand — not a fallback
 */
const compToken = injectionToken('desc', {
  factory: () => {
    const counter = signal(0);

    return {
      value: counter.asReadonly(),
      decrease: () => {
        counter.update(v => v - 1);
      },
      increase: () => {
        counter.update(v => v + 1);
      },
    };
  },
});

/**
 * Root provider: factory invoked once at root scope —
 * no need to provide it explicitly
 */
const rootToken = injectionToken('desc', {
  level: 'root',
  factory: () => {
    const counter = signal(0);

    return {
      value: counter.asReadonly(),
      decrease: () => {
        counter.update(v => v - 1);
      },
      increase: () => {
        counter.update(v => v + 1);
      },
    };
  },
});

/**
 * multi: factory used only by the provide(multiToken)
 * shorthand — not a root default entry
 */
const multiToken = injectionToken('desc', {
  multi: true,
  factory: () => Math.random(),
});

/**
 * class
 */
class Store {}

export const Counter = component({
  bindings: {
    initialValue: input<number>(),
  },
  setup: () => {
    const rootCounter = inject(rootToken);
    const compCounter = inject(compToken);
    const multi = inject(multiToken); // array of numbers
    const store = inject(Store);
    /** ... **/
    return (...);
  },
  providers: ({ initialValue }) => [
    // provide compToken at Counter level using the default factory
    provide(compToken),
    
    // multi: default factory called once per provide(multiToken)
    provide(multiToken),
    provide(multiToken),
    provide({ token: multiToken, useFactory: () => 10 }),
    provide({ token: multiToken, useFactory: () => initialValue() }),
    
    // class
    provide({ token: Store, useFactory: () => new Store() }),
  ],
});
```

## Final considerations

### Concepts Impacted by These Changes
- `ng-content`: replaced by `fragments`,
- `ng-template` (`let-*` shorthands + `ngTemplateGuard_*`): likely replaced by `fragments`,
- structural directives: likely replaced by `fragments`,
- `pipes`: replaced by derivations — derivations cover the same transform use case and also support DI,
- `event delegation`: not explicitly considered, but it could fit as "special attributes" (`onClick`, ...) similarly to [Solid events](https://docs.solidjs.com/concepts/components/event-handlers),
- `@let`: unchanged,
- `directives` attached to the host (components): no longer possible, but directives can be passed in and attached to elements,
- `directive` types: since `host` is declared as a typed `ref` at the directive config level, static type checking is built in — directives can only be applied to compatible elements,
- `template reference variables`: likely replaced by `ref`,
- `queries`: likely replaced by `ref`; `ref` should be extended to cover programmatic component creation, but must not allow arbitrary `read` of providers from the injector tree (see [`viewChild abuses`](https://stackblitz.com/edit/stackblitz-starters-wkkqtd9j)),
- `component and directive injection`: the preferred interaction model is an explicit `ref` passed as an `input`. Nevertheless, with `ref`/`expose` in place, component and directive injection are safer by design — directive-to-directive and child-to-parent injection are established patterns worth keeping (see [`ngModel hijacking`](https://stackblitz.com/edit/stackblitz-starters-ezryrmmy) for the kind of abuse `expose` helps prevent). The trade-off is that some Angular-reserved names are necessary (`attachments`, `children`);
- `interface conformance`: opt-in via `satisfies` on `bindings` and `expose` — the same structural check that `implements` provides for classes.

### Notes
- other decorator properties: in this proposal, components and directives expose only `providers` and `setup` entries. However, `@Component` and `@Directive` have many more properties, some of which (like `preserveWhitespaces`) should probably remain. They are not covered here to avoid scope creep;
- `providers` defined at `directive` level: the added value is unclear, but the confusion they generate is well-documented; it is uncertain whether this concept remains meaningful;
- inputs and outputs can be reassigned inside the setup:
  - `https://github.com/microsoft/TypeScript/issues/18497`,
  - [`no-param-reassign`](https://eslint.org/docs/latest/rules/no-param-reassign).

### Pros and cons
Pros:
- familiar enough,
- not subject to typical single-file component (SFC) limitations,
- enforces a strict structure,
- AI agent-friendly,
- no `splitProps` drama 😅.

Cons:
- noticeable repetition in how bindings are declared and consumed,
- not plain TypeScript.
