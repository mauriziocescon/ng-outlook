# Claude code
## Prompt:

In readme.md and why-ng-files.md, I drafted a possible evolution of Angular's template syntax and proposed a new authoring format.

Based on those files and current Angular best practices, could you create a sample application that showcases all the concepts introduced? Please keep CSS to a minimum and output everything in a single .md file.

# Sample Application — Product Catalog

A product catalog with search, cart, and role-based views. Each file maps to one or more concepts from the proposal.

## File structure

```
app/
├── product.ts                     interfaces + sample data
├── cart.store.ts                  CartStore class
├── tokens.ts                      injectionToken examples
├── directives/
│   ├── tooltip.ng                 directive (DOM enhancement)
│   └── highlight.ng               directive with `:when`
├── derivations/
│   ├── currency.ng                derivation with LOCALE_ID + CurrencyCodeToken
│   └── filter.ng                  derivation with SearchConfigToken
├── components/
│   ├── button.ng                  behaviours, HTMLButtonAttributes, children
│   ├── icon-button.ng             Props<T>, component wrapping
│   ├── badge.ng                   simple display component
│   ├── card.ng                    children fragment
│   ├── search-bar.ng              model:, ref expose
│   ├── product-card.ng            @derive, use:, expose
│   └── product-list.ng            named fragment, refMany
└── pages/
    ├── admin-page.ng              admin view
    ├── catalog-page.ng            @fragment, @derive, ref, inputs hoisted to providers
    └── app-page.ng                dynamic components, injectionToken, root providers
```

---

## `app/product.ts`
Domain interfaces and sample data.

```ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'electronics' | 'clothing' | 'food';
}

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Keyboard',  description: 'Mechanical keyboard', price: 129, category: 'electronics' },
  { id: '2', name: 'T-Shirt',   description: 'Cotton t-shirt',      price: 25,  category: 'clothing'     },
  { id: '3', name: 'Coffee',    description: 'Arabica blend',        price: 18,  category: 'food'         },
  { id: '4', name: 'Monitor',   description: '4K display',           price: 399, category: 'electronics' },
  { id: '5', name: 'Jeans',     description: 'Slim fit jeans',       price: 60,  category: 'clothing'     },
];
```

---

## `app/cart.store.ts`
Plain class — provided at the `AppPage` level via `providers`.

```ts
import { signal, computed } from '@angular/core';
import { Product } from './product';

export class CartStore {
  private readonly _items = signal<Map<string, number>>(new Map());

  readonly count = computed(() =>
    [...this._items().values()].reduce((sum, qty) => sum + qty, 0)
  );

  add(product: Product) {
    this._items.update(m => {
      const next = new Map(m);
      next.set(product.id, (next.get(product.id) ?? 0) + 1);
      return next;
    });
  }

  qty(productId: string): number {
    return this._items().get(productId) ?? 0;
  }
}
```

---

## `app/tokens.ts`
`injectionToken` — root, scoped, and multi variants.

```ts
import { injectionToken, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

// Root-level: available everywhere without an explicit provide()
export const ThemeToken = injectionToken('theme', {
  level: 'root',
  factory: () => signal<Theme>('light'),
});

// Scoped: must be explicitly provided
export const CurrencyCodeToken = injectionToken('currency-code', {
  factory: () => 'USD',
});

// Scoped: controls search behaviour
export const SearchConfigToken = injectionToken('search-config', {
  factory: () => ({ caseSensitive: false, minChars: 1 }),
});

// Multi: each provide() adds an entry — injected as an array
export const AnalyticsHandlerToken = injectionToken('analytics', {
  multi: true,
  factory: () => (event: string) => console.log('[analytics]', event),
});
```

---

## `app/directives/tooltip.ng`
A directive that attaches a tooltip to any DOM element.

```ts
import { directive, input, output, inject, DestroyRef, afterRenderEffect } from '@angular/core';

export const tooltip = directive<HTMLElement>({
  props: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  script: ({ message, dismiss }, { host }) => {
    const destroyRef = inject(DestroyRef);
    let tooltipEl: HTMLElement | null = null;

    afterRenderEffect(() => {
      const hostEl = host(); // host is Signal<HTMLElement>
      tooltipEl?.remove();
      if (!message()) return;

      tooltipEl = document.createElement('span');
      tooltipEl.textContent = message();
      tooltipEl.className = 'tooltip';
      hostEl.appendChild(tooltipEl);
    });

    destroyRef.onDestroy(() => tooltipEl?.remove());

    return {
      show: () => { if (tooltipEl) tooltipEl.style.display = 'block'; },
      hide: () => { if (tooltipEl) tooltipEl.style.display = 'none'; },
    };
  },
});
```

---

## `app/directives/highlight.ng`
A directive using the `:when` modifier to conditionally apply itself.

```ts
import { directive, input, afterRenderEffect } from '@angular/core';

export const highlight = directive<HTMLElement>({
  props: {
    color: input<string>('yellow'),
  },
  script: ({ color }, { host }) => {
    afterRenderEffect(() => {
      host().style.backgroundColor = color(); // host is Signal<HTMLElement>
    });

    return {};
  },
});
```

Usage with `:when`:
```ts
<p use:highlight(color={'cyan'}):when={isHighlighted()}>Some text</p>
```

---

## `app/derivations/currency.ng`
A derivation for locale-aware currency formatting. Injects `LOCALE_ID` and `CurrencyCodeToken` — that's why it's a derivation and not a plain `computed`.

```ts
import { derivation, input, inject, computed, LOCALE_ID } from '@angular/core';
import { CurrencyCodeToken } from '../tokens';

export const currency = derivation({
  props: {
    value: input.required<number>(),
    code: input<string>(),
  },
  script: ({ value, code }) => {
    const locale = inject(LOCALE_ID);
    const defaultCode = inject(CurrencyCodeToken);

    return computed(() =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code() ?? defaultCode,
      }).format(value())
    );
  },
});
```

---

## `app/derivations/filter.ng`
A derivation for filtering products. Injects `SearchConfigToken` for configurable search behaviour.

```ts
import { derivation, input, inject, computed } from '@angular/core';
import { Product } from '../product';
import { SearchConfigToken } from '../tokens';

export const filter = derivation({
  props: {
    items: input.required<Product[]>(),
    query: input<string>(''),
  },
  script: ({ items, query }) => {
    const config = inject(SearchConfigToken);

    return computed(() => {
      const q = config.caseSensitive ? query() : query().toLowerCase();
      if (q.length < config.minChars) return items();
      return items().filter(p => {
        const name = config.caseSensitive ? p.name : p.name.toLowerCase();
        return name.includes(q);
      });
    });
  },
});
```

---

## `app/components/button.ng`
A component with `behaviours` (directives spread), `children` fragment, and native element wrapping via `HTMLButtonAttributes`.

```ts
import { component, input, output, fragment, directives, Props } from '@angular/core';
import { HTMLButtonAttributes } from '@angular/core/elements';

export const Button = component<HTMLButtonAttributes>({
  props: {
    disabled: input<boolean>(false),
    variant: input<'primary' | 'ghost'>('primary'),
    click: output<void>(),
    children: fragment<void>(),
    behaviours: directives<HTMLButtonElement>(),
  },
  script: ({ disabled, variant, click, children, behaviours }, { rest }) => (
    <button
      {...behaviours()}
      {...rest}
      class:primary={variant() === 'primary'}
      class:ghost={variant() === 'ghost'}
      disabled={disabled()}
      on:click={() => click.emit()}>
        @render(children())
    </button>
  ),
  style: `
    button { padding: 6px 14px; border-radius: 4px; cursor: pointer; }
    .primary { background: #0070f3; color: white; border: none; }
    .ghost { background: transparent; border: 1px solid currentColor; }
  `,
});

export type ButtonProps = Props<typeof Button>;
```

---

## `app/components/icon-button.ng`
Wraps `Button` using `ButtonProps` and `{...rest}` forwarding.

```ts
import { component, input } from '@angular/core';
import { Button, ButtonProps } from './button.ng';

export const IconButton = component<ButtonProps>({
  props: {
    icon: input.required<string>(),
    label: input.required<string>(),
  },
  script: ({ icon, label }, { rest }) => (
    <Button {...rest}>
      {icon()} {label()}
    </Button>
  ),
});
```

---

## `app/components/badge.ng`
A simple count badge. Hidden when count is zero.

```ts
import { component, input } from '@angular/core';

export const Badge = component({
  props: {
    count: input.required<number>(),
  },
  script: ({ count }) => (
    @if (count() > 0) {
      <span class="badge">{count()}</span>
    }
  ),
  style: `
    .badge { background: #e00; color: white; border-radius: 999px; padding: 2px 8px; font-size: .75rem; }
  `,
});
```

---

## `app/components/card.ng`
A clickable container component with an implicit `children` fragment.

```ts
import { component, output, fragment } from '@angular/core';

export const Card = component({
  props: {
    click: output<void>(),
    children: fragment<void>(),
  },
  script: ({ click, children }) => (
    <div class="card" on:click={() => click.emit()}>
      @render(children())
    </div>
  ),
  style: `
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; cursor: pointer; }
    .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.12); }
  `,
});
```

---

## `app/components/search-bar.ng`
Two-way binding with `model:`. Uses `ref` internally to auto-focus the input, and exposes `clear` via `expose`.

```ts
import { component, model, ref, afterNextRender } from '@angular/core';

export const SearchBar = component({
  props: {
    query: model<string>(''),
  },
  script: ({ query }) => {
    const inputEl = ref<HTMLInputElement>();

    afterNextRender(() => {
      inputEl()?.focus();
    });

    return {
      template: (
        <input
          ref={inputEl}
          type="search"
          placeholder="Search products..."
          model:value={query} />
      ),
      expose: {
        clear: () => query.set(''),
      },
    };
  },
  style: `input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }`,
});
```

---

## `app/components/product-card.ng`
Uses `@derive` for price formatting, `use:tooltip` with `:ref`, `use:highlight` with `:when`, and exposes a `flash` method.

```ts
import { component, signal, input, output, ref } from '@angular/core';
import { tooltip } from '../directives/tooltip.ng';
import { highlight } from '../directives/highlight.ng';
import { currency } from '../derivations/currency.ng';
import { Product } from '../product';

export const ProductCard = component({
  props: {
    product: input.required<Product>(),
    cartQty: input<number>(0),
    addToCart: output<Product>(),
  },
  script: ({ product, cartQty, addToCart }) => {
    const flashing = signal(false);
    // :ref captures the directive instance → Signal<{ show, hide } | undefined>
    const tlp = ref(tooltip);

    return {
      template: (
        @derive price = currency({ value: product().price });

        <div class:in-cart={cartQty() > 0}>
          <h3 use:tooltip(message={product().description}):ref={tlp}>
            {product().name}
          </h3>
          <p use:highlight(color={'lightyellow'}):when={cartQty() > 0}>
            {price()}
          </p>
          <small>In cart: {cartQty()}</small>
          <button
            class:flash={flashing()}
            on:click={() => addToCart.emit(product())}>
              Add to cart
          </button>
        </div>
      ),
      expose: {
        flash: () => { flashing.set(true); setTimeout(() => flashing.set(false), 300); },
      },
    };
  },
  style: `
    div { padding: 12px; border-radius: 6px; }
    .in-cart { outline: 2px solid #0070f3; }
    .flash { background: #fffae6; }
  `,
});
```

---

## `app/components/product-list.ng`
Accepts a named, typed `item` fragment and uses `@render` to project each product.

```ts
import { component, input, fragment } from '@angular/core';
import { Product } from '../product';

export const ProductList = component({
  props: {
    items: input.required<Product[]>(),
    item: fragment<[Product]>(),
  },
  script: ({ items, item }) => (
    @if (items().length === 0) {
      <p>No products found.</p>
    } @else {
      <div class="grid">
        @for (p of items(); track p.id) {
          @render(item(p))
        }
      </div>
    }
  ),
  style: `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }`,
});
```

---

## `app/pages/admin-page.ng`
Minimal admin view — used as one branch of a dynamic component switch.

```ts
import { component } from '@angular/core';

export const AdminPage = component({
  script: () => (
    <div>
      <h2>Admin Panel</h2>
      <p>Manage your catalog here.</p>
    </div>
  ),
});
```

---

## `app/pages/catalog-page.ng`
The main page. Demonstrates:
- inputs hoisted to `providers` (`currencyCode` → `CurrencyCodeToken`)
- `@derive` at the template top level
- `@fragment` inline
- `ref(SearchBar)` and `refMany(ProductCard)` with `afterNextRender`
- lexical scoping (`enum`, `const`)
- shorthand binding syntax

```ts
import { component, signal, computed, inject, ref, refMany, input, afterNextRender } from '@angular/core';
import { ripple } from '@mylib/ripple';
import { filter } from '../derivations/filter.ng';
import { Button } from '../components/button.ng';
import { IconButton } from '../components/icon-button.ng';
import { Badge } from '../components/badge.ng';
import { SearchBar } from '../components/search-bar.ng';
import { ProductCard } from '../components/product-card.ng';
import { ProductList } from '../components/product-list.ng';
import { CartStore } from '../cart.store';
import { CurrencyCodeToken, AnalyticsHandlerToken } from '../tokens';
import { PRODUCTS, Product } from '../product';

// Lexical scoping: enum and constant are directly available in the template
enum SortOrder { Asc = 'asc', Desc = 'desc' }
const PAGE_TITLE = 'Product Catalog';

export const CatalogPage = component({
  props: {
    // Input hoisted to providers: available before script() runs
    currencyCode: input<string>('USD'),
  },
  script: () => {
    const cart = inject(CartStore);
    const handlers = inject(AnalyticsHandlerToken); // array (multi token)

    const query = signal('');
    const sort = signal<SortOrder>(SortOrder.Asc);

    // ref(SearchBar): type inferred from expose → Signal<{ clear: () => void } | undefined>
    const searchBar = ref(SearchBar);
    // refMany(ProductCard): Signal<{ flash: () => void }[]>
    const cards = refMany(ProductCard);

    afterNextRender(() => {
      handlers.forEach(h => h('catalog:view'));
    });

    function flashAll() {
      cards().forEach(c => c.flash());
    }

    return (
      <h1>{PAGE_TITLE}</h1>

      <div style="display: flex; gap: 8px; align-items: center;">
        <SearchBar {query} ref={searchBar} />
        <Button variant={'ghost'} on:click={() => searchBar()?.clear()}>Clear</Button>
        <Badge count={cart.count()} />
      </div>

      <div style="display: flex; gap: 8px; margin: 8px 0;">
        <Button
          use:ripple()
          variant={'ghost'}
          on:click={() => sort.set(SortOrder.Asc)}>
            A → Z
        </Button>
        <Button
          use:ripple()
          variant={'ghost'}
          on:click={() => sort.set(SortOrder.Desc)}>
            Z → A
        </Button>
        <IconButton icon={'✨'} label={'Flash all'} on:click={flashAll} />
      </div>

      @derive filtered = filter({ items: PRODUCTS, query: query() });

      @fragment item(p: Product) {
        <ProductCard
          ref={cards}
          product={p}
          cartQty={cart.qty(p.id)}
          on:addToCart={(prod) => cart.add(prod)} />
      }

      <ProductList items={filtered()} {item} />
    );
  },
  providers: ({ currencyCode }) => [
    // currencyCode is a Signal<string> — available here before script() runs
    provide({ token: CurrencyCodeToken, useFactory: () => currencyCode }),
    provide(AnalyticsHandlerToken),
    provide({ token: AnalyticsHandlerToken, useFactory: () => (e: string) => fetch('/api/analytics', { method: 'POST', body: e }) }),
  ],
});
```

---

## `app/pages/app-page.ng`
Root page. Provides `CartStore`, toggles between `CatalogPage` and `AdminPage` as a dynamic component, and reads `ThemeToken`.

```ts
import { component, signal, computed, inject, provide } from '@angular/core';
import { CatalogPage } from './catalog-page.ng';
import { AdminPage } from './admin-page.ng';
import { CartStore } from '../cart.store';
import { ThemeToken } from '../tokens';

export const AppPage = component({
  script: () => {
    const theme = inject(ThemeToken);
    const isAdmin = signal(false);

    // panel() returns typeof CatalogPage | typeof AdminPage
    // props are type-checked against the union
    const panel = computed(() => isAdmin() ? AdminPage : CatalogPage);

    return (
      <div class:dark={theme() === 'dark'}>
        <nav>
          <button on:click={() => isAdmin.update(v => !v)}>
            {isAdmin() ? 'Go to catalog' : 'Go to admin'}
          </button>
          <button on:click={() => theme.update(t => t === 'light' ? 'dark' : 'light')}>
            Toggle theme
          </button>
        </nav>

        <{panel()} currencyCode={'EUR'} />
      </div>
    );
  },
  providers: () => [
    provide({ token: CartStore, useFactory: () => new CartStore() }),
  ],
  style: `
    nav { display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #eee; }
    .dark { background: #111; color: #eee; }
  `,
});
```

---

## Concept index

| Concept | File(s) |
|---|---|
| `component` (props, script, style) | all component files |
| `bind:` / `on:` / `model:` / `class:` / `use:` | `search-bar.ng`, `product-card.ng`, `catalog-page.ng` |
| Lexical scoping (`enum`, `const`) | `catalog-page.ng` |
| `directive` | `tooltip.ng`, `highlight.ng` |
| `:when` on `use:` binding | `product-card.ng` (`use:highlight`) |
| `:ref` on `use:` binding | `product-card.ng` (`use:tooltip`) |
| `derivation` + `@derive` | `currency.ng`, `filter.ng`, `product-card.ng`, `catalog-page.ng` |
| Inputs hoisted to `providers` | `catalog-page.ng` (`currencyCode` → `CurrencyCodeToken`) |
| `children` fragment (implicit) | `card.ng`, `button.ng` |
| Named/typed fragment + `@fragment` inline | `product-list.ng`, `catalog-page.ng` |
| `behaviours` + `directives` spread | `button.ng` |
| Named props type export + `{...rest}` component wrapping | `icon-button.ng` |
| `HTMLButtonAttributes` + `{...rest}` native wrapping | `button.ng` |
| Dynamic components | `app-page.ng` |
| `ref` + `refMany` + `afterNextRender` | `search-bar.ng` (internal), `catalog-page.ng` |
| `expose` | `search-bar.ng`, `product-card.ng` |
| `injectionToken` (root, scoped, multi) | `tokens.ts` |
| `provide` + `providers` | `catalog-page.ng`, `app-page.ng` |
| Shorthand binding syntax | `catalog-page.ng` (`{query}`, `{item}`) |
