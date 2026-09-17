export function getFirstName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return trimmed;
  return trimmed.substring(0, spaceIndex);
}

export function formatShortDayDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }); // e.g. "Sa" or "Sa."
  const cleanDayName = dayName.replace(/\.$/, '');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${cleanDayName} ${day}.${month}.`;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getArrivalTime(dtstartStr: string, minutesBefore: number): string {
  const date = new Date(dtstartStr);
  date.setMinutes(date.getMinutes() - minutesBefore);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getDeadlineDayDate(dtstartStr: string): string {
  const matchDate = new Date(dtstartStr);
  const deadlineDate = new Date(matchDate);
  deadlineDate.setDate(matchDate.getDate() - 7);
  return formatShortDayDate(deadlineDate.toISOString());
}

export function getOpponentName(match: { summary: string; is_home: boolean }): string {
  if (!match || !match.summary) return '';
  if (match.is_home) {
    return (match.summary.split(' vs ')[1] || match.summary).trim();
  } else {
    return (match.summary.split(' vs ')[0] || match.summary).trim();
  }
}

export function getTeamOrdinalPhrase(teamName: string): string {
  if (!teamName) return 'Die andere Mannschaft';
  const t = teamName.trim();
  if (/\b(III|3)\b/i.test(t) || t.endsWith(' III') || t.endsWith(' 3')) {
    return 'Die dritte Mannschaft';
  }
  if (/\b(II|2)\b/i.test(t) || t.endsWith(' II') || t.endsWith(' 2')) {
    return 'Die zweite Mannschaft';
  }
  if (/\b(I|1)\b/i.test(t) || t.endsWith(' I') || t.endsWith(' 1')) {
    return 'Die erste Mannschaft';
  }
  if (/\b(IV|4)\b/i.test(t) || t.endsWith(' IV') || t.endsWith(' 4')) {
    return 'Die vierte Mannschaft';
  }
  if (/\b(V|5)\b/i.test(t) || t.endsWith(' V') || t.endsWith(' 5')) {
    return 'Die fünfte Mannschaft';
  }
  if (/\b(VI|6)\b/i.test(t) || t.endsWith(' VI') || t.endsWith(' 6')) {
    return 'Die sechste Mannschaft';
  }
  return `Die ${teamName}`;
}

export function getTimeOfDayPhrase(dtstartStr: string): string {
  const date = new Date(dtstartStr);
  const hours = date.getHours();
  if (hours < 12) {
    return 'netter Vormittag';
  } else if (hours < 17) {
    return 'netter Nachmittag';
  } else {
    return 'netter Abend';
  }
}

export function getAwayLocationName(match: any): string {
  if (match.location && match.location.trim()) {
    const loc = match.location.trim();
    const zipCityMatch = loc.match(/\d{5}\s+([A-Za-zÄÖÜäöüß\s-]+)/);
    if (zipCityMatch && zipCityMatch[1]) {
      return zipCityMatch[1].trim();
    }
    const parts = loc.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return loc;
  }
  const opponent = getOpponentName(match);
  return opponent || 'Auswärts';
}

export function findConcurrentSameLocationMatch(
  match: any,
  allMatches: any[] = [],
  allTeams: any[] = []
): { otherMatch: any; otherTeam: any } | null {
  if (!match || !allMatches || allMatches.length === 0) return null;

  const matchTime = new Date(match.dtstart).getTime();

  for (const otherMatch of allMatches) {
    if (otherMatch.id === match.id) continue;
    if (otherMatch.team_id === match.team_id) continue;
    if (otherMatch.active === false) continue;

    const otherTime = new Date(otherMatch.dtstart).getTime();
    if (otherTime !== matchTime) continue;

    if (match.is_home !== otherMatch.is_home) continue;

    if (match.is_home) {
      const otherTeam = allTeams.find((t) => t.id === otherMatch.team_id);
      return { otherMatch, otherTeam };
    } else {
      const loc1 = (match.location || '').trim().toLowerCase();
      const loc2 = (otherMatch.location || '').trim().toLowerCase();

      let isSameLocation = false;
      if (loc1 && loc2 && (loc1 === loc2 || loc1.includes(loc2) || loc2.includes(loc1))) {
        isSameLocation = true;
      } else {
        const opp1 = getOpponentName(match).toLowerCase();
        const opp2 = getOpponentName(otherMatch).toLowerCase();
        if (opp1 && opp2) {
          const base1 = opp1.replace(/\s+(i|ii|iii|iv|v|vi|\d+)$/i, '').trim();
          const base2 = opp2.replace(/\s+(i|ii|iii|iv|v|vi|\d+)$/i, '').trim();
          if (base1 === base2 || opp1.includes(base2) || opp2.includes(base1)) {
            isSameLocation = true;
          }
        }
      }

      if (isSameLocation) {
        const otherTeam = allTeams.find((t) => t.id === otherMatch.team_id);
        return { otherMatch, otherTeam };
      }
    }
  }

  return null;
}

export function generateWhatsAppMessage(
  match: any,
  matchAvailabilities: any[],
  allProfiles: any[],
  teamPlayers: any[] = [],
  allMatches: any[] = [],
  allTeams: any[] = []
): string {
  const matchType = match.is_home ? 'Heimspiel' : 'Auswärtsspiel';
  const opponent = getOpponentName(match);
  const dateTimeStr = `${formatShortDayDate(match.dtstart)} um ${formatTime(match.dtstart)} Uhr`;

  // Get active confirmed ("yes" or "yes_sub") availabilities for this match version
  const yesAvails = matchAvailabilities.filter(
    (a) => a.match_id === match.id && (a.response === 'yes' || a.response === 'yes_sub') && a.version_responded === match.version
  );

  // Sort confirmed profiles: regular "yes" players first, followed by "yes_sub" (substitute) players,
  // ordered by official reporting order (team_number asc, position_number asc, name asc)
  const confirmedProfiles = yesAvails
    .map((av) => allProfiles.find((p) => p.id === av.player_id) || av.profiles)
    .filter(Boolean);

  confirmedProfiles.sort((a, b) => {
    const avA = yesAvails.find((av) => av.player_id === a.id);
    const avB = yesAvails.find((av) => av.player_id === b.id);

    const isSubA = avA?.response === 'yes_sub' ? 1 : 0;
    const isSubB = avB?.response === 'yes_sub' ? 1 : 0;

    if (isSubA !== isSubB) {
      return isSubA - isSubB; // 0 (regular yes) comes before 1 (yes_sub)
    }

    const teamNumA = a.team_number ?? 999999;
    const teamNumB = b.team_number ?? 999999;
    if (teamNumA !== teamNumB) return teamNumA - teamNumB;

    const posNumA = a.position_number ?? 999999;
    const posNumB = b.position_number ?? 999999;
    if (posNumA !== posNumB) return posNumA - posNumB;

    return (a.name || '').localeCompare(b.name || '');
  });

  const confirmedFirstNames = confirmedProfiles
    .map((p) => getFirstName(p.name))
    .filter(Boolean);

  // Check for concurrent same-location match of another team
  const concurrentInfo = findConcurrentSameLocationMatch(match, allMatches, allTeams);
  let extraConcurrentSentence = '';
  if (concurrentInfo) {
    const { otherMatch, otherTeam } = concurrentInfo;
    const otherTeamName = otherTeam?.name || '';
    const ordinalPhrase = getTeamOrdinalPhrase(otherTeamName);
    const timeOfDayPhrase = getTimeOfDayPhrase(match.dtstart);

    if (match.is_home) {
      extraConcurrentSentence = ` ${ordinalPhrase} hat zeitgleich ebenfalls ein Heimspiel. Es wird also bestimmt ein ${timeOfDayPhrase}.`;
    } else {
      const awayLoc = getAwayLocationName(match);
      extraConcurrentSentence = ` ${ordinalPhrase} hat zeitgleich ebenfalls ein Spiel in ${awayLoc}. Es wird also bestimmt ein ${timeOfDayPhrase}.`;
    }
  }

  let arrivalInfo = '';
  if (match.is_home) {
    const homeArrivalTime = getArrivalTime(match.dtstart, 60);
    arrivalInfo = ` Bitte seid bis spätestens ${homeArrivalTime} Uhr in der Halle.`;
  } else {
    const awayArrivalTime = getArrivalTime(match.dtstart, 30);
    const location = (match.location && match.location.trim()) ? match.location.trim() : getAwayLocationName(match);
    arrivalInfo = ` Bitte seid um ${awayArrivalTime} Uhr an ${location}.`;
  }

  if (yesAvails.length >= 4) {
    // Option 1: 4 or more yes votes
    const primaryNames = confirmedFirstNames.slice(0, 4).join(', ');
    const backupStr = confirmedFirstNames.length > 4 ? ` mit Backup ${confirmedFirstNames[4]}` : '';
    return `🏓 Das ${matchType} gegen ${opponent} am ${dateTimeStr} spielen wir in der Aufstellung ${primaryNames}${backupStr}.${extraConcurrentSentence}${arrivalInfo}`;
  } else {
    // Option 2: less than 4 yes votes
    const missingCount = 4 - yesAvails.length;
    const missingPhrase = missingCount === 1 ? 'fehlt uns noch 1 Spieler' : `fehlen uns noch ${missingCount} Spieler`;
    const confirmedList = confirmedFirstNames.length > 0 ? confirmedFirstNames.join(', ') : 'keine';
    const deadlineStr = getDeadlineDayDate(match.dtstart);

    return `⚠️ WICHTIG: Für das ${matchType} gegen ${opponent} am ${dateTimeStr} ${missingPhrase}! Bisher haben zugesagt: ${confirmedList}. Bitte bis ${deadlineStr} melden, ansonsten muss ich das Spiel absagen. 🙏${extraConcurrentSentence}`;
  }
}
