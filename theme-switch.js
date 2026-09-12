// <theme-switch> — a zero-dependency light/auto/dark control.
//
// Usage:
//   <script type="module" src="theme-switch.js"></script>
//   <theme-switch></theme-switch>
//
// It sets data-theme="light"|"dark" on <html> (removed entirely for "auto", so
// prefers-color-scheme decides), persists the choice to localStorage, and
// dispatches both a "change" event on itself and a "themechange" event on
// document (detail: { value }) so a host page's own theme-swap logic — e.g.
// one already listening for "themechange" — keeps working unchanged.
//
// Load-bearing platform fact: a custom element only runs once its tag is
// parsed, which is after <head> and the top of <body> have already painted.
// It cannot itself prevent a flash of the wrong theme on a cold load. Keep a
// tiny inline bootstrap script at the top of <head> that reads the same
// storage key and sets data-theme before first paint — see README.
//
// Theming: every color is a CSS custom property, inherited from the host page
// through the shadow boundary the normal way. Define --surface, --line-2,
// --accent, --accent-ink, --muted on an ancestor (:root is fine) to match a
// site's palette; the values below are only the fallback when the host
// defines none.
const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>
  :host {
    display: inline-flex;
    --ts-surface: var(--surface, #ffffff);
    --ts-line-2: var(--line-2, #d3cfe0);
    --ts-accent: var(--accent, #6750a4);
    --ts-accent-ink: var(--accent-ink, #ffffff);
    --ts-accent-ink-on-dark: var(--accent-ink-on-dark, #14121b);
    --ts-muted: var(--muted, #6d6a7a);
  }
  .switch {
    position: relative;
    display: flex;
    flex-shrink: 0;
    background: var(--ts-surface);
    border: 1px solid var(--ts-line-2);
    border-radius: 99px;
    padding: 2px;
    touch-action: none;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc((100% - 4px) / 3);
    background: var(--ts-accent);
    border-radius: 99px;
    transition: transform 0.15s ease;
  }
  .switch[data-active="auto"] .thumb { transform: translateX(100%); }
  .switch[data-active="dark"] .thumb { transform: translateX(200%); }
  .option {
    position: relative;
    flex: 1;
    background: transparent;
    border: 0;
    border-radius: 99px;
    padding: 4px 12px;
    font: inherit;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--ts-muted);
    cursor: pointer;
  }
  .option:hover { color: var(--ts-accent); }
  .option:focus-visible { outline: 2px solid var(--ts-accent); outline-offset: 1px; }
  .option[aria-checked="true"] { color: var(--ts-accent-ink); }
  :host([data-resolved="dark"]) .option[aria-checked="true"] { color: var(--ts-accent-ink-on-dark); }
  @media (prefers-reduced-motion: reduce) {
    .thumb { transition: none; }
  }
</style>
<div class="switch" role="radiogroup" aria-label="Theme" data-active="auto">
  <span class="thumb" aria-hidden="true"></span>
  <button type="button" class="option" role="radio" data-value="light" aria-checked="false" tabindex="-1" aria-label="Light">&#9728;</button>
  <button type="button" class="option" role="radio" data-value="auto" aria-checked="true" tabindex="0" aria-label="Auto">Auto</button>
  <button type="button" class="option" role="radio" data-value="dark" aria-checked="false" tabindex="-1" aria-label="Dark">&#127769;</button>
</div>
`;

class ThemeSwitch extends HTMLElement {
  static get observedAttributes() { return ['storage-key']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(TEMPLATE.content.cloneNode(true));
    this._switch = this.shadowRoot.querySelector('.switch');
    this._thumb = this.shadowRoot.querySelector('.thumb');
    this._options = Array.prototype.slice.call(this.shadowRoot.querySelectorAll('.option'));
    this._dragRect = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
  }

  get storageKey() { return this.getAttribute('storage-key') || 'theme'; }

  connectedCallback() {
    let saved = null;
    try { saved = window.localStorage.getItem(this.storageKey); } catch (e) { /* storage may be blocked */ }
    this._apply(saved === 'light' || saved === 'dark' ? saved : 'auto', false);

    this._options.forEach((opt, index) => {
      opt.addEventListener('click', () => this._apply(opt.dataset.value, true));
      opt.addEventListener('keydown', (event) => {
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const next = this._options[(index + delta + this._options.length) % this._options.length];
        this._apply(next.dataset.value, true);
        next.focus();
      });
    });

    // Drag/swipe: Pointer Events unify mouse-drag and touch-swipe in one
    // handler. The thumb tracks the pointer while held, then snaps to
    // whichever third of the track it was released over. touch-action: none
    // above keeps the browser from also scrolling the page during the drag;
    // it is scoped to this control alone, so the rest of the page still
    // scrolls exactly as normal.
    this._switch.addEventListener('pointerdown', this._onPointerDown);
    this._switch.addEventListener('pointermove', this._onPointerMove);
    this._switch.addEventListener('pointerup', this._onPointerUp);
    this._switch.addEventListener('pointercancel', this._onPointerCancel);
  }

  disconnectedCallback() {
    this._switch.removeEventListener('pointerdown', this._onPointerDown);
    this._switch.removeEventListener('pointermove', this._onPointerMove);
    this._switch.removeEventListener('pointerup', this._onPointerUp);
    this._switch.removeEventListener('pointercancel', this._onPointerCancel);
  }

  _onPointerDown(event) {
    if (event.button !== 0) return;
    this._dragRect = this._switch.getBoundingClientRect();
    this._switch.setPointerCapture(event.pointerId);
    this._thumb.style.transition = 'none';
    this._followPointer(event.clientX);
  }

  _onPointerMove(event) {
    if (!this._dragRect) return;
    this._followPointer(event.clientX);
  }

  _onPointerUp(event) {
    if (!this._dragRect) return;
    const value = this._valueAtPointer(event.clientX);
    this._dragRect = null;
    this._thumb.style.transition = '';
    this._thumb.style.transform = '';
    this._apply(value, true);
  }

  _onPointerCancel() {
    this._dragRect = null;
    this._thumb.style.transition = '';
    this._thumb.style.transform = '';
  }

  _followPointer(clientX) {
    const width = this._thumb.offsetWidth;
    const x = Math.min(this._dragRect.width - width, Math.max(0, clientX - this._dragRect.left - width / 2));
    this._thumb.style.transform = 'translateX(' + x + 'px)';
  }

  _valueAtPointer(clientX) {
    const ratio = (clientX - this._dragRect.left) / this._dragRect.width;
    const index = Math.min(this._options.length - 1, Math.max(0, Math.floor(ratio * this._options.length)));
    return this._options[index].dataset.value;
  }

  /** @param {'light'|'auto'|'dark'} value */
  _apply(value, persist) {
    const resolved = value === 'dark' || (value === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
    if (value === 'light' || value === 'dark') {
      document.documentElement.setAttribute('data-theme', value);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    this.setAttribute('data-resolved', resolved);
    this._switch.setAttribute('data-active', value);
    this._options.forEach((opt) => {
      const isActive = opt.dataset.value === value;
      opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
      opt.tabIndex = isActive ? 0 : -1;
    });
    if (persist) {
      try { window.localStorage.setItem(this.storageKey, value); } catch (e) { /* storage may be blocked */ }
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true }));
    document.dispatchEvent(new CustomEvent('themechange', { detail: { value } }));
  }

  /** Read the current light/auto/dark choice. */
  get value() { return this._switch.getAttribute('data-active'); }

  /** Set the current choice and persist it, same as a click would. */
  set value(next) {
    if (next === 'light' || next === 'auto' || next === 'dark') this._apply(next, true);
  }
}

customElements.define('theme-switch', ThemeSwitch);
