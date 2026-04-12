# Claude code
## Prompt:

Using:
- Angular Signal Forms (https://github.com/angular/angular/tree/main/packages/forms/signals)
- The proposed new authoring format described in readme.md and why-ng-files.md

Could you create a few form-related components that integrate seamlessly with this setup?

A couple of medium-complexity components is sufficient. Use only modern Angular and keep CSS to a minimum.

Output everything in a single Markdown file.

# Signal Forms — Reusable Input Components

Reusable form controls that integrate with [`@angular/forms/signals`](https://github.com/angular/angular/tree/main/packages/forms/signals) via the `[formField]` directive and `attachments`.

**How it works in the new `.ng` format:**
`use:formField(field={...})` on a component is collected into `attachments: directives<HTMLInputElement>()` and spread onto the inner `<input>` via `{...attachments()}`. The directive then runs on the native element and handles all value/state binding. The components are styled wrappers; error display stays in the consumer where `FieldState` is in scope.

---

## `app/forms/controls/text-input.ng`

Handles `text`, `email`, `password`, and `search` variants. Also usable standalone via `model:value={sig}`.

```ts
import { component, input, model, directives } from '@angular/core';

export const TextInput = component({
  bindings: {
    label:       input<string>(''),
    placeholder: input<string>(''),
    type:        input<'text' | 'email' | 'password' | 'search'>('text'),

    // Standalone usage: <TextInput model:value={sig} />
    value: model<string>(''),

    // Collects use:formField(...) and any other directives applied by the consumer.
    // They are spread onto the inner <input> so formField runs on the native element.
    attachments: directives<HTMLInputElement>(),
  },
  setup: ({ label, placeholder, type, value, attachments }) => ({
    template: (
      <label>
        @if (label()) { <span>{label()}</span> }
        <input
          {...attachments()}
          type={type()}
          placeholder={placeholder()}
          model:value={value} />
      </label>
    ),
  }),
  style: `
    label { display: flex; flex-direction: column; gap: 4px; }
    span { font-size: .9rem; font-weight: 500; }
    input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; }
    input:disabled { opacity: .55; cursor: not-allowed; }
  `,
});
```

---

## `app/forms/controls/checkbox-input.ng`

```ts
import { component, input, model, directives } from '@angular/core';

export const CheckboxInput = component({
  bindings: {
    label:   input.required<string>(),
    checked: model<boolean>(false),
    attachments: directives<HTMLInputElement>(),
  },
  setup: ({ label, checked, attachments }) => ({
    template: (
      <label class="row">
        <input
          {...attachments()}
          type="checkbox"
          model:checked={checked} />
        <span>{label()}</span>
      </label>
    ),
  }),
  style: `
    .row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    input { width: 16px; height: 16px; cursor: pointer; }
    input:disabled { cursor: not-allowed; opacity: .55; }
  `,
});
```

---

## Usage example

Error display is kept in the consumer — it reads `FieldState` directly, which avoids coupling the input components to the forms library.

```ts
import { component, signal } from '@angular/core';
import { form, schema, required, validate, emailError, minLengthError } from '@angular/forms/signals';
import { formField, formRoot } from '@angular/forms/signals';   // directives
import { TextInput } from './controls/text-input.ng';
import { CheckboxInput } from './controls/checkbox-input.ng';

interface SignupModel {
  email: string;
  password: string;
  acceptTerms: boolean;
}

const signupSchema = schema<SignupModel>((p) => {
  required(p.email);
  validate(p.email, ({ value }) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value()) ? undefined : emailError()
  );

  required(p.password);
  validate(p.password, ({ value }) =>
    value().length < 8 ? minLengthError(8) : undefined
  );

  required(p.acceptTerms);
});

export const SignupForm = component({
  setup: () => {
    const model = signal<SignupModel>({ email: '', password: '', acceptTerms: false });

    /**
     * setup() runs in an injection context, so form() resolves the injector
     * automatically — no inject(Injector) or explicit { injector } option needed.
     *
     * The submit action is defined here so formRoot can call it automatically.
     * formRoot intercepts the native submit event, prevents default, marks all
     * fields touched, validates, and — only when valid — calls this action.
     */
    const f = form(model, signupSchema, {
      submit: {
        action: (value) => console.log('signup', value),
      },
    });

    return {
      template: (
        /**
         * use:formRoot(field={f}) is applied to the native <form> element directly
         * (not forwarded via attachments — <form> is not a wrapper component).
         * No on:submit handler needed; formRoot owns the submit lifecycle.
         */
        <form use:formRoot(field={f})>

          /**
           * use:formField(field={f.email}) is collected by TextInput's attachments
           * and spread onto the inner <input>. The directive runs on the native
           * element: it syncs the value and marks touched on blur.
           *
           * Errors are read from FieldState in this template — no coupling
           * between TextInput and @angular/forms/signals.
           */
          <div class="field">
            <TextInput
              label="Email"
              type="email"
              use:formField(field={f.email}) />
            @if (f.email().touched() && f.email().errors().length > 0) {
              <span class="error">{f.email().errors()[0].message ?? f.email().errors()[0].kind}</span>
            }
          </div>

          <div class="field">
            <TextInput
              label="Password"
              type="password"
              use:formField(field={f.password}) />
            @if (f.password().touched() && f.password().errors().length > 0) {
              <span class="error">{f.password().errors()[0].message ?? f.password().errors()[0].kind}</span>
            }
          </div>

          <div class="field">
            <CheckboxInput
              label="I accept the terms"
              use:formField(field={f.acceptTerms}) />
            @if (f.acceptTerms().touched() && f.acceptTerms().errors().length > 0) {
              <span class="error">{f.acceptTerms().errors()[0].message ?? f.acceptTerms().errors()[0].kind}</span>
            }
          </div>

          <button type="submit">Sign up</button>
        </form>
      ),
    };
  },
  style: `
    form { display: flex; flex-direction: column; gap: 16px; max-width: 360px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .error { color: #c00; font-size: .8rem; }
  `,
});
```

---

## Standalone usage (no `formField`)

The same components work without a form, using `model:` directly:

```ts
<TextInput label="Search" type="search" model:value={query} />
<CheckboxInput label="Dark mode" model:checked={darkMode} />
```
