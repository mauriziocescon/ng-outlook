# Anatomy of signal components
**⚠️ Note ⚠️: personal thoughts from a developer's perspective on [the future of Angular](https://myconf.dev/videos/2024-keynote-session-the-future-of-angular) (template level).**

Points:
1. building blocks as functions:
    - `*.ng` files with template DSL (see [`why .ng files`](https://github.com/mauriziocescon/ng-outlook/blob/main/why-ng-files.md)),
    - `component`: a `setup` with scoped logic that returns a `template`,
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
`setup` runs once on init; `bindings` are destructured and available immediately:
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
     *
     * Can bind to non-existent attributes (ignored)
     * ✅ <span nonsense={...} on:nonsense={...}> ✅
     */
    return {
      template: (
        <label class:danger={isDanger()}>Text:</label>
        <input type="text" model:value={text} on:input={textChange} />

        <button disabled={text().length === 0} on:click={() => text.set('')}>
          {'Reset ' + text()}
        </button>
      ),
    };
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
     *
     * Can bind to non-existent entries (ignored)
     * ✅ <UserDetail nonsense={...} on:nonsense={...} /> ✅
     */
    return {
      template: (
        <UserDetail
          user={user()}
          model:email={email}
          on:makeAdmin={makeAdmin} />
      ),
    };
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
  setup: ({ user, email, makeAdmin }) => {
    // ...
  },
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
  setup: () => ({
    template: (
      @if (type === Type.Counter) {
        <p>{counter(5)}</p>
      } @else {
        <span>Empty</span>
      }
    ),
  }),
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
    return {
      template: (
        <input
          type="text"
          model:value={text}
          on:input={valueChange}
          use:tooltip(message={message()} on:dismiss={doSomething}) />

        <p>Value: {text()}</p>
      ),
    };
  },
});

// -- tooltip in @mylib/tooltip --------------------
import { directive, input, output, inject, DestroyRef, Renderer2, afterRenderEffect } from '@angular/core';

// HTMLElement: constrains which host elements this directive can be attached to
export const tooltip = directive<HTMLElement>({
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ message, dismiss }, { host }) => {
    const destroyRef = inject(DestroyRef);
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      const hostEl: HTMLElement = host();
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

    return {
      template: (
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
      ),
    };
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
    return {
      template: (
        @for (item of items(); track item.id) {
          @derive price = simulation({qty: 1, item: item});

          <h5>{item.desc}</h5>
          <div>Price: {price()}</div>
        }
      ),
    };
  },
});
```

## Inputs
Inputs hoisted to the component level for use in provider initialization:
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

    return {
      template: (
        <h1>Counter</h1>
        <div>Value: {store.value()}</div>
        <button on:click={() => store.decrease()}>-</button>
        <button on:click={() => store.increase()}>+</button>
      ),
    };
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
    return {
      template: (
        <Menu>
          <MenuItem>{first()}</MenuItem>
          <MenuItem>{second()}</MenuItem>
        </Menu>
      ),
    };
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
     * No need to have an explicit anchor point like ng-container
     */
    return {
      template: (
        @if (children) {
          @render(children())
        } @else {
          <span>Empty</span>
        }
      ),
    };
  },
});

export const MenuItem = component({
  bindings: {
    children: fragment<void>(),
  },
  setup: ({ children }) => ({
    template: (
      @render(children())
    ),
  }),
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

    return {
      template: (
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
      ),
    };
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
  setup: ({ items, menuItem }) => ({
    template: (
      <h1> Total items: {items().length} </h1>

      @for (item of items(); track item.id) {
        @render(menuItem(item))
      }
    ),
  }),
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

    return {
      template: (
        <Button
          use:ripple()
          use:tooltip(message={tooltipMsg()})
          disabled={!valid()}
          on:click={doSomething}>
            Click / Hover me
        </Button>
      ),
    };
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
    return {
      template: (
        <button {...attachments()} disabled={disabled()} on:click={() => click.emit()}>
          @render(children())
        </button>
      ),
    };
  },
});
```

Wrapping components and forwarding inputs and outputs:
```ts
import { component, signal, input, computed, Bindings } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  setup: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);

    function makeAdmin() {/** ... **/}

    return {
      template: (
        <UserDetailWrapper
          user={user()}
          model:email={email}
          on:makeAdmin={makeAdmin} />
      ),
    };
  },
});

// Bindings<typeof UserDetail>: defines the full set of bindings rest is typed against
export const UserDetailWrapper = component<Bindings<typeof UserDetail>>({
  bindings: {
    user: input<User>(),
  },
  /**
   * rest (destructuring syntax): captures everything that does not match
   * the explicitly defined inputs / outputs / models / fragments / directives
   * (like user). Components have no host, so { rest } is the only second-argument context.
   */
  setup: ({ user }, { rest }) => {
    const other = computed(() => /** something depending on user or a default value **/);

    /**
     * Compile-time unrolling (UserDetail bindings): no real runtime spread + strict types
     */
    return {
      template: (
        <UserDetail {...rest} user={other()} />
      ),
    };
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

    return { template: (...) };
  },
});
```

Wrapping native elements and forwarding attributes and event listeners:
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
     * Can pass down attributes (either static or bound) and event listeners
     * Cannot have multiple style / class / ...
     */
    return {
      template: (
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
      ),
    };
  },
});

// -- button in @mylib/button --------------------
import { component, input, computed, fragment, directives } from '@angular/core';
import { HTMLButtonAttributes } from '@angular/core/elements';

export const Button = component<HTMLButtonAttributes>({
  bindings: {
    style: input<string>(''),
    children: fragment<void>(),
    attachments: directives<HTMLButtonElement>(),
  },
  setup: ({ style, children, attachments }, { rest }) => {
    const innerStyle = computed(() => `${style()}; color: red;`);

    /**
     * {...rest} spreads remaining attributes like type, class, etc.
     */
    return {
      template: (
        <button {...attachments()} {...rest} style={innerStyle()}>
          @render(children())
        </button>
      ),
    };
  },
});
```

Dynamic components:
```ts
import { component, signal, computed } from '@angular/core';
import { AdminPanel } from './admin-panel.ng';   // bindings: { user: input.required<User>() }
import { GuestPanel } from './guest-panel.ng';   // bindings: { user: input.required<User>() }

export const Dashboard = component({
  setup: () => {
    const isAdmin = signal(false);
    const user = signal<User>(/** ... **/);

    const panel = computed(() => isAdmin() ? AdminPanel : GuestPanel);

    /**
     * {panel()} as a tag: panel() returns typeof AdminPanel | typeof GuestPanel,
     * so bindings are type-checked against the union — no untyped inputs bag
     *
     * ⚠️ Only bindings shared by both components can be safely passed ⚠️
     */
    return {
      template: (
        <button on:click={() => isAdmin.update(v => !v)}>Toggle role</button>
        <{panel()} user={user()} />
      ),
    };
  },
});
```

## Expose and Template ref
`expose` defines the public interface — the only part of `setup()` accessible via `ref`. Components return it alongside `template`; directives return it directly (no template). The directive's `host` is `Signal<HTMLElement>` (constrained by the generic) and resolves in `afterNextRender`.

`ref(Type)` → `Signal<expose | undefined>`, bound via `ref={signal}` on elements and components, or `:ref={signal}` on `use:` bindings. `refMany(Type)` → `Signal<expose[]>` for multiple instances. Both resolve after `afterNextRender`. Refs can also be passed as inputs — keeping component interactions explicit and visible at the template level.

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
  setup: ({ childRef }) => ({
    template: (
      <button on:click={() => childRef()?.text()}>Show text</button>
    ),
  }),
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

    return {
      template: (
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
      ),
    };
  },
});
```

## DI enhancements
Improved ergonomics for types and tokens:
```ts
import { component, inject, provide, injectionToken, input, signal } from '@angular/core';

/**
 * Not provided in root by default: the token
 * must be provided somewhere
 * 
 * factory defines a default implementation and type
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
 * Root provider: no need to provide it
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
 * multi
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
  },
  providers: ({ initialValue }) => [
    // provide compToken at Counter level using the default factory
    provide(compToken),
    
    // multi
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
- `directive` types: since `host` is not injected anymore, static type checking could be introduced, allowing directives to be applied only to compatible elements,
- `template reference variables`: likely replaced by `ref`,
- `queries`: if `ref` covers the use case, they may no longer be needed; if they remain, it would be good to limit their DI capabilities — specifically, preventing `read` of providers from the injector tree (see [`viewChild abuses`](https://stackblitz.com/edit/stackblitz-starters-wkkqtd9j)),
- multiple `directives` on the same element: similarly, it would be good to prevent directives from injecting each other when applied to the same element (see [`ngModel hijacking`](https://stackblitz.com/edit/stackblitz-starters-ezryrmmy)); instead, interaction should be an explicit template operation using a `ref` passed as an `input`,
- in general, the practice of injecting components or directives into each other should be restricted, as it introduces indirection and complexity; the trade-off is that some Angular-reserved names are necessary (`attachments`, `children`).

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
- no `splitProps` drama 😅.

Cons:
- noticeable repetition in how bindings are declared and consumed,
- creates a wider gap from plain TypeScript.
