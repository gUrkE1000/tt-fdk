import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Supabase erkennt eine Migration an der Zahl vor dem Unterstrich, nicht am Namen. Zwei
 * Dateien mit derselben Zahl hält `supabase db push` für eine: Die zweite wird nie
 * eingespielt, oder das Ausrollen scheitert an `schema_migrations_pkey` (F-9).
 */
describe('Migrationen', () => {
  const dir = resolve(__dirname, '../../supabase/migrations');
  const files = readdirSync(dir).filter((name) => name.endsWith('.sql'));

  it('tragen jede Versionsnummer nur einmal', () => {
    const byVersion = new Map<string, string[]>();
    for (const file of files) {
      const version = file.split('_')[0];
      byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
    }
    const duplicates = [...byVersion.values()].filter((names) => names.length > 1);
    expect(duplicates).toEqual([]);
  });

  it('beginnen mit einer vierzehnstelligen Zeitmarke', () => {
    expect(files.filter((file) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(file))).toEqual([]);
  });
});
