/**
 * supabase-js für alle Edge Functions — mit fester Version an genau einer Stelle.
 *
 * Vorher importierte jede Function `https://esm.sh/@supabase/supabase-js@2`: Jedes
 * Ausrollen konnte eine andere Version ziehen, über einen zusätzlichen Dienst in der
 * Lieferkette, und das mit service_role-Rechten. Die Version hier entspricht der im
 * package-lock.json des Frontends.
 */
export { createClient } from 'npm:@supabase/supabase-js@2.112.2';
export type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
