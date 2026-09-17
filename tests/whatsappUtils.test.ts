import { describe, it, expect } from 'vitest';
import {
  getFirstName,
  formatShortDayDate,
  formatTime,
  getArrivalTime,
  getDeadlineDayDate,
  getOpponentName,
  generateWhatsAppMessage,
} from '../src/lib/whatsappUtils';

describe('whatsappUtils', () => {
  it('extracts first name correctly', () => {
    expect(getFirstName('Max Mustermann')).toBe('Max');
    expect(getFirstName('Erika')).toBe('Erika');
    expect(getFirstName(' Hans  Peter ')).toBe('Hans');
    expect(getFirstName('')).toBe('');
  });

  it('formats short day date and time correctly', () => {
    const dtstart = '2026-08-15T18:30:00.000Z';
    const shortDate = formatShortDayDate(dtstart);
    expect(shortDate).toMatch(/^(Mo|Di|Mi|Do|Fr|Sa|So) \d{2}\.\d{2}\.$/);

    const timeStr = formatTime(dtstart);
    expect(timeStr).toMatch(/^\d{2}:\d{2}$/);
  });

  it('calculates arrival time correctly', () => {
    const dtstart = '2026-08-15T18:30:00.000Z'; // 18:30 match
    expect(getArrivalTime(dtstart, 60)).toBe('17:30');
    expect(getArrivalTime(dtstart, 30)).toBe('18:00');
  });

  it('calculates 1-week deadline date correctly', () => {
    const dtstart = '2026-08-15T18:30:00.000Z'; // Saturday Aug 15
    const deadlineStr = getDeadlineDayDate(dtstart);
    // 7 days prior: Aug 8
    expect(deadlineStr).toMatch(/08\.08\.$/);
  });

  it('parses opponent name correctly for home and away matches', () => {
    const homeMatch = { summary: 'Heiligenhauser SV vs TTV Gegner Stadt', is_home: true };
    const awayMatch = { summary: 'TTV Gegner Stadt vs Heiligenhauser SV', is_home: false };

    expect(getOpponentName(homeMatch)).toBe('TTV Gegner Stadt');
    expect(getOpponentName(awayMatch)).toBe('TTV Gegner Stadt');
  });

  it('generates Option 1 WhatsApp message when 4 players confirm', () => {
    const match = {
      id: 'm-1',
      summary: 'Heiligenhauser SV vs TTG Rivalen',
      is_home: true,
      dtstart: '2026-09-20T17:00:00.000Z',
      version: 1,
    };

    const matchAvailabilities = [
      { match_id: 'm-1', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-3', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-4', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice Schmidt', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Bob Müller', team_number: 1, position_number: 2 },
      { id: 'p-3', name: 'Charlie Meier', team_number: 1, position_number: 3 },
      { id: 'p-4', name: 'David Schulze', team_number: 1, position_number: 4 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('🏓 Das Heimspiel gegen TTG Rivalen am');
    expect(message).toContain('spielen wir in der Aufstellung Alice, Bob, Charlie, David.');
    expect(message).toContain('Bitte seid bis spätestens 16:00 Uhr in der Halle.');
    expect(message).not.toContain('mit Backup');
  });

  it('handles "yes_sub" response by placing substitute player in Backup slot behind regular "yes" players', () => {
    const match = {
      id: 'm-1',
      summary: 'Heiligenhauser SV vs TTG Rivalen',
      is_home: true,
      dtstart: '2026-09-20T17:00:00.000Z',
      version: 1,
    };

    // p-3 (Charlie) has response 'yes_sub'. So p-1, p-2, p-4, p-5 are regular 'yes'.
    // Alice, Bob, David, Frank will be primary 4, Charlie will be Backup!
    const matchAvailabilities = [
      { match_id: 'm-1', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-3', response: 'yes_sub', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-4', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-5', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice Schmidt', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Bob Müller', team_number: 1, position_number: 2 },
      { id: 'p-3', name: 'Charlie Meier', team_number: 1, position_number: 3 },
      { id: 'p-4', name: 'David Schulze', team_number: 1, position_number: 4 },
      { id: 'p-5', name: 'Frank Franke', team_number: 1, position_number: 5 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('spielen wir in der Aufstellung Alice, Bob, David, Frank mit Backup Charlie.');
  });

  it('generates Option 1 WhatsApp message with 5th player as Backup', () => {
    const match = {
      id: 'm-1',
      summary: 'Heiligenhauser SV vs TTG Rivalen',
      is_home: true,
      dtstart: '2026-09-20T17:00:00.000Z',
      version: 1,
    };

    const matchAvailabilities = [
      { match_id: 'm-1', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-3', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-4', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-5', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Taras A', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'David B', team_number: 1, position_number: 2 },
      { id: 'p-3', name: 'Daniel C', team_number: 1, position_number: 3 },
      { id: 'p-4', name: 'Jan D', team_number: 1, position_number: 4 },
      { id: 'p-5', name: 'Frank E', team_number: 1, position_number: 5 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('spielen wir in der Aufstellung Taras, David, Daniel, Jan mit Backup Frank.');
  });

  it('generates Option 2 WhatsApp message with singular "fehlt uns noch 1 Spieler" and omits arrival info', () => {
    const match = {
      id: 'm-2',
      summary: 'Post SV vs Heiligenhauser SV',
      is_home: false,
      dtstart: '2026-10-10T14:00:00.000Z',
      version: 1,
    };

    const matchAvailabilities = [
      { match_id: 'm-2', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-2', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-2', player_id: 'p-3', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice Schmidt', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Bob Müller', team_number: 1, position_number: 2 },
      { id: 'p-3', name: 'Charlie Meier', team_number: 1, position_number: 3 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('⚠️ WICHTIG: Für das Auswärtsspiel gegen Post SV am');
    expect(message).toContain('fehlt uns noch 1 Spieler! Bisher haben zugesagt: Alice, Bob, Charlie.');
    expect(message).toContain('melden, ansonsten muss ich das Spiel absagen. 🙏');
    expect(message).not.toContain('Bitte seid um');
    expect(message).not.toContain('Bitte seid bis spätestens');
  });

  it('generates Option 2 WhatsApp message with plural "fehlen uns noch 2 Spieler"', () => {
    const match = {
      id: 'm-2',
      summary: 'Post SV vs Heiligenhauser SV',
      is_home: false,
      dtstart: '2026-10-10T14:00:00.000Z',
      version: 1,
    };

    const matchAvailabilities = [
      { match_id: 'm-2', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-2', player_id: 'p-2', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice Schmidt', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Bob Müller', team_number: 1, position_number: 2 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('fehlen uns noch 2 Spieler! Bisher haben zugesagt: Alice, Bob.');
  });

  it('appends concurrent home match sentence for both Option 1 and Option 2', () => {
    const match1 = {
      id: 'm-1',
      team_id: 't-2',
      summary: 'Heiligenhauser SV II vs opponent A',
      is_home: true,
      dtstart: '2026-11-14T18:00:00.000Z', // Evening match (18:00 UTC / 19:00 local)
      version: 1,
      active: true,
    };

    const match2 = {
      id: 'm-2',
      team_id: 't-1',
      summary: 'Heiligenhauser SV I vs opponent B',
      is_home: true,
      dtstart: '2026-11-14T18:00:00.000Z',
      version: 1,
      active: true,
    };

    const allTeams = [
      { id: 't-1', name: 'Erwachsene I' },
      { id: 't-2', name: 'Erwachsene II' },
    ];

    const allMatches = [match1, match2];

    const matchAvailabilities = [
      { match_id: 'm-1', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-3', response: 'yes', version_responded: 1 },
      { match_id: 'm-1', player_id: 'p-4', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice', team_number: 2, position_number: 1 },
      { id: 'p-2', name: 'Bob', team_number: 2, position_number: 2 },
      { id: 'p-3', name: 'Charlie', team_number: 2, position_number: 3 },
      { id: 'p-4', name: 'David', team_number: 2, position_number: 4 },
    ];

    // Option 1 (>=4 confirmed)
    const msg1 = generateWhatsAppMessage(match1, matchAvailabilities, allProfiles, [], allMatches, allTeams);
    expect(msg1).toContain('Die erste Mannschaft hat zeitgleich ebenfalls ein Heimspiel. Es wird also bestimmt ein netter Abend.');

    // Option 2 (<4 confirmed)
    const msg2 = generateWhatsAppMessage(match1, matchAvailabilities.slice(0, 2), allProfiles, [], allMatches, allTeams);
    expect(msg2).toContain('Die erste Mannschaft hat zeitgleich ebenfalls ein Heimspiel. Es wird also bestimmt ein netter Abend.');
  });

  it('appends concurrent away match sentence with location name and time of day', () => {
    const match1 = {
      id: 'm-10',
      team_id: 't-2',
      summary: 'VfL Engelskirchen vs Heiligenhauser SV II',
      is_home: false,
      location: 'Turnhalle Engelskirchen, 51766 Engelskirchen',
      dtstart: '2026-11-15T09:00:00.000Z', // Morning match (9:00)
      version: 1,
      active: true,
    };

    const match2 = {
      id: 'm-20',
      team_id: 't-3',
      summary: 'VfL Engelskirchen II vs Heiligenhauser SV III',
      is_home: false,
      location: 'Turnhalle Engelskirchen, 51766 Engelskirchen',
      dtstart: '2026-11-15T09:00:00.000Z',
      version: 1,
      active: true,
    };

    const allTeams = [
      { id: 't-2', name: 'Erwachsene II' },
      { id: 't-3', name: 'Erwachsene III' },
    ];

    const allMatches = [match1, match2];

    const matchAvailabilities = [
      { match_id: 'm-10', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-10', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-10', player_id: 'p-3', response: 'yes', version_responded: 1 },
      { match_id: 'm-10', player_id: 'p-4', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice', team_number: 2, position_number: 1 },
      { id: 'p-2', name: 'Bob', team_number: 2, position_number: 2 },
      { id: 'p-3', name: 'Charlie', team_number: 2, position_number: 3 },
      { id: 'p-4', name: 'David', team_number: 2, position_number: 4 },
    ];

    const msg = generateWhatsAppMessage(match1, matchAvailabilities, allProfiles, [], allMatches, allTeams);
    expect(msg).toContain('Die dritte Mannschaft hat zeitgleich ebenfalls ein Spiel in Engelskirchen. Es wird also bestimmt ein netter Vormittag.');
  });

  it('appends away arrival time and detailed address/location info when provided', () => {
    const match = {
      id: 'm-away',
      summary: 'TTV Rivalen vs Heiligenhauser SV',
      is_home: false,
      location: 'Turnhalle Süd, Schulstraße 12, 51766 Engelskirchen',
      dtstart: '2026-10-10T18:30:00.000Z',
      version: 1,
    };

    const matchAvailabilities = [
      { match_id: 'm-away', player_id: 'p-1', response: 'yes', version_responded: 1 },
      { match_id: 'm-away', player_id: 'p-2', response: 'yes', version_responded: 1 },
      { match_id: 'm-away', player_id: 'p-3', response: 'yes', version_responded: 1 },
      { match_id: 'm-away', player_id: 'p-4', response: 'yes', version_responded: 1 },
    ];

    const allProfiles = [
      { id: 'p-1', name: 'Alice', team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Bob', team_number: 1, position_number: 2 },
      { id: 'p-3', name: 'Charlie', team_number: 1, position_number: 3 },
      { id: 'p-4', name: 'David', team_number: 1, position_number: 4 },
    ];

    const message = generateWhatsAppMessage(match, matchAvailabilities, allProfiles);
    expect(message).toContain('Bitte seid um 18:00 Uhr an Turnhalle Süd, Schulstraße 12, 51766 Engelskirchen.');
  });
});
