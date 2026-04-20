/**
 * gameEngine.js — Pure Five Crowns game logic
 *
 * NO DOM dependencies. No global `game` object.
 * All functions receive state as parameters and return new state / results.
 *
 * Compatible with:
 *   - Node.js  (require / CommonJS)
 *   - Browser  (<script> tag, exposed on window.GameEngine)
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUITS = ['spades', 'clubs', 'hearts', 'diamonds', 'stars'];

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];

const RANK_VALUES = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'jack': 11, 'queen': 12, 'king': 13, 'joker': 50,
};

/** Round 1 = 3 cards dealt … Round 9 = 11 cards dealt */
const FIRST_ROUND = 1;
const LAST_ROUND  = 11;

function cardsDealtForRound(roundNumber) {
  return roundNumber + 2;
}

function wildRankForRound(roundNumber) {
  return String(roundNumber + 2); // e.g. round 1 → '3', round 9 → '11' (jack)
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

class Card {
  /**
   * @param {string} suit  - 'spades' | 'clubs' | 'hearts' | 'diamonds' | 'stars'
   * @param {string} rank  - '3'..'king' | 'joker'
   * @param {number} value - point value (used for scoring)
   */
  constructor(suit, rank, value) {
    this.suit  = suit;
    this.rank  = rank;
    this.value = value;
    // UI hints carried by the card — engine sets/reads these but never touches DOM
    this.melded      = false;
    this.styleBorder = '';
    this.bckgrndColour = '';
  }

  clone() {
    const c = new Card(this.suit, this.rank, this.value);
    c.melded       = this.melded;
    c.styleBorder  = this.styleBorder;
    c.bckgrndColour = this.bckgrndColour;
    return c;
  }

  isWild(wildRank) {
    return this.rank === 'joker' || this.rank === String(wildRank);
  }
}

// ---------------------------------------------------------------------------
// Deck  (double deck of 116 cards — no DOM calls)
// ---------------------------------------------------------------------------

class Deck {
  constructor() {
    this.cards = [];
    this._build();
    // Note: caller is responsible for shuffling before use (matches existing code)
  }

  _build() {
    const half = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        half.push(new Card(suit, rank, RANK_VALUES[rank]));
      }
    }
    // 3 jokers per half-deck
    for (let i = 0; i < 3; i++) {
      half.push(new Card('stars', 'joker', 50));
    }
    // Five Crowns uses a double deck — clone each card for independent objects
    this.cards = [...half, ...half.map(c => c.clone())];
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /** Draws and returns the top card, or null if the deck is empty. */
  draw() {
    return this.cards.pop() || null;
  }

  get size() {
    return this.cards.length;
  }
}

// ---------------------------------------------------------------------------
// Meld validation  (pure — no side effects, no DOM, no global state)
// ---------------------------------------------------------------------------

/**
 * Validate whether an array of Card objects forms a legal Five Crowns meld.
 *
 * @param {Card[]} cards     - Cards the player wants to meld
 * @param {number|string} wildRank - The current round's wild rank (e.g. 3 for round 1)
 * @returns {{ valid: boolean, type?: 'set'|'run', reason?: string }}
 *
 * Rules:
 *   SET  — all non-wild cards share the same rank (suits may vary)
 *   RUN  — all non-wild cards share the same suit with consecutive ranks;
 *           wilds / jokers fill gaps
 *   Minimum 3 cards total (including wilds).
 *   Jokers and the current round's rank card both act as wilds.
 */
function validateMeld(cards, wildRank) {
  if (!Array.isArray(cards) || cards.length < 3) {
    return { valid: false, reason: 'Need at least 3 cards' };
  }

  const wRank    = String(wildRank);
  const wilds    = cards.filter(c => c.rank === 'joker' || c.rank === wRank);
  const nonWilds = cards.filter(c => c.rank !== 'joker' && c.rank !== wRank);

  const rankVal = r => {
    if (r === 'jack')  return 11;
    if (r === 'queen') return 12;
    if (r === 'king')  return 13;
    return Number(r);
  };

  const uniqueRanks = [...new Set(nonWilds.map(c => c.rank))];
  const uniqueSuits = [...new Set(nonWilds.map(c => c.suit))];

  // All-wild meld (e.g. three jokers) — valid set
  if (nonWilds.length === 0) {
    return { valid: true, type: 'set' };
  }

  // SET: all non-wilds have the same rank
  if (uniqueRanks.length === 1) {
    return { valid: true, type: 'set' };
  }

  // RUN: all non-wilds share a suit, with consecutive ranks (wilds fill gaps)
  if (uniqueSuits.length === 1) {
    const values = nonWilds.map(c => rankVal(c.rank)).sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i - 1] - 1;
    }
    if (gaps <= wilds.length) {
      return { valid: true, type: 'run' };
    }
    return { valid: false, reason: 'Run has too many gaps for available wilds' };
  }

  return { valid: false, reason: 'Cards do not form a valid set or run' };
}

// ---------------------------------------------------------------------------
// Scoring  (pure)
// ---------------------------------------------------------------------------

/**
 * Calculate the round score for one player.
 * Unmelded cards in hand count against the player; going-out earns a bonus.
 *
 * @param {object}  player              - { hand: Card[], meldSets: Card[][], IsOut: boolean }
 * @param {number}  wildRank            - numeric wild rank for this round
 * @param {boolean} optGoingOutBonus    - whether going-out bonus is enabled
 * @returns {number} score (can be negative if going-out bonus applies)
 */
function calculateRoundScore(player, wildRank, optGoingOutBonus) {
  const wRank = Number(wildRank);
  let score = 0;

  if (player.IsOut && optGoingOutBonus) {
    score -= wRank; // bonus: subtract the wild rank value
  }

  for (const card of (player.hand || [])) {
    if (!card) continue;
    if (card.rank === 'joker')      score += 50;
    else if (card.value === wRank)  score += 20;
    else                            score += (card.value || 0);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Deal helpers  (pure — mutate objects passed in, no DOM)
// ---------------------------------------------------------------------------

/**
 * Deal numCards from deck into player.hand.
 * Does NOT call any display function.
 */
function dealToPlayer(player, deck, numCards) {
  for (let i = 0; i < numCards; i++) {
    const card = deck.draw();
    if (card) player.hand.push(card);
  }
}

/**
 * Set up a fresh round: reset deck, deal hands, place first discard.
 *
 * @param {object[]} players      - array of player objects (hand/meldSets will be reset)
 * @param {number}   roundNumber  - current round (1–11)
 * @returns {{ deck: Deck, discardPile: Card[], cardsDealt: number }}
 */
function setupRound(players, roundNumber) {
  const deck = new Deck();
  deck.shuffle();

  const numCards = cardsDealtForRound(roundNumber);

  // Reset all player hands
  for (const p of players) {
    p.hand      = [];
    p.meldCards = [];
    p.meldSets  = [];
    p.meldCount = 0;
    p.IsOut     = false;
  }

  // Deal hands
  for (const p of players) {
    dealToPlayer(p, deck, numCards);
  }

  // Initial discard
  const firstDiscard = deck.draw();
  const discardPile  = firstDiscard ? [firstDiscard] : [];

  return { deck, discardPile, cardsDealt: numCards };
}

// ---------------------------------------------------------------------------
// Discard pile helpers  (pure)
// ---------------------------------------------------------------------------

/**
 * Move all but the top discard card back into the deck and shuffle.
 * Mutates both deck and discardPile in place.
 */
function reshuffleDiscardIntoDeck(deck, discardPile) {
  // Keep only the top card on the discard pile
  while (discardPile.length > 1) {
    deck.cards.push(discardPile.shift());
  }
  deck.shuffle();
}

/**
 * Draw the top card from the discard pile.
 * Returns the card or null if the pile is empty.
 */
function drawFromDiscard(discardPile) {
  if (!discardPile || discardPile.length === 0) return null;
  return discardPile.pop();
}

/**
 * Place a card on top of the discard pile.
 */
function placeOnDiscard(discardPile, card) {
  discardPile.push(card);
}

// ---------------------------------------------------------------------------
// Turn advancement  (pure — returns next state, no callbacks)
// ---------------------------------------------------------------------------

/**
 * Compute the index of the next active player.
 * Skips players who have already gone out (IsOut = true).
 *
 * @param {number}   currentIndex
 * @param {object[]} players
 * @returns {number} next player index
 */
function nextPlayerIndex(currentIndex, players) {
  const count = players.length;
  let next = (currentIndex + 1) % count;
  // Avoid infinite loop if all players are somehow out
  for (let tries = 0; tries < count; tries++) {
    if (!players[next].IsOut) return next;
    next = (next + 1) % count;
  }
  return next; // fallback
}

/**
 * Determine whether the round is over.
 * The round ends when play returns to the player who went out.
 *
 * @param {number}   newPlayerIndex  - the index we just advanced to
 * @param {object[]} players
 * @returns {boolean}
 */
function isRoundOver(newPlayerIndex, players) {
  return Boolean(players[newPlayerIndex] && players[newPlayerIndex].IsOut);
}

// ---------------------------------------------------------------------------
// Wild / value helpers  (pure)
// ---------------------------------------------------------------------------

function isWild(card, wildRank) {
  return card.rank === 'joker' || card.rank === String(wildRank);
}

function cardDisplayValue(card, wildRank) {
  if (card.rank === 'joker') return 50;
  if (card.rank === String(wildRank)) return 20;
  return card.value || 0;
}

// ---------------------------------------------------------------------------
// Export — works in both Node.js and browser
// ---------------------------------------------------------------------------

const GameEngine = {
  // Constants
  SUITS,
  RANKS,
  RANK_VALUES,
  FIRST_ROUND,
  LAST_ROUND,
  cardsDealtForRound,
  wildRankForRound,
  // Classes
  Card,
  Deck,
  // Pure functions
  validateMeld,
  calculateRoundScore,
  dealToPlayer,
  setupRound,
  reshuffleDiscardIntoDeck,
  drawFromDiscard,
  placeOnDiscard,
  nextPlayerIndex,
  isRoundOver,
  isWild,
  cardDisplayValue,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
} else if (typeof window !== 'undefined') {
  window.GameEngine = GameEngine;
}
