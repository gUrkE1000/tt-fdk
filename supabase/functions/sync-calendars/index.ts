import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Pure ICS Parsing functions for absolute self-containment in Deno
export interface IcsEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary: string;
  description: string;
  location: string;
}

function unfoldLines(icsString: string): string {
  return icsString.replace(/\r?\n[ \t]/g, '');
}

// TODO - add documentation
function parseLocalDateToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date {
  const utcDate = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const partVal = (type: string) => {
    const found = parts.find(p => p.type === type);
    return found ? parseInt(found.value, 10) : 0;
  };

  const formattedYear = partVal('year');
  const formattedMonth = partVal('month') - 1;
  const formattedDay = partVal('day');
  const formattedHour = partVal('hour');
  const formattedMinute = partVal('minute');
  const formattedSecond = partVal('second');

  const diffMs =
    Date.UTC(formattedYear, formattedMonth, formattedDay, formattedHour, formattedMinute, formattedSecond) -
    Date.UTC(year, monthIndex, day, hour, minute, second);

  return new Date(utcDate.getTime() - diffMs);
}

function parseIcsDate(value: string): Date {
  const cleanValue = value.replace(/[-:]/g, '');

  if (/^\d{8}$/.test(cleanValue)) {
    const year = parseInt(cleanValue.substring(0, 4), 10);
    const month = parseInt(cleanValue.substring(4, 6), 10) - 1;
    const day = parseInt(cleanValue.substring(6, 8), 10);
    return parseLocalDateToUtc(year, month, day, 0, 0, 0);
  }

  const dtMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(cleanValue);
  if (!dtMatch) {
    return new Date();
  }

  const year = parseInt(dtMatch[1], 10);
  const month = parseInt(dtMatch[2], 10) - 1;
  const day = parseInt(dtMatch[3], 10);
  const hour = parseInt(dtMatch[4], 10);
  const minute = parseInt(dtMatch[5], 10);
  const second = parseInt(dtMatch[6], 10);
  const isUtc = dtMatch[7] === 'Z';

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return parseLocalDateToUtc(year, month, day, hour, minute, second);
}

function parseIcs(icsContent: string): IcsEvent[] {
  const unfolded = unfoldLines(icsContent);
  const events: IcsEvent[] = [];

  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];
    const lines = block.split(/\r?\n/);
    const rawLines: { key: string; val: string }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const rawKeyPart = line.substring(0, colonIdx);
      const val = line.substring(colonIdx + 1).trim();

      let key = rawKeyPart;
      const semiIdx = rawKeyPart.indexOf(';');
      if (semiIdx !== -1) {
        key = rawKeyPart.substring(0, semiIdx);
      }

      rawLines.push({ key: key.toUpperCase(), val });
    }

    const uid = rawLines.find(r => r.key === 'UID')?.val || '';
    const summary = rawLines.find(r => r.key === 'SUMMARY')?.val || '';
    const description = rawLines.find(r => r.key === 'DESCRIPTION')?.val || '';
    const location = rawLines.find(r => r.key === 'LOCATION')?.val || '';

    const dtstartRaw = rawLines.find(r => r.key === 'DTSTART');
    const dtendRaw = rawLines.find(r => r.key === 'DTEND');

    if (!uid || !dtstartRaw) {
      continue;
    }

    const dtstart = parseIcsDate(dtstartRaw.val);
    const dtend = dtendRaw ? parseIcsDate(dtendRaw.val) : new Date(dtstart.getTime() + 2 * 60 * 60 * 1000);

    events.push({
      uid,
      dtstart,
      dtend,
      summary,
      description,
      location: location.replace(/\\,/g, ','),
    });
  }

  return events;
}

function determineHomeAway(summary: string, teamName: string, teamShortName: string) {
  const normalizedSummary = summary.replace(/\s+vs\.?\s+/gi, ' vs ');
  const vsParts = normalizedSummary.split(' vs ');

  if (vsParts.length === 2) {
    const homeCandidate = vsParts[0].trim();
    const awayCandidate = vsParts[1].trim();

    const isHomeMatched =
      homeCandidate.toLowerCase().includes(teamName.toLowerCase()) ||
      homeCandidate.toLowerCase().includes(teamShortName.toLowerCase()) ||
      teamName.toLowerCase().includes(homeCandidate.toLowerCase()) ||
      teamShortName.toLowerCase().includes(homeCandidate.toLowerCase());

    const isAwayMatched =
      awayCandidate.toLowerCase().includes(teamName.toLowerCase()) ||
      awayCandidate.toLowerCase().includes(teamShortName.toLowerCase()) ||
      teamName.toLowerCase().includes(awayCandidate.toLowerCase()) ||
      teamShortName.toLowerCase().includes(awayCandidate.toLowerCase());

    if (isHomeMatched && !isAwayMatched) {
      return { isHome: true, opponent: awayCandidate };
    } else if (isAwayMatched && !isHomeMatched) {
      return { isHome: false, opponent: homeCandidate };
    } else {
      return { isHome: true, opponent: awayCandidate };
    }
  }

  return { isHome: true, opponent: summary };
}

function extractMatchday(description: string, summary: string): number | null {
  const match = /Spieltag:?\s*(\d+)/i.exec(description) || /Spieltag:?\s*(\d+)/i.exec(summary);
  return match ? parseInt(match[1], 10) : null;
}

// Main Edge Function Handler
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const syncSecret = Deno.env.get('SYNC_SECRET') || '';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate Request
  const requestSecret = req.headers.get('x-sync-secret') || new URL(req.url).searchParams.get('secret');
  let isAuthorized = false;

  if (syncSecret && requestSecret === syncSecret) {
    isAuthorized = true;
  } else {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const userSupabase = createClient(supabaseUrl, token);
      const { data: { user }, error: userErr } = await userSupabase.auth.getUser();

      if (user && !userErr) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile && profile.role === 'club_admin') {
          isAuthorized = true;
        }
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Record Sync Run Started
  const { data: syncRun, error: runError } = await supabase
    .from('sync_runs')
    .insert({
      status: 'pending',
      summary_text: 'Synchronisation gestartet...',
    })
    .select()
    .single();

  if (runError || !syncRun) {
    return new Response(JSON.stringify({ error: 'Could not log sync run: ' + runError?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const syncDetails: any[] = [];
  let totalAdded = 0;
  let totalRescheduled = 0;
  let totalDeactivated = 0;
  let finalStatus = 'success';

  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('active', true);

    if (teamsError || !teams) {
      throw new Error('Failed to fetch teams: ' + teamsError?.message);
    }

    for (const team of teams) {
      const teamDetail = {
        teamId: team.id,
        teamName: team.name,
        status: 'success',
        added: 0,
        rescheduled: 0,
        updated: 0,
        deactivated: 0,
        error: '',
      };

      try {
        if (!team.webcal_url) {
          throw new Error('Webcal URL fehlt.');
        }

        const httpUrl = team.webcal_url.replace(/^webcal:\/\//i, 'https://');
        const resp = await fetch(httpUrl);
        if (!resp.ok) {
          throw new Error(`Webcal-Download fehlgeschlagen: HTTP ${resp.status}`);
        }

        const icsText = await resp.text();
        const events = parseIcs(icsText);

        const { data: existingMatches, error: matchesErr } = await supabase
          .from('matches')
          .select('*')
          .eq('team_id', team.id);

        if (matchesErr) {
          throw new Error(`Datenbankfehler beim Laden der Spiele: ${matchesErr.message}`);
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
                team_id: team.id,
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
              console.error(`Insert error match ${event.uid}:`, insertErr);
            } else {
              teamDetail.added++;
              totalAdded++;
            }
          } else {
            const oldStart = new Date(existing.dtstart).getTime();
            const newStart = event.dtstart.getTime();
            const oldEnd = new Date(existing.dtend).getTime();
            const newEnd = event.dtend.getTime();

            const dateTimeChanged = oldStart !== newStart || oldEnd !== newEnd;
            const detailsChanged =
              existing.summary !== event.summary ||
              existing.description !== event.description ||
              existing.location !== event.location ||
              existing.matchday !== matchday ||
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
                console.error(`Update error rescheduled match ${existing.id}:`, updateErr);
              } else {
                teamDetail.rescheduled++;
                totalRescheduled++;

                await supabase
                  .from('match_changes')
                  .insert({
                    match_id: existing.id,
                    old_dtstart: existing.dtstart,
                    new_dtstart: event.dtstart.toISOString(),
                    change_type: 'date_time_changed',
                  });
              }
            } else if (detailsChanged) {
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
                console.error(`Update error details match ${existing.id}:`, updateErr);
              } else {
                teamDetail.updated++;
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

        // Safety check: Do not deactivate matches if 0 events were parsed when active matches existed
        if (events.length === 0 && activeExistingMatches.length > 0) {
          teamDetail.status = 'warning';
          teamDetail.error = `Sicherheitssperre: 0 Termine im ICS gefunden, obwohl ${activeExistingMatches.length} aktive Spiele existieren. Inaktivierung blockiert.`;
          finalStatus = 'warning';
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
                console.error(`Deactivate error match ${existing.id}:`, deacErr);
              } else {
                teamDetail.deactivated++;
                totalDeactivated++;

                await supabase
                  .from('match_changes')
                  .insert({
                    match_id: existing.id,
                    change_type: 'cancelled',
                  });
              }
            }
          }
        }

      } catch (teamErr: any) {
        teamDetail.status = 'failed';
        teamDetail.error = teamErr.message || 'Unbekannter Fehler';
        finalStatus = 'warning';
      }

      syncDetails.push(teamDetail);
    }

    const summaryText = `Synchronisation beendet. Status: ${finalStatus}. Gesamt neue Spiele: ${totalAdded}, verschobene Spiele: ${totalRescheduled}, inaktivierte Spiele: ${totalDeactivated}.`;

    await supabase
      .from('sync_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: finalStatus,
        summary_text: summaryText + ' Details: ' + JSON.stringify(syncDetails),
      })
      .eq('id', syncRun.id);

    return new Response(JSON.stringify({
      status: finalStatus,
      message: summaryText,
      details: syncDetails,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (globalErr: any) {
    await supabase
      .from('sync_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        summary_text: 'Kritischer Synchronisationsfehler: ' + globalErr.message,
      })
      .eq('id', syncRun.id);

    return new Response(JSON.stringify({
      error: globalErr.message || 'Kritischer Synchronisationsfehler',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
