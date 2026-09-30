import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm, typedMatches } from '../../src/components/ui';

describe('typedMatches', () => {
  it('vergleicht ohne Groß-/Kleinschreibung und Rand-Leerzeichen', () => {
    expect(typedMatches(' 1. herren ', '1. Herren')).toBe(true);
    expect(typedMatches('LÖSCHEN', 'löschen')).toBe(true);
    expect(typedMatches('1. Herre', '1. Herren')).toBe(false);
  });
});

function Harness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('offen');
  return (
    <>
      <button
        onClick={async () =>
          setResult(
            String(
              await confirm({
                title: 'Das Amt „Kassenwart" löschen?',
                confirmLabel: 'Endgültig löschen',
                danger: true,
                typeToConfirm: 'Kassenwart',
              }),
            ),
          )
        }
      >
        Start
      </button>
      <p>Ergebnis: {result}</p>
    </>
  );
}

describe('useConfirm mit typeToConfirm', () => {
  it('bestätigt erst, wenn der Name abgetippt ist', async () => {
    render(
      <ConfirmProvider>
        <Harness />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    const confirm = await screen.findByRole('button', { name: 'Endgültig löschen' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Zur Bestätigung eingeben'), 'kassenwart{Enter}');
    expect(await screen.findByText('Ergebnis: true')).toBeInTheDocument();
  });

  it('beginnt bei der nächsten Rückfrage wieder leer', async () => {
    render(
      <ConfirmProvider>
        <Harness />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await userEvent.type(await screen.findByLabelText('Zur Bestätigung eingeben'), 'Kassen');
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(await screen.findByText('Ergebnis: false')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByLabelText('Zur Bestätigung eingeben')).toHaveValue('');
  });
});
