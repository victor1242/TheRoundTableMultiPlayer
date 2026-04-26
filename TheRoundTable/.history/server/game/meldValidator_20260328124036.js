'use strict';

/**
 * Validates whether a group of cards forms a legal Five Crowns meld.
 * Ported from the client-side validateMeld() in functions.js.
 *
 * @param {Array<{rank:string, suit:string}>} group  - Cards to validate
 * @param {number} roundNumber  - Current round (1-9); wild rank = roundNumber + 2
 * @returns {{ valid: boolean, type?: 'set'|'run' }}
 */
function validateMeld(group, roundNumber) {
  if (!group || group.length < 3) {
    return { valid: false, reason: 'Need at least 3 cards' };
  }

  const wildRank = String(roundNumber + 2);

  const jokers = group.filter((c) => c.rank === 'joker' || c.rank === wildRank);
  const nonJokers = group.filter((c) => c.rank !== 'joker' && c.rank !== wildRank);

  const rankValue = (r) => {
    if (r === 'jack') return 11;
    if (r === 'queen') return 12;
    if (r === 'king') return 13;
    return Number(r);
  };

  const uniqueRanks = [...new Set(nonJokers.map((c) => c.rank))];
  const uniqueSuits = [...new Set(nonJokers.map((c) => c.suit))];

  // Set: all non-jokers same rank (distinct suits), or all jokers/wilds
  if (uniqueRanks.length === 0 && uniqueSuits.length === nonJokers.length) {
    return { valid: true, type: 'set' };
  }
  if (
    nonJokers.length > 0 &&
    uniqueRanks.length === 1 &&
    group.length >= 3 &&
    nonJokers.length + jokers.length === group.length
  ) {
    return { valid: true, type: 'set' };
  }

  // Run: same suit, consecutive ranks (jokers fill gaps)
  if (uniqueSuits.length === 1) {
    const values = nonJokers.map((c) => rankValue(c.rank)).sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i - 1] - 1;
    }
    if (gaps <= jokers.length) {
      return { valid: true, type: 'run' };
    }
    return { valid: false, reason: 'Too many gaps in run' };
  }

  return { valid: false, reason: 'Not a valid set or run' };
}

module.exports = { validateMeld };
