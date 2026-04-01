# Claude code
## Prompt:

How would you create a couple of form-related components by integrating the new authoring format with Angular Signal Forms (https://github.com/angular/angular/tree/main/packages/forms/signals)?

A couple of medium-complexity components is more than enough. Use only modern Angular and keep CSS to a minimum.

Output everything in a single MD file.

# Angular Signal Forms — Custom Control & Composed Form

> **Note:** `@angular/forms/signals` is an **experimental** package (Angular 21+). The API
> surface is still evolving; treat all imports and types as subject to change.

---

## Prerequisites

```bash
# Signal Forms ships inside the Angular monorepo.
# Until a standalone release, reference it from source or an Angular 21+ dist.
npm install @angular/forms   # provides interop directives
# @angular/forms/signals is available as a sub-entry-point in Angular 21+
```

Angular version requirements: standalone components, signal inputs/outputs, and
built-in control flow (`@if`, `@for`) are all needed — all stable since Angular 17+.

---

## Overview of the Two Components

| Component | Role |
|---|---|
| `TextInputComponent` | Reusable primitive — implements `FormValueControl<string>` so any `[formField]` directive can drive it |
| `UserProfileFormComponent` | Form owner — creates a `FieldTree` via `form()`, defines validation via `schema()`, and composes `TextInputComponent` instances |

---

## 1. `TextInputComponent` — Custom Signal Form Control

### What it demonstrates

- Implementing the `FormValueControl<string>` contract required by the `[formField]` directive
- `model<string>('')` as the single required property of the contract
- Optional `input()` signals (`errors`, `disabled`, `required`, `invalid`, `touched`)
  that the `FormField` directive populates automatically when it detects them
- A `touch` output that the directive listens to in order to mark the field as touched
- A `computed()` that derives a single human-readable error message from the raw error map
- Pure signal-based value binding in the template (no `FormsModule` / `NgModel` needed)

```typescript
// text-input/text-input.component.ts
import {
  Component,
  computed,
  input,
  model,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/**
 * Generic text/email/password input that plugs into Angular Signal Forms via
 * the FormValueControl<string> contract.
 *
 * Usage with a Signal Forms field:
 *   <app-text-input label="Email" type="email" [formField]="form.email" />
 *
 * Usage standalone (no Signal Forms):
 *   <app-text-input label="Name" [(value)]="name" />
 */
@Component({
  selector: 'app-text-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field        { display: flex; flex-direction: column; gap: 4px; }
    label         { font-size: .875rem; font-weight: 500; }
    label .req    { color: #c00; margin-left: 2px; }
    input         { padding: .375rem .625rem; border: 1px solid #ccc; border-radius: 4px; font: inherit; }
    input:focus   { outline: 2px solid #0057e7; outline-offset: 1px; }
    input[aria-invalid="true"] { border-color: #c00; }
    .error        { font-size: .8rem; color: #c00; }
  `,
  template: `
    <div class="field">

      @if (label()) {
        <label [for]="inputId">
          {{ label() }}
          @if (required()) { <span class="req" aria-hidden="true">*</span> }
        </label>
      }

      <input
        [id]="inputId"
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="showError() ? errorId : null"
        [attr.aria-required]="required() || null"
        (input)="value.set($any($event.target).value)"
        (blur)="touch.emit()"
      />

      @if (showError()) {
        <span [id]="errorId" class="error" role="alert">
          {{ errorMessage() }}
        </span>
      }

    </div>
  `,
})
export class TextInputComponent implements FormValueControl<string> {

  // ── FormValueControl<string> contract ──────────────────────────────────────
  // `value` is the ONLY required property. The [formField] directive binds to
  // it like a regular two-way binding: it writes the field value in, and reads
  // user changes out through the ModelSignal's change event.
  readonly value = model<string>('');

  // Optional state inputs – the [formField] directive sets these automatically
  // when it detects them on the host component.
  readonly errors    = input<Record<string, unknown> | null>(null);
  readonly disabled  = input<boolean>(false);
  readonly required  = input<boolean>(false);
  readonly invalid   = input<boolean>(false);
  readonly touched   = input<boolean>(false);
  readonly dirty     = input<boolean>(false);
  readonly name      = input<string | undefined>(undefined);

  // Relay touch events back to the field so it can mark itself as touched.
  readonly touch = output<void>();

  // ── Component-specific inputs ───────────────────────────────────────────────
  readonly label       = input<string>('');
  readonly placeholder = input<string>('');
  readonly type        = input<'text' | 'email' | 'password'>('text');

  // ── Internal helpers ────────────────────────────────────────────────────────
  private static _nextId = 0;
  protected readonly inputId = `text-input-${++TextInputComponent._nextId}`;
  protected readonly errorId = `${this.inputId}-error`;

  protected readonly showError = computed(
    () => this.touched() && this.invalid() && !!this.errorMessage(),
  );

  /**
   * Maps the first error key in the error map to a readable message.
   * Signal Forms validation errors follow the same key convention as classic
   * Angular validators: 'required', 'email', 'minLength', 'maxLength', etc.
   */
  protected readonly errorMessage = computed((): string | null => {
    const errs = this.errors();
    if (!errs) return null;

    if ('required' in errs) return 'This field is required.';
    if ('email' in errs)    return 'Enter a valid email address.';

    const ml = errs['minLength'] as { requiredLength?: number } | undefined;
    if (ml?.requiredLength != null)
      return `At least ${ml.requiredLength} characters required.`;

    const xl = errs['maxLength'] as { requiredLength?: number } | undefined;
    if (xl?.requiredLength != null)
      return `No more than ${xl.requiredLength} characters allowed.`;

    const mn = errs['min'] as { min?: number } | undefined;
    if (mn?.min != null) return `Value must be at least ${mn.min}.`;

    const mx = errs['max'] as { max?: number } | undefined;
    if (mx?.max != null) return `Value must be at most ${mx.max}.`;

    return 'Invalid value.';
  });
}
```

---

## 2. `UserProfileFormComponent` — Composed Form with Schema & Validation

### What it demonstrates

- `form(modelSignal, schemaFn)` to create a reactive `FieldTree<UserProfile>`
- `schema()` for a **reusable** validation block that can be applied to multiple forms
- `required()`, `email()`, `minLength()`, `maxLength()` validators from Signal Forms
- `[formRoot]="..."` on `<form>` — disables browser validation and owns submission
- `[formField]="form.fieldName"` on both the custom `<app-text-input>` and a native
  `<textarea>` — shows the directive works with both control types
- Form-level validity derived via `computed()` from individual field states
- Submission guard that first marks all fields as touched to surface any errors

```typescript
// user-profile-form/user-profile-form.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import {
  form,
  schema,
  required,
  email,
  minLength,
  maxLength,
  FormField,
  FormRoot,
} from '@angular/forms/signals';

import { TextInputComponent } from '../text-input/text-input.component';

// ── Domain model ─────────────────────────────────────────────────────────────

interface UserProfile {
  firstName: string;
  lastName:  string;
  email:     string;
  bio:       string;
}

const EMPTY_PROFILE: UserProfile = {
  firstName: '',
  lastName:  '',
  email:     '',
  bio:       '',
};

// ── Reusable schema ───────────────────────────────────────────────────────────
// Defined outside the component so it can be imported by other forms that
// also contain a UserProfile-shaped subtree.

const userProfileSchema = schema<UserProfile>((profile) => {
  required(profile.firstName);
  minLength(profile.firstName, 2);

  required(profile.lastName);
  minLength(profile.lastName, 2);

  required(profile.email);
  email(profile.email);

  // bio is optional but capped
  maxLength(profile.bio, 300);
});

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-user-profile-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TextInputComponent,
    FormField,   // provides the [formField] directive
    FormRoot,    // provides the [formRoot] directive
  ],
  styles: `
    form         { display: flex; flex-direction: column; gap: 1rem; max-width: 480px; }
    textarea     { padding: .375rem .625rem; border: 1px solid #ccc; border-radius: 4px;
                   font: inherit; resize: vertical; min-height: 80px; }
    textarea[aria-invalid="true"] { border-color: #c00; }
    .char-count  { font-size: .75rem; color: #666; text-align: right; }
    .actions     { display: flex; gap: .5rem; }
    button       { padding: .4rem .9rem; border-radius: 4px; cursor: pointer; border: 1px solid; }
    .btn-primary { background: #0057e7; color: #fff; border-color: #0057e7; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-ghost   { background: transparent; }
    .success     { padding: .75rem; background: #e6f4ea; border-radius: 4px;
                   border-left: 4px solid #34a853; }
  `,
  template: `
    <form [formRoot]="profileForm" (ngSubmit)="onSubmit()">

      <app-text-input
        label="First name"
        placeholder="Ada"
        [formField]="profileForm.firstName"
      />

      <app-text-input
        label="Last name"
        placeholder="Lovelace"
        [formField]="profileForm.lastName"
      />

      <app-text-input
        label="Email address"
        type="email"
        placeholder="ada@example.com"
        [formField]="profileForm.email"
      />

      <!--
        Native <textarea> works with [formField] directly — no custom component
        needed. The FormField directive detects the native element and wires up
        value + touched state automatically.
      -->
      <div>
        <label for="bio-input">
          Bio
          <span style="font-weight:400;font-size:.8rem"> (optional)</span>
        </label>
        <textarea
          id="bio-input"
          placeholder="Tell us about yourself…"
          [formField]="profileForm.bio"
          [attr.aria-invalid]="profileForm.bio().invalid() || null"
        ></textarea>
        <p class="char-count">
          {{ bioLength() }} / 300
        </p>
      </div>

      <div class="actions">
        <button
          type="submit"
          class="btn-primary"
          [disabled]="submitting()"
        >
          {{ submitting() ? 'Saving…' : 'Save profile' }}
        </button>
        <button type="button" class="btn-ghost" (click)="onReset()">
          Reset
        </button>
      </div>

    </form>

    @if (savedProfile()) {
      <div class="success" role="status">
        <strong>Profile saved!</strong>
        {{ savedProfile()!.firstName }} {{ savedProfile()!.lastName }}
        &lt;{{ savedProfile()!.email }}&gt;
      </div>
    }
  `,
})
export class UserProfileFormComponent {

  // ── Model signal — single source of truth for the form value ───────────────
  // form() does NOT copy the data; the model IS the form value.
  private readonly model = signal<UserProfile>({ ...EMPTY_PROFILE });

  // ── FieldTree — drives the entire form ─────────────────────────────────────
  // Apply the reusable schema defined above.
  protected readonly profileForm = form(this.model, userProfileSchema);

  // ── UI state ───────────────────────────────────────────────────────────────
  protected readonly submitting  = signal(false);
  protected readonly savedProfile = signal<UserProfile | null>(null);

  /**
   * Aggregate form validity across all fields.
   * Each field in the FieldTree is a callable signal: calling it (e.g.
   * `profileForm.email()`) returns the field's reactive state, which exposes
   * `.invalid()` as a boolean computed signal.
   */
  protected readonly isFormValid = computed(() =>
    !this.profileForm.firstName().invalid() &&
    !this.profileForm.lastName().invalid()  &&
    !this.profileForm.email().invalid()     &&
    !this.profileForm.bio().invalid(),
  );

  protected readonly bioLength = computed(
    () => this.model().bio.length,
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  protected async onSubmit(): Promise<void> {
    // Touch every field so validation messages become visible even if the user
    // never interacted with a field.
    this.profileForm.firstName().markAsDirty();
    this.profileForm.lastName().markAsDirty();
    this.profileForm.email().markAsDirty();
    this.profileForm.bio().markAsDirty();

    if (!this.isFormValid()) return;

    this.submitting.set(true);
    try {
      // Simulate an async save; replace with a real service call.
      await simulateSave(this.model());
      this.savedProfile.set(structuredClone(this.model()));
    } finally {
      this.submitting.set(false);
    }
  }

  protected onReset(): void {
    this.model.set({ ...EMPTY_PROFILE });
    this.savedProfile.set(null);
  }
}

// ── Utility (would live in a service in a real app) ────────────────────────

function simulateSave(profile: UserProfile): Promise<void> {
  return new Promise((resolve) => setTimeout(() => {
    console.log('Saved:', profile);
    resolve();
  }, 800));
}
```

---

## How They Fit Together

```
UserProfileFormComponent
│
│  model = signal<UserProfile>({ firstName: '', … })
│  profileForm = form(model, userProfileSchema)   ← FieldTree<UserProfile>
│
│  <form [formRoot]="profileForm">
│  │
│  │  <app-text-input [formField]="profileForm.firstName">
│  │  └─ FormField directive detects FormValueControl<string>:
│  │       • writes profileForm.firstName().value → component.value (model input)
│  │       • reads component.value changes → updates model signal
│  │       • sets component.errors / invalid / touched / required inputs
│  │       • listens to component.touch output → marks field touched
│  │
│  │  <textarea [formField]="profileForm.bio">
│  │  └─ FormField directive detects native element:
│  │       • same state sync, handled natively
│  │
│  │  <button type="submit"> → (ngSubmit) → onSubmit()
│  │       • guard: isFormValid() computed from field states
│  │       • reads final value directly from model()
```

---

## Side-note: `transformedValue` for Non-String Fields

When a field holds a `number` (or any type that differs from the raw string a
native `<input>` produces), `transformedValue` bridges the gap without a
separate component:

```typescript
// Inside a hypothetical NumberInputComponent that implements
// FormValueControl<number | null>:
import { transformedValue } from '@angular/forms/signals';

readonly value = model.required<number | null>();

// rawValue is what the <input> sees (string); it auto-syncs with value.
protected readonly rawValue = transformedValue(this.value, {
  parse: (raw) => {
    if (raw === '') return { value: null };
    const n = Number(raw);
    return Number.isNaN(n)
      ? { error: { parse: { message: `"${raw}" is not a number` } } }
      : { value: n };
  },
  format: (n) => n?.toString() ?? '',
});
```

```html
<input
  [value]="rawValue()"
  (input)="rawValue.set($any($event.target).value)"
  (blur)="touch.emit()"
/>
```

The `parseErrors` signal on `rawValue` surfaces parse failures as a separate
error channel, distinct from Signal Forms validation errors.

---

## Key Takeaways

| Concept | Where used |
|---|---|
| `model<T>()` | `TextInputComponent.value` — the FormValueControl contract |
| `input<T>()` for state | `errors`, `disabled`, `invalid`, `touched` on `TextInputComponent` |
| `output<void>()` | `touch` on `TextInputComponent` |
| `computed()` | `errorMessage`, `isFormValid`, `bioLength` |
| `signal<T>()` | `model`, `submitting`, `savedProfile` in the form component |
| `form(modelSignal, schema)` | Creates the reactive `FieldTree` |
| `schema()` | Reusable, composable validation block |
| `required()`, `email()`, `minLength()`, `maxLength()` | Validators applied inside the schema |
| `[formField]` directive | Binds a `Field<T>` to a custom or native control |
| `[formRoot]` directive | Owns `novalidate` + submission lifecycle on `<form>` |
| `field().invalid()`, `field().markAsDirty()` | Programmatic access to field state |
