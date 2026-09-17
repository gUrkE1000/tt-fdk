import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncTeamCalendar } from '../lib/syncEngine';
import { getShortName } from '../lib/nameUtils';
import { RefreshCw, Shield, List, AlertCircle, Plus, Edit2, Check, X, ShieldAlert } from 'lucide-react';

export default function AdminDashboard() {
  const [teams, setTeams] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clubNr, setClubNr] = useState('21707');
  const [savingClubNr, setSavingClubNr] = useState(false);

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editShortName, setEditShortName] = useState('');
  const [editWebcal, setEditWebcal] = useState('');

  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newWebcal, setNewWebcal] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: teamsData } = await supabase.from('teams').select('*').order('name');
      setTeams(teamsData || []);

      const { data: profilesData } = await supabase.from('profiles').select('*').order('name');
      setProfiles(profilesData || []);

      const { data: runsData } = await supabase
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      setSyncRuns(runsData || []);

      try {
        const { data: clubNrData } = await supabase
          .from('club_settings')
          .select('value')
          .eq('key', 'club_nr')
          .single();
        if (clubNrData) {
          setClubNr(clubNrData.value);
        }
      } catch (e) {
        console.log('No club_nr setting yet.');
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClubNr = async () => {
    setSavingClubNr(true);
    try {
      const { error } = await supabase
        .from('club_settings')
        .upsert({ key: 'club_nr', value: clubNr }, { onConflict: 'key' });
      if (error) throw error;
      alert('Vereinsnummer erfolgreich gespeichert!');
    } catch (err: any) {
      alert('Fehler beim Speichern der Vereinsnummer: ' + err.message);
    } finally {
      setSavingClubNr(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // TODO - add documentation
  const handleManualSync = async () => {
    setSyncing(true);
    setSyncFeedback('Synchronisiere Kalender...');

    let successCount = 0;
    let failedCount = 0;
    let detailsSummary = '';

    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('sync-calendars', {
        headers: {
          'x-sync-secret': import.meta.env.VITE_SYNC_SECRET || '',
        }
      });

      if (!edgeErr && edgeData) {
        setSyncFeedback(edgeData.message || 'Erfolgreich synchronisiert.');
        loadData();
        return;
      }

      console.warn('Edge function sync failed or not deployed, falling back to client-side sync engine:', edgeErr);

      const { data: runRecord, error: rErr } = await supabase
        .from('sync_runs')
        .insert({
          status: 'pending',
          summary_text: 'Manuelle Synchronisierung via Client...',
        })
        .select()
        .single();

      if (rErr || !runRecord) throw new Error('Konnte Sync-Log nicht initialisieren.');

      const results = [];
      for (const team of teams) {
        if (!team.active) continue;
        if (results.length > 0) {
          // Add a 1.5s delay between teams to prevent concurrent proxy/target site rate-limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        const res = await syncTeamCalendar(supabase, team.id);
        results.push(res);
        if (res.status === 'success') {
          successCount++;
          detailsSummary += `${res.teamName}: ${res.added} neu, ${res.rescheduled} verlegt. `;
        } else {
          failedCount++;
          detailsSummary += `${res.teamName} fehlgeschlagen (${res.message}). `;
        }
      }

      const finalStatus = failedCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'failed';
      const summaryText = `Client-Sync beendet (${finalStatus}). ${detailsSummary}`;

      await supabase
        .from('sync_runs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          summary_text: summaryText,
        })
        .eq('id', runRecord.id);

      setSyncFeedback(summaryText);
      loadData();
    } catch (err: any) {
      console.error('Manual sync error:', err);
      setSyncFeedback('Synchronisationsfehler: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTeam = async (id: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editName,
          short_name: editShortName,
          webcal_url: editWebcal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      setEditingTeamId(null);
      loadData();
    } catch (err: any) {
      alert('Fehler beim Speichern der Mannschaft: ' + err.message);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('teams').insert({
        name: newName,
        short_name: newShortName,
        webcal_url: newWebcal,
        active: true,
      });

      if (error) throw error;
      setIsAddingTeam(false);
      setNewName('');
      setNewShortName('');
      setNewWebcal('');
      loadData();
    } catch (err: any) {
      alert('Fehler beim Hinzufügen der Mannschaft: ' + err.message);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Fehler beim Ändern der Rolle: ' + err.message);
    }
  };

  const toggleTeamActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Fehler beim Umschalten des Status: ' + err.message);
    }
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🛡️ Vereins-Administration
          </h2>
          <p className="text-sm text-gray-500">
            Verwalte Mannschaften, Webcal-Links, Rollen und synchronisiere die Spielpläne.
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            🔄 Spielpläne jetzt synchronisieren
          </button>

          {syncFeedback && (
            <p className="text-xs text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-150 max-w-sm">
              {syncFeedback}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          ⚙️ Allgemeine Vereinseinstellungen
        </h3>
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vereinsnummer (click-tt / myTischtennis)</label>
            <input
              type="text"
              value={clubNr}
              onChange={(e) => setClubNr(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="z.B. 21707"
            />
          </div>
          <button
            onClick={handleSaveClubNr}
            disabled={savingClubNr}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 shrink-0"
          >
            {savingClubNr ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <List className="h-5 w-5 text-gray-500" />
                Mannschaftskonfiguration
              </h3>
              <button
                onClick={() => setIsAddingTeam(!isAddingTeam)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Neue Mannschaft
              </button>
            </div>

            {isAddingTeam && (
              <form onSubmit={handleAddTeam} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase">Neue Mannschaft hinzufügen</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Mannschaftsname (z.B. Erwachsene IV)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-2 border rounded-xl text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Kurzname (z.B. Erwachsene 4)"
                    value={newShortName}
                    onChange={(e) => setNewShortName(e.target.value)}
                    className="px-3 py-2 border rounded-xl text-sm"
                    required
                  />
                </div>
                <input
                  type="text"
                  placeholder="webcal://www.mytischtennis.de/community/..."
                  value={newWebcal}
                  onChange={(e) => setNewWebcal(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  required
                />
                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingTeam(false)}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 font-semibold rounded-lg text-gray-700"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 font-semibold text-white rounded-lg"
                  >
                    Hinzufügen
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {teams.map((team) => {
                const isEditing = editingTeamId === team.id;

                return (
                  <div key={team.id} className="p-4 border border-gray-150 rounded-xl space-y-3 hover:border-gray-300 transition-colors bg-white">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-2 border rounded-xl text-sm font-semibold"
                            placeholder="Mannschaftsname"
                          />
                          <input
                            type="text"
                            value={editShortName}
                            onChange={(e) => setEditShortName(e.target.value)}
                            className="px-3 py-2 border rounded-xl text-sm font-semibold"
                            placeholder="Kurzname"
                          />
                        </div>
                        <input
                          type="text"
                          value={editWebcal}
                          onChange={(e) => setEditWebcal(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-xs"
                          placeholder="Webcal URL"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingTeamId(null)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSaveTeam(team.id)}
                            className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800">{team.name}</h4>
                            <span className="text-xs text-gray-400">({team.short_name})</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${team.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {team.active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-sm sm:max-w-md md:max-w-lg mt-1" title={team.webcal_url}>
                            🔗 {team.webcal_url}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => toggleTeamActive(team.id, team.active)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border ${team.active ? 'hover:bg-red-50 text-red-600 border-red-100' : 'hover:bg-green-50 text-green-600 border-green-100'}`}
                          >
                            {team.active ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setEditName(team.name);
                              setEditShortName(team.short_name);
                              setEditWebcal(team.webcal_url);
                            }}
                            className="p-2 border hover:bg-gray-50 text-gray-600 rounded-lg"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              Rollenverwaltung
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-150">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{getShortName(profile.name)}</p>
                    <p className="text-[10px] text-gray-400">{profile.id.substring(0, 8)}...</p>
                  </div>

                  <select
                    value={profile.role}
                    onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                    className="text-xs bg-white border rounded-lg px-2 py-1 outline-none font-medium text-gray-700 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="player">Spieler (player)</option>
                    <option value="team_manager">M-Führer (manager)</option>
                    <option value="sportwart">Sportwart (sportwart)</option>
                    <option value="club_admin">Admin (club_admin)</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-gray-500" />
          Synchronisations-Protokoll (Letzte 5)
        </h3>

        <div className="divide-y divide-gray-100">
          {syncRuns.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Noch keine Synchronisierungen durchgeführt.</p>
          ) : (
            syncRuns.map((run) => (
              <div key={run.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded font-bold mr-2 ${
                    run.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : run.status === 'pending'
                      ? 'bg-blue-100 text-blue-800 animate-pulse'
                      : run.status === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {run.status.toUpperCase()}
                  </span>
                  <span className="font-semibold text-gray-700">
                    {new Date(run.started_at).toLocaleString('de-DE')}
                  </span>
                  <p className="text-gray-500 mt-1 max-w-xl truncate" title={run.summary_text}>
                    {run.summary_text}
                  </p>
                </div>
                <div className="text-gray-400 shrink-0 text-[10px]">
                  ID: {run.id.substring(0, 8)}...
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
