## Why macros
Since `tsx` grammar does not currently support Angular control flow or directives, the likely path forward involves a DSL combined with [Volar](https://volarjs.dev/), requiring `**.ng` files and a custom parser — similar in principle to what [ripple](https://www.ripple-ts.com/) has done. Assuming this setup (or something comparable), one could argue that macros are unnecessary, since a component could be written as a plain function. However, consider the following: 
```ts
import { component, ... } from '@angular/core';

let Comp = component(({
  /** ... **/
}) => {
  const unwanted = 'unwanted';
  return {
    script: () => {
      ...
      return {
        template: (...),
        exports: {...},
      };
    },
    style: `...`,
    providers: () => [...],
  };
});
```

With macros and DSL + Volar (or equivalent):
- unwanted flexibility is avoided (e.g., `let` / `var` declarations),
- unexpected scope behaviors are eliminated (e.g., the `unwanted` variable in the example above),
- tooling has clear structural markers to work with,
- DI is kept separate from the script and template, while still allowing providers to depend on inputs — but not on variables defined inside the script.

Note that the entire proposal preserves the concept of declaring inputs, outputs, and similar constructs at the component level, with Angular syncing them and enforcing strict type checking at build time. Additionally, the script runs only once, at component creation time.

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

#directive tooltip({
  message = input.required<string>(),
  host = ref<HTMLElement>(),
}) {
  script: () => {
    const renderer = inject(Renderer2);

    afterRenderEffect(() => {
      /** ... **/
    });
  },
}

#declaration currency({
  value = input.required<number | undefined>(),
  currencyCode = input<string>(),
}) {
  script: () => {
    const localeId = inject(LOCALE_ID);
    
    return computed(/** ... **/);
  },
}

#component List({
  items = input.required<Item[]>(),
  item = fragment<[Item]>(),
}) {
  script: () => (
    @for (i of items(); track i.id) {
      <Render fragment={item()} params={[i]} />
    }
  ),
}

class ItemsStore {
  /** ... **/
}

export #component ItemsPage() {
  script: () => {
    const store = inject(ItemsStore);
  
    function goTo(item: Item) {
      // ..
    }
    
    return (
      <List items={store.items()}>
        @fragment item(i: Item) {
          <Card on:click={() => goTo(i)}>
            <HStack width={100}>
              <Img url={i.imgUrl} />
              <VStack>
                <Title title={i.title} />
                <Description @tooltip(message={i.title}) description={i.description} />
                
                <hr />                
                
                @const price = @currency({value: i.price, currencyCode: 'EUR'});
                <p>Price: {price()}</p>
              </VStack>
            </HStack>
          </Card>
        }
      </List>
    );
  },
  styleUrl: './items-page.css',
  providers: () => [
    provide({ token: ItemsStore, useFactory: () => new ItemsStore() }),
  ],
}
```
