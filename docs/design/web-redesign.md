# Web redesign spec

Source of truth for restyling the React client. The visual reference is the design canvas
"Table Booking – Web & Mobile UI" (Aditya has the link). This file is what Claude Code builds from.

## Rules for every PR in this series

- **Styling only.** Change `className`s, markup structure for layout, `index.css` and `index.html`.
  Do not change logic, hooks, state, validation, routing, API calls, error handling or focus management.
- **Keep all copy** except where this spec gives new text (marked NEW TEXT).
- **Keep accessibility as it is:** every `role`, `aria-*`, `tabIndex`, `ref`, live region and label stays.
  Visible focus ring on every interactive element (2 px brass outline, 2 px offset).
- **No new npm dependencies.** Fonts load with a `<link>` in `index.html`.
- **Contrast:** text at least 4.5:1. Brass `#C9A46A` is only used for text on the dark ink background;
  on light backgrounds use `brass-text` `#7A5B2A`.
- **Touch targets** at least 44 px tall.
- Must work from 375 px wide upwards: the header wraps, grids collapse to one column.

## Tokens (Tailwind 4 `@theme` in `client/src/index.css`)

```css
@import "tailwindcss";

@theme {
  --color-ink: #111614; /* dark backgrounds, primary buttons, main text */
  --color-ink-raised: #263029; /* avatar circle, borders on dark */
  --color-ink-line: #3a463f; /* outlines on dark, disabled button on light */
  --color-on-ink-muted: #a9b1ac; /* secondary text on dark */
  --color-brass: #c9a46a; /* accents on dark, brass buttons */
  --color-brass-text: #7a5b2a; /* brass-coloured text on light */
  --color-paper: #f7f5f0; /* page background */
  --color-line: #e4dfd4; /* card borders */
  --color-line-soft: #ece8df; /* dividers inside cards */
  --color-field: #d8d2c6; /* input borders */
  --color-muted: #5e6661; /* secondary text on light */
  --color-body: #3d4440; /* labels */
  --color-success: #1f6b4e;
  --color-danger: #a3281c;
  --color-danger-soft: #fbedeb;
  --color-danger-line: #f0cfca;
  --color-danger-text: #6e1b13;
  --color-notice-soft: #fbf1e0;
  --color-notice-line: #eed9b4;
  --color-notice-text: #6b4a13;
  --color-neutral-pill: #f0ede6;
  --color-pill-text: #4a514c; /* text on the neutral pill */
  --color-on-ink-disabled: #e9e6df; /* text on a disabled / in-progress button */

  --font-sans: "Manrope", system-ui, sans-serif;
  --font-display: "Cormorant Garamond", Georgia, serif;

  --shadow-card: 0 1px 2px rgb(17 22 20 / 0.04);
  --shadow-raised:
    0 1px 2px rgb(17 22 20 / 0.06), 0 18px 48px rgb(17 22 20 / 0.12);
  --container-page: 1120px; /* max content width: max-w-page */
}
```

`index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

## Type

| Use                                  | Font    | Size / weight                                                                          |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| Page hero title                      | display | 52 px (36 px under 640 px), 600, tracking -0.02em, line-height 1.05                    |
| Section title ("3 tables available") | display | 30 px, 600                                                                             |
| Big numbers (table "T1", day "17")   | display | 34–40 px, 600, line-height 1                                                           |
| Eyebrow label ("RESERVATIONS")       | sans    | 11–12 px, 600, uppercase, tracking 0.14em, brass on dark / brass-text on light         |
| Body                                 | sans    | 15 px, 400                                                                             |
| Field label                          | sans    | 11 px, 600, uppercase, tracking 0.1em, muted (search bar); 13 px 600 body (auth forms) |

Serif is only for headings and big numbers. Everything people read in sentences or tap is Manrope.

## Components

- **Primary button:** `bg-ink text-white`, 12 px radius, 48 px tall, 600 weight. Hover `#263029`.
- **Brass button** (only on dark backgrounds): `bg-brass text-ink`.
- **Secondary button:** white, 1 px `field` border, pill radius, 44 px tall.
- **Danger button:** `bg-danger text-white`, pill radius.
- **Disabled / in-progress button:** `bg-ink-line`, text `#E9E6DF`.
- **Status:** a 7 px dot plus a word. Confirmed/Available = success. In progress = brass. Cancelled/Past = small uppercase pill, `neutral-pill` background, `#4A514C` text.
- **Card:** white, 1 px `line` border, 16 px radius, `shadow-card`. A highlighted/active card gets a 1.5 px brass border.
- **Notice (session expired):** `notice-soft` background, `notice-line` border, `notice-text`, 12 px radius, clock icon.
- **Error box:** `danger-soft` background, `danger-line` border, `danger-text`.
- **Inputs (auth forms):** 50 px tall, 12 px radius, `field` border, white. Invalid: 1.5 px `danger` border plus the existing error text in `danger`.
- **Icons:** inline stroke SVGs (1.8–2 px stroke, `currentColor`), `aria-hidden="true"`. No icon library.

## Screens

### Layout (header)

Dark band (`bg-ink`), content max width 1120 px, 32 px side padding, 1 px `ink-raised` line under the header row.

- Left: logo mark (30 px circle, 1.5 px brass border, brass fork-and-knife icon) + "Table Booking" in display 21 px 600 white.
- Right: nav links 14 px, `on-ink-muted`; the active link is white, 600, with a 1.5 px brass underline (NavLink `isActive`).
- Logged in: avatar circle (32 px, `ink-raised`, brass initial = first letter of the email, uppercase, `aria-hidden`), email in `on-ink-muted`, "Log out" as an outline pill (1 px `ink-line`, white text).
- Pages that show a hero (Find a table, My bookings) continue the dark band under the header; `Layout` keeps rendering `<Outlet />` and each page renders its own hero. Login/Register don't use the dark hero (see below).

### Find a table (`Availability.tsx`, `AvailabilityResults.tsx`, `BookingConfirmation.tsx`)

- Hero on dark: eyebrow NEW TEXT "Reservations", title NEW TEXT "Find your table", then the existing time-zone sentence in `on-ink-muted`. 56 px top padding, 88 px bottom padding.
- Search form: one white bar, 18 px radius, `shadow-raised`, pulled up over the hero edge (`-mt-12`). Inside, a grid `repeat(auto-fit, minmax(170px, 1fr))`: four field segments (uppercase label above a borderless 16 px 600 value) separated by 1 px `line-soft` left borders, then the "Find tables" button (ink, magnifier icon in brass) filling the last cell. Existing `TextField`/`SelectField` get a variant for this, without changing their props contract for the auth forms.
- Results header: eyebrow with the full date (brass-text), section title "N tables available" (keep the existing wording logic), summary line on the right in muted. 1 px `line` under it.
- Table cards in a grid `repeat(auto-fit, minmax(260px, 1fr))`, gap 20 px: label "Table" (uppercase small) above the table name in display 40 px; status dot top right; "Seats up to N" with a people icon; full-width primary button. The card being booked gets the brass border and the in-progress button.
- Confirmation: same card style with a success heading; keep its links/buttons and focus behaviour.

### My bookings (`MyBookings.tsx`, `MyBookingRow.tsx`, `Pagination.tsx`)

- Hero on dark, smaller: eyebrow NEW TEXT "Your reservations", title "My bookings" (44 px), the existing status line underneath in `on-ink-muted`.
- The list is one white card (18 px radius) with rows divided by `line-soft`.
- Row: date column 64 px wide with a right divider (weekday uppercase brass-text, day number display 34 px, month small muted), then time range (17 px 600) and "Table T3 · Party of 2" in muted; status and the cancel action on the right.
- Cancelled: time struck through and muted, "Cancelled" pill. Past bookings: whatever `MyBookingRow` already decides, shown with the neutral pill.
- Confirm-cancel state: the row background `#FCFBF8`; under it a `danger-soft` box with the existing question text, "Keep" as a secondary button and the confirm as a danger button. Keep the existing button labels.
- Pagination: "Page X of Y" on the left, Previous (secondary pill) / Next (primary pill) on the right.

### Log in / Register (`Login.tsx`, `Register.tsx`)

- Keep the `Layout` header for consistency. Below it, render the page as two columns that wrap on small screens:
  - Left (dark, `bg-ink`): eyebrow NEW TEXT "Welcome back" (Register: "Join us"), display 48 px NEW TEXT "Your table, held for you.", a muted sentence NEW TEXT "Log in to reserve a table and manage your bookings in one place." (Register: "Create an account to reserve a table and manage your bookings."). Hidden under 768 px.
  - Right: the form, max width 400 px, title in display 36 px, "New here? Create an account" link under the title (brass-text, 600), the session-expired notice in the notice style, inputs and full-width primary button as in Components.

### Not found (`NotFound.tsx`)

Display title, muted sentence, primary button back to Find a table. Keep the existing text.

## PR plan (one branch each, small)

1. `feat/design-tokens`: `@theme` tokens, fonts in `index.html`, body background `paper`, text `ink`, font `sans`; header restyle in `Layout.tsx`. Everything else keeps working with the old classes.
2. `feat/redesign-find-table`: Find a table hero, search bar, results cards, confirmation.
3. `feat/redesign-my-bookings`: My bookings hero, list, rows, cancel state, pagination.
4. `feat/redesign-auth`: Log in, Register, Not found.

Each PR: typecheck, build, and a manual check at 375 px, 768 px and 1280 px wide, with the keyboard (Tab through everything; the focus ring must be visible on dark and light backgrounds).
