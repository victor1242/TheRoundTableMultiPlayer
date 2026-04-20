// AI Meld Planning System for Five Crowns
// This module provides intelligent card melding strategies for AI players
//
// FIVE CROWNS RULE: A discard is ALWAYS mandatory at the end of every turn.
// A player cannot meld their entire hand - at least 1 card must remain to discard.
// Going out means melding all-but-one card, then discarding that last card.
// selectBestMeld() enforces this by filtering out any meld where remainingCards === 0.
// findPossibleMelds() intentionally returns ALL combinations including remainingCards === 0
// so callers have full information, but selectBestMeld() must always be used to pick
// the actual meld to play.

/**
 * Analyzes a player's hand and finds all possible valid melds.
 * NOTE: Returns ALL valid combinations including ones that would meld the entire hand
 * (remainingCards === 0). Callers must NOT play a meld with remainingCards === 0 directly
 * as a discard is always mandatory. Use selectBestMeld() which enforces this rule.
 * @param {Array} hand - Array of Card objects
 * @param {number} wildRank - The rank value that acts as wild (roundNumber + 2)
 * @returns {Array} Array of meld objects with cards, indices, type, and remaining card count
 */
function findPossibleMelds(hand, wildRank) {
  if (!hand || hand.length < 3) return [];
  
  const melds = [];
  const handSize = hand.length;
  
  // Try all possible combinations of 3+ cards
  for (let size = 3; size <= handSize; size++) {
    const combinations = getCombinations(hand, size);
    
    for (const combo of combinations) {
      const validation = validateMeld(combo.cards, { silent: true });
      
      if (validation.valid) {
        melds.push({
          cards: combo.cards,
          indices: combo.indices,
          type: validation.type,
          remainingCards: handSize - size,
          size: size
        });
      }
    }
  }
  
  return melds;
}

/**
 * Generates all combinations of specified size from hand
 * @param {Array} hand - Array of cards
 * @param {number} size - Size of combinations to generate
 * @returns {Array} Array of {cards, indices} objects
 */
function getCombinations(hand, size) {
  const results = [];
  
  function combine(start, chosen, chosenIndices) {
    if (chosen.length === size) {
      results.push({
        cards: [...chosen],
        indices: [...chosenIndices]
      });
      return;
    }
    
    for (let i = start; i < hand.length; i++) {
      chosen.push(hand[i]);
      chosenIndices.push(i);
      combine(i + 1, chosen, chosenIndices);
      chosen.pop();
      chosenIndices.pop();
    }
  }
  
  combine(0, [], []);
  return results;
}

/**
 * Evaluates the strategic value of a card
 * @param {Card} card - The card to evaluate
 * @param {number} wildRank - The wild rank for this round
 * @returns {number} Strategic value (higher = more valuable to keep)
 */
function evaluateCardValue(card, wildRank) {
  if (!card) return 0;
  
  // Wild cards are extremely valuable
  if (card.rank === "joker") return 50;
  if (card.value === wildRank) return 20;
  
  // Face cards are less flexible
  if (card.rank === "king") return 13;
  if (card.rank === "queen") return 12;
  if (card.rank === "jack") return 11;
  
  // Number cards by value
  return card.value || 0;
}

/**
 * Chooses the best card to discard from hand
 * @param {Array} hand - Player's current hand
 * @param {number} wildRank - The wild rank for this round
 * @param {boolean} isFinalTurn - Whether this is the final turn phase
 * @returns {number} Index of card to discard
 */
function chooseCardToDiscard(hand, wildRank, isFinalTurn = false) {
  if (!hand || hand.length === 0) return 0;
  if (hand.length === 1) return 0;
  
  // Count card frequencies by rank and suit
  const rankCounts = {};
  const suitCounts = {};
  
  hand.forEach(card => {
    const rank = card.rank;
    const suit = card.suit;
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    suitCounts[suit] = (suitCounts[suit] || 0) + 1;
  });
  
  // Score each card for discarding (higher score = better to discard)
  const cardScores = hand.map((card, idx) => {
    let score = 0;
    
    // Never discard wilds unless it's final turn or only option
    const isWild = card.rank === "joker" || card.value === wildRank;
    if (isWild && !isFinalTurn) {
      return { idx, score: -1000 };
    }
    
    // Prefer discarding high-value cards to reduce penalty
    score += card.value || 0;
    
    // Prefer discarding singletons (cards with no matching rank/suit)
    if (rankCounts[card.rank] === 1) score += 5;
    if (suitCounts[card.suit] === 1) score += 3;
    
    // Prefer discarding cards that don't fit sequences
    const hasSequencePotential = checkSequencePotential(card, hand, wildRank);
    if (!hasSequencePotential) score += 8;
    
    return { idx, score };
  });
  
  // Sort by score (descending) and return index of best discard
  cardScores.sort((a, b) => b.score - a.score);
  return cardScores[0].idx;
}

/**
 * Checks if a card has potential to form a sequence
 * @param {Card} card - Card to check
 * @param {Array} hand - Full hand
 * @param {number} wildRank - Wild rank value
 * @returns {boolean} True if card could form a run
 */
function checkSequencePotential(card, hand, wildRank) {
  if (card.rank === "joker" || card.value === wildRank) return true;
  
  const cardValue = card.value;
  const cardSuit = card.suit;
  
  // Check for adjacent cards in same suit
  for (const otherCard of hand) {
    if (otherCard === card) continue;
    
    const isWild = otherCard.rank === "joker" || otherCard.value === wildRank;
    if (isWild) return true;
    
    if (otherCard.suit === cardSuit) {
      const valueDiff = Math.abs(otherCard.value - cardValue);
      if (valueDiff <= 2) return true; // Adjacent or one gap
    }
  }
  
  return false;
}

/**
 * Determines if AI should attempt to meld
 * @param {Array} hand - Current hand
 * @param {Array} meldSets - Already melded sets
 * @param {number} wildRank - Wild rank value
 * @returns {boolean} True if should attempt meld
 */
function shouldAttemptMeld(hand, meldSets, wildRank) {
  // Always try to meld if we have enough cards
  if (hand.length < 3) return false;
  
  // Check if we can form any valid melds
  const possibleMelds = findPossibleMelds(hand, wildRank);
  return possibleMelds.length > 0;
}

/**
 * Determines if AI should unmeld and remeld for better combinations
 * @param {Array} hand - Current hand
 * @param {Array} meldSets - Current meld sets
 * @param {number} wildRank - Wild rank value
 * @returns {boolean} True if should unmeld
 */
function shouldUnmeldAndRemeld(hand, meldSets, wildRank) {
  if (!meldSets || meldSets.length === 0) return false;
  
  // Combine all cards (hand + melds)
  const allCards = [...hand];
  meldSets.forEach(meld => {
    if (Array.isArray(meld)) {
      allCards.push(...meld);
    }
  });
  
  // Find best possible melds with all cards
  const newMelds = findPossibleMelds(allCards, wildRank);
  
  // Calculate current melded count
  let currentMeldedCount = 0;
  meldSets.forEach(meld => {
    if (Array.isArray(meld)) currentMeldedCount += meld.length;
  });
  
  // Check if we can meld more cards by remelding
  for (const meld of newMelds) {
    if (meld.size > currentMeldedCount) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determines if AI should take a card from discard pile
 * @param {Card} discardCard - Top card of discard pile
 * @param {Array} hand - Current hand
 * @param {number} wildRank - Wild rank value
 * @returns {boolean} True if should take discard
 */
function shouldTakeDiscard(discardCard, hand, wildRank, forceDrawFromDeck = false) {
  if (!discardCard) return false;
  
  // Deadlock override: caller detected a cycle, force draw from deck
  if (forceDrawFromDeck) return false;

  // Always take wild cards UNLESS hand is already a going-out hand —
  // taking a wild when you can already go out forces discarding a valuable card
  if (discardCard.rank === "joker" || discardCard.value === wildRank) {
    const wildsCheck = findPossibleMelds(hand, wildRank);
    const alreadyWinning = wildsCheck.some(function(m) { return m.remainingCards <= 1; });
    if (alreadyWinning) return false;
    return true;
  }
  
  // If hand already has a going-out meld, don't take the discard —
  // drawing from deck keeps the winning hand intact and avoids gifting a wild to the next player
  const currentMelds = findPossibleMelds(hand, wildRank);
  const alreadyGoingOut = currentMelds.some(function(m) { return m.remainingCards <= 1; });
  if (alreadyGoingOut) return false;

  // Check if discard card participates in a NEW meld (not just inflates count)
  const testHand = [...hand, discardCard];
  const melds = findPossibleMelds(testHand, wildRank);
  
  // Only take if a meld exists that actually contains the discard card
  const discardIsUseful = melds.some(function(meld) {
    return meld.cards.includes(discardCard);
  });

  return discardIsUseful;
}

/**
 * Selects the best meld from available options.
 * ENFORCES the mandatory discard rule: any meld leaving 0 cards is excluded
 * because a player must always discard at least 1 card to end their turn.
 * Going out = meld down to 1 card, then discard that card.
 * @param {Array} possibleMelds - Array of possible meld objects (from findPossibleMelds)
 * @param {number} wildRank - Wild rank value
 * @returns {Object|null} Best meld object (always remainingCards >= 1), or null if none valid
 */
function selectBestMeld(possibleMelds, wildRank) {
  if (!possibleMelds || possibleMelds.length === 0) return null;
  
  // A discard is always mandatory - never meld all cards (remainingCards === 0)
  const validMelds = possibleMelds.filter(m => m.remainingCards >= 1);
  if (validMelds.length === 0) return null;

  // Priority 1: Melds that leave 1 card (going out with mandatory discard)
  const oneCardLeftMelds = validMelds.filter(m => m.remainingCards === 1);
  if (oneCardLeftMelds.length > 0) {
    // Among these, prefer leaving a low-value card
    return oneCardLeftMelds.reduce((best, current) => {
      const bestRemaining = getRemainingCards(best.cards, best.indices, validMelds[0].cards.length + best.remainingCards);
      const currentRemaining = getRemainingCards(current.cards, current.indices, validMelds[0].cards.length + current.remainingCards);
      
      const bestValue = bestRemaining[0] ? evaluateCardValue(bestRemaining[0], wildRank) : 999;
      const currentValue = currentRemaining[0] ? evaluateCardValue(currentRemaining[0], wildRank) : 999;
      
      return currentValue < bestValue ? current : best;
    });
  }
  
  // Priority 2: Largest meld (most cards melded)
  return validMelds.reduce((best, current) => {
    return current.size > best.size ? current : best;
  });
}

/**
 * Gets remaining cards after a meld
 * @param {Array} meldCards - Cards in the meld
 * @param {Array} meldIndices - Indices of melded cards
 * @param {number} totalCards - Total cards in hand
 * @returns {Array} Remaining cards
 */
function getRemainingCards(meldCards, meldIndices, totalCards) {
  // This is a helper - in practice, you'd reconstruct from the full hand
  // For now, return empty array as placeholder
  return [];
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findPossibleMelds,
    evaluateCardValue,
    chooseCardToDiscard,
    shouldAttemptMeld,
    shouldUnmeldAndRemeld,
    shouldTakeDiscard,
    selectBestMeld
  };
}

// Also expose to window for browser usage
if (typeof window !== 'undefined') {
  window.AIMeldPlanner = {
    findPossibleMelds,
    evaluateCardValue,
    chooseCardToDiscard,
    shouldAttemptMeld,
    shouldUnmeldAndRemeld,
    shouldTakeDiscard,
    selectBestMeld
  };
}
