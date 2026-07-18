/**
 * Английские текстовки совета.
 *
 * Зеркало ru.ts для английской локали. Подключается через setLocale('en').
 * Покерная терминология сохранена как в англоязычной литературе.
 *
 * Плейсхолдеры идентичны ru.ts — не переименовывайте {outs}, {activePfr} и т.д.
 */

import type { AdviceMessages } from './messages';

export const enAdviceMessages: AdviceMessages = {
  reason: {
    nuts: 'Nuts — maximize the pot.',
    strongHand: 'Very strong hand — raise for value.',
    premiumVsBet: 'Premium pair (AA–JJ) facing a bet — 3-bet for value.',
    premium: 'Premium pair (AA–JJ) — raise for value.',
    strongReady: 'Strong made hand.',
    strongDraw: 'Strong draw — {outs} outs.',
    callByStrength: 'Call is fine by hand strength.',
    equityEnough: 'Equity is enough to call.',
    callProfitable: 'Call is +EV by pot odds.',
    callOk: 'Call is okay.',
    callBorderline: 'Marginal call, but okay.',
    weakRiver: 'Weak hand on the river.',
    weakFewOuts: 'Weak hand and few outs.',
    equityBelowRequired: 'Equity below what the call needs.',
    equityNotEnoughFold: 'Not enough equity — fold.',
    equityShort: 'Equity falls short of a call.',
    needTwoCards: 'Enter your two hole cards.',
    noBetCheck: 'No bet to call — check and reassess.',
  },
  details: {
    raiseOrCall: "Raise or call — depends on opponents' actions.",
    drawOddsOk: 'Chance to improve justifies the call.',
    potLargeVsBet: 'Pot is large relative to the bet.',
    betLargeVsPot: 'Bet is large relative to the pot.',
    callNotWorthwhile: 'At these pot odds the call does not pay off.',
    potGoodOdds: 'Pot offers good odds.',
    oppTight: 'Tight opponent (PFR ~{activePfr}%) — their raise means more.',
    oppAggressive: 'Aggressive opponent (PFR ~{activePfr}%) — bluffs more often.',
    noBetNoOdds: 'No bet — pot odds do not apply.',
    noPotNoOdds: 'Pot not specified — pot odds unavailable.',
  },
};
