import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyTheme,
  isThemeChoice,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from '../../src/lib/theme';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('resolveTheme', () => {
  it('folgt bei „system" dem Gerät', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('übergeht das Gerät bei einer festen Wahl', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemeChoice', () => {
  it('nimmt nur die drei bekannten Werte an', () => {
    expect(isThemeChoice('dark')).toBe(true);
    expect(isThemeChoice('bunt')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});

describe('readStoredTheme', () => {
  it('liefert ohne Eintrag „system"', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('liest eine gespeicherte Wahl', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignoriert Unsinn im Speicher', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('system');
  });

  it('übersteht einen gesperrten Speicher', () => {
    // Privates Fenster, gesperrte Website-Daten: `getItem` wirft. Eine Anwendung, die
    // daran scheitert, wäre wegen einer Farbeinstellung nicht startbar.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredTheme()).toBe('system');
  });

  it('übersteht auch einen gesperrten Schreibversuch', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeTheme('dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('setzt und entfernt die Klasse', () => {
    const root = document.createElement('html');

    applyTheme('dark', root);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');

    applyTheme('light', root);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});
