import { describe, it, expect } from 'vitest';
import { planSync, type ExistingMatch } from '../../supabase/functions/_shared/syncPlanner';
import type { IcsEvent } from '../../supabase/functions/_shared/ics';

function event(uid: string, start: string, overrides: Partial<IcsEvent> = {}): IcsEvent {
  const dtstart = new Date(start);
  return {
    uid,
    dtstart,
    dtend: new Date(dtstart.getTime() + 3 * 60 * 60 * 1000),
    summary: 'TTC Musterstadt vs TV Beispiel',
    description: 'Spieltag: 1',
    location: 'Sporthalle, Musterstadt',
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingMatch> = {}): ExistingMatch {
  const dtstart = '2026-10-12T16:00:00.000Z';
  return {
    id: 'm1',
    external_uid: 'uid-1',
    dtstart,
    dtend: new Date(new Date(dtstart).getTime() + 3 * 60 * 60 * 1000).toISOString(),
    summary: 'TTC Musterstadt vs TV Beispiel',
    description: 'Spieltag: 1',
    location_text: 'Sporthalle, Musterstadt',
    opponent: 'TV Beispiel',
    is_home: true,
    matchday: 1,
    active: true,
    version: 1,
    dtstart_override: null,
    ...overrides,
  };
}

const resolve = () => ({ isHome: true, opponent: 'TV Beispiel', matchday: 1 });

describe('planSync', () => {
  it('legt ein unbekanntes Spiel an', () => {
    const plan = planSync({
      existing: [],
      events: [event('uid-neu', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.status).toBe('success');
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: 'insert' });
  });

  it('erkennt eine Verlegung und zählt die Version hoch', () => {
    const plan = planSync({
      existing: [existing()],
      events: [event('uid-1', '2026-10-13T17:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toMatchObject({
      kind: 'reschedule',
      id: 'm1',
      newVersion: 2,
      fromDtstart: '2026-10-12T16:00:00.000Z',
    });
  });

  it('aktualisiert geänderte Details, ohne die Version anzufassen', () => {
    const plan = planSync({
      existing: [existing()],
      events: [
        event('uid-1', '2026-10-12T16:00:00.000Z', { location: 'Neue Halle, Musterstadt' }),
      ],
      resolve,
    });

    expect(plan.actions[0]).toMatchObject({ kind: 'update_details', id: 'm1' });
  });

  it('rührt ein unverändertes Spiel nicht an', () => {
    const plan = planSync({
      existing: [existing()],
      events: [event('uid-1', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toEqual({ kind: 'touch', id: 'm1', uid: 'uid-1' });
  });

  it('setzt ein Spiel inaktiv, das aus dem Kalender verschwunden ist', () => {
    const plan = planSync({
      existing: [existing(), existing({ id: 'm2', external_uid: 'uid-2' })],
      events: [event('uid-1', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions).toContainEqual({ kind: 'deactivate', id: 'm2' });
  });

  it('greift bei einem leeren Kalender zur Sicherheitssperre', () => {
    const plan = planSync({ existing: [existing()], events: [], resolve });

    expect(plan.status).toBe('warning');
    expect(plan.actions).toHaveLength(0);
    expect(plan.warning).toContain('Sicherheitssperre');
  });

  it('lässt einen leeren Kalender zu, wenn es auch keine aktiven Spiele gibt', () => {
    const plan = planSync({
      existing: [existing({ active: false })],
      events: [],
      resolve,
    });

    expect(plan.status).toBe('success');
    expect(plan.actions).toHaveLength(0);
  });

  it('räumt eine bestätigte Verlegung auf, sobald click-TT sie übernommen hat', () => {
    const plan = planSync({
      existing: [existing({ dtstart_override: '2026-10-13T17:00:00.000Z' })],
      events: [event('uid-1', '2026-10-13T17:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toEqual({ kind: 'clear_override', id: 'm1', uid: 'uid-1' });
  });

  it('behandelt einen abweichenden Termin trotz Verlegung als neue Verlegung', () => {
    const plan = planSync({
      existing: [existing({ dtstart_override: '2026-10-13T17:00:00.000Z' })],
      events: [event('uid-1', '2026-10-14T18:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toMatchObject({ kind: 'reschedule', newVersion: 2 });
  });

  it('aktiviert ein zuvor abgesagtes Spiel wieder', () => {
    const plan = planSync({
      existing: [existing({ active: false })],
      events: [event('uid-1', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toMatchObject({ kind: 'update_details' });
  });
});

/**
 * Der Fall, der die Liste dreimal dasselbe Spiel zeigen ließ: myTischtennis vergibt die
 * UID bei jedem Export neu. Über die UID allein wäre jeder Abruf ein Neuanfang.
 */
describe('planSync mit wechselnden UIDs', () => {
  it('erkennt dasselbe Spiel trotz neuer UID wieder und legt nichts an', () => {
    const plan = planSync({
      existing: [existing()],
      events: [event('uid-beim-zweiten-export-anders', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toEqual({
      kind: 'touch',
      id: 'm1',
      uid: 'uid-beim-zweiten-export-anders',
    });
  });

  it('erkennt trotz neuer UID auch eine Verlegung als Verlegung', () => {
    const plan = planSync({
      existing: [existing()],
      events: [event('andere-uid', '2026-10-13T17:00:00.000Z')],
      resolve,
    });

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: 'reschedule', id: 'm1', newVersion: 2 });
  });

  it('unterscheidet Hin- und Rückspiel gegen denselben Gegner', () => {
    const heim = existing({ id: 'heim', external_uid: 'alt-heim', is_home: true });
    const auswaerts = existing({ id: 'aus', external_uid: 'alt-aus', is_home: false });

    const plan = planSync({
      existing: [heim, auswaerts],
      events: [event('neu-aus', '2026-10-12T16:00:00.000Z')],
      resolve: () => ({ isHome: false, opponent: 'TV Beispiel', matchday: 1 }),
    });

    expect(plan.actions).toContainEqual({ kind: 'touch', id: 'aus', uid: 'neu-aus' });
    expect(plan.actions).toContainEqual({ kind: 'deactivate', id: 'heim' });
  });

  it('greift im Scherbenhaufen eines Fehlimports das aktive Spiel', () => {
    // Genau Jans Ausgangslage: ein aktives Spiel und zwei Leichen aus früheren Läufen.
    const plan = planSync({
      existing: [
        existing({ id: 'tot-1', external_uid: 'uid-1', active: false }),
        existing({ id: 'tot-2', external_uid: 'uid-2', active: false }),
        existing({ id: 'lebt', external_uid: 'uid-3', active: true }),
      ],
      events: [event('uid-4', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions).toEqual([{ kind: 'touch', id: 'lebt', uid: 'uid-4' }]);
  });

  it('legt lieber neu an, als bei mehreren aktiven Kandidaten zu raten', () => {
    const plan = planSync({
      existing: [
        existing({ id: 'a', external_uid: 'uid-a' }),
        existing({ id: 'b', external_uid: 'uid-b' }),
      ],
      events: [event('voellig-neue-uid', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions[0]).toMatchObject({ kind: 'insert' });
    expect(plan.actions).toContainEqual({ kind: 'deactivate', id: 'a' });
    expect(plan.actions).toContainEqual({ kind: 'deactivate', id: 'b' });
  });

  it('verteilt zwei Feed-Termine nicht auf dieselbe Zeile', () => {
    const plan = planSync({
      existing: [existing()],
      events: [
        event('neu-1', '2026-10-12T16:00:00.000Z'),
        event('neu-2', '2026-11-12T16:00:00.000Z'),
      ],
      resolve,
    });

    const betroffen = plan.actions.filter(
      (action) => 'id' in action && action.id === 'm1',
    );
    expect(betroffen).toHaveLength(1);
    expect(plan.actions.filter((action) => action.kind === 'insert')).toHaveLength(1);
  });

  it('bevorzugt den UID-Treffer vor dem Zweitschlüssel', () => {
    const plan = planSync({
      existing: [
        existing({ id: 'm1', external_uid: 'uid-1' }),
        existing({ id: 'm2', external_uid: 'uid-2', active: false }),
      ],
      events: [event('uid-1', '2026-10-12T16:00:00.000Z')],
      resolve,
    });

    expect(plan.actions).toEqual([{ kind: 'touch', id: 'm1', uid: 'uid-1' }]);
  });
});
