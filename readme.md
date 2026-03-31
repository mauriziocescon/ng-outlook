# Anatomy of signal components
**⚠️ Note ⚠️: personal thoughts from a developer's perspective on [the future of Angular](https://myconf.dev/videos/2024-keynote-session-the-future-of-angular) (template level).**

Points:
1. building blocks as functions:
    - `*.ng` files with template DSL (see [`why .ng files`](https://github.com/mauriziocescon/ng-outlook/blob/main/why-ng-files.md)),
    - `component`: a `script` with scoped logic that returns a `template`,
    - `directive`: a `script` that can change the appearance or behavior of DOM elements,
    - `derivation`: a factory for template-scoped computed values that requires DI,
    - `fragment`: a way to capture some markup in the form of a function,
2. ts expressions with `{}`: bindings + text interpolation,
3. extra bindings for DOM elements: `bind:`, `on:`, `model:`, `class:`, `style:`, `animate:`, `use:`,
4. hostless components + ts lexical scoping for templates,
5. component inputs: lifted up + immediately available in the script,
6. composition with fragments, directives and spread syntax,
7. template ref,
8. DI enhancements, 
9. Final considerations (`!important`).

**Template syntax note**: the template syntax in the examples below resembles TSX syntactically but is Angular DSL — not JSX. It supports Angular control flow, directives, and custom bindings.

## Components
Component structure and element bindings:
```ts
import { component, signal, linkedSignal, input, output } from '@angular/core';

export const TextSearch = component({
  /**
   * By the time script is called,
   * inputs are populated with parent data
   */
  props: {
    value: input.required<string>(),
    valueChange: output<string>(),
  },
  // Runs once on init
  script: ({ value, valueChange }) => {
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

Component bindings:
```ts
import { component, signal } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  script: () => {
    const user = signal<User>(/** ... **/);
    const email = signal<string>(/** ... **/);

    function makeAdmin() {/** ... **/}

    /**
     * Any component can be used directly in the template
     * bind:, model:, on: behave the same as for native elements
     * 
     * ⚠️ Must provide all required inputs / models ⚠️
     * 
     * Cannot duplicate prop names: only one
     * ‼️ <UserDetail user={...} user={...} model:user={...} /> ‼️
     * ‼️ <UserDetail on:makeAdmin={...} on:makeAdmin={...} /> ‼️
     * 
     * Shouldn't use 'on' prefix with input / model / output
     * ⚠️ <UserDetail onInput={...} model:onModel={...} on:onEvent={...} /> ⚠️
     * 
     * Can bind to non-existent entries (ignored)
     * ✅ <UserDetail nonsense={...} on:nonsense={...} /> ✅
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
  props: {
    user: input.required<User>(),
    email: model<string>(),
    makeAdmin: output<void>(),    
  },
  script: ({ user, email, makeAdmin }) => {
    // ...      
  },
});
```

Lexical scoping resolves in this order: template → script → functions, constants, enums, and interfaces imported in the file → global.
```ts
import { component } from '@angular/core';

enum Type {
  Counter = 'counter',
  Other = 'other',
}

const type = Type.Counter;

const counter = (value: number) => `Let's count till ${value}`;

export const Counter = component({
  script: () => (
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
  script: () => {
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
import { directive, input, output, inject, DestroyRef, Renderer2, afterRenderEffect } from '@angular/core';

// HTMLElement: constrains which host elements this directive can be attached to
export const tooltip = directive<HTMLElement>({
  props: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  /**
   * host: typed as Signal<HTMLElement> (from the generic);
   * usable only in afterNextRender or similar
   *
   * Directive scripts return their expose directly — there is
   * no template to return. The returned object is the public
   * interface accessible via ref; everything else in script()
   * is private.
   */
  script: ({ message, dismiss }, { host }) => {
    const destroyRef = inject(DestroyRef);
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      const hostEl: HTMLElement = host();
      // something with hostEl
    });

    destroyRef.onDestroy(() => {
      // cleanup logic
    });

    return {
      toggle: () => { /** ... **/ },
    };
  },
});
```

## Template-scope derivations with `@derive`
`@derive` creates a template-scoped reactive computation, establishing an injection context before calling the derivation's `script`. It follows the lifecycle of the enclosing view:
```ts
import { component, derivation, computed, inject, input } from '@angular/core';
import { Item, PriceManager } from '@mylib/item';

const simulation = derivation({
  props: {
    /**
     * Only inputs are allowed: a derivation has no DOM host,
     * so there is no surface to emit outputs or sync models against
     */
    qty: input.required<number>(),
    item: input.required<Item>(),
  },
  /**
   * script always returns Signal<T> (e.g. computed)
   */
  script: ({ qty, item }) => {
    const priceManager = inject(PriceManager);

    return computed(() => priceManager.computePrice(item(), qty()));
  },
});

export const PriceSimulator = component({
  props: {
    items: input.required<Item[]>(),
  },
  script: ({ items }) => {
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
  props: {
    c: input.required<number>(),    
  },
  script: () => {
    const store = inject(CounterStore);
    
    return (
      <h1>Counter</h1>
      <div>Value: {store.value()}</div>
      <button on:click={() => store.decrease()}>-</button>
      <button on:click={() => store.increase()}>+</button>
    );
  },
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
  script: () => {
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
  props: {
    /**
     * children = fragment<void>()
     *
     * Nullable function provided by ng (not bindable directly)
     * Name reserved to ng
     */
     children: fragment<void>(),
  },
  script: ({ children }) => {
    /** ... **/

    /**
     * No need to have an explicit anchor point like ng-container
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
  props: {
    children: fragment<void>(),
  },
  script: ({ children }) => (
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
  script: () => {
    const items = signal<Item[]>(/** ... **/);
    
    /**
     * menuItem inside <Menu></Menu> automatically becomes a fragment input
     */
    return (
      @fragment menuItem(item: Item) {
        <div class="my-menu-item">
          <MyMenuItem>{item.desc}</MyMenuItem>
        </div>
      }
      <Menu items={items()} menuItem={menuItem} />
    );
  },
  styleUrl: './menu-consumer.css',
});

// -- Menu in @mylib/menu --------------------------
import { component, input, fragment } from '@angular/core';

export const Menu = component({
  props: {
    items: input.required<{ id: string, desc: string }[]>(),
    menuItem: fragment<[{ id: string, desc: string }]>(),
  },
  script: ({ items, menuItem }) => (
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
  script: () => {
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
  props: {
    children: fragment<void>(),
    disabled: input<boolean>(false),
    click: output<void>(),
    /**
     * All directives applied to <Button />
     *
     * Readonly signal provided by ng (not bindable directly)
     * Name reserved to ng
     */
    behaviours: directives<HTMLButtonElement>(),
  },
  script: ({ children, disabled, click, behaviours }) => {
    // ...

    /**
     * Compile-time unrolling + type checking
     */
    return (
      <button {...behaviours()} disabled={disabled()} on:click={() => click.emit()}>
        @render(children())
      </button>
    );
  },
});
```

Wrapping components and forwarding inputs and outputs:
```ts
import { component, signal, input, computed, Props } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export const UserDetailConsumer = component({
  script: () => {
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

// Props<UserDetail>: defines the full set of props rest is typed against
export const UserDetailWrapper = component<Props<UserDetail>>({
  props: {
    user: input<User>(),
  },
  /**
   * rest (destructuring syntax): captures everything that does not match
   * the explicitly defined inputs / outputs / models / fragments / directives
   * (like user). Components have no host, so { rest } is the only second-argument context.
   */
  script: ({ user }, { rest }) => {
    const other = computed(() => /** something depending on user or a default value **/);
    
    /**
     * Compile-time unrolling (UserDetail props): no real runtime spread + strict types
     */
    return (
      <UserDetail {...rest} user={other()} />
    );
  },  
});

// -- UserDetail -----------------------------------
import { component, input, model, output, fragment, directives } from '@angular/core';

export interface User {/** ... **/}

export const UserDetail = component({
  props: {
    user: input.required<User>(),
    email: model.required<string>(),
    makeAdmin: output<void>(),
    children: fragment<void>(),
    behaviours: directives<HTMLElement>(),
  },
  script: ({ user, email, makeAdmin, children, behaviours }) => {
    // ...

    return (...);
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
  script: () => {
    const tooltipMsg = signal('');
    const valid = signal(false);
  
    function doSomething() {/** ... **/}
    
    /**
     * Can pass down attributes (either static or bound) and event listeners
     * Cannot have multiple style / class / ...
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
import { component, input, computed, fragment, directives } from '@angular/core';
import { HTMLButtonAttributes } from '@angular/core/elements';

export const Button = component<HTMLButtonAttributes>({
  props: {
    style: input<string>(''),
    children: fragment<void>(),
    behaviours: directives<HTMLButtonElement>(),
  },
  script: ({ style, children, behaviours }, { rest }) => {
    const innerStyle = computed(() => `${style()}; color: red;`);

    /**
     * {...rest} spreads remaining attributes like type, class, etc.
     */
    return (
      <button {...behaviours()} {...rest} style={innerStyle()}>
        @render(children())
      </button>
    );
  },
});
```

Dynamic components:
```ts
import { component, signal, computed } from '@angular/core';
import { AdminPanel } from './admin-panel.ng';   // props: { user: input.required<User>() }
import { GuestPanel } from './guest-panel.ng';   // props: { message: input.required<string>() }

export const Dashboard = component({
  script: () => {
    const isAdmin = signal(false);
    const user = signal<User>(/** ... **/);

    const panel = computed(() => isAdmin() ? AdminPanel : GuestPanel);

    /**
     * {panel()} as a tag: panel() returns typeof AdminPanel | typeof GuestPanel,
     * so props are type-checked against the union — no untyped inputs bag
     *
     * ⚠️ Only props shared by both components can be safely passed ⚠️
     */
    return (
      <button on:click={() => isAdmin.update(v => !v)}>Toggle role</button>
      <{panel()} user={user()} />
    );
  },
});
```

## Template ref
Declare a `ref(Type)` in the script and assign it via `ref={signal}` in the template to get a `Signal<expose | undefined>`. Refs resolve after `afterNextRender`; before that they are `undefined`.
```ts
import { component, ref, refMany, signal, afterNextRender } from '@angular/core';
import { ripple } from '@mylib/ripple';
import { tooltip } from '@mylib/tooltip';

const Child = component({
  script: () => {
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

export const Parent = component({
  script: () => {
    // Native element: type explicit → Signal<HTMLDivElement | undefined>
    const el = ref<HTMLDivElement>();
    // Component: type inferred from expose → Signal<{ text: Signal<string> } | undefined>
    const child = ref(Child);
    // Directive: type inferred from script() return → Signal<{ toggle: () => void } | undefined>
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
        use:tooltip(message={'something'} ref={tlp})>
          Something
      </div>

      <Child ref={child} />
      <button on:click={() => child()?.text()}>Show text</button>

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
  props: {
    initialValue: input<number>(),    
  },
  script: () => {
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
- in general, the practice of injecting components or directives into each other should be restricted, as it introduces indirection and complexity; the trade-off is that some Angular-reserved names are necessary (`behaviours`, `children`).

### Notes
- other decorator properties: in this proposal, components and directives expose only `providers` and `script` entries. However, `@Component` and `@Directive` have many more properties, some of which (like `preserveWhitespaces`) should probably remain. They are not covered here to avoid scope creep;
- `providers` defined at the `directive` level: the added value is unclear, but the confusion they generate is well-documented; it is uncertain whether this concept remains meaningful;
- name-matching shorthand for passing signals (as in Svelte or Vue): when a local variable name matches the prop name, the binding type is inferred from its signal kind — `Signal<T>` for inputs, `WritableSignal<T>` for models, `() => void` for outputs; falls back to explicit form when names differ or the expression is not a single identifier;
```ts
// explicit form — always works
<User user={user()} age={age()} gender={gender()} model:address={address} on:userChange={userChange} />

// shorthand — requires local variable names to match prop names
<User {user} {age} {gender} model:{address} on:{userChange} />
```
- `when` is a built-in reserved prop on directives (framework-owned, like `children` and `behaviours` on components) for conditional application; it cannot be used as a directive input name;
```ts
<Button
  use:ripple()
  use:tooltip(message={tooltipMsg()} when={enabled()})
  on:click={doSomething}>
    Click / Hover me
</Button>
```
- inputs and outputs can be reassigned inside the script:
  - `https://github.com/microsoft/TypeScript/issues/18497`,
  - [`no-param-reassign`](https://eslint.org/docs/latest/rules/no-param-reassign).

### Pros and cons
Pros:
- familiar enough,
- not subject to typical single-file component (SFC) limitations,
- enforces a strict structure,
- no `splitProps` drama 😅.

Cons:
- creates a wider gap from plain TypeScript.
