import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AlertTriangle, Clock, MapPin, User, ChevronRight, Check } from 'lucide-react';
import { getShortName } from '../lib/nameUtils';

export default function GesamtUebersichtView() {
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: teamsData } = await supabase.from('teams').select('*').eq('active', true);
      const activeTeams = (teamsData || []).sort((a, b) => a.name.localeCompare(b.name));
      setTeams(activeTeams);
      const activeTeamIds = activeTeams.map((t) => t.id);

      if (activeTeamIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .in('team_id', activeTeamIds)
        .eq('active', true)
        .order('dtstart', { ascending: true });
      const fetchedMatches = matchesData || [];
      setMatches(fetchedMatches);

      const { data: tpData } = await supabase
        .from('team_players')
        .select('*, teams(name)');
      setTeamPlayers(tpData || []);

      const { data: avData } = await supabase
        .from('availabilities')
        .select('*, profiles(name)');
      setAvailabilities(avData || []);

      const { data: profilesData } = await supabase.from('profiles').select('*');
      setProfiles(profilesData || []);

      calculateConflicts(fetchedMatches, avData || [], profilesData || [], activeTeams);
    } catch (err) {
      console.error('Error loading Gesamtübersicht data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateConflicts = (allMatches: any[], allAvails: any[], allProfs: any[], allTeams: any[]) => {
    const list: any[] = [];

    const activeAvails = allAvails.filter(
      (a) => a.response === 'yes' || a.response === 'yes_sub' || a.response === 'maybe'
    );

    const playerMap = new Map<string, any[]>();
    for (const av of activeAvails) {
      if (!playerMap.has(av.player_id)) {
        playerMap.set(av.player_id, []);
      }
      playerMap.get(av.player_id)!.push(av);
    }

    for (const [playerId, avList] of playerMap.entries()) {
      const player = allProfs.find((p) => p.id === playerId);
      if (!player) continue;

      for (let i = 0; i < avList.length; i++) {
        for (let j = i + 1; j < avList.length; j++) {
          const matchA = allMatches.find((m) => m.id === avList[i].match_id);
          const matchB = allMatches.find((m) => m.id === avList[j].match_id);

          if (!matchA || !matchB || matchA.id === matchB.id) continue;

          const startA = new Date(matchA.dtstart).getTime();
          const endA = new Date(matchA.dtend).getTime();
          const startB = new Date(matchB.dtstart).getTime();
          const endB = new Date(matchB.dtend).getTime();

          const hasOverlap = startA < endB && startB < endA;

          if (hasOverlap) {
            const teamA = allTeams.find((t) => t.id === matchA.team_id)?.name || 'Team A';
            const teamB = allTeams.find((t) => t.id === matchB.team_id)?.name || 'Team B';

            list.push({
              id: `${playerId}-${matchA.id}-${matchB.id}`,
              playerName: getShortName(player.name),
              matchA,
              matchB,
              teamA,
              teamB,
            });
          }
        }
      }
    }

    setConflicts(list);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const getPlayerTeamsString = (playerId: string) => {
    const maps = teamPlayers.filter((tp) => tp.player_id === playerId);
    if (maps.length === 0) return 'Keine Stammzugehörigkeit';
    return maps.map((m) => m.teams?.name).join(', ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🗓️ Chronologische Gesamtübersicht
          </h2>
          <p className="text-sm text-gray-500">
            Alle anstehenden Spiele aller {teams.length} Mannschaften in zeitlicher Reihenfolge.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-sm px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold rounded-xl transition-colors self-start"
        >
          🔄 Aktualisieren
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            ⚠️ Möglicher Terminkonflikt ({conflicts.length})
          </h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {conflicts.map((conf) => (
              <div key={conf.id} className="bg-white/80 border border-red-100 rounded-xl p-3 text-xs text-red-800 space-y-1 shadow-sm">
                <p>
                  <strong className="text-sm text-red-900">{conf.playerName}</strong> ist gleichzeitig verfügbar für:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div className="bg-red-50/50 p-2 rounded border border-red-100/50">
                    <span className="font-bold">{conf.teamA}</span> ({conf.matchA.summary.split(' vs ').find((p: string) => !p.includes(conf.teamA))})
                    <p className="text-[10px] text-gray-500 mt-0.5">{formatGermanDate(conf.matchA.dtstart)}</p>
                  </div>
                  <div className="bg-red-50/50 p-2 rounded border border-red-100/50">
                    <span className="font-bold">{conf.teamB}</span> ({conf.matchB.summary.split(' vs ').find((p: string) => !p.includes(conf.teamB))})
                    <p className="text-[10px] text-gray-500 mt-0.5">{formatGermanDate(conf.matchB.dtstart)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {matches.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
            <p className="text-gray-500 italic">Derzeit keine anstehenden Termine vorhanden.</p>
          </div>
        ) : (
          matches.map((match) => {
            const team = teams.find((t) => t.id === match.team_id);
            const isExpanded = expandedMatchId === match.id;

            const teamIdx = teams.findIndex((t) => t.id === match.team_id);
            const teamNum = teamIdx !== -1 ? teamIdx + 1 : null;

            const assignedPlayerIds = teamPlayers
              .filter((tp) => tp.team_id === match.team_id)
              .map((tp) => tp.player_id);

            const isPlayerStamm = (playerId: string) => {
              const prof = profiles.find((p) => p.id === playerId);
              if (!prof) return false;

              // 1. If profile is in team_players for this team
              if (assignedPlayerIds.includes(playerId)) {
                // If they are a club_admin or sportwart but have no team_number assigned,
                // they are unassigned/Ersatzspieler (e.g. Admin Dummy) and not a Stammspieler.
                if ((prof.role === 'club_admin' || prof.role === 'sportwart') && !prof.team_number) {
                  return false;
                }
                return true;
              }

              // 2. If profile's team_number matches teamNum, they are definitely Stammspieler
              if (prof.team_number && teamNum && prof.team_number === teamNum) {
                return true;
              }

              return false;
            };

            const matchAvs = availabilities.filter((av) => av.match_id === match.id && av.version_responded === match.version);
            const yesAvs = matchAvs.filter((av) => av.response === 'yes' || av.response === 'yes_sub');
            const maybeAvs = matchAvs.filter((av) => av.response === 'maybe');

            const stammAvail = yesAvs.filter((av) => isPlayerStamm(av.player_id));
            const helperAvail = yesAvs.filter((av) => !isPlayerStamm(av.player_id));

            const opponent = match.is_home
              ? (match.summary.split(' vs ')[1] || match.summary).trim()
              : (match.summary.split(' vs ')[0] || match.summary).trim();

            return (
              <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div
                  onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                  className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none hover:bg-gray-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-teal-50 text-teal-800 text-xs font-bold rounded-md">
                        {team?.name || 'Mannschaft'}
                      </span>
                      <span className="text-xs text-gray-400">
                        Spieltag {match.matchday || '-'}
                      </span>
                    </div>

                    <h3 className={`text-base sm:text-lg font-bold ${yesAvs.length < 4 ? 'text-red-600' : 'text-gray-800'}`}>
                      {match.is_home ? '🏠 Heimspiel gegen' : '🚌 Auswärtsspiel gegen'} {opponent}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-teal-600" />
                        {formatGermanDate(match.dtstart)}
                      </span>
                      {match.location && (
                        <span className="flex items-center gap-1 max-w-xs truncate" title={match.location}>
                          <MapPin className="h-3.5 w-3.5 text-teal-600" />
                          {match.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {yesAvs.length < 4 && (
                      <span title="Weniger als 4 Zusagen!">
                        <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                      </span>
                    )}
                    <div className="text-right text-xs">
                      <p className="font-bold text-gray-700">Verfügbar: {yesAvs.length}</p>
                      <p className="text-gray-400">{helperAvail.length} Ersatzspieler</p>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50/50 px-5 py-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider border-b pb-1.5 border-gray-200">
                        Stammzugehörigkeit ({stammAvail.length})
                      </h4>
                      {stammAvail.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Keine Stammspieler als verfügbar gemeldet.</p>
                      ) : (
                        <div className="space-y-2">
                          {stammAvail.map((av) => (
                            <div key={av.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-150">
                              <span className="font-semibold text-gray-800">{getShortName(av.profiles?.name || '')}</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                <Check className="h-3 w-3" /> Stamm
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider border-b pb-1.5 border-gray-200">
                        Ersatzspieler aus anderen Teams ({helperAvail.length})
                      </h4>
                      {helperAvail.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Keine Ersatzspieler gemeldet.</p>
                      ) : (
                        <div className="space-y-2">
                          {helperAvail.map((av) => (
                            <div key={av.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-teal-100 shadow-sm">
                              <div>
                                <span className="font-semibold text-teal-900">{getShortName(av.profiles?.name || '')}</span>
                                <span className="text-[10px] text-gray-400 block">Stamm: {getPlayerTeamsString(av.player_id)}</span>
                              </div>
                              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                <User className="h-3 w-3 text-teal-600" /> Aushilfe
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {maybeAvs.length > 0 && (
                      <div className="md:col-span-2 pt-3">
                        <h5 className="font-bold text-gray-600 uppercase text-xs tracking-wider mb-2">Vielleicht ({maybeAvs.length})</h5>
                        <div className="flex flex-wrap gap-2">
                          {maybeAvs.map((av) => (
                            <div key={av.id} className="bg-white px-2.5 py-1 rounded-lg border border-gray-150 text-xs text-gray-700">
                              <span className="font-semibold">{getShortName(av.profiles?.name || '')}</span> ({getPlayerTeamsString(av.player_id)})
                              {av.comment && <span className="italic text-gray-400 block text-[10px] mt-0.5">💬 "{av.comment}"</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
