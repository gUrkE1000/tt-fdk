import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  applyUpdate,
  detectPlatform,
  isInstalled,
  registerServiceWorker,
  serviceWorkerSupported,
  SW_URL,
} from '../../src/lib/pwa';

describe('detectPlatform', () => {
  it('erkennt iPhone und iPad', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios');
  });

  it('erkennt Android', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
  });

  it('nimmt sonst den Schreibtisch an', () => {
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('desktop');
    expect(detectPlatform('')).toBe('desktop');
  });
});

describe('isInstalled', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete (navigator as { standalone?: boolean }).standalone;
  });

  it('erkennt den Standalone-Modus', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
    expect(isInstalled()).toBe(true);
  });

  it('erkennt den Sonderweg von iOS', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia;
    (navigator as { standalone?: boolean }).standalone = true;
    expect(isInstalled()).toBe(true);
  });

  it('meldet im Browserfenster false', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia;
    expect(isInstalled()).toBe(false);
  });
});

describe('registerServiceWorker', () => {
  const listeners: Record<string, ((event: Event) => void)[]> = {};
  let registration: {
    waiting: ServiceWorker | null;
    installing: {
      state: string;
      addEventListener: (type: string, handler: () => void) => void;
    } | null;
    addEventListener: (type: string, handler: (event: Event) => void) => void;
  };

  beforeEach(() => {
    for (const key of Object.keys(listeners)) delete listeners[key];
  });

  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  function install(controller: unknown = {}) {
    registration = {
      waiting: null,
      installing: null,
      addEventListener: (type, handler) => {
        (listeners[type] ??= []).push(handler);
      },
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller,
        register: vi.fn().mockResolvedValue(registration),
        addEventListener: vi.fn(),
      },
    });
  }

  it('meldet ohne Unterstützung gar nichts an', async () => {
    expect(serviceWorkerSupported()).toBe(false);
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('meldet den Worker unter der Basis-Adresse an', async () => {
    install();
    await registerServiceWorker(vi.fn());
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith(SW_URL);
    expect(SW_URL).toMatch(/sw\.js$/);
  });

  it('meldet einen bereits wartenden Stand sofort', async () => {
    install();
    const onUpdate = vi.fn();
    const waiting = {} as ServiceWorker;
    // Die Registrierung liegt schon vor, bevor sich jemand anmeldet.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register: vi.fn().mockResolvedValue({ ...registration, waiting }),
        addEventListener: vi.fn(),
      },
    });

    await registerServiceWorker(onUpdate);
    expect(onUpdate).toHaveBeenCalledWith(waiting);
  });

  it('meldet einen neu installierten Stand — aber nur, wenn schon einer lief', async () => {
    install();
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);

    const stateListeners: (() => void)[] = [];
    registration.installing = {
      state: 'installed',
      addEventListener: vi.fn((_type: string, handler: () => void) => {
        stateListeners.push(handler);
      }),
    };

    for (const handler of listeners.updatefound ?? []) handler(new Event('updatefound'));
    for (const handler of stateListeners) handler();

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('meldet beim allerersten Besuch keinen neuen Stand', async () => {
    // Ohne Controller ist es die erste Installation — da gibt es nichts zu aktualisieren,
    // und ein „neue Fassung bereit" wäre schlicht falsch.
    install(null);
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);

    const stateListeners: (() => void)[] = [];
    registration.installing = {
      state: 'installed',
      addEventListener: vi.fn((_type: string, handler: () => void) => {
        stateListeners.push(handler);
      }),
    };

    for (const handler of listeners.updatefound ?? []) handler(new Event('updatefound'));
    for (const handler of stateListeners) handler();

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('schluckt einen Fehlschlag beim Anmelden', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: vi.fn().mockRejectedValue(new Error('nope')) },
    });

    await expect(registerServiceWorker(vi.fn())).resolves.toBeUndefined();
  });
});

describe('applyUpdate', () => {
  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  it('weist den wartenden Worker an zu übernehmen', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {}, register: vi.fn(), addEventListener: vi.fn() },
    });

    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    applyUpdate(waiting);

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
      { once: true },
    );
  });
});

describe('App-Symbole', () => {
  // Ohne diese Dateien ist die Anwendung nicht installierbar — und das merkt man erst,
  // wenn ein Mitglied es versucht.
  it.each([
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
  ])('%s liegt in public/icons', (file) => {
    expect(existsSync(resolve(__dirname, '../../public/icons', file))).toBe(true);
  });
});
