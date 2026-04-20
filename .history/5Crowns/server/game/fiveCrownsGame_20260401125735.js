'use strict';

const { createDeck, shuffleDeck, rankValue } = require('./deck');
const { validateMeld } = require('./meldValidator');

/**
 * Server-authoritative Five Crowns game state.
 *
 * Turn flow per player:
 *   'draw'         → must call drawDeck() or drawDiscard()
 *   'meld-discard' → may call declareMeld() / undoMelds() any number of times,
 *                    then must call discardCard() to end turn
 */
class FiveCrownsGame {
  constructor(playerIds) {
    if (!Array.isArray(playerIds) || playerIds.length < 2) {
      throw new Error('Need at least 2 players');
    }
    this.playerIds = [...playerIds];
    this.roundNumber = 1;
    this.lastRound = 9;          // rounds 1-9 (3..11 cards dealt)
    this.phase = 'lobby';        // 'lobby' | 'playing' | 'roundOver' | 'gameOver'

    // Per-player data
    this.hands = {};             // { playerId: Card[] }
    this.meldSets = {};          // { playerId: Card[][] }
    this.scores = {};            // { playerId: { roundScore, gameScore } }

    this.deck = [];
    this.discardPile = [];

    // Turn tracking
    this.currentPlayerIndex = 0;
    this.turnPhase = 'draw';     // 'draw' | 'meld-discard'

    // Final-turn tracking
    this.goingOutPlayerId = null;
    this.finalTurnQueue = [];    // player IDs still owed a final turn

    // History for the client score table
    this.scoreboardData = [];

    this.playerIds.forEach((id) => {
      this.scores[id] = { roundScore: 0, gameScore: 0 };
      this.hands[id] = [];
      this.meldSets[id] = [];
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  get cardsDealt() {
    return this.roundNumber + 2;
  }

  get currentPlayerId() {
    return this.playerIds[this.currentPlayerIndex];
  }

  get wildRank() {
    return String(this.roundNumber + 2);
  }

  _assertPlayingPhase() {
    if (this.phase !== 'playing') throw new Error('Game is not in progress');
  }

  _assertCurrentPlayer(playerId) {
    if (playerId !== this.currentPlayerId) throw new Error('Not your turn');
  }

  _reshuffleDiscard() {
    if (this.discardPile.length <= 1) {
      throw new Error('Not enough cards to reshuffle');
    }
    // Keep top card on discard pile
    const top = this.discardPile.pop();
    this.deck = shuffleDeck(this.discardPile);
    this.discardPile = [top];
  }

  _drawFromDeckInternal() {
    if (this.deck.length === 0) this._reshuffleDiscard();
    return this.deck.pop();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  startRound() {
    if (this.phase === 'gameOver') throw new Error('Game is already over');

    // Reset per-round state
    this.deck = shuffleDeck(createDeck());
    this.discardPile = [];
    this.goingOutPlayerId = null;
    this.finalTurnQueue = [];
    this.turnPhase = 'draw';

    this.playerIds.forEach((id) => {
      this.hands[id] = [];
      this.meldSets[id] = [];
      this.scores[id].roundScore = 0;
    });

    // Deal cards
    const n = this.cardsDealt;
    for (let i = 0; i < n; i++) {
      this.playerIds.forEach((id) => {
        this.hands[id].push(this._drawFromDeckInternal());
      });
    }

    // Flip one card to start discard pile
    this.discardPile.push(this._drawFromDeckInternal());

    // Dealer rotates each round
    this.currentPlayerIndex = (this.roundNumber - 1) % this.playerIds.length;
    this.phase = 'playing';
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  drawDeck(playerId) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);
    if (this.turnPhase !== 'draw') throw new Error('You have already drawn this turn');

    const card = this._drawFromDeckInternal();
    this.hands[playerId].push(card);
    this.turnPhase = 'meld-discard';
    return card;
  }

  drawDiscard(playerId) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);
    if (this.turnPhase !== 'draw') throw new Error('You have already drawn this turn');
    if (this.discardPile.length === 0) throw new Error('Discard pile is empty');

    const card = this.discardPile.pop();
    this.hands[playerId].push(card);
    this.turnPhase = 'meld-discard';
    return card;
  }

  /**
   * Declare a meld: move cards at the given hand indices into a new meld set.
   * @param {string} playerId
   * @param {number[]} handIndices  - indices into this.hands[playerId]
   */
  declareMeld(playerId, handIndices) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);
    if (this.turnPhase !== 'meld-discard') throw new Error('Draw a card first');

    const hand = this.hands[playerId];
    if (!Array.isArray(handIndices) || handIndices.length < 3) {
      throw new Error('Select at least 3 cards to meld');
    }

    // Validate indices
    const sorted = [...handIndices].sort((a, b) => b - a); // descending for splicing
    sorted.forEach((idx) => {
      if (idx < 0 || idx >= hand.length) throw new Error(`Invalid card index ${idx}`);
    });

    const meldCards = handIndices.sort((a, b) => a - b).map((i) => hand[i]);
    const result = validateMeld(meldCards, this.roundNumber);
    if (!result.valid) throw new Error(`Invalid meld: ${result.reason}`);

    // Remove from hand (splice in descending order to preserve indices)
    sorted.forEach((idx) => hand.splice(idx, 1));

    this.meldSets[playerId].push(meldCards);
    return { type: result.type, cards: meldCards };
  }

  /**
   * Move all melded cards back into the player's hand.
   */
  undoMelds(playerId) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);
    if (this.turnPhase !== 'meld-discard') throw new Error('Draw a card first');

    const sets = this.meldSets[playerId];
    sets.forEach((set) => set.forEach((card) => this.hands[playerId].push(card)));
    this.meldSets[playerId] = [];
  }

  /**
   * Discard a card from hand, ending the player's turn.
   * @param {string} playerId
   * @param {number} cardIndex  - index in this.hands[playerId]
   * @returns {{ card, roundOver, gameOver }}
   */
  discardCard(playerId, cardIndex) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);
    if (this.turnPhase !== 'meld-discard') throw new Error('Draw a card first');

    const hand = this.hands[playerId];
    if (cardIndex < 0 || cardIndex >= hand.length) throw new Error('Invalid card index');

    const card = hand.splice(cardIndex, 1)[0];
    this.discardPile.push(card);

    // Going out = player has 0 cards left in hand (all melded)
    const wentOut = hand.length === 0 && this.meldSets[playerId].length > 0;

    if (wentOut && !this.goingOutPlayerId) {
      this.goingOutPlayerId = playerId;
      // All other players get one final turn
      const nextIdx = (this.currentPlayerIndex + 1) % this.playerIds.length;
      let idx = nextIdx;
      while (idx !== this.currentPlayerIndex) {
        this.finalTurnQueue.push(this.playerIds[idx]);
        idx = (idx + 1) % this.playerIds.length;
      }
    }

    // Check if the round ends here
    const roundOver = this._advanceTurn();
    if (roundOver) {
      return { card, roundOver: true, gameOver: this.phase === 'gameOver' };
    }
    return { card, roundOver: false, gameOver: false };
  }

  /**
   * Skip the current player's turn without requiring draw/discard actions.
   * Used when the current player is disconnected.
   */
  skipCurrentTurn(playerId) {
    this._assertPlayingPhase();
    this._assertCurrentPlayer(playerId);

    const roundOver = this._advanceTurn();
    return { skipped: true, roundOver, gameOver: this.phase === 'gameOver' };
  }

  /**
   * Advances turn. Returns true if the round ended.
   */
  _advanceTurn() {
    // If a player went out, check if the current player was the last in finalTurnQueue
    if (this.goingOutPlayerId) {
      const idx = this.finalTurnQueue.indexOf(this.currentPlayerId);
      if (idx !== -1) {
        this.finalTurnQueue.splice(idx, 1);
      }
      if (this.finalTurnQueue.length === 0) {
        // Round over
        this._endRound();
        return true;
      }
    }

    // Normal turn advance
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;

    // Skip the player who went out for subsequent turns (they don't act again this round)
    if (this.goingOutPlayerId) {
      let safetyCounter = 0;
      while (
        this.currentPlayerId === this.goingOutPlayerId &&
        safetyCounter < this.playerIds.length
      ) {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerIds.length;
        safetyCounter++;
      }
    }

    this.turnPhase = 'draw';
    return false;
  }

  // ─── Round / Game End ─────────────────────────────────────────────────────

  _endRound() {
    this._calculateScores();

    const roundEntry = {
      round: this.roundNumber,
      players: this.playerIds.map((id) => ({
        id,
        roundScore: this.scores[id].roundScore,
        gameScore: this.scores[id].gameScore,
        wentOut: id === this.goingOutPlayerId,
        hand: this.hands[id].map((c) => ({ rank: c.rank, suit: c.suit })),
        meldSets: this.meldSets[id].map((set) =>
          set.map((c) => ({ rank: c.rank, suit: c.suit })),
        ),
      })),
    };
    this.scoreboardData.push(roundEntry);

    if (this.roundNumber >= this.lastRound) {
      this.phase = 'gameOver';
    } else {
      this.phase = 'roundOver';
    }
  }

  nextRound() {
    if (this.phase !== 'roundOver') throw new Error('Round is not over yet');
    this.roundNumber += 1;
    this.startRound();
  }

  _calculateScores() {
    const wildRankNum = this.roundNumber + 2;

    this.playerIds.forEach((id) => {
      let score = 0;
      // Wild rank bonus: going out gives −wildRank points
      if (id === this.goingOutPlayerId) {
        score -= wildRankNum;
      }
      // Points for remaining unmelded cards
      this.hands[id].forEach((card) => {
        if (card.rank === 'joker') {
          score += 50;
        } else if (card.rank === this.wildRank) {
          score += 20;
        } else {
          score += card.value;
        }
      });
      this.scores[id].roundScore = score;
      this.scores[id].gameScore += score;
    });
  }

  // ─── Client State ─────────────────────────────────────────────────────────

  /**
   * Returns the game state tailored for a specific player.
   * Private hand info is only included for `forPlayerId`.
   */
  toClientState(forPlayerId) {
    // Validate that forPlayerId exists in the game if provided
    if (forPlayerId && !this.playerIds.includes(forPlayerId)) {
      console.error(`[fiveCrownsGame] Warning: forPlayerId ${forPlayerId} not in this game's playerIds:`, this.playerIds);
    }

    const discardTop =
      this.discardPile.length > 0
        ? this.discardPile[this.discardPile.length - 1]
        : null;

    // Any player with no cards left after melding/discarding is considered out.
    // This supports the case where multiple players can go out in the same round.
    const outPlayerIds = this.playerIds.filter((id) => {
      const hand = this.hands[id] || [];
      const melds = this.meldSets[id] || [];
      return hand.length === 0 && melds.length > 0;
    });
    const outIdSet = new Set(outPlayerIds);

    const opponents = this.playerIds
      .filter((id) => id !== forPlayerId)
      .map((id) => ({
        id,
        handSize: this.hands[id].length,
        meldSets: this.meldSets[id],          // melds are public
        roundScore: this.scores[id].roundScore,
        gameScore: this.scores[id].gameScore,
        isOut: outIdSet.has(id),
        isCurrentTurn: id === this.currentPlayerId,
      }));

    const myHand = forPlayerId ? (this.hands[forPlayerId] ?? []) : [];
    
    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      wildRank: this.wildRank,
      cardsDealt: this.cardsDealt,
      deckSize: this.deck.length,
      discardTop,
      discardSize: this.discardPile.length,
      currentPlayerId: this.currentPlayerId,
      turnPhase: this.turnPhase,
      finalTurn: this.goingOutPlayerId !== null,
      goingOutPlayerName: this.goingOutPlayerId,
      outPlayerIds,
      myIsOut: forPlayerId ? outIdSet.has(forPlayerId) : false,

      // This player's private data
      myHand: myHand,
      myMelds: forPlayerId ? (this.meldSets[forPlayerId] ?? []) : [],
      myScore: forPlayerId ? this.scores[forPlayerId] : null,
      isMyTurn: forPlayerId ? forPlayerId === this.currentPlayerId : false,
      myTurnPhase: forPlayerId === this.currentPlayerId ? this.turnPhase : null,

      opponents,
      scoreboardData: this.scoreboardData,
    };
  }
}

module.exports = { FiveCrownsGame };
