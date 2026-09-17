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

    expect(plan.actions[0]).toMatchObject({ kind: 'touch', id: 'm1' });
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

    expect(plan.actions[0]).toEqual({ kind: 'clear_override', id: 'm1' });
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
