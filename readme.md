# Anatomy of signal components
**⚠️ Note ⚠️: personal thoughts from a developer's perspective on [the future of Angular](https://myconf.dev/videos/2024-keynote-session-the-future-of-angular) (template level).**

Points:
1. building blocks as functions:
    - `*.ng` files with template DSL (see [`authoring format`](https://github.com/mauriziocescon/ng-outlook/blob/main/authoring-format.md)),
    - `component`: a `setup` with scoped logic that returns a `template` or `{ template, expose }`,
    - `directive`: a `setup` that can change the appearance or behavior of DOM elements,
    - `derivation`: a factory for template-scoped computed values that requires DI,
    - `fragment`: a way to capture some markup in the form of a function,
2. ts expressions with `{}`: bindings + text interpolation,
3. extra bindings for DOM elements: `bind:`, `on:`, `model:`, `class:`, `style:`, `animate:`, `use:`,
4. hostless components + ts lexical scoping for templates,
5. component inputs: lifted up + immediately available in the setup,
6. composition with fragments, directives and spread syntax,
7. expose and template ref,
8. DI enhancements, 
9. final considerations (`!important`).

**Template syntax note**: the template syntax in the examples below resembles TSX syntactically but is Angular DSL — not JSX. It supports Angular control flow, directives, and custom bindings.

## Component structure and bindings
`setup` runs once on init; `bindings` are available immediately — destructuring in the signature is optional:
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
  /**
   * Mental model:
   *
   * <UserDetail
   *   style="..."
   *   user={user()}
   *   model:email={email}
   *   on:makeAdmin={makeAdmin} />
   *
   * function UserDetail({
   *   style: '...',
   *   user: computedInput(() => user(), {transform: ...}),
   *   email: computedInput(() => email()),
   *   'on:emailChange': (v: string) => {email.set(v)},
   *   'on:makeAdmin': () => {makeAdmin()},
   * }) {...}
   */
  bindings: {
    user: input.required<User>(),
    email: model<string>(),
    makeAdmin: output<void>(),
  },
  setup: (bindings) => (
    // bindings.user, bindings.email, bindings.makeAdmin, ...
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

## Binding shorthands
- **Name-matching**: omit the value when the local variable name matches the binding; type inferred from the signal kind — `Signal<T>` for inputs, `WritableSignal<T>` for models, `() => void` for outputs.
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

## Template-scope derivations with `@derive`
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
    qty: input.required<number>(),
    item: input.required<Item>(),
  },
  /**
   * setup always returns Signal<T> (e.g. computed)
   */
  setup: ({ qty, item }) => {
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
        @derive price = simulation({qty: 1, item: item});

        <h5>{item.desc}</h5>
        <div>Price: {price()}</div>
      }
    );
  },
});
```

## Inputs
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

## Composition with fragments, directives and spread syntax
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
       * then passed as a named binding — equivalent to the inline form above.
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

Directives attached to a component and bound to an element:
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

    return (
      <Button
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
import { component, input, output, fragment, directives } from '@angular/core';

export const Button = component({
  bindings: {
    children: fragment<void>(),
    disabled: input<boolean>(false),
    click: output<void>(),
    /**
     * All directives applied to <Button />
     *
     * Readonly signal provided by ng (not bindable directly)
     * Name reserved to ng
     */
    attachments: directives<HTMLButtonElement>(),
  },
  setup: ({ children, disabled, click, attachments }) => {
    // ...

    /**
     * Compile-time unrolling + type checking
     */
    return (
      <button {...attachments()} disabled={disabled()} on:click={() => click.emit()}>
        @render(children())
      </button>
    );
  },
});
```

Wrapping components and forwarding inputs and outputs:
```ts
import { component, signal, input, computed } from '@angular/core';
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
 * Wrapper mode: component.wrap<typeof Target>({ ... }).
 * setup receives wrapped bindings (same as standard components).
 *
 * {...rest} is a compile-time operation: the compiler statically
 * unrolls the spread into individual bindings on the target,
 * re-wiring each binding wrapper (InputSignal, ModelSignal, etc.)
 * to the corresponding target binding. No runtime object spread.
 */
export const UserDetailWrapper = component.wrap<typeof UserDetail>({
  bindings: {
    user: input.required<User>(),
  },
  setup: ({ user, ...rest }) => {
    const other = computed(() => /** something depending on user() or a default value **/);

    return (
      <UserDetail {...rest} user={other()} />
    );
  },
});

// -- UserDetail -----------------------------------
import { component, input, model, output, fragment, directives } from '@angular/core';

export interface User {/** ... **/}

export const UserDetail = component({
  bindings: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
    attachments: directives<HTMLElement>(),
  },
  setup: ({ user, email, makeAdmin, children, attachments }) => {
    // ...

    return (...);
  },
});
```

Wrapping native elements and forwarding selected attributes and event listeners:
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

    // Pass selected attributes and events.
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
import { component, input, output, computed, fragment, directives } from '@angular/core';

export const Button = component({
  bindings: {
    type: input<'button' | 'submit' | 'reset'>('button'),
    class: input<string>(''),
    style: input<string>(''),
    disabled: input<boolean>(false),
    click: output<void>(),
    children: fragment<void>(),
    attachments: directives<HTMLButtonElement>(),
  },
  setup: ({ type, class: className, style, disabled, click, children, attachments }) => {
    const innerStyle = computed(() => `${style()}; color: red;`);

    // Forward explicit bindings + attached directives.
    return (
      <button
        {...attachments()}
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

## Expose and Template ref
`expose` is the public interface of `setup()` for refs. Components return it with `template`; directives return it from `setup` (their host is provided via the second setup arg).

`ref(Type)` → `Signal<expose | undefined>`, `refMany(Type)` → `Signal<expose[]>`; without `expose`, they resolve to `Signal<undefined>` and `Signal<undefined[]>`. Bind with `ref={...}` (elements/components) or `:ref={...}` (`use:`), and read after `afterNextRender`.

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

## DI enhancements
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

### Concepts affected by these changes
- `ng-content`: replaced by `fragments`,
- `ng-template` (`let-*` shorthands + `ngTemplateGuard_*`): likely replaced by `fragments`,
- structural directives: likely replaced by `fragments`,
- `Ng**Outlet` + `ng-container`: likely replaced by the new primitives,
- `pipes`: replaced by derivations — derivations cover the same transform use case and also support DI,
- `event delegation`: not explicitly considered, but it could fit as "special attributes" (`onClick`, ...) similarly to [Solid events](https://docs.solidjs.com/concepts/components/event-handlers),
- `@let`: unchanged,
- `directives` attached to the host (components): no longer possible, but directives can be passed in and spread onto elements,
- `directive` types: since `host` is declared as a typed `ref` at the directive config level, static type checking is built in — directives can only be applied to compatible elements,
- `template reference variables`: likely replaced by `ref`,
- `queries`: likely replaced by `ref`; `ref` should be extended to cover programmatic component creation, but must not allow arbitrary `read` of providers from the injector tree (see [`viewChild abuses`](https://stackblitz.com/edit/stackblitz-starters-wkkqtd9j)),
- `component and directive injection`: the preferred interaction model is an explicit `ref` passed as an `input`. Nevertheless, with `ref`/`expose` in place, component and directive injection are safer by design — directive-to-directive and child-to-parent injection are established patterns worth keeping (see [`ngModel hijacking`](https://stackblitz.com/edit/stackblitz-starters-ezryrmmy) for the kind of abuse `expose` helps prevent). The trade-off is that some Angular-reserved names are necessary (`attachments`, `children`);
- `interface conformance`: opt-in via `satisfies` on `bindings` and `expose` — the same structural check that `implements` provides for classes.

### Notes
- other decorator properties: in this proposal, components and directives expose only `providers` and `setup` entries. However, `@Component` and `@Directive` have many more properties, some of which (like `preserveWhitespaces`) should probably remain. They are not covered here to avoid scope creep;
- `providers` defined at the `directive` level: the added value is unclear, but the confusion they generate is well-documented; it is uncertain whether this concept remains meaningful;
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
- noticeable repetition in how bindings are declared and consumed: increases boilerplate for small components but scales better for larger ones,
- not plain TypeScript.
