import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import GuideView from '../src/components/GuideView';

describe('GuideView Component', () => {
  test('renders default instructions for player role', () => {
    render(<GuideView role="player" />);

    // Check heading
    expect(screen.getByText('📖 Handbuch & Bedienungsanleitung')).toBeDefined();

    // Check general instructions (Passwort-Gate & Bypass-Link are hidden for players)
    expect(screen.getByText('Anmeldung & Sicherheit')).toBeDefined();
    expect(screen.queryByText('Passwort-Gate')).toBeNull();
    expect(screen.queryByText('?pw=DeinPasswort')).toBeNull();

    // Check default active role (player) info
    expect(screen.getByText('Funktionen für Spieler')).toBeDefined();
    expect(screen.getByText(/1\. Spielbereitschaft zurückmelden/)).toBeDefined();
    expect(screen.getByText(/3\. Abwesenheiten eintragen/)).toBeDefined();
  });

  test('switching roles displays different instructions and warnings', () => {
    render(<GuideView role="player" />);

    // Active warning should not be there initially since active role matches selected role
    expect(screen.queryByText(/Du betrachtest die Anleitung für die Rolle/)).toBeNull();

    // Switch to Admin role
    const adminTabButton = screen.getByRole('button', { name: /Admin/ });
    fireEvent.click(adminTabButton);

    // Now switching warning should be visible
    expect(screen.getByText(/Du betrachtest die Anleitung für die Rolle/)).toBeDefined();
    expect(screen.getByText('Funktionen für Admin')).toBeDefined();
    expect(screen.queryByText(/Kader verwalten/)).toBeNull(); // that's team_manager
    expect(screen.getByText(/2\. Rollenverteilung/)).toBeDefined();
  });

  test('renders team_manager role correctly by default', () => {
    render(<GuideView role="team_manager" />);

    expect(screen.getByText('Funktionen für Mannschaftsführer')).toBeDefined();
    expect(screen.getByText(/2\. Spieler & Ersatzspieler zu Spielen hinzufügen/)).toBeDefined();
  });

  test('renders sportwart role correctly by default', () => {
    render(<GuideView role="sportwart" />);

    expect(screen.getByText('Funktionen für Sportwart')).toBeDefined();
    expect(screen.getByText(/2\. Aufstellungs-Kontrolle & Lineups/)).toBeDefined();
  });

  test('renders club_admin role correctly by default', () => {
    render(<GuideView role="club_admin" />);

    expect(screen.getByText('Funktionen für Admin')).toBeDefined();
    expect(screen.getByText(/1\. Mannschafts- & Webcal-Verwaltung/)).toBeDefined();
  });
});
