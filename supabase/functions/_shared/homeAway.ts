/**
 * Heim- oder Auswärtsspiel aus dem ICS-Titel bestimmen.
 *
 * myTischtennis schreibt den Titel als „Heimmannschaft vs Gastmannschaft". Ob wir die
 * Heimmannschaft sind, entscheidet sich daran, ob unser Verein auf der linken Seite steht.
 *
 * Der eigene Verein kommt als Liste von Namensbestandteilen herein (club_aliases aus den
 * Vereinseinstellungen). Im Basisprojekt stand der Vereinsname hier fest im Code — genau
 * das macht die Funktion für jeden anderen Verein unbrauchbar.
 */

export interface HomeAwayInfo {
  isHome: boolean;
  opponent: string;
}

export function determineHomeAway(
  summary: string,
  teamName: string,
  clubAliases: string[] = [],
): HomeAwayInfo {
  const normalized = summary.replace(/\s+vs\.?\s+/gi, ' vs ');
  const parts = normalized.split(' vs ');

  if (parts.length !== 2) {
    // Kein erkennbarer Titel: als Heimspiel behandeln und den ganzen Titel als Gegner
    // führen. Lieber ein sichtbar merkwürdiger Eintrag als ein stiller Fehler.
    return { isHome: true, opponent: summary };
  }

  const home = parts[0].trim();
  const away = parts[1].trim();

  const isOurs = (candidate: string): boolean => {
    const lower = candidate.toLowerCase();

    if (clubAliases.some((alias) => alias && lower.includes(alias.toLowerCase()))) {
      return true;
    }

    const team = teamName.toLowerCase();
    return Boolean(team) && (lower.includes(team) || team.includes(lower));
  };

  const homeIsOurs = isOurs(home);
  const awayIsOurs = isOurs(away);

  if (homeIsOurs && !awayIsOurs) return { isHome: true, opponent: away };
  if (awayIsOurs && !homeIsOurs) return { isHome: false, opponent: home };

  // Beide oder keine Seite erkannt: Heimspiel annehmen. Das entspricht dem Verhalten des
  // Basisprojekts; der Mannschaftsführer kann es am Termin korrigieren.
  return { isHome: true, opponent: away };
}
