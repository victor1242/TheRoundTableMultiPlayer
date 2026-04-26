// Helper to get wild rank text for a round
function getRoundWildText(roundNum) {
  let wild = '';
  if (roundNum <= 8) wild = String(roundNum + 2);
  else if (roundNum === 9) wild = 'Jack';
  else if (roundNum === 10) wild = 'Queen';
  else if (roundNum === 11) wild = 'King';
  let wildText = '';
  if (roundNum <= 8) wildText = `${wild}s and Jokers`;
  else wildText = `${wild}s and Jokers`;
  return `Round: ${roundNum} - Wilds: ${wildText}`;
}
let x = 0;

// Store hand history for all rounds
let handHistory = [];

function addHandsToHistory(roundNumber) {
  if (!game || !game.players) return;
  // Store cards left in hand (unmelded) for each player
  const roundHands = game.players.map(player => ({
    name: player.name,
    hand: (player.hand || []).map(card => ({rank: card.rank, suit: card.suit})),
    roundscore: player.roundscore,
    gamescore: player.gamescore
  }));
  handHistory.push({ round: roundNumber, hands: roundHands });
  renderHandHistory();
}

function renderHandHistory() {
  const panel = document.getElementById('hand-history-list');
  if (!panel) return;
  panel.innerHTML = '';
  handHistory.forEach((entry, roundIdx) => {
    const roundDiv = document.createElement('div');
    roundDiv.style.marginBottom = '8px';
    roundDiv.innerHTML = `<b>Round ${entry.round}</b>`;
    (entry.hands || []).forEach(pm => {
      // Calculate hand score
      let handScore = 0;
      if (pm.hand && pm.hand.length > 0) {
        for (const card of pm.hand) {
          if (card.rank === "joker") handScore += 50;
          else if (card.rank === "jack") handScore += 11;
          else if (card.rank === "queen") handScore += 12;
          else if (card.rank === "king") handScore += 13;
          else handScore += Number(card.rank) || 0;
        }
      }
      // Try to get roundscore and gamescore from player object if available
      let roundscore = '';
      let gamescore = '';
      // Try to get from latest game.players if available
      if (window.game && window.game.players) {
        const pl = window.game.players.find(p => p.name === pm.name);
        if (pl) {
          roundscore = pl.roundscore !== undefined ? pl.roundscore : '';
          gamescore = pl.gamescore !== undefined ? pl.gamescore : '';
        }
      }
      // Fallback: try to get from handHistory if stored (not always possible)
      if (pm.roundscore !== undefined) roundscore = pm.roundscore;
      if (pm.gamescore !== undefined) gamescore = pm.gamescore;
      const handStr = (pm.hand && pm.hand.length > 0)
        ? pm.hand.map(card => `${card.rank}-${card.suit}`).join(', ')
        : '[No cards left]';
      const pdiv = document.createElement('div');
      pdiv.style.fontSize = '90%';
      // Format: +round total/+game total – cards in hand
      let roundDisp = roundscore !== '' ? `+${roundscore}` : '';
      let gameDisp = gamescore !== '' ? `/+${gamescore}` : '';
      pdiv.textContent = `${pm.name}: ${roundDisp}${gameDisp} – ${handStr}`;
      roundDiv.appendChild(pdiv);
    });
    panel.appendChild(roundDiv);
  });
}
// Global debug flag for optional diagnostics

// ...existing code...

// Debug logs for round transitions (must be after DEBUG is initialized)
function logCompleteRoundAndDeal() {
  logCompleteRoundAndDeal();
}
function logFinalizeRoundAfterFinalTurns() {
  logFinalizeRoundAfterFinalTurns();
}
completeRoundAndDeal// Helper: Check if all final turns are complete and advance round if so
function checkAdvanceAfterFinalTurn() {
  if (game.finalTurnQueue && game.finalTurnQueue.length === 0) {
    finalizeRoundAfterFinalTurns();
    return true;
  }
  return false;
}

// --- End-of-round logic ---
function endRound() {
  // Calculate scores for each player (sum of card values in hand)
  const roundResults = [];
  if (!game || !game.players) return { roundResults };
  game.players.forEach(player => {
    // Only count unmelded cards for scoring
    if (DEBUG) {
      const handDesc = player.hand.map(c => `${c.rank}-${c.suit}(${c.value})`).join(', ');
      console.log(`[endRound] ${player.name} final hand: [${handDesc}]`);
    }
    let handScore = player.hand.reduce((sum, c) => sum + (c.value || 0), 0);
    showmessage(`[endRound] ${player.name} handScore: ${handScore}`);
    // Set roundscore to this round's score, and add to gamescore
    player.roundscore = handScore;
    player.gamescore = (player.gamescore || 0) + handScore;
    roundResults.push({
      name: player.name,
      handScore,
      roundscore: player.roundscore,
      gamescore: player.gamescore
    });
  });
  // Do not increment roundCount here; it is handled in startRound
  return { roundResults };
}

function showRoundResults(roundResults) {
  // Update round number UI
  const roundNum = document.getElementById('round-number');
  if (roundNum) {
    roundNum.textContent = 'Round: ' + roundCount;
  }
  // Show hand history panel only at end of round
  let panel = document.getElementById('hand-history-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'hand-history-panel';
    panel.style.maxHeight = '200px';
    panel.style.overflowY = 'auto';
    panel.style.border = '1px solid #888';
    panel.style.margin = '10px';
    panel.style.padding = '8px';
    panel.style.background = '#f9f9f9';
    panel.style.color = '#222';
    panel.innerHTML = '<h3>Hand History</h3><div id="hand-history-list"></div>';
    document.body.insertBefore(panel, document.body.firstChild);
  }
  renderHandHistory();
  // Optionally, show a popup or message
  let msg = 'End of round!\n';
  msg += roundResults.map(r => `${r.name}: +${r.handScore} (Total: ${r.totalScore})`).join('\n');
  showMessage(msg);
}
// Update dealer indicator at the top
function updateDealerIndicator() {
  const dealerDiv = document.getElementById('dealer-indicator');
  if (!dealerDiv || !window.game || !window.game.dealerId) {
    if (dealerDiv) dealerDiv.textContent = '';
    return;
  }
  const dealer = window.game.players.find(p => p.id === window.game.dealerId);
  if (dealer) {
    dealerDiv.textContent = `Current Dealer: ${dealer.name}`;
  } else {
    dealerDiv.textContent = '';
  }
}
// Suits used in Five Crowns
// Global debug flag for optional diagnostics
let DEBUG = false; // Set to true to enable debug logs
const suits = ['stars', 'hearts', 'clubs', 'spades', 'diamonds'];
// showMessage implementation using alert, only if DEBUG is true
function showMessage(msg) {
  if (DEBUG) alert(msg);
}

// Helper for debug/info logging (does nothing unless DEBUG is true)
function showmessage(...args) {
  if (DEBUG) {
    if (args.length === 1) {
      console.log(args[0]);
    } else {
      console.log(...args);
    }
  }
}

// Update the score summary display (all players)
const UseAlt = false;
const directory = '';
const cardWidth = 40;
const cardHeight = 60;

class Card {  
    constructor(suit, rank, value)
     {
        this.suit = suit;
        this.rank = rank;
        this.value = value;
    }
  }
  
// Deck class to handle card creation and shuffling

class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
    }

    createDeck() {
        let ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'jack','queen','king'];
        for (let suit of suits) {
            for (let rank of ranks) {
                this.cards.push(new Card(suit.toLowerCase(), String(rank).toLowerCase(), this.getRankValue(rank)));
            }
        }
        for (let i = 0; i < 3; i++) {
            this.cards.push(new Card('stars', 'joker', 50));
        }
        // double the deck
        this.cards = this.cards.concat(this.cards);
    
    }

    getRankValue(rank) {
        const values = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'jack': 11, 'queen': 12, 'king': 13};
        return values[rank];
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

// Player class to manage hand and ID
class Player {
    constructor(id, name) {
      this.id = id;
      this.name = name;
      this.hand = [];
      this.roundscore = 0;
      this.gamescore

      this.melds = []; // array of meld groups (each group is array of Card)
      this.canDraw = false;
      this.canDiscard = false;
    }

    drawCard(deck) {
        this.hand.push(deck.draw());
    }

    discardCard(cardIndex) {
      return this.hand.splice(cardIndex, 1)[0];
    }
    
}

// GameState class to manage the overall game rules and turn logic
class GameState {
    constructor() {
        this.players = [];
        this.ActivePlayer = 0;
        this.deck = new Deck();
        this.discardPile = [];
    this.turn = 0;
    this.turnNumber = 1; // increments each player-turn so we can track per-turn actions
        this.deck.shuffle();
    }

    addPlayer(id, name) {
        this.players.push(new Player(id, name));
    }

    nextTurn() {
        this.ActivePlayer = (this.ActivePlayer + 1) % this.players.length;
    }
}


function draw() {
    showmessage(`[draw] (START) game.ActivePlayer=${game.ActivePlayer}, name=${game.players[game.ActivePlayer]?.name}`);
    const active = game.players[game.ActivePlayer];
    // Log before hand size check
        if (DEBUG) {
          console.log(`[draw] Pre hand-size check: Player ${game.ActivePlayer} (${active.name}) hand length=${active.hand.length}, limit=${GameRound + 3}`);
          // Diagnostic: log canDraw/canDiscard for all players on every draw attempt
          console.log('[draw] Player flags:');
          game.players.forEach((p, idx) => {
            console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
          });
          console.log(`[draw] Active player: ${game.ActivePlayer}, name: ${active?.name}, canDraw: ${active?.canDraw}`);
        }
  if (!active) return;
  showmessage(`[draw] Before draw: Player ${game.ActivePlayer} (${active.name}) canDraw=${active.canDraw}, canDiscard=${active.canDiscard}`);
  if (!active.canDraw) { showMessage(
    `${game.players[game.ActivePlayer].name} you can draw only once per turn`
  ); return; }
  // allow draw when hand equals GameRound + 3 (player draws one then must discard)
    if (active.hand.length > GameRound + 3) { 
      showmessage(`[discard handler] Player ${active.name} (${active.id}) cannot draw: hand exceeds limit.`);
      showMessage('Cannot draw: hand already exceeds draw limit'); 
      return; 
    }
  const card = game.deck.draw();
  if (!card) { showMessage('Deck is empty'); return; }
  showmessage(
    `[draw] (PUSH) Adding card to player index ${game.ActivePlayer} (${active.name}) hand.`
  );
  active.hand.push(card);
  showmessage(`[draw] Card ${card.rank}-${card.suit} added to player ${active.name} (index ${game.ActivePlayer}). Hand now: [${active.hand.map(c => c.rank + '-' + c.suit).join(', ')}]`);
  // after drawing, disable further draws and enable discard
  active.canDraw = false;
  showmessage(`[canDraw=false] Set for Player ${game.ActivePlayer} (${active.name}) in draw()`);
  console.trace();
  active.canDiscard = true;
  // Remove deck click handler to prevent double draw
  let deckEl = document.getElementById('deck');
  if (deckEl) deckEl.onclick = null;
  showmessage(`[draw] After draw: Player ${game.ActivePlayer} (${active.name}) canDraw=${active.canDraw}, canDiscard=${active.canDiscard}`);
  if (DEBUG) {
    game.players.forEach((p, idx) => {
      console.log(`[draw] Player ${idx} (${p.name}) hand:`, p.hand.map(c => `${c.rank}-${c.suit}`));
    });
  }
  renderPlayerHand(active);
  // Also refresh all hands to ensure discard click handler is enabled
  renderAllHands();
  // Enable meld button for active player if they can discard (i.e., after drawing, before discarding)
  const meldBtn = document.getElementById('meld-btn');
  if (meldBtn && isActivePlayer(active) && active.canDiscard) {
    meldBtn.disabled = false;
    meldBtn.style.display = '';
  } else if (meldBtn) {
    meldBtn.disabled = true;
  }
  // Log after successful draw
  showmessage(`[draw] SUCCESS: Player ${game.ActivePlayer} (${active.name}) drew a card. Updated flags: canDraw=${active.canDraw}, canDiscard=${active.canDiscard}`);
}

function discard() {
  const active = game.players[game.ActivePlayer];
  if (!active) return;
  // Only allow picking up from discard pile if canDraw is true
  if (!active.canDraw) { showMessage('You must draw only once per turn'); return; }
  if (active.hand.length > GameRound + 3) { showMessage('Cannot pick up discard: hand already exceeds draw limit'); return; }
  const card = game.discardPile.pop();
  if (!card) { showMessage('No card on discard pile'); return; }
  active.hand.push(card);
  active.canDraw = false;
  active.canDiscard = true;
  renderPlayerHand(active);
  renderAllHands(); // Ensure discard click handler is enabled
  // update discard pile DOM to show new top or clear if empty
  if (game.discardPile.length > 0) {
    const top = game.discardPile[game.discardPile.length - 1];
    updateDiscardPile(top);
  } else {
    const discEl = document.getElementById('discard');
    if (discEl) discEl.innerHTML = '';
  }
}

//===================== G A M E   S T A R T =============================
let waitingForPlayers = true;
let CardDealingDone = false;
let GameRound = 3; // number of cards to deal this round (start at 3 for round 1)
let roundCount = 1; // actual round number (1-based, start at 1)
let cardAlt = "";
let cardSrc = ""; 
let dragEnabled = false

// Add missing autoPlay variable to prevent ReferenceError
let autoPlay = false;

// GAME START

    document.addEventListener('DOMContentLoaded', function() {
      // Remove score summary display if present (prevents redundant display after reload)
      //const scoreSummary = document.getElementById('score-summary');
      //if (scoreSummary) scoreSummary.remove();

      const deckEl = document.getElementById("deck");
      if (deckEl) {
        deckEl.addEventListener("click", draw);
      } else {
        console.warn("[Five Crowns] Missing #deck element for draw handler");
      }

      const discardEl = document.getElementById("discard");
      if (discardEl) {
        discardEl.addEventListener("click", discard);
      } else {
        console.warn("[Five Crowns] Missing #discard element for discard handler");
      }

      const meldBtn = document.getElementById("meld-btn");
      if (meldBtn) {
        meldBtn.addEventListener("click", Meld);
      } else {
        console.warn("[Five Crowns] Missing #meld-btn element for Meld handler");
      }

      const unMeldBtn = document.getElementById("unMeld");
      if (unMeldBtn) {
        unMeldBtn.addEventListener("click", unMeld);
      } else {
        console.warn("[Five Crowns] Missing #unMeld element for unMeld handler");
      }
    });

  while (waitingForPlayers) {
 
    waitingForPlayers = false;
  }
  // create double deck with 6 jokers
  // shuffle deck

  const game = new GameState();
  game.addPlayer("p1", "Victor");
  game.addPlayer("p2", "Alice");
  game.addPlayer("p3", "Bob");
  window.game = game; // Make game globally accessible for UI updates
  // Set dealerId to the first active player on reload/start
  game.dealerId = game.players[game.ActivePlayer].id;

  // Remove any existing player panels and hand history panel to prevent duplicates
  const oldPlayersContainer = document.getElementById('players-container');
  if (oldPlayersContainer) oldPlayersContainer.remove();
  const oldHandHistoryPanel = document.getElementById('hand-history-panel');
  if (oldHandHistoryPanel) oldHandHistoryPanel.remove();

  // Render player panels (name + score) and mark the active player
  game.players.forEach(p => displayPlayer(p));
  setActivePlayer(game.players[game.ActivePlayer].id);

  // Only reset GameRound and roundCount on a true new game
  window.resetGameCounters = function() {
    GameRound = 3;
    roundCount = 1;
  };
  window.resetGameCounters();

// firstRound must be accessible to startRound and resetFirstRound
let firstRound = true;

  // Ensure firstRound is reset if a new game is started
  window.resetFirstRound = function() { firstRound = true; };
  function startRound() {
      showmessage(`[startRound] firstRound=${firstRound}, roundCount=${roundCount}`);
    // Log all player flags after round start
    if (DEBUG) {
      console.log('[startRound] Player flags after round start:');
      game.players.forEach((p, idx) => {
        console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
      });
    }
      if (DEBUG) {
        if (DEBUG) {
          console.log('[startRound] Player flags after round start:');
          game.players.forEach((p, idx) => {
            console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
          });
        }
      }
    // Log every deck click
    if (DEBUG) {
      console.log('[draw] Deck clicked');
      console.log('[startRound] Called. Setting up new round.');
    }
      if (DEBUG) {
        if (DEBUG) {
          console.log('[draw] Deck clicked');
          console.log('[startRound] Called. Setting up new round.');
        }
      }
    // Advance dealer to next player in the cycle and set ActivePlayer to the player after the dealer
    if (typeof game.dealerId !== 'undefined' && game.players && game.players.length > 0) {
      let currentDealerIdx = game.players.findIndex(p => p.id === game.dealerId);
      let nextDealerIdx = (currentDealerIdx + 1) % game.players.length;
      game.dealerId = game.players[nextDealerIdx].id;
      // Active player is the player after the dealer
      let firstPlayerIdx = (nextDealerIdx + 1) % game.players.length;
      game.ActivePlayer = firstPlayerIdx;
    }
    CardDealingDone = false;
    // determine current round's hand size: first round = 3 cards, then increment by 1 each round
    // Always deal roundCount + 2 cards (e.g., round 1: 3, round 2: 4, ...)
    let cardsToDeal = roundCount + 2;
    GameRound = cardsToDeal;
    firstRound = false;
    // reset per-turn counter
    game.turnNumber = 1;
    // fresh deck
    game.deck = new Deck();
    game.deck.shuffle();
    game.discardPile = [];
    clearBoard();
    // Remove score summary display if present (prevents redundant display after reload)
    const scoreSummary = document.getElementById('score-summary');
    if (scoreSummary) scoreSummary.remove();
    // Deal cards to each player
    for (let player of game.players) {
      player.hand = [];
      player.melds = []; // Clear melds at the start of each round
      for (let i = 0; i < cardsToDeal; i++) {
        player.hand.push(game.deck.draw());
      }
    }
    // diagnostic: log hands after dealing
    if (DEBUG) {
      if (DEBUG) {
        console.log('startRound: GameRound=', GameRound, 'Deck size=', game.deck.cards.length);
        game.players.forEach((p, idx) => console.log(`player[${idx}] ${p.name} hand length:`, p.hand.length, p.hand.map(c => `${c.rank}-${c.suit}`)));
      }
    }
    // render all hands so clickable handlers are attached
    renderAllHands();
    // show deck back and set initial discard
    deckEl = document.getElementById('deck');
    if (deckEl) deckEl.innerHTML = '';
    displayCardBack('deck');
    const cardStart = game.deck.draw();
    game.discardPile.push(cardStart);
    updateDiscardPile(cardStart);
    CardDealingDone = true;
    refreshPlayerPanels();
    // Ensure player panels show latest scores
    game.players.forEach(p => {
      const panel = document.getElementById(p.id + '-panel');
      if (panel) {
        const scoreEl = panel.querySelector('.player-score');
        if (scoreEl) scoreEl.textContent = 'Score: ' + (p.score || 0);
      }
    });
    renderAllMelds(); // Clear melds display at end of round
    // initialize per-player discard flags
    game.players.forEach((p, idx) => {
      p.canDiscard = false;
      p.canDraw = false;
      p.lastDiscardTurn = undefined;
    });
    // Set canDraw for the player after the dealer (who is now the ActivePlayer)
    if (game.players[game.ActivePlayer]) {
      game.players[game.ActivePlayer].canDraw = true;
    }
    // Visually highlight the active player
    setActivePlayer(game.players[game.ActivePlayer].id);
    // Update round number and wilds display
    const roundNum = document.getElementById('round-number');
    if (roundNum) {
      roundNum.textContent = getRoundWildText(roundCount);
    }
    showmessage(`[startRound] After setup: Player ${game.ActivePlayer} (${game.players[game.ActivePlayer].name}) canDraw=${game.players[game.ActivePlayer].canDraw}, canDiscard=${game.players[game.ActivePlayer].canDiscard}`);
    // Force UI update and log after flag change
    renderAllHands();
    refreshPlayerPanels();
    showmessage('[UI refresh after flag change]');
    beginPlayerTurn(game.ActivePlayer);
    // Always re-attach deck click handler to draw for new round
    deckEl = document.getElementById('deck');
    if (deckEl) deckEl.onclick = draw;
  }

  startRound();

function displayCard(card, cardId){
  let cardImg = document.createElement("img");
  cardImg.alt = card.rank + "-" + card.suit ;
  cardImg.width = cardWidth
  cardImg.height = cardHeight

  cardImg.src = getCardImagePath(card);
  showmessage("Card path: " + cardImg.src + " in element: " + cardId);
  document.getElementById(cardId).append(cardImg);
}

function displayCardBack(cardId) {

  let cardImg = document.createElement("img");

  cardImg.alt = "Card Back";
  cardImg.width = cardWidth;
  cardImg.height = cardHeight

  cardImg.src = "./cards/back.png";
  showmessage("Card path: " + cardImg.src + " in element: " + cardId);
  document.getElementById(cardId).append(cardImg);
}

// Update the discard pile DOM to show the given card face-up (replace previous top)
function updateDiscardPile(card) {
  const discEl = document.getElementById('discard');
  if (!discEl) return;
  discEl.innerHTML = '';
  if (!card) return;
  const img = document.createElement('img');
  img.alt = card.rank + '-' + card.suit;
  img.width = cardWidth;
  img.height = cardHeight;
  img.src = getCardImagePath(card);
  discEl.appendChild(img);
  // store top card info for logic/debug
  discEl.dataset.top = `${card.rank}-${card.suit}`;
}

function getCardImagePath(card) {
  if (!card) return '';
  const rank = String(card.rank || '').toLowerCase();
  const suit = String(card.suit || '').toLowerCase();
  return `./cards/${rank}_of_${suit}.png`;
}

// Display a small player panel (name + score) next to the player's card area
function displayPlayer(player) {
  const panelId = player.id + "-panel";
  let panel = document.getElementById(panelId);
  // ensure players container exists at top of body
  let container = document.getElementById('players-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'players-container';
    container.className = 'players-container';
    document.body.insertBefore(container, document.body.firstChild);
  }

  if (!panel) {
    panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "player-panel";
    panel.dataset.playerId = player.id;
    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    panel.appendChild(nameEl);
    const scoreEl = document.createElement("div");
    scoreEl.className = "player-score";
    panel.appendChild(scoreEl);
    // click to select this player
    panel.addEventListener('click', () => {
      // prevent switching when another player still has a pending discard
      const pending = game.players.find(p => p.canDiscard);
      if (pending && pending.id !== player.id) {
        showMessage(`${pending.name} must finish their discard before switching players`);
        return;
      }
      setActivePlayer(player.id);
      const ix = game.players.findIndex(p => p.id === player.id);
      if (ix !== -1) game.ActivePlayer = ix;
    });
    container.appendChild(panel);
  }
  // Always update name and highlight
  const nameEl = panel.querySelector('.player-name');
  // Clear previous content
  nameEl.innerHTML = '';
  nameEl.textContent = player.name;
  // Add dealer badge if this player is the dealer
 /* if (window.game && window.game.dealerId && player.id === window.game.dealerId) {
    const dealerBadge = document.createElement('span');
    dealerBadge.className = 'dealer-badge';
    dealerBadge.textContent = ' DEALER ';
    nameEl.appendChild(dealerBadge);
  }
    */
  // Highlight active player name and panel
  if (window.game && window.game.players && window.game.players[window.game.ActivePlayer] && player.id === window.game.players[window.game.ActivePlayer].id) {
    nameEl.classList.add('active-player-name');
    panel.classList.add('active');
  } else {
    nameEl.classList.remove('active-player-name');
    panel.classList.remove('active');
  }
  // Only set score once, in refreshPlayerPanels or updatePlayerScore
  return panel;
}

function refreshPlayerPanels() {
  if (!window.game) return;
  updateDealerIndicator();
  game.players.forEach(p => {
    const panel = document.getElementById(p.id + '-panel');
    if (panel) {
      const scoreEl = panel.querySelector('.player-score');
      if (scoreEl) scoreEl.textContent = `Round: ${(p.roundscore !== undefined ? p.roundscore : 0)} / Game: ${(p.gamescore !== undefined ? p.gamescore : 0)}`;
      // Update dealer badge if needed
      const nameEl = panel.querySelector('.player-name');
      if (nameEl) {
        // Remove any existing dealer badge
        const oldBadge = nameEl.querySelector('.dealer-badge');
        if (oldBadge) oldBadge.remove();
        if (window.game && window.game.dealerId && p.id === window.game.dealerId) {
          /*const dealerBadge = document.createElement('span');
          dealerBadge.className = 'dealer-badge';
          dealerBadge.textContent = ' DEALER ';
          nameEl.appendChild(dealerBadge);
          */
        }
      }
    }
  });
}

function updatePlayerScore(playerId, score) {
  const panel = document.getElementById(playerId + "-panel");
  if (!panel) return;
  const scoreEl = panel.querySelector('.player-score');
  // Accepts either a number (gamescore) or an object with roundscore/gamescore
  if (scoreEl) {
    if (typeof score === 'object' && score !== null) {
      scoreEl.textContent = `Round: ${(score.roundscore !== undefined ? score.roundscore : 0)} / Game: ${(score.gamescore !== undefined ? score.gamescore : 0)}`;
    } else {
      scoreEl.textContent = `Game: ${score}`;
    }
  }
}

function setActivePlayer(playerId) {
  // Remove highlight from all panels and names
  document.querySelectorAll('.player-panel').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.player-name').forEach(el => el.classList.remove('active-player-name'));
  // Add highlight to current
  const panel = document.getElementById(playerId + '-panel');
  if (panel) {
    panel.classList.add('active');
    const nameEl = panel.querySelector('.player-name');
    if (nameEl) nameEl.classList.add('active-player-name');
  }
}

// Clear card DOM elements and player hands
function clearBoard() {
  if (!window.game) return;
  game.players.forEach(p => {
    for (let k = 1; k <= 12; k++) {
      const el = document.getElementById(p.id + 'card' + k);
      if (el) el.innerHTML = '';
    }
    p.hand = [];
  });
  deckEl = document.getElementById('deck'); if (deckEl) deckEl.innerHTML = '';
  const discardEl = document.getElementById('discard'); if (discardEl) discardEl.innerHTML = '';
}

// Start (or restart) a round: increment GameRound, create/shuffle deck, deal cards and set discard


// --- Scoring helpers and round end handling ---

function renderAllHands() {
  game.players.forEach(player => renderPlayerHand(player));
}

// Stub for renderAllMelds to prevent ReferenceError
function renderAllMelds() {
  // Render melds for all players
  game.players.forEach((player, idx) => {
    let panel = document.getElementById(`player-panel-${player.id}`);
    if (!panel) {
      // Create panel if missing
      panel = document.createElement('div');
      panel.id = `player-panel-${player.id}`;
      panel.className = 'player-panel';
      panel.innerHTML = `<div class='player-name'>${player.name}</div><div class='player-melds'></div>`;
      document.body.appendChild(panel);
    }
    const meldsEl = panel.querySelector('.player-melds');
    if (meldsEl) {
      meldsEl.innerHTML = '';
      if (player.melds && player.melds.length > 0) {
        player.melds.forEach((group, gidx) => {
          const groupEl = document.createElement('div');
          groupEl.className = 'meld-group';
          group.forEach(card => {
            const img = document.createElement('img');
            img.width = cardWidth; img.height = cardHeight;
            img.src = getCardImagePath(card);
            img.alt = card.rank + '-' + card.suit;
            groupEl.appendChild(img);
          });
          meldsEl.appendChild(groupEl);
        });
      } else {
        meldsEl.textContent = 'No melds yet.';
      }
    }
  });
}

// Stub for beginPlayerTurn to prevent ReferenceError
function beginPlayerTurn(playerIndex) {
  // Only update UI and re-attach deck click handler
  showmessage(`[beginPlayerTurn] (START) Activating player index: ${playerIndex}, name: ${game.players[playerIndex]?.name}`);
  showmessage(`[beginPlayerTurn] (START) game.ActivePlayer=${game.ActivePlayer}, name=${game.players[game.ActivePlayer]?.name}`);
  if (!game || !game.players || typeof playerIndex !== 'number') return;
  // Optionally, update UI or show message
  // showMessage(`It's ${game.players[playerIndex].name}'s turn!`);
  // Diagnostic: log active player and their flags before UI update
  const p = game.players[playerIndex];
  showMessage( `[beginPlayerTurn] Player ${playerIndex} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`
  );
  if (DEBUG) {
    game.players.forEach((pl, idx) => {
      console.log(`[beginPlayerTurn] Player ${idx} (${pl.name}) hand:`, pl.hand.map(c => `${c.rank}-${c.suit}`));
    });
  }
  // Re-attach deck click handler to ensure correct active player
  deckEl = document.getElementById('deck');
  if (deckEl) {
    deckEl.onclick = draw;
  }
  // Always show meld button for the active player, but only enable for them if canDiscard is true
  document.querySelectorAll('[id$="-meld-controls"]').forEach(ctrl => ctrl.remove());
  const meldBtn = document.getElementById('meld-btn');
  if (meldBtn) {
    meldBtn.style.display = '';
    meldBtn.onclick = null;
    meldBtn.addEventListener('click', Meld);
    // Only enable for active player and only if canDiscard is true
    if (game.ActivePlayer === playerIndex && game.players[playerIndex].canDiscard) {
      meldBtn.disabled = false;
    } else {
      meldBtn.disabled = true;
    }
  }
  // Auto-advance in final turns if player cannot act
  const player = game.players[playerIndex];
  if (game.finalTurnQueue &&
      !player.canDraw &&
      !player.canDiscard &&
      (!player.hand || player.hand.length < 3)) {
    // No possible action, skip to next final turn
    if (game.finalTurnQueue.length > 0) {
      const next = game.finalTurnQueue.shift();
      game.ActivePlayer = next;
      beginPlayerTurn(next);
    } else {
      checkAdvanceAfterFinalTurn();
    }
    return;
  }
  // If in final turns and the queue is empty, advance the round
  checkAdvanceAfterFinalTurn();
  // Ensure Meld button is visible for the active player after all checks (handled above)
}

// Wildcard detection for meld picker
function isWildcard(card) {
  if (!card) return false;
  return card.rank === 'joker' || Number(card.rank) === GameRound;
}

function renderPlayerHand(player) {
  // Add player name label above hand area
  let handContainer = document.getElementById(player.id + '-hand-container');
  if (!handContainer) {
    handContainer = document.createElement('div');
    handContainer.id = player.id + '-hand-container';
    handContainer.className = 'hand-container';
    const nameLabel = document.createElement('div');
    nameLabel.className = 'hand-player-name';
    nameLabel.textContent = `${player.name}`;
    handContainer.appendChild(nameLabel);
    // Insert before first card slot if possible
    const firstCard = document.getElementById(player.id + 'card1');
    if (firstCard && firstCard.parentNode) {
      firstCard.parentNode.insertBefore(handContainer, firstCard);
    } else {
      document.body.appendChild(handContainer);
    }
  } else {
    // Update name label with score if already present
    const nameLabel = handContainer.querySelector('.hand-player-name');
    if (nameLabel) {
      nameLabel.textContent = `${player.name}`;
    }
  }
  // Clear all possible card slots (up to 12)
  for (let k = 1; k <= 12; k++) {
    const el = document.getElementById(player.id + 'card' + k);
    if (el) el.innerHTML = '';
  }
  // Render current hand
  player.hand.forEach((card, idx) => {
    const el = document.getElementById(player.id + 'card' + (idx + 1));
    if (el) {
      displayCard(card, el.id);
      // Enable discard by clicking if allowed
      if (player.canDiscard && isActivePlayer(player)) {
        el.onclick = () => discardCardFromHand(idx);
        el.style.cursor = 'pointer';
      } else {
        el.onclick = null;
        el.style.cursor = '';
      }
    }
  });
}

// Helper to check if player is the active player
function isActivePlayer(player) {
  return game.players[game.ActivePlayer] === player;
}

// Discard a card from hand by index
function discardCardFromHand(cardIndex) {
        // If not in final turns, and all hands are empty, finalize round (safety net)
        if (!game.finalTurnQueue && game.players.every(p => p.hand.length === 0)) {
          finalizeRoundAfterFinalTurns();
          return;
        }
      // ...existing code...
      // Always re-attach deck click handler to draw for new active player
      let deckEl = document.getElementById('deck');
      if (deckEl) deckEl.onclick = draw;
    // Diagnostic: log flags for all players after discard and turn advance
    if (DEBUG) {
      console.log('[discard] After discard and turn advance:');
      game.players.forEach((p, idx) => {
        console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
      });
    }
    const player = game.players[game.ActivePlayer];
  if (!player || !player.canDiscard) {
    showMessage('You cannot discard right now');
    return;
  }
  if (cardIndex < 0 || cardIndex >= player.hand.length) return;
  let card = player.hand.splice(cardIndex, 1)[0];
  showmessage(`[discard] Player ${player.name} discarding card: ${card.rank}-${card.suit}`);
  game.discardPile.push(card);
  player.canDiscard = false;
  // End turn or advance to next player as needed
  player.canDraw = false;
  showmessage(`[canDraw=false] Set for Player ${game.ActivePlayer} (${player.name}) in discardCardFromHand()`);
  console.trace();
  player.canDiscard = false;
  renderPlayerHand(player);
  updateDiscardPile(card);
  // Disable meld button after discard for active player
  const meldBtn = document.getElementById('meld-btn');
  if (meldBtn && isActivePlayer(player)) {
    meldBtn.disabled = true;
    meldBtn.style.display = '';
  }
  // Check if player is out of cards (went out)
  if (player.hand.length === 0) {
    showmessage(`[end-of-round] Player ${player.name} went out. Triggering end-of-round logic.`);
    // If in final turns, remove this player from the queue if present
    if (game.finalTurnQueue) {
      showmessage('[finalTurnQueue] Player went out during final turns.');
      // Remove this player from the queue if present
      const idx = game.finalTurnQueue.indexOf(game.ActivePlayer);
      if (idx !== -1) {
        game.finalTurnQueue.splice(idx, 1);
        showmessage(`[finalTurnQueue] Removed player ${game.ActivePlayer} from queue after their final turn.`);
      }
      // If queue is empty, finalize round
      if (game.finalTurnQueue.length === 0) {
        finalizeRoundAfterFinalTurns();
        return;
      }
      // Otherwise, advance to the next player in the queue using shift()
      const next = game.finalTurnQueue.shift();
      if (typeof next !== 'undefined') {
        game.ActivePlayer = next;
        setActivePlayer(game.players[next].id);
        beginPlayerTurn(next);
      }
      return;
    }
    // If not in final turns, always trigger final turns for others (even in round 1)
    if (game.players.length > 1) {
      setupFinalTurns(game.ActivePlayer);
    } else {
      // For 1 player (should not happen), end round immediately
      finalizeRoundAfterFinalTurns();
    }
    return;
  }
  // If in final turns, check if queue is empty after this discard and only allow players in the queue to act
  if (game.finalTurnQueue) {
    showmessage(`[finalTurnQueue] After discard, queue length: ${game.finalTurnQueue.length}, contents: [${game.finalTurnQueue.map(i => game.players[i].name).join(', ')}]`);
    if (game.finalTurnQueue.length === 0) {
      showmessage('[finalTurnQueue] All final turns completed. Finalizing round.');
      finalizeRoundAfterFinalTurns();
      return;
    }
    // Advance to the next player in the queue
    const next = game.finalTurnQueue.shift();
    if (typeof next !== 'undefined') {
      game.players.forEach((p, idx) => { p.canDraw = false; p.canDiscard = false; });
      game.ActivePlayer = next;
      game.players[next].canDraw = true;
      game.players[next].canDiscard = true;
      renderAllHands();
      setActivePlayer(game.players[next].id);
      refreshPlayerPanels();
      deckEl = document.getElementById('deck');
      if (deckEl) deckEl.onclick = draw;
      if (DEBUG) {
        console.log('[turn advance] Player flags:');
        game.players.forEach((p, idx) => {
          console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
        });
      }
      return;
    }
  }
  // If not in final turns, advance as normal
  game.nextTurn();
  let newActive = game.players[game.ActivePlayer];
  game.players.forEach((p, idx) => {
    p.canDraw = false;
    p.canDiscard = false;
  });
  newActive.canDraw = true;
  newActive.canDiscard = false;
  game.players.forEach((p, idx) => {
    showmessage(`[After discard] Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
  });
  renderAllHands();
  setActivePlayer(game.players[game.ActivePlayer].id);
  refreshPlayerPanels();
  deckEl = document.getElementById('deck');
  if (deckEl) deckEl.onclick = draw;
  if (DEBUG) {
    console.log('[turn advance] Player flags:');
    game.players.forEach((p, idx) => {
      console.log(`  Player ${idx} (${p.name}): canDraw=${p.canDraw}, canDiscard=${p.canDiscard}`);
    });
  }
}

// Stub: Validate meld group (always valid for now)
function validateMeld(group) {
  // Five Crowns meld validation: set or run, jokers allowed
  if (!group || group.length < 3) {
    showmessage('[validateMeld] Invalid: less than 3 cards');
    return { valid: false };
  }
  // Only treat the current round's wild rank as wild
  const wildRank = typeof GameRound !== 'undefined' ? String(GameRound) : '3';
  // Treat jokers and wild cards (of current round rank) as jokers
  const jokers = group.filter(c => c.rank === 'joker' || c.rank === wildRank);
  const nonJokers = group.filter(c => c.rank !== 'joker' && c.rank !== wildRank);
  const rankValue = r => {
    if (r === 'jack') return 11;
    if (r === 'queen') return 12;
    if (r === 'king') return 13;
    return Number(r);
  };
  const ranks = nonJokers.map(c => c.rank);
  const suits = nonJokers.map(c => c.suit);
  const uniqueRanks = [...new Set(ranks)];
  const uniqueSuits = [...new Set(suits)];
  showmessage('[validateMeld] Attempted meld:', group.map(c => `${c.rank}-${c.suit}`));
  // Set: all non-jokers same rank, suits unique
  // Allow sets with jokers and wilds (current round rank)
  if (uniqueRanks.length === 1 && uniqueSuits.length === nonJokers.length) {
    showmessage('[validateMeld] Valid set');
    return { valid: true, type: 'set' };
  }
  // If all non-jokers are the same rank, and the rest are jokers/wilds, it's a valid set
  if (nonJokers.length > 0 && uniqueRanks.length === 1 && group.length >= 3 && (nonJokers.length + jokers.length === group.length)) {
    showmessage('[validateMeld] Valid set (with wilds/jokers)');
    return { valid: true, type: 'set' };
  }
  // Run: all non-jokers same suit, ranks sequential
  if (uniqueSuits.length === 1) {
    let values = nonJokers.map(c => rankValue(c.rank)).sort((a,b) => a-b);
    let gaps = 0;
    for (let i = 1; i < values.length; i++) {
      gaps += values[i] - values[i-1] - 1;
    }
    showmessage(`[validateMeld] Run gaps: ${gaps}, jokers: ${jokers.length}`);
    if (gaps <= jokers.length) {
      showmessage('[validateMeld] Valid run');
      return { valid: true, type: 'run' };
    } else {
      showmessage('[validateMeld] Invalid run: too many gaps');
    }
  } else {
    showmessage('[validateMeld] Invalid run: not all same suit');
  }
  showmessage('[validateMeld] Invalid meld');
  return { valid: false };
}

// Basic picker validation: enable Meld button if 3+ cards selected
function refreshPickerValidation(picker, player) {
  const okBtn = picker.querySelector('.meld-picker-actions button');
  const boxes = Array.from(picker.querySelectorAll('.meld-checkbox')).filter(b => b.checked);
  if (okBtn) okBtn.disabled = boxes.length < 3;
}

// Called when a player goes out; computes and applies round scores

// Patch for missing completeRoundAndDeal function
// This function should handle end-of-round logic, scoring, and starting the next round
function completeRoundAndDeal() {

  // 1. Compute and show round results
  const { roundResults } = endRound();
  showRoundResults(roundResults);
  // 1b. Add hands
  //  to history for this round
  addHandsToHistory(roundCount);

  // 2. Reset final turn state
  game.finalTurnQueue = undefined;
  game.finalOutPlayer = undefined;

  // 3. Check for game over (e.g., after 11 rounds)
  if (typeof roundCount !== 'undefined' && roundCount >= 11) {
    showMessage('Game over! Final scores:\n' + roundResults.map(r => `${r.name}: ${r.totalScore}`).join('\n'));
    return;
  }

  // 4. Increment roundCount for next round
  roundCount++;
  // Update round number UI immediately after increment
  const roundNum = document.getElementById('round-number');
  if (roundNum) {
    roundNum.textContent = getRoundWildText(roundCount);
  }
  // 5. Start the next round
  setTimeout(() => {
    startRound();
  }, 1000); // Short delay to let user see scores
}

// --- Meld functionality ---
function unMeld() {
  const player = getActivePlayer();
  if (!player || !player.melds || player.melds.length === 0) {
    showMessage('No melds to undo.');
    return;
  }
  // Remove the last meld group
  const lastMeld = player.melds.pop();
  // Add cards back to hand
  player.hand.push(...lastMeld);
  // Sort hand by rank and suit for consistency (optional)
  player.hand.sort((a, b) => {
    const rankOrder = ['3','4','5','6','7','8','9','10','J','Q','K','joker'];
    const suitOrder = ['hearts','spades','clubs','diamonds','stars'];
    const rA = rankOrder.indexOf(a.rank);
    const rB = rankOrder.indexOf(b.rank);
    if (rA !== rB) return rA - rB;
    return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  });
  renderAllHands();
  renderAllMelds();
  showMessage('Last meld undone.');

// --- UnDo discard functionality ---
function UnDo() {
  const player = getActivePlayer();
  if ( player.canDiscard === false) {
  player.hand.push(game.discardPile.pop());
  }  
}
function getActivePlayer() {
  // Prefer the UI-selected player panel if present, otherwise use game.ActivePlayer
  const activePanel = document.querySelector('.player-panel.active');
  if (activePanel && activePanel.dataset && activePanel.dataset.playerId) {
    const pid = activePanel.dataset.playerId;
    const idx = game.players.findIndex(p => p.id === pid);
    if (idx !== -1) return game.players[idx];
  }
  return game.players[game.ActivePlayer];
}

function Meld() {
  const player = getActivePlayer();
  if (!player) return;
  // Disable main Meld button while picker is open and remove any duplicate event listeners
  const mainMeldBtn = document.getElementById('meld-btn');
  if (mainMeldBtn) {
    mainMeldBtn.disabled = false;
    // Remove any duplicate event listeners by replacing with clone
    const newBtn = mainMeldBtn.cloneNode(true);
    newBtn.disabled = true;
    newBtn.onclick = null;
    newBtn.addEventListener('click', Meld);
    mainMeldBtn.parentNode.replaceChild(newBtn, mainMeldBtn);
  }
  // Remove any existing meld checkboxes
  document.querySelectorAll('.meld-checkbox').forEach(cb => cb.remove());
  // Remove any existing meld controls for all players
  document.querySelectorAll('[id$="-meld-controls"]').forEach(ctrl => ctrl.remove());
  // Add checkboxes to each card in hand
  let prefix = '';
  if (player.id === 'p1') prefix = 'p1card';
  else if (player.id === 'p2') prefix = 'p2card';
  else if (player.id === 'p3') prefix = 'p3card';
  player.hand.forEach((card, idx) => {
    const cardEl = document.getElementById(prefix + (idx + 1));
    if (cardEl && !cardEl.querySelector('.meld-checkbox')) {
      cardEl.style.position = 'relative';
      let cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'meld-checkbox';
      cb.dataset.idx = idx;
      cb.style.position = 'absolute';
      cb.style.top = '2px';
      cb.style.left = '2px';
      cb.style.zIndex = '10';
      cb.style.width = '18px';
      cb.style.height = '18px';
      cardEl.appendChild(cb);
      cardEl.onclick = (e) => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
        }
      };
      cb.onclick = (e) => { e.stopPropagation(); };
    }
  });
  // Add Meld Confirm and Cancel buttons above hand
  let controls = document.createElement('div');
  controls.id = player.id + '-meld-controls';
  controls.style.marginBottom = '8px';
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.justifyContent = 'center';
  const ok = document.createElement('button'); ok.textContent = 'Meld';
  const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
  controls.appendChild(ok); controls.appendChild(cancel);
  const handContainer = document.getElementById(player.id + '-hand-container') || document.body;
  // Insert controls as the first child after the name label (if present)
  if (handContainer.children.length > 0 && handContainer.children[0].classList.contains('hand-player-name')) {
    handContainer.insertBefore(controls, handContainer.children[1] || null);
  } else {
    handContainer.insertBefore(controls, handContainer.firstChild);
  }
  ok.onclick = () => {
    const boxes = Array.from(document.querySelectorAll('.meld-checkbox')).filter(b => b.checked);
    if (boxes.length < 3) { showMessage('Select at least 3 cards to meld'); return; }
    const indices = boxes.map(b => Number(b.dataset.idx)).sort((a,b) => b - a);
    if (indices.length >= player.hand.length) {
      showMessage('You must leave at least one card in your hand to discard.');
      return;
    }
    const group = indices.map(ix => player.hand[ix]);
    showmessage('[Meld] Attempting meld:', group.map(c => `${c.rank}-${c.suit}`));
    const validation = validateMeld(group);
    if (!validation.valid) { showMessage('Invalid meld: does not meet rules'); return; }
    const prevCanDraw = player.canDraw;
    const prevCanDiscard = player.canDiscard;
    for (const ix of indices) player.hand.splice(ix, 1);
    player.melds.push(group);
    game.players.forEach(p => { p.canDraw = false; p.canDiscard = false; });
    if (game.ActivePlayer === game.players.findIndex(p => p.id === player.id)) {
      player.canDraw = prevCanDraw;
      player.canDiscard = prevCanDiscard;
    }
    const pidx = game.players.findIndex(p => p.id === player.id);
    if (pidx !== -1) game.ActivePlayer = pidx;
    renderAllHands();
    renderAllMelds();
    if (DEBUG) showMessage('Meld created');
    document.querySelectorAll('.meld-checkbox').forEach(cb => cb.remove());
    if (controls) controls.remove();
    if (checkAdvanceAfterFinalTurn()) return;
  };
  cancel.onclick = () => {
    document.querySelectorAll('.meld-checkbox').forEach(cb => cb.remove());
    if (controls) controls.remove();
    // Restore discard click handlers for active player's hand
    player.hand.forEach((card, idx) => {
      const cardEl = document.getElementById(player.id + 'card' + (idx + 1));
      if (cardEl) {
        if (player.canDiscard && isActivePlayer(player)) {
          cardEl.onclick = () => discardCardFromHand(idx);
          cardEl.style.cursor = 'pointer';
        } else {
          cardEl.onclick = null;
          cardEl.style.cursor = '';
        }
      }
    });
  };
}

function openMeldPicker(player) {
  // remove existing picker
  const ex = document.getElementById('meld-picker');
  if (ex) ex.remove();

  var picker = document.createElement('div');
  picker.id = 'meld-picker';
  picker.className = 'meld-picker';

  const inner = document.createElement('div');
  inner.className = 'meld-picker-inner';
  const title = document.createElement('div');
  title.className = 'meld-picker-title';
  title.textContent = `Select cards to Meld - ${player.name}`;
  inner.appendChild(title);

  const list = document.createElement('div');
  list.className = 'meld-picker-list';

  // Always show current hand as selectable buttons
  if (player.hand && player.hand.length > 0) {
      player.hand.forEach((c, idx) => {
        const btn = document.createElement('button');
        btn.className = 'meld-pick-btn';
        const img = document.createElement('img');
        // ...existing code...
      });
  }
  inner.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'meld-picker-actions';
  const ok = document.createElement('button'); ok.textContent = 'Meld';
  const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
  actions.appendChild(ok); actions.appendChild(cancel);
  inner.appendChild(actions);
  picker.appendChild(inner);
  // Insert meld picker before the first player panel for visibility
  const firstPanel = document.querySelector('.player-panel');
  if (firstPanel && firstPanel.parentNode) {
    firstPanel.parentNode.insertBefore(picker, firstPanel);
  } else {
    document.body.appendChild(picker);
  }
  cancel.addEventListener('click', () => {
    picker.remove();
    // Re-enable main Meld button
    const mainMeldBtn = document.getElementById('meld-btn');
    if (mainMeldBtn) mainMeldBtn.disabled = false;
  });
  // initial validation state
  refreshPickerValidation(picker, player);
  ok.addEventListener('click', () => {
    const boxes = Array.from(picker.querySelectorAll('.meld-checkbox')).filter(b => b.checked);
    if (boxes.length < 3) { showMessage('Select at least 3 cards to meld'); return; }
    // collect selected indices, highest first to splice safely
    const indices = boxes.map(b => Number(b.dataset.idx)).sort((a,b) => b - a);
    const group = indices.map(ix => player.hand[ix]);
    // Debug: log meld attempt
    showmessage('[Meld Picker] Attempting meld:', group.map(c => `${c.rank}-${c.suit}`));
    const validation = validateMeld(group);
    if (!validation.valid) {
      showMessage('Invalid meld: does not meet rules');
      return;
    }
    // preserve current player's draw/discard permissions
    const prevCanDraw = player.canDraw;
    const prevCanDiscard = player.canDiscard;
    // Remove cards from hand (highest index first)
    for (const ix of indices.sort((a,b) => b - a)) {
      player.hand.splice(ix, 1);
    }
    player.melds.push(group);
    // ensure this player remains the active player and retains their draw/discard state
    game.players.forEach(p => { p.canDraw = false; p.canDiscard = false; });
    // Only restore canDraw/canDiscard for the active player after meld
    if (game.ActivePlayer === game.players.findIndex(p => p.id === player.id)) {
      player.canDraw = prevCanDraw;
      player.canDiscard = prevCanDiscard;
    }
    const pidx = game.players.findIndex(p => p.id === player.id);
    if (pidx !== -1) game.ActivePlayer = pidx;
    renderAllHands();
    renderAllMelds();
    if (DEBUG) showMessage('Meld created');
    picker.remove();
    // Re-enable main Meld button
    const mainMeldBtn = document.getElementById('meld-btn');
    if (mainMeldBtn) mainMeldBtn.disabled = false;
    // If in final turns, log queue length and check for round completion
    if (game.finalTurnQueue) {
      showmessage(`[finalTurnQueue] After meld, queue length: ${game.finalTurnQueue.length}`);
      if (checkAdvanceAfterFinalTurn()) return;
    }
  });
}

// When a player goes out (no cards left), set up a final-turn queue for the other players

function setupFinalTurns(outPlayerIndex) {
  // If finalTurnQueue already exists, do not rebuild it; just skip the player who went out
  if (game.finalTurnQueue && Array.isArray(game.finalTurnQueue)) {
    showmessage(`[setupFinalTurns] (final turns active) Player ${game.players[outPlayerIndex].name} went out. Remaining queue: [${game.finalTurnQueue.map(i => game.players[i].name).join(', ')}]`);
    if (game.finalTurnQueue.length === 0) {
      showmessage('[setupFinalTurns] Final turn queue empty. Finalizing round.');
      finalizeRoundAfterFinalTurns();
      return;
    }
    // Advance to next in queue using shift()
    const next = game.finalTurnQueue.shift();
    if (next !== undefined) {
      game.ActivePlayer = next;
      game.turnNumber = (game.turnNumber || 1) + 1;
      game.players.forEach((p, idx) => { p.canDraw = false; p.canDiscard = false; });
      game.players[next].canDraw = true;
      game.players[next].canDiscard = true;
      setActivePlayer(game.players[next].id);
      beginPlayerTurn(next);
    }
    return;
  }
  // Otherwise, build queue for first time
  const n = game.players.length;
  const queue = [];
  for (let i = 1; i < n; i++) {
    const idx = (outPlayerIndex + i) % n;
    queue.push(idx);
  }
  game.finalTurnQueue = queue.slice(); // copy to avoid mutation issues
  game.finalOutPlayer = outPlayerIndex;
  showmessage(`[setupFinalTurns] Player ${game.players[outPlayerIndex].name} went out. Final turn queue: [${queue.map(i => game.players[i].name).join(', ')}]`);
  if (game.finalTurnQueue.length > 0) {
    const first = game.finalTurnQueue.shift();
    game.ActivePlayer = first;
    game.turnNumber = (game.turnNumber || 1) + 1;
    if (DEBUG) showMessage(`${game.players[outPlayerIndex].name} went out — final turns start with ${game.players[first].name}`);
    game.players.forEach((p, idx) => { p.canDraw = false; p.canDiscard = false; });
    game.players[first].canDraw = true;
    game.players[first].canDiscard = true;
    beginPlayerTurn(first);
  } else {
    showmessage('[setupFinalTurns] No other players for final turns. Finalizing round immediately.');
    finalizeRoundAfterFinalTurns();
  }
}

function finalizeRoundAfterFinalTurns() {
  showmessage('[finalizeRoundAfterFinalTurns] Called. Advancing to completeRoundAndDeal.');
  // Ensure all players have finished their final turn before ending round
  if (game.finalTurnQueue && game.finalTurnQueue.length > 0) {
    showmessage('[finalizeRoundAfterFinalTurns] Not all final turns complete. Waiting.');
    return;
  }
  completeRoundAndDeal();
}




// Allow DEBUG to be toggled from UI
window.addEventListener('DOMContentLoaded', function() {
  var debugToggle = document.getElementById('debug-toggle');
  // Restore DEBUG from localStorage if present
  if (localStorage.getItem('fivecrowns_debug') !== null) {
    DEBUG = localStorage.getItem('fivecrowns_debug') === 'true';
  }
  if (debugToggle) {
    debugToggle.checked = DEBUG;
    debugToggle.addEventListener('change', function() {
      DEBUG = debugToggle.checked;
      localStorage.setItem('fivecrowns_debug', DEBUG);
      if (DEBUG) {
        console.log('[DEBUG] Debug mode enabled');
      } else {
        console.log('[DEBUG] Debug mode disabled');
      }
    });
  }
});
}