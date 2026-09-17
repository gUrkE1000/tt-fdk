import React, { useState, useEffect } from 'react';
import { BookOpen, Shield, User, Users, Award, Calendar, Settings, Info, Lock, Key, ChevronRight } from 'lucide-react';

interface GuideViewProps {
  role?: 'player' | 'team_manager' | 'sportwart' | 'club_admin';
}

export default function GuideView({ role = 'player' }: GuideViewProps) {
  const [selectedRole, setSelectedRole] = useState<'player' | 'team_manager' | 'sportwart' | 'club_admin'>(role);

  // Sync state if initial prop changes (e.g. on late profile load)
  useEffect(() => {
    if (role) {
      setSelectedRole(role);
    }
  }, [role]);

  const roleLabels: Record<'player' | 'team_manager' | 'sportwart' | 'club_admin', string> = {
    player: 'Spieler',
    team_manager: 'Mannschaftsführer',
    sportwart: 'Sportwart',
    club_admin: 'Admin',
  };

  const getRoleIcon = (r: 'player' | 'team_manager' | 'sportwart' | 'club_admin') => {
    switch (r) {
      case 'player':
        return <User className="h-4 w-4" />;
      case 'team_manager':
        return <Users className="h-4 w-4" />;
      case 'sportwart':
        return <Award className="h-4 w-4" />;
      case 'club_admin':
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-teal-600" />
            📖 Handbuch & Bedienungsanleitung
          </h2>
          <p className="text-sm text-gray-500">
            Hier findest du eine Übersicht aller Funktionen, angepasst an deine Rolle im Verein.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-150">
          {(['player', 'team_manager', 'sportwart', 'club_admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                selectedRole === r
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {getRoleIcon(r)}
              {roleLabels[r]}
              {role === r && (
                <span className="text-[9px] bg-white text-teal-700 px-1 py-0.2 rounded font-black uppercase tracking-wider ml-1">
                  Aktiv
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Info Badge */}
      {role !== selectedRole && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Du betrachtest die Anleitung für die Rolle <strong>{roleLabels[selectedRole]}</strong>. Deine aktive Rolle ist <strong>{roleLabels[role]}</strong>.
          </span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: General password & lock info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Lock className="h-5 w-5 text-teal-600" />
              Anmeldung & Sicherheit
            </h3>

            <div className="space-y-4">
              {selectedRole !== 'player' && (
                <>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Passwort-Gate</h4>
                      <p className="text-xs text-gray-500 leading-relaxed mt-1">
                        Die gesamte Anwendung ist durch ein globales Vereinspasswort vor unbefugtem Zugriff von außen geschützt.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Info className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Bypass-Link</h4>
                      <p className="text-xs text-gray-500 leading-relaxed mt-1">
                        Um die Eingabe zu überspringen, kannst du das Passwort an die URL anhängen:
                        <code className="block bg-gray-100 text-[10px] p-1.5 rounded border border-gray-200 mt-1.5 font-mono overflow-x-auto whitespace-pre-wrap">
                          ?pw=DeinPasswort
                        </code>
                        Ideal, um den Link als Lesezeichen zu speichern oder in WhatsApp-Gruppen zu teilen!
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Zwei Login-Wege</h4>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    <strong>1. Passwortlos (Dropdown):</strong> Schnellzugriff für normale Spieler. Du hast hierbei nur Spieler-Rechte.<br />
                    <strong>2. E-Mail & Passwort:</strong> Erforderlich, um erweiterte Rechte (Mannschaftsführer, Sportwart, Admin) freizuschalten.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Selected role documentation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="h-10 w-10 bg-teal-50 border border-teal-200 rounded-xl text-teal-600 flex items-center justify-center">
                {getRoleIcon(selectedRole)}
              </div>
              <div>
                <h3 className="text-base font-black text-gray-800">
                  Funktionen für {roleLabels[selectedRole]}
                </h3>
                <p className="text-xs text-gray-400">Rolle: `{selectedRole}`</p>
              </div>
            </div>

            {/* Role specific content conditional render */}
            {selectedRole === 'player' && (
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  Als <strong>Spieler</strong> steht für dich die schnelle Rückmeldung und deine persönliche Planung im Vordergrund:
                </p>

                <div className="space-y-3 mt-4">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🟢 1. Spielbereitschaft zurückmelden (RSVP)
                    </h4>
                    <p className="text-xs text-gray-500">
                      Im Reiter <strong>"Mannschaften"</strong> siehst du anstehende Spiele deines Teams. Trage deine Bereitschaft mit den berührungsfreundlichen Tasten ein:
                    </p>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1 text-xs text-gray-500">
                      <li><strong className="text-emerald-700">Zusage (Grün):</strong> Du bist spielbereit und stehst zur Verfügung.</li>
                      <li><strong className="text-rose-700">Absage (Rot):</strong> Du kannst an diesem Termin nicht spielen.</li>
                      <li><strong className="text-amber-700">Unsicher (Gelb):</strong> Du bist noch unsicher (z.B. wegen Schichtarbeit).</li>
                    </ul>
                    <p className="text-xs text-gray-500 mt-1">
                      Hinterlasse bei Bedarf auch direkt eine kurze Bemerkung (z.B. "Komme direkt zum Spiel").
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🏓 2. Ersatzspieler-Meldung
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du möchtest in einer anderen Mannschaft als Ersatzspieler aushelfen? Navigiere einfach zu dem entsprechenden Team, klicke auf das Spiel und trage dich mit <strong>"Zusage" (Grün)</strong> ein. Das System führt dich dort sofort als verfügbaren Ersatzspieler auf.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      📅 3. Abwesenheiten eintragen (Mein Kalender)
                    </h4>
                    <p className="text-xs text-gray-500">
                      Im Reiter <strong>"Mein Kalender"</strong> kannst du Zeiträume eintragen, an denen du generell nicht zur Verfügung stehst (Urlaub, Dienstreisen, Krankheit). Diese werden Mannschaftsführern, dem Sportwart und den Admins im Abwesenheits-Kalender automatisch angezeigt.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'team_manager' && (
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  Als <strong>Mannschaftsführer</strong> bist du für die Aufstellung, Kaderpflege und Organisation deines Teams verantwortlich:
                </p>

                <div className="space-y-3 mt-4">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🔑 1. Login-Voraussetzung & Änderungs-Banner
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du musst dich zwingend mit deiner <strong>E-Mail-Adresse und Passwort</strong> anmelden. Eine passwortlose Anmeldung über die Namensliste stuft dich aus Sicherheitsgründen als normalen Spieler ein!
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      <strong>🔔 Benachrichtigungen seit deinem letzten Login:</strong> Wenn du eingeloggt bist und deine Mannschaft auswählst, wird oben über den Spielen ein blaues Banner angezeigt. Dort siehst du auf einen Blick alle neuen Zu-, Ab- oder Ersatz-Meldungen von Spielern, die seit deinem letzten Login vorgenommen wurden.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🏓 2. Spieler & Ersatzspieler zu Spielen hinzufügen (RSVP-Steuerung)
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du kannst die Rückmeldungen für Spiele deiner Mannschaft direkt steuern. Das ist besonders nützlich, wenn ein Spieler dir mündlich oder per WhatsApp zusagt:
                    </p>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1 text-xs text-gray-500">
                      <li>
                        <strong>Wo:</strong> Navigiere zum Reiter <strong>"Mannschaften"</strong> und wähle deine Mannschaft aus. In der Aufstellungs-Liste ("Aufstellung (Stamm 1-4 / Ersatz)") des jeweiligen Spiels findest du neben den Spielern ein <strong>Dropdown-Auswahlfeld</strong> (z.B. mit "Ja", "Nein", "Vielleicht", "Keine Antwort").
                      </li>
                      <li>
                        <strong>Ersatzspieler hinzufügen:</strong> Wenn ein externer Spieler (Ersatzspieler) aushelfen möchte, muss dieser entweder selbst für das Spiel zugestimmt haben, oder du änderst seinen Status in der Liste auf "Ja". Sobald er eine Zusage hat, wird er automatisch in das Lineup deines Spiels aufgenommen.
                      </li>
                      <li>
                        <strong>Berechtigungsregel:</strong> Du kannst die Rückmeldungen all deiner Stammspieler ändern. Für Ersatzspieler gilt: Nur der Mannschaftsführer <strong>seiner registrierten Stamm-Mannschaft</strong> (oder Sportwarte/Admins) kann dessen RSVP-Status ändern. So wird verhindert, dass andere Teams unerlaubt über die Verfügbarkeit fremder Spieler bestimmen.
                      </li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      ⚙️ 3. Logik der Mannschaftsaufstellung (Lineup-Engine)
                    </h4>
                    <p className="text-xs text-gray-500">
                      Die Aufstellungsliste pro Spiel (Kader von maximal 5 Spielern) wird vollautomatisch nach einer klaren Logik berechnet und sortiert:
                    </p>
                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-teal-500 text-xs text-gray-500">
                      <p>
                        <strong>A. Pool der Kandidaten:</strong> Der Pool besteht aus allen fest zugeordneten Stammspielern deines Teams sowie allen externen Spielern (Ersatzspielern), die eine Rückmeldung für dieses Spiel abgegeben haben.
                      </p>
                      <p>
                        <strong>B. RSVP-Priorität (4-Stufen-Logik):</strong> Alle Kandidaten werden zuerst nach ihrer Rückmeldung für dieses Spiel gruppiert und priorisiert:
                      </p>
                      <ol className="list-decimal pl-4 space-y-0.5">
                        <li><strong className="text-emerald-700">Ja (Zusage):</strong> Haben höchste Priorität und rücken auf die ersten 4 Stamm-Plätze.</li>
                        <li><strong className="text-teal-700">Ja als Ersatz:</strong> 5. Option im Dropdown. Wenn 5 oder mehr Spieler zugesagt haben, kannst du Spieler als "Ja als Ersatz" markieren. Sie landen dann auf Ersatz-Position 5, 6 etc.</li>
                        <li><strong>Keine Antwort:</strong> Werden als Standby behandelt und folgen danach.</li>
                        <li><strong className="text-amber-700">Vielleicht:</strong> Stehen an vierter Stelle.</li>
                        <li><strong className="text-rose-700">Nein (Absage):</strong> Rutschen ganz ans Ende.</li>
                      </ol>
                      <p>
                        <strong>C. Vereinsrangfolge (Tie-Breaker):</strong> Haben mehrere Spieler denselben RSVP-Status (z. B. drei Spieler mit "Ja"), entscheidet die offizielle Rangfolge im Verein. Diese ist sortiert nach:
                        <br />
                        <span className="font-mono bg-gray-100 px-1 py-0.2 rounded text-[10px]">Mannschaftsnummer aufsteigend ➔ Positionsnummer aufsteigend ➔ Name alphabetisch</span>
                        <br />
                        Dadurch rücken bei Ausfällen automatisch die nächstbesten, verfügbaren Spieler des Vereins nach.
                      </p>
                      <p>
                        <strong>D. Die "Top 5" & der Ersatzspieler-Status:</strong> Das System wählt die besten 5 Spieler aus dieser sortierten Liste aus:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Die ersten <strong>vier Spieler</strong> (Index 1 bis 4) bilden die Kern-Aufstellung.</li>
                        <li>Der <strong>fünfte Spieler</strong> (Index 5) wird deutlich sichtbar als <strong>"Ersatz"</strong> markiert (warme gelbe Hintergrundfarbe & Ersatz-Badge).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      📊 4. Team-Matrix & WhatsApp-Nachrichten-Generator
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      Unterhalb der Spieleliste deiner Mannschaft siehst du die <strong>Team-Matrix</strong>. Hier erkennst du auf einen Blick, wer zugesagt, abgesagt, noch nicht geantwortet oder eine Bemerkung hinterlassen hat.
                    </p>
                    <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-150 text-xs text-gray-600 space-y-1.5">
                      <p className="font-bold text-emerald-900 flex items-center gap-1">
                        💬 WhatsApp-Kopierfunktion (Zeile "WhatsApp" ganz unten):
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Ein Klick auf das WhatsApp-Icon unter einem Spiel generiert automatisch einen fertigen WhatsApp-Text und kopiert ihn direkt in deine Zwischenablage:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px]">
                        <li>
                          <strong>Bei 4 oder mehr Zusagen:</strong> Erzeugt eine finale Aufstellungsnachricht mit den 4 Stammspielern und optionalem 5. Backup-Spieler.
                        </li>
                        <li>
                          <strong>Bei weniger als 4 Zusagen:</strong> Erzeugt einen dringenden Aufruf, nennt die Anzahl der fehlenden Spieler, listet bisherige Zusagen namentlich auf und setzt automatisch eine Rückmeldefrist (1 Woche vor dem Spiel).
                        </li>
                        <li>
                          <strong>Erkennung zeitgleicher Spiele:</strong> Spielt zeitgleich eine andere Vereinsmannschaft am selben Ort (Heim oder Auswärts), fügt das System automatisch einen freundlichen Zusatzhinweis hinzu (z. B. <em>"Die zweite Mannschaft hat zeitgleich ebenfalls ein Heimspiel..."</em>).
                        </li>
                        <li>
                          <strong>Ankunftszeit & Spielort:</strong> Bei 4 oder mehr Zusagen wird automatisch die Ankunftszeit bzw. der Treffpunkt ergänzt (bei Heimspielen 1 Stunde vor Spielstart in der Halle; bei Auswärtsspielen 30 Minuten vor Spielstart am jeweiligen Spielort).
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      📅 5. Abwesenheits-Kalender
                    </h4>
                    <p className="text-xs text-gray-500">
                      Im Reiter <strong>"Abwesenheits-Kalender"</strong> siehst du die kommenden 4 Monate (2 Monate nebeneinander) an Abwesenheiten aller Vereinsmitglieder gesammelt. Klicke auf einen Tag, um Details zu sehen, wer fehlt und warum, damit du besser für Ersatz sorgen kannst.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'sportwart' && (
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  Als <strong>Sportwart</strong> hast du die sportliche Gesamtleitung und planst die Aufstellungen mannschaftsübergreifend im Verein:
                </p>

                <div className="space-y-3 mt-4">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🛠️ 1. Spieler & TTR-Punkte verwalten
                    </h4>
                    <p className="text-xs text-gray-500">
                      Im Reiter <strong>"Sportwart"</strong> kannst du neue Spielerprofile anlegen (ohne dass diese ein Supabase-Konto benötigen), TTR-Punkte aktualisieren und ihre Vereinsrangfolge (Team- & Positionsnummer, z.B. 1.1, 1.2, etc.) festlegen. Diese Rangfolge steuert die automatische Nachrücker-Hierarchie bei Ersatzspielern.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      HTML-Kader-Import & Abgleich
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du kannst die Mannschaftsmeldung (HTML-Tabelle von myTischtennis.de) kopieren und über die Import-Funktion einfügen. Das System vergleicht die Daten automatisch und zeigt übersichtlich an, welche Spieler neu sind, wessen TTR-Punkte sich geändert haben oder wer ersetzt wurde, bevor du die Änderungen bestätigst.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🏓 2. Aufstellungs-Kontrolle & Lineups (mannschaftsübergreifend)
                    </h4>
                    <p className="text-xs text-gray-500">
                      In der Gesamtübersicht und in den Teamansichten siehst du die berechnete Aufstellung (Top 4 Stammspieler + 5. Ersatzspieler basierend auf der 4-Stufen RSVP-Logik und Rangfolge). Als Sportwart hast du das Recht, <strong>die Rückmeldungen (RSVP) von beliebigen Spielern direkt zu bearbeiten</strong>, um Ausfälle mannschaftsübergreifend optimal zu koordinieren. Zudem kannst du in der Team-Matrix per Klick vorgefertigte WhatsApp-Aufstellungsmeldungen oder Spielersuch-Nachrichten inklusive automatischer Parallelspiel-Erkennung kopieren.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      📅 3. 4-Monats-Abwesenheits-Kalender
                    </h4>
                    <p className="text-xs text-gray-500">
                      Zusammen mit den Mannschaftsführern und Admins hast du Zugriff auf den Reiter <strong>"Abwesenheits-Kalender"</strong>. Eine übersichtliche Tages-Matrix visualisiert farblich alle Abwesenheiten der kommenden 4 Monate (jeweils zwei Monate nebeneinander). Ein Klick auf einen Tag zeigt alle Details und Gründe für Abwesenheiten.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'club_admin' && (
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  Als <strong>Vereinsadministrator</strong> verwaltest du die technischen Grundeinstellungen und Berechtigungen der Plattform:
                </p>

                <div className="space-y-3 mt-4">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🛡️ 1. Mannschafts- & Webcal-Verwaltung
                    </h4>
                    <p className="text-xs text-gray-500">
                      Im Reiter <strong>"Admin"</strong> kannst du neue Mannschaften erstellen, Webcal-Links von myTischtennis.de hinterlegen oder anpassen sowie Teams aktiv/inaktiv schalten.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      👥 2. Rollenverteilung & globale Aufstellungskontrolle
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du kannst die Benutzerrollen aller registrierten Vereinsmitglieder ändern (z. B. einen Spieler zum Mannschaftsführer, Sportwart oder Admin ernennen). Zudem besitzt du uneingeschränkte Rechte zur Bearbeitung aller Aufstellungsreihenfolgen und RSVPs.
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-150">
                    <h4 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1">
                      🔄 3. Kalender-Synchronisation & Berichte
                    </h4>
                    <p className="text-xs text-gray-500">
                      Du kannst die automatische Spielplan-Synchronisation manuell anstoßen und Berichte/Logs über die letzten Import-Prozesse einsehen (wie viele Spiele importiert wurden, Fehler etc.).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
