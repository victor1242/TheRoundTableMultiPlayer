// OOP Classes for Five Crowns

class Card {
  constructor(
    suit,
    suitIcon,
    suitColour,
    rank,
    value,
    wild,
    wildValue,
    scrnref,
    styleBorder,
    bckgrndColour,
    melded,
  ) {
    this.suit = suit;
    this.suitIcon = suitIcon;
    this.suitColour = suitColour;
    this.rank = rank;
    this.value = value;
    this.wild = false;
    this.wildValue = 0;
    this.scrnref = scrnref;
    this.styleBorder = styleBorder;
    this.bckgrndColour = bckgrndColour;
    this.melded = melded;
  }
}

// Define the suits used in Five Crowns
const suits = ["spades", "clubs", "hearts", "diamonds", "stars"];

// Dummy getSuitIcon function (replace with your actual implementation)
function getSuitIcon(suit) {
  // Example: returns an array with icon and color
  switch (suit) {
    case "spades":
      return ["♠", "black"];
    case "clubs":
      return ["♣", "black"];
    case "hearts":
      return ["♥", "red"];
    case "diamonds":
      return ["♦", "red"];
    case "stars":
      return ["★", "gold"];
    default:
      return ["?", "gray"];
  }
}

class Deck {
  constructor() {
    this.cards = [];
    this.createDeck();
  }
  createDeck() {
    let ranks = [
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "jack",
      "queen",
      "king",
    ];
    let Icon, Colour;
    for (let suit of suits) {
      for (let rank of ranks) {
        Icon = getSuitIcon(suit)[0];
        Colour = getSuitIcon(suit)[1];
        this.cards.push(
          new Card(
            suit.toLowerCase(),
            Icon,
            Colour,
            String(rank).toLowerCase(),
            this.getRankValue(rank),
          ),
        );
      }
    }
    Icon = getSuitIcon("stars")[0];
    Colour = getSuitIcon("stars")[1];
    for (let i = 0; i < 3; i++) {
      this.cards.push(new Card("stars", Icon, Colour, "joker", 50));
    }
    this.cards = this.cards.concat(this.cards);
  }
  getRankValue(rank) {
    const values = {
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9,
      10: 10,
      jack: 11,
      queen: 12,
      king: 13,
      joker: 50,
    };
    return values[rank];
  }
  getWildState(rank) {
    if (rank === "joker" || this.getRankValue(rank) === this.cardsDealt)
      return true;
    else return false;
  }
  getWildValue(rank, cardsDealt) {
    if (rank === "joker") return 50;
    else if (this.getRankValue(rank) === cardsDealt) return 20;
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  draw() {
    const card = this.cards.pop();
    console.log(this.cards.length);
    console.log (card);
    updateUI();
   // const deckSizeEl = this.createDeckdocument.getElementById("deck-size");
    if (deckSizeEl) deckSizeEl.textContent = `${this.cards.length}`;
    return card;
  }
}

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hand = [];
    this.meldCards = [];
    this.roundScore = 0;
    this.gameScore = 0;
    this.IsOut = false;
    this.melding = false;
    this.meldCount = 0;
    this.meldSets = [];
    this.wildDiscard = false;
    this.wildDraw = false;
    this.wildCardUse = false;
    this.goingOutBonus = false;
    this.aiPlayer = false;
  }
  drawCard(deck) {
    this.hand.push(deck.draw());
    const deckSizeEl = document.getElementById("deck-size");
    if (deckSizeEl) deckSizeEl.textContent = `${deck.cards.length}`;
  }
  discardCard(cardIndex) {
    const card = this.hand.splice(cardIndex, 1)[0];
    const discardSizeEl = document.getElementById("discard-size");
    if (discardSizeEl) discardSizeEl.textContent = `${this.hand.length}`;
    return card;
  }
}

class GameState {
  constructor() {
    this.players = [];  
    this.currentPlayerIndex = 1;
    this.currentPlayer = this.players[this.currentPlayerIndex] || 0;
    this.newRound = true;
    this.roundOver = false;
    this.scoreboardData = []; 
    this.dealerIndex = 0;
    this.cardsDealt = 3;
    this.roundNumber = 1;
    this.deck = new Deck();
    this.discardPile = [];
    this.deck.shuffle();
    this.cardWidth = 72;
    this.cardHeight = 96;
    this.finalTurn = false;
    this.optGoingOutBonus = true; // Bonus points for going out # of cards dealt in round
    this.optDrawHint = true; // Hint to draw from deck or discard
    this.optDiscardHint = true; // Hint which card to discard
    this.optMeldHint = true; // Highlight potential melds in hand
    this.optPrompts = true; // Text prompts for player actions
  }
  addPlayer(id, name) {
    console.log(`Adding player: ID=${id}, Name=${name}`);
    this.players.push(new Player(id, name));
  }
  nextDealer() {
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
  }
}

// Expose classes to global scope for non-module usage
if (typeof window !== 'undefined') {
  window.Player = Player;
  window.GameState = GameState;
  console.log('Loaded classes.js from main folder at', new Date().toISOString());
}
