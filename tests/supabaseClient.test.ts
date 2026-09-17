import { describe, it, expect } from 'vitest';
import { supabase } from '../src/lib/supabaseClient';

describe('Supabase Client Initialisation', () => {
  it('should initialize and export a Supabase client instance', () => {
    expect(supabase).toBeDefined();
    expect(supabase.from).toBeTypeOf('function');
    expect(supabase.rpc).toBeTypeOf('function');
  });
});
