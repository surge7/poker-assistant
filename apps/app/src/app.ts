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
      <div class="header-title-row">
        <button type="button" class="title-help-trigger" aria-label="Инструкция">?</button>
        <h1>Покерный тренажер СР</h1>
        <div class="title-help-popover" id="title-help-popover" role="tooltip" hidden>
          <p>Тренажёр для расчёта эквити, аутов и советов в Texas Hold'em. Укажите карты в руке и на борде, позицию, банк и сумму колла — совет и вероятности обновляются автоматически.</p>
        </div>
      </div>
    </header>

    <main class="main">
      <section class="section">
        <h2>Карты в руке</h2>
        <div id="hole-cards" class="hole-cards-col"></div>
      </section>

      <section class="section section-board">
        <div class="board-inner">
          <h2 class="board-title">Борд</h2>
          <div class="board-main">
            <div class="board-labels">
              <div class="board-stage board-stage-flop"><span class="board-stage-name">Флоп</span></div>
              <div class="board-stage board-stage-turn"><span class="board-stage-name">Терн</span></div>
              <div class="board-stage board-stage-river"><span class="board-stage-name">Ривер</span></div>
            </div>
            <div class="board-brackets">
              <div class="board-stage board-stage-flop">
                <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 14 Q 50 0 100 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              </div>
              <div class="board-stage board-stage-turn">
                <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 14 Q 50 0 100 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              </div>
              <div class="board-stage board-stage-river">
                <svg class="board-bracket" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 14 Q 50 0 100 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              </div>
            </div>
            <div id="board-cards" class="board-cards-row"></div>
          </div>
        </div>
      </section>

      <section class="section options">
        <div class="option-position">
          <label class="position-label-row">
            <span>Позиция</span>
            <button type="button" class="position-help-trigger" aria-label="Подсказка по позициям">?</button>
            <select id="position">
              ${[0, 1, 2, 3, 4, 5].map((i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${i} ${POSITION_NAMES[i] ?? `Поз. ${i}`}</option>`).join('')}
            </select>
          </label>
          <div class="position-help-popover" id="position-help-popover" role="tooltip" hidden>
            <p><strong>0 BTN</strong> — баттон (дилер). <strong>1 SB</strong> — малый блайнд. <strong>2 BB</strong> — большой блайнд. <strong>3 UTG</strong> — под пистолетом (первый после блайндов). <strong>4 MP</strong> — средняя позиция. <strong>5 CO</strong> — катофф (предбаттон).</p>
            <p>Если игроков больше 6 — выберите ту позицию из списка, которая по смыслу совпадает с вашей (кто когда ходит). Например, при 9 игроках тот, кто ходит первым после блайндов, отмечает UTG.</p>
          </div>
        </div>
        <label>
          Игроков за столом
          <input type="number" id="num-players" min="2" max="10" value="2" />
        </label>
        <label>
          Банк
          <div class="input-with-step">
            <input type="number" id="pot-size" min="0" value="0" />
            <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
            <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
          </div>
        </label>
        <label>
          Сумма колла
          <div class="input-with-step">
            <input type="number" id="to-call" min="0" value="0" />
            <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
            <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
          </div>
        </label>
      </section>

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

  const positionHelpTrigger = document.querySelector('.position-help-trigger') as HTMLButtonElement;
  const positionHelpPopover = document.getElementById('position-help-popover')!;
  if (positionHelpTrigger && positionHelpPopover) {
    positionHelpTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = positionHelpPopover.hidden;
      positionHelpPopover.hidden = !isHidden;
    });
    document.addEventListener('click', (e) => {
      if (!positionHelpPopover.hidden && !positionHelpPopover.contains(e.target as Node) && e.target !== positionHelpTrigger) {
        positionHelpPopover.hidden = true;
      }
    });
  }

  const titleHelpTrigger = document.querySelector('.title-help-trigger') as HTMLButtonElement;
  const titleHelpPopover = document.getElementById('title-help-popover')!;
  if (titleHelpTrigger && titleHelpPopover) {
    titleHelpTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = titleHelpPopover.hidden;
      titleHelpPopover.hidden = !isHidden;
    });
    document.addEventListener('click', (e) => {
      if (!titleHelpPopover.hidden && !titleHelpPopover.contains(e.target as Node) && e.target !== titleHelpTrigger) {
        titleHelpPopover.hidden = true;
      }
    });
  }

  document.querySelectorAll('.step-up').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = (btn as HTMLElement).closest('.input-with-step');
      const input = wrap?.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) {
        const v = (parseInt(input.value, 10) || 0) + 5;
        input.value = String(v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
  document.querySelectorAll('.step-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = (btn as HTMLElement).closest('.input-with-step');
      const input = wrap?.querySelector('input[type="number"]') as HTMLInputElement;
      if (input) {
        const v = Math.max(0, (parseInt(input.value, 10) || 0) - 5);
        input.value = String(v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

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

  function attachAutoUpdate(): void {
    const selectors: string[] = [];
    for (let i = 0; i < 2; i++) selectors.push(`#hole-rank-${i}`, `#hole-suit-${i}`);
    for (let i = 0; i < 5; i++) selectors.push(`#board-rank-${i}`, `#board-suit-${i}`);
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) el.addEventListener('change', updateResults);
    }
    const opts = ['#position', '#num-players', '#pot-size', '#to-call'];
    for (const sel of opts) {
      const el = document.querySelector(sel);
      if (el) {
        el.addEventListener('change', updateResults);
        el.addEventListener('input', updateResults);
      }
    }
  }

  attachAutoUpdate();
  updateResults();
}
