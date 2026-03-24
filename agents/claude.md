# Claude code
## Prompt:

Hey!

In readme.md and why-macros.md, I drafted a possible evolution of the angular syntax in templates and proposed a new authoring format.

Considering such files and the current angular best practices, could you please create an example of components composition using directives, declarations and fragments?

Thanks

## Result:

```ts
/**
 * Comprehensive example of component composition using:
 * - Directives (tooltip, ripple, highlight)
 * - Declarations (currency, discount)
 * - Fragments (card, actions, customItem)
 *
 * Scenario: Product catalog with customizable display and interactions
 */

import {
  signal,
  computed,
  linkedSignal,
  inject,
  input,
  output,
  model,
  fragment,
  attachments,
  ref,
  provide,
  afterRenderEffect,
  Renderer2,
  LOCALE_ID,
} from '@angular/core';
import { Render } from '@angular/common';

// ============================================
// TYPES
// ============================================

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discountPercent?: number;
  imageUrl: string;
  inStock: boolean;
}

// ============================================
// DIRECTIVES
// ============================================

/**
 * Tooltip directive - shows message on hover
 */
#directive tooltip({
  message = input.required<string>(),
  position = input<'top' | 'bottom' | 'left' | 'right'>('top'),
  dismiss = output<void>(),
  host = ref<HTMLElement>(),
}) {
  script: () => {
    const renderer = inject(Renderer2);
    const tooltipElement = signal<HTMLElement | null>(null);

    afterRenderEffect(() => {
      if (!host()) return;

      const element = host();

      // Create tooltip element
      const tooltip = renderer.createElement('div');
      renderer.addClass(tooltip, 'tooltip');
      renderer.addClass(tooltip, `tooltip-${position()}`);
      renderer.setProperty(tooltip, 'textContent', message());

      // Show/hide handlers
      const showTooltip = () => {
        renderer.appendChild(element, tooltip);
        tooltipElement.set(tooltip);
      };

      const hideTooltip = () => {
        if (tooltipElement()) {
          renderer.removeChild(element, tooltipElement());
          tooltipElement.set(null);
          dismiss.emit();
        }
      };

      renderer.listen(element, 'mouseenter', showTooltip);
      renderer.listen(element, 'mouseleave', hideTooltip);
    });
  },
}

/**
 * Ripple directive - adds ripple effect on click
 */
#directive ripple({
  color = input<string>('rgba(255, 255, 255, 0.5)'),
  duration = input<number>(600),
  host = ref<HTMLElement>(),
}) {
  script: () => {
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      if (!host()) return;

      const element = host();

      renderer.listen(element, 'click', (event: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const ripple = renderer.createElement('span');
        renderer.addClass(ripple, 'ripple-effect');
        renderer.setStyle(ripple, 'left', `${x}px`);
        renderer.setStyle(ripple, 'top', `${y}px`);
        renderer.setStyle(ripple, 'background', color());

        renderer.appendChild(element, ripple);

        setTimeout(() => {
          renderer.removeChild(element, ripple);
        }, duration());
      });
    });
  },
}

/**
 * Highlight directive - highlights element when condition is true
 */
#directive highlight({
  active = input<boolean>(false),
  highlightColor = input<string>('yellow'),
  host = ref<HTMLElement>(),
}) {
  script: () => {
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      if (!host()) return;

      const element = host();

      if (active()) {
        renderer.setStyle(element, 'background-color', highlightColor());
        renderer.setStyle(element, 'transition', 'background-color 0.3s ease');
      } else {
        renderer.removeStyle(element, 'background-color');
      }
    });
  },
}

// ============================================
// DECLARATIONS
// ============================================

/**
 * Currency declaration - formats price with locale
 */
#declaration currency({
  value = input.required<number | undefined>(),
  currencyCode = input<string>('USD'),
  locale = input<string | undefined>(),
}) {
  script: () => {
    const defaultLocale = inject(LOCALE_ID);

    return computed(() => {
      const val = value();
      if (val === undefined) return 'N/A';

      const effectiveLocale = locale() ?? defaultLocale;

      return new Intl.NumberFormat(effectiveLocale, {
        style: 'currency',
        currency: currencyCode(),
      }).format(val);
    });
  },
}

/**
 * Discount declaration - calculates discounted price
 */
#declaration discount({
  originalPrice = input.required<number>(),
  discountPercent = input<number>(0),
}) {
  script: () => {
    return computed(() => {
      const price = originalPrice();
      const percent = discountPercent();

      if (percent <= 0) return price;

      return price - (price * percent / 100);
    });
  },
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

/**
 * Card component - wraps content with styling and directives
 */
export #component Card({
  children = fragment<void>(),
  directives = attachments<HTMLDivElement>(),
  elevated = input<boolean>(true),
  padding = input<string>('1rem'),
}) {
  script: () => {
    const cardClass = computed(() =>
      elevated() ? 'card card-elevated' : 'card'
    );

    return (
      <div
        {...directives()}
        class={cardClass()}
        style={`padding: ${padding()}`}>
        <Render fragment={children()} />
      </div>
    );
  },
  style: `
    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      position: relative;
      overflow: hidden;
    }

    .card-elevated {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  `,
}

/**
 * Badge component - displays a small label
 */
export #component Badge({
  children = fragment<void>(),
  variant = input<'primary' | 'success' | 'warning' | 'danger'>('primary'),
}) {
  script: () => (
    <span class={`badge badge-${variant()}`}>
      <Render fragment={children()} />
    </span>
  ),
  style: `
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge-primary { background: #007bff; color: white; }
    .badge-success { background: #28a745; color: white; }
    .badge-warning { background: #ffc107; color: black; }
    .badge-danger { background: #dc3545; color: white; }
  `,
}

/**
 * Button component - reusable button with directives support
 */
export #component Button({
  children = fragment<void>(),
  directives = attachments<HTMLButtonElement>(),
  variant = input<'primary' | 'secondary' | 'outline'>('primary'),
  disabled = input<boolean>(false),
  click = output<void>(),
}) {
  script: () => (
    <button
      {...directives()}
      class={`btn btn-${variant()}`}
      disabled={disabled()}
      on:click={() => click.emit()}>
      <Render fragment={children()} />
    </button>
  ),
  style: `
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      position: relative;
      overflow: hidden;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-outline {
      background: transparent;
      border: 2px solid #007bff;
      color: #007bff;
    }

    .ripple-effect {
      position: absolute;
      border-radius: 50%;
      width: 100px;
      height: 100px;
      margin-left: -50px;
      margin-top: -50px;
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    }

    @keyframes ripple {
      from {
        transform: scale(0);
        opacity: 1;
      }
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `,
}

// ============================================
// PRODUCT DISPLAY COMPONENTS
// ============================================

/**
 * ProductImage component - displays product image with stock badge
 */
export #component ProductImage({
  url = input.required<string>(),
  alt = input<string>('Product image'),
  inStock = input<boolean>(true),
}) {
  script: () => (
    <div class="product-image-wrapper">
      <img src={url()} alt={alt()} class="product-image" />

      @if (!inStock()) {
        <Badge variant="danger">Out of Stock</Badge>
      }
    </div>
  ),
  style: `
    .product-image-wrapper {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
    }

    .product-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-image-wrapper .badge {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
    }
  `,
}

/**
 * ProductInfo component - displays product details with fragments
 */
export #component ProductInfo({
  product = input.required<Product>(),
  actions = fragment<void>(),
  showDescription = input<boolean>(true),
}) {
  script: () => (
    <div class="product-info">
      <h3 class="product-name">{product().name}</h3>

      @if (showDescription() && product().description) {
        <p class="product-description">{product().description}</p>
      }

      <div class="product-pricing">
        @const finalPrice = @discount({
          originalPrice: product().price,
          discountPercent: product().discountPercent ?? 0,
        });

        @const formattedPrice = @currency({
          value: finalPrice(),
          currencyCode: 'USD',
        });

        @if (product().discountPercent && product().discountPercent > 0) {
          <div class="price-with-discount">
            @const originalFormatted = @currency({
              value: product().price,
              currencyCode: 'USD',
            });

            <span class="original-price">{originalFormatted()}</span>
            <span class="discounted-price">{formattedPrice()}</span>
            <Badge variant="success">{product().discountPercent}% OFF</Badge>
          </div>
        } @else {
          <div class="price">{formattedPrice()}</div>
        }
      </div>

      @if (actions()) {
        <div class="product-actions">
          <Render fragment={actions()} />
        </div>
      }
    </div>
  ),
  style: `
    .product-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .product-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .product-description {
      margin: 0;
      color: #666;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .product-pricing {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .price-with-discount {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .original-price {
      text-decoration: line-through;
      color: #999;
      font-size: 0.875rem;
    }

    .discounted-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #28a745;
    }

    .price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #007bff;
    }

    .product-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
}

/**
 * ProductList component - renders list of products with customizable item fragment
 */
export #component ProductList({
  products = input.required<Product[]>(),
  item = fragment<[Product]>(),
  emptyMessage = input<string>('No products available'),
}) {
  script: () => (
    <div class="product-list">
      @if (products().length === 0) {
        <p class="empty-message">{emptyMessage()}</p>
      } @else {
        @for (product of products(); track product.id) {
          <Render fragment={item()} params={[product]} />
        }
      }
    </div>
  ),
  style: `
    .product-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      padding: 1rem;
    }

    .empty-message {
      text-align: center;
      color: #999;
      font-size: 1.125rem;
      padding: 2rem;
    }
  `,
}

// ============================================
// MAIN APPLICATION COMPONENT
// ============================================

/**
 * Store for managing products and cart
 */
class ProductStore {
  private readonly products = signal<Product[]>([]);
  private readonly cart = signal<Set<string>>(new Set());
  private readonly highlighted = signal<Set<string>>(new Set());

  readonly allProducts = this.products.asReadonly();
  readonly cartItems = computed(() =>
    this.products().filter(p => this.cart().has(p.id))
  );
  readonly cartCount = computed(() => this.cart().size);

  constructor(initialProducts: Product[] = []) {
    this.products.set(initialProducts);
  }

  addToCart(productId: string) {
    this.cart.update(cart => new Set([...cart, productId]));
  }

  removeFromCart(productId: string) {
    this.cart.update(cart => {
      const newCart = new Set(cart);
      newCart.delete(productId);
      return newCart;
    });
  }

  isInCart(productId: string) {
    return computed(() => this.cart().has(productId));
  }

  toggleHighlight(productId: string) {
    this.highlighted.update(hl => {
      const newSet = new Set(hl);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }

  isHighlighted(productId: string) {
    return computed(() => this.highlighted().has(productId));
  }
}

/**
 * Main catalog component demonstrating composition
 */
export #component ProductCatalog({
  initialProducts = input<Product[]>([]),
}) {
  script: () => {
    const store = inject(ProductStore);
    const searchQuery = signal('');
    const showDescriptions = signal(true);

    const filteredProducts = computed(() => {
      const query = searchQuery().toLowerCase();
      if (!query) return store.allProducts();

      return store.allProducts().filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    });

    function handleAddToCart(product: Product) {
      if (product.inStock) {
        store.addToCart(product.id);
      }
    }

    function handleRemoveFromCart(productId: string) {
      store.removeFromCart(productId);
    }

    function handleToggleHighlight(productId: string) {
      store.toggleHighlight(productId);
    }

    return (
      <div class="catalog">
        <header class="catalog-header">
          <h1>Product Catalog</h1>

          <div class="catalog-controls">
            <input
              type="search"
              placeholder="Search products..."
              model:value={searchQuery}
              class="search-input" />

            <label class="toggle-label">
              <input
                type="checkbox"
                model:checked={showDescriptions} />
              <span>Show descriptions</span>
            </label>

            <div
              class="cart-badge"
              @tooltip(message={`${store.cartCount()} items in cart`})>
              🛒 Cart ({store.cartCount()})
            </div>
          </div>
        </header>

        <ProductList
          products={filteredProducts()}
          emptyMessage="No products match your search">
          @fragment item(product: Product) {
            <Card
              @highlight(
                active={store.isHighlighted(product.id)()}
                highlightColor="#fff3cd"
              )>
              <ProductImage
                url={product.imageUrl}
                alt={product.name}
                inStock={product.inStock} />

              <ProductInfo
                product={product}
                showDescription={showDescriptions()}>
                @fragment actions() {
                  @const inCart = store.isInCart(product.id);

                  @if (inCart()) {
                    <Button
                      variant="secondary"
                      @ripple
                      @tooltip(message="Remove from cart")
                      on:click={() => handleRemoveFromCart(product.id)}>
                      Remove from Cart
                    </Button>
                  } @else {
                    <Button
                      variant="primary"
                      disabled={!product.inStock}
                      @ripple
                      @tooltip(message={product.inStock ? 'Add to cart' : 'Out of stock'})
                      on:click={() => handleAddToCart(product)}>
                      {product.inStock ? 'Add to Cart' : 'Unavailable'}
                    </Button>
                  }

                  <Button
                    variant="outline"
                    @tooltip(message="Toggle highlight")
                    on:click={() => handleToggleHighlight(product.id)}>
                    ⭐
                  </Button>
                }
              </ProductInfo>
            </Card>
          }
        </ProductList>
      </div>
    );
  },
  style: `
    .catalog {
      max-width: 1400px;
      margin: 0 auto;
    }

    .catalog-header {
      padding: 2rem 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }

    .catalog-header h1 {
      margin: 0 0 1rem 0;
    }

    .catalog-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .cart-badge {
      padding: 0.5rem 1rem;
      background: #007bff;
      color: white;
      border-radius: 20px;
      font-weight: 600;
      cursor: pointer;
    }

    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
    }

    .tooltip-top {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
    }

    .tooltip-bottom {
      top: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(8px);
    }

    .tooltip-left {
      right: 100%;
      top: 50%;
      transform: translateY(-50%) translateX(-8px);
    }

    .tooltip-right {
      left: 100%;
      top: 50%;
      transform: translateY(-50%) translateX(8px);
    }
  `,
  providers: () => [
    provide({
      token: ProductStore,
      useFactory: () => new ProductStore(initialProducts()),
    }),
  ],
}
```
