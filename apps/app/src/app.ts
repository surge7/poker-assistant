/**
 * Orchestrator: initApp() связывает все модули.
 *
 * Модули:
 * - picker.ts: card picker (выбор карт, дубликаты)
 * - format.ts: форматтеры (explanationRow, formatExplanationPct и т.д.)
 * - render.ts: рендеринг результата
 * - state-ui.ts: UI-state (applyState, debouncedSave, applyHandHidden)
 * - equity-client.ts: Worker + requestEquity + fallback
 *
 * initApp — единственная экспортируемая функция. Остальная логика вынесена
 * в модули, app.ts занимается только связями и обработчиками событий.
 */

import {
  evaluatePlayerHand,
  countOuts,
  totalOuts,
  compareToNuts,
  getAdvice,
  PREFLOP_ITERATIONS,
  POSTFLOP_ITERATIONS,
  INTERACTIVE_PREFLOP_ITERATIONS,
  INTERACTIVE_POSTFLOP_ITERATIONS,
  clampNumPlayers,
  clampPositionIndex,
} from '@poker/core';
import { impactLight, impactMedium, notificationWarning, notificationSuccess, selectionChanged } from './haptics';
import { EquityClient } from './equity-client';
import { handRankingsButtonIcon, openHandRankingsPanel } from './hand-rankings-ui';
import { loadState, clearState, getDefaultState } from './state';
import {
  buildCardSelects,
  buildBoardCardSelects,
  readCardSelects,
  attachDuplicateCheck,
} from './picker';
import { applyState, applyHandHidden, updatePositionUI, createDebouncedSave, parseAmount } from './state-ui';
import { renderEmptyState, renderErrorState, renderResults, type EquityRange } from './render';

/** Преобразовать board.length → phase для getAdvice. */
function getPhase(boardLength: number): 'preflop' | 'flop' | 'turn' | 'river' {
  if (boardLength === 0) return 'preflop';
  if (boardLength === 3) return 'flop';
  if (boardLength === 4) return 'turn';
  return 'river';
}

export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const initialTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'dark';
  document.documentElement.setAttribute('data-theme', initialTheme);

  app.innerHTML = `
    <header class="header">
      <div class="header-brand">
        <img src="./logo-pirate.png" alt="Покерный тренажёр" class="header-logo" id="header-logo">
      </div>
      <div class="header-controls">
        <button type="button" class="hand-toggle btn-ripple" id="hand-toggle" aria-label="Скрыть/показать руку" title="Скрыть/показать руку">
          <span class="hand-toggle-icon hand-toggle-icon--visible" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
          <span class="hand-toggle-icon hand-toggle-icon--hidden" aria-hidden="true" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></span>
        </button>
        <button type="button" class="title-help-trigger btn-ripple" aria-label="Инструкция">?</button>
        <div class="title-help-popover" id="title-help-popover" role="tooltip" hidden>
          <p class="title-help-intro">Введите карты, борд, позицию, банк и колл — нажмите «Рассчитать». Ниже — совет и расчёты.</p>
          <dl class="title-help-glossary">
            <dt>Эквити</dt>
            <dd>Ваш шанс выиграть банк, когда все общие карты выложены и раздача доходит до вскрытия. На префлопе — одно число, на флопе и дальше — ещё и диапазон.</dd>
            <dt>Надёжность по данным</dt>
            <dd>Насколько однозначен совет при введённых картах, банке, колле и числе игроков. Чем выше %, тем меньше сомнений между коллом и фолдом. Это не шанс выиграть — за шанс отвечает эквити.</dd>
            <dt>Порог колла</dt>
            <dd>Минимальный шанс на победу, при котором колл окупается: колл ÷ (банк + колл). Если эквити ниже — выгоднее сбросить.</dd>
            <dt>Ауты</dt>
            <dd>Карты в колоде, которые могут усилить руку на терне или ривере. Показываются в блоке «Почему так?» на флопе и терне.</dd>
            <dt>Совет</dt>
            <dd>FOLD / CHECK / CALL / RAISE — рекомендация по эквити, пот-оддсам, силе руки и аутам.</dd>
          </dl>
        </div>
        <button type="button" class="rankings-trigger btn-ripple" id="rankings-trigger" aria-label="Комбинации" title="Комбинации">
          ${handRankingsButtonIcon()}
        </button>
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
          <div class="position-chips-row" id="position-chips-row" role="group" aria-label="Выбор позиции"></div>
          <input type="hidden" id="position" value="0">
          <div class="position-help-popover" id="position-help-popover" role="tooltip" hidden></div>
        </div>
        <label>
          <span>Игроков за столом</span>
          <div class="players-row" role="group" aria-label="Количество игроков">
            ${[2,3,4,5,6,7,8,9,10].map(n => `<button type="button" class="player-chip${n === 6 ? ' player-chip--active' : ''}" data-players="${n}">${n}</button>`).join('')}
          </div>
          <input type="hidden" id="num-players" value="6">
        </label>
        <div class="pot-call-block">
          <div class="pot-call-row">
            <label class="pot-call-field">
              <span>Банк</span>
              <div class="input-with-step" data-step="5" data-min="0">
                <input type="number" id="pot-size" min="0" value="0" />
                <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
                <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
              </div>
            </label>
            <label class="pot-call-field">
              <span>Сумма колла</span>
              <div class="input-with-step" data-step="5" data-min="0">
                <input type="number" id="to-call" min="0" value="0" />
                <button type="button" class="step-btn step-down" aria-label="−5">−5</button>
                <button type="button" class="step-btn step-up" aria-label="+5">+5</button>
              </div>
            </label>
          </div>
          <div class="presets-row" id="call-presets">
            <button type="button" class="preset-chip" data-preset="third">⅓ банка</button>
            <button type="button" class="preset-chip" data-preset="half">½ банка</button>
            <button type="button" class="preset-chip" data-preset="pot">Банк</button>
            <button type="button" class="preset-chip" data-preset="zero">0</button>
          </div>
        </div>
      </section>

      <section class="section results" id="results">
        <div class="results-actions-row">
          <button type="button" id="btn-calculate" class="btn btn-calculate btn-ripple">Рассчитать</button>
          <button type="button" id="btn-reset" class="btn btn-reset" aria-label="Сбросить ввод">↺</button>
        </div>
        <div id="results-content" aria-live="polite" aria-atomic="true"></div>
      </section>
    </main>
  `;

  const holeContainer = document.getElementById('hole-cards')!;
  const boardContainer = document.getElementById('board-cards')!;
  buildCardSelects(holeContainer, 2, 'hole', ['Первая карта', 'Вторая карта']);
  buildBoardCardSelects(boardContainer);
  attachDuplicateCheck();

  document.getElementById('rankings-trigger')?.addEventListener('click', () => {
    openHandRankingsPanel();
  });

  const positionInput = document.getElementById('position') as HTMLInputElement;
  const positionChipsRow = document.getElementById('position-chips-row')!;
  const positionHelpPopover = document.getElementById('position-help-popover')!;

  const savedState = loadState();
  if (savedState) {
    applyState(savedState, app);
  } else {
    applyHandHidden(app, false);
    updatePositionUI(6, positionChipsRow, positionInput, positionHelpPopover);
  }

  const debouncedSave = createDebouncedSave(positionInput);

  // --- Player chips ---
  document.querySelectorAll<HTMLButtonElement>('.player-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const n = parseInt(chip.dataset.players ?? '6', 10) || 6;
      (document.getElementById('num-players') as HTMLInputElement).value = String(n);
      document.querySelectorAll('.player-chip').forEach((c) => c.classList.remove('player-chip--active'));
      chip.classList.add('player-chip--active');
      updatePositionUI(n, positionChipsRow, positionInput, positionHelpPopover);
      selectionChanged();
      debouncedSave();
      scheduleCalc();
    });
  });

  // --- Preset chips for to-call ---
  function updatePresetChips(): void {
    const potVal = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
    const presetRow = document.getElementById('call-presets');
    if (!presetRow) return;
    presetRow.querySelectorAll<HTMLButtonElement>('.preset-chip').forEach((chip) => {
      chip.disabled = potVal === 0 && chip.dataset.preset !== 'zero';
    });
  }

  document.getElementById('call-presets')?.querySelectorAll<HTMLButtonElement>('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const potVal = parseInt((document.getElementById('pot-size') as HTMLInputElement).value, 10) || 0;
      const input = document.getElementById('to-call') as HTMLInputElement;
      switch (chip.dataset.preset) {
        case 'third': input.value = String(Math.round(potVal / 3)); break;
        case 'half': input.value = String(Math.round(potVal / 2)); break;
        case 'pot': input.value = String(potVal); break;
        case 'zero': input.value = '0'; break;
      }
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('preset-chip--active'));
      chip.classList.add('preset-chip--active');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.getElementById('pot-size')?.addEventListener('input', updatePresetChips);
  updatePresetChips();

  // Сброс активного пресета при ручном вводе суммы колла
  document.getElementById('to-call')?.addEventListener('input', () => {
    document.querySelectorAll('.preset-chip--active').forEach((c) => c.classList.remove('preset-chip--active'));
  });

  // --- Position chips ---
  positionChipsRow.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.position-chip');
    if (!chip) return;
    const pos = chip.dataset.position ?? '0';
    positionInput.value = pos;
    positionChipsRow.querySelectorAll('.position-chip').forEach((c) => c.classList.remove('position-chip--active'));
    chip.classList.add('position-chip--active');
    selectionChanged();
    debouncedSave();
    scheduleCalc();
  });

  // --- Help popovers (position + title) ---
  function setupHelpPopover(triggerSelector: string, popover: HTMLElement): void {
    const trigger = document.querySelector(triggerSelector) as HTMLButtonElement;
    if (!trigger || !popover) return;
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      popover.hidden = !popover.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!popover.hidden && !popover.contains(e.target as Node) && e.target !== trigger) {
        popover.hidden = true;
      }
    });
  }
  setupHelpPopover('.position-help-trigger', positionHelpPopover);
  setupHelpPopover('.title-help-trigger', document.getElementById('title-help-popover')!);

  // --- Theme ---
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.querySelector('.theme-icon-sun') as HTMLElement;
  const themeIconMoon = document.querySelector('.theme-icon-moon') as HTMLElement;
  function applyTheme(theme: 'dark' | 'light'): void {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* noop */ }
    if (themeIconSun && themeIconMoon) {
      themeIconSun.hidden = theme === 'light';
      themeIconMoon.hidden = theme === 'dark';
    }
    const headerLogo = document.getElementById('header-logo') as HTMLImageElement | null;
    if (headerLogo) {
      headerLogo.src = theme === 'light' ? './logo-light.png' : './logo-pirate.png';
    }
  }
  if (themeToggle && themeIconSun && themeIconMoon) {
    applyTheme((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark');
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      impactLight();
    });
  }

  // --- Hand toggle (privacy) ---
  const handToggle = document.getElementById('hand-toggle');
  if (handToggle) {
    handToggle.addEventListener('click', () => {
      const next = app.getAttribute('data-hand-hidden') !== 'true';
      applyHandHidden(app, next);
      impactLight();
      debouncedSave();
    });
  }

  // --- Step buttons (+5/-5) ---
  function bindStepButtons(): void {
    document.querySelectorAll<HTMLButtonElement>('.step-up, .step-down').forEach((btn) => {
      const isUp = btn.classList.contains('step-up');
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.input-with-step');
        const input = wrap?.querySelector('input[type="number"]') as HTMLInputElement;
        if (!input || !wrap) return;
        const step = parseInt(wrap.getAttribute('data-step') ?? '5', 10) || 1;
        const min = parseInt(wrap.getAttribute('data-min') ?? '0', 10) ?? 0;
        const maxAttr = wrap.getAttribute('data-max');
        const max = maxAttr != null ? parseInt(maxAttr, 10) : undefined;
        let v = (parseInt(input.value, 10) || min) + (isUp ? step : -step);
        if (max != null) v = Math.min(max, v);
        v = Math.max(min, v);
        input.value = String(v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }
  bindStepButtons();

  // --- Results ---
  const resultsContent = document.getElementById('results-content')!;
  const equityClient = new EquityClient(new URL('./equity-worker.ts', import.meta.url));

  /** Тактильная отдача по action. */
  function hapticForAction(action: string): void {
    if (action === 'raise' || action === 'all-in') notificationSuccess();
    else if (action === 'fold') notificationWarning();
    else if (action === 'call') impactMedium();
    else impactLight();
  }

  /** Авто-расчёт: debounce 200мс, без тактильной отдачи. */
  let calcTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleCalc(): void {
    clearTimeout(calcTimer);
    calcTimer = setTimeout(() => updateResults(false), 200);
  }

  async function updateResults(triggeredByUser = false): Promise<void> {
    const holeCards = readCardSelects(holeContainer, 'hole');
    const boardCards = readCardSelects(boardContainer, 'board');
    const numPlayers = clampNumPlayers(parseInt((document.getElementById('num-players') as HTMLInputElement).value, 10) || 6);
    const positionIndex = clampPositionIndex(parseInt(positionInput.value, 10) || 0, numPlayers);
    const potSize = parseAmount(document.getElementById('pot-size') as HTMLInputElement);
    const toCall = parseAmount(document.getElementById('to-call') as HTMLInputElement);

    if (holeCards.length !== 2) {
      if (triggeredByUser) notificationWarning();
      resultsContent.innerHTML = renderEmptyState();
      return;
    }

    // Defense-in-depth: dedup на change-событиях уже убирает дубликаты.
    // Здесь — защита от регрессии (прямое программное изменение селектов).
    const allCards = [...holeCards, ...boardCards];
    if (new Set(allCards).size !== allCards.length) {
      if (triggeredByUser) notificationWarning();
      resultsContent.innerHTML = renderErrorState('Одна карта не может быть в руке и на борде одновременно. Очистите дублирующуюся карту.');
      return;
    }

    const phase = getPhase(boardCards.length);
    const board = boardCards;

    const strength = evaluatePlayerHand(holeCards, board);
    const outsList = board.length >= 3 && board.length < 5 ? countOuts(holeCards, board) : [];
    const totalOutsCount = board.length >= 3 && board.length < 5
      ? totalOuts(holeCards, board).total
      : 0;

    // Полные итерации при ручном расчёте, уменьшенные при автопересчёте.
    const iterationsAllIn = triggeredByUser
      ? (board.length === 0 ? PREFLOP_ITERATIONS : POSTFLOP_ITERATIONS)
      : (board.length === 0 ? INTERACTIVE_PREFLOP_ITERATIONS : INTERACTIVE_POSTFLOP_ITERATIONS);

    const eqRange = await equityClient.request({
      holeCards,
      board,
      numOpponents: numPlayers - 1,
      iterations: iterationsAllIn,
    });
    if (eqRange.isStale) return;

    const nutsInfo = board.length === 5 ? compareToNuts(holeCards, board) : null;
    const advice = getAdvice({
      phase,
      board,
      holeCards,
      potSize,
      toCall,
      numPlayers,
      positionIndex,
      equityPercent: eqRange.percent,
      equityLow: eqRange.low,
      equityHigh: eqRange.high,
    });

    if (triggeredByUser) hapticForAction(advice.action);

    const handLabel =
      board.length < 3
        ? board.length === 0
          ? 'Для расчёта руки добавьте на борд 3 карты (флоп).'
          : `Для полной оценки добавьте на борд ещё ${3 - board.length} карт${3 - board.length === 1 ? 'у' : 'ы'} (флоп = 3 карты).`
        : strength.name;

    const eq: EquityRange = { percent: eqRange.percent, low: eqRange.low, high: eqRange.high };
    resultsContent.innerHTML = renderResults({
      advice,
      eqRange: eq,
      potSize,
      toCall,
      boardLength: board.length,
      numPlayers,
      handLabel,
      strength,
      outsList,
      totalOutsCount,
      nutsDescription: nutsInfo?.description ?? null,
      isNuts: nutsInfo?.isNuts ?? false,
    });
  }

  // --- Wire up: карты / позиция / банк / колл → debouncedSave + scheduleCalc ---
  for (let i = 0; i < 2; i++) {
    document.getElementById(`hole-rank-${i}`)?.addEventListener('change', debouncedSave);
    document.getElementById(`hole-rank-${i}`)?.addEventListener('change', scheduleCalc);
    document.getElementById(`hole-suit-${i}`)?.addEventListener('change', debouncedSave);
    document.getElementById(`hole-suit-${i}`)?.addEventListener('change', scheduleCalc);
  }
  for (let i = 0; i < 5; i++) {
    document.getElementById(`board-rank-${i}`)?.addEventListener('change', debouncedSave);
    document.getElementById(`board-rank-${i}`)?.addEventListener('change', scheduleCalc);
    document.getElementById(`board-suit-${i}`)?.addEventListener('change', debouncedSave);
    document.getElementById(`board-suit-${i}`)?.addEventListener('change', scheduleCalc);
  }
  document.getElementById('pot-size')?.addEventListener('input', debouncedSave);
  document.getElementById('pot-size')?.addEventListener('input', scheduleCalc);
  document.getElementById('to-call')?.addEventListener('input', debouncedSave);
  document.getElementById('to-call')?.addEventListener('input', scheduleCalc);

  // --- Calculate / Reset buttons ---
  const btnCalculate = document.getElementById('btn-calculate');
  if (btnCalculate) {
    btnCalculate.addEventListener('click', () => {
      impactLight();
      const btn = btnCalculate as HTMLButtonElement;
      btn.classList.add('is-calculating');
      btn.disabled = true;
      requestAnimationFrame(() => {
        updateResults(true).finally(() => {
          btn.classList.remove('is-calculating');
          btn.disabled = false;
        });
      });
    });
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      clearState();
      applyState(getDefaultState(), app);
      notificationWarning();
      resultsContent.innerHTML = '';
    });
  }

  updateResults();
}
