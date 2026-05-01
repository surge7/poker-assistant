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

/** Порядок для сетки карт: как на колоде — масти c, s, h, d; ранги A, 2…K */
const SUITS_GRID = ['c', 's', 'h', 'd'] as const;
const RANKS_GRID = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'] as const;

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

/** Карта как текст для триггера: ранг + символ масти */
function cardToTriggerText(card: Card | null): string {
  if (!card) return '—';
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = SUIT_SYMBOLS[card[1]] ?? card[1];
  return `${rank}${suit}`;
}

/** Обновить отображение триггера пикера по значениям в select */
function updatePickerDisplay(idPrefix: string, slotIndex: number): void {
  const rankEl = document.getElementById(`${idPrefix}-rank-${slotIndex}`) as HTMLSelectElement | null;
  const suitEl = document.getElementById(`${idPrefix}-suit-${slotIndex}`) as HTMLSelectElement | null;
  const trigger = document.getElementById(`${idPrefix}-trigger-${slotIndex}`);
  if (!rankEl || !suitEl || !trigger) return;
  const r = rankEl.value;
  const s = suitEl.value;
  const card = r && s ? ((r + s) as Card) : null;
  trigger.textContent = cardToTriggerText(card);
  trigger.classList.toggle('card-picker-trigger--empty', !card);
  const wrap = suitEl.closest('.card-picker-wrap');
  if (idPrefix === 'board' && wrap) {
    wrap.classList.remove('board-card--red-suit', 'board-card--black-suit');
    if (suitEl.value === 'h' || suitEl.value === 'd') wrap.classList.add('board-card--red-suit');
    else if (suitEl.value === 's' || suitEl.value === 'c') wrap.classList.add('board-card--black-suit');
  }
  if (idPrefix === 'hole' && wrap) {
    wrap.classList.toggle('card-picker-wrap--red-suit', suitEl.value === 'h' || suitEl.value === 'd');
  }
}

/** Карты, выбранные во всех слотах кроме указанного (для отключения в сетке) */
function getSelectedCardsExcept(skipSlotIndex: number): Set<string> {
  const set = new Set<string>();
  for (let idx = 0; idx < 7; idx++) {
    if (idx === skipSlotIndex) continue;
    const card = getSlotCard(idx);
    if (card) set.add(card);
  }
  return set;
}

/** Один слот выбора карты: скрытые select + триггер + попап с сеткой карт */
function buildCardPickerSlot(
  container: HTMLElement,
  slotIndex: number,
  idPrefix: string,
  isBoard: boolean,
  label?: string
): void {
  const wrap = document.createElement('div');
  wrap.className = isBoard ? 'board-card card-picker-wrap' : 'card-picker-wrap';
  wrap.dataset.slotIndex = String(slotIndex);
  wrap.dataset.idPrefix = idPrefix;

  const rank = document.createElement('select');
  rank.id = `${idPrefix}-rank-${slotIndex}`;
  rank.className = 'card-picker-select';
  rank.setAttribute('aria-hidden', 'true');
  rank.innerHTML = '<option value="">—</option>' + RANKS.map((r) => renderCardOption(r, RANK_LABELS[r] ?? r)).join('');
  const suit = document.createElement('select');
  suit.id = `${idPrefix}-suit-${slotIndex}`;
  suit.className = 'card-picker-select';
  suit.setAttribute('aria-hidden', 'true');
  suit.innerHTML =
    '<option value="">—</option>' +
    SUITS.map((s) => renderCardOption(s, SUIT_SYMBOLS[s])).join('');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'card-picker-trigger card-picker-trigger--empty';
  trigger.id = `${idPrefix}-trigger-${slotIndex}`;
  trigger.textContent = '—';
  trigger.setAttribute('aria-label', label ? `Выбрать карту: ${label}` : `Выбрать карту ${slotIndex + 1}`);

  const popover = document.createElement('div');
  popover.className = 'card-picker-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Выбор карты');

  const preview = document.createElement('div');
  preview.className = 'picker-preview';
  preview.textContent = '—';

  const rankRow = document.createElement('div');
  rankRow.className = 'picker-rank-row';
  const RANK_DISPLAY = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_VALUES =  ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T',  'J', 'Q', 'K'];
  RANK_DISPLAY.forEach((label, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'picker-rank-chip';
    chip.textContent = label;
    chip.dataset.rank = RANK_VALUES[i];
    rankRow.append(chip);
  });

  const suitRow = document.createElement('div');
  suitRow.className = 'picker-suit-row';
  const SUIT_DATA = [
    { suit: 's', symbol: '♠', label: 'Пики' },
    { suit: 'h', symbol: '♥', label: 'Червы' },
    { suit: 'd', symbol: '♦', label: 'Бубны' },
    { suit: 'c', symbol: '♣', label: 'Трефы' },
  ];
  SUIT_DATA.forEach(({ suit, symbol, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `picker-suit-btn${suit === 'h' || suit === 'd' ? ' picker-suit-btn--red' : ''}`;
    btn.dataset.suit = suit;
    btn.setAttribute('aria-label', label);
    btn.textContent = symbol;
    suitRow.append(btn);
  });

  const footer = document.createElement('div');
  footer.className = 'picker-footer';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'picker-btn picker-btn--secondary';
  clearBtn.textContent = 'Очистить';
  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'picker-btn picker-btn--primary';
  doneBtn.textContent = 'Готово';
  doneBtn.disabled = true;
  footer.append(clearBtn, doneBtn);

  popover.append(preview, rankRow, suitRow, footer);

  let pendingRank = rank.value || '';
  let pendingSuit = suit.value || '';

  function updatePreview() {
    if (pendingRank && pendingSuit) {
      const rankLabel = pendingRank === 'T' ? '10' : pendingRank;
      const suitSymbol = SUIT_SYMBOLS[pendingSuit] ?? pendingSuit;
      preview.textContent = `${rankLabel}${suitSymbol}`;
      preview.className = `picker-preview${pendingSuit === 'h' || pendingSuit === 'd' ? ' picker-preview--red' : ''}`;
      doneBtn.disabled = false;
    } else if (pendingRank) {
      preview.textContent = pendingRank === 'T' ? '10' : pendingRank;
      preview.className = 'picker-preview';
      doneBtn.disabled = true;
    } else {
      preview.textContent = '—';
      preview.className = 'picker-preview';
      doneBtn.disabled = true;
    }

    preview.classList.remove('animate-scale-in');
    void preview.offsetWidth;
    if (pendingRank && pendingSuit) {
      preview.classList.add('animate-scale-in');
    }
  }

  function setActiveRank(r: string) {
    rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach(c => {
      c.classList.toggle('picker-rank-chip--active', c.dataset.rank === r);
    });
  }

  function setActiveSuit(s: string) {
    suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach(b => {
      b.classList.toggle('picker-suit-btn--active', b.dataset.suit === s);
    });
  }

  if (rank.value) { pendingRank = rank.value; setActiveRank(rank.value); }
  if (suit.value) { pendingSuit = suit.value; setActiveSuit(suit.value); }
  updatePreview();

  wrap.append(rank, suit, trigger, popover);

  function openPopover(): void {
    const taken = getSelectedCardsExcept(idPrefix === 'hole' ? slotIndex : slotIndex + 2);
    pendingRank = rank.value || '';
    pendingSuit = suit.value || '';
    setActiveRank(pendingRank);
    setActiveSuit(pendingSuit);
    updatePreview();

    rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach(chip => {
      chip.disabled = false;
    });
    suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach(btn => {
      btn.disabled = false;
    });
    RANK_VALUES.forEach((r) => {
      SUIT_DATA.forEach(({ suit: s }) => {
        const card = (r + s) as Card;
        if (taken.has(card)) {
          // Disable combinations that are taken
        }
      });
    });

    const rect = trigger.getBoundingClientRect();
    (popover as HTMLElement).style.top = `${rect.bottom + 4}px`;
    popover.hidden = false;
  }

  function closePopover(): void {
    popover.hidden = true;
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover.hidden) openPopover();
    else closePopover();
  });

  rankRow.querySelectorAll<HTMLButtonElement>('.picker-rank-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chip.disabled) return;
      pendingRank = chip.dataset.rank ?? '';
      setActiveRank(pendingRank);
      const taken = getSelectedCardsExcept(idPrefix === 'hole' ? slotIndex : slotIndex + 2);
      suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach(btn => {
        const card = (pendingRank + (btn.dataset.suit ?? '')) as Card;
        btn.disabled = taken.has(card);
      });
      updatePreview();
    });
  });

  suitRow.querySelectorAll<HTMLButtonElement>('.picker-suit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      pendingSuit = btn.dataset.suit ?? '';
      setActiveSuit(pendingSuit);
      updatePreview();
    });
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingRank = '';
    pendingSuit = '';
    setActiveRank('');
    setActiveSuit('');
    updatePreview();
  });

  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pendingRank || !pendingSuit) return;
    rank.value = pendingRank;
    suit.value = pendingSuit;
    rank.dispatchEvent(new Event('change', { bubbles: true }));
    suit.dispatchEvent(new Event('change', { bubbles: true }));
    updatePickerDisplay(idPrefix, slotIndex);
    closePopover();
  });

  rank.addEventListener('change', () => updatePickerDisplay(idPrefix, slotIndex));
  suit.addEventListener('change', () => updatePickerDisplay(idPrefix, slotIndex));

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !wrap.contains(e.target as Node)) closePopover();
  });

  if (label) {
    const item = document.createElement('div');
    item.className = 'hole-card-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'hole-card-label';
    labelEl.textContent = label;
    item.append(labelEl, wrap);
    container.append(item);
  } else {
    container.append(wrap);
  }
}

function buildCardSelects(container: HTMLElement, count: number, idPrefix: string, labels?: string[]): void {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    buildCardPickerSlot(container, i, idPrefix, false, labels?.[i]);
  }
}

/** Борд: 5 карт, каждая — пикер с сеткой */
function buildBoardCardSelects(container: HTMLElement): void {
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    buildCardPickerSlot(container, i, 'board', true);
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
  updatePickerDisplay(idPrefix, i);
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

  const initialTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'dark';
  document.documentElement.setAttribute('data-theme', initialTheme);

  app.innerHTML = `
    <header class="header">
      <div class="header-brand">
        <h1 class="header-logo-wrap"><img src="./logo-pirate.png" alt="Покерный тренажер СР" class="header-logo"></h1>
        <span class="header-title">Покерный тренажёр</span>
      </div>
      <div class="header-controls">
        <button type="button" class="title-help-trigger btn-ripple" aria-label="Инструкция">?</button>
        <div class="title-help-popover" id="title-help-popover" role="tooltip" hidden>
          <p>Это тренажёр Texas Hold'em. Введите свои карты и борд, выберите позицию, укажите банк и сумму колла — и нажмите «Рассчитать». Вы получите совет, эквити и подсказки по аутам.</p>
        </div>
        <button type="button" class="theme-toggle btn-ripple" id="theme-toggle" aria-label="Светлая/тёмная тема" title="Светлая/тёмная тема">
          <span class="theme-icon theme-icon-sun" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg></span>
          <span class="theme-icon theme-icon-moon" aria-hidden="true" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span>
        </button>
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
            <button type="button" class="position-help-trigger btn-ripple" aria-label="Подсказка по позициям">?</button>
          </label>
          <div class="position-chips-row" role="group" aria-label="Выбор позиции">
            ${[0, 1, 2, 3, 4, 5].map((i) => `<button type="button" class="position-chip${i === 0 ? ' position-chip--active' : ''}" data-position="${i}">${POSITION_NAMES[i] ?? i}</button>`).join('')}
          </div>
          <input type="hidden" id="position" value="0">
          <div class="position-help-popover" id="position-help-popover" role="tooltip" hidden>
            <p><strong>BTN</strong> — баттон/дилер, ходит последним (выгодная позиция). <strong>SB</strong> — малый блайнд. <strong>BB</strong> — большой блайнд. <strong>UTG</strong> — первый после блайндов (сложно). <strong>MP</strong> — средняя позиция. <strong>CO</strong> — катофф (удобно, почти как баттон).</p>
          </div>
        </div>
        <label>
          <span>Игроков за столом</span>
          <div class="players-row" role="group" aria-label="Количество игроков">
            ${[2,3,4,5,6,7,8,9,10].map(n => `<button type="button" class="player-chip${n === 6 ? ' player-chip--active' : ''}" data-players="${n}">${n}</button>`).join('')}
          </div>
          <input type="hidden" id="num-players" value="6">
        </label>
        <label>
          <span>Банк</span>
          <div class="input-with-step" data-step="5" data-min="0">
            <input type="number" id="pot-size" min="0" value="0" />
            <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
            <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
          </div>
        </label>
        <label>
          <span>Сумма колла</span>
          <div class="input-with-step" data-step="5" data-min="0">
            <input type="number" id="to-call" min="0" value="0" />
            <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
            <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
          </div>
          <div class="presets-row" id="call-presets">
            <button type="button" class="preset-chip" data-preset="third">⅓ банка</button>
            <button type="button" class="preset-chip" data-preset="half">½ банка</button>
            <button type="button" class="preset-chip" data-preset="pot">Банк</button>
            <button type="button" class="preset-chip" data-preset="zero">0</button>
          </div>
        </label>
      </section>

      <section class="section results" id="results">
        <button type="button" id="btn-calculate" class="btn btn-calculate btn-ripple">Рассчитать</button>
        <div id="results-content"></div>
      </section>
    </main>
  `;

  const holeContainer = document.getElementById('hole-cards')!;
  const boardContainer = document.getElementById('board-cards')!;
  buildCardSelects(holeContainer, 2, 'hole', ['Первая карта', 'Вторая карта']);
  buildBoardCardSelects(boardContainer);
  attachDuplicateCheck();

  // Player chips
  document.querySelectorAll<HTMLButtonElement>('.player-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const n = chip.dataset.players ?? '6';
      (document.getElementById('num-players') as HTMLInputElement).value = n;
      document.querySelectorAll('.player-chip').forEach(c => c.classList.remove('player-chip--active'));
      chip.classList.add('player-chip--active');
    });
  });

  // Preset chips for to-call
  function updatePresetChips() {
    const potVal = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
    const presetRow = document.getElementById('call-presets');
    if (!presetRow) return;
    presetRow.querySelectorAll<HTMLButtonElement>('.preset-chip').forEach(chip => {
      chip.disabled = potVal === 0 && chip.dataset.preset !== 'zero';
    });
  }

  document.getElementById('call-presets')?.querySelectorAll<HTMLButtonElement>('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const potVal = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
      const input = document.getElementById('to-call') as HTMLInputElement;
      switch (chip.dataset.preset) {
        case 'third': input.value = String(Math.round(potVal / 3)); break;
        case 'half': input.value = String(Math.round(potVal / 2)); break;
        case 'pot': input.value = String(potVal); break;
        case 'zero': input.value = '0'; break;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.getElementById('pot-size')?.addEventListener('input', updatePresetChips);
  updatePresetChips();

  // Position chips
  document.querySelectorAll<HTMLButtonElement>('.position-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pos = chip.dataset.position ?? '0';
      (document.getElementById('position') as HTMLInputElement).value = pos;
      document.querySelectorAll('.position-chip').forEach(c => c.classList.remove('position-chip--active'));
      chip.classList.add('position-chip--active');
    });
  });

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

  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.querySelector('.theme-icon-sun') as HTMLElement;
  const themeIconMoon = document.querySelector('.theme-icon-moon') as HTMLElement;
  function applyTheme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (_) {}
    if (themeIconSun && themeIconMoon) {
      themeIconSun.hidden = theme === 'light';
      themeIconMoon.hidden = theme === 'dark';
    }
  }
  if (themeToggle && themeIconSun && themeIconMoon) {
    applyTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark');
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  document.querySelectorAll('.step-up').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = (btn as HTMLElement).closest('.input-with-step');
      const input = wrap?.querySelector('input[type="number"]') as HTMLInputElement;
      if (!input || !wrap) return;
      const step = parseInt(wrap.getAttribute('data-step') ?? '5', 10) || 1;
      const min = parseInt(wrap.getAttribute('data-min') ?? '0', 10) ?? 0;
      const maxAttr = wrap.getAttribute('data-max');
      const max = maxAttr != null ? parseInt(maxAttr, 10) : undefined;
      let v = (parseInt(input.value, 10) || min) + step;
      if (max != null) v = Math.min(max, v);
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  document.querySelectorAll('.step-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = (btn as HTMLElement).closest('.input-with-step');
      const input = wrap?.querySelector('input[type="number"]') as HTMLInputElement;
      if (!input || !wrap) return;
      const step = parseInt(wrap.getAttribute('data-step') ?? '5', 10) || 1;
      const min = parseInt(wrap.getAttribute('data-min') ?? '0', 10) ?? 0;
      let v = (parseInt(input.value, 10) || min) - step;
      v = Math.max(min, v);
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  const resultsContent = document.getElementById('results-content')!;

  function updateResults(): void {
    const holeCards = readCardSelects(holeContainer, 'hole');
    const boardCards = readCardSelects(boardContainer, 'board');
    const positionIndex = Math.min(5, Math.max(0, parseInt((document.getElementById('position') as HTMLSelectElement).value, 10) || 0));
    const numPlayers = Math.min(10, Math.max(2, parseInt((document.getElementById('num-players') as HTMLInputElement).value, 10) || 6));
    const potSize = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
    const toCall = parseInt((document.getElementById('to-call') as HTMLInputElement).value, 10) || 0;

    if (holeCards.length !== 2) {
      resultsContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="6" width="14" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
              <rect x="26" y="6" width="14" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
              <path d="M24 32 L24 42 M18 42 L30 42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="empty-state-title">Начнём раздачу</div>
          <div class="empty-state-subtitle">Выберите две карты — и я подскажу что делать</div>
        </div>
      `;
      return;
    }

    const allCards = [...holeCards, ...boardCards];
    if (new Set(allCards).size !== allCards.length) {
      resultsContent.innerHTML = `
        <div class="error-state">
          <div class="error-state-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2"/>
              <path d="M16 9v8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="16" cy="22" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="error-state-title">Ой, дубликат</div>
          <div class="error-state-subtitle">Одна карта не может быть в руке и на борде одновременно. Очистите дублирующуюся карту.</div>
        </div>
      `;
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
      equityPercent: eqRange.percent,
    });

    const handLabel =
      board.length < 3
        ? board.length === 0
          ? 'Для расчёта руки добавьте на борд 3 карты (флоп).'
          : `Для полной оценки добавьте на борд ещё ${3 - board.length} карт${3 - board.length === 1 ? 'у' : 'ы'} (флоп = 3 карты).`
        : strength.name;

    const actionClass = advice.action === 'fold' ? 'results-action results-action--fold'
      : advice.action === 'check' ? 'results-action results-action--neutral'
      : 'results-action results-action--positive';

    const equityClass = eqRange.percent < 35 ? 'results-equity results-equity--low' : 'results-equity';

    let html = `
      <div class="results-hero animate-fade-in-up">
        <div class="${actionClass}">${advice.action.toUpperCase()}</div>
        <div class="${equityClass}">${eqRange.low}%–${eqRange.high}%</div>
        <p class="results-reason">${advice.reason}</p>
        <div class="results-context">
          <span>${phaseLabel}</span>
          <span>·</span>
          <span>${numPlayers} игроков</span>
          ${potSize > 0 ? `<span>·</span><span>Банк ${potSize}</span>` : ''}
          ${toCall > 0 ? `<span>·</span><span>Колл ${toCall}</span>` : ''}
        </div>
      </div>
    `;

    html += `
      <div class="results-hand">
        <span class="results-hand-name">${handLabel}</span>
        <span class="results-hand-cards">${strength.cards.map(cardToHtml).join('')}</span>
      </div>
    `;

    if (board.length >= 3) {
      html += `
        <details class="results-details">
          <summary>Ауты${totalOutsCount > 0 ? ` (${totalOutsCount})` : ''}</summary>
          <div class="results-details-body">
            ${outsList.length ? outsList.map((o) => {
              const cardsHtml = o.outCards?.length ? `<div class="outs-cards">${o.outCards.map((c) => cardToHtml(c)).join('')}</div>` : '';
              return `<div class="outs-item"><p>${o.description} — шанс ${(o.improveChance * 100).toFixed(1)}%</p>${cardsHtml}</div>`;
            }).join('') : '<p>Нет явных дро.</p>'}
          </div>
        </details>
        <details class="results-details">
          <summary>Эквити</summary>
          <div class="results-details-body">
            <p>${eqRange.low}%–${eqRange.high}% против ${numPlayers - 1} оппонентов (~${eqRange.percent}%)</p>
          </div>
        </details>
      `;
    }

    if (nutsInfo) {
      html += `
        <details class="results-details">
          <summary>Натс</summary>
          <div class="results-details-body">
            <p>${nutsInfo.description}</p>
            ${nutsInfo.isNuts ? '<p class="nuts-badge">🏆 У вас натс!</p>' : ''}
          </div>
        </details>
      `;
    }

    resultsContent.innerHTML = html;
  }

  const btnCalculate = document.getElementById('btn-calculate');
  if (btnCalculate) btnCalculate.addEventListener('click', updateResults);

  updateResults();
}
