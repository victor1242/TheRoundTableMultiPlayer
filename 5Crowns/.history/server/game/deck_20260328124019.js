'use strict';

// Server-side Card and Deck for Five Crowns
// Matches the structure used in client-side classes.js

const SUITS = ['spades', 'clubs', 'hearts', 'diamonds', 'stars'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];

const RANK_VALUES = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'jack': 11, 'queen': 12, 'king': 13, 'joker': 50,
};

function rankValue(rank) {
  return RANK_VALUES[rank] ?? 0;
}

function createCard(suit, rank) {
  return { suit, rank, value: rankValue(rank) };
}

/**
 * Creates a shuffled Five Crowns deck.
 * Five Crowns uses 2× (5 suits × 11 ranks + 3 jokers) = 116 cards.
 */
function createDeck() {
  const half = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      half.push(createCard(suit, rank));
    }
  }
  // 3 jokers per half-deck
  for (let i = 0; i < 3; i++) {
    half.push(createCard('stars', 'joker'));
  }
  // Double the deck
  const cards = [...half, ...half.map((c) => ({ ...c }))];
  return cards;
}

function shuffleDeck(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { createDeck, shuffleDeck, rankValue, createCard, SUITS, RANKS };
