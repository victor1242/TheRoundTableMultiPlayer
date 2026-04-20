'use strict';

/**
 * offlineAI.js
 * Server-side AI that plays a full turn for an offline player.
 * Uses only the server's gameEngine.js — no DOM, no browser globals.
 */

const Engine = require('../engine/gameEngine');

// ---------------------------------------------------------------------------
// Meld helpers (self-contained, using server validateMeld signature)
// ---------------------------------------------------------------------------

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

function findPossibleMelds(hand, wildRank) {
  if (!hand || hand.length < 3) return [];
  const melds = [];
  for (let size = 3; size <= hand.length; size++) {
    for (const combo of getCombinations(hand, size)) {
      const result = Engine.validateMeld(combo.cards, wildRank);
      if (result.valid) {
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

function shouldTakeDiscard(discardCard, hand, wildRank) {
  if (!discardCard) return false;
  const wRank = String(wildRank);

  // Always take wilds, unless hand can already go out (protect winning state)
  if (discardCard.rank === 'joker' || discardCard.rank === wRank) {
    return !findPossibleMelds(hand, wildRank).some((m) => m.remainingCards <= 1);
  }

  // Take only if discard participates in a new meld
  const testHand = [...hand, discardCard];
  return findPossibleMelds(testHand, wildRank).some((m) => m.cards.includes(discardCard));
}

function selectBestMeld(possibleMelds) {
  if (!possibleMelds || possibleMelds.length === 0) return null;
  // Must keep ≥1 card to discard
  const valid = possibleMelds.filter((m) => m.remainingCards >= 1);
  if (valid.length === 0) return null;
  // Prefer going-out melds (1 card left)
  const oneLeft = valid.filter((m) => m.remainingCards === 1);
  if (oneLeft.length > 0) return oneLeft[0];
  // Otherwise biggest meld
  return valid.reduce((best, m) => (m.size > best.size ? m : best));
}

function chooseDiscard(hand, wildRank, isFinalTurn) {
  if (hand.length === 0) return 0;
  if (hand.length === 1) return 0;
  const wRank = String(wildRank);

  // On the final turn wilds are a liability — discard jokers first (50 pts each),
  // then round-wild cards (20 pts each), then fall through to normal logic.
  if (isFinalTurn) {
    const jokerIdx = hand.findIndex((c) => c.rank === 'joker');
    if (jokerIdx !== -1) return jokerIdx;
    const wildIdx = hand.findIndex((c) => c.rank === wRank);
    if (wildIdx !== -1) return wildIdx;
  }

  let bestIdx = -1;
  let bestScore = -Infinity;

  hand.forEach((card, i) => {
    // Outside final turn, protect wilds — they are too useful to discard
    if (!isFinalTurn && (card.rank === 'joker' || card.rank === wRank)) return;

    let score = card.value || 0;

    // Bonus for cards with no adjacent same-suit neighbour within 2 ranks
    const hasNeighbour = hand.some((other, j) => {
      if (j === i) return false;
      if (other.rank === 'joker' || other.rank === wRank) return true;
      if (other.suit !== card.suit) return false;
      return Math.abs((other.value || 0) - (card.value || 0)) <= 2;
    });
    if (!hasNeighbour) score += 8;

    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });

  // Fallback: discard index 0
  return bestIdx === -1 ? 0 : bestIdx;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Play a complete AI turn for the current player in `room`.
 * Mutates room state exactly the way applyAction does.
 * @param {GameRoom} room
 * @returns {string[]} log lines describing what happened
 */
function playOfflineTurn(room) {
  const gs = room.gameState;
  if (gs.phase !== 'playing') throw new Error('Game is not in playing phase');

  const player = room.players[gs.turnIndex];
  if (!player) throw new Error('No current player');

  const wildRank = Engine.wildRankForRound(gs.roundNumber);
  const log = [`[AI] ${player.name}'s turn (offline AI)`];

  // ── DRAW ──────────────────────────────────────────────────────────────────
  const topDiscard = gs.discardPile.length > 0
    ? gs.discardPile[gs.discardPile.length - 1]
    : null;

  if (topDiscard && shouldTakeDiscard(topDiscard, player.hand, wildRank)) {
    const card = Engine.drawFromDiscard(gs.discardPile);
    player.hand.push(card);
    log.push(`  drew ${card.rank} of ${card.suit} from discard`);
  } else {
    if (gs.deck.size === 0) Engine.reshuffleDiscardIntoDeck(gs.deck, gs.discardPile);
    const card = gs.deck.draw();
    if (!card) throw new Error('Deck and discard both empty');
    player.hand.push(card);
    log.push(`  drew from deck (${gs.deck.size} remaining)`);
  }
  player.hasDrawn = true;

  // ── MELD (repeat while improving) ─────────────────────────────────────────
  let meldCount = 0;
  let keepMelding = true;
  while (keepMelding && player.hand.length > 1) {
    const possible = findPossibleMelds(player.hand, wildRank);
    const best = selectBestMeld(possible);
    if (!best) { keepMelding = false; break; }

    const indexSet = new Set(best.indices);
    player.meldSets.push(best.cards);
    player.hand = player.hand.filter((_, i) => !indexSet.has(i));
    meldCount++;
    log.push(`  melded ${best.size} cards (${best.type})`);

    if (player.hand.length <= 1) break;
  }
  if (meldCount === 0) log.push('  no melds found');

  // ── DISCARD ───────────────────────────────────────────────────────────────
  if (player.hand.length === 0) {
    // Extremely rare: shouldn't happen since selectBestMeld keeps ≥1 card
    log.push('  no card to discard (hand empty after melds)');
    player.hasDrawn = false;
    room.bumpVersion('aiTurn', { playerId: player.id });
    return log;
  }

  const discardIdx = chooseDiscard(player.hand, wildRank, Boolean(gs.finalTurn));
  const discarded = player.hand.splice(discardIdx, 1)[0];
  Engine.placeOnDiscard(gs.discardPile, discarded);
  log.push(`  discarded ${discarded.rank} of ${discarded.suit}`);

  // ── CHECK GOING OUT ───────────────────────────────────────────────────────
  if (player.hand.length === 0) {
    player.IsOut = true;
    gs.finalTurn = true;
    if (!gs.goingOutPlayerId) {
      gs.goingOutPlayerId = player.id;
      gs.finalTurnQueue = [];
      let idx = (gs.turnIndex + 1) % room.players.length;
      while (idx !== gs.turnIndex) {
        const p = room.players[idx];
        if (p && !p.IsOut && p.id !== player.id) gs.finalTurnQueue.push(p.id);
        idx = (idx + 1) % room.players.length;
      }
    }
    log.push('  went out!');
  }

  player.hasDrawn = false;

  // Remove from final-turn queue if present
  if (gs.goingOutPlayerId) {
    const qIdx = gs.finalTurnQueue.indexOf(player.id);
    if (qIdx !== -1) gs.finalTurnQueue.splice(qIdx, 1);
  }

  // End round or advance turn
  if (gs.goingOutPlayerId && gs.finalTurnQueue.length === 0) {
    room._endRound();
    log.push('  round ended');
  } else {
    gs.turnIndex = Engine.nextPlayerIndex(gs.turnIndex, room.players);
  }

  room.bumpVersion('aiTurn', { playerId: player.id });
  log.forEach((line) => console.log(line));
  return log;
}

module.exports = { playOfflineTurn };
