import {
  evaluatePlayerHand,
  countOuts,
  totalOuts,
  equityPercentRange,
  compareToNuts,
  getAdvice,
  POSITION_NAMES,
  type Card,
} from '@poker/core';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** Подписи для старших карт в выпадающем списке */
const RANK_LABELS: Record<string, string> = {
  T: '10',
  J: 'J (валет)',
  Q: 'Q (дама)',
  K: 'K (король)',
  A: 'A (туз)',
};

/** Unicode Playing Cards: код символа карты (🂡…🃏) */
function cardToUnicode(card: Card): string {
  const rankChar = card[0];
  const suitChar = card[1];
  const rankNum = rankChar === 'A' ? 1 : rankChar === 'T' ? 10 : rankChar === 'J' ? 11 : rankChar === 'Q' ? 12 : rankChar === 'K' ? 13 : parseInt(rankChar, 10);
  const suitOffset = suitChar === 's' ? 0 : suitChar === 'h' ? 16 : suitChar === 'd' ? 32 : 48;
  const code = 0x1f0a0 + suitOffset + rankNum;
  return String.fromCodePoint(code);
}

/** Карта как HTML: символ карты (картинка) + текст с цветной мастью */
function cardToHtml(card: Card): string {
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1];
  const symbol = SUIT_SYMBOLS[suit] ?? suit;
  const suitClass = `suit suit-${suit}`;
  const cardChar = cardToUnicode(card);
  return `<span class="card-display" title="${rank}${symbol}"><span class="card-char" aria-hidden="true">${cardChar}</span><span class="card-text">${rank}<span class="${suitClass}">${symbol}</span></span></span>`;
}

function getPhase(boardLength: number): 'preflop' | 'flop' | 'turn' | 'river' {
  if (boardLength === 0) return 'preflop';
  if (boardLength === 3) return 'flop';
  if (boardLength === 4) return 'turn';
  return 'river';
}

function renderCardOption(value: string, label: string): string {
  return `<option value="${value}">${label}</option>`;
}

function buildCardSelects(container: HTMLElement, count: number, idPrefix: string, labels?: string[]): void {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'card-select';
    const rank = document.createElement('select');
    rank.id = `${idPrefix}-rank-${i}`;
    rank.innerHTML = '<option value="">—</option>' + RANKS.map((r) => renderCardOption(r, RANK_LABELS[r] ?? r)).join('');
    const suit = document.createElement('select');
    suit.id = `${idPrefix}-suit-${i}`;
    suit.innerHTML =
      '<option value="">—</option>' +
      SUITS.map((s) => renderCardOption(s, SUIT_SYMBOLS[s])).join('');
    suit.addEventListener('change', () => {
      suit.classList.remove('suit-red', 'suit-black');
      if (suit.value === 'h' || suit.value === 'd') suit.classList.add('suit-red');
      else if (suit.value === 's' || suit.value === 'c') suit.classList.add('suit-black');
    });
    wrap.append(rank, suit);
    if (labels?.[i]) {
      const item = document.createElement('div');
      item.className = 'hole-card-item';
      const label = document.createElement('span');
      label.className = 'hole-card-label';
      label.textContent = labels[i];
      item.append(label, wrap);
      container.append(item);
    } else {
      container.append(wrap);
    }
  }
}

/** Борд: 5 карт в ряд, каждая в обёртке «карта» */
function buildBoardCardSelects(container: HTMLElement): void {
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const cardWrap = document.createElement('div');
    cardWrap.className = 'board-card';
    const rank = document.createElement('select');
    rank.id = `board-rank-${i}`;
    rank.innerHTML = '<option value="">—</option>' + RANKS.map((r) => renderCardOption(r, RANK_LABELS[r] ?? r)).join('');
    const suit = document.createElement('select');
    suit.id = `board-suit-${i}`;
    suit.innerHTML =
      '<option value="">—</option>' +
      SUITS.map((s) => renderCardOption(s, SUIT_SYMBOLS[s])).join('');
    function setSuitColor(el: HTMLSelectElement) {
      el.classList.remove('suit-red', 'suit-black');
      cardWrap.classList.remove('board-card--red-suit', 'board-card--black-suit');
      if (el.value === 'h' || el.value === 'd') {
        el.classList.add('suit-red');
        cardWrap.classList.add('board-card--red-suit');
      } else if (el.value === 's' || el.value === 'c') {
        el.classList.add('suit-black');
        cardWrap.classList.add('board-card--black-suit');
      }
    }
    suit.addEventListener('change', () => setSuitColor(suit));
    setSuitColor(suit);
    cardWrap.append(rank, suit);
    container.append(cardWrap);
  }
}

function readCardSelects(container: HTMLElement, idPrefix: string): Card[] {
  const cards: Card[] = [];
  let i = 0;
  while (true) {
    const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
    const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
    if (!rankEl || !suitEl) break;
    const r = rankEl.value;
    const s = suitEl.value;
    if (r && s) cards.push((r + s) as Card);
    i++;
  }
  return cards;
}

/** Индексы слотов: 0–1 рука, 2–6 борд. Возвращает карту в слоте или null. */
function getSlotCard(slotIndex: number): Card | null {
  const idPrefix = slotIndex < 2 ? 'hole' : 'board';
  const i = slotIndex < 2 ? slotIndex : slotIndex - 2;
  const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
  if (!rankEl || !suitEl) return null;
  const r = rankEl.value;
  const s = suitEl.value;
  return r && s ? ((r + s) as Card) : null;
}

/** Очистить слот (сбросить ранг и масть). */
function clearSlot(slotIndex: number): void {
  const idPrefix = slotIndex < 2 ? 'hole' : 'board';
  const i = slotIndex < 2 ? slotIndex : slotIndex - 2;
  const rankEl = document.getElementById(`${idPrefix}-rank-${i}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${i}`) as HTMLSelectElement | null;
  if (rankEl) rankEl.value = '';
  if (suitEl) {
    suitEl.value = '';
    suitEl.classList.remove('suit-red', 'suit-black');
    if (slotIndex >= 2) {
      const cardWrap = suitEl.closest('.board-card');
      if (cardWrap) cardWrap.classList.remove('board-card--red-suit', 'board-card--black-suit');
    }
  }
}

/** Убрать дубликаты: если одна и та же карта выбрана в нескольких слотах, оставить только в первом по порядку. */
function removeDuplicateCards(): void {
  const slots: (Card | null)[] = [];
  for (let idx = 0; idx < 7; idx++) slots.push(getSlotCard(idx));
  for (let i = 0; i < 7; i++) {
    if (!slots[i]) continue;
    for (let j = i + 1; j < 7; j++) {
      if (slots[j] === slots[i]) {
        clearSlot(j);
        slots[j] = null;
      }
    }
  }
}

/** Подключить ко всем селектам карт проверку на дубликаты. */
function attachDuplicateCheck(): void {
  const selectors: string[] = [];
  for (let i = 0; i < 2; i++) selectors.push(`#hole-rank-${i}`, `#hole-suit-${i}`);
  for (let i = 0; i < 5; i++) selectors.push(`#board-rank-${i}`, `#board-suit-${i}`);
  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLSelectElement | null;
    if (el) el.addEventListener('change', removeDuplicateCards);
  }
}

export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <header class="header">
      <h1>Sergey Romakhin's Poker Trainer</h1>
      <p class="subtitle">Texas Hold'em · офлайн</p>
    </header>

    <main class="main">
      <section class="section">
        <h2>Карты в руке</h2>
        <div id="hole-cards" class="hole-cards-col"></div>
      </section>

      <section class="section section-board">
        <h2>Борд</h2>
        <div class="board-wrapper">
          <div id="board-cards" class="board-cards-row"></div>
          <div class="board-labels">
            <div class="board-stage board-stage-flop">
              <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 2 Q 50 16 100 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              <span class="board-stage-name">Флоп</span>
            </div>
            <div class="board-stage board-stage-turn">
              <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 2 Q 50 16 100 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              <span class="board-stage-name">Терн</span>
            </div>
            <div class="board-stage board-stage-river">
              <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 2 Q 50 16 100 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              <span class="board-stage-name">Ривер</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section options">
        <div class="option-position">
          <label>
            Позиция
            <select id="position">
              ${[0, 1, 2, 3, 4, 5].map((i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${i} ${POSITION_NAMES[i] ?? `Поз. ${i}`}</option>`).join('')}
            </select>
          </label>
          <p class="position-legend">BTN — баттон, SB — малый блайнд, BB — большой блайнд, UTG — под пистолетом, MP — средняя позиция, CO — катофф</p>
        </div>
        <label>
          Игроков за столом
          <input type="number" id="num-players" min="2" max="10" value="2" />
        </label>
        <label>
          Банк
          <input type="number" id="pot-size" min="0" value="0" />
        </label>
        <label>
          Сумма колла
          <input type="number" id="to-call" min="0" value="0" />
        </label>
      </section>

      <button type="button" id="btn-calc" class="btn">Рассчитать</button>

      <section class="section results" id="results">
        <div id="results-content"></div>
      </section>
    </main>
  `;

  const holeContainer = document.getElementById('hole-cards')!;
  const boardContainer = document.getElementById('board-cards')!;
  buildCardSelects(holeContainer, 2, 'hole', ['Первая карта', 'Вторая карта']);
  buildBoardCardSelects(boardContainer);
  attachDuplicateCheck();

  const btnCalc = document.getElementById('btn-calc')!;
  const resultsContent = document.getElementById('results-content')!;

  function updateResults(): void {
    const holeCards = readCardSelects(holeContainer, 'hole');
    const boardCards = readCardSelects(boardContainer, 'board');
    const positionIndex = Math.min(5, Math.max(0, parseInt((document.getElementById('position') as HTMLSelectElement).value, 10) || 0));
    const numPlayers = Math.min(10, Math.max(2, parseInt((document.getElementById('num-players') as HTMLInputElement).value, 10) || 2));
    const potSize = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
    const toCall = parseInt((document.getElementById('to-call') as HTMLInputElement).value, 10) || 0;

    if (holeCards.length !== 2) {
      resultsContent.innerHTML = '<p class="message">Выберите ровно 2 карты в руке.</p>';
      return;
    }

    const allCards = [...holeCards, ...boardCards];
    if (new Set(allCards).size !== allCards.length) {
      resultsContent.innerHTML = '<p class="message">Одна и та же карта не может быть в руке и на борде дважды. Выберите разные карты.</p>';
      return;
    }

    const phase = getPhase(boardCards.length);
    const board = boardCards;

    const strength = evaluatePlayerHand(holeCards, board);
    const outsList = board.length >= 3 ? countOuts(holeCards, board) : [];
    const { total: totalOutsCount, improveChance } = board.length >= 3 ? totalOuts(holeCards, board) : { total: 0, improveChance: 0 };
    const iterationsAllIn = board.length === 0 ? 800 : 500;
    const eqRange = equityPercentRange(holeCards, board, numPlayers - 1, iterationsAllIn);
    const nutsInfo = board.length === 5 ? compareToNuts(holeCards, board) : null;
    const phaseLabel = phase === 'preflop' ? 'Префлоп' : phase === 'flop' ? 'Флоп' : phase === 'turn' ? 'Терн' : 'Ривер';
    const advice = getAdvice({
      phase,
      board,
      holeCards,
      potSize,
      toCall,
      numPlayers,
      positionIndex,
    });

    const handLabel =
      board.length < 3
        ? board.length === 0
          ? 'Для расчёта руки добавьте на борд 3 карты (флоп).'
          : `Для полной оценки добавьте на борд ещё ${3 - board.length} карт${3 - board.length === 1 ? 'у' : 'ы'} (флоп = 3 карты).`
        : strength.name;

    const adviceActionClass = advice.action === 'fold' ? 'advice-action advice-action--fold' : 'advice-action';
    let html = `
      <div class="result-block advice">
        <h3>Совет</h3>
        <p class="${adviceActionClass}">${advice.action.toUpperCase()}</p>
        <p class="advice-reason">${advice.reason}</p>
      </div>
    `;

    const allinValueClass = eqRange.percent < 50 ? 'allin-value allin-value--low' : 'allin-value';
    html += `
        <div class="result-block result-block-allin">
          <h3>Вероятность для All-in</h3>
          <p class="${allinValueClass}">${eqRange.low}% – ${eqRange.high}%</p>
          <p class="allin-desc">${phaseLabel}. Вероятность выигрыша, если поставить всё (против ${numPlayers - 1} оппонентов). Оценка ~${eqRange.percent}%, диапазон — 95% доверительный интервал.</p>
        </div>
      `;

    html += `
      <div class="result-block">
        <h3>Рука</h3>
        <p class="hand-name">${handLabel}</p>
        <p class="hand-cards">${strength.cards.map(cardToHtml).join(' ')}</p>
      </div>
    `;

    if (board.length >= 3) {
      html += `
        <div class="result-block">
          <h3>Ауты</h3>
          ${outsList.length ? outsList.map((o) => {
            const cardsHtml = o.outCards?.length ? `<div class="outs-cards">${o.outCards.map((c) => cardToHtml(c)).join('')}</div><span class="outs-value">${o.outs} аутов</span>` : '';
            return `<div class="outs-item"><p>${o.description} → шанс улучшения ${(o.improveChance * 100).toFixed(1)}%</p>${cardsHtml}</div>`;
          }).join('') : '<p>Нет явных дро.</p>'}
          ${totalOutsCount > 0 ? `<p><strong>Всего аутов:</strong> ${totalOutsCount}</p>` : ''}
        </div>
        <div class="result-block">
          <h3>Эквити</h3>
          <p>${eqRange.low}% – ${eqRange.high}% (против ${numPlayers - 1} оппонентов)</p>
        </div>
      `;
    }

    if (nutsInfo) {
      html += `
        <div class="result-block">
          <h3>Натс</h3>
          <p>${nutsInfo.description}</p>
          ${nutsInfo.isNuts ? '<p class="nuts-badge">У вас натс</p>' : ''}
        </div>
      `;
    }

    resultsContent.innerHTML = html;
  }

  btnCalc.addEventListener('click', updateResults);
  updateResults();
}
