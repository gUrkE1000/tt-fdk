import '@testing-library/jest-dom/vitest';

/**
 * jsdom kennt weder ResizeObserver noch die Zeiger-Methoden, die Radix UI benutzt.
 * Ohne diese Attrappen brechen Komponenten mit Checkbox, Dialog oder Select beim
 * Rendern ab — mit ihnen verhalten sie sich wie im Browser, nur ohne Layout.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
