'use strict';

/**
 * offlineAI.js — Server-side AI for offline players using FiveCrownsGame's public API.
 * Plays a complete turn: draw → (meld)* → discard.
 */

const { validateMeld } = require('../game/meldValidator');

// ─── Combination helpers ────────────────────────────────────────────────────

function getCombinations(hand, size) {
  const results = [];
  function combine(start, chosen, indices) {
    if (chosen.length === size) {
      results.push({ cards: [...chosen], indices: [...indices] });
      return;
    }
    for (let i = start; i < hand.length; i++) {
      chosen.push(hand[i]);
      indices.push(i);
      combine(i + 1, chosen, indices);
      chosen.pop();
      indices.pop();
    }
  }
  combine(0, [], []);
  return results;
}

/**
 * Find all valid melds in `hand` for the given round.
 * Only returns melds that leave at least 1 card remaining for the discard.
 */
function findPlayableMelds(hand, roundNumber) {
  if (!hand || hand.length < 3) return [];
  const melds = [];
  for (let size = 3; size <= hand.length; size++) {
    for (const combo of getCombinations(hand, size)) {
      const result = validateMeld(combo.cards, roundNumber);
      if (result.valid && hand.length - size >= 1) {
        melds.push({
          cards: combo.cards,
          indices: combo.indices,
          type: result.type,
          remainingCards: hand.length - size,
          size,
        });
      }
    }
  }
  return melds;
}

/** Pick the best meld: prefer one that leaves 1 card (go-out), else biggest. */
function selectBestMeld(melds) {
  if (!melds || melds.length === 0) return null;
  const oneLeft = melds.filter((m) => m.remainingCards === 1);
  if (oneLeft.length > 0) return oneLeft[0];
  return melds.reduce((best, m) => (m.size > best.size ? m : best));
}

/** Decide whether to draw from discard pile. */
function shouldTakeDiscard(discardCard, hand, roundNumber) {
  if (!discardCard) return false;
  const wildRank = String(roundNumber + 2);

  // Always take wilds/jokers unless hand is already one discard away from going out
  if (discardCard.rank === 'joker' || discardCard.rank === wildRank) {
    const alreadyNearOut = findPlayableMelds(hand, roundNumber).some(
      (m) => m.remainingCards <= 1
    );
    return !alreadyNearOut;
  }

  // Take if the discard card participates in a new potential meld
  const testHand = [...hand, discardCard];
  return findPlayableMelds(testHand, roundNumber).some((m) =>
    m.cards.includes(discardCard)
  );
}

/** Choose the hand index of the worst card to discard. */
function chooseDiscardIndex(hand, roundNumber, isFinalTurn) {
  if (hand.length <= 1) return 0;
  const wildRank = String(roundNumber + 2);

  // On final turn, dump high dead-weight first (jokers > wilds > point value)
  if (isFinalTurn) {
    const jokerIdx = hand.findIndex((c) => c.rank === 'joker');
    if (jokerIdx !== -1) return jokerIdx;
    const wildIdx = hand.findIndex((c) => c.rank === wildRank);
    if (wildIdx !== -1) return wildIdx;
  }

  let bestIdx = -1;
  let bestScore = -Infinity;

  hand.forEach((card, i) => {
    // Outside final turn, protect wilds — too useful to throw away
    if (!isFinalTurn && (card.rank === 'joker' || card.rank === wildRank)) return;

    let score = card.value || 0;

    // Prefer isolating cards with no close neighbour in the same suit
    const hasNeighbour = hand.some((other, j) => {
      if (j === i) return false;
      if (other.rank === 'joker' || other.rank === wildRank) return true;
      if (other.suit !== card.suit) return false;
      return Math.abs((other.value || 0) - (card.value || 0)) <= 2;
    });
    if (!hasNeighbour) score += 8;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  return bestIdx === -1 ? 0 : bestIdx;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Play a complete turn for the current (offline) player in `game`.
 * Uses FiveCrownsGame's public API so all validation remains intact.
 *
 * @param {import('../game/fiveCrownsGame').FiveCrownsGame} game
 * @returns {string[]} human-readable log lines
 */
function playOfflineTurn(game) {
  const playerId = game.currentPlayerId;
  const isFinalTurn = game.goingOutPlayerId !== null;
  const log = [`[OfflineAI] turn for player ${playerId}`];

  // ── DRAW ──────────────────────────────────────────────────────────────────
  const hand = game.hands[playerId] || [];
  const topDiscard =
    game.discardPile.length > 0
      ? game.discardPile[game.discardPile.length - 1]
      : null;

  if (topDiscard && shouldTakeDiscard(topDiscard, hand, game.roundNumber)) {
    game.drawDiscard(playerId);
    log.push(`  drew ${topDiscard.rank} from discard`);
  } else {
    game.drawDeck(playerId);
    log.push('  drew from deck');
  }

  // ── MELD ──────────────────────────────────────────────────────────────────
  let meldCount = 0;
  let keepMelding = true;
  while (keepMelding) {
    const currentHand = game.hands[playerId];
    if (!currentHand || currentHand.length <= 1) break;

    const melds = findPlayableMelds(currentHand, game.roundNumber);
    const best = selectBestMeld(melds);
    if (!best) { keepMelding = false; break; }

    game.declareMeld(playerId, best.indices);
    meldCount++;
    log.push(`  melded ${best.size} cards (${best.type})`);
  }
  if (meldCount === 0) log.push('  no melds found');

  // ── DISCARD ───────────────────────────────────────────────────────────────
  const handAfterMelds = game.hands[playerId];
  if (!handAfterMelds || handAfterMelds.length === 0) {
    log.push('  hand empty after melds — skipping discard');
  } else {
    const idx = chooseDiscardIndex(handAfterMelds, game.roundNumber, isFinalTurn);
    game.discardCard(playerId, idx);
    log.push(`  discarded ${handAfterMelds[idx] ? handAfterMelds[idx].rank : 'card'} at index ${idx}`);
  }

  return log;
}

module.exports = { playOfflineTurn };
