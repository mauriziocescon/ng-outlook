## Co-located templates in Angular via .ng files
Since `tsx` grammar currently does not support Angular control flow or directives, the likely path forward involves a DSL combined with [Volar](https://volarjs.dev/), requiring `*.ng` files and a custom parser — similar in principle to what [ripple](https://www.ripple-ts.com/) has done. Assuming this setup (or something comparable), one could argue that losing the ability to keep the template as a separate file (e.g., via `templateUrl`) is a significant regression. That said, agents tend to prefer something similar in nature to React where
- the template is part of the component definition,
- the template is defined within the setup's scope, with direct access to its variables,
- tooling has clear structural markers to work with,
- provider declarations are kept separate from the setup and template, while still allowing providers to depend on inputs — but not on variables defined inside the setup.

Note that the entire proposal preserves the concept of declaring inputs, outputs, and similar constructs at the component level, with Angular syncing them and enforcing strict type checking at build time. Additionally, the setup runs only once, at component creation time.

### Another example
```ts
import { ... } from '@angular/core';
import { Card, HStack, Img, VStack, Title, Description } from '@lib/card';

export interface Item {
  id: string;
  imgUrl: string;
  title: string;
  description: string;
  price: number;
}

const tooltip = directive<HTMLElement>({
  bindings: {
    message: input.required<string>(),
  },
  setup: ({ message }, { host }) => {
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      /** ... **/
    });

    return {
      /** ... **/
    };
  },
});

const currency = derivation({
  bindings: {
    value: input.required<number | undefined>(),
    currencyCode: input<string>(),
  },
  setup: ({ value, currencyCode }) => {
    const localeId = inject(LOCALE_ID);

    return computed(/** ... **/);
  },
});

const List = component({
  bindings: {
    items: input.required<Item[]>(),
    item: fragment<[Item]>(),
  },
  setup: ({ items, item }) => ({
    template: (
      @for (i of items(); track i.id) {
        @render(item(i))
      }
    ),
  }),
});

class ItemsStore {
  /** ... **/
}

export const ItemsPage = component({
  setup: () => {
    const store = inject(ItemsStore);

    function goTo(item: Item) {
      // ..
    }

    return {
      template: (
        <List items={store.items()}>
          @fragment item(i: Item) {
            <Card on:click={() => goTo(i)}>
              <HStack width={100}>
                <Img url={i.imgUrl} />
                <VStack>
                  <Title title={i.title} />
                  <Description use:tooltip(message={i.title}) description={i.description} />

                  <hr />

                  @derive price = currency({value: i.price, currencyCode: 'EUR'});
                  <p>Price: {price()}</p>
                </VStack>
              </HStack>
            </Card>
          }
        </List>
      ),
    };
  },
  styleUrl: './items-page.css',
  providers: () => [
    provide({ token: ItemsStore, useFactory: () => new ItemsStore() }),
  ],
});
```
