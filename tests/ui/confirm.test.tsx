import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from '../../src/components/ui';

function Probe() {
  const confirm = useConfirm();
  const [result, setResult] = useState('offen');
  return (
    <>
      <button
        type="button"
        onClick={async () =>
          setResult(
            String(
              await confirm({
                title: 'Nachricht löschen?',
                description: 'Das lässt sich nicht rückgängig machen.',
                confirmLabel: 'Löschen',
                danger: true,
              }),
            ),
          )
        }
      >
        Fragen
      </button>
      <p>Ergebnis: {result}</p>
    </>
  );
}

function renderProbe() {
  return render(
    <ConfirmProvider>
      <Probe />
    </ConfirmProvider>,
  );
}

describe('useConfirm', () => {
  it('fragt im Dialog der App und liefert die Antwort', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }));

    expect(await screen.findByRole('dialog', { name: 'Nachricht löschen?' })).toBeInTheDocument();
    expect(screen.getByText('Das lässt sich nicht rückgängig machen.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText('Ergebnis: true')).toBeInTheDocument();
  });

  it('wertet „Abbrechen" als Nein', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Abbrechen' }));
    expect(await screen.findByText('Ergebnis: false')).toBeInTheDocument();
  });
});
