import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncTeamCalendar } from '../lib/syncEngine';
import { getShortName } from '../lib/nameUtils';
import { Check, X, HelpCircle, MessageSquare, AlertTriangle, Bell } from 'lucide-react';
import { formatShortDayDate, getOpponentName } from '../lib/whatsappUtils';

interface TeamTabViewProps {
  teamId: string;
  userId: string;
  userRole: string;
  isClubAdmin: boolean;
  previousLoginAt?: string | null;
}

export default function TeamTabView({ teamId, userId, userRole, isClubAdmin, previousLoginAt }: TeamTabViewProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [cancelledMatches, setCancelledMatches] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [matchChanges, setMatchChanges] = useState<Record<string, any[]>>({});
  const [allAvailabilities, setAllAvailabilities] = useState<any[]>([]);
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [showRecentChanges, setShowRecentChanges] = useState(true);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [teamName, setTeamName] = useState('');
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [activeTeams, setActiveTeams] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [userAllYesAvailabilities, setUserAllYesAvailabilities] = useState<any[]>([]);

  const isElevatedRole = userRole === 'team_manager' || userRole === 'sportwart' || userRole === 'club_admin' || isClubAdmin;

  const handleRefresh = async () => {
    // If the user has an elevated role (team_manager, sportwart, club_admin),
    // we also sync their calendar with myTischtennis.de online Webcal.
    // Standard players only reload from the local Supabase database.
    if (isElevatedRole) {
      setSyncing(true);
      setSyncFeedback('Online-Kalender wird auf Änderungen geprüft...');
      try {
        const res = await syncTeamCalendar(supabase, teamId);
        if (res.status === 'success') {
          setSyncFeedback(
            `Erfolgreich synchronisiert! Neue Spiele: ${res.added}, Verlegt: ${res.rescheduled}, Details geändert: ${res.updated}, Inaktiviert: ${res.deactivated}.`
          );
        } else {
          setSyncFeedback(`Synchronisierung fehlgeschlagen: ${res.message}`);
        }
      } catch (err: any) {
        console.error('Error syncing team calendar:', err);
        setSyncFeedback(`Fehler bei der Synchronisierung: ${err.message}`);
      } finally {
        setSyncing(false);
        // Clear feedback after 8 seconds
        setTimeout(() => {
          setSyncFeedback(null);
        }, 8000);
      }
    } else {
      setSyncFeedback('Daten aus Datenbank neu geladen.');
      setTimeout(() => {
        setSyncFeedback(null);
      }, 4000);
    }

    await loadData();
  };

  const resolveRsvpConflicts = async (playerId: string) => {
    try {
      // 1. Fetch player profile to get their home team_number
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', playerId)
        .single();

      if (!profile) return;

      // 2. Fetch all active teams sorted by name to find their home team ID
      const { data: activeTeamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('active', true)
        .order('name');
      const sortedTeams = activeTeamsData || [];

      const homeTeamId = profile.team_number && sortedTeams[profile.team_number - 1]
        ? sortedTeams[profile.team_number - 1].id
        : null;

      // 3. Fetch all yes availabilities for this player
      const { data: avails, error: availsErr } = await supabase
        .from('availabilities')
        .select('*, matches(*)')
        .eq('player_id', playerId)
        .eq('response', 'yes');

      if (availsErr || !avails) return;

      // Filter to active matches only
      const yesAvails = avails.filter(av => av.matches && av.matches.active);

      if (yesAvails.length <= 1) return;

      // 4. Group conflicts. Two matches conflict if they start within +- 1 hour (3600000ms)
      const conflictsToResolve: Record<string, any[]> = {};
      const processedMatchIds = new Set<string>();

      for (let i = 0; i < yesAvails.length; i++) {
        const av1 = yesAvails[i];
        if (processedMatchIds.has(av1.match_id)) continue;

        const group = [av1];
        const t1 = new Date(av1.matches.dtstart).getTime();

        for (let j = i + 1; j < yesAvails.length; j++) {
          const av2 = yesAvails[j];
          const t2 = new Date(av2.matches.dtstart).getTime();

          if (Math.abs(t1 - t2) <= 3600000) {
            group.push(av2);
            processedMatchIds.add(av2.match_id);
          }
        }

        if (group.length > 1) {
          conflictsToResolve[av1.match_id] = group;
          processedMatchIds.add(av1.match_id);
        }
      }

      // 5. For each conflict group, determine which one to keep 'yes' and set others to 'no'
      let conflictsResolved = false;
      for (const matchId of Object.keys(conflictsToResolve)) {
        const group = conflictsToResolve[matchId];

        // Sort group by priority:
        // A. If the match team matches their home team ID, that has highest priority
        // B. Tie breaker: the one with the most recent updated_at timestamp
        const sortedGroup = [...group].sort((a, b) => {
          const aIsHomeTeam = a.matches.team_id === homeTeamId ? 1 : 0;
          const bIsHomeTeam = b.matches.team_id === homeTeamId ? 1 : 0;

          if (aIsHomeTeam !== bIsHomeTeam) {
            return bIsHomeTeam - aIsHomeTeam; // 1 (home team) comes first
          }

          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime; // more recently updated comes first
        });

        const others = sortedGroup.slice(1);

        for (const av of others) {
          const { error: updErr } = await supabase
            .from('availabilities')
            .update({
              response: 'no',
              updated_at: new Date().toISOString(),
            })
            .eq('id', av.id);
          if (!updErr) {
            conflictsResolved = true;
          }
        }
      }

      if (conflictsResolved) {
        await loadData();
      }
    } catch (err) {
      console.error('Error resolving RSVP conflicts:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single();
      if (team) setTeamName(team.name);

      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('team_id', teamId)
        .eq('active', true)
        .order('dtstart', { ascending: true });

      const fetchedMatches = matchesData || [];
      setMatches(fetchedMatches);

      const { data: inactiveMatchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('team_id', teamId)
        .eq('active', false)
        .order('dtstart', { ascending: true });

      setCancelledMatches(inactiveMatchesData || []);

      const { data: activeTeamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('active', true)
        .order('name');
      setActiveTeams(activeTeamsData || []);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      setAllProfiles(profilesData || []);

      if (fetchedMatches.length > 0) {
        const matchIds = fetchedMatches.map((m) => m.id);

        const { data: userAv } = await supabase
          .from('availabilities')
          .select('*')
          .eq('player_id', userId)
          .in('match_id', matchIds);

        const availMap: Record<string, any> = {};
        const commentMap: Record<string, string> = {};
        if (userAv) {
          userAv.forEach((av) => {
            availMap[av.match_id] = av;
            commentMap[av.match_id] = av.comment || '';
          });
        }
        setAvailabilities(availMap);
        setComments(commentMap);

        const { data: allAvail } = await supabase
          .from('availabilities')
          .select('*, profiles(name)')
          .in('match_id', matchIds);
        setAllAvailabilities(allAvail || []);

        // Fetch recent changes since last login for team manager
        if (previousLoginAt) {
          const { data: recentAvs } = await supabase
            .from('availabilities')
            .select('*, profiles(name), matches(summary, is_home, dtstart)')
            .in('match_id', matchIds)
            .gt('updated_at', previousLoginAt)
            .neq('player_id', userId)
            .order('updated_at', { ascending: false });

          setRecentChanges(recentAvs || []);
        }

        const { data: changes } = await supabase
          .from('match_changes')
          .select('*')
          .in('match_id', matchIds)
          .eq('change_type', 'date_time_changed')
          .order('created_at', { ascending: false });

        const changesMap: Record<string, any[]> = {};
        if (changes) {
          changes.forEach((ch) => {
            if (!changesMap[ch.match_id]) changesMap[ch.match_id] = [];
            changesMap[ch.match_id].push(ch);
          });
        }
        setMatchChanges(changesMap);
      }

      if (userId) {
        const { data: userYesAvails } = await supabase
          .from('availabilities')
          .select('*, matches(*, teams(name))')
          .eq('player_id', userId)
          .eq('response', 'yes');

        if (userYesAvails) {
          const activeYes = userYesAvails.filter(
            (av) => av.matches && av.matches.active && av.version_responded === av.matches.version
          );
          setUserAllYesAvailabilities(activeYes);
        }
      }
    } catch (err) {
      console.error('Error loading team tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      resolveRsvpConflicts(userId);
    }
    // Initial load only queries local DB to be fast
    loadData();
  }, [teamId, userId]);

  const handleVote = async (matchId: string, matchVersion: number, responseType: 'yes' | 'no' | 'maybe') => {
    const existing = availabilities[matchId];
    const commentText = comments[matchId] || '';

    try {
      if (existing) {
        const { data, error } = await supabase
          .from('availabilities')
          .update({
            response: responseType,
            comment: commentText,
            version_responded: matchVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        setAvailabilities((prev) => ({ ...prev, [matchId]: data }));
      } else {
        const { data, error } = await supabase
          .from('availabilities')
          .insert({
            match_id: matchId,
            player_id: userId,
            response: responseType,
            comment: commentText,
            version_responded: matchVersion,
          })
          .select()
          .single();

        if (error) throw error;
        setAvailabilities((prev) => ({ ...prev, [matchId]: data }));
      }

      const { data: allAvail } = await supabase
        .from('availabilities')
        .select('*, profiles(name)')
        .in('match_id', matches.map((m) => m.id));
      setAllAvailabilities(allAvail || []);

      if (responseType === 'yes') {
        await resolveRsvpConflicts(userId);
      }

      if (userId) {
        const { data: userYesAvails } = await supabase
          .from('availabilities')
          .select('*, matches(*, teams(name))')
          .eq('player_id', userId)
          .eq('response', 'yes');

        if (userYesAvails) {
          const activeYes = userYesAvails.filter(
            (av) => av.matches && av.matches.active && av.version_responded === av.matches.version
          );
          setUserAllYesAvailabilities(activeYes);
        }
      }
    } catch (err: any) {
      alert('Fehler beim Abgeben der Stimme: ' + err.message);
    }
  };

  const handleSaveComment = async (matchId: string, matchVersion: number) => {
    const existing = availabilities[matchId];
    const commentText = comments[matchId] || '';

    try {
      if (existing) {
        const { error } = await supabase
          .from('availabilities')
          .update({
            comment: commentText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
        alert('Bemerkung erfolgreich gespeichert!');
      } else {
        const { data, error } = await supabase
          .from('availabilities')
          .insert({
            match_id: matchId,
            player_id: userId,
            response: 'maybe',
            comment: commentText,
            version_responded: matchVersion,
          })
          .select()
          .single();

        if (error) throw error;
        setAvailabilities((prev) => ({ ...prev, [matchId]: data }));
        alert('Bemerkung gespeichert (Verfügbarkeit auf "Vielleicht" gesetzt).');
      }

      const { data: allAvail } = await supabase
        .from('availabilities')
        .select('*, profiles(name)')
        .in('match_id', matches.map((m) => m.id));
      setAllAvailabilities(allAvail || []);
    } catch (err: any) {
      alert('Fehler beim Speichern der Bemerkung: ' + err.message);
    }
  };

  const getLineupForMatch = (match: any, matchAvails: any[]) => {
    // 1. Establish the current team's team_number from activeTeams sorted by name
    const sortedTeams = [...activeTeams].sort((a, b) => a.name.localeCompare(b.name));
    const teamIndex = sortedTeams.findIndex((t) => t.id === teamId) + 1; // 1-based index

    // All profiles with sorting helper:
    // Sorted by team_number (nulls last), then position_number (nulls last), then name
    const getSortValue = (p: any) => {
      const teamNum = p.team_number ?? 999999;
      const posNum = p.position_number ?? 999999;
      return { teamNum, posNum, name: p.name || '' };
    };

    const sortedProfiles = [...allProfiles].sort((a, b) => {
      const sA = getSortValue(a);
      const sB = getSortValue(b);
      if (sA.teamNum !== sB.teamNum) return sA.teamNum - sB.teamNum;
      if (sA.posNum !== sB.posNum) return sA.posNum - sB.posNum;
      return sA.name.localeCompare(sB.name);
    });

    // Stammspieler are the players officially listed for this team (team_number = teamIndex, positions 1 to 4 if possible)
    // Wait, requirement: "die ersten vier Stamm-Spieler (also bei Mannschaft 1: die Spieler 1.1 bis 1.4)"
    // Let's gather Stammspieler. They are profiles with team_number === teamIndex and position_number in [1, 2, 3, 4]
    const stammspieler = sortedProfiles.filter((p) => p.team_number === teamIndex && p.position_number >= 1 && p.position_number <= 4);

    // Candidates pool:
    // 1. All profiles belonging to the current team: p.team_number === teamIndex
    // 2. Any other profile who has explicitly RSVP'd to this match
    const candidates = sortedProfiles.filter((p) => {
      if (p.team_number === teamIndex) {
        return true;
      }
      const av = matchAvails.find((a) => a.player_id === p.id);
      return av && av.version_responded === match.version;
    });

    // RSVP priority order:
    // 1. yes (Ja)
    // 2. yes_sub (Ja als Ersatz)
    // 3. no response / null / undefined / older version (Keine Antwort)
    // 4. maybe (Vielleicht)
    // 5. no (Nein)
    const getRsvppriority = (p: any) => {
      const av = matchAvails.find((a) => a.player_id === p.id);
      const response = av && av.version_responded === match.version ? av.response : null;
      if (response === 'yes') return 1;
      if (response === 'yes_sub') return 2;
      if (!response) return 3;
      if (response === 'maybe') return 4;
      if (response === 'no') return 5;
      return 3;
    };

    // Sort candidates by RSVP priority first, then by global club ranking:
    const orderedCandidates = [...candidates].sort((a, b) => {
      const prioA = getRsvppriority(a);
      const prioB = getRsvppriority(b);

      if (prioA !== prioB) {
        return prioA - prioB;
      }

      const sA = getSortValue(a);
      const sB = getSortValue(b);
      if (sA.teamNum !== sB.teamNum) return sA.teamNum - sB.teamNum;
      if (sA.posNum !== sB.posNum) return sA.posNum - sB.posNum;
      return sA.name.localeCompare(sB.name);
    });

    // Limit lineup to the top 5 candidates:
    const activeLineup = orderedCandidates.slice(0, 5);

    return { activeLineup, stammspieler };
  };

  const formatGermanDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' Uhr';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🏓 {teamName || 'Mannschaft'}
          </h2>
          <p className="text-sm text-gray-500">
            {matches.length} anstehende Spiele im Kalender
          </p>
          {syncFeedback && (
            <p className="text-xs text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-150 inline-block animate-fade-in mt-1">
              {syncFeedback}
            </p>
          )}
        </div>
        {isElevatedRole && (
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="text-sm px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold rounded-xl transition-colors self-start disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-teal-700"></div>
                <span>Synchronisiere...</span>
              </>
            ) : (
              <span>🔄 Aktualisieren</span>
            )}
          </button>
        )}
      </div>

      {userRole === 'team_manager' && showRecentChanges && recentChanges.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs sm:text-sm text-blue-900 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 font-bold text-blue-900">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600 shrink-0" />
              <span>🔔 Rückmeldungs-Änderungen seit deinem letzten Login ({recentChanges.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRecentChanges(false)}
              className="text-xs px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg font-semibold transition-colors shrink-0"
            >
              Gelesen / Ausblenden
            </button>
          </div>
          <ul className="space-y-1.5 pt-1">
            {recentChanges.map((ch) => {
              const playerName = ch.profiles?.name || 'Ein Spieler';
              const matchType = ch.matches?.is_home ? 'Heimspiel' : 'Auswärtsspiel';
              const opponent = getOpponentName(ch.matches);
              const matchDate = formatShortDayDate(ch.matches?.dtstart);
              const actionText =
                ch.response === 'yes'
                  ? 'zugesagt'
                  : ch.response === 'yes_sub'
                  ? 'als Ersatz zugesagt'
                  : ch.response === 'no'
                  ? 'abgesagt'
                  : 'mit "vielleicht" geantwortet';

              return (
                <li key={ch.id} className="bg-white/80 p-2.5 rounded-xl border border-blue-100 flex items-center gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    Spieler <strong>{playerName}</strong> hat für das <strong>{matchType} gegen {opponent}</strong> am {matchDate} <strong>{actionText}</strong>.
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {cancelledMatches.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>🚫 Abgesagte / Inaktive Spiele ({cancelledMatches.length})</span>
          </div>
          <p className="text-rose-700">
            Die folgenden Spiele wurden im Kalender als abgesagt oder inaktiv markiert:
          </p>
          <div className="space-y-1.5 pt-1">
            {cancelledMatches.map((m) => (
              <div key={m.id} className="bg-white/80 p-2.5 rounded-xl border border-rose-100 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span className="font-semibold text-gray-800">
                  {m.summary} ({formatGermanDate(m.dtstart)})
                </span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full shrink-0 self-start sm:self-auto">
                  🚫 Abgesagt / Inaktiv
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {matches.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
            <span className="text-4xl">📅</span>
            <p className="text-gray-500 mt-2">Keine anstehenden Termine für diese Mannschaft gefunden.</p>
          </div>
        ) : (
          matches.map((match) => {
            const userAv = availabilities[match.id];
            const hasOutdatedResponse = userAv && userAv.version_responded < match.version;

            const changes = matchChanges[match.id] || [];
            const oldDateText = changes.length > 0 && changes[0].old_dtstart
              ? formatGermanDate(changes[0].old_dtstart)
              : null;

            const matchAvails = allAvailabilities.filter((av) => av.match_id === match.id);
            const countJa = matchAvails.filter((av) => (av.response === 'yes' || av.response === 'yes_sub') && av.version_responded === match.version).length;
            const countNein = matchAvails.filter((av) => av.response === 'no' && av.version_responded === match.version).length;
            const countVielleicht = matchAvails.filter((av) => av.response === 'maybe' && av.version_responded === match.version).length;

            const opponent = match.is_home
              ? (match.summary.split(' vs ')[1] || match.summary).trim()
              : (match.summary.split(' vs ')[0] || match.summary).trim();

            const { activeLineup, stammspieler } = getLineupForMatch(match, matchAvails);

            // Determine authorization for reordering or editing response:
            // "für die nachrückenden Spieler kann nur der Mannschaftsführer der Mannschaft in denen diese Spieler Stammspieler sind, deren Verfügbarkeit verändern."
            // Also, club_admin and sportwart and team_manager of current team can edit Stammspieler's availability.
            // Let's first identify what "team_manager" the user is.
            const userIsAdminOrSportwart = userRole === 'club_admin' || userRole === 'sportwart';

            // Check if current user is the team manager of this team
            // Let's find current user's profile
            const currentUserProfile = allProfiles.find((p) => p.id === userId);
            const userTeamNumber = currentUserProfile?.team_number;
            const sortedTeams = [...activeTeams].sort((a, b) => a.name.localeCompare(b.name));
            const currentTeamIndex = sortedTeams.findIndex((t) => t.id === teamId) + 1;

            const isCurrentTeamManager = userRole === 'team_manager' && userTeamNumber === currentTeamIndex;

            const handleUpdatePlayerResponse = async (playerId: string, responseType: 'yes' | 'yes_sub' | 'no' | 'maybe' | '') => {
              const existingAv = matchAvails.find((a) => a.player_id === playerId);
              try {
                if (responseType) {
                  if (existingAv) {
                    const { error } = await supabase
                      .from('availabilities')
                      .update({
                        response: responseType,
                        version_responded: match.version,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', existingAv.id);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase
                      .from('availabilities')
                      .insert({
                        match_id: match.id,
                        player_id: playerId,
                        response: responseType,
                        version_responded: match.version,
                      });
                    if (error) throw error;
                  }
                } else {
                  if (existingAv) {
                    const { error } = await supabase
                      .from('availabilities')
                      .delete()
                      .eq('id', existingAv.id);
                    if (error) throw error;
                  }
                }

                // Refresh data
                const { data: allAvail } = await supabase
                  .from('availabilities')
                  .select('*, profiles(name)')
                  .in('match_id', matches.map((m) => m.id));
                setAllAvailabilities(allAvail || []);

                if (responseType === 'yes') {
                  await resolveRsvpConflicts(playerId);
                }
              } catch (err: any) {
                alert('Fehler beim Aktualisieren der Verfügbarkeit: ' + err.message);
              }
            };

            return (
              <div
                key={match.id}
                className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm transition-all duration-200 ${
                  hasOutdatedResponse
                    ? 'border-amber-400 bg-amber-50/10 ring-2 ring-amber-300 ring-opacity-50'
                    : 'border-gray-100 hover:shadow-md'
                }`}
              >
                {hasOutdatedResponse && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 text-amber-800 text-sm flex gap-2 items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">⚠️ Termin geändert!</p>
                      <p>
                        Dieses Spiel wurde auf einen neuen Termin verschoben.{' '}
                        {oldDateText && (
                          <span>
                            (Zuvor: <strong className="line-through text-gray-500">{oldDateText}</strong>).
                          </span>
                        )}{' '}
                        Bitte bestätige deine Verfügbarkeit für den neuen Termin erneut. Deine alte Stimme war:
                        <span className="font-semibold ml-1">
                          {userAv.response === 'yes' ? '✅ Ja' : userAv.response === 'no' ? '❌ Nein' : '🤔 Vielleicht'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                  {/* Desktop/Tablet: 2-column layout. Left: match information, Location & RSVP. Right: RSVP counters & Lineup list. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
                    {/* Left Column: Match details, Location, Description & RSVP Vote */}
                    <div className="space-y-4">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-full mb-2">
                          Spieltag {match.matchday || '-'}
                        </span>
                        <h3 className={`text-base sm:text-lg font-bold ${countJa < 4 ? 'text-red-600' : 'text-gray-800'}`}>
                          {match.is_home ? '🏠 Heimspiel' : '🚌 Auswärtsspiel'} gegen {opponent}
                        </h3>
                        <p className="text-sm font-semibold text-teal-700 mt-1">
                          📅 {formatGermanDate(match.dtstart)}
                        </p>
                      </div>

                      <div className="space-y-1.5 text-xs sm:text-sm text-gray-600">
                        {match.location && (
                          <p>
                            <span className="font-medium text-gray-700">📍 Ort:</span> {match.location}
                          </p>
                        )}
                        {match.description && (
                          <p className="italic text-gray-500">
                            {match.description.replace(/\\n/g, '\n')}
                          </p>
                        )}
                      </div>

                      {/* Vote/Response section integrated into Left Column */}
                      <div className="space-y-4 pt-4 border-t border-gray-100 border-dashed">
                        {(() => {
                          const matchTime = new Date(match.dtstart).getTime();
                          const conflictingAv = userAllYesAvailabilities.find((av) => {
                            if (!av.matches || !av.matches.active) return false;
                            if (av.match_id === match.id) return false;
                            if (av.version_responded !== av.matches.version) return false;
                            const otherTime = new Date(av.matches.dtstart).getTime();
                            return Math.abs(otherTime - matchTime) <= 3600000;
                          });

                          const conflictingTeamName = conflictingAv
                            ? (conflictingAv.matches.teams?.name ||
                               activeTeams.find((t) => t.id === conflictingAv.matches.team_id)?.name)
                            : null;

                          return (
                            <p className="text-xs sm:text-sm font-semibold text-gray-700">
                              Kannst du bei diesem Spiel mitspielen
                              {conflictingTeamName
                                ? ` (du hast bereits bei Mannschaft ${conflictingTeamName} zugesagt)`
                                : ''}?
                            </p>
                          );
                        })()}
                        <div className="grid grid-cols-3 gap-2.5 max-w-md">
                          <button
                            type="button"
                            onClick={() => handleVote(match.id, match.version, 'yes')}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-4 rounded-xl font-bold transition-all border text-xs sm:text-sm ${
                              userAv && userAv.response === 'yes' && !hasOutdatedResponse
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105'
                                : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <Check className="h-5 w-5 shrink-0" />
                            <span>Ja</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVote(match.id, match.version, 'maybe')}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-4 rounded-xl font-bold transition-all border text-xs sm:text-sm ${
                              userAv && userAv.response === 'maybe' && !hasOutdatedResponse
                                ? 'bg-amber-500 text-white border-amber-500 shadow-md transform scale-105'
                                : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <HelpCircle className="h-5 w-5 shrink-0" />
                            <span>Vielleicht</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVote(match.id, match.version, 'no')}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-4 rounded-xl font-bold transition-all border text-xs sm:text-sm ${
                              userAv && userAv.response === 'no' && !hasOutdatedResponse
                                ? 'bg-rose-600 text-white border-rose-600 shadow-md transform scale-105'
                                : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            <X className="h-5 w-5 shrink-0" />
                            <span>Nein</span>
                          </button>
                        </div>

                        <div className="max-w-md pt-1">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <MessageSquare className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Bemerkung (z.B. erst ab 19 Uhr)"
                                value={comments[match.id] || ''}
                                onChange={(e) => setComments((prev) => ({ ...prev, [match.id]: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveComment(match.id, match.version)}
                              className="px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
                            >
                              Speichern
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: RSVP Summary & Live Lineup */}
                    <div className="flex flex-col gap-3 shrink-0">
                    <div className="flex items-center justify-between md:justify-end gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 text-xs sm:text-sm w-full md:w-auto">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          ✅ {countJa}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-amber-600">
                          🤔 {countVielleicht}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-rose-600">
                          ❌ {countNein}
                        </span>
                      </div>
                      {countJa < 4 && (
                        <span title="Weniger als 4 Zusagen!">
                          <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                        </span>
                      )}
                    </div>

                    {/* Active 4 Lineup players list right under sum/status icons */}
                      <div className="w-full bg-slate-50 rounded-xl p-3 border border-slate-150 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
                        <span className="font-extrabold text-slate-700">👥 Aufstellung (Stamm 1-4 / Ersatz)</span>
                      </div>
                      {activeLineup.length === 0 ? (
                        <p className="text-slate-400 italic">Keine Spieler aufgestellt.</p>
                      ) : (
                        activeLineup.map((p, idx) => {
                          const av = matchAvails.find((a) => a.player_id === p.id);
                          const response = av && av.version_responded === match.version ? av.response : null;

                          // Auth rules:
                          // "Der Mannschaftsführer und die Admins müssen in der Lage sein, die Antworten dieser 4 Spieler zu ändern."
                          // "für die nachrückenden Spieler kann nur der Mannschaftsführer der Mannschaft in denen diese Spieler Stammspieler sind, deren Verfügbarkeit verändern."
                          // Also:
                          // - If player is a Stammspieler of the current team:
                          //   - Can change if: userIsAdminOrSportwart || isCurrentTeamManager || userId === p.id
                          // - If player is a substitute (not a Stammspieler of the current team):
                          //   - Can change if: userIsAdminOrSportwart || userId === p.id || (userRole === 'team_manager' && userTeamNumber === p.team_number)
                          // Let's implement this permission check cleanly:
                          const isStammOfCurrentTeam = stammspieler.some((s) => s.id === p.id);
                          let canEditResponse = false;
                          if (userIsAdminOrSportwart || userId === p.id) {
                            canEditResponse = true;
                          } else if (isStammOfCurrentTeam && isCurrentTeamManager) {
                            canEditResponse = true;
                          } else if (!isStammOfCurrentTeam && userRole === 'team_manager' && userTeamNumber === p.team_number) {
                            canEditResponse = true;
                          }

                          const isSubstitute = idx === 4;

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border transition-all ${
                                isSubstitute
                                  ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded shrink-0">
                                  {p.team_number && p.position_number ? `${p.team_number}.${p.position_number}` : 'Ersatz'}
                                </span>
                                <span className="font-semibold text-slate-800 truncate flex items-center gap-1" title={getShortName(p.name)}>
                                  <span className="truncate">{getShortName(p.name)}</span>
                                  {isSubstitute && (
                                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 border border-amber-200/60 px-1 py-0.5 rounded shrink-0 uppercase tracking-wider">
                                      Ersatz
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {canEditResponse ? (
                                  <select
                                    value={response || ''}
                                    onChange={(e) => handleUpdatePlayerResponse(p.id, e.target.value as any)}
                                    className={`text-[10px] font-bold p-1 rounded border outline-none bg-white cursor-pointer ${
                                      response === 'yes' || response === 'yes_sub'
                                        ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                                        : response === 'no'
                                        ? 'border-rose-300 text-rose-800 bg-rose-50'
                                        : response === 'maybe'
                                        ? 'border-amber-300 text-amber-800 bg-amber-50'
                                        : 'border-slate-200 text-slate-400'
                                    }`}
                                  >
                                    <option value="">Keine Antwort</option>
                                    <option value="yes">Ja</option>
                                    <option value="yes_sub">Ja als Ersatz</option>
                                    <option value="maybe">Vielleicht</option>
                                    <option value="no">Nein</option>
                                  </select>
                                ) : (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    response === 'yes' || response === 'yes_sub'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                      : response === 'no'
                                      ? 'bg-rose-50 text-rose-800 border-rose-100'
                                      : response === 'maybe'
                                      ? 'bg-amber-50 text-amber-800 border-amber-100'
                                      : 'bg-slate-50 text-slate-400 border-slate-100'
                                  }`}>
                                    {response === 'yes' ? 'Ja' : response === 'yes_sub' ? 'Ja als Ersatz' : response === 'no' ? 'Nein' : response === 'maybe' ? 'Vielleicht' : 'Keine Antwort'}
                                  </span>
                                )}

                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {userRole !== 'player' && matchAvails.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-50">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Aktuelle Rückmeldungen:</p>
                    <div className="flex flex-wrap gap-2">
                      {matchAvails.map((av) => (
                        <div
                          key={av.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            av.version_responded < match.version
                              ? 'bg-gray-50 text-gray-400 border-gray-200'
                              : av.response === 'yes' || av.response === 'yes_sub'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                              : av.response === 'no'
                              ? 'bg-rose-50 text-rose-800 border-rose-100'
                              : 'bg-amber-50 text-amber-800 border-amber-100'
                          }`}
                        >
                          <span>{getShortName(av.profiles?.name || '')}</span>
                          <span>
                            {av.version_responded < match.version
                              ? '⚠️'
                              : av.response === 'yes'
                              ? '✅'
                              : av.response === 'yes_sub'
                              ? '✅ (Ersatz)'
                              : av.response === 'no'
                              ? '❌'
                              : '🤔'}
                          </span>
                          {av.comment && (
                            <span className="text-[10px] text-gray-500 ml-1 italic border-l border-gray-300 pl-1" title={av.comment}>
                              💬
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
