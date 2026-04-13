# Claude code
## Prompt:

In readme.md and authoring-format.md, I drafted a possible evolution of Angular's template syntax and proposed a new authoring format.

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
│   ├── button.ng                  attachments, explicit native bindings, children
│   ├── icon-button.ng             component.wrap<typeof T>, wrapper component
│   ├── badge.ng                   simple display component
│   ├── search-bar.ng              model:, ref expose
│   ├── product-card.ng            @derive, use:, expose
│   └── product-list.ng            named fragment
└── pages/
    ├── admin-page.ng              admin view
    ├── catalog-page.ng            @fragment, @derive, ref, inputs hoisted to providers
    └── app-page.ng                injectionToken, root providers
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
// Provides a WritableSignal so consumers can both read and toggle the theme
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
A directive that attaches a tooltip to any DOM element. `host` is a top-level config property (not a binding) — it is framework-provided context, not consumer-bindable. `setup` receives bindings as the first argument and `{ host }` as the second.

```ts
import { directive, ref, input, output, inject, DestroyRef, afterRenderEffect } from '@angular/core';

export const tooltip = directive({
  host: ref<HTMLElement>(),
  bindings: {
    message: input.required<string>(),
    dismiss: output<void>(),
  },
  setup: ({ message, dismiss }, { host }) => {
    const destroyRef = inject(DestroyRef);
    let tooltipEl: HTMLElement | null = null;

    afterRenderEffect(() => {
      const hostEl: HTMLElement | undefined = host();
      tooltipEl?.remove();
      if (!hostEl || !message()) return;

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
import { directive, ref, input, afterRenderEffect } from '@angular/core';

export const highlight = directive({
  host: ref<HTMLElement>(),
  bindings: {
    color: input<string>('yellow'),
  },
  setup: ({ color }, { host }) => {
    afterRenderEffect(() => {
      const hostEl: HTMLElement | undefined = host();
      if (hostEl) hostEl.style.backgroundColor = color();
    });
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
  bindings: {
    value: input.required<number>(),
    code: input<string>(),
  },
  setup: ({ value, code }) => {
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
  bindings: {
    items: input.required<Product[]>(),
    query: input<string>(''),
  },
  setup: ({ items, query }) => {
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
A component with `attachments` (directives spread), `children` fragment, and explicit native-element bindings.

```ts
import { component, input, output, computed, fragment, directives } from '@angular/core';

export const Button = component({
  bindings: {
    type: input<'button' | 'submit' | 'reset'>('button'),
    class: input<string>(''),
    style: input<string>(''),
    disabled: input<boolean>(false),
    variant: input<'primary' | 'ghost'>('primary'),
    click: output<void>(),
    children: fragment<void>(),
    attachments: directives<HTMLButtonElement>(),
  },
  setup: ({ type, class: className, style, disabled, variant, click, children, attachments }) => {
    const innerStyle = computed(() => `${style()}; font-weight: 500;`);

    return {
      template: (
        <button
          {...attachments()}
          type={type()}
          class={className()}
          style={innerStyle()}
          class:primary={variant() === 'primary'}
          class:ghost={variant() === 'ghost'}
          disabled={disabled()}
          on:click={() => click.emit()}>
            @render(children())
        </button>
      ),
    };
  },
  style: `
    button { padding: 6px 14px; border-radius: 4px; cursor: pointer; }
    .primary { background: #0070f3; color: white; border: none; }
    .ghost { background: transparent; border: 1px solid currentColor; }
  `,
});
```

---

## `app/components/icon-button.ng`
Wraps `Button` using `component.wrap<typeof Button>()` and `{...rest}` forwarding. Intercepts `children` to add styling; all other `Button` bindings are forwarded automatically.

```ts
import { component, input, output, fragment, directives } from '@angular/core';
import { Button } from './button.ng';

export const IconButton = component.wrap<typeof Button>({
  bindings: {
    children: fragment<void>(),
  },
  setup: ({ children, ...rest }) => ({
    template: (
      <Button {...rest}>
        @render(children())
      </Button>
    ),
  }),
  style: `button { display: inline-flex; align-items: center; gap: 4px; }`,
});
```

---

## `app/components/badge.ng`
A simple count badge. Hidden when count is zero.

```ts
import { component, input } from '@angular/core';

export const Badge = component({
  bindings: {
    count: input.required<number>(),
  },
  setup: ({ count }) => ({
    template: (
      @if (count() > 0) {
        <span class="badge">{count()}</span>
      }
    ),
  }),
  style: `
    .badge { background: #e00; color: white; border-radius: 999px; padding: 2px 8px; font-size: .75rem; }
  `,
});
```

---

## `app/components/search-bar.ng`
Two-way binding with `model:`. Uses `ref` internally to auto-focus the input, and exposes `clear` via `expose`.

```ts
import { component, model, ref, afterNextRender } from '@angular/core';

export const SearchBar = component({
  bindings: {
    query: model<string>(''),
  },
  setup: ({ query }) => {
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
  bindings: {
    product: input.required<Product>(),
    cartQty: input<number>(0),
    addToCart: output<Product>(),
  },
  setup: ({ product, cartQty, addToCart }) => {
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
  bindings: {
    items: input.required<Product[]>(),
    item: fragment<[Product]>(),
  },
  setup: ({ items, item }) => ({
    template: (
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
  }),
  style: `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }`,
});
```

---

## `app/pages/admin-page.ng`
Minimal admin view — used as one branch of an `@if`/`@else` switch.

```ts
import { component } from '@angular/core';

export const AdminPage = component({
  setup: () => ({
    template: (
      <div>
        <h2>Admin Panel</h2>
        <p>Manage your catalog here.</p>
      </div>
    ),
  }),
});
```

---

## `app/pages/catalog-page.ng`
The main page. Demonstrates:
- inputs hoisted to `providers` (`currencyCode` → `CurrencyCodeToken`)
- `@derive` at the template top level
- `@fragment` inline
- `ref(SearchBar)` and `refMany(ProductCard)` with `afterNextRender`
- lexical scoping (`const`)
- shorthand binding syntax

```ts
import { component, signal, inject, ref, refMany, input, afterNextRender, provide } from '@angular/core';
import { ripple } from '@mylib/ripple';
import { filter } from '../derivations/filter.ng';
import { Button } from '../components/button.ng';
import { Badge } from '../components/badge.ng';
import { SearchBar } from '../components/search-bar.ng';
import { ProductCard } from '../components/product-card.ng';
import { ProductList } from '../components/product-list.ng';
import { CartStore } from '../cart.store';
import { CurrencyCodeToken, SearchConfigToken, AnalyticsHandlerToken } from '../tokens';
import { PRODUCTS, Product } from '../product';

// Lexical scoping: enum and constant are directly available in the template
const PAGE_TITLE = 'Product Catalog';

export const CatalogPage = component({
  bindings: {
    // Input hoisted to providers: available before setup() runs
    currencyCode: input<string>('USD'),
  },
  setup: () => {
    const cart = inject(CartStore);
    const handlers = inject(AnalyticsHandlerToken); // array (multi token)

    const query = signal('');

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

    return {
      template: (
        <h1>{PAGE_TITLE}</h1>

        <div style="display: flex; gap: 8px; align-items: center;">
          <SearchBar model:{query} ref={searchBar} />
          <Button variant={'ghost'} on:click={() => searchBar()?.clear()}>Clear</Button>
          <Badge count={cart.count()} />
        </div>

        <Button use:ripple() variant={'ghost'} on:click={flashAll}>
          ✨ Flash all
        </Button>

        @derive filtered = filter({ items: PRODUCTS, query: query() });

        @fragment item(p: Product) {
          <ProductCard
            ref={cards}
            product={p}
            cartQty={cart.qty(p.id)}
            on:addToCart={(prod) => cart.add(prod)} />
        }

        <ProductList items={filtered()} {item} />
      ),
    };
  },
  providers: ({ currencyCode }) => [
    // currencyCode is an InputSignal<string> — available here before setup() runs
    provide({ token: CurrencyCodeToken, useFactory: () => currencyCode() }),
    provide(SearchConfigToken),
    provide(AnalyticsHandlerToken),
    provide({ token: AnalyticsHandlerToken, useFactory: () => (e: string) => fetch('/api/analytics', { method: 'POST', body: e }) }),
  ],
});
```

---

## `app/pages/app-page.ng`
Root page. Provides `CartStore`, toggles between `CatalogPage` and `AdminPage`, and reads `ThemeToken`.

```ts
import { component, signal, inject, provide } from '@angular/core';
import { CatalogPage } from './catalog-page.ng';
import { AdminPage } from './admin-page.ng';
import { CartStore } from '../cart.store';
import { ThemeToken } from '../tokens';

export const AppPage = component({
  setup: () => {
    const theme = inject(ThemeToken);
    const isAdmin = signal(false);

    return {
      template: (
        <div class:dark={theme() === 'dark'}>
          <nav>
            <button on:click={() => isAdmin.update(v => !v)}>
              {isAdmin() ? 'Go to catalog' : 'Go to admin'}
            </button>
            <button on:click={() => theme.update(t => t === 'light' ? 'dark' : 'light')}>
              Toggle theme
            </button>
          </nav>

          @if (isAdmin()) {
            <AdminPage />
          } @else {
            <CatalogPage currencyCode={'EUR'} />
          }
        </div>
      ),
    };
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
| `component` (bindings, setup, style) | all component files |
| `on:` / `model:` / `class:` / `use:` | `search-bar.ng`, `product-card.ng`, `catalog-page.ng` |
| Lexical scoping (`const`) | `catalog-page.ng` |
| `directive` (`host: ref<>()`, bindings, setup) | `tooltip.ng`, `highlight.ng` |
| `:when` on `use:` binding | `product-card.ng` (`use:highlight`) |
| `:ref` on `use:` binding | `product-card.ng` (`use:tooltip`) |
| `derivation` + `@derive` | `currency.ng`, `filter.ng`, `product-card.ng`, `catalog-page.ng` |
| Inputs hoisted to `providers` | `catalog-page.ng` (`currencyCode` → `CurrencyCodeToken`) |
| `children` fragment (implicit) | `button.ng`, `icon-button.ng` |
| Named/typed fragment + `@fragment` inline | `product-list.ng`, `catalog-page.ng` |
| `attachments` + `directives` spread | `button.ng` |
| `component.wrap<typeof T>` + `{...rest}` wrapper component | `icon-button.ng` |
| Explicit native bindings + `attachments` forwarding | `button.ng` |
| `ref` + `refMany` + `afterNextRender` | `search-bar.ng` (internal), `catalog-page.ng` |
| `expose` | `search-bar.ng`, `product-card.ng` |
| `injectionToken` (root, scoped, multi) | `tokens.ts` |
| `provide` + `providers` | `catalog-page.ng`, `app-page.ng` |
| Shorthand binding syntax | `catalog-page.ng` (`model:{query}`, `{item}`) |
