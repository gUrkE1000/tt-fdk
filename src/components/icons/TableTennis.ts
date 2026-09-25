import { createLucideIcon } from 'lucide-react';

/**
 * Tischtennisschläger mit Ball — für „Meine Spiele" und „Trainings". Die Bibliothek hat
 * keinen; als Lucide-Symbol gebaut, damit Größe, Strichstärke und Farbe wie bei allen
 * anderen Symbolen wirken und es überall passt, wo ein `LucideIcon` erwartet wird.
 *
 * Senkrecht mit kurzem, breitem Griff: Schräg gestellt mit schmalem Griff sah es auf
 * 24 Pixeln aus wie eine Lupe.
 */
const TableTennis = createLucideIcon('TableTennis', [
  // Schlägerblatt
  ['circle', { cx: '14', cy: '9', r: '7', key: 'blatt' }],
  // Griff
  ['path', { d: 'M12 15.7V20a2 2 0 0 0 4 0v-4.3', key: 'griff' }],
  // Ball
  ['circle', { cx: '4.5', cy: '18.5', r: '2', key: 'ball' }],
]);

export default TableTennis;
