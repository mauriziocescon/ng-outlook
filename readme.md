# Anatomy of signal components
**⚠️ Note ⚠️: just personal thoughts from a DEV perspective on [the future of angular](https://myconf.dev/videos/2024-keynote-session-the-future-of-angular) (template level).**

Points:
1. building blocks as functions:
    - `**.ng` files with macros (see [`why macros`](https://github.com/mauriziocescon/ng-playground/blob/main/why-macros.md)), 
    - `component`: a `script` with scoped logic that returns a `template`,
    - `directive`: a `script` that can change the appearance or behaviour of DOM elements,
    - `declaration`: a way to declare `const` variables in templates that depend on DI,
    - `fragment`: a way to capture some markup in the form of a function,
2. ts expressions with `{}`: bindings + text interpolation,
3. extra bindings for DOM elements: `bind:`, `on:`, `model:`, `class:`, `style:`, `animate:`,
4. hostless components + ts lexical scoping for templates,
5. component inputs: lifted up + immediately available in the script,
6. composition with fragments, directives and spread syntax,
7. template ref,
8. DI enhancements, 
9. Final considerations (`!important`).

## Components
Component structure and element bindings:
```ts
import { signal, linkedSignal, input, output } from '@angular/core';

export #component TextSearch({
  /**
   * by the time script is called,
   * inputs are populated with parent data
   */
  value = input.required<string>(),
  valueChange = output<string>(),
}) {
  // runs once on init
  script: () => {
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
     * cannot duplicate attribute names: only one (static or bound)
     * ‼️ <span class="..." class="..." class={...}> ‼️
     * ‼️ <span on:click={...} on:click={...}> ‼️
     * 
     * can use multiple class: and style:
     * ✅ <span class="..." class:some-class={...} class:some-other-class={...}> ✅
     * 
     * can bind not existing attributes (ignored)
     * ✅ <span nonsense={...} on:nonsense={...}> ✅ -->
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
}
```

Component bindings:
```ts
import { signal } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export #component UserDetailConsumer() {
  script: () => {
    const user = signal<User>(...);
    const email = signal<string>(...);

    function makeAdmin() {/** ... **/}
    
    /**
     * any component can be used directly in the template
     * bind: model: on: behaves the same as for native elements
     * 
     * ⚠️ must provide all required inputs / models ⚠️
     * 
     * cannot duplicate prop names: only one
     * ‼️ <UserDetail user={...} user={...} model:user={...} /> ‼️
     * ‼️ <UserDetail on:makeAdmin={...} on:makeAdmin={...} /> ‼️
     * 
     * shouldn't use 'on' prefix with input / model / output
     * ⚠️ <UserDetail onInput={...} model:onModel={...} on:onEvent={...} /> ⚠️
     * 
     * can bind not existing entries (ignored)
     * ✅ <UserDetail nonsense={...} on:nonsense={...} /> ✅
     */
    return (
      <UserDetail
        user={user()}
        model:email={email}
        on:makeAdmin={makeAdmin} />
    );
  },
}

// -- UserDetail -----------------------------------
import { input, model, output } from '@angular/core';

export interface User {/** ... **/}

export #component UserDetail({
  /**
   * mental model: 
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
  user = input.required<User>(),
  email = model<string>(),
  makeAdmin = output<void>(),
}) {
  // ...
}
```

Lexical scoping: template => script => func / const / enum / interface imported in the file => global.
```ts
enum Type {
  Counter = 'counter',
  Other = 'other',
}

const type = Type.Counter;

const counter = (value: number) => `Let's count till ${value}`;

export #component Counter() {
  script: () => (
    @if (type === Type.Counter) {
      <p>{counter(5)}</p>
    } @else {
      <span>Empty</span>
    }
  ),
}
```

## Element directives
Change the appearance or behavior of DOM elements:
```ts
import { signal } from '@angular/core';
import { tooltip } from '@mylib/tooltip';

export #component TextSearch() {
  script: () => {
    const text = signal('');
    const message = signal('Message');

    function valueChange() {/** ... **/}
    function doSomething() {/** ... **/}
    
     /**
      * encapsulation of directive data: @directive(...)
      * any directive can be used directly in the template
      */
     return (
       <input
         type="text"
         model:value={text}
         on:input={valueChange}
         @tooltip(message={message()} on:dismiss={doSomething}) />
     
       <p>Value: {text()}</p>
     );
  },
}

// -- tooltip in @mylib/tooltip --------------------
import { input, output, ref, inject, DestroyRef, Renderer2, afterRenderEffect } from '@angular/core';

export #directive tooltip({
  message = input.required<string>(),
  dismiss = output<void>(),
  /**
   * usable only in afterNextRender or similar
   * tooltip can be attached to any HTMLElement
   * 
   * readonly signal provided by ng (not bindable directly)
   * name reserved to ng
   */
   host = ref<HTMLElement>(),
}) {
  script: () => {
    const destroyRef = inject(DestroyRef);
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      // something with host
    });
    
    destroyRef.onDestroy(() => {
      // cleanup logic
    });
  },
}
```

## Declarations and template-scope `@const` constants
Definition of template-scoped constant `@const` where creation happens once (view life cycle) and can run in an injection context:
```ts
import { signal, computed, inject, input } from '@angular/core';
import { Item, PriceManager } from '@mylib/item';

function quantity(value?: number) {
  const qty = signal(value ?? 0);

  return {
    value: qty.asReadonly(),
    decrease: () => qty.update(c => c - 1),
    increment: () => qty.update(c => c + 1),
  };
}

#declaration price({
  /**
   * can only have input
   */
  qty = input.required<number>(),
}) {
  script: () => {
    // injection context
    const priceManager = inject(PriceManager);
    
    return computed(/** ... **/);
  },
}

export #component PriceSimulator({
  items = input.required<Item[]>(),
}) {
  script: () => {
    /**
     * any declaration can be used directly in the template
     * declarations require @ cause they can only be used with @const
     * 
     * qty / price have the same @let scope and get created once 
     * following the @for embedded views life cycle
     */
    return (
      @for (item of items(); track item.id) {
        @const qty = quantity(0);
        @const price = @price({qty: qty.value});
      
        <h5>{item.desc}</h5>
        <button on:click={() => qty.decrease()}>-</button>
        <div>Quantity: {qty.value()}</div>
        <button on:click={() => qty.increase()}>+</button>
        <hr />
        <div>Price: {price()}</div>
      }
    );
  },
}
```

## Inputs
Inputs lifted up for providers init:
```ts
import { linkedSignal, input, WritableSignal, provide, inject } from '@angular/core';

class CounterStore {
  private readonly counter: WritableSignal<number>;
  readonly value = this.counter.asReadonly();

  constructor(c = () => 0) {
    this.counter = linkedSignal(() => c());
  }

  decrease() {/** ... **/}
  increase() {/** ... **/}
}

export #component Counter({
  c = input.required<number>(),
}) {
  script: () => {
    const store = inject(CounterStore);
    
    return (
      <h1>Counter</h1>
      <div>Value: {store.value()}</div>
      <button on:click={() => store.decrease()}>-</button>
      <button on:click={() => store.increase()}>+</button>
    );
  },
  providers: () => [
    provide({ token: CounterStore, useFactory: () => new CounterStore(c) }),
  ],
}
```

## Composition with fragments, directives and spread syntax
Fragments are very similar to [`svelte snippets`](https://svelte.dev/docs/svelte/snippet): functions returning html markup. Returned markup is opaque: cannot manipulate it similarly to [`react Children (legacy)`](https://react.dev/reference/react/Children) or [`solid children`](https://www.solidjs.com/tutorial/props_children). Directives behave similarly to [`svelte attachments`](https://svelte.dev/docs/svelte/@attach). Spread syntax can be used at component function level similarly to react. Note: the examples below are simplified.

Implicit children fragment (where + when) and binding context:
```ts
import { signal } from '@angular/core';
import { Menu, MenuItem } from '@mylib/menu';

export #component MenuConsumer() {
  script: () => {
    const first = signal('First');
    const second = signal('Second');
    
    /**
     * markup inside comp tag => implicitly becomes a fragment called children
     */
    return (
      <Menu>
        <MenuItem>{first()}</MenuItem>
        <MenuItem>{second()}</MenuItem>
      </Menu>
    );
  },
}

// -- Menu in @mylib/menu --------------------------
import { input, fragment } from '@angular/core';
import { Render } from '@angular/common';

export #component Menu({
  /**
   * children = fragment<void>()
   * 
   * readonly signal provided by ng (not bindable directly)
   * name reserved to ng
   */
   children = fragment<void>(),
}) {
  script: () => {
    /** ... **/
    
    /**
     * no need to have an explicit anchor point like ng-container
     */
    return (
      @if (children()) {
        <Render fragment={children()} />
      } @else {
        <span>Empty</span>
      }
    );
  },
}

export #component MenuItem({
  children = fragment<void>(),
}) {
  script: () => (
    <Render fragment={children()} />
  ),
}
```

Customising components:
```ts
import { signal } from '@angular/core';
import { Menu } from '@mylib/menu';
import { MyMenuItem } from './my-menu-item.ng';

export interface Item {
  id: string;
  desc: string;
}

export #component MenuConsumer() {
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
}

// -- Menu in @mylib/menu --------------------------
import { input, fragment } from '@angular/core';
import { Render } from '@angular/common';

export #component Menu({
  items = input.required<{ id: string, desc: string }[]>(),
  menuItem = fragment<[{ id: string, desc: string }]>(),
}) {
  script: () => (
    <h1> Total items: {items().length} </h1>
    
    @for (item of items(); track item.id) {
      <Render fragment={menuItem()} params={[item]} />
    }
  ),
}
```

Directives attached to a component and bound to an element:
```ts
import { signal } from '@angular/core';
import { Button } from '@mylib/button';
import { ripple } from '@mylib/ripple';
import { tooltip } from '@mylib/tooltip';

export #component ButtonConsumer() {
  script: () => {
    const tooltipMsg = signal('');
    const valid = signal(false);

    function doSomething() {/** ... **/}
    
    return (
      <Button
        @ripple
        @tooltip(message={tooltipMsg()})
        disabled={!valid()}
        on:click={doSomething}>
          Click / Hover me
      </Button>
    );
  },
}

// -- button in @mylib/button --------------------
import { input, output, fragment, attachments } from '@angular/core';
import { Render } from '@angular/common';

export #component Button({
  children = fragment<void>(),
  disabled = input<boolean>(false),
  click = output<void>(),
  /**
   * all @directive applied to <Button />
   * 
   * readonly signal provided by ng (not bindable directly)
   * name reserved to ng
   */
  directives = attachments<HTMLButtonElement>(), 
}) {
  script: () => {
    // ...
    
    /**
     * compile-time unrolling + type checking
     */
    return (
      <button {...directives()} disabled={disabled()} on:click={() => click.emit()}>
        <Render fragment={children()} />
      </button>
    );
  },
}
```

Wrapping components and passing inputs / outputs:
```ts
import { input, computed, Props } from '@angular/core';
import { UserDetail, User } from './user-detail.ng';

export #component UserDetailConsumer() {
  script: () => {
    const user = signal<User>(...);
    const email = signal<string>(...);

    function makeAdmin() {/** ... **/}
    
    /**
     * bind:**={object} bind entries of object; same for model / on
     * compile-time unrolling + type checking
     */
    return (
      <UserDetailWrapper
        bind:**={{user}}
        model:**={{email}}
        on:**={{makeAdmin}} />
    );
  },
}

export #component UserDetailWrapper({
  user = input<User>(),
  /**
   * destruction syntax: whatever is not matching 
   * inputs / outputs / models / fragments / directives
   * defined explicitly (like user).
   */
  ...rest,
}: Props<UserDetail>) {
  script: () => {
    const other = computed(() => /** something depending on user or a default value **/);
    
    /**
     * compile-time unrolling (UserDetail props): no real runtime spread + strict types
     */
    return (
      <UserDetail {...rest} user={other()} />
    );
  },
}

// -- UserDetail -----------------------------------
import { input, model, output, fragment, attachments } from '@angular/core';

export interface User {/** ... **/}

export #component UserDetail({
  user = input.required<User>(),
  email = model.required<string>(),
  makeAdmin = output<void>(),
  children = fragment<void>(),
  directives = attachments<HTMLElement>(), 
}) {
  script: () => {
    // ...
    
    return (...);
  },
}
```

Wrapping native elements and passing attributes / event listeners:
```ts
import { signal } from '@angular/core';
import { Button } from '@mylib/button';
import { ripple } from '@mylib/ripple';
import { tooltip } from '@mylib/tooltip';

export #component ButtonConsumer() {
  script: () => {
    const tooltipMsg = signal('');
    const valid = signal(false);

    function doSomething() {/** ... **/}
    
    /**
     * can pass down attributes (either static or bound) and event listeners
     * cannot have multiple style / class / ...
     */
    return (
      <Button
        type="button"
        style="background-color: cyan"
        class={valid() ? 'global-css-valid' : ''}
        @ripple
        @tooltip(message={tooltipMsg()})
        disabled={!valid()}
        on:click={doSomething}>
          Click / Hover me
      </Button>
    );
  },
}

// -- button in @mylib/button --------------------
import { input, computed, fragment, attachments } from '@angular/core';
import { HTMLButtonAttributes } from '@angular/core/elements';

export #component Button({
  style = input<string>(''),
  children = fragment<void>(),
  directives = attachments<HTMLButtonElement>(), 
  ...rest,
}: HTMLButtonAttributes) {
  script: () => {
    const innerStyle = computed(() => `${style()}; color: red;`);
    
    /**
     * {...rest} adds type / class / ...
     */
    return (
      <button {...directives()} {...rest} style={innerStyle()}>
        <Render fragment={children()} />
      </button>
    );
  },
}
```

Dynamic components:
```ts
import { signal, computed } from '@angular/core';
import { Dynamic } from '@angular/common';
import { AComp } from './a-comp.ng';
import { BComp } from './b-comp.ng';

export #component Something() {
  script: () => {
    const condition = signal<boolean>(/** ... **/);
    const comp = computed(() => condition() ? AComp : BComp);
    const inputs = computed(() => /** ... **/);
    
    return (
      <Dynamic component={comp()} inputs={inputs()} />
    );
  },
}
```

## Template ref
Retrieving references of elements / components / directives (runtime):
```ts
import { ref, Signal, signal, afterNextRender } from '@angular/core';
import { tooltip } from '@mylib/tooltip';

#component Child() {
  script: () => {
    const text = signal('');
    
    return {
      template: (...),
      /**
       * can return an object that
       * any ref can use to interact
       * with the component
       * (public interface)
       */
      exports: {
        text: text.asReadonly(),        
      },
    };
  },
}

export #component Parent() {
  script: () => {
    // readonly signal
    const el = ref<HTMLDivElement>('el');

    /**
     * 1. can only use what's returned by Child.script.exports
     * 2. templates only lookup: cannot retrieve providers
     *    defined in the Child comp tree
     */
    const child = ref('child');

    // using what's returned by tooltip.script
    const tlp = ref<{ toggle: () => void }>('tlp');
    const many = signal<{ text: Signal<string> }[]>([]);

    afterNextRender(() => {
      // something with refs
    });
    
    /**
     * ref: can bind to a function as well (runs at view creation)
     */
    return (
      <div
        #el
        @ripple=#rpl
        @tooltip(message={'something'})=#tlp>
          Something
      </div>
    
      <Child #child />
      
      <Child ref={(c) => many.update(v => [...v, c])} />
      <Child ref={(c) => many.update(v => [...v, c])} />
    
      <button on:click={() => tlp().toggle()}>Toggle tlp</button>
    );
  },
}
```

## DI enhancements
Better ergonomics around types / tokens:
```ts
import { inject, provide, injectionToken, input } from '@angular/core';

/**
 * not provided in root by default: the token
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
 * root provider: no need to provide it
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

export #component Counter({
  initialValue = input<number>(),
}) {
  script: () => {
    const rootCounter = inject(rootToken);
    const compCounter = inject(compToken);
    const multi = inject(multiToken); // array of numbers
    const store = inject(Store);
    /** ... **/
  },
  providers: () => [
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
}
```

## Final considerations

### Concepts affected by these changes
- `ng-content`: replaced by `fragments`,
- `ng-template` (`let-*` shorthands + `ngTemplateGuard_*`): likely replaced by `fragments`,
- structural directives: likely replaced by `fragments`,
- `Ng**Outlet` + `ng-container`: likely replaced by the new things,
- `pipes`: replaced by declarations,
- `event delegation`: not explicitly considered, but it could fit as "special attributes" (`onClick`, ...) similarly to [solid events](https://docs.solidjs.com/concepts/components/event-handlers),
- `@let`: likely obsolete and not needed anymore,
- `directives` attached to the host (components): not possible anymore, but you can pass directives and spread them,
- `directive` types: since `host` is defined as an input (rather then injected), static types checking could be introduced (directives can be applied only to compatible elementes),
- `queries`: if `ref` makes sense, likely not needed anymore; if they stay, it would be nice to limit their DI capabilities: no way to `read` providers from `injector` tree (see [`viewChild abuses`](https://stackblitz.com/edit/stackblitz-starters-wkkqtd9j)),
- multiple `directives` attached to the same element: as for the previous point, it would be nice to avoid directives injection when applied to the same element (see [`ngModel hijacking`](https://stackblitz.com/edit/stackblitz-starters-ezryrmmy)); instead, it should be an explicit template operation with a `ref` passed as an `input`,
- in general, the concept of injecting components / directives inside each others should be restricted cause it generates lots of indirection / complexity; the downside is that some ng-reserved names are necessary (`host`, `directives`, `children`).

### Unresolved points
- other decorator props: in this proposal, components and directives have only `providers` / `script` entries. On the other hand, `@Component` and `@Directive` have many more and some of them (like `preserveWhitespaces`) should probably stay. They are not considered to avoid digressions; 
- `providers` defined at `directive` level: never really understood the added value, but experienced the confusion they generate; not really sure if they have a meaning or not; 
- there isn't any obvious `short notation` for passing signals (like svelte / vue);
```ts
<User user={user()} age={age()} gender={gender()} model:address={address} on:userChange={userChange} />

// hacky way: "matching the name only for signals"
// error in case of string interpolation or similar

<User {user} {age} {gender} model:{address} on:{userChange} />
```
- there isn't any obvious way to conditionally apply directives;
```ts
// maybe using another ()?

<Button ( @tooltip(message={tooltipMsg()}) && {enabled()} )>
  Click / Hover me
</Button>
```
- can reassign inputs / outputs inside script:
  - `https://github.com/microsoft/TypeScript/issues/18497`,
  - [`no-param-reassign`](https://eslint.org/docs/latest/rules/no-param-reassign).

### Pros and cons
Pros: 
- familiar enough, 
- not affected by typical SFC limitations, 
- strict structure, 
- no `splitProps` drama 😅. 

Cons:
- deeper gap with plain typescript.
