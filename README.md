# theme-switch

A light/auto/dark toggle as one dependency-free custom element. Built once for
[stock-today.com](https://stock-today.com) and [pfalkowski.github.io/cv](https://pfalkowski.github.io/cv),
then pulled out here so both — and anything else — can share the same control
instead of three drifting copies.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/PFalkowski/theme-switch@v1/theme-switch.js"></script>
<theme-switch></theme-switch>
```

That's the whole integration. No build step, no framework, no bundler: the
file above is the entire component, loaded as a native ES module.

## What it does

- Renders a pill with three options — Light, Auto, Dark — and a thumb that
  slides behind whichever is selected.
- The thumb can be **clicked, tapped, or dragged/swiped** — one pointer-event
  handler covers mouse and touch, and it tracks the pointer live while held
  before snapping to the nearest option on release.
- Arrow keys move focus and selection between options (`role="radiogroup"` /
  `role="radio"`, roving `tabindex`), matching native radio-group behavior.
- "Light" and "Dark" set `data-theme="light"` / `data-theme="dark"` on
  `<html>`; "Auto" removes the attribute so `prefers-color-scheme` decides.
  Choice persists to `localStorage` under a configurable key.
- Fires `change` on itself and `themechange` on `document` (both with
  `detail: { value }`), so a page with its own theme-swap logic already
  listening for either keeps working unchanged.

## Two load-bearing facts

**It cannot prevent a flash of the wrong theme by itself.** A custom
element's code only runs once its tag is parsed and upgraded, which is after
`<head>` — and the top of `<body>` — has already painted. Keep a tiny inline
bootstrap script at the very top of `<head>`, before any stylesheet, that
reads the same storage key and sets `data-theme` immediately:

```html
<script>
(function () {
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
})();
</script>
```

**Every color it draws is a CSS custom property**, inherited from the host
page through the shadow boundary the normal way — nothing special to opt in.
Define these on `:root` (or any ancestor) to match a site's palette; the
values below are only the fallback used when none are defined:

| Property | Fallback | Used for |
|---|---|---|
| `--surface` | `#ffffff` | Track background |
| `--line-2` | `#d3cfe0` | Track border |
| `--accent` | `#6750a4` | Thumb, hover color |
| `--accent-ink` | `#ffffff` | Text on the selected option (light thumb) |
| `--accent-ink-on-dark` | `#14121b` | Text on the selected option, when `<html data-theme="dark">` |
| `--muted` | `#6d6a7a` | Text on unselected options |

## API

| | |
|---|---|
| `storage-key` attribute | `localStorage` key to persist under. Default `theme`. Give each embedding site its own if they must not share a choice — they usually don't need to, since `localStorage` is already scoped per origin. |
| `.value` property (get/set) | Current choice, one of `"light"`, `"auto"`, `"dark"`. Setting it applies and persists the change, same as a click. |
| `change` event | Fires on the element. `event.detail.value` is the new choice. |
| `themechange` event | Fires on `document`, same detail — for a page whose own logic already listens for this (stock-today.com's did, before this component replaced it). |

## Why a custom element instead of a framework component

The three consumers don't share a framework: a static HTML report generated
by a .NET job, an Astro-built static site, and — informally — a fourth,
`whats-next`'s own PowerShell-generated HTML report, which keeps its own copy
styled to its own palette rather than taking a network dependency for an
offline-first CLI tool. A native custom element is the one thing all of them
can load without adopting each other's build tooling.

## Local development

Open `demo.html` directly in a browser (no server, no build) to see the
control against a couple of different token sets side by side.

## License

MIT © Piotr Falkowski
