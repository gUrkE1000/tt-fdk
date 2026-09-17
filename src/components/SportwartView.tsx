import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Plus, Edit2, Trash2, Check, X, Shield, Calendar, AlertCircle } from 'lucide-react';
import { isNameMatch } from '../lib/nameUtils';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface ScrapedPlayer {
  name: string;
  teamNumber: number;
  positionNumber: number;
  ttrPoints: number;
}

async function fetchHtmlText(url: string): Promise<string> {
  const errors: string[] = [];
  const maxRetries = 3;

  // 1. Try api.allorigins.win RAW endpoint with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const rawUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const resp = await fetch(rawUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.toLowerCase().includes('<table')) {
          return text;
        }
        errors.push(`AllOrigins RAW (Versuch ${attempt}/${maxRetries}): Antwort enthält keine Tabellendaten.`);
      } else {
        errors.push(`AllOrigins RAW (Versuch ${attempt}/${maxRetries}): HTTP-Fehler ${resp.status}`);
      }
    } catch (err: any) {
      errors.push(`AllOrigins RAW (Versuch ${attempt}/${maxRetries}) Fehler: ${err.message}`);
    }
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 2. Try api.allorigins.win JSON /get endpoint with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const resp = await fetch(allOriginsUrl);
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.contents) {
          let content = '';
          if (json.contents.startsWith('data:')) {
            const commaIdx = json.contents.indexOf(',');
            if (commaIdx !== -1) {
              const base64Str = json.contents.substring(commaIdx + 1);
              const binary = atob(base64Str);
              const bytes = new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
              content = new TextDecoder('utf-8').decode(bytes);
            }
          } else {
            content = json.contents;
          }
          if (content && content.toLowerCase().includes('<table')) {
            return content;
          }
          errors.push(`AllOrigins /get (Versuch ${attempt}/${maxRetries}): Parsierter Inhalt enthält keine Tabellendaten.`);
        } else {
          errors.push(`AllOrigins /get (Versuch ${attempt}/${maxRetries}): 'contents'-Feld fehlt in der Antwort.`);
        }
      } else {
        errors.push(`AllOrigins /get (Versuch ${attempt}/${maxRetries}): HTTP-Fehler ${resp.status}`);
      }
    } catch (err: any) {
      errors.push(`AllOrigins /get (Versuch ${attempt}/${maxRetries}) Fehler: ${err.message}`);
    }
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 3. Try codetabs proxy
  try {
    const codetabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const resp = await fetch(codetabsUrl);
    if (resp.ok) {
      const text = await resp.text();
      if (text && text.toLowerCase().includes('<table')) {
        return text;
      }
      errors.push(`Codetabs Proxy: Antwort enthält keine Tabellendaten.`);
    } else {
      errors.push(`Codetabs Proxy: HTTP-Fehler ${resp.status}`);
    }
  } catch (err: any) {
    errors.push(`Codetabs Proxy Fehler: ${err.message}`);
  }

  // 4. Try direct fetch
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const text = await resp.text();
      if (text && text.toLowerCase().includes('<table')) {
        return text;
      }
      errors.push(`Direkter Abruf: Antwort enthält keine Tabellendaten.`);
    } else {
      errors.push(`Direkter Abruf: HTTP-Fehler ${resp.status}`);
    }
  } catch (err: any) {
    errors.push(`Direkter Abruf Fehler: ${err.message}`);
  }

  throw new Error(`Alle Verbindungsmethoden zum Download sind fehlgeschlagen.\nDetails:\n- ${errors.join('\n- ')}`);
}

function parseMeldungHtml(html: string): ScrapedPlayer[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const scraped: ScrapedPlayer[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;

    // Check if one cell matches "X.Y" position format
    let positionMatch: RegExpExecArray | null = null;
    let positionCellIdx = -1;

    for (let i = 0; i < cells.length; i++) {
      let text = cells[i].innerHTML || '';
      text = text.replace(/<!--[\s\S]*?-->/g, ''); // remove comments

      const parserTmp = new DOMParser();
      const docTmp = parserTmp.parseFromString(text, 'text/html');
      const cleanText = (docTmp.body.textContent || '').replace(/\u00a0/g, ' ').trim();

      // Match "1.1" or "2.3" or "3.12" etc., possibly with whitespace
      const m = /^\s*(\d+)\s*\.\s*(\d+)\s*$/.exec(cleanText);
      if (m) {
        positionMatch = m;
        positionCellIdx = i;
        break;
      }
    }

    if (!positionMatch) return;

    const teamNumber = parseInt(positionMatch[1], 10);
    const positionNumber = parseInt(positionMatch[2], 10);

    // Look for name. It's usually in a link inside the row or the next cell
    let name = '';
    const link = row.querySelector('a');
    if (link) {
      name = link.textContent?.trim() || '';
    } else {
      // Fallback: look at cells after position cell that contain comma
      for (let i = positionCellIdx + 1; i < cells.length; i++) {
        const txt = cells[i].textContent?.trim() || '';
        if (txt.includes(',')) {
          name = txt;
          break;
        }
      }
    }

    if (!name) return;

    // Normalize name "Lastname, Firstname" to "Firstname Lastname"
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      if (parts.length === 2) {
        name = `${parts[1]} ${parts[0]}`;
      }
    }

    // Look for Q-TTR points (a 3 or 4 digit integer, usually >= 500)
    let ttrPoints = 0;
    for (let i = 0; i < cells.length; i++) {
      const txt = cells[i].textContent?.replace(/\u00a0/g, ' ').trim() || '';
      // Match a 3-4 digit number, ignore text around it if any, or must be pure number
      const m = /^\s*(\d{3,4})\s*$/.exec(txt);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val >= 500 && val <= 3000) {
          ttrPoints = val;
        }
      }
    }

    scraped.push({
      name,
      teamNumber,
      positionNumber,
      ttrPoints: ttrPoints || 0, // 0 means no Q-TTR points found (or not yet rated)
    });
  });

  return scraped;
}

export default function SportwartView() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings
  const [registeredTeamsCount, setRegisteredTeamsCount] = useState<number>(3);
  const [savingSettings, setSavingSettings] = useState(false);

  // Scraper Settings
  const [scrapedSeason, setScrapedSeason] = useState('26--27');
  const [scrapedRound, setScrapedRound] = useState<'vr' | 'rr'>('vr');

  // Manual Paste fallback Settings
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [manualHtml, setManualHtml] = useState('');

  // Player Form State
  const [isEditing, setIsEditing] = useState<string | null>(null); // 'new' or profile.id
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'player' | 'team_manager' | 'sportwart' | 'club_admin'>('player');
  const [formTtrPoints, setFormTtrPoints] = useState<number>(1500);
  const [formTeamNumber, setFormTeamNumber] = useState<string>('');
  const [formPositionNumber, setFormPositionNumber] = useState<string>('');

  const handleDownloadRoster = async () => {
    setLoading(true);
    try {
      // 1. Fetch club number from club_settings
      let clubNrValue = '21707';
      try {
        const { data: clubNrData } = await supabase
          .from('club_settings')
          .select('value')
          .eq('key', 'club_nr')
          .single();
        if (clubNrData) clubNrValue = clubNrData.value;
      } catch (e) {
        console.log('No club_nr setting yet. Using default 21707.');
      }

      // 2. Build URL
      const url = `https://www.mytischtennis.de/click-tt/WTTV/${scrapedSeason}/verein/${clubNrValue}/Heiligenhauser_SV/meldungendetails/E/${scrapedRound}`;

      const html = await fetchHtmlText(url);
      const scrapedPlayers = parseMeldungHtml(html);
      if (scrapedPlayers.length === 0) {
        throw new Error('Keine Spieler auf der Seite gefunden. Bitte überprüfe die URL, die Saison und die Vereinsnummer.');
      }

      // Calculate statistics before asking for confirmation
      let bereitsAktuell = 0;
      let nurAktualisiert = 0;
      let ersetzt = 0;

      scrapedPlayers.forEach((sp) => {
        const existingAtPosition = profiles.find(
          (p) => p.team_number === sp.teamNumber && p.position_number === sp.positionNumber
        );

        if (existingAtPosition && isNameMatch(existingAtPosition.name, sp.name)) {
          if (existingAtPosition.ttr_points === sp.ttrPoints) {
            bereitsAktuell++;
          } else {
            nurAktualisiert++;
          }
        } else {
          ersetzt++;
        }
      });

      const confirmMessage = `Achtung! Dadurch werden alle aktuell im Sportwart-Tab angegebenen Spieler durch die heruntergeladenen Spieler überschrieben.\n\n` +
        `Online gefundene Spieler: ${scrapedPlayers.length}\n` +
        `- Bereits aktuell: ${bereitsAktuell} Spieler (keine Änderung nötig)\n` +
        `- Nur aktualisiert (Q-TTR Punkte geändert): ${nurAktualisiert} Spieler\n` +
        `- Ersetzt (anderer Spielername auf Position oder neue Position): ${ersetzt} Spieler\n\n` +
        `Möchtest du fortfahren und die Änderungen in die Datenbank übernehmen?`;

      if (!confirm(confirmMessage)) {
        setLoading(false);
        return;
      }

      // 3. Clear existing team assignments & mappings
      // Reset team_number and position_number for all existing profiles
      const { error: resetErr } = await supabase
        .from('profiles')
        .update({ team_number: null, position_number: null })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (resetErr) throw resetErr;

      // Delete all team_players mappings
      const { error: delErr } = await supabase
        .from('team_players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
      if (delErr) throw delErr;

      // 4. Upsert scraped players
      for (const sp of scrapedPlayers) {
        // Check if player already exists by name
        const existing = profiles.find(p => isNameMatch(p.name, sp.name));
        let playerId = '';

        if (existing) {
          playerId = existing.id;
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({
              name: sp.name,
              team_number: sp.teamNumber,
              position_number: sp.positionNumber,
              ttr_points: sp.ttrPoints,
              updated_at: new Date().toISOString(),
            })
            .eq('id', playerId);
          if (updateErr) throw updateErr;
        } else {
          playerId = generateUUID();
          const { error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: playerId,
              name: sp.name,
              role: 'player',
              team_number: sp.teamNumber,
              position_number: sp.positionNumber,
              ttr_points: sp.ttrPoints,
            });
          if (insertErr) throw insertErr;
        }

        // Map to team_players
        const targetTeam = teams[sp.teamNumber - 1];
        if (targetTeam) {
          const { error: mapErr } = await supabase
            .from('team_players')
            .insert({
              team_id: targetTeam.id,
              player_id: playerId,
            });
          if (mapErr) console.error('Error mapping to team_players:', mapErr);
        }
      }

      alert(`Erfolgreich ${scrapedPlayers.length} Spieler heruntergeladen und importiert!`);
      await loadData();
    } catch (err: any) {
      alert(
        `Fehler beim Herunterladen der Spieler: ${err.message}\n\n` +
        `Tipp: Falls der automatische Download blockiert wurde (z.B. durch Browser-Sicherheitseinstellungen, Ad-Blocker oder Netzwerk-Einschränkungen), ` +
        `kannst du den HTML-Code der click-tt Tabelle kopieren und über die Option "HTML manuell einfügen" direkt importieren!`
      );
      setShowPasteArea(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async (htmlToParse: string) => {
    if (!htmlToParse.trim()) {
      alert('Bitte füge zuerst den HTML-Code ein.');
      return;
    }

    setLoading(true);
    try {
      const scrapedPlayers = parseMeldungHtml(htmlToParse);
      if (scrapedPlayers.length === 0) {
        throw new Error('Keine Spieler im eingefügten HTML gefunden. Bitte stelle sicher, dass du die richtige Tabelle kopiert hast.');
      }

      // Calculate statistics before asking for confirmation
      let bereitsAktuell = 0;
      let nurAktualisiert = 0;
      let ersetzt = 0;

      scrapedPlayers.forEach((sp) => {
        const existingAtPosition = profiles.find(
          (p) => p.team_number === sp.teamNumber && p.position_number === sp.positionNumber
        );

        if (existingAtPosition && isNameMatch(existingAtPosition.name, sp.name)) {
          if (existingAtPosition.ttr_points === sp.ttrPoints) {
            bereitsAktuell++;
          } else {
            nurAktualisiert++;
          }
        } else {
          ersetzt++;
        }
      });

      const confirmMessage = `Achtung! Dadurch werden alle aktuell im Sportwart-Tab angegebenen Spieler durch die eingefügten Spieler überschrieben.\n\n` +
        `Gefundene Spieler im HTML: ${scrapedPlayers.length}\n` +
        `- Bereits aktuell: ${bereitsAktuell} Spieler (keine Änderung nötig)\n` +
        `- Nur aktualisiert (Q-TTR Punkte geändert): ${nurAktualisiert} Spieler\n` +
        `- Ersetzt (anderer Spielername auf Position oder neue Position): ${ersetzt} Spieler\n\n` +
        `Möchtest du fortfahren und die Änderungen in die Datenbank übernehmen?`;

      if (!confirm(confirmMessage)) {
        setLoading(false);
        return;
      }

      // 3. Clear existing team assignments & mappings
      const { error: resetErr } = await supabase
        .from('profiles')
        .update({ team_number: null, position_number: null })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (resetErr) throw resetErr;

      const { error: delErr } = await supabase
        .from('team_players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) throw delErr;

      // 4. Upsert scraped players
      for (const sp of scrapedPlayers) {
        const existing = profiles.find(p => isNameMatch(p.name, sp.name));
        let playerId = '';

        if (existing) {
          playerId = existing.id;
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({
              name: sp.name,
              team_number: sp.teamNumber,
              position_number: sp.positionNumber,
              ttr_points: sp.ttrPoints,
              updated_at: new Date().toISOString(),
            })
            .eq('id', playerId);
          if (updateErr) throw updateErr;
        } else {
          playerId = generateUUID();
          const { error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: playerId,
              name: sp.name,
              role: 'player',
              team_number: sp.teamNumber,
              position_number: sp.positionNumber,
              ttr_points: sp.ttrPoints,
            });
          if (insertErr) throw insertErr;
        }

        // Map to team_players
        const targetTeam = teams[sp.teamNumber - 1];
        if (targetTeam) {
          const { error: mapErr } = await supabase
            .from('team_players')
            .insert({
              team_id: targetTeam.id,
              player_id: playerId,
            });
          if (mapErr) console.error('Error mapping to team_players:', mapErr);
        }
      }

      alert(`Erfolgreich ${scrapedPlayers.length} Spieler manuell importiert!`);
      setManualHtml('');
      setShowPasteArea(false);
      await loadData();
    } catch (err: any) {
      alert('Fehler beim Importieren der Spieler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      setProfiles(profs || []);

      // 2. Fetch active teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('active', true)
        .order('name');
      setTeams(teamsData || []);

      // 3. Fetch registered teams count setting
      const { data: setting } = await supabase
        .from('club_settings')
        .select('*')
        .eq('key', 'registered_teams_count')
        .single();
      if (setting) {
        setRegisteredTeamsCount(parseInt(setting.value, 10) || 3);
      }

      // 4. Fetch all player absences
      const { data: absData } = await supabase
        .from('absences')
        .select('*, profiles(name)')
        .order('start_date', { ascending: true });
      setAbsences(absData || []);
    } catch (err) {
      console.error('Error loading Sportwart data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('club_settings')
        .upsert({
          key: 'registered_teams_count',
          value: String(registeredTeamsCount),
        });

      if (error) throw error;
      alert('Einstellungen erfolgreich gespeichert!');
    } catch (err: any) {
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenNewForm = () => {
    setIsEditing('new');
    setFormName('');
    setFormRole('player');
    setFormTtrPoints(1500);
    setFormTeamNumber('');
    setFormPositionNumber('');
  };

  const handleOpenEditForm = (p: any) => {
    setIsEditing(p.id);
    setFormName(p.name);
    setFormRole(p.role);
    setFormTtrPoints(p.ttr_points || 0);
    setFormTeamNumber(p.team_number ? String(p.team_number) : '');
    setFormPositionNumber(p.position_number ? String(p.position_number) : '');
  };

  const handleCancelForm = () => {
    setIsEditing(null);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const ttr = Number(formTtrPoints) || 0;
    const teamNum = formTeamNumber ? Number(formTeamNumber) : null;
    const posNum = formPositionNumber ? Number(formPositionNumber) : null;

    try {
      let playerId = '';

      if (isEditing === 'new') {
        const generatedId = generateUUID();
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: generatedId,
            name: formName.trim(),
            role: formRole,
            ttr_points: ttr,
            team_number: teamNum,
            position_number: posNum,
          })
          .select()
          .single();

        if (error) throw error;
        playerId = data?.id || generatedId;
      } else {
        if (!isEditing) return;
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formName.trim(),
            role: formRole,
            ttr_points: ttr,
            team_number: teamNum,
            position_number: posNum,
            updated_at: new Date().toISOString(),
          })
          .eq('id', isEditing);

        if (error) throw error;
        playerId = isEditing;
      }

      // Sync team_players many-to-many map automatically if team_number is provided
      if (teamNum && teams.length >= teamNum) {
        const targetTeam = teams[teamNum - 1];
        if (targetTeam) {
          // Delete old team association
          await supabase.from('team_players').delete().eq('player_id', playerId);
          // Insert new team association
          await supabase.from('team_players').insert({
            team_id: targetTeam.id,
            player_id: playerId,
          });
        }
      } else {
        // If team number was removed, delete mappings
        await supabase.from('team_players').delete().eq('player_id', playerId);
      }

      setIsEditing(null);
      loadData();
      alert('Spieler erfolgreich gespeichert!');
    } catch (err: any) {
      alert('Fehler beim Speichern des Spielers: ' + err.message);
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`Möchtest du den Spieler "${name}" wirklich unwiderruflich löschen? Alle zugehörigen Stimmen und Abwesenheiten werden ebenfalls gelöscht.`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
      alert('Spieler erfolgreich gelöscht!');
    } catch (err: any) {
      alert('Fehler beim Löschen des Spielers: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // Group players by team numbers
  const groupedPlayers: Record<string, any[]> = { unassigned: [] };
  for (let i = 1; i <= registeredTeamsCount; i++) {
    groupedPlayers[i] = [];
  }

  profiles.forEach((p) => {
    if (p.team_number && p.team_number >= 1 && p.team_number <= registeredTeamsCount) {
      groupedPlayers[p.team_number].push(p);
    } else {
      groupedPlayers.unassigned.push(p);
    }
  });

  // Sort each team's players by position_number, then name
  Object.keys(groupedPlayers).forEach((key) => {
    groupedPlayers[key].sort((a, b) => {
      if (a.position_number && b.position_number) {
        return a.position_number - b.position_number;
      }
      if (a.position_number) return -1;
      if (b.position_number) return 1;
      return a.name.localeCompare(b.name);
    });
  });

  return (
    <div className="space-y-8">
      {/* 1. Header and Team Count Config */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            📋 Sportwart-Dashboard
          </h2>
          <p className="text-sm text-gray-500">
            Mannschaften registrieren, Spieler mit TTR-Punkten verwalten und Abwesenheiten überwachen.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-150 shrink-0 self-start md:self-auto">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Gemeldete Mannschaften</label>
            <input
              type="number"
              min="1"
              max="10"
              value={registeredTeamsCount}
              onChange={(e) => setRegisteredTeamsCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1.5 font-bold text-gray-700 outline-none text-center"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
          >
            Speichern
          </button>
        </div>
      </div>

      {/* Gemeldete Spieler importieren Section */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          📥 Gemeldete Spieler aus click-tt importieren
        </h3>
        <p className="text-xs text-gray-500 max-w-xl">
          Lade die offizielle Mannschaftsmeldung deines Vereins direkt von myTischtennis.de herunter oder füge den HTML-Code manuell ein. Alle gemeldeten Spieler, ihre Positionen und Q-TTR Punkte werden importiert und überschrieben.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end max-w-2xl">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Saison</label>
            <input
              type="text"
              value={scrapedSeason}
              onChange={(e) => setScrapedSeason(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="z.B. 26--27"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Halbserie</label>
            <select
              value={scrapedRound}
              onChange={(e) => setScrapedRound(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white font-semibold outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="vr">Vorrunde (vr)</option>
              <option value="rr">Rückrunde (rr)</option>
            </select>
          </div>
          <div className="sm:col-span-3 flex flex-wrap gap-3 mt-2">
            <button
              onClick={handleDownloadRoster}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              📥 Spieler herunterladen
            </button>
            <button
              onClick={() => setShowPasteArea(!showPasteArea)}
              className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors shadow-sm border border-gray-250"
            >
              📋 HTML manuell einfügen
            </button>
          </div>
        </div>

        {showPasteArea && (
          <div className="border-t border-gray-150 pt-4 space-y-3">
            <label className="block text-xs font-bold text-gray-600 uppercase">
              HTML-Code der Tabelle oder click-tt Seite einfügen:
            </label>
            <p className="text-[11px] text-gray-400">
              Kopiere den Quellcode der Tabelle auf der myTischtennis.de Seite (Meldungsdetails) und füge ihn hier ein.
            </p>
            <textarea
              value={manualHtml}
              onChange={(e) => setManualHtml(e.target.value)}
              placeholder="<table ...> ... </table>"
              className="w-full h-40 px-3 py-2 text-xs border rounded-xl font-mono focus:ring-2 focus:ring-teal-500 outline-none"
            />
            <button
              onClick={() => handleManualImport(manualHtml)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
              disabled={!manualHtml.trim()}
            >
              Import starten
            </button>
          </div>
        )}
      </div>

      {/* 2. Players Management */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Mannschaftsaufstellungen & Listenplätze
          </h3>
          {isEditing !== 'new' && (
            <button
              onClick={handleOpenNewForm}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" /> Spieler anlegen
            </button>
          )}
        </div>

        {/* Player Add/Edit Form */}
        {isEditing && (
          <form onSubmit={handleSavePlayer} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
            <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-widest">
              {isEditing === 'new' ? 'Neuen Spieler anlegen' : 'Spielerdaten bearbeiten'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Voller Name</label>
                <input
                  type="text"
                  placeholder="z.B. Max Mustermann"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Rolle im Verein</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="player">Spieler (player)</option>
                  <option value="team_manager">M-Führer (team_manager)</option>
                  <option value="sportwart">Sportwart (sportwart)</option>
                  <option value="club_admin">Vereinsadmin (club_admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">TTR Punkte</label>
                <input
                  type="number"
                  placeholder="z.B. 1600"
                  value={formTtrPoints}
                  onChange={(e) => setFormTtrPoints(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mannschafts-Index</label>
                <input
                  type="number"
                  min="1"
                  max={registeredTeamsCount}
                  placeholder="z.B. 1 für Erwachsene I"
                  value={formTeamNumber}
                  onChange={(e) => setFormTeamNumber(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leer lassen für Ersatzspieler</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Listenposition</label>
                <input
                  type="number"
                  min="1"
                  placeholder="z.B. 3 für Position 3"
                  value={formPositionNumber}
                  onChange={(e) => setFormPositionNumber(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">z.B. 1.3 (Team 1, Position 3)</p>
              </div>

              <div className="md:col-span-2 flex items-end justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 rounded-xl text-xs transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow"
                >
                  Speichern
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Aufstellungs-Ansicht */}
        <div className="space-y-6">
          {Array.from({ length: registeredTeamsCount }).map((_, idx) => {
            const teamNum = idx + 1;
            const players = groupedPlayers[teamNum] || [];

            return (
              <div key={teamNum} className="border border-gray-150 rounded-2xl overflow-hidden bg-white">
                <div className="bg-gray-50 border-b border-gray-150 px-4 py-3 flex items-center justify-between">
                  <h4 className="text-sm font-black text-gray-800">
                    🏅 Mannschaft {teamNum} ({teams[idx]?.name || `Erwachsene ${teamNum}`})
                  </h4>
                  <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2.5 py-0.5 rounded-full">
                    {players.length} Spieler gemeldet
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {players.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400 italic">Noch keine Spieler für diese Mannschaft eingetragen.</div>
                  ) : (
                    players.map((p) => (
                      <div key={p.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-gray-50/50 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-teal-700 w-8">
                            {teamNum}.{p.position_number || '?'}
                          </span>
                          <span className="font-bold text-gray-800">{p.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                            {p.ttr_points} TTR
                          </span>
                          {p.role !== 'player' && (
                            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold uppercase px-1.5 py-0.5 rounded">
                              {p.role}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditForm(p)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(p.id, p.name)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Ersatzspieler / Unassigned */}
          {groupedPlayers.unassigned.length > 0 && (
            <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white">
              <div className="bg-gray-50 border-b border-gray-150 px-4 py-3">
                <h4 className="text-sm font-black text-gray-800">
                  ⚠️ Ersatzspieler / Sonstige Vereinsmitglieder
                </h4>
              </div>

              <div className="divide-y divide-gray-100">
                {groupedPlayers.unassigned.map((p) => (
                  <div key={p.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-gray-50/50 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">{p.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                        {p.ttr_points} TTR
                      </span>
                      {p.role !== 'player' && (
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold uppercase px-1.5 py-0.5 rounded">
                          {p.role}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditForm(p)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                        title="Bearbeiten"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(p.id, p.name)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
