#!/usr/bin/env node
/**
 * Erzeugt src/lib/database.types.ts aus dem Katalog der lokalen Datenbank.
 *
 * Warum nicht `supabase gen types`? Die CLI startet dafür einen Container mit
 * postgres-meta — in unserer Entwicklungsumgebung und in der CI gibt es aber keinen
 * Docker-Daemon. Dieser Generator liest dieselben Informationen direkt über psql und
 * gibt die Typen in der Form aus, die supabase-js erwartet
 * (Database["public"]["Tables"][…]["Row" | "Insert" | "Update"]).
 *
 * Aufruf: node scripts/gen-types.mjs > src/lib/database.types.ts
 */
import { execFileSync } from 'node:child_process';

const DB_NAME = process.env.DB_NAME ?? 'vereinsplaner';
const env = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '127.0.0.1',
  PGPORT: process.env.PGPORT ?? '5432',
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
};

/** Führt eine Abfrage aus, die genau eine JSON-Spalte liefert. */
function queryJson(sql) {
  const out = execFileSync('psql', ['-d', DB_NAME, '-X', '-t', '-A', '-c', sql], {
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out.trim() || '[]');
}

// ---------------------------------------------------------------- Abfragen

const enums = queryJson(`
  SELECT COALESCE(json_agg(e ORDER BY e.name), '[]'::json) FROM (
    SELECT t.typname AS name,
           json_agg(l.enumlabel ORDER BY l.enumsortorder) AS values
      FROM pg_type t
      JOIN pg_enum l ON l.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e'
       )
     GROUP BY t.typname
  ) e;
`);

const relations = queryJson(`
  SELECT COALESCE(json_agg(r ORDER BY r.name), '[]'::json) FROM (
    SELECT c.relname AS name,
           c.relkind AS kind,
           json_agg(
             json_build_object(
               'name', a.attname,
               'type', format_type(a.atttypid, NULL),
               'udt', t.typname,
               'is_enum', t.typtype = 'e',
               'is_array', t.typcategory = 'A',
               'element_udt', COALESCE(et.typname, ''),
               'element_is_enum', COALESCE(et.typtype = 'e', false),
               'nullable', NOT a.attnotnull,
               'has_default', a.atthasdef,
               'generated', a.attgenerated <> ''
             ) ORDER BY a.attnum
           ) AS columns
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      JOIN pg_type t ON t.oid = a.atttypid
      LEFT JOIN pg_type et ON et.oid = t.typelem
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'v', 'm')
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e'
       )
     GROUP BY c.relname, c.relkind
  ) r;
`);

const functions = queryJson(`
  SELECT COALESCE(json_agg(f ORDER BY f.name), '[]'::json) FROM (
    SELECT p.proname AS name,
           pg_get_function_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS result,
           p.proretset AS returns_set
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       -- Trigger-Funktionen und interne Helfer gehören nicht in die API-Typen.
       AND pg_get_function_result(p.oid) <> 'trigger'
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
       -- Alles, was zu einer Extension gehoert (pgTAP, pgcrypto), bleibt draussen.
       -- Sonst unterschieden sich die Typen zwischen lokaler Instanz und Supabase.
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
       )
  ) f;
`);

// ---------------------------------------------------------------- Typabbildung

const SCALARS = {
  uuid: 'string',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  citext: 'string',
  name: 'string',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  bool: 'boolean',
  timestamptz: 'string',
  timestamp: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  interval: 'string',
  json: 'Json',
  jsonb: 'Json',
  bytea: 'string',
  inet: 'string',
};

function enumRef(udt) {
  return `Database["public"]["Enums"]["${udt}"]`;
}

function tsType(column) {
  if (column.is_array) {
    const inner = column.element_is_enum
      ? enumRef(column.element_udt)
      : (SCALARS[column.element_udt] ?? 'unknown');
    return `${inner}[]`;
  }
  if (column.is_enum) return enumRef(column.udt);
  return SCALARS[column.udt] ?? 'unknown';
}

function rowType(column) {
  const base = tsType(column);
  return column.nullable ? `${base} | null` : base;
}

// ---------------------------------------------------------------- Ausgabe

const lines = [];
const w = (s = '') => lines.push(s);

w('// Automatisch erzeugt — nicht von Hand bearbeiten.');
w('// Neu erzeugen mit: npm run gen:types');
w('//');
w('// Quelle ist der Katalog der lokalen Datenbank (scripts/gen-types.mjs). Die Form');
w('// entspricht dem, was supabase-js erwartet.');
w('');
w('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
w('');
w('export interface Database {');
w('  public: {');
w('    Tables: {');

const tables = relations.filter((r) => r.kind === 'r');
const views = relations.filter((r) => r.kind === 'v' || r.kind === 'm');

for (const table of tables) {
  w(`      ${table.name}: {`);
  w('        Row: {');
  for (const c of table.columns) w(`          ${c.name}: ${rowType(c)};`);
  w('        };');

  w('        Insert: {');
  for (const c of table.columns) {
    if (c.generated) continue; // generierte Spalten lassen sich nicht schreiben
    const optional = c.nullable || c.has_default;
    w(`          ${c.name}${optional ? '?' : ''}: ${rowType(c)};`);
  }
  w('        };');

  w('        Update: {');
  for (const c of table.columns) {
    if (c.generated) continue;
    w(`          ${c.name}?: ${rowType(c)};`);
  }
  w('        };');
  w('      };');
}

w('    };');
w('    Views: {');
for (const view of views) {
  w(`      ${view.name}: {`);
  w('        Row: {');
  // Spalten einer View gelten im Katalog als nullable; das ist auch fachlich richtig,
  // weil jede Maskierung NULL liefern kann.
  for (const c of view.columns) w(`          ${c.name}: ${tsType(c)} | null;`);
  w('        };');
  w('      };');
}
w('    };');

w('    Functions: {');
for (const fn of functions) {
  w(`      ${fn.name}: {`);
  w(`        Args: ${fn.args ? `{ /* ${fn.args} */ [key: string]: unknown }` : 'Record<string, never>'};`);
  w(`        Returns: unknown;`);
  w('      };');
}
w('    };');

w('    Enums: {');
for (const e of enums) {
  w(`      ${e.name}: ${e.values.map((v) => `"${v}"`).join(' | ')};`);
}
w('    };');
w('  };');
w('}');
w('');
w('// Kurzformen für den Alltag');
w('export type Tables<T extends keyof Database["public"]["Tables"]> =');
w('  Database["public"]["Tables"][T]["Row"];');
w('export type InsertDto<T extends keyof Database["public"]["Tables"]> =');
w('  Database["public"]["Tables"][T]["Insert"];');
w('export type UpdateDto<T extends keyof Database["public"]["Tables"]> =');
w('  Database["public"]["Tables"][T]["Update"];');
w('export type ViewRow<T extends keyof Database["public"]["Views"]> =');
w('  Database["public"]["Views"][T]["Row"];');
w('export type Enums<T extends keyof Database["public"]["Enums"]> =');
w('  Database["public"]["Enums"][T];');

process.stdout.write(lines.join('\n') + '\n');
