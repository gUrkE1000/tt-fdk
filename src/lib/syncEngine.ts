import { SupabaseClient } from '@supabase/supabase-js';
import { parseIcs, determineHomeAway, extractMatchday, IcsEvent } from './icsParser';

export interface SyncResult {
  teamId: string;
  teamName: string;
  status: 'success' | 'failed';
  message: string;
  added: number;
  updated: number;
  rescheduled: number;
  deactivated: number;
}

async function fetchIcsText(httpUrl: string): Promise<string> {
  const errors: string[] = [];

  // 1. Try api.allorigins.win (with retries and delay)
  const maxRetries = 3;
  let allOriginsSuccess = false;
  let allOriginsContent = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // A. Try the RAW endpoint first (most reliable, bypassing JSON/Base64 wrapping)
    try {
      const rawUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(httpUrl)}`;
      const resp = await fetch(rawUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes('BEGIN:VCALENDAR')) {
          allOriginsContent = text;
          allOriginsSuccess = true;
          break;
        }
      }
    } catch (err: any) {
      errors.push(`AllOrigins RAW (Attempt ${attempt}/${maxRetries}) error: ${err.message}`);
    }

    // B. Fallback to /get JSON endpoint if RAW failed
    try {
      const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(httpUrl)}`;
      const resp = await fetch(allOriginsUrl);
      if (resp.ok && typeof resp.json === 'function') {
        const json = await resp.json();
        if (json && json.contents) {
          if (json.contents.startsWith('data:')) {
            const commaIdx = json.contents.indexOf(',');
            if (commaIdx !== -1) {
              const base64Str = json.contents.substring(commaIdx + 1);
              const binary = atob(base64Str);
              const bytes = new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
              allOriginsContent = new TextDecoder('utf-8').decode(bytes);
            }
          } else {
            allOriginsContent = json.contents;
          }
          allOriginsSuccess = true;
          break;
        }
      } else if (resp.ok && typeof resp.text === 'function') {
        const text = await resp.text();
        if (text && text.includes('BEGIN:VCALENDAR')) {
          allOriginsContent = text;
          allOriginsSuccess = true;
          break;
        }
      }
      errors.push(`AllOrigins /get (Attempt ${attempt}/${maxRetries}) returned status ${resp.status}`);
    } catch (err: any) {
      errors.push(`AllOrigins /get (Attempt ${attempt}/${maxRetries}) error: ${err.message}`);
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (allOriginsSuccess) {
    return allOriginsContent;
  }

  // 2. Try codetabs proxy as a fallback
  try {
    const codetabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(httpUrl)}`;
    const resp = await fetch(codetabsUrl);
    if (resp.ok) {
      const text = await resp.text();
      if (text && text.includes('BEGIN:VCALENDAR')) {
        return text;
      }
    }
    errors.push(`Codetabs returned status ${resp.status}`);
  } catch (err: any) {
    errors.push(`Codetabs error: ${err.message}`);
  }

  // 3. Last resort: Direct fetch (might fail with CORS but always good as ultimate fallback)
  try {
    const resp = await fetch(httpUrl);
    if (resp.ok) {
      return await resp.text();
    }
    errors.push(`Direct fetch returned status ${resp.status}`);
  } catch (err: any) {
    errors.push(`Direct fetch error: ${err.message}`);
  }

  throw new Error(`Alle Verbindungsmethoden zum Kalender-Download sind fehlgeschlagen. Details: [${errors.join('; ')}]`);
}

export async function syncTeamCalendar(
  supabase: SupabaseClient,
  teamId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    teamId,
    teamName: '',
    status: 'success',
    message: '',
    added: 0,
    updated: 0,
    rescheduled: 0,
    deactivated: 0,
  };

  let syncRunId: string | null = null;

  try {
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('name, short_name, webcal_url')
      .eq('id', teamId)
      .single();

    if (teamErr || !team) {
      throw new Error(`Team not found or error fetching team: ${teamErr?.message}`);
    }

    result.teamName = team.name;

    // Log start of sync run in sync_runs table
    try {
      const insertQuery = supabase
        .from('sync_runs')
        .insert({
          status: 'pending',
          summary_text: `Synchronisierung für ${team.name} gestartet...`,
        });

      if (typeof insertQuery?.select === 'function') {
        const { data: runRecord } = await insertQuery.select('id').single();
        if (runRecord) {
          syncRunId = runRecord.id;
        }
      }
    } catch (runErr) {
      // Ignore if supabase client mock doesn't support .select() on .insert()
    }

    if (!team.webcal_url) {
      throw new Error('Webcal URL is missing for this team.');
    }

    const httpUrl = team.webcal_url.replace(/^webcal:\/\//i, 'https://');

    let icsText = '';
    try {
      icsText = await fetchIcsText(httpUrl);
    } catch (fetchErr: any) {
      throw new Error(`Failed to fetch Webcal URL (${httpUrl}): ${fetchErr.message}`);
    }

    let events: IcsEvent[] = [];
    try {
      events = parseIcs(icsText);
    } catch (parseErr: any) {
      throw new Error(`Failed to parse ICS calendar: ${parseErr.message}`);
    }

    const { data: existingMatches, error: matchesErr } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', teamId);

    if (matchesErr) {
      throw new Error(`Failed to fetch existing matches: ${matchesErr.message}`);
    }

    const existingMap = new Map<string, any>();
    if (existingMatches) {
      for (const m of existingMatches) {
        existingMap.set(m.external_uid, m);
      }
    }

    const processedUids = new Set<string>();

    for (const event of events) {
      processedUids.add(event.uid);
      const existing = existingMap.get(event.uid);

      const homeAwayInfo = determineHomeAway(event.summary, team.name, team.short_name);
      const matchday = extractMatchday(event.description, event.summary);

      if (!existing) {
        const { error: insertErr } = await supabase
          .from('matches')
          .insert({
            team_id: teamId,
            external_uid: event.uid,
            summary: event.summary,
            description: event.description,
            location: event.location,
            dtstart: event.dtstart.toISOString(),
            dtend: event.dtend.toISOString(),
            is_home: homeAwayInfo.isHome,
            matchday: matchday,
            active: true,
            version: 1,
            last_synced_at: new Date().toISOString(),
          });

        if (insertErr) {
          console.error(`Error inserting match ${event.uid}:`, insertErr);
        } else {
          result.added++;
        }
      } else {
        const oldStart = new Date(existing.dtstart).getTime();
        const newStart = event.dtstart.getTime();
        const oldEnd = new Date(existing.dtend).getTime();
        const newEnd = event.dtend.getTime();

        const dateTimeChanged = oldStart !== newStart || oldEnd !== newEnd;
        const otherDetailsChanged =
          existing.summary !== event.summary ||
          existing.description !== event.description ||
          existing.location !== event.location ||
          existing.matchday !== matchday ||
          existing.is_home !== homeAwayInfo.isHome ||
          !existing.active;

        if (dateTimeChanged) {
          const newVersion = existing.version + 1;

          const { error: updateErr } = await supabase
            .from('matches')
            .update({
              summary: event.summary,
              description: event.description,
              location: event.location,
              dtstart: event.dtstart.toISOString(),
              dtend: event.dtend.toISOString(),
              is_home: homeAwayInfo.isHome,
              matchday: matchday,
              active: true,
              version: newVersion,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateErr) {
            console.error(`Error updating rescheduled match ${existing.id}:`, updateErr);
          } else {
            result.rescheduled++;

            await supabase
              .from('match_changes')
              .insert({
                match_id: existing.id,
                old_dtstart: existing.dtstart,
                new_dtstart: event.dtstart.toISOString(),
                change_type: 'date_time_changed',
              });
          }
        } else if (otherDetailsChanged) {
          const { error: updateErr } = await supabase
            .from('matches')
            .update({
              summary: event.summary,
              description: event.description,
              location: event.location,
              is_home: homeAwayInfo.isHome,
              matchday: matchday,
              active: true,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateErr) {
            console.error(`Error updating details for match ${existing.id}:`, updateErr);
          } else {
            result.updated++;
          }
        } else {
          await supabase
            .from('matches')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
      }
    }

    const activeExistingMatches = Array.from(existingMap.values()).filter((m) => m.active);

    // Safety Check: If the parsed ICS contains 0 events but active matches exist in the database,
    // do NOT deactivate all matches! This prevents accidental mass cancellation due to empty/malformed ICS responses.
    if (events.length === 0 && activeExistingMatches.length > 0) {
      result.status = 'failed';
      result.message = `Sicherheitssperre: Der Kalender lieferte 0 Termine, obwohl ${activeExistingMatches.length} aktive Spiele in der Datenbank existieren. Aus Sicherheitsgründen wurden keine Spiele inaktiviert.`;
    } else {
      for (const [uid, existing] of existingMap.entries()) {
        if (!processedUids.has(uid) && existing.active) {
          const { error: deacErr } = await supabase
            .from('matches')
            .update({
              active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (deacErr) {
            console.error(`Error deactivating match ${existing.id}:`, deacErr);
          } else {
            result.deactivated++;

            await supabase
              .from('match_changes')
              .insert({
                match_id: existing.id,
                change_type: 'cancelled',
              });
          }
        }
      }

      result.message = `Erfolgreich synchronisiert (${team.name}). ${result.added} neue Spiele, ${result.rescheduled} verschoben, ${result.updated} Details geändert, ${result.deactivated} inaktiv gesetzt.`;
    }
  } catch (err: any) {
    result.status = 'failed';
    result.message = err.message || 'Unknown sync error';
  }

  // Update sync_runs table with completion status
  if (syncRunId) {
    try {
      await supabase
        .from('sync_runs')
        .update({
          status: result.status,
          completed_at: new Date().toISOString(),
          summary_text: result.message,
        })
        .eq('id', syncRunId);
    } catch (updateRunErr) {
      console.warn('Failed to update sync_runs record:', updateRunErr);
    }
  }

  return result;
}
