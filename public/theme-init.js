/*
  Darstellung (Aufgabe 9.11) setzen, bevor irgendetwas gezeichnet wird. Als React-Effekt
  erledigt wäre die Seite für einen Wimpernschlag hell, bevor sie dunkel wird — und genau
  das blendet nachts.

  Eigene Datei statt Inline-Skript: Die Content-Security-Policy in index.html erlaubt
  nur Skripte vom eigenen Ursprung. Ein Inline-Skript bräuchte dort eine Ausnahme, die
  auch jedes eingeschleuste Skript durchließe.

  Die Voreinstellung ist `light` und muss mit DEFAULT_THEME in src/lib/theme.ts
  übereinstimmen: Stünde hier etwas anderes, flackerte die Seite beim Start einmal um,
  weil React dann sofort korrigiert.
*/
try {
  var choice = localStorage.getItem('vereinsplaner.theme') || 'light';
  var dark =
    choice === 'dark' ||
    (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
} catch {
  /* Ohne Website-Daten bleibt es hell — kein Grund, den Start abzubrechen. */
}
