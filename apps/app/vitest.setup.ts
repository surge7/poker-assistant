import { Window } from 'happy-dom';

// Node ≥ 25 объявляет localStorage экспериментальным геттером: без флага
// --localstorage-file он возвращает undefined, а vitest 2.x из-за этого не
// подменяет его реализацией happy-dom (getWindowKeys пропускает ключи, уже
// занятые в глобале Node). Всегда ставим собственное хранилище из happy-dom:
// delete не вызывает нативный геттер, поэтому предупреждение Node не печатается,
// а тесты ведут себя одинаково на любой версии Node (в CI — Node 22, локально — 26).
const g = globalThis as unknown as { localStorage?: Storage };
delete g.localStorage;
g.localStorage = new Window().localStorage;
