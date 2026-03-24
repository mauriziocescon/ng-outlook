## Why macros
Considering the `tsx` grammar doesn't currently support Angular control flow or directives, the likely way to go is using something like a DSL + [Volar](https://volarjs.dev/) which requires `**.ng` files and a new parser. In practice, something similar to what [ripple](https://www.ripple-ts.com/) did (high level). Assuming this setup (or similar in nature), one might argue that macros are not really necessary because a component could be written as a "sort of valid function". On the other hand: 
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

So with macros and DLS + Volar (or equivalent)
- you avoid unwanted flexibility (definitions: let / var),
- you avoid strange scope behaviours (`unwanted` above),
- you have clear markers for tools,
- you keep DI separated from script / template and at the same time enable the definition of providers depending on inputs, but not on variables defined inside script. 

Note that the entire proposal is keeping the idea of creating inputs / outputs / ... at component level, have ng syncing them and strict type checking at build time. Moreover, script runs only once at component creation time. 

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
